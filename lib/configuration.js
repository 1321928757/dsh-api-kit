/**
 * Host-side configuration facade for service targets, environments and auth
 * profiles. It only exposes safe metadata; secret resolution is request-time.
 */

import { normalizeAuthProfile, normalizeEnvironment, normalizeServiceTarget, normalizeKit, normalizeOperation, MAX_KITS, MAX_OPERATIONS, MAX_ENVIRONMENTS, MAX_SERVICE_TARGETS, MAX_AUTH_PROFILES } from './model.js'
import {
  assertReadOnlyKitView,
  assertReadOnlyOperationView,
  reconcileRegistryLinks,
  safeKitListView,
  safeKitView,
  safeOperationListView,
  safeOperationView,
  validateKitInput,
  validateKitPatch,
  validateOperationInput,
  validateOperationPatch,
} from './operation-validation.js'
import {
  ConfigurationError,
  safeAuthProfileView,
  safeEnvironmentView,
  safeServiceTargetView,
  validateAuthProfileInput,
  validateConfigurationReferences,
  validateEnvironmentInput,
  validateServiceTargetInput,
} from './config-validation.js'
import { CredentialAdapterError } from './errors.js'
import { createCredentialAdapter } from './credential-adapter.js'
import {
  activationError,
  createSessionActivationStore,
  inspectSessionActivation,
  normalizeSessionActivationInput,
} from './session-selection.js'

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function requiredId(id, field = 'id') {
  if (typeof id !== 'string' || !id.trim()) throw new ConfigurationError('INVALID_ID', `${field} must be a non-empty string`, { path: field })
  return id.trim()
}

function indexOfId(values, id) {
  return values.findIndex((item) => item.id === id)
}

function ensureUniqueId(items, id, field) {
  if (items.some((item) => item.id === id)) throw new ConfigurationError('DUPLICATE_ID', `${field} id already exists`, { path: `${field}.id`, detail: { id } })
}

function referencesFor(registry, collection, id) {
  const references = []
  for (const [index, item] of (registry.kits ?? []).entries()) {
    if (collection === 'environments' && ((item.environmentIds ?? []).includes(id) || item.defaultEnvironmentId === id)) references.push(`kits[${index}].environmentIds`)
    if (collection === 'serviceTargets' && (item.serviceTargetIds ?? []).includes(id)) references.push(`kits[${index}].serviceTargetIds`)
  }
  for (const [index, item] of (registry.operations ?? []).entries()) {
    if (collection === 'serviceTargets' && item.serviceTargetId === id) references.push(`operations[${index}].serviceTargetId`)
    if (collection === 'authProfiles' && item.authProfileId === id) references.push(`operations[${index}].authProfileId`)
  }
  for (const [index, item] of (registry.serviceTargets ?? []).entries()) {
    if (collection === 'environments' && ((item.environmentIds ?? []).includes(id) || item.defaultEnvironmentId === id)) references.push(`serviceTargets[${index}]`)
    if (collection === 'authProfiles' && (item.authProfileIds ?? []).includes(id)) references.push(`serviceTargets[${index}].authProfileIds`)
  }
  if (collection === 'operations') {
    for (const [index, item] of (registry.kits ?? []).entries()) {
      if ((item.operationIds ?? []).includes(id)) references.push(`kits[${index}].operationIds`)
    }
  }
  return references
}

function makeDeleteError(collection, id, references) {
  const labels = { environments: 'ENVIRONMENT_IN_USE', serviceTargets: 'TARGET_IN_USE', authProfiles: 'AUTH_PROFILE_IN_USE' }
  return new ConfigurationError(labels[collection], `${collection.slice(0, -1)} is still referenced`, {
    path: collection,
    detail: { id, references },
  })
}

export function createConfigurationService(options = {}) {
  const store = options.store
  if (!store || typeof store.getSnapshot !== 'function' || typeof store.update !== 'function') {
    throw new ConfigurationError('INVALID_OPTIONS', 'configuration service requires a Registry store')
  }
  const clock = options.clock ?? (() => new Date())
  const credentials = options.credentialAdapter ?? createCredentialAdapter({ service: options.credentials })
  let diagnostics
  const sessionActivations = createSessionActivationStore()

  const snapshot = () => clone(store.getSnapshot())
  const commit = async (mutator) => {
    try {
      let operationResult
      let warnings = []
      const saved = await store.update((draft) => {
        operationResult = mutator(draft)
        const reconciliation = reconcileRegistryLinks(draft)
        warnings = reconciliation.warnings
        validateConfigurationReferences(draft)
        if (warnings.length > 0) {
          for (const warning of warnings) console.warn('[dsh-api-kit] Registry links reconciled', warning)
        }
        return draft
      })
      diagnostics = warnings.length > 0 ? { code: 'LINKS_RECONCILED', warnings } : undefined
      if (operationResult && typeof operationResult === 'object' && !Array.isArray(operationResult)) return { ...operationResult, warnings }
      return operationResult === undefined ? saved : operationResult
    } catch (error) {
      diagnostics = error instanceof ConfigurationError || error instanceof CredentialAdapterError
        ? error.toJSON()
        : { code: typeof error?.code === 'string' ? error.code : 'CONFIG_WRITE_FAILED', message: 'Configuration write failed' }
      throw error
    }
  }

  const get = (name, id) => clone((snapshot()[name] ?? []).find((item) => item.id === requiredId(id)))
  const patchEntity = (current, patch) => {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new ConfigurationError('PATCH_INVALID', 'patch must be an object', { path: 'patch' })
    const result = { ...current }
    for (const [key, value] of Object.entries(patch)) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue
      if (value !== undefined) result[key] = value
    }
    return result
  }
  const listSafeEnvironments = () => snapshot().environments.map((item) => safeEnvironmentView(item))
  const getSafeEnvironment = (id) => {
    const item = get('environments', id)
    if (!item) throw new ConfigurationError('ENVIRONMENT_NOT_FOUND', 'environment was not found', { path: 'id', detail: { id } })
    return safeEnvironmentView(item)
  }
  const listSafeServiceTargets = () => snapshot().serviceTargets.map((item) => safeServiceTargetView(item))
  const getSafeServiceTarget = (id) => {
    const item = get('serviceTargets', id)
    if (!item) throw new ConfigurationError('TARGET_NOT_FOUND', 'service target was not found', { path: 'id', detail: { id } })
    return safeServiceTargetView(item)
  }
  const registryContext = (registry) => ({
    operations: registry.operations ?? [],
    serviceTargets: registry.serviceTargets ?? [],
    environments: registry.environments ?? [],
    authProfiles: registry.authProfiles ?? [],
  })
  const operationListView = (operation, registry) => assertReadOnlyOperationView(safeOperationListView(operation, registryContext(registry)))
  const operationDetailView = (operation, registry) => assertReadOnlyOperationView(safeOperationView(operation, registryContext(registry)))
  const kitListView = (kit, registry) => assertReadOnlyKitView(safeKitListView(kit, registryContext(registry)))
  const kitDetailView = (kit, registry) => assertReadOnlyKitView(safeKitView(kit, registryContext(registry)))
  const operationResult = (operation, registry, detail = false) => detail ? operationDetailView(operation, registry) : operationListView(operation, registry)
  const kitResult = (kit, registry, detail = false) => detail ? kitDetailView(kit, registry) : kitListView(kit, registry)
  const assertCapacity = (registry, collection, max, path) => {
    if ((registry[collection] ?? []).length >= max) throw new ConfigurationError('CAPACITY_EXCEEDED', `${collection} capacity has been reached`, { path, detail: { collection, max } })
  }
  let describeAuthProfile
  const listSafeAuthProfiles = async () => {
    const profiles = snapshot().authProfiles ?? []
    return Promise.all(profiles.map(async (profile) => describeAuthProfile(profile.id)))
  }
  const getSafeAuthProfile = async (id) => describeAuthProfile(id)

  const createEnvironment = (input) => commit((registry) => {
    assertCapacity(registry, 'environments', MAX_ENVIRONMENTS, 'environments')
    const value = validateEnvironmentInput(input)
    ensureUniqueId(registry.environments, value.id, 'environment')
    registry.environments.push(value)
    return clone(value)
  })
  const updateEnvironment = (id, input) => commit((registry) => {
    const targetId = requiredId(id)
    const index = indexOfId(registry.environments, targetId)
    if (index < 0) throw new ConfigurationError('ENVIRONMENT_NOT_FOUND', 'environment was not found', { path: 'id', detail: { id: targetId } })
    const value = validateEnvironmentInput({ ...patchEntity(registry.environments[index], input), id: targetId })
    registry.environments[index] = value
    return clone(value)
  })
  const deleteEnvironment = (id) => commit((registry) => {
    const targetId = requiredId(id)
    const index = indexOfId(registry.environments, targetId)
    if (index < 0) return false
    const references = referencesFor(registry, 'environments', targetId)
    if (references.length) throw makeDeleteError('environments', targetId, references)
    registry.environments.splice(index, 1)
    return true
  })

  const createServiceTarget = (input) => commit((registry) => {
    assertCapacity(registry, 'serviceTargets', MAX_SERVICE_TARGETS, 'serviceTargets')
    const value = validateServiceTargetInput(input)
    ensureUniqueId(registry.serviceTargets, value.id, 'serviceTarget')
    registry.serviceTargets.push(value)
    return clone(value)
  })
  const updateServiceTarget = (id, input) => commit((registry) => {
    const targetId = requiredId(id)
    const index = indexOfId(registry.serviceTargets, targetId)
    if (index < 0) throw new ConfigurationError('TARGET_NOT_FOUND', 'service target was not found', { path: 'id', detail: { id: targetId } })
    registry.serviceTargets[index] = validateServiceTargetInput({ ...patchEntity(registry.serviceTargets[index], input), id: targetId })
    return clone(registry.serviceTargets[index])
  })
  const deleteServiceTarget = (id) => commit((registry) => {
    const targetId = requiredId(id)
    const index = indexOfId(registry.serviceTargets, targetId)
    if (index < 0) return false
    const references = referencesFor(registry, 'serviceTargets', targetId)
    if (references.length) throw makeDeleteError('serviceTargets', targetId, references)
    registry.serviceTargets.splice(index, 1)
    return true
  })

  const createAuthProfile = (input) => commit((registry) => {
    assertCapacity(registry, 'authProfiles', MAX_AUTH_PROFILES, 'authProfiles')
    const value = validateAuthProfileInput(input)
    ensureUniqueId(registry.authProfiles, value.id, 'authProfile')
    registry.authProfiles.push(value)
    return safeAuthProfileView(value, { configured: false, available: credentials.available, writable: false })
  })
  const updateAuthProfile = (id, input) => commit((registry) => {
    const targetId = requiredId(id)
    const index = indexOfId(registry.authProfiles, targetId)
    if (index < 0) throw new ConfigurationError('AUTH_PROFILE_NOT_FOUND', 'auth profile was not found', { path: 'id', detail: { id: targetId } })
    registry.authProfiles[index] = validateAuthProfileInput({ ...patchEntity(registry.authProfiles[index], input), id: targetId })
    return safeAuthProfileView(registry.authProfiles[index], { configured: false, available: credentials.available, writable: false })
  })
  const deleteAuthProfile = (id) => commit((registry) => {
    const targetId = requiredId(id)
    const index = indexOfId(registry.authProfiles, targetId)
    if (index < 0) return false
    const references = referencesFor(registry, 'authProfiles', targetId)
    if (references.length) throw makeDeleteError('authProfiles', targetId, references)
    registry.authProfiles.splice(index, 1)
    return true
  })

  const listOperations = (options) => {
    options = options ?? {}
    const current = snapshot()
    let items = current.operations ?? []
    if (options.kitId !== undefined) {
      const kit = (current.kits ?? []).find((item) => item.id === requiredId(options.kitId, 'kitId'))
      items = kit ? items.filter((item) => kit.operationIds.includes(item.id)) : []
    }
    if (options.enabled !== undefined) items = items.filter((item) => item.enabled === options.enabled)
    return items.map((item) => operationListView(item, current))
  }
  const getOperation = (id) => {
    const current = snapshot()
    const operationId = requiredId(id)
    const item = (current.operations ?? []).find((operation) => operation.id === operationId)
    if (!item) throw new ConfigurationError('OPERATION_NOT_FOUND', 'operation was not found', { path: 'id', detail: { id: operationId } })
    return operationDetailView(item, current)
  }
  const createOperation = (input) => commit((registry) => {
    assertCapacity(registry, 'operations', MAX_OPERATIONS, 'operations')
    const value = validateOperationInput(input, { registry })
    if (registry.operations.some((item) => item.id === value.id)) throw new ConfigurationError('DUPLICATE_ID', 'operation id already exists', { path: 'operation.id', detail: { id: value.id } })
    if (registry.operations.some((item) => item.operationId.toLowerCase() === value.operationId.toLowerCase())) throw new ConfigurationError('DUPLICATE_OPERATION_ID', 'operationId already exists', { path: 'operation.operationId', detail: { operationId: value.operationId } })
    const stamp = clock().toISOString()
    const stored = normalizeOperation({ ...value, createdAt: stamp, updatedAt: stamp })
    registry.operations.push(stored)
    for (const kitId of stored.kitIds) {
      const kit = registry.kits.find((item) => item.id === kitId)
      if (kit && !kit.operationIds.includes(stored.id)) kit.operationIds.push(stored.id)
    }
    return operationDetailView(stored, registry)
  })
  const updateOperation = (id, patch) => commit((registry) => {
    const operationId = requiredId(id)
    const index = indexOfId(registry.operations, operationId)
    if (index < 0) throw new ConfigurationError('OPERATION_NOT_FOUND', 'operation was not found', { path: 'id', detail: { id: operationId } })
    const current = registry.operations[index]
    const value = validateOperationPatch(operationId, patch, current, { registry })
    if (registry.operations.some((item, itemIndex) => itemIndex !== index && item.operationId.toLowerCase() === value.operationId.toLowerCase())) throw new ConfigurationError('DUPLICATE_OPERATION_ID', 'operationId already exists', { path: 'operation.operationId', detail: { operationId: value.operationId } })
    const stored = normalizeOperation({ ...value, createdAt: current.createdAt || clock().toISOString(), updatedAt: clock().toISOString() })
    registry.operations[index] = stored
    if (Object.hasOwn(patch ?? {}, 'kitIds') || Object.hasOwn(patch ?? {}, 'kits')) {
      for (const kit of registry.kits) kit.operationIds = kit.operationIds.filter((candidate) => candidate !== stored.id)
      for (const kitId of stored.kitIds) {
        const kit = registry.kits.find((candidate) => candidate.id === kitId)
        if (kit && !kit.operationIds.includes(stored.id)) kit.operationIds.push(stored.id)
      }
    }
    return operationDetailView(stored, registry)
  })
  const deleteOperation = (id) => commit((registry) => {
    const operationId = requiredId(id)
    const index = indexOfId(registry.operations, operationId)
    if (index < 0) return false
    const references = referencesFor(registry, 'operations', operationId)
    if (references.length) throw new ConfigurationError('OPERATION_IN_USE', 'operation is still referenced by a kit', { path: 'operations', detail: { id: operationId, references } })
    registry.operations.splice(index, 1)
    return true
  })
  const setOperationEnabled = (id, enabled) => {
    if (typeof enabled !== 'boolean') throw new ConfigurationError('INVALID_FIELD', 'enabled must be boolean', { path: 'enabled' })
    return updateOperation(id, { enabled })
  }

  const inspectStoredSessionActivation = (sessionId) => {
    const selection = sessionActivations.get(sessionId)
    return inspectSessionActivation(snapshot(), selection)
  }
  const getSessionActivation = (input) => {
    const value = normalizeSessionActivationInput(input)
    return inspectSessionActivation(snapshot(), sessionActivations.get(value.sessionId))
  }
  const setSessionActivation = (input) => {
    const value = normalizeSessionActivationInput(input)
    const result = inspectSessionActivation(snapshot(), value)
    if (!result.valid) throw activationError(result)
    sessionActivations.set(value)
    return result
  }
  const clearSessionActivation = (input) => {
    const value = normalizeSessionActivationInput(input)
    sessionActivations.clear(value.sessionId)
    return inspectSessionActivation(snapshot(), sessionActivations.get(value.sessionId))
  }
  const resolveSessionActivation = (sessionId) => {
    const result = inspectStoredSessionActivation(sessionId)
    if (!result.valid) throw activationError(result)
    return result
  }
  const clearAllSessionActivations = () => sessionActivations.clearAll()

  const listKits = () => {
    const current = snapshot()
    return (current.kits ?? []).map((item) => kitListView(item, current))
  }
  const getKit = (id) => {
    const current = snapshot()
    const kitId = requiredId(id)
    const item = (current.kits ?? []).find((kit) => kit.id === kitId)
    if (!item) throw new ConfigurationError('KIT_NOT_FOUND', 'kit was not found', { path: 'id', detail: { id: kitId } })
    return kitDetailView(item, current)
  }
  const createKit = (input) => commit((registry) => {
    assertCapacity(registry, 'kits', MAX_KITS, 'kits')
    const value = validateKitInput(input, registry)
    if (registry.kits.some((item) => item.id === value.id)) throw new ConfigurationError('DUPLICATE_KIT_ID', 'kit id already exists', { path: 'kit.id', detail: { id: value.id } })
    const stamp = clock().toISOString()
    const stored = normalizeKit({ ...value, createdAt: stamp, updatedAt: stamp })
    registry.kits.push(stored)
    return kitDetailView(stored, registry)
  })
  const updateKit = (id, patch) => commit((registry) => {
    const kitId = requiredId(id)
    const index = indexOfId(registry.kits, kitId)
    if (index < 0) throw new ConfigurationError('KIT_NOT_FOUND', 'kit was not found', { path: 'id', detail: { id: kitId } })
    const current = registry.kits[index]
    const value = validateKitPatch(kitId, patch, current, registry)
    const stored = normalizeKit({ ...value, createdAt: current.createdAt || clock().toISOString(), updatedAt: clock().toISOString() })
    registry.kits[index] = stored
    return kitDetailView(stored, registry)
  })
  const deleteKit = (id) => commit((registry) => {
    const kitId = requiredId(id)
    const index = indexOfId(registry.kits, kitId)
    if (index < 0) return false
    registry.kits.splice(index, 1)
    return true
  })
  const changeKitOperations = (kitId, operationIds, add) => commit((registry) => {
    const id = requiredId(kitId, 'kitId')
    const kit = registry.kits.find((item) => item.id === id)
    if (!kit) throw new ConfigurationError('KIT_NOT_FOUND', 'kit was not found', { path: 'kitId', detail: { id } })
    if (!Array.isArray(operationIds)) throw new ConfigurationError('KIT_OPERATION_INVALID', 'operationIds must be an array', { path: 'operationIds' })
    const ids = operationIds.map((operationId, index) => {
      if (typeof operationId !== 'string' || !operationId.trim()) throw new ConfigurationError('KIT_OPERATION_INVALID', 'operation id must be a non-empty string', { path: `operationIds[${index}]` })
      return operationId.trim()
    })
    for (const operationId of ids) if (!registry.operations.some((operation) => operation.id === operationId)) throw new ConfigurationError('KIT_OPERATION_INVALID', 'kit references a missing operation', { path: 'operationIds', detail: { id: operationId } })
    kit.operationIds = add ? [...new Set([...kit.operationIds, ...ids])] : kit.operationIds.filter((operationId) => !ids.includes(operationId))
    return kitDetailView(kit, registry)
  })
  const addOperationsToKit = (kitId, operationIds) => changeKitOperations(kitId, operationIds, true)
  const removeOperationsFromKit = (kitId, operationIds) => changeKitOperations(kitId, operationIds, false)

  describeAuthProfile = async (id) => {
    const profile = get('authProfiles', id)
    if (!profile) throw new ConfigurationError('AUTH_PROFILE_NOT_FOUND', 'auth profile was not found', { path: 'id', detail: { id } })
    let info = { configured: false, available: credentials.available, writable: false }
    if (profile.secretRef) {
      try { info = await credentials.describe(profile.secretRef) } catch (error) {
        if (error instanceof ConfigurationError || error instanceof CredentialAdapterError) throw error
        throw new ConfigurationError('CREDENTIAL_DESCRIBE_FAILED', 'Credential status lookup failed', { cause: error })
      }
    }
    return safeAuthProfileView(profile, info)
  }

  const resolveAuthForRequest = async (profileId) => {
    const id = requiredId(profileId, 'authProfileId')
    const profile = get('authProfiles', id)
    if (!profile) throw new ConfigurationError('AUTH_PROFILE_NOT_FOUND', 'auth profile was not found', { path: 'authProfileId', detail: { id } })
    if (!profile.enabled || profile.type === 'none') return { type: 'none', headers: {}, query: {} }
    if (profile.type === 'api-key-query' && profile.allowQuery !== true) throw new ConfigurationError('QUERY_AUTH_DISABLED', 'API key query authentication is disabled by default')
    const secret = await credentials.resolve(profile.secretRef)
    if (!secret) throw new ConfigurationError('CREDENTIAL_NOT_CONFIGURED', 'Credential is not configured')
    const value = typeof secret === 'string' ? secret : secret.value
    if (typeof value !== 'string' || !value) throw new ConfigurationError('CREDENTIAL_NOT_CONFIGURED', 'Credential is not configured')
    if (profile.type === 'bearer') return { type: profile.type, headers: { Authorization: `${profile.scheme || 'Bearer'} ${value}` }, query: {} }
    if (profile.type === 'api-key-header') return { type: profile.type, headers: { [profile.headerName]: value }, query: {} }
    if (profile.type === 'api-key-query') return { type: profile.type, headers: {}, query: { [profile.queryName]: value } }
    if (profile.type === 'basic') {
      const encoded = typeof btoa === 'function'
        ? btoa(`${profile.username}:${value}`)
        : Buffer.from(`${profile.username}:${value}`).toString('base64')
      return { type: profile.type, headers: { Authorization: `Basic ${encoded}` }, query: {} }
    }
    return { type: 'none', headers: {}, query: {} }
  }

  // Secret writes are deliberately separate from Registry commits. The
  // adapter must provide its own durable/atomic semantics; no secret value
  // enters the Registry transaction or any returned object.
  const setAuthSecret = async (profileId, value) => {
    const profile = get('authProfiles', profileId)
    if (!profile) throw new ConfigurationError('AUTH_PROFILE_NOT_FOUND', 'auth profile was not found', { path: 'authProfileId', detail: { id: profileId } })
    if (profile.type === 'none') throw new ConfigurationError('AUTH_TYPE_NONE', 'none authentication profiles cannot store a secret')
    await credentials.set(profile.secretRef, value)
    return describeAuthProfile(profile.id)
  }
  const unsetAuthSecret = async (profileId) => {
    const profile = get('authProfiles', profileId)
    if (!profile) throw new ConfigurationError('AUTH_PROFILE_NOT_FOUND', 'auth profile was not found', { path: 'authProfileId', detail: { id: profileId } })
    if (profile.type === 'none') throw new ConfigurationError('AUTH_TYPE_NONE', 'none authentication profiles cannot store a secret')
    await credentials.unset(profile.secretRef)
    return describeAuthProfile(profile.id)
  }

  const load = async (...args) => {
    const result = await store.load(...args)
    diagnostics = result?.diagnostic
    return result
  }

  const api = {
    load,
    getSnapshot: () => {
      const current = snapshot()
      return {
        ...current,
        environments: current.environments.map(safeEnvironmentView),
        serviceTargets: current.serviceTargets.map(safeServiceTargetView),
        authProfiles: current.authProfiles.map((profile) => safeAuthProfileView(profile, { configured: false, available: credentials.available, writable: false })),
        operations: current.operations.map((operation) => operationListView(operation, current)),
        kits: current.kits.map((kit) => kitListView(kit, current)),
      }
    },
    getDiagnostics: () => clone(diagnostics ?? store.getDiagnostics?.()),
    listEnvironments: listSafeEnvironments,
    getEnvironment: getSafeEnvironment,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    listServiceTargets: listSafeServiceTargets,
    getServiceTarget: getSafeServiceTarget,
    createServiceTarget,
    updateServiceTarget,
    deleteServiceTarget,
    listAuthProfiles: listSafeAuthProfiles,
    getAuthProfile: getSafeAuthProfile,
    getSessionActivation,
    setSessionActivation,
    clearSessionActivation,
    resolveSessionActivation,
    clearAllSessionActivations,
    listOperations,
    getOperation,
    createOperation,
    updateOperation,
    deleteOperation,
    setOperationEnabled,
    listKits,
    getKit,
    createKit,
    updateKit,
    deleteKit,
    addOperationsToKit,
    removeOperationsFromKit,
    createAuthProfile,
    updateAuthProfile,
    deleteAuthProfile,
    describeAuthProfile,
    resolveAuthForRequest,
    setAuthSecret,
    unsetAuthSecret,
    safeEnvironmentView,
    safeServiceTargetView,
    safeAuthProfileView,
    credentialAdapter: credentials,
    clock,
  }
  return Object.freeze(api)
}

export { normalizeAuthProfile, normalizeEnvironment, normalizeServiceTarget, normalizeKit, normalizeOperation }
