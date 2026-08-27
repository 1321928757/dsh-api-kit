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
  'cordis.patch.yml',
  'README.md',
  'README.zh-CN.md',
  'CHANGELOG.md',
  'LICENSE',
  'NOTICE',
]

if (packageJson.name !== 'dsh-api-kit') fail('package.name must be dsh-api-kit')
if (packageJson.version !== '0.1.0') fail('T01 package.version must be 0.1.0')
if (packageJson.type !== 'module') fail('package.type must be module')
if (packageJson.main !== './lib/index.js' && packageJson.main !== 'lib/index.js') fail('package.main must point to lib/index.js')
if (!packageJson.exports || !packageJson.exports['.'] || !packageJson.exports['./client'] || !packageJson.exports['./typert'] || !packageJson.exports['./package.json']) {
  fail('exports must include ., ./client, ./typert and ./package.json')
}
if (!packageJson.dsh || !packageJson.dsh.bundle || packageJson.dsh.bundle.patch !== './cordis.patch.yml') fail('dsh.bundle.patch must be ./cordis.patch.yml')
if (!packageJson.dsh.client || packageJson.dsh.client.platform !== 'web') fail('dsh.client.platform must be web')
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
if (!/invocations:\s*\[\]/.test(typert)) fail('T01 Typert manifest should not expose business invocations')

if (process.exitCode) process.exit()
console.log('[check-manifest] manifest checks passed')
