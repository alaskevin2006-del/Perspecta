import { readJson } from '../src/validation.js';

const fail = (code, httpStatus) => {throw Object.assign(new Error(code),{code,httpStatus});};
const fields = (value,names) => value!==null && typeof value==='object' && !Array.isArray(value) &&
  Object.keys(value).length===names.length && names.every(name=>typeof value[name]==='string'&&value[name].trim().length>0);
try {
  let base;
  try {base=new URL(process.env.API_BASE_URL||'http://127.0.0.1:3001');}catch{fail('INVALID_HEALTH_TARGET');}
  if ((base.protocol!=='https:' && !(base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname))) ||
    base.username || base.password || base.search || base.hash || base.pathname!=='/') fail('INVALID_HEALTH_TARGET');
  let mode;
  const counts={};
  // Only these two GET endpoints are reachable. There is no generation or credential path.
  for (const route of ['roles','topics']) {
    const response=await fetch(new URL(`/api/${route}`,base),{method:'GET',redirect:'error',signal:AbortSignal.timeout(5000)});
    try {
      if (!response.ok) fail('HEALTH_HTTP_ERROR',response.status);
      const currentMode=response.headers.get('x-perspecta-mode');
      if (!['mock','live'].includes(currentMode) || !response.headers.get('cache-control')?.includes('no-store')) fail('HEALTH_CONTRACT_ERROR');
      if (mode && mode!==currentMode) fail('HEALTH_MODE_MISMATCH');
      mode=currentMode;
      let body;
      try {body=await readJson(response.body,65536);}catch{fail('HEALTH_CONTRACT_ERROR');}
      const values=body?.[route];
      const names=route==='roles'?['id','name','tagline','description','avatar']:['id','title','prompt'];
      if (!Array.isArray(values) || values.length<(route==='roles'?2:1) || values.some(value=>!fields(value,names)) ||
        new Set(values.map(value=>value.id)).size!==values.length) fail('HEALTH_CONTRACT_ERROR');
      if (route==='topics' && values.some(value=>[...value.prompt.trim()].length<10||[...value.prompt.trim()].length>300)) fail('HEALTH_CONTRACT_ERROR');
      counts[route]=values.length;
    } finally {
      if (response.body && !response.body.locked) {try {await response.body.cancel();}catch{ /* failed/closed body */ }}
    }
  }
  console.log(JSON.stringify({result:'PASS',mode,roles:counts.roles,topics:counts.topics,generationRequests:0,providerConnectivityTested:false}));
} catch(error) {
  const codes=new Set(['INVALID_HEALTH_TARGET','HEALTH_HTTP_ERROR','HEALTH_CONTRACT_ERROR','HEALTH_MODE_MISMATCH']);
  console.log(JSON.stringify({result:'FAIL',code:codes.has(error?.code)?error.code:'HEALTH_TRANSPORT_ERROR',
    ...(Number.isInteger(error?.httpStatus)?{httpStatus:error.httpStatus}:{})}));
  process.exitCode=1;
}
