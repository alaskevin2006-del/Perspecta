import test from 'node:test';
import assert from 'node:assert/strict';
import {roles} from '../src/catalog.js';
import {buildMessages} from '../src/prompt.js';
const ids=['zhang_xuefeng','lei_jun','wang_defeng','du_sujuan'];
const selected=ids.map(id=>roles.find(r=>r.id===id));
const topics=['大学阶段时间有限，应该优先投入绩点还是项目实践？','大学生该如何理解亲密关系里的自由和责任？','人工智能艺术作品的价值应该如何判断？'];
test('all discussion topics keep identity but do not receive a GPA-specific per-person script',()=>{
 for(const topic of topics){
  const messages=buildMessages({topic,roleIds:ids,rounds:4},selected);const body=JSON.parse(messages[1].content);
  assert.equal(body.topic,topic);assert.ok(!('turnTasks' in body));
  assert.doesNotMatch(messages[0].content,/user\.turnTasks|不再列考试资格清单|保研\/考研\/考公|同一句硬门槛/);
  assert.match(messages[0].content,/与议题无关/);
 }
});
test('three and four rounds include distinct source-based speech observations as data, not quotations',()=>{
 for(const rounds of [3,4]){
  const messages=buildMessages({topic:topics[2],roleIds:ids,rounds},selected);const body=JSON.parse(messages[1].content);
  const notes=body.roles.map(role=>role.discussionGuidance.speechEvidence);
  assert.ok(notes.every(note=>typeof note==='string'&&note.length>30));assert.equal(new Set(notes).size,4);
  assert.match(notes[0],/具体例子/);assert.match(notes[3],/处境/);
  assert.match(messages[0].content,/不是本人原话/);
  assert.doesNotMatch(JSON.stringify(notes),/我想补一个判断条件|亲身经历|永久保证/);
 }
});

test('speech observations remain traceable to unchanged repository source files',async()=>{
 const {readFileSync}=await import('node:fs');const {createHash}=await import('node:crypto');
 const evidence=JSON.parse(readFileSync(new URL('../data/persona-speech-evidence.json',import.meta.url),'utf8'));
 for(const id of ids){
  const record=evidence[id];assert.equal(record.status,'editorial_paraphrase_pending_persona_owner_review');assert.ok(record.sourceRefs.length);
  for(const ref of record.sourceRefs){
   const raw=readFileSync(new URL('../../'+ref.path,import.meta.url));
   assert.equal(createHash('sha256').update(raw).digest('hex'),ref.fileSha256);assert.ok(ref.section);
  }
  const body=JSON.parse(buildMessages({topic:topics[1],roleIds:ids,rounds:4},selected)[1].content);
  assert.equal(body.roles.find(r=>r.id===id).discussionGuidance.speechEvidence,record.speechEvidence);
 }
});

test('decision cases carry traceable, bounded context and reach each discussion mode without invented quotes',async()=>{
 const {readFileSync}=await import('node:fs');
 const cases=JSON.parse(readFileSync(new URL('../data/persona-decision-cases.json',import.meta.url),'utf8'));
 for(const id of ['zhang_xuefeng','du_sujuan']){
  const role=roles.find(r=>r.id===id);
  assert.equal(cases[id].length,2);
  for(const item of cases[id]){
   assert.ok(['context','judgment','reason','scope','url','locator','status'].every(k=>typeof item[k]==='string'&&item[k].length));
   assert.equal(role.sources.find(source=>source.id===item.source)?.url,item.url);
  }
 }
 for(const rounds of [2,3,4]){
  const body=JSON.parse(buildMessages({topic:topics[0],roleIds:ids,rounds},selected)[1].content);
  for(const id of ['zhang_xuefeng','du_sujuan']){
   const transmitted=body.roles.find(r=>r.id===id).decisionCases;
   assert.deepEqual(transmitted,cases[id].map(({runtime})=>runtime));
   assert.ok(!JSON.stringify(transmitted).includes('https://'));
  }
 }
});
