import { ApiError } from './errors.js';

export function createGuards(config, now = Date.now) {
  const clients = new Map();
  const active = new Set();
  let window = {start: now(), count: 0};
  let chargedTokens = 0;
  let calls = 0;
  let budgetStart = now();
  const pending = new Map();
  const refreshBudget = time => {
    if (config.budgetWindowMs > 0 && time - budgetStart >= config.budgetWindowMs) {
      budgetStart = time;
      chargedTokens = [...pending.values()].reduce((sum, value) => sum + value, 0);
      calls = pending.size;
    }
  };
  return {
    acquire(clientId, key, reservedTokens = 0) {
      const time = now();
      refreshBudget(time);
      for (const [id, entry] of clients) if (time - entry.start >= config.windowMs) clients.delete(id);
      if (time - window.start >= config.windowMs) window = {start: time, count: 0};
      const client = clients.get(clientId) ?? {start: time, count: 0};
      const reject = (reason, retryAfter = 60) => {throw new ApiError('RATE_LIMITED', {reason, retryAfter});};
      if (active.has(key)) reject('DUPLICATE_REQUEST');
      if (active.size >= config.maxConcurrent) reject('CONCURRENCY_LIMIT');
      if (client.count >= config.clientRate) reject('CLIENT_RATE_LIMIT', Math.ceil((client.start + config.windowMs - time) / 1000));
      if (window.count >= config.globalRate) reject('GLOBAL_RATE_LIMIT', Math.ceil((window.start + config.windowMs - time) / 1000));
      if (!clients.has(clientId) && clients.size >= config.maxClients) reject('CLIENT_CAPACITY');
      const budgetRetry = config.budgetWindowMs > 0 ? Math.ceil((budgetStart + config.budgetWindowMs - time) / 1000) : null;
      if (reservedTokens > 0 && calls >= config.sessionCallLimit) reject('SESSION_CALL_LIMIT', budgetRetry);
      if (reservedTokens > 0 && chargedTokens + reservedTokens > config.sessionTokenBudget) reject('SESSION_TOKEN_BUDGET', budgetRetry);
      clients.set(clientId, {start: client.start, count: client.count + 1});
      window.count++;
      active.add(key);
      chargedTokens += reservedTokens;
      if (reservedTokens > 0) {calls++; pending.set(key, reservedTokens);}
      let released = false;
      return (actualTokens) => {
        if (released) return;
        released = true;
        refreshBudget(now());
        active.delete(key);
        pending.delete(key);
        // Unknown/failed calls retain the full reservation: cancellation does not prove zero billing.
        if (actualTokens !== undefined) chargedTokens += actualTokens - reservedTokens;
      };
    },
  };
}
