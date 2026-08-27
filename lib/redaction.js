/**
 * Bounded, recursive response redaction.
 *
 * This module only handles already-parsed JSON values. Sensitive keys are
 * replaced before their values are traversed or counted, so secrets cannot
 * escape through a size-limit or error path. Plain text responses are handled
 * by the executor as bounded text and are deliberately not guessed at here.
 */

import { isRecord } from './normalizers.js'

export const REDACTED_VALUE = '[REDACTED]'
export const DEFAULT_REDACT_KEYS = Object.freeze([
  'access_key', 'access-key', 'accesskey', 'access_token', 'access-token', 'accesstoken',
  'api_key', 'api-key', 'apikey', 'x-api-key', 'csrf_token', 'csrf-token', 'session', 'session_id', 'authorization', 'client_secret', 'client-secret',
  'clientsecret', 'cookie', 'id_token', 'id-token', 'idtoken', 'password', 'passwd',
  'private_key', 'private-key', 'privatekey', 'refresh_token', 'refresh-token', 'refreshtoken',
  'secret', 'token',
])
export const REDACTION_MAX_DEPTH = 32
export const REDACTION_MAX_KEYS = 5000
export const REDACTION_MAX_ARRAY_ITEMS = 1000
export const REDACTION_MAX_STRING_LENGTH = 16000
export const REDACTION_MAX_BYTES = 512 * 1024

function normalizedKeys(values) {
  const source = Array.isArray(values) ? values : []
  const result = new Set(DEFAULT_REDACT_KEYS)
  for (const value of source.slice(0, 100)) {
    if (typeof value !== 'string') continue
    const key = value.trim().toLowerCase()
    if (/^[a-z][a-z0-9_.:-]{0,79}$/.test(key)) result.add(key)
  }
  return result
}

function keyMatches(key, keys) {
  return typeof key === 'string' && keys.has(key.trim().toLowerCase())
}

function byteLength(value) {
  const encoded = JSON.stringify(value)
  return typeof TextEncoder === 'function' ? new TextEncoder().encode(encoded).byteLength : encoded.length
}

export function createResponseRedactor(options = {}) {
  const configuredKeys = normalizedKeys(options.redactKeys)
  const hard = {
    maxDepth: Math.min(REDACTION_MAX_DEPTH, Number.isInteger(options.maxDepth) && options.maxDepth > 0 ? options.maxDepth : 8),
    maxKeys: Math.min(REDACTION_MAX_KEYS, Number.isInteger(options.maxKeys) && options.maxKeys > 0 ? options.maxKeys : 2000),
    maxArrayItems: Math.min(REDACTION_MAX_ARRAY_ITEMS, Number.isInteger(options.maxArrayItems) && options.maxArrayItems > 0 ? options.maxArrayItems : 200),
    maxString: Math.min(REDACTION_MAX_STRING_LENGTH, Number.isInteger(options.maxString) && options.maxString > 0 ? options.maxString : 12000),
    maxBytes: Math.min(REDACTION_MAX_BYTES, Number.isInteger(options.maxBytes) && options.maxBytes > 0 ? options.maxBytes : REDACTION_MAX_BYTES),
  }

  const redact = (value, localOptions = {}) => {
    const keys = normalizedKeys([...configuredKeys, ...(localOptions.redactKeys ?? [])])
    const limits = {
      maxDepth: Math.min(hard.maxDepth, Number.isInteger(localOptions.maxDepth) && localOptions.maxDepth > 0 ? localOptions.maxDepth : hard.maxDepth),
      maxKeys: Math.min(hard.maxKeys, Number.isInteger(localOptions.maxKeys) && localOptions.maxKeys > 0 ? localOptions.maxKeys : hard.maxKeys),
      maxArrayItems: Math.min(hard.maxArrayItems, Number.isInteger(localOptions.maxArrayItems) && localOptions.maxArrayItems > 0 ? localOptions.maxArrayItems : hard.maxArrayItems),
      maxString: Math.min(hard.maxString, Number.isInteger(localOptions.maxString) && localOptions.maxString > 0 ? localOptions.maxString : hard.maxString),
      maxBytes: Math.min(hard.maxBytes, Number.isInteger(localOptions.maxBytes) && localOptions.maxBytes > 0 ? localOptions.maxBytes : hard.maxBytes),
    }
    const state = { keys: 0, truncated: false, tooLarge: false, seen: new WeakSet() }

    const walk = (current, depth) => {
      if (depth > limits.maxDepth) {
        state.truncated = true
        return '[Truncated]'
      }
      if (current === null || typeof current === 'boolean' || typeof current === 'number') return current
      if (typeof current === 'string') {
        if (current.length > limits.maxString) state.truncated = true
        return current.slice(0, limits.maxString)
      }
      if (!Array.isArray(current) && !isRecord(current)) {
        state.truncated = true
        return '[Truncated]'
      }
      if (state.seen.has(current)) {
        state.truncated = true
        return '[Truncated]'
      }
      state.seen.add(current)
      let result
      if (Array.isArray(current)) {
        result = []
        const values = current.slice(0, limits.maxArrayItems)
        if (current.length > values.length) state.truncated = true
        for (const item of values) result.push(walk(item, depth + 1))
      } else {
        result = {}
        const entries = Object.entries(current)
        if (entries.length > limits.maxKeys) state.truncated = true
        for (const [key, item] of entries.slice(0, limits.maxKeys)) {
          state.keys += 1
          if (state.keys > limits.maxKeys) {
            state.truncated = true
            break
          }
          result[key.slice(0, 256)] = keyMatches(key, keys) ? REDACTED_VALUE : walk(item, depth + 1)
        }
      }
      state.seen.delete(current)
      return result
    }

    let data = walk(value, 0)
    try {
      if (byteLength(data) > limits.maxBytes) {
        state.tooLarge = true
        state.truncated = true
        if (isRecord(data)) {
          const bounded = {}
          for (const [key, child] of Object.entries(data)) {
            bounded[key] = child
            if (byteLength(bounded) > limits.maxBytes) {
              delete bounded[key]
              break
            }
          }
          data = bounded
        } else if (Array.isArray(data)) {
          while (data.length > 0 && byteLength(data) > limits.maxBytes) data.pop()
        }
      }
    } catch {
      state.tooLarge = true
      state.truncated = true
      data = REDACTED_VALUE
    }
    return { data, truncated: state.truncated, tooLarge: state.tooLarge, bytes: byteLength(data) }
  }

  return Object.freeze({ redact })
}

export function redactJsonValue(value, options = {}) {
  return createResponseRedactor(options).redact(value)
}
