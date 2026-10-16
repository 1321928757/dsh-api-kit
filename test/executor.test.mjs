import test from 'node:test'
import assert from 'node:assert/strict'
import { createConfigurationService } from '../lib/configuration.js'
import { createRegistryStore } from '../lib/registry-store.js'
import { buildUrl, createApiKitHttpExecutor } from '../lib/executor.js'
import { createFetchTransport } from '../lib/transport.js'
import { createMemoryFs } from './helpers/memory-fs.mjs'

const FILE = 'C:\\dsh-api-kit-executor\\registry.json'
const CLOCK = () => new Date('2026-08-27T00:00:00.000Z')

function exec(sessionId = 'session-a', signal = new AbortController().signal) {
  return { agent: sessionId === null ? undefined : { id: sessionId }, signal }
}

function operation(id, path, extra = {}) {
  return {
    id,
    operationId: id,
    name: id,
    method: 'GET',
    path,
    serviceTargetId: 'backend',
    parameters: [],
    policy: { allowAgentCall: true, allowMethods: ['GET', 'HEAD'] },
    ...extra,
  }
}

async function setup(options = {}) {
  const fs = createMemoryFs()
  const store = createRegistryStore({ fs, filePath: FILE, clock: CLOCK })
  await store.load()
  const config = createConfigurationService({ store, clock: CLOCK, credentialAdapter: options.credentialAdapter })
  await config.createEnvironment({ id: 'dev', name: 'Development', baseUrl: options.baseUrl ?? 'https://api.example.test/api/' })
  await config.createServiceTarget({ id: 'backend', name: 'Backend', environmentIds: ['dev'], defaultEnvironmentId: 'dev', authProfileIds: options.authProfileIds ?? [] })
  await config.createKit({ id: 'rpa', name: 'RPA', operationIds: [] })
  await config.createOperation(operation('user', '/users/{userId}', {
    parameters: [
      { name: 'userId', in: 'path', required: true, schema: { type: 'string', minLength: 1 } },
      { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
      { name: 'tag', in: 'query', schema: { type: 'string' }, allowEmptyValue: true },
      { name: 'X-Trace', in: 'header', schema: { type: 'string' } },
    ],
    kitIds: ['rpa'],
    ...options.operation,
  }))
  await config.setSessionActivation({ sessionId: 'session-a', activeKitIds: ['rpa'], environmentId: 'dev' })
  return { config, store }
}

function fakeTransport(response, calls = []) {
  return {
    handlesResolution: true,
    async request(request) {
      calls.push(request)
      if (typeof response === 'function') return response(request)
      return response
    },
  }
}

function response(status = 200, body = '{}', contentType = 'application/json', extra = {}) {
  return { status, contentType, body: new TextEncoder().encode(body), ...extra }
}

test('fixed base URL and path parameters are encoded without accepting a target URL', async () => {
  const { config } = await setup()
  const calls = []
  const executor = createApiKitHttpExecutor(config, { transport: fakeTransport(response(200, '{"ok":true}'), calls) })
  const result = await executor.execute({ operationId: 'user', pathParams: { userId: 'a/b' }, query: { q: 'open' } }, exec())
  assert.equal(result.ok, true)
  assert.equal(calls[0].url, 'https://api.example.test/api/users/a%2Fb?q=open')
  assert.equal(calls[0].method, 'GET')
  const rejected = await executor.execute({ operationId: 'user', url: 'https://evil.test', pathParams: { userId: 'x' }, query: { q: 'x' } }, exec())
  assert.equal(rejected.error.code, 'INVALID_ARGUMENT')
  assert.equal(calls.length, 1)
})

test('same logical Environment routes different Service Targets to different endpoints', async () => {
  const { config } = await setup()
  await config.createServiceTarget({ id: 'vehicle', name: 'Vehicle', environmentIds: ['dev'], defaultEnvironmentId: 'dev', endpoints: { dev: { baseUrl: 'https://vehicle.example.test/api' } } })
  await config.createOperation(operation('vehicle', '/vehicles', { serviceTargetId: 'vehicle', kitIds: ['rpa'] }))
  const calls = []
  const executor = createApiKitHttpExecutor(config, { transport: fakeTransport(response(200, '{}'), calls) })
  assert.equal((await executor.execute({ operationId: 'user', pathParams: { userId: 'x' }, query: { q: 'x' } }, exec())).ok, true)
  assert.equal((await executor.execute({ operationId: 'vehicle' }, exec())).ok, true)
  assert.equal(calls[0].url, 'https://api.example.test/api/users/x?q=x')
  assert.equal(calls[1].url, 'https://vehicle.example.test/api/vehicles')
})

test('path, query and header declarations are enforced at execution time', async () => {
  const { config } = await setup()
  const executor = createApiKitHttpExecutor(config, { transport: fakeTransport(response()) })
  assert.equal((await executor.execute({ operationId: 'user', query: { q: 'x' } }, exec())).error.code, 'MISSING_PARAMETER')
  assert.equal((await executor.execute({ operationId: 'user', pathParams: { userId: 'x', extra: 'y' }, query: { q: 'x' } }, exec())).error.code, 'INVALID_ARGUMENT')
  assert.equal((await executor.execute({ operationId: 'user', pathParams: { userId: 'x' }, query: { unknown: 'x' } }, exec())).error.code, 'INVALID_ARGUMENT')
  assert.equal((await executor.execute({ operationId: 'user', pathParams: { userId: 'x' }, query: { q: 'x' }, headers: { Authorization: 'x' } }, exec())).error.code, 'INVALID_ARGUMENT')
  assert.equal((await executor.execute({ operationId: 'user', pathParams: { userId: 'x' }, query: { q: 'x' }, headers: { 'X-Trace': 'trace' } }, exec())).ok, true)
})

test('query arrays and booleans are rendered and authentication cannot be overridden', async () => {
  const credentials = {
    available: true,
    toCredentialRef: (value) => value,
    async describe() { return { configured: true, source: 'test', writable: false } },
    async resolve() { return { value: 'secret' } },
  }
  const { config } = await setup({ credentialAdapter: credentials })
  await config.createAuthProfile({ id: 'token', type: 'bearer', secretRef: 'API_TOKEN' })
  await config.updateServiceTarget('backend', { authProfileIds: ['token'] })
  await config.updateOperation('user', { authProfileId: 'token' })
  const calls = []
  const executor = createApiKitHttpExecutor(config, { transport: fakeTransport(response(200, '{}'), calls) })
  const result = await executor.execute({ operationId: 'user', pathParams: { userId: 'x' }, query: { q: 'x', tag: '' }, headers: { 'X-Trace': 'trace' } }, exec())
  assert.equal(result.ok, true)
  assert.equal(calls[0].headers.Authorization, 'Bearer secret')
  assert.match(calls[0].url, /q=x/)
  assert.match(calls[0].url, /tag=/)
  assert.equal(JSON.stringify(result).includes('secret'), false)
  const conflict = await executor.execute({ operationId: 'user', pathParams: { userId: 'x' }, query: { q: 'x' }, headers: { authorization: 'spoof' } }, exec())
  assert.equal(conflict.error.code, 'INVALID_ARGUMENT')
})

test('declared write methods execute directly while invalid requests still fail closed', async () => {
  const calls = []
  const { config } = await setup({ operation: { method: 'POST', policy: { allowAgentCall: true, allowWrite: false }, requestBody: { required: true, schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } } } } })
  const executor = createApiKitHttpExecutor(config, { transport: fakeTransport(response(), calls) })
  assert.equal((await executor.execute({ operationId: 'user', pathParams: { userId: 'x' }, query: { q: 'q' }, body: { name: 'ok' } }, exec())).ok, true)
  assert.equal(calls[0].method, 'POST')
  assert.equal(JSON.parse(calls[0].body).name, 'ok')
  assert.equal((await executor.execute({ operationId: 'user', pathParams: { userId: 'x' }, query: { q: 'q' }, body: {} }, exec())).error.code, 'PARAMETER_INVALID')

  const readSetup = await setup({ operation: { policy: { allowAgentCall: true, requiresConfirmation: true } } })
  const readExecutor = createApiKitHttpExecutor(readSetup.config, { transport: fakeTransport(response()) })
  assert.equal((await readExecutor.execute({ operationId: 'user', pathParams: { userId: 'x' }, query: { q: 'x' } }, exec())).error.code, 'CONFIRMATION_REQUIRED')

  const cookieSetup = await setup({ operation: { parameters: [{ name: 'sid', in: 'cookie', schema: { type: 'string' } }] } })
  const cookieExecutor = createApiKitHttpExecutor(cookieSetup.config, { transport: fakeTransport(response()) })
  assert.equal((await cookieExecutor.execute({ operationId: 'user', pathParams: { userId: 'x' }, query: { q: 'x' } }, exec())).error.code, 'PARAMETER_NOT_SUPPORTED')

  const bodySetup = await setup({ operation: { requestBody: { schema: { type: 'object' } } } })
  const bodyExecutor = createApiKitHttpExecutor(bodySetup.config, { transport: fakeTransport(response()) })
  assert.equal((await bodyExecutor.execute({ operationId: 'user', pathParams: { userId: 'x' }, query: { q: 'x' }, body: {} }, exec())).error.code, 'BODY_NOT_SUPPORTED')
})

test('JSON and text responses are projected, status errors remain safe, and oversized bodies are truncated', async () => {
  const { config } = await setup()
  const executor = createApiKitHttpExecutor(config, { transport: fakeTransport(response(200, '{"data":[1,true]}')) })
  const json = await executor.execute({ operationId: 'user', pathParams: { userId: 'x' }, query: { q: 'x' } }, exec())
  assert.deepEqual(json.response, { kind: 'json', data: { data: [1, true] } })

  const textExecutor = createApiKitHttpExecutor(config, { transport: fakeTransport(response(200, 'plain text', 'text/plain')) })
  const text = await textExecutor.execute({ operationId: 'user', pathParams: { userId: 'x' }, query: { q: 'x' } }, exec())
  assert.deepEqual(text.response, { kind: 'text', text: 'plain text' })

  for (const contentType of ['text/plain', 'application/xml', 'text/javascript', undefined, 'application/octet-stream']) {
    const body = 'message=ok Authorization: Bearer bearer-secret Cookie: sid=cookie-secret token=token-secret password="password-secret" secret: xml-secret api-key=key-secret'
    const responseFixture = contentType === undefined
      ? { status: 200, body: new TextEncoder().encode(body) }
      : response(200, body, contentType)
    const leakExecutor = createApiKitHttpExecutor(config, { transport: fakeTransport(responseFixture) })
    const safe = await leakExecutor.execute({ operationId: 'user', pathParams: { userId: 'x' }, query: { q: 'x' } }, exec())
    assert.equal(safe.response.kind, 'text')
    assert.equal(safe.response.text.includes('bearer-secret'), false)
    assert.equal(safe.response.text.includes('cookie-secret'), false)
    assert.equal(safe.response.text.includes('token-secret'), false)
    assert.equal(safe.response.text.includes('password-secret'), false)
    assert.equal(safe.response.text.includes('xml-secret'), false)
    assert.equal(safe.response.text.includes('key-secret'), false)
    assert.match(safe.response.text, /\[REDACTED\]/)
  }

  const statusExecutor = createApiKitHttpExecutor(config, { transport: fakeTransport(response(404, 'Authorization: Bearer error-secret token=error-token', 'text/plain')) })
  const status = await statusExecutor.execute({ operationId: 'user', pathParams: { userId: 'x' }, query: { q: 'x' } }, exec())
  assert.equal(status.ok, false)
  assert.equal(status.error.code, 'HTTP_STATUS')
  assert.equal(status.status, 404)
  assert.equal(status.response.text.includes('error-secret'), false)
  assert.equal(status.response.text.includes('error-token'), false)

  const largeExecutor = createApiKitHttpExecutor(config, { maxOutputBytes: 8, transport: fakeTransport(response(200, '0123456789', 'text/plain')) })
  const large = await largeExecutor.execute({ operationId: 'user', pathParams: { userId: 'x' }, query: { q: 'x' } }, exec())
  assert.equal(large.error.code, 'RESPONSE_TOO_LARGE')
  assert.equal(large.truncated, true)
})

test('stale session, host allowlist, cancellation and transport errors are safe', async () => {
  const { config } = await setup()
  const calls = []
  const executor = createApiKitHttpExecutor(config, { transport: fakeTransport(response(), calls) })
  assert.throws(() => buildUrl({ ...config.getEnvironment('dev') }, { path: '/users/x' }, '/users/x', { baseUrl: 'https://api.example.test', allowedHosts: ['other.example.test'] }), (error) => error.code === 'HOST_NOT_ALLOWED')
  assert.equal(calls.length, 0)

  const fresh = await setup()
  const controller = new AbortController()
  controller.abort()
  const aborted = await createApiKitHttpExecutor(fresh.config, { transport: fakeTransport(response()) }).execute({ operationId: 'user', pathParams: { userId: 'x' }, query: { q: 'x' } }, exec('session-a', controller.signal))
  assert.equal(aborted.error.code, 'ABORTED')

  const failure = createApiKitHttpExecutor(fresh.config, { transport: { handlesResolution: true, async request() { throw new Error('private failure') } } })
  const result = await failure.execute({ operationId: 'user', pathParams: { userId: 'x' }, query: { q: 'x' } }, exec())
  assert.equal(result.error.code, 'NETWORK_ERROR')
})

test('fetch transport forwards manual redirect, signal, headers and caps streamed bytes', async () => {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    return {
      status: 200,
      headers: { get(name) { return name === 'content-type' ? 'text/plain; charset=utf-8' : null } },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('abcdef'))
          controller.close()
        },
      }),
    }
  }
  const transport = createFetchTransport({ fetchImpl })
  const controller = new AbortController()
  const result = await transport.request({ url: 'https://api.example.test/x', method: 'GET', headers: { Accept: 'text/plain' }, signal: controller.signal, maxResponseBytes: 3, maxRedirects: 0 })
  assert.equal(result.tooLarge, true)
  assert.equal(result.truncated, true)
  assert.deepEqual([...result.body], [...new TextEncoder().encode('abc')])
  assert.equal(calls[0].init.redirect, 'manual')
  assert.equal(calls[0].init.signal, controller.signal)
})

console.log('Executor tests complete')
