/**
 * dsh-api-kit canonical domain model.
 *
 * No DSH/Cordis, filesystem, credential, or network dependency belongs here.
 * This module turns plain untrusted JSON into a bounded Registry model shared by
 * the Host adapter, OpenAPI importer, and future MCP adapter.
 */

import {
  MAX_DESCRIPTION_LENGTH,
  MAX_HOSTS,
  MAX_NAME_LENGTH,
  MAX_PARAMETERS,
  MAX_PATH_LENGTH,
  MAX_SCHEMA_BYTES,
  MAX_SCHEMA_STRING,
  MAX_TAGS,
  deriveHostFromBaseUrl,
  identifier,
  isRecord,
  normalizeBaseUrl,
  normalizeExample,
  normalizeHostList,
  normalizeJsonSchema,
  lowercaseIdentifier,
  normalizeMethod,
  normalizeParameterLocation,
  normalizeParameterName,
  normalizePath,
  normalizePort,
  normalizeSchemaMap,
  normalizeTags,
  normalizeTimeout,
  stableSlug,
  text,
  uniqueStrings,
} from './normalizers.js'

export const REGISTRY_SCHEMA_VERSION = 1
export const SUPPORTED_METHODS = Object.freeze(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
export const READ_METHODS = Object.freeze(['GET', 'HEAD'])
export const WRITE_METHODS = Object.freeze(['POST', 'PUT', 'PATCH', 'DELETE'])
export const AUTH_TYPES = Object.freeze(['none', 'bearer', 'api-key-header', 'api-key-query', 'basic'])
export const DEFAULT_TIMEOUT_MS = 15000
export const DEFAULT_MAX_RESPONSE_BYTES = 512 * 1024
export const MAX_OPERATIONS = 10000
export const MAX_KITS = 500
export const MAX_ENVIRONMENTS = 500
export const MAX_SERVICE_TARGETS = 500
export const MAX_AUTH_PROFILES = 500

const EMPTY_ARRAY = Object.freeze([])

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value
  }
  return ''
}

function normalizeBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeNumber(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.floor(number)))
}

export function normalizePolicy(input, method = '') {
  const raw = isRecord(input) ? input : {}
  const normalizedMethod = normalizeMethod(method)
  const readDefault = READ_METHODS.includes(normalizedMethod)
  const allowMethods = uniqueStrings(raw.allowMethods, SUPPORTED_METHODS.length, 16)
    .map(normalizeMethod)
    .filter((item) => SUPPORTED_METHODS.includes(item))
  const allowAgentCall = normalizeBoolean(raw.allowAgentCall, readDefault)
  const requiresConfirmation = normalizeBoolean(raw.requiresConfirmation, !readDefault)
  const allowWrite = normalizeBoolean(raw.allowWrite, false)
  return {
    allowAgentCall,
    requiresConfirmation,
    allowWrite,
    allowMethods: allowMethods.length > 0 ? allowMethods : (readDefault ? [...READ_METHODS] : EMPTY_ARRAY),
    timeoutMs: normalizeTimeout(raw.timeoutMs, DEFAULT_TIMEOUT_MS),
    maxResponseBytes: normalizeNumber(raw.maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES, 1024, 16 * 1024 * 1024),
    maxResponseDepth: normalizeNumber(raw.maxResponseDepth, 8, 1, 32),
    maxArrayItems: normalizeNumber(raw.maxArrayItems, 200, 1, 5000),
  }
}

export function normalizeParameter(input) {
  const raw = isRecord(input) ? input : {}
  const name = normalizeParameterName(firstString(raw.name, raw.key))
  const location = normalizeParameterLocation(firstString(raw.in, raw.location))
  return {
    name: name.slice(0, 256),
    in: location || 'query',
    required: normalizeBoolean(raw.required, location === 'path'),
    description: text(raw.description, MAX_DESCRIPTION_LENGTH, ''),
    schema: normalizeJsonSchema(raw.schema),
    example: normalizeExample(raw.example),
    deprecated: normalizeBoolean(raw.deprecated, false),
    allowEmptyValue: normalizeBoolean(raw.allowEmptyValue, false),
  }
}

export function normalizeParameters(values) {
  if (!Array.isArray(values)) return []
  const result = []
  const seen = new Set()
  for (const value of values.slice(0, MAX_PARAMETERS)) {
    const parameter = normalizeParameter(value)
    if (!parameter.name) continue
    const key = `${parameter.in}:${parameter.name}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(parameter)
  }
  return result
}

export function extractPathParams(path) {
  const result = []
  const seen = new Set()
  const normalized = normalizePath(path)
  const matcher = /\{([^{}]+)\}/g
  let match
  while ((match = matcher.exec(normalized)) !== null) {
    const name = normalizeParameterName(match[1])
    if (!name || seen.has(name)) continue
    seen.add(name)
    result.push(name)
  }
  return result
}

export function normalizeRequestBody(input) {
  const raw = isRecord(input) ? input : {}
  const schema = raw.schema !== undefined
    ? normalizeJsonSchema(raw.schema)
    : isRecord(raw.content)
      ? normalizeJsonSchema(Object.values(raw.content)[0]?.schema)
      : {}
  const contentTypes = raw.contentTypes !== undefined
    ? uniqueStrings(raw.contentTypes, 20, 120)
    : isRecord(raw.content)
      ? uniqueStrings(Object.keys(raw.content), 20, 120)
      : []
  return {
    required: normalizeBoolean(raw.required, false),
    contentTypes,
    schema,
    example: normalizeExample(raw.example),
    description: text(raw.description, MAX_DESCRIPTION_LENGTH, ''),
  }
}

export function normalizeResponses(input) {
  if (!isRecord(input)) return []
  const result = []
  for (const [status, value] of Object.entries(input).slice(0, 100)) {
    const raw = isRecord(value) ? value : {}
    const content = isRecord(raw.content) ? raw.content : {}
    const firstContent = Object.values(content)[0]
    result.push({
      status: String(status).slice(0, 32),
      description: text(raw.description, MAX_DESCRIPTION_LENGTH, ''),
      contentTypes: uniqueStrings(Object.keys(content), 20, 120),
      schema: normalizeJsonSchema(raw.schema ?? firstContent?.schema),
      example: normalizeExample(raw.example ?? firstContent?.example),
    })
  }
  return result
}

export function normalizeOperation(input, defaults = {}) {
  const raw = isRecord(input) ? input : {}
  const method = normalizeMethod(firstString(raw.method, defaults.method))
  const path = normalizePath(firstString(raw.path, raw.url, defaults.path))
  const explicitId = identifier(firstString(raw.id, raw.operationId, defaults.operationId), '')
  const id = explicitId || stableOperationId(method, path)
  const operationId = identifier(firstString(raw.operationId, id), id)
  const parameters = normalizeParameters(raw.parameters)
  const pathParams = extractPathParams(path)
  for (const name of pathParams) {
    if (!parameters.some((parameter) => parameter.in === 'path' && parameter.name === name)) {
      parameters.push(normalizeParameter({ name, in: 'path', required: true, schema: { type: 'string' } }))
    }
  }
  const policy = normalizePolicy(raw.policy, method)
  const tags = normalizeTags(raw.tags)
  const serviceTargetId = identifier(firstString(raw.serviceTargetId, raw.targetId, defaults.serviceTargetId), '')
  const kitIds = uniqueStrings(raw.kitIds ?? raw.kits, MAX_KITS, 128).map((value) => identifier(value, '')).filter(Boolean)
  return {
    id,
    operationId,
    name: text(firstString(raw.name, raw.summary, operationId), MAX_NAME_LENGTH, operationId),
    summary: text(raw.summary, MAX_NAME_LENGTH, ''),
    description: text(raw.description, MAX_DESCRIPTION_LENGTH, ''),
    method,
    path: path.slice(0, MAX_PATH_LENGTH),
    tags,
    serviceTargetId,
    kitIds,
    parameters: parameters.slice(0, MAX_PARAMETERS),
    requestBody: raw.requestBody === null ? null : normalizeRequestBody(raw.requestBody),
    responses: normalizeResponses(raw.responses),
    security: uniqueStrings(raw.security, 50, 128),
    authProfileId: identifier(firstString(raw.authProfileId, defaults.authProfileId), ''),
    policy,
    source: text(raw.source, 120, ''),
    sourceKey: text(raw.sourceKey, 512, ''),
    extensions: normalizeSchemaMap(raw.extensions),
  }
}

export function stableOperationKey(method, path) {
  const normalizedMethod = normalizeMethod(method) || 'GET'
  const normalizedPath = normalizePath(path)
  return `${normalizedMethod} ${normalizedPath}`
}

export function stableOperationId(method, path) {
  return stableSlug(stableOperationKey(method, path).replace(/\{([^{}]+)\}/g, 'by-$1'), 'operation')
}

export function normalizeEnvironment(input, defaults = {}) {
  const raw = isRecord(input) ? input : {}
  const baseUrl = normalizeBaseUrl(firstString(raw.baseUrl, defaults.baseUrl))
  const configuredHosts = normalizeHostList(raw.allowedHosts ?? raw.hosts)
  const derivedHost = deriveHostFromBaseUrl(baseUrl)
  const allowedHosts = configuredHosts.length > 0 ? configuredHosts : (derivedHost ? [derivedHost] : [])
  return {
    id: identifier(firstString(raw.id, raw.name, defaults.id), 'environment'),
    name: text(firstString(raw.name, raw.id, defaults.name), MAX_NAME_LENGTH, 'Environment'),
    description: text(raw.description, MAX_DESCRIPTION_LENGTH, ''),
    baseUrl,
    allowedHosts,
    allowPrivateNetwork: normalizeBoolean(raw.allowPrivateNetwork, false),
    production: normalizeBoolean(raw.production ?? raw.isProduction, false),
    enabled: normalizeBoolean(raw.enabled, true),
    timeoutMs: normalizeTimeout(raw.timeoutMs, DEFAULT_TIMEOUT_MS),
    maxResponseBytes: normalizeNumber(raw.maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES, 1024, 16 * 1024 * 1024),
    maxRedirects: normalizeNumber(raw.maxRedirects, 0, 0, 3),
    port: normalizePort(raw.port, 0),
  }
}

export function normalizeServiceTarget(input, defaults = {}) {
  const raw = isRecord(input) ? input : {}
  return {
    id: lowercaseIdentifier(firstString(raw.id, raw.name, defaults.id), 'service'),
    name: text(firstString(raw.name, raw.id, defaults.name), MAX_NAME_LENGTH, 'Service'),
    description: text(raw.description, MAX_DESCRIPTION_LENGTH, ''),
    environmentIds: uniqueStrings(raw.environmentIds ?? raw.environments, MAX_ENVIRONMENTS, 128).map((value) => identifier(value, '')).filter(Boolean),
    defaultEnvironmentId: identifier(firstString(raw.defaultEnvironmentId, defaults.defaultEnvironmentId), ''),
    authProfileIds: uniqueStrings(raw.authProfileIds ?? raw.authProfiles, MAX_AUTH_PROFILES, 128).map((value) => identifier(value, '')).filter(Boolean),
    enabled: normalizeBoolean(raw.enabled, true),
  }
}

export function normalizeAuthProfile(input, defaults = {}) {
  const raw = isRecord(input) ? input : {}
  const type = firstString(raw.type, defaults.type).toLowerCase()
  const normalizedType = AUTH_TYPES.includes(type) ? type : 'none'
  return {
    id: lowercaseIdentifier(firstString(raw.id, raw.name, defaults.id), 'auth'),
    name: text(firstString(raw.name, raw.id, defaults.name), MAX_NAME_LENGTH, 'Authentication'),
    type: normalizedType,
    headerName: text(firstString(raw.headerName, defaults.headerName), 120, normalizedType === 'api-key-header' ? 'X-API-Key' : ''),
    queryName: text(firstString(raw.queryName, defaults.queryName), 120, normalizedType === 'api-key-query' ? 'api_key' : ''),
    scheme: text(raw.scheme, 80, 'Bearer'),
    username: text(raw.username, 256, ''),
    secretRef: text(firstString(raw.secretRef, raw.credentialId, defaults.secretRef), 512, ''),
    enabled: normalizeBoolean(raw.enabled, true),
  }
}

export function normalizeKit(input, defaults = {}) {
  const raw = isRecord(input) ? input : {}
  const id = lowercaseIdentifier(firstString(raw.id, raw.name, defaults.id), 'api-kit')
  const operationIds = uniqueStrings(raw.operationIds ?? raw.operations, MAX_OPERATIONS, 128).map((value) => identifier(value, '')).filter(Boolean)
  const serviceTargetIds = uniqueStrings(raw.serviceTargetIds ?? raw.targets, MAX_SERVICE_TARGETS, 128).map((value) => identifier(value, '')).filter(Boolean)
  const environmentIds = uniqueStrings(raw.environmentIds ?? raw.environments, MAX_ENVIRONMENTS, 128).map((value) => identifier(value, '')).filter(Boolean)
  const policyInput = isRecord(raw.policy) ? raw.policy : {}
  return {
    id,
    name: text(firstString(raw.name, id, defaults.name), MAX_NAME_LENGTH, id),
    description: text(raw.description, MAX_DESCRIPTION_LENGTH, ''),
    project: text(raw.project, MAX_NAME_LENGTH, ''),
    tags: normalizeTags(raw.tags),
    operationIds,
    serviceTargetIds,
    environmentIds,
    defaultEnvironmentId: identifier(firstString(raw.defaultEnvironmentId, defaults.defaultEnvironmentId), ''),
    enabled: normalizeBoolean(raw.enabled, true),
    agentEnabled: normalizeBoolean(raw.agentEnabled ?? raw.allowAgentCall, true),
    policy: {
      allowReadMethods: uniqueStrings(policyInput.allowReadMethods, READ_METHODS.length, 16).map(normalizeMethod).filter((method) => READ_METHODS.includes(method)),
      allowWriteMethods: uniqueStrings(policyInput.allowWriteMethods, WRITE_METHODS.length, 16).map(normalizeMethod).filter((method) => WRITE_METHODS.includes(method)),
      allowWrite: normalizeBoolean(policyInput.allowWrite, false),
      requiresConfirmation: normalizeBoolean(policyInput.requiresConfirmation, false),
      maxActiveOperations: normalizeNumber(policyInput.maxActiveOperations, 1000, 1, MAX_OPERATIONS),
    },
    createdAt: text(raw.createdAt, 64, ''),
    updatedAt: text(raw.updatedAt, 64, ''),
  }
}

export function createEmptyRegistry() {
  return {
    schemaVersion: REGISTRY_SCHEMA_VERSION,
    kits: [],
    operations: [],
    serviceTargets: [],
    environments: [],
    authProfiles: [],
    metadata: {
      createdAt: '',
      updatedAt: '',
    },
  }
}

export function migrateRegistry(input) {
  const raw = isRecord(input) ? input : {}
  const version = Number(raw.schemaVersion ?? raw.version ?? 0)
  if (version >= REGISTRY_SCHEMA_VERSION) return raw

  // T02 accepts the empty/legacy shape and leaves later entity migration to
  // normalizeRegistry. Keeping this function explicit gives future versions a
  // single place to add lossless migrations instead of scattering version checks.
  return {
    ...raw,
    schemaVersion: REGISTRY_SCHEMA_VERSION,
    kits: raw.kits ?? raw.collections ?? [],
    operations: raw.operations ?? raw.endpoints ?? [],
    serviceTargets: raw.serviceTargets ?? raw.targets ?? [],
    environments: raw.environments ?? [],
    authProfiles: raw.authProfiles ?? raw.auth ?? [],
  }
}

export function normalizeRegistry(input) {
  const migrated = migrateRegistry(input)
  const raw = isRecord(migrated) ? migrated : {}
  const registry = createEmptyRegistry()
  registry.kits = Array.isArray(raw.kits) ? raw.kits.slice(0, MAX_KITS).map((item) => normalizeKit(item)) : []
  registry.operations = Array.isArray(raw.operations) ? raw.operations.slice(0, MAX_OPERATIONS).map((item) => normalizeOperation(item)) : []
  registry.serviceTargets = Array.isArray(raw.serviceTargets) ? raw.serviceTargets.slice(0, MAX_SERVICE_TARGETS).map((item) => normalizeServiceTarget(item)) : []
  registry.environments = Array.isArray(raw.environments) ? raw.environments.slice(0, MAX_ENVIRONMENTS).map((item) => normalizeEnvironment(item)) : []
  registry.authProfiles = Array.isArray(raw.authProfiles) ? raw.authProfiles.slice(0, MAX_AUTH_PROFILES).map((item) => normalizeAuthProfile(item)) : []
  registry.metadata = {
    createdAt: text(raw.metadata?.createdAt, 64, ''),
    updatedAt: text(raw.metadata?.updatedAt, 64, ''),
  }
  return registry
}

export function linkOperationToKit(operation, kitId) {
  const normalizedOperation = normalizeOperation(operation)
  const id = identifier(kitId, '')
  if (id && !normalizedOperation.kitIds.includes(id)) normalizedOperation.kitIds.push(id)
  return normalizedOperation
}

export function linkKitToOperation(kit, operationId) {
  const normalizedKit = normalizeKit(kit)
  const id = identifier(operationId, '')
  if (id && !normalizedKit.operationIds.includes(id)) normalizedKit.operationIds.push(id)
  return normalizedKit
}

// Keep these imports part of the public pure-model contract for callers that
// need to validate size limits while building an entity.
export { MAX_SCHEMA_BYTES, MAX_SCHEMA_STRING, MAX_HOSTS, MAX_TAGS }
