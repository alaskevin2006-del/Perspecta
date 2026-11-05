import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuards} from '../src/guards.js';
import {loadConfig} from '../src/config.js';
import {errorResponse} from '../src/errors.js';
import {createApp} from '../src/app.js';
import {upstream,send,completion,debateRequest,roleIds} from '../test-support/upstream.js';

const config = extra => ({...loadConfig({}),sessionTokenBudget:100,sessionCallLimit:2,budgetWindowMs:3600000,...extra});
test('local token cap recovers at its configured window without restarting',async()=>{
 let time=0;const guards=createGuards(config(),()=>time);
 guards.acquire('a','1',80)(70);
 let blocked;try{guards.acquire('a','2',40);}catch(e){blocked=e;}
 assert.equal(blocked.guardReason,'SESSION_TOKEN_BUDGET');
 const response=errorResponse(blocked);assert.equal(response.headers.get('retry-after'),'3600');
 assert.match((await response.json()).error.message,/本站.*自动恢复.*不表示模型账户余额不足/);
 time=3599999;assert.throws(()=>guards.acquire('a','2',40));
 time=3600000;guards.acquire('a','2',40)(30);
});
test('pending requests carry across multiple budget windows and settle exactly once',()=>{
 let time=0;const guards=createGuards(config(),()=>time);
 const release=guards.acquire('a','1',80);
 for(time of [3600000,7200000])assert.throws(()=>guards.acquire('b','2',30),e=>e.guardReason==='SESSION_TOKEN_BUDGET');
 release(20);release(0);
 guards.acquire('b','2',80)();
 assert.throws(()=>guards.acquire('b','3',1));
});
test('unknown failed usage remains reserved until the next window and call caps renew',()=>{
 let time=0;const guards=createGuards(config({sessionCallLimit:1}),()=>time);
 guards.acquire('a','1',80)();
 assert.throws(()=>guards.acquire('b','2',1),e=>e.guardReason==='SESSION_CALL_LIMIT');
 time=3600000;guards.acquire('b','2',80)();
});
test('legacy lifetime caps require administrator action and do not promise a retry in 60 seconds',async()=>{
 const guards=createGuards(config({budgetWindowMs:0}));guards.acquire('a','1',100)();
 let error;try{guards.acquire('b','2',1);}catch(e){error=e;}
 const r=errorResponse(error);assert.equal(r.headers.get('retry-after'),null);
 assert.match((await r.json()).error.message,/联系管理员/);
});
test('short custom questions reach the model unchanged, including the reported nine-character question',async t=>{
 const {config,calls}=await upstream(t,(_req,res)=>send(res,completion()));
 const app=createApp({config,logger:()=>{}});
 for(const topic of ['学计算机还是学土木','就业','😀😀']){
  const r=await app.handle(debateRequest({topic,roleIds}));assert.equal(r.status,200);
  assert.equal((await r.json()).topic,topic);
  assert.equal(JSON.parse(calls.at(-1).body.messages[1].content).topic,topic);
 }
});
test('rejections identify a local guard without logging input or contacting the provider',async()=>{
 const events=[];const app=createApp({config:{...loadConfig({DEBATE_MODE:'live',LLM_API_KEY:'FAKE',LLM_MODEL:'fake'}),sessionTokenBudget:1,budgetWindowMs:3600000},logger:e=>events.push(e),fetchImpl:()=>{throw Error('Provider forbidden');}});
 assert.equal((await app.handle(debateRequest())).status,429);
 assert.deepEqual(Object.keys(events[0]).sort(),['code','event','reason','retryAfter']);
 assert.equal(events[0].reason,'SESSION_TOKEN_BUDGET');
});
test('budget window accepts explicit lifetime and hourly modes and rejects unsafe small or large windows',()=>{
 assert.equal(loadConfig({SESSION_BUDGET_WINDOW_MS:'0'}).budgetWindowMs,0);
 assert.equal(loadConfig({SESSION_BUDGET_WINDOW_MS:'3600000'}).budgetWindowMs,3600000);
 for(const v of ['1','-1','86400001','bad'])assert.throws(()=>loadConfig({SESSION_BUDGET_WINDOW_MS:v}));
});
