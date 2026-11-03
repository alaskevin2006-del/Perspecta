import { ApiError } from './errors.js';
import { readJson, validateOutput } from './validation.js';

export async function generate(input, messages, config, signal, fetchImpl = fetch) {
  let usage = null;
  let providerCost = null;
  try {
    const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: 'POST', signal, redirect: 'error',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}`},
      body: JSON.stringify({model: config.model, messages, stream: false, response_format: {type: 'json_object'}, max_completion_tokens: config.maxOutputTokens}),
    });
    if (!response.ok) {
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
    return {...validateOutput(output, input.roleIds), usage, providerCost};
  } catch (error) {
    const safe = signal.aborted ? new ApiError('MODEL_TIMEOUT') : error instanceof ApiError ? error : new ApiError('INTERNAL_ERROR');
    safe.telemetry = {usage, providerCost};
    throw safe;
  }
}
