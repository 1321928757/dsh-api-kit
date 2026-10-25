import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (name) => readFile(path.join(root, name), 'utf8')

const packageJson = JSON.parse(await read('package.json'))

test('package metadata declares a DSH web bundle', () => {
  assert.equal(packageJson.name, 'dsh-api-kit')
  assert.equal(packageJson.version, '0.1.3')
  assert.equal(packageJson.type, 'module')
  assert.equal(packageJson.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(packageJson.dsh.client.platform, 'web')
  assert.ok(packageJson.keywords.includes('dsh-plugin'))
})

test('package exports all T01 entry points', () => {
  assert.equal(packageJson.exports['.'].default, './lib/index.js')
  assert.equal(packageJson.exports['./client'].default, './lib/client.js')
  assert.equal(packageJson.exports['./typert'].default, './lib/typert.host.js')
  assert.equal(packageJson.exports['./package.json'], './package.json')
})

test('T01 source entries have the expected identities', async () => {
  const host = await read('lib/index.js')
  const client = await read('lib/client.js')
  const typert = await read('lib/typert.host.js')

  assert.match(host, /export const name = 'dsh-api-kit'/)
  assert.match(host, /configuration\.js/)
  assert.match(host, /apiKitConfig/)
  assert.match(client, /window\.__ModuleLoader__\.load/)
  assert.match(client, /id: 'dsh-api-kit'/)
  assert.match(client, /conversation\.input\.left/)
  assert.match(client, /settings\.section/)
  assert.match(typert, /package: 'dsh-api-kit'/)
  assert.match(typert, /face: 'host'/)
  assert.match(typert, /key: 'apiKitConfig'/)
  assert.match(typert, /namespace: 'api-kit'/)
  assert.match(typert, /'listOperations'/)
  assert.match(typert, /'createOperation'/)
  assert.match(typert, /'createServiceTarget'/)
  assert.match(typert, /'createEnvironment'/)
  for (const name of ['createAuthProfile', 'updateAuthProfile', 'deleteAuthProfile', 'setAuthSecret', 'unsetAuthSecret']) assert.match(typert, new RegExp(name))
  assert.match(typert, /'getSessionActivation'/)
  assert.match(typert, /'setSessionActivation'/)
  assert.match(typert, /'clearSessionActivation'/)
  assert.match(client, /getSessionActivation/)
  assert.match(client, /setSessionActivation/)
  assert.match(client, /clearSessionActivation/)
  assert.match(client, /previewOpenApiImport/)
  assert.match(client, /confirmOpenApiImport/)
  assert.match(client, /data-t12-import/)
  assert.match(client, /focus-visible/)
  assert.match(client, /prefers-reduced-motion:reduce/)
  assert.match(client, /aria-modal/)
  assert.match(client, /parseJsonValue/)
  assert.match(typert, /name: item, wire: item/)
  assert.match(typert, /create: \(\) => z\.json\(\)/)
  assert.match(typert, /create: \(\) => z\.array\(z\.string\(\)\)/)
  assert.match(typert, /operationIds.*operationIdsCodec/)
})

test('bundle patch inserts exactly the plugin row', async () => {
  const patch = await read('cordis.patch.yml')
  assert.match(patch, /- insert:/)
  assert.match(patch, /id: dsh-api-kit/)
  assert.match(patch, /name: dsh-api-kit/)
})

test('T05 Typert manifest exposes only safe configuration methods', async () => {
  const typert = await read('lib/typert.host.js')
  assert.match(typert, /service: 'apiKitConfig'/)
  assert.doesNotMatch(typert, /api_call|api_kits|api_operations/)
})

test('T14 exposes OAuth and deprecated write compatibility stubs in model tools', async () => {
  const typert = await read('lib/typert.host.js')
  const model = await read('lib/model.js')
  const validation = await read('lib/config-validation.js')
  const tools = await read('lib/agent-tools.js')
  assert.doesNotMatch(typert, /approveWriteConfirmation|rejectWriteConfirmation|cancelWriteConfirmation/)
  assert.match(model, /oauth2-client-credentials/)
  assert.match(validation, /oauth2-client-credentials/)
  assert.match(tools, /WRITE_CONFIRMATION_UNSUPPORTED/)
  assert.match(tools, /api_write_execute.*WRITE_CONFIRMATION_UNSUPPORTED/s)
  assert.doesNotMatch(tools, /confirmationToken/)
  assert.match(tools, /required: \['operationId'\]/)
})

test('T07 registers fixed Agent discovery tools without HTTP execution', async () => {
  const host = await read('lib/index.js')
  const tools = await read('lib/agent-tools.js')
  assert.match(host, /export const inject = \['tools', 'systemPrompt', 'credentials'\]/)
  assert.match(host, /createApiKitAgentTools/)
  assert.match(host, /ctx\.tools\.register/)
  for (const name of ['api_kits', 'api_operations', 'api_describe']) assert.match(tools, new RegExp(`name: '${name}'`))
  assert.doesNotMatch(tools, /fetch\(|http:\/\//)
})

test('T11 ships a bounded DSH-independent OpenAPI JSON importer', async () => {
  const importer = await read('lib/openapi-import.js')
  assert.match(importer, /buildOpenApiImportPreview/)
  assert.match(importer, /openapi-3\.\$\{minor\}/)
  assert.match(importer, /swagger-2\.0/)
  assert.match(importer, /EXTERNAL_REF_UNSUPPORTED/)
  assert.doesNotMatch(importer, /\bfetch\s*\(/)
})

test('T10 registers a per-assembly dynamic runtime context', async () => {
  const host = await read('lib/index.js')
  const context = await read('lib/runtime-context.js')
  assert.match(host, /export const inject = \['tools', 'systemPrompt', 'credentials'\]/)
  assert.match(host, /registerApiKitRuntimeContext/)
  assert.match(context, /systemPrompt\.context/)
  assert.match(host, /systemPrompt/)
  assert.match(context, /api_operations/)
  assert.match(context, /声明 HTTP method/)
})

test('T08 adds a fixed-target api_call executor and transport', async () => {
  const host = await read('lib/index.js')
  const tools = await read('lib/agent-tools.js')
  const executor = await read('lib/executor.js')
  const transport = await read('lib/transport.js')
  assert.match(tools, /name: 'api_call'/)
  assert.match(executor, /createApiKitHttpExecutor/)
  assert.match(transport, /redirect: 'manual'/)
  assert.match(executor, /READ_METHODS/)
  assert.doesNotMatch(tools, /name: 'web_fetch'/)
})

test('T03 package files include Registry runtime artifacts', () => {
  const expected = new Set([
    'lib/index.js',
    'lib/typert.host.js',
    'lib/client.js',
    'lib/model.js',
    'lib/normalizers.js',
    'lib/registry-store.js',
    'lib/registry-archive.js',
    'lib/errors.js',
    'lib/config-validation.js',
    'lib/credential-adapter.js',
    'lib/configuration.js',
    'lib/operation-validation.js',
    'lib/session-selection.js',
    'lib/discovery.js',
    'lib/agent-tools.js',
    'lib/executor.js',
    'lib/oauth2.js',
    'lib/write-confirmation.js',
    'lib/transport.js',
    'lib/ip.js',
    'lib/ssrf.js',
    'lib/redaction.js',
    'lib/audit-log.js',
    'lib/runtime-context.js',
    'lib/openapi-import.js',
    'lib/openapi-import-transaction.js',
    'test/client-contract.test.mjs',
    'test/environment.test.mjs',
    'test/model.test.mjs',
    'test/ssrf.test.mjs',
    'test/runtime-context.test.mjs',
    'test/executor.test.mjs',
    'test/response-redaction-policy.test.mjs',
    'test/oauth2.test.mjs',
    'test/configuration.test.mjs',
    'test/auth.test.mjs',
    'test/openapi-import-transaction.test.mjs',
    'test/credential-adapter.test.mjs',
    'test/fixtures/legacy-auth-collision.json',
    'test/typert-contract.test.mjs',
    'test/oauth2.test.mjs',
    'test/write-confirmation.test.mjs',
    'test/write-executor.test.mjs',
    'cordis.patch.yml',
    'README.md',
    'README.zh-CN.md',
    'screenshots.json',
    'assets',
    'CHANGELOG.md',
    'LICENSE',
    'NOTICE',
  ])
  assert.deepEqual(new Set(packageJson.files), expected)
})

test('package metadata declares the verified DSH 0.2 line and actual Client graph dependency', () => {
  assert.equal(packageJson.engines.dsh, '>=0.2.0-rc.2 <0.3.0')
  assert.equal(packageJson.peerDependencies['@deepseek-ai/cordis'], '~4.0.4')
  assert.equal(packageJson.peerDependencies['@deepseek-ai/dsh-client-runtime'], undefined)
  assert.deepEqual(packageJson.dsh.client.inject, ['@deepseek-ai/dsh-client-ui-primitives'])
  assert.equal(packageJson.peerDependencies['@deepseek-ai/dsh-client-ui-primitives'], '0.2.0-rc.2')
})
