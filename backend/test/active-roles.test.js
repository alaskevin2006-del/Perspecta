import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';
const app=()=>createApp({config:loadConfig({}),fetchImpl:()=>{throw Error('No paid calls');}});
test('active catalog exposes only the four delivered personas',async()=>{
 const response=await app().handle(new Request('http://localhost/api/roles'));
 const {roles}=await response.json();
 assert.deepEqual(roles.map(r=>r.id),['zhang_xuefeng','du_sujuan','lei_jun','wang_defeng']);
});
test('retired prototype IDs cannot start new discussions',async()=>{
 for(const id of ['career_realist','growth_explorer','risk_analyst']){
  const response=await app().handle(new Request('http://localhost/api/debate',{method:'POST',body:JSON.stringify({topic:'大学阶段应该如何安排学习和项目时间？',roleIds:[id,'zhang_xuefeng']})}));
  assert.equal(response.status,400);
 }
});
