import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildRequest} from './builders.mjs';
import {runOnce} from './runner.mjs';
import {fixtureA,fixtureB} from './support.mjs';
const key='fake-key-used-in-test';
const sha=v=>createHash('sha256').update(v).digest('hex');
function options(variant='A'){const request=buildRequest(variant);return {variant,request,metadata:{requestSHA256:sha(JSON.stringify(request))},reportDir:mkdtempSync('/tmp/perspecta-ab-test-'),apiKey:key};}
const completion=value=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}],usage:{prompt_tokens:100,completion_tokens:50,total_tokens:150,prompt_cache_hit_tokens:0,prompt_cache_miss_tokens:100}});
for(const variant of ['A','B'])test(`${variant} dispatches exactly once and persists no key`,async()=>{
 const o=options(variant);let calls=0;
 try{const r=await runOnce({...o,fetchImpl:async(url,init)=>{calls++;assert.equal(url,'https://api.deepseek.com/chat/completions');assert.equal(init.redirect,'error');assert.equal(JSON.parse(init.body).max_tokens,4500);return completion(variant==='A'?fixtureA():fixtureB());}});assert.equal(r.outcome,'VALID');assert.equal(calls,1);await assert.rejects(()=>runOnce({...o,fetchImpl:async()=>{calls++;return completion(fixtureA());}}),/ATTEMPT_ALREADY_USED/);assert.equal(calls,1);assert.ok(!readFileSync(o.reportDir+'/report.json','utf8').includes(key));assert.equal(r.usage.inputTokens,100);}finally{rmSync(o.reportDir,{recursive:true,force:true});}
});
test('network failure is one attempt without automatic retry or raw error disclosure',async()=>{const o=options();let calls=0;try{const r=await runOnce({...o,fetchImpl:async()=>{calls++;throw Error(key);}});assert.equal(r.outcome,'NETWORK_OR_TIMEOUT');assert.equal(calls,1);assert.ok(!readFileSync(o.reportDir+'/report.json','utf8').includes(key));}finally{rmSync(o.reportDir,{recursive:true,force:true});}});
test('invalid model output preserves original text and safe known usage',async()=>{const o=options();try{const r=await runOnce({...o,fetchImpl:async()=>completion({messages:[],summary:{}})});assert.equal(r.outcome,'INVALID_OUTPUT');assert.equal(r.usage.outputTokens,50);assert.equal(readFileSync(o.reportDir+'/raw-content.txt','utf8'),JSON.stringify({messages:[],summary:{}}));}finally{rmSync(o.reportDir,{recursive:true,force:true});}});
test('oversized response is bounded and not retried',async()=>{const o=options();let calls=0;try{const r=await runOnce({...o,fetchImpl:async()=>{calls++;return new Response('x'.repeat(65537));}});assert.equal(r.outcome,'INVALID_UPSTREAM_JSON');assert.equal(calls,1);}finally{rmSync(o.reportDir,{recursive:true,force:true});}});
test('changed frozen request cannot dispatch',async()=>{const o=options();o.request.max_tokens=8000;let calls=0;try{await assert.rejects(()=>runOnce({...o,fetchImpl:async()=>{calls++;return completion(fixtureA());}}),/REQUEST_CHANGED|CONTROL_CHANGED/);assert.equal(calls,0);}finally{rmSync(o.reportDir,{recursive:true,force:true});}});
test('conflicting direct and nested cache counts preserve usage but fail accounting',async()=>{const o=options();try{const r=await runOnce({...o,fetchImpl:async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(fixtureA())}}],usage:{prompt_tokens:100,completion_tokens:50,total_tokens:150,prompt_cache_hit_tokens:0,prompt_cache_miss_tokens:100,prompt_tokens_details:{cached_tokens:50}}})});assert.equal(r.outcome,'INVALID_ACCOUNTING');assert.equal(r.usage.inputTokens,100);}finally{rmSync(o.reportDir,{recursive:true,force:true});}});
