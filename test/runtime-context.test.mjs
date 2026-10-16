import test from 'node:test'
import assert from 'node:assert/strict'
import { createConfigurationService } from '../lib/configuration.js'
import { createRegistryStore } from '../lib/registry-store.js'
import {
  API_KIT_RUNTIME_CONTEXT_MAX_BYTES,
  API_KIT_TOOL_NAMES,
  buildApiKitRuntimeContext,
  renderApiKitRuntimeContext,
} from '../lib/runtime-context.js'
import { createMemoryFs } from './helpers/memory-fs.mjs'

const FILE = 'C:\\dsh-api-kit-runtime-context\\registry.json'
const CLOCK = () => new Date('2026-08-27T00:00:00.000Z')

function operation(id, path, extra = {}) {
  return {
    id,
    operationId: id,
    name: id,
    summary: `${id} summary`,
    method: 'GET',
    path,
    serviceTargetId: 'backend',
    policy: { allowAgentCall: true, allowMethods: ['GET', 'HEAD'] },
    enabled: true,
    kitIds: ['rpa'],
    ...extra,
  }
}

async function setup() {
  const store = createRegistryStore({ fs: createMemoryFs(), filePath: FILE, clock: CLOCK })
  await store.load()
  const configuration = createConfigurationService({ store, clock: CLOCK })
  await configuration.createEnvironment({ id: 'dev', name: 'Development', description: 'safe test environment', baseUrl: 'https://dev.example.test' })
  await configuration.createServiceTarget({ id: 'backend', name: 'Backend', environmentIds: ['dev'], defaultEnvironmentId: 'dev' })
  await configuration.createKit({ id: 'rpa', name: 'RPA 排障', description: '内部 API 排障套件', operationIds: [] })
  await configuration.createOperation(operation('health', '/health'))
  await configuration.createOperation(operation('jobs', '/jobs'))
  await configuration.createOperation(operation('head', '/head', { method: 'HEAD', policy: { allowAgentCall: true, allowMethods: ['HEAD'] } }))
  await configuration.createOperation(operation('write', '/write', { method: 'POST', policy: { allowAgentCall: true, allowMethods: ['POST'], allowWrite: true } }))
  await configuration.addOperationsToKit('rpa', ['health', 'jobs', 'head', 'write'])
  await configuration.setSessionActivation({ sessionId: 'session-a', activeKitIds: ['rpa'], environmentId: 'dev' })
  return configuration
}

function activation(sessionId, overrides = {}) {
  return {
    sessionId,
    valid: true,
    activeKitIds: ['rpa'],
    environmentId: 'dev',
    kits: [{ id: 'rpa', name: 'RPA 排障', description: '内部 API 排障套件' }],
    environments: [{ id: 'dev', name: 'Development', production: false, enabled: true, agentEnabled: true }],
    ...overrides,
  }
}

test('renders a bounded active-session summary with fixed tools and safe rules', async () => {
  const configuration = await setup()
  const text = renderApiKitRuntimeContext({
    activation: configuration.resolveSessionActivation('session-a'),
    operations: configuration.listOperations(),
    serviceTargets: configuration.listServiceTargets(),
  })
  assert.match(text, /RPA 排障/)
  assert.match(text, /Development/)
  assert.match(text, /可发现 4 个/)
  for (const name of API_KIT_TOOL_NAMES) assert.match(text, new RegExp(name))
  assert.match(text, /api_operations.*api_describe.*api_call/)
  assert.match(text, /声明 HTTP method/)
  assert.match(text, /DNS\/IP SSRF/)
  assert.match(text, /响应默认脱敏.*Operation 设置中明确关闭/)
  assert.match(text, /临时 token.*声明的普通参数.*不能覆盖 Host 认证/)
  assert.match(text, /内部 API hostname 可解析到私网地址/)
  assert.ok(new TextEncoder().encode(text).byteLength <= API_KIT_RUNTIME_CONTEXT_MAX_BYTES)
  assert.doesNotMatch(text, /baseUrl|dev\.example\.test|allowedHosts|allowedCidrs|secretRef|password|authorization|cookie/i)
})

test('empty, missing, or invalid activation clears the dynamic snapshot', () => {
  assert.equal(renderApiKitRuntimeContext(), '')
  assert.equal(renderApiKitRuntimeContext({ activation: { sessionId: 's', valid: false } }), '')
  assert.equal(renderApiKitRuntimeContext({ activation: activation('s', { activeKitIds: [] }) }), '')
  assert.equal(buildApiKitRuntimeContext({ activation: activation('s', { environments: [] }) }), null)
})

test('counts discoverable operations per current kit and de-duplicates shared operations', () => {
  const input = {
    activation: {
      ...activation('s', {
        activeKitIds: ['rpa', 'ops'],
        kits: [
          { id: 'rpa', name: 'RPA', description: '', operationIds: ['same', 'rpa-only'], enabled: true, agentEnabled: true },
          { id: 'ops', name: 'Ops', description: '', operationIds: ['same', 'hidden'], enabled: true, agentEnabled: true },
        ],
      }),
    },
    operations: [
      operation('same', '/same', { kitIds: ['rpa', 'ops'] }),
      operation('rpa-only', '/rpa', { kitIds: ['rpa'] }),
      operation('hidden', '/hidden', { kitIds: ['ops'], enabled: false }),
    ],
    serviceTargets: [{ id: 'backend', enabled: true, agentEnabled: true, environmentIds: ['dev'] }],
  }
  const built = buildApiKitRuntimeContext(input)
  assert.equal(built.totalDiscoverableOperationCount, 2)
  assert.equal(built.totalReadOperationCount, 2)
  assert.equal(built.totalWriteOperationCount, 0)
})

test('runtime context sanitizes administrator text and does not leak suspicious fields', () => {
  const text = renderApiKitRuntimeContext({
    activation: activation('s', {
      kits: [{ id: 'rpa', name: 'RPA\n\u0000排障', description: 'description\nwith controls' }],
      environments: [{ id: 'dev', name: 'Dev\nEnvironment', enabled: true, agentEnabled: true }],
    }),
    operations: [],
    serviceTargets: [],
  })
  assert.doesNotMatch(text, /\u0000/)
  assert.doesNotMatch(text, /\nEnvironment/)
  assert.doesNotMatch(text, /secretRef|credential|password/i)
})
