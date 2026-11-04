import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { upstream, send, completion, core, debateRequest } from '../test-support/upstream.js';

test('DeepSeek selection uses its official endpoint and still needs an explicit live model and key',()=>{
  const config=loadConfig({LLM_PROVIDER:'deepseek'});
  assert.equal(config.provider,'deepseek');
  assert.equal(config.baseUrl,'https://api.deepseek.com');
  assert.equal(config.mode,'mock');
  assert.throws(()=>loadConfig({DEBATE_MODE:'live',LLM_PROVIDER:'deepseek',LLM_API_KEY:'dummy'}));
  assert.throws(()=>loadConfig({LLM_PROVIDER:'unknown'}));
  assert.throws(()=>loadConfig({LLM_PROVIDER:'deepseek',LLM_BASE_URL:'https://api.openai.com/v1'}));
  assert.throws(()=>loadConfig({LLM_BASE_URL:'https://api.deepseek.com'}));
});

test('DeepSeek sends max_tokens and disables thinking without changing the client envelope',async t=>{
  const {config,calls}=await upstream(t,(_req,res)=>send(res,completion()));
  config.provider='deepseek';config.model='deepseek-flash';
  config.baseUrl=config.baseUrl.replace('/v1','');
  const logs=[];
  const response=await createApp({config,logger:e=>logs.push(e)}).handle(debateRequest());
  assert.equal(response.status,200);
  const value=await response.json();
  assert.deepEqual(Object.keys(value).sort(),['discussionId','messages','summary','topic','usage']);
  assert.equal(calls.length,1);
  assert.equal(calls[0].path,'/chat/completions');
  assert.equal(calls[0].body.max_tokens,3000);
  assert.equal(Object.hasOwn(calls[0].body,'max_completion_tokens'),false);
  assert.deepEqual(calls[0].body.thinking,{type:'disabled'});
  assert.deepEqual(calls[0].body.response_format,{type:'json_object'});
  assert.equal(calls[0].body.stream,false);
  assert.equal(logs[0].provider,'deepseek');
  assert.equal(logs[0].upstreamStatus,200);
});

for (const [status,diagnostic] of [[400,'UPSTREAM_INVALID_REQUEST'],[401,'UPSTREAM_AUTH_FAILED'],[402,'UPSTREAM_INSUFFICIENT_BALANCE'],
  [422,'UPSTREAM_INVALID_REQUEST'],[429,'UPSTREAM_RATE_LIMITED'],[500,'UPSTREAM_UNAVAILABLE'],[503,'UPSTREAM_UNAVAILABLE']]) {
  test(`DeepSeek ${status} keeps public error contract and records safe diagnostic without retry`,async t=>{
    const {config,calls}=await upstream(t,(_req,res)=>send(res,{error:{message:'private provider detail',type:'secret'}},status));
    config.provider='deepseek';
    const logs=[];
    const response=await createApp({config,logger:e=>logs.push(e)}).handle(debateRequest());
    assert.equal(response.status,status===429?429:500);
    const value=await response.json();
    assert.deepEqual(Object.keys(value),['error']);
    assert.deepEqual(Object.keys(value.error).sort(),['code','message']);
    assert.equal(value.error.code,status===429?'RATE_LIMITED':'INTERNAL_ERROR');
    assert.equal(logs[0].upstreamStatus,status);
    assert.equal(logs[0].upstreamError,diagnostic);
    assert.ok(!JSON.stringify([value,logs]).includes('private provider detail'));
    assert.ok(!JSON.stringify(logs).includes('test-key'));
    assert.equal(calls.length,1);
  });
}

for (const content of ['', '   \n  ', null]) test(`DeepSeek empty/blank content ${JSON.stringify(content)} is rejected even with reasoning`,async t=>{
  const value=completion();value.choices[0].message.content=content;
  value.choices[0].message.reasoning_content='private reasoning must not be returned';
  const {config,calls}=await upstream(t,(_req,res)=>send(res,value));config.provider='deepseek';
  const logs=[];
  const response=await createApp({config,logger:e=>logs.push(e)}).handle(debateRequest());
  assert.equal(response.status,502);
  assert.equal((await response.json()).error.code,'INVALID_MODEL_OUTPUT');
  assert.deepEqual(logs[0].usage,{inputTokens:120,outputTokens:300});
  assert.ok(!JSON.stringify(logs).includes('private reasoning'));
  assert.equal(calls.length,1);
});

test('DeepSeek cache statistics do not double-count usage or expose reasoning',async t=>{
  const value=completion(core(),{prompt_tokens:120,completion_tokens:300,total_tokens:420,
    prompt_cache_hit_tokens:80,prompt_cache_miss_tokens:40,prompt_tokens_details:{cached_tokens:80},completion_tokens_details:{reasoning_tokens:0}});
  value.choices[0].message.reasoning_content='private reasoning';
  const {config}=await upstream(t,(_req,res)=>send(res,value));config.provider='deepseek';
  const logs=[];
  const response=await createApp({config,logger:e=>logs.push(e)}).handle(debateRequest());
  const result=await response.json();
  assert.equal(response.status,200);
  assert.deepEqual(result.usage,{inputTokens:120,outputTokens:300});
  assert.ok(!JSON.stringify([result,logs]).includes('private reasoning'));
  assert.equal(logs[0].providerCost,null);
  assert.deepEqual(logs[0].usageDetails,{cacheHitTokens:80,cacheMissTokens:40,totalTokens:420,reasoningTokens:0});
});

test('optional usage details remain null when the provider does not report them',async t=>{
  const {config}=await upstream(t,(_req,res)=>send(res,completion()));config.provider='deepseek';
  const logs=[];
  const response=await createApp({config,logger:e=>logs.push(e)}).handle(debateRequest());
  assert.equal(response.status,200);
  assert.deepEqual(logs[0].usageDetails,{cacheHitTokens:null,cacheMissTokens:null,totalTokens:null,reasoningTokens:null});
  assert.deepEqual(Object.keys((await response.json()).usage).sort(),['inputTokens','outputTokens']);
});

for(const [name,update] of Object.entries({
  'cache sum':usage=>{usage.prompt_cache_miss_tokens=41;},
  'negative cache count':usage=>{usage.prompt_cache_hit_tokens=-1;},
  'cache count exceeds input':usage=>{usage.prompt_cache_hit_tokens=121;},
  'total does not match':usage=>{usage.total_tokens=421;},
  'reasoning exceeds output':usage=>{usage.completion_tokens_details.reasoning_tokens=301;},
  'nonnumeric counter':usage=>{usage.prompt_cache_miss_tokens='40';},
  'conflicting cache representations':usage=>{usage.prompt_tokens_details={cached_tokens:79};},
}))test(`inconsistent provider ${name} is rejected while actual core usage is retained`,async t=>{
  const value=completion(core(),{prompt_tokens:120,completion_tokens:300,total_tokens:420,
    prompt_cache_hit_tokens:80,prompt_cache_miss_tokens:40,completion_tokens_details:{reasoning_tokens:0},cost:0.001});
  update(value.usage);
  const {config,calls}=await upstream(t,(_req,res)=>send(res,value));config.provider='deepseek';
  const logs=[];
  const response=await createApp({config,logger:e=>logs.push(e)}).handle(debateRequest());
  assert.equal(response.status,502);
  assert.equal((await response.json()).error.code,'INVALID_MODEL_OUTPUT');
  assert.deepEqual(logs[0].usage,{inputTokens:120,outputTokens:300});
  assert.equal(logs[0].providerCost,0.001);
  assert.equal(calls.length,1);
});

test('OpenAI nested cache counter is retained without inventing missing cache totals',async t=>{
  const value=completion(core(),{prompt_tokens:120,completion_tokens:300,prompt_tokens_details:{cached_tokens:80}});
  const {config}=await upstream(t,(_req,res)=>send(res,value));
  const logs=[];
  const response=await createApp({config,logger:e=>logs.push(e)}).handle(debateRequest());
  assert.equal(response.status,200);
  assert.deepEqual(logs[0].usageDetails,{cacheHitTokens:80,cacheMissTokens:null,totalTokens:null,reasoningTokens:null});
});

test('model prompt includes a concrete two-round JSON example with only the selected role IDs',async t=>{
  const {config,calls}=await upstream(t,(_req,res)=>send(res,completion()));config.provider='deepseek';
  const response=await createApp({config,logger:()=>{}}).handle(debateRequest());
  assert.equal(response.status,200);
  const system=calls[0].body.messages[0].content;
  let example;
  assert.doesNotThrow(()=>{example=JSON.parse(system.slice(system.lastIndexOf('\n')+1));});
  assert.equal(example.messages.length,6);
  assert.deepEqual(example.messages.map(m=>m.round),[1,1,1,2,2,2]);
  assert.deepEqual(example.messages.map(m=>m.roleId),['zhang_xuefeng','du_sujuan','lei_jun','zhang_xuefeng','du_sujuan','lei_jun']);
  assert.deepEqual(example.messages.slice(3).map(m=>m.replyTo),['m2','m3','m1']);
  assert.deepEqual(Object.keys(example.summary).sort(),['consensus','decisionFactors','disagreements','nextActions']);
});

test('DeepSeek two-role selection uses a four-message prompt example and returns four validated messages',async t=>{
  const value=core();value.messages=[value.messages[2],value.messages[1],value.messages[5],value.messages[4]];
  value.messages[2].replyTo='m2';value.messages[3].replyTo='m3';
  const {config,calls}=await upstream(t,(_req,res)=>send(res,completion(value)));config.provider='deepseek';
  const response=await createApp({config,logger:()=>{}}).handle(debateRequest({topic:'在有限时间内如何平衡绩点和项目投入？',roleIds:['lei_jun','du_sujuan']}));
  assert.equal(response.status,200);
  assert.equal((await response.json()).messages.length,4);
  const system=calls[0].body.messages[0].content;
  const example=JSON.parse(system.slice(system.lastIndexOf('\n')+1));
  assert.deepEqual(example.messages.map(m=>m.roleId),['lei_jun','du_sujuan','lei_jun','du_sujuan']);
  assert.deepEqual(example.messages.slice(2).map(m=>m.replyTo),['m2','m1']);
});
