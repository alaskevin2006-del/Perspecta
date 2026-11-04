import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { loadConfig } from '../src/config.js';

export const topic = '大学阶段时间有限，应该优先投入绩点还是项目实践？';
export const roleIds = ['career_realist', 'growth_explorer', 'risk_analyst'];
const demo = JSON.parse(readFileSync(new URL('../data/demo-debate.json', import.meta.url)));
export const core = () => structuredClone({messages: demo.messages, summary: demo.summary});
// Fake upstream replies use the current three-round contract; legacy fixture remains untouched.
export const completion = (value = core(), usage = {prompt_tokens:120, completion_tokens:300}) => {
  value=structuredClone(value);
  const first=value.messages.filter(m=>m.round===1), second=value.messages.filter(m=>m.round===2);
  if (first.length>=2 && first.length===second.length && value.messages.length===first.length*2) {
    for (const [i,m] of first.entries()) value.messages.push({id:`test-r3-${i}`,round:3,roleId:m.roleId,
      content:'针对此前的观点，我们还要考虑具体条件并据此调整选择。',replyTo:second[(i+1)%first.length].id});
  }
  return {id:'upstream-test', object:'chat.completion', model:'test-model', choices:[{index:0, message:{role:'assistant', content:JSON.stringify(value)}, finish_reason:'stop'}],
    ...(usage === null ? {} : {usage})};
};
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
