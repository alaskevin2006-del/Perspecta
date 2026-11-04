import { ApiError, invalidModelOutput } from './errors.js';
import { readJson, validateOutput } from './validation.js';

const upstreamDiagnostic = status => ({400:'UPSTREAM_INVALID_REQUEST',401:'UPSTREAM_AUTH_FAILED',402:'UPSTREAM_INSUFFICIENT_BALANCE',
  422:'UPSTREAM_INVALID_REQUEST',429:'UPSTREAM_RATE_LIMITED'}[status] ?? 'UPSTREAM_UNAVAILABLE');

function accountingDetails(raw, usage) {
  const optional = value => {
    if (value == null) return null;
    if (!Number.isSafeInteger(value) || value < 0) throw invalidModelOutput('USAGE_INVALID','usage');
    return value;
  };
  const directHit = optional(raw.prompt_cache_hit_tokens);
  const nestedHit = optional(raw.prompt_tokens_details?.cached_tokens);
  if (directHit !== null && nestedHit !== null && directHit !== nestedHit) throw invalidModelOutput('USAGE_INVALID','usage');
  const details = {cacheHitTokens:directHit ?? nestedHit, cacheMissTokens:optional(raw.prompt_cache_miss_tokens),
    totalTokens:optional(raw.total_tokens), reasoningTokens:optional(raw.completion_tokens_details?.reasoning_tokens)};
  if ((details.cacheHitTokens !== null && details.cacheHitTokens > usage.inputTokens) ||
    (details.cacheMissTokens !== null && details.cacheMissTokens > usage.inputTokens) ||
    (details.cacheHitTokens !== null && details.cacheMissTokens !== null && details.cacheHitTokens + details.cacheMissTokens !== usage.inputTokens) ||
    (details.totalTokens !== null && details.totalTokens !== usage.inputTokens + usage.outputTokens) ||
    (details.reasoningTokens !== null && details.reasoningTokens > usage.outputTokens)) throw invalidModelOutput('USAGE_INVALID','usage');
  return details;
}

export async function generate(input, messages, config, signal, fetchImpl = fetch) {
  let usage = null;
  let usageDetails = null;
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
    try {raw = await readJson(response.body, config.maxResponseBytes);} catch {throw invalidModelOutput('UPSTREAM_JSON_INVALID','$');}
    providerCost = typeof raw?.usage?.cost === 'number' && Number.isFinite(raw.usage.cost) && raw.usage.cost >= 0 ? raw.usage.cost : null;
    if (raw?.usage != null) {
      const {prompt_tokens: inputTokens, completion_tokens: outputTokens} = raw.usage;
      if (![inputTokens, outputTokens].every(value => Number.isSafeInteger(value) && value >= 0)) throw invalidModelOutput('USAGE_INVALID','usage');
      usage = {inputTokens, outputTokens};
      usageDetails = accountingDetails(raw.usage, usage);
    }
    const choice = raw?.choices?.[0];
    if (choice?.finish_reason === 'length') throw invalidModelOutput('OUTPUT_TRUNCATED','choices[0].finish_reason');
    if (choice?.message?.refusal) throw invalidModelOutput('OUTPUT_REFUSED','choices[0].message.refusal');
    if (choice?.finish_reason !== 'stop' || typeof choice?.message?.content !== 'string') throw invalidModelOutput('OUTPUT_STRUCTURE','choices[0].message');
    let output;
    try {output = JSON.parse(choice.message.content);} catch {throw invalidModelOutput('CONTENT_JSON_INVALID','choices[0].message.content');}
    return {...validateOutput(output, input.roleIds, {rounds:input.rounds??2}), usage, usageDetails, providerCost, upstreamStatus, upstreamError};
  } catch (error) {
    const safe = signal.aborted ? new ApiError('MODEL_TIMEOUT') : error instanceof ApiError ? error : new ApiError('INTERNAL_ERROR');
    safe.telemetry = {usage, usageDetails, providerCost, upstreamStatus, upstreamError};
    throw safe;
  }
}
