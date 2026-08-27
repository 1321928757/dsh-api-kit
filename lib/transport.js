/**
 * Small Host-side HTTP transport for the fixed API executor.
 *
 * The transport receives an already-authorized, already-resolved request. It
 * never accepts a model URL or follows redirects. A fetch implementation can be
 * injected by tests; production uses Node's built-in WHATWG fetch, which keeps
 * response decompression and AbortSignal handling in one well-tested runtime.
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
  const body = response?.body
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
          return { body: concatBytes(chunks, total), truncated: true, tooLarge: true }
        }
        chunks.push(chunk)
        total += chunk.byteLength
      }
      return { body: concatBytes(chunks, total), truncated: false, tooLarge: false }
    } finally {
      try { reader.releaseLock?.() } catch {}
    }
  }

  // This branch mainly supports small fake Response objects. Real Node fetch
  // responses expose a streaming body and therefore never read unbounded data.
  try {
    if (typeof response?.arrayBuffer === 'function') {
      const value = bytesOf(await response.arrayBuffer())
      if (value.byteLength > limit) return { body: value.slice(0, limit), truncated: true, tooLarge: true }
      return { body: value, truncated: false, tooLarge: false }
    }
    if (typeof response?.text === 'function') {
      const text = await response.text()
      const encoded = new TextEncoder().encode(text)
      if (encoded.byteLength > limit) return { body: encoded.slice(0, limit), truncated: true, tooLarge: true }
      return { body: encoded, truncated: false, tooLarge: false }
    }
  } catch (cause) {
    if (signal?.aborted) throw new HttpTransportError('ABORTED', 'HTTP request was cancelled', { cause })
    throw new HttpTransportError('BODY_READ_FAILED', 'HTTP response could not be read', { cause })
  }
  return { body: new Uint8Array(0), truncated: false, tooLarge: false }
}

/**
 * Create the default transport. `fetchImpl` is intentionally injectable so
 * unit tests never contact a real API.
 */
export function createFetchTransport(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    return Object.freeze({
      async request() {
        throw new HttpTransportError('NETWORK_UNAVAILABLE', 'Host HTTP transport is unavailable')
      },
    })
  }

  return Object.freeze({
    async request(request) {
      if (!request || typeof request !== 'object' || typeof request.url !== 'string') {
        throw new HttpTransportError('REQUEST_INVALID', 'HTTP transport request is invalid')
      }
      const init = {
        method: request.method,
        headers: request.headers ?? {},
        // The executor owns redirect policy. Manual mode ensures a 3xx is
        // returned as data and cannot silently escape the registered host.
        redirect: 'manual',
        signal: request.signal,
      }
      if (request.body !== undefined) init.body = request.body
      let response
      try {
        response = await fetchImpl(request.url, init)
      } catch (cause) {
        if (request.signal?.aborted) throw new HttpTransportError('ABORTED', 'HTTP request was cancelled', { cause })
        throw new HttpTransportError('NETWORK_ERROR', 'HTTP request failed', { cause })
      }
      const read = await readBody(response, request.maxResponseBytes, request.signal)
      return {
        status: Number.isInteger(response?.status) ? response.status : 0,
        contentType: contentTypeOf(response),
        body: read.body,
        truncated: read.truncated,
        tooLarge: read.tooLarge,
      }
    },
  })
}

export { readBody }
