import test from 'node:test'
import assert from 'node:assert/strict'
import { createCredentialAdapter } from '../lib/credential-adapter.js'
import { createConfigurationService } from '../lib/configuration.js'
import { createRegistryStore } from '../lib/registry-store.js'
import { createMemoryFs } from './helpers/memory-fs.mjs'

const FILE = 'C:\\dsh-api-kit-credential-adapter\\registry.json'
const clock = () => new Date('2026-08-27T00:00:00Z')

function fakeCredentials() {
  const values = new Map()
  const calls = []
  return {
    values,
    calls,
    service: {
      async describe(ref) { calls.push(['describe', ref]); return { configured: values.has(ref), source: 'test', writable: true } },
      async resolve(ref) { calls.push(['resolve', ref]); return values.has(ref) ? { value: values.get(ref) } : undefined },
      async set(ref, value) { calls.push(['set', ref]); values.set(ref, value) },
      async unset(ref) { calls.push(['unset', ref]); values.delete(ref) },
    },
  }
}

test('credentials adapter accepts POSIX refs and normalizes legacy refs only at the DSH boundary', async () => {
  const fake = fakeCredentials()
  const adapter = createCredentialAdapter({ service: fake.service })
  await adapter.set('CUSTOM_REF_1', 'one')
  assert.equal((await adapter.resolve('CUSTOM_REF_1')).value, 'one')
  assert.throws(() => adapter.toCredentialRef('credential:bad'), (error) => error.code === 'SECRET_REF_INVALID')
  assert.throws(() => adapter.toCredentialRef('2BAD'), (error) => error.code === 'SECRET_REF_INVALID')
  assert.equal(adapter.toCredentialRef('dsh-api-kit/auth/2bad'), 'DSH_API_KIT_AUTH_2BAD')
  await adapter.set('dsh-api-kit/auth/2bad', 'legacy')
  assert.equal(fake.values.get(adapter.toCredentialRef('dsh-api-kit/auth/2bad')), 'legacy')
})

test('credential mutations honor writable status and provider rejection without Registry writes', async () => {
  const fs = createMemoryFs()
  const store = createRegistryStore({ fs, filePath: FILE, clock })
  await store.load()
  const fake = fakeCredentials()
  const adapter = createCredentialAdapter({ service: fake.service })
  const config = createConfigurationService({ store, credentialAdapter: adapter })
  await config.createAuthProfile({ id: 'readonly', type: 'bearer', secretRef: 'READ_ONLY_REF' })
  const before = store.getSnapshot()
  const originalDescribe = fake.service.describe
  fake.service.describe = async (ref) => ({ configured: fake.values.has(ref), source: 'env', writable: false })
  await assert.rejects(config.setAuthSecret('readonly', 'not-stored'), (error) => error.code === 'CREDENTIAL_NOT_WRITABLE')
  await assert.rejects(config.unsetAuthSecret('readonly'), (error) => error.code === 'CREDENTIAL_NOT_WRITABLE')
  assert.deepEqual(store.getSnapshot(), before)
  assert.equal(fake.calls.some(([method]) => method === 'set' || method === 'unset'), false)

  fake.service.describe = originalDescribe
  const originalSet = fake.service.set
  fake.service.set = async () => { throw new Error('read-only race') }
  await assert.rejects(config.setAuthSecret('readonly', 'not-stored'), (error) => error.code === 'CREDENTIAL_WRITE_FAILED')
  assert.deepEqual(store.getSnapshot(), before)
  fake.service.set = originalSet
  await config.setAuthSecret('readonly', 'stored')
  assert.equal(fake.values.get('READ_ONLY_REF'), 'stored')
  await config.unsetAuthSecret('readonly')
  assert.equal(fake.values.has('READ_ONLY_REF'), false)
  fake.service.describe = async () => { throw new Error('provider offline') }
  await assert.rejects(config.setAuthSecret('readonly', 'not-stored'), (error) => error.code === 'CREDENTIAL_PROVIDER_UNAVAILABLE')
  await assert.rejects(config.unsetAuthSecret('readonly'), (error) => error.code === 'CREDENTIAL_PROVIDER_UNAVAILABLE')
  assert.deepEqual(store.getSnapshot(), before)
})
