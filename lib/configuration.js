/**
 * Host-side configuration facade for service targets, environments and auth
 * profiles. It only exposes safe metadata; secret resolution is request-time.
 */

import { normalizeAuthProfile, normalizeEnvironment, normalizeServiceTarget } from './model.js'
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

  const snapshot = () => clone(store.getSnapshot())
  const commit = async (mutator) => {
    try {
      let operationResult
      const saved = await store.update((draft) => {
        operationResult = mutator(draft)
        validateConfigurationReferences(draft)
        return draft
      })
      diagnostics = undefined
      return operationResult === undefined ? saved : operationResult
    } catch (error) {
      diagnostics = error instanceof ConfigurationError || error instanceof CredentialAdapterError
        ? error.toJSON()
        : { code: typeof error?.code === 'string' ? error.code : 'CONFIG_WRITE_FAILED', message: 'Configuration write failed' }
      throw error
    }
  }

  const readCollection = (name) => clone(snapshot()[name] ?? [])
  const get = (name, id) => clone((snapshot()[name] ?? []).find((item) => item.id === requiredId(id)))
  let describeAuthProfile
  const listSafeAuthProfiles = async () => {
    const profiles = snapshot().authProfiles ?? []
    return Promise.all(profiles.map(async (profile) => describeAuthProfile(profile.id)))
  }
  const getSafeAuthProfile = async (id) => describeAuthProfile(id)

  const createEnvironment = (input) => commit((registry) => {
    const value = validateEnvironmentInput(input)
    ensureUniqueId(registry.environments, value.id, 'environment')
    registry.environments.push(value)
    return clone(value)
  })
  const updateEnvironment = (id, input) => commit((registry) => {
    const targetId = requiredId(id)
    const index = indexOfId(registry.environments, targetId)
    if (index < 0) throw new ConfigurationError('ENVIRONMENT_NOT_FOUND', 'environment was not found', { path: 'id', detail: { id: targetId } })
    const value = validateEnvironmentInput({ ...input, id: targetId })
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
    const value = validateServiceTargetInput(input)
    ensureUniqueId(registry.serviceTargets, value.id, 'serviceTarget')
    registry.serviceTargets.push(value)
    return clone(value)
  })
  const updateServiceTarget = (id, input) => commit((registry) => {
    const targetId = requiredId(id)
    const index = indexOfId(registry.serviceTargets, targetId)
    if (index < 0) throw new ConfigurationError('TARGET_NOT_FOUND', 'service target was not found', { path: 'id', detail: { id: targetId } })
    registry.serviceTargets[index] = validateServiceTargetInput({ ...input, id: targetId })
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
    const value = validateAuthProfileInput(input)
    ensureUniqueId(registry.authProfiles, value.id, 'authProfile')
    registry.authProfiles.push(value)
    return clone(value)
  })
  const updateAuthProfile = (id, input) => commit((registry) => {
    const targetId = requiredId(id)
    const index = indexOfId(registry.authProfiles, targetId)
    if (index < 0) throw new ConfigurationError('AUTH_PROFILE_NOT_FOUND', 'auth profile was not found', { path: 'id', detail: { id: targetId } })
    registry.authProfiles[index] = validateAuthProfileInput({ ...input, id: targetId })
    return clone(registry.authProfiles[index])
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

  return Object.freeze({
    load,
    getSnapshot: snapshot,
    getDiagnostics: () => clone(diagnostics ?? store.getDiagnostics?.()),
    listEnvironments: () => readCollection('environments'),
    getEnvironment: (id) => get('environments', id),
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    listServiceTargets: () => readCollection('serviceTargets'),
    getServiceTarget: (id) => get('serviceTargets', id),
    createServiceTarget,
    updateServiceTarget,
    deleteServiceTarget,
    listAuthProfiles: listSafeAuthProfiles,
    getAuthProfile: getSafeAuthProfile,
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
  })
}

export { normalizeAuthProfile, normalizeEnvironment, normalizeServiceTarget }
