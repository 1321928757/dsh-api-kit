import test from 'node:test'
import assert from 'node:assert/strict'
import { createAuditLog, projectAuditRecord } from '../lib/audit-log.js'
import { createMemoryFs } from './helpers/memory-fs.mjs'

const DIR = 'C:\\dsh-api-kit-audit\\audit'
const CLOCK = () => new Date('2026-08-27T12:00:00.000Z')

function record(overrides = {}) {
  return { sessionId: 'session-a', kind: 'api_call', outed: true, operationId: 'get-user', kitIds: ['rpa'], environmentId: 'dev', method: 'GET', host: 'api.example.test', status: 200, durationMs: 12, resultBytes: 20, truncated: false, ok: true, ...overrides }
}

test('audit projection allowlists fields and excludes sensitive data', () => {
  const value = projectAuditRecord({ ...record(), url: 'https://api.example.test/x?token=bad', Authorization: 'Bearer secret', requestBody: { password: 'bad' }, stack: 'secret' }, CLOCK())
  assert.equal(value.url, undefined)
  assert.equal(value.Authorization, undefined)
  assert.equal(value.requestBody, undefined)
  assert.equal(value.stack, undefined)
  assert.equal(value.operationId, 'get-user')
})

test('audit log appends JSONL and rotates old date files', async () => {
  const fs = createMemoryFs()
  const audit = createAuditLog({ fs, directory: DIR, clock: CLOCK, maxDays: 14 })
  await audit.append(record())
  await audit.append(record({ ok: false, errorCode: 'IP_NOT_ALLOWED', rejectionReason: 'IP_NOT_ALLOWED' }))
  await audit.flush()
  const file = 'C:\\dsh-api-kit-audit\\audit\\audit-2026-08-27.jsonl'
  assert.equal(fs.getFile(file).trim().split('\n').length, 2)
  assert.equal(fs.getFile(file).includes('secret'), false)
})

test('audit write failure is isolated and diagnosed', async () => {
  const fs = createMemoryFs()
  const audit = createAuditLog({ fs, directory: DIR, clock: CLOCK })
  fs.fail('appendFile')
  assert.equal(await audit.append(record()), false)
  assert.equal(audit.getDiagnostics().dropped, 1)
  await audit.dispose()
  assert.equal(await audit.append(record()), false)
})

console.log('Audit log tests complete')
