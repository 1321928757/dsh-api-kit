/**
 * dsh-api-kit Host bundle entry.
 *
 * T04 mounts the DSH-independent configuration facade only. RPC, model tools,
 * browser forms and HTTP execution remain deliberately out of this task.
 */

import { createConfigurationService } from './configuration.js'
import { createCredentialAdapter } from './credential-adapter.js'
import { createRegistryStore } from './registry-store.js'

export const name = 'dsh-api-kit'

export function apply(ctx) {
  const credentials = ctx?.get?.('credentials')
  const store = createRegistryStore()
  const service = createConfigurationService({
    store,
    credentialAdapter: createCredentialAdapter({ service: credentials }),
  })
  const dispose = ctx?.provide?.('apiKitConfig', service)
  Promise.resolve(service.load()).catch((error) => {
    console.error('[dsh-api-kit] Registry load failed', error?.code || 'LOAD_FAILED')
  })
  return typeof dispose === 'function' ? dispose : undefined
}

export default { name, apply }
