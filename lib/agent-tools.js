/**
 * Fixed model-visible Agent tools for API Kit discovery.
 *
 * The tool definitions stay as plain JavaScript objects so the bundle does not
 * depend on a second copy of the DSH runtime. Business logic lives in
 * discovery.js and is therefore easy to test without starting an Agent.
 */

import { createApiKitDiscoveryService } from './discovery.js'

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

function descriptionText(value) {
  return typeof value === 'string' ? value : ''
}

export function createApiKitAgentTools(configuration, options = {}) {
  const discovery = createApiKitDiscoveryService(configuration, options)
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

  return Object.freeze({ apiKits, apiOperations, apiDescribe })
}

export { JSON_OUTPUT, apiKitsParameters, apiOperationsParameters, apiDescribeParameters }
