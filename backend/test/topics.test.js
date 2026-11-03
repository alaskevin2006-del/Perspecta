import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { topics } from '../src/catalog.js';
import { completion, debateRequest, roleIds } from '../test-support/upstream.js';

for(const topic of topics)test(`preset ${topic.id} is forwarded once and echoed under the locked contract`,async()=>{
  const config=loadConfig({DEBATE_MODE:'live',LLM_PROVIDER:'deepseek',LLM_MODEL:'test-only',LLM_API_KEY:'test-only-key',LLM_BASE_URL:'http://127.0.0.1:1'});
  let calls=0;
  const app=createApp({config,logger:()=>{},fetchImpl:async(url,options)=>{
    calls++;
    assert.equal(url,'http://127.0.0.1:1/chat/completions');
    const payload=JSON.parse(options.body);
    const input=JSON.parse(payload.messages[1].content);
    assert.equal(input.topic,topic.prompt);
    assert.deepEqual(input.roles.map(role=>role.id),roleIds);
    return Response.json(completion());
  }});
  const response=await app.handle(debateRequest({topic:`  ${topic.prompt}  `,roleIds}));
  assert.equal(response.status,200);
  assert.equal((await response.json()).topic,topic.prompt);
  assert.equal(calls,1);
  // The returned words are a fake fixture: this verifies plumbing, not topic-specific generation quality.
});
