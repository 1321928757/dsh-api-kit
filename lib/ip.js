/**
 * Dependency-free IP address and CIDR helpers used by the Host SSRF guard.
 *
 * The parser deliberately accepts only canonical textual IPv4/IPv6 forms (with
 * the usual IPv4 tail in IPv6) and never delegates classification to a DNS or
 * URL parser. IPv4-mapped IPv6 values are unwrapped before policy checks so an
 * address such as ::ffff:127.0.0.1 cannot bypass the IPv4 rules.
 */

const IPV4_MAX = 0xffffffffn
const IPV6_MAX = (1n << 128n) - 1n
const V4_MAPPED_PREFIX = 0xffffn
// These IPv6 forms carry an IPv4 value and therefore receive IPv4 policy
// checks as well (translated/compatible, NAT64 well-known prefix, and 6to4).

function ipv4ToBigInt(value) {
  if (typeof value !== 'string') return undefined
  const parts = value.split('.')
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return undefined
  let result = 0n
  for (const part of parts) {
    const number = Number(part)
    if (number > 255) return undefined
    result = (result << 8n) | BigInt(number)
  }
  return result
}

function bigIntToIpv4(value) {
  return [24n, 16n, 8n, 0n].map((shift) => String(Number((value >> shift) & 255n))).join('.')
}

function parseIpv6Words(value) {
  if (typeof value !== 'string' || !value || value.includes('%')) return undefined
  const input = value.toLowerCase().replace(/^\[|\]$/g, '')
  if (!input || input.includes('[') || input.includes(']')) return undefined
  const double = input.indexOf('::')
  if (double !== -1 && input.indexOf('::', double + 2) !== -1) return undefined

  const expand = (part) => {
    if (!part) return []
    const pieces = part.split(':')
    const words = []
    for (const piece of pieces) {
      if (!piece) return undefined
      if (piece.includes('.')) {
        const v4 = ipv4ToBigInt(piece)
        if (v4 === undefined) return undefined
        words.push(Number((v4 >> 16n) & 0xffffn), Number(v4 & 0xffffn))
      } else {
        if (!/^[0-9a-f]{1,4}$/.test(piece)) return undefined
        words.push(Number.parseInt(piece, 16))
      }
    }
    return words
  }

  let words
  if (double === -1) {
    words = expand(input)
    if (!words || words.length !== 8) return undefined
  } else {
    const left = expand(input.slice(0, double))
    const right = expand(input.slice(double + 2))
    if (!left || !right || left.length + right.length >= 8) return undefined
    words = [...left, ...Array(8 - left.length - right.length).fill(0), ...right]
  }
  return words
}

function wordsToBigInt(words) {
  let result = 0n
  for (const word of words) result = (result << 16n) | BigInt(word)
  return result
}

function bigIntToIpv6(value) {
  const words = []
  for (let shift = 112n; shift >= 0n; shift -= 16n) words.push(Number((value >> shift) & 0xffffn).toString(16))
  let bestStart = -1
  let bestLength = 0
  for (let start = 0; start < words.length;) {
    if (words[start] !== '0') {
      start += 1
      continue
    }
    let end = start
    while (end < words.length && words[end] === '0') end += 1
    if (end - start > bestLength) {
      bestStart = start
      bestLength = end - start
    }
    start = end
  }
  if (bestLength < 2) return words.join(':')
  const left = words.slice(0, bestStart).join(':')
  const right = words.slice(bestStart + bestLength).join(':')
  return `${left}::${right}`
}

export function parseIp(value) {
  if (typeof value !== 'string') return undefined
  const input = value.trim().replace(/^\[|\]$/g, '')
  const ipv4 = ipv4ToBigInt(input)
  if (ipv4 !== undefined) return { family: 4, address: bigIntToIpv4(ipv4), value: ipv4, mapped: false }
  const words = parseIpv6Words(input)
  if (!words) return undefined
  const value128 = wordsToBigInt(words)
  const low32 = value128 & IPV4_MAX
  const high96 = value128 >> 32n
  const isMapped = high96 === V4_MAPPED_PREFIX
  const isTranslated = high96 === 0xffff0000n
  const isCompatible = high96 === 0n && value128 !== 0n && value128 !== 1n
  const isNat64 = (value128 >> 96n) === 0x64ff9bn
  const isSixToFour = (value128 >> 112n) === 0x2002n
  if (isMapped || isTranslated || isCompatible || isNat64 || isSixToFour) {
    const embedded = isSixToFour ? ((value128 >> 80n) & IPV4_MAX) : low32
    return { family: 4, address: bigIntToIpv4(embedded), value: embedded, mapped: true, original: bigIntToIpv6(value128) }
  }
  return { family: 6, address: bigIntToIpv6(value128), value: value128, mapped: false }
}

export function normalizeIp(value) {
  return parseIp(value)?.address ?? ''
}

export function parseCidr(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) return undefined
  const input = value.trim()
  const slash = input.lastIndexOf('/')
  if (slash <= 0 || slash === input.length - 1 || input.indexOf('/', slash + 1) !== -1) return undefined
  const ip = parseIp(input.slice(0, slash))
  if (!ip || !/^\d+$/.test(input.slice(slash + 1))) return undefined
  const prefix = Number(input.slice(slash + 1))
  const bits = ip.family === 4 ? 32 : 128
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) return undefined
  const mask = prefix === 0 ? 0n : ((1n << BigInt(prefix)) - 1n) << BigInt(bits - prefix)
  const network = ip.value & mask
  return {
    family: ip.family,
    prefix,
    network,
    bits,
    value: `${ip.family === 4 ? bigIntToIpv4(network) : bigIntToIpv6(network)}/${prefix}`,
  }
}

export function normalizeCidr(value) {
  return parseCidr(value)?.value ?? ''
}

export function cidrContains(cidr, ip) {
  const range = typeof cidr === 'string' ? parseCidr(cidr) : cidr
  const candidate = typeof ip === 'string' ? parseIp(ip) : ip
  if (!range || !candidate || range.family !== candidate.family) return false
  const mask = range.prefix === 0 ? 0n : ((1n << BigInt(range.prefix)) - 1n) << BigInt(range.bits - range.prefix)
  return (candidate.value & mask) === range.network
}

const ranges = Object.freeze({
  v4Loopback: parseCidr('127.0.0.0/8'),
  v4Unspecified: parseCidr('0.0.0.0/32'),
  v4LinkLocal: parseCidr('169.254.0.0/16'),
  v4Private10: parseCidr('10.0.0.0/8'),
  v4Private172: parseCidr('172.16.0.0/12'),
  v4Private192: parseCidr('192.168.0.0/16'),
  v4Cgnat: parseCidr('100.64.0.0/10'),
  v4Reserved: [
    parseCidr('192.0.0.0/24'), parseCidr('192.0.2.0/24'), parseCidr('198.18.0.0/15'),
    parseCidr('198.51.100.0/24'), parseCidr('203.0.113.0/24'), parseCidr('240.0.0.0/4'),
  ],
  v4Multicast: parseCidr('224.0.0.0/4'),
  v6Loopback: parseCidr('::1/128'),
  v6Unspecified: parseCidr('::/128'),
  v6LinkLocal: parseCidr('fe80::/10'),
  v6Ula: parseCidr('fc00::/7'),
  v6Multicast: parseCidr('ff00::/8'),
  v6Documentation: parseCidr('2001:db8::/32'),
})

function inAny(ip, values) {
  return values.some((range) => cidrContains(range, ip))
}

export function classifyIp(value) {
  const ip = typeof value === 'string' ? parseIp(value) : value
  if (!ip) return { address: '', family: 0, category: 'invalid', private: false, highRisk: true, allowedByPrivateOptIn: false }
  const highRisk = ip.family === 4
    ? inAny(ip, [ranges.v4Loopback, ranges.v4Unspecified, ranges.v4LinkLocal, ranges.v4Multicast]) || inAny(ip, ranges.v4Reserved)
      || ip.address === '169.254.169.254'
    : inAny(ip, [ranges.v6Loopback, ranges.v6Unspecified, ranges.v6LinkLocal, ranges.v6Multicast, ranges.v6Documentation])
  const privateNetwork = ip.family === 4
    ? inAny(ip, [ranges.v4Private10, ranges.v4Private172, ranges.v4Private192, ranges.v4Cgnat])
    : inAny(ip, [ranges.v6Ula])
  let category = 'public'
  if (highRisk) category = ip.address === '169.254.169.254' ? 'metadata' : 'reserved'
  else if (privateNetwork) category = ip.family === 4 && cidrContains(ranges.v4Cgnat, ip) ? 'cgnat' : 'private'
  return {
    address: ip.address,
    family: ip.family,
    category,
    private: privateNetwork,
    highRisk,
    allowedByPrivateOptIn: privateNetwork && !highRisk,
    mapped: ip.mapped === true,
  }
}

export const IP_RANGES = ranges
export const IPV4_MAX_VALUE = IPV4_MAX
export const IPV6_MAX_VALUE = IPV6_MAX
