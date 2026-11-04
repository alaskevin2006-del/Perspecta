import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

// Exported developer credentials must never change a contract test into a billed call.
const createMockApp = () => createApp({config:loadConfig({}), fetchImpl:() => {throw new Error('Provider calls forbidden in mock contract tests');}});

const topic = '大学阶段时间有限，应该优先投入绩点还是项目实践？';
const ids = ['career_realist', 'growth_explorer', 'risk_analyst'];
const request = (body, path = '/api/debate', method = 'POST') => new Request(`http://localhost${path}`, {
  method, ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
});

test('role cards expose exactly the locked five fields', async () => {
  const response = await createMockApp().handle(request(null, '/api/roles', 'GET'));
  assert.equal(response.status, 200);
  const { roles } = await response.json();
  assert.deepEqual(roles.map(r => r.id), [...ids, 'zhang_xuefeng', 'du_sujuan', 'lei_jun', 'wang_defeng']);
  for (const role of roles) assert.deepEqual(Object.keys(role).sort(), ['avatar', 'description', 'id', 'name', 'tagline']);
  assert.equal(roles[0].avatar, 'career');
});

test('recommended topics preserve documented IDs and prompts', async () => {
  const response = await createMockApp().handle(request(null, '/api/topics', 'GET'));
  assert.equal(response.status, 200);
  const { topics } = await response.json();
  assert.deepEqual(topics.map(t => t.id), ['postgraduate_or_work', 'gpa_or_projects', 'stability_or_exploration']);
  assert.equal(topics[1].prompt, topic);
});

for (const roleIds of [ids, ['risk_analyst', 'growth_explorer'], ['career_realist', 'risk_analyst'], ['growth_explorer', 'career_realist']]) {
  test(`mock returns two valid rounds for ${roleIds.join(',')}`, async () => {
    const response = await createMockApp().handle(request({ topic: `  ${topic}  `, roleIds }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Perspecta-Mode'), 'mock');
    const result = await response.json();
    assert.deepEqual(Object.keys(result).sort(), ['discussionId', 'messages', 'summary', 'topic', 'usage']);
    assert.equal(result.discussionId, 'demo-001');
    assert.equal(result.topic, topic);
    assert.equal(result.messages.length, roleIds.length * 2);
    assert.deepEqual(result.messages.map(m => m.roleId), [...roleIds, ...roleIds]);
    const first = result.messages.slice(0, roleIds.length);
    for (const m of first) { assert.equal(m.round, 1); assert.equal(m.replyTo, null); }
    for (const m of result.messages.slice(roleIds.length)) {
      assert.equal(m.round, 2);
      assert.ok(first.some(f => f.id === m.replyTo && f.roleId !== m.roleId));
    }
    assert.deepEqual(Object.keys(result.summary).sort(), ['consensus', 'decisionFactors', 'disagreements', 'nextActions']);
    for (const values of Object.values(result.summary)) assert.ok(values.length > 0);
    assert.deepEqual(result.usage, { inputTokens: 0, outputTokens: 0 });
  });
}

test('invalid inputs always use INVALID_INPUT before generation', async () => {
  for (const body of [null, [], true, {topic, roleIds: ['career_realist']}, {topic, roleIds: ['career_realist', 'career_realist']},
    {topic, roleIds: ['career_realist', '__proto__']}, {topic: '短', roleIds: ids}, {topic: '字'.repeat(301), roleIds: ids}, {topic, roleIds: 'bad'}]) {
    const response = await createMockApp().handle(request(body));
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal((await response.json()).error.code, 'INVALID_INPUT');
  }
});

test('topic boundaries count Unicode code points after trimming', async () => {
  for (const text of ['字'.repeat(10), '字'.repeat(300), '😀'.repeat(300)]) {
    const response = await createMockApp().handle(request({topic: text, roleIds: ids}));
    assert.equal(response.status, 200);
  }
});

test('malformed JSON and oversized bytes return JSON input errors', async () => {
  for (const body of ['{broken', ' '.repeat(20000)]) {
    const response = await createMockApp().handle(new Request('http://localhost/api/debate', {method:'POST', body}));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'INVALID_INPUT');
  }
});

test('invalid UTF-8 is rejected instead of silently replacing characters', async () => {
  const response=await createMockApp().handle(new Request('http://localhost/api/debate', {method:'POST', body:new Uint8Array([0xff,0xfe])}));
  assert.equal(response.status,400);
});
