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
  const service = createConfigurationService({ store, clock: () => new Date('2026-08-27T00:00:00.000Z') })
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
