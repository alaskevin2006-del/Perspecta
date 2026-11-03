import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { upstream, send, completion, debateRequest, topic, roleIds } from '../test-support/upstream.js';

test('budget refuses a call before reaching provider', async t => {
  const {config, calls} = await upstream(t, (_req, res) => send(res, completion()));
  config.sessionTokenBudget=1;
  const response = await createApp({config, logger:()=>{}}).handle(debateRequest());
  assert.equal(response.status, 429);
  assert.equal(calls.length, 0);
});

test('rate controls bound repeated requests and permit a new time window', async t => {
  const {config, calls} = await upstream(t, (_req, res) => send(res, completion()));
  config.clientRate=1;
  let now=0;
  const app = createApp({config, logger:()=>{}, now:()=>now});
  assert.equal((await app.handle(debateRequest(), {clientId:'a'})).status, 200);
  const blocked=await app.handle(debateRequest(), {clientId:'a'});
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '60');
  now=60001;
  assert.equal((await app.handle(debateRequest(), {clientId:'a'})).status, 200);
  assert.equal(calls.length, 2);
});

test('in-flight duplicates and concurrency are rejected, slots release on timeout', async t => {
  let received;
  const ready = new Promise(resolve => {received=resolve;});
  const {config, calls} = await upstream(t, () => {received();});
  config.maxConcurrent=1; config.timeoutMs=80;
  const app = createApp({config, logger:()=>{}});
  const first = app.handle(debateRequest(), {clientId:'a'});
  await Promise.race([ready, new Promise((_, reject) => setTimeout(() => reject(new Error('upstream request not dispatched')), 1000).unref())]);
  assert.equal((await app.handle(debateRequest(), {clientId:'b'})).status, 429);
  assert.equal((await app.handle(debateRequest({topic:topic+'请比较条件', roleIds}), {clientId:'b'})).status, 429);
  assert.equal((await first).status, 504);
  assert.equal((await app.handle(debateRequest())).status, 504);
  assert.equal(calls.length, 2);
});

test('failed calls retain budget reservations and cannot be repeated indefinitely', async t => {
  const {config,calls}=await upstream(t, (_req,res)=>send(res,{error:'unavailable'},500));
  config.sessionTokenBudget=16000;
  config.maxOutputTokens=8000;
  const app=createApp({config,logger:()=>{}});
  assert.equal((await app.handle(debateRequest())).status,500);
  assert.equal((await app.handle(debateRequest())).status,429);
  assert.equal(calls.length,1);
});

test('global and session call caps apply even to different client identities', async t => {
  const {config,calls}=await upstream(t, (_req,res)=>send(res,completion()));
  config.globalRate=1;
  let now=0;
  const app=createApp({config,logger:()=>{},now:()=>now});
  assert.equal((await app.handle(debateRequest(),{clientId:'a'})).status,200);
  assert.equal((await app.handle(debateRequest(),{clientId:'b'})).status,429);
  now=60001;
  assert.equal((await app.handle(debateRequest(),{clientId:'b'})).status,200);
  const capped=createApp({config:{...config,globalRate:100,sessionCallLimit:1},logger:()=>{}});
  assert.equal((await capped.handle(debateRequest())).status,200);
  assert.equal((await capped.handle(debateRequest(),{clientId:'new'})).status,429);
  assert.equal(calls.length,3);
});

test('client buckets refuse new identities at capacity and expire without unbounded growth',async()=>{
  let now=0;
  const config={...loadConfig({}),maxClients:1,clientRate:100,globalRate:100};
  const app=createApp({config,now:()=>now,fetchImpl:()=>{throw new Error('Provider forbidden');}});
  assert.equal((await app.handle(debateRequest(),{clientId:'first'})).status,200);
  assert.equal((await app.handle(debateRequest(),{clientId:'second'})).status,429);
  now=60001;
  assert.equal((await app.handle(debateRequest(),{clientId:'second'})).status,200);
});

test('rejected model output releases capacity for an explicit later request',async t=>{
  const {config,calls}=await upstream(t,(_req,res,all)=>{
    const value=completion();if(all.length===1)value.choices[0].message.content='{}';send(res,value);
  });
  config.maxConcurrent=1;
  const app=createApp({config,logger:()=>{}});
  assert.equal((await app.handle(debateRequest())).status,502);
  assert.equal((await app.handle(debateRequest())).status,200);
  assert.equal(calls.length,2);
});
