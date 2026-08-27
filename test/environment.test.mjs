import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ConfigurationError,
  normalizeEnvironmentConfig,
  safeEnvironmentView,
  validateEnvironmentInput,
} from '../lib/config-validation.js'

function rejectsCode(task, code) {
  return assert.rejects?.(task, (error) => error.code === code)
}

test('environment accepts HTTP/HTTPS, normalizes hosts and defaults production Agent access off', () => {
  const development = validateEnvironmentInput({
    id: 'dev',
    name: 'Development',
    baseUrl: 'https://api.example.test/v1///',
    allowedHosts: ['API.EXAMPLE.TEST', 'api.example.test'],
  })
  assert.equal(development.baseUrl, 'https://api.example.test/v1')
  assert.equal(development.protocol, 'https')
  assert.deepEqual(development.allowedHosts, ['api.example.test'])
  assert.equal(development.production, false)
  assert.equal(development.agentEnabled, true)

  const production = validateEnvironmentInput({ id: 'prod', baseUrl: 'https://api.example.test', production: true })
  assert.equal(production.agentEnabled, false)
  const productionView = safeEnvironmentView(production)
  assert.equal(productionView.id, 'prod')
  assert.equal(productionView.baseUrl, 'https://api.example.test')
  assert.equal(productionView.production, true)
  assert.equal(productionView.agentEnabled, false)
  assert.equal(productionView.allowedHosts[0], 'api.example.test')
})

test('environment rejects empty, unsafe, credential-bearing, query-bearing and privileged URLs', () => {
  for (const [baseUrl, code] of [
    ['', 'BASE_URL_REQUIRED'],
    ['file:///etc/passwd', 'BASE_URL_PROTOCOL'],
    ['javascript:alert(1)', 'BASE_URL_PROTOCOL'],
    ['https://user:pass@example.test', 'BASE_URL_CREDENTIALS'],
    ['https://example.test?token=secret', 'BASE_URL_QUERY'],
    ['https://example.test:22', 'BASE_URL_PORT'],
  ]) {
    assert.throws(() => validateEnvironmentInput({ baseUrl }), (error) => error instanceof ConfigurationError && error.code === code)
  }
})

test('private/local environments require explicit opt-in and keep the distinction for T09', () => {
  assert.throws(() => validateEnvironmentInput({ baseUrl: 'http://127.0.0.1:8080' }), (error) => error.code === 'PRIVATE_HOST_REQUIRES_OPT_IN')
  const environment = validateEnvironmentInput({ baseUrl: 'http://127.0.0.1:8080', allowPrivateNetwork: true })
  assert.equal(environment.allowPrivateNetwork, true)
  assert.equal(environment.allowedHosts[0], '127.0.0.1')
})

test('environment rejects malformed host lists and allows explicit non-standard port opt-in', () => {
  assert.throws(() => validateEnvironmentInput({ baseUrl: 'https://api.example.test', allowedHosts: 'api.example.test' }), (error) => error.code === 'INVALID_HOST_LIST')
  assert.throws(() => validateEnvironmentInput({ baseUrl: 'https://api.example.test:844' }), (error) => error.code === 'BASE_URL_PORT')
  const environment = normalizeEnvironmentConfig({ baseUrl: 'https://api.example.test:844', allowPrivilegedPort: true })
  assert.equal(environment.port, 844)
  assert.equal(environment.allowPrivilegedPort, true)
})

console.log('Environment tests complete')
