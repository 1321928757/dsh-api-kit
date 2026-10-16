/**
 * Bounded, DSH-independent OpenAPI JSON importer and preview builder.
 *
 * This module never reads files, contacts a network, creates Registry entities,
 * or resolves credentials. It translates an in-memory OpenAPI 3.0/3.1 or
 * Swagger 2.0 document into safe Operation candidates for a later, explicit
 * T12 confirmation/import transaction.
 */

import {
  READ_METHODS,
  SUPPORTED_METHODS,
  stableOperationId,
  stableOperationKey,
  normalizeOperation,
} from './model.js'
import {
  identifier,
  isRecord,
  normalizeJsonSchema,
  normalizeJsonValue,
  normalizeMethod,
  normalizePath,
  lowercaseIdentifier,
  text,
} from './normalizers.js'
import { validateOperationInput } from './operation-validation.js'
import { CONTROLLED_HEADERS } from './config-validation.js'

export const OPENAPI_IMPORT_LIMITS = Object.freeze({
  maxDocumentBytes: 1024 * 1024,
  maxDocumentDepth: 16,
  maxDocumentKeys: 10000,
  maxDocumentArray: 1000,
  maxDocumentString: 12000,
  maxRefCount: 1000,
  maxRefDepth: 32,
  maxServers: 50,
  maxSecuritySchemes: 50,
  maxPaths: 10000,
  maxOperations: 10000,
  maxParameters: 100,
  maxResponses: 100,
  maxIssues: 1000,
})

export const OPENAPI_METHOD_ORDER = Object.freeze([
  'GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS',
])

const PATH_ITEM_KEYS = new Set([
  '$ref', 'summary', 'description', 'servers', 'parameters',
  ...OPENAPI_METHOD_ORDER.map((method) => method.toLowerCase()),
])
const SECRET_KEY = /(?:authorization|cookie|pass(?:word|wd)?|secret|token|api[-_]?key|client[-_]?secret|private[-_]?key|access[-_]?key|credential|session)/i
const FORBIDDEN_AUTH_NAME = /^(?:authorization|cookie|host|content-length|connection|transfer-encoding|proxy-authorization|proxy-authenticate)$/i
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/
const HTTP_PROTOCOLS = new Set(['http:', 'https:'])
const STATUS_PATTERN = /^(?:default|[1-5][0-9]{2})$/
const JSON_MEDIA = /^application\/(?:json|[^;]+\+json)$/i
const RESERVED_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const FATAL_CODES = new Set([
  'DOCUMENT_ROOT_INVALID', 'DOCUMENT_JSON_INVALID', 'DOCUMENT_TOO_LARGE', 'OPENAPI_VERSION_UNSUPPORTED',
  'PATHS_INVALID', 'PATH_ITEM_INVALID', 'OPERATION_PATH_INVALID', 'REF_INVALID', 'REF_NOT_FOUND',
  'EXTERNAL_REF_UNSUPPORTED', 'REF_CYCLE', 'REF_DEPTH_EXCEEDED', 'REF_LIMIT_EXCEEDED',
  'SERVER_INVALID', 'SERVERS_INVALID', 'UNSUPPORTED_METHOD', 'OPERATION_LIMIT_EXCEEDED', 'PATH_LIMIT_EXCEEDED',
])

function issue(code, message, path = '', detail) {
  return {
    code,
    message,
    ...(path ? { path } : {}),
    ...(detail === undefined ? {} : { detail }),
  }
}

function capIssues(list, additions, limit = OPENAPI_IMPORT_LIMITS.maxIssues) {
  for (const value of additions ?? []) {
    if (list.length >= limit) break
    if (!value || typeof value.code !== 'string') continue
    list.push({
      code: value.code,
      message: typeof value.message === 'string' ? value.message : 'Import issue',
      ...(typeof value.path === 'string' && value.path ? { path: value.path } : {}),
      ...(value.detail === undefined ? {} : { detail: safeValue(value.detail) }),
    })
  }
  return list
}

function safeValue(value, depth = 0, state = { keys: 0 }, redactSensitive = true) {
  if (depth > 12) return '[Truncated]'
  if (value === null || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string') return value.replace(CONTROL_CHARS, ' ').slice(0, 12000)
  if (typeof value !== 'object') return undefined
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => safeValue(item, depth + 1, state, redactSensitive))
  const result = {}
  for (const [key, child] of Object.entries(value).slice(0, 2000)) {
    if (RESERVED_KEYS.has(key)) continue
    state.keys += 1
    if (state.keys > 2000) break
    if (key === 'schema') {
      result[key.slice(0, 256)] = safeSchema(child)
      continue
    }
    const childRedaction = redactSensitive
    result[key.slice(0, 256)] = redactSensitive && SECRET_KEY.test(key) ? '[REDACTED]' : safeValue(child, depth + 1, state, childRedaction)
  }
  return result
}

function safeSchema(value, depth = 0, state = { keys: 0 }) {
  if (depth > 12) return '[Truncated]'
  if (value === null || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string') return value.replace(CONTROL_CHARS, ' ').slice(0, 12000)
  if (!value || typeof value !== 'object') return undefined
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => safeSchema(item, depth + 1, state))
  const result = {}
  for (const [key, child] of Object.entries(value).slice(0, 2000)) {
    if (RESERVED_KEYS.has(key)) continue
    state.keys += 1
    if (state.keys > 2000) break
    const lower = key.toLowerCase()
    if (['default', 'example', 'examples', 'const', 'enum'].includes(lower)) {
      result[key.slice(0, 256)] = '[REDACTED]'
    } else if (lower === 'properties' && isRecord(child)) {
      const properties = {}
      for (const [propertyName, propertySchema] of Object.entries(child).slice(0, 2000)) {
        properties[propertyName.slice(0, 256)] = safeSchema(propertySchema, depth + 1, state)
      }
      result.properties = properties
    } else {
      result[key.slice(0, 256)] = safeSchema(child, depth + 1, state)
    }
  }
  return result
}

function byteLength(value) {
  try {
    return new TextEncoder().encode(value).byteLength
  } catch {
    return value.length
  }
}

function containsNonFinite(value, seen = new WeakSet(), depth = 0) {
  if (typeof value === 'number') return !Number.isFinite(value)
  if (!value || typeof value !== 'object') return false
  if (seen.has(value) || depth > OPENAPI_IMPORT_LIMITS.maxDocumentDepth + 1) return false
  seen.add(value)
  if (Array.isArray(value)) return value.some((item) => containsNonFinite(item, seen, depth + 1))
  return Object.values(value).some((item) => containsNonFinite(item, seen, depth + 1))
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}

function hashText(value) {
  // FNV-1a is sufficient here: this is a deterministic source identity, not a
  // security primitive. Keeping it local avoids a crypto/runtime dependency.
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function cloneJson(value) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

function issueCodes(list) {
  return new Set((list ?? []).map((item) => item.code))
}

function limitsFor(options = {}) {
  const result = { ...OPENAPI_IMPORT_LIMITS }
  for (const key of Object.keys(result)) {
    const value = Number(options?.limits?.[key] ?? options?.[key])
    if (Number.isFinite(value) && value > 0) result[key] = Math.floor(value)
  }
  return result
}

function versionInfo(document) {
  if (!isRecord(document)) return undefined
  const hasOpenApi = typeof document.openapi === 'string'
  const hasSwagger = typeof document.swagger === 'string'
  if (hasOpenApi && hasSwagger) return undefined
  if (hasOpenApi) {
    const match = document.openapi.trim().match(/^3\.(0|1)(?:\.\d+)?$/)
    if (!match) return undefined
    const minor = match[1]
    return { format: 'openapi', version: `3.${minor}`, source: `openapi-3.${minor}` }
  }
  if (hasSwagger && document.swagger.trim() === '2.0') {
    return { format: 'swagger', version: '2.0', source: 'swagger-2.0' }
  }
  return undefined
}

/**
 * Detect the supported OpenAPI family. The result is metadata rather than the
 * original document so callers cannot accidentally expose it to a model.
 */
export function detectOpenApiVersion(document) {
  const detected = versionInfo(document)
  return detected ? { ok: true, ...detected } : {
    ok: false,
    error: issue('OPENAPI_VERSION_UNSUPPORTED', 'Only OpenAPI 3.0/3.1 and Swagger 2.0 JSON documents are supported', 'openapi'),
  }
}

function normalizeDocument(input, limits) {
  let document = input
  if (typeof input === 'string') {
    if (byteLength(input) > limits.maxDocumentBytes) {
      return { ok: false, errors: [issue('DOCUMENT_TOO_LARGE', 'OpenAPI JSON exceeds the maximum document size', '')] }
    }
    try {
      document = JSON.parse(input)
    } catch {
      return { ok: false, errors: [issue('JSON_PARSE', 'OpenAPI input is not valid JSON', '')] }
    }
  }
  if (!isRecord(document)) {
    return { ok: false, errors: [issue('DOCUMENT_ROOT_INVALID', 'OpenAPI document must be a JSON object', '')] }
  }
  if (containsNonFinite(document)) {
    return { ok: false, errors: [issue('DOCUMENT_JSON_INVALID', 'OpenAPI document contains a non-finite number', '')] }
  }
  let bounded
  try {
    bounded = normalizeJsonValue(document, {
      maxDepth: limits.maxDocumentDepth,
      maxKeys: limits.maxDocumentKeys,
      maxArray: limits.maxDocumentArray,
      maxString: limits.maxDocumentString,
      maxBytes: limits.maxDocumentBytes,
    })
    const encoded = JSON.stringify(bounded)
    if (encoded && byteLength(encoded) > limits.maxDocumentBytes) throw new Error('document too large')
  } catch {
    return { ok: false, errors: [issue('DOCUMENT_TOO_LARGE', 'OpenAPI document exceeds supported JSON bounds', '')] }
  }
  const detected = versionInfo(bounded)
  if (!detected) {
    return { ok: false, document: bounded, errors: [issue('OPENAPI_VERSION_UNSUPPORTED', 'Only OpenAPI 3.0/3.1 and Swagger 2.0 JSON documents are supported', 'openapi')] }
  }
  if (!isRecord(bounded.paths)) {
    return { ok: false, document: bounded, ...detected, errors: [issue('PATHS_INVALID', 'OpenAPI paths must be an object', 'paths')] }
  }
  return { ok: true, document: bounded, ...detected, errors: [] }
}

/** Parse, bound, and validate an OpenAPI JSON string or object. */
export function parseOpenApiJson(input, options = {}) {
  const limits = limitsFor(options)
  const parsed = normalizeDocument(input, limits)
  if (!parsed.ok) return { ...parsed, warnings: [] }
  const info = isRecord(parsed.document.info) ? parsed.document.info : {}
  return {
    ...parsed,
    documentMeta: buildDocumentMeta(parsed.document, parsed, options),
    warnings: [],
  }
}

function buildDocumentMeta(document, detected, options = {}) {
  const sourceIdentity = typeof options.sourceId === 'string' && options.sourceId.trim()
    ? identifier(options.sourceId, '')
    : ''
  const fingerprint = hashText(stableStringify(document))
  const documentId = sourceIdentity || `openapi-${fingerprint}`
  const info = isRecord(document.info) ? document.info : {}
  return {
    documentId,
    fingerprint,
    format: detected.format,
    version: detected.version,
    title: text(info.title, 240, 'Untitled OpenAPI document'),
    documentVersion: text(info.version, 120, ''),
    description: text(info.description, 4000, ''),
  }
}

class ImportFailure extends Error {
  constructor(code, message, path = '', detail) {
    super(message)
    this.code = code
    this.path = path
    this.detail = detail
  }
}

function fail(code, message, path, detail) {
  throw new ImportFailure(code, message, path, detail)
}

function pointerSegments(ref) {
  if (typeof ref !== 'string' || !ref) fail('REF_INVALID', 'OpenAPI $ref must be a non-empty string', '$ref')
  if (!ref.startsWith('#/')) {
    if (ref.startsWith('#')) fail('REF_INVALID', 'Only non-empty local JSON Pointer references are supported', '$ref')
    fail('EXTERNAL_REF_UNSUPPORTED', 'External OpenAPI references are not supported', '$ref')
  }
  const raw = ref.slice(2).split('/')
  return raw.map((segment) => {
    if (/~(?![01])/.test(segment)) fail('REF_INVALID', 'OpenAPI $ref contains an invalid JSON Pointer escape', '$ref')
    return segment.replace(/~1/g, '/').replace(/~0/g, '~')
  })
}

class LocalResolver {
  constructor(document, options = {}) {
    this.document = document
    this.version = options.version ?? versionInfo(document)?.version ?? '3.0'
    this.limits = limitsFor(options)
    this.refs = 0
    this.warnings = []
  }

  resolvePointer(ref) {
    const segments = pointerSegments(ref)
    let current = this.document
    for (const segment of segments) {
      if (!isRecord(current) && !Array.isArray(current)) fail('REF_NOT_FOUND', 'OpenAPI $ref target was not found', '$ref', { ref })
      if (Array.isArray(current) && !/^\d+$/.test(segment)) fail('REF_NOT_FOUND', 'OpenAPI $ref target was not found', '$ref', { ref })
      if (!Object.hasOwn(current, segment)) fail('REF_NOT_FOUND', 'OpenAPI $ref target was not found', '$ref', { ref })
      current = current[segment]
    }
    return current
  }

  dereference(value, path = '', depth = 0, stack = []) {
    if (depth > this.limits.maxRefDepth) fail('REF_DEPTH_EXCEEDED', 'OpenAPI $ref expansion exceeded the maximum depth', path)
    if (value === null || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.slice(0, this.limits.maxDocumentArray).map((item, index) => this.dereference(item, `${path}[${index}]`, depth + 1, stack))

    if (typeof value.$ref === 'string') {
      const ref = value.$ref
      if (stack.includes(ref)) fail('REF_CYCLE', 'OpenAPI $ref contains a cycle', path || '$ref', { ref })
      this.refs += 1
      if (this.refs > this.limits.maxRefCount) fail('REF_LIMIT_EXCEEDED', 'OpenAPI document uses too many $ref expansions', path)
      const target = this.resolvePointer(ref)
      const resolved = this.dereference(target, path, depth + 1, [...stack, ref])
      const siblings = Object.fromEntries(Object.entries(value).filter(([key]) => key !== '$ref' && !RESERVED_KEYS.has(key)))
      if (Object.keys(siblings).length === 0) return resolved
      if (this.version !== '3.1') {
        this.warnings.push(issue('REF_SIBLINGS_IGNORED', 'Sibling fields next to $ref are not merged for OpenAPI 3.0/Swagger 2.0', path, { ref }))
        return resolved
      }
      if (!isRecord(resolved)) return resolved
      return this.dereference({ ...resolved, ...siblings }, path, depth + 1, stack)
    }

    const result = {}
    for (const [key, child] of Object.entries(value).slice(0, this.limits.maxDocumentKeys)) {
      if (RESERVED_KEYS.has(key)) continue
      result[key] = this.dereference(child, path ? `${path}.${key}` : key, depth + 1, stack)
    }
    return result
  }
}

/** Resolve one local RFC 6901 reference without any filesystem/network access. */
export function resolveOpenApiRef(document, ref, options = {}) {
  try {
    if (!isRecord(document)) fail('DOCUMENT_ROOT_INVALID', 'OpenAPI document must be an object', '')
    const resolver = new LocalResolver(document, options)
    const value = resolver.dereference({ $ref: ref }, '$ref')
    return { ok: true, value: safeValue(value), warnings: resolver.warnings }
  } catch (error) {
    return {
      ok: false,
      error: issue(error.code || 'REF_INVALID', error.message || 'OpenAPI $ref could not be resolved', error.path || '$ref', error.detail),
    }
  }
}

function resolved(resolver, value, path, issues) {
  try {
    return resolver.dereference(value, path)
  } catch (error) {
    capIssues(issues, [issue(error.code || 'REF_INVALID', error.message || 'OpenAPI reference could not be resolved', error.path || path, error.detail)])
    return undefined
  }
}

function sourcePath(path, method, suffix = '') {
  return `paths.${path}.${method.toLowerCase()}${suffix}`
}

function validateRelativePath(value, path) {
  if (typeof value !== 'string' || CONTROL_CHARS.test(value) || value.includes('\\') || !value.trim().startsWith('/') || /^[a-z][a-z\d+.-]*:\/\//i.test(value.trim()) || value.trim().startsWith('//') || /[?#]/.test(value)) {
    fail('OPERATION_PATH_INVALID', 'OpenAPI operation path must be a relative path without query or fragment text', path)
  }
  return normalizePath(value)
}

function pathTemplateNames(path) {
  const names = []
  const seen = new Set()
  const matcher = /\{([^{}]+)\}/g
  let match
  while ((match = matcher.exec(path)) !== null) {
    const name = match[1].trim()
    if (name && !seen.has(name)) {
      seen.add(name)
      names.push(name)
    }
  }
  return names
}

function chooseMedia(content) {
  if (!isRecord(content)) return { contentTypes: [], mediaType: '', media: undefined }
  const contentTypes = Object.keys(content).filter((key) => !CONTROL_CHARS.test(key)).slice(0, 20)
  const ordered = [...contentTypes].sort((left, right) => {
    const leftJson = JSON_MEDIA.test(left) ? 0 : 1
    const rightJson = JSON_MEDIA.test(right) ? 0 : 1
    return leftJson - rightJson || left.localeCompare(right)
  })
  const mediaType = ordered[0] || ''
  return { contentTypes, mediaType, media: mediaType ? content[mediaType] : undefined }
}

function isUploadMediaType(value) {
  return typeof value === 'string' && /^multipart\//i.test(value.trim())
}

function isValidSwaggerHost(value) {
  if (typeof value !== 'string') return false
  const host = value.trim()
  if (!host || CONTROL_CHARS.test(host) || /[\s\\/@?#]/.test(host)) return false
  try {
    const url = new URL(`http://${host}`)
    return url.hostname !== '' && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash
  } catch {
    return false
  }
}

function mediaSchema(media, resolver, path, issues) {
  if (!isRecord(media)) return undefined
  if (Object.hasOwn(media, 'schema')) {
    const value = resolved(resolver, media.schema, `${path}.schema`, issues)
    if (value === undefined) return undefined
    try { return safeValue(normalizeJsonSchema(value)) } catch { capIssues(issues, [issue('SCHEMA_TOO_LARGE', 'OpenAPI schema exceeds supported bounds', `${path}.schema`)]); return undefined }
  }
  return undefined
}

function mediaExample(media, resolver, path, issues) {
  if (!isRecord(media)) return undefined
  if (Object.hasOwn(media, 'example')) return safeValue(media.example)
  if (isRecord(media.examples)) {
    const key = Object.keys(media.examples).sort()[0]
    if (key) {
      const example = resolved(resolver, media.examples[key], `${path}.examples.${key}`, issues)
      if (isRecord(example) && Object.hasOwn(example, 'value')) return safeValue(example.value)
      return safeValue(example)
    }
  }
  return undefined
}

function schemaFromSwaggerParameter(parameter, path, issues, resolver) {
  if (Object.hasOwn(parameter, 'schema')) {
    const value = resolver ? resolved(resolver, parameter.schema, `${path}.schema`, issues) : parameter.schema
    if (value === undefined) return {}
    try { return safeValue(normalizeJsonSchema(value)) } catch { capIssues(issues, [issue('SCHEMA_TOO_LARGE', 'Swagger parameter schema exceeds supported bounds', `${path}.schema`)]); return {} }
  }
  const schema = {}
  for (const key of ['type', 'format', 'description', 'default', 'pattern', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minLength', 'maxLength', 'minItems', 'maxItems', 'uniqueItems', 'multipleOf']) {
    if (parameter[key] !== undefined) schema[key] = parameter[key]
  }
  if (Array.isArray(parameter.enum)) schema.enum = parameter.enum
  if (isRecord(parameter.items)) schema.items = parameter.items
  if (isRecord(parameter.properties)) schema.properties = parameter.properties
  if (parameter.type === 'array' && !schema.items) schema.items = { type: 'string' }
  if (!schema.type) schema.type = 'string'
  if (parameter.collectionFormat) schema['x-collectionFormat'] = text(parameter.collectionFormat, 32, '')
  try {
    const expanded = resolver ? resolved(resolver, schema, path, issues) : schema
    return safeValue(normalizeJsonSchema(expanded))
  } catch { capIssues(issues, [issue('SCHEMA_TOO_LARGE', 'Swagger parameter schema exceeds supported bounds', path)]); return {} }
}

function normalizeParameterEntry(raw, version, resolver, path, issues) {
  const parameter = resolved(resolver, raw, path, issues)
  if (!isRecord(parameter)) {
    capIssues(issues, [issue('PARAMETER_INVALID', 'OpenAPI parameter must be an object', path)])
    return undefined
  }
  const location = typeof parameter.in === 'string' ? parameter.in.trim().toLowerCase() : ''
  const name = typeof parameter.name === 'string' ? parameter.name.trim() : ''
  if (!name || !location) {
    capIssues(issues, [issue('PARAMETER_INVALID', 'OpenAPI parameter requires name and in', path)])
    return undefined
  }
  if (!['path', 'query', 'header', 'cookie'].includes(location)) {
    capIssues(issues, [issue(location === 'body' || location === 'formdata' ? 'UNSUPPORTED_REQUEST_BODY' : 'PARAMETER_LOCATION_UNSUPPORTED', 'This OpenAPI parameter location is not supported by the API Kit model', `${path}.in`, { in: location })])
    return undefined
  }
  let schema
  let example
  const parameterIssues = []
  if (version.startsWith('3.')) {
    if (isRecord(parameter.content)) {
      const chosen = chooseMedia(parameter.content)
      if (chosen.contentTypes.length > 1) capIssues(parameterIssues, [issue('MULTIPLE_MEDIA_TYPES_COMPRESSED', 'Multiple parameter media types were reduced to one deterministic schema', `${path}.content`)])
      schema = mediaSchema(chosen.media, resolver, `${path}.content.${chosen.mediaType}`, parameterIssues)
      example = mediaExample(chosen.media, resolver, `${path}.content.${chosen.mediaType}`, parameterIssues)
    } else if (Object.hasOwn(parameter, 'schema')) {
      const value = resolved(resolver, parameter.schema, `${path}.schema`, parameterIssues)
      if (value !== undefined) {
        try { schema = safeValue(normalizeJsonSchema(value)) } catch { capIssues(parameterIssues, [issue('SCHEMA_TOO_LARGE', 'OpenAPI parameter schema exceeds supported bounds', `${path}.schema`)]); schema = {} }
      }
    }
    if (example === undefined && Object.hasOwn(parameter, 'example')) example = safeValue(parameter.example)
  } else {
    schema = schemaFromSwaggerParameter(parameter, path, parameterIssues, resolver)
    if (Object.hasOwn(parameter, 'x-example')) example = safeValue(parameter['x-example'])
    else if (Object.hasOwn(parameter, 'example')) example = safeValue(parameter.example)
  }
  capIssues(issues, parameterIssues)
  if (location === 'header' && CONTROLLED_HEADERS.has(name.toLowerCase())) {
    capIssues(issues, [issue('CONTROLLED_HEADER', 'Authentication and controlled headers cannot be imported as business parameters', `${path}.name`, { name })])
    return undefined
  }
  const result = {
    name,
    in: location,
    required: parameter.required === true || location === 'path',
    description: text(parameter.description, 4000, ''),
    schema: schema ?? { type: 'string' },
    ...(example === undefined ? {} : { example }),
    deprecated: parameter.deprecated === true,
    allowEmptyValue: parameter.allowEmptyValue === true,
  }
  if (location === 'path' && parameter.required !== true) capIssues(issues, [issue('PATH_PARAMETER_REQUIRED', 'Path parameters must be required', `${path}.required`, { name })])
  return result
}

function parameterKey(parameter) {
  return `${String(parameter?.in || '').toLowerCase()}:${String(parameter?.name || '').toLowerCase()}`
}

function collectParameters(pathItem, operation, version, resolver, path, issues, limits) {
  const result = []
  const positions = new Map()
  const append = (raw, rawPath, override) => {
    const parameter = normalizeParameterEntry(raw, version, resolver, rawPath, issues)
    if (!parameter) return
    const key = parameterKey(parameter)
    if (positions.has(key)) {
      const index = positions.get(key)
      if (override) result[index] = parameter
      return
    }
    positions.set(key, result.length)
    result.push(parameter)
  }
  const pathParameters = Array.isArray(pathItem?.parameters) ? pathItem.parameters : []
  for (const [index, parameter] of pathParameters.slice(0, limits.maxParameters).entries()) {
    const resolvedParameter = version === '2.0' ? resolved(resolver, parameter, `${path}.parameters[${index}]`, issues) : parameter
    if (version === '2.0' && isRecord(resolvedParameter) && ['body', 'formData'].includes(String(resolvedParameter.in).toLowerCase())) continue
    append(parameter, `${path}.parameters[${index}]`, false)
  }
  const operationParameters = Array.isArray(operation?.parameters) ? operation.parameters : []
  for (const [index, parameter] of operationParameters.slice(0, limits.maxParameters).entries()) {
    const resolvedParameter = version === '2.0' ? resolved(resolver, parameter, `${path}.operation.parameters[${index}]`, issues) : parameter
    if (version === '2.0' && isRecord(resolvedParameter) && ['body', 'formData'].includes(String(resolvedParameter.in).toLowerCase())) continue
    append(parameter, `${path}.operation.parameters[${index}]`, true)
  }
  if (pathParameters.length + operationParameters.length > limits.maxParameters) capIssues(issues, [issue('PARAMETER_LIMIT_EXCEEDED', 'OpenAPI operation parameters were truncated to the supported limit', path)])
  return result
}

function validatePathParameters(path, parameters, issues) {
  const names = pathTemplateNames(path)
  const declared = new Set(parameters.filter((item) => item.in === 'path').map((item) => item.name))
  for (const name of names) if (!declared.has(name)) capIssues(issues, [issue('PATH_PARAMETER_MISSING', 'Path template parameter has no declaration', 'parameters', { name })])
  for (const name of declared) if (!names.includes(name)) capIssues(issues, [issue('PATH_PARAMETER_UNUSED', 'Declared path parameter is not present in the path template', 'parameters', { name })])
}

function normalizeRequestBody(pathItem, operation, version, document, resolver, path, issues, limits) {
  if (version.startsWith('3.')) {
    if (!Object.hasOwn(operation, 'requestBody')) return null
    const body = resolved(resolver, operation.requestBody, `${path}.requestBody`, issues)
    if (!isRecord(body)) {
      capIssues(issues, [issue('REQUEST_BODY_INVALID', 'OpenAPI requestBody must be an object', `${path}.requestBody`)]); return null
    }
    const chosen = chooseMedia(body.content)
    if (chosen.contentTypes.length === 0) {
      capIssues(issues, [issue('REQUEST_BODY_CONTENT_MISSING', 'OpenAPI requestBody has no media type content', `${path}.requestBody.content`)]); return null
    }
    if (chosen.contentTypes.some(isUploadMediaType)) {
      capIssues(issues, [issue('UNSUPPORTED_FILE_UPLOAD', 'Multipart and file uploads are not supported', `${path}.requestBody.content`)]); return null
    }
    if (chosen.contentTypes.length > 1) capIssues(issues, [issue('MULTIPLE_MEDIA_TYPES_COMPRESSED', 'Multiple request body media types were reduced to one deterministic schema', `${path}.requestBody.content`)])
    return {
      required: body.required === true,
      contentTypes: chosen.contentTypes,
      schema: mediaSchema(chosen.media, resolver, `${path}.requestBody.content.${chosen.mediaType}`, issues) ?? {},
      ...(mediaExample(chosen.media, resolver, `${path}.requestBody.content.${chosen.mediaType}`, issues) === undefined ? {} : { example: mediaExample(chosen.media, resolver, `${path}.requestBody.content.${chosen.mediaType}`, issues) }),
      description: text(body.description, 4000, ''),
    }
  }
  const parameters = [
    ...(Array.isArray(pathItem?.parameters) ? pathItem.parameters : []),
    ...(Array.isArray(operation.parameters) ? operation.parameters : []),
  ]
  const bodyParameters = []
  const formParameters = []
  for (const [index, raw] of parameters.slice(0, limits.maxParameters).entries()) {
    const parameter = resolved(resolver, raw, `${path}.parameters[${index}]`, issues)
    if (!isRecord(parameter)) continue
    if (parameter.in === 'body') bodyParameters.push({ parameter, index })
    if (parameter.in === 'formData') formParameters.push({ parameter, index })
  }
  if (bodyParameters.length > 0 && formParameters.length > 0) {
    capIssues(issues, [issue('BODY_FORMDATA_CONFLICT', 'Swagger operation cannot combine body and formData parameters', path)])
    return null
  }
  if (formParameters.length > 0) {
    capIssues(issues, [issue('UNSUPPORTED_FILE_UPLOAD', 'Swagger formData/file uploads are not supported', `${path}.parameters`)]); return null
  }
  const item = bodyParameters[0]?.parameter
  if (!item) return null
  if (bodyParameters.length > 1) capIssues(issues, [issue('MULTIPLE_REQUEST_BODIES', 'Swagger operation has multiple body parameters', `${path}.parameters`)]);
  const schema = schemaFromSwaggerParameter(item, `${path}.parameters[${bodyParameters[0].index}]`, issues, resolver)
  const contentTypes = Array.isArray(operation.consumes) && operation.consumes.length > 0
    ? operation.consumes.filter((value) => typeof value === 'string').slice(0, 20)
    : (Array.isArray(document.consumes) ? document.consumes.filter((value) => typeof value === 'string').slice(0, 20) : [])
  return {
    required: item.required === true,
    contentTypes,
    schema,
    ...(item.example === undefined ? {} : { example: safeValue(item.example) }),
    description: text(item.description, 4000, ''),
  }
}

function normalizeResponses(operation, version, document, resolver, path, issues, limits) {
  const rawResponses = resolved(resolver, operation.responses, `${path}.responses`, issues)
  if (!isRecord(rawResponses)) {
    capIssues(issues, [issue('RESPONSES_INVALID', 'OpenAPI operation responses must be an object', `${path}.responses`)]); return { responses: [], successStatuses: [] }
  }
  const entries = Object.entries(rawResponses).slice(0, limits.maxResponses)
  if (Object.keys(rawResponses).length > limits.maxResponses) capIssues(issues, [issue('RESPONSE_LIMIT_EXCEEDED', 'OpenAPI responses were truncated to the supported limit', `${path}.responses`)]);
  const responses = []
  const successStatuses = []
  for (const [status, raw] of entries) {
    if (!STATUS_PATTERN.test(status)) {
      capIssues(issues, [issue('RESPONSE_STATUS_INVALID', 'Response status must be default or a 1xx-5xx status code', `${path}.responses.${status}`)])
      continue
    }
    const response = resolved(resolver, raw, `${path}.responses.${status}`, issues)
    if (!isRecord(response)) {
      capIssues(issues, [issue('RESPONSE_INVALID', 'OpenAPI response must be an object', `${path}.responses.${status}`)]); continue
    }
    const content = version.startsWith('3.') ? chooseMedia(response.content) : { contentTypes: Array.isArray(operation.produces) ? operation.produces.slice(0, 20) : (Array.isArray(document.produces) ? document.produces.slice(0, 20) : []), mediaType: '', media: undefined }
    let schema
    let example
    if (version.startsWith('3.')) {
      if (content.contentTypes.length > 1) capIssues(issues, [issue('MULTIPLE_MEDIA_TYPES_COMPRESSED', 'Multiple response media types were reduced to one deterministic schema', `${path}.responses.${status}.content`)]);
      schema = mediaSchema(content.media, resolver, `${path}.responses.${status}.content.${content.mediaType}`, issues)
      example = mediaExample(content.media, resolver, `${path}.responses.${status}.content.${content.mediaType}`, issues)
    } else {
      if (Object.hasOwn(response, 'schema')) {
        const value = resolved(resolver, response.schema, `${path}.responses.${status}.schema`, issues)
        if (value !== undefined) {
          try { schema = safeValue(normalizeJsonSchema(value)) } catch { capIssues(issues, [issue('SCHEMA_TOO_LARGE', 'Swagger response schema exceeds supported bounds', `${path}.responses.${status}.schema`)]) }
        }
      }
      if (isRecord(response.examples)) {
        const key = Object.keys(response.examples).sort()[0]
        if (key) example = safeValue(response.examples[key])
      }
    }
    if (!text(response.description, 4000, '')) capIssues(issues, [issue('RESPONSE_DESCRIPTION_MISSING', 'OpenAPI response has no description', `${path}.responses.${status}.description`)]);
    if (schema === undefined && example === undefined && content.contentTypes.length > 0) capIssues(issues, [issue('RESPONSE_SCHEMA_MISSING', 'Response content has no safely convertible schema or example', `${path}.responses.${status}`)]);
    const normalizedStatus = status
    if (/^2\d\d$/.test(status)) successStatuses.push(Number(status))
    responses.push({
      status: normalizedStatus,
      description: text(response.description, 4000, ''),
      contentTypes: content.contentTypes,
      schema: schema ?? {},
      ...(example === undefined ? {} : { example }),
    })
  }
  return { responses, successStatuses: successStatuses.sort((left, right) => left - right) }
}

function serverIssueCode(message) {
  return message === 'missing' ? 'MISSING_BASE_URL' : 'SERVER_INVALID'
}

function normalizeServer(raw, source, path, limits, warnings) {
  const server = isRecord(raw) ? raw : { url: raw }
  const template = typeof server.url === 'string' ? server.url.trim() : ''
  if (!template || CONTROL_CHARS.test(template)) {
    const value = issue('SERVER_INVALID', 'OpenAPI server URL is missing or invalid', path)
    capIssues(warnings, [value]); return { id: `server-${hashText(`${source}:${path}`)}`, source, status: 'invalid', warnings: [value] }
  }
  let urlText = template
  const variableNames = [...template.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1])
  const variableWarnings = []
  for (const name of variableNames) {
    const variable = isRecord(server.variables) && isRecord(server.variables[name]) ? server.variables[name] : {}
    const defaultValue = typeof variable.default === 'string' ? variable.default : ''
    const enumValues = Array.isArray(variable.enum) ? variable.enum.filter((value) => typeof value === 'string') : []
    if (!defaultValue || CONTROL_CHARS.test(defaultValue) || /[\s\\/?#:@]/.test(defaultValue) || (enumValues.length > 0 && !enumValues.includes(defaultValue))) {
      const warning = issue('SERVER_VARIABLE_UNRESOLVED', 'Server variable has no safe default value', `${path}.variables.${name}`)
      variableWarnings.push(warning)
      continue
    }
    urlText = urlText.split(`{${name}}`).join(defaultValue)
  }
  if (variableWarnings.length > 0 || /\{[^{}]+\}/.test(urlText)) {
    const unresolved = variableWarnings.length ? variableWarnings : [issue('SERVER_VARIABLE_UNRESOLVED', 'Server URL contains an unresolved variable', path)]
    capIssues(warnings, unresolved)
    return { id: `server-${hashText(`${source}:${template}`)}`, source, status: 'unresolved', warnings: unresolved }
  }
  let url
  try { url = new URL(urlText) } catch {
    const value = issue('SERVER_INVALID', 'Server URL is not a valid URL', path)
    capIssues(warnings, [value]); return { id: `server-${hashText(`${source}:${template}`)}`, source, status: 'invalid', warnings: [value] }
  }
  if (!HTTP_PROTOCOLS.has(url.protocol) || url.username || url.password || url.search || url.hash || !url.hostname) {
    const value = issue('SERVER_INVALID', 'Server URL must be HTTP/HTTPS without credentials, query or fragment', path)
    capIssues(warnings, [value]); return { id: `server-${hashText(`${source}:${template}`)}`, source, status: 'invalid', warnings: [value] }
  }
  const pathname = url.pathname.replace(/\/+$/, '')
  const normalizedUrl = url.origin + (pathname === '/' ? '' : pathname)
  const result = {
    id: `server-${hashText(`${source}:${normalizedUrl}`)}`,
    source,
    url: normalizedUrl,
    status: 'valid',
    displayOnly: true,
    ...(variableNames.length > 0 ? { variables: variableNames } : {}),
  }
  return result
}

function normalizeOpenApiServers(document, detected, limits, warnings, resolver) {
  const candidates = []
  const seen = new Set()
  const add = (raw, source, path) => {
    if (candidates.length >= limits.maxServers) return
    const resolvedServer = resolver ? resolved(resolver, raw, path, warnings) : raw
    if (resolvedServer === undefined) return
    const item = normalizeServer(resolvedServer, source, path, limits, warnings)
    const key = item.url ? `url:${item.url}` : `${item.status}:${item.id}`
    if (seen.has(key)) return
    seen.add(key)
    candidates.push({ ...item, scopePath: path })
  }
  if (detected.format === 'openapi') {
    if (Array.isArray(document.servers)) for (const [index, server] of document.servers.entries()) add(server, 'document', `servers[${index}]`)
    else if (document.servers !== undefined) capIssues(warnings, [issue('SERVERS_INVALID', 'OpenAPI servers must be an array', 'servers')])
    for (const pathName of Object.keys(document.paths ?? {}).sort()) {
      const pathItem = resolver ? resolved(resolver, document.paths[pathName], `paths.${pathName}`, warnings) : document.paths[pathName]
      if (!isRecord(pathItem)) continue
      if (Array.isArray(pathItem.servers)) for (const [index, server] of pathItem.servers.entries()) add(server, 'path', `paths.${pathName}.servers[${index}]`)
      for (const method of OPENAPI_METHOD_ORDER) {
        const operation = pathItem[method.toLowerCase()]
        if (isRecord(operation) && Array.isArray(operation.servers)) {
          for (const [index, server] of operation.servers.entries()) add(server, 'operation', `paths.${pathName}.${method.toLowerCase()}.servers[${index}]`)
        }
      }
    }
  } else {
    const host = typeof document.host === 'string' ? document.host.trim() : ''
    const basePath = typeof document.basePath === 'string' ? document.basePath.trim() : ''
    const schemes = Array.isArray(document.schemes) && document.schemes.length > 0 ? document.schemes : ['http']
    if (!host) capIssues(warnings, [issue('MISSING_BASE_URL', 'Swagger document has no host; a user-confirmed Environment is required', 'host')])
    else if (!isValidSwaggerHost(host)) capIssues(warnings, [issue('SERVER_INVALID', 'Swagger host must be a valid host[:port] without path or credentials', 'host')])
    if (document.schemes === undefined) capIssues(warnings, [issue('SCHEME_DEFAULTED', 'Swagger document omitted schemes; http is treated as a candidate only', 'schemes')])
    if (/[?#]/.test(basePath) || (basePath && !basePath.startsWith('/'))) capIssues(warnings, [issue('SERVER_INVALID', 'Swagger basePath must be a relative path', 'basePath')])
    const safeBasePath = basePath && basePath.startsWith('/') && !/[?#]/.test(basePath) ? normalizePath(basePath) : ''
    if (host && isValidSwaggerHost(host)) {
      for (const [index, scheme] of schemes.slice(0, limits.maxServers).entries()) {
        if (typeof scheme !== 'string' || !/^https?$/i.test(scheme.trim())) {
          capIssues(warnings, [issue('SERVER_INVALID', 'Swagger schemes must be http or https', `schemes[${index}]`)]); continue
        }
        add({ url: `${scheme.trim().toLowerCase()}://${host}${safeBasePath}` }, 'swagger', `schemes[${index}]`)
      }
    }
  }
  if (candidates.length === 0 && !warnings.some((value) => value.code === 'MISSING_BASE_URL')) capIssues(warnings, [issue('MISSING_BASE_URL', 'No valid HTTP/HTTPS server candidate was found', 'servers')])
  return candidates
}

function operationServers(document, detected, pathItem, operation, allServers, warnings, path, resolver, limits) {
  if (detected.format !== 'openapi') return allServers.filter((item) => item.source === 'swagger' && item.status === 'valid')
  const hasOperationServers = Array.isArray(operation?.servers)
  const hasPathServers = Array.isArray(pathItem?.servers)
  const raw = hasOperationServers ? operation.servers : hasPathServers ? pathItem.servers : Array.isArray(document.servers) ? document.servers : []
  const ids = []
  for (const [index, item] of raw.entries()) {
    const resolvedServer = resolved(resolver, item, `${path}.servers[${index}]`, warnings)
    if (resolvedServer === undefined) continue
    const candidate = normalizeServer(resolvedServer, hasOperationServers ? 'operation' : hasPathServers ? 'path' : 'document', `${path}.servers[${index}]`, limits, warnings)
    const match = allServers.find((value) => value.url && candidate.url && value.url === candidate.url && value.status === 'valid')
    if (match) ids.push(match.id)
  }
  return ids.length > 0 ? allServers.filter((item) => ids.includes(item.id)) : []
}

function securitySchemeSource(document, detected) {
  if (detected.format === 'openapi') return document.components?.securitySchemes
  return document.securityDefinitions
}

function mapSecuritySchemes(document, detected, resolver, warnings, limits) {
  const source = securitySchemeSource(document, detected)
  const templates = []
  const schemes = new Map()
  if (source !== undefined && !isRecord(source)) {
    capIssues(warnings, [issue('SECURITY_SCHEMES_INVALID', 'Security schemes must be an object', detected.format === 'openapi' ? 'components.securitySchemes' : 'securityDefinitions')])
    return { templates, schemes }
  }
  for (const name of Object.keys(source ?? {}).sort().slice(0, limits.maxSecuritySchemes)) {
    const path = detected.format === 'openapi' ? `components.securitySchemes.${name}` : `securityDefinitions.${name}`
    const scheme = resolved(resolver, source[name], path, warnings)
    if (!isRecord(scheme)) continue
    const type = String(scheme.type || '').toLowerCase()
    let template
    if (detected.format === 'openapi' && type === 'http' && String(scheme.scheme || '').toLowerCase() === 'bearer') template = { type: 'bearer', scheme: 'Bearer' }
    else if ((detected.format === 'openapi' && type === 'http' && String(scheme.scheme || '').toLowerCase() === 'basic') || (detected.format === 'swagger' && type === 'basic')) template = { type: 'basic', scheme: 'Basic' }
    else if (type === 'apikey' || type === 'apiKey'.toLowerCase()) {
      const location = String(scheme.in || '').toLowerCase()
      if (location === 'header' || location === 'query') template = { type: location === 'header' ? 'api-key-header' : 'api-key-query', [location === 'header' ? 'headerName' : 'queryName']: text(scheme.name, 120, '') }
    }
    if (!template || ((template.type === 'api-key-header' || template.type === 'api-key-query') && (!template.headerName && !template.queryName || FORBIDDEN_AUTH_NAME.test(template.headerName || template.queryName)))) {
      capIssues(warnings, [issue('SECURITY_SCHEME_UNSUPPORTED', 'Security scheme is not supported without additional credential semantics', path, { name })])
      continue
    }
    const id = lowercaseIdentifier(name, 'auth')
    const collision = templates.find((item) => item.id === id)
    if (collision) {
      capIssues(warnings, [issue('DUPLICATE_AUTH_PROFILE_ID', 'Security scheme names collide after normalization', path, { id, names: [collision.sourceName, name] })])
      continue
    }
    const result = {
      id,
      name: text(scheme.description, 120, name) || name,
      type: template.type,
      ...(template.headerName ? { headerName: template.headerName } : {}),
      ...(template.queryName ? { queryName: template.queryName, allowQuery: false, risk: 'credential-in-url' } : {}),
      ...(template.scheme ? { scheme: template.scheme } : {}),
      sourceName: name,
      needsCredentialBinding: true,
    }
    templates.push(result)
    schemes.set(name, result)
  }
  if (source && Object.keys(source).length > limits.maxSecuritySchemes) capIssues(warnings, [issue('SECURITY_SCHEME_LIMIT_EXCEEDED', 'Security schemes were truncated to the supported limit', detected.format === 'openapi' ? 'components.securitySchemes' : 'securityDefinitions')])
  if (templates.length > 0) {
    const templateIds = new Set(templates.map((item) => item.id))
    if (templateIds.size !== templates.length) capIssues(warnings, [issue('DUPLICATE_AUTH_PROFILE_ID', 'Security scheme template IDs are not unique', detected.format === 'openapi' ? 'components.securitySchemes' : 'securityDefinitions')])
  }
  return { templates, schemes }
}

function securityRequirements(operation, document, detected, schemes, resolver, path, warnings) {
  const hasOperationSecurity = Object.hasOwn(operation, 'security')
  const raw = hasOperationSecurity ? operation.security : document.security
  if (raw === undefined) return { names: [], requirements: [], explicit: false, supported: true }
  if (!Array.isArray(raw)) {
    capIssues(warnings, [issue('SECURITY_INVALID', 'OpenAPI security must be an array', `${path}.security`)]); return { names: [], requirements: [], explicit: true, supported: false }
  }
  const requirements = []
  const names = []
  let supported = true
  for (const [index, item] of raw.entries()) {
    if (!isRecord(item)) {
      capIssues(warnings, [issue('SECURITY_INVALID', 'Security requirement must be an object', `${path}.security[${index}]`)]); supported = false; continue
    }
    const allOf = []
    for (const name of Object.keys(item)) {
      if (!schemes.has(name)) {
        capIssues(warnings, [issue('SECURITY_SCHEME_UNSUPPORTED', 'Security requirement references an unavailable or unsupported scheme', `${path}.security[${index}].${name}`, { name })])
        supported = false
      }
      allOf.push(name)
      if (!names.includes(name)) names.push(name)
    }
    requirements.push({ allOf })
  }
  if (requirements.some((item) => item.allOf.length > 1) || requirements.length > 1) capIssues(warnings, [issue('SECURITY_REQUIREMENTS_LOSSY', 'Operation.security is a flat list; the original OR/AND security structure is preserved in OpenAPI metadata', `${path}.security`)]);
  return { names, requirements, explicit: true, supported }
}

function candidateValidation(candidate, options, issues) {
  const targetId = candidate.serviceTargetId || '__openapi_import_target__'
  const registry = isRecord(options.registry) ? cloneJson(options.registry) : {}
  registry.serviceTargets = Array.isArray(registry.serviceTargets) ? registry.serviceTargets : []
  registry.environments = Array.isArray(registry.environments) ? registry.environments : []
  registry.authProfiles = Array.isArray(registry.authProfiles) ? registry.authProfiles : []
  registry.kits = Array.isArray(registry.kits) ? registry.kits : []
  if (!isRecord(options.registry) || !candidate.serviceTargetId) registry.serviceTargets.push({ id: targetId })
  if (isRecord(options.registry) && candidate.serviceTargetId && !registry.serviceTargets.some((item) => item?.id === candidate.serviceTargetId)) {
    capIssues(issues, [issue('TARGET_NOT_FOUND', 'The supplied Service Target is not present in the Registry', 'serviceTargetId', { id: candidate.serviceTargetId })])
    return
  }
  for (const id of candidate.kitIds ?? []) if (!registry.kits.some((item) => item?.id === id)) {
    capIssues(issues, [issue('KIT_NOT_FOUND', 'The supplied API Kit is not present in the Registry', 'kitIds', { id })])
    return
  }
  try {
    validateOperationInput({ ...candidate, serviceTargetId: targetId }, { registry })
  } catch (error) {
    capIssues(issues, [issue(error.code || 'OPERATION_INVALID', error.message || 'Imported operation failed canonical validation', error.path || 'operation', error.detail)])
  }
}

function fallbackOperation(method, path, operationId, meta, options) {
  return normalizeOperation({
    id: '', operationId, name: operationId || path, method, path,
    serviceTargetId: options.serviceTargetId || '', kitIds: options.kitIds || [],
    parameters: [], requestBody: null, responses: [], security: [],
    source: meta.source, sourceKey: `${meta.documentId}#${method} ${path}`,
  })
}

function operationSemantics(operation) {
  const copy = cloneJson(operation) || {}
  for (const key of ['id', 'createdAt', 'updatedAt', 'kitIds', 'status', 'warnings', 'errors', 'needsBinding', 'needsTargetBinding', 'needsAuthBinding', 'importable', 'identity', 'successStatuses']) delete copy[key]
  return copy
}

function sameOperation(left, right) {
  return stableStringify(operationSemantics(left)) === stableStringify(operationSemantics(right))
}

function findExisting(candidate, registry) {
  const operations = Array.isArray(registry?.operations) ? registry.operations : []
  const operationId = String(candidate.operationId || '').toLowerCase()
  const sourceKey = candidate.sourceKey
  const bySource = operations.find((item) => item?.sourceKey && item.sourceKey === sourceKey)
  if (bySource) return { item: bySource, matches: [bySource] }
  const byOperationId = operations.filter((item) => String(item?.operationId || '').toLowerCase() === operationId)
  if (byOperationId.length > 0) return { item: byOperationId[0], matches: byOperationId }
  const key = stableOperationKey(candidate.method, candidate.path)
  const byPath = operations.filter((item) => stableOperationKey(item?.method, item?.path) === key)
  return byPath.length > 0 ? { item: byPath[0], matches: byPath } : undefined
}

function classifyCandidate(candidate, options) {
  if (candidate.errors.length > 0) return 'error'
  const found = findExisting(candidate, options.registry)
  if (!found) return 'new'
  if (found.matches.length > 1) return 'conflict'
  if (sameOperation(candidate, found.item)) return 'skip'
  const candidateDocumentId = candidate.extensions?.openapi?.documentId
  const existingDocumentId = found.item?.extensions?.openapi?.documentId
  const sameSource = found.item?.sourceKey === candidate.sourceKey
    || (candidateDocumentId && existingDocumentId && candidateDocumentId === existingDocumentId)
  return sameSource ? 'update' : 'conflict'
}

function countMap(values) {
  const result = {}
  for (const value of values) {
    const key = value || '(none)'
    result[key] = (result[key] || 0) + 1
  }
  return result
}

function buildOperationCandidate(document, detected, meta, serverCandidates, security, pathName, method, pathItem, operation, resolver, options) {
  const issues = []
  const methodPath = sourcePath(pathName, method)
  let path
  try { path = validateRelativePath(pathName, `${methodPath}.path`) } catch (error) {
    capIssues(issues, [issue(error.code, error.message, error.path)])
    path = '/'
  }
  const operationObject = resolved(resolver, operation, methodPath, issues)
  if (!isRecord(operationObject)) {
    capIssues(issues, [issue('OPERATION_INVALID', 'OpenAPI operation must be an object', methodPath)]); return undefined
  }
  const pathObject = isRecord(pathItem) ? pathItem : {}
  const operationIdProvided = typeof operationObject.operationId === 'string' && operationObject.operationId.trim()
  let operationId = operationIdProvided ? operationObject.operationId.trim() : stableOperationId(method, path)
  if (!operationIdProvided) capIssues(issues, [issue('MISSING_OPERATION_ID', 'Operation has no operationId; a stable method/path ID was generated', `${methodPath}.operationId`, { operationId })])
  const normalizedOperationId = identifier(operationId, '')
  if (!normalizedOperationId) {
    capIssues(issues, [issue('OPERATION_ID_INVALID', 'Operation operationId could not be normalized safely', `${methodPath}.operationId`)]); operationId = stableOperationId(method, path)
  } else if (normalizedOperationId !== operationId) {
    capIssues(issues, [issue('OPERATION_ID_NORMALIZED', 'Operation operationId was normalized for the canonical model ID', `${methodPath}.operationId`, { operationId: normalizedOperationId })])
  }

  const parameters = collectParameters(pathObject, operationObject, detected.version, resolver, methodPath, issues, options.limits)
  validatePathParameters(path, parameters, issues)
  const requestBody = normalizeRequestBody(pathObject, operationObject, detected.version, document, resolver, methodPath, issues, options.limits)
  const responseResult = normalizeResponses(operationObject, detected.version, document, resolver, methodPath, issues, options.limits)
  const securityResult = securityRequirements(operationObject, document, detected, security.schemes, resolver, methodPath, issues)
  const scopedServers = operationServers(document, detected, pathObject, operationObject, serverCandidates, issues, methodPath, resolver, options.limits)
  if (scopedServers.length === 0) capIssues(issues, [issue('MISSING_BASE_URL', 'Operation has no valid server candidate; bind an Environment explicitly before import', `${methodPath}.servers`)]);

  const authBindings = isRecord(options.authProfileBindings) ? options.authProfileBindings : {}
  const boundNames = securityResult.names.filter((name) => typeof authBindings[name] === 'string' && authBindings[name].trim())
  const authProfileId = securityResult.names.length === 1 && boundNames.length === 1 ? lowercaseIdentifier(authBindings[boundNames[0]], '') : ''
  if (securityResult.names.length > 0 && !authProfileId && securityResult.supported) capIssues(issues, [issue('NEEDS_CREDENTIAL_BINDING', 'Security metadata was imported without a credential; bind an existing Auth Profile during confirmation', `${methodPath}.security`)]);
  if (securityResult.explicit && securityResult.requirements.some((item) => item.allOf.length === 0)) capIssues(issues, [issue('ANONYMOUS_SECURITY_ALTERNATIVE', 'Security requirements include an anonymous alternative; preserve this choice during confirmation', `${methodPath}.security`)]);

  const securityMetadata = securityResult.requirements.map((requirement) => ({ allOf: requirement.allOf.slice(0, 20) }))
  const extension = {
    openapi: {
      documentId: meta.documentId,
      source: detected.source,
      serverCandidateIds: scopedServers.map((item) => item.id),
      securityRequirements: securityMetadata,
      ...(securityResult.explicit ? { securityExplicit: true } : {}),
      successStatuses: responseResult.successStatuses,
      ...(operationIdProvided ? {} : { operationIdGenerated: true }),
    },
  }
  let normalized
  try {
    normalized = normalizeOperation({
      operationId,
      name: operationObject.summary || operationId || path,
      summary: operationObject.summary,
      description: operationObject.description,
      method,
      path,
      tags: operationObject.tags,
      serviceTargetId: options.serviceTargetId || '',
      kitIds: Array.isArray(options.kitIds) ? options.kitIds : [],
      parameters,
      requestBody,
      responses: responseResult.responses,
      policy: { allowAgentCall: true },
       security: securityResult.names,
      authProfileId,
      source: detected.source,
      sourceKey: `${meta.documentId}#${method} ${path}`,
      extensions: extension,
    })
    candidateValidation(normalized, options, issues)
  } catch (error) {
    capIssues(issues, [issue(error.code || 'OPERATION_INVALID', error.message || 'Imported operation could not be normalized', error.path || methodPath, error.detail)])
    normalized = fallbackOperation(method, path, operationId, meta, options)
  }
  const needsTargetBinding = !normalized.serviceTargetId
  const needsAuthBinding = securityResult.names.length > 0 && !normalized.authProfileId
  if (needsTargetBinding) capIssues(issues, [issue('NEEDS_TARGET_BINDING', 'Candidate is not bound to a registered Service Target', methodPath)])
  const fatalIssue = issues.some((item) => FATAL_CODES.has(item.code) || ['CONTROLLED_HEADER', 'RESPONSE_STATUS_INVALID', 'PARAMETER_LOCATION_UNSUPPORTED', 'UNSUPPORTED_REQUEST_BODY', 'UNSUPPORTED_FILE_UPLOAD', 'BODY_FORMDATA_CONFLICT', 'DUPLICATE_OPERATION_ID', 'DUPLICATE_AUTH_PROFILE_ID', 'SECURITY_SCHEME_UNSUPPORTED', 'SECURITY_INVALID', 'TARGET_NOT_FOUND', 'KIT_NOT_FOUND'].includes(item.code))
  const candidate = {
    ...normalized,
    successStatuses: responseResult.successStatuses,
    serverCandidateIds: scopedServers.map((item) => item.id),
    identity: stableOperationKey(normalized.method, normalized.path),
    needsTargetBinding,
    needsAuthBinding,
    needsBinding: needsTargetBinding || needsAuthBinding,
      importable: !fatalIssue,
    warnings: issues.filter((item) => ['MISSING_OPERATION_ID', 'OPERATION_ID_NORMALIZED', 'NEEDS_TARGET_BINDING', 'NEEDS_CREDENTIAL_BINDING', 'MISSING_BASE_URL', 'RESPONSE_DESCRIPTION_MISSING', 'RESPONSE_SCHEMA_MISSING', 'MULTIPLE_MEDIA_TYPES_COMPRESSED', 'SECURITY_REQUIREMENTS_LOSSY', 'SCHEME_DEFAULTED', 'PATH_PARAMETER_UNUSED', 'REF_SIBLINGS_IGNORED'].includes(item.code)),
    errors: issues.filter((item) => !['MISSING_OPERATION_ID', 'OPERATION_ID_NORMALIZED', 'NEEDS_TARGET_BINDING', 'NEEDS_CREDENTIAL_BINDING', 'MISSING_BASE_URL', 'RESPONSE_DESCRIPTION_MISSING', 'RESPONSE_SCHEMA_MISSING', 'MULTIPLE_MEDIA_TYPES_COMPRESSED', 'SECURITY_REQUIREMENTS_LOSSY', 'SCHEME_DEFAULTED', 'PATH_PARAMETER_UNUSED', 'REF_SIBLINGS_IGNORED', 'ANONYMOUS_SECURITY_ALTERNATIVE'].includes(item.code)),
  }
  candidate.status = classifyCandidate(candidate, options)
  return candidate
}

function collectOperations(document, detected, meta, serverCandidates, security, resolver, options, warnings) {
  const candidates = []
  const paths = Object.keys(document.paths ?? {}).sort().slice(0, options.limits.maxPaths)
  if (Object.keys(document.paths ?? {}).length > options.limits.maxPaths) capIssues(warnings, [issue('PATH_LIMIT_EXCEEDED', 'OpenAPI paths were truncated to the supported limit', 'paths')])
  for (const pathName of paths) {
    const pathIssues = []
    let pathItem = resolved(resolver, document.paths[pathName], `paths.${pathName}`, pathIssues)
    if (!isRecord(pathItem)) {
      capIssues(warnings, pathIssues.length > 0 ? pathIssues : [issue('PATH_ITEM_INVALID', 'OpenAPI path item must be an object', `paths.${pathName}`)])
      continue
    }
    capIssues(warnings, pathIssues)
    const pathHasOperations = Object.keys(pathItem).some((key) => OPENAPI_METHOD_ORDER.includes(normalizeMethod(key)))
    if (pathHasOperations) {
      try { validateRelativePath(pathName, `paths.${pathName}`) } catch (error) {
        for (const method of OPENAPI_METHOD_ORDER.filter((item) => Object.hasOwn(pathItem, item.toLowerCase()))) {
          capIssues(warnings, [issue(error.code, error.message, sourcePath(pathName, method))])
        }
      }
    }
    for (const key of Object.keys(pathItem)) {
      if (key.startsWith('x-') || PATH_ITEM_KEYS.has(key)) continue
      if (/^[a-z]+$/i.test(key)) capIssues(warnings, [issue('UNSUPPORTED_METHOD', 'OpenAPI path method is not supported', `paths.${pathName}.${key}`, { method: key })])
    }
    const methods = OPENAPI_METHOD_ORDER.filter((method) => Object.hasOwn(pathItem, method.toLowerCase()))
    for (const method of methods) {
      if (candidates.length >= options.limits.maxOperations) break
      const operation = pathItem[method.toLowerCase()]
      const candidate = buildOperationCandidate(document, detected, meta, serverCandidates, security, pathName, method, pathItem, operation, resolver, options)
      if (candidate) candidates.push(candidate)
    }
    if (candidates.length >= options.limits.maxOperations) break
  }
  if (candidates.length >= options.limits.maxOperations) capIssues(warnings, [issue('OPERATION_LIMIT_EXCEEDED', 'OpenAPI operations were truncated to the supported limit', 'paths')])
  return candidates
}

function ensureUniqueCandidateIds(candidates) {
  const byId = new Map()
  for (const candidate of candidates) {
    const key = String(candidate.operationId || '').toLowerCase()
    if (!key) continue
    const prior = byId.get(key)
    if (prior) {
      const value = issue('DUPLICATE_OPERATION_ID', 'OpenAPI operationId is not unique after normalization', 'operationId', { operationId: candidate.operationId })
      prior.errors.push(value); prior.importable = false; prior.status = 'error'
      candidate.errors.push(value); candidate.importable = false; candidate.status = 'error'
    } else byId.set(key, candidate)
  }
}

function buildCounts(candidates, warnings, errors) {
  const counts = { total: candidates.length, operations: candidates.length, new: 0, update: 0, conflict: 0, skip: 0, error: 0, warning: warnings.length }
  for (const candidate of candidates) {
    if (candidate.status === 'new') counts.new += 1
    else if (candidate.status === 'update') counts.update += 1
    else if (candidate.status === 'conflict') counts.conflict += 1
    else if (candidate.status === 'skip') counts.skip += 1
    else counts.error += 1
    counts.warning += candidate.warnings.length
  }
  counts.error = Math.max(counts.error, errors.length)
  return counts
}

/**
 * Build a deterministic, preview-only import plan. No Registry or input object
 * is mutated, and the returned object never contains the complete source doc.
 */
export function buildOpenApiImportPreview(input, options = {}) {
  const limits = limitsFor(options)
  const parsed = parseOpenApiJson(input, { ...options, limits })
  if (!parsed.ok) {
    const documentMeta = parsed.document && parsed.format ? buildDocumentMeta(parsed.document, parsed, options) : undefined
    return {
      ok: false,
      ...(documentMeta ? { documentMeta } : {}),
      serverCandidates: [],
      authProfileTemplates: [],
      operations: [],
      tagCounts: {},
      serviceCounts: {},
      warnings: parsed.warnings ?? [],
      errors: parsed.errors ?? [],
      counts: { total: 0, operations: 0, new: 0, update: 0, conflict: 0, skip: 0, error: parsed.errors?.length ?? 0, warning: 0 },
    }
  }
  const document = parsed.document
  const meta = parsed.documentMeta
  const warnings = []
  const resolver = new LocalResolver(document, { ...options, version: parsed.version, limits })
  const serverCandidates = normalizeOpenApiServers(document, parsed, limits, warnings, resolver)
  const security = mapSecuritySchemes(document, parsed, resolver, warnings, limits)
  const candidates = collectOperations(document, parsed, meta, serverCandidates, security, resolver, { ...options, limits, registry: options.registry }, warnings)
  ensureUniqueCandidateIds(candidates)
  for (const candidate of candidates) {
    if (candidate.errors.length > 0 || !candidate.importable) candidate.status = 'error'
    else candidate.status = classifyCandidate(candidate, options)
  }
  const tags = []
  const services = []
  for (const candidate of candidates) {
    tags.push(...(candidate.tags ?? []))
    services.push(candidate.serviceTargetId || '(unbound)')
  }
  const errors = []
  const errorKeys = new Set()
  const addErrors = (values) => {
    for (const value of values ?? []) {
      const key = `${value.code}:${value.path || ''}:${JSON.stringify(value.detail ?? '')}`
      if (errorKeys.has(key)) continue
      errorKeys.add(key)
      capIssues(errors, [value], limits.maxIssues)
    }
  }
  addErrors(parsed.errors)
  addErrors(warnings.filter((item) => FATAL_CODES.has(item.code)))
  for (const candidate of candidates) {
    addErrors(candidate.errors)
    addErrors(candidate.warnings.filter((item) => FATAL_CODES.has(item.code)))
  }
  return {
    ok: errors.length === 0,
    documentMeta: meta,
    serverCandidates: serverCandidates.map((item) => safeValue(item)),
    authProfileTemplates: security.templates.map((item) => safeValue(item)),
    operations: candidates.map((item) => safeValue(item)),
    tagCounts: countMap(tags),
    serviceCounts: countMap(services),
    warnings: warnings.map((item) => safeValue(item)),
    errors: errors.map((item) => safeValue(item)),
    counts: buildCounts(candidates, warnings, errors),
  }
}

// Short aliases make the pure adapter convenient to consume from future T12
// code without exposing any DSH runtime object.
export const previewOpenApiImport = buildOpenApiImportPreview
export const normalizeOpenApiDocument = buildOpenApiImportPreview
export const resolveRef = resolveOpenApiRef
export const parseOpenApi = parseOpenApiJson

export { READ_METHODS, SUPPORTED_METHODS }
