// Mock-only: actual frontend request helpers through the Vite proxy.
import assert from 'node:assert/strict';
import {createServer as createApi} from '../backend/src/server.js';
import {loadConfig} from '../backend/src/config.js';
import {createServer as createVite} from 'vite';
const api=createApi({config:loadConfig({DEBATE_MODE:'mock'}),fetchImpl:()=>{throw Error('Provider calls forbidden');}});
await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
process.env.API_PROXY_TARGET='http://127.0.0.1:'+api.address().port;process.env.VITE_API_MODE='live';
let vite;const nativeFetch=globalThis.fetch;
try{
 vite=await createVite({optimizeDeps:{noDiscovery:true,include:[]},server:{host:'127.0.0.1',port:0}});await vite.listen();
 const base='http://127.0.0.1:'+vite.httpServer.address().port;
 globalThis.fetch=(url,options)=>nativeFetch(typeof url==='string'&&url.startsWith('/')?base+url:url,options);
 const frontend=await vite.ssrLoadModule('/src/data.ts');assert.equal(frontend.isMock,false);
 const catalog=await frontend.getCatalog();assert.equal(catalog.mode,'mock');assert.equal(catalog.roles.length,5);
 for(const ids of [['zhang_xuefeng','du_sujuan'],['zhang_xuefeng','du_sujuan','career_realist'],['zhang_xuefeng','du_sujuan','career_realist','growth_explorer']]){
  const result=await frontend.generateDebate(catalog.topics[0].prompt,ids);assert.equal(result.mode,'mock');assert.equal(result.messages.length,ids.length*2);console.log('PASS frontend + proxy + mock backend: '+ids.length+' roles');
 }
 await assert.rejects(()=>frontend.generateDebate(catalog.topics[0].prompt,['zhang_xuefeng','lei_jun']),/2–4/);console.log('PASS missing persona rejected without fallback');
 for(const code of [400,429,500,502,504]){globalThis.fetch=async()=>Response.json({error:{code:'TEST_ERROR',message:'synthetic '+code}},{status:code});await assert.rejects(()=>frontend.generateDebate(catalog.topics[0].prompt,['zhang_xuefeng','du_sujuan']),new RegExp('synthetic '+code));}
 console.log('PASS frontend propagates 400/429/500/502/504 without fallback');
}finally{globalThis.fetch=nativeFetch;await vite?.close();await new Promise(resolve=>api.close(resolve));}
