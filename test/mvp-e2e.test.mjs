import test from 'node:test'
import assert from 'node:assert/strict'
import { createConfigurationService } from '../lib/configuration.js'
import { createRegistryStore } from '../lib/registry-store.js'
import { createApiKitAgentTools } from '../lib/agent-tools.js'
import { createApiKitHttpExecutor } from '../lib/executor.js'
import { createMemoryFs } from './helpers/memory-fs.mjs'
import { registerApiKitRuntimeContext } from '../lib/runtime-context.js'

const FILE = 'C:\\dsh-api-kit-mvp\\registry.json'
const CLOCK = () => new Date('2026-08-27T00:00:00.000Z')

function exec(id = 'mvp-session') {
  return { agent: { id }, signal: new AbortController().signal }
}

function response(body = '{"items":[{"id":1,"token":"do-not-return"}]}') {
  return { status: 200, contentType: 'application/json', body: new TextEncoder().encode(body), truncated: false }
}

async function setup() {
  const store = createRegistryStore({ fs: createMemoryFs(), filePath: FILE, clock: CLOCK })
  await store.load()
  const config = createConfigurationService({ store, clock: CLOCK })
  await config.createEnvironment({ id: 'test', name: 'Test', baseUrl: 'https://api.example.test', allowedHosts: ['api.example.test'] })
  await config.createServiceTarget({ id: 'backend', name: 'Backend', environmentIds: ['test'], defaultEnvironmentId: 'test' })
  await config.createKit({ id: 'rpa', name: 'RPA 排障', description: '只读 API', operationIds: [] })
  for (const [id, path] of [['health', '/health'], ['jobs', '/jobs'], ['detail', '/jobs/{jobId}']]) {
    await config.createOperation({
      id, operationId: id, name: id, method: 'GET', path, serviceTargetId: 'backend', kitIds: ['rpa'],
      parameters: id === 'detail' ? [{ name: 'jobId', in: 'path', required: true, schema: { type: 'string' } }] : [],
      policy: { allowAgentCall: true, allowMethods: ['GET', 'HEAD'] },
    })
  }
  await config.addOperationsToKit('rpa', ['health', 'jobs', 'detail'])
  await config.setSessionActivation({ sessionId: 'mvp-session', activeKitIds: ['rpa'], environmentId: 'test' })
  return config
}

test('MVP discovery-to-call flow keeps the fixed target and safe response boundary', async () => {
  const config = await setup()
  const calls = []
  const executor = createApiKitHttpExecutor(config, {
    transport: { handlesResolution: true, async request(request) { calls.push(request); return response() } },
  })
  const tools = createApiKitAgentTools(config, { executor })
  const kits = await tools.apiKits.execute({}, exec())
  assert.equal(kits.ok, true)
  const operations = await tools.apiOperations.execute({}, exec())
  assert.equal(operations.ok, true)
  assert.equal(operations.returnedCount, 3)
  const description = await tools.apiDescribe.execute({ operationId: 'detail' }, exec())
  assert.equal(description.ok, true)
  const result = await tools.apiCall.execute({ operationId: 'detail', pathParams: { jobId: 'a/b' } }, exec())
  assert.equal(result.ok, true)
  assert.equal(calls[0].url, 'https://api.example.test/jobs/a%2Fb')
  assert.equal(JSON.stringify(result).includes('do-not-return'), false)
  assert.equal(JSON.stringify(result).includes('api.example.test'), false)
})

test('runtime context and tools immediately reflect stale authoritative state', async () => {
  const config = await setup()
  const registrations = []
  registerApiKitRuntimeContext({ context(value) { registrations.push(value); return () => {} } }, config)
  const contextProvider = registrations[0].text
  assert.match(contextProvider({ agent: { id: 'mvp-session' } }), /RPA 排障/)
  await config.updateKit('rpa', { enabled: false })
  assert.equal(contextProvider({ agent: { id: 'mvp-session' } }), '')
  const tools = createApiKitAgentTools(config)
  const result = await tools.apiOperations.execute({}, exec())
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'KIT_DISABLED')
})
