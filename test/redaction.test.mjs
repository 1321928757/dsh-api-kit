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

console.log('Redaction tests complete')
