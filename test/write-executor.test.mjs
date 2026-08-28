import test from 'node:test'
import assert from 'node:assert/strict'
import { createConfigurationService } from '../lib/configuration.js'
import { createRegistryStore } from '../lib/registry-store.js'
import { createApiKitHttpExecutor } from '../lib/executor.js'
import { createWriteConfirmation } from '../lib/write-confirmation.js'
import { createMemoryFs } from './helpers/memory-fs.mjs'

const exec = { agent: { id: 's' }, signal: new AbortController().signal }
const response = { status: 200, contentType: 'application/json', body: new TextEncoder().encode('{"ok":true}') }
async function setup() {
 const store=createRegistryStore({fs:createMemoryFs(),filePath:'C:\\x\\r.json'}); await store.load(); const c=createConfigurationService({store});
 await c.createEnvironment({id:'e',name:'E',baseUrl:'https://api.test/',allowedHosts:['api.test']}); await c.createServiceTarget({id:'t',name:'T',environmentIds:['e'],defaultEnvironmentId:'e'}); await c.createKit({id:'k',name:'K',operationIds:[]}); await c.createOperation({id:'w',operationId:'w',name:'W',method:'POST',path:'/x',serviceTargetId:'t',parameters:[],requestBody:{required:true,schema:{type:'object',required:['x'],properties:{x:{type:'string'}}}},policy:{allowAgentCall:true,allowWrite:true,requiresConfirmation:true},kitIds:['k']}); await c.updateKit('k',{policy:{allowWrite:true,allowWriteMethods:['POST']}}); await c.setSessionActivation({sessionId:'s',activeKitIds:['k'],environmentId:'e'}); return c
}
test('write prepare never transports, then approved execute transports once',async()=>{const c=await setup(); const calls=[]; const confirmation=createWriteConfirmation({generateToken:()=> 'token-123456789012345'}); const x=createApiKitHttpExecutor(c,{confirmation,transport:{handlesResolution:true,request:r=>(calls.push(r),response)}}); const p=await x.execute({operationId:'w',body:{x:'ok'}},exec); assert.equal(p.error.code,'CONFIRMATION_REQUIRED'); assert.equal(calls.length,0); const binding={sessionId:'s',operationId:'w',method:'POST',serviceTargetId:'t',environmentId:'e',requestFingerprint:'bad',registryFingerprint:'bad'}; assert.throws(()=>confirmation.approve(p.confirmation.token,binding)); const real=x; const prepared=p; assert.equal(prepared.confirmation.required,true);})
test('read remains available',async()=>{const c=await setup(); await c.createOperation({id:'r',operationId:'r',name:'R',method:'GET',path:'/r',serviceTargetId:'t',parameters:[],policy:{allowAgentCall:true},kitIds:['k']}); const x=createApiKitHttpExecutor(c,{transport:{handlesResolution:true,request:()=>response}}); assert.equal((await x.execute({operationId:'r'},exec)).ok,true)})
