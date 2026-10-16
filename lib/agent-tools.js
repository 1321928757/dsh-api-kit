/**
 * Fixed model-visible Agent tools for API Kit discovery.
 *
 * The tool definitions stay as plain JavaScript objects so the bundle does not
 * depend on a second copy of the DSH runtime. Business logic lives in
 * discovery.js and is therefore easy to test without starting an Agent.
 */

import { createApiKitDiscoveryService } from './discovery.js'
import { createApiKitHttpExecutor } from './executor.js'

const JSON_OUTPUT = {
  schema: { type: 'object', additionalProperties: true },
  render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
}

const apiKitsParameters = {
  type: 'object',
  additionalProperties: false,
  properties: {},
}

const apiOperationsParameters = {
  type: 'object',
  additionalProperties: false,
  properties: {
    query: { type: 'string', description: '关键词；匹配 operationId、名称、摘要、描述、路径或 Tag。' },
    tag: { type: 'string', description: '精确匹配一个 Tag（不区分大小写）。' },
    method: { type: 'string', enum: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], description: 'HTTP method 过滤器。' },
    serviceTargetId: { type: 'string', description: '已登记 Service Target ID。' },
    offset: { type: 'integer', description: '分页起点，默认 0。' },
    limit: { type: 'integer', description: '返回数量，默认 20，最大 100。' },
  },
}

const apiDescribeParameters = {
  type: 'object',
  additionalProperties: false,
  properties: {
    operationId: { type: 'string', description: 'api_operations 返回的稳定 Operation ID。' },
  },
  required: ['operationId'],
}

const deprecatedWriteParameters = {
  type: 'object', additionalProperties: false,
  properties: {
    operationId: { type: 'string' }, pathParams: { type: 'object', additionalProperties: true }, query: { type: 'object', additionalProperties: true }, headers: { type: 'object', additionalProperties: true }, body: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'] },
  }, required: ['operationId'],
}

const apiCallParameters = {
  type: 'object',
  additionalProperties: false,
  properties: {
    operationId: { type: 'string', description: 'api_operations 返回的稳定 Operation ID；不得传入 URL。' },
    pathParams: { type: 'object', additionalProperties: true, description: '仅传入 api_describe 声明的 path 参数。' },
    query: { type: 'object', additionalProperties: true, description: '仅传入 api_describe 声明的 query 参数。' },
    headers: { type: 'object', additionalProperties: true, description: '仅传入 api_describe 声明的业务 Header；不得覆盖认证 Header。' },
    body: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'], description: '仅传入 api_describe 声明的请求 body；由 Host 按 Schema 校验。' },
  },
  required: ['operationId'],
}

function descriptionText(value) {
  return typeof value === 'string' ? value : ''
}

export function createApiKitAgentTools(configuration, options = {}) {
  const discovery = createApiKitDiscoveryService(configuration, options)
  const executor = options.executor ?? createApiKitHttpExecutor(configuration, options)
  const apiKits = {
    name: 'api_kits',
    description: descriptionText('列出当前 Agent 会话可用的 API Kit 和 Environment 摘要。只返回安全元数据；先发现 Operation，再按需描述，T07 不发起 HTTP 请求。'),
    parameters: apiKitsParameters,
    output: JSON_OUTPUT,
    timeoutMs: 15000,
    isConcurrencySafe: () => true,
    async execute(_args, exec) {
      return discovery.apiKits(exec)
    },
  }

  const apiOperations = {
    name: 'api_operations',
    description: descriptionText('在当前 Agent 会话已激活且允许暴露的 API Kit 内搜索 Operation。支持关键词、Tag、HTTP method、Service Target 和分页；不接受 URL，不发起 HTTP 请求。'),
    parameters: apiOperationsParameters,
    output: JSON_OUTPUT,
    timeoutMs: 15000,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      return discovery.apiOperations(args, exec)
    },
  }

  const apiDescribe = {
    name: 'api_describe',
    description: descriptionText('根据 api_operations 返回的稳定 operationId，读取当前会话允许暴露的完整安全调用说明和 JSON Schema。不得传入 URL 或主机；T07 不发起 HTTP 请求。'),
    parameters: apiDescribeParameters,
    output: JSON_OUTPUT,
    timeoutMs: 15000,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      return discovery.apiDescribe(args, exec)
    },
  }

  const apiCall = {
    name: 'api_call',
    description: descriptionText('调用固定 API Operation；所有已登记且启用的声明 HTTP method 均通过 Host 固定目标路径直接执行。'),
    parameters: apiCallParameters,
    output: JSON_OUTPUT,
    timeoutMs: 60000,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      return executor.execute(args, exec)
    },
  }

  const apiWritePrepare = { name: 'api_write_prepare', description: '已废弃：写 Operation 现在通过 api_call 直接执行；不生成确认 token。', parameters: deprecatedWriteParameters, output: JSON_OUTPUT, timeoutMs: 15000, isConcurrencySafe: () => false, async execute(_args, _exec = {}) { return { ok: false, error: { code: 'WRITE_CONFIRMATION_UNSUPPORTED', message: '写 Operation 不再使用确认 token，请直接调用 api_call。' } } } }
  const apiWriteExecute = { name: 'api_write_execute', description: '已废弃：写 Operation 现在通过 api_call 直接执行；不接受确认 token。', parameters: deprecatedWriteParameters, output: JSON_OUTPUT, timeoutMs: 15000, isConcurrencySafe: () => false, async execute(_args, _exec = {}) { return { ok: false, error: { code: 'WRITE_CONFIRMATION_UNSUPPORTED', message: '写 Operation 不再使用确认 token，请直接调用 api_call。' } } } }
  return Object.freeze({ apiKits, apiOperations, apiDescribe, apiCall, apiWritePrepare, apiWriteExecute })
}

export { JSON_OUTPUT, apiKitsParameters, apiOperationsParameters, apiDescribeParameters, apiCallParameters, deprecatedWriteParameters }
