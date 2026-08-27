/**
 * Optional OpenAPI import archive.
 *
 * Registry persistence never writes the source document. An archive is an
 * explicit, separate operation and defaults to `none`.
 */

import { randomUUID } from 'node:crypto'
import { writeFile, rename, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { normalizeJsonValue } from './normalizers.js'
import { RegistryStoreError } from './errors.js'

const DEFAULT_MODE = 'none'
const MODES = Object.freeze(['none', 'sanitized', 'raw'])
const SECRET_KEY = /(authorization|cookie|password|passwd|secret|token|api[-_]?key|client[-_]?secret|private[-_]?key|access[-_]?key)/i
const RESERVED_FILE_CHARS = /[^A-Za-z0-9._-]+/g

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function safeFileName(value, fallback = 'import') {
  if (typeof value !== 'string') return fallback
  const cleaned = value.trim().replace(RESERVED_FILE_CHARS, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 120)
  return cleaned || fallback
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function sanitize(value, depth = 0) {
  if (depth > 12) return '[Truncated]'
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => sanitize(item, depth + 1))
  if (!isRecord(value)) {
    if (typeof value === 'string' && value.length > 12000) return value.slice(0, 12000)
    return value
  }
  const result = {}
  for (const [key, child] of Object.entries(value).slice(0, 2000)) {
    if (SECRET_KEY.test(key)) {
      result[key] = '[REDACTED]'
    } else {
      result[key] = sanitize(child, depth + 1)
    }
  }
  return result
}

function jsonText(value) {
  const encoded = JSON.stringify(value, null, 2)
  if (encoded === undefined) throw new TypeError('document must be JSON-serializable')
  return `${encoded}\n`
}

export function createRegistryArchive(options = {}) {
  const fs = options.fs
  const registryPath = typeof options.registryPath === 'string' && options.registryPath ? options.registryPath : ''
  if (!fs || !registryPath) throw new RegistryStoreError('INVALID_OPTIONS', 'archive requires fs and registryPath')
  const configuredMode = options.mode ?? DEFAULT_MODE
  const mode = MODES.includes(configuredMode) ? configuredMode : DEFAULT_MODE
  const allowRaw = options.allowRaw === true
  const directory = path.join(path.dirname(registryPath), 'imports')
  const clock = options.clock ?? (() => new Date())

  const save = async (document, saveOptions = {}) => {
    const requestedMode = saveOptions.mode ?? mode
    if (!MODES.includes(requestedMode)) {
      throw new RegistryStoreError('ARCHIVE_FAILED', `Unsupported archive mode: ${requestedMode}`, { path: directory })
    }
    if (requestedMode === 'none') {
      return { saved: false, mode: 'none', path: undefined, raw: false }
    }
    if (requestedMode === 'raw' && !allowRaw && saveOptions.allowRaw !== true) {
      throw new RegistryStoreError('ARCHIVE_FAILED', 'Raw OpenAPI archive requires explicit allowRaw configuration', { path: directory })
    }
    let normalized
    try {
      normalized = normalizeJsonValue(document, { maxDepth: 16, maxKeys: 10000, maxArray: 1000, maxString: 12000, maxBytes: 1024 * 1024 })
    } catch (cause) {
      throw new RegistryStoreError('ARCHIVE_FAILED', 'OpenAPI import is not a bounded JSON document', { path: directory, cause })
    }
    const archived = requestedMode === 'sanitized' ? sanitize(normalized) : normalized
    const stampValue = clock instanceof Function ? clock() : clock
    const stamp = new Date(stampValue ?? Date.now()).toISOString().replace(/[:.]/g, '-')
    const base = safeFileName(saveOptions.name ?? saveOptions.fileName ?? 'openapi-import')
    const filePath = path.join(directory, `${base}-${stamp}-${randomUUID()}.json`)
    const temporary = `${filePath}.tmp`
    try {
      await fs.mkdir(directory, { recursive: true })
      await fs.writeFile(temporary, jsonText(archived), 'utf8')
      await fs.rename(temporary, filePath)
    } catch (cause) {
      try { await fs.unlink(temporary) } catch {}
      throw new RegistryStoreError('ARCHIVE_FAILED', 'Unable to atomically save the OpenAPI archive', { path: filePath, cause })
    }
    return { saved: true, mode: requestedMode, path: filePath, raw: requestedMode === 'raw' }
  }

  return Object.freeze({
    mode,
    path: directory,
    save,
    sanitize: (document) => clone(sanitize(document)),
  })
}

export { MODES as REGISTRY_ARCHIVE_MODES }
