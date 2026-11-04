import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as httpServer } from 'node:http';
import { once } from 'node:events';
import { createServer } from '../src/server.js';
import { upstream, send, completion } from '../test-support/upstream.js';

const directory=new URL('../',import.meta.url);
const bounded=promise=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Child process timed out')),3000).unref())]);
async function listen(t,server){
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  return `http://127.0.0.1:${server.address().port}`;
}
function command(t,args,env){
  // Never inherit LLM_API_KEY, live configuration, or any other developer secrets.
  const child=spawn(process.execPath,args,{cwd:directory,env});
  t.after(()=>{if(child.exitCode===null)child.kill('SIGTERM');});
  let stdout='',stderr='';
  child.stdout.on('data',chunk=>{stdout+=chunk;});
  child.stderr.on('data',chunk=>{stderr+=chunk;});
  const result=once(child,'close').then(([code,signal])=>({code,signal,stdout,stderr}));
  return {child,result};
}

test('smoke CLI refuses live service without explicit opt-in and makes no model call',async t=>{
  const {config,calls}=await upstream(t,(_req,res)=>send(res,completion()));
  const base=await listen(t,createServer({config,logger:()=>{}}));
  const {result}=command(t,['scripts/smoke.mjs'],{API_BASE_URL:base});
  const value=await bounded(result);
  assert.equal(value.code,1);
  assert.match(value.stderr,/Pass --live explicitly/);
  assert.equal(calls.length,0);
});

test('opted-in smoke CLI validates complete HTTP adapter against local fake upstream',async t=>{
  const {config,calls}=await upstream(t,(_req,res)=>send(res,completion()));
  const base=await listen(t,createServer({config,logger:()=>{}}));
  const {result}=command(t,['scripts/smoke.mjs','--live'],{API_BASE_URL:base});
  const value=await bounded(result);
  assert.equal(value.code,0,value.stderr);
  assert.deepEqual(JSON.parse(value.stdout),{result:'PASS',mode:'live',endpoints:3,roles:7,topics:3,messages:6});
  assert.equal(calls.length,1);
});

test('standalone deployment entry starts in explicit mock mode and terminates on SIGTERM',async t=>{
  const reservation=httpServer();
  reservation.listen(0,'127.0.0.1');await once(reservation,'listening');
  const port=reservation.address().port;
  await new Promise(resolve=>reservation.close(resolve));
  const {child,result}=command(t,['src/server.js'],{DEBATE_MODE:'mock',HOST:'127.0.0.1',PORT:String(port)});
  await bounded(once(child.stdout,'data'));
  const response=await fetch(`http://127.0.0.1:${port}/api/roles`);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('x-perspecta-mode'),'mock');
  child.kill('SIGTERM');
  const value=await bounded(result);
  assert.equal(value.code,0,value.stderr);
  assert.equal(JSON.parse(value.stdout).mode,'mock');
});

test('health CLI checks live-mode catalogs without attempting generation',async t=>{
  const {config,calls}=await upstream(t,(_req,res)=>send(res,completion()));
  const base=await listen(t,createServer({config,logger:()=>{}}));
  const {result}=command(t,['scripts/health.mjs'],{API_BASE_URL:base});
  const value=await bounded(result);
  assert.equal(value.code,0,value.stderr);
  assert.deepEqual(JSON.parse(value.stdout),{result:'PASS',mode:'live',roles:7,topics:3,generationRequests:0,providerConnectivityTested:false});
  assert.equal(calls.length,0);
});

test('health CLI rejects malformed successful catalog responses without printing their bodies',async t=>{
  const base=await listen(t,httpServer((_req,res)=>{res.writeHead(200,{'Content-Type':'application/json','X-Perspecta-Mode':'mock'});res.end(JSON.stringify({roles:'synthetic-private-body'}));}));
  const {result}=command(t,['scripts/health.mjs'],{API_BASE_URL:base});
  const value=await bounded(result);
  assert.equal(value.code,1);
  assert.equal(JSON.parse(value.stdout).code,'HEALTH_CONTRACT_ERROR');
  assert.ok(![value.stdout,value.stderr].join().includes('synthetic-private-body'));
});

test('health CLI refuses credentials in target URLs without echoing the URL',async t=>{
  const {result}=command(t,['scripts/health.mjs'],{API_BASE_URL:'https://user:synthetic-private-target@example.invalid'});
  const value=await bounded(result);
  assert.equal(value.code,1);
  assert.equal(JSON.parse(value.stdout).code,'INVALID_HEALTH_TARGET');
  assert.ok(![value.stdout,value.stderr].join().includes('synthetic-private-target'));
});

test('health CLI cancels an invalid streaming response instead of holding its socket open',async t=>{
  const base=await listen(t,httpServer((_req,res)=>{res.writeHead(200,{'Content-Type':'application/json','X-Perspecta-Mode':'mock'});res.write('{');}));
  const {result}=command(t,['scripts/health.mjs'],{API_BASE_URL:base});
  const value=await bounded(result);
  assert.equal(value.code,1);
  assert.equal(JSON.parse(value.stdout).code,'HEALTH_CONTRACT_ERROR');
});


test('health stays successful when generation quota is exhausted and does not reset or consume it',async t=>{
  const {config,calls}=await upstream(t,(_req,res)=>send(res,completion()));
  config.sessionCallLimit=1;
  const base=await listen(t,createServer({config,logger:()=>{}}));
  const body=JSON.stringify({topic:'大学阶段时间有限，应该优先投入绩点还是项目实践？',roleIds:['career_realist','growth_explorer','risk_analyst']});
  assert.equal((await fetch(`${base}/api/debate`,{method:'POST',body})).status,200);
  const {result}=command(t,['scripts/health.mjs'],{API_BASE_URL:base});
  const value=await bounded(result);
  assert.equal(value.code,0,value.stderr);
  assert.equal(JSON.parse(value.stdout).generationRequests,0);
  assert.equal((await fetch(`${base}/api/debate`,{method:'POST',body})).status,429);
  assert.equal(calls.length,1);
});
