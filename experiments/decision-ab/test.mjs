import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {loadFrozen,input,params,limits,sha} from './prepare.mjs';
import {runOnce} from './runner.mjs';
import {validateVariant} from './protocol.mjs';
import {mockDebate} from '../../backend/src/mock.js';
const fixture=()=>{const {messages,summary}=mockDebate(input);return {messages,summary};};
const fake=(value,usage={prompt_tokens:100,completion_tokens:200})=>async()=>new Response(JSON.stringify({model:'deepseek-flash',usage,choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]}),{status:200});
const dir=()=>mkdtempSync(join(tmpdir(),'perspecta-decision-fake-'));
const args=v=>({variant:v,...loadFrozen(v),apiKey:'FAKE-KEY-NO-REAL-CALL',fakeOnly:true});
test('frozen requests match exact repository versions, share all provider controls and reply graph',()=>{
 const a=loadFrozen('A'),b=loadFrozen('B');
 for(const v of ['A','B']){const f=loadFrozen(v);for(const [path,hash]of Object.entries(f.metadata.sourceHashes).filter(([path])=>path.startsWith('backend/')))assert.equal(sha(execFileSync('git',['show',`${f.metadata.sourceCommit}:${path}`])),hash);const {messages,...controls}=f.request;assert.deepEqual(controls,params);assert.ok(Buffer.byteLength(JSON.stringify(f.request))<limits.maxInputBytes);}
 const au=JSON.parse(a.request.messages[1].content),bu=JSON.parse(b.request.messages[1].content);assert.deepEqual(au.turnPlan,bu.turnPlan);assert.equal(au.topic,bu.topic);assert.equal(au.topic,input.topic);assert.equal(au.roles[0].id,bu.roles[0].id);assert.equal(au.roles.length,4);assert.equal(au.rounds,4);assert.ok(!('temperature'in a.request)&&!('top_p'in a.request));
 for(const id of ['zhang_xuefeng','du_sujuan']){assert.equal(bu.roles.find(r=>r.id===id).decisionCases.length,2);assert.equal(typeof au.roles.find(r=>r.id===id).supportedPositions[0],'object');assert.equal(typeof bu.roles.find(r=>r.id===id).supportedPositions[0],'string');}
});
test('both variants accept same frozen mock plan, reject summary overflow and preserve failure output and usage',async()=>{
 for(const variant of ['A','B']){
  assert.doesNotThrow(()=>validateVariant(fixture(),variant));const body=fixture();body.summary.decisionFactors=['一','二','三','四'];const reportDir=dir();const r=await runOnce({...args(variant),reportDir,fetchImpl:fake(body)});assert.equal(r.outcome,'INVALID_OUTPUT');assert.deepEqual(r.usage,{inputTokens:100,outputTokens:200});assert.equal(readFileSync(reportDir+'/raw-content.txt','utf8'),JSON.stringify(body));assert.ok(!existsSync(reportDir+'/mapped-output.json'));
 }
});
test('persistent lock forbids repeated dispatch including upstream errors',async()=>{
 let calls=0;const reportDir=dir(),a={...args('A'),reportDir,fetchImpl:async()=>{calls++;return new Response('',{status:402});}};const r=await runOnce(a);assert.equal(r.upstreamStatus,402);assert.equal(r.outcome,'UPSTREAM_HTTP_ERROR');await assert.rejects(runOnce(a),/ATTEMPT_ALREADY_USED/);assert.equal(calls,1);
});
test('successful fake request records model and validated text; invalid usage never becomes valid',async()=>{
 const r=await runOnce({...args('B'),reportDir:dir(),fetchImpl:fake(fixture())});assert.equal(r.outcome,'VALID');assert.equal(r.responseModel,'deepseek-flash');
 const invalid=await runOnce({...args('A'),reportDir:dir(),fetchImpl:fake(fixture(),{prompt_tokens:100,completion_tokens:200,total_tokens:1})});assert.equal(invalid.outcome,'INVALID_ACCOUNTING');
});
test('hash mutation and missing key fail before lock and dispatch',async()=>{
 const a=args('A');a.request.max_tokens=9000;let calls=0;await assert.rejects(runOnce({...a,reportDir:dir(),fetchImpl:async()=>{calls++;}}),/REQUEST_CHANGED/);assert.equal(calls,0);await assert.rejects(runOnce({...args('B'),apiKey:'',reportDir:dir(),fetchImpl:fake(fixture())}),/KEY_REQUIRED/);
});
