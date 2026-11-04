import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { loadConfig } from '../src/config.js';

export const topic = '大学阶段时间有限，应该优先投入绩点还是项目实践？';
export const roleIds = ['zhang_xuefeng', 'du_sujuan', 'lei_jun'];
const demo = JSON.parse(readFileSync(new URL('../data/demo-debate.json', import.meta.url)));
for (const message of demo.messages) message.roleId = ({career_realist:'zhang_xuefeng',growth_explorer:'du_sujuan',risk_analyst:'lei_jun'})[message.roleId];
export const core = () => structuredClone({messages: demo.messages, summary: demo.summary});
export const completion = (value = core(), usage = {prompt_tokens:120, completion_tokens:300}) => ({
  id:'upstream-test', object:'chat.completion', model:'test-model', choices:[{index:0, message:{role:'assistant', content:JSON.stringify(value)}, finish_reason:'stop'}],
  ...(usage === null ? {} : {usage}),
});
export function debateRequest(body = {topic, roleIds}, signal) {
  return new Request('http://localhost/api/debate', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), signal});
}
export async function upstream(t, respond) {
  const calls = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    calls.push({path:req.url, headers:req.headers, body:JSON.parse(body)});
    await respond(req, res, calls);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => {server.close(resolve); server.closeAllConnections();}));
  const config = {...loadConfig({}), mode:'live', apiKey:'test-key', model:'test-model',
    baseUrl:`http://127.0.0.1:${server.address().port}/v1`, clientRate:100, globalRate:100,
    sessionTokenBudget:1000000, timeoutMs:500};
  return {config, calls};
}
export const send = (res, value, status = 200) => {res.writeHead(status, {'Content-Type':'application/json'}); res.end(JSON.stringify(value));};
