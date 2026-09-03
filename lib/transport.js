import http from 'node:http'
import https from 'node:https'
import { brotliDecompress, gunzip, inflate } from 'node:zlib'
import { promisify } from 'node:util'

const gunzipAsync = promisify(gunzip)
const inflateAsync = promisify(inflate)
const brotliDecompressAsync = promisify(brotliDecompress)

/**
 * Small Host-side HTTP transports for the fixed API executor.
 *
 * The default fetch transport remains available for compatibility and tests.
 * T09 adds a pinned Node transport: the executor resolves and validates every
 * DNS answer first, then this transport connects to that exact address while
 * retaining the registered hostname for HTTP Host and HTTPS SNI.
 */

export class HttpTransportError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = 'HttpTransportError'
    this.code = code
  }
}

function bytesOf(value) {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  return new Uint8Array(0)
}

function concatBytes(chunks, total) {
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

function contentTypeOf(response) {
  try {
    const value = response?.headers?.get?.('content-type')
    return typeof value === 'string' ? value.split(';', 1)[0].trim().toLowerCase() : ''
  } catch {
    return ''
  }
}

async function readBody(response, maxBytes, signal) {
  const limit = Number.isInteger(maxBytes) && maxBytes > 0 ? maxBytes : 1
  // Fetch Response exposes the stream as `response.body`, while Node's
  // IncomingMessage is itself the async-iterable response body. Supporting
  // both is required by the pinned transport; otherwise a valid chunked Node
  // response is silently projected as an empty body.
  const body = response?.body ?? (response && typeof response[Symbol.asyncIterator] === 'function' ? response : undefined)
  if (body && typeof body.getReader === 'function') {
    const reader = body.getReader()
    const chunks = []
    let total = 0
    try {
      while (true) {
        if (signal?.aborted) throw new HttpTransportError('ABORTED', 'HTTP request was cancelled')
        const next = await reader.read()
        if (next.done) break
        const chunk = bytesOf(next.value)
        if (total + chunk.byteLength > limit) {
          const remaining = Math.max(0, limit - total)
          if (remaining > 0) {
            chunks.push(chunk.slice(0, remaining))
            total += remaining
          }
          try { await reader.cancel('response size limit') } catch {}
          return { body: concatBytes(chunks, total), truncated: true, tooLarge: true, bytesRead: total }
        }
        chunks.push(chunk)
        total += chunk.byteLength
      }
      return { body: concatBytes(chunks, total), truncated: false, tooLarge: false, bytesRead: total }
    } finally {
      try { reader.releaseLock?.() } catch {}
    }
  }

  if (body && typeof body[Symbol.asyncIterator] === 'function') {
    const chunks = []
    let total = 0
    try {
      for await (const value of body) {
        if (signal?.aborted) throw new HttpTransportError('ABORTED', 'HTTP request was cancelled')
        const chunk = bytesOf(value)
        if (total + chunk.byteLength > limit) {
          const remaining = Math.max(0, limit - total)
          if (remaining > 0) {
            chunks.push(chunk.slice(0, remaining))
            total += remaining
          }
          try { body.destroy?.() } catch {}
          return { body: concatBytes(chunks, total), truncated: true, tooLarge: true, bytesRead: total }
        }
        chunks.push(chunk)
        total += chunk.byteLength
      }
      return { body: concatBytes(chunks, total), truncated: false, tooLarge: false, bytesRead: total }
    } catch (cause) {
      if (cause instanceof HttpTransportError) throw cause
      if (signal?.aborted) throw new HttpTransportError('ABORTED', 'HTTP request was cancelled', { cause })
      throw new HttpTransportError('BODY_READ_FAILED', 'HTTP response could not be read', { cause })
    }
  }

  // This branch mainly supports small fake Response objects. Real Node fetch
  // responses expose a streaming body and therefore never read unbounded data.
  try {
    if (typeof response?.arrayBuffer === 'function') {
      const value = bytesOf(await response.arrayBuffer())
      if (value.byteLength > limit) return { body: value.slice(0, limit), truncated: true, tooLarge: true, bytesRead: limit }
      return { body: value, truncated: false, tooLarge: false, bytesRead: value.byteLength }
    }
    if (typeof response?.text === 'function') {
      const text = await response.text()
      const encoded = new TextEncoder().encode(text)
      if (encoded.byteLength > limit) return { body: encoded.slice(0, limit), truncated: true, tooLarge: true, bytesRead: limit }
      return { body: encoded, truncated: false, tooLarge: false, bytesRead: encoded.byteLength }
    }
  } catch (cause) {
    if (signal?.aborted) throw new HttpTransportError('ABORTED', 'HTTP request was cancelled', { cause })
    throw new HttpTransportError('BODY_READ_FAILED', 'HTTP response could not be read', { cause })
  }
  return { body: new Uint8Array(0), truncated: false, tooLarge: false, bytesRead: 0 }
}

function headerObject(headers) {
  const result = {}
  if (!headers) return result
  if (typeof headers.entries === 'function') {
    for (const [name, value] of headers.entries()) result[name] = String(value)
    return result
  }
  for (const [name, value] of Object.entries(headers)) result[name] = String(value)
  return result
}

async function responseFromNode(response, maxBytes, signal) {
  const encoding = typeof response.headers?.['content-encoding'] === 'string' ? response.headers['content-encoding'].trim().toLowerCase() : ''
  // Allow compressed responses to be decoded safely. The body is still bounded
  // again after decompression, preventing compressed-bomb expansion from
  // escaping the executor's response limit.
  const readLimit = encoding && encoding !== 'identity' ? Math.min(maxBytes * 4, 4 * 1024 * 1024) : maxBytes
  const read = await readBody(response, readLimit, signal)
  let body = read.body
  let truncated = read.truncated
  let tooLarge = read.tooLarge
  if (!truncated && !tooLarge && body.byteLength > 0 && encoding) {
    try {
      if (encoding === 'gzip') body = new Uint8Array(await gunzipAsync(body))
      else if (encoding === 'deflate') body = new Uint8Array(await inflateAsync(body))
      else if (encoding === 'br') body = new Uint8Array(await brotliDecompressAsync(body))
      else if (encoding !== 'identity') throw new Error('unsupported content encoding')
      if (body.byteLength > maxBytes) { body = body.slice(0, maxBytes); truncated = true; tooLarge = true }
    } catch (cause) {
      throw new HttpTransportError('BODY_READ_FAILED', 'HTTP response could not be decompressed', { cause })
    }
  }
  return ({
    status: Number.isInteger(response.statusCode) ? response.statusCode : 0,
    contentType: typeof response.headers?.['content-type'] === 'string' ? response.headers['content-type'].split(';', 1)[0].trim().toLowerCase() : '',
    body,
    truncated,
    tooLarge,
    bytesRead: body.byteLength,
    redirect: Number.isInteger(response.statusCode) && response.statusCode >= 300 && response.statusCode < 400,
  })
}

function validatePinnedRequest(request) {
  if (!request || typeof request !== 'object' || typeof request.url !== 'string') throw new HttpTransportError('REQUEST_INVALID', 'HTTP transport request is invalid')
  let url
  try { url = new URL(request.url) } catch { throw new HttpTransportError('REQUEST_INVALID', 'HTTP transport URL is invalid') }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new HttpTransportError('REQUEST_INVALID', 'HTTP transport protocol is invalid')
  const pin = request.resolvedAddress
  if (typeof pin !== 'string' || !pin || (request.resolvedFamily !== 4 && request.resolvedFamily !== 6)) throw new HttpTransportError('REQUEST_UNPINNED', 'HTTP transport requires a validated resolved address')
  if (request.redirect !== 'manual' || request.maxRedirects !== 0) throw new HttpTransportError('REDIRECT_POLICY_INVALID', 'pinned transport does not follow redirects')
  return { url, pin }
}

/**
 * Connect to the already validated address. `lookup` is still supplied as a
 * defensive second check: Node's http/https client cannot substitute another
 * DNS result when `family` and the address are fixed.
 */
export function createPinnedHttpTransport(options = {}) {
  const requestImpl = options.requestImpl
  const requester = requestImpl ?? ((url, init) => {
    const client = url.protocol === 'https:' ? https : http
    return new Promise((resolve, reject) => {
      const hostHeader = init.port && !((url.protocol === 'http:' && init.port === 80) || (url.protocol === 'https:' && init.port === 443)) ? `${init.hostname}:${init.port}` : init.hostname
      const headers = { ...(init.headers ?? {}), Host: hostHeader, 'Accept-Encoding': 'identity' }
      const req = client.request(url, {
        method: init.method,
        headers,
        hostname: init.hostname,
        port: init.port,
        path: `${url.pathname}${url.search}`,
        family: init.family,
        lookup(hostname, _options, callback) {
          callback(null, init.address, init.family)
        },
        servername: url.protocol === 'https:' ? init.hostname : undefined,
        agent: false,
        signal: init.signal,
        rejectUnauthorized: true,
      })
      req.once('response', resolve)
      req.once('error', reject)
      if (init.body !== undefined) req.write(init.body)
      req.end()
    })
  })
  if (typeof requester !== 'function') throw new TypeError('requestImpl must be a function')

  return Object.freeze({
    handlesResolution: true,
    async request(request) {
      const { url, pin } = validatePinnedRequest(request)
      let response
      try {
        response = await requester(url, {
          method: request.method,
          headers: { ...headerObject(request.headers), 'accept-encoding': 'identity' },
          hostname: url.hostname,
          port: url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80),
          path: `${url.pathname}${url.search}`,
          address: pin,
          family: request.resolvedFamily,
          signal: request.signal,
          body: request.body,
          redirect: 'manual',
          maxRedirects: 0,
        })
      } catch (cause) {
        if (request.signal?.aborted) throw new HttpTransportError('ABORTED', 'HTTP request was cancelled', { cause })
        throw new HttpTransportError('NETWORK_ERROR', 'HTTP request failed', { cause })
      }
      return responseFromNode(response, request.maxResponseBytes, request.signal)
    },
  })
}

/** Create the default fetch transport. It is retained for injected tests. */
export function createFetchTransport(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    return Object.freeze({ async request() { throw new HttpTransportError('NETWORK_UNAVAILABLE', 'Host HTTP transport is unavailable') } })
  }
  return Object.freeze({
    async request(request) {
      if (!request || typeof request !== 'object' || typeof request.url !== 'string') throw new HttpTransportError('REQUEST_INVALID', 'HTTP transport request is invalid')
      const init = { method: request.method, headers: request.headers ?? {}, redirect: 'manual', signal: request.signal }
      if (request.body !== undefined) init.body = request.body
      let response
      try { response = await fetchImpl(request.url, init) } catch (cause) {
        if (request.signal?.aborted) throw new HttpTransportError('ABORTED', 'HTTP request was cancelled', { cause })
        throw new HttpTransportError('NETWORK_ERROR', 'HTTP request failed', { cause })
      }
      const read = await readBody(response, request.maxResponseBytes, request.signal)
      return { status: Number.isInteger(response?.status) ? response.status : 0, contentType: contentTypeOf(response), body: read.body, truncated: read.truncated, tooLarge: read.tooLarge, bytesRead: read.bytesRead, redirect: Number.isInteger(response?.status) && response.status >= 300 && response.status < 400 }
    },
  })
}

export { readBody }
