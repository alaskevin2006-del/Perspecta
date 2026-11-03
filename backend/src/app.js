import { publicRoles, roles, topics } from './catalog.js';
import { mockDebate } from './mock.js';
import { readJson, validateInput } from './validation.js';
import { errorResponse } from './errors.js';

export function createApp() {
  return { async handle(request) {
    try {
      const path = new URL(request.url).pathname;
      const headers = {'Cache-Control': 'no-store', 'X-Perspecta-Mode': 'mock'};
      if (request.method === 'GET' && path === '/api/roles') return Response.json({roles: publicRoles}, {headers});
      if (request.method === 'GET' && path === '/api/topics') return Response.json({topics}, {headers});
      if (request.method === 'POST' && path === '/api/debate') {
        const input = validateInput(await readJson(request.body), roles);
        return Response.json(mockDebate(input), {headers});
      }
      return Response.json({error: {code: 'INTERNAL_ERROR', message: '接口不存在或请求方法不支持'}}, {status: 404, headers});
    } catch (error) { return errorResponse(error); }
  } };
}
