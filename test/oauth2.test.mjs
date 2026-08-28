import test from 'node:test'
import assert from 'node:assert/strict'
import { createOAuth2Client, OAuth2Error, validateOAuth2Config } from '../lib/oauth2.js'

const base = { tokenEndpoint: 'https://auth.example.test/oauth/token', clientId: 'client', secretRef: 'cred:client', scope: 'read' }

function response(body, status = 200, contentType = 'application/json') {
  return { status, headers: { 'content-type': contentType }, text: async () => body }
}

test('strictly validates HTTPS token endpoints and supported auth methods', () => {
  for (const tokenEndpoint of ['http://auth.example.test/token', 'https://auth.example.test/token?x=1', 'https://user:pass@auth.example.test/token', 'https://auth.example.test/token#x']) {
    assert.throws(() => validateOAuth2Config({ ...base, tokenEndpoint }), (e) => e instanceof OAuth2Error)
  }
  assert.throws(() => validateOAuth2Config({ ...base, authMethod: 'none' }), (e) => e.code === 'AUTH_METHOD_UNSUPPORTED')
  assert.throws(() => validateOAuth2Config({ ...base, scope: 'bad\nvalue' }), (e) => e.code === 'SCOPE_INVALID')
  assert.equal(validateOAuth2Config({ ...base, authMethod: 'client_secret_post' }).authMethod, 'client_secret_post')
  assert.throws(() => validateOAuth2Config({ ...base }, { endpointValidator: () => false }), (e) => e.code === 'TOKEN_ENDPOINT_REJECTED')
})

test('client_secret_basic sends form request and resolves credentials only at request time', async () => {
  const calls = []
  const client = createOAuth2Client({ config: base, resolver: async (ref) => { calls.push(ref); return { value: 's3cret' } }, transport: async (request) => { calls.push(request); return response(JSON.stringify({ access_token: 'token-value', token_type: 'Bearer', expires_in: 300 })) } })
  const result = await client.getToken()
  assert.deepEqual(result, { accessToken: 'token-value', tokenType: 'Bearer', expiresIn: 300 })
  assert.equal(calls[0], 'cred:client')
  assert.equal(calls[1].method, 'POST')
  assert.equal(calls[1].headers['content-type'], 'application/x-www-form-urlencoded')
  assert.equal(calls[1].headers.authorization, `Basic ${Buffer.from('client:s3cret').toString('base64')}`)
  assert.equal(new URLSearchParams(calls[1].body).get('grant_type'), 'client_credentials')
  assert.equal(new URLSearchParams(calls[1].body).get('scope'), 'read')
  assert.equal(JSON.stringify(new OAuth2Error('X', 'stable')).includes('s3cret'), false)
})

test('client_secret_post, bounded JSON response, cache key, single-flight, clear and dispose', async () => {
  let requests = 0
  let release
  const gate = new Promise(resolve => { release = resolve })
  const client = createOAuth2Client({ config: { ...base, authMethod: 'client_secret_post', scope: '' }, resolver: async () => 'secret', transport: async (request) => { requests++; await gate; return response('{"access_token":"t","token_type":"bearer","expires_in":60}') } })
  const a = client.getToken({ audience: 'one' }); const b = client.getToken({ audience: 'one' }); release()
  assert.deepEqual(await Promise.all([a, b]), [{ accessToken: 't', tokenType: 'bearer', expiresIn: 60 }, { accessToken: 't', tokenType: 'bearer', expiresIn: 60 }])
  assert.equal(requests, 1)
  const cached = await client.getToken({ audience: 'one' }); assert.equal(cached.accessToken, 't'); assert.equal(requests, 1)
  const postRequest = []
  const postClient = createOAuth2Client({ config: { ...base, authMethod: 'client_secret_post' }, resolver: async () => 'secret', transport: async (r) => { postRequest.push(r); return response('{"access_token":"x","token_type":"Bearer","expires_in":1}') } })
  await postClient.getToken(); const form = new URLSearchParams(postRequest[0].body); assert.equal(form.get('client_secret'), 'secret'); assert.equal(postRequest[0].headers.authorization, undefined)
  client.clear(); assert.equal(client.size, 0); client.dispose(); await assert.rejects(client.getToken(), e => e.code === 'DISPOSED')
})

test('supports canonical byte responses, injected clock/base64, and request signal', async () => {
  let now = 1000
  let encoded
  let request
  const signal = { aborted: false }
  const client = createOAuth2Client({ config: base, clock: () => now, base64Encode: (bytes) => { encoded = bytes; return 'custom-base64' }, resolver: async () => '秘密', transport: async (r) => { request = r; return { status: 200, contentType: 'application/json; charset=utf-8', body: new TextEncoder().encode('{"access_token":"安全-token","token_type":"Bearer","expires_in":60}') } } })
  assert.deepEqual(await client.getToken({ signal }), { accessToken: '安全-token', tokenType: 'Bearer', expiresIn: 60 })
  assert.equal(request.signal, signal)
  assert.equal(request.headers.authorization, 'Basic custom-base64')
  assert.equal(new TextDecoder().decode(encoded), 'client:秘密')
})

test('clear prevents an old flight from populating cache or deleting a new flight', async () => {
  let releaseOld
  let calls = 0
  const oldGate = new Promise(resolve => { releaseOld = resolve })
  const client = createOAuth2Client({ config: base, resolver: async () => 'secret', transport: async () => { calls++; if (calls === 1) { await oldGate; return response('{"access_token":"old","token_type":"Bearer","expires_in":60}') }; return response('{"access_token":"new","token_type":"Bearer","expires_in":60}') } })
  const old = client.getToken()
  client.clear()
  const fresh = client.getToken()
  assert.equal((await fresh).accessToken, 'new')
  releaseOld()
  assert.equal((await old).accessToken, 'old')
  assert.equal(client.size, 1)
  assert.equal((await client.getToken()).accessToken, 'new')
  assert.equal(calls, 2)
})

test('rejects malformed status and unsafe or unbounded token fields', async (t) => {
  for (const body of [
    '{"access_token":"x\\n","token_type":"Bearer","expires_in":1}',
    '{"access_token":"x","token_type":"Bearer","expires_in":0}',
    '{"access_token":"x","token_type":"Bearer","expires_in":null}',
    '{"access_token":"x","token_type":"Bearer","expires_in":31536001}',
  ]) await t.test(body, async () => {
    const client = createOAuth2Client({ config: base, resolver: async () => 'secret', transport: async () => response(body) })
    await assert.rejects(client.getToken(), e => e.code === 'TOKEN_RESPONSE_INVALID')
  })
  const invalid = createOAuth2Client({ config: base, resolver: async () => 'secret', transport: async () => ({ status: 200.5, contentType: 'application/json', body: new Uint8Array() }) })
  await assert.rejects(invalid.getToken(), e => e.code === 'TOKEN_TRANSPORT_INVALID')
})

test('rejects oversized, wrong content type, malformed and incomplete token responses without leaking details', async (t) => {
  for (const [name, res] of [
    ['large', response('x'.repeat(20), 200, 'application/json')],
    ['type', response('{}', 200, 'text/plain')],
    ['json', response('{not-json}', 200, 'application/json')],
    ['fields', response('{"access_token":"x"}', 200, 'application/json')],
  ]) {
    await t.test(name, async () => {
      const client = createOAuth2Client({ config: base, maxResponseBytes: 10, resolver: async () => 'secret', transport: async () => res })
      await assert.rejects(client.getToken(), e => e instanceof OAuth2Error && !e.message.includes('secret') && !e.message.includes(base.tokenEndpoint))
    })
  }
})
