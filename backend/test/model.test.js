import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { upstream, send, completion, core, debateRequest, roleIds, topic } from '../test-support/upstream.js';

test('live makes one bounded JSON request and returns only server-owned envelope fields', async t => {
  const {config, calls} = await upstream(t, (_req, res) => send(res, completion()));
  const logs = [];
  const response = await createApp({config, logger: e => logs.push(e)}).handle(debateRequest());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-Perspecta-Mode'), 'live');
  const value = await response.json();
  assert.match(value.discussionId, /^[0-9a-f-]{36}$/);
  assert.equal(value.topic, topic);
  assert.deepEqual(value.usage, {inputTokens:120, outputTokens:300});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/v1/chat/completions');
  assert.equal(calls[0].headers.authorization, 'Bearer test-key');
  assert.equal(calls[0].body.stream, false);
  assert.deepEqual(calls[0].body.response_format, {type:'json_object'});
  assert.equal(calls[0].body.max_completion_tokens, config.maxOutputTokens);
  assert.equal(JSON.parse(calls[0].body.messages[1].content).roles.length, 3);
  assert.ok(logs[0].durationMs >= 0);
  assert.deepEqual(logs[0].usage, value.usage);
  assert.ok(!JSON.stringify(logs).includes(topic));
  assert.ok(!JSON.stringify(logs).includes('test-key'));
});

test('missing upstream usage stays null and no token counts are invented', async t => {
  const {config} = await upstream(t, (_req, res) => send(res, completion(core(), null)));
  const response = await createApp({config, logger:()=>{}}).handle(debateRequest());
  assert.equal((await response.json()).usage, null);
});

const corruptions = {
  'missing summary array': v => {delete v.summary.nextActions;},
  'extra summary field': v => {v.summary.extra = 'untrusted';},
  'empty summary': v => {v.summary.consensus = [];},
  'unexpected top-level metadata': v => {v.topic='model-owned';},
  'duplicate IDs': v => {v.messages[1].id = 'm1';},
  'unknown role': v => {v.messages[0].roleId='intruder';},
  'missing message': v => {v.messages.pop();},
  'repeated role': v => {v.messages[1].roleId='career_realist';},
  'wrong round order': v => {v.messages.reverse();},
  'future reference': v => {v.messages[3].replyTo='m5';},
  'self reference': v => {v.messages[3].replyTo='m1';},
  'first round reference': v => {v.messages[0].replyTo='m2';},
  'blank content': v => {v.messages[0].content=' ';},
  'extra message field': v => {v.messages[0].source='untrusted';},
};
for (const [name, corrupt] of Object.entries(corruptions)) {
  test(`rejects ${name} with 502 and no automatic retry`, async t => {
    const value = core(); corrupt(value);
    const {config, calls} = await upstream(t, (_req, res) => send(res, completion(value)));
    const response = await createApp({config, logger:()=>{}}).handle(debateRequest());
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error.code, 'INVALID_MODEL_OUTPUT');
    assert.equal(calls.length, 1);
  });
}

for (const [name, change] of Object.entries({
  truncated: r => {r.choices[0].finish_reason='length';},
  'non-JSON content': r => {r.choices[0].message.content='```json\n{}\n```';},
  'malformed usage': r => {r.usage.prompt_tokens=-1;},
  refusal: r => {r.choices[0].message.refusal='refused';},
})) {
  test(`rejects upstream ${name}`, async t => {
    const result = completion(); change(result);
    const {config} = await upstream(t, (_req, res) => send(res, result));
    const response = await createApp({config, logger:()=>{}}).handle(debateRequest());
    assert.equal(response.status, 502);
  });
}

for (const status of [401, 429, 500]) test(`maps upstream ${status} without leaking provider details`, async t => {
  const {config, calls} = await upstream(t, (_req, res) => send(res, {error:'provider secret detail'}, status));
  const response = await createApp({config, logger:()=>{}}).handle(debateRequest());
  assert.equal(response.status, status === 429 ? 429 : 500);
  assert.ok(!(await response.text()).includes('provider secret detail'));
  assert.equal(calls.length, 1);
});

test('timeout covers upstream response body and aborts without retry', async t => {
  const {config, calls} = await upstream(t, (_req, res) => {res.writeHead(200); res.write('{');});
  config.timeoutMs = 40;
  const response = await createApp({config, logger:()=>{}}).handle(debateRequest());
  assert.equal(response.status, 504);
  assert.equal((await response.json()).error.code, 'MODEL_TIMEOUT');
  assert.equal(calls.length, 1);
});

test('oversized upstream response is rejected', async t => {
  const {config} = await upstream(t, (_req, res) => res.end('x'.repeat(70000)));
  const response = await createApp({config, logger:()=>{}}).handle(debateRequest());
  assert.equal(response.status, 502);
});

test('invalid input never consumes an upstream call', async t => {
  const {config, calls} = await upstream(t, (_req, res) => send(res, completion()));
  const response = await createApp({config, logger:()=>{}}).handle(debateRequest({topic:'短', roleIds}));
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});

test('invalid model JSON still logs provider-supplied usage and cost', async t => {
  const value=core(); value.messages.pop();
  const {config}=await upstream(t, (_req,res)=>send(res, completion(value, {prompt_tokens:120, completion_tokens:300, cost:0.001})));
  const logs=[];
  const response=await createApp({config, logger:e=>logs.push(e)}).handle(debateRequest());
  assert.equal(response.status,502);
  assert.deepEqual(logs[0].usage,{inputTokens:120,outputTokens:300});
  assert.equal(logs[0].providerCost,0.001);
});

test('valid two-role live result retains selected order and cross-role references', async t => {
  const value=core();
  value.messages=[value.messages[2],value.messages[1],value.messages[5],value.messages[4]];
  value.messages[2].replyTo='m2'; value.messages[3].replyTo='m3';
  const {config}=await upstream(t, (_req,res)=>send(res,completion(value)));
  const response=await createApp({config,logger:()=>{}}).handle(debateRequest({topic,roleIds:['risk_analyst','growth_explorer']}));
  assert.equal(response.status,200);
  assert.equal((await response.json()).messages.length,6);
});

test('caller cancellation aborts generation and releases the concurrency slot', async t => {
  let received;
  const ready=new Promise(resolve=>{received=resolve;});
  const {config,calls}=await upstream(t, (_req,res,all)=>{if(all.length===1)received();else send(res,completion());});
  config.maxConcurrent=1;
  const app=createApp({config,logger:()=>{}});
  const abort=new AbortController();
  const pending=app.handle(debateRequest(undefined,abort.signal));
  await ready;
  abort.abort();
  assert.equal((await pending).status,504);
  assert.equal((await app.handle(debateRequest())).status,200);
  assert.equal(calls.length,2);
});
