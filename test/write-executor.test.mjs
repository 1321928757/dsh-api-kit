import test from 'node:test'
import assert from 'node:assert/strict'
import { createConfigurationService } from '../lib/configuration.js'
import { createRegistryStore } from '../lib/registry-store.js'
import { createApiKitHttpExecutor } from '../lib/executor.js'
import { createWriteConfirmation } from '../lib/write-confirmation.js'
import { createMemoryFs } from './helpers/memory-fs.mjs'

const exec = { agent: { id: 's' }, signal: new AbortController().signal }
const response = { status: 200, contentType: 'application/json', body: new TextEncoder().encode('{"ok":true}') }
async function setup(method = 'POST') {
  const store = createRegistryStore({ fs: createMemoryFs(), filePath: 'C:\\x\\r.json' })
  await store.load()
  const c = createConfigurationService({ store })
  await c.createEnvironment({ id: 'e', name: 'E', baseUrl: 'https://api.test/', allowedHosts: ['api.test'] })
  await c.createServiceTarget({ id: 't', name: 'T', environmentIds: ['e'], defaultEnvironmentId: 'e' })
  await c.createKit({ id: 'k', name: 'K', operationIds: [] })
  await c.createOperation({ id: 'w', operationId: 'w', name: 'W', method, path: '/x', serviceTargetId: 't', parameters: [], requestBody: { required: true, schema: { type: 'object', required: ['x'], properties: { x: { type: 'string' } } } }, policy: { allowAgentCall: true, allowWrite: false, requiresConfirmation: true }, kitIds: ['k'] })
  await c.updateKit('k', { policy: { allowWrite: false, allowWriteMethods: [] } })
  await c.setSessionActivation({ sessionId: 's', activeKitIds: ['k'], environmentId: 'e' })
  return c
}

test('api_call directly transports declared write methods without confirmation', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const c = await setup(method)
    const calls = []
    const confirmation = createWriteConfirmation({ generateToken: () => 'token-123456789012345' })
    const executor = createApiKitHttpExecutor(c, { confirmation, transport: { handlesResolution: true, request: (request) => (calls.push(request), response) } })
    const result = await executor.execute({ operationId: 'w', body: { x: 'ok' } }, exec)
    assert.equal(result.ok, true, method)
    assert.equal(calls.length, 1, method)
    assert.equal(calls[0].method, method)
    assert.deepEqual(JSON.parse(calls[0].body), { x: 'ok' })
    assert.equal(result.confirmation, undefined)
  }
})

test('deprecated confirmation aliases remain offline and unsupported', async () => {
  const c = await setup()
  const calls = []
  const x = createApiKitHttpExecutor(c, { transport: { handlesResolution: true, request: (request) => (calls.push(request), response) } })
  const prepared = await x.prepareWrite({ operationId: 'w', body: { x: 'ok' } }, exec)
  assert.equal(prepared.error.code, 'CONFIRMATION_REQUIRED')
  assert.equal(calls.length, 0)
})

test('read remains available', async () => {
  const c = await setup('GET')
  await c.createOperation({ id: 'r', operationId: 'r', name: 'R', method: 'GET', path: '/r', serviceTargetId: 't', parameters: [], policy: { allowAgentCall: true }, kitIds: ['k'] })
  const x = createApiKitHttpExecutor(c, { transport: { handlesResolution: true, request: () => response } })
  assert.equal((await x.execute({ operationId: 'r' }, exec)).ok, true)
})
