import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateInput,validateOutput} from '../src/validation.js';
import {roles} from '../src/catalog.js';
import {mockDebate} from '../src/mock.js';
import {buildMessages} from '../src/prompt.js';
import {loadConfig} from '../src/config.js';
import {createApp} from '../src/app.js';
import {completion,topic} from '../test-support/upstream.js';
const all=['zhang_xuefeng','lei_jun','wang_defeng','du_sujuan'];
const rows={2:[[0,1,null],[1,1,null],[0,2,2],[1,2,1],[0,3,4],[1,3,3],[0,4,6],[1,4,5]],3:[[0,1,null],[1,1,null],[2,1,null],[0,2,3],[1,2,1],[2,2,2],[0,3,5],[1,3,6],[2,3,4],[0,4,9],[1,4,7],[2,4,8]],4:[[0,1,null],[1,1,null],[2,1,null],[3,1,null],[0,2,4],[3,2,5],[2,2,2],[1,2,7],[0,3,6],[3,3,9],[2,3,8],[1,3,11],[0,4,12],[1,4,10],[2,4,9],[3,4,11]]};
function fixture(ids){return {messages:rows[ids.length].map(([i,round,target],k)=>({id:`m${k+1}`,round,roleId:ids[i],content:`明确论点${k+1}：应在必要条件核实后比较投入；判断依据应包括实际任务和可承受代价，而不是只按单一指标排序。`,replyTo:target?`m${target}`:null})),summary:{consensus:['必要条件要核查。'],disagreements:['何时扩大探索仍有不同判断。'],decisionFactors:['目标与资源。'],nextActions:['若必要条件未满足则先补足，再比较小规模尝试。']}};}
const post=body=>new Request('http://localhost/api/debate',{method:'POST',body:JSON.stringify(body)});
test('optional rounds selects four stages while old requests remain two',()=>{
 assert.equal(validateInput({topic,roleIds:all,rounds:4},roles).rounds,4);
 assert.equal(validateInput({topic,roleIds:all},roles).rounds,2);
 for(const rounds of [null,0,1,5,'4',true,[],{}])assert.throws(()=>validateInput({topic,roleIds:all,rounds},roles));
});
for(const n of [2,3,4])test(`four stages balance ${n} roles and revisit earlier arguments in ${n*4} turns`,()=>{
 const ids=all.slice(0,n);const valid=fixture(ids);
 assert.doesNotThrow(()=>validateOutput(valid,ids,{rounds:4}));
 const result=mockDebate({topic,roleIds:ids,rounds:4});assert.equal(result.messages.length,n*4);
 assert.doesNotThrow(()=>validateOutput({messages:result.messages,summary:result.summary},ids,{rounds:4}));
 for(const m of result.messages.filter(m=>m.replyTo))assert.notEqual(m.roleId,result.messages.find(p=>p.id===m.replyTo).roleId);
 if(n>2)for(const id of ids){const targets=result.messages.filter(m=>m.roleId===id&&m.replyTo).map(m=>result.messages.find(x=>x.id===m.replyTo).roleId);assert.ok(new Set(targets).size>=2);}
});
const mutations={
 'missing final turn':v=>v.messages.pop(),
 'unknown role':v=>{v.messages[2].roleId='unknown';},
 'repeated ID':v=>{v.messages[2].id=v.messages[0].id;},
 'missing stage':v=>{v.messages[12].round=3;},
 'stage role duplicated':v=>{v.messages[2].roleId=v.messages[0].roleId;},
 'first refers to later turn':v=>{v.messages[0].replyTo='m2';},
 'missing third-stage callback':v=>{v.messages[8].replyTo='m7';},
 'future reference':v=>{v.messages[6].replyTo='m8';},
 'missing ongoing reply':v=>{v.messages[4].replyTo=null;},
 'same speaker across stage boundary':v=>{[v.messages[4].roleId,v.messages[5].roleId]=[v.messages[5].roleId,v.messages[4].roleId];},
 'narrator-style hypothetical wording':v=>{v.messages[4].content='我会先问：目标是什么？然后再来讨论。';},
 'wrong explicitly attributed quote':v=>{v.messages[4].content='回应杜老师“第一段根本没有出现的错误引语”：这里需要另一种判断。';},
};
for(const [label,mutate] of Object.entries(mutations))test(`new conversation rejects ${label}`,()=>{
 const value=fixture(all);assert.doesNotThrow(()=>validateOutput(value,all,{rounds:4}));mutate(value);assert.throws(()=>validateOutput(value,all,{rounds:4}));
});
test('new explicit excerpt may quote the correct earlier referenced turn',()=>{
 const value=fixture(all);value.messages[6].content=`回应对方“${value.messages[1].content.slice(0,12)}”：这个限制还需补充。`;
 assert.doesNotThrow(()=>validateOutput(value,all,{rounds:4}));
});
test('new profile payload restores positions and traceable character-specific ideas within budget',()=>{
 const selected=all.map(id=>roles.find(r=>r.id===id));const messages=buildMessages({topic,roleIds:all,rounds:4},selected);const body=JSON.parse(messages[1].content);
 assert.equal(body.rounds,4);assert.equal(body.turnPlan.length,16);
 for(const role of body.roles){
  const original=selected.find(r=>r.id===role.id);
  assert.deepEqual(role.coreValues,original.coreValues);assert.deepEqual(role.boundaries,original.boundaries);
  if(original.supportedPositions)assert.deepEqual(role.supportedPositions,original.supportedPositions.map(p=>p.position));
  assert.ok(role.discussionGuidance.coreIdeas.length>=4);assert.ok(role.discussionGuidance.voice);
  assert.ok(!('sources' in role)&&!('provenance' in role));
 }
 const wang=body.roles.find(r=>r.id==='wang_defeng');assert.match(JSON.stringify(wang.discussionGuidance),/儒家/);assert.match(JSON.stringify(wang.discussionGuidance),/道家/);assert.match(JSON.stringify(wang.discussionGuidance),/佛家/);assert.match(JSON.stringify(wang.discussionGuidance),/良知/);
 const lei=body.roles.find(r=>r.id==='lei_jun');assert.match(JSON.stringify(lei.discussionGuidance),/对角线/);assert.match(JSON.stringify(lei.discussionGuidance),/阶段/);
 for(const char of ['测','😀','\u0000','"','\\'])assert.ok(Buffer.byteLength(JSON.stringify(buildMessages({topic:char.repeat(300),rounds:4},selected)))<=24000);
 assert.doesNotMatch(JSON.stringify(body.roles.map(r=>r.discussionGuidance.coreIdeas)),/【一句话结论】|【最坏怎么死】|永不失败/);
});
test('four-stage output limit respects explicit legacy operator caps',()=>{
 assert.equal(loadConfig({}).debateMaxOutputTokens,4500);
 assert.equal(loadConfig({LLM_MAX_OUTPUT_TOKENS:'700'}).debateMaxOutputTokens,700);
 assert.equal(loadConfig({LLM_MAX_OUTPUT_TOKENS:'700',LLM_DEBATE_OUTPUT_TOKENS:'900'}).debateMaxOutputTokens,900);
 for(const limit of ['0','NaN','8001'])assert.throws(()=>loadConfig({LLM_DEBATE_OUTPUT_TOKENS:limit}));
});
test('four-stage API sends one bounded request and keeps only five response fields',async()=>{
 let calls=0;let payload;
 const config=loadConfig({DEBATE_MODE:'live',LLM_PROVIDER:'deepseek',LLM_MODEL:'fake-only',LLM_API_KEY:'fake-only'});
 const app=createApp({config,logger:()=>{},fetchImpl:async(_url,options)=>{calls++;payload=JSON.parse(options.body);return Response.json(completion(fixture(all)));}});
 const response=await app.handle(post({topic,roleIds:all,rounds:4}));assert.equal(response.status,200);const body=await response.json();assert.equal(body.messages.length,16);
 assert.deepEqual(Object.keys(body).sort(),['discussionId','messages','summary','topic','usage']);assert.equal(calls,1);assert.equal(payload.max_tokens,4500);
});
test('four-stage reservation uses the larger effective cap before any dispatch',async()=>{
 const selected=all.map(id=>roles.find(r=>r.id===id));const input={topic,roleIds:all,rounds:4};
 const reserve=Buffer.byteLength(JSON.stringify(buildMessages(input,selected)))+512+4500;
 const config={...loadConfig({}),mode:'live',apiKey:'fake-only',model:'fake-only',sessionTokenBudget:reserve-1};let calls=0;
 const app=createApp({config,logger:()=>{},fetchImpl:async()=>{calls++;return Response.json(completion(fixture(all)));}});
 const response=await app.handle(post(input));assert.equal(response.status,429);assert.equal(calls,0);
});


test('actual first sixteen-turn response is rejected for a fabricated attributed excerpt',()=>{
 const value=JSON.parse(readFileSync(new URL('./fixtures/live-conversation-quote-mismatch-20261104.json',import.meta.url),'utf8'));
 assert.equal(value.messages.length,16);
 assert.ok(value.messages[6].content.includes('有限尝试'));
 assert.ok(!value.messages[5].content.includes('有限尝试'));
 assert.throws(()=>validateOutput(value,all,{rounds:4,legacyFour:true}));
 const withoutMisquote=structuredClone(value);withoutMisquote.messages[6].content=withoutMisquote.messages[6].content.replace('“有限尝试”','有限时间内的小范围尝试');
 assert.doesNotThrow(()=>validateOutput(withoutMisquote,all,{rounds:4,legacyFour:true}));
 // This edited copy is only an isolated validation probe, never published as a generated success.
});

test('actual second sixteen-turn response rejects extra summary fields and four-item arrays',()=>{
 const value=JSON.parse(readFileSync(new URL('./fixtures/live-conversation-summary-mismatch-20261104.json',import.meta.url),'utf8'));
 assert.equal(value.messages.length,16);assert.ok(value.summary.nextActions_note);assert.equal(value.summary.decisionFactors.length,4);
 assert.throws(()=>validateOutput(value,all,{rounds:4,legacyFour:true}));
 const probe=structuredClone(value);delete probe.summary.nextActions_note;assert.throws(()=>validateOutput(probe,all,{rounds:4,legacyFour:true}));
 probe.summary.decisionFactors.pop();assert.doesNotThrow(()=>validateOutput(probe,all,{rounds:4,legacyFour:true}));
 // Only a unit validation probe; the raw rejected response is never presented as success.
});
