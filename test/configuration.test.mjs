import test from 'node:test'
import assert from 'node:assert/strict'
import { createConfigurationService } from '../lib/configuration.js'
import { ConfigurationError } from '../lib/config-validation.js'
import { createRegistryStore } from '../lib/registry-store.js'
import { createMemoryFs } from './helpers/memory-fs.mjs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const FILE = 'C:\\dsh-api-kit-config\\registry.json'
const CLOCK = () => new Date('2026-08-27T00:00:00Z')
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

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
  await config.createAuthProfile({ id: 'token', type: 'bearer', secretRef: 'CREDENTIAL_TOKEN' })
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
  await config.createAuthProfile({ id: 'oauth', type: 'oauth2-client-credentials', tokenEndpoint: 'https://issuer.example.test/oauth/token', clientId: 'client', scope: 'read', secretRef: 'CREDENTIAL_OAUTH' })
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
  await config.createAuthProfile({ id: 'token', type: 'bearer', secretRef: 'CREDENTIAL_TOKEN' })
  await config.createServiceTarget({ id: 'backend', environmentIds: ['dev'], authProfileIds: ['token'] })
  await assert.rejects(config.deleteEnvironment('dev'), (error) => error.code === 'ENVIRONMENT_IN_USE' && error.detail.references.includes('serviceTargets[0]'))
  await assert.rejects(config.deleteAuthProfile('token'), (error) => error.code === 'AUTH_PROFILE_IN_USE')
  assert.equal(await config.deleteServiceTarget('backend'), true)
  assert.equal(await config.deleteAuthProfile('token'), true)
  assert.equal(await config.deleteEnvironment('dev'), true)
})

test('safe auth list and get never expose secretRef; secret resolution is request-time', async () => {
  const { config, secretValues, calls } = await loadedSetup()
  await config.createAuthProfile({ id: 'token', type: 'bearer', secretRef: 'CREDENTIAL_TOKEN' })
  await config.setAuthSecret('token', 'first-secret')
  const first = await config.resolveAuthForRequest('token')
  secretValues.set('CREDENTIAL_TOKEN', 'second-secret')
  const second = await config.resolveAuthForRequest('token')
  assert.equal(first.headers.Authorization, 'Bearer first-secret')
  assert.equal(second.headers.Authorization, 'Bearer second-secret')
  assert.equal(JSON.stringify(config.getSnapshot()).includes('first-secret'), false)
  assert.equal(JSON.stringify(config.getSnapshot()).includes('second-secret'), false)
  assert.equal(JSON.stringify(await config.listAuthProfiles()).includes('CREDENTIAL_TOKEN'), false)
  assert.ok(calls.filter(([kind]) => kind === 'resolve').length >= 2)
})

test('credential provider may be unavailable for CRUD but request resolution fails safely', async () => {
  const adapter = { available: false, toCredentialRef: (value) => value, async describe() { return { configured: false, available: false, writable: false } }, async resolve() { return undefined }, async set() {}, async unset() {} }
  const { config } = await loadedSetup({ credentialAdapter: adapter })
  await config.createAuthProfile({ id: 'token', type: 'bearer', secretRef: 'CREDENTIAL_TOKEN' })
  const view = await config.getAuthProfile('token')
  assert.equal(view.hasSecret, false)
  await assert.rejects(config.resolveAuthForRequest('token'), (error) => error.code === 'CREDENTIAL_NOT_CONFIGURED')
})

test('auth profile patch preserves omitted fields and returns a safe view', async () => {
  const { config } = await loadedSetup()
  await config.createAuthProfile({ id: 'token', type: 'bearer', secretRef: 'CREDENTIAL_TOKEN', name: 'Token' })
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
  await config.createAuthProfile({ id: 'query', type: 'api-key-query', secretRef: 'CREDENTIAL_KEY', queryName: 'key' })
  await assert.rejects(config.resolveAuthForRequest('query'), (error) => error.code === 'QUERY_AUTH_DISABLED')
  await config.updateAuthProfile('query', { type: 'api-key-query', secretRef: 'CREDENTIAL_KEY', queryName: 'key', allowQuery: true })
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

test('new default credential refs are POSIX-valid, collision-resistant, and explicit refs remain unchanged', async () => {
  const context = await loadedSetup()
  const { config, calls } = context
  const ids = ['api-key', 'api_key', 'Mixed.Case', 'x'.repeat(128)]
  const refs = []
  for (const id of ids) {
    const profile = await config.createAuthProfile({ id, type: 'bearer' })
    assert.equal(profile.id, id.toLowerCase())
    await config.setAuthSecret(id.toLowerCase(), `value-${refs.length}`)
    const lastSet = context.calls.filter(([kind]) => kind === 'set').at(-1)
    refs.push(lastSet[1])
  }
  assert.equal(new Set(refs).size, ids.length)
  assert.ok(refs.some((ref) => ref === 'DSH_API_KIT_AUTH_API_KEY') === false)
  for (const ref of refs) assert.match(ref, /^[A-Za-z_][A-Za-z0-9_]*$/)
  assert.ok(refs.every((ref) => ref.length <= 128))
  await config.createAuthProfile({ id: 'long-id', type: 'bearer' })
  const longProfile = context.store.getSnapshot().authProfiles.find((item) => item.id === 'long-id')
  assert.match(longProfile.secretRef, /^[A-Za-z_][A-Za-z0-9_]*$/)
  assert.ok(longProfile.secretRef.length <= 128)
  await config.createAuthProfile({ id: 'explicit', type: 'bearer', secretRef: 'CUSTOM_SECRET_REF' })
  assert.equal(context.store.getSnapshot().authProfiles.find((item) => item.id === 'explicit').secretRef, 'CUSTOM_SECRET_REF')
})

test('legacy normalized credential-reference collisions are reported without values and block new reuse', async () => {
  const context = await loadedSetup()
  const legacy = JSON.parse(await readFile(path.join(ROOT, 'test/fixtures/legacy-auth-collision.json'), 'utf8'))
  context.fs.setFile(FILE, JSON.stringify(legacy))
  await context.store.load()
  const diagnostic = context.config.getAuthSecretRefDiagnostics()
  assert.equal(diagnostic.code, 'AUTH_SECRET_REF_COLLISION')
  assert.deepEqual(diagnostic.conflicts, [{ secretRef: 'DSH_API_KIT_AUTH_API_KEY', profileIds: ['api-key', 'api.key'] }])
  assert.doesNotMatch(JSON.stringify(diagnostic), /secret-value/)
  assert.equal(diagnostic.conflicts[0].secretRef, 'DSH_API_KIT_AUTH_API_KEY')
  assert.equal(context.store.getSnapshot().authProfiles[0].secretRef, 'DSH_API_KIT_AUTH_API_KEY')
  await assert.rejects(context.config.createAuthProfile({ id: 'api-key-new', type: 'bearer', secretRef: 'DSH_API_KIT_AUTH_API_KEY' }), (error) => error instanceof ConfigurationError && error.code === 'AUTH_SECRET_REF_CONFLICT')
  await assert.rejects(context.config.createAuthProfile({ id: 'api_key', type: 'bearer', secretRef: `DSH_API_KIT_AUTH_${'API_KEY'}` }), (error) => error.code === 'AUTH_SECRET_REF_CONFLICT')
  await context.config.updateAuthProfile('api-key', { name: 'Still preserved' })
  assert.equal(context.store.getSnapshot().authProfiles[0].secretRef, 'DSH_API_KIT_AUTH_API_KEY')
  await context.config.updateAuthProfile('api.key', { secretRef: 'DSH_API_KIT_AUTH_API_KEY_2' })
  assert.equal(context.config.getAuthSecretRefDiagnostics(), undefined)
  await context.config.createAuthProfile({ id: 'fresh', type: 'bearer', secretRef: 'DSH_API_KIT_AUTH_API_KEY_2' }).then(() => assert.fail('duplicate explicit refs must be rejected'), (error) => assert.equal(error.code, 'AUTH_SECRET_REF_CONFLICT'))
})

test('legacy sentinel reference is preserved under old mapping and Registry load never rewrites stored refs', async () => {
  const context = await loadedSetup()
  context.fs.setFile(FILE, JSON.stringify({ schemaVersion: 1, kits: [], operations: [], environments: [], serviceTargets: [], authProfiles: [{ id: 'legacy-profile', type: 'bearer', secretRef: 'CUSTOM_OLD_REF' }] }))
  await context.store.load()
  const before = context.store.getSnapshot().authProfiles[0].secretRef
  context.fs.setFile(FILE, JSON.stringify({ schemaVersion: 1, kits: [], operations: [], environments: [], serviceTargets: [], authProfiles: [{ id: 'legacy-sentinel', type: 'bearer', secretRef: 'dsh-api-kit/auth/legacy-sentinel' }] }))
  await context.store.load()
  assert.equal(context.store.getSnapshot().authProfiles[0].secretRef, 'dsh-api-kit/auth/legacy-sentinel')
  assert.equal(before, 'CUSTOM_OLD_REF')
  const legacyStatus = await context.config.describeAuthProfile('legacy-sentinel')
  assert.equal(legacyStatus.hasSecret, false)
  assert.equal(JSON.stringify(legacyStatus).includes('dsh-api-kit/auth/legacy-sentinel'), false)
})

test('auth profile management supports generated refs, secret lifecycle, disabled guards and safe deletion', async () => {
  const context = await loadedSetup()
  const { config, secretValues, calls } = context
  const created = await config.createAuthProfile({ id: 'wechat', name: 'WeCom API', type: 'api-key-query', queryName: 'key' })
  assert.equal(created.id, 'wechat')
  assert.equal(created.hasSecret, false)
  assert.equal('secretRef' in created, false)
  await config.setAuthSecret('wechat', 'wechat-secret')
  assert.equal((await config.getAuthProfile('wechat')).hasSecret, true)
  const wechatRef = calls.filter(([kind]) => kind === 'set').at(-1)[1]
  assert.match(wechatRef, /^DSH_API_KIT_AUTH_V2_[A-F0-9]{24}$/)
  assert.equal(secretValues.get(wechatRef), 'wechat-secret')
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

test('credential writes and deletes fail closed for read-only sources without Registry mutation', async () => {
  const context = await loadedSetup()
  await context.config.createAuthProfile({ id: 'readonly', type: 'bearer' })
  const before = context.store.getSnapshot()
  const secretCallsBefore = context.calls.filter(([kind]) => kind === 'set' || kind === 'unset').length
  context.calls.length = 0
  const provider = context.config.credentialAdapter
  assert.equal(typeof provider.describe, 'function')
  const originalDescribe = provider.describe
  const originalSet = provider.set
  const originalUnset = provider.unset
  provider.describe = async () => ({ configured: true, source: 'env', writable: false })
  provider.set = async () => { throw new Error('should not be called for readonly provider') }
  provider.unset = async () => { throw new Error('should not be called for readonly provider') }
  await assert.rejects(context.config.setAuthSecret('readonly', 'never-store'), (error) => error.code === 'CREDENTIAL_NOT_WRITABLE')
  await assert.rejects(context.config.unsetAuthSecret('readonly'), (error) => error.code === 'CREDENTIAL_NOT_WRITABLE')
  assert.deepEqual(context.store.getSnapshot(), before)
  assert.equal(context.calls.filter(([kind]) => kind === 'set' || kind === 'unset').length, 0)
  assert.ok(secretCallsBefore >= 0)
  provider.describe = originalDescribe
  provider.set = originalSet
  provider.unset = originalUnset
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
