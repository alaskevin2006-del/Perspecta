const definitions = {
  INVALID_INPUT: [400, '议题须为 2–300 字，角色须为 2–4 个不同的有效角色'],
  RATE_LIMITED: [429, '模型服务繁忙，请稍后重试'],
  INVALID_MODEL_OUTPUT: [502, '讨论结果格式不符合要求，请重试'],
  MODEL_TIMEOUT: [504, '讨论生成超时，请重试'],
  INTERNAL_ERROR: [500, '讨论生成失败，请稍后重试'],
};
const limitMessages = {
  DUPLICATE_REQUEST: '相同议题正在生成，请等待本次讨论完成',
  CONCURRENCY_LIMIT: '当前讨论人数较多，请稍后再试',
  CLIENT_RATE_LIMIT: '请求过于频繁，请稍后重试',
  GLOBAL_RATE_LIMIT: '当前请求较多，请稍后重试',
  CLIENT_CAPACITY: '当前访问人数较多，请稍后重试',
  SESSION_CALL_LIMIT: '本站本时段生成次数已达上限',
  SESSION_TOKEN_BUDGET: '本站本时段用量保护已触发',
};

export class ApiError extends Error {
  constructor(code, {reason, retryAfter = 60} = {}) {
    const [status, message] = definitions[code] ?? definitions.INTERNAL_ERROR;
    super(message);
    this.code = code in definitions ? code : 'INTERNAL_ERROR';
    this.status = status;
    if (code === 'RATE_LIMITED' && Object.hasOwn(limitMessages, reason)) {
      this.guardReason = reason;
      this.retryAfter = retryAfter === null ? null : Math.max(1, Math.ceil(retryAfter));
      this.message = limitMessages[reason] + (reason.startsWith('SESSION_') ?
        (this.retryAfter === null ? '，请联系管理员；这不表示模型账户余额不足' : `，约 ${this.retryAfter} 秒后自动恢复；这不表示模型账户余额不足`) : '');
    }
  }
}

export function errorResponse(error) {
  const safe = error instanceof ApiError ? error : new ApiError('INTERNAL_ERROR');
  return Response.json({error: {code: safe.code, message: safe.message}}, {
    status: safe.status,
    headers: { 'Cache-Control': 'no-store', ...(safe.status === 429 && safe.retryAfter !== null ? {'Retry-After': String(safe.retryAfter ?? 60)} : {}) },
  });
}

// Only allow fixed categories and schema paths. Never accept provider text or keys.
const outputReasons = new Set(['OUTPUT_TRUNCATED','OUTPUT_REFUSED','UPSTREAM_JSON_INVALID','CONTENT_JSON_INVALID',
  'USAGE_INVALID','OUTPUT_STRUCTURE','MESSAGE_STRUCTURE','MESSAGE_COUNT','MESSAGE_CONTENT','REFERENCE_INVALID',
  'QUOTE_MISMATCH','SUMMARY_COUNT','SUMMARY_CONTENT','ROUND_COVERAGE','DUPLICATE_CONTENT']);
const outputPath = /^(?:\$|usage|choices\[0\]\.(?:finish_reason|message(?:\.(?:content|refusal))?)|messages(?:\[\d{1,2}\](?:\.(?:replyTo|content))?)?|summary(?:\.(?:consensus|disagreements|decisionFactors|nextActions))?)$/;
export function invalidModelOutput(reason = 'OUTPUT_STRUCTURE', path = '$') {
  const error = new ApiError('INVALID_MODEL_OUTPUT');
  error.outputDiagnostic = Object.freeze({reason:outputReasons.has(reason)?reason:'OUTPUT_STRUCTURE',
    path:typeof path==='string'&&outputPath.test(path)?path:'$'});
  return error;
}
