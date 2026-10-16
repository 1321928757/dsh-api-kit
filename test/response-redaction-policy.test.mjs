import test from 'node:test'
import assert from 'node:assert/strict'
import { createConfigurationService } from '../lib/configuration.js'
import { createRegistryStore } from '../lib/registry-store.js'
import { createApiKitHttpExecutor } from '../lib/executor.js'
import { createAuditLog } from '../lib/audit-log.js'
import { REDACTED_VALUE } from '../lib/redaction.js'
import { createMemoryFs } from './helpers/memory-fs.mjs'

const FILE = 'C:\\dsh-api-kit-response-policy\\registry.json'
const AUDIT_DIR = 'C:\\dsh-api-kit-response-policy\\audit'
const CLOCK = () => new Date('2026-08-27T00:00:00.000Z')
const SESSION = { agent: { id: 'response-policy-session' }, signal: new AbortController().signal }
// These are deliberately synthetic fixtures; no credentials, DNS, or network are used.
const ACCESS_TOKEN = 'fixture-access-value+/=with-space '
const REFRESH_TOKEN = 'fixture-refresh-value'
const AUTH_TOKEN = 'fixture-host-auth-value'
const TOKENS = {
  access_token: ACCESS_TOKEN,
  nested: { Refresh_Token: REFRESH_TOKEN, items: [{ token: 'fixture-nested-value', password: 'fixture-password-value', ok: true }] },
  internalId: 'fixture-custom-value',
  ordinary: 'visible',
}

function operation(id, extra = {}) {
  return { id, operationId: id, name: id, method: 'GET', path: `/${id}`, serviceTargetId: 'backend', kitIds: ['kit'], policy: { allowAgentCall: true }, ...extra }
}

function response(body = TOKENS, contentType = 'application/json', extra = {}) {
  return {
    status: 200,
    ...(contentType === null ? {} : { contentType }),
    body: new TextEncoder().encode(typeof body === 'string' ? body : JSON.stringify(body)),
    ...extra,
  }
}

async function setup(options = {}) {
  const fs = createMemoryFs()
  const store = createRegistryStore({ fs, filePath: FILE, clock: CLOCK })
  await store.load()
  const credentialAdapter = {
    available: true,
    toCredentialRef: (value) => value,
    async describe() { return { configured: true, source: 'fixture', writable: false } },
    async resolve() { return { value: AUTH_TOKEN } },
  }
  const config = createConfigurationService({ store, clock: CLOCK, credentialAdapter })
  await config.createEnvironment({ id: 'dev', name: 'Development', baseUrl: 'https://api.example.test/api/', ...options.environment })
  await config.createServiceTarget({ id: 'backend', name: 'Backend', environmentIds: ['dev'], defaultEnvironmentId: 'dev' })
  await config.createKit({ id: 'kit', name: 'Kit', operationIds: [] })
  await config.createOperation(operation('get-token', { operationId: 'getToken', path: '/token', policy: { allowAgentCall: true, redactResponse: false, redactKeys: ['internalId'] } }))
  await config.createOperation(operation('sibling'))
  await config.createOperation(operation('consume', { parameters: [{ name: 'access_token', in: 'query', required: true, schema: { type: 'string' } }] }))
  await config.createOperation(operation('write', {
    method: 'POST', policy: { allowAgentCall: true, redactResponse: false },
    requestBody: { required: true, schema: { type: 'object', required: ['requestMarker'], properties: { requestMarker: { type: 'string' }, token: { type: 'string' } }, additionalProperties: false } },
  }))
  await config.setSessionActivation({ sessionId: SESSION.agent.id, activeKitIds: ['kit'], environmentId: 'dev' })
  const calls = []
  const audits = []
  let fixture = options.response ?? response()
  const transport = {
    handlesResolution: true,
    async request(request) {
      calls.push(request)
      return typeof fixture === 'function' ? fixture(request) : fixture
    },
  }
  const executor = createApiKitHttpExecutor(config, { transport, onAudit: (record) => audits.push(record), clock: () => 0, ...options.executor })
  return { fs, store, config, executor, transport, calls, audits, setResponse(value) { fixture = value } }
}

function assertBounded(result, maxBytes) {
  const value = result.response.kind === 'json' ? JSON.stringify(result.response.data) : result.response.text
  assert.ok(new TextEncoder().encode(value).byteLength <= maxBytes)
}

test('default operation redacts access_token and nested tokens while explicit false preserves JSON', async () => {
  const { executor } = await setup()
  const safe = await executor.execute({ operationId: 'sibling' }, SESSION)
  assert.equal(safe.ok, true)
  assert.equal(safe.response.kind, 'json')
  assert.equal(safe.response.data.access_token, REDACTED_VALUE)
  assert.equal(safe.response.data.nested.Refresh_Token, REDACTED_VALUE)
  assert.equal(safe.response.data.nested.items[0].token, REDACTED_VALUE)
  assert.equal(safe.response.data.nested.items[0].password, REDACTED_VALUE)
  assert.equal(safe.response.data.ordinary, 'visible')
  const raw = await executor.execute({ operationId: 'getToken' }, SESSION)
  assert.equal(raw.ok, true)
  assert.deepEqual(raw.response, { kind: 'json', data: TOKENS })
  assert.equal(raw.truncated, false)
})

test('text-pattern opt-out covers text, unknown and missing content types but default siblings stay redacted', async () => {
  const { executor, setResponse } = await setup()
  const text = 'Authorization: Bearer fixture-bearer-value Cookie: sid=fixture-cookie-value token=fixture-text-value password="fixture-password-value" <secret>fixture-xml-value</secret> api-key=fixture-api-value'
  for (const contentType of ['text/plain; charset=utf-8', 'application/xml', 'text/javascript', 'application/octet-stream', 'application/x-fixture', null]) {
    setResponse(response(text, contentType))
    const raw = await executor.execute({ operationId: 'getToken' }, SESSION)
    assert.equal(raw.ok, true, String(contentType))
    assert.deepEqual(raw.response, { kind: 'text', text }, String(contentType))
    const safe = await executor.execute({ operationId: 'sibling' }, SESSION)
    assert.equal(safe.ok, true, String(contentType))
    assert.match(safe.response.text, /\[REDACTED\]/)
    for (const token of ['fixture-bearer-value', 'fixture-cookie-value', 'fixture-text-value', 'fixture-password-value', 'fixture-xml-value', 'fixture-api-value']) {
      assert.equal(safe.response.text.includes(token), false, `${contentType}: ${token}`)
    }
  }
})

test('re-enabling response redaction takes effect immediately on the same executor and stays operation-local', async () => {
  const { config, executor, setResponse } = await setup()
  assert.equal((await executor.execute({ operationId: 'getToken' }, SESSION)).response.data.access_token, ACCESS_TOKEN)
  await config.updateOperation('get-token', { policy: { redactResponse: true } })
  const enabled = await executor.execute({ operationId: 'getToken' }, SESSION)
  assert.equal(enabled.response.data.access_token, REDACTED_VALUE)
  assert.equal(enabled.response.data.internalId, REDACTED_VALUE)
  setResponse(response('token=fixture-text-value', 'text/plain'))
  assert.equal((await executor.execute({ operationId: 'getToken' }, SESSION)).response.text.includes('fixture-text-value'), false)
  await config.updateOperation('get-token', { policy: { redactResponse: false } })
  assert.equal((await executor.execute({ operationId: 'getToken' }, SESSION)).response.text, 'token=fixture-text-value')
  assert.equal((await executor.execute({ operationId: 'sibling' }, SESSION)).response.text.includes('fixture-text-value'), false)
  setResponse(response())
  assert.equal((await executor.execute({ operationId: 'sibling' }, SESSION)).response.data.access_token, REDACTED_VALUE)
})

test('getToken response roundtrips into another operation declared access_token query parameter', async () => {
  const { executor, calls, setResponse } = await setup()
  const tokenResult = await executor.execute({ operationId: 'getToken' }, SESSION)
  assert.equal(tokenResult.ok, true)
  assert.equal(tokenResult.response.data.access_token, ACCESS_TOKEN)
  setResponse(response({ accepted: true, access_token: ACCESS_TOKEN }))
  const consumed = await executor.execute({ operationId: 'consume', query: { access_token: tokenResult.response.data.access_token } }, SESSION)
  assert.equal(consumed.ok, true)
  assert.equal(calls.length, 2)
  const target = new URL(calls[1].url)
  assert.equal(target.origin, 'https://api.example.test')
  assert.equal(target.pathname, '/api/consume')
  assert.equal(target.searchParams.get('access_token'), ACCESS_TOKEN)
  assert.equal(consumed.response.data.access_token, REDACTED_VALUE)
  assert.equal(consumed.response.data.accepted, true)
})

test('response opt-out leaves each JSON structural output limit active', async (t) => {
  const cases = [
    { name: 'depth', policy: { maxResponseDepth: 1 }, body: { token: { child: { access_token: ACCESS_TOKEN } } }, expected: { token: { child: '[Truncated]' } } },
    { name: 'array items', policy: { maxArrayItems: 2 }, body: { token: [ACCESS_TOKEN, REFRESH_TOKEN, 'omitted'] }, expected: { token: [ACCESS_TOKEN, REFRESH_TOKEN] } },
    { name: 'string length', policy: { maxResponseStringLength: 64 }, body: { access_token: 'x'.repeat(100) }, expected: { access_token: 'x'.repeat(64) } },
    { name: 'global key count', policy: { maxResponseKeys: 3 }, body: { access_token: ACCESS_TOKEN, nested: { token: REFRESH_TOKEN, password: 'omitted' }, trailing: true }, expected: { access_token: ACCESS_TOKEN, nested: { token: REFRESH_TOKEN } } },
  ]
  for (const item of cases) await t.test(item.name, async () => {
    const { config, executor } = await setup({ response: response(item.body) })
    await config.updateOperation('get-token', { policy: item.policy })
    const result = await executor.execute({ operationId: 'getToken' }, SESSION)
    assert.equal(result.ok, true)
    assert.deepEqual(result.response, { kind: 'json', data: item.expected })
    assert.equal(result.truncated, true)
  })
  await t.test('key length', async () => {
    const key = 'k'.repeat(300)
    const { executor } = await setup({ response: response({ [key]: ACCESS_TOKEN }) })
    const result = await executor.execute({ operationId: 'getToken' }, SESSION)
    assert.deepEqual(result.response.data, { [key.slice(0, 256)]: ACCESS_TOKEN })
  })
})

test('response opt-out preserves operation environment endpoint and executor byte caps', async (t) => {
  for (const source of ['operation', 'environment', 'endpoint', 'executor']) await t.test(source, async () => {
    const { config, executor, calls } = await setup({
      response: response({ access_token: 'x'.repeat(2000) }),
      ...(source === 'executor' ? { executor: { maxOutputBytes: 1024 } } : {}),
      // Environment settings are captured in the target endpoint at creation.
      ...(source === 'environment' ? { environment: { maxResponseBytes: 1024 } } : {}),
    })
    if (source === 'operation') await config.updateOperation('get-token', { policy: { maxResponseBytes: 1024 } })
    if (source === 'endpoint') await config.updateServiceTarget('backend', { endpoints: { dev: { baseUrl: 'https://api.example.test/api/', maxResponseBytes: 1024 } } })
    const result = await executor.execute({ operationId: 'getToken' }, SESSION)
    assert.equal(calls[0].maxResponseBytes, 1024)
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'RESPONSE_TOO_LARGE')
    assert.equal(result.truncated, true)
    assertBounded(result, 1024)
  })
})

test('raw text and JSON scalar output stay byte-bounded when response redaction is false', async () => {
  const { executor, setResponse } = await setup({ executor: { maxOutputBytes: 32 } })
  for (const contentType of ['text/plain', 'application/octet-stream', null]) {
    setResponse(response(`token=${'x'.repeat(100)}`, contentType))
    const result = await executor.execute({ operationId: 'getToken' }, SESSION)
    assert.equal(result.error.code, 'RESPONSE_TOO_LARGE')
    assert.equal(result.truncated, true)
    assert.equal(result.response.text, `token=${'x'.repeat(26)}`)
    assertBounded(result, 32)
  }
  setResponse(response(JSON.stringify(ACCESS_TOKEN.repeat(5))))
  const scalar = await executor.execute({ operationId: 'getToken' }, SESSION)
  assert.equal(scalar.error.code, 'RESPONSE_TOO_LARGE')
  assert.equal(scalar.truncated, true)
  assertBounded(scalar, 32)
})

test('UTF-8 text truncation never expands a split character beyond the byte limit', async () => {
  for (const maxOutputBytes of [1, 2, 3, 4, 5, 7]) {
    const { executor, setResponse } = await setup({ executor: { maxOutputBytes } })
    for (const contentType of ['text/plain', 'application/octet-stream', null]) {
      for (const text of ['ééééé', '中文内容', '😀😀😀']) {
        setResponse(response(text, contentType))
        for (const operationId of ['getToken', 'sibling']) {
          const result = await executor.execute({ operationId }, SESSION)
          assert.equal(result.error.code, 'RESPONSE_TOO_LARGE')
          assert.equal(result.truncated, true)
          assertBounded(result, maxOutputBytes)
          assert.equal(result.response.text.includes('\uFFFD'), false)
        }
      }
    }
  }
})

test('HTTP error bodies respect the same per-operation response redaction policy', async () => {
  const { executor, setResponse } = await setup()
  for (const [body, contentType] of [[{ access_token: ACCESS_TOKEN }, 'application/json'], ['token=fixture-error-value', 'text/plain']]) {
    setResponse(response(body, contentType, { status: 401 }))
    const raw = await executor.execute({ operationId: 'getToken' }, SESSION)
    const safe = await executor.execute({ operationId: 'sibling' }, SESSION)
    assert.equal(raw.error.code, 'HTTP_STATUS')
    assert.equal(safe.error.code, 'HTTP_STATUS')
    assert.equal(raw.status, 401)
    if (contentType === 'application/json') {
      assert.equal(raw.response.data.access_token, ACCESS_TOKEN)
      assert.equal(safe.response.data.access_token, REDACTED_VALUE)
    } else {
      assert.equal(raw.response.text, body)
      assert.equal(safe.response.text.includes('fixture-error-value'), false)
    }
  }
})

test('malformed or transport-truncated JSON remains empty with response redaction disabled', async () => {
  const { executor, setResponse } = await setup()
  for (const contentType of ['application/json', 'application/problem+json', 'text/json; charset=utf-8']) {
    setResponse(response(`{"access_token":"${ACCESS_TOKEN}","unfinished":`, contentType))
    const malformed = await executor.execute({ operationId: 'getToken' }, SESSION)
    assert.equal(malformed.ok, false)
    assert.equal(malformed.error.code, 'RESPONSE_INVALID')
    assert.deepEqual(malformed.response, { kind: 'text', text: '' })
    assert.equal(malformed.truncated, true)
    for (const flags of [{ truncated: true }, { tooLarge: true }, { truncated: true, tooLarge: true }]) {
      // Even parseable JSON must be discarded if the transport reports truncation.
      setResponse(response(TOKENS, contentType, flags))
      const truncated = await executor.execute({ operationId: 'getToken' }, SESSION)
      assert.equal(truncated.ok, false)
      assert.equal(truncated.error.code, 'RESPONSE_TOO_LARGE')
      assert.deepEqual(truncated.response, { kind: 'text', text: '' })
      assert.equal(truncated.truncated, true)
      assert.equal(JSON.stringify(truncated).includes(ACCESS_TOKEN), false)
    }
  }
})

test('api_call cannot supply redactResponse false or other policy overrides', async () => {
  const { executor, calls } = await setup()
  for (const operationId of ['sibling', 'getToken']) {
    for (const override of [{ redactResponse: false }, { policy: { redactResponse: false } }]) {
      const result = await executor.execute({ operationId, ...override }, SESSION)
      assert.equal(result.error.code, 'INVALID_ARGUMENT')
    }
  }
  assert.equal(calls.length, 0)
  assert.equal((await executor.execute({ operationId: 'sibling' }, SESSION)).response.data.access_token, REDACTED_VALUE)
})

test('response opt-out keeps fixed targets declared parameters and controlled/authentication headers enforced', async () => {
  const { config, executor, calls } = await setup()
  await config.createAuthProfile({ id: 'fixture-auth', type: 'bearer', secretRef: 'FIXTURE_AUTH_REF' })
  await config.updateServiceTarget('backend', { authProfileIds: ['fixture-auth'] })
  await config.createOperation(operation('fixed', {
    path: '/items/{itemId}', authProfileId: 'fixture-auth', policy: { allowAgentCall: true, redactResponse: false },
    parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'X-Trace', in: 'header', schema: { type: 'string' } }],
  }))
  const base = { operationId: 'fixed', pathParams: { itemId: 'a/b' } }
  const valid = await executor.execute({ ...base, headers: { 'X-Trace': 'fixture-trace' } }, SESSION)
  assert.equal(valid.ok, true)
  assert.equal(valid.response.data.access_token, ACCESS_TOKEN)
  assert.equal(calls[0].url, 'https://api.example.test/api/items/a%2Fb')
  assert.equal(calls[0].headers.Authorization, `Bearer ${AUTH_TOKEN}`)
  assert.equal(calls[0].headers['X-Trace'], 'fixture-trace')
  assert.equal(calls[0].redirect, 'manual')
  assert.equal(calls[0].maxRedirects, 0)
  for (const override of [{ url: 'https://evil.example.test' }, { host: 'evil.example.test' }, { baseUrl: 'https://evil.example.test' }, { redirect: 'follow' }, { query: { access_token: ACCESS_TOKEN } }, { pathParams: { itemId: 'x', extra: 'y' } }]) {
    assert.equal((await executor.execute({ ...base, ...override }, SESSION)).error.code, 'INVALID_ARGUMENT')
  }
  for (const name of ['Authorization', 'authorization', 'Host', 'Cookie', 'Content-Length', 'Proxy-Authorization']) {
    assert.equal((await executor.execute({ ...base, headers: { [name]: 'fixture-spoof' } }, SESSION)).error.code, 'INVALID_ARGUMENT')
  }
  assert.equal(calls.length, 1)
})

test('audit callback and persisted JSONL omit token values and request/response payloads despite opt-out', async () => {
  const { config, fs, transport, calls, setResponse } = await setup()
  await config.createAuthProfile({ id: 'audit-auth', type: 'bearer', secretRef: 'FIXTURE_AUDIT_AUTH_REF' })
  await config.updateServiceTarget('backend', { authProfileIds: ['audit-auth'] })
  for (const id of ['get-token', 'consume', 'write']) await config.updateOperation(id, { authProfileId: 'audit-auth' })
  const audit = createAuditLog({ fs, directory: AUDIT_DIR, clock: CLOCK })
  const records = []
  const executor = createApiKitHttpExecutor(config, { transport, clock: () => 0, async onAudit(record) { records.push(record); await audit.append(record) } })
  const token = await executor.execute({ operationId: 'getToken' }, SESSION)
  assert.equal(token.response.data.access_token, ACCESS_TOKEN)
  setResponse(response({ responseMarker: 'fixture-response-payload-value', access_token: ACCESS_TOKEN }))
  assert.equal((await executor.execute({ operationId: 'consume', query: { access_token: token.response.data.access_token } }, SESSION)).ok, true)
  const body = { requestMarker: 'fixture-request-payload-value', token: 'fixture-request-token-value' }
  const written = await executor.execute({ operationId: 'write', body }, SESSION)
  assert.equal(written.response.data.access_token, ACCESS_TOKEN)
  assert.deepEqual(JSON.parse(calls[2].body), body)
  for (const call of calls) assert.equal(call.headers.Authorization, `Bearer ${AUTH_TOKEN}`)
  await audit.flush()
  const persisted = fs.getFile(`${AUDIT_DIR}\\audit-2026-08-27.jsonl`)
  assert.equal(records.length, 3)
  assert.equal(persisted.trim().split('\n').length, 3)
  const forbidden = ['url', 'query', 'headers', 'body', 'request', 'requestBody', 'response', 'responseBody', 'payload']
  for (const record of [...records, ...persisted.trim().split('\n').map((line) => JSON.parse(line))]) {
    assert.equal(record.outed, true)
    assert.equal(record.status, 200)
    assert.equal(record.host, 'api.example.test')
    for (const name of forbidden) assert.equal(Object.hasOwn(record, name), false, name)
  }
  for (const text of [JSON.stringify(records), persisted]) {
    for (const value of [ACCESS_TOKEN, REFRESH_TOKEN, AUTH_TOKEN, 'fixture-nested-value', 'fixture-password-value', 'fixture-custom-value', 'fixture-request-payload-value', 'fixture-request-token-value', 'fixture-response-payload-value']) assert.equal(text.includes(value), false, value)
    for (const name of ['access_token', 'requestMarker', 'responseMarker']) assert.equal(text.includes(name), false, name)
  }
  assert.equal(audit.getDiagnostics().dropped, 0)
  await audit.dispose()
})

test('write response opt-out and immediate re-enable use the same bounded projection as reads', async () => {
  const { config, executor, calls, setResponse } = await setup()
  const args = { operationId: 'write', body: { requestMarker: 'fixture-write-request' } }
  const raw = await executor.execute(args, SESSION)
  assert.equal(raw.ok, true)
  assert.deepEqual(raw.response, { kind: 'json', data: TOKENS })
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].headers['Content-Type'], 'application/json')
  await config.updateOperation('write', { policy: { redactResponse: true } })
  assert.equal((await executor.execute(args, SESSION)).response.data.access_token, REDACTED_VALUE)
  await config.updateOperation('write', { policy: { redactResponse: false } })
  setResponse(response('{"access_token":"fixture-write-malformed-value"'))
  const malformed = await executor.execute(args, SESSION)
  assert.equal(malformed.error.code, 'RESPONSE_INVALID')
  assert.deepEqual(malformed.response, { kind: 'text', text: '' })
})
