import assert from 'node:assert/strict'
import { normalizeJsonSchema } from '../lib/normalizers.js'
import {
  AUTH_TYPES,
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_TIMEOUT_MS,
  READ_METHODS,
  REGISTRY_SCHEMA_VERSION,
  SUPPORTED_METHODS,
  WRITE_METHODS,
  createEmptyRegistry,
  linkKitToOperation,
  linkOperationToKit,
  migrateRegistry,
  normalizeAuthProfile,
  normalizeEnvironment,
  normalizeKit,
  normalizeOperation,
  normalizeParameter,
  normalizeRegistry,
  normalizeRequestBody,
  normalizeResponses,
  normalizeServiceTarget,
  stableOperationId,
  stableOperationKey,
} from '../lib/model.js'

let passed = 0
function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log('✓ ' + name)
  } catch (err) {
    console.error('✗ ' + name)
    throw err
  }
}

test('常量定义覆盖 MVP 方法、认证和默认限制', () => {
  assert.deepEqual(READ_METHODS, ['GET', 'HEAD'])
  assert.deepEqual(WRITE_METHODS, ['POST', 'PUT', 'PATCH', 'DELETE'])
  assert.ok(SUPPORTED_METHODS.includes('OPTIONS'))
  assert.deepEqual(AUTH_TYPES, ['none', 'bearer', 'api-key-header', 'api-key-query', 'basic', 'oauth2-client-credentials'])
  assert.equal(DEFAULT_TIMEOUT_MS, 15000)
  assert.equal(DEFAULT_MAX_RESPONSE_BYTES, 512 * 1024)
  assert.equal(REGISTRY_SCHEMA_VERSION, 1)
})

test('operation 归一化 method/path/id，并自动补全 path 参数', () => {
  const operation = normalizeOperation({
    method: ' get ',
    path: 'users/{userId}/orders/{orderId}/',
    summary: ' 查询订单 ',
    tags: ['order', 'order', 3, 'user profile'],
  })
  assert.equal(operation.method, 'GET')
  assert.equal(operation.path, '/users/{userId}/orders/{orderId}')
  assert.equal(operation.id, 'get-users-by-userid-orders-by-orderid')
  assert.equal(operation.operationId, operation.id)
  assert.deepEqual(operation.tags, ['order', 'user-profile'])
  assert.deepEqual(operation.parameters.map((item) => [item.name, item.in, item.required]), [
    ['userId', 'path', true],
    ['orderId', 'path', true],
  ])
  assert.deepEqual(operation.policy.allowMethods, ['GET', 'HEAD'])
  assert.equal(operation.policy.allowAgentCall, true)
  assert.equal(operation.policy.requiresConfirmation, false)
})

test('显式 operationId 优先且安全归一化，重复参数按 location/name 去重', () => {
  const operation = normalizeOperation({
    id: 'local op/1',
    operationId: 'orders.get',
    method: 'POST',
    path: '/orders/{id}',
    parameters: [
      { name: 'id', in: 'path', required: false },
      { name: 'id', in: 'path', required: true },
      { name: 'q', in: 'query' },
    ],
  })
  assert.equal(operation.id, 'local-op-1')
  assert.equal(operation.operationId, 'orders.get')
  assert.deepEqual(operation.parameters.map((item) => item.name), ['id', 'q'])
  assert.equal(operation.parameters[0].required, true)
  assert.deepEqual(operation.policy.allowMethods, [])
  assert.equal(operation.policy.allowAgentCall, false)
  assert.equal(operation.policy.requiresConfirmation, true)
})

test('operation URL 形式不会进入规范化 path', () => {
  const operation = normalizeOperation({ method: 'GET', path: 'https://evil.example/pwn' })
  assert.equal(operation.path, '/')
  assert.equal(operation.id, 'get')
})

test('稳定 operation key/id 对同一输入幂等', () => {
  assert.equal(stableOperationKey('get', 'users/1'), 'GET /users/1')
  assert.equal(stableOperationId('GET', '/users/{id}'), 'get-users-by-id')
  assert.equal(stableOperationId('GET', '/users/{id}'), stableOperationId('get', 'users/{id}'))
})

test('parameter/schema/request body/response 归一化并限制不安全键', () => {
  const parameter = normalizeParameter({ name: 'X-Test\r\nInjected', in: 'HEADER', schema: { type: 'string' } })
  assert.equal(parameter.name, 'X-TestInjected')
  assert.equal(parameter.in, 'header')
  assert.deepEqual(normalizeJsonSchema({ type: 'object', properties: { safe: { type: 'string' }, __proto__: { type: 'string' } } }), {
    type: 'object',
    properties: { safe: { type: 'string' } },
  })
  const body = normalizeRequestBody({ required: true, content: { 'application/json': { schema: { type: 'object' } } } })
  assert.equal(body.required, true)
  assert.deepEqual(body.contentTypes, ['application/json'])
  assert.deepEqual(body.schema, { type: 'object' })
  const responses = normalizeResponses({ '200': { description: 'ok', content: { 'application/json': { schema: { type: 'array' } } } } })
  assert.equal(responses[0].status, '200')
  assert.deepEqual(responses[0].schema, { type: 'array' })
})

test('environment 从 baseUrl 推导 host，不接受危险协议、查询和凭据', () => {
  const environment = normalizeEnvironment({
    id: 'test env',
    baseUrl: 'https://api.example.test/v1///',
    production: true,
  })
  assert.equal(environment.id, 'test-env')
  assert.equal(environment.baseUrl, 'https://api.example.test/v1')
  assert.deepEqual(environment.allowedHosts, ['api.example.test'])
  assert.equal(environment.production, true)
  assert.equal(environment.agentEnabled, false)
  assert.equal(normalizeEnvironment({ baseUrl: 'file:///etc/passwd' }).baseUrl, '')
  assert.equal(normalizeEnvironment({ baseUrl: 'https://user:pass@example.test' }).baseUrl, '')
  assert.equal(normalizeEnvironment({ baseUrl: 'https://example.test?a=1' }).baseUrl, '')
})

test('未知 auth type 不会在 registry normalize 时静默降级为 none', () => {
  assert.throws(() => normalizeRegistry({ authProfiles: [{ id: 'bad', type: 'mystery' }] }), (error) => error.code === 'AUTH_TYPE_UNSUPPORTED')
})

test('OAuth2 auth profile 保留兼容配置字段', () => {
  const auth = normalizeAuthProfile({ id: 'oauth', type: 'oauth2-client-credentials', tokenEndpoint: 'https://issuer.example.test/oauth/token', clientId: 'client', scope: 'read' })
  assert.equal(auth.type, 'oauth2-client-credentials')
  assert.equal(auth.tokenEndpoint, 'https://issuer.example.test/oauth/token')
  assert.equal(auth.clientId, 'client')
})

test('service target/auth profile 使用安全视图字段且默认关闭危险能力', () => {
  const target = normalizeServiceTarget({ name: 'Risk Service', environments: ['test', 'test'], authProfiles: ['token'] })
  assert.equal(target.id, 'risk-service')
  assert.deepEqual(target.environmentIds, ['test'])
  assert.deepEqual(target.authProfileIds, ['token'])
  assert.equal(target.enabled, true)

  const auth = normalizeAuthProfile({ name: 'Token', type: 'BEARER', secretRef: 'credential:risk' })
  assert.equal(auth.id, 'token')
  assert.equal(auth.type, 'bearer')
  assert.equal(auth.secretRef, 'credential:risk')
  assert.equal(auth.enabled, true)
})

test('kit 归一化默认允许 Agent 但默认不允许写操作', () => {
  const kit = normalizeKit({ name: 'RPA 排障', operations: ['get-jobs', 'get-jobs'], policy: { allowWrite: true } })
  assert.equal(kit.id, 'rpa')
  assert.deepEqual(kit.operationIds, ['get-jobs'])
  assert.equal(kit.agentEnabled, true)
  assert.equal(kit.policy.allowWrite, true)
  assert.deepEqual(kit.policy.allowReadMethods, [])
  assert.deepEqual(kit.policy.allowWriteMethods, [])
})

test('empty registry、legacy migration 和 normalizeRegistry 生成统一结构', () => {
  const empty = createEmptyRegistry()
  assert.equal(empty.schemaVersion, 1)
  assert.deepEqual(empty.kits, [])
  const migrated = migrateRegistry({ version: 0, collections: [{ name: 'kit' }], endpoints: [{ method: 'GET', path: '/health' }] })
  assert.equal(migrated.schemaVersion, 1)
  assert.ok(Array.isArray(migrated.kits))
  const registry = normalizeRegistry(migrated)
  assert.equal(registry.schemaVersion, 1)
  assert.equal(registry.kits[0].id, 'kit')
  assert.equal(registry.operations[0].id, 'get-health')
})

test('kit/operation link 幂等且不重复', () => {
  const operation = linkOperationToKit({ method: 'GET', path: '/health', kitIds: ['ops'] }, 'ops')
  assert.deepEqual(operation.kitIds, ['ops'])
  const kit = linkKitToOperation({ name: 'ops', operationIds: ['get-health'] }, 'get-health')
  assert.deepEqual(kit.operationIds, ['get-health'])
})

console.log(`\n全部通过：${passed} 组断言`)
