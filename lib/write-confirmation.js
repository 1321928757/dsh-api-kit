/**
 * In-memory, single-use confirmation intents for potentially mutating writes.
 *
 * This module is deliberately independent of DSH.  The request body and any
 * secret passed to create() are used only to calculate an optional caller
 * fingerprint; neither is retained.  Only a SHA-256 hash of the opaque token
 * is held in memory.
 */

import { createHash, randomBytes } from 'node:crypto'

export const DEFAULT_TTL_MS = 5 * 60 * 1000
export const MAX_TTL_MS = 30 * 60 * 1000
export const MAX_SUMMARY_BYTES = 4096

export class WriteConfirmationError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'WriteConfirmationError'
    this.code = code
  }
  toJSON() { return { name: this.name, code: this.code, message: this.message } }
}

const fail = (code, message) => { throw new WriteConfirmationError(code, message) }
const required = (v, name) => {
  if (typeof v !== 'string' || v.length === 0 || v.length > 512) fail('INVALID_BINDING', `${name} must be a non-empty bounded string`)
  // Binding identifiers are protocol data: reject controls and surrounding whitespace
  // rather than silently normalising values that must match exactly at consume time.
  if (v.trim() !== v || Array.from(v).some((char) => {
    const code = char.charCodeAt(0)
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f)
  })) {
    fail('INVALID_BINDING', `${name} contains invalid whitespace or control characters`)
  }
  return v
}

function defaultToken() {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(32)
    c.getRandomValues(bytes)
    return Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join('')
  }
  // Node's CSPRNG is only a fallback; callers may always inject a generator.
  return randomBytes(32).toString('hex')
}

function hashToken(token) {
  if (typeof token !== 'string' || token.length < 16 || token.length > 4096) fail('INVALID_TOKEN', 'token is invalid')
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

function boundedScalar(value) {
  if (typeof value === 'string') {
    // Keep human labels bounded and remove URL/credential-shaped material.
    if (/https?:\/\//i.test(value) || /(?:bearer|basic|api[_ -]?key|secret|password|token)\s*[:=]/i.test(value) || /[A-Za-z][A-Za-z0-9_.-]*\s*=/.test(value)) return undefined
    return value.slice(0, 256)
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'boolean' || value === null) return value
  return undefined
}

function makeSummary(input, binding) {
  // Explicit allow-list: notably no URL, path, headers, auth, body, or secret.
  const summary = {}
  for (const key of ['operationId', 'method', 'serviceTargetId', 'environmentId']) {
    const value = boundedScalar(binding[key])
    if (value !== undefined) summary[key] = value
  }
  const minimal = () => Object.freeze({ ...summary })
  if (input && typeof input === 'object') {
    for (const key of ['label', 'description', 'estimatedImpact']) {
      const value = boundedScalar(input[key])
      if (value !== undefined) summary[key] = value
    }
  }
  let encoded
  try { encoded = JSON.stringify(summary) } catch { return minimal() }
  if (new TextEncoder().encode(encoded).byteLength > MAX_SUMMARY_BYTES) return minimal()
  return Object.freeze(summary)
}

function bindingOf(input = {}) {
  return Object.freeze({
    sessionId: required(input.sessionId, 'sessionId'),
    operationId: required(input.operationId, 'operationId'),
    method: required(input.method, 'method').toUpperCase(),
    serviceTargetId: required(input.serviceTargetId, 'serviceTargetId'),
    environmentId: required(input.environmentId, 'environmentId'),
    requestFingerprint: required(input.requestFingerprint, 'requestFingerprint'),
    registryFingerprint: required(input.registryFingerprint, 'registryFingerprint'),
  })
}

function sameBinding(a, b) {
  return ['sessionId', 'operationId', 'method', 'serviceTargetId', 'environmentId', 'requestFingerprint', 'registryFingerprint']
    .every((key) => a[key] === b[key])
}

export function createWriteConfirmation(options = {}) {
  const clock = typeof options.clock === 'function' ? options.clock : () => Date.now()
  const generateToken = typeof options.generateToken === 'function'
    ? options.generateToken
    : (typeof options.tokenGenerator === 'function' ? options.tokenGenerator : (typeof options.idGenerator === 'function' ? options.idGenerator : defaultToken))
  const intents = new Map()
  const ttlLimit = Number.isFinite(options.maxTtlMs) ? Math.min(MAX_TTL_MS, Math.max(1, options.maxTtlMs)) : MAX_TTL_MS

  function now() { const value = clock(); return value instanceof Date ? value.getTime() : Number(value) }
  function purgeExpired() {
    const at = now()
    for (const [key, item] of intents) if (item.expiresAt <= at) intents.delete(key)
  }
  function lookup(token, binding, action) {
    purgeExpired()
    const item = intents.get(hashToken(token))
    if (!item) fail('INTENT_NOT_FOUND', 'confirmation intent was not found')
    if (!binding) fail('INVALID_BINDING', 'confirmation binding is required')
    if (!sameBinding(item.binding, bindingOf(binding))) fail('BINDING_MISMATCH', 'confirmation binding does not match')
    if (action === 'approve' && item.state !== 'pending') fail('INVALID_STATE', `cannot approve intent in ${item.state} state`)
    if (action === 'consume' && item.state !== 'approved') fail('NOT_APPROVED', 'confirmation intent is not approved')
    return item
  }

  function create(input = {}) {
    purgeExpired()
    const binding = bindingOf(input)
    const ttlMs = Number.isFinite(input.ttlMs) ? Math.min(ttlLimit, Math.max(1, input.ttlMs)) : Math.min(DEFAULT_TTL_MS, ttlLimit)
    const token = String(generateToken())
    if (token.length < 16) fail('INVALID_TOKEN', 'token generator returned an invalid token')
    const tokenHash = hashToken(token)
    const createdAt = now()
    const item = { tokenHash, binding, summary: makeSummary(input.summary, binding), state: 'pending', createdAt, expiresAt: createdAt + ttlMs }
    intents.set(tokenHash, item)
    return Object.freeze({ token, state: item.state, createdAt, expiresAt: item.expiresAt, summary: item.summary })
  }

  function approve(token, binding) {
    const item = lookup(token, binding, 'approve')
    item.state = 'approved'
    return Object.freeze({ state: item.state, expiresAt: item.expiresAt, summary: item.summary })
  }
  function approveToken(token) {
    purgeExpired()
    const item = intents.get(hashToken(token))
    if (!item) fail('INTENT_NOT_FOUND', 'confirmation intent was not found')
    if (item.state !== 'pending') fail('INVALID_STATE', `cannot approve intent in ${item.state} state`)
    item.state = 'approved'
    return Object.freeze({ state: item.state, expiresAt: item.expiresAt, summary: item.summary })
  }
  function consume(token, binding) {
    const item = lookup(token, binding, 'consume')
    // Delete before returning: consume is atomic and replay/concurrent calls fail.
    intents.delete(item.tokenHash)
    item.state = 'consumed'
    return Object.freeze({ state: 'consumed', operationId: item.binding.operationId, method: item.binding.method, summary: item.summary })
  }
  function transition(token, binding, state) {
    const item = lookup(token, binding)
    intents.delete(item.tokenHash)
    item.state = state
    return true
  }
  function reject(token, binding) { return transition(token, binding, 'rejected') }
  function cancel(token, binding) { return transition(token, binding, 'cancelled') }
  function cancelToken(token) {
    purgeExpired()
    const tokenHash = hashToken(token)
    const item = intents.get(tokenHash)
    if (!item) fail('INTENT_NOT_FOUND', 'confirmation intent was not found')
    if (item.state !== 'pending') fail('INVALID_STATE', `cannot cancel intent in ${item.state} state`)
    intents.delete(tokenHash)
    return true
  }
  function expire(token, binding) { return transition(token, binding, 'expired') }
  function clear() { const count = intents.size; intents.clear(); return count }
  function clearSession(sessionId) {
    if (typeof sessionId !== 'string') return 0
    purgeExpired()
    let count = 0
    for (const [tokenHash, item] of intents) {
      if (item.binding.sessionId === sessionId) {
        intents.delete(tokenHash)
        count += 1
      }
    }
    return count
  }

  return Object.freeze({ create, approve, approveToken, consume, reject, cancel, cancelToken, expire, clear, clearSession, size: () => (purgeExpired(), intents.size) })
}

export const createWriteConfirmationStore = createWriteConfirmation
export default createWriteConfirmation
