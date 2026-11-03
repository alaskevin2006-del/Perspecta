const definitions = {
  INVALID_INPUT: [400, '议题须为 10–300 字，角色须为 2–3 个不同的有效角色'],
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
