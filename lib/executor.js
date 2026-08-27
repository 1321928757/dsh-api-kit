/**
 * Fixed-target, read-only API operation executor.
 *
 * This module is DSH-independent. It resolves an operation from the current
 * session activation, constructs a request only from the registered Environment
 * and Operation, and delegates the already-fixed request to an injected
 * transport. No caller-supplied URL, host, redirect policy, or credential value
 * is accepted.
 */

import { READ_METHODS } from './model.js'
import { ConfigurationError, CONTROLLED_HEADERS } from './config-validation.js'
import { CredentialAdapterError } from './errors.js'
import { operationDiscoverable, requiredSessionId } from './discovery.js'
import {
  MAX_URL_LENGTH,
  isRecord,
  normalizeMethod,
  normalizeHost,
  normalizeJsonValue,
} from './normalizers.js'
import { createFetchTransport, HttpTransportError } from './transport.js'

export const EXECUTOR_MAX_OUTPUT_BYTES = 512 * 1024
export const EXECUTOR_MAX_REQUEST_BODY_BYTES = 256 * 1024
export const EXECUTOR_MAX_DURATION_MS = 60 * 1000
export const EXECUTOR_MAX_PATH_VALUE_LENGTH = 4096
export const EXECUTOR_MAX_QUERY_ITEMS = 100
export const EXECUTOR_MAX_HEADER_VALUE_LENGTH = 8192

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/
const URL_PROTOCOLS = new Set(['http:', 'https:'])
const JSON_CONTENT_TYPE = /^(?:application\/json|[^;\s]+\+json|text\/json)$/i
const TEXT_CONTENT_TYPE = /^(?:text\/|application\/(?:xml|javascript|x-javascript))/i
const FORBIDDEN_TOP_LEVEL = new Set(['sessionId', 'url', 'baseUrl', 'host', 'headersRaw', 'redirect', 'timeoutMs'])
const SAFE_ERROR_CODES = new Set([
  'SESSION_ID_REQUIRED', 'ABORTED', 'KIT_NOT_ACTIVE', 'KIT_NOT_FOUND', 'KIT_DISABLED',
  'KIT_AGENT_DISABLED', 'ENVIRONMENT_DISABLED', 'ENVIRONMENT_AGENT_DISABLED',
  'ENVIRONMENT_NOT_COMPATIBLE', 'NO_COMMON_ENVIRONMENT', 'ENVIRONMENT_NOT_FOUND',
  'OPERATION_NOT_FOUND', 'METHOD_NOT_ALLOWED', 'CONFIRMATION_REQUIRED',
  'TARGET_NOT_FOUND', 'TARGET_DISABLED', 'TARGET_AGENT_DISABLED',
  'AUTH_PROFILE_NOT_FOUND', 'AUTH_PROFILE_NOT_ALLOWED', 'CREDENTIAL_NOT_CONFIGURED',
  'QUERY_AUTH_DISABLED', 'AUTH_RESOLUTION_FAILED', 'INVALID_ARGUMENT',
  'MISSING_PARAMETER', 'PARAMETER_INVALID', 'PARAMETER_NOT_SUPPORTED',
  'BODY_NOT_SUPPORTED', 'REQUEST_BODY_REQUIRED', 'REQUEST_BODY_INVALID',
  'REQUEST_BODY_UNSUPPORTED', 'HEADER_CONFLICT', 'AUTH_HEADER_CONFLICT',
  'AUTH_QUERY_CONFLICT', 'PATH_INVALID', 'URL_INVALID', 'URL_TOO_LONG',
  'HOST_NOT_ALLOWED', 'PORT_NOT_ALLOWED', 'RESPONSE_TOO_LARGE',
  'RESPONSE_UNSUPPORTED', 'NETWORK_ERROR', 'NETWORK_UNAVAILABLE',
  'REQUEST_TIMEOUT', 'REQUEST_FAILED', 'RESPONSE_INVALID', 'HTTP_STATUS',
])

function utf8Bytes(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).byteLength
  return text.length
}

function cloneJson(value) {
  if (value === undefined) return undefined
  try { return JSON.parse(JSON.stringify(value)) } catch { return undefined }
}

function issue(code, message, hint, details) {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(hint ? { hint } : {}),
      ...(details === undefined ? {} : { details: cloneJson(details) }),
    },
  }
}

function fail(code, message, hint, details) {
  const error = new Error(message)
  error.code = code
  error.hint = hint
  error.details = details
  throw error
}

function safeDetails(value) {
  if (!isRecord(value)) return undefined
  const allowed = ['id', 'operationId', 'name', 'field', 'parameter', 'environmentId', 'serviceTargetId', 'host', 'status', 'maxBytes']
  const result = {}
  for (const key of allowed) {
    if (value[key] !== undefined) result[key] = cloneJson(value[key])
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function errorMessage(code) {
  const messages = {
    SESSION_ID_REQUIRED: '当前工具调用缺少有效的 Agent 会话标识',
    ABORTED: 'API 请求已取消，请重试',
    KIT_NOT_ACTIVE: '当前会话尚未激活 API 套件',
    OPERATION_NOT_FOUND: 'Operation 不存在、已禁用，或不在当前会话的 Agent 暴露范围内',
    METHOD_NOT_ALLOWED: '当前 api_call 只允许 GET 和 HEAD 只读 Operation',
    CONFIRMATION_REQUIRED: '该 Operation 需要人工确认；当前版本不会在 Agent 工具中绕过确认',
    MISSING_PARAMETER: '缺少必需的 API 参数',
    PARAMETER_INVALID: 'API 参数不符合已登记的参数 Schema',
    PARAMETER_NOT_SUPPORTED: '当前版本不支持该 API 参数位置',
    BODY_NOT_SUPPORTED: '当前只读执行器不支持该请求体用法',
    REQUEST_BODY_REQUIRED: '该 Operation 要求提供请求体',
    REQUEST_BODY_INVALID: '请求体必须是有界 JSON 值并符合已登记 Schema',
    REQUEST_BODY_UNSUPPORTED: '当前版本只支持 JSON 请求体',
    HEADER_CONFLICT: '请求 Header 与受控请求字段或固定请求体 Header 冲突',
    AUTH_HEADER_CONFLICT: '业务参数不能覆盖认证 Header',
    AUTH_QUERY_CONFLICT: '业务参数不能覆盖认证 Query 参数',
    PATH_INVALID: '登记的 Operation path 不是安全的相对路径',
    URL_INVALID: '固定目标 URL 无效',
    URL_TOO_LONG: '固定目标 URL 超过安全长度限制',
    HOST_NOT_ALLOWED: '目标主机不在当前 Environment 白名单中',
    PORT_NOT_ALLOWED: '目标端口与当前 Environment 不一致',
    TARGET_NOT_FOUND: 'Service Target 不存在或已失效',
    TARGET_DISABLED: 'Service Target 已停用',
    TARGET_AGENT_DISABLED: 'Service Target 未允许 Agent 使用',
    AUTH_PROFILE_NOT_FOUND: '认证配置不存在或已失效',
    AUTH_PROFILE_NOT_ALLOWED: 'Operation 的认证配置不属于当前 Service Target',
    CREDENTIAL_NOT_CONFIGURED: '当前认证凭据未配置',
    QUERY_AUTH_DISABLED: 'API Key Query 认证默认关闭',
    AUTH_RESOLUTION_FAILED: '认证配置无法在 Host 侧解析',
    INVALID_ARGUMENT: 'api_call 参数无效',
    ENVIRONMENT_DISABLED: '当前 Environment 已停用',
    ENVIRONMENT_AGENT_DISABLED: '当前 Environment 未允许 Agent 使用',
    ENVIRONMENT_NOT_COMPATIBLE: '当前 Environment 不在激活 API 套件的共同范围内',
    NO_COMMON_ENVIRONMENT: '当前激活 API 套件没有共同可用 Environment',
    RESPONSE_TOO_LARGE: '响应超过当前 Operation 的大小限制，请缩小查询范围',
    RESPONSE_UNSUPPORTED: '响应内容类型不受当前只读执行器支持',
    NETWORK_ERROR: 'API 请求未能建立网络连接',
    NETWORK_UNAVAILABLE: 'Host HTTP transport 不可用',
    REQUEST_TIMEOUT: 'API 请求超过配置的超时时间',
    REQUEST_FAILED: 'API 请求失败，请检查当前 API 配置后重试',
    RESPONSE_INVALID: 'API 响应无法安全解析',
    HTTP_STATUS: 'API 返回了非成功 HTTP 状态码',
  }
  return messages[code] || messages.REQUEST_FAILED
}

function hintForCode(code) {
  const hints = {
    SESSION_ID_REQUIRED: '请在正常 DSH Agent 会话中重试。',
    KIT_NOT_ACTIVE: '请先在输入栏激活 API Kit 和 Environment。',
    OPERATION_NOT_FOUND: '请先使用 api_operations 重新发现当前会话可用的 Operation。',
    METHOD_NOT_ALLOWED: 'T08 只执行 GET/HEAD；写操作留给后续版本。',
    CONFIRMATION_REQUIRED: '请关闭该 Operation 的确认策略，或等待后续人工确认版本。',
    MISSING_PARAMETER: '请使用 api_describe 检查必需参数名称。',
    PARAMETER_INVALID: '请按照 api_describe 返回的参数 Schema 修正值。',
    HOST_NOT_ALLOWED: '请让管理员检查 Environment 的显式 allowedHosts 配置。',
    RESPONSE_TOO_LARGE: '请增加筛选条件、缩小分页或等待响应治理版本。',
    CREDENTIAL_NOT_CONFIGURED: '请在 Host 凭据存储中配置对应认证凭据。',
    REQUEST_TIMEOUT: '请缩小查询范围或调整已登记的超时策略。',
  }
  return hints[code]
}

function envelopeError(code, details, message = errorMessage(code), hint = hintForCode(code)) {
  return issue(code, message, hint, safeDetails(details))
}

function normalizeOperationId(args) {
  if (!isRecord(args) || typeof args.operationId !== 'string' || !args.operationId.trim() || args.operationId.length > 128 || CONTROL_CHARS.test(args.operationId)) {
    fail('INVALID_ARGUMENT', 'operationId must be a bounded non-empty string', '请传入 api_operations 返回的稳定 operationId')
  }
  return args.operationId.trim()
}

function normalizeObject(value, field) {
  if (value === undefined) return {}
  if (!isRecord(value)) fail('INVALID_ARGUMENT', `${field} must be an object`, `请将 ${field} 作为对象传入`, { field })
  return value
}

function assertKnownTopLevel(args) {
  for (const key of Object.keys(args)) {
    if (FORBIDDEN_TOP_LEVEL.has(key)) fail('INVALID_ARGUMENT', `${key} cannot be supplied to api_call`, 'api_call 只能接受 operationId 和已声明的结构化参数', { field: key })
    if (!['operationId', 'pathParams', 'query', 'headers', 'body'].includes(key)) {
      fail('INVALID_ARGUMENT', `unknown api_call field: ${key}`, 'api_call 不接受任意请求选项', { field: key })
    }
  }
}

function primitiveText(value, field, options = {}) {
  if (typeof value === 'string') {
    if (value.length > (options.maxLength ?? EXECUTOR_MAX_HEADER_VALUE_LENGTH) || CONTROL_CHARS.test(value)) {
      fail('PARAMETER_INVALID', `${field} contains unsupported characters or is too long`, undefined, { field })
    }
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('PARAMETER_INVALID', `${field} must be finite`, undefined, { field })
    return String(value)
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  fail('PARAMETER_INVALID', `${field} must be a string, number or boolean`, undefined, { field })
}

function schemaTypeMatches(value, type) {
  if (type === 'string') return typeof value === 'string'
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value)
  if (type === 'boolean') return typeof value === 'boolean'
  if (type === 'array') return Array.isArray(value)
  if (type === 'object') return isRecord(value)
  if (type === 'null') return value === null
  return true
}

function valuesEqual(left, right) {
  if (Object.is(left, right)) return true
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    return leftKeys.length === rightKeys.length && leftKeys.every((key) => Object.hasOwn(right, key) && valuesEqual(left[key], right[key]))
  }
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, index) => valuesEqual(item, right[index]))
  return false
}

function validateAgainstSchema(value, schema, field, depth = 0) {
  if (depth > 12 || schema === undefined || schema === null || typeof schema === 'boolean') {
    if (schema === false) fail('PARAMETER_INVALID', `${field} is rejected by its Schema`, undefined, { field })
    return
  }
  if (!isRecord(schema)) return
  if (schema.nullable === true && value === null) return
  if (Array.isArray(schema.type) && !schema.type.some((type) => schemaTypeMatches(value, type))) fail('PARAMETER_INVALID', `${field} has an invalid type`, undefined, { field })
  else if (typeof schema.type === 'string' && !schemaTypeMatches(value, schema.type)) fail('PARAMETER_INVALID', `${field} has an invalid type`, undefined, { field })
  if (Array.isArray(schema.enum) && !schema.enum.some((item) => valuesEqual(item, value))) fail('PARAMETER_INVALID', `${field} is not one of the allowed values`, undefined, { field })
  if (typeof value === 'string') {
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) fail('PARAMETER_INVALID', `${field} is shorter than allowed`, undefined, { field })
    if (Number.isInteger(schema.maxLength) && value.length > schema.maxLength) fail('PARAMETER_INVALID', `${field} is longer than allowed`, undefined, { field })
  }
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) fail('PARAMETER_INVALID', `${field} is below the minimum`, undefined, { field })
    if (typeof schema.maximum === 'number' && value > schema.maximum) fail('PARAMETER_INVALID', `${field} is above the maximum`, undefined, { field })
    if (schema.exclusiveMinimum === true && typeof schema.minimum === 'number' && value <= schema.minimum) fail('PARAMETER_INVALID', `${field} is below the exclusive minimum`, undefined, { field })
    if (schema.exclusiveMaximum === true && typeof schema.maximum === 'number' && value >= schema.maximum) fail('PARAMETER_INVALID', `${field} is above the exclusive maximum`, undefined, { field })
  }
  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) fail('PARAMETER_INVALID', `${field} has too few items`, undefined, { field })
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) fail('PARAMETER_INVALID', `${field} has too many items`, undefined, { field })
    for (const [index, item] of value.entries()) validateAgainstSchema(item, schema.items, `${field}[${index}]`, depth + 1)
  }
  if (isRecord(value) && isRecord(schema.properties)) {
    for (const [name, child] of Object.entries(value)) {
      if (Object.hasOwn(schema.properties, name)) validateAgainstSchema(child, schema.properties[name], `${field}.${name}`, depth + 1)
      else if (schema.additionalProperties === false) fail('PARAMETER_INVALID', `${field}.${name} is not allowed`, undefined, { field: `${field}.${name}` })
    }
    if (Array.isArray(schema.required)) for (const name of schema.required) if (!Object.hasOwn(value, name)) fail('PARAMETER_INVALID', `${field}.${name} is required`, undefined, { field: `${field}.${name}` })
  }
  if (Array.isArray(schema.allOf)) for (const child of schema.allOf) validateAgainstSchema(value, child, field, depth + 1)
  if (Array.isArray(schema.anyOf) && !schema.anyOf.some((child) => {
    try { validateAgainstSchema(value, child, field, depth + 1); return true } catch { return false }
  })) fail('PARAMETER_INVALID', `${field} does not match any allowed Schema`, undefined, { field })
}

function pathTemplateNames(path) {
  const names = []
  const seen = new Set()
  const matcher = /\{([^{}]+)\}/g
  let match
  while ((match = matcher.exec(path)) !== null) {
    const name = match[1]
    if (!name || seen.has(name)) continue
    seen.add(name)
    names.push(name)
  }
  return names
}

function findParameter(parameters, location, name) {
  return parameters.find((parameter) => parameter.in === location && parameter.name === name)
}

function assertRequiredParameters(values, parameters, location) {
  for (const parameter of parameters.filter((item) => item.in === location && item.required === true)) {
    if (!Object.hasOwn(values, parameter.name)) fail('MISSING_PARAMETER', `missing ${location} parameter: ${parameter.name}`, '请使用 api_describe 检查必需参数', { parameter: parameter.name })
  }
}

function assertDeclaredKeys(values, declared, field) {
  for (const key of Object.keys(values)) {
    if (!declared.has(key)) fail('INVALID_ARGUMENT', `${field}.${key} is not declared by the Operation`, `请使用 api_describe 检查 ${field} 参数名`, { field: `${field}.${key}` })
  }
}

function buildPath(operation, pathParams) {
  const path = operation.path
  if (typeof path !== 'string' || !path.startsWith('/') || path.includes('?') || path.includes('#') || path.includes('\\') || /^[a-z][a-z\d+.-]*:\/\//i.test(path) || path.startsWith('//')) {
    fail('PATH_INVALID', 'operation path must remain a relative path', undefined, { operationId: operation.operationId })
  }
  const names = pathTemplateNames(path)
  const declared = new Map((operation.parameters ?? []).filter((parameter) => parameter.in === 'path').map((parameter) => [parameter.name, parameter]))
  for (const name of names) if (!declared.has(name)) fail('PATH_INVALID', 'path template parameter is not declared', undefined, { parameter: name })
  assertDeclaredKeys(pathParams, new Set(declared.keys()), 'pathParams')
  assertRequiredParameters(pathParams, operation.parameters ?? [], 'path')
  let rendered
  try {
    rendered = path.replace(/\{([^{}]+)\}/g, (_whole, name) => {
      if (!Object.hasOwn(pathParams, name)) fail('MISSING_PARAMETER', `missing path parameter: ${name}`, '请使用 api_describe 检查必需 path 参数', { parameter: name })
      const parameter = declared.get(name)
      const value = pathParams[name]
      if (value === null || Array.isArray(value) || isRecord(value)) fail('PARAMETER_INVALID', `path parameter ${name} must be scalar`, undefined, { parameter: name })
      validateAgainstSchema(value, parameter.schema, `pathParams.${name}`)
      return encodeURIComponent(primitiveText(value, `pathParams.${name}`, { maxLength: EXECUTOR_MAX_PATH_VALUE_LENGTH }))
    })
  } catch (error) {
    if (error?.code) throw error
    fail('PARAMETER_INVALID', 'path parameter could not be encoded', undefined, { field: 'pathParams' })
  }
  return rendered
}

function appendQuery(url, values, parameters, authQuery = {}) {
  const declared = new Map(parameters.filter((parameter) => parameter.in === 'query').map((parameter) => [parameter.name, parameter]))
  assertDeclaredKeys(values, new Set(declared.keys()), 'query')
  assertRequiredParameters(values, parameters, 'query')
  for (const [name, value] of Object.entries(values)) {
    const parameter = declared.get(name)
    if (parameter === undefined) continue
    validateAgainstSchema(value, parameter.schema, `query.${name}`)
    const entries = Array.isArray(value) ? value : [value]
    if (entries.length > EXECUTOR_MAX_QUERY_ITEMS) fail('PARAMETER_INVALID', `query.${name} has too many values`, undefined, { parameter: name })
    for (const item of entries) {
      if (item === null || item === '' || (Array.isArray(item) || isRecord(item))) {
        if (parameter.allowEmptyValue === true && (item === null || item === '')) url.searchParams.append(name, '')
        else fail('PARAMETER_INVALID', `query.${name} must be a scalar value`, undefined, { parameter: name })
      } else url.searchParams.append(name, primitiveText(item, `query.${name}`))
    }
  }
  for (const [name, value] of Object.entries(authQuery)) {
    if (Object.hasOwn(values, name)) fail('AUTH_QUERY_CONFLICT', 'business query cannot override authentication query', undefined, { parameter: name })
    if (typeof value !== 'string' || CONTROL_CHARS.test(value)) fail('AUTH_RESOLUTION_FAILED', 'authentication query value is invalid')
    url.searchParams.append(name, value)
  }
}

function buildHeaders(values, parameters, authHeaders = {}) {
  const declared = new Map()
  for (const parameter of parameters.filter((item) => item.in === 'header')) {
    const lower = parameter.name.toLowerCase()
    if (CONTROLLED_HEADERS.has(lower)) fail('HEADER_CONFLICT', 'controlled headers cannot be declared as business parameters', undefined, { field: parameter.name })
    if (declared.has(lower)) fail('HEADER_CONFLICT', 'duplicate header parameter names are not supported', undefined, { field: parameter.name })
    declared.set(lower, parameter)
  }
  const result = {}
  const supplied = new Set()
  for (const [name, value] of Object.entries(values)) {
    const lower = name.toLowerCase()
    const parameter = declared.get(lower)
    if (!parameter) fail('INVALID_ARGUMENT', `headers.${name} is not declared by the Operation`, '请使用 api_describe 检查业务 Header 名称', { field: `headers.${name}` })
    if (supplied.has(lower)) fail('HEADER_CONFLICT', 'header names must not differ only by case', undefined, { field: name })
    supplied.add(lower)
    if (CONTROLLED_HEADERS.has(lower)) fail('HEADER_CONFLICT', 'controlled headers cannot be supplied', undefined, { field: name })
    validateAgainstSchema(value, parameter.schema, `headers.${name}`)
    result[parameter.name] = primitiveText(value, `headers.${name}`)
  }
  for (const [name, value] of Object.entries(authHeaders)) {
    if (typeof value !== 'string' || CONTROL_CHARS.test(value)) fail('AUTH_RESOLUTION_FAILED', 'authentication header value is invalid')
    const lower = name.toLowerCase()
    if (supplied.has(lower)) fail('AUTH_HEADER_CONFLICT', 'business headers cannot override authentication headers', undefined, { field: name })
    result[name] = value
  }
  return result
}

function isJsonContentType(contentType) {
  return typeof contentType === 'string' && JSON_CONTENT_TYPE.test(contentType.split(';', 1)[0].trim())
}

function decodeText(bytes) {
  try { return new TextDecoder('utf-8', { fatal: false }).decode(bytes) } catch { return String(bytes) }
}

function truncateText(text, maxBytes) {
  if (utf8Bytes(text) <= maxBytes) return { text, truncated: false }
  const encoded = new TextEncoder().encode(text).slice(0, Math.max(0, maxBytes))
  return { text: new TextDecoder('utf-8', { fatal: false }).decode(encoded), truncated: true }
}

function responseProjection(response, maxOutputBytes, operation) {
  const bytes = response?.body instanceof Uint8Array ? response.body : new Uint8Array(0)
  const contentType = typeof response?.contentType === 'string' ? response.contentType.toLowerCase() : ''
  const truncatedByTransport = response?.truncated === true || response?.tooLarge === true
  if (!contentType && bytes.byteLength === 0) return { response: { kind: 'text', text: '' }, truncated: truncatedByTransport, tooLarge: truncatedByTransport }
  if (!contentType || isJsonContentType(contentType) || TEXT_CONTENT_TYPE.test(contentType)) {
    const text = decodeText(bytes)
    if (isJsonContentType(contentType) && !truncatedByTransport) {
      try {
        const parsed = JSON.parse(text)
        const maxDepth = Number.isInteger(operation?.policy?.maxResponseDepth) ? operation.policy.maxResponseDepth : 8
        const maxArray = Number.isInteger(operation?.policy?.maxArrayItems) ? operation.policy.maxArrayItems : 200
        const normalized = normalizeJsonValue(parsed, { maxDepth, maxArray, maxBytes: maxOutputBytes })
        if (utf8Bytes(normalized) <= maxOutputBytes) return { response: { kind: 'json', data: normalized }, truncated: false, tooLarge: false }
      } catch {}
    }
    const bounded = truncateText(text, maxOutputBytes)
    return { response: { kind: 'text', text: bounded.text }, truncated: truncatedByTransport || bounded.truncated, tooLarge: truncatedByTransport || bounded.truncated }
  }
  return { response: { kind: 'text', text: '' }, truncated: truncatedByTransport, tooLarge: false, unsupported: true }
}

function responseResult(operationId, status, projection, durationMs, code, details) {
  return {
    ok: false,
    operationId,
    ...(status === undefined ? {} : { status }),
    response: projection.response,
    truncated: projection.truncated === true,
    durationMs,
    error: {
      code,
      message: errorMessage(code),
      ...(hintForCode(code) ? { hint: hintForCode(code) } : {}),
      ...(details === undefined ? {} : { details: safeDetails(details) }),
    },
  }
}

function responseSuccess(operationId, status, projection, durationMs) {
  return {
    ok: status >= 200 && status < 300,
    operationId,
    status,
    response: projection.response,
    truncated: projection.truncated === true,
    durationMs,
    ...(status >= 200 && status < 300 ? {} : { error: { code: 'HTTP_STATUS', message: errorMessage('HTTP_STATUS'), hint: '请根据 status 和响应内容修正参数或检查服务状态。', details: { status } } }),
  }
}

function combineSignal(upstream, timeoutMs) {
  const controller = new AbortController()
  let reason = ''
  const listeners = []
  const abort = (nextReason) => {
    if (controller.signal.aborted) return
    reason = nextReason
    controller.abort(nextReason)
  }
  if (upstream?.aborted) abort('aborted')
  else if (upstream?.addEventListener) {
    const listener = () => abort('aborted')
    upstream.addEventListener('abort', listener, { once: true })
    listeners.push(() => upstream.removeEventListener('abort', listener))
  }
  const timer = setTimeout(() => abort('timeout'), timeoutMs)
  return {
    signal: controller.signal,
    reason: () => reason,
    cleanup() {
      clearTimeout(timer)
      for (const dispose of listeners) dispose()
    },
  }
}

function activeKitConfirmationRequired(kit, operation) {
  if (operation.policy?.requiresConfirmation === true || kit.policy?.requiresConfirmation === true) return true
  const policy = isRecord(kit.operationPolicies) ? (kit.operationPolicies[operation.id] ?? kit.operationPolicies[operation.operationId]) : undefined
  return policy?.requiresConfirmation === true
}

async function findExecutionTarget(configuration, activation, operationId) {
  const operations = await configuration.listOperations()
  const operationSummary = (Array.isArray(operations) ? operations : []).find((item) => item.operationId === operationId)
  if (!operationSummary) return undefined
  const operation = typeof configuration.getOperation === 'function' ? await configuration.getOperation(operationSummary.id) : operationSummary
  const targets = await configuration.listServiceTargets()
  const target = (Array.isArray(targets) ? targets : []).find((item) => item.id === operation.serviceTargetId)
  const environment = (Array.isArray(activation.environments) ? activation.environments : []).find((item) => item.id === activation.environmentId)
  const kits = []
  for (const id of activation.activeKitIds) {
    const kit = await configuration.getKit(id)
    if (kit) kits.push(kit)
  }
  const discoverableKits = kits.filter((kit) => operationDiscoverable(operation, kit, { serviceTarget: target, environmentId: activation.environmentId }))
  if (!target || !environment || discoverableKits.length === 0) return undefined
  return { operation, target, environment, kits: discoverableKits }
}

function validateEnvironment(environment) {
  if (!isRecord(environment) || typeof environment.baseUrl !== 'string' || !environment.baseUrl) fail('URL_INVALID', 'selected Environment has no valid baseUrl')
  let base
  try { base = new URL(environment.baseUrl) } catch { fail('URL_INVALID', 'selected Environment baseUrl is invalid') }
  if (!URL_PROTOCOLS.has(base.protocol) || base.username || base.password || base.search || base.hash) fail('URL_INVALID', 'selected Environment baseUrl is not a safe HTTP URL')
  const host = normalizeHost(base.hostname)
  const allowedHosts = new Set((Array.isArray(environment.allowedHosts) ? environment.allowedHosts : []).map((value) => normalizeHost(value)).filter(Boolean))
  if (!host || !allowedHosts.has(host)) fail('HOST_NOT_ALLOWED', 'selected Environment baseUrl host is not allowlisted', undefined, { host, environmentId: environment.id })
  const actualPort = base.port ? Number(base.port) : (base.protocol === 'https:' ? 443 : 80)
  if (Number.isInteger(environment.port) && environment.port > 0 && actualPort !== environment.port) fail('PORT_NOT_ALLOWED', 'selected Environment port does not match its registered port', undefined, { environmentId: environment.id })
  return { base, host }
}

function buildUrl(environment, operation, path) {
  const { base, host } = validateEnvironment(environment)
  const basePath = base.pathname.replace(/\/+$/, '')
  const joinedPath = `${basePath}${path}`.replace(/\/+/g, '/') || '/'
  let url
  try { url = new URL(`${base.origin}${joinedPath}`) } catch { fail('URL_INVALID', 'fixed Operation URL could not be constructed') }
  if (!URL_PROTOCOLS.has(url.protocol) || normalizeHost(url.hostname) !== host) fail('HOST_NOT_ALLOWED', 'fixed Operation URL changed its registered host', undefined, { host })
  if (url.toString().length > MAX_URL_LENGTH) fail('URL_TOO_LONG', 'fixed Operation URL exceeds the supported length', undefined, { maxBytes: MAX_URL_LENGTH })
  return url
}

function durationBetween(clock, started) {
  const value = Number(clock()) - started
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
}

export function createApiKitHttpExecutor(configuration, options = {}) {
  if (!configuration || typeof configuration.resolveSessionActivation !== 'function') throw new TypeError('configuration service is required')
  const transport = options.transport ?? createFetchTransport({ fetchImpl: options.fetchImpl })
  if (!transport || typeof transport.request !== 'function') throw new TypeError('transport.request is required')
  const clock = typeof options.clock === 'function' ? options.clock : () => Date.now()
  const hardOutputBytes = Number.isInteger(options.maxOutputBytes) && options.maxOutputBytes > 0
    ? Math.min(options.maxOutputBytes, EXECUTOR_MAX_OUTPUT_BYTES)
    : EXECUTOR_MAX_OUTPUT_BYTES
  const onAudit = typeof options.onAudit === 'function' ? options.onAudit : undefined

  const execute = async (args, exec = {}) => {
    let operationId
    let started = clock()
    let outcome
    let auditRecord
    try {
      if (exec?.signal?.aborted) return envelopeError('ABORTED')
      if (!isRecord(args)) return envelopeError('INVALID_ARGUMENT')
      assertKnownTopLevel(args)
      operationId = normalizeOperationId(args)
      const sessionId = requiredSessionId(exec)
      if (!sessionId) return envelopeError('SESSION_ID_REQUIRED')
      let activation
      try { activation = configuration.resolveSessionActivation(sessionId) } catch (error) {
        return envelopeError(typeof error?.code === 'string' ? error.code : 'SESSION_ACTIVATION_INVALID', safeDetails(error?.detail))
      }
      if (!activation?.valid) return envelopeError('SESSION_ACTIVATION_INVALID')
      if (!Array.isArray(activation.activeKitIds) || activation.activeKitIds.length === 0) return envelopeError('KIT_NOT_ACTIVE')

      const known = (await configuration.listOperations()).find((item) => item.operationId === operationId)
      if (known && !READ_METHODS.includes(normalizeMethod(known.method))) return envelopeError('METHOD_NOT_ALLOWED', { operationId })
      const scope = await findExecutionTarget(configuration, activation, operationId)
      if (!scope) return envelopeError('OPERATION_NOT_FOUND', { operationId })
      const { operation, target, environment, kits } = scope
      if (target.enabled !== true) return envelopeError('TARGET_DISABLED', { serviceTargetId: target.id })
      if (target.agentEnabled !== true) return envelopeError('TARGET_AGENT_DISABLED', { serviceTargetId: target.id })
      const method = normalizeMethod(operation.method)
      if (!READ_METHODS.includes(method)) return envelopeError('METHOD_NOT_ALLOWED', { operationId })
      const confirmingKit = kits.find((kit) => activeKitConfirmationRequired(kit, operation))
      if (confirmingKit) return envelopeError('CONFIRMATION_REQUIRED', { operationId })
      if ((operation.parameters ?? []).some((parameter) => parameter.in === 'cookie')) return envelopeError('PARAMETER_NOT_SUPPORTED', { field: 'cookie' })

      if (Object.hasOwn(args, 'body')) return envelopeError('BODY_NOT_SUPPORTED', { operationId })
      if (operation.requestBody?.required === true) return envelopeError('BODY_NOT_SUPPORTED', { operationId })
      const pathParams = normalizeObject(args.pathParams, 'pathParams')
      const query = normalizeObject(args.query, 'query')
      const headers = normalizeObject(args.headers, 'headers')
      const renderedPath = buildPath(operation, pathParams)
      const url = buildUrl(environment, operation, renderedPath)

      let auth = { headers: {}, query: {} }
      if (operation.authProfileId) {
        if (Array.isArray(target.authProfileIds) && target.authProfileIds.length > 0 && !target.authProfileIds.includes(operation.authProfileId)) return envelopeError('AUTH_PROFILE_NOT_ALLOWED', { operationId })
        try { auth = await configuration.resolveAuthForRequest(operation.authProfileId) } catch (error) {
          const code = ['AUTH_PROFILE_NOT_FOUND', 'CREDENTIAL_NOT_CONFIGURED', 'QUERY_AUTH_DISABLED'].includes(error?.code) ? error.code : 'AUTH_RESOLUTION_FAILED'
          return envelopeError(code)
        }
      }

      appendQuery(url, query, operation.parameters ?? [], auth.query ?? {})
      const requestHeaders = buildHeaders(headers, operation.parameters ?? [], auth.headers ?? {})
      // Authentication query/header names are controlled by the Host profile;
      // reject reserved names even if a custom adapter returns them.
      for (const name of Object.keys(auth.query ?? {})) {
        if (CONTROLLED_HEADERS.has(name.toLowerCase())) return envelopeError('AUTH_QUERY_CONFLICT', { field: name })
      }

      const operationTimeout = Number.isInteger(operation.policy?.timeoutMs) ? operation.policy.timeoutMs : 15000
      const environmentTimeout = Number.isInteger(environment.timeoutMs) ? environment.timeoutMs : 15000
      const timeoutMs = Math.max(1, Math.min(EXECUTOR_MAX_DURATION_MS, operationTimeout, environmentTimeout))
      const operationLimit = Number.isInteger(operation.policy?.maxResponseBytes) ? operation.policy.maxResponseBytes : EXECUTOR_MAX_OUTPUT_BYTES
      const environmentLimit = Number.isInteger(environment.maxResponseBytes) ? environment.maxResponseBytes : EXECUTOR_MAX_OUTPUT_BYTES
      const maxResponseBytes = Math.max(1, Math.min(EXECUTOR_MAX_OUTPUT_BYTES, operationLimit, environmentLimit, hardOutputBytes))
      const combined = combineSignal(exec?.signal, timeoutMs)
      try {
        const response = await transport.request({
          url: url.toString(),
          method,
          headers: requestHeaders,
          signal: combined.signal,
          maxResponseBytes,
          maxRedirects: 0,
        })
        const durationMs = durationBetween(clock, started)
        const projection = responseProjection(response, maxResponseBytes, operation)
        const status = Number.isInteger(response?.status) ? response.status : 0
        auditRecord = { operationId, method, environmentId: environment.id, serviceTargetId: target.id, status, durationMs, truncated: projection.truncated === true }
        if (projection.unsupported) outcome = responseResult(operationId, status, projection, durationMs, 'RESPONSE_UNSUPPORTED')
        else if (projection.tooLarge) outcome = responseResult(operationId, status, projection, durationMs, 'RESPONSE_TOO_LARGE', { maxBytes: maxResponseBytes })
        else outcome = responseSuccess(operationId, status, projection, durationMs)
        if (combined.reason() === 'timeout') outcome = responseResult(operationId, status, projection, durationMs, 'REQUEST_TIMEOUT')
        else if (combined.reason() === 'aborted') outcome = responseResult(operationId, status, projection, durationMs, 'ABORTED')
        return outcome
      } catch (error) {
        const durationMs = durationBetween(clock, started)
        const reason = combined.reason()
        const code = reason === 'timeout' ? 'REQUEST_TIMEOUT' : reason === 'aborted' || error?.code === 'ABORTED' ? 'ABORTED' : (SAFE_ERROR_CODES.has(error?.code) ? error.code : 'NETWORK_ERROR')
        outcome = {
          ok: false,
          operationId,
          durationMs,
          error: { code, message: errorMessage(code), ...(hintForCode(code) ? { hint: hintForCode(code) } : {}) },
        }
        auditRecord = { operationId, method, environmentId: environment.id, serviceTargetId: target.id, durationMs, errorCode: code }
        return outcome
      } finally {
        combined.cleanup()
      }
    } catch (error) {
      const code = SAFE_ERROR_CODES.has(error?.code) ? error.code : error instanceof ConfigurationError || error instanceof CredentialAdapterError ? (typeof error.code === 'string' ? error.code : 'REQUEST_FAILED') : 'REQUEST_FAILED'
      outcome = envelopeError(code, error?.details ?? error?.detail)
      if (operationId) outcome.operationId = operationId
      return outcome
    } finally {
      if (auditRecord && onAudit) {
        try { await onAudit({ ...auditRecord, ok: outcome?.ok === true }) } catch {}
      }
    }
  }

  return Object.freeze({ execute, maxOutputBytes: hardOutputBytes })
}

export { appendQuery, buildHeaders, buildPath, buildUrl, responseProjection, validateAgainstSchema, findExecutionTarget }
