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
import { createApiKitAgentTools } from './agent-tools.js'
import { createAuditLog } from './audit-log.js'
import { registerApiKitRuntimeContext } from './runtime-context.js'

export const name = 'dsh-api-kit'
export const inject = ['tools', 'systemPrompt']

const RPC_METHODS = Object.freeze([
  'listKits', 'getKit', 'createKit', 'updateKit', 'deleteKit',
  'addOperationsToKit', 'removeOperationsFromKit', 'listOperations', 'getOperation',
  'createOperation', 'updateOperation', 'deleteOperation', 'setOperationEnabled',
  'listServiceTargets', 'getServiceTarget', 'listEnvironments', 'getEnvironment',
  'listAuthProfiles', 'getAuthProfile',
  'getSessionActivation', 'setSessionActivation', 'clearSessionActivation',
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
    getSessionActivation: (args) => service.getSessionActivation(args),
    setSessionActivation: (args) => service.setSessionActivation(args),
    clearSessionActivation: (args) => service.clearSessionActivation(args),
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
  const systemPrompt = ctx.systemPrompt
  if (!systemPrompt || typeof systemPrompt.context !== 'function') throw new TypeError('systemPrompt context provider is unavailable')
  registerApiKitRuntimeContext(systemPrompt, service)
  let audit
  try {
    audit = createAuditLog({
      dshHome: typeof process !== 'undefined' ? process.env?.DSH_HOME : undefined,
    })
  } catch (error) {
    // Auditing is best-effort; a filesystem problem must not prevent the core
    // configuration and Agent tools from mounting.
    audit = { append: async () => false, dispose: async () => {}, getDiagnostics: () => ({ lastError: { code: 'AUDIT_UNAVAILABLE' }, dropped: 0 }) }
  }
  const tools = createApiKitAgentTools(service, {
    transport: ctx?.get?.('apiKitHttpTransport'),
    resolver: ctx?.get?.('apiKitDnsResolver'),
    onAudit: (record) => audit.append(record),
  })
  for (const tool of Object.values(tools)) ctx.tools.register(tool)
  if (typeof ctx?.on === 'function') {
    ctx.on('agent/disposed', (payload) => {
      const sessionId = payload?.agent?.id
      if (typeof sessionId === 'string') service.clearSessionActivation({ sessionId })
    })
    ctx.on('dispose', () => {
      service.clearAllSessionActivations()
      void audit.dispose()
    })
  }
  Promise.resolve(service.load()).catch((error) => {
    console.error('[dsh-api-kit] Registry load failed', error?.code || 'LOAD_FAILED')
  })
  return typeof dispose === 'function' ? dispose : undefined
}

export { RPC_METHODS }
export default { name, inject, apply }
