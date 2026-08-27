import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionActivationStore, inspectSessionActivation } from '../lib/session-selection.js'
import { createConfigurationService } from '../lib/configuration.js'
import { createRegistryStore } from '../lib/registry-store.js'
import { createMemoryFs } from './helpers/memory-fs.mjs'

const FILE = 'C:\\dsh-api-kit-session\\registry.json'
const CLOCK = () => new Date('2026-08-27T00:00:00Z')

function operation(id, path, serviceTargetId = 'backend', kitIds = []) {
  return { id, operationId: id, name: id, method: 'GET', path, serviceTargetId, kitIds }
}

async function setup() {
  const fs = createMemoryFs()
  const store = createRegistryStore({ fs, filePath: FILE, clock: CLOCK })
  await store.load()
  const config = createConfigurationService({ store, clock: CLOCK })
  await config.createEnvironment({ id: 'dev', name: 'Development', baseUrl: 'https://dev.example.test' })
  await config.createEnvironment({ id: 'stage', name: 'Staging', baseUrl: 'https://stage.example.test' })
  await config.createEnvironment({ id: 'prod', name: 'Production', baseUrl: 'https://prod.example.test', production: true })
  await config.createServiceTarget({ id: 'backend', name: 'Backend', environmentIds: ['dev', 'stage', 'prod'], defaultEnvironmentId: 'dev' })
  await config.createKit({ id: 'rpa', name: 'RPA', operationIds: [] })
  await config.createKit({ id: 'ops', name: 'Operations', environmentIds: ['stage'], operationIds: [] })
  await config.createKit({ id: 'empty', name: 'Empty', operationIds: [] })
  await config.createOperation(operation('health', '/health', 'backend', ['rpa']))
  await config.createOperation(operation('jobs', '/jobs', 'backend', ['rpa', 'ops']))
  return { config, store }
}

function codes(result) {
  return result.errors.map((item) => item.code)
}

function warningCodes(result) {
  return result.warnings.map((item) => item.code)
}

test('pure session activation store isolates sessions and clears state', () => {
  const store = createSessionActivationStore()
  assert.deepEqual(store.get('session-a'), { sessionId: 'session-a', activeKitIds: [], environmentId: null })
  assert.deepEqual(store.set({ sessionId: 'session-a', activeKitIds: ['rpa', 'rpa'], environmentId: 'dev' }), { sessionId: 'session-a', activeKitIds: ['rpa'], environmentId: 'dev' })
  assert.deepEqual(store.get('session-b'), { sessionId: 'session-b', activeKitIds: [], environmentId: null })
  assert.deepEqual(store.clear('session-a'), { sessionId: 'session-a', activeKitIds: [], environmentId: null })
  assert.deepEqual(store.get('session-a'), { sessionId: 'session-a', activeKitIds: [], environmentId: null })
  assert.throws(() => store.set({ sessionId: '', activeKitIds: [] }), (error) => error.code === 'SESSION_ID_REQUIRED')
})

test('inspection derives available environments and warns when scope expands', async () => {
  const { config } = await setup()
  const result = config.getSessionActivation({ sessionId: 'session-a' })
  assert.equal(result.valid, true)
  assert.deepEqual(result.availableEnvironmentIds, ['dev', 'stage'])
  const selected = await config.setSessionActivation({ sessionId: 'session-a', activeKitIds: ['rpa'], environmentId: 'dev' })
  assert.equal(selected.valid, true)
  assert.deepEqual(selected.activeKitIds, ['rpa'])
  assert.deepEqual(selected.availableEnvironmentIds, ['dev', 'stage'])
  assert.equal(selected.environments.find((item) => item.id === 'prod').selectable, false)
  await config.createKit({ id: 'extra', name: 'Extra', operationIds: [] })
  const expanded = inspectSessionActivation(config.getSnapshot(), { sessionId: 'session-a', activeKitIds: ['rpa', 'ops', 'extra'], environmentId: 'stage' })
  assert.equal(expanded.valid, true)
  assert.ok(warningCodes(expanded).includes('KIT_SCOPE_EXPANDED'))
})

test('session activation is independent and returns only safe Kit/Environment views', async () => {
  const { config } = await setup()
  await config.setSessionActivation({ sessionId: 'session-a', activeKitIds: ['rpa'], environmentId: 'dev' })
  await config.setSessionActivation({ sessionId: 'session-b', activeKitIds: ['ops'], environmentId: 'stage' })
  assert.deepEqual(config.getSessionActivation({ sessionId: 'session-a' }).activeKitIds, ['rpa'])
  assert.deepEqual(config.getSessionActivation({ sessionId: 'session-b' }).activeKitIds, ['ops'])
  const text = JSON.stringify(config.getSessionActivation({ sessionId: 'session-a' }))
  assert.equal(/secretRef|password|authorization|cookie|token/i.test(text), false)
  assert.equal(config.getSessionActivation({ sessionId: 'session-a' }).kits.find((item) => item.id === 'rpa').environmentNames.includes('Production'), false)
})

test('set rejects incompatible, disabled and over-limit activation while allowing expanded scope', async () => {
  const { config } = await setup()
  assert.throws(() => config.setSessionActivation({ sessionId: 'session-a', activeKitIds: ['rpa'], environmentId: 'prod' }), (error) => error.code === 'ENVIRONMENT_AGENT_DISABLED')
  assert.throws(() => config.setSessionActivation({ sessionId: 'session-a', activeKitIds: ['rpa', 'ops'], environmentId: 'dev' }), (error) => error.code === 'ENVIRONMENT_NOT_COMPATIBLE')
  assert.throws(() => config.setSessionActivation({ sessionId: 'session-a', activeKitIds: ['missing'], environmentId: 'dev' }), (error) => error.code === 'KIT_NOT_FOUND')
  await config.updateKit('rpa', { enabled: false })
  assert.throws(() => config.setSessionActivation({ sessionId: 'session-a', activeKitIds: ['rpa'], environmentId: 'dev' }), (error) => error.code === 'KIT_DISABLED')
  await config.updateKit('rpa', { enabled: true })
  await config.createKit({ id: 'third', name: 'Third', operationIds: [] })
  const accepted = await config.setSessionActivation({ sessionId: 'session-a', activeKitIds: ['rpa', 'ops', 'third'], environmentId: 'stage' })
  assert.equal(accepted.valid, true)
  assert.ok(warningCodes(accepted).includes('KIT_SCOPE_EXPANDED'))
})

test('get and resolve revalidate current Registry after Kit/Environment changes', async () => {
  const { config } = await setup()
  await config.setSessionActivation({ sessionId: 'session-a', activeKitIds: ['rpa'], environmentId: 'dev' })
  await config.updateEnvironment('dev', { enabled: false })
  const invalid = config.getSessionActivation({ sessionId: 'session-a' })
  assert.equal(invalid.valid, false)
  assert.ok(codes(invalid).includes('ENVIRONMENT_DISABLED'))
  assert.throws(() => config.resolveSessionActivation('session-a'), (error) => error.code === 'ENVIRONMENT_DISABLED')
  await config.updateEnvironment('dev', { enabled: true })
  await config.updateKit('rpa', { enabled: false })
  assert.equal(config.getSessionActivation({ sessionId: 'session-a' }).valid, false)
  assert.throws(() => config.resolveSessionActivation('session-a'), (error) => error.code === 'KIT_DISABLED')
  assert.deepEqual(config.clearSessionActivation({ sessionId: 'session-a' }).activeKitIds, [])
  assert.equal(config.resolveSessionActivation('session-a').valid, true)
})

test('empty kits and production environment surface actionable state', async () => {
  const { config } = await setup()
  const empty = config.getSessionActivation({ sessionId: 'session-a' })
  assert.equal(empty.valid, true)
  const result = inspectSessionActivation(config.getSnapshot(), { sessionId: 'session-a', activeKitIds: ['empty'], environmentId: 'dev' })
  assert.equal(result.valid, true)
  assert.ok(warningCodes(result).includes('KIT_NO_ENABLED_OPERATIONS'))
  await config.updateEnvironment('prod', { agentEnabled: true })
  await config.updateKit('rpa', { environmentIds: ['prod'] })
  const production = await config.setSessionActivation({ sessionId: 'session-a', activeKitIds: ['rpa'], environmentId: 'prod' })
  assert.ok(warningCodes(production).includes('PRODUCTION_ENVIRONMENT'))
})

console.log('Session selection tests complete')
