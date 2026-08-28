import test from 'node:test'
import assert from 'node:assert/strict'
import { createWriteConfirmation, WriteConfirmationError, DEFAULT_TTL_MS } from '../lib/write-confirmation.js'

const binding = {
  sessionId: 'session-1', operationId: 'op-1', method: 'post',
  serviceTargetId: 'svc-1', environmentId: 'env-1',
  requestFingerprint: 'request-hash', registryFingerprint: 'registry-hash',
}
const token = (n) => `confirmation-token-${n}-0123456789`

function make(clock = () => 1000) {
  return createWriteConfirmation({ clock, generateToken: () => token('one') })
}

function code(codeValue) {
  return (error) => error instanceof WriteConfirmationError && error.code === codeValue
}

test('creates pending intent with bounded TTL and safe summary only', () => {
  const store = make()
  const result = store.create({ ...binding, body: { password: 'do-not-store' }, secret: 'secret-value', summary: {
    label: 'Update record', description: 'safe', url: 'https://user:password@example.test/private', authorization: 'Bearer hidden',
  } })
  assert.equal(result.state, 'pending')
  assert.equal(result.expiresAt, 1000 + DEFAULT_TTL_MS)
  assert.equal(result.summary.label, 'Update record')
  assert.equal('url' in result.summary, false)
  assert.equal(JSON.stringify(store).includes('do-not-store'), false)
  assert.equal(JSON.stringify(result).includes('secret-value'), false)
  assert.equal(store.size(), 1)
})

test('approve and consume is single-use and rejects binding mismatch or forgery', () => {
  const store = make()
  const created = store.create(binding)
  assert.throws(() => store.approve('forged-token-0123456789', binding), code('INTENT_NOT_FOUND'))
  assert.throws(() => store.approve(created.token, { ...binding, sessionId: 'other' }), code('BINDING_MISMATCH'))
  assert.equal(store.approve(created.token, binding).state, 'approved')
  assert.equal(store.consume(created.token, binding).state, 'consumed')
  assert.throws(() => store.consume(created.token, binding), code('INTENT_NOT_FOUND'))
})

test('cancelToken clears a pending intent without exposing its binding', () => {
  const store = make()
  const created = store.create(binding)
  assert.equal(store.cancelToken(created.token), true)
  assert.equal(store.size(), 0)
  assert.throws(() => store.cancelToken(created.token), code('INTENT_NOT_FOUND'))
})

test('approveToken approves an existing token without weakening consume binding', () => {
  const store = make()
  const created = store.create(binding)
  assert.equal(store.approveToken(created.token).state, 'approved')
  assert.throws(() => store.consume(created.token, { ...binding, method: 'delete' }), code('BINDING_MISMATCH'))
  assert.equal(store.consume(created.token, binding).state, 'consumed')
  assert.throws(() => store.approveToken(created.token), code('INTENT_NOT_FOUND'))
})

test('binding fields reject control characters and out-of-range whitespace', () => {
  const store = make()
  for (const field of Object.keys(binding)) {
    assert.throws(() => store.create({ ...binding, [field]: `bad\nvalue` }), code('INVALID_BINDING'))
    assert.throws(() => store.create({ ...binding, [field]: ` bad` }), code('INVALID_BINDING'))
    assert.throws(() => store.create({ ...binding, [field]: `bad ` }), code('INVALID_BINDING'))
  }
})

test('concurrent consume attempts cannot replay', async () => {
  const store = make()
  const created = store.create(binding)
  store.approve(created.token, binding)
  const results = await Promise.allSettled([
    Promise.resolve().then(() => store.consume(created.token, binding)),
    Promise.resolve().then(() => store.consume(created.token, binding)),
  ])
  assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1)
  assert.equal(results.filter((x) => x.status === 'rejected' && x.reason.code === 'INTENT_NOT_FOUND').length, 1)
})

test('expired intent cannot be approved or consumed', () => {
  let time = 1000
  const store = createWriteConfirmation({ clock: () => time, generateToken: () => token('expire') })
  const created = store.create({ ...binding, ttlMs: 20 })
  time = created.expiresAt
  assert.equal(store.size(), 0)
  assert.throws(() => store.approve(created.token, binding), code('INTENT_NOT_FOUND'))
})

test('reject, cancel, expire and clear remove intents', () => {
  let n = 0
  const store = createWriteConfirmation({ clock: () => 1000, generateToken: () => token(++n) })
  const a = store.create(binding); const b = store.create(binding); const c = store.create(binding)
  assert.equal(store.reject(a.token, binding), true)
  assert.equal(store.cancel(b.token, binding), true)
  assert.equal(store.expire(c.token, binding), true)
  assert.equal(store.size(), 0)
  assert.equal(store.clear(), 0)
})

test('stable error codes are exposed', () => {
  const store = make()
  assert.throws(() => store.create({ ...binding, sessionId: '' }), code('INVALID_BINDING'))
  const created = store.create(binding)
  assert.throws(() => store.consume(created.token, binding), code('NOT_APPROVED'))
})
