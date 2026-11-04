// Mock-only: actual frontend request helpers through the Vite proxy.
import assert from 'node:assert/strict';
import {createServer as createApi} from '../backend/src/server.js';
import {loadConfig} from '../backend/src/config.js';
import {createServer as createVite} from 'vite';
const api=createApi({config:loadConfig({DEBATE_MODE:'mock',CLIENT_REQUESTS_PER_MINUTE:'20'}),fetchImpl:()=>{throw Error('Provider calls forbidden');}});
await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
process.env.API_PROXY_TARGET='http://127.0.0.1:'+api.address().port;process.env.VITE_API_MODE='live';
let vite;const nativeFetch=globalThis.fetch;
try{
 vite=await createVite({optimizeDeps:{noDiscovery:true,include:[]},server:{host:'127.0.0.1',port:0}});await vite.listen();
 const base='http://127.0.0.1:'+vite.httpServer.address().port;
 globalThis.fetch=(url,options)=>nativeFetch(typeof url==='string'&&url.startsWith('/')?base+url:url,options);
 const frontend=await vite.ssrLoadModule('/src/data.ts');assert.equal(frontend.isMock,false);
 const catalog=await frontend.getCatalog();assert.equal(catalog.mode,'mock');assert.equal(catalog.roles.length,7);
 for(const ids of [['zhang_xuefeng','du_sujuan'],['zhang_xuefeng','du_sujuan','career_realist'],['zhang_xuefeng','du_sujuan','career_realist','growth_explorer'],['lei_jun','wang_defeng'],['lei_jun','wang_defeng','du_sujuan'],['zhang_xuefeng','lei_jun','wang_defeng','du_sujuan']]){
  const result=await frontend.generateDebate(catalog.topics[0].prompt,ids);assert.equal(result.mode,'mock');assert.equal(result.messages.length,ids.length*2);console.log('PASS frontend + proxy + mock backend: '+ids.length+' roles');
 }
 await assert.rejects(()=>frontend.generateDebate(catalog.topics[0].prompt,['zhang_xuefeng','unknown_role']),/2–4/);console.log('PASS unknown persona rejected without fallback');
 for(const code of [400,429,500,502,504]){globalThis.fetch=async()=>Response.json({error:{code:'TEST_ERROR',message:'synthetic '+code}},{status:code});await assert.rejects(()=>frontend.generateDebate(catalog.topics[0].prompt,['zhang_xuefeng','du_sujuan']),new RegExp('synthetic '+code));}
 console.log('PASS frontend propagates 400/429/500/502/504 without fallback');
 for(const [response,message] of [
  [()=>new Response('<html>synthetic gateway failure</html>',{status:502}), '服务暂时不可用，请重试'],
  [()=>new Response('',{status:500}), '服务暂时不可用，请重试'],
  [()=>Response.json(null,{status:503}), '服务暂时不可用，请重试'],
  [()=>Response.json({error:{message:123}},{status:400}), '服务暂时不可用，请重试'],
  [()=>new Response('<html>synthetic success shell</html>',{status:200}), '服务返回格式异常，请重试'],
 ]){
  let attempts=0;globalThis.fetch=async()=>{attempts++;return response();};
  await assert.rejects(()=>frontend.generateDebate(catalog.topics[0].prompt,['zhang_xuefeng','du_sujuan']),error=>error.message===message);
  assert.equal(attempts,1);
 }
 globalThis.fetch=async()=>{throw new TypeError('synthetic private transport detail');};
 await assert.rejects(()=>frontend.generateDebate(catalog.topics[0].prompt,['zhang_xuefeng','du_sujuan']),error=>error.message==='服务暂时无法连接，请稍后重试');
 globalThis.fetch=async()=>{throw new DOMException('synthetic abort','AbortError');};
 await assert.rejects(()=>frontend.generateDebate(catalog.topics[0].prompt,['zhang_xuefeng','du_sujuan']),error=>error.message==='讨论生成超时，请重试');
 console.log('PASS malformed/empty errors, invalid successful JSON and transport failures stay safe, with no retry');

}finally{globalThis.fetch=nativeFetch;await vite?.close();await new Promise(resolve=>api.close(resolve));}
