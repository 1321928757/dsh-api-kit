/**
 * Strict validation for user-managed environments, service targets and auth
 * profiles. It intentionally remains independent from DSH and credentials.
 */

import {
  AUTH_TYPES,
  READ_METHODS,
  WRITE_METHODS,
  normalizeAuthProfile,
  normalizeEnvironment,
  normalizeServiceTarget,
  normalizeServiceTargetEndpoint,
} from './model.js'
import { normalizeHost, normalizeCidrList } from './normalizers.js'
import { parseCidr } from './ip.js'
import { validateOAuth2Config, OAuth2Error } from './oauth2.js'

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/
const CONTROLLED_HEADERS = new Set([
  'authorization', 'cookie', 'host', 'content-length', 'connection',
  'transfer-encoding', 'proxy-authorization', 'proxy-authenticate',
])
const PRIVATE_HOSTS = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal', 'instance-data.ec2.internal'])
const SAFE_PROTOCOLS = new Set(['http:', 'https:'])

export class ConfigurationError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = 'ConfigurationError'
    this.code = code
    if (options.path) this.path = options.path
    if (options.detail !== undefined) this.detail = options.detail
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.path ? { path: this.path } : {}),
      ...(this.detail === undefined ? {} : { detail: this.detail }),
    }
  }
}

function fail(code, message, path, detail) {
  throw new ConfigurationError(code, message, { path, detail })
}

function ensureId(value, path) {
  if (typeof value !== 'string' || !value.trim() || CONTROL_CHARS.test(value)) {
    fail('INVALID_ID', 'A non-empty safe identifier is required', path)
  }
  return value.trim()
}

function ensureReferenceList(values, field) {
  if (values === undefined) return []
  if (!Array.isArray(values)) fail('INVALID_REFERENCE_LIST', `${field} must be an array`, field)
  for (const [index, value] of values.entries()) ensureId(value, `${field}[${index}]`)
  return values
}

function isHostSyntax(value) {
  if (typeof value !== 'string') return false
  const host = value.trim()
  if (!host || host.includes('://') || /[\s/\\?#]/.test(host)) return false
  if (host.includes(':')) return /^\[?[0-9a-f:.]+\]?$/i.test(host)
  if (/^\d+(?:\.\d+){3}$/.test(host)) return host.split('.').every((part) => Number(part) >= 0 && Number(part) <= 255)
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(host)
}

function hostIsPrivateOrLocal(host) {
  const normalized = normalizeHost(host)
  if (!normalized) return false
  if (PRIVATE_HOSTS.has(normalized) || normalized === '::1' || normalized === '0.0.0.0') return true
  if (/^127\./.test(normalized) || /^10\./.test(normalized) || /^192\.168\./.test(normalized) || /^169\.254\./.test(normalized)) return true
  const match = normalized.match(/^172\.(\d+)(?:\.|$)/)
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31)
}

function validateBaseUrl(baseUrl, pathName, options = {}) {
  if (typeof baseUrl !== 'string' || !baseUrl.trim()) fail('BASE_URL_REQUIRED', 'baseUrl must be explicitly configured', pathName)
  let url
  try { url = new URL(baseUrl) } catch { fail('BASE_URL_INVALID', 'baseUrl is not a valid URL', pathName) }
  if (!SAFE_PROTOCOLS.has(url.protocol)) fail('BASE_URL_PROTOCOL', 'baseUrl must use HTTP or HTTPS', pathName, { protocol: url.protocol })
  if (url.username || url.password) fail('BASE_URL_CREDENTIALS', 'baseUrl must not contain embedded credentials', pathName)
  if (url.search || url.hash) fail('BASE_URL_QUERY', 'baseUrl must not contain a query or fragment', pathName)
  if (!url.hostname || CONTROL_CHARS.test(url.hostname)) fail('BASE_URL_HOST', 'baseUrl must contain a valid host', pathName)
  const port = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80)
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail('BASE_URL_PORT', 'baseUrl has an invalid port', pathName)
  if (port < 1024 && port !== 80 && port !== 443 && options.allowPrivilegedPort !== true) fail('BASE_URL_PORT', 'privileged ports require explicit allowPrivilegedPort', pathName, { port })
  return { url, port }
}

export function validateEnvironmentInput(input, options = {}) {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const hasBaseUrl = typeof value.baseUrl === 'string' && value.baseUrl.trim() !== ''
  let url
  let port = Number.isInteger(value.port) ? value.port : 0
  if (hasBaseUrl) {
    const checked = validateBaseUrl(value.baseUrl.trim(), 'baseUrl', { allowPrivilegedPort: value.allowPrivilegedPort === true || options.allowPrivilegedPort === true })
    url = checked.url; port = checked.port
  }
  const suppliedHosts = value.allowedHosts ?? value.hosts
  if (suppliedHosts !== undefined && !Array.isArray(suppliedHosts)) fail('INVALID_HOST_LIST', 'allowedHosts must be an array', 'allowedHosts')
  const normalizedHosts = (suppliedHosts ?? []).map((host) => {
    if (!isHostSyntax(host) || CONTROL_CHARS.test(host) || !normalizeHost(host)) fail('INVALID_HOST', 'allowedHosts contains an invalid host', 'allowedHosts')
    return normalizeHost(host)
  })
  const hostList = [...new Set([...(url ? [url.hostname.toLowerCase()] : []), ...normalizedHosts])]
  const suppliedCidrs = value.allowedCidrs ?? value.privateCidrs
  if (suppliedCidrs !== undefined && !Array.isArray(suppliedCidrs)) fail('INVALID_CIDR_LIST', 'allowedCidrs must be an array', 'allowedCidrs')
  const allowedCidrs = normalizeCidrList(suppliedCidrs)
  if (suppliedCidrs !== undefined && allowedCidrs.length !== suppliedCidrs.length) fail('INVALID_CIDR', 'allowedCidrs contains invalid values', 'allowedCidrs')
  for (const [index, cidr] of allowedCidrs.entries()) if (!parseCidr(cidr)) fail('INVALID_CIDR', 'allowedCidrs contains an invalid CIDR', `allowedCidrs[${index}]`)
  if (url && hostIsPrivateOrLocal(url.hostname) && value.allowPrivateNetwork !== true) fail('PRIVATE_HOST_REQUIRES_OPT_IN', 'private or local hosts require allowPrivateNetwork', 'allowPrivateNetwork')
  return Object.freeze(normalizeEnvironment({ ...value, baseUrl: url?.toString() ?? '', allowedHosts: hostList, allowedCidrs, agentEnabled: value.agentEnabled ?? !Boolean(value.production), port, allowPrivilegedPort: value.allowPrivilegedPort === true || options.allowPrivilegedPort === true }))
}

export function normalizeEnvironmentConfig(input, options = {}) {
  return validateEnvironmentInput(input, options)
}

export function normalizeServiceTargetEndpointConfig(input, defaults = {}) {
  return normalizeServiceTargetEndpoint(input, defaults)
}

export function validateServiceTargetEndpointInput(input, pathName = 'endpoints') {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const environmentId = ensureId(value.environmentId, `${pathName}.environmentId`)
  if (typeof value.baseUrl !== 'string' || !value.baseUrl.trim()) fail('BASE_URL_REQUIRED', 'endpoint baseUrl must be explicitly configured', `${pathName}.baseUrl`)
  const normalized = validateEnvironmentInput({ ...value, id: environmentId })
  return Object.freeze({ environmentId, baseUrl: normalized.baseUrl, protocol: normalized.protocol, allowedHosts: normalized.allowedHosts, allowedCidrs: normalized.allowedCidrs, allowPrivateNetwork: normalized.allowPrivateNetwork, timeoutMs: normalized.timeoutMs, maxResponseBytes: normalized.maxResponseBytes, maxRedirects: normalized.maxRedirects, port: normalized.port, allowPrivilegedPort: normalized.allowPrivilegedPort })
}

export function validateServiceTargetInput(input) {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const normalized = normalizeServiceTarget(value)
  ensureId(normalized.id, 'id')
  const rawEnvironmentIds = value.environmentIds ?? value.environments
  const environments = ensureReferenceList(rawEnvironmentIds === undefined ? Object.keys(normalized.endpoints ?? {}) : normalized.environmentIds, 'environmentIds')
  const authProfiles = ensureReferenceList(normalized.authProfileIds, 'authProfileIds')
  if (environments.length === 0) fail('TARGET_ENVIRONMENT_REQUIRED', 'a service target must bind at least one environment', 'environmentIds')
  if (normalized.defaultEnvironmentId && !environments.includes(normalized.defaultEnvironmentId)) fail('DEFAULT_ENVIRONMENT_NOT_BOUND', 'defaultEnvironmentId must belong to environmentIds', 'defaultEnvironmentId')
  const endpointEntries = Object.entries(normalized.endpoints ?? {})
  const endpoints = {}
  endpointEntries.forEach(([environmentId, endpoint], index) => {
    const checked = validateServiceTargetEndpointInput({ ...endpoint, environmentId }, `endpoints.${environmentId || index}`)
    if (!environments.includes(checked.environmentId)) fail('TARGET_ENDPOINT_ENVIRONMENT_MISMATCH', 'endpoint environment must be bound to the service target', `endpoints.${environmentId}.environmentId`)
    endpoints[checked.environmentId] = checked
  })
  // Targets written by older callers may omit endpoints; registry migration
  // materializes them from legacy Environment fields when loading. Explicit
  // endpoint declarations, however, must cover every binding exactly once.
  if (Object.hasOwn(value, 'endpoints') && endpointEntries.length > 0 && endpointEntries.length !== environments.length) fail('TARGET_ENDPOINT_REQUIRED', 'service target requires one endpoint per bound environment', 'endpoints')
  return Object.freeze({ ...normalized, endpoints })
}

export function validateAuthProfileInput(input) {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const rawType = typeof value.type === 'string' ? value.type.trim().toLowerCase() : ''
  if (rawType && !AUTH_TYPES.includes(rawType)) fail('AUTH_TYPE_UNSUPPORTED', 'unsupported authentication type', 'type')
  const normalized = normalizeAuthProfile(value)
  ensureId(normalized.id, 'id')
  if (normalized.type === 'oauth2-client-credentials') {
    try {
      validateOAuth2Config(normalized)
    } catch (error) {
      if (error instanceof OAuth2Error) {
        fail(`OAUTH2_${error.code}`, error.message, error.code === 'CONFIG_INVALID' ? 'oauth2' : undefined)
      }
      throw error
    }
  }
  if (normalized.secretRef && normalized.secretRef.length > 512) fail('SECRET_REF_INVALID', 'secretRef is too long', 'secretRef')
  if (!AUTH_TYPES.includes(normalized.type)) fail('AUTH_TYPE_UNSUPPORTED', 'unsupported authentication type', 'type')
  if (normalized.type === 'none' && normalized.secretRef) fail('SECRET_REF_FOR_NONE', 'none authentication profiles must not reference a secret', 'secretRef')
  if (normalized.type !== 'none' && !normalized.secretRef) fail('SECRET_REF_REQUIRED', 'secretRef is required for this authentication type', 'secretRef')
  if (CONTROL_CHARS.test(normalized.headerName) || CONTROL_CHARS.test(normalized.queryName)) fail('AUTH_NAME_INVALID', 'headerName/queryName must not contain control characters', 'headerName')
  if (normalized.headerName && CONTROLLED_HEADERS.has(normalized.headerName.toLowerCase())) fail('CONTROLLED_HEADER', 'controlled headers cannot be used as business headers', 'headerName')
  if (normalized.queryName && CONTROLLED_HEADERS.has(normalized.queryName.toLowerCase())) fail('CONTROLLED_HEADER', 'controlled query names cannot be used for credentials', 'queryName')
  if (normalized.type === 'api-key-header' && !normalized.headerName) fail('AUTH_HEADER_REQUIRED', 'API key header authentication requires headerName', 'headerName')
  if (normalized.type === 'api-key-query' && !normalized.queryName) fail('AUTH_QUERY_REQUIRED', 'API key query authentication requires queryName', 'queryName')
  if (normalized.type === 'basic' && !normalized.username) fail('BASIC_USERNAME_REQUIRED', 'Basic authentication requires username', 'username')
  return Object.freeze({ ...normalized, allowQuery: normalized.type === 'api-key-query' ? value.allowQuery === true : false, risk: normalized.type === 'api-key-query' ? 'credential-in-url' : normalized.type === 'oauth2-client-credentials' ? 'oauth2-client-credentials' : '' })
}

function entityIds(values, name) {
  const ids = new Set()
  for (const [index, item] of (Array.isArray(values) ? values.entries() : [])) {
    if (!item?.id) fail('INVALID_ID', `${name}[${index}] has no id`, `${name}[${index}].id`)
    if (ids.has(item.id)) fail('DUPLICATE_ID', `${name} contains duplicate id`, `${name}[${index}].id`, { id: item.id })
    ids.add(item.id)
  }
  return ids
}

export function validateConfigurationReferences(registry) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) fail('REGISTRY_INVALID', 'registry must be an object', 'registry')
  const environments = entityIds(registry.environments, 'environments')
  const targets = entityIds(registry.serviceTargets, 'serviceTargets')
  const authProfiles = entityIds(registry.authProfiles, 'authProfiles')
  const operations = entityIds(registry.operations, 'operations')
  const kits = entityIds(registry.kits, 'kits')
  for (const [index, environment] of (registry.environments ?? []).entries()) {
    validateEnvironmentInput(environment)
    if (environment.production && environment.agentEnabled === true && environment.enabled !== true) fail('PRODUCTION_DISABLED', 'disabled production environment cannot be agent-enabled', `environments[${index}]`)
  }
  for (const [index, target] of (registry.serviceTargets ?? []).entries()) {
    const value = validateServiceTargetInput(target)
    for (const id of value.environmentIds) if (!environments.has(id)) fail('DANGLING_ENVIRONMENT', 'service target references a missing environment', `serviceTargets[${index}].environmentIds`, { id })
    for (const id of Object.keys(value.endpoints ?? {})) if (!environments.has(id)) fail('DANGLING_ENVIRONMENT', 'service target endpoint references a missing environment', `serviceTargets[${index}].endpoints.${id}`, { id })
    for (const id of value.authProfileIds) if (!authProfiles.has(id)) fail('DANGLING_AUTH_PROFILE', 'service target references a missing auth profile', `serviceTargets[${index}].authProfileIds`, { id })
  }
  for (const [index, auth] of (registry.authProfiles ?? []).entries()) validateAuthProfileInput(auth, `authProfiles[${index}]`)
  const operationKeys = new Set()
  for (const [index, operation] of (registry.operations ?? []).entries()) {
    const operationKey = typeof operation.operationId === 'string' ? operation.operationId.toLowerCase() : ''
    if (operationKey && operationKeys.has(operationKey)) fail('DUPLICATE_OPERATION_ID', 'operationId must be globally unique', `operations[${index}].operationId`, { operationId: operation.operationId })
    if (operationKey) operationKeys.add(operationKey)
    if (operation.serviceTargetId && !targets.has(operation.serviceTargetId)) fail('DANGLING_TARGET', 'operation references a missing service target', `operations[${index}].serviceTargetId`, { id: operation.serviceTargetId })
    if (operation.authProfileId && !authProfiles.has(operation.authProfileId)) fail('DANGLING_AUTH_PROFILE', 'operation references a missing auth profile', `operations[${index}].authProfileId`, { id: operation.authProfileId })
    for (const id of operation.kitIds ?? []) if (!kits.has(id)) fail('DANGLING_KIT', 'operation references a missing kit', `operations[${index}].kitIds`, { id })
  }
  for (const [index, kit] of (registry.kits ?? []).entries()) {
    for (const id of kit.operationIds ?? []) if (!operations.has(id)) fail('DANGLING_OPERATION', 'kit references a missing operation', `kits[${index}].operationIds`, { id })
    for (const id of kit.serviceTargetIds ?? []) if (!targets.has(id)) fail('DANGLING_TARGET', 'kit references a missing service target', `kits[${index}].serviceTargetIds`, { id })
    for (const id of kit.environmentIds ?? []) if (!environments.has(id)) fail('DANGLING_ENVIRONMENT', 'kit references a missing environment', `kits[${index}].environmentIds`, { id })
    for (const id of Object.keys(kit.operationPolicies ?? {})) if (!Array.isArray(kit.operationIds) || !kit.operationIds.includes(id)) fail('DANGLING_OPERATION_POLICY', 'kit operation policy references an operation outside the kit', `kits[${index}].operationPolicies.${id}`, { id })
  }
  return { ok: true, valid: true, errors: [], warnings: [] }
}

export function safeEnvironmentView(environment) {
  const normalized = normalizeEnvironment(environment)
  return {
    id: normalized.id,
    name: normalized.name,
    description: normalized.description,
    production: normalized.production,
    agentEnabled: normalized.agentEnabled,
    enabled: normalized.enabled,
  }
}

export function safeServiceTargetView(target) {
  const normalized = normalizeServiceTarget(target)
  const endpoints = Object.fromEntries(Object.entries(normalized.endpoints ?? {}).map(([environmentId, endpoint]) => [environmentId, {
    environmentId,
    baseUrl: endpoint.baseUrl,
    protocol: endpoint.protocol,
    allowedHosts: [...(endpoint.allowedHosts ?? [])],
    allowedCidrs: [...(endpoint.allowedCidrs ?? [])],
    allowPrivateNetwork: endpoint.allowPrivateNetwork === true,
    timeoutMs: endpoint.timeoutMs,
    maxResponseBytes: endpoint.maxResponseBytes,
    maxRedirects: endpoint.maxRedirects,
    port: endpoint.port,
    allowPrivilegedPort: endpoint.allowPrivilegedPort === true,
  }]))
  return {
    id: normalized.id,
    name: normalized.name,
    description: normalized.description,
    environmentIds: [...normalized.environmentIds],
    defaultEnvironmentId: normalized.defaultEnvironmentId,
    authProfileIds: [...normalized.authProfileIds],
    endpoints,
    enabled: normalized.enabled,
    agentEnabled: normalized.agentEnabled,
  }
}

export function safeAuthProfileView(profile, credentialInfo = {}) {
  const normalized = normalizeAuthProfile(profile)
  const view = {
    id: normalized.id,
    name: normalized.name,
    type: normalized.type,
    headerName: normalized.headerName,
    queryName: normalized.queryName,
    scheme: normalized.scheme,
    username: normalized.username,
    allowQuery: normalized.allowQuery,
    risk: normalized.risk,
    enabled: normalized.enabled,
    hasSecret: credentialInfo.configured === true || credentialInfo.hasSecret === true,
    credentialSource: ['env', 'file', 'keychain', 'memory', 'dsh'].includes(credentialInfo.source) ? credentialInfo.source : undefined,
    writable: credentialInfo.writable === true,
  }
  // OAuth metadata is deliberately reduced to host/path; never return the
  // endpoint URL (which may contain sensitive routing information), token, or ref.
  if (normalized.type === 'oauth2-client-credentials') {
    try {
      const url = new URL(normalized.tokenEndpoint)
      view.tokenEndpointHost = url.hostname.toLowerCase()
      view.tokenEndpointPath = url.pathname || '/'
      view.oauthClientId = normalized.clientId
      view.oauthScope = normalized.scope
      view.oauthAudience = normalized.audience
      view.oauthAuthMethod = normalized.authMethod
    } catch {
      view.tokenEndpointHost = ''
      view.tokenEndpointPath = ''
    }
  }
  return assertReadOnlyAuthView(view)
}

export function assertReadOnlyAuthView(value) {
  const forbiddenKeys = /^(?:secretRef|password|cookie|authorization|token|accessToken|refreshToken|clientSecret)$/i
  const inspect = (item) => {
    if (!item || typeof item !== 'object') return
    for (const [key, child] of Object.entries(item)) {
      if (forbiddenKeys.test(key)) fail('SECRET_LEAK', 'safe auth view contains a forbidden secret field')
      inspect(child)
    }
  }
  inspect(value)
  return value
}

export { CONTROLLED_HEADERS, PRIVATE_HOSTS, SAFE_PROTOCOLS, READ_METHODS, WRITE_METHODS }
