import test from 'node:test'
import assert from 'node:assert/strict'
import { registerApiKitRuntimeContext, API_KIT_RUNTIME_CONTEXT_NAME, API_KIT_RUNTIME_CONTEXT_ORDER } from '../lib/runtime-context.js'

function configurationFor(values) {
  return {
    resolveSessionActivation(sessionId) {
      return values.activations.get(sessionId) ?? { sessionId, valid: false, activeKitIds: [] }
    },
    listOperations() { return values.operations },
    listServiceTargets() { return values.targets },
  }
}

function active(sessionId, kitName) {
  return {
    sessionId,
    valid: true,
    activeKitIds: ['kit'],
    environmentId: 'dev',
    kits: [{ id: 'kit', name: kitName, description: '' }],
    environments: [{ id: 'dev', name: 'Development', enabled: true, agentEnabled: true }],
  }
}

const operations = [{
  id: 'health', operationId: 'health', method: 'GET', serviceTargetId: 'target', kitIds: ['kit'], enabled: true,
  policy: { allowAgentCall: true, allowMethods: ['GET'] },
}]
const targets = [{ id: 'target', enabled: true, agentEnabled: true, environmentIds: ['dev'] }]

test('registers a unique per-assembly provider and disposes it through the returned disposer', () => {
  const registrations = []
  const systemPrompt = {
    context(value) {
      registrations.push(value)
      return () => { registrations.splice(registrations.indexOf(value), 1) }
    },
  }
  const values = { activations: new Map([['session-a', active('session-a', 'Kit A')], ['session-b', active('session-b', 'Kit B')]]), operations, targets }
  const dispose = registerApiKitRuntimeContext(systemPrompt, configurationFor(values))
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].name, API_KIT_RUNTIME_CONTEXT_NAME)
  assert.equal(registrations[0].order, API_KIT_RUNTIME_CONTEXT_ORDER)
  assert.match(registrations[0].text({ agent: { id: 'session-a' } }), /Kit A/)
  assert.match(registrations[0].text({ agent: { id: 'session-b' } }), /Kit B/)
  assert.equal(registrations[0].text({ agent: { id: 'unknown' } }), '')
  dispose()
  assert.equal(registrations.length, 0)
})

test('provider re-reads activation and configuration on every assembly', () => {
  const registrations = []
  const values = { activations: new Map([['session-a', active('session-a', 'Old Kit')]]), operations, targets }
  registerApiKitRuntimeContext({ context(value) { registrations.push(value); return () => {} } }, configurationFor(values))
  const provider = registrations[0].text
  assert.match(provider({ agent: { id: 'session-a' } }), /Old Kit/)
  values.activations.set('session-a', active('session-a', 'New Kit'))
  assert.match(provider({ agent: { id: 'session-a' } }), /New Kit/)
  values.activations.set('session-a', { sessionId: 'session-a', valid: false, activeKitIds: [] })
  assert.equal(provider({ agent: { id: 'session-a' } }), '')
})
