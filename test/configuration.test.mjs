import test from 'node:test'
import assert from 'node:assert/strict'
import { createConfigurationService } from '../lib/configuration.js'
import { createRegistryStore } from '../lib/registry-store.js'
import { createMemoryFs } from './helpers/memory-fs.mjs'

const FILE = 'C:\\dsh-api-kit-config\\registry.json'
const CLOCK = () => new Date('2026-08-27T00:00:00Z')

function setup(options = {}) {
  const fs = createMemoryFs()
  const store = createRegistryStore({ fs, filePath: FILE, clock: CLOCK })
  const secretValues = new Map()
  const calls = []
  const adapter = {
    available: true,
    toCredentialRef: (secretRef) => secretRef,
    async describe(ref) { calls.push(['describe', ref]); return { configured: secretValues.has(ref), source: 'fake', writable: true } },
    async resolve(ref) { calls.push(['resolve', ref]); return secretValues.has(ref) ? { value: secretValues.get(ref) } : undefined },
    async set(ref, value) { calls.push(['set', ref]); secretValues.set(ref, value) },
    async unset(ref) { calls.push(['unset', ref]); secretValues.delete(ref) },
  }
  return { fs, store, config: createConfigurationService({ store, credentialAdapter: options.credentialAdapter ?? adapter }), secretValues, calls }
}

async function loadedSetup(options) {
  const context = setup(options)
  await context.store.load()
  return context
}

test('configuration CRUD supports target multi-environment and auth relations', async () => {
  const { config } = await loadedSetup()
  await config.createEnvironment({ id: 'dev', name: 'Development', baseUrl: 'https://api.example.test/dev' })
  await config.createEnvironment({ id: 'prod', name: 'Production', baseUrl: 'https://api.example.test', production: true })
  await config.createAuthProfile({ id: 'token', type: 'bearer', secretRef: 'credential:token' })
  await config.createServiceTarget({ id: 'backend', name: 'Backend', environmentIds: ['dev', 'prod'], defaultEnvironmentId: 'dev', authProfileIds: ['token'] })
  assert.deepEqual(config.getServiceTarget('backend').environmentIds, ['dev', 'prod'])
  assert.equal(config.getEnvironment('prod').agentEnabled, false)
  assert.equal((await config.listAuthProfiles())[0].hasSecret, false)
  assert.equal('secretRef' in (await config.getAuthProfile('token')), false)
})

test('default environment must be bound and duplicate IDs are rejected', async () => {
  const { config } = await loadedSetup()
  await assert.rejects(config.createServiceTarget({ id: 'backend', environmentIds: ['dev'], defaultEnvironmentId: 'prod' }), (error) => error.code === 'DEFAULT_ENVIRONMENT_NOT_BOUND')
  await config.createEnvironment({ id: 'dev', baseUrl: 'https://api.example.test' })
  await assert.rejects(config.createEnvironment({ id: 'dev', baseUrl: 'https://api.example.test' }), (error) => error.code === 'DUPLICATE_ID')
})

test('deleting referenced environments, targets and auth profiles is rejected with actionable references', async () => {
  const { config } = await loadedSetup()
  await config.createEnvironment({ id: 'dev', baseUrl: 'https://api.example.test' })
  await config.createAuthProfile({ id: 'token', type: 'bearer', secretRef: 'credential:token' })
  await config.createServiceTarget({ id: 'backend', environmentIds: ['dev'], authProfileIds: ['token'] })
  await assert.rejects(config.deleteEnvironment('dev'), (error) => error.code === 'ENVIRONMENT_IN_USE' && error.detail.references.includes('serviceTargets[0]'))
  await assert.rejects(config.deleteAuthProfile('token'), (error) => error.code === 'AUTH_PROFILE_IN_USE')
  assert.equal(await config.deleteServiceTarget('backend'), true)
  assert.equal(await config.deleteAuthProfile('token'), true)
  assert.equal(await config.deleteEnvironment('dev'), true)
})

test('safe auth list and get never expose secretRef; secret resolution is request-time', async () => {
  const { config, secretValues, calls } = await loadedSetup()
  await config.createAuthProfile({ id: 'token', type: 'bearer', secretRef: 'credential:token' })
  await config.setAuthSecret('token', 'first-secret')
  const first = await config.resolveAuthForRequest('token')
  secretValues.set('credential:token', 'second-secret')
  const second = await config.resolveAuthForRequest('token')
  assert.equal(first.headers.Authorization, 'Bearer first-secret')
  assert.equal(second.headers.Authorization, 'Bearer second-secret')
  assert.equal(JSON.stringify(config.getSnapshot()).includes('first-secret'), false)
  assert.equal(JSON.stringify(config.getSnapshot()).includes('second-secret'), false)
  assert.equal(JSON.stringify(await config.listAuthProfiles()).includes('credential:token'), false)
  assert.ok(calls.filter(([kind]) => kind === 'resolve').length >= 2)
})

test('credential provider may be unavailable for CRUD but request resolution fails safely', async () => {
  const adapter = { available: false, toCredentialRef: (value) => value, async describe() { return { configured: false, available: false, writable: false } }, async resolve() { return undefined }, async set() {}, async unset() {} }
  const { config } = await loadedSetup({ credentialAdapter: adapter })
  await config.createAuthProfile({ id: 'token', type: 'bearer', secretRef: 'credential:token' })
  const view = await config.getAuthProfile('token')
  assert.equal(view.hasSecret, false)
  await assert.rejects(config.resolveAuthForRequest('token'), (error) => error.code === 'CREDENTIAL_NOT_CONFIGURED')
})

test('none profiles cannot store secrets and query auth requires explicit enablement', async () => {
  const { config } = await loadedSetup()
  await config.createAuthProfile({ id: 'none', type: 'none' })
  await assert.rejects(config.setAuthSecret('none', 'secret'), (error) => error.code === 'AUTH_TYPE_NONE')
  await config.createAuthProfile({ id: 'query', type: 'api-key-query', secretRef: 'credential:key', queryName: 'key' })
  await assert.rejects(config.resolveAuthForRequest('query'), (error) => error.code === 'QUERY_AUTH_DISABLED')
  await config.updateAuthProfile('query', { type: 'api-key-query', secretRef: 'credential:key', queryName: 'key', allowQuery: true })
  await config.setAuthSecret('query', 'query-secret')
  const auth = await config.resolveAuthForRequest('query')
  assert.equal(auth.query.key, 'query-secret')
})

test('registry write failure leaves configuration snapshot unchanged', async () => {
  const context = await loadedSetup()
  await context.config.createEnvironment({ id: 'dev', baseUrl: 'https://api.example.test' })
  const before = context.config.getSnapshot()
  context.fs.fail('copyFile')
  await assert.rejects(context.config.updateEnvironment('dev', { baseUrl: 'https://changed.example.test' }), (error) => error.code === 'BACKUP_FAILED')
  assert.equal(context.config.getEnvironment('dev').baseUrl, before.environments[0].baseUrl)
  assert.equal(context.config.getDiagnostics().code, 'BACKUP_FAILED')
})

console.log('Configuration tests complete')
