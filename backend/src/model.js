import { ApiError } from './errors.js';
import { readJson, validateOutput } from './validation.js';

const upstreamDiagnostic = status => ({400:'UPSTREAM_INVALID_REQUEST',401:'UPSTREAM_AUTH_FAILED',402:'UPSTREAM_INSUFFICIENT_BALANCE',
  422:'UPSTREAM_INVALID_REQUEST',429:'UPSTREAM_RATE_LIMITED'}[status] ?? 'UPSTREAM_UNAVAILABLE');

export async function generate(input, messages, config, signal, fetchImpl = fetch) {
  let usage = null;
  let providerCost = null;
  let upstreamStatus = null;
  let upstreamError = null;
  try {
    const outputLimit = config.provider === 'deepseek'
      ? {max_tokens: config.maxOutputTokens, thinking: {type: 'disabled'}}
      : {max_completion_tokens: config.maxOutputTokens};
    const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: 'POST', signal, redirect: 'error',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}`},
      body: JSON.stringify({model: config.model, messages, stream: false, response_format: {type: 'json_object'}, ...outputLimit}),
    });
    upstreamStatus = response.status;
    if (!response.ok) {
      upstreamError = upstreamDiagnostic(response.status);
      await response.body?.cancel();
      throw new ApiError(response.status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR');
    }
    let raw;
    try {raw = await readJson(response.body, config.maxResponseBytes);} catch {throw new ApiError('INVALID_MODEL_OUTPUT');}
    if (raw?.usage != null) {
      const {prompt_tokens: inputTokens, completion_tokens: outputTokens} = raw.usage;
      if (![inputTokens, outputTokens].every(value => Number.isSafeInteger(value) && value >= 0)) throw new ApiError('INVALID_MODEL_OUTPUT');
      usage = {inputTokens, outputTokens};
    }
    providerCost = typeof raw?.usage?.cost === 'number' && Number.isFinite(raw.usage.cost) && raw.usage.cost >= 0 ? raw.usage.cost : null;
    const choice = raw?.choices?.[0];
    if (choice?.finish_reason !== 'stop' || choice?.message?.refusal || typeof choice?.message?.content !== 'string') throw new ApiError('INVALID_MODEL_OUTPUT');
    let output;
    try {output = JSON.parse(choice.message.content);} catch {throw new ApiError('INVALID_MODEL_OUTPUT');}
    return {...validateOutput(output, input.roleIds), usage, providerCost, upstreamStatus, upstreamError};
  } catch (error) {
    const safe = signal.aborted ? new ApiError('MODEL_TIMEOUT') : error instanceof ApiError ? error : new ApiError('INTERNAL_ERROR');
    safe.telemetry = {usage, providerCost, upstreamStatus, upstreamError};
    throw safe;
  }
}
