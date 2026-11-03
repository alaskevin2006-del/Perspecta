import { ApiError } from './errors.js';

export async function readJson(stream, limit = 8192) {
  if (!stream) throw new ApiError('INVALID_INPUT');
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new ApiError('INVALID_INPUT');
      }
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks)));
  } catch {
    throw new ApiError('INVALID_INPUT');
  } finally { reader.releaseLock(); }
}

export function validateInput(body, roles) {
  const validIds = new Set(roles.map(role => role.id));
  if (!body || Array.isArray(body) || typeof body !== 'object' || typeof body.topic !== 'string') throw new ApiError('INVALID_INPUT');
  const topic = body.topic.trim();
  const roleIds = body.roleIds;
  if ([...topic].length < 10 || [...topic].length > 300 || !Array.isArray(roleIds) || roleIds.length < 2 || roleIds.length > 3 ||
    new Set(roleIds).size !== roleIds.length || roleIds.some(id => typeof id !== 'string' || !validIds.has(id))) throw new ApiError('INVALID_INPUT');
  return {topic, roleIds};
}
