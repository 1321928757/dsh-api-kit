import { createPinnedHttpTransport } from '../lib/transport.js'
import { lookup } from 'node:dns/promises'

const url = new URL('http://interface.demo.ehi.com.cn/Order/Reduced?orderId=1172576462&Platform=InterfaceApi&IsTrack=false&fillOptions=960')
const addresses = await lookup(url.hostname, { all: true, verbatim: true })
const pin = addresses[0]
const transport = createPinnedHttpTransport()
const response = await transport.request({ url: url.toString(), method: 'GET', headers: {}, redirect: 'manual', maxRedirects: 0, maxResponseBytes: 524288, resolvedAddress: pin.address, resolvedFamily: pin.family })
console.log({ status: response.status, contentType: response.contentType, bytes: response.bytesRead, truncated: response.truncated, tooLarge: response.tooLarge, bodyPrefix: new TextDecoder().decode(response.body).slice(0, 100) })
