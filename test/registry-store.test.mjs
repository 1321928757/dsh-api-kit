import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import {
  REGISTRY_ERROR_CODES,
  RegistryStoreError,
  createRegistryStore,
  defaultRegistryPath,
  prepareRegistryForLoad,
  stampRegistry,
  validateRegistryIntegrity,
} from '../lib/registry-store.js'
import { createEmptyRegistry } from '../lib/model.js'
import { createMemoryFs } from './helpers/memory-fs.mjs'

const ROOT = path.resolve('registry-store-test-root')
const FILE = path.join(ROOT, 'storages', 'dsh-api-kit', 'registry.json')
const CLOCK = () => new Date('2026-08-27T12:34:56.000Z')

function validRegistry(overrides = {}) {
  return {
    ...createEmptyRegistry(),
    ...overrides,
  }
}

function storeWith(fs, options = {}) {
  return createRegistryStore({ fs, filePath: FILE, clock: CLOCK, ...options })
}

test('defaultRegistryPath follows DSH_HOME storage layout and rejects unsafe file names', () => {
  assert.equal(defaultRegistryPath('C:\\Users\\demo\\.dsh'), path.resolve('C:\\Users\\demo\\.dsh', 'storages', 'dsh-api-kit', 'registry.json'))
  assert.equal(defaultRegistryPath({ dshHome: 'C:\\Users\\demo\\.dsh', fileName: '../escape.json' }), path.resolve('C:\\Users\\demo\\.dsh', 'storages', 'dsh-api-kit', 'registry.json'))
})

test('missing adapter methods fail fast with INVALID_OPTIONS', () => {
  assert.throws(
    () => createRegistryStore({ fs: { readFile() {} }, filePath: FILE }),
    (error) => error instanceof RegistryStoreError && error.code === 'INVALID_OPTIONS',
  )
  assert.ok(REGISTRY_ERROR_CODES.includes('INTEGRITY_INVALID'))
})

test('first load creates directories and returns an empty safe Registry', async () => {
  const fs = createMemoryFs()
  const store = storeWith(fs)
  const result = await store.load()
  assert.equal(result.recovered, false)
  assert.equal(result.registry.schemaVersion, 1)
  assert.deepEqual(result.registry.kits, [])
  assert.equal(store.isLoaded(), true)
  assert.equal(fs.hasFile(FILE), false)
  assert.ok(fs.calls.some((call) => call.operation === 'mkdir'))
})

test('replace, update, load and snapshot use the latest committed Registry', async () => {
  const fs = createMemoryFs()
  const store = storeWith(fs)
  await store.load()
  const saved = await store.replace(validRegistry({ kits: [{ name: 'Ops' }] }))
  assert.equal(saved.kits[0].id, 'ops')
  assert.equal(saved.metadata.createdAt, '2026-08-27T12:34:56.000Z')
  assert.equal(saved.metadata.updatedAt, '2026-08-27T12:34:56.000Z')

  const updateResult = await store.update((draft) => {
    draft.kits[0].description = 'updated'
  })
  assert.equal(updateResult.kits[0].description, 'updated')
  assert.equal(store.getSnapshot().kits[0].description, 'updated')

  const external = store.getSnapshot()
  external.kits[0].description = 'mutated outside store'
  assert.equal(store.getSnapshot().kits[0].description, 'updated')

  const reloaded = storeWith(fs)
  const result = await reloaded.load()
  assert.equal(result.recovered, false)
  assert.equal(result.registry.kits[0].description, 'updated')
})

test('legacy registry aliases migrate to schemaVersion 1', async () => {
  const fs = createMemoryFs()
  fs.setFile(FILE, JSON.stringify({
    version: 0,
    collections: [{ name: 'Operations' }],
    endpoints: [{ method: 'GET', path: '/health' }],
    targets: [{ name: 'Backend' }],
    auth: [{ name: 'Token', type: 'bearer' }],
  }))
  const store = storeWith(fs)
  const result = await store.load()
  assert.equal(result.recovered, false)
  assert.equal(result.migrated, true)
  assert.equal(result.registry.schemaVersion, 1)
  assert.equal(result.registry.kits[0].id, 'operations')
  assert.equal(result.registry.operations[0].id, 'get-health')
  assert.equal(result.registry.serviceTargets[0].id, 'backend')
  assert.equal(result.registry.authProfiles[0].id, 'token')
  // Loading a migration does not silently rewrite the source file.
  assert.match(fs.getFile(FILE), /"version":0/)
})

test('future schema is rejected without replacing the previous in-memory snapshot', async () => {
  const fs = createMemoryFs()
  const store = storeWith(fs)
  await store.replace(validRegistry({ kits: [{ name: 'safe' }] }))
  fs.setFile(FILE, JSON.stringify({ schemaVersion: 99, kits: [] }))
  const result = await store.load()
  assert.equal(result.recovered, true)
  assert.equal(result.diagnostic.code, 'SCHEMA_VERSION_UNSUPPORTED')
  assert.deepEqual(result.registry.kits, [])
  assert.ok(fs.files.size >= 2, 'the unsupported file should be preserved')
})

test('invalid JSON is preserved and replaced by an empty safe snapshot', async () => {
  const fs = createMemoryFs()
  fs.setFile(FILE, '{ invalid json')
  const store = storeWith(fs)
  const result = await store.load()
  assert.equal(result.recovered, true)
  assert.equal(result.diagnostic.code, 'JSON_PARSE')
  assert.ok(result.diagnostic.preservedPath)
  assert.equal(fs.getFile(result.diagnostic.preservedPath), '{ invalid json')
  assert.deepEqual(store.getSnapshot(), createEmptyRegistry())
})

test('rethrowLoadErrors exposes a structured error while preserving the damaged file', async () => {
  const fs = createMemoryFs()
  fs.setFile(FILE, JSON.stringify({ schemaVersion: 1, kits: [{ name: 'kit', operationIds: ['missing'] }] }))
  const store = storeWith(fs, { rethrowLoadErrors: true })
  await assert.rejects(store.load(), (error) => error.code === 'INTEGRITY_INVALID' && error instanceof RegistryStoreError)
  assert.equal(store.getSnapshot().schemaVersion, 1)
  assert.ok([...fs.files.keys()].some((name) => name.includes('.corrupt-')))
})

test('integrity validation detects duplicate IDs and dangling references', () => {
  const registry = validRegistry({
    kits: [
      { id: 'kit', operationIds: ['missing'] },
      { id: 'kit' },
    ],
    operations: [],
    serviceTargets: [],
    environments: [],
    authProfiles: [],
  })
  const report = validateRegistryIntegrity(registry)
  assert.equal(report.ok, false)
  assert.ok(report.errors.some((item) => item.code === 'DUPLICATE_ID'))
  assert.ok(report.errors.some((item) => item.code === 'DANGLING_REFERENCE'))
  const warningReport = validateRegistryIntegrity(registry, { mode: 'warn' })
  assert.ok(warningReport.warnings.some((item) => item.code === 'DANGLING_REFERENCE'))
  assert.ok(warningReport.errors.some((item) => item.code === 'DUPLICATE_ID'))
})

test('atomic saves write a sibling temporary then rename and rotate backups', async () => {
  const fs = createMemoryFs()
  const store = storeWith(fs, { maxBackups: 2 })
  await store.replace(validRegistry({ kits: [{ name: 'first' }] }))
  fs.resetCalls()
  await store.update((draft) => { draft.kits[0].name = 'second' })
  assert.ok(fs.calls.some((call) => call.operation === 'writeFile' && call.path.includes('.tmp-')))
  assert.ok(fs.calls.some((call) => call.operation === 'rename' && call.target?.endsWith('registry.json')))
  assert.equal(fs.getFile(`${FILE}.bak`), fs.getFile(FILE).replace('second', 'first'))
  assert.equal([...fs.files.keys()].some((name) => name.includes('.tmp-')), false)
})

test('write failure leaves memory and disk at the previous committed version', async () => {
  const fs = createMemoryFs()
  const store = storeWith(fs)
  await store.replace(validRegistry({ kits: [{ name: 'stable' }] }))
  const before = fs.getFile(FILE)
  fs.fail('writeFile')
  await assert.rejects(store.update((draft) => { draft.kits[0].name = 'failed' }), (error) => error.code === 'WRITE_FAILED')
  assert.equal(fs.getFile(FILE), before)
  assert.equal(store.getSnapshot().kits[0].name, 'stable')
})

test('rename failure cleans the temporary file and does not commit the candidate', async () => {
  const fs = createMemoryFs()
  const store = storeWith(fs)
  await store.replace(validRegistry({ kits: [{ name: 'stable' }] }))
  fs.fail('rename', undefined, Infinity, FILE)
  await assert.rejects(store.update((draft) => { draft.kits[0].name = 'failed' }), (error) => error.code === 'WRITE_FAILED')
  assert.equal(store.getSnapshot().kits[0].name, 'stable')
  assert.equal([...fs.files.keys()].some((name) => name.includes('.tmp-')), false)
})

test('backup failure does not update the in-memory snapshot', async () => {
  const fs = createMemoryFs()
  const store = storeWith(fs)
  await store.replace(validRegistry({ kits: [{ name: 'stable' }] }))
  fs.fail('copyFile')
  await assert.rejects(store.update((draft) => { draft.kits[0].name = 'failed' }), (error) => error.code === 'BACKUP_FAILED')
  assert.equal(store.getSnapshot().kits[0].name, 'stable')
})

test('concurrent updates are serialized and retain every mutation', async () => {
  const fs = createMemoryFs()
  const store = storeWith(fs)
  await store.load()
  await Promise.all([
    store.update(async (draft) => { await Promise.resolve(); draft.kits.push({ name: 'one' }) }),
    store.update((draft) => { draft.kits.push({ name: 'two' }) }),
    store.update((draft) => { draft.kits.push({ name: 'three' }) }),
  ])
  assert.deepEqual(store.getSnapshot().kits.map((kit) => kit.id), ['one', 'two', 'three'])
})

test('stampRegistry keeps createdAt and updates updatedAt from an injected clock', () => {
  const first = stampRegistry(createEmptyRegistry(), () => new Date('2026-01-01T00:00:00.000Z'))
  const second = stampRegistry({ ...first, metadata: { ...first.metadata } }, () => new Date('2026-01-02T00:00:00.000Z'))
  assert.equal(first.metadata.createdAt, '2026-01-01T00:00:00.000Z')
  assert.equal(second.metadata.createdAt, first.metadata.createdAt)
  assert.equal(second.metadata.updatedAt, '2026-01-02T00:00:00.000Z')
})

test('OpenAPI archives default to none, sanitize secrets, and require explicit raw permission', async () => {
  const fs = createMemoryFs()
  const store = storeWith(fs)
  const document = {
    openapi: '3.0.0',
    info: { title: 'Demo' },
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', token: 'do-not-save' } } },
    paths: {},
  }
  assert.deepEqual(await store.saveImport(document), { saved: false, mode: 'none', path: undefined, raw: false })
  assert.equal([...fs.files.keys()].some((name) => name.includes('imports')), false)

  const sanitized = await store.archive.save(document, { mode: 'sanitized', name: 'demo import' })
  assert.equal(sanitized.saved, true)
  const sanitizedText = fs.getFile(sanitized.path)
  assert.match(sanitizedText, /\[REDACTED\]/)
  assert.doesNotMatch(sanitizedText, /do-not-save/)

  await assert.rejects(store.archive.save(document, { mode: 'raw' }), (error) => error.code === 'ARCHIVE_FAILED')
  const raw = await store.archive.save(document, { mode: 'raw', allowRaw: true, name: 'demo-raw' })
  assert.equal(raw.raw, true)
  assert.match(fs.getFile(raw.path), /do-not-save/)
})

test('archive failures are isolated from the Registry snapshot', async () => {
  const fs = createMemoryFs()
  const store = storeWith(fs, { archiveMode: 'sanitized' })
  await store.replace(validRegistry({ kits: [{ name: 'stable' }] }))
  fs.fail('writeFile')
  await assert.rejects(store.saveImport({ openapi: '3.0.0', paths: {} }), (error) => error.code === 'ARCHIVE_FAILED')
  assert.equal(store.getSnapshot().kits[0].name, 'stable')
})

console.log('Registry store tests complete')
