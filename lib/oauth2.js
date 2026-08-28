const DEFAULTS = Object.freeze({
  maxResponseBytes: 64 * 1024,
  expirySkewSeconds: 30,
  maxScopeLength: 2048,
  maxTokenLength: 16 * 1024,
  maxTokenTypeLength: 256,
  maxExpiresIn: 365 * 24 * 60 * 60,
})

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/
const utf8Encoder = new TextEncoder()
const utf8Decoder = new TextDecoder() 

function defaultBase64Encode(bytes) {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index])
  if (typeof globalThis.btoa === 'function') return globalThis.btoa(binary)
  if (typeof globalThis.Buffer === 'function') return globalThis.Buffer.from(bytes).toString('base64')
  fail('BASE64_UNAVAILABLE', 'base64 encoding is unavailable')
}

export class OAuth2Error extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'OAuth2Error'
    this.code = code
  }
  toJSON() { return { name: this.name, code: this.code, message: this.message } }
}

function fail(code, message) { throw new OAuth2Error(code, message) }
function text(value) { return typeof value === 'string' ? value : '' }
function safeString(value, name) {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f\u007f]/.test(value)) fail('CONFIG_INVALID', `${name} is invalid`)
  return value.trim()
}

export function validateOAuth2Config(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('CONFIG_INVALID', 'OAuth2 configuration is invalid')
  const endpoint = safeString(input.tokenEndpoint, 'tokenEndpoint')
  let url
  try { url = new URL(endpoint) } catch { fail('TOKEN_ENDPOINT_INVALID', 'tokenEndpoint is invalid') }
  if (url.protocol !== 'https:') fail('TOKEN_ENDPOINT_HTTPS_REQUIRED', 'tokenEndpoint must use HTTPS')
  if (url.search || url.hash || url.username || url.password) fail('TOKEN_ENDPOINT_INVALID', 'tokenEndpoint must not include query, hash, or credentials')
  if (typeof options.endpointValidator === 'function') {
    try {
      const verdict = options.endpointValidator(url)
      if (verdict === false) fail('TOKEN_ENDPOINT_REJECTED', 'tokenEndpoint was rejected')
    } catch (error) {
      if (error instanceof OAuth2Error) throw error
      fail('TOKEN_ENDPOINT_REJECTED', 'tokenEndpoint was rejected')
    }
  }
  const authMethod = input.authMethod ?? input.tokenEndpointAuthMethod ?? 'client_secret_basic'
  if (authMethod !== 'client_secret_basic' && authMethod !== 'client_secret_post') fail('AUTH_METHOD_UNSUPPORTED', 'OAuth2 client authentication method is unsupported')
  const clientId = safeString(input.clientId, 'clientId')
  const secretRef = safeString(input.secretRef ?? input.clientSecretRef, 'secretRef')
  const scope = input.scope === undefined ? '' : input.scope
  if (typeof scope !== 'string' || scope.length > DEFAULTS.maxScopeLength || /[\u0000-\u001f\u007f]/.test(scope)) fail('SCOPE_INVALID', 'scope is invalid')
  if (scope && !/^\S+(?:\s+\S+)*$/.test(scope)) fail('SCOPE_INVALID', 'scope is invalid')
  const audience = input.audience === undefined ? '' : input.audience
  if (typeof audience !== 'string' || audience.length > 1024 || /[\u0000-\u001f\u007f]/.test(audience)) fail('AUDIENCE_INVALID', 'audience is invalid')
  const profile = input.profile === undefined ? 'default' : safeString(input.profile, 'profile')
  return Object.freeze({ tokenEndpoint: url.href, clientId, secretRef, authMethod, scope, audience, profile })
}

function normalizeResponse(response) {
  if (!response || typeof response !== 'object') fail('TOKEN_TRANSPORT_INVALID', 'token transport returned an invalid response')
  const status = response.status
  if (!Number.isInteger(status) || status < 100 || status > 599) fail('TOKEN_TRANSPORT_INVALID', 'token transport returned an invalid response')
  const headers = response.headers ?? {}
  let contentType = response.contentType
  if (typeof contentType !== 'string') {
    if (typeof headers.get === 'function') contentType = text(headers.get('content-type'))
    else contentType = text(headers['content-type'] ?? headers['Content-Type'])
  }
  return { response, status, contentType: contentType.split(';', 1)[0].trim().toLowerCase() }
}

async function bodyText(response, maxBytes) {
  let value
  try {
    if (typeof response.text === 'function') value = await response.text()
    else if (typeof response.body === 'string') value = response.body
    else if (response.body instanceof Uint8Array) value = utf8Decoder.decode(response.body)
    else if (response.body !== undefined) value = utf8Decoder.decode(response.body)
    else value = ''
  } catch { fail('TOKEN_RESPONSE_INVALID', 'token response body is invalid') }
  if (typeof value !== 'string' || utf8Encoder.encode(value).byteLength > maxBytes) fail('TOKEN_RESPONSE_TOO_LARGE', 'token response exceeds the size limit')
  return value
}

export function createOAuth2Client(options = {}) {
  const config = validateOAuth2Config(options.config ?? options, options)
  const resolver = options.resolver ?? options.credentialResolver
  const transport = options.transport
  if (typeof resolver !== 'function') fail('CREDENTIAL_RESOLVER_REQUIRED', 'credential resolver is required')
  if (typeof transport !== 'function') fail('TRANSPORT_REQUIRED', 'token transport is required')
  const maxResponseBytes = Number.isInteger(options.maxResponseBytes) && options.maxResponseBytes > 0 ? options.maxResponseBytes : DEFAULTS.maxResponseBytes
  const skew = Number.isFinite(options.expirySkewSeconds) && options.expirySkewSeconds >= 0 ? options.expirySkewSeconds : DEFAULTS.expirySkewSeconds
  const clock = typeof options.clock === 'function' ? options.clock : () => Date.now()
  const base64Encode = typeof options.base64Encode === 'function' ? options.base64Encode : defaultBase64Encode
  const cache = new Map()
  const flights = new Map()
  let disposed = false
  let generation = 0
  const keyFor = (request = {}) => JSON.stringify([config.profile, request.scope ?? config.scope, request.audience ?? config.audience])
  const acquire = async (request = {}) => {
    if (disposed) fail('DISPOSED', 'OAuth2 client is disposed')
    const scope = request.scope ?? config.scope
    const audience = request.audience ?? config.audience
    if (typeof scope !== 'string' || scope.length > DEFAULTS.maxScopeLength || CONTROL_CHARS.test(scope) || (scope && !/^\S+(?:\s+\S+)*$/.test(scope))) fail('SCOPE_INVALID', 'scope is invalid')
    if (typeof audience !== 'string' || audience.length > 1024 || CONTROL_CHARS.test(audience)) fail('AUDIENCE_INVALID', 'audience is invalid')
    const key = keyFor({ scope, audience })
    const now = clock()
    const cached = cache.get(key)
    if (cached && cached.generation === generation && cached.expiresAt - skew * 1000 > now) return { ...cached.token }
    const existing = flights.get(key)
    if (existing && existing.generation === generation) return existing.promise
    const flightGeneration = generation
    const flight = fetchToken(scope, audience, request.signal).then(record => {
      if (!disposed && generation === flightGeneration && flights.get(key)?.promise === flight) cache.set(key, { ...record, generation: flightGeneration })
      return { ...record.token }
    }).finally(() => { if (flights.get(key)?.promise === flight) flights.delete(key) })
    flights.set(key, { promise: flight, generation: flightGeneration })
    return flight
  }
  const fetchToken = async (scope, audience, signal) => {
    let resolved
    try { resolved = await resolver(config.secretRef) } catch { fail('CREDENTIAL_RESOLVE_FAILED', 'credential resolution failed') }
    const secret = typeof resolved === 'string' ? resolved : resolved?.value
    if (typeof secret !== 'string' || !secret) fail('CREDENTIAL_INVALID', 'resolved credential is invalid')
    const params = new URLSearchParams({ grant_type: 'client_credentials' })
    if (scope) params.set('scope', scope)
    if (audience) params.set('audience', audience)
    const headers = { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }
    if (config.authMethod === 'client_secret_basic') headers.authorization = `Basic ${base64Encode(utf8Encoder.encode(`${config.clientId}:${secret}`))}`
    else { params.set('client_id', config.clientId); params.set('client_secret', secret) }
    let response
    try { response = normalizeResponse(await transport({ url: config.tokenEndpoint, method: 'POST', headers, body: params.toString(), ...(signal === undefined ? {} : { signal }) })) } catch (error) {
      if (error instanceof OAuth2Error) throw error
      fail('TOKEN_TRANSPORT_FAILED', 'token request failed')
    }
    if (response.status < 200 || response.status >= 300) fail('TOKEN_HTTP_ERROR', 'token endpoint returned an error')
    if (response.contentType !== 'application/json' && !/^application\/[^;\s]+\+json$/.test(response.contentType)) fail('TOKEN_CONTENT_TYPE_INVALID', 'token response content type is invalid')
    const raw = await bodyText(response.response, maxResponseBytes)
    let data
    try { data = JSON.parse(raw) } catch { fail('TOKEN_JSON_INVALID', 'token response JSON is invalid') }
    const expiresIn = typeof data?.expires_in === 'number' ? data.expires_in : (typeof data?.expires_in === 'string' && data.expires_in.trim() ? Number(data.expires_in) : NaN)
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.access_token !== 'string' || !data.access_token || data.access_token.length > DEFAULTS.maxTokenLength || CONTROL_CHARS.test(data.access_token) || typeof data.token_type !== 'string' || !data.token_type || data.token_type.length > DEFAULTS.maxTokenTypeLength || CONTROL_CHARS.test(data.token_type) || !Number.isFinite(expiresIn) || expiresIn <= 0 || expiresIn > DEFAULTS.maxExpiresIn) fail('TOKEN_RESPONSE_INVALID', 'token response is invalid')
    return { token: { accessToken: data.access_token, tokenType: data.token_type, expiresIn }, expiresAt: clock() + expiresIn * 1000 }
  }
  return Object.freeze({ getToken: acquire, clear() { generation += 1; cache.clear(); flights.clear() }, dispose() { disposed = true; generation += 1; cache.clear(); flights.clear() }, get size() { return cache.size } })
}

export default createOAuth2Client
