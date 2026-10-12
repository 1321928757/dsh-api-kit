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
import { createOAuth2Client } from './oauth2.js'
import { resolveAndValidateTarget } from './ssrf.js'
import { createOpenApiImportTransactionService } from './openapi-import-transaction.js'
import { createWriteConfirmation } from './write-confirmation.js'
import { createHash } from 'node:crypto'
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

function assertEnabledAuthProfiles(registry, ids, path = 'authProfileIds') {
  for (const [index, id] of (Array.isArray(ids) ? ids : []).entries()) {
    const profile = (registry.authProfiles ?? []).find((item) => item.id === id)
    if (!profile) throw new ConfigurationError('DANGLING_AUTH_PROFILE', 'service configuration references a missing auth profile', { path: `${path}[${index}]`, detail: { id } })
    if (profile.enabled === false) throw new ConfigurationError('AUTH_PROFILE_DISABLED', 'auth profile is disabled', { path: `${path}[${index}]`, detail: { id } })
  }
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
  const oauthClients = new Map()
  const getAuthSecretRefDiagnostics = () => {
    const profiles = snapshot().authProfiles ?? []
    const collisions = legacyRefCollisions(profiles)
    if (collisions.length === 0) return undefined
    return {
      code: 'AUTH_SECRET_REF_COLLISION',
      conflicts: collisions.map(({ secretRef, profileIds }) => ({ secretRef, profileIds })),
    }
  }
  const oauthTransport = options.oauthTransport ?? options.transport
  const oauthResolver = options.resolver ?? options.dnsResolver
  const transportIds = new WeakMap()
  let nextTransportId = 1
  const transportIdentity = (value) => {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) return 'none'
    let id = transportIds.get(value)
    if (!id) { id = `transport-${nextTransportId++}`; transportIds.set(value, id) }
    return id
  }
  const oauthClientKey = (profile, target, environment, policy, transport) => {
    // OAuth clients are scoped to the effective endpoint policy, not merely the
    // environment URL. Two endpoint overrides in one environment must never
    // share a token cache.
    const key = [profile.id, profile.tokenEndpoint, profile.clientId, profile.secretRef, profile.authMethod, profile.scope, profile.audience, environment.id, policy.baseUrl, policy.protocol, policy.port, policy.allowPrivilegedPort, ...(policy.allowedHosts ?? []), transportIdentity(transport)]
    return JSON.stringify(key)
  }
  const sessionActivations = createSessionActivationStore()
  const confirmationStore = options.confirmation ?? createWriteConfirmation()
  if (!confirmationStore || typeof confirmationStore.create !== 'function' || typeof confirmationStore.approve !== 'function' || typeof confirmationStore.reject !== 'function' || typeof confirmationStore.cancel !== 'function') {
    throw new ConfigurationError('INVALID_OPTIONS', 'confirmation store is invalid')
  }
  const confirmations = Object.freeze({
    create: (input) => confirmationStore.create(input),
    approve: (token, binding) => confirmationStore.approve(token, binding),
    consume: (token, binding) => confirmationStore.consume(token, binding),
    reject: (token, binding) => confirmationStore.reject(token, binding),
    cancel: (token, binding) => confirmationStore.cancel(token, binding),
    cancelToken: (token) => typeof confirmationStore.cancelToken === 'function' ? confirmationStore.cancelToken(token) : (() => { throw new Error('cancelToken unavailable') })(),
    expire: (token, binding) => confirmationStore.expire(token, binding),
    clear: () => confirmationStore.clear(),
    clearSession: (sessionId) => typeof confirmationStore.clearSession === 'function' ? confirmationStore.clearSession(sessionId) : 0,
    size: () => confirmationStore.size(),
  })
  const confirmationError = () => ({ ok: false, error: { code: 'CONFIRMATION_NOT_FOUND', message: 'confirmation intent was not found' } })
  const confirmationBinding = (args = {}) => ({ ...(args.binding && typeof args.binding === 'object' ? args.binding : {}), ...args })
  const confirmationAction = (action, args = {}) => {
    try {
      const input = confirmationBinding(args)
      const token = input.token ?? input.confirmationToken
      if (typeof token !== 'string') return confirmationError()
      const binding = { sessionId: input.sessionId, operationId: input.operationId, method: input.method, serviceTargetId: input.serviceTargetId, environmentId: input.environmentId, requestFingerprint: input.requestFingerprint, registryFingerprint: input.registryFingerprint }
      const result = confirmations[action](token, binding)
      return { ok: true, state: action === 'approve' ? result.state : 'cancelled', ...(result?.expiresAt ? { expiresAt: result.expiresAt } : {}), ...(result?.summary ? { summary: result.summary } : {}) }
    } catch { return confirmationError() }
  }
  const disposeOAuthClients = () => {
    for (const client of oauthClients.values()) client.dispose()
    oauthClients.clear()
  }
  const invalidateOAuthClient = (id) => {
    for (const [key, client] of oauthClients) {
      if (key.startsWith(`["${id}",`)) {
        client.dispose()
        oauthClients.delete(key)
      }
    }
  }
  const selectedEnvironment = (registry, environmentId) => {
    const environments = registry.environments ?? []
    const environment = environmentId ? environments.find((item) => item.id === environmentId) : environments[0]
    if (!environment) throw new ConfigurationError('ENVIRONMENT_REQUIRED', 'an environment is required for OAuth2', { path: 'environmentId' })
    return environment
  }
  const endpointPolicy = (target, environment) => {
    const endpoints = target?.endpoints
    const endpoint = endpoints && typeof endpoints === 'object' && !Array.isArray(endpoints)
      ? endpoints[environment.id]
      : Array.isArray(endpoints) ? endpoints.find((item) => item.environmentId === environment.id) : undefined
    // Environment is the compatibility fallback for registries created before
    // per-target endpoint policies were introduced.
    return endpoint ?? environment
  }
  const makeOAuthTransport = (environment, policy, transport) => {
    if (!transport || typeof transport.request !== 'function') return undefined
    return async (request) => {
      const endpoint = new URL(request.url)
      const pin = await resolveAndValidateTarget(endpoint, environment, { policy, resolver: oauthResolver })
      const response = await transport.request({ ...request, resolvedAddress: pin.address, resolvedFamily: pin.family, redirect: 'manual', maxRedirects: 0, maxResponseBytes: 64 * 1024 })
      if (response && typeof response.text !== 'function' && (response.body instanceof Uint8Array || typeof response.body === 'string')) {
        const body = response.body instanceof Uint8Array ? new TextDecoder().decode(response.body) : response.body
        return { ...response, headers: { 'content-type': response.contentType || 'application/json' }, text: async () => body }
      }
      return response
    }
  }
  const importTransactions = createOpenApiImportTransactionService({
    store,
    clock,
    archiveMode: options.archiveMode,
    limits: options.importLimits,
    onAudit: options.onImportAudit,
  })

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
  const safeTargetView = (item) => safeServiceTargetView(item)
  const listSafeServiceTargets = () => snapshot().serviceTargets.map((item) => safeTargetView(item))
  const getSafeServiceTarget = (id) => {
    const item = get('serviceTargets', id)
    if (!item) throw new ConfigurationError('TARGET_NOT_FOUND', 'service target was not found', { path: 'id', detail: { id } })
    return safeTargetView(item)
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
    disposeOAuthClients()
    return clone(value)
  })
  const updateEnvironment = (id, input) => commit((registry) => {
    const targetId = requiredId(id)
    const index = indexOfId(registry.environments, targetId)
    if (index < 0) throw new ConfigurationError('ENVIRONMENT_NOT_FOUND', 'environment was not found', { path: 'id', detail: { id: targetId } })
    const value = validateEnvironmentInput({ ...patchEntity(registry.environments[index], input), id: targetId })
    registry.environments[index] = value
    disposeOAuthClients()
    return clone(value)
  })
  const deleteEnvironment = (id) => commit((registry) => {
    const targetId = requiredId(id)
    const index = indexOfId(registry.environments, targetId)
    if (index < 0) return false
    const references = referencesFor(registry, 'environments', targetId)
    if (references.length) throw makeDeleteError('environments', targetId, references)
    registry.environments.splice(index, 1)
    disposeOAuthClients()
    return true
  })

  const targetInput = (registry, input) => {
    const value = normalizeServiceTarget(input)
    const supplied = new Map(Object.entries(value.endpoints ?? {}))
    const endpoints = {}
    for (const environmentId of value.environmentIds) {
      endpoints[environmentId] = supplied.get(environmentId) ?? { environmentId, ...(registry.environments ?? []).find((environment) => environment.id === environmentId) }
    }
    return { ...input, environmentIds: value.environmentIds, defaultEnvironmentId: value.defaultEnvironmentId, authProfileIds: value.authProfileIds, endpoints }
  }
  const createServiceTarget = (input) => commit((registry) => {
    assertCapacity(registry, 'serviceTargets', MAX_SERVICE_TARGETS, 'serviceTargets')
    const value = validateServiceTargetInput(targetInput(registry, input))
    assertEnabledAuthProfiles(registry, value.authProfileIds)
    ensureUniqueId(registry.serviceTargets, value.id, 'serviceTarget')
    registry.serviceTargets.push(value)
    disposeOAuthClients()
    return safeTargetView(value)
  })
  const updateServiceTarget = (id, input) => commit((registry) => {
    const targetId = requiredId(id)
    const index = indexOfId(registry.serviceTargets, targetId)
    if (index < 0) throw new ConfigurationError('TARGET_NOT_FOUND', 'service target was not found', { path: 'id', detail: { id: targetId } })
    registry.serviceTargets[index] = validateServiceTargetInput(targetInput(registry, { ...patchEntity(registry.serviceTargets[index], input), id: targetId }))
    assertEnabledAuthProfiles(registry, registry.serviceTargets[index].authProfileIds)
    disposeOAuthClients()
    return safeTargetView(registry.serviceTargets[index])
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

  const legacyAuthSecretRefForId = (id) => {
    const suffix = String(id).replace(/[^A-Za-z0-9_]/g, '_').toUpperCase()
    const legacy = `DSH_API_KIT_AUTH_${suffix}`
    if (/^[A-Z_]/.test(legacy) && legacy.length <= 128) return legacy
    return `DSH_API_KIT_AUTH_LEGACY_${createHash('sha256').update(String(id)).digest('hex').slice(0, 24).toUpperCase()}`
  }
  const authSecretRefForId = (id) => {
    const normalized = String(id).toLowerCase()
    const digest = createHash('sha256').update(normalized, 'utf8').digest('hex').slice(0, 24).toUpperCase()
    return `DSH_API_KIT_AUTH_V2_${digest}`
  }
  const isValidCredentialRef = (ref) => typeof ref === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(ref)
  const legacyCredentialRefCandidates = (id) => {
    const suffix = String(id).replace(/[^A-Za-z0-9_]/g, '_').toUpperCase()
    const old = `DSH_API_KIT_AUTH_${suffix}`
    const digest = createHash('sha256').update(`dsh-api-kit/auth/${id}`, 'utf8').digest('hex').slice(0, 24).toUpperCase()
    return [old, `DSH_API_KIT_AUTH_LEGACY_${digest}`].filter((ref) => ref.length <= 128)
  }
  const legacyRefCollisions = (profiles) => {
    const byRef = new Map()
    for (const profile of profiles) {
      if (!profile?.id || profile.type === 'none' || !profile.secretRef) continue
      const sentinel = `dsh-api-kit/auth/${profile.id}`
      const candidates = new Set(legacyCredentialRefCandidates(profile.id))
      const matchesLegacy = candidates.has(profile.secretRef) || profile.secretRef.toLowerCase() === sentinel.toLowerCase()
      if (!matchesLegacy) continue
      const effectiveRef = isValidCredentialRef(profile.secretRef) ? profile.secretRef : legacyAuthSecretRefForId(profile.id)
      const ids = byRef.get(effectiveRef) ?? []
      ids.push(profile.id)
      byRef.set(effectiveRef, ids)
    }
    // Only persisted rows are authoritative: don't infer or synthesize
    // unconfigured profiles as collision participants.
    return [...byRef.entries()].filter(([, ids]) => ids.length > 1).map(([secretRef, profileIds]) => ({ secretRef, profileIds }))
  }
  const isLegacyDerivedRef = (profile) => {
    if (!profile?.id || !profile.secretRef) return false
    return legacyCredentialRefCandidates(profile.id).includes(profile.secretRef) || profile.secretRef.toLowerCase() === `dsh-api-kit/auth/${profile.id}`.toLowerCase()
  }
  const assertNoAuthSecretRefCollision = (profiles, candidate, options = {}) => {
    const collision = profiles.find((profile) => profile.id !== candidate.id && profile.secretRef === candidate.secretRef)
    if (!collision) return
    if (options.allowExistingLegacy === true && isLegacyDerivedRef(collision) && candidate.secretRef === collision.secretRef) return
    const legacyConflict = legacyRefCollisions(profiles).find(({ secretRef }) => secretRef === candidate.secretRef)
    if (legacyConflict && candidate.secretRef === legacyConflict.secretRef) {
      throw new ConfigurationError('AUTH_SECRET_REF_CONFLICT', 'Auth Profile credential reference conflicts with an existing legacy collision', { path: 'secretRef', detail: { profileIds: [...new Set([...legacyConflict.profileIds, candidate.id])] } })
    }
    throw new ConfigurationError('AUTH_SECRET_REF_CONFLICT', 'Auth Profile credential reference conflicts with an existing profile', { path: 'secretRef', detail: { profileIds: [collision.id, candidate.id] } })
  }
  const assertNoNewLegacyCollision = (profiles, candidate) => {
    const candidateLegacyRefs = new Set(legacyCredentialRefCandidates(candidate.id))
    const conflicts = profiles.filter((profile) => profile.id !== candidate.id && candidateLegacyRefs.has(profile.secretRef) && isLegacyDerivedRef(profile))
    if (conflicts.length) throw new ConfigurationError('AUTH_SECRET_REF_CONFLICT', 'Auth Profile ID conflicts with an existing legacy credential reference', { path: 'id', detail: { profileIds: [...conflicts.map((profile) => profile.id), candidate.id] } })
  }
  const assertExistingLegacyCollisionMutation = (profiles, candidate, previous) => {
    const collision = legacyRefCollisions(profiles).find(({ profileIds }) => profileIds.includes(candidate.id))
    if (!collision || (candidate.secretRef === previous.secretRef && candidate.id === previous.id)) return
    // A user-directed, valid replacement is the supported resolution path.
    // Uniqueness is checked separately; no credential value is read/moved.
    if (!isValidCredentialRef(candidate.secretRef)) throw new ConfigurationError('SECRET_REF_INVALID', 'secretRef must be a POSIX environment-variable name', { path: 'secretRef' })
  }
  const prepareAuthProfileInput = (input) => {
    const raw = input && typeof input === 'object' && !Array.isArray(input) ? { ...input } : {}
    const normalized = normalizeAuthProfile(raw)
    if (normalized.type === 'none') delete raw.secretRef
    else if (!raw.secretRef && !raw.credentialId) raw.secretRef = authSecretRefForId(normalized.id)
    // The historical default sentinel and the new generated references are
    // distinguished at creation time; persisted values are never rewritten.
    else if (typeof raw.secretRef === 'string' && /^dsh-api-kit\/auth\//i.test(raw.secretRef.trim())) raw.secretRef = legacyAuthSecretRefForId(normalized.id)
    return raw
  }
  const assertWritableCredentialRef = (profile, path = 'secretRef') => {
    if (profile.type === 'none' || !profile.secretRef || isValidCredentialRef(profile.secretRef)) return
    throw new ConfigurationError('SECRET_REF_INVALID', 'secretRef must be a POSIX environment-variable name', { path })
  }
  const createAuthProfile = (input) => commit((registry) => {
    assertCapacity(registry, 'authProfiles', MAX_AUTH_PROFILES, 'authProfiles')
    const value = validateAuthProfileInput(prepareAuthProfileInput(input))
    assertWritableCredentialRef(value)
    ensureUniqueId(registry.authProfiles, value.id, 'authProfile')
    assertNoAuthSecretRefCollision(registry.authProfiles, value)
    assertNoNewLegacyCollision(registry.authProfiles, value)
    registry.authProfiles.push(value)
    diagnostics = getAuthSecretRefDiagnostics()
    invalidateOAuthClient(value.id)
    return safeAuthProfileView(value, { configured: false, available: credentials.available, writable: false })
  })
  const updateAuthProfile = (id, input) => commit((registry) => {
    const targetId = requiredId(id)
    const index = indexOfId(registry.authProfiles, targetId)
    if (index < 0) throw new ConfigurationError('AUTH_PROFILE_NOT_FOUND', 'auth profile was not found', { path: 'id', detail: { id: targetId } })
    const previous = registry.authProfiles[index]
    const updated = validateAuthProfileInput(prepareAuthProfileInput({ ...patchEntity(previous, input), id: targetId }))
    if (updated.secretRef !== previous.secretRef) assertWritableCredentialRef(updated)
    assertExistingLegacyCollisionMutation(registry.authProfiles, updated, previous)
    assertNoAuthSecretRefCollision(registry.authProfiles, updated, { allowExistingLegacy: updated.secretRef === previous.secretRef && updated.id === previous.id })
    registry.authProfiles[index] = updated
    diagnostics = getAuthSecretRefDiagnostics()
    invalidateOAuthClient(targetId)
    return safeAuthProfileView(registry.authProfiles[index], { configured: false, available: credentials.available, writable: false })
  })
  const deleteAuthProfile = (id) => commit((registry) => {
    const targetId = requiredId(id)
    const index = indexOfId(registry.authProfiles, targetId)
    if (index < 0) return false
    const references = referencesFor(registry, 'authProfiles', targetId)
    if (references.length) throw makeDeleteError('authProfiles', targetId, references)
    registry.authProfiles.splice(index, 1)
    invalidateOAuthClient(targetId)
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
    if (value.authProfileId) assertEnabledAuthProfiles(registry, [value.authProfileId], 'authProfileId')
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
    if (value.authProfileId) assertEnabledAuthProfiles(registry, [value.authProfileId], 'authProfileId')
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

  const resolveAuthForRequest = async (profileId, requestOptions = {}) => {
    const id = requiredId(profileId, 'authProfileId')
    const profile = get('authProfiles', id)
    if (!profile) throw new ConfigurationError('AUTH_PROFILE_NOT_FOUND', 'auth profile was not found', { path: 'authProfileId', detail: { id } })
    if (profile.enabled === false) throw new ConfigurationError('AUTH_PROFILE_DISABLED', 'auth profile is disabled', { path: 'authProfileId', detail: { id } })
    if (profile.type === 'none') return { type: 'none', headers: {}, query: {} }
    if (profile.type === 'oauth2-client-credentials') {
      const current = snapshot()
      const environment = selectedEnvironment(current, requestOptions.environmentId)
      const target = requestOptions.serviceTargetId
        ? current.serviceTargets.find((item) => item.id === requestOptions.serviceTargetId)
        : undefined
      if (requestOptions.serviceTargetId && !target) throw new ConfigurationError('TARGET_NOT_FOUND', 'service target was not found', { path: 'serviceTargetId', detail: { id: requestOptions.serviceTargetId } })
      if (target && !(target.environmentIds ?? []).includes(environment.id)) throw new ConfigurationError('ENVIRONMENT_NOT_BOUND', 'selected Environment is not bound to the Service Target', { path: 'environmentId', detail: { id: environment.id, targetId: target.id } })
      const policy = endpointPolicy(target, environment)
      if (target && (!policy || typeof policy.baseUrl !== 'string' || !policy.baseUrl)) throw new ConfigurationError('TARGET_ENDPOINT_NOT_FOUND', 'selected Service Target has no endpoint for the selected Environment', { path: 'environmentId', detail: { id: environment.id, targetId: target.id } })
      const transport = makeOAuthTransport(environment, policy, requestOptions.oauthTransport ?? requestOptions.transport ?? oauthTransport)
      if (!transport) throw new ConfigurationError('OAUTH_TRANSPORT_UNAVAILABLE', 'a secure OAuth2 transport is unavailable')
      const clientKey = oauthClientKey(profile, target, environment, policy, transport)
      let client = oauthClients.get(clientKey)
      if (!client) {
        try {
          client = createOAuth2Client({
            config: profile,
            resolver: async (ref) => credentials.resolve(ref),
            transport,
            endpointValidator: (url) => Array.isArray(policy.allowedHosts) && policy.allowedHosts.some((host) => String(host).toLowerCase() === url.hostname.toLowerCase()),
          })
        } catch (error) {
          if (error?.code) throw new ConfigurationError(`OAUTH2_${error.code}`, error.message, { cause: error })
          throw error
        }
        oauthClients.set(clientKey, client)
      }
      try {
        const token = await client.getToken({ scope: requestOptions.scope, audience: requestOptions.audience })
        return { type: profile.type, headers: { Authorization: `Bearer ${token.accessToken}` }, query: {} }
      } catch (error) {
        if (error instanceof ConfigurationError) throw error
        throw new ConfigurationError(`OAUTH2_${error.code || 'TOKEN_FAILED'}`, error.message || 'OAuth2 token request failed', { cause: error })
      }
    }
    if (profile.type === 'api-key-query' && profile.allowQuery !== true) throw new ConfigurationError('QUERY_AUTH_DISABLED', 'API key query authentication is disabled by default')
    const secret = await credentials.resolve(profile.secretRef)
    if (!secret) throw new ConfigurationError('CREDENTIAL_NOT_CONFIGURED', 'Credential is not configured')
    const value = typeof secret === 'string' ? secret : secret.value
    if (typeof value !== 'string' || !value) throw new ConfigurationError('CREDENTIAL_NOT_CONFIGURED', 'Credential is not configured')
    if (profile.type === 'bearer') return { type: profile.type, headers: { Authorization: `${profile.scheme || 'Bearer'} ${value}` }, query: {} }
    if (profile.type === 'api-key-header') return { type: profile.type, headers: { [profile.headerName]: value }, query: {} }
    if (profile.type === 'api-key-query') return { type: profile.type, headers: {}, query: { [profile.queryName]: value } }
    if (profile.type === 'basic') {
      const encoded = typeof btoa === 'function' ? btoa(`${profile.username}:${value}`) : Buffer.from(`${profile.username}:${value}`).toString('base64')
      return { type: profile.type, headers: { Authorization: `Basic ${encoded}` }, query: {} }
    }
    return { type: 'none', headers: {}, query: {} }
  }

  // Secret writes are deliberately separate from Registry commits. The
  // adapter must provide its own durable/atomic semantics; no secret value
  // enters the Registry transaction or any returned object.
  const assertCredentialWritable = async (profile) => {
    assertWritableCredentialRef(profile, 'authProfileId')
    if (credentials.available !== true) throw new ConfigurationError('CREDENTIAL_PROVIDER_UNAVAILABLE', 'Credential provider is unavailable')
    let info
    try { info = await credentials.describe(profile.secretRef) } catch (error) {
      if (error?.code === 'CREDENTIAL_DESCRIBE_FAILED') throw new ConfigurationError('CREDENTIAL_PROVIDER_UNAVAILABLE', 'Credential status service is unavailable', { cause: error })
      throw error
    }
    if (info?.available === false) throw new ConfigurationError('CREDENTIAL_PROVIDER_UNAVAILABLE', 'Credential status service is unavailable')
    if (info?.writable !== true) throw new ConfigurationError('CREDENTIAL_NOT_WRITABLE', 'Credential source is read-only; use a writable credentials source', { path: 'authProfileId', detail: { id: profile.id, source: info?.source } })
  }
  const setAuthSecret = async (profileId, value) => {
    const profile = get('authProfiles', profileId)
    if (!profile) throw new ConfigurationError('AUTH_PROFILE_NOT_FOUND', 'auth profile was not found', { path: 'authProfileId', detail: { id: profileId } })
    if (profile.type === 'none') throw new ConfigurationError('AUTH_TYPE_NONE', 'none authentication profiles cannot store a secret')
    await assertCredentialWritable(profile)
    try { await credentials.set(profile.secretRef, value) } catch (error) {
      if (error instanceof ConfigurationError) throw error
      throw new ConfigurationError(error?.code || 'CREDENTIAL_WRITE_FAILED', 'Credential write failed', { path: 'authProfileId', detail: { id: profile.id }, cause: error })
    }
    invalidateOAuthClient(profile.id)
    return describeAuthProfile(profile.id)
  }
  const unsetAuthSecret = async (profileId) => {
    const profile = get('authProfiles', profileId)
    if (!profile) throw new ConfigurationError('AUTH_PROFILE_NOT_FOUND', 'auth profile was not found', { path: 'authProfileId', detail: { id: profileId } })
    if (profile.type === 'none') throw new ConfigurationError('AUTH_TYPE_NONE', 'none authentication profiles cannot store a secret')
    await assertCredentialWritable(profile)
    try { await credentials.unset(profile.secretRef) } catch (error) {
      if (error instanceof ConfigurationError) throw error
      throw new ConfigurationError(error?.code || 'CREDENTIAL_WRITE_FAILED', 'Credential removal failed', { path: 'authProfileId', detail: { id: profile.id }, cause: error })
    }
    invalidateOAuthClient(profile.id)
    return describeAuthProfile(profile.id)
  }

  const load = async (...args) => {
    const result = await store.load(...args)
    diagnostics = result?.diagnostic
    return {
      recovered: result?.recovered === true,
      migrated: result?.migrated === true,
      diagnostic: clone(result?.diagnostic),
    }
  }

  const api = {
    load,
    getSnapshot: () => {
      const current = snapshot()
      return {
        ...current,
        environments: current.environments.map(safeEnvironmentView),
        serviceTargets: current.serviceTargets.map(safeTargetView),
        authProfiles: current.authProfiles.map((profile) => safeAuthProfileView(profile, { configured: false, available: credentials.available, writable: false })),
        operations: current.operations.map((operation) => operationListView(operation, current)),
        kits: current.kits.map((kit) => kitListView(kit, current)),
      }
    },
    getDiagnostics: () => clone(diagnostics ?? store.getDiagnostics?.()),
    getAuthSecretRefDiagnostics,
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
    previewOpenApiImport: importTransactions.previewOpenApiImport,
    confirmOpenApiImport: importTransactions.confirmOpenApiImport,
    registryFingerprint: importTransactions.registryFingerprint,
    confirmation: confirmations,
    approveWriteConfirmation: (args) => confirmationAction('approve', args),
    rejectWriteConfirmation: (args) => confirmationAction('reject', args),
    cancelWriteConfirmation: (args) => confirmationAction('cancel', args),
    clearSessionConfirmations: (sessionId) => confirmations.clearSession(sessionId),
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
    dispose() {
      disposeOAuthClients()
      sessionActivations.clearAll()
      confirmations.clear()
    },
  }
  return Object.freeze(api)
}

export { normalizeAuthProfile, normalizeEnvironment, normalizeServiceTarget, normalizeKit, normalizeOperation }
