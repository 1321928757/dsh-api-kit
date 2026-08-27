/**
 * Strict write validation, link reconciliation, and safe views for Operations
 * and API Kits. This module is DSH-independent and never handles credentials.
 */

import {
  READ_METHODS,
  SUPPORTED_METHODS,
  WRITE_METHODS,
  normalizeKit,
  normalizeOperation,
} from './model.js'
import {
  CONTROLLED_HEADERS,
  ConfigurationError,
} from './config-validation.js'
import {
  identifier,
  isRecord,
  normalizeParameterLocation,
  normalizeParameterName,
  lowercaseIdentifier,
  normalizePath,
  normalizeMethod,
  normalizeJsonValue,
} from './normalizers.js'

const ALLOWED_PARAMETER_LOCATIONS = new Set(['path', 'query', 'header', 'cookie'])
const STATUS_PATTERN = /^(?:default|[1-5][0-9]{2})$/
const SECRET_KEY = /^(?:authorization|cookie|password|passwd|secret|token|api[-_]?key|client[-_]?secret|private[-_]?key|access[-_]?key)$/i
const FORBIDDEN_VIEW_KEYS = new Set(['secretref', 'secret', 'password', 'passwd', 'authorization', 'cookie'])
const CLEARABLE_OPERATION_FIELDS = new Set(['parameters', 'tags', 'security', 'responses', 'kitIds', 'requestBody'])
const CLEARABLE_KIT_FIELDS = new Set(['operationIds', 'serviceTargetIds', 'environmentIds', 'tags', 'operationPolicies'])

function fail(code, message, path, detail) {
  throw new ConfigurationError(code, message, { path, detail })
}

function plainObject(value, path, code = 'INVALID_INPUT') {
  if (!isRecord(value)) fail(code, 'value must be a plain object', path)
  return value
}

function stringField(value, path, { required = false, max = 4096 } = {}) {
  if (value === undefined && !required) return undefined
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    fail('INVALID_FIELD', `${path} must be a bounded string`, path)
  }
  return value
}

function booleanField(value, path) {
  if (value !== undefined && typeof value !== 'boolean') fail('INVALID_FIELD', `${path} must be boolean`, path)
}

function safeReference(value, path, { required = false } = {}) {
  if ((value === undefined || value === null || value === '') && !required) return undefined
  stringField(value, path, { required: true, max: 128 })
  const normalized = lowercaseIdentifier(value, '')
  if (!normalized) fail('INVALID_ID', `${path} must be a safe identifier`, path)
  return normalized
}

function referenceList(value, path) {
  if (value === undefined) return undefined
  if (value === null) return []
  if (!Array.isArray(value)) fail('INVALID_REFERENCE_LIST', `${path} must be an array`, path)
  return value.map((item, index) => safeReference(item, `${path}[${index}]`, { required: true }))
}

function assertOperationId(value, path = 'id') {
  const normalized = safeReference(value, path, { required: true })
  if (normalized !== normalized.toLowerCase() || value.trim() !== normalized) {
    fail('OPERATION_ID_INVALID', 'new operation ids must already be normalized lowercase identifiers', path, { id: value })
  }
  return normalized
}

function assertKitId(value, path = 'id') {
  const normalized = safeReference(value, path, { required: true })
  if (normalized !== normalized.toLowerCase() || value.trim() !== normalized) {
    fail('KIT_ID_INVALID', 'new kit ids must already be normalized lowercase identifiers', path, { id: value })
  }
  return normalized
}

function assertMethod(value) {
  stringField(value, 'method', { required: true, max: 16 })
  const method = normalizeMethod(value)
  if (!SUPPORTED_METHODS.includes(method)) {
    fail('OPERATION_METHOD_UNSUPPORTED', 'method must be one of the supported HTTP methods', 'method', { method: value })
  }
  return method
}

function assertPath(value) {
  stringField(value, 'path', { required: true, max: 2048 })
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(value.trim()) || value.trim().startsWith('//')) {
    fail('OPERATION_PATH_INVALID', 'operation path must be relative and must not contain a host', 'path')
  }
  if (/[?#]/.test(value) || !value.trim().startsWith('/')) {
    fail('OPERATION_PATH_INVALID', 'operation path must start with / and must not contain query or fragment text', 'path')
  }
  return normalizePath(value)
}

function validateSchemaValue(value, path) {
  if (value === undefined || value === null) return
  if (typeof value !== 'object' && typeof value !== 'boolean') fail('SCHEMA_INVALID', `${path} must be a JSON Schema value`, path)
  try { normalizeJsonValue(value) } catch (cause) { fail('SCHEMA_INVALID', `${path} exceeds the supported schema limits`, path, { cause: String(cause?.message || cause) }) }
}

function validateParameters(value, path = 'parameters') {
  if (value === null || value === undefined) return
  if (!Array.isArray(value)) fail('PARAMETERS_INVALID', `${path} must be an array`, path)
  const seen = new Set()
  for (const [index, item] of value.entries()) {
    const parameter = plainObject(item, `${path}[${index}]`, 'PARAMETER_INVALID')
    stringField(parameter.name ?? parameter.key, `${path}[${index}].name`, { required: true, max: 256 })
    const rawLocation = parameter.in ?? parameter.location
    stringField(rawLocation, `${path}[${index}].in`, { required: true, max: 32 })
    const location = normalizeParameterLocation(rawLocation)
    if (!ALLOWED_PARAMETER_LOCATIONS.has(location) || rawLocation.trim() !== location) {
      fail('PARAMETER_LOCATION_UNSUPPORTED', 'only path, query, header and cookie parameters are supported', `${path}[${index}].in`, { location: rawLocation })
    }
    const name = normalizeParameterName(parameter.name ?? parameter.key)
    if (!name) fail('PARAMETER_NAME_INVALID', 'parameter name must not be empty', `${path}[${index}].name`)
    const key = `${location}:${name.toLowerCase()}`
    if (seen.has(key)) fail('DUPLICATE_PARAMETER', 'parameter location/name must be unique', `${path}[${index}]`, { name, in: location })
    seen.add(key)
    booleanField(parameter.required, `${path}[${index}].required`)
    if (location === 'path' && parameter.required !== true) {
      fail('PATH_PARAMETER_INVALID', 'path parameters must be required', `${path}[${index}].required`, { name })
    }
    if (location === 'header' && CONTROLLED_HEADERS.has(name.toLowerCase())) {
      fail('CONTROLLED_HEADER', 'controlled headers cannot be declared as business parameters', `${path}[${index}].name`, { name })
    }
    stringField(parameter.description, `${path}[${index}].description`, { max: 4000 })
    booleanField(parameter.deprecated, `${path}[${index}].deprecated`)
    booleanField(parameter.allowEmptyValue, `${path}[${index}].allowEmptyValue`)
    validateSchemaValue(parameter.schema, `${path}[${index}].schema`)
    if (Object.hasOwn(parameter, 'example')) validateSchemaValue(parameter.example, `${path}[${index}].example`)
  }
}

function validateRequestBody(value) {
  if (value === undefined || value === null) return
  const body = plainObject(value, 'requestBody', 'REQUEST_BODY_INVALID')
  booleanField(body.required, 'requestBody.required')
  if (body.contentTypes !== undefined) {
    if (!Array.isArray(body.contentTypes) || body.contentTypes.some((item) => typeof item !== 'string')) fail('REQUEST_BODY_INVALID', 'requestBody.contentTypes must be an array of strings', 'requestBody.contentTypes')
  }
  stringField(body.description, 'requestBody.description', { max: 4000 })
  validateSchemaValue(body.schema, 'requestBody.schema')
  if (Object.hasOwn(body, 'example')) validateSchemaValue(body.example, 'requestBody.example')
}

function validateResponses(value) {
  if (value === undefined || value === null) return
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(item?.status ?? 'default'), item, index])
    : Object.entries(plainObject(value, 'responses', 'RESPONSES_INVALID')).map(([status, response]) => [status, response, status])
  for (const [status, response, key] of entries) {
    if (!STATUS_PATTERN.test(status)) fail('RESPONSE_STATUS_INVALID', 'response status must be default or a 1xx-5xx status code', `responses.${key}`)
    const item = plainObject(response, `responses.${key}`, 'RESPONSE_INVALID')
    stringField(item.description, `responses.${key}.description`, { max: 4000 })
    if (item.contentTypes !== undefined && (!Array.isArray(item.contentTypes) || item.contentTypes.some((entry) => typeof entry !== 'string'))) fail('RESPONSES_INVALID', 'response contentTypes must be an array of strings', `responses.${key}.contentTypes`)
    validateSchemaValue(item.schema, `responses.${key}.schema`)
    if (Object.hasOwn(item, 'example')) validateSchemaValue(item.example, `responses.${key}.example`)
  }
}

function validatePolicy(value, method) {
  if (value === undefined || value === null) return
  const policy = plainObject(value, 'policy', 'OPERATION_POLICY_INVALID')
  for (const key of ['allowAgentCall', 'requiresConfirmation', 'allowWrite']) booleanField(policy[key], `policy.${key}`)
  if (policy.allowMethods !== undefined) {
    if (!Array.isArray(policy.allowMethods)) fail('OPERATION_POLICY_INVALID', 'policy.allowMethods must be an array', 'policy.allowMethods')
    for (const [index, item] of policy.allowMethods.entries()) {
      stringField(item, `policy.allowMethods[${index}]`, { required: true, max: 16 })
      const normalized = normalizeMethod(item)
      if (!SUPPORTED_METHODS.includes(normalized) || item.trim() !== normalized) fail('OPERATION_POLICY_INVALID', 'policy.allowMethods contains an unsupported method', `policy.allowMethods[${index}]`)
    }
    if (policy.allowMethods.length > 0 && !policy.allowMethods.includes(method)) fail('OPERATION_POLICY_INVALID', 'policy.allowMethods must include the operation method', 'policy.allowMethods', { method })
  }
  for (const key of ['timeoutMs', 'maxResponseBytes', 'maxResponseDepth', 'maxArrayItems', 'maxResponseStringLength', 'maxResponseKeys']) {
    if (policy[key] !== undefined && (!Number.isFinite(Number(policy[key])) || Number(policy[key]) < 0)) fail('OPERATION_POLICY_INVALID', `policy.${key} must be a finite non-negative number`, `policy.${key}`)
  }
  if (policy.redactKeys !== undefined && (!Array.isArray(policy.redactKeys) || policy.redactKeys.length > 100 || policy.redactKeys.some((key) => typeof key !== 'string' || !/^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/.test(key)))) {
    fail('OPERATION_POLICY_INVALID', 'policy.redactKeys must contain bounded field names', 'policy.redactKeys')
  }
  if (!READ_METHODS.includes(method) && policy.allowAgentCall === true && policy.allowWrite !== true) {
    fail('OPERATION_POLICY_INVALID', 'write operations require policy.allowWrite before Agent access can be enabled', 'policy.allowWrite')
  }
}

function validateRegistryReference(registry, collection, id, path, code) {
  if (id === undefined || id === '') return
  if (registry && !(registry[collection] ?? []).some((item) => item.id === id)) fail(code, `${path} references a missing ${collection.slice(0, -1)}`, path, { id })
}

export function validateOperationInput(input, options = {}) {
  const value = plainObject(input, 'operation')
  const hasId = Object.hasOwn(value, 'id') && value.id !== undefined
  if (hasId) assertOperationId(value.id)
  if (Object.hasOwn(value, 'operationId') && value.operationId !== undefined) {
    stringField(value.operationId, 'operationId', { required: true, max: 128 })
    if (!identifier(value.operationId, '')) fail('OPERATION_ID_INVALID', 'operationId must be a safe identifier', 'operationId')
  }
  const method = assertMethod(value.method)
  const path = assertPath(value.path)
  booleanField(value.enabled, 'enabled')
  stringField(value.name, 'name', { max: 120 })
  stringField(value.summary, 'summary', { max: 120 })
  stringField(value.description, 'description', { max: 4000 })
  stringField(value.source, 'source', { max: 120 })
  stringField(value.sourceKey, 'sourceKey', { max: 512 })
  if (value.tags !== undefined && value.tags !== null && (!Array.isArray(value.tags) || value.tags.some((tag) => typeof tag !== 'string'))) fail('INVALID_TAGS', 'tags must be an array of strings', 'tags')
  validateParameters(value.parameters)
  validateRequestBody(value.requestBody)
  validateResponses(value.responses)
  if (value.security !== undefined && value.security !== null && (!Array.isArray(value.security) || value.security.some((entry) => typeof entry !== 'string'))) fail('INVALID_SECURITY', 'security must be an array of strings', 'security')
  const targetId = safeReference(value.serviceTargetId ?? value.targetId, 'serviceTargetId', { required: true })
  const authProfileId = safeReference(value.authProfileId, 'authProfileId')
  const kitIds = referenceList(value.kitIds ?? value.kits, 'kitIds')
  validatePolicy(value.policy, method)
  validateRegistryReference(options.registry, 'serviceTargets', targetId, 'serviceTargetId', 'DANGLING_TARGET')
  validateRegistryReference(options.registry, 'authProfiles', authProfileId, 'authProfileId', 'DANGLING_AUTH_PROFILE')
  for (const [index, id] of (kitIds ?? []).entries()) validateRegistryReference(options.registry, 'kits', id, `kitIds[${index}]`, 'DANGLING_KIT')
  let normalized
  try { normalized = normalizeOperation({ ...value, id: hasId ? value.id : undefined, serviceTargetId: targetId, authProfileId, kitIds }) } catch (cause) { fail('OPERATION_INVALID', 'operation could not be normalized safely', 'operation', { cause: String(cause?.message || cause) }) }
  if (!normalized.id) fail('OPERATION_ID_INVALID', 'operation id could not be generated safely', 'id')
  if (hasId && normalized.id !== value.id.trim()) fail('OPERATION_ID_INVALID', 'operation id must match its normalized value', 'id', { id: value.id })
  if (!normalized.parameters.filter((item) => item.in === 'path').every((item) => item.required === true)) fail('PATH_PARAMETER_INVALID', 'all path parameters must be required', 'parameters')
  const templateNames = new Set(extractPathNames(path))
  for (const parameter of normalized.parameters.filter((item) => item.in === 'path')) if (!templateNames.has(parameter.name)) fail('PATH_PARAMETER_INVALID', 'path parameter is not present in the path template', 'parameters', { name: parameter.name })
  for (const name of templateNames) if (!normalized.parameters.some((parameter) => parameter.in === 'path' && parameter.name === name)) fail('PATH_PARAMETER_INVALID', 'path template parameter must be declared', 'parameters', { name })
  if (isRecord(value.extensions)) validateSchemaValue(value.extensions, 'extensions')
  return Object.freeze(normalized)
}

export function validateOperationPatch(id, patch, current, options = {}) {
  const currentValue = plainObject(current, 'current')
  const updateId = safeReference(id, 'id', { required: true })
  if (currentValue.id !== updateId) fail('OPERATION_NOT_FOUND', 'operation identity does not match the requested id', 'id')
  const changes = plainObject(patch, 'patch', 'OPERATION_PATCH_INVALID')
  if (Object.hasOwn(changes, 'id') && changes.id !== undefined && changes.id !== updateId) fail('OPERATION_ID_IMMUTABLE', 'operation id cannot be changed', 'id')
  const merged = mergePatch(currentValue, changes, CLEARABLE_OPERATION_FIELDS, 'policy')
  if (Object.hasOwn(changes, 'kits') && !Object.hasOwn(changes, 'kitIds')) merged.kitIds = changes.kits
  merged.id = updateId
  return validateOperationInput(merged, options)
}

export function validateKitInput(input, registry, options = {}) {
  const value = plainObject(input, 'kit')
  const hasId = Object.hasOwn(value, 'id') && value.id !== undefined
  if (hasId) assertKitId(value.id)
  stringField(value.name, 'name', { max: 120 })
  stringField(value.description, 'description', { max: 4000 })
  stringField(value.project, 'project', { max: 120 })
  booleanField(value.enabled, 'enabled')
  booleanField(value.agentEnabled, 'agentEnabled')
  for (const field of ['operationIds', 'serviceTargetIds', 'environmentIds']) referenceList(value[field] ?? (field === 'operationIds' ? value.operations : field === 'serviceTargetIds' ? value.targets : value.environments), field)
  for (const [index, id] of (referenceList(value.operationIds ?? value.operations, 'operationIds') ?? []).entries()) validateRegistryReference(registry, 'operations', id, `operationIds[${index}]`, 'DANGLING_OPERATION')
  for (const [index, id] of (referenceList(value.serviceTargetIds ?? value.targets, 'serviceTargetIds') ?? []).entries()) validateRegistryReference(registry, 'serviceTargets', id, `serviceTargetIds[${index}]`, 'DANGLING_TARGET')
  for (const [index, id] of (referenceList(value.environmentIds ?? value.environments, 'environmentIds') ?? []).entries()) validateRegistryReference(registry, 'environments', id, `environmentIds[${index}]`, 'DANGLING_ENVIRONMENT')
  const defaultEnvironmentId = safeReference(value.defaultEnvironmentId, 'defaultEnvironmentId')
  const environmentIds = referenceList(value.environmentIds ?? value.environments, 'environmentIds') ?? []
  if (defaultEnvironmentId && !environmentIds.includes(defaultEnvironmentId)) fail('DEFAULT_ENVIRONMENT_NOT_BOUND', 'defaultEnvironmentId must belong to environmentIds', 'defaultEnvironmentId')
  if (value.tags !== undefined && value.tags !== null && (!Array.isArray(value.tags) || value.tags.some((tag) => typeof tag !== 'string'))) fail('INVALID_TAGS', 'tags must be an array of strings', 'tags')
  validateKitPolicy(value.policy)
  const operationPolicies = value.operationPolicies ?? value.operationPolicy
  if (operationPolicies !== undefined && operationPolicies !== null) {
    plainObject(operationPolicies, 'operationPolicies', 'KIT_OPERATION_POLICY_INVALID')
    const operationIds = new Set(referenceList(value.operationIds ?? value.operations, 'operationIds') ?? [])
    for (const [id, policy] of Object.entries(operationPolicies)) {
      if (!operationIds.has(identifier(id, ''))) fail('KIT_OPERATION_POLICY_INVALID', 'operationPolicies may only target operations in this kit', `operationPolicies.${id}`)
      validatePolicy(policy, registry?.operations?.find((operation) => operation.id === identifier(id, ''))?.method ?? 'GET')
    }
  }
  let normalized
  try { normalized = normalizeKit({ ...value, id: hasId ? value.id : undefined, defaultEnvironmentId, operationIds: referenceList(value.operationIds ?? value.operations, 'operationIds') ?? [], serviceTargetIds: referenceList(value.serviceTargetIds ?? value.targets, 'serviceTargetIds') ?? [], environmentIds }) } catch (cause) { fail('KIT_INVALID', 'kit could not be normalized safely', 'kit', { cause: String(cause?.message || cause) }) }
  if (hasId && normalized.id !== value.id.trim()) fail('KIT_ID_INVALID', 'kit id must match its normalized value', 'id')
  return Object.freeze(normalized)
}

export function validateKitPatch(id, patch, current, registry, options = {}) {
  const updateId = safeReference(id, 'id', { required: true })
  if (current?.id !== updateId) fail('KIT_NOT_FOUND', 'kit identity does not match the requested id', 'id')
  const changes = plainObject(patch, 'patch', 'KIT_PATCH_INVALID')
  if (Object.hasOwn(changes, 'id') && changes.id !== undefined && changes.id !== updateId) fail('KIT_ID_IMMUTABLE', 'kit id cannot be changed', 'id')
  const merged = mergePatch(current, changes, CLEARABLE_KIT_FIELDS, 'policy')
  if (Object.hasOwn(changes, 'operations') && !Object.hasOwn(changes, 'operationIds')) merged.operationIds = changes.operations
  if (Object.hasOwn(changes, 'targets') && !Object.hasOwn(changes, 'serviceTargetIds')) merged.serviceTargetIds = changes.targets
  if (Object.hasOwn(changes, 'environments') && !Object.hasOwn(changes, 'environmentIds')) merged.environmentIds = changes.environments
  merged.id = updateId
  return validateKitInput(merged, registry, options)
}

function validateKitPolicy(value) {
  if (value === undefined || value === null) return
  const policy = plainObject(value, 'policy', 'KIT_POLICY_INVALID')
  for (const key of ['allowWrite', 'requiresConfirmation']) booleanField(policy[key], `policy.${key}`)
  if (policy.allowReadMethods !== undefined && (!Array.isArray(policy.allowReadMethods) || policy.allowReadMethods.some((method) => !READ_METHODS.includes(normalizeMethod(method))))) fail('KIT_POLICY_INVALID', 'policy.allowReadMethods must contain GET or HEAD', 'policy.allowReadMethods')
  if (policy.allowWriteMethods !== undefined && (!Array.isArray(policy.allowWriteMethods) || policy.allowWriteMethods.some((method) => !WRITE_METHODS.includes(normalizeMethod(method))))) fail('KIT_POLICY_INVALID', 'policy.allowWriteMethods must contain write methods', 'policy.allowWriteMethods')
}

function mergePatch(current, patch, clearable, nestedKey) {
  const merged = Object.create(null)
  for (const [key, value] of Object.entries(current)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue
    merged[key] = value
  }
  for (const [key, value] of Object.entries(patch)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor' || value === undefined) continue
    if (value === null && clearable.has(key)) {
      if (key === 'requestBody') merged[key] = null
      else if (key === nestedKey || key === 'operationPolicies') merged[key] = {}
      else merged[key] = []
      continue
    }
    if (key === nestedKey && isRecord(value)) merged[key] = { ...(isRecord(current[key]) ? current[key] : {}), ...value }
    else merged[key] = value
  }
  return merged
}

function extractPathNames(path) {
  const names = []
  const seen = new Set()
  const matcher = /\{([^{}]+)\}/g
  let match
  while ((match = matcher.exec(path)) !== null) {
    const name = normalizeParameterName(match[1])
    if (name && !seen.has(name)) { seen.add(name); names.push(name) }
  }
  return names
}

export function reconcileRegistryLinks(registry) {
  const warnings = []
  const operations = Array.isArray(registry?.operations) ? registry.operations : []
  const operationById = new Map(operations.map((operation) => [operation.id, operation]))
  const expected = new Map(operations.map((operation) => [operation.id, []]))
  for (const [kitIndex, kit] of (Array.isArray(registry?.kits) ? registry.kits.entries() : [])) {
    const nextIds = []
    const seen = new Set()
    for (const operationId of Array.isArray(kit.operationIds) ? kit.operationIds : []) {
      if (seen.has(operationId)) {
        warnings.push({ code: 'DUPLICATE_KIT_OPERATION', path: `kits[${kitIndex}].operationIds`, id: operationId })
        continue
      }
      seen.add(operationId)
      if (!operationById.has(operationId)) {
        warnings.push({ code: 'DANGLING_OPERATION', path: `kits[${kitIndex}].operationIds`, id: operationId })
        continue
      }
      nextIds.push(operationId)
      expected.get(operationId).push(kit.id)
    }
    if (!sameList(kit.operationIds, nextIds)) warnings.push({ code: 'KIT_OPERATION_LINK_RECONCILED', path: `kits[${kitIndex}].operationIds`, id: kit.id })
    kit.operationIds = nextIds
    if (isRecord(kit.operationPolicies)) {
      const policies = {}
      for (const operationId of nextIds) if (Object.hasOwn(kit.operationPolicies, operationId)) policies[operationId] = kit.operationPolicies[operationId]
      kit.operationPolicies = policies
    }
  }
  for (const [index, operation] of operations.entries()) {
    const nextIds = expected.get(operation.id) ?? []
    if (!sameList(operation.kitIds, nextIds)) warnings.push({ code: 'OPERATION_KIT_LINK_RECONCILED', path: `operations[${index}].kitIds`, id: operation.id })
    operation.kitIds = nextIds
  }
  return { registry, warnings }
}

function sameList(left, right) {
  return Array.isArray(left) && left.length === right.length && left.every((item, index) => item === right[index])
}

function sanitizeSensitive(value, depth = 0) {
  if (depth > 12) return '[Truncated]'
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => sanitizeSensitive(item, depth + 1))
  if (!isRecord(value)) return value
  const result = {}
  for (const [key, child] of Object.entries(value).slice(0, 2000)) result[key] = SECRET_KEY.test(key) ? '[REDACTED]' : sanitizeSensitive(child, depth + 1)
  return result
}

function safeParameter(parameter) {
  return {
    name: parameter.name,
    in: parameter.in,
    required: parameter.required === true,
    description: parameter.description || '',
    schema: sanitizeSensitive(parameter.schema),
    ...(parameter.example === undefined ? {} : { example: sanitizeSensitive(parameter.example) }),
    deprecated: parameter.deprecated === true,
    allowEmptyValue: parameter.allowEmptyValue === true,
  }
}

function safeRequestBody(body) {
  if (body === null) return null
  if (!body) return { required: false, contentTypes: [], schema: {}, description: '' }
  return {
    required: body.required === true,
    contentTypes: Array.isArray(body.contentTypes) ? [...body.contentTypes] : [],
    schema: sanitizeSensitive(body.schema),
    ...(body.example === undefined ? {} : { example: sanitizeSensitive(body.example) }),
    description: body.description || '',
  }
}

function safeResponses(responses) {
  return (Array.isArray(responses) ? responses : []).map((response) => ({
    status: response.status,
    description: response.description || '',
    contentTypes: Array.isArray(response.contentTypes) ? [...response.contentTypes] : [],
    schema: sanitizeSensitive(response.schema),
    ...(response.example === undefined ? {} : { example: sanitizeSensitive(response.example) }),
  }))
}

export function safeOperationListView(operation, context = {}) {
  const normalized = normalizeOperation(operation)
  const target = context.serviceTargets?.find((item) => item.id === normalized.serviceTargetId)
  return {
    id: normalized.id,
    operationId: normalized.operationId,
    name: normalized.name,
    summary: normalized.summary,
    description: normalized.description,
    method: normalized.method,
    path: normalized.path,
    tags: [...normalized.tags],
    serviceTargetId: normalized.serviceTargetId,
    ...(target ? { serviceTargetName: target.name } : {}),
    authProfileId: normalized.authProfileId,
    enabled: normalized.enabled,
    kitIds: [...normalized.kitIds],
    requiredParameters: normalized.parameters.filter((parameter) => parameter.required).map((parameter) => ({ name: parameter.name, in: parameter.in, schema: sanitizeSensitive(parameter.schema) })),
    policy: { allowAgentCall: normalized.policy.allowAgentCall, allowWrite: normalized.policy.allowWrite, requiresConfirmation: normalized.policy.requiresConfirmation, maxResponseDepth: normalized.policy.maxResponseDepth, maxArrayItems: normalized.policy.maxArrayItems, maxResponseStringLength: normalized.policy.maxResponseStringLength, maxResponseKeys: normalized.policy.maxResponseKeys, redactKeys: [...normalized.policy.redactKeys] },
  }
}

export function safeOperationView(operation, context = {}) {
  const normalized = normalizeOperation(operation)
  return {
    ...safeOperationListView(normalized, context),
    description: normalized.description,
    parameters: normalized.parameters.map(safeParameter),
    requestBody: safeRequestBody(normalized.requestBody),
    responses: safeResponses(normalized.responses),
    security: [...normalized.security],
    policy: { ...normalized.policy },
    source: normalized.source,
    sourceKey: normalized.sourceKey,
    extensions: sanitizeSensitive(normalized.extensions),
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
  }
}

export function safeKitListView(kit, context = {}) {
  const normalized = normalizeKit(kit)
  const operations = (context.operations ?? []).filter((operation) => normalized.operationIds.includes(operation.id))
  const targets = (context.serviceTargets ?? []).filter((target) => normalized.serviceTargetIds.includes(target.id))
  const environments = (context.environments ?? []).filter((environment) => normalized.environmentIds.includes(environment.id))
  return {
    id: normalized.id,
    name: normalized.name,
    description: normalized.description,
    project: normalized.project,
    tags: [...normalized.tags],
    operationIds: [...normalized.operationIds],
    operationCount: normalized.operationIds.length,
    enabledOperationCount: operations.filter((operation) => operation.enabled !== false).length,
    readOperationCount: operations.filter((operation) => READ_METHODS.includes(operation.method)).length,
    writeOperationCount: operations.filter((operation) => WRITE_METHODS.includes(operation.method)).length,
    serviceTargetIds: [...normalized.serviceTargetIds],
    serviceTargetNames: targets.map((target) => target.name),
    environmentIds: [...normalized.environmentIds],
    environmentNames: environments.map((environment) => environment.name),
    defaultEnvironmentId: normalized.defaultEnvironmentId,
    enabled: normalized.enabled,
    agentEnabled: normalized.agentEnabled,
    policy: { ...normalized.policy },
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
  }
}

export function safeKitView(kit, context = {}) {
  const normalized = normalizeKit(kit)
  return {
    ...safeKitListView(normalized, context),
    operationPolicies: sanitizeSensitive(normalized.operationPolicies),
    operations: (context.operations ?? []).filter((operation) => normalized.operationIds.includes(operation.id)).map((operation) => safeOperationListView(operation, context)),
  }
}

export function assertReadOnlyOperationView(value) {
  assertNoForbiddenKeys(value, 'operation')
  return value
}

export function assertReadOnlyKitView(value) {
  assertNoForbiddenKeys(value, 'kit')
  return value
}

function assertNoForbiddenKeys(value, subject, path = subject, seen = new Set()) {
  if (value === null || typeof value !== 'object') return
  if (seen.has(value)) fail('SECRET_LEAK', `${subject} view contains a cycle`, path)
  seen.add(value)
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_VIEW_KEYS.has(key.toLowerCase()) && child !== '[REDACTED]') fail('SECRET_LEAK', `${subject} view contains a forbidden field`, `${path}.${key}`)
    assertNoForbiddenKeys(child, subject, `${path}.${key}`, seen)
  }
  seen.delete(value)
}

export { ALLOWED_PARAMETER_LOCATIONS, STATUS_PATTERN }
