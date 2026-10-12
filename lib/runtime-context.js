/**
 * Dynamic, model-facing API Kit context.
 *
 * This module stays independent from Cordis and the DSH Agent runtime. The
 * adapter calls `renderApiKitRuntimeContext()` synchronously for every prompt
 * assembly, while the configuration facade remains the authority for the
 * current session selection and Registry state.
 */

import { READ_METHODS } from './model.js'
import { operationDiscoverable } from './discovery.js'
import { serviceTargetCoversEnvironment } from './session-selection.js'

export const API_KIT_RUNTIME_CONTEXT_NAME = 'api-kit:session'
export const API_KIT_RUNTIME_CONTEXT_ORDER = 200
export const API_KIT_RUNTIME_CONTEXT_MAX_BYTES = 16 * 1024
export const API_KIT_RUNTIME_CONTEXT_MAX_KITS = 100
export const API_KIT_RUNTIME_CONTEXT_MAX_DESCRIPTION = 320
export const API_KIT_TOOL_NAMES = Object.freeze([
  'api_kits',
  'api_operations',
  'api_describe',
  'api_call',
])

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g
const WHITESPACE = /\s+/g
const SENSITIVE_FIELD_WORDS = /(?:secretref|authorization|cookie|password|passwd|token|api[-_ ]?key|credential|private[-_ ]?key)/i

function utf8Bytes(value) {
  const text = String(value)
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).byteLength
  return text.length
}

function boundedText(value, max = API_KIT_RUNTIME_CONTEXT_MAX_DESCRIPTION) {
  if (typeof value !== 'string') return ''
  const text = value.replace(CONTROL_CHARS, ' ').replace(WHITESPACE, ' ').trim().slice(0, max)
  return SENSITIVE_FIELD_WORDS.test(text) ? '' : text
}

function clipUtf8(value, maxBytes = API_KIT_RUNTIME_CONTEXT_MAX_BYTES) {
  const text = String(value)
  if (utf8Bytes(text) <= maxBytes) return text
  let result = ''
  for (const character of text) {
    if (utf8Bytes(result + character) > maxBytes) break
    result += character
  }
  return result
}

function safeCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0
}

function safeId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : undefined
}

function list(value) {
  return Array.isArray(value) ? value : []
}

function targetMap(targets) {
  return new Map(list(targets).filter((target) => target && typeof target.id === 'string').map((target) => [target.id, target]))
}

function discoverableForKit(kit, operations, targets, environmentId) {
  const targetById = targetMap(targets)
  const found = []
  for (const operation of list(operations)) {
    const target = targetById.get(operation?.serviceTargetId)
    const operationKitIds = list(operation?.kitIds)
    const kitOperationIds = list(kit?.operationIds)
    const linked = kitOperationIds.length === 0
      ? operationKitIds.includes(kit?.id)
      : kitOperationIds.includes(operation?.id)
    if (!linked) continue
    if (target && serviceTargetCoversEnvironment(target, environmentId) && operationDiscoverable(operation, { ...kit, operationIds: kitOperationIds.length > 0 ? kitOperationIds : [operation.id] }, { serviceTarget: target, environmentId })) found.push(operation)
  }
  return found
}

function safeKitLine(kit, operations, targets, environmentId) {
  const found = discoverableForKit(kit, operations, targets, environmentId)
  const readCount = found.filter((operation) => READ_METHODS.includes(operation.method)).length
  const writeCount = found.length - readCount
  const name = boundedText(kit?.name, 160) || '未命名套件'
  const description = boundedText(kit?.description, API_KIT_RUNTIME_CONTEXT_MAX_DESCRIPTION)
  const detail = description ? `：${description}` : ''
  return {
    text: `- ${name}${detail}（可发现 ${found.length} 个；只读 ${readCount} 个；写操作 ${writeCount} 个）`,
    discoverableOperationCount: found.length,
    readOperationCount: readCount,
    writeOperationCount: writeCount,
  }
}

/**
 * Build a small owned data object before rendering. No Registry, Agent, Session,
 * credential, or Cordis object is returned from this function.
 */
export function buildApiKitRuntimeContext(input = {}) {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const activation = value.activation
  if (!activation || activation.valid !== true || !safeId(activation.sessionId) || !Array.isArray(activation.activeKitIds) || activation.activeKitIds.length === 0) return null

  const environment = list(activation.environments).find((item) => item?.id === activation.environmentId)
  if (!environment || environment.enabled !== true || environment.agentEnabled !== true) return null

  const operations = list(value.operations)
  const targets = list(value.serviceTargets)
  const kits = list(activation.kits)
    .filter((kit) => kit && activation.activeKitIds.includes(kit.id))
    .slice(0, API_KIT_RUNTIME_CONTEXT_MAX_KITS)

  const kitLines = kits.map((kit) => safeKitLine(kit, operations, targets, activation.environmentId))
  const unique = new Map()
  for (const kitLine of kitLines) {
    // Counts are intentionally based on the per-Kit discoverable sets. The
    // shared operation count is calculated independently by operation id below.
    void kitLine
  }
  for (const kit of kits) {
    for (const operation of discoverableForKit(kit, operations, targets, activation.environmentId)) {
      const key = typeof operation?.id === 'string' ? operation.id : operation?.operationId
      if (key) unique.set(key, operation)
    }
  }
  const discoverable = [...unique.values()]
  const readCount = discoverable.filter((operation) => READ_METHODS.includes(operation.method)).length
  const writeCount = discoverable.length - readCount
  const environmentName = boundedText(environment.name, 160) || '未命名环境'
  const production = environment.production === true ? '（生产环境）' : ''

  return {
    sessionId: activation.sessionId,
    environmentName,
    production,
    kits: kitLines,
    totalDiscoverableOperationCount: discoverable.length,
    totalReadOperationCount: readCount,
    totalWriteOperationCount: writeCount,
  }
}

/**
 * Render the model-facing snapshot. It deliberately contains no concrete URL,
 * host, CIDR, credential reference, auth value, Header, Cookie, or full Schema.
 */
export function renderApiKitRuntimeContext(input = {}) {
  const built = buildApiKitRuntimeContext(input)
  if (!built) return ''

  const lines = [
    'API Kit 运行时上下文（按当前会话实时刷新）：',
    `- 环境：${built.environmentName}${built.production}`,
    `- 当前激活套件共可发现 ${built.totalDiscoverableOperationCount} 个 Operation（只读 ${built.totalReadOperationCount} 个；写操作 ${built.totalWriteOperationCount} 个）`,
    '- 激活套件：',
    ...built.kits.map((kit) => kit.text),
    `- 工具：${API_KIT_TOOL_NAMES.join('、')}`,
    '- 使用顺序：先用 api_operations 发现，再用 api_describe 查看参数和 Schema，最后用 api_call 调用；不得猜测或替换 operationId。',
    '- 当前 api_call 仅执行已登记 Operation 的 GET/HEAD，只读调用；写操作即使登记也不会在 MVP 中执行。',
    '- 目标、Environment、协议、登记 hostname 和 DNS/IP SSRF 校验均由 Host 固定并执行；模型不得提供任意 URL、host、代理、重定向策略或 sessionId。内部 API hostname 可解析到私网地址；本机、metadata、link-local、组播和保留地址仍会被拒绝。',
    '- 模型不得提供认证值或受控请求 Header；凭据只在 Host 按次解析，响应会脱敏。',
    '- 单次调用有超时、响应字节、嵌套深度、数组、字符串和对象数量限制；默认不跟随重定向，调用和策略拒绝写入本地审计。',
  ]

  // A user-controlled Kit name/description is display-only input. If an
  // administrator accidentally included a credential-shaped field name, omit
  // that whole line instead of placing suspicious text in model context.
  const filtered = lines.filter((line) => !SENSITIVE_FIELD_WORDS.test(line) || line.startsWith('- 模型不得提供认证值'))
  return clipUtf8(filtered.join('\n'), API_KIT_RUNTIME_CONTEXT_MAX_BYTES)
}

/**
 * Register the provider on the current Cordis Fiber. The provider is evaluated
 * synchronously for every `systemPrompt.assemble()` call, so changing a Kit or
 * session selection is visible without rebuilding this plugin.
 */
export function registerApiKitRuntimeContext(systemPrompt, configuration) {
  if (!systemPrompt || typeof systemPrompt.context !== 'function') throw new TypeError('systemPrompt.context is required')
  if (!configuration || typeof configuration.resolveSessionActivation !== 'function' || typeof configuration.listOperations !== 'function' || typeof configuration.listServiceTargets !== 'function') {
    throw new TypeError('configuration runtime context methods are required')
  }
  return systemPrompt.context({
    name: API_KIT_RUNTIME_CONTEXT_NAME,
    order: API_KIT_RUNTIME_CONTEXT_ORDER,
    text: (assemblyContext = {}) => {
      const sessionId = safeId(assemblyContext?.agent?.id)
      if (!sessionId) return ''
      try {
        const activation = configuration.resolveSessionActivation(sessionId)
        return renderApiKitRuntimeContext({
          activation,
          operations: configuration.listOperations(),
          serviceTargets: configuration.listServiceTargets(),
        })
      } catch {
        // Dynamic context must fail closed. The discovery and executor tools
        // retain their own actionable error envelopes for the actual call.
        return ''
      }
    },
  })
}

export { boundedText, clipUtf8, utf8Bytes }
