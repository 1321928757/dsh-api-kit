/**
 * dsh-api-kit Host bundle entry.
 *
 * The configuration core remains DSH-independent. This adapter exposes only
 * safe read/write methods through the Typert service binding; the gateway
 * envelope is owned by dsh-api-gateway, not by this plugin.
 */

import { createConfigurationService } from './configuration.js'
import { createCredentialAdapter } from './credential-adapter.js'
import { createRegistryStore } from './registry-store.js'

export const name = 'dsh-api-kit'
export const inject = []

const RPC_METHODS = Object.freeze([
  'listKits', 'getKit', 'createKit', 'updateKit', 'deleteKit',
  'addOperationsToKit', 'removeOperationsFromKit', 'listOperations', 'getOperation',
  'createOperation', 'updateOperation', 'deleteOperation', 'setOperationEnabled',
  'listServiceTargets', 'getServiceTarget', 'listEnvironments', 'getEnvironment',
  'listAuthProfiles', 'getAuthProfile',
])

/**
 * Adapt the public Typert `{ args }` records to the DSH-independent facade.
 * The returned object is the actual Typert receiver and must therefore be the
 * object referenced by `typertRemote.service`.
 */
export function createApiKitGateway(service) {
  if (!service || typeof service !== 'object') throw new TypeError('configuration service is required')
  const gateway = {
    listKits: () => service.listKits(),
    getKit: (id) => service.getKit(id),
    createKit: (input) => service.createKit(input),
    updateKit: (id, patch) => service.updateKit(id, patch),
    deleteKit: (id) => service.deleteKit(id),
    addOperationsToKit: (kitId, operationIds) => service.addOperationsToKit(kitId, operationIds),
    removeOperationsFromKit: (kitId, operationIds) => service.removeOperationsFromKit(kitId, operationIds),
    listOperations: (args) => service.listOperations(args),
    getOperation: (id) => service.getOperation(id),
    createOperation: (input) => service.createOperation(input),
    updateOperation: (id, patch) => service.updateOperation(id, patch),
    deleteOperation: (id) => service.deleteOperation(id),
    setOperationEnabled: (id, enabled) => service.setOperationEnabled(id, enabled),
    listServiceTargets: () => service.listServiceTargets(),
    getServiceTarget: (id) => service.getServiceTarget(id),
    listEnvironments: () => service.listEnvironments(),
    getEnvironment: (id) => service.getEnvironment(id),
    listAuthProfiles: () => service.listAuthProfiles(),
    getAuthProfile: (id) => service.getAuthProfile(id),
  }
  Object.defineProperty(gateway, 'typertRemote', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: { service: gateway, serviceKey: 'apiKitConfig', namespace: 'api-kit' },
  })
  return gateway
}

export function apply(ctx) {
  const credentials = ctx?.get?.('credentials')
  const store = createRegistryStore()
  const service = createConfigurationService({
    store,
    credentialAdapter: createCredentialAdapter({ service: credentials }),
  })
  const gateway = createApiKitGateway(service)
  if (typeof ctx?.provide !== 'function') throw new TypeError('apiKitConfig service provider is unavailable')
  const dispose = ctx.provide('apiKitConfig', gateway)
  Promise.resolve(service.load()).catch((error) => {
    console.error('[dsh-api-kit] Registry load failed', error?.code || 'LOAD_FAILED')
  })
  return typeof dispose === 'function' ? dispose : undefined
}

export { RPC_METHODS }
export default { name, apply }
