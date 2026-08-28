/**
 * T12 OpenAPI preview confirmation transaction.
 *
 * This module is DSH-independent. It re-parses untrusted input at confirmation
 * time, never trusts Client-supplied candidates, and uses one Registry update for
 * the whole batch. Server URLs remain display-only; only pre-existing Registry
 * targets, environments, authentication profiles and Kits may be referenced.
 */

import {
  MAX_AUTH_PROFILES,
  MAX_ENVIRONMENTS,
  MAX_KITS,
  MAX_OPERATIONS,
  MAX_SERVICE_TARGETS,
  normalizeOperation,
} from './model.js'
import {
  buildOpenApiImportPreview,
  OPENAPI_IMPORT_LIMITS,
} from './openapi-import.js'
import {
  reconcileRegistryLinks,
  validateKitInput,
  validateOperationInput,
} from './operation-validation.js'
import {
  ConfigurationError,
  validateConfigurationReferences,
} from './config-validation.js'
import {
  isRecord,
  lowercaseIdentifier,
  normalizeMethod,
  normalizePath,
} from './normalizers.js'

const RESERVED_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const DECISIONS = new Set(['overwrite', 'keep', 'keep-local', 'skip'])
const ARCHIVE_MODES = new Set(['none', 'sanitized', 'raw'])
const MAX_REQUEST_KEYS = 2000
const MAX_SOURCE_KEYS = OPENAPI_IMPORT_LIMITS.maxOperations
const MAX_TRANSACTION_ID = 180

function clone(value) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

function stableStringify(value, seen = new Set()) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (seen.has(value)) throw new TypeError('cyclic value')
  seen.add(value)
  let result
  if (Array.isArray(value)) result = `[${value.map((item) => stableStringify(item, seen)).join(',')}]`
  else result = `{${Object.keys(value).sort().filter((key) => !RESERVED_KEYS.has(key)).map((key) => `${JSON.stringify(key)}:${stableStringify(value[key], seen)}`).join(',')}}`
  seen.delete(value)
  return result
}

function hashText(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function registryFingerprint(registry) {
  const value = {
    schemaVersion: registry?.schemaVersion ?? 1,
    kits: Array.isArray(registry?.kits) ? registry.kits : [],
    operations: Array.isArray(registry?.operations) ? registry.operations : [],
    serviceTargets: Array.isArray(registry?.serviceTargets) ? registry.serviceTargets : [],
    environments: Array.isArray(registry?.environments) ? registry.environments : [],
    authProfiles: Array.isArray(registry?.authProfiles) ? registry.authProfiles : [],
  }
  return hashText(stableStringify(value))
}

export class OpenApiImportTransactionError extends Error {
  constructor(code, message, options = {}) {
    super(message)
    this.name = 'OpenApiImportTransactionError'
    this.code = code
    if (options.path) this.path = options.path
    if (options.detail !== undefined) this.detail = clone(options.detail)
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.path ? { path: this.path } : {}),
      ...(this.detail === undefined ? {} : { detail: clone(this.detail) }),
    }
  }
}

function fail(code, message, path, detail) {
  throw new OpenApiImportTransactionError(code, message, { path, detail })
}

function boundedString(value, path, max = 512, required = false) {
  if (value === undefined && !required) return undefined
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value) || (required && !value.trim())) {
    fail('IMPORT_REQUEST_INVALID', `${path} must be a bounded string`, path)
  }
  return value.trim()
}

function safeId(value, path, required = false) {
  const raw = boundedString(value, path, 128, required)
  if (raw === undefined) return undefined
  const id = lowercaseIdentifier(raw, '')
  if (!id) fail('IMPORT_REFERENCE_INVALID', `${path} must be a safe identifier`, path)
  return id
}

function boundedList(value, path, max, itemMax = 512) {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > max) fail('IMPORT_REQUEST_INVALID', `${path} must be a bounded array`, path, { max })
  return value.map((item, index) => boundedString(item, `${path}[${index}]`, itemMax, true))
}

function plain(value, path) {
  if (value === undefined) return undefined
  if (!isRecord(value)) fail('IMPORT_REQUEST_INVALID', `${path} must be an object`, path)
  const keys = Object.keys(value)
  if (keys.length > MAX_REQUEST_KEYS) fail('IMPORT_REQUEST_TOO_LARGE', `${path} has too many keys`, path, { max: MAX_REQUEST_KEYS })
  for (const key of keys) if (RESERVED_KEYS.has(key)) fail('IMPORT_REQUEST_INVALID', `${path} contains a reserved key`, `${path}.${key}`)
  return value
}

function mapObject(value, path, max = MAX_SOURCE_KEYS) {
  const object = plain(value, path)
  if (object === undefined) return undefined
  const entries = Object.entries(object)
  if (entries.length > max) fail('IMPORT_REQUEST_TOO_LARGE', `${path} has too many entries`, path, { max })
  const result = {}
  for (const [key, child] of entries) {
    boundedString(key, `${path}.${key}`, 512, true)
    result[key] = child
  }
  return result
}

function dateIso(clock) {
  const raw = typeof clock === 'function' ? clock() : clock
  const date = raw instanceof Date ? raw : new Date(raw ?? Date.now())
  if (Number.isNaN(date.getTime())) throw new TypeError('clock must return a valid date')
  return date.toISOString()
}

function normalizeDecision(value, path) {
  const decision = boundedString(value, path, 32, true).toLowerCase()
  if (!DECISIONS.has(decision)) fail('IMPORT_DECISION_INVALID', 'conflict decision must be overwrite, keep-local, or skip', path, { decision })
  return decision === 'keep-local' ? 'keep' : decision
}

function sourceKeySet(preview) {
  return new Set((preview.operations ?? []).map((item) => item.sourceKey).filter((value) => typeof value === 'string' && value))
}

function operationBySource(preview) {
  return new Map((preview.operations ?? []).map((item) => [item.sourceKey, item]))
}

function serverIdSet(preview) {
  return new Set((preview.serverCandidates ?? []).map((item) => item?.id).filter((value) => typeof value === 'string' && value))
}

function authSchemeSet(preview) {
  return new Set((preview.authProfileTemplates ?? []).flatMap((item) => [item?.id, item?.sourceName]).filter((value) => typeof value === 'string' && value))
}

function selectionInput(request) {
  const root = plain(request, 'request') ?? {}
  const selection = plain(root.selection ?? root.selections, 'selection') ?? {}
  const includedSourceKeys = boundedList(
    selection.includedSourceKeys ?? selection.sourceKeys ?? root.includedSourceKeys ?? root.sourceKeys,
    'selection.includedSourceKeys',
    MAX_SOURCE_KEYS,
  )
  const excludedSourceKeys = boundedList(
    selection.excludedSourceKeys ?? root.excludedSourceKeys,
    'selection.excludedSourceKeys',
    MAX_SOURCE_KEYS,
  ) ?? []
  const tagFilter = plain(selection.tagFilter ?? root.tagFilter, 'selection.tagFilter')
  let tags
  if (tagFilter) {
    tags = boundedList(tagFilter.selectedTags ?? tagFilter.tags, 'selection.tagFilter.selectedTags', 50, 80) ?? []
  } else if (selection.selectedTags !== undefined || root.selectedTags !== undefined) {
    tags = boundedList(selection.selectedTags ?? root.selectedTags, 'selection.selectedTags', 50, 80) ?? []
  }
  const assignments = mapObject(selection.assignments ?? root.assignments, 'selection.assignments') ?? {}
  const conflictDecisionsRaw = mapObject(selection.conflictDecisions ?? root.conflictDecisions, 'selection.conflictDecisions') ?? {}
  const conflictDecisions = { ...conflictDecisionsRaw }
  const serviceTargetBindingsRaw = mapObject(
    selection.serviceTargetBindings ?? root.serviceTargetBindings ?? root.serviceTargetByServer,
    'selection.serviceTargetBindings',
    100,
  ) ?? {}
  const serviceTargetBindings = { ...serviceTargetBindingsRaw }
  const targetDefaultsRaw = mapObject(selection.targetDefaults ?? root.targetDefaults, 'selection.targetDefaults', MAX_SERVICE_TARGETS) ?? {}
  const targetDefaults = {}
  for (const [key, value] of Object.entries(targetDefaultsRaw)) {
    const targetId = safeId(key, `selection.targetDefaults.${key}`, true)
    targetDefaults[targetId] = safeId(value, `selection.targetDefaults.${key}`, true)
  }
  const authProfileBindingsRaw = mapObject(selection.authProfileBindings ?? root.authProfileBindings, 'selection.authProfileBindings', MAX_AUTH_PROFILES) ?? {}
  const authProfileBindings = {}
  for (const [key, value] of Object.entries(authProfileBindingsRaw)) authProfileBindings[key] = safeId(value, `selection.authProfileBindings.${key}`, true)
  const rawDefaultKitIds = boundedList(selection.defaultKitIds ?? selection.kitIds ?? root.defaultKitIds ?? root.kitIds, 'selection.defaultKitIds', MAX_KITS, 128)
  const defaultKitIds = rawDefaultKitIds?.map((id, index) => safeId(id, `selection.defaultKitIds[${index}]`, true))
  const defaultServiceTargetId = selection.defaultServiceTargetId ?? root.defaultServiceTargetId ?? root.serviceTargetId
  const defaultAuthProfileId = selection.defaultAuthProfileId ?? root.defaultAuthProfileId ?? root.authProfileId
  const enabledBySourceKey = mapObject(selection.enabledBySourceKey ?? root.enabledBySourceKey, 'selection.enabledBySourceKey', MAX_SOURCE_KEYS) ?? {}
  for (const [key, value] of Object.entries(enabledBySourceKey)) {
    if (typeof value !== 'boolean') fail('IMPORT_REQUEST_INVALID', 'enabledBySourceKey values must be boolean', `selection.enabledBySourceKey.${key}`)
  }
  const conflictPolicy = selection.conflictPolicy ?? root.conflictPolicy
  const globalDecision = conflictPolicy === undefined ? undefined : normalizeDecision(conflictPolicy, 'selection.conflictPolicy')
  for (const [key, value] of Object.entries(conflictDecisions)) conflictDecisions[key] = normalizeDecision(value, `selection.conflictDecisions.${key}`)
  for (const [key, value] of Object.entries(serviceTargetBindings)) {
    const normalizedKey = boundedString(key, `selection.serviceTargetBindings.${key}`, 512, true)
    serviceTargetBindings[normalizedKey] = safeId(value, `selection.serviceTargetBindings.${key}`, true)
  }
  const assignmentsOut = {}
  for (const [sourceKey, raw] of Object.entries(assignments)) {
    const item = plain(raw, `selection.assignments.${sourceKey}`) ?? {}
    const normalized = {}
    if (item.serviceTargetId !== undefined) normalized.serviceTargetId = safeId(item.serviceTargetId, `selection.assignments.${sourceKey}.serviceTargetId`, true)
    if (item.authProfileId !== undefined) normalized.authProfileId = safeId(item.authProfileId, `selection.assignments.${sourceKey}.authProfileId`, true)
    if (item.kitIds !== undefined || item.kits !== undefined) normalized.kitIds = boundedList(item.kitIds ?? item.kits, `selection.assignments.${sourceKey}.kitIds`, MAX_KITS, 128).map((id, index) => safeId(id, `selection.assignments.${sourceKey}.kitIds[${index}]`, true))
    if (item.environmentId !== undefined) normalized.environmentId = safeId(item.environmentId, `selection.assignments.${sourceKey}.environmentId`, true)
    if (item.enabled !== undefined) {
      if (typeof item.enabled !== 'boolean') fail('IMPORT_REQUEST_INVALID', 'assignment.enabled must be boolean', `selection.assignments.${sourceKey}.enabled`)
      normalized.enabled = item.enabled
    }
    assignmentsOut[sourceKey] = normalized
  }
  const normalizedDefaultServiceTargetId = defaultServiceTargetId === undefined ? undefined : safeId(defaultServiceTargetId, 'selection.defaultServiceTargetId', true)
  const normalizedDefaultAuthProfileId = defaultAuthProfileId === undefined ? undefined : safeId(defaultAuthProfileId, 'selection.defaultAuthProfileId', true)
  return {
    includedSourceKeys,
    excludedSourceKeys,
    tags,
    includeUntagged: tagFilter?.includeUntagged === true || selection.includeUntagged === true || root.includeUntagged === true,
    tagMode: tagFilter?.mode === 'all' || selection.tagMode === 'all' || root.tagMode === 'all' ? 'all' : 'any',
    assignments: assignmentsOut,
    conflictDecisions,
    globalDecision,
    serviceTargetBindings,
    targetDefaults,
    authProfileBindings,
    defaultKitIds,
    defaultServiceTargetId: normalizedDefaultServiceTargetId,
    defaultAuthProfileId: normalizedDefaultAuthProfileId,
    operationEnabled: enabledBySourceKey,
  }
}

function selectCandidates(preview, selection) {
  const bySource = operationBySource(preview)
  const known = sourceKeySet(preview)
  const knownServers = serverIdSet(preview)
  const knownSchemes = authSchemeSet(preview)
  const explicit = selection.includedSourceKeys
  const excluded = new Set(selection.excludedSourceKeys)
  for (const key of [...excluded, ...(explicit ?? []), ...Object.keys(selection.assignments), ...Object.keys(selection.conflictDecisions), ...Object.keys(selection.operationEnabled ?? {})]) {
    if (!known.has(key)) fail('IMPORT_SOURCE_KEY_INVALID', 'selection references an operation that is not in the preview', 'selection', { sourceKey: key })
  }
  for (const key of [...Object.keys(selection.serviceTargetBindings), ...Object.keys(selection.authProfileBindings)]) {
    if (!knownServers.has(key) && !knownSchemes.has(key)) fail('IMPORT_BINDING_KEY_INVALID', 'binding references a server or security scheme that is not in the preview', 'selection', { key })
  }
  let selected = explicit ? [...explicit] : [...known]
  if (selection.tags !== undefined) {
    const wanted = new Set(selection.tags.map((tag) => tag.toLowerCase()))
    if (wanted.size > 0) selected = selected.filter((key) => {
      const candidate = bySource.get(key)
      const tags = (candidate?.tags ?? []).map((tag) => String(tag).toLowerCase())
      if (tags.length === 0) return selection.includeUntagged
      return selection.tagMode === 'all' ? [...wanted].every((tag) => tags.includes(tag)) : [...wanted].some((tag) => tags.includes(tag))
    })
  }
  return selected.filter((key) => !excluded.has(key)).map((key) => bySource.get(key)).filter(Boolean)
}

function findExisting(candidate, registry) {
  const operations = Array.isArray(registry?.operations) ? registry.operations : []
  const source = operations.find((item) => item?.sourceKey && item.sourceKey === candidate.sourceKey)
  if (source) return { item: source, matches: [source] }
  const operationId = String(candidate.operationId || '').toLowerCase()
  const byId = operations.filter((item) => String(item?.operationId || '').toLowerCase() === operationId)
  if (byId.length > 0) return { item: byId[0], matches: byId }
  const method = normalizeMethod(candidate.method)
  const path = normalizePath(candidate.path)
  const key = `${method} ${path}`
  const byPath = operations.filter((item) => `${normalizeMethod(item?.method)} ${normalizePath(item?.path)}` === key)
  return byPath.length > 0 ? { item: byPath[0], matches: byPath } : undefined
}

function arrayUnique(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value))]
}

function registryEntity(registry, collection, id) {
  const normalized = lowercaseIdentifier(id, '')
  return (registry?.[collection] ?? []).find((item) => lowercaseIdentifier(item?.id, '') === normalized)
}

function ensureTarget(registry, id, path) {
  const target = registryEntity(registry, 'serviceTargets', id)
  if (!target) fail('TARGET_NOT_FOUND', 'selected Service Target does not exist', path, { id })
  if (target.enabled === false) fail('TARGET_DISABLED', 'selected Service Target is disabled', path, { id })
  return target
}

function ensureEnvironment(target, registry, id, path) {
  if (id === undefined) return undefined
  const environment = registryEntity(registry, 'environments', id)
  if (!environment) fail('ENVIRONMENT_NOT_FOUND', 'selected Environment does not exist', path, { id })
  if (!(target.environmentIds ?? []).includes(environment.id)) fail('ENVIRONMENT_NOT_BOUND', 'selected Environment is not bound to the Service Target', path, { id, targetId: target.id })
  return environment
}

function ensureKit(registry, id, path) {
  const kit = registryEntity(registry, 'kits', id)
  if (!kit) fail('KIT_NOT_FOUND', 'selected API Kit does not exist', path, { id })
  return kit
}

function securityShape(candidate) {
  const requirements = candidate.extensions?.openapi?.securityRequirements
  if (!Array.isArray(candidate.security) || candidate.security.length === 0) return { required: false, scheme: undefined }
  if (!Array.isArray(requirements) || requirements.length !== 1 || !Array.isArray(requirements[0]?.allOf) || requirements[0].allOf.length !== 1) {
    fail('IMPORT_SECURITY_MAPPING_UNSUPPORTED', 'security alternatives or multiple required schemes need an explicit future auth mapping', 'security', { operationId: candidate.operationId })
  }
  return { required: true, scheme: requirements[0].allOf[0] }
}

function securityTemplate(preview, candidate, sourceName) {
  const templates = preview.authProfileTemplates ?? []
  const requirements = candidate.extensions?.openapi?.securityRequirements
  const names = Array.isArray(requirements) ? requirements.flatMap((item) => item?.allOf ?? []) : []
  return templates.find((item) => item.sourceName === sourceName || item.id === sourceName || names.includes(item.sourceName) || names.includes(item.id))
}

function ensureAuth(registry, target, id, template, path) {
  if (!id) fail('IMPORT_AUTH_BINDING_REQUIRED', 'an existing Auth Profile must be selected for this security scheme', path)
  const profile = registryEntity(registry, 'authProfiles', id)
  if (!profile) fail('AUTH_PROFILE_NOT_FOUND', 'selected Auth Profile does not exist', path, { id })
  if (profile.enabled === false) fail('AUTH_PROFILE_DISABLED', 'selected Auth Profile is disabled', path, { id })
  if (!(target.authProfileIds ?? []).includes(profile.id)) fail('AUTH_PROFILE_NOT_BOUND', 'selected Auth Profile is not bound to the Service Target', path, { id, targetId: target.id })
  if (template?.type && profile.type !== template.type) fail('IMPORT_AUTH_TYPE_MISMATCH', 'Auth Profile type does not match the OpenAPI security scheme', path, { expected: template.type, actual: profile.type })
  return profile
}

function resolveAssignment(candidate, selection, existing, registry) {
  const direct = selection.assignments[candidate.sourceKey] ?? {}
  let serviceTargetId = direct.serviceTargetId
  if (!serviceTargetId) {
    const mapped = arrayUnique((candidate.serverCandidateIds ?? []).map((id) => selection.serviceTargetBindings[id]))
    if (mapped.length > 1) fail('IMPORT_SERVICE_MAPPING_AMBIGUOUS', 'one operation maps to multiple Service Targets; assign it explicitly', 'selection.assignments', { sourceKey: candidate.sourceKey, targetIds: mapped })
    serviceTargetId = mapped[0]
  }
  if (!serviceTargetId) serviceTargetId = selection.defaultServiceTargetId
  if (!serviceTargetId && existing) serviceTargetId = existing.serviceTargetId
  const target = serviceTargetId ? ensureTarget(registry, serviceTargetId, `selection.assignments.${candidate.sourceKey}.serviceTargetId`) : undefined
  if (!target) fail('IMPORT_TARGET_BINDING_REQUIRED', 'an existing Service Target must be selected before importing this operation', `selection.assignments.${candidate.sourceKey}.serviceTargetId`)
  const environmentId = direct.environmentId
    ?? selection.targetDefaults[target.id]
    ?? target.defaultEnvironmentId
    ?? undefined
  const environment = ensureEnvironment(target, registry, environmentId, `selection.assignments.${candidate.sourceKey}.environmentId`)
  const requestedKitIds = direct.kitIds ?? selection.defaultKitIds ?? (existing ? existing.kitIds : undefined)
  const kitIds = arrayUnique((requestedKitIds ?? []).map((id) => lowercaseIdentifier(id, '')).filter(Boolean))
  if (kitIds.length === 0) fail('IMPORT_KIT_BINDING_REQUIRED', 'at least one existing API Kit must be selected for an imported operation', `selection.assignments.${candidate.sourceKey}.kitIds`)
  const kits = kitIds.map((id, index) => ensureKit(registry, id, `selection.assignments.${candidate.sourceKey}.kitIds[${index}]`))
  const security = securityShape(candidate)
  let authProfileId = direct.authProfileId
  if (security.required && !authProfileId) authProfileId = selection.authProfileBindings[security.scheme]
  if (security.required && !authProfileId) authProfileId = selection.defaultAuthProfileId
  if (security.required && !authProfileId && existing) authProfileId = existing.authProfileId
  const template = security.required ? securityTemplate(candidate.__preview, candidate, security.scheme) : undefined
  const authProfile = security.required ? ensureAuth(registry, target, authProfileId, template, `selection.assignments.${candidate.sourceKey}.authProfileId`) : undefined
  let enabled = existing ? existing.enabled !== false : true
  if (direct.enabled !== undefined) enabled = direct.enabled
  else if (selection.operationEnabled?.[candidate.sourceKey] !== undefined) enabled = selection.operationEnabled[candidate.sourceKey]
  return { direct, target, environment, kitIds, kits, authProfileId: authProfile?.id ?? '', enabled }
}

function candidateOperationInput(candidate, assignment, existing) {
  const base = {
    id: existing?.id ?? candidate.id,
    operationId: candidate.operationId,
    name: candidate.name,
    summary: candidate.summary,
    description: candidate.description,
    method: candidate.method,
    path: candidate.path,
    tags: candidate.tags,
    serviceTargetId: assignment.target.id,
    kitIds: assignment.kitIds,
    parameters: candidate.parameters,
    requestBody: candidate.requestBody,
    responses: candidate.responses,
    security: candidate.security,
    authProfileId: assignment.authProfileId,
    source: candidate.source,
    sourceKey: candidate.sourceKey,
    extensions: candidate.extensions,
    enabled: assignment.enabled,
    policy: existing ? existing.policy : candidate.policy,
  }
  return normalizeOperation(base)
}

function assertOperationUniqueness(registry, value, currentId) {
  if (registry.operations.some((item) => item.id === value.id && item.id !== currentId)) fail('DUPLICATE_ID', 'operation id already exists', 'operation.id', { id: value.id })
  if (registry.operations.some((item) => item.id !== currentId && String(item.operationId || '').toLowerCase() === String(value.operationId || '').toLowerCase())) {
    fail('DUPLICATE_OPERATION_ID', 'operationId already exists', 'operation.operationId', { operationId: value.operationId })
  }
}

function addKitLinks(registry, operationId, assignment, environmentId) {
  const assigned = new Set(assignment.kitIds)
  for (const kit of registry.kits ?? []) {
    kit.operationIds = Array.isArray(kit.operationIds) ? kit.operationIds.filter((id) => id !== operationId) : []
    if (!assigned.has(kit.id)) continue
    if (!kit.operationIds.includes(operationId)) kit.operationIds.push(operationId)
    if (!Array.isArray(kit.serviceTargetIds)) kit.serviceTargetIds = []
    if (!kit.serviceTargetIds.includes(assignment.target.id)) kit.serviceTargetIds.push(assignment.target.id)
    if (environmentId) {
      if (!Array.isArray(kit.environmentIds)) kit.environmentIds = []
      if (!kit.environmentIds.includes(environmentId)) kit.environmentIds.push(environmentId)
    }
  }
}

function ensureTargetDefaults(registry, targetDefaults, usedTargets) {
  for (const [targetId, environmentId] of Object.entries(targetDefaults)) {
    const target = ensureTarget(registry, targetId, `selection.targetDefaults.${targetId}`)
    ensureEnvironment(target, registry, environmentId, `selection.targetDefaults.${targetId}`)
    if (usedTargets.has(target.id)) target.defaultEnvironmentId = environmentId
  }
}

function applyImport(draft, preview, request, selection, clock) {
  if (!preview.documentMeta) fail('IMPORT_PREVIEW_INVALID', 'OpenAPI document could not be previewed', 'preview')
  const candidates = selectCandidates(preview, selection)
  if (selection.tags !== undefined && selection.tags.length === 0 && selection.includedSourceKeys === undefined) {
    // An explicitly empty Tag selection means “all Tags”, including untagged operations.
  }
  const errors = []
  for (const candidate of candidates) if (!candidate.importable || candidate.errors?.length > 0 || candidate.status === 'error') errors.push({ sourceKey: candidate.sourceKey, errors: candidate.errors ?? [] })
  if (errors.length > 0) fail('IMPORT_CANDIDATE_INVALID', 'one or more selected operations are not importable', 'selection.includedSourceKeys', { candidates: errors.slice(0, 50) })
  const newCount = candidates.filter((candidate) => candidate.status === 'new').length
  if ((draft.operations?.length ?? 0) + newCount > MAX_OPERATIONS) fail('CAPACITY_EXCEEDED', 'operation capacity would be exceeded by this import', 'operations', { max: MAX_OPERATIONS, requested: newCount })
  if ((draft.kits?.length ?? 0) > MAX_KITS || (draft.serviceTargets?.length ?? 0) > MAX_SERVICE_TARGETS || (draft.environments?.length ?? 0) > MAX_ENVIRONMENTS || (draft.authProfiles?.length ?? 0) > MAX_AUTH_PROFILES) fail('CAPACITY_EXCEEDED', 'Registry capacity is already exceeded', 'registry')
  const decisions = []
  const usedTargets = new Set()
  const selectedEnvironmentByTarget = new Map()
  const usedEnvironments = new Set()
  const selectedKitIds = new Set()
  let created = 0
  let updated = 0
  let skipped = 0
  let kept = 0
  for (const candidate of candidates) {
    const found = findExisting(candidate, draft)
    if (found?.matches?.length > 1) fail('IMPORT_CONFLICT_AMBIGUOUS', 'an operation matches multiple existing Registry operations', 'operation', { sourceKey: candidate.sourceKey })
    const existing = found?.item
    let decision = candidate.status === 'conflict' ? selection.conflictDecisions[candidate.sourceKey] ?? selection.globalDecision : undefined
    if (candidate.status === 'conflict' && !decision) fail('IMPORT_CONFLICT_DECISION_REQUIRED', 'each conflict requires overwrite, keep-local, or skip', `selection.conflictDecisions.${candidate.sourceKey}`)
    if (decision === 'keep') {
      kept += 1
      decisions.push({ sourceKey: candidate.sourceKey, status: candidate.status, decision, operationId: candidate.operationId, existingOperationId: existing?.id })
      continue
    }
    if (decision === 'skip' || candidate.status === 'skip') {
      skipped += 1
      decisions.push({ sourceKey: candidate.sourceKey, status: candidate.status, decision: decision ?? 'skip', operationId: candidate.operationId, existingOperationId: existing?.id })
      continue
    }
    if (candidate.status === 'update' && decision === 'skip') {
      skipped += 1
      decisions.push({ sourceKey: candidate.sourceKey, status: candidate.status, decision, operationId: candidate.operationId, existingOperationId: existing?.id })
      continue
    }
    const candidateForAssignment = { ...candidate, __preview: preview }
    const assignment = resolveAssignment(candidateForAssignment, selection, existing, draft)
    usedTargets.add(assignment.target.id)
    for (const kitId of assignment.kitIds) selectedKitIds.add(kitId)
    if (assignment.environment?.id) {
      usedEnvironments.add(assignment.environment.id)
      const priorEnvironment = selectedEnvironmentByTarget.get(assignment.target.id)
      if (priorEnvironment && priorEnvironment !== assignment.environment.id) fail('IMPORT_ENVIRONMENT_AMBIGUOUS', 'one import cannot bind the same Service Target to multiple Environments', 'selection.assignments', { targetId: assignment.target.id })
      selectedEnvironmentByTarget.set(assignment.target.id, assignment.environment.id)
    }
    const value = candidateOperationInput(candidate, assignment, existing)
    try {
      validateOperationInput(value, { registry: draft })
    } catch (error) {
      if (error instanceof ConfigurationError) fail(error.code || 'OPERATION_INVALID', error.message, error.path || 'operation', error.detail)
      throw error
    }
    assertOperationUniqueness(draft, value, existing?.id)
    if (existing) {
      const index = draft.operations.findIndex((item) => item.id === existing.id)
      const stored = {
        ...value,
        id: existing.id,
        createdAt: existing.createdAt || dateIso(clock),
        updatedAt: dateIso(clock),
        // Keep local policy and enabled state unless an explicit assignment changed enabled.
        policy: existing.policy,
        enabled: assignment.direct.enabled === undefined ? existing.enabled !== false : assignment.enabled,
      }
      validateOperationInput(stored, { registry: draft })
      draft.operations[index] = stored
      addKitLinks(draft, existing.id, assignment, assignment.environment?.id)
      updated += 1
      decisions.push({ sourceKey: candidate.sourceKey, status: candidate.status, decision: decision ?? 'overwrite', operationId: stored.operationId, existingOperationId: existing.id })
    } else {
      const stored = { ...value, createdAt: dateIso(clock), updatedAt: dateIso(clock) }
      draft.operations.push(stored)
      addKitLinks(draft, stored.id, assignment, assignment.environment?.id)
      created += 1
      decisions.push({ sourceKey: candidate.sourceKey, status: candidate.status, decision: 'create', operationId: stored.operationId, operationEntityId: stored.id })
    }
  }
  ensureTargetDefaults(draft, selection.targetDefaults, usedTargets)
  for (const kit of draft.kits ?? []) {
    try { validateKitInput(kit, draft) } catch (error) {
      if (error instanceof ConfigurationError) fail(error.code || 'KIT_INVALID', error.message, error.path || 'kits', error.detail)
      throw error
    }
  }
  const reconciliation = reconcileRegistryLinks(draft)
  validateConfigurationReferences(draft)
  return {
    transactionId: request.transactionId,
    documentMeta: clone(preview.documentMeta),
    applied: { created, updated, skipped, kept },
    decisions,
    warnings: [...(preview.warnings ?? []), ...reconciliation.warnings].slice(0, OPENAPI_IMPORT_LIMITS.maxIssues),
    counts: { selected: candidates.length, created, updated, skipped, kept },
    bindings: {
      serviceTargetIds: [...usedTargets],
      kitIds: [...selectedKitIds],
      environmentIds: [...usedEnvironments],
    },
  }
}

function safeResult(value) {
  const result = clone(value) ?? {}
  delete result.__preview
  return result
}

/**
 * Construct the Host-side import service. `store.update` is the only commit
 * primitive; preview and confirmation never call individual CRUD methods.
 */
export function createOpenApiImportTransactionService(options = {}) {
  const store = options.store
  if (!store || typeof store.getSnapshot !== 'function' || typeof store.update !== 'function') throw new TypeError('import transaction requires a Registry store')
  const clock = options.clock ?? (() => new Date())
  const configuredLimits = isRecord(options.limits) ? clone(options.limits) : undefined
  const archiveMode = ARCHIVE_MODES.has(options.archiveMode) ? options.archiveMode : 'none'
  const pending = new Map()

  const previewOpenApiImport = (input, previewOptions = {}) => {
    const registry = clone(store.getSnapshot())
    const effective = {
      ...previewOptions,
      ...(configuredLimits ? { limits: configuredLimits } : {}),
      registry,
    }
    const preview = buildOpenApiImportPreview(input, effective)
    if (!preview.documentMeta) return preview
    const registryFp = registryFingerprint(registry)
    const transactionId = `openapi-${preview.documentMeta.fingerprint}-${registryFp}`.slice(0, MAX_TRANSACTION_ID)
    const enriched = {
      ...preview,
      transactionId,
      registryFingerprint: registryFp,
      registryRevision: registry.metadata?.updatedAt || '',
      needsBinding: (preview.operations ?? []).some((item) => item.needsBinding === true),
      serviceGroups: Object.fromEntries((preview.serverCandidates ?? []).map((server) => [server.id, (preview.operations ?? []).filter((item) => (item.serverCandidateIds ?? []).includes(server.id)).length])),
    }
    pending.set(transactionId, {
      documentId: preview.documentMeta.documentId,
      fingerprint: preview.documentMeta.fingerprint,
      registryFingerprint: registryFp,
      sourceId: effective.sourceId,
    })
    if (pending.size > 100) pending.delete(pending.keys().next().value)
    return safeResult(enriched)
  }

  const confirmOpenApiImport = async (request = {}) => {
    const root = plain(request, 'request') ?? {}
    const transactionId = boundedString(root.transactionId, 'transactionId', MAX_TRANSACTION_ID, true)
    const requestedArchiveMode = root.archiveMode ?? archiveMode
    if (!ARCHIVE_MODES.has(requestedArchiveMode)) fail('IMPORT_ARCHIVE_MODE_INVALID', 'archiveMode must be none, sanitized, or raw', 'archiveMode')
    const input = root.input ?? root.document ?? root.sourceDocument
    if (input === undefined) fail('IMPORT_DOCUMENT_REQUIRED', 'confirmation must include the original JSON document', 'input')
    const prior = pending.get(transactionId)
    const selection = selectionInput(root)
    const expectedRegistryFingerprint = boundedString(root.expectedRegistryFingerprint ?? prior?.registryFingerprint, 'expectedRegistryFingerprint', 64, true)
  if (!prior && root.expectedRegistryFingerprint === undefined) fail('IMPORT_PREVIEW_REQUIRED', 'confirm requires a prior preview or expected Registry fingerprint', 'transactionId')
    const requestedSourceId = root.sourceId === undefined ? prior?.sourceId : boundedString(root.sourceId, 'sourceId', 128)
    const preflight = buildOpenApiImportPreview(input, {
      ...(configuredLimits ? { limits: configuredLimits } : {}),
      registry: clone(store.getSnapshot()),
      ...(requestedSourceId ? { sourceId: requestedSourceId } : {}),
    })
    if (!preflight.documentMeta) fail('IMPORT_PREVIEW_INVALID', 'OpenAPI document could not be previewed', 'input', { errors: preflight.errors })
    if (prior && (prior.documentId !== preflight.documentMeta.documentId || prior.fingerprint !== preflight.documentMeta.fingerprint)) fail('IMPORT_TRANSACTION_MISMATCH', 'transactionId does not match the supplied OpenAPI document', 'transactionId')
    const requestedDocumentId = root.documentId
    if (requestedDocumentId !== undefined && boundedString(requestedDocumentId, 'documentId', 180, true) !== preflight.documentMeta.documentId) fail('IMPORT_DOCUMENT_MISMATCH', 'documentId does not match the supplied OpenAPI document', 'documentId')
    if (root.fingerprint !== undefined && boundedString(root.fingerprint, 'fingerprint', 64, true) !== preflight.documentMeta.fingerprint) fail('IMPORT_DOCUMENT_MISMATCH', 'document fingerprint does not match the supplied OpenAPI document', 'fingerprint')
    for (const candidate of preflight.operations ?? []) {
      if (selection.conflictDecisions[candidate.sourceKey] !== undefined && candidate.status !== 'conflict') fail('IMPORT_DECISION_INVALID', 'conflict decisions may only target conflict candidates', `selection.conflictDecisions.${candidate.sourceKey}`)
    }
    const selectionHash = hashText(stableStringify(selection))
    if (prior?.completed) {
      if (prior.selectionHash === selectionHash) return clone(prior.result)
      fail('IMPORT_TRANSACTION_REPLAY', 'transactionId was already confirmed with different decisions', 'transactionId')
    }
    const dryRun = root.dryRun === true
    let outcome
    let saved
    try {
      if (dryRun) {
        const current = clone(store.getSnapshot())
        if (registryFingerprint(current) !== expectedRegistryFingerprint) fail('IMPORT_STALE_PREVIEW', 'Registry changed after the preview; please preview again', 'expectedRegistryFingerprint')
        const preview = buildOpenApiImportPreview(input, { ...(configuredLimits ? { limits: configuredLimits } : {}), registry: current, ...(requestedSourceId ? { sourceId: requestedSourceId } : {}) })
        if (!preview.documentMeta || preview.documentMeta.fingerprint !== preflight.documentMeta.fingerprint) fail('IMPORT_DOCUMENT_MISMATCH', 'OpenAPI document changed during confirmation', 'input')
        outcome = applyImport(current, preview, { transactionId }, selection, clock)
        outcome.dryRun = true
        outcome.registryFingerprint = registryFingerprint(current)
        saved = current
      } else {
        saved = await store.update((draft) => {
          if (registryFingerprint(draft) !== expectedRegistryFingerprint) fail('IMPORT_STALE_PREVIEW', 'Registry changed after the preview; please preview again', 'expectedRegistryFingerprint')
          const preview = buildOpenApiImportPreview(input, { ...(configuredLimits ? { limits: configuredLimits } : {}), registry: draft, ...(requestedSourceId ? { sourceId: requestedSourceId } : {}) })
          if (!preview.documentMeta || preview.documentMeta.fingerprint !== preflight.documentMeta.fingerprint) fail('IMPORT_DOCUMENT_MISMATCH', 'OpenAPI document changed during confirmation', 'input')
          outcome = applyImport(draft, preview, { transactionId }, selection, clock)
          return draft
        })
        outcome.registryFingerprint = registryFingerprint(saved)
      }
    } catch (error) {
      if (typeof options.onAudit === 'function') await options.onAudit({ kind: 'import-confirm', status: 0, ok: false, errorCode: error?.code || 'IMPORT_FAILED', rejectionReason: 'transaction-rejected' })
      if (error instanceof OpenApiImportTransactionError || error instanceof ConfigurationError) throw error
      fail(error?.code || 'IMPORT_FAILED', 'OpenAPI import transaction failed')
    }
    let archive = { saved: false, mode: 'none', raw: false }
    if (!dryRun && requestedArchiveMode !== 'none') {
      try {
        if (typeof store.saveImport === 'function') archive = await store.saveImport(input, { mode: requestedArchiveMode, name: preflight.documentMeta.documentId, allowRaw: root.allowRaw === true })
      } catch {
        archive = { saved: false, mode: requestedArchiveMode, raw: requestedArchiveMode === 'raw', failed: true }
      }
    }
    const result = safeResult({ ...outcome, archive, dryRun })
    if (!dryRun) pending.set(transactionId, { documentId: preflight.documentMeta.documentId, fingerprint: preflight.documentMeta.fingerprint, registryFingerprint: registryFingerprint(saved), sourceId: requestedSourceId, selectionHash, completed: true, result: clone(result) })
    if (typeof options.onAudit === 'function') await options.onAudit({ kind: 'import-confirm', status: 200, ok: true, rejectionReason: dryRun ? 'dry-run' : undefined })
    return result
  }

  return Object.freeze({
    previewOpenApiImport,
    confirmOpenApiImport,
    registryFingerprint,
  })
}

export { registryFingerprint, DECISIONS, ARCHIVE_MODES }
