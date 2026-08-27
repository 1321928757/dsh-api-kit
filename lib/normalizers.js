/**
 * dsh-api-kit domain normalizers.
 *
 * This module is deliberately independent from DSH, Cordis, the filesystem,
 * and the network. It converts untrusted plain JSON into bounded values that
 * can be used by the Registry, OpenAPI importer, DSH adapter, and future MCP
 * adapter.
 */

export const MAX_ID_LENGTH = 128
export const MAX_NAME_LENGTH = 120
export const MAX_DESCRIPTION_LENGTH = 4000
export const MAX_PATH_LENGTH = 2048
export const MAX_URL_LENGTH = 2048
export const MAX_TAG_LENGTH = 80
export const MAX_TAGS = 50
export const MAX_PARAMETERS = 100
export const MAX_HEADERS = 50
export const MAX_HOSTS = 50
export const MAX_CIDRS = 50
export const MAX_SCHEMA_DEPTH = 12
export const MAX_SCHEMA_KEYS = 2000
export const MAX_SCHEMA_ARRAY = 200
export const MAX_SCHEMA_STRING = 12000
export const MAX_SCHEMA_BYTES = 256 * 1024

const RESERVED_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function text(value, maxLength, fallback = '') {
  if (typeof value !== 'string') return fallback
  return value.trim().slice(0, maxLength)
}

export function identifier(value, fallback = '') {
  const raw = text(value, MAX_ID_LENGTH, '')
  if (!raw) return fallback
  const ascii = raw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  return ascii
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._:-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.:-]+|[.:-]+$/g, '')
    .slice(0, MAX_ID_LENGTH) || fallback
}

export function stableSlug(value, fallback = 'item') {
  const result = identifier(value, '').toLowerCase()
  return result || fallback
}

export function lowercaseIdentifier(value, fallback = '') {
  const result = identifier(value, '').toLowerCase()
  return result || fallback
}

export function uniqueStrings(values, maxItems, itemMaxLength = MAX_ID_LENGTH) {
  if (!Array.isArray(values)) return []
  const seen = new Set()
  const result = []
  for (const value of values) {
    if (typeof value !== 'string') continue
    const item = value.trim().slice(0, itemMaxLength)
    if (!item || seen.has(item)) continue
    seen.add(item)
    result.push(item)
    if (result.length >= maxItems) break
  }
  return result
}

export function normalizeTags(values) {
  return uniqueStrings(values, MAX_TAGS, MAX_TAG_LENGTH)
    .map((tag) => tag.replace(/\s+/g, '-'))
}

export function normalizeMethod(value) {
  if (typeof value !== 'string') return ''
  return value.trim().toUpperCase().slice(0, 16)
}

export function normalizePath(value) {
  const raw = text(value, MAX_PATH_LENGTH, '')
  if (!raw) return '/'
  // An operation path is never an absolute URL. The executor must resolve the
  // target only from the registered environment, so discard URL-shaped input.
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(raw) || raw.startsWith('//')) return '/'
  const pathOnly = raw.split(/[?#]/, 1)[0]
  const path = pathOnly.startsWith('/') ? pathOnly : '/' + pathOnly
  return path.replace(/\/+/g, '/').replace(/\/+$/g, '') || '/'
}

export function normalizeHost(value) {
  if (typeof value !== 'string') return ''
  let host = value.trim().toLowerCase()
  if (!host) return ''
  if (host.includes('://')) {
    try { host = new URL(host).hostname.toLowerCase() } catch { return '' }
  }
  host = host.replace(/^\[|\]$/g, '')
  return host.slice(0, 255)
}

export function normalizeHostList(values) {
  if (!Array.isArray(values)) return []
  const seen = new Set()
  const result = []
  for (const value of values) {
    const host = normalizeHost(value)
    if (!host || seen.has(host)) continue
    seen.add(host)
    result.push(host)
    if (result.length >= MAX_HOSTS) break
  }
  return result
}

export function normalizeCidrList(values) {
  if (!Array.isArray(values)) return []
  const result = []
  const seen = new Set()
  for (const value of values) {
    if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) continue
    const item = value.trim().slice(0, 255)
    if (!item || seen.has(item)) continue
    seen.add(item)
    result.push(item)
    if (result.length >= MAX_CIDRS) break
  }
  return result
}

export function normalizeBaseUrl(value) {
  const raw = text(value, MAX_URL_LENGTH, '')
  if (!raw) return ''
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    if (url.username || url.password || url.search || url.hash) return ''
    const pathname = url.pathname.replace(/\/+$/, '')
    return url.origin + (pathname === '/' ? '' : pathname)
  } catch {
    return ''
  }
}

export function deriveHostFromBaseUrl(baseUrl) {
  if (!baseUrl) return ''
  try {
    return normalizeHost(new URL(baseUrl).hostname)
  } catch {
    return ''
  }
}

export function normalizeTimeout(value, fallback = 15000) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(60000, Math.max(1000, Math.floor(number)))
}

export function normalizePort(value, fallback = 0) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > 65535) return fallback
  return Math.floor(number)
}

export function normalizeParameterLocation(value) {
  if (typeof value !== 'string') return ''
  const location = value.trim().toLowerCase()
  return ['path', 'query', 'header', 'cookie'].includes(location) ? location : location.slice(0, 16)
}

export function normalizeParameterName(value) {
  return text(value, 256, '').replace(/[\r\n]/g, '')
}

export function normalizeJsonValue(value, options = {}) {
  const maxDepth = options.maxDepth ?? MAX_SCHEMA_DEPTH
  const maxKeys = options.maxKeys ?? MAX_SCHEMA_KEYS
  const maxArray = options.maxArray ?? MAX_SCHEMA_ARRAY
  const maxString = options.maxString ?? MAX_SCHEMA_STRING
  const maxBytes = options.maxBytes ?? MAX_SCHEMA_BYTES
  const state = { keys: 0, bytes: 0, seen: new WeakSet() }

  const walk = (current, depth) => {
    if (state.bytes > maxBytes) throw new Error('JSON value exceeds the maximum size')
    if (current === null || typeof current === 'boolean' || typeof current === 'number') return current
    if (typeof current === 'string') {
      const result = current.slice(0, maxString)
      state.bytes += result.length
      return result
    }
    if (typeof current !== 'object') return undefined
    if (state.seen.has(current)) throw new Error('JSON value contains a cycle')
    if (depth > maxDepth) throw new Error('JSON value exceeds the maximum depth')

    state.seen.add(current)
    let result
    if (Array.isArray(current)) {
      result = []
      for (const item of current.slice(0, maxArray)) {
        const normalized = walk(item, depth + 1)
        if (normalized !== undefined) result.push(normalized)
      }
    } else {
      result = {}
      const entries = Object.entries(current).slice(0, maxKeys)
      for (const [key, item] of entries) {
        if (RESERVED_OBJECT_KEYS.has(key)) continue
        state.keys += 1
        if (state.keys > maxKeys) break
        const normalized = walk(item, depth + 1)
        if (normalized !== undefined) result[key.slice(0, 256)] = normalized
      }
    }
    state.seen.delete(current)
    return result
  }

  const result = walk(value, 0)
  const encoded = JSON.stringify(result)
  if (encoded && encoded.length > maxBytes) throw new Error('JSON value exceeds the maximum size')
  return result
}

export function normalizeJsonSchema(value) {
  if (typeof value === 'boolean') return value
  if (!isRecord(value)) return {}
  return normalizeJsonValue(value)
}

export function normalizeExample(value) {
  if (value === undefined) return undefined
  try { return normalizeJsonValue(value, { maxDepth: 8, maxKeys: 500, maxArray: 100, maxString: 8000, maxBytes: 64 * 1024 }) } catch { return undefined }
}

export function normalizeSchemaMap(value) {
  if (!isRecord(value)) return {}
  const result = {}
  for (const [key, schema] of Object.entries(value).slice(0, 500)) {
    if (RESERVED_OBJECT_KEYS.has(key)) continue
    result[key.slice(0, 256)] = normalizeJsonSchema(schema)
  }
  return result
}
