import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyIp, cidrContains, normalizeCidr, parseIp } from '../lib/ip.js'
import { createDnsResolver, resolveAndValidateTarget } from '../lib/ssrf.js'

const publicEnvironment = { id: 'dev', allowedHosts: ['api.example.test'], allowedCidrs: [], allowPrivateNetwork: false, port: 443 }

for (const [address, category, highRisk, family] of [
  ['127.0.0.1', 'reserved', true, 4], ['169.254.169.254', 'metadata', true, 4], ['10.2.3.4', 'private', false, 4],
  ['172.20.1.2', 'private', false, 4], ['192.168.1.2', 'private', false, 4], ['100.64.1.2', 'cgnat', false, 4],
  ['::1', 'reserved', true, 6], ['fe80::1', 'reserved', true, 6], ['fc00::1', 'private', false, 6],
  ['::ffff:127.0.0.1', 'reserved', true, 4], ['::ffff:0:127.0.0.1', 'reserved', true, 4], ['64:ff9b::7f00:1', 'reserved', true, 4], ['::127.0.0.1', 'reserved', true, 4], ['2002:7f00:1::1', 'reserved', true, 4], ['2001:db8::1', 'reserved', true, 6],
  ['8.8.8.8', 'public', false, 4],
]) test(`classifies ${address}`, () => {
  const result = classifyIp(address)
  assert.equal(result.category, category)
  assert.equal(result.highRisk, highRisk)
  assert.equal(result.family, family)
})

test('normalizes and matches IPv4 and IPv6 CIDR ranges', () => {
  assert.equal(normalizeCidr('10.0.0.1/8'), '10.0.0.0/8')
  assert.equal(normalizeCidr('FC00::1/7'), 'fc00::/7')
  assert.equal(cidrContains('10.0.0.0/8', '10.20.1.1'), true)
  assert.equal(cidrContains('10.0.0.0/8', '11.20.1.1'), false)
  assert.equal(cidrContains('fc00::/7', 'fd00::123'), true)
  assert.equal(parseIp('not-an-ip'), undefined)
})

test('requires all DNS answers to pass policy and returns a fixed address', async () => {
  const resolver = createDnsResolver({ lookupAll: async () => [{ address: '10.0.0.8', family: 4 }] })
  await assert.rejects(resolveAndValidateTarget(new URL('https://api.example.test/x'), publicEnvironment, { resolver }), (error) => error.code === 'PRIVATE_ADDRESS_NOT_ALLOWED')
  const allowed = { ...publicEnvironment, allowPrivateNetwork: true, allowedCidrs: ['10.0.0.0/8'] }
  const resolved = await resolveAndValidateTarget(new URL('https://api.example.test/x'), allowed, { resolver })
  assert.equal(resolved.address, '10.0.0.8')
  assert.equal(resolved.family, 4)
})

test('rejects mixed answers, empty answers, DNS failures and cancellation', async () => {
  const mixed = createDnsResolver({ lookupAll: async () => [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }] })
  await assert.rejects(resolveAndValidateTarget(new URL('https://api.example.test/x'), publicEnvironment, { resolver: mixed }), (error) => error.code === 'IP_NOT_ALLOWED')
  const empty = createDnsResolver({ lookupAll: async () => [] })
  await assert.rejects(resolveAndValidateTarget(new URL('https://api.example.test/x'), publicEnvironment, { resolver: empty }), (error) => error.code === 'DNS_NO_ADDRESS')
  const failure = createDnsResolver({ lookupAll: async () => { throw new Error('dns') } })
  await assert.rejects(resolveAndValidateTarget(new URL('https://api.example.test/x'), publicEnvironment, { resolver: failure }), (error) => error.code === 'DNS_RESOLUTION_FAILED')
  const controller = new AbortController(); controller.abort()
  await assert.rejects(resolveAndValidateTarget(new URL('https://api.example.test/x'), publicEnvironment, { resolver: failure, signal: controller.signal }), (error) => error.code === 'ABORTED')
})

console.log('SSRF tests complete')
