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

const writeParameters = {
  type: 'object', additionalProperties: false,
  properties: {
    operationId: { type: 'string' }, pathParams: { type: 'object', additionalProperties: true }, query: { type: 'object', additionalProperties: true }, headers: { type: 'object', additionalProperties: true }, body: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'] }, confirmationToken: { type: 'string' },
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
    body: { type: 'object', description: 'T08 只读调用不接受 body；保留字段仅用于明确拒绝未来写请求。' },
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
    description: descriptionText('调用固定 API Operation；读请求直接执行，写请求只生成确认意图，绝不直接联网。'),
    parameters: apiCallParameters,
    output: JSON_OUTPUT,
    timeoutMs: 60000,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      return executor.execute(args, exec)
    },
  }

  const apiWritePrepare = { name: 'api_write_prepare', description: '准备写请求并生成 Host 确认 token；不联网。', parameters: writeParameters, output: JSON_OUTPUT, timeoutMs: 15000, isConcurrencySafe: () => false, async execute(args, exec = {}) {
    const result = await executor.prepareWrite(args, exec)
    const requestApproval = options.approval && typeof options.approval.request === 'function'
      ? options.approval.request.bind(options.approval)
      : undefined
    if (!requestApproval || !exec?.agent || !result?.confirmation?.token) return result

    const pending = result.confirmation
    const cancelIntent = () => {
      try { executor.confirmation?.cancelToken?.(pending.token) } catch {
        try { executor.confirmation?.cancel?.(pending.token, pending.binding) } catch {}
      }
    }
    let decision
    try {
      decision = await requestApproval({ agent: exec.agent, toolName: 'api_write_prepare', callId: exec.callId, reason: 'API 写请求需要人工确认', signal: exec.signal })
    } catch {
      decision = 'unavailable'
    }
    const outcome = typeof decision === 'string' ? decision : decision?.outcome
    if (outcome === 'allowed-once') {
      try {
        const approved = executor.confirmation?.approveToken?.(pending.token)
        return { ...result, confirmation: { ...pending, state: 'approved', ...(approved?.expiresAt === undefined ? {} : { expiresAt: approved.expiresAt }) } }
      } catch {
        cancelIntent()
        return { ok: false, error: { code: 'CONFIRMATION_REQUIRED', message: '该写请求未获得有效的人工确认' } }
      }
    }
    cancelIntent()
    const code = decision?.outcome === 'rejected' ? 'CONFIRMATION_REJECTED' : 'CONFIRMATION_REQUIRED'
    return { ok: false, error: { code, message: code === 'CONFIRMATION_REJECTED' ? '人工确认已拒绝该 API 写请求' : '该 API 写请求需要人工确认' } }
  } }
  const apiWriteExecute = { name: 'api_write_execute', description: '仅使用已批准确认 token 执行绑定写请求；模型不能自行批准。', parameters: writeParameters, output: JSON_OUTPUT, timeoutMs: 60000, isConcurrencySafe: () => false, async execute(args, exec) { return executor.executeWrite(args, exec) } }
  return Object.freeze({ apiKits, apiOperations, apiDescribe, apiCall, apiWritePrepare, apiWriteExecute })
}

export { JSON_OUTPUT, apiKitsParameters, apiOperationsParameters, apiDescribeParameters, apiCallParameters, writeParameters }
