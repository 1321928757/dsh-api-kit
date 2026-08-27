/**
 * Host-only append-only JSONL audit sink.
 *
 * Audit records are intentionally a small allowlisted projection. This module
 * never receives request headers, credentials, body, URL, response headers or
 * raw Error objects. A malformed record is rejected rather than serialized.
 */

import { appendFile, mkdir, readdir, unlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const FILE_PATTERN = /^audit-(\d{4}-\d{2}-\d{2})(?:-(\d+))?\.jsonl$/
const DEFAULT_MAX_DAYS = 14
const DEFAULT_MAX_LINE_BYTES = 16 * 1024
const MAX_STRING = 256
const MAX_ARRAY = 20
const ALLOWED_FIELDS = new Set([
  'timestamp', 'sessionId', 'kind', 'outed', 'operationId', 'kitIds', 'environmentId',
  'method', 'host', 'status', 'durationMs', 'resultBytes', 'truncated', 'ok', 'serviceTargetId',
  'errorCode', 'rejectionReason',
])
const FORBIDDEN_KEY = /(url|baseurl|path|query|header|authorization|cookie|secret|token|password|body|stack|cause|credential|location)/i

function clone(value) {
  try { return JSON.parse(JSON.stringify(value)) } catch { return undefined }
}

function dateValue(clock) {
  const raw = typeof clock === 'function' ? clock() : clock
  const date = raw instanceof Date ? raw : new Date(raw ?? Date.now())
  if (Number.isNaN(date.getTime())) throw new TypeError('clock must produce a valid date')
  return date
}

function dateStamp(date) {
  return date.toISOString().slice(0, 10)
}

function filePath(directory, stamp, sequence = 0) {
  return path.join(directory, `audit-${stamp}${sequence > 0 ? `-${sequence}` : ''}.jsonl`)
}

function safeString(value) {
  if (typeof value !== 'string') return undefined
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, MAX_STRING)
  return cleaned || undefined
}

function safeInteger(value, min = 0) {
  return Number.isInteger(value) && value >= min ? value : undefined
}

function project(record, now) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError('audit record must be an object')
  const output = { timestamp: dateValue(record.timestamp ?? now).toISOString() }
  for (const [key, value] of Object.entries(record)) {
    if (!ALLOWED_FIELDS.has(key) || FORBIDDEN_KEY.test(key)) continue
    if (key === 'kitIds') {
      if (Array.isArray(value)) output.kitIds = value.filter((item) => typeof item === 'string').map((item) => safeString(item)).filter(Boolean).slice(0, MAX_ARRAY)
      continue
    }
    if (['sessionId', 'kind', 'operationId', 'serviceTargetId', 'environmentId', 'method', 'host', 'errorCode', 'rejectionReason'].includes(key)) {
      const safe = safeString(value)
      if (safe !== undefined) output[key] = safe
      continue
    }
    if (['outed', 'truncated', 'ok'].includes(key)) {
      if (typeof value === 'boolean') output[key] = value
      continue
    }
    if (['status', 'durationMs', 'resultBytes'].includes(key)) {
      const safe = safeInteger(value)
      if (safe !== undefined) output[key] = safe
    }
  }
  for (const key of Object.keys(output)) if (FORBIDDEN_KEY.test(key)) throw new TypeError('audit record contains forbidden data')
  return output
}

function lineBytes(value) {
  const line = `${JSON.stringify(value)}\n`
  return typeof TextEncoder === 'function' ? new TextEncoder().encode(line).byteLength : line.length
}

export function createAuditLog(options = {}) {
  const fs = options.fs ?? { appendFile, mkdir, readdir, unlink }
  if (fs && typeof fs === 'object' && (typeof fs.appendFile !== 'function' || typeof fs.mkdir !== 'function')) {
    throw new TypeError('audit fs requires appendFile and mkdir')
  }
  for (const name of ['appendFile', 'mkdir']) if (typeof fs[name] !== 'function') throw new TypeError(`audit fs requires ${name}`)
  const clock = options.clock ?? (() => new Date())
  const directory = typeof options.directory === 'string' && options.directory.trim()
    ? path.resolve(options.directory)
    : path.join(typeof options.dshHome === 'string' && options.dshHome.trim() ? options.dshHome : (process.env.DSH_HOME || path.join(os.homedir(), '.dsh')), 'storages', 'dsh-api-kit', 'audit')
  const maxDays = Number.isInteger(options.maxDays) ? Math.max(1, Math.min(90, options.maxDays)) : DEFAULT_MAX_DAYS
  const maxLineBytes = Number.isInteger(options.maxLineBytes) ? Math.max(1024, Math.min(256 * 1024, options.maxLineBytes)) : DEFAULT_MAX_LINE_BYTES
  const diagnostics = { lastError: undefined, dropped: 0 }
  let queue = Promise.resolve()
  let disposed = false
  let cleanupStamp = ''

  const enqueue = (task) => {
    const result = queue.then(task, task)
    queue = result.then(() => undefined, () => undefined)
    return result
  }

  const cleanup = async (currentDate) => {
    if (typeof fs.readdir !== 'function' || typeof fs.unlink !== 'function') return
    const names = await fs.readdir(directory).catch(() => [])
    const cutoff = currentDate.getTime() - maxDays * 24 * 60 * 60 * 1000
    for (const name of names) {
      const match = typeof name === 'string' ? name.match(FILE_PATTERN) : null
      if (!match) continue
      const timestamp = Date.parse(`${match[1]}T00:00:00.000Z`)
      if (Number.isFinite(timestamp) && timestamp < cutoff) await fs.unlink(path.join(directory, name)).catch(() => {})
    }
  }

  const append = (record) => {
    if (disposed) return Promise.resolve(false)
    return enqueue(async () => {
      if (disposed) return false
      const now = dateValue(clock)
      const value = project(record, now)
      if (lineBytes(value) > maxLineBytes) throw new TypeError('audit record exceeds the line limit')
      const target = filePath(directory, dateStamp(now))
      await fs.mkdir(directory, { recursive: true })
      await fs.appendFile(target, `${JSON.stringify(value)}\n`, 'utf8')
      if (cleanupStamp !== dateStamp(now)) {
        cleanupStamp = dateStamp(now)
        await cleanup(now)
      }
      return true
    }).catch((error) => {
      diagnostics.lastError = { code: typeof error?.code === 'string' ? error.code : 'AUDIT_WRITE_FAILED', message: 'Audit record was not persisted' }
      diagnostics.dropped += 1
      return false
    })
  }

  const flush = () => queue
  const dispose = async () => {
    disposed = true
    await queue
  }
  return Object.freeze({
    directory,
    maxDays,
    append,
    flush,
    dispose,
    getDiagnostics: () => clone(diagnostics),
  })
}

export { ALLOWED_FIELDS, FILE_PATTERN, project as projectAuditRecord }
