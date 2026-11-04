import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {roles} from '../src/catalog.js';
import {createApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';
import {validateOutput} from '../src/validation.js';
import {buildMessages} from '../src/prompt.js';
const topic='大学阶段时间有限，应该优先投入绩点还是项目实践？';
const request=roleIds=>new Request('http://localhost/api/debate',{method:'POST',body:JSON.stringify({topic,roleIds})});
const app=()=>createApp({config:loadConfig({DEBATE_MODE:'mock'}),fetchImpl:()=>{throw Error('No provider calls allowed');}});
test('all delivered personas are copied exactly and new adaptations trace their source',()=>{
 for(const name of ['张雪峰','杜素娟'])for(const profile of JSON.parse(readFileSync(new URL(`../../人物画像/${name}/roles.json`,import.meta.url),'utf8')))assert.deepEqual(roles.find(r=>r.id===profile.id),profile);
 for(const id of ['lei_jun','wang_defeng']){
  const [profile]=JSON.parse(readFileSync(new URL(`../../人物画像/结构化适配/${id}.roles.json`,import.meta.url),'utf8'));
  assert.deepEqual(roles.find(r=>r.id===id),profile);
  const source=readFileSync(new URL(`../../${profile.provenance.sourcePath}`,import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'),profile.provenance.sha256);
  assert.equal(profile.provenance.approvalStatus,'pending_persona_owner_review');
 }
 assert.equal(roles.length,7);
});
for(const ids of [['zhang_xuefeng','du_sujuan'],['zhang_xuefeng','du_sujuan','career_realist'],['zhang_xuefeng','du_sujuan','career_realist','growth_explorer'],['risk_analyst','career_realist','du_sujuan','zhang_xuefeng'],['lei_jun','wang_defeng'],['lei_jun','wang_defeng','du_sujuan'],['zhang_xuefeng','lei_jun','wang_defeng','du_sujuan']])test(`${ids.length}-role integrated mock ${ids.join(',')}`,async()=>{
 const response=await app().handle(request(ids)); assert.equal(response.status,200);assert.equal(response.headers.get('X-Perspecta-Mode'),'mock');const data=await response.json();assert.equal(data.messages.length,ids.length*2);validateOutput({messages:data.messages,summary:data.summary},ids);assert.deepEqual(data.messages.map(m=>m.roleId),[...ids,...ids]);
 const messages=buildMessages({topic,roleIds:ids},ids.map(id=>roles.find(r=>r.id===id))); assert.equal(JSON.parse(messages[1].content).roles.length,ids.length);
});
test('five, duplicate, absent and unknown IDs are rejected',async()=>{
 for(const ids of [roles.slice(0,5).map(r=>r.id),['zhang_xuefeng','zhang_xuefeng'],['zhang_xuefeng'],['zhang_xuefeng','not_delivered'],['not_delivered','du_sujuan']]){const r=await app().handle(request(ids));assert.equal(r.status,400);assert.equal((await r.json()).error.code,'INVALID_INPUT');}
});

test('legacy four-role combinations fit the budget without source metadata or instructions',()=>{
 for(const topic of ['测'.repeat(300),'😀'.repeat(300),'\u0000'.repeat(300),'"'.repeat(300),'\\'.repeat(300)]){
 const input={topic};
 for(let a=0;a<roles.length;a++)for(let b=a+1;b<roles.length;b++)for(let c=b+1;c<roles.length;c++)for(let d=c+1;d<roles.length;d++){
  const selected=[roles[a],roles[b],roles[c],roles[d]];
  const messages=buildMessages(input,selected);const data=JSON.parse(messages[1].content);
  assert.ok(Buffer.byteLength(JSON.stringify(messages))<=24000);
  for(const [i,role] of data.roles.entries()){
   assert.deepEqual(role.coreValues,selected[i].coreValues);assert.deepEqual(role.boundaries,selected[i].boundaries);
   for(const key of ['sources','provenance','supportedPositions','avatar'])assert.ok(!(key in role));
  }
 }
 }
});
