/**
 * Durable local Registry storage for dsh-api-kit.
 *
 * This module deliberately does not depend on Cordis or a DSH Service. The Host
 * adapter can inject a filesystem implementation later; tests use the same
 * small adapter contract without touching the real filesystem.
 */

import { copyFile, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import {
  REGISTRY_SCHEMA_VERSION,
  createEmptyRegistry,
  migrateRegistry,
  normalizeRegistry,
} from './model.js'
import { isRecord } from './normalizers.js'
import { RegistryStoreError } from './errors.js'
import { createRegistryArchive } from './registry-archive.js'

export const REGISTRY_ERROR_CODES = Object.freeze([
  'INVALID_OPTIONS',
  'REGISTRY_ROOT_INVALID',
  'SCHEMA_VERSION_INVALID',
  'SCHEMA_VERSION_UNSUPPORTED',
  'JSON_PARSE',
  'NORMALIZATION_INVALID',
  'INTEGRITY_INVALID',
  'LOAD_FAILED',
  'WRITE_FAILED',
  'BACKUP_FAILED',
  'ARCHIVE_FAILED',
])

const REQUIRED_FS_METHODS = Object.freeze(['readFile', 'writeFile', 'rename', 'mkdir', 'unlink', 'copyFile'])
const DEFAULT_MAX_BACKUPS = 3

const nodeFsAdapter = Object.freeze({
  readFile,
  writeFile,
  rename,
  mkdir,
  unlink,
  copyFile,
  readdir,
})

function cloneJson(value) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

function isNotFound(error) {
  return error?.code === 'ENOENT'
}

function errorSummary(error) {
  if (!error) return undefined
  return {
    name: typeof error.name === 'string' ? error.name : 'Error',
    code: typeof error.code === 'string' ? error.code : undefined,
    message: typeof error.message === 'string' ? error.message : String(error),
  }
}

function safeClockValue(clock) {
  const value = typeof clock === 'function' ? clock() : clock
  const date = value instanceof Date ? value : new Date(value ?? Date.now())
  if (Number.isNaN(date.getTime())) throw new TypeError('clock must return a valid date')
  return date.toISOString()
}

function safeFileName(value, fallback) {
  if (typeof value !== 'string') return fallback
  const name = value.trim()
  if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) return fallback
  return name
}

function validateFsAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') {
    throw new RegistryStoreError('INVALID_OPTIONS', 'fs adapter is required')
  }
  const missing = REQUIRED_FS_METHODS.filter((name) => typeof adapter[name] !== 'function')
  if (missing.length > 0) {
    throw new RegistryStoreError('INVALID_OPTIONS', `fs adapter is missing: ${missing.join(', ')}`, {
      detail: { missing },
    })
  }
  return adapter
}

function resolveHome(dshHome) {
  const candidate = typeof dshHome === 'string' && dshHome.trim()
    ? dshHome.trim()
    : (typeof process !== 'undefined' && process.env?.DSH_HOME ? process.env.DSH_HOME : '')
  if (candidate) return candidate
  if (typeof os.homedir === 'function') return path.join(os.homedir(), '.dsh')
  throw new RegistryStoreError('INVALID_OPTIONS', 'dshHome is required when the home directory is unavailable')
}

export function defaultRegistryPath(dshHome, options = {}) {
  if (isRecord(dshHome)) {
    options = dshHome
    dshHome = options.dshHome
  }
  const home = resolveHome(dshHome)
  const storageDirectory = typeof options.storageDirectory === 'string' && options.storageDirectory.trim()
    ? options.storageDirectory
    : path.join(home, 'storages', 'dsh-api-kit')
  const fileName = safeFileName(options.fileName, 'registry.json')
  return path.resolve(storageDirectory, fileName)
}

function pushIssue(list, code, message, issuePath, detail, kind = 'integrity') {
  list.push({ code, message, path: issuePath, ...(detail ? { detail } : {}), kind })
}

function uniqueEntityIds(values, field, errors) {
  const ids = new Set()
  if (!Array.isArray(values)) {
    pushIssue(errors, 'ENTITY_LIST_INVALID', `${field} must be an array`, field, undefined, 'shape')
    return ids
  }
  values.forEach((item, index) => {
    const id = item?.id
    if (typeof id !== 'string' || !id) {
      pushIssue(errors, 'ENTITY_ID_INVALID', `${field}[${index}] has no valid id`, `${field}[${index}].id`)
      return
    }
    if (ids.has(id)) {
      pushIssue(errors, 'DUPLICATE_ID', `${field} contains duplicate id: ${id}`, `${field}[${index}].id`, { id })
    }
    ids.add(id)
  })
  return ids
}

function reference(errors, source, sourcePath, target, targetField, targetType) {
  if (!target) return
  if (!target.has(targetField)) {
    pushIssue(
      errors,
      'DANGLING_REFERENCE',
      `${source} references missing ${targetType}: ${targetField}`,
      sourcePath,
      { target: targetType, id: targetField },
      'reference',
    )
  }
}

/**
 * Check canonical Registry references without mutating the input.
 *
 * The result has both `ok` and `valid` aliases for callers that prefer either
 * spelling. In `warn` mode dangling references become warnings, while malformed
 * entity shapes and duplicate IDs remain errors.
 */
export function validateRegistryIntegrity(registry, options = {}) {
  const errors = []
  const warnings = []
  if (!isRecord(registry)) {
    pushIssue(errors, 'REGISTRY_ROOT_INVALID', 'Registry root must be an object', '')
    return { ok: false, valid: false, errors, warnings }
  }
  if (Number(registry.schemaVersion) !== REGISTRY_SCHEMA_VERSION) {
    pushIssue(errors, 'SCHEMA_VERSION_UNSUPPORTED', `Unsupported Registry schemaVersion: ${registry.schemaVersion}`, 'schemaVersion', {
      expected: REGISTRY_SCHEMA_VERSION,
      actual: registry.schemaVersion,
    }, 'schema')
  }

  const kits = uniqueEntityIds(registry.kits, 'kits', errors)
  const operations = uniqueEntityIds(registry.operations, 'operations', errors)
  const targets = uniqueEntityIds(registry.serviceTargets, 'serviceTargets', errors)
  const environments = uniqueEntityIds(registry.environments, 'environments', errors)
  const authProfiles = uniqueEntityIds(registry.authProfiles, 'authProfiles', errors)

  for (const [index, kit] of (Array.isArray(registry.kits) ? registry.kits.entries() : [])) {
    for (const id of Array.isArray(kit.operationIds) ? kit.operationIds : []) {
      reference(errors, 'kit', `kits[${index}].operationIds`, operations, id, 'operation')
    }
    for (const id of Array.isArray(kit.serviceTargetIds) ? kit.serviceTargetIds : []) {
      reference(errors, 'kit', `kits[${index}].serviceTargetIds`, targets, id, 'serviceTarget')
    }
    for (const id of Array.isArray(kit.environmentIds) ? kit.environmentIds : []) {
      reference(errors, 'kit', `kits[${index}].environmentIds`, environments, id, 'environment')
    }
    if (kit.defaultEnvironmentId) {
      reference(errors, 'kit', `kits[${index}].defaultEnvironmentId`, environments, kit.defaultEnvironmentId, 'environment')
    }
  }

  for (const [index, operation] of (Array.isArray(registry.operations) ? registry.operations.entries() : [])) {
    if (operation.serviceTargetId) {
      reference(errors, 'operation', `operations[${index}].serviceTargetId`, targets, operation.serviceTargetId, 'serviceTarget')
    }
    if (operation.authProfileId) {
      reference(errors, 'operation', `operations[${index}].authProfileId`, authProfiles, operation.authProfileId, 'authProfile')
    }
    for (const id of Array.isArray(operation.kitIds) ? operation.kitIds : []) {
      reference(errors, 'operation', `operations[${index}].kitIds`, kits, id, 'kit')
    }
  }

  for (const [index, target] of (Array.isArray(registry.serviceTargets) ? registry.serviceTargets.entries() : [])) {
    for (const id of Array.isArray(target.environmentIds) ? target.environmentIds : []) {
      reference(errors, 'serviceTarget', `serviceTargets[${index}].environmentIds`, environments, id, 'environment')
    }
    for (const id of (target.endpoints && typeof target.endpoints === 'object' && !Array.isArray(target.endpoints) ? Object.keys(target.endpoints) : [])) {
      reference(errors, 'serviceTarget', `serviceTargets[${index}].endpoints.${id}`, environments, id, 'environment')
    }
    if (target.defaultEnvironmentId) {
      reference(errors, 'serviceTarget', `serviceTargets[${index}].defaultEnvironmentId`, environments, target.defaultEnvironmentId, 'environment')
    }
    for (const id of Array.isArray(target.authProfileIds) ? target.authProfileIds : []) {
      reference(errors, 'serviceTarget', `serviceTargets[${index}].authProfileIds`, authProfiles, id, 'authProfile')
    }
  }

  if (options.mode === 'warn') {
    for (const issue of errors) {
      if (issue.kind === 'reference') warnings.push(issue)
    }
  }
  const remainingErrors = options.mode === 'warn' ? errors.filter((issue) => issue.kind !== 'reference') : errors
  return {
    ok: remainingErrors.length === 0,
    valid: remainingErrors.length === 0,
    errors: remainingErrors,
    warnings,
  }
}

export function prepareRegistryForLoad(input, options = {}) {
  if (!isRecord(input)) {
    throw new RegistryStoreError('REGISTRY_ROOT_INVALID', 'Registry root must be a JSON object')
  }
  const rawVersion = input.schemaVersion ?? input.version ?? 0
  const version = Number(rawVersion)
  if (!Number.isInteger(version) || version < 0) {
    throw new RegistryStoreError('SCHEMA_VERSION_INVALID', 'Registry schemaVersion must be a non-negative integer', {
      detail: { actual: rawVersion },
    })
  }
  if (version > REGISTRY_SCHEMA_VERSION) {
    throw new RegistryStoreError('SCHEMA_VERSION_UNSUPPORTED', `Registry schemaVersion ${version} is newer than supported version ${REGISTRY_SCHEMA_VERSION}`, {
      detail: { actual: version, supported: REGISTRY_SCHEMA_VERSION },
    })
  }

  let normalized
  try {
    normalized = normalizeRegistry(migrateRegistry(input))
  } catch (cause) {
    throw new RegistryStoreError('NORMALIZATION_INVALID', 'Registry contains values that cannot be normalized safely', { cause })
  }
  const integrity = validateRegistryIntegrity(normalized, options)
  if (!integrity.ok) {
    throw new RegistryStoreError('INTEGRITY_INVALID', 'Registry contains invalid entity references', {
      detail: { errors: integrity.errors, warnings: integrity.warnings },
    })
  }
  return normalized
}

export function stampRegistry(registry, clock = () => new Date()) {
  const normalized = normalizeRegistry(registry)
  const now = safeClockValue(clock)
  normalized.metadata.createdAt = normalized.metadata.createdAt || now
  normalized.metadata.updatedAt = now
  return normalized
}

function backupPath(filePath, index) {
  return index === 0 ? `${filePath}.bak` : `${filePath}.bak.${index}`
}

function corruptPath(filePath, stamp, sequence) {
  return `${filePath}.corrupt-${stamp.replace(/[^0-9TZ-]/g, '')}-${sequence}.json`
}

function tempPath(filePath) {
  return `${filePath}.tmp-${randomUUID()}`
}

async function bestEffortUnlink(fsAdapter, target) {
  try {
    await fsAdapter.unlink(target)
    return true
  } catch (error) {
    return isNotFound(error)
  }
}

async function fileExists(fsAdapter, target) {
  try {
    await fsAdapter.readFile(target)
    return true
  } catch (error) {
    if (isNotFound(error)) return false
    throw error
  }
}

function resultSnapshot(snapshot) {
  return cloneJson(snapshot)
}

export function createRegistryStore(options = {}) {
  if (!isRecord(options)) throw new RegistryStoreError('INVALID_OPTIONS', 'store options must be an object')
  const fsAdapter = validateFsAdapter(options.fs ?? nodeFsAdapter)
  const filePath = path.resolve(options.filePath ?? defaultRegistryPath(options.dshHome, options))
  const directory = path.dirname(filePath)
  const maxBackups = Number.isInteger(options.maxBackups)
    ? Math.max(0, Math.min(options.maxBackups, 20))
    : DEFAULT_MAX_BACKUPS
  const clock = options.clock ?? (() => new Date())
  const rethrowLoadErrors = options.rethrowLoadErrors === true
  const cleanupTemps = options.cleanupTemps !== false
  const archive = createRegistryArchive({
    fs: fsAdapter,
    registryPath: filePath,
    clock,
    mode: options.openApiArchiveMode ?? options.archiveMode ?? 'none',
    allowRaw: options.allowRawOpenApi === true,
  })

  let snapshot = createEmptyRegistry()
  let loaded = false
  let diagnostic
  let corruptSequence = 0
  let queue = Promise.resolve()

  const enqueue = (task) => {
    const result = queue.then(task, task)
    queue = result.then(() => undefined, () => undefined)
    return result
  }

  const cleanTemporaryFiles = async () => {
    if (!cleanupTemps || typeof fsAdapter.readdir !== 'function') return
    let names
    try {
      names = await fsAdapter.readdir(directory)
    } catch (error) {
      if (isNotFound(error)) return
      return
    }
    const prefix = `${path.basename(filePath)}.tmp-`
    for (const name of names) {
      if (typeof name === 'string' && name.startsWith(prefix)) {
        await bestEffortUnlink(fsAdapter, path.join(directory, name))
      }
    }
  }

  const preserveDamagedFile = async () => {
    let exists
    try {
      exists = await fileExists(fsAdapter, filePath)
    } catch (cause) {
      return { path: undefined, error: errorSummary(cause) }
    }
    if (!exists) return { path: undefined }
    corruptSequence += 1
    const name = corruptPath(filePath, safeClockValue(clock), corruptSequence)
    try {
      await fsAdapter.copyFile(filePath, name)
      return { path: name }
    } catch (cause) {
      return { path: undefined, error: errorSummary(cause) }
    }
  }

  const rotateBackups = async () => {
    if (maxBackups <= 0) return
    let exists
    try {
      exists = await fileExists(fsAdapter, filePath)
    } catch (cause) {
      throw new RegistryStoreError('BACKUP_FAILED', 'Unable to inspect the existing Registry before saving', {
        path: filePath,
        cause,
      })
    }
    if (!exists) return
    try {
      await bestEffortUnlink(fsAdapter, backupPath(filePath, maxBackups))
      for (let index = maxBackups - 2; index >= 0; index -= 1) {
        const source = backupPath(filePath, index)
        const target = backupPath(filePath, index + 1)
        try {
          // Windows cannot rename over an existing destination. Removing the
          // destination first is safe because the source backup still exists.
          await bestEffortUnlink(fsAdapter, target)
          await fsAdapter.rename(source, target)
        } catch (error) {
          if (!isNotFound(error)) throw error
        }
      }
      await fsAdapter.copyFile(filePath, backupPath(filePath, 0))
    } catch (cause) {
      throw new RegistryStoreError('BACKUP_FAILED', 'Unable to create the Registry backup', {
        path: filePath,
        cause,
      })
    }
  }

  const atomicReplace = async (temporary) => {
    try {
      await fsAdapter.rename(temporary, filePath)
      return
    } catch (firstError) {
      // Node's Windows fs.rename does not replace an existing file. Only the
      // platform's destination-exists errors may use the move-aside fallback;
      // arbitrary I/O failures must leave the old file untouched.
      if (!['EEXIST', 'EPERM', 'ENOTEMPTY'].includes(firstError?.code)) throw firstError
      let existing = false
      try { existing = await fileExists(fsAdapter, filePath) } catch {}
      if (!existing) throw firstError
      const oldPath = `${filePath}.swap-old-${randomUUID()}`
      await fsAdapter.rename(filePath, oldPath)
      try {
        await fsAdapter.rename(temporary, filePath)
      } catch (secondError) {
        try { await fsAdapter.rename(oldPath, filePath) } catch {}
        throw secondError
      }
      await bestEffortUnlink(fsAdapter, oldPath)
    }
  }

  const persist = async (candidate) => {
    await fsAdapter.mkdir(directory, { recursive: true })
    await rotateBackups()
    const temporary = tempPath(filePath)
    const serialized = `${JSON.stringify(candidate, null, 2)}\n`
    try {
      await fsAdapter.writeFile(temporary, serialized, 'utf8')
      await atomicReplace(temporary)
    } catch (cause) {
      await bestEffortUnlink(fsAdapter, temporary)
      throw new RegistryStoreError('WRITE_FAILED', 'Unable to atomically save the Registry', {
        path: filePath,
        cause,
      })
    }
    return candidate
  }

  const load = () => enqueue(async () => {
    await fsAdapter.mkdir(directory, { recursive: true })
    await cleanTemporaryFiles()
    let text
    try {
      text = await fsAdapter.readFile(filePath, 'utf8')
    } catch (cause) {
      if (isNotFound(cause)) {
        snapshot = createEmptyRegistry()
        loaded = true
        diagnostic = undefined
        return {
          registry: resultSnapshot(snapshot),
          snapshot: resultSnapshot(snapshot),
          path: filePath,
          recovered: false,
          migrated: false,
          diagnostic: undefined,
        }
      }
      const error = new RegistryStoreError('LOAD_FAILED', 'Unable to read the Registry file', { path: filePath, cause })
      snapshot = createEmptyRegistry()
      loaded = true
      diagnostic = error.toJSON()
      if (rethrowLoadErrors) throw error
      return {
        registry: resultSnapshot(snapshot),
        snapshot: resultSnapshot(snapshot),
        path: filePath,
        recovered: true,
        migrated: false,
        diagnostic: cloneJson(diagnostic),
      }
    }

    let parsed
    try {
      parsed = JSON.parse(String(text))
    } catch (cause) {
      const error = new RegistryStoreError('JSON_PARSE', 'Registry JSON is invalid', { path: filePath, cause })
      const preserved = await preserveDamagedFile()
      snapshot = createEmptyRegistry()
      loaded = true
      diagnostic = {
        ...error.toJSON(),
        recovered: true,
        preservedPath: preserved.path,
        preserveError: preserved.error,
      }
      if (rethrowLoadErrors) throw error
      return {
        registry: resultSnapshot(snapshot),
        snapshot: resultSnapshot(snapshot),
        path: filePath,
        recovered: true,
        migrated: false,
        diagnostic: cloneJson(diagnostic),
      }
    }

    try {
      const version = Number(parsed?.schemaVersion ?? parsed?.version ?? 0)
      const prepared = prepareRegistryForLoad(parsed)
      const migrated = version !== REGISTRY_SCHEMA_VERSION
      snapshot = prepared
      loaded = true
      diagnostic = undefined
      return {
        registry: resultSnapshot(snapshot),
        snapshot: resultSnapshot(snapshot),
        path: filePath,
        recovered: false,
        migrated,
        diagnostic: undefined,
      }
    } catch (cause) {
      const error = cause instanceof RegistryStoreError
        ? cause
        : new RegistryStoreError('LOAD_FAILED', 'Registry validation failed', { path: filePath, cause })
      const preserved = await preserveDamagedFile()
      snapshot = createEmptyRegistry()
      loaded = true
      diagnostic = {
        ...error.toJSON(),
        recovered: true,
        preservedPath: preserved.path,
        preserveError: preserved.error,
      }
      if (rethrowLoadErrors) throw error
      return {
        registry: resultSnapshot(snapshot),
        snapshot: resultSnapshot(snapshot),
        path: filePath,
        recovered: true,
        migrated: false,
        diagnostic: cloneJson(diagnostic),
      }
    }
  })

  const replace = (next) => enqueue(async () => {
    const prepared = prepareRegistryForLoad(next)
    const candidate = stampRegistry(prepared, clock)
    await persist(candidate)
    snapshot = candidate
    loaded = true
    diagnostic = undefined
    return resultSnapshot(snapshot)
  })

  const update = (mutator) => enqueue(async () => {
    if (typeof mutator !== 'function') throw new RegistryStoreError('INVALID_OPTIONS', 'update requires a function')
    const draft = resultSnapshot(snapshot)
    const result = await mutator(draft)
    const prepared = prepareRegistryForLoad(result === undefined ? draft : result)
    const candidate = stampRegistry(prepared, clock)
    await persist(candidate)
    snapshot = candidate
    loaded = true
    diagnostic = undefined
    return resultSnapshot(snapshot)
  })

  const save = () => enqueue(async () => {
    const prepared = prepareRegistryForLoad(snapshot)
    const candidate = stampRegistry(prepared, clock)
    await persist(candidate)
    snapshot = candidate
    loaded = true
    diagnostic = undefined
    return resultSnapshot(snapshot)
  })

  const saveImport = (document, importOptions = {}) => enqueue(async () => {
    try {
      return await archive.save(document, importOptions)
    } catch (cause) {
      if (cause instanceof RegistryStoreError) throw cause
      throw new RegistryStoreError('ARCHIVE_FAILED', 'Unable to save the OpenAPI import archive', {
        path: archive.path,
        cause,
      })
    }
  })

  return Object.freeze({
    path: filePath,
    archive,
    load,
    getSnapshot: () => resultSnapshot(snapshot),
    getDiagnostics: () => cloneJson(diagnostic),
    isLoaded: () => loaded,
    replace,
    update,
    save,
    saveImport,
  })
}

export { nodeFsAdapter }
export { RegistryStoreError } from './errors.js'
