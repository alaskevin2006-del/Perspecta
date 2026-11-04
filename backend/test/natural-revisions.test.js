import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync}from'node:fs';
import {createHash}from'node:crypto';
import {buildMessages,buildNaturalA2Messages}from'../src/prompt.js';
import {roles}from'../src/catalog.js';
import {generate}from'../src/model.js';
import {buildMessages as priorMessages}from'../../experiments/decision-ab/sources/A/backend/src/prompt.js';
const root=new URL('../../experiments/natural-revisions/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));
const selected=manifest.input.roleIds.map(id=>roles.find(r=>r.id===id));
test('default four-round generation exactly matches the real-tested B2 messages including bounded case scopes',()=>{
 const frozen=JSON.parse(readFileSync(new URL('request-B2.json',root),'utf8'));
 const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
 assert.equal(hash(buildMessages(manifest.input,selected)),hash(frozen.messages));
 const a=JSON.parse(readFileSync(new URL('request-A2.json',root),'utf8'));
 assert.equal(hash(buildNaturalA2Messages(manifest.input,selected)),hash(a.messages));
});
test('legacy two and three rounds keep their previous messages on unrelated topics',()=>{
 for(const rounds of [2,3])for(const topic of ['大学生该如何理解亲密关系里的自由和责任？','人工智能艺术作品的价值应该如何判断？']){
  const input={...manifest.input,topic,rounds};
  assert.deepEqual(buildMessages(input,selected),priorMessages(input,selected));
 }
});
test('production model adapter sends the frozen B2 request and accepts its original complete result',async()=>{
 const frozen=JSON.parse(readFileSync(new URL('request-B2.json',root),'utf8'));
 const raw=JSON.parse(readFileSync(new URL('results/B2/raw-content.txt',root),'utf8'));
 let calls=0;
 const output=await generate(manifest.input,buildMessages(manifest.input,selected),{
  provider:'deepseek',baseUrl:'https://api.deepseek.com',apiKey:'FAKE-ONLY',model:'deepseek-flash',maxOutputTokens:4500,maxResponseBytes:65536,
 },new AbortController().signal,async(url,options)=>{
  calls++;assert.equal(options.body,JSON.stringify(frozen));
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(raw)}}]});
 });
 assert.equal(calls,1);assert.deepEqual(output.messages,raw.messages);assert.deepEqual(output.summary,raw.summary);
});
