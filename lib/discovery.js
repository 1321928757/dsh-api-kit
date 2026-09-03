/**
 * Host-owned discovery and description surface for the fixed api_* tools.
 *
 * This module is deliberately independent from Cordis and the model-tool
 * registry. It resolves the current session activation on every call, applies
 * the Kit/Operation policy intersection, and returns only owned JSON views.
 * T07 never constructs or sends an HTTP request.
 */

import {
  READ_METHODS,
  WRITE_METHODS,
} from './model.js'
import { ConfigurationError } from './config-validation.js'
import { isRecord, lowercaseIdentifier, normalizeMethod } from './normalizers.js'
import { serviceTargetCoversEnvironment } from './session-selection.js'

export const DISCOVERY_MAX_OUTPUT_BYTES = 64 * 1024
export const DISCOVERY_MAX_KITS = 200
export const DISCOVERY_MAX_ENVIRONMENTS = 200
export const DISCOVERY_DEFAULT_OPERATION_LIMIT = 20
export const DISCOVERY_MAX_OPERATION_LIMIT = 100
export const DISCOVERY_MAX_OFFSET = 100000
export const DISCOVERY_MAX_QUERY_LENGTH = 256
export const DISCOVERY_MAX_OPERATION_ID_LENGTH = 128
export const DISCOVERY_MAX_DESCRIPTION_LENGTH = 800
export const DISCOVERY_MAX_SCHEMA_PREVIEW_BYTES = 4096

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/
const SAFE_METHODS = new Set([...READ_METHODS, ...WRITE_METHODS, 'OPTIONS'])

function cloneJson(value) {
  if (value === undefined) return undefined
  try { return JSON.parse(JSON.stringify(value)) } catch { return undefined }
}

function utf8Bytes(value) {
  const text = JSON.stringify(value)
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).length
  return text.length
}

function boundedText(value, max = DISCOVERY_MAX_DESCRIPTION_LENGTH) {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max)
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

function unexpectedError(error) {
  if (error instanceof ConfigurationError) {
    return issue(
      typeof error.code === 'string' ? error.code : 'DISCOVERY_FAILED',
      typeof error.message === 'string' && error.message ? error.message : 'API Kit discovery failed',
      hintForCode(error.code),
      safeErrorDetails(error.detail),
    )
  }
  return issue('DISCOVERY_FAILED', 'API Kit discovery failed; retry after checking the current API Kit configuration', '请检查当前会话的 API 套件和环境选择后重试')
}

function safeErrorDetails(value) {
  if (!isRecord(value)) return undefined
  const result = {}
  for (const key of ['id', 'sessionId', 'issue', 'availableEnvironmentIds', 'references']) {
    if (value[key] !== undefined) result[key] = cloneJson(value[key])
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function hintForCode(code) {
  const hints = {
    SESSION_ID_REQUIRED: '工具执行需要当前 Agent 会话；请在正常会话中重试。',
    KIT_NOT_ACTIVE: '请先在输入栏激活一个 API 套件，再使用 api_operations 或 api_describe。',
    KIT_DISABLED: '请在设置中重新启用该 API 套件，然后重新激活会话。',
    KIT_AGENT_DISABLED: '请在设置中允许该 API 套件供 Agent 使用，然后重新激活会话。',
    ENVIRONMENT_DISABLED: '请在设置中启用所选环境，或切换到其他环境。',
    ENVIRONMENT_AGENT_DISABLED: '请在设置中允许所选环境供 Agent 使用，生产环境需要显式开启。',
    ENVIRONMENT_NOT_COMPATIBLE: '请在当前会话选择所有激活套件共同支持的环境。',
    NO_COMMON_ENVIRONMENT: '请减少激活套件，或为它们配置一个共同环境。',
    OPERATION_NOT_FOUND: '请先使用 api_operations 重新发现当前会话可用的 Operation。',
    DESCRIPTION_TOO_LARGE: '请让管理员拆分或缩小该 Operation 的 Schema 后再描述。',
  }
  return hints[code]
}

function requiredSessionId(exec) {
  const value = exec?.agent?.id
  if (typeof value !== 'string' || !value.trim() || value.length > 256 || CONTROL_CHARS.test(value)) return undefined
  return value.trim()
}

function validateOptionalText(value, field, max = DISCOVERY_MAX_QUERY_LENGTH) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || value.length > max || CONTROL_CHARS.test(value)) {
    return { error: issue('INVALID_ARGUMENT', `${field} must be a bounded string`, `请缩短 ${field} 后重试`) }
  }
  const result = value.trim()
  return result ? { value: result } : { value: undefined }
}

function normalizeServiceTargetFilter(value) {
  const checked = validateOptionalText(value, 'serviceTargetId', 128)
  if (checked === undefined || checked.error) return checked
  if (checked.value === undefined) return checked
  const normalized = lowercaseIdentifier(checked.value, '')
  if (!normalized) return { error: issue('INVALID_ARGUMENT', 'serviceTargetId must be a safe identifier') }
  return { value: normalized }
}

function normalizeOperationSearchArgs(args) {
  const value = isRecord(args) ? args : {}
  const query = validateOptionalText(value.query, 'query')
  if (query?.error) return query
  const tag = validateOptionalText(value.tag, 'tag', 80)
  if (tag?.error) return tag
  const serviceTargetId = normalizeServiceTargetFilter(value.serviceTargetId)
  if (serviceTargetId?.error) return serviceTargetId

  let method
  if (value.method !== undefined && value.method !== null && value.method !== '') {
    if (typeof value.method !== 'string' || value.method.length > 16 || CONTROL_CHARS.test(value.method)) {
      return { error: issue('INVALID_ARGUMENT', 'method must be one supported HTTP method') }
    }
    method = normalizeMethod(value.method)
    if (!SAFE_METHODS.has(method)) return { error: issue('INVALID_ARGUMENT', 'method must be one of GET, HEAD, POST, PUT, PATCH, DELETE or OPTIONS') }
  }

  let offset = 0
  if (value.offset !== undefined) {
    if (typeof value.offset !== 'number' || !Number.isInteger(value.offset) || value.offset < 0 || value.offset > DISCOVERY_MAX_OFFSET) {
      return { error: issue('INVALID_ARGUMENT', `offset must be an integer from 0 to ${DISCOVERY_MAX_OFFSET}`) }
    }
    offset = value.offset
  }

  let limit = DISCOVERY_DEFAULT_OPERATION_LIMIT
  if (value.limit !== undefined) {
    if (typeof value.limit !== 'number' || !Number.isInteger(value.limit) || value.limit < 1 || value.limit > DISCOVERY_MAX_OPERATION_LIMIT) {
      return { error: issue('INVALID_ARGUMENT', `limit must be an integer from 1 to ${DISCOVERY_MAX_OPERATION_LIMIT}`) }
    }
    limit = value.limit
  }
  return { value: { query: query?.value?.toLowerCase(), tag: tag?.value?.toLowerCase(), method, serviceTargetId: serviceTargetId?.value, offset, limit } }
}

function normalizeOperationIdArgs(args) {
  const value = isRecord(args) ? args : {}
  if (typeof value.operationId !== 'string' || !value.operationId.trim() || value.operationId.length > DISCOVERY_MAX_OPERATION_ID_LENGTH || CONTROL_CHARS.test(value.operationId)) {
    return { error: issue('INVALID_ARGUMENT', 'operationId must be a bounded non-empty string', '请传入 api_operations 返回的稳定 operationId') }
  }
  return { value: value.operationId.trim() }
}

function isWriteMethod(method) {
  return !READ_METHODS.includes(method)
}

function includesId(values, id) {
  return Array.isArray(values) && values.includes(id)
}

function policyAllowsMethod(policy, method) {
  if (!isRecord(policy)) return false
  return !Array.isArray(policy.allowMethods) || policy.allowMethods.length === 0 || policy.allowMethods.includes(method)
}

function kitOperationPolicy(kit, operation) {
  const policies = isRecord(kit?.operationPolicies) ? kit.operationPolicies : {}
  return policies[operation.id] ?? policies[operation.operationId]
}

/**
 * Apply the operation policy and the active Kit policy as an intersection.
 * A Kit policy can only narrow an Operation; it can never grant a disabled or
 * non-Agent operation. The selected environment/target checks are included so
 * discovery cannot describe an operation that a future fixed executor cannot
 * resolve.
 */
export function operationDiscoverable(operation, kit, options = {}) {
  if (!isRecord(operation) || !isRecord(kit)) return false
  if (kit.enabled !== true || kit.agentEnabled !== true) return false
  if (operation.enabled !== true) return false
  if (operation.policy?.allowAgentCall !== true) return false
  const method = normalizeMethod(operation.method)
  if (!SAFE_METHODS.has(method) || !policyAllowsMethod(operation.policy, method)) return false
  if (!includesId(kit.operationIds, operation.id)) return false

  if (Array.isArray(kit.serviceTargetIds) && kit.serviceTargetIds.length > 0 && !kit.serviceTargetIds.includes(operation.serviceTargetId)) return false
  if (options.environmentId !== undefined && options.environmentId !== null && Array.isArray(kit.environmentIds) && kit.environmentIds.length > 0 && !kit.environmentIds.includes(options.environmentId)) return false
  const target = options.serviceTarget
  if (!target || target.enabled !== true || target.agentEnabled !== true) return false
  if (options.environmentId !== undefined && options.environmentId !== null && !serviceTargetCoversEnvironment(target, options.environmentId)) return false

  const kitPolicy = isRecord(kit.policy) ? kit.policy : {}
  if (READ_METHODS.includes(method)) {
    if (Array.isArray(kitPolicy.allowReadMethods) && kitPolicy.allowReadMethods.length > 0 && !kitPolicy.allowReadMethods.includes(method)) return false
  } else {
    if (operation.policy.allowWrite !== true || kitPolicy.allowWrite !== true) return false
    if (Array.isArray(kitPolicy.allowWriteMethods) && kitPolicy.allowWriteMethods.length > 0 && !kitPolicy.allowWriteMethods.includes(method)) return false
  }

  const extraPolicy = kitOperationPolicy(kit, operation)
  if (extraPolicy !== undefined) {
    if (extraPolicy.allowAgentCall !== true || !policyAllowsMethod(extraPolicy, method)) return false
    if (isWriteMethod(method) && extraPolicy.allowWrite !== true) return false
  }
  return true
}

function operationRisk(operation, kitDetails) {
  const method = normalizeMethod(operation.method)
  const policies = kitDetails.map((kit) => kitOperationPolicy(kit, operation)).filter(Boolean)
  return {
    readOnly: READ_METHODS.includes(method),
    requiresConfirmation: operation.policy?.requiresConfirmation === true || policies.some((policy) => policy.requiresConfirmation === true) || kitDetails.some((kit) => kit.policy?.requiresConfirmation === true),
    writeAllowed: operation.policy?.allowWrite === true && kitDetails.some((kit) => kit.policy?.allowWrite === true),
  }
}

function compactSchema(value) {
  if (value === undefined) return undefined
  if (typeof value === 'boolean') return value
  if (!isRecord(value)) return {}
  const copied = cloneJson(value)
  if (copied === undefined) return {}
  if (utf8Bytes(copied) <= DISCOVERY_MAX_SCHEMA_PREVIEW_BYTES) return copied
  const preview = {}
  for (const key of ['type', 'enum', 'const', 'required', 'description']) {
    if (copied[key] !== undefined) preview[key] = cloneJson(copied[key])
  }
  preview.truncated = true
  return preview
}

function requiredParameterPreview(parameter) {
  const result = {
    name: boundedText(parameter?.name, 256),
    in: boundedText(parameter?.in, 32),
    schema: compactSchema(parameter?.schema),
  }
  if (parameter?.description) result.description = boundedText(parameter.description, 400)
  return result
}

function operationListItem(operation, activeKitIds, kitDetails = []) {
  const risk = operationRisk(operation, kitDetails)
  const requiredParameters = Array.isArray(operation.requiredParameters)
    ? operation.requiredParameters.slice(0, 100).map(requiredParameterPreview)
    : []
  return {
    id: operation.id,
    operationId: operation.operationId,
    name: boundedText(operation.name, 160),
    summary: boundedText(operation.summary, 500),
    method: operation.method,
    path: operation.path,
    tags: Array.isArray(operation.tags) ? operation.tags.slice(0, 50).map((tag) => boundedText(tag, 80)) : [],
    serviceTargetId: operation.serviceTargetId,
    ...(operation.serviceTargetName ? { serviceTargetName: boundedText(operation.serviceTargetName, 160) } : {}),
    activeKitIds: [...activeKitIds],
    readOnly: risk.readOnly,
    requiresConfirmation: operation.policy?.requiresConfirmation === true,
    requiredParameters,
  }
}

function projectEnvironment(environment, activation) {
  return {
    id: environment.id,
    name: boundedText(environment.name, 160),
    description: boundedText(environment.description),
    production: environment.production === true,
    enabled: environment.enabled === true,
    agentEnabled: environment.agentEnabled === true,
    selectable: environment.selectable === true,
    compatible: environment.compatible === true,
    active: activation.environmentId === environment.id,
  }
}

function projectKit(kit, activation, counts) {
  return {
    id: kit.id,
    name: boundedText(kit.name, 160),
    description: boundedText(kit.description),
    project: boundedText(kit.project, 160),
    tags: Array.isArray(kit.tags) ? kit.tags.slice(0, 50).map((tag) => boundedText(tag, 80)) : [],
    active: activation.activeKitIds.includes(kit.id),
    selectable: kit.selectable === true,
    operationCount: Number.isInteger(kit.operationCount) ? kit.operationCount : 0,
    enabledOperationCount: Number.isInteger(kit.enabledOperationCount) ? kit.enabledOperationCount : 0,
    discoverableOperationCount: counts.discoverableOperationCount,
    readOperationCount: counts.readOperationCount,
    writeOperationCount: counts.writeOperationCount,
    environmentNames: Array.isArray(kit.environmentNames) ? kit.environmentNames.slice(0, 50).map((name) => boundedText(name, 160)) : [],
  }
}

function fitKitPayload(base, kits, environments, maxOutputBytes) {
  const result = { ...base, kits, environments }
  return utf8Bytes(result) <= maxOutputBytes
}

async function listOperations(configuration) {
  return await configuration.listOperations()
}

async function listTargets(configuration) {
  return await configuration.listServiceTargets()
}

async function getActiveKitDetails(configuration, activation) {
  const result = []
  for (const id of activation.activeKitIds) {
    const kit = await configuration.getKit(id)
    if (kit) result.push(kit)
  }
  return result
}

async function collectDiscoverable(configuration, activation, options = {}) {
  const [operations, targets, activeKitDetails] = await Promise.all([
    listOperations(configuration),
    listTargets(configuration),
    getActiveKitDetails(configuration, activation),
  ])
  const selectedEnvironment = Array.isArray(activation.environments)
    ? activation.environments.find((environment) => environment.id === activation.environmentId)
    : undefined
  if (!selectedEnvironment || selectedEnvironment.enabled !== true || selectedEnvironment.agentEnabled !== true) return { operations, targets, targetById: new Map(), activeKitDetails, found: [] }
  const targetById = new Map((Array.isArray(targets) ? targets : []).map((target) => [target.id, target]))
  const found = []
  for (const operation of Array.isArray(operations) ? operations : []) {
    if (options.operationId !== undefined && operation.operationId !== options.operationId) continue
    const activeKitIds = []
    for (const kit of activeKitDetails) {
      const target = targetById.get(operation.serviceTargetId)
      if (operationDiscoverable(operation, kit, { serviceTarget: target, environmentId: activation.environmentId })) activeKitIds.push(kit.id)
    }
    if (activeKitIds.length > 0) found.push({ operation, activeKitIds, kitDetails: activeKitDetails.filter((kit) => activeKitIds.includes(kit.id)) })
  }
  return { operations, targets, targetById, activeKitDetails, found }
}

async function executeWithSession(configuration, exec, handler) {
  const sessionId = requiredSessionId(exec)
  if (!sessionId) return issue('SESSION_ID_REQUIRED', '当前工具调用缺少有效的 Agent 会话标识', '请在正常 DSH 会话中重试')
  if (exec?.signal?.aborted) return issue('ABORTED', '工具调用已取消，请重试')
  try {
    const activation = configuration.resolveSessionActivation(sessionId)
    if (!activation?.valid) return issue('SESSION_ACTIVATION_INVALID', '当前会话的 API 套件选择已失效', '请在输入栏重新选择 API 套件和环境')
    const result = await handler(sessionId, activation)
    if (exec?.signal?.aborted) return issue('ABORTED', '工具调用已取消，请重试')
    return result
  } catch (error) {
    return unexpectedError(error)
  }
}

export function createApiKitDiscoveryService(configuration, options = {}) {
  if (!configuration || typeof configuration.resolveSessionActivation !== 'function') throw new TypeError('configuration service is required')
  const maxOutputBytes = Number.isInteger(options.maxOutputBytes) && options.maxOutputBytes > 0
    ? Math.min(options.maxOutputBytes, DISCOVERY_MAX_OUTPUT_BYTES)
    : DISCOVERY_MAX_OUTPUT_BYTES

  const apiKits = async (exec) => executeWithSession(configuration, exec, async (_sessionId, activation) => {
    const [targets, operations] = await Promise.all([listTargets(configuration), listOperations(configuration)])
    const targetById = new Map((Array.isArray(targets) ? targets : []).map((target) => [target.id, target]))
    const kits = Array.isArray(activation.kits) ? activation.kits : []
    const kitItems = []
    for (const kit of kits.slice(0, DISCOVERY_MAX_KITS)) {
      const eligibleOperations = (Array.isArray(operations) ? operations : []).filter((operation) => {
        const target = targetById.get(operation.serviceTargetId)
        return operationDiscoverable(operation, kit, { serviceTarget: target, environmentId: activation.environmentId })
      })
      const readOperationCount = eligibleOperations.filter((operation) => READ_METHODS.includes(operation.method)).length
      const writeOperationCount = eligibleOperations.filter((operation) => !READ_METHODS.includes(operation.method)).length
      kitItems.push(projectKit(kit, activation, {
        discoverableOperationCount: eligibleOperations.length,
        readOperationCount,
        writeOperationCount,
      }))
    }
    const environmentItems = (Array.isArray(activation.environments) ? activation.environments : [])
      .slice(0, DISCOVERY_MAX_ENVIRONMENTS)
      .map((environment) => projectEnvironment(environment, activation))
    const base = {
      sessionId: activation.sessionId,
      activeKitIds: [...activation.activeKitIds],
      environmentId: activation.environmentId,
      environmentName: activation.environmentId === null ? null : (environmentItems.find((item) => item.id === activation.environmentId)?.name ?? null),
      production: activation.environmentId === null ? false : environmentItems.find((item) => item.id === activation.environmentId)?.production === true,
      availableEnvironmentIds: Array.isArray(activation.availableEnvironmentIds) ? [...activation.availableEnvironmentIds] : [],
      rules: [
        '先使用 api_operations 发现当前激活套件内的 Operation，再使用 api_describe 获取完整调用说明；T07 不发起 HTTP 请求。',
        '默认只读；不得猜测 URL、主机或凭据，后续调用必须使用已登记的 Operation 和 Environment。',
      ],
      truncated: false,
    }
    let fittedKits = []
    let fittedEnvironments = []
    for (const kit of kitItems) {
      if (!fitKitPayload({ ...base, totalKitCount: kits.length, totalEnvironmentCount: environmentItems.length }, [...fittedKits, kit], fittedEnvironments, maxOutputBytes)) break
      fittedKits.push(kit)
    }
    for (const environment of environmentItems) {
      if (!fitKitPayload({ ...base, totalKitCount: kits.length, totalEnvironmentCount: environmentItems.length }, fittedKits, [...fittedEnvironments, environment], maxOutputBytes)) break
      fittedEnvironments.push(environment)
    }
    const truncated = fittedKits.length < kits.length || fittedEnvironments.length < environmentItems.length
    const result = {
      ...base,
      kits: fittedKits,
      environments: fittedEnvironments,
      totalKitCount: kits.length,
      totalEnvironmentCount: environmentItems.length,
      truncated,
    }
    if (utf8Bytes(result) > maxOutputBytes) return issue('RESULT_TOO_LARGE', 'API Kit discovery result exceeds the safe output limit', '请减少 API Kit 数量或缩短描述')
    return { ok: true, ...result }
  })

  const apiOperations = async (args, exec) => executeWithSession(configuration, exec, async (_sessionId, activation) => {
    if (activation.activeKitIds.length === 0) return issue('KIT_NOT_ACTIVE', '当前会话尚未激活 API 套件', '请先在输入栏激活至少一个 API 套件')
    const normalized = normalizeOperationSearchArgs(args)
    if (normalized.error) return normalized.error
    const scope = await collectDiscoverable(configuration, activation)
    const filtered = scope.found.filter(({ operation }) => {
      if (normalized.value.method && operation.method !== normalized.value.method) return false
      if (normalized.value.serviceTargetId && operation.serviceTargetId !== normalized.value.serviceTargetId) return false
      if (normalized.value.tag && !(operation.tags ?? []).some((tag) => String(tag).toLowerCase() === normalized.value.tag)) return false
      if (normalized.value.query) {
        const haystack = [operation.id, operation.operationId, operation.name, operation.summary, operation.description, operation.path, ...(operation.tags ?? [])]
          .join('\u0000').toLowerCase()
        if (!haystack.includes(normalized.value.query)) return false
      }
      return true
    })
    const totalCount = filtered.length
    const page = []
    const end = Math.min(totalCount, normalized.value.offset + normalized.value.limit)
    let sizeTruncated = false
    for (let index = normalized.value.offset; index < end; index += 1) {
      const candidate = operationListItem(filtered[index].operation, filtered[index].activeKitIds, filtered[index].kitDetails)
      const prospective = {
        ok: true,
        operations: [...page, candidate],
        totalCount,
        offset: normalized.value.offset,
        limit: normalized.value.limit,
        returnedCount: page.length + 1,
        truncated: false,
      }
      if (utf8Bytes(prospective) > maxOutputBytes) {
        sizeTruncated = true
        break
      }
      page.push(candidate)
    }
    if (page.length === 0 && normalized.value.offset < totalCount) return issue('RESULT_TOO_LARGE', 'Operation discovery item exceeds the safe output limit', '请缩小 Operation 参数 Schema 或使用更窄的筛选条件')
    const truncated = sizeTruncated || normalized.value.offset + page.length < totalCount
    const result = {
      ok: true,
      operations: page,
      totalCount,
      offset: normalized.value.offset,
      limit: normalized.value.limit,
      returnedCount: page.length,
      truncated,
      ...(page.length < totalCount ? { nextOffset: normalized.value.offset + page.length } : {}),
      ...(totalCount === 0 ? { notice: '当前激活套件没有符合条件且允许 Agent 发现的 Operation。' } : {}),
    }
    if (utf8Bytes(result) > maxOutputBytes) return issue('RESULT_TOO_LARGE', 'Operation discovery result exceeds the safe output limit', '请使用 query、tag、method 或分页缩小结果')
    return result
  })

  const apiDescribe = async (args, exec) => executeWithSession(configuration, exec, async (_sessionId, activation) => {
    if (activation.activeKitIds.length === 0) return issue('KIT_NOT_ACTIVE', '当前会话尚未激活 API 套件', '请先在输入栏激活至少一个 API 套件')
    const normalized = normalizeOperationIdArgs(args)
    if (normalized.error) return normalized.error
    const scope = await collectDiscoverable(configuration, activation, { operationId: normalized.value })
    const candidate = scope.found[0]
    if (!candidate) return issue('OPERATION_NOT_FOUND', 'Operation 不存在、已禁用，或不在当前会话的 Agent 暴露范围内', hintForCode('OPERATION_NOT_FOUND'), { operationId: normalized.value })

    const operation = await configuration.getOperation(candidate.operation.id)
    if (!operation || operation.operationId !== normalized.value) return issue('OPERATION_NOT_FOUND', 'Operation 不存在、已禁用，或不在当前会话的 Agent 暴露范围内', hintForCode('OPERATION_NOT_FOUND'), { operationId: normalized.value })
    const target = scope.targetById.get(operation.serviceTargetId)
    if (!operationDiscoverable(operation, candidate.kitDetails[0], { serviceTarget: target, environmentId: activation.environmentId })) {
      return issue('OPERATION_NOT_FOUND', 'Operation 不存在、已禁用，或不在当前会话的 Agent 暴露范围内', hintForCode('OPERATION_NOT_FOUND'), { operationId: normalized.value })
    }

    let auth
    if (operation.authProfileId && typeof configuration.getAuthProfile === 'function') {
      try { auth = await configuration.getAuthProfile(operation.authProfileId) } catch {}
    }
    const selectedEnvironment = Array.isArray(activation.environments)
      ? activation.environments.find((environment) => environment.id === activation.environmentId)
      : undefined
    const risk = operationRisk(operation, candidate.kitDetails)
    const parameters = Array.isArray(operation.parameters)
      ? operation.parameters.slice(0, 100).map((parameter) => ({
        name: parameter.name,
        in: parameter.in,
        required: parameter.required === true,
        description: boundedText(parameter.description, 1000),
        schema: cloneJson(parameter.schema),
        ...(parameter.example === undefined ? {} : { example: cloneJson(parameter.example) }),
        deprecated: parameter.deprecated === true,
        allowEmptyValue: parameter.allowEmptyValue === true,
      }))
      : []
    const requestBody = operation.requestBody === null ? null : {
      required: operation.requestBody?.required === true,
      contentTypes: Array.isArray(operation.requestBody?.contentTypes) ? [...operation.requestBody.contentTypes] : [],
      schema: cloneJson(operation.requestBody?.schema ?? {}),
      ...(operation.requestBody?.example === undefined ? {} : { example: cloneJson(operation.requestBody.example) }),
      description: boundedText(operation.requestBody?.description, 1000),
    }
    const responses = Array.isArray(operation.responses) ? operation.responses.slice(0, 100).map((response) => ({
      status: response.status,
      description: boundedText(response.description, 1000),
      contentTypes: Array.isArray(response.contentTypes) ? [...response.contentTypes] : [],
      schema: cloneJson(response.schema),
      ...(response.example === undefined ? {} : { example: cloneJson(response.example) }),
    })) : []
    const result = {
      ok: true,
      operation: {
        id: operation.id,
        operationId: operation.operationId,
        name: boundedText(operation.name, 160),
        summary: boundedText(operation.summary, 1000),
        description: boundedText(operation.description, 4000),
        method: operation.method,
        path: operation.path,
        tags: Array.isArray(operation.tags) ? [...operation.tags] : [],
        parameters,
        requestBody,
        responses,
        security: Array.isArray(operation.security) ? [...operation.security] : [],
        serviceTarget: target ? { id: target.id, name: boundedText(target.name, 160), description: boundedText(target.description), enabled: target.enabled === true, agentEnabled: target.agentEnabled === true } : null,
        environment: selectedEnvironment ? { id: selectedEnvironment.id, name: boundedText(selectedEnvironment.name, 160), description: boundedText(selectedEnvironment.description), production: selectedEnvironment.production === true } : null,
        authentication: auth ? { name: boundedText(auth.name, 160), type: auth.type, enabled: auth.enabled === true, risk: boundedText(auth.risk, 120) } : { type: 'none', enabled: true },
        activeKitIds: [...candidate.activeKitIds],
        readOnly: risk.readOnly,
        allowAgentCall: operation.policy?.allowAgentCall === true,
        requiresConfirmation: risk.requiresConfirmation,
        policy: {
          allowMethods: Array.isArray(operation.policy?.allowMethods) ? [...operation.policy.allowMethods] : [],
          allowWrite: operation.policy?.allowWrite === true && risk.writeAllowed,
          requiresConfirmation: risk.requiresConfirmation,
          timeoutMs: operation.policy?.timeoutMs,
          maxResponseBytes: operation.policy?.maxResponseBytes,
          maxResponseDepth: operation.policy?.maxResponseDepth,
          maxArrayItems: operation.policy?.maxArrayItems,
        },
        rules: [
          'T07 只提供发现和描述，不发起 HTTP 请求。后续 api_call 必须继续使用此 operationId，不得替换为任意 URL。',
          risk.readOnly ? '该 Operation 是只读方法。' : '该 Operation 可能产生副作用，必须满足套件和操作的写策略，并按策略请求人工确认。',
        ],
      },
    }
    if (utf8Bytes(result) > maxOutputBytes) return issue('DESCRIPTION_TOO_LARGE', 'Operation description exceeds the safe output limit', hintForCode('DESCRIPTION_TOO_LARGE'), { operationId: operation.operationId, maxBytes: maxOutputBytes })
    return result
  })

  return Object.freeze({ apiKits, apiOperations, apiDescribe, maxOutputBytes })
}

export { requiredSessionId, normalizeOperationSearchArgs, normalizeOperationIdArgs, compactSchema }
