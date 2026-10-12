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

test('environment keeps legacy URL compatibility while safe views expose only metadata', () => {
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
  assert.equal('baseUrl' in productionView, false)
  assert.equal(productionView.production, true)
  assert.equal(productionView.agentEnabled, false)
})

test('environment rejects unsafe, credential-bearing, query-bearing and privileged URLs while allowing metadata-only records', () => {
  assert.equal(validateEnvironmentInput({ id: 'metadata-only', name: 'Metadata' }).baseUrl, '')
  for (const [baseUrl, code] of [
    ['file:///etc/passwd', 'BASE_URL_PROTOCOL'],
    ['javascript:alert(1)', 'BASE_URL_PROTOCOL'],
    ['https://user:pass@example.test', 'BASE_URL_CREDENTIALS'],
    ['https://example.test?token=secret', 'BASE_URL_QUERY'],
    ['https://example.test:22', 'BASE_URL_PORT'],
  ]) {
    assert.throws(() => validateEnvironmentInput({ baseUrl }), (error) => error instanceof ConfigurationError && error.code === code)
  }
})

test('private API host configuration needs no retired opt-in flags', () => {
  const environment = validateEnvironmentInput({ baseUrl: 'http://10.20.30.40:8080' })
  assert.equal(environment.allowedHosts[0], '10.20.30.40')
  assert.equal(Object.hasOwn(environment, 'allowPrivateNetwork'), false)
  assert.equal(Object.hasOwn(environment, 'allowedCidrs'), false)
  const ignoredLegacyControls = validateEnvironmentInput({ baseUrl: 'https://api.example.test', allowPrivateNetwork: false, allowedCidrs: ['invalid legacy value'] })
  assert.equal(ignoredLegacyControls.baseUrl, 'https://api.example.test')
  assert.equal(Object.hasOwn(ignoredLegacyControls, 'allowPrivateNetwork'), false)
  assert.equal(Object.hasOwn(ignoredLegacyControls, 'allowedCidrs'), false)
})

test('environment rejects malformed host lists and allows explicit non-standard port opt-in', () => {
  assert.throws(() => validateEnvironmentInput({ baseUrl: 'https://api.example.test', allowedHosts: 'api.example.test' }), (error) => error.code === 'INVALID_HOST_LIST')
  assert.throws(() => validateEnvironmentInput({ baseUrl: 'https://api.example.test:844' }), (error) => error.code === 'BASE_URL_PORT')
  const environment = normalizeEnvironmentConfig({ baseUrl: 'https://api.example.test:844', allowPrivilegedPort: true })
  assert.equal(environment.port, 844)
  assert.equal(environment.allowPrivilegedPort, true)
})

test('legacy private CIDR fields are discarded during endpoint normalization', () => {
  const endpoint = validateEnvironmentInput({ baseUrl: 'http://10.1.2.3:8080', allowPrivateNetwork: true, allowedCidrs: ['10.0.0.1/8'] })
  assert.equal(endpoint.baseUrl, 'http://10.1.2.3:8080')
  assert.equal(Object.hasOwn(endpoint, 'allowedCidrs'), false)
  assert.equal(Object.hasOwn(endpoint, 'allowPrivateNetwork'), false)
})

console.log('Environment tests complete')
