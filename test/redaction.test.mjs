import test from 'node:test'
import assert from 'node:assert/strict'
import { createResponseRedactor, redactJsonValue, REDACTED_VALUE } from '../lib/redaction.js'

test('redacts sensitive fields recursively and case-insensitively', () => {
  const result = redactJsonValue({ user: { name: 'alice', password: 'secret' }, items: [{ token: 'abc', value: 1 }], Authorization: 'Bearer x' })
  assert.deepEqual(result.data.user, { name: 'alice', password: REDACTED_VALUE })
  assert.equal(result.data.items[0].token, REDACTED_VALUE)
  assert.equal(result.data.Authorization, REDACTED_VALUE)
})

test('supports bounded custom keys without accepting regexes', () => {
  const redactor = createResponseRedactor({ redactKeys: ['internalId'] })
  assert.equal(redactor.redact({ internalId: 'x' }).data.internalId, REDACTED_VALUE)
  assert.equal(redactor.redact({ other: 'x' }).data.other, 'x')
})

test('bounds depth arrays strings and total bytes', () => {
  const redactor = createResponseRedactor({ maxDepth: 2, maxArrayItems: 2, maxString: 3, maxBytes: 40 })
  const result = redactor.redact({ long: 'abcdef', list: [1, 2, 3], nested: { next: { value: true } } })
  assert.equal(result.truncated, true)
  assert.equal(result.data.long, 'abc')
  assert.equal(result.data.list.length, 2)
})

test('cycles and unsupported values fail closed without throwing', () => {
  const value = {}; value.self = value
  const result = redactJsonValue(value)
  assert.equal(result.truncated, true)
  assert.equal(result.data.self, '[Truncated]')
  assert.equal(redactJsonValue(Symbol('x')).data, '[Truncated]')
})

test('sensitive response redaction defaults on and only strict false disables it', () => {
  const value = { access_token: 'fixture-access-value', nested: [{ Refresh_Token: 'fixture-refresh-value', password: 'fixture-password-value' }] }
  assert.equal(redactJsonValue(value).data.access_token, REDACTED_VALUE)
  assert.deepEqual(redactJsonValue(value, { redactSensitive: false }).data, value)
  assert.deepEqual(createResponseRedactor({ redactSensitive: false }).redact(value).data, value)
  for (const redactSensitive of [true, undefined, null, 0, 1, '', 'false', [], {}]) {
    assert.equal(redactJsonValue(value, { redactSensitive }).data.access_token, REDACTED_VALUE)
    assert.equal(createResponseRedactor().redact(value, { redactSensitive }).data.access_token, REDACTED_VALUE)
  }
})

test('per-call opt-out includes custom keys and never changes the next default call', () => {
  const value = { access_token: 'fixture-access-value', internalId: 'fixture-internal-value', child: { token: 'fixture-child-value' } }
  const redactor = createResponseRedactor({ redactKeys: ['internalId'] })
  assert.deepEqual(redactor.redact(value, { redactSensitive: false }).data, value)
  assert.deepEqual(redactor.redact(value).data, { access_token: REDACTED_VALUE, internalId: REDACTED_VALUE, child: { token: REDACTED_VALUE } })
  assert.deepEqual(value, { access_token: 'fixture-access-value', internalId: 'fixture-internal-value', child: { token: 'fixture-child-value' } })
})

test('sensitive-key opt-out still bounds depth arrays strings key count and key length', () => {
  const limits = { maxDepth: 1, maxArrayItems: 2, maxString: 3, maxKeys: 2 }
  const depth = redactJsonValue({ access_token: { child: { token: 'fixture-value' } } }, { ...limits, redactSensitive: false })
  assert.deepEqual(depth.data, { access_token: { child: '[Truncated]' } })
  assert.equal(depth.truncated, true)
  const array = redactJsonValue({ token: [1, 2, 3] }, { ...limits, maxDepth: 3, redactSensitive: false })
  assert.deepEqual(array.data.token, [1, 2])
  assert.equal(array.truncated, true)
  const string = redactJsonValue({ access_token: 'abcdef' }, { ...limits, redactSensitive: false })
  assert.equal(string.data.access_token, 'abc')
  assert.equal(string.truncated, true)
  const keys = redactJsonValue({ token: 'x', child: { password: 'y', extra: 'z' }, omitted: true }, { ...limits, maxDepth: 3, redactSensitive: false })
  assert.deepEqual(keys.data, { token: 'x', child: {} })
  assert.equal(keys.truncated, true)
  const longKey = 'k'.repeat(300)
  const keyLength = redactJsonValue({ [longKey]: 'x' }, { redactSensitive: false })
  assert.deepEqual(Object.keys(keyLength.data), [longKey.slice(0, 256)])
})

test('sensitive-key opt-out cannot loosen construction limits and retains byte bounds', () => {
  const redactor = createResponseRedactor({ maxDepth: 1, maxArrayItems: 2, maxString: 3, maxKeys: 2, maxBytes: 32 })
  const loose = { redactSensitive: false, maxDepth: 32, maxArrayItems: 1000, maxString: 16000, maxKeys: 5000, maxBytes: 512 * 1024 }
  assert.equal(redactor.redact({ token: 'abcdef' }, loose).data.token, 'abc')
  assert.deepEqual(redactor.redact([1, 2, 3], loose).data, [1, 2])
  assert.deepEqual(redactor.redact({ a: { token: 'x' } }, loose).data, { a: { token: '[Truncated]' } })
  assert.deepEqual(redactor.redact({ a: 1, b: 2, token: 3 }, loose).data, { a: 1, b: 2 })
  for (const value of [{ access_token: 'x'.repeat(60) }, ['x'.repeat(60), 'y'.repeat(60)]]) {
    const result = redactJsonValue(value, { redactSensitive: false, maxBytes: 32 })
    assert.equal(result.tooLarge, true)
    assert.equal(result.truncated, true)
    assert.ok(result.bytes <= 32)
    assert.ok(new TextEncoder().encode(JSON.stringify(result.data)).byteLength <= 32)
  }
})

test('sensitive-key opt-out retains cycle and unsupported-value fail-closed handling', () => {
  const value = { access_token: 'fixture-access-value' }
  value.token = value
  const result = redactJsonValue(value, { redactSensitive: false })
  assert.equal(result.data.access_token, 'fixture-access-value')
  assert.equal(result.data.token, '[Truncated]')
  assert.equal(result.truncated, true)
  assert.equal(redactJsonValue(Symbol('fixture-value'), { redactSensitive: false }).data, '[Truncated]')
})

console.log('Redaction tests complete')
