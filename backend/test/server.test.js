import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

test('real HTTP adapter exposes all routes as UTF-8 JSON without transcript persistence', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => {server.close(resolve); server.closeAllConnections();}));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const route of ['roles', 'topics']) {
    const response = await fetch(`${base}/api/${route}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok((await response.json())[route].length > 0);
  }
  const response = await fetch(`${base}/api/debate`, {method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({topic:'大学阶段时间有限，应该优先投入绩点还是项目实践？', roleIds:['career_realist','risk_analyst']})});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).messages.length, 4);
});
