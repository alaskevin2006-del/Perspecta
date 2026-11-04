import test from 'node:test';
import assert from 'node:assert/strict';
import {validateInput,validateOutput} from '../src/validation.js';
import {mockDebate} from '../src/mock.js';
import {buildMessages} from '../src/prompt.js';
import {roles} from '../src/catalog.js';
const ids=['zhang_xuefeng','du_sujuan','lei_jun','wang_defeng'];
const core=()=>{const d=mockDebate({topic:'大学阶段如何平衡绩点与项目实践？',roleIds:ids,rounds:3});return {messages:d.messages,summary:d.summary};};
test('three rounds allow continuing an earlier exchange, but reject future and self references',()=>{
 const d=core();assert.doesNotThrow(()=>validateOutput(d,ids,{rounds:3}));
 const historical=core();historical.messages=historical.messages.slice(0,ids.length*2);
 assert.doesNotThrow(()=>validateOutput(historical,ids));
 assert.throws(()=>validateOutput(historical,ids,{rounds:3}));
 const future=core();future.messages[4].replyTo=future.messages[5].id;assert.throws(()=>validateOutput(future,ids,{rounds:3}));
 const self=core();self.messages[8].replyTo=self.messages[4].id;assert.throws(()=>validateOutput(self,ids,{rounds:3}));
 const shallow=core();for(const m of shallow.messages.filter(m=>m.round===3)) m.replyTo=shallow.messages.find(x=>x.round===1&&x.roleId!==m.roleId).id;assert.throws(()=>validateOutput(shallow,ids,{rounds:3}));
});
test('prompt uses evidence-backed positions and does not feed the question templates',()=>{
 const prompt=buildMessages({topic:'测试议题',rounds:3,roleIds:ids},ids.map(id=>roles.find(r=>r.id===id)));
 const data=JSON.parse(prompt[1].content);assert.equal(data.rounds,3);assert.ok(data.roles[0].supportedPositions.length);assert.ok(!('typicalQuestions' in data.roles[0]));
});

test('three-round input and all ordered rosters stay bounded with new source guidance',()=>{
 let checked=0,maxBytes=0;
 const visit=(list)=>{if(list.length>=2){
  const chosen=list.map(id=>roles.find(r=>r.id===id));
  assert.equal(validateInput({topic:'大学阶段如何平衡绩点与项目实践？',roleIds:list,rounds:3},roles).rounds,3);
  for(const rounds of [2,3,4]){
   const d=mockDebate({topic:'大学阶段如何平衡绩点与项目实践？',roleIds:list,rounds});validateOutput({messages:d.messages,summary:d.summary},list,{rounds});
   for(const char of ['测','😀','\u0000','"','\\']){const bytes=Buffer.byteLength(JSON.stringify(buildMessages({topic:char.repeat(300),roleIds:list,rounds},chosen)));assert.ok(bytes<=24000,`budget ${bytes}`);maxBytes=Math.max(maxBytes,bytes);}
  }checked++;
 }if(list.length<4)for(const role of roles)if(!list.includes(role.id))visit([...list,role.id]);};visit([]);
 assert.equal(checked,1092);console.log(JSON.stringify({orderedRosters:checked,modes:3,maxPromptBytes:maxBytes}));
});
