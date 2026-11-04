import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {roles} from '../src/catalog.js';
import {createApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';
import {validateOutput} from '../src/validation.js';
import {buildMessages} from '../src/prompt.js';
const topic='大学阶段时间有限，应该优先投入绩点还是项目实践？';
const request=roleIds=>new Request('http://localhost/api/debate',{method:'POST',body:JSON.stringify({topic,roleIds})});
const app=()=>createApp({config:loadConfig({DEBATE_MODE:'mock'}),fetchImpl:()=>{throw Error('No provider calls allowed');}});
test('delivered personas are copied exactly, missing personas are not invented',()=>{
 for(const name of ['张雪峰','杜素娟'])for(const profile of JSON.parse(readFileSync(new URL(`../../人物画像/${name}/roles.json`,import.meta.url),'utf8')))assert.deepEqual(roles.find(r=>r.id===profile.id),profile);
 assert.ok(!roles.some(r=>['lei_jun','wang_defeng'].includes(r.id)));
});
for(const ids of [['zhang_xuefeng','du_sujuan'],['zhang_xuefeng','du_sujuan','career_realist'],['zhang_xuefeng','du_sujuan','career_realist','growth_explorer'],['risk_analyst','career_realist','du_sujuan','zhang_xuefeng']])test(`${ids.length}-role integrated mock ${ids.join(',')}`,async()=>{
 const response=await app().handle(request(ids)); assert.equal(response.status,200);assert.equal(response.headers.get('X-Perspecta-Mode'),'mock');const data=await response.json();assert.equal(data.messages.length,ids.length*2);validateOutput({messages:data.messages,summary:data.summary},ids);assert.deepEqual(data.messages.map(m=>m.roleId),[...ids,...ids]);
 const messages=buildMessages({topic,roleIds:ids},ids.map(id=>roles.find(r=>r.id===id))); assert.equal(JSON.parse(messages[1].content).roles.length,ids.length);
});
test('five, duplicate, absent and missing-profile IDs are rejected',async()=>{
 for(const ids of [roles.map(r=>r.id),['zhang_xuefeng','zhang_xuefeng'],['zhang_xuefeng'],['zhang_xuefeng','lei_jun'],['wang_defeng','du_sujuan']]){const r=await app().handle(request(ids));assert.equal(r.status,400);assert.equal((await r.json()).error.code,'INVALID_INPUT');}
});
