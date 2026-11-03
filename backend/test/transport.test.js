import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as httpServer, request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { createServer } from '../src/server.js';
import { loadConfig } from '../src/config.js';
import { upstream, send, completion, topic, roleIds } from '../test-support/upstream.js';

const deadline = (promise, label) => Promise.race([promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(label)), 1500).unref()),
]);
async function listen(t, server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => {server.close(resolve); server.closeAllConnections();}));
  return `http://127.0.0.1:${server.address().port}`;
}
function proxy(target) {
  return httpServer((req, res) => {
    if (!req.url.startsWith('/api/')) {res.end('frontend proxy test harness'); return;}
    const outgoing = httpRequest(`${target}${req.url}`, {method:req.method, headers:req.headers}, incoming => {
      res.writeHead(incoming.statusCode, incoming.headers);
      incoming.pipe(res);
    });
    outgoing.on('error', () => {if (!res.destroyed) {res.writeHead(502); res.end();}});
    res.on('close', () => outgoing.destroy());
    req.pipe(outgoing);
  });
}
const post = (base, extraHeaders = {}) => fetch(`${base}/api/debate`, {
  method:'POST', headers:{'Content-Type':'application/json', ...extraHeaders}, body:JSON.stringify({topic, roleIds}),
});

test('same-origin proxy preserves all three routes, locked envelope and model request', async t => {
  const {config,calls} = await upstream(t, (_req,res) => send(res, completion()));
  const target = await listen(t, createServer({config,logger:()=>{}}));
  const base = await listen(t, proxy(target));
  for (const route of ['roles','topics']) {
    const response = await fetch(`${base}/api/${route}`);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('x-perspecta-mode'),'live');
    assert.equal((await response.json())[route].length,3);
  }
  const response = await post(base);
  assert.equal(response.status,200);
  const result=await response.json();
  assert.deepEqual(Object.keys(result).sort(),['discussionId','messages','summary','topic','usage']);
  assert.equal(result.messages.length,6);
  assert.deepEqual(result.usage,{inputTokens:120,outputTokens:300});
  assert.equal(calls.length,1);
  assert.equal(calls[0].path,'/v1/chat/completions');
  assert.deepEqual(JSON.parse(calls[0].body.messages[1].content).roles.map(r=>r.id),roleIds);
  const invalid=await fetch(`${base}/api/debate`,{method:'POST',body:JSON.stringify({topic:'短',roleIds})});
  assert.equal(invalid.status,400);
  assert.equal((await invalid.json()).error.code,'INVALID_INPUT');
  assert.equal(calls.length,1);
});

test('actual HTTP client disconnect aborts upstream and releases active capacity', async t => {
  let arrived, closed, logged;
  const received=new Promise(resolve=>{arrived=resolve;});
  const cancelled=new Promise(resolve=>{closed=resolve;});
  const completed=new Promise(resolve=>{logged=resolve;});
  const {config,calls}=await upstream(t, (_req,res,all)=>{
    if(all.length===1){res.on('close',closed);arrived();}
    else send(res,completion());
  });
  config.maxConcurrent=1; config.timeoutMs=5000;
  const base=await listen(t,createServer({config,logger:logged}));
  const client=httpRequest(`${base}/api/debate`,{method:'POST',headers:{'Content-Type':'application/json'}});
  client.on('error',()=>{});
  client.end(JSON.stringify({topic,roleIds}));
  await deadline(received,'provider did not receive request');
  client.destroy();
  await deadline(cancelled,'disconnect did not cancel upstream');
  const event=await deadline(completed,'cancelled generation did not release');
  assert.equal(event.outcome,'MODEL_TIMEOUT');
  assert.equal((await post(base)).status,200);
  assert.equal(calls.length,2);
});

test('forwarded headers cannot evade socket-based rate limit',async t=>{
  const config={...loadConfig({}),clientRate:1};
  const base=await listen(t,createServer({config,fetchImpl:()=>{throw new Error('Provider forbidden');}}));
  assert.equal((await post(base,{'X-Forwarded-For':'198.51.100.1'})).status,200);
  const blocked=await post(base,{'X-Forwarded-For':'198.51.100.2','X-Real-IP':'198.51.100.3'});
  assert.equal(blocked.status,429);
  assert.equal((await blocked.json()).error.code,'RATE_LIMITED');
});

test('chunked oversized body returns locked JSON error over HTTP',async t=>{
  const base=await listen(t,createServer({config:loadConfig({}),fetchImpl:()=>{throw new Error('Provider forbidden');}}));
  const underLimit=await fetch(`${base}/api/debate`,{method:'POST',body:JSON.stringify({topic,roleIds,padding:'x'.repeat(100)})});
  assert.equal(underLimit.status,200);
  // Otherwise-valid JSON proves rejection comes from size, not the parser.
  const body=JSON.stringify({topic,roleIds,padding:'x'.repeat(10000)});
  const response = new Promise((resolve,reject)=>{
    const client=httpRequest(`${base}/api/debate`,{method:'POST',headers:{'Content-Type':'application/json'}},res=>{
      let body='';res.on('data',chunk=>{body+=chunk;});res.on('end',()=>resolve({status:res.statusCode,body}));
    });
    client.on('error',reject);
    client.write(body.slice(0,5000));client.write(body.slice(5000));client.end();
  });
  const result=await deadline(response,'oversized HTTP body did not terminate');
  assert.equal(result.status,400);
  assert.equal(JSON.parse(result.body).error.code,'INVALID_INPUT');
});
