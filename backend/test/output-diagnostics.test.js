import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';
import {completion, core, debateRequest} from '../test-support/upstream.js';
import {mockDebate} from '../src/mock.js';
const secret='PRIVATE_SENTINEL_NEVER_LOG';
const cases=[
 ['truncation',r=>{r.choices[0].finish_reason='length';},'OUTPUT_TRUNCATED','choices[0].finish_reason'],
 ['parse',r=>{r.choices[0].message.content=secret;},'CONTENT_JSON_INVALID','choices[0].message.content'],
 ['root keys',r=>{const v=core();v[secret]=secret;r.choices[0].message.content=JSON.stringify(v);},'OUTPUT_STRUCTURE','$'],
 ['summary count',r=>{const v=core();v.summary.decisionFactors=[secret,secret,secret,secret];r.choices[0].message.content=JSON.stringify(v);},'SUMMARY_COUNT','summary.decisionFactors'],
 ['reference',r=>{const v=core();v.messages[3].replyTo=secret;r.choices[0].message.content=JSON.stringify(v);},'REFERENCE_INVALID','messages[3].replyTo'],
 ['refusal',r=>{r.choices[0].message.refusal=secret;},'OUTPUT_REFUSED','choices[0].message.refusal'],
 ['usage',r=>{r.usage.prompt_tokens=secret;},'USAGE_INVALID','usage'],
];
for(const [name,change,reason,path] of cases)test(`safe log distinguishes ${name} without changing public error or retrying`,async()=>{
 const raw=completion();change(raw);const logs=[];let calls=0;
 const config={...loadConfig({}),mode:'live',apiKey:secret,model:'test',sessionTokenBudget:1000000};
 const app=createApp({config,logger:e=>logs.push(e),fetchImpl:async()=>{calls++;return Response.json(raw);}});
 const response=await app.handle(debateRequest());
 assert.equal(response.status,502);assert.deepEqual(await response.json(),{error:{code:'INVALID_MODEL_OUTPUT',message:'讨论结果格式不符合要求，请重试'}});
 assert.equal(calls,1);assert.equal(logs.length,1);
 assert.deepEqual(logs[0].outputDiagnostic,{reason,path});
 assert.equal(logs[0].upstreamStatus,200);assert.ok(!JSON.stringify(logs).includes(secret));
});
for(const rounds of [2,3,4])test(`summary diagnostics cover ${rounds}-round mode`,async()=>{
 const ids=['zhang_xuefeng','lei_jun','wang_defeng','du_sujuan'];
 const data=mockDebate({topic:'测试讨论的固定公开主题内容',roleIds:ids,rounds});
 const value={messages:data.messages,summary:data.summary};value.summary.consensus=[];
 let event;
 const app=createApp({config:{...loadConfig({}),mode:'live',apiKey:secret,model:'test'},logger:e=>event=e,fetchImpl:async()=>Response.json(completion(value))});
 assert.equal((await app.handle(debateRequest({topic:'测试讨论的固定公开主题内容',roleIds:ids,rounds}))).status,502);
 assert.deepEqual(event.outputDiagnostic,{reason:'SUMMARY_COUNT',path:'summary.consensus'});
});

test('unknown diagnostic values cannot inject data into logs or public errors',async()=>{
 const {invalidModelOutput,errorResponse}=await import('../src/errors.js');
 const error=invalidModelOutput(secret,`summary.${secret}`);
 assert.deepEqual(error.outputDiagnostic,{reason:'OUTPUT_STRUCTURE',path:'$'});
 assert.ok(!JSON.stringify(await errorResponse(error).json()).includes(secret));
 assert.ok(Object.isFrozen(error.outputDiagnostic));
});
test('malformed upstream envelope is classified without logging its text',async()=>{
 let event;let calls=0;
 const app=createApp({config:{...loadConfig({}),mode:'live',apiKey:secret,model:'test'},logger:e=>event=e,
  fetchImpl:async()=>{calls++;return new Response(secret);}});
 assert.equal((await app.handle(debateRequest())).status,502);
 assert.deepEqual(event.outputDiagnostic,{reason:'UPSTREAM_JSON_INVALID',path:'$'});
 assert.equal(calls,1);assert.ok(!JSON.stringify(event).includes(secret));
});
test('four-stage literal quote mismatch reports only the field path',async()=>{
 const ids=['zhang_xuefeng','lei_jun','wang_defeng','du_sujuan'];
 const result=mockDebate({topic:'测试讨论的固定公开主题内容',roleIds:ids,rounds:4});
 result.messages[4].content=`你说“${secret}”，这个事实需要核查。`;
 let event;const app=createApp({config:{...loadConfig({}),mode:'live',apiKey:secret,model:'test'},logger:e=>event=e,
  fetchImpl:async()=>Response.json(completion({messages:result.messages,summary:result.summary}))});
 assert.equal((await app.handle(debateRequest({topic:'测试讨论的固定公开主题内容',roleIds:ids,rounds:4}))).status,502);
 assert.deepEqual(event.outputDiagnostic,{reason:'QUOTE_MISMATCH',path:'messages[4].content'});
 assert.ok(!JSON.stringify(event).includes(secret));
});
