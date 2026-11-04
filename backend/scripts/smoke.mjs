import assert from 'node:assert/strict';

const base = process.env.API_BASE_URL || 'http://127.0.0.1:3001';
const get = async path => {
  const response = await fetch(`${base}${path}`, {signal:AbortSignal.timeout(5000)});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return {value:await response.json(), mode:response.headers.get('x-perspecta-mode')};
};
const {value:{roles},mode} = await get('/api/roles');
const {value:{topics}} = await get('/api/topics');
assert.ok(roles.length >= 2 && topics.length >= 1);
if (mode !== 'mock' && !process.argv.includes('--live')) throw new Error('Live service detected. Pass --live explicitly to allow one billed generation.');
const roleIds=roles.slice(0,3).map(role=>role.id);
const topic=topics[Math.min(1,topics.length-1)].prompt;
const response=await fetch(`${base}/api/debate`, {method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({topic,roleIds}),signal:AbortSignal.timeout(125000)});
assert.equal(response.status,200);
const result=await response.json();
assert.equal(result.topic,topic);
assert.ok([2,3].includes(result.messages.length/roleIds.length));
for (const [i,m] of result.messages.entries()) {
 assert.equal(m.round,Math.floor(i/roleIds.length)+1);
 if(m.round===1) assert.equal(m.replyTo,null);
 else assert.ok(result.messages.slice(0,i).some(p=>p.id===m.replyTo && p.roleId!==m.roleId));
}
for (const key of ['consensus','disagreements','decisionFactors','nextActions']) assert.ok(Array.isArray(result.summary[key]) && result.summary[key].length>0);
console.log(JSON.stringify({result:'PASS',mode,endpoints:3,roles:roles.length,topics:topics.length,messages:result.messages.length}));
