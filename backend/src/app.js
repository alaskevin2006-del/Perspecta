import { publicRoles, roles, topics } from './catalog.js';
import { mockDebate } from './mock.js';
import { readJson, validateInput, validateOutput } from './validation.js';
import { ApiError, errorResponse } from './errors.js';
import { createHash, randomUUID } from 'node:crypto';
import { loadConfig } from './config.js';
import { createGuards } from './guards.js';
import { buildMessages } from './prompt.js';
import { generate } from './model.js';

export function createApp({config = loadConfig(), logger = event => console.log(JSON.stringify(event)), now = Date.now, fetchImpl = fetch} = {}) {
  const guards = createGuards(config, now);
  return { async handle(request, {clientId = 'local'} = {}) {
    try {
      const path = new URL(request.url).pathname;
      const headers = {'Cache-Control': 'no-store', 'X-Perspecta-Mode': config.mode};
      if (request.method === 'GET' && path === '/api/roles') return Response.json({roles: publicRoles}, {headers});
      if (request.method === 'GET' && path === '/api/topics') return Response.json({topics}, {headers});
      if (request.method === 'POST' && path === '/api/debate') {
        const input = validateInput(await readJson(request.body), roles);
        const selected = input.roleIds.map(id => roles.find(role => role.id === id));
        const messages = buildMessages(input, selected);
        const generationConfig = input.rounds>=3 ? {...config,maxOutputTokens:config.debateMaxOutputTokens??config.maxOutputTokens} : config;
        const bytes = Buffer.byteLength(JSON.stringify(messages));
        if (bytes > config.maxInputBytes) throw new ApiError('INVALID_INPUT');
        const key = createHash('sha256').update(JSON.stringify({topic:input.topic, roleIds:[...input.roleIds].sort(),rounds:input.rounds})).digest('hex');
        const release = guards.acquire(clientId, key, config.mode === 'live' ? bytes + 512 + generationConfig.maxOutputTokens : 0);
        const start = now();
        const discussionId = randomUUID();
        let actualTokens;
        let usage = null;
        let usageDetails = null;
        let providerCost = null;
        let upstreamStatus = null;
        let upstreamError = null;
        let outcome = 'success';
        try {
          if (config.mode === 'mock') {
            const result = mockDebate(input);
            validateOutput({messages:result.messages, summary:result.summary}, input.roleIds, {rounds:input.rounds});
            return Response.json(result, {headers});
          }
          const signal = AbortSignal.any([request.signal, AbortSignal.timeout(config.timeoutMs)]);
          const result = await generate(input, messages, generationConfig, signal, fetchImpl);
          usage = result.usage;
          usageDetails = result.usageDetails;
          providerCost = result.providerCost;
          upstreamStatus = result.upstreamStatus;
          upstreamError = result.upstreamError;
          if (usage) actualTokens = usage.inputTokens + usage.outputTokens;
          return Response.json({discussionId, topic:input.topic, messages:result.messages, summary:result.summary, usage}, {headers});
        } catch (error) {
          outcome = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
          if (error instanceof ApiError && error.telemetry) {
            ({usage, usageDetails, providerCost, upstreamStatus, upstreamError} = error.telemetry);
            if (usage) actualTokens = usage.inputTokens + usage.outputTokens;
          }
          throw error;
        } finally {
          release(actualTokens);
          if (config.mode === 'live') {
            // Do not include prompts, roles, provider bodies, keys or client addresses.
            try {logger({event:'debate_call', discussionId, mode:config.mode, provider:config.provider, model:config.model,
              durationMs:now()-start, outcome, usage, usageDetails, providerCost, upstreamStatus, upstreamError});} catch { /* logging must not affect delivery */ }
          }
        }
      }
      return Response.json({error: {code: 'INTERNAL_ERROR', message: '接口不存在或请求方法不支持'}}, {status: 404, headers});
    } catch (error) { return errorResponse(error); }
  } };
}
