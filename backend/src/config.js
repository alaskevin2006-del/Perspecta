const integer = (env, name, fallback, min, max) => {
  const raw = env[name] ?? String(fallback);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < min || Number(raw) > max) throw new Error(`Invalid ${name}`);
  return Number(raw);
};

export function loadConfig(env = process.env) {
  const mode = env.DEBATE_MODE ?? 'mock';
  if (!['mock', 'live'].includes(mode)) throw new Error('Invalid DEBATE_MODE');
  const apiKey = env.LLM_API_KEY?.trim();
  const model = env.LLM_MODEL?.trim();
  if (mode === 'live' && (!apiKey || !model)) throw new Error('Live mode requires LLM_API_KEY and LLM_MODEL');
  const base = new URL(env.LLM_BASE_URL ?? 'https://api.openai.com/v1');
  if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) ||
    base.username || base.password || base.search || base.hash) throw new Error('Invalid LLM_BASE_URL');
  return {
    mode, apiKey, model, baseUrl: base.href.replace(/\/$/, ''),
    host: env.HOST || '127.0.0.1', port: integer(env, 'PORT', 3001, 1, 65535),
    timeoutMs: integer(env, 'LLM_TIMEOUT_MS', 45000, 1, 120000),
    maxOutputTokens: integer(env, 'LLM_MAX_OUTPUT_TOKENS', 3000, 128, 8000),
    sessionTokenBudget: integer(env, 'SESSION_TOKEN_BUDGET', 200000, 1, 10000000),
    sessionCallLimit: integer(env, 'SESSION_CALL_LIMIT', 100, 1, 10000),
    maxConcurrent: integer(env, 'MAX_CONCURRENT', 2, 1, 10),
    clientRate: integer(env, 'CLIENT_REQUESTS_PER_MINUTE', 5, 1, 100),
    globalRate: integer(env, 'GLOBAL_REQUESTS_PER_MINUTE', 20, 1, 1000),
    maxClients: 1000, windowMs: 60000, maxInputBytes: 24000, maxResponseBytes: 65536,
  };
}
