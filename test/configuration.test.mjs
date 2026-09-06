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
  await config.createServiceTarget({ id: 'backend', name: 'Backend', environmentIds: ['dev', 'prod'], endpoints: { dev: { baseUrl: 'https://api.example.test/dev' }, prod: { baseUrl: 'https://api.example.test' } }, defaultEnvironmentId: 'dev', authProfileIds: ['token'] })
  assert.deepEqual(config.getServiceTarget('backend').environmentIds, ['dev', 'prod'])
  assert.equal(config.getEnvironment('prod').agentEnabled, false)
  assert.equal((await config.listAuthProfiles())[0].hasSecret, false)
  assert.equal('secretRef' in (await config.getAuthProfile('token')), false)
})

test('未知 auth type 在创建和 registry load/import validation 时都被拒绝', async () => {
  const context = await loadedSetup()
  const { config, store, fs } = context
  await assert.rejects(config.createAuthProfile({ id: 'bad', type: 'mystery' }), (error) => error.code === 'AUTH_TYPE_UNSUPPORTED')
  await fs.writeFile(FILE, JSON.stringify({ schemaVersion: 1, kits: [], operations: [], serviceTargets: [], environments: [], authProfiles: [{ id: 'bad', type: 'mystery' }] }), 'utf8')
  const result = await store.load()
  assert.equal(result.recovered, true)
  assert.equal(store.getDiagnostics().code, 'NORMALIZATION_INVALID')
})

test('OAuth2 client credentials profile remains valid and safe view omits endpoint URL', async () => {
  const { config } = await loadedSetup()
  await config.createAuthProfile({ id: 'oauth', type: 'oauth2-client-credentials', tokenEndpoint: 'https://issuer.example.test/oauth/token', clientId: 'client', scope: 'read', secretRef: 'credential:oauth' })
  const view = await config.getAuthProfile('oauth')
  assert.equal(view.type, 'oauth2-client-credentials')
  assert.equal(view.tokenEndpointHost, 'issuer.example.test')
  assert.equal(view.tokenEndpointPath, '/oauth/token')
  assert.equal(JSON.stringify(view).includes('https://issuer.example.test'), false)
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

test('auth profile patch preserves omitted fields and returns a safe view', async () => {
  const { config } = await loadedSetup()
  await config.createAuthProfile({ id: 'token', type: 'bearer', secretRef: 'credential:token', name: 'Token' })
  const updated = await config.updateAuthProfile('token', { enabled: false })
  assert.equal(updated.type, 'bearer')
  assert.equal(updated.enabled, false)
  assert.equal('secretRef' in updated, false)
  assert.equal(config.getSnapshot().authProfiles[0].type, 'bearer')
  assert.equal('secretRef' in config.getSnapshot().authProfiles[0], false)
})

test('environment and service target patches preserve omitted fields', async () => {
  const { config } = await loadedSetup()
  await config.createEnvironment({ id: 'dev', name: 'Development', baseUrl: 'https://api.example.test', production: true })
  const environment = await config.updateEnvironment('dev', { description: 'patched' })
  assert.equal(environment.name, 'Development')
  assert.equal(environment.production, true)
  await config.createServiceTarget({ id: 'backend', name: 'Backend', environmentIds: ['dev'], defaultEnvironmentId: 'dev' })
  const target = await config.updateServiceTarget('backend', { description: 'patched' })
  assert.deepEqual(target.environmentIds, ['dev'])
  assert.equal(target.name, 'Backend')
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
  assert.equal(context.config.getEnvironment('dev').id, before.environments[0].id)
  assert.equal(context.config.getDiagnostics().code, 'BACKUP_FAILED')
})

test('auth profile management supports generated refs, secret lifecycle, disabled guards and safe deletion', async () => {
  const { config, secretValues } = await loadedSetup()
  const created = await config.createAuthProfile({ id: 'wechat', name: 'WeCom API', type: 'api-key-query', queryName: 'key' })
  assert.equal(created.id, 'wechat')
  assert.equal(created.hasSecret, false)
  assert.equal('secretRef' in created, false)
  await config.setAuthSecret('wechat', 'wechat-secret')
  assert.equal((await config.getAuthProfile('wechat')).hasSecret, true)
  assert.equal(secretValues.get('DSH_API_KIT_AUTH_WECHAT'), 'wechat-secret')
  await config.unsetAuthSecret('wechat')
  assert.equal((await config.getAuthProfile('wechat')).hasSecret, false)
  await config.updateAuthProfile('wechat', { allowQuery: true })
  await config.setAuthSecret('wechat', 'wechat-secret-2')
  assert.equal((await config.resolveAuthForRequest('wechat')).query.key, 'wechat-secret-2')
  await config.updateAuthProfile('wechat', { enabled: false })
  await assert.rejects(config.resolveAuthForRequest('wechat'), (error) => error.code === 'AUTH_PROFILE_DISABLED')
  await config.createEnvironment({ id: 'dev', baseUrl: 'https://api.example.test' })
  await assert.rejects(config.createServiceTarget({ id: 'disabled-target', name: 'Disabled', environmentIds: ['dev'], endpoints: { dev: { baseUrl: 'https://api.example.test' } }, authProfileIds: ['wechat'] }), (error) => error.code === 'AUTH_PROFILE_DISABLED')
  await config.updateAuthProfile('wechat', { enabled: true })
  await config.createServiceTarget({ id: 'target', name: 'Target', environmentIds: ['dev'], authProfileIds: ['wechat'] })
  await assert.rejects(config.deleteAuthProfile('wechat'), (error) => error.code === 'AUTH_PROFILE_IN_USE' && error.detail.references.length > 0)
})

test('missing credential provider is reported separately from metadata CRUD', async () => {
  const unavailable = {
    available: false,
    async describe() { throw Object.assign(new Error('Credential provider is unavailable'), { code: 'CREDENTIAL_PROVIDER_UNAVAILABLE' }) },
    async resolve() { throw Object.assign(new Error('Credential provider is unavailable'), { code: 'CREDENTIAL_PROVIDER_UNAVAILABLE' }) },
    async set() { throw Object.assign(new Error('Credential provider is unavailable'), { code: 'CREDENTIAL_PROVIDER_UNAVAILABLE' }) },
    async unset() { throw Object.assign(new Error('Credential provider is unavailable'), { code: 'CREDENTIAL_PROVIDER_UNAVAILABLE' }) },
  }
  const isolated = await loadedSetup({ credentialAdapter: unavailable })
  const profile = await isolated.config.createAuthProfile({ id: 'wecom-corpsecret', type: 'api-key-query', queryName: 'corpsecret', allowQuery: true })
  assert.equal(profile.hasSecret, false)
  await assert.rejects(isolated.config.setAuthSecret('wecom-corpsecret', 'not-recorded'), (error) => error.code === 'CREDENTIAL_PROVIDER_UNAVAILABLE')
})

test('auth profile secret writes do not mutate Registry or leak values in safe views', async () => {
  const { config } = await loadedSetup()
  await config.createAuthProfile({ id: 'bearer', type: 'bearer' })
  await config.setAuthSecret('bearer', 'secret-value')
  assert.doesNotMatch(JSON.stringify(config.getSnapshot()), /secret-value|DSH_API_KIT_AUTH_BEARER/)
  assert.doesNotMatch(JSON.stringify(await config.listAuthProfiles()), /secret-value|dsh-api-kit\/auth\/bearer/)
  assert.equal((await config.getAuthProfile('bearer')).hasSecret, true)
})

console.log('Configuration tests complete')
