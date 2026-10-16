import test from 'node:test'
import assert from 'node:assert/strict'
import { createApiKitGateway } from '../lib/index.js'
import { createConfigurationService } from '../lib/configuration.js'
import { createRegistryStore } from '../lib/registry-store.js'
import { createMemoryFs } from './helpers/memory-fs.mjs'

const FILE = 'C:\\dsh-api-kit-host\\registry.json'

async function setup() {
  const fs = createMemoryFs()
  const store = createRegistryStore({ fs, filePath: FILE, clock: () => new Date('2026-08-27T00:00:00.000Z') })
  await store.load()
  const values = new Map()
  const credentialAdapter = { available: true, toCredentialRef: (value) => value, async describe(ref) { return { configured: values.has(ref), source: 'test', writable: true } }, async set(ref, value) { values.set(ref, value) }, async unset(ref) { values.delete(ref) }, async resolve(ref) { return values.has(ref) ? { value: values.get(ref) } : undefined } }
  const service = createConfigurationService({ store, clock: () => new Date('2026-08-27T00:00:00.000Z'), credentialAdapter })
  await service.createEnvironment({ id: 'dev', name: 'Dev', baseUrl: 'https://api.example.test' })
  await service.createServiceTarget({ id: 'backend', name: 'Backend', environmentIds: ['dev'], defaultEnvironmentId: 'dev' })
  return { service, fs }
}

test('gateway adapts Typert positional parameters and preserves result shapes', async () => {
  const { service } = await setup()
  const gateway = createApiKitGateway(service)
  assert.equal(gateway.typertRemote.service, gateway)
  const kit = await gateway.createKit({ id: 'jobs', name: 'Jobs', operationIds: [] })
  assert.equal(kit.id, 'jobs')
  const operation = await gateway.createOperation({ id: 'list-jobs', operationId: 'listJobs', name: 'List jobs', method: 'GET', path: '/jobs', serviceTargetId: 'backend' })
  assert.equal(operation.id, 'list-jobs')
  assert.equal((await gateway.getOperation('list-jobs')).operationId, 'listJobs')
  assert.equal((await gateway.updateOperation('list-jobs', { summary: 'updated' })).summary, 'updated')
  assert.equal((await gateway.setOperationEnabled('list-jobs', false)).enabled, false)
  assert.equal((await gateway.setOperationEnabled('list-jobs', true)).enabled, true)
  assert.equal((await gateway.addOperationsToKit('jobs', ['list-jobs'])).operationIds[0], 'list-jobs')
  assert.equal((await gateway.listOperations({ kitId: 'jobs' })).length, 1)
  assert.equal(await gateway.deleteOperation('list-jobs').catch((error) => error.code), 'OPERATION_IN_USE')
  assert.equal(await gateway.deleteKit('jobs'), true)
  assert.equal(await gateway.deleteOperation('list-jobs'), true)
  assert.deepEqual(await gateway.listKits(), [])
  const targets = await gateway.listServiceTargets()
  assert.equal(targets.length, 1)
  assert.equal(targets[0].id, 'backend')
  assert.equal(targets[0].endpoints.dev.baseUrl, 'https://api.example.test')
  assert.deepEqual(targets[0].environmentIds, ['dev'])
})

test('gateway preserves an existing operation across multiple kit associations', async () => {
  const { service } = await setup()
  const gateway = createApiKitGateway(service)
  await gateway.createKit({ id: 'primary', name: 'Primary', operationIds: [] })
  await gateway.createKit({ id: 'secondary', name: 'Secondary', operationIds: [] })
  await gateway.createOperation({ id: 'shared', operationId: 'shared', name: 'Shared', method: 'GET', path: '/shared', serviceTargetId: 'backend', kitIds: ['primary'] })

  await gateway.addOperationsToKit('secondary', ['shared'])
  assert.deepEqual((await gateway.getOperation('shared')).kitIds, ['primary', 'secondary'])
  assert.deepEqual((await gateway.listOperations({ kitId: 'secondary' })).map((item) => item.id), ['shared'])

  await gateway.removeOperationsFromKit('primary', ['shared'])
  assert.deepEqual((await gateway.getOperation('shared')).kitIds, ['secondary'])
  assert.deepEqual((await gateway.getKit('primary')).operationIds, [])
  assert.deepEqual((await gateway.getKit('secondary')).operationIds, ['shared'])
})

test('gateway exposes Auth Profile lifecycle without returning secret values', async () => {
  const { service } = await setup()
  const gateway = createApiKitGateway(service)
  const profile = await gateway.createAuthProfile({ id: 'token', name: 'Token', type: 'bearer' })
  assert.equal(profile.id, 'token')
  assert.equal('secretRef' in profile, false)
  assert.equal('credentialSource' in profile, false)
  assert.equal(JSON.stringify(profile).includes('undefined'), false)
  const set = await gateway.setAuthSecret({ id: 'token', secret: 'gateway-secret' })
  assert.equal(set.hasSecret, true)
  assert.equal(JSON.stringify(set).includes('gateway-secret'), false)
  const updated = await gateway.updateAuthProfile('token', { enabled: false })
  assert.equal(updated.enabled, false)
  assert.equal(await gateway.deleteAuthProfile('token'), true)
  const corpsecret = await gateway.createAuthProfile({ id: 'wecom-corpsecret', name: '企业微信 corpsecret', type: 'api-key-query', queryName: 'corpsecret', allowQuery: true })
  assert.equal(corpsecret.allowQuery, true)
  assert.equal('credentialSource' in corpsecret, false)
  assert.equal(JSON.stringify(corpsecret).includes('undefined'), false)
  assert.equal(await gateway.deleteAuthProfile('wecom-corpsecret'), true)
  assert.deepEqual(await gateway.listAuthProfiles(), [])
})
