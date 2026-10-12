import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const hostSource = await readFile(path.join(root, 'lib/typert.host.js'), 'utf8')
const clientSource = await readFile(path.join(root, 'lib/client.js'), 'utf8')
const hostEntrySource = await readFile(path.join(root, 'lib/index.js'), 'utf8')
const host = (await import('../lib/typert.host.js')).TYPERT

function bracesAfter(source, marker) {
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `missing marker ${marker}`)
  const open = source.indexOf('{', start)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  assert.fail(`unclosed block after ${marker}`)
}

test('Host strict codecs expose create factories and enforce actual wire shapes', () => {
  const shared = new Set()
  for (const invocation of host.invocations) {
    for (const parameter of invocation.parameters) shared.add(parameter.codec)
    shared.add(invocation.result)
  }
  for (const codec of shared) {
    assert.equal(codec.mode, 'strict')
    assert.equal(typeof codec.create, 'function', `${codec.typeSymbol} must expose create()`)
    assert.equal(typeof codec.create().parse, 'function', `${codec.typeSymbol}.create() must return parse-capable schema`)
  }

  const list = host.invocations.find((invocation) => invocation.method === 'addOperationsToKit')
  const kitId = list.parameters.find((parameter) => parameter.name === 'kitId')
  const operationIds = list.parameters.find((parameter) => parameter.name === 'operationIds')
  assert.equal(operationIds.codec.typeSymbol, 'dsh-api-kit#OperationIds')
  assert.deepEqual(operationIds.codec.create().parse(['list-jobs', 'get-job']), ['list-jobs', 'get-job'])
  assert.throws(() => operationIds.codec.create().parse({ first: 'list-jobs' }))
  assert.throws(() => kitId.codec.create().parse(undefined))
  assert.deepEqual(host.invocations.find((invocation) => invocation.method === 'listKits').result.create().parse([]), [])
  assert.throws(() => host.invocations.find((invocation) => invocation.method === 'listKits').result.create().parse(undefined))
  assert.equal(z.json().parse(null), null)
})

test('Client strict codecs have create factories and import no zod', () => {
  assert.doesNotMatch(clientSource, /require\(['"]zod['"]\)|from\s+['"]zod['"]/, 'browser module must not import zod')
  const marker = 'const looseCodec = '
  const start = clientSource.indexOf(marker)
  assert.notEqual(start, -1)
  const end = clientSource.indexOf('\n    const descriptor =', start)
  const codecFactory = clientSource.slice(start, end)
  assert.match(codecFactory, /create:\s*\(\)\s*=>\s*\(\s*\{\s*parse:/)
  assert.doesNotMatch(codecFactory, /schema:\s*\{/)
})

function extractClientContract() {
  const start = clientSource.indexOf('const RPC_METHODS = [')
  const end = clientSource.indexOf('\n    const styles =', start)
  assert.ok(start >= 0 && end > start)
  const isolated = clientSource.slice(start, end)
  const executable = isolated
    .replace('const RPC_METHODS = [', 'const RPC_METHODS = [')
  return new Function(`${executable}; return { RPC_METHODS, descriptorSpec, CONTRIBUTION }`)()
}

test('Client descriptors match all shared Host RPC calls and omit approval-only host methods', () => {
  const { RPC_METHODS, descriptorSpec, CONTRIBUTION } = extractClientContract()
  const hostByMethod = new Map(host.invocations.map((invocation) => [invocation.method, invocation]))
  const clientByMethod = new Map(CONTRIBUTION.descriptors.map((descriptor) => [descriptor.method, descriptor]))
  const hostOnly = ['approveWriteConfirmation', 'rejectWriteConfirmation', 'cancelWriteConfirmation']
  const serviceMethods = hostEntrySource.match(/const RPC_METHODS = Object\.freeze\(\[([\s\S]*?)\]\)/)?.[1]
    .match(/'([^']+)'/g)?.map((method) => method.slice(1, -1)) ?? []

  assert.deepEqual([...new Set(serviceMethods)].sort(), [...hostByMethod.keys()].sort(), 'Host gateway must expose every manifest method once')
  assert.equal(RPC_METHODS.length, CONTRIBUTION.descriptors.length)
  for (const method of RPC_METHODS) {
    const invocation = hostByMethod.get(method)
    const descriptor = clientByMethod.get(method)
    assert.ok(invocation, `Host method ${method} must exist`)
    assert.ok(descriptor, `Client descriptor ${method} must exist`)
    assert.equal(descriptor.id, invocation.id)
    assert.equal(descriptor.service, invocation.service)
    assert.equal(descriptor.namespace, invocation.namespace)
    assert.deepEqual(descriptor.invocation, invocation.invocation)
    assert.deepEqual(descriptor.parameters.map(({ name, wire, source, codec }) => ({ name, wire, source, typeSymbol: codec.typeSymbol })), invocation.parameters.map(({ name, wire, source, codec }) => ({ name, wire, source, typeSymbol: codec.typeSymbol })), method)
    assert.equal(descriptor.result.typeSymbol, invocation.result.typeSymbol, `${method} result codec`)
    assert.deepEqual(descriptorSpec[method], invocation.parameters.map((parameter) => parameter.name), `${method} positional argument order`)
    for (const codec of [...descriptor.parameters.map((parameter) => parameter.codec), descriptor.result]) {
      assert.equal(codec.mode, 'strict')
      assert.equal(typeof codec.create, 'function')
      assert.equal(typeof codec.create().parse, 'function')
    }
  }
  for (const method of hostOnly) {
    assert.ok(hostByMethod.has(method), `Host-only method ${method} exists`)
    assert.equal(clientByMethod.has(method), false, `${method} must remain absent from Client descriptors`)
  }
})


test('strict codec regression without create matches DSH 0.2 loader rejection contract', () => {
  const badCodec = { mode: 'strict', typeSymbol: 'dsh-api-kit#Args', schema: z.record(z.string(), z.unknown()) }
  assert.equal(typeof badCodec.create, 'undefined')
  assert.throws(() => {
    if (typeof badCodec.create !== 'function') throw new Error('typert-loader: dsh-api-kit invocation "test" parameter has no create() factory')
  }, /has no create\(\) factory/)
})
