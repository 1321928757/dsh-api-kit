import test from 'node:test'
import assert from 'node:assert/strict'
import { ConfigurationError, safeAuthProfileView, validateAuthProfileInput } from '../lib/config-validation.js'
import { createCredentialAdapter } from '../lib/credential-adapter.js'
import { createConfigurationService } from '../lib/configuration.js'
import { createEmptyRegistry } from '../lib/model.js'
import { createMemoryFs } from './helpers/memory-fs.mjs'
import { createRegistryStore } from '../lib/registry-store.js'

const FILE = 'C:\\dsh-api-kit-auth\\registry.json'

function fakeCredentials() {
  const values = new Map()
  const calls = []
  const service = {
    async resolve(ref) { calls.push(['resolve', ref]); return values.get(ref.name) },
    async describe(ref) { calls.push(['describe', ref]); return { configured: values.has(ref.name), source: 'fake', writable: true } },
    async set(ref, value) { calls.push(['set', ref]); values.set(ref.name, value) },
    async unset(ref) { calls.push(['unset', ref]); values.delete(ref.name) },
  }
  return { service, values, calls }
}

test('all supported auth profiles normalize safely and API key query is opt-in', () => {
  assert.equal(validateAuthProfileInput({ id: 'none', type: 'none' }).type, 'none')
  assert.equal(validateAuthProfileInput({ id: 'bearer', type: 'bearer', secretRef: 'cred:bearer' }).type, 'bearer')
  assert.equal(validateAuthProfileInput({ id: 'header', type: 'api-key-header', secretRef: 'cred:key', headerName: 'X-API-Key' }).headerName, 'X-API-Key')
  const query = validateAuthProfileInput({ id: 'query', type: 'api-key-query', secretRef: 'cred:key', queryName: 'key' })
  assert.equal(query.allowQuery, false)
  assert.equal(query.risk, 'credential-in-url')
  assert.equal(validateAuthProfileInput({ id: 'basic', type: 'basic', username: 'alice', secretRef: 'cred:password' }).username, 'alice')
})

test('auth validation rejects missing secrets, controlled names and incomplete Basic', () => {
  assert.throws(() => validateAuthProfileInput({ id: 'bearer', type: 'bearer' }), (error) => error.code === 'SECRET_REF_REQUIRED')
  for (const headerName of ['Authorization', 'Cookie', 'Host', 'Content-Length', 'X-Test\r\nInjected']) {
    assert.throws(() => validateAuthProfileInput({ id: 'key', type: 'api-key-header', secretRef: 'cred:key', headerName }), (error) => error instanceof ConfigurationError)
  }
  assert.throws(() => validateAuthProfileInput({ id: 'basic', type: 'basic', secretRef: 'cred:password' }), (error) => error.code === 'BASIC_USERNAME_REQUIRED')
})

test('safe auth view contains metadata and never secretRef or secret values', () => {
  const profile = validateAuthProfileInput({ id: 'bearer', type: 'bearer', name: 'Token', secretRef: 'credential:token' })
  const view = safeAuthProfileView(profile, { configured: true, source: 'fake', writable: true })
  assert.equal(view.hasSecret, true)
  assert.equal(view.credentialSource, 'fake')
  assert.equal('secretRef' in view, false)
  assert.equal(JSON.stringify(view).includes('credential:token'), false)
  assert.equal(JSON.stringify(view).includes('password'), false)
  assert.equal('secretRef' in view, false)
})

test('credential adapter resolves and describes per call, and fails safely without a provider', async () => {
  const fake = fakeCredentials()
  const adapter = createCredentialAdapter({ service: fake.service })
  await adapter.set('cred:token', 'secret-value')
  assert.equal((await adapter.resolve('cred:token')).name, undefined)
  assert.equal((await adapter.resolve('cred:token')).value, 'secret-value')
  assert.equal((await adapter.describe('cred:token')).configured, true)
  assert.equal(fake.calls.filter(([name]) => name === 'resolve').length, 2)

  const unavailable = createCredentialAdapter()
  await assert.rejects(unavailable.resolve('cred:token'), (error) => error.code === 'CREDENTIAL_PROVIDER_UNAVAILABLE')
})

test('configuration resolves credentials only on Host and query auth remains disabled', async () => {
  const fake = fakeCredentials()
  const fs = createMemoryFs()
  const store = createRegistryStore({ fs, filePath: FILE, clock: () => new Date('2026-08-27T00:00:00Z') })
  await store.load()
  const config = createConfigurationService({ store, credentialAdapter: createCredentialAdapter({ service: fake.service }) })
  await config.createAuthProfile({ id: 'bearer', type: 'bearer', secretRef: 'cred:bearer' })
  await fake.service.set({ name: 'cred:bearer' }, 'do-not-leak')
  const view = await config.describeAuthProfile('bearer')
  assert.equal(view.hasSecret, true)
  assert.equal(JSON.stringify(view).includes('do-not-leak'), false)
  const auth = await config.resolveAuthForRequest('bearer')
  assert.equal(auth.headers.Authorization, 'Bearer do-not-leak')
  assert.equal(JSON.stringify(config.getSnapshot()).includes('do-not-leak'), false)

  await config.createAuthProfile({ id: 'query', type: 'api-key-query', secretRef: 'cred:query', queryName: 'key' })
  await assert.rejects(config.resolveAuthForRequest('query'), (error) => error.code === 'QUERY_AUTH_DISABLED')
})

console.log('Auth tests complete')
