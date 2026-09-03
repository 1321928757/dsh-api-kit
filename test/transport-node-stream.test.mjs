import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinnedHttpTransport } from '../lib/transport.js'

function nodeResponse(chunks, headers = {}) {
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'transfer-encoding': 'chunked', ...headers },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield Buffer.from(chunk)
    },
  }
}

test('pinned transport reads chunked Node IncomingMessage bodies', async () => {
  const transport = createPinnedHttpTransport({
    requestImpl: async () => nodeResponse(['{"result":', '{"orderId":"1172576462"}}']),
  })
  const response = await transport.request({
    url: 'http://interface.demo.ehi.com.cn/Order/Reduced?orderId=1172576462',
    method: 'GET',
    headers: {},
    redirect: 'manual',
    maxRedirects: 0,
    maxResponseBytes: 524288,
    resolvedAddress: '172.31.33.216',
    resolvedFamily: 4,
  })
  assert.equal(response.status, 200)
  assert.equal(response.contentType, 'application/json')
  assert.equal(response.bytesRead, 35)
  assert.equal(new TextDecoder().decode(response.body), '{"result":{"orderId":"1172576462"}}')
})
