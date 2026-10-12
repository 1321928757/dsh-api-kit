import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createMemoryFs } from './helpers/memory-fs.mjs'
import { createRegistryStore } from '../lib/registry-store.js'
import { createConfigurationService } from '../lib/configuration.js'
import { createOpenApiImportTransactionService } from '../lib/openapi-import-transaction.js'

const FILE = 'C:\\dsh-api-kit-t12\\registry.json'
const CLOCK = () => new Date('2026-08-29T00:00:00.000Z')
const fixture = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'))

async function setup() {
  const fs = createMemoryFs()
  const store = createRegistryStore({ fs, filePath: FILE, clock: CLOCK })
  await store.load()
  const config = createConfigurationService({ store, clock: CLOCK })
  await config.createEnvironment({ id: 'dev', name: 'Development', baseUrl: 'https://api.example.test' })
  await config.createAuthProfile({ id: 'bearer', name: 'Bearer', type: 'bearer', secretRef: 'CREDENTIAL_BEARER' })
  await config.createServiceTarget({ id: 'backend', name: 'Backend', environmentIds: ['dev'], defaultEnvironmentId: 'dev', authProfileIds: ['bearer'] })
  await config.createKit({ id: 'pets', name: 'Pets', operationIds: [] })
  return { fs, store, config }
}

function confirmArgs(preview, document, extra = {}) {
  return {
    transactionId: preview.transactionId,
    input: document,
    expectedRegistryFingerprint: preview.registryFingerprint,
    sourceId: preview.documentMeta.documentId,
    defaultServiceTargetId: 'backend',
    defaultKitIds: ['pets'],
    ...extra,
  }
}

test('preview and confirm import atomically bind existing target, environment and kit', async () => {
  const { store, config } = await setup()
  const document = await fixture('openapi-3-basic.json')
  const importer = createOpenApiImportTransactionService({ store, clock: CLOCK })
  const preview = importer.previewOpenApiImport(document, { sourceId: 'pet-api' })
  assert.equal(preview.ok, true)
  assert.equal(preview.needsBinding, true)
  const result = await importer.confirmOpenApiImport(confirmArgs(preview, document))
  assert.deepEqual(result.applied, { created: 1, updated: 0, skipped: 0, kept: 0 })
  assert.equal(config.getSnapshot().operations.length, 1)
  assert.deepEqual(config.getSnapshot().kits[0].operationIds, ['getpet'])
  assert.equal(result.archive.saved, false)
})

test('tag filtering is case-insensitive and does not write excluded operations', async () => {
  const { store, config } = await setup()
  const document = {
    openapi: '3.0.3', info: { title: 'Tagged', version: '1' }, servers: [{ url: 'https://api.example.test' }],
    paths: {
      '/health': { get: { operationId: 'health', tags: ['Internal'], responses: { '200': { description: 'ok' } } } },
      '/pets': { get: { operationId: 'pets', tags: ['Public'], responses: { '200': { description: 'ok' } } } },
      '/none': { get: { operationId: 'none', responses: { '200': { description: 'ok' } } } },
    },
  }
  const importer = createOpenApiImportTransactionService({ store, clock: CLOCK })
  const preview = importer.previewOpenApiImport(document, { sourceId: 'tagged' })
  const result = await importer.confirmOpenApiImport(confirmArgs(preview, document, { selection: { selectedTags: ['public'], includeUntagged: false } }))
  assert.equal(result.applied.created, 1)
  assert.equal(config.getSnapshot().operations[0].operationId, 'pets')
})

test('conflicts require a decision and keep-local does not overwrite', async () => {
  const { store, config } = await setup()
  await config.createOperation({ id: 'getpet', operationId: 'getPet', name: 'Local', method: 'GET', path: '/pets/{id}', serviceTargetId: 'backend', kitIds: ['pets'], summary: 'local' })
  const document = await fixture('openapi-3-basic.json')
  const importer = createOpenApiImportTransactionService({ store, clock: CLOCK })
  const preview = importer.previewOpenApiImport(document, { sourceId: 'other' })
  assert.equal(preview.operations[0].status, 'conflict')
  await assert.rejects(importer.confirmOpenApiImport(confirmArgs(preview, document, { sourceId: 'other' })), (error) => error.code === 'IMPORT_CONFLICT_DECISION_REQUIRED')
  const before = config.getSnapshot()
  const result = await importer.confirmOpenApiImport(confirmArgs(preview, document, { sourceId: 'other', selection: { conflictDecisions: { [preview.operations[0].sourceKey]: 'keep-local' } } }))
  assert.equal(result.applied.kept, 1)
  assert.equal(config.getSnapshot().operations[0].summary, before.operations[0].summary)
})

test('dry run, stale preview and candidate errors fail closed without partial writes', async () => {
  const { store, config } = await setup()
  const document = await fixture('openapi-3-basic.json')
  const importer = createOpenApiImportTransactionService({ store, clock: CLOCK })
  const preview = importer.previewOpenApiImport(document, { sourceId: 'dry' })
  const dry = await importer.confirmOpenApiImport(confirmArgs(preview, document, { dryRun: true }))
  assert.equal(dry.dryRun, true)
  assert.equal(config.getSnapshot().operations.length, 0)
  await config.createKit({ id: 'other', name: 'Other', operationIds: [] })
  await assert.rejects(importer.confirmOpenApiImport(confirmArgs(preview, document)), (error) => error.code === 'IMPORT_STALE_PREVIEW')
  assert.equal(config.getSnapshot().operations.length, 0)
})

test('duplicate confirmation with same transaction and selection is idempotent', async () => {
  const { store } = await setup()
  const document = await fixture('openapi-3-basic.json')
  const importer = createOpenApiImportTransactionService({ store, clock: CLOCK })
  const preview = importer.previewOpenApiImport(document, { sourceId: 'repeat' })
  const args = confirmArgs(preview, document)
  const first = await importer.confirmOpenApiImport(args)
  const second = await importer.confirmOpenApiImport(args)
  assert.deepEqual(second, first)
})

test('security alternatives require explicit future mapping instead of guessing a profile', async () => {
  const { store } = await setup()
  const document = {
    openapi: '3.0.3', info: { title: 'Auth', version: '1' }, servers: [{ url: 'https://api.example.test' }],
    components: { securitySchemes: { a: { type: 'http', scheme: 'bearer' }, b: { type: 'http', scheme: 'basic' } } },
    security: [{ a: [] }, { b: [] }], paths: { '/secure': { get: { operationId: 'secure', responses: { '200': { description: 'ok' } } } } },
  }
  const importer = createOpenApiImportTransactionService({ store, clock: CLOCK })
  const preview = importer.previewOpenApiImport(document, { sourceId: 'auth' })
  await assert.rejects(importer.confirmOpenApiImport(confirmArgs(preview, document, { sourceId: 'auth' })), (error) => error.code === 'IMPORT_SECURITY_MAPPING_UNSUPPORTED')
})

test('newKit is created and linked atomically during import', async () => {
  const { store, config } = await setup()
  const document = await fixture('openapi-3-basic.json')
  const importer = createOpenApiImportTransactionService({ store, clock: CLOCK })
  const preview = importer.previewOpenApiImport(document, { sourceId: 'new-kit' })
  const result = await importer.confirmOpenApiImport({ ...confirmArgs(preview, document), defaultKitIds: [], selection: { newKit: { name: 'Pet Catalog' }, defaultServiceTargetId: 'backend', defaultKitIds: [], includedSourceKeys: preview.operations.map((item) => item.sourceKey), assignments: Object.fromEntries(preview.operations.map((item) => [item.sourceKey, { serviceTargetId: 'backend', kitIds: [] }])) } })
  assert.equal(result.applied.created, 1)
  assert.equal(result.bindings.createdKitId, 'pet-catalog')
  assert.equal(config.getSnapshot().kits.length, 2)
  assert.deepEqual(config.getSnapshot().kits.find((kit) => kit.id === 'pet-catalog').operationIds, ['getpet'])
})

test('newKit duplicate rejects without a partial Registry write', async () => {
  const { store, config } = await setup()
  const document = await fixture('openapi-3-basic.json')
  const importer = createOpenApiImportTransactionService({ store, clock: CLOCK })
  const preview = importer.previewOpenApiImport(document, { sourceId: 'new-kit-duplicate' })
  const before = JSON.stringify(config.getSnapshot())
  await assert.rejects(importer.confirmOpenApiImport({ ...confirmArgs(preview, document), defaultKitIds: [], selection: { newKit: { name: 'Pets' }, defaultServiceTargetId: 'backend', defaultKitIds: [] } }), (error) => error.code === 'DUPLICATE_KIT_ID')
  assert.equal(JSON.stringify(config.getSnapshot()), before)
})

test('input and registry stay unchanged when confirmation validation fails', async () => {
  const { store, config } = await setup()
  const document = await fixture('openapi-3-basic.json')
  const original = JSON.stringify(document)
  const importer = createOpenApiImportTransactionService({ store, clock: CLOCK })
  const preview = importer.previewOpenApiImport(document, { sourceId: 'invalid' })
  await assert.rejects(importer.confirmOpenApiImport(confirmArgs(preview, document, { defaultKitIds: ['missing'] })), (error) => error.code === 'KIT_NOT_FOUND')
  assert.equal(JSON.stringify(document), original)
  assert.equal(config.getSnapshot().operations.length, 0)
})

console.log('OpenAPI import transaction tests complete')
