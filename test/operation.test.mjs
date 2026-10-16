import test from 'node:test'
import assert from 'node:assert/strict'
import { createConfigurationService } from '../lib/configuration.js'
import { createRegistryStore } from '../lib/registry-store.js'
import { createEmptyRegistry, normalizeOperation } from '../lib/model.js'
import { validateOperationInput, validateKitInput, reconcileRegistryLinks, safeOperationListView, safeOperationView } from '../lib/operation-validation.js'
import { createMemoryFs } from './helpers/memory-fs.mjs'

const FILE = 'C:\\dsh-api-kit-operation\\registry.json'
const CLOCK = () => new Date('2026-08-27T00:00:00.000Z')

async function setup(fs = createMemoryFs()) {
  const store = createRegistryStore({ fs, filePath: FILE, clock: CLOCK })
  await store.load()
  const config = createConfigurationService({ store, clock: CLOCK })
  await config.createEnvironment({ id: 'dev', name: 'Development', baseUrl: 'https://api.example.test' })
  await config.createServiceTarget({ id: 'backend', name: 'Backend', environmentIds: ['dev'], defaultEnvironmentId: 'dev' })
  return { fs, store, config }
}

function operation(id, path, extra = {}) {
  return {
    id,
    operationId: id,
    name: id,
    method: 'GET',
    path,
    serviceTargetId: 'backend',
    ...extra,
  }
}

test('operation validator enforces method/path/parameter/security boundaries', () => {
  assert.equal(validateOperationInput(operation('health', '/health')).enabled, true)
  assert.throws(() => validateOperationInput(operation('bad', 'https://evil.test')), (error) => error.code === 'OPERATION_PATH_INVALID')
  assert.throws(() => validateOperationInput(operation('bad', '/users/{id}', { parameters: [{ name: 'id', in: 'path', required: false }] })), (error) => error.code === 'PATH_PARAMETER_INVALID')
  assert.throws(() => validateOperationInput(operation('bad', '/health', { parameters: [{ name: 'Authorization', in: 'header' }] })), (error) => error.code === 'CONTROLLED_HEADER')
  assert.throws(() => validateOperationInput(operation('bad', '/health', { parameters: [{ name: 'body', in: 'body' }] })), (error) => error.code === 'PARAMETER_LOCATION_UNSUPPORTED')
  assert.throws(() => validateOperationInput(operation('bad', '/health', { responses: { 700: { description: 'bad' } } })), (error) => error.code === 'RESPONSE_STATUS_INVALID')
})

test('three GET operations can be created, linked to a kit and survive reload', async () => {
  const { fs, config } = await setup()
  await config.createKit({ id: 'rpa', name: 'RPA', operationIds: [] })
  await config.createOperation(operation('health', '/health'))
  await config.createOperation(operation('jobs', '/jobs', { kitIds: ['rpa'] }))
  await config.createOperation(operation('status', '/status', { kitIds: ['rpa'] }))
  await config.addOperationsToKit('rpa', ['health'])
  assert.deepEqual(config.getKit('rpa').operationIds, ['jobs', 'status', 'health'])
  assert.deepEqual(config.listOperations({ kitId: 'rpa' }).map((item) => item.id), ['health', 'jobs', 'status'])
  const reloadedStore = createRegistryStore({ fs, filePath: FILE, clock: CLOCK })
  await reloadedStore.load()
  const reloaded = createConfigurationService({ store: reloadedStore, clock: CLOCK })
  assert.deepEqual(reloaded.getKit('rpa').operationIds, ['jobs', 'status', 'health'])
  assert.deepEqual(reloaded.listOperations({ kitId: 'rpa' }).map((item) => item.id), ['health', 'jobs', 'status'])
})

test('an existing operation can be associated with multiple kits and detached atomically', async () => {
  const { fs, config } = await setup()
  await config.createKit({ id: 'primary', name: 'Primary', operationIds: [] })
  await config.createKit({ id: 'secondary', name: 'Secondary', operationIds: [] })
  await config.createOperation(operation('shared', '/shared', { kitIds: ['primary'] }))

  await config.addOperationsToKit('secondary', ['shared'])
  assert.deepEqual(config.getOperation('shared').kitIds, ['primary', 'secondary'])
  assert.deepEqual(config.getKit('primary').operationIds, ['shared'])
  assert.deepEqual(config.getKit('secondary').operationIds, ['shared'])

  await assert.rejects(config.addOperationsToKit('secondary', ['missing-operation']), (error) => error.code === 'KIT_OPERATION_INVALID')
  assert.deepEqual(config.getKit('secondary').operationIds, ['shared'])

  await config.removeOperationsFromKit('primary', ['shared'])
  assert.deepEqual(config.getOperation('shared').kitIds, ['secondary'])
  assert.deepEqual(config.getKit('primary').operationIds, [])
  assert.deepEqual(config.getKit('secondary').operationIds, ['shared'])

  await config.removeOperationsFromKit('secondary', ['shared'])
  assert.deepEqual(config.getOperation('shared').kitIds, [])
  assert.equal(config.getOperation('shared').id, 'shared')

  const reloadedStore = createRegistryStore({ fs, filePath: FILE, clock: CLOCK })
  await reloadedStore.load()
  const reloaded = createConfigurationService({ store: reloadedStore, clock: CLOCK })
  assert.deepEqual(reloaded.getOperation('shared').kitIds, [])
  assert.deepEqual(reloaded.getKit('primary').operationIds, [])
  assert.deepEqual(reloaded.getKit('secondary').operationIds, [])
})

test('operation patch updates fields, clears request body and keeps timestamps', async () => {
  const { config } = await setup()
  const created = await config.createOperation(operation('search', '/search', { requestBody: { required: true, schema: { type: 'object' } } }))
  const updated = await config.updateOperation('search', { description: 'new', requestBody: null, parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }] })
  assert.equal(updated.description, 'new')
  assert.equal(updated.requestBody, null)
  assert.equal(updated.parameters[0].name, 'q')
  assert.equal(updated.createdAt, created.createdAt)
  assert.equal(updated.updatedAt, created.updatedAt)
})

test('operation and kit safe views omit secret-shaped keys and protect referenced deletion', async () => {
  const { config } = await setup()
  await config.createKit({ id: 'safe', name: 'Safe' })
  await assert.rejects(config.createOperation(operation('secure', '/secure', { authProfileId: 'missing', extensions: { token: 'hidden' } })), (error) => error.code === 'DANGLING_AUTH_PROFILE')
  await config.createOperation(operation('public', '/public', { kitIds: ['safe'], extensions: { note: 'ok' } }))
  const view = config.getOperation('public')
  assert.equal(JSON.stringify(view).includes('secretRef'), false)
  await assert.rejects(config.deleteOperation('public'), (error) => error.code === 'OPERATION_IN_USE')
  await config.removeOperationsFromKit('safe', ['public'])
  assert.equal(await config.deleteOperation('public'), true)
})

test('link reconciliation uses kit operationIds as the source of truth', () => {
  const registry = { ...createEmptyRegistry(), kits: [{ id: 'one', operationIds: ['a'] }], operations: [normalizeOperation({ id: 'a', method: 'GET', path: '/a', kitIds: ['wrong'] })] }
  const result = reconcileRegistryLinks(registry)
  assert.deepEqual(result.registry.operations[0].kitIds, ['one'])
  assert.ok(result.warnings.some((warning) => warning.code === 'OPERATION_KIT_LINK_RECONCILED'))
})

test('operation input enforces lowercase ids and kit references exist', () => {
  assert.throws(() => validateOperationInput(operation('Upper', '/upper')), (error) => error.code === 'OPERATION_ID_INVALID')
  assert.throws(() => validateKitInput({ id: 'x', name: 'X', operationIds: ['missing'] }, { operations: [] }), (error) => error.code === 'DANGLING_OPERATION')
  const view = safeOperationView({ ...normalizeOperation(operation('safe', '/safe')), extensions: { password: 'redacted' } })
  assert.equal(view.extensions.password, '[REDACTED]')
})

test('response redaction normalization is default-on and fails safe for nonboolean registry values', () => {
  assert.equal(normalizeOperation(operation('default', '/default')).policy.redactResponse, true)
  assert.equal(normalizeOperation(operation('empty', '/empty', { policy: {} })).policy.redactResponse, true)
  assert.equal(normalizeOperation(operation('raw', '/raw', { policy: { redactResponse: false } })).policy.redactResponse, false)
  for (const redactResponse of [true, undefined, null, 0, 1, '', 'false', [], {}]) {
    assert.equal(normalizeOperation(operation('safe', '/safe', { policy: { redactResponse } })).policy.redactResponse, true)
  }
})

test('operation validator accepts only boolean response redaction policy values', () => {
  for (const redactResponse of [true, false]) {
    assert.equal(validateOperationInput(operation('valid', '/valid', { policy: { redactResponse } })).policy.redactResponse, redactResponse)
  }
  for (const redactResponse of [null, 0, 1, '', 'false', 'true', [], {}]) {
    assert.throws(
      () => validateOperationInput(operation('invalid', '/invalid', { policy: { redactResponse } })),
      (error) => error.code === 'INVALID_FIELD' && error.path === 'policy.redactResponse',
    )
  }
})

test('safe operation list and detail views expose response redaction without disabling metadata sanitization', () => {
  for (const redactResponse of [true, false]) {
    const value = normalizeOperation(operation('view', '/view', { policy: { redactResponse }, extensions: { token: 'fixture-metadata-value' } }))
    assert.equal(safeOperationListView(value).policy.redactResponse, redactResponse)
    const detail = safeOperationView(value)
    assert.equal(detail.policy.redactResponse, redactResponse)
    assert.equal(detail.extensions.token, '[REDACTED]')
  }
})

test('response redaction defaults, opt-out, patches and safe views survive registry reload', async () => {
  const { fs, config } = await setup()
  await config.createOperation(operation('default', '/default'))
  const created = await config.createOperation(operation('raw', '/raw', { policy: { redactResponse: false, maxArrayItems: 7, redactKeys: ['internalId'] } }))
  assert.equal(created.policy.redactResponse, false)
  await config.updateOperation('raw', { description: 'unrelated edit' })
  assert.equal(config.getOperation('raw').policy.redactResponse, false)
  assert.equal(config.listOperations().find((item) => item.id === 'raw').policy.redactResponse, false)
  const persisted = JSON.parse(fs.getFile(FILE))
  assert.equal(persisted.operations.find((item) => item.id === 'default').policy.redactResponse, true)
  assert.equal(persisted.operations.find((item) => item.id === 'raw').policy.redactResponse, false)
  const reloadedStore = createRegistryStore({ fs, filePath: FILE, clock: CLOCK })
  await reloadedStore.load()
  const reloaded = createConfigurationService({ store: reloadedStore, clock: CLOCK })
  assert.equal(reloaded.getOperation('default').policy.redactResponse, true)
  assert.equal(reloaded.getOperation('raw').policy.redactResponse, false)
  assert.equal(reloaded.listOperations().find((item) => item.id === 'raw').policy.redactResponse, false)
  const enabled = await reloaded.updateOperation('raw', { policy: { redactResponse: true } })
  assert.equal(enabled.policy.redactResponse, true)
  assert.equal(enabled.policy.maxArrayItems, 7)
  assert.deepEqual(enabled.policy.redactKeys, ['internalid'])
  assert.equal(reloaded.getOperation('default').policy.redactResponse, true)
  const enabledStore = createRegistryStore({ fs, filePath: FILE, clock: CLOCK })
  await enabledStore.load()
  assert.equal(createConfigurationService({ store: enabledStore, clock: CLOCK }).getOperation('raw').policy.redactResponse, true)
})

test('invalid response redaction create and patch values never modify persisted configuration', async () => {
  const { fs, config } = await setup()
  await config.createOperation(operation('raw', '/raw', { policy: { redactResponse: false } }))
  const before = fs.getFile(FILE)
  for (const redactResponse of [null, 0, 1, '', 'false', 'true', [], {}]) {
    await assert.rejects(config.createOperation(operation('invalid', '/invalid', { policy: { redactResponse } })), (error) => error.code === 'INVALID_FIELD')
    await assert.rejects(config.updateOperation('raw', { policy: { redactResponse } }), (error) => error.code === 'INVALID_FIELD')
    assert.equal(config.getOperation('raw').policy.redactResponse, false)
    assert.equal(fs.getFile(FILE), before)
  }
})

console.log('Operation tests complete')
