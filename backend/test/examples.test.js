import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateOutput } from '../src/validation.js';

for(const file of ['live-gpa-20261103.json','live-gpa-20261103-revised.json','live-postgraduate-20261103.json'])test(`historical ${file} remains consumable under the locked public contract`,()=>{
  const value=JSON.parse(readFileSync(new URL(`../examples/${file}`,import.meta.url),'utf8'));
  assert.deepEqual(Object.keys(value).sort(),['discussionId','messages','summary','topic','usage']);
  assert.equal(typeof value.discussionId,'string');
  assert.ok(typeof value.topic==='string' && [...value.topic].length>=10 && [...value.topic].length<=300);
  assert.equal(value.messages.length,6);
  assert.doesNotThrow(()=>validateOutput({messages:value.messages,summary:value.summary},['career_realist','growth_explorer','risk_analyst']));
  assert.deepEqual(Object.keys(value.usage).sort(),['inputTokens','outputTokens']);
  assert.ok(Object.values(value.usage).every(count=>Number.isSafeInteger(count)&&count>=0));
});


test('four-person historical live result preserves contract and every explicitly attributed excerpt',()=>{
 const value=JSON.parse(readFileSync(new URL('../examples/live-four-personas-20261104.json',import.meta.url),'utf8'));
 const ids=['zhang_xuefeng','lei_jun','wang_defeng','du_sujuan'];
 assert.deepEqual(Object.keys(value).sort(),['discussionId','messages','summary','topic','usage']);
 assert.equal(value.messages.length,8);
 assert.deepEqual(value.messages.map(m=>m.roleId),[...ids,...ids]);
 assert.doesNotThrow(()=>validateOutput({messages:value.messages,summary:value.summary},ids));
 for(const message of value.messages.slice(4)){
  const first=value.messages.find(m=>m.id===message.replyTo);
  const excerpt=/^回应[^“]+“([^”]+)”/.exec(message.content)?.[1];
  assert.ok(excerpt&&first.round===1&&first.roleId!==message.roleId&&first.content.includes(excerpt));
 }
 assert.deepEqual(value.usage,{inputTokens:2508,outputTokens:987});
 // Literal-source checks do not prove preservation of semantic conditions or persona fidelity.
});
