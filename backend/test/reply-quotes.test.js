import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateOutput } from '../src/validation.js';
import { createApp } from '../src/app.js';
import { core,completion,debateRequest,upstream,send } from '../test-support/upstream.js';

const twoRoleCase=()=>({messages:[
  {id:'m1',round:1,roleId:'growth_explorer',content:'我倾向先广泛尝试，但要有边界，并以真实任务反馈判断兴趣与能力。',replyTo:null},
  {id:'m2',round:1,roleId:'risk_analyst',content:'应先确认信息缺口与硬性条件，再进行可逆、期限短的探索。',replyTo:null},
  {id:'m3',round:2,roleId:'growth_explorer',content:'回应信息缺口：等待信息齐全可能变成拖延，可以用小规模行动获取信息。',replyTo:'m2'},
  {id:'m4',round:2,roleId:'risk_analyst',content:'回应你所说“等待信息齐全可能变成拖延”，但探索应绑定可验证产出。',replyTo:'m1'},
],summary:{consensus:['尝试需要边界。'],disagreements:['先查证还是先行动。'],decisionFactors:['信息和资源。'],nextActions:['核查要求再小步试验。']}});

test('an explicit quote from round two cannot be attributed to a first-round reply target',()=>{
  assert.throws(()=>validateOutput(twoRoleCase(),['growth_explorer','risk_analyst']),error=>error.code==='INVALID_MODEL_OUTPUT');
});

test('actual stability sample with a mismatched quoted source is rejected offline',()=>{
  const value=JSON.parse(readFileSync(new URL('fixtures/live-stability-quote-mismatch-20261103.json',import.meta.url),'utf8'));
  assert.equal(value.messages[3].replyTo,'m1');
  assert.ok(value.messages[2].content.includes('等待信息齐全可能变成拖延'));
  assert.ok(!value.messages[0].content.includes('等待信息齐全可能变成拖延'));
  assert.throws(()=>validateOutput({messages:value.messages,summary:value.summary},['growth_explorer','risk_analyst']),error=>error.code==='INVALID_MODEL_OUTPUT');
});

test('an explicit attributed quote must be a contiguous excerpt of its own reply target',()=>{
  const value=twoRoleCase();
  value.messages[3].content='回应你所说“以真实任务反馈判断兴趣与能力”，探索的成本还需要约束。';
  assert.doesNotThrow(()=>validateOutput(value,['growth_explorer','risk_analyst']));
  value.messages[3].content='回应你提到“没有出现过的具体引语”，再补充一点。';
  assert.throws(()=>validateOutput(value,['growth_explorer','risk_analyst']),error=>error.code==='INVALID_MODEL_OUTPUT');
});

test('accurate paraphrase and newly introduced quoted concepts remain allowed',()=>{
  const value=twoRoleCase();
  value.messages[3].content='回应成长探索派：你主张从真实任务获取反馈，我补充可逆性和退出条件。';
  assert.doesNotThrow(()=>validateOutput(value,['growth_explorer','risk_analyst']));
  value.messages[3].content='我补充一个新概念“可验证的实际项目成果”，用于评价探索投入。';
  assert.doesNotThrow(()=>validateOutput(value,['growth_explorer','risk_analyst']));
  value.messages[3].content='我没有认为你说“未曾出现过的完整观点”，这里只是在提出一个新的约束。';
  assert.doesNotThrow(()=>validateOutput(value,['growth_explorer','risk_analyst']));
});

test('a quote taken from a different first-round role is rejected',()=>{
  const value=core();
  value.messages[3].content='回应你强调“维持成绩底线通常应优先”，需要增加资源约束。';
  assert.throws(()=>validateOutput(value,['zhang_xuefeng','du_sujuan','lei_jun']),error=>error.code==='INVALID_MODEL_OUTPUT');
});

test('wrong attributed quote maps to 502, preserves usage and never retries',async t=>{
  const actual=JSON.parse(readFileSync(new URL('fixtures/live-stability-quote-mismatch-20261103.json',import.meta.url),'utf8'));
  for(const message of actual.messages)message.roleId=({growth_explorer:'du_sujuan',risk_analyst:'lei_jun'})[message.roleId];
  const {config,calls}=await upstream(t,(_req,res)=>send(res,completion({messages:actual.messages,summary:actual.summary})));config.provider='deepseek';
  const logs=[];
  const response=await createApp({config,logger:event=>logs.push(event)}).handle(debateRequest({topic:'大学生应该尽早确定未来方向，还是广泛尝试？',roleIds:['du_sujuan','lei_jun']}));
  assert.equal(response.status,502);
  assert.equal((await response.json()).error.code,'INVALID_MODEL_OUTPUT');
  assert.equal(calls.length,1);
  assert.deepEqual(logs[0].usage,{inputTokens:120,outputTokens:300});
  assert.ok(!JSON.stringify(logs).includes('等待信息齐全'));
});
