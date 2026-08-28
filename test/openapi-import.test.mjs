import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildOpenApiImportPreview,
  detectOpenApiVersion,
  parseOpenApiJson,
  resolveOpenApiRef,
} from '../lib/openapi-import.js'

const fixtureRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const fixture = async (name) => JSON.parse(await readFile(path.join(fixtureRoot, name), 'utf8'))

const OAS3 = {
  openapi: '3.0.3',
  info: { title: 'Pet API', version: '1.2.0', description: 'Pets' },
  servers: [{ url: 'https://api.example.test/v1/' }],
  components: {
    schemas: {
      Pet: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' } }, required: ['id'] },
    },
    parameters: {
      PetId: { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
    },
    responses: {
      NotFound: { description: 'Not found' },
    },
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', description: 'Bearer credentials' },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/pets/{id}': {
      parameters: [{ name: 'q', in: 'query', schema: { type: 'string' }, description: 'path query' }],
      get: {
        operationId: 'getPet',
        summary: 'Get pet',
        tags: ['pets'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/PetId' },
          { name: 'q', in: 'query', schema: { type: 'integer' }, description: 'operation query' },
        ],
        responses: {
          '200': { description: 'OK', content: { 'text/plain': {}, 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
  },
}

const SWAGGER2 = {
  swagger: '2.0',
  info: { title: 'Legacy API', version: '2.0' },
  schemes: ['https'],
  host: 'legacy.example.test',
  basePath: '/api/',
  consumes: ['application/json'],
  produces: ['application/json'],
  definitions: { User: { type: 'object', properties: { id: { type: 'integer' } } } },
  securityDefinitions: {
    api_key: { type: 'apiKey', name: 'X-API-Key', in: 'header' },
  },
  security: [{ api_key: [] }],
  paths: {
    '/users': {
      post: {
        operationId: 'createUser',
        parameters: [{ name: 'body', in: 'body', required: true, schema: { $ref: '#/definitions/User' } }],
        responses: { '201': { description: 'Created', schema: { $ref: '#/definitions/User' } } },
      },
    },
  },
}

test('bundled fixtures cover the supported OpenAPI JSON families', async () => {
  assert.equal((await fixture('openapi-3-basic.json')).openapi, '3.0.3')
  assert.equal((await fixture('openapi-3-ref.json')).openapi, '3.1.0')
  assert.equal((await fixture('swagger-2-basic.json')).swagger, '2.0')
  assert.equal((await fixture('openapi-invalid.json')).paths['https://invalid.example.test/users'].trace.operationId, 'traceUsers')
})

test('detects and parses OpenAPI 3.0, 3.1, and Swagger 2.0 JSON', () => {
  assert.deepEqual(detectOpenApiVersion({ ...OAS3, openapi: '3.1.0' }), { ok: true, format: 'openapi', version: '3.1', source: 'openapi-3.1' })
  assert.deepEqual(detectOpenApiVersion(SWAGGER2), { ok: true, format: 'swagger', version: '2.0', source: 'swagger-2.0' })
  assert.equal(parseOpenApiJson(JSON.stringify(OAS3)).ok, true)
  assert.equal(parseOpenApiJson('{broken').errors[0].code, 'JSON_PARSE')
  assert.equal(parseOpenApiJson([]).errors[0].code, 'DOCUMENT_ROOT_INVALID')
  assert.equal(parseOpenApiJson({ openapi: '2.0', paths: {} }).errors[0].code, 'OPENAPI_VERSION_UNSUPPORTED')
  assert.equal(parseOpenApiJson({ openapi: '3.0.0', paths: [] }).errors[0].code, 'PATHS_INVALID')
})

test('normalizes OAS3 operations, refs, parameters, responses, servers and security safely', () => {
  const before = JSON.stringify(OAS3)
  const preview = buildOpenApiImportPreview(OAS3)
  assert.equal(preview.ok, true)
  assert.equal(preview.documentMeta.title, 'Pet API')
  assert.equal(preview.documentMeta.version, '3.0')
  assert.equal(preview.serverCandidates[0].url, 'https://api.example.test/v1')
  assert.equal(preview.serverCandidates[0].displayOnly, true)
  assert.deepEqual(preview.authProfileTemplates.map((item) => item.type), ['bearer'])
  const operation = preview.operations[0]
  assert.equal(operation.id, 'getpet')
  assert.equal(operation.operationId, 'getPet')
  assert.equal(operation.method, 'GET')
  assert.equal(operation.path, '/pets/{id}')
  assert.deepEqual(operation.parameters.map((item) => [item.name, item.in, item.schema.type]), [['q', 'query', 'integer'], ['id', 'path', 'integer']])
  assert.deepEqual(operation.successStatuses, [200])
  assert.deepEqual(operation.responses.map((item) => item.status), ['200', '404'])
  assert.deepEqual(operation.security, ['bearerAuth'])
  assert.equal(operation.needsTargetBinding, true)
  assert.equal(operation.needsAuthBinding, true)
  assert.equal(preview.tagCounts.pets, 1)
  assert.equal(JSON.stringify(preview).includes('Bearer credentials'), true)
  assert.equal(JSON.stringify(preview).includes('secretRef'), false)
  assert.equal(JSON.stringify(OAS3), before)
})

test('generates a stable ID when operationId is absent and keeps repeated preview deterministic', () => {
  const document = { openapi: '3.0.0', info: { title: 'Health', version: '1' }, paths: { '/health/': { get: { responses: { '204': { description: 'ok' } } } } } }
  const first = buildOpenApiImportPreview(document, { sourceId: 'demo' })
  const second = buildOpenApiImportPreview(JSON.parse(JSON.stringify(document)), { sourceId: 'demo' })
  assert.deepEqual(second, first)
  assert.equal(first.operations[0].id, 'get-health')
  assert.equal(first.operations[0].operationId, 'get-health')
  assert.ok(first.operations[0].warnings.some((item) => item.code === 'MISSING_OPERATION_ID'))
  assert.ok(first.warnings.some((item) => item.code === 'MISSING_BASE_URL'))
})

test('normalizes Swagger 2 body, definitions, response and api-key template', () => {
  const preview = buildOpenApiImportPreview(SWAGGER2)
  assert.equal(preview.ok, true)
  assert.equal(preview.documentMeta.format, 'swagger')
  assert.equal(preview.serverCandidates[0].url, 'https://legacy.example.test/api')
  assert.equal(preview.authProfileTemplates[0].type, 'api-key-header')
  assert.equal(preview.authProfileTemplates[0].headerName, 'X-API-Key')
  const operation = preview.operations[0]
  assert.equal(operation.method, 'POST')
  assert.equal(operation.requestBody.required, true)
  assert.equal(operation.requestBody.schema.properties.id.type, 'integer')
  assert.deepEqual(operation.successStatuses, [201])
  assert.equal(operation.policy.allowAgentCall, false)
  assert.equal(operation.policy.allowWrite, false)
  assert.ok(operation.warnings.some((item) => item.code === 'NEEDS_CREDENTIAL_BINDING'))
})

test('resolves local escaped refs and rejects external, missing and cyclic refs', () => {
  const document = { components: { schemas: { 'a/b': { type: 'string' }, A: { $ref: '#/components/schemas/B' }, B: { $ref: '#/components/schemas/A' } } } }
  assert.deepEqual(resolveOpenApiRef(document, '#/components/schemas/a~1b').value, { type: 'string' })
  assert.equal(resolveOpenApiRef(document, 'https://example.test/schema.json').error.code, 'EXTERNAL_REF_UNSUPPORTED')
  assert.equal(resolveOpenApiRef(document, '#/components/schemas/nope').error.code, 'REF_NOT_FOUND')
  assert.equal(resolveOpenApiRef(document, '#/components/schemas/A').error.code, 'REF_CYCLE')
})

test('reports unsafe methods, controlled headers, unsupported formData and path declarations', () => {
  const document = {
    openapi: '3.0.0',
    info: { title: 'Issues', version: '1' },
    servers: [{ url: 'ftp://bad.example.test' }],
    paths: {
      '/things/{id}': {
        trace: { operationId: 'traceThing', responses: { '200': { description: 'ok' } } },
        post: {
          operationId: 'postThing',
          parameters: [
            { name: 'Authorization', in: 'header' },
            { name: 'file', in: 'query', schema: { type: 'string' } },
          ],
          requestBody: { content: { 'multipart/form-data': { schema: { type: 'object' } } } },
          responses: { '2XX': { description: 'bad' } },
        },
      },
    },
  }
  const preview = buildOpenApiImportPreview(document)
  assert.ok(preview.warnings.some((item) => item.code === 'SERVER_INVALID'))
  assert.ok(preview.warnings.some((item) => item.code === 'UNSUPPORTED_METHOD'))
  const operation = preview.operations[0]
  assert.ok(operation.errors.some((item) => item.code === 'CONTROLLED_HEADER'))
  assert.ok(operation.errors.some((item) => item.code === 'PATH_PARAMETER_MISSING'))
  assert.ok(operation.errors.some((item) => item.code === 'RESPONSE_STATUS_INVALID'))
  assert.equal(operation.importable, false)
})

test('handles server variables, security alternatives and explicit no-auth', () => {
  const document = {
    openapi: '3.1.0',
    info: { title: 'Variables', version: '1' },
    servers: [{ url: 'https://{env}.example.test/{version}', variables: { env: { default: 'dev', enum: ['dev', 'prod'] }, version: { enum: ['v1'] } } }],
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' }, key: { type: 'apiKey', in: 'query', name: 'key' }, oauth: { type: 'oauth2', flows: {} } } },
    security: [{ bearer: [] }, { key: [] }],
    paths: {
      '/public': { get: { operationId: 'public', security: [], responses: { '200': { description: 'ok' } } } },
      '/private': { get: { operationId: 'private', responses: { '200': { description: 'ok' } } } },
    },
  }
  const preview = buildOpenApiImportPreview(document)
  assert.equal(preview.serverCandidates[0].status, 'unresolved')
  assert.equal('url' in preview.serverCandidates[0], false)
  assert.ok(preview.warnings.some((item) => item.code === 'SERVER_VARIABLE_UNRESOLVED'))
  assert.ok(preview.warnings.some((item) => item.code === 'SECURITY_SCHEME_UNSUPPORTED'))
  const publicOperation = preview.operations.find((item) => item.operationId === 'public')
  assert.deepEqual(publicOperation.security, [])
  const privateOperation = preview.operations.find((item) => item.operationId === 'private')
  assert.ok(privateOperation.warnings.some((item) => item.code === 'SECURITY_REQUIREMENTS_LOSSY'))
  assert.ok(privateOperation.warnings.some((item) => item.code === 'NEEDS_CREDENTIAL_BINDING'))
})

test('preview classifies new, update, skip and conflict without mutating Registry input', () => {
  const document = { openapi: '3.0.0', info: { title: 'Diff', version: '1' }, servers: [{ url: 'https://api.example.test' }], paths: { '/health': { get: { operationId: 'health', responses: { '200': { description: 'ok' } } } } } }
  const unbound = buildOpenApiImportPreview(document, { serviceTargetId: 'backend', sourceId: 'demo' })
  const candidate = unbound.operations[0]
  const registry = { operations: [candidate], serviceTargets: [{ id: 'backend' }] }
  const before = JSON.stringify(registry)
  const same = buildOpenApiImportPreview(document, { serviceTargetId: 'backend', sourceId: 'demo', registry })
  assert.equal(same.operations[0].status, 'skip')
  assert.equal(JSON.stringify(registry), before)
  const changed = buildOpenApiImportPreview({ ...document, paths: { '/health': { get: { operationId: 'health', summary: 'changed', responses: { '200': { description: 'ok' } } } } } }, { serviceTargetId: 'backend', sourceId: 'demo', registry })
  assert.equal(changed.operations[0].status, 'update')
  const conflict = buildOpenApiImportPreview({ ...document, paths: { '/health': { get: { operationId: 'health', summary: 'other', responses: { '200': { description: 'ok' } } } } } }, { serviceTargetId: 'backend', registry: { operations: [{ ...candidate, source: 'manual' }], serviceTargets: [{ id: 'backend' }] } })
  assert.equal(conflict.operations[0].status, 'conflict')
})

test('bounds oversized JSON before importing', () => {
  const huge = JSON.stringify({ openapi: '3.0.0', info: { title: 'x' }, paths: {}, description: 'x'.repeat(2000) })
  const preview = buildOpenApiImportPreview(huge, { limits: { maxDocumentBytes: 1000 } })
  assert.equal(preview.ok, false)
  assert.equal(preview.errors[0].code, 'DOCUMENT_TOO_LARGE')
})

console.log('OpenAPI import tests complete')
