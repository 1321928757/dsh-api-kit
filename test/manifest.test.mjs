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
  assert.equal(packageJson.version, '0.1.0')
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
  assert.match(typert, /invocations: \[\]/)
})

test('bundle patch inserts exactly the plugin row', async () => {
  const patch = await read('cordis.patch.yml')
  assert.match(patch, /- insert:/)
  assert.match(patch, /id: dsh-api-kit/)
  assert.match(patch, /name: dsh-api-kit/)
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
    'cordis.patch.yml',
    'README.md',
    'README.zh-CN.md',
    'CHANGELOG.md',
    'LICENSE',
    'NOTICE',
  ])
  assert.deepEqual(new Set(packageJson.files), expected)
})
