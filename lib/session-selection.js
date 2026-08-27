/**
 * Session-scoped API Kit activation state and authoritative diagnostics.
 *
 * Selection is an in-memory runtime concern. Registry definitions stay durable,
 * while every inspection re-evaluates the current Registry so disabled or
 * deleted entities never remain usable through a stale session cache.
 */

import {
  MAX_KITS,
  MAX_OPERATIONS,
  normalizeEnvironment,
  normalizeKit,
  normalizeOperation,
  normalizeServiceTarget,
} from './model.js'
import {
  safeEnvironmentView,
  safeServiceTargetView,
  ConfigurationError,
} from './config-validation.js'
import { safeKitListView } from './operation-validation.js'
import { isRecord, lowercaseIdentifier } from './normalizers.js'

export const MAX_SESSION_ID_LENGTH = 256
export const MAX_SELECTION_KITS = Math.min(MAX_KITS, 500)
const SAFE_ID_LENGTH = 128

function issue(code, message, path, detail) {
  return { code, message, ...(path ? { path } : {}), ...(detail === undefined ? {} : { detail }) }
}

function requiredSessionId(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_SESSION_ID_LENGTH || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new ConfigurationError('SESSION_ID_REQUIRED', 'sessionId must be a bounded non-empty string', { path: 'sessionId' })
  }
  return value.trim()
}

function selectionId(value, path) {
  if (typeof value !== 'string' || !value.trim() || value.length > SAFE_ID_LENGTH || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new ConfigurationError('SESSION_SELECTION_INVALID', `${path} must contain safe identifiers`, { path })
  }
  const normalized = lowercaseIdentifier(value, '')
  if (!normalized) throw new ConfigurationError('SESSION_SELECTION_INVALID', `${path} must contain safe identifiers`, { path })
  return normalized
}

/** Normalize the JSON shape accepted by the Host session-selection methods. */
export function normalizeSessionActivationInput(input) {
  const value = isRecord(input) ? input : {}
  const sessionId = requiredSessionId(value.sessionId)
  const rawKitIds = value.activeKitIds ?? value.kitIds ?? []
  if (!Array.isArray(rawKitIds)) throw new ConfigurationError('SESSION_SELECTION_INVALID', 'activeKitIds must be an array', { path: 'activeKitIds' })
  if (rawKitIds.length > MAX_SELECTION_KITS) {
    throw new ConfigurationError('SESSION_SELECTION_INVALID', 'activeKitIds exceeds the supported limit', { path: 'activeKitIds', detail: { max: MAX_SELECTION_KITS } })
  }
  const activeKitIds = []
  const seen = new Set()
  for (const [index, item] of rawKitIds.entries()) {
    const id = selectionId(item, `activeKitIds[${index}]`)
    if (!seen.has(id)) {
      seen.add(id)
      activeKitIds.push(id)
    }
  }
  let environmentId = null
  if (value.environmentId !== undefined && value.environmentId !== null && value.environmentId !== '') {
    environmentId = selectionId(value.environmentId, 'environmentId')
  }
  return { sessionId, activeKitIds, environmentId }
}

/** Small DSH-independent store used by the Host facade and unit tests. */
export function createSessionActivationStore() {
  const values = new Map()
  return {
    get(sessionId) {
      const id = requiredSessionId(sessionId)
      const current = values.get(id)
      return current === undefined
        ? { sessionId: id, activeKitIds: [], environmentId: null }
        : { sessionId: id, activeKitIds: [...current.activeKitIds], environmentId: current.environmentId }
    },
    set(input) {
      const next = normalizeSessionActivationInput(input)
      values.set(next.sessionId, { activeKitIds: [...next.activeKitIds], environmentId: next.environmentId })
      return { sessionId: next.sessionId, activeKitIds: [...next.activeKitIds], environmentId: next.environmentId }
    },
    clear(sessionId) {
      const id = requiredSessionId(sessionId)
      values.delete(id)
      return { sessionId: id, activeKitIds: [], environmentId: null }
    },
    clearAll() {
      values.clear()
    },
  }
}

function entries(registry, name) {
  return Array.isArray(registry?.[name]) ? registry[name] : []
}

function findById(values, id) {
  return values.find((item) => item?.id === id || lowercaseIdentifier(item?.id, '') === id)
}

function normalizedEntities(registry) {
  return {
    operations: entries(registry, 'operations').slice(0, MAX_OPERATIONS).map((item) => normalizeOperation(item)),
    serviceTargets: entries(registry, 'serviceTargets').map((item) => normalizeServiceTarget(item)),
    environments: entries(registry, 'environments').map((item) => normalizeEnvironment(item)),
    kits: entries(registry, 'kits').slice(0, MAX_KITS).map((item) => normalizeKit(item)),
  }
}

function eligibleEnvironmentIds(environments) {
  return environments
    .filter((environment) => environment.enabled !== false && environment.agentEnabled !== false)
    .map((environment) => environment.id)
}

function kitEnvironmentConstraint(kit, operations, serviceTargets) {
  const explicit = new Set((kit.environmentIds ?? []).filter(Boolean))
  if (explicit.size > 0) return explicit
  const derived = new Set()
  const operationIds = Array.isArray(kit.operationIds) ? kit.operationIds.slice(0, MAX_OPERATIONS) : []
  for (const operationId of operationIds) {
    const operation = findById(operations, operationId)
    if (!operation) continue
    const target = findById(serviceTargets, operation.serviceTargetId)
    for (const environmentId of target?.environmentIds ?? []) derived.add(environmentId)
  }
  // An empty kit has no environment constraint. Its first operation/target,
  // once added later, will be reflected by the next authoritative inspection.
  return derived.size > 0 ? derived : null
}

function intersect(left, right) {
  return left.filter((id) => right.has(id))
}

function compatibleEnvironmentIdsForKit(kit, operations, serviceTargets, eligibleIds) {
  const constraint = kitEnvironmentConstraint(kit, operations, serviceTargets)
  return constraint === null ? [...eligibleIds] : eligibleIds.filter((id) => constraint.has(id))
}

function sameId(left, right) {
  return left === right || lowercaseIdentifier(left, '') === lowercaseIdentifier(right, '')
}

/**
 * Analyze one selection against the current Registry.
 * The result is owned JSON and can be returned directly to the Client.
 */
export function inspectSessionActivation(registry, input) {
  const selection = normalizeSessionActivationInput(input)
  const current = normalizedEntities(registry)
  const errors = []
  const warnings = []
  const allEligibleEnvironmentIds = eligibleEnvironmentIds(current.environments)
  let commonEnvironmentIds = [...allEligibleEnvironmentIds]
  let hasEnvironmentConstraint = false

  if (selection.activeKitIds.length > 2) {
    warnings.push(issue('KIT_SCOPE_EXPANDED', '当前会话已激活超过 2 个 API 套件，模型可见的操作范围会扩大', 'activeKitIds', { count: selection.activeKitIds.length, recommendedMax: 2 }))
  }

  for (const [index, kitId] of selection.activeKitIds.entries()) {
    const kit = findById(current.kits, kitId)
    if (!kit) {
      errors.push(issue('KIT_NOT_FOUND', 'API 套件不存在或已被删除', `activeKitIds[${index}]`, { id: kitId }))
      continue
    }
    const compatibleIds = compatibleEnvironmentIdsForKit(kit, current.operations, current.serviceTargets, allEligibleEnvironmentIds)
    if (kit.enabled === false) errors.push(issue('KIT_DISABLED', 'API 套件已停用，请在设置中重新启用后再选择', `activeKitIds[${index}]`, { id: kit.id }))
    if (kit.agentEnabled === false) errors.push(issue('KIT_AGENT_DISABLED', 'API 套件未允许 Agent 使用', `activeKitIds[${index}]`, { id: kit.id }))
    const kitOperations = current.operations.filter((operation) => (kit.operationIds ?? []).some((id) => sameId(id, operation.id)))
    if (kitOperations.filter((operation) => operation.enabled !== false).length === 0) {
      warnings.push(issue('KIT_NO_ENABLED_OPERATIONS', 'API 套件当前没有启用的 Operation', `activeKitIds[${index}]`, { id: kit.id }))
    }
    const constraint = kitEnvironmentConstraint(kit, current.operations, current.serviceTargets)
    if (constraint !== null) {
      hasEnvironmentConstraint = true
      commonEnvironmentIds = intersect(commonEnvironmentIds, new Set(compatibleIds))
    }
  }

  if (selection.activeKitIds.length > 0 && allEligibleEnvironmentIds.length === 0) {
    errors.push(issue('NO_AGENT_ENVIRONMENT', '没有可供 Agent 使用的启用环境', 'environmentId'))
  } else if (selection.activeKitIds.length > 0 && hasEnvironmentConstraint && commonEnvironmentIds.length === 0) {
    errors.push(issue('NO_COMMON_ENVIRONMENT', '当前激活的 API 套件没有共同可用环境，请调整套件或环境', 'environmentId', { kitIds: selection.activeKitIds }))
  }

  const selectedEnvironment = selection.environmentId === null ? undefined : findById(current.environments, selection.environmentId)
  if (selection.activeKitIds.length === 0) {
    if (selection.environmentId !== null) errors.push(issue('ENVIRONMENT_WITHOUT_KIT', '选择环境前请先激活至少一个 API 套件', 'environmentId'))
  } else if (selection.environmentId === null) {
    errors.push(issue('ENVIRONMENT_REQUIRED', '激活 API 套件后必须选择一个环境', 'environmentId'))
  } else if (!selectedEnvironment) {
    errors.push(issue('ENVIRONMENT_NOT_FOUND', '环境不存在或已被删除', 'environmentId', { id: selection.environmentId }))
  } else {
    if (selectedEnvironment.enabled === false) errors.push(issue('ENVIRONMENT_DISABLED', '当前环境已停用', 'environmentId', { id: selectedEnvironment.id }))
    if (selectedEnvironment.agentEnabled === false) errors.push(issue('ENVIRONMENT_AGENT_DISABLED', selectedEnvironment.production ? '生产环境默认禁止 Agent 使用，请显式开启后再选择' : '当前环境未允许 Agent 使用', 'environmentId', { id: selectedEnvironment.id, production: selectedEnvironment.production === true }))
    if (selectedEnvironment.production === true && selectedEnvironment.agentEnabled === true) warnings.push(issue('PRODUCTION_ENVIRONMENT', '当前会话使用生产环境，请确认目标和查询范围', 'environmentId', { id: selectedEnvironment.id }))
    if (commonEnvironmentIds.length > 0 && !commonEnvironmentIds.includes(selectedEnvironment.id)) {
      errors.push(issue('ENVIRONMENT_NOT_COMPATIBLE', '当前环境不在所有激活 API 套件的可用范围内', 'environmentId', { id: selectedEnvironment.id, available: commonEnvironmentIds }))
    }
  }

  const kitViews = current.kits.map((kit) => ({
    ...safeKitListView(kit, current),
    compatibleEnvironmentIds: compatibleEnvironmentIdsForKit(kit, current.operations, current.serviceTargets, allEligibleEnvironmentIds),
    selectable: kit.enabled !== false && kit.agentEnabled !== false,
  }))
  const environmentViews = current.environments.map((environment) => ({
    ...safeEnvironmentView(environment),
    selectable: environment.enabled !== false && environment.agentEnabled !== false,
    compatible: (selection.activeKitIds.length === 0 || commonEnvironmentIds.includes(environment.id)) && environment.enabled !== false && environment.agentEnabled !== false,
  }))

  return {
    sessionId: selection.sessionId,
    activeKitIds: [...selection.activeKitIds],
    environmentId: selection.environmentId,
    valid: errors.length === 0,
    errors,
    warnings,
    availableEnvironmentIds: [...commonEnvironmentIds],
    kits: kitViews,
    environments: environmentViews,
  }
}

export function createEmptySessionActivation(sessionId, registry = {}) {
  return inspectSessionActivation(registry, { sessionId, activeKitIds: [], environmentId: null })
}

export function activationError(result) {
  const first = result.errors[0] ?? issue('SESSION_ACTIVATION_INVALID', '当前会话的 API 套件选择已失效', 'sessionId')
  return new ConfigurationError(first.code, first.message, {
    path: first.path,
    detail: { sessionId: result.sessionId, ...(first.detail === undefined ? {} : { issue: first.detail }), availableEnvironmentIds: result.availableEnvironmentIds },
  })
}

export { safeEnvironmentView, safeServiceTargetView }
