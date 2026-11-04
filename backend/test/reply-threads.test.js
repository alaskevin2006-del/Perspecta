import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateOutput} from '../src/validation.js';
import {buildMessages} from '../src/prompt.js';
import {roles} from '../src/catalog.js';
import {mockDebate} from '../src/mock.js';
const all=['zhang_xuefeng','lei_jun','wang_defeng','du_sujuan'];
const rows={2:[[0,1,null],[1,1,null],[0,2,2],[1,2,1],[0,3,4],[1,3,3],[0,4,6],[1,4,5]],3:[[0,1,null],[1,1,null],[2,1,null],[0,2,3],[1,2,1],[2,2,2],[0,3,5],[1,3,6],[2,3,4],[0,4,9],[1,4,7],[2,4,8]],4:[[0,1,null],[1,1,null],[2,1,null],[3,1,null],[0,2,4],[3,2,5],[2,2,2],[1,2,7],[0,3,6],[3,3,9],[2,3,8],[1,3,11],[0,4,12],[1,4,10],[2,4,9],[3,4,11]]};
function fixture(n){return {messages:rows[n].map(([i,round,target],k)=>({id:`m${k+1}`,round,roleId:all[i],replyTo:target?`m${target}`:null,content:`论点${k+1}：这个具体条件需要放回实际路径中比较，不能把已有边界重复一遍当作新的理由。`})),summary:{consensus:['张与杜接受核查正式资格。'],disagreements:['低成本尝试何时安排仍有不同判断。'],decisionFactors:['目标、资源与截止节点。'],nextActions:['若资格临近截止则先核查，否则可并行安排小尝试。']}};}
for(const n of [2,3,4])test(`mixed ${n}-role threads return to earlier exchanges rather than relay every turn`,()=>{
 const ids=all.slice(0,n);const value=fixture(n);assert.doesNotThrow(()=>validateOutput(value,ids,{rounds:4}));
 const mock=mockDebate({topic:'大学阶段如何平衡绩点与项目实践？',roleIds:ids,rounds:4});
 assert.deepEqual(mock.messages.map(({id,round,roleId,replyTo})=>({id,round,roleId,replyTo})),value.messages.map(({id,round,roleId,replyTo})=>({id,round,roleId,replyTo})));
 assert.doesNotThrow(()=>validateOutput({messages:mock.messages,summary:mock.summary},ids,{rounds:4}));
});
test('new four-stage validation rejects stale relay output but explicitly retains historical parsing',()=>{
 const old=JSON.parse(readFileSync(new URL('../examples/live-continuous-gpa-20261104.json',import.meta.url),'utf8'));const core={messages:old.messages,summary:old.summary};
 assert.throws(()=>validateOutput(core,all,{rounds:4}));assert.doesNotThrow(()=>validateOutput(core,all,{rounds:4,legacyFour:true}));
});
test('a structurally valid thread cannot copy one whole speech into another',()=>{const value=fixture(4);assert.doesNotThrow(()=>validateOutput(value,all,{rounds:4}));value.messages[8].content=value.messages[4].content;assert.throws(()=>validateOutput(value,all,{rounds:4}));});
test('a callback must really target a response to this speaker',()=>{const value=fixture(4);value.messages[8].replyTo='m7';assert.throws(()=>validateOutput(value,all,{rounds:4}));});

test('later realist turns receive distinct tasks and summaries require named assent',()=>{
 const p=buildMessages({topic:'大学阶段时间有限，应该优先投入绩点还是项目实践？',roleIds:all,rounds:4},all.map(id=>roles.find(r=>r.id===id)));
 const body=JSON.parse(p[1].content);assert.match(body.turnTasks.m5,/截止/);assert.match(body.turnTasks.m9,/资源/);assert.match(body.turnTasks.m13,/反馈/);assert.match(p[0].content,/每条以明确认可者姓名开头/);
});
