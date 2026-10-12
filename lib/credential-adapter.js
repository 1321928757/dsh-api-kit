/**
 * Host-only credential adapter boundary.
 *
 * The domain model stores only a secretRef. This adapter is the only place
 * where a DSH credentials service may be translated into request-time access.
 */

import { createHash } from 'node:crypto'
import { CredentialAdapterError } from './errors.js'

function unavailable() {
  throw new CredentialAdapterError('CREDENTIAL_PROVIDER_UNAVAILABLE', 'Credential provider is unavailable')
}

function assertSecretRefText(secretRef) {
  if (typeof secretRef !== 'string' || !secretRef.trim()) {
    throw new CredentialAdapterError('SECRET_REF_REQUIRED', 'secretRef is required')
  }
  const normalized = secretRef.trim()
  if (/[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new CredentialAdapterError('SECRET_REF_INVALID', 'secretRef contains control characters')
  }
  return normalized
}

export function isCredentialRefName(secretRef) {
  return typeof secretRef === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(secretRef)
}

function assertCredentialRefName(secretRef) {
  const normalized = assertSecretRefText(secretRef)
  if (!isCredentialRefName(normalized)) {
    throw new CredentialAdapterError('SECRET_REF_INVALID', 'secretRef must be a POSIX environment-variable name')
  }
  return normalized
}

function normalizeLegacySecretRef(secretRef) {
  const prefix = 'dsh-api-kit/auth/'
  if (!secretRef.toLowerCase().startsWith(prefix)) return secretRef
  const suffix = secretRef.slice(prefix.length).replace(/[^A-Za-z0-9_]/g, '_').toUpperCase()
  const candidate = `DSH_API_KIT_AUTH_${suffix}`
  if (/^[A-Z_]/.test(candidate) && isCredentialRefName(candidate)) return candidate
  const digest = createHash('sha256').update(secretRef, 'utf8').digest('hex').slice(0, 24).toUpperCase()
  return `DSH_API_KIT_AUTH_LEGACY_${digest}`
}

export function createCredentialAdapter(options = {}) {
  const service = options.service
  const customReferenceAdapter = typeof options.toCredentialRef === 'function'
  const toCredentialRef = customReferenceAdapter ? options.toCredentialRef : assertCredentialRefName
  const makeRef = (secretRef) => {
    const raw = assertSecretRefText(secretRef)
    return customReferenceAdapter ? toCredentialRef(raw) : toCredentialRef(normalizeLegacySecretRef(raw))
  }
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

  const assertWritable = async (secretRef) => {
    let status
    try { status = await describe(secretRef) } catch (cause) {
      if (cause?.code === 'CREDENTIAL_DESCRIBE_FAILED') throw new CredentialAdapterError('CREDENTIAL_PROVIDER_UNAVAILABLE', 'Credential status service is unavailable', { cause })
      throw cause
    }
    if (status.available !== true) throw new CredentialAdapterError('CREDENTIAL_PROVIDER_UNAVAILABLE', 'Credential status service is unavailable')
    if (status.writable !== true) throw new CredentialAdapterError('CREDENTIAL_NOT_WRITABLE', 'Credential source is read-only; use a writable credentials source')
  }

  const set = async (secretRef, value) => {
    if (!hasService || typeof service.set !== 'function') unavailable()
    if (typeof value !== 'string' || !value) throw new CredentialAdapterError('SECRET_VALUE_REQUIRED', 'credential value must be non-empty')
    try {
      await assertWritable(secretRef)
      await service.set(makeRef(secretRef), value)
    } catch (cause) {
      if (cause instanceof CredentialAdapterError) throw cause
      throw new CredentialAdapterError('CREDENTIAL_WRITE_FAILED', 'Credential write failed', { cause })
    }
  }

  const unset = async (secretRef) => {
    if (!hasService || typeof service.unset !== 'function') unavailable()
    try {
      await assertWritable(secretRef)
      await service.unset(makeRef(secretRef))
    } catch (cause) {
      if (cause instanceof CredentialAdapterError) throw cause
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
