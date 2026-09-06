/**
 * Host-only credential adapter boundary.
 *
 * The domain model stores only a secretRef. This adapter is the only place
 * where a DSH credentials service may be translated into request-time access.
 */

import { CredentialAdapterError } from './errors.js'

function unavailable() {
  throw new CredentialAdapterError('CREDENTIAL_PROVIDER_UNAVAILABLE', 'Credential provider is unavailable')
}

function assertSecretRef(secretRef) {
  if (typeof secretRef !== 'string' || !secretRef.trim()) {
    throw new CredentialAdapterError('SECRET_REF_REQUIRED', 'secretRef is required')
  }
  if (/[\u0000-\u001f\u007f]/.test(secretRef)) {
    throw new CredentialAdapterError('SECRET_REF_INVALID', 'secretRef contains control characters')
  }
  return secretRef.trim()
}

function normalizeLegacySecretRef(secretRef) {
  const prefix = 'dsh-api-kit/auth/'
  if (!secretRef.toLowerCase().startsWith(prefix)) return secretRef
  const suffix = secretRef.slice(prefix.length).replace(/[^A-Za-z0-9_]/g, '_').toUpperCase()
  return `DSH_API_KIT_AUTH_${suffix}`
}

export function createCredentialAdapter(options = {}) {
  const service = options.service
  // DSH's credentials seam accepts a branded POSIX-style string. Branding is
  // type-only at runtime, so returning the validated string is sufficient and
  // avoids passing the legacy `{ name }` shape used by an earlier prototype.
  const toCredentialRef = typeof options.toCredentialRef === 'function'
    ? options.toCredentialRef
    : (secretRef) => assertSecretRef(secretRef)
  const makeRef = (secretRef) => toCredentialRef(normalizeLegacySecretRef(assertSecretRef(secretRef)))
  const hasService = service && typeof service === 'object'

  const resolve = async (secretRef) => {
    if (!hasService || typeof service.resolve !== 'function') unavailable()
    try {
      const result = await service.resolve(makeRef(secretRef))
      return typeof result === 'string' ? { value: result } : result
    } catch (cause) {
      throw new CredentialAdapterError('CREDENTIAL_RESOLVE_FAILED', 'Credential resolution failed', { cause })
    }
  }

  const describe = async (secretRef) => {
    if (!hasService || typeof service.describe !== 'function') {
      return { configured: false, available: false, writable: false }
    }
    try {
      const value = await service.describe(makeRef(secretRef))
      return {
        configured: value?.configured === true || value?.hasValue === true,
        available: true,
        source: typeof value?.source === 'string' ? value.source : undefined,
        writable: value?.writable === true,
      }
    } catch (cause) {
      throw new CredentialAdapterError('CREDENTIAL_DESCRIBE_FAILED', 'Credential status lookup failed', { cause })
    }
  }

  const set = async (secretRef, value) => {
    if (!hasService || typeof service.set !== 'function') unavailable()
    if (typeof value !== 'string' || !value) throw new CredentialAdapterError('SECRET_VALUE_REQUIRED', 'credential value must be non-empty')
    try {
      await service.set(makeRef(secretRef), value)
    } catch (cause) {
      throw new CredentialAdapterError('CREDENTIAL_WRITE_FAILED', 'Credential write failed', { cause })
    }
  }

  const unset = async (secretRef) => {
    if (!hasService || typeof service.unset !== 'function') unavailable()
    try {
      await service.unset(makeRef(secretRef))
    } catch (cause) {
      throw new CredentialAdapterError('CREDENTIAL_WRITE_FAILED', 'Credential removal failed', { cause })
    }
  }

  return Object.freeze({
    get available() { return Boolean(hasService && typeof service.resolve === 'function') },
    toCredentialRef: makeRef,
    resolve,
    describe,
    set,
    unset,
  })
}
