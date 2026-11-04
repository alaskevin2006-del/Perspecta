import { ApiError } from './errors.js';

export function createGuards(config, now = Date.now) {
  const clients = new Map();
  const active = new Set();
  let window = {start: now(), count: 0};
  let chargedTokens = 0;
  let calls = 0;
  return {
    acquire(clientId, key, reservedTokens = 0) {
      const time = now();
      for (const [id, entry] of clients) if (time - entry.start >= config.windowMs) clients.delete(id);
      if (time - window.start >= config.windowMs) window = {start: time, count: 0};
      const client = clients.get(clientId) ?? {start: time, count: 0};
      if (active.has(key) || active.size >= config.maxConcurrent || client.count >= config.clientRate || window.count >= config.globalRate ||
        (!clients.has(clientId) && clients.size >= config.maxClients) ||
        (reservedTokens > 0 && (calls >= config.sessionCallLimit || chargedTokens + reservedTokens > config.sessionTokenBudget))) throw new ApiError('RATE_LIMITED');
      clients.set(clientId, {start: client.start, count: client.count + 1});
      window.count++;
      active.add(key);
      chargedTokens += reservedTokens;
      if (reservedTokens > 0) calls++;
      let released = false;
      return (actualTokens) => {
        if (released) return;
        released = true;
        active.delete(key);
        // Unknown/failed calls retain the full reservation: cancellation does not prove zero billing.
        if (actualTokens !== undefined) chargedTokens += actualTokens - reservedTokens;
      };
    },
  };
}
