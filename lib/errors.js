/**
 * Shared error types for the storage and credential leaves.
 *
 * Keeping these classes in a dependency-free module prevents the Registry
 * store and optional archive from importing each other.
 */

function cloneJson(value) {
  if (value === undefined) return undefined
  try { return JSON.parse(JSON.stringify(value)) } catch { return undefined }
}

export class RegistryStoreError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = 'RegistryStoreError'
    this.code = code
    if (options.path) this.path = options.path
    if (options.detail !== undefined) this.detail = options.detail
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.path ? { path: this.path } : {}),
      ...(this.detail !== undefined ? { detail: cloneJson(this.detail) } : {}),
    }
  }
}

export class CredentialAdapterError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = 'CredentialAdapterError'
    this.code = code
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message }
  }
}
