import test from 'node:test'
import assert from 'node:assert/strict'
import { createConfigurationService } from '../lib/configuration.js'
import { createRegistryStore } from '../lib/registry-store.js'
import { createApiKitDiscoveryService, operationDiscoverable } from '../lib/discovery.js'
import { createApiKitAgentTools } from '../lib/agent-tools.js'
import { createMemoryFs } from './helpers/memory-fs.mjs'

const FILE = 'C:\\dsh-api-kit-discovery\\registry.json'
const CLOCK = () => new Date('2026-08-27T00:00:00.000Z')

function exec(sessionId = 'session-a') {
  return { agent: sessionId === null ? undefined : { id: sessionId }, signal: new AbortController().signal }
}

function operation(id, path, extra = {}) {
  return {
    id,
    operationId: id,
    name: id,
    summary: `${id} summary`,
    description: `${id} description`,
    method: 'GET',
    path,
    serviceTargetId: 'backend',
    policy: { allowAgentCall: true },
    ...extra,
  }
}

async function setup(options = {}) {
  const fs = createMemoryFs()
  const store = createRegistryStore({ fs, filePath: FILE, clock: CLOCK })
  await store.load()
  const config = createConfigurationService({ store, clock: CLOCK })
  await config.createEnvironment({ id: 'dev', name: 'Development', baseUrl: 'https://dev.example.test' })
  await config.createEnvironment({ id: 'stage', name: 'Staging', baseUrl: 'https://stage.example.test' })
  await config.createServiceTarget({ id: 'backend', name: 'Backend', environmentIds: ['dev', 'stage'], defaultEnvironmentId: 'dev' })
  await config.createKit({ id: 'rpa', name: 'RPA', description: 'RPA diagnostics', operationIds: [] })
  await config.createKit({ id: 'ops', name: 'Operations', environmentIds: ['stage'], operationIds: [] })
  await config.createOperation(operation('health', '/health', { kitIds: ['rpa'] }))
  await config.createOperation(operation('jobs', '/jobs', { tags: ['jobs'], kitIds: ['rpa', 'ops'] }))
  await config.createOperation(operation('hidden', '/hidden', { policy: { allowAgentCall: false }, kitIds: ['rpa'] }))
  await config.createOperation(operation('disabled', '/disabled', { enabled: false, kitIds: ['rpa'] }))
  await config.createOperation(operation('write', '/write', { method: 'POST', policy: { allowAgentCall: true, allowWrite: true }, kitIds: ['rpa'] }))
  await config.setSessionActivation({ sessionId: 'session-a', activeKitIds: ['rpa'], environmentId: 'dev' })
  if (options.activateSecond) await config.setSessionActivation({ sessionId: 'session-b', activeKitIds: ['ops'], environmentId: 'stage' })
  return { config, store }
}

function toolResult(tool, args, sessionId = 'session-a') {
  return tool.execute(args, exec(sessionId))
}

test('api_kits exposes safe active session summaries without target URLs or credentials', async () => {
  const { config } = await setup()
  const discovery = createApiKitDiscoveryService(config)
  const result = await discovery.apiKits(exec())
  assert.equal(result.ok, true)
  assert.equal(result.activeKitIds[0], 'rpa')
  assert.equal(result.environmentName, 'Development')
  assert.equal(result.kits.find((kit) => kit.id === 'rpa').active, true)
  assert.equal(JSON.stringify(result).includes('baseUrl'), false)
  assert.equal(JSON.stringify(result).includes('allowedHosts'), false)
  assert.equal(/secretRef|password|authorization|cookie|token/i.test(JSON.stringify(result)), false)
})

test('operations and describe require an active session Kit', async () => {
  const { config } = await setup()
  const discovery = createApiKitDiscoveryService(config)
  const operations = await discovery.apiOperations({}, exec('empty-session'))
  const describe = await discovery.apiDescribe({ operationId: 'health' }, exec('empty-session'))
  assert.equal(operations.ok, false)
  assert.equal(operations.error.code, 'KIT_NOT_ACTIVE')
  assert.equal(describe.ok, false)
  assert.equal(describe.error.code, 'KIT_NOT_ACTIVE')
})

test('api_operations applies policy, filters, stable pagination, and Kit deduplication', async () => {
  const { config } = await setup()
  const discovery = createApiKitDiscoveryService(config)
  const all = await discovery.apiOperations({ limit: 100 }, exec())
  assert.equal(all.ok, true)
  assert.deepEqual(all.operations.map((item) => item.operationId), ['health', 'jobs', 'write'])
  assert.deepEqual(all.operations.find((item) => item.operationId === 'jobs').activeKitIds, ['rpa'])
  const filtered = await discovery.apiOperations({ tag: 'JOBS', method: 'GET', serviceTargetId: 'backend', limit: 1 }, exec())
  assert.equal(filtered.totalCount, 1)
  assert.equal(filtered.operations[0].operationId, 'jobs')
  const empty = await discovery.apiOperations({ query: 'does-not-exist' }, exec())
  assert.equal(empty.ok, true)
  assert.equal(empty.returnedCount, 0)
  assert.equal(empty.notice !== undefined, true)
})

test('api_describe returns complete safe schema only for discoverable Operation', async () => {
  const { config } = await setup()
  const discovery = createApiKitDiscoveryService(config)
  await config.updateOperation('health', {
    parameters: [{ name: 'userId', in: 'query', required: true, schema: { type: 'string' } }],
    requestBody: { required: false, contentTypes: ['application/json'], schema: { type: 'object' } },
    responses: { '200': { description: 'ok', schema: { type: 'object' } } },
  })
  const result = await discovery.apiDescribe({ operationId: 'health' }, exec())
  assert.equal(result.ok, true)
  assert.equal(result.operation.parameters[0].name, 'userId')
  assert.equal(result.operation.requestBody.contentTypes[0], 'application/json')
  assert.equal(result.operation.responses[0].status, '200')
  assert.equal(result.operation.environment.name, 'Development')
  assert.equal(JSON.stringify(result).includes('baseUrl'), false)
  assert.equal(/secretRef|password|authorization|cookie|token/i.test(JSON.stringify(result)), false)
  const hidden = await discovery.apiDescribe({ operationId: 'hidden' }, exec())
  const missing = await discovery.apiDescribe({ operationId: 'missing' }, exec())
  assert.equal(hidden.error.code, 'OPERATION_NOT_FOUND')
  assert.equal(missing.error.code, 'OPERATION_NOT_FOUND')
})

test('discovery reports persisted response redaction policy without granting a call override', async () => {
  const { config } = await setup()
  const discovery = createApiKitDiscoveryService(config)
  let description = await discovery.apiDescribe({ operationId: 'health' }, exec())
  assert.equal(description.operation.policy.redactResponse, true)
  assert.match(description.operation.rules.join(' '), /响应默认.*脱敏/)
  await config.updateOperation('health', { policy: { redactResponse: false } })
  const list = await discovery.apiOperations({}, exec())
  assert.equal(list.operations.find((item) => item.operationId === 'health').redactResponse, false)
  assert.equal(list.operations.find((item) => item.operationId === 'jobs').redactResponse, true)
  description = await discovery.apiDescribe({ operationId: 'health' }, exec())
  assert.equal(description.operation.policy.redactResponse, false)
  assert.match(description.operation.rules.join(' '), /用户已关闭.*响应脱敏/)
  assert.match(description.operation.rules.join(' '), /临时 token.*声明参数.*不得覆盖 Host 认证/)
  assert.equal(description.operation.authentication.type, 'none')
  await config.updateOperation('health', { policy: { redactResponse: true } })
  assert.equal((await discovery.apiDescribe({ operationId: 'health' }, exec())).operation.policy.redactResponse, true)
})

test('stale Kit or environment state is rejected on the next tool call', async () => {
  const { config } = await setup()
  const discovery = createApiKitDiscoveryService(config)
  await config.updateEnvironment('dev', { enabled: false })
  const result = await discovery.apiOperations({}, exec())
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'ENVIRONMENT_DISABLED')
})

test('policy intersection never grants a disabled write Operation', () => {
  const base = { id: 'write', method: 'POST', enabled: true, policy: { allowAgentCall: true, allowWrite: true }, serviceTargetId: 'backend' }
  const kit = { id: 'rpa', enabled: true, agentEnabled: true, operationIds: ['write'], policy: { allowWrite: false } }
  assert.equal(operationDiscoverable(base, kit, { serviceTarget: { enabled: true, agentEnabled: true, environmentIds: ['dev'] }, environmentId: 'dev' }), true)
})

test('raw Agent tools expose strict schemas, safe envelopes, and no sessionId argument', async () => {
  const { config } = await setup()
  const tools = createApiKitAgentTools(config)
  assert.deepEqual(Object.keys(tools), ['apiKits', 'apiOperations', 'apiDescribe', 'apiCall', 'apiWritePrepare', 'apiWriteExecute'])
  assert.equal(tools.apiCall.parameters.required[0], 'operationId')
  assert.equal('url' in tools.apiCall.parameters.properties, false)
  assert.equal('confirmationToken' in tools.apiCall.parameters.properties, false)
  assert.deepEqual(tools.apiDescribe.parameters.required, ['operationId'])
  assert.equal('sessionId' in tools.apiOperations.parameters.properties, false)
  assert.equal(tools.apiOperations.output.schema.additionalProperties, true)
  const result = await toolResult(tools.apiOperations, { limit: 1 })
  assert.equal(result.ok, true)
  const noSession = await toolResult(tools.apiOperations, {}, null)
  assert.equal(noSession.error.code, 'SESSION_ID_REQUIRED')
  const bad = await toolResult(tools.apiOperations, { limit: 0 })
  assert.equal(bad.error.code, 'INVALID_ARGUMENT')
})

test('large description fails closed instead of returning a partial schema', async () => {
  const { config } = await setup()
  await config.updateOperation('health', { description: 'x'.repeat(4000), responses: { '200': { description: 'y'.repeat(4000), schema: { type: 'object', properties: { data: { type: 'string' } } } } } })
  const discovery = createApiKitDiscoveryService(config, { maxOutputBytes: 1024 })
  const result = await discovery.apiDescribe({ operationId: 'health' }, exec())
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'DESCRIPTION_TOO_LARGE')
})

console.log('Discovery tool tests complete')
