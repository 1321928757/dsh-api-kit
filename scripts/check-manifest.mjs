import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (name) => readFile(path.join(root, name), 'utf8')
const fail = (message) => {
  console.error(`[check-manifest] ${message}`)
  process.exitCode = 1
}

const packageJson = JSON.parse(await read('package.json'))
const expectedFiles = [
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
]

if (packageJson.name !== 'dsh-api-kit') fail('package.name must be dsh-api-kit')
if (packageJson.version !== '0.1.1') fail('T01 package.version must be 0.1.1')
if (packageJson.type !== 'module') fail('package.type must be module')
if (packageJson.main !== './lib/index.js' && packageJson.main !== 'lib/index.js') fail('package.main must point to lib/index.js')
if (!packageJson.exports || !packageJson.exports['.'] || !packageJson.exports['./client'] || !packageJson.exports['./typert'] || !packageJson.exports['./package.json']) {
  fail('exports must include ., ./client, ./typert and ./package.json')
}
if (!packageJson.dsh || !packageJson.dsh.bundle || packageJson.dsh.bundle.patch !== './cordis.patch.yml') fail('dsh.bundle.patch must be ./cordis.patch.yml')
if (!packageJson.dsh.client || packageJson.dsh.client.platform !== 'web') fail('dsh.client.platform must be web')
if (packageJson.engines?.dsh !== '>=0.2.0-rc.2 <0.3.0') fail('engines.dsh must declare the verified DSH 0.2 runtime range')
const targetVersions = ['0.2.0-rc.2', '0.2.0', '0.2.9', '0.3.0']
const compareVersion = (left, right) => {
  const parse = (version) => {
    const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/)
    return match && { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] }
  }
  const a = parse(left); const b = parse(right)
  if (!a || !b) return NaN
  for (const key of ['major', 'minor', 'patch']) if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1
  if (a.prerelease === b.prerelease) return 0
  if (a.prerelease === undefined) return 1
  if (b.prerelease === undefined) return -1
  return a.prerelease.localeCompare(b.prerelease, 'en', { numeric: true })
}
const inDeclaredRuntimeRange = (version) => compareVersion(version, '0.2.0-rc.2') >= 0 && compareVersion(version, '0.3.0') < 0
for (const version of targetVersions) {
  const expected = version !== '0.3.0'
  if (inDeclaredRuntimeRange(version) !== expected) fail(`engines.dsh resolver compatibility is incorrect for ${version}`)
}
if (packageJson.peerDependencies?.['@deepseek-ai/cordis'] !== '~4.0.4') fail('Cordis peer must match the verified DSH 0.2 runtime line')
if (packageJson.peerDependencies?.['@deepseek-ai/dsh-client-runtime']) fail('obsolete dsh-client-runtime peer must be removed')
if ((packageJson.dsh.client.inject ?? []).some((name) => name === '@deepseek-ai/dsh-client-runtime' || name === '@deepseek-ai/dsh-client-ui-conversation')) fail('dsh.client.inject must not name services or unrelated UI packages')
if (!packageJson.dsh.client.inject?.includes('@deepseek-ai/dsh-client-ui-primitives')) fail('Client module graph must declare the imported optional UI primitives package')
if (!Array.isArray(packageJson.files)) fail('package.files must be an array')
for (const file of expectedFiles) {
  if (!packageJson.files.includes(file)) fail(`package.files is missing ${file}`)
}
for (const file of packageJson.files) {
  if (!expectedFiles.includes(file)) fail(`package.files contains unexpected T01 file ${file}`)
}
if (!Array.isArray(packageJson.keywords) || !packageJson.keywords.includes('dsh-plugin')) fail('keywords must include dsh-plugin')

const patch = await read('cordis.patch.yml')
if (!/- id:\s*dsh-api-kit/.test(patch) || !/name:\s*dsh-api-kit/.test(patch)) fail('cordis.patch.yml must insert dsh-api-kit')

const host = await read('lib/index.js')
const client = await read('lib/client.js')
const typert = await read('lib/typert.host.js')
if (!/export const name\s*=\s*['"]dsh-api-kit['"]/.test(host)) fail('Host entry must export dsh-api-kit name')
if (!/configuration\.js/.test(host)) fail('Host entry must reference configuration service')
if (!/id:\s*['"]dsh-api-kit['"]/.test(client)) fail('Client entry must load with dsh-api-kit id')
if (!/package:\s*['"]dsh-api-kit['"]/.test(typert) || !/face:\s*['"]host['"]/.test(typert)) fail('Typert manifest must declare package and host face')
for (const method of ['listKits', 'createKit', 'listOperations', 'createOperation', 'updateOperation', 'deleteOperation', 'getSessionActivation', 'setSessionActivation', 'clearSessionActivation', 'approveWriteConfirmation', 'rejectWriteConfirmation', 'cancelWriteConfirmation']) {
  if (!new RegExp(`["']${method}["']`).test(typert)) fail(`Typert manifest is missing ${method}`)
}
if (!/key:\s*['"]apiKitConfig['"]/.test(typert) || !/namespace:\s*['"]api-kit['"]/.test(typert)) fail('Typert manifest must declare the api-kit namespace')
for (const tool of ['api_kits', 'api_operations', 'api_describe', 'api_call', 'api_write_prepare', 'api_write_execute']) {
  if (!new RegExp(`name:\\s*['"]${tool}['"]`).test(await read('lib/agent-tools.js'))) fail(`Agent tool is missing ${tool}`)
}
if (!/createApiKitAgentTools/.test(host) || !/tools\.register/.test(host) || !/createApiKitHttpExecutor/.test(await read('lib/executor.js'))) fail('Host entry must register Agent API tools and executor')
if (!/runtime-context\.js/.test(host) || !/systemPrompt/.test(host) || !/registerApiKitRuntimeContext/.test(await read('lib/runtime-context.js'))) fail('Host entry must register dynamic API Kit runtime context')
const importer = await read('lib/openapi-import.js')
if (!/buildOpenApiImportPreview/.test(importer) || !/openapi-3\.\$\{minor\}/.test(importer) || !/swagger-2\.0/.test(importer) || !/EXTERNAL_REF_UNSUPPORTED/.test(importer)) fail('T11 OpenAPI importer must expose bounded JSON preview support')
const transaction = await read('lib/openapi-import-transaction.js')
if (!/createOpenApiImportTransactionService/.test(transaction) || !/confirmOpenApiImport/.test(transaction) || !/store\.update/.test(transaction)) fail('T12 import transaction must revalidate and commit atomically')
if (!/previewOpenApiImport/.test(host) || !/confirmOpenApiImport/.test(host) || !/previewOpenApiImport/.test(typert) || !/confirmOpenApiImport/.test(typert) || !/previewOpenApiImport/.test(client) || !/confirmOpenApiImport/.test(client) || !/data-t12-import/.test(client)) fail('T12 import RPC methods and settings UI must be synchronized')
if (!/focus-visible/.test(client) || !/prefers-reduced-motion:reduce/.test(client) || !/@media\(max-width:520px\)/.test(client) || !/aria-modal/.test(client) || !/requestRef/.test(client) || !/parseJsonValue/.test(client)) fail('T13 Client UI quality guards are missing')
try { await read('test/client-contract.test.mjs') } catch { fail('T13 Client contract test is missing') }
if (/fetch\(|webServer/.test(transaction)) fail('T12 import transaction must remain offline and not expose a web route')
if (/\bfetch\s*\(/.test(importer)) fail('T11 importer must not perform network access')
for (const wire of ['id', 'patch', 'enabled', 'input', 'kitId', 'operationIds']) {
  if (!new RegExp(`name: item, wire: item`).test(typert)) fail(`Typert manifest does not generate named wire mappings for ${wire}`)
}
if (!/create:\s*\(\)\s*=>\s*z\.json\(\)/.test(typert)) fail('Typert result codec must expose a create() factory validating JSON values')
if (!/create:\s*\(\)\s*=>\s*z\.record\(z\.string\(\),\s*z\.unknown\(\)\)/.test(typert)) fail('Typert object-argument codec must expose a create() factory')
if (!/dsh-api-kit#OperationIds[\s\S]*?create:\s*\(\)\s*=>\s*z\.array\(z\.string\(\)\)/.test(typert)) fail('operationIds must use a strict string-array codec factory')
if (!/typeof codec\.create/.test(await read('test/typert-contract.test.mjs'))) fail('Typert contract tests must verify create() factories')

if (process.exitCode) process.exit()
console.log('[check-manifest] manifest checks passed')
