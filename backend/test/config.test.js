import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

test('mock is the explicit safe default and live requires key and model', () => {
  assert.equal(loadConfig({}).mode, 'mock');
  for (const env of [{DEBATE_MODE:'unknown'}, {DEBATE_MODE:'live'}, {DEBATE_MODE:'live', LLM_API_KEY:'test'}]) {
    assert.throws(() => loadConfig(env));
  }
});

test('configuration rejects unsafe URLs and malformed or unbounded numbers', () => {
  for (const env of [{LLM_TIMEOUT_MS:'0'}, {LLM_MAX_OUTPUT_TOKENS:'NaN'}, {MAX_CONCURRENT:'-1'}, {PORT:'65536'},
    {LLM_BASE_URL:'http://remote.example/v1'}, {LLM_BASE_URL:'https://user:password@example.com/v1'},
    {LLM_MAX_OUTPUT_TOKENS:'9999999'}, {SESSION_TOKEN_BUDGET:'-20'}]) assert.throws(() => loadConfig(env), JSON.stringify(env));
  assert.equal(loadConfig({LLM_BASE_URL:'http://127.0.0.1:1234/v1'}).baseUrl, 'http://127.0.0.1:1234/v1');
});

test('malformed base URL errors never retain the supplied configuration value',()=>{
  const sentinel='not-a-url-SYNTHETIC_PRIVATE_VALUE';
  let error;
  try{loadConfig({LLM_BASE_URL:sentinel});}catch(caught){error=caught;}
  assert.ok(error);
  assert.ok(![error.message,error.stack,JSON.stringify(error)].join('\n').includes(sentinel));
});
