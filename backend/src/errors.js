const definitions = {
  INVALID_INPUT: [400, '议题须为 10–300 字，角色须为 2–4 个不同的有效角色'],
  RATE_LIMITED: [429, '请求过于频繁或服务额度已用完，请稍后重试'],
  INVALID_MODEL_OUTPUT: [502, '讨论结果格式不符合要求，请重试'],
  MODEL_TIMEOUT: [504, '讨论生成超时，请重试'],
  INTERNAL_ERROR: [500, '讨论生成失败，请稍后重试'],
};

export class ApiError extends Error {
  constructor(code) {
    const [status, message] = definitions[code] ?? definitions.INTERNAL_ERROR;
    super(message);
    this.code = code in definitions ? code : 'INTERNAL_ERROR';
    this.status = status;
  }
}

export function errorResponse(error) {
  const safe = error instanceof ApiError ? error : new ApiError('INTERNAL_ERROR');
  return Response.json({error: {code: safe.code, message: safe.message}}, {
    status: safe.status,
    headers: { 'Cache-Control': 'no-store', ...(safe.status === 429 ? {'Retry-After': '60'} : {}) },
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
