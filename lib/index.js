/**
 * dsh-api-kit Host bundle entry.
 *
 * T01 intentionally keeps the Host half side-effect free: it only proves that
 * the published bundle can be loaded by DSH. Registry, tools, RPC and network
 * execution are introduced by later implementation tasks.
 */

export const name = 'dsh-api-kit'

export function apply() {
  console.log('[dsh-api-kit] plugin loaded (T01 skeleton)')
}

export default { name, apply }
