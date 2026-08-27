/**
 * Execution-time DNS/IP SSRF policy.
 *
 * All addresses returned by a resolver are checked before a request is made.
 * The selected address is then passed to a pinned transport; using a resolver
 * only as a preflight check with hostname-based fetch would not prevent DNS
 * rebinding and is intentionally not supported by this module.
 */

import { promises as dns } from 'node:dns'
import { ConfigurationError } from './config-validation.js'
import { cidrContains, classifyIp, normalizeCidr, parseCidr, parseIp } from './ip.js'
import { normalizeHost } from './normalizers.js'

export const SSRF_MAX_RESOLVED_ADDRESSES = 32
export const SSRF_MAX_ALLOWED_CIDRS = 50

const PRIVATE_CATEGORIES = new Set(['private', 'cgnat'])

function safeError(code, message, details) {
  const error = new ConfigurationError(code, message, { detail: details })
  return error
}

function hostMatches(host, allowedHosts) {
  return Array.isArray(allowedHosts) && allowedHosts.some((value) => normalizeHost(value) === host)
}

function normalizeResolverResult(value) {
  const source = Array.isArray(value) ? value : [value]
  const result = []
  const seen = new Set()
  for (const entry of source.slice(0, SSRF_MAX_RESOLVED_ADDRESSES)) {
    const address = typeof entry === 'string' ? entry : entry?.address
    const family = typeof entry === 'object' && entry !== null ? entry.family : undefined
    const parsed = parseIp(address)
    if (!parsed || (family !== undefined && Number(family) !== parsed.family)) {
      throw safeError('DNS_ADDRESS_INVALID', 'DNS returned an invalid address')
    }
    if (seen.has(parsed.address)) continue
    seen.add(parsed.address)
    result.push({ address: parsed.address, family: parsed.family })
  }
  if (result.length === 0) throw safeError('DNS_NO_ADDRESS', 'DNS returned no usable address')
  return result
}

function validateCidrList(environment) {
  const values = Array.isArray(environment?.allowedCidrs) ? environment.allowedCidrs : []
  if (values.length > SSRF_MAX_ALLOWED_CIDRS) throw safeError('CIDR_INVALID', 'Environment allowedCidrs exceeds the supported limit')
  const result = []
  const seen = new Set()
  for (const value of values) {
    const normalized = normalizeCidr(value)
    const parsed = parseCidr(value)
    if (!parsed || !normalized || seen.has(normalized)) {
      throw safeError('CIDR_INVALID', 'Environment contains an invalid allowed CIDR')
    }
    seen.add(normalized)
    result.push(parsed)
  }
  return result
}

export function createDnsResolver(options = {}) {
  const lookupAll = options.lookupAll ?? (async (host, lookupOptions = {}) => dns.lookup(host, { all: true, verbatim: true, signal: lookupOptions.signal }))
  if (typeof lookupAll !== 'function') throw new TypeError('lookupAll must be a function')
  return Object.freeze({
    async lookupAll(host, lookupOptions = {}) {
      return lookupAll(host, lookupOptions)
    },
  })
}

export async function resolveAndValidateTarget(url, environment, options = {}) {
  if (!(url instanceof URL)) throw safeError('URL_INVALID', 'fixed target URL is invalid')
  const host = normalizeHost(url.hostname)
  if (!host || !hostMatches(host, environment?.allowedHosts)) throw safeError('HOST_NOT_ALLOWED', 'target host is not allowlisted', { host })
  const expectedPort = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80)
  if (Number.isInteger(environment?.port) && environment.port > 0 && expectedPort !== environment.port) throw safeError('PORT_NOT_ALLOWED', 'target port is not registered', { port: expectedPort })
  const resolver = options.resolver ?? createDnsResolver()
  let raw
  try {
    raw = await resolver.lookupAll(host, { all: true, verbatim: true, signal: options.signal })
  } catch (cause) {
    if (options.signal?.aborted) throw safeError('ABORTED', 'DNS lookup was cancelled')
    throw safeError('DNS_RESOLUTION_FAILED', 'DNS lookup failed')
  }
  let addresses
  try { addresses = normalizeResolverResult(raw) } catch (error) { throw error }
  const cidrs = validateCidrList(environment)
  const checked = []
  for (const entry of addresses) {
    const classification = classifyIp(entry.address)
    if (classification.highRisk) throw safeError('IP_NOT_ALLOWED', 'resolved target address is reserved or local', { host, address: classification.address })
    if (classification.private) {
      if (environment?.allowPrivateNetwork !== true || !cidrs.some((cidr) => cidrContains(cidr, parseIp(entry.address)))) {
        throw safeError('PRIVATE_ADDRESS_NOT_ALLOWED', 'resolved private address requires explicit matching CIDR opt-in', { host, address: classification.address })
      }
    } else if (!hostMatches(host, environment?.allowedHosts)) {
      throw safeError('HOST_NOT_ALLOWED', 'resolved target host is not allowlisted', { host })
    }
    checked.push({ ...entry, category: classification.category })
  }
  if (checked.length === 0) throw safeError('DNS_NO_ADDRESS', 'DNS returned no allowed address')
  return Object.freeze({ host, port: expectedPort, addresses: checked, address: checked[0].address, family: checked[0].family })
}

export function addressAllowedByEnvironment(address, environment) {
  const parsed = parseIp(address)
  if (!parsed) return false
  const classification = classifyIp(parsed)
  if (classification.highRisk) return false
  if (!classification.private) return true
  const cidrs = validateCidrList(environment)
  return environment?.allowPrivateNetwork === true && cidrs.some((cidr) => cidrContains(cidr, parsed))
}
