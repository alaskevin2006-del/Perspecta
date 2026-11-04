import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readJson} from '../../backend/src/validation.js';
import {params,limits} from './prepare.mjs';
import {validateVariant,speechMetrics} from './protocol.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
export async function runOnce({variant,request,metadata,reportDir,apiKey,fetchImpl=fetch,fakeOnly=false}){
 const serialized=JSON.stringify(request);const {messages,...actualParams}=request;
 if(sha(serialized)!==metadata.requestSHA256)throw Error('REQUEST_CHANGED');
 if(JSON.stringify(actualParams)!==JSON.stringify(params))throw Error('CONTROL_CHANGED');
 if(!['A','B'].includes(variant)||!Array.isArray(messages))throw Error('REQUEST_CHANGED');
 const requestBytes=Buffer.byteLength(serialized),reservedTokens=requestBytes+512+params.max_tokens;
 const estimatedMaxUSD=((requestBytes+512)*.3+params.max_tokens*1.2)/1e6;
 if(requestBytes>limits.maxInputBytes||reservedTokens>limits.reservedTokenLimit||estimatedMaxUSD>=limits.maxEstimatedUSD)throw Error('BUDGET_EXCEEDED');
 if(typeof apiKey!=='string'||!apiKey.trim())throw Error('KEY_REQUIRED');
 if(fakeOnly&&fetchImpl===fetch)throw Error('FAKE_FETCH_REQUIRED');
 mkdirSync(reportDir,{recursive:true,mode:0o700});
 const lock=reportDir+'/attempt.lock';if(existsSync(lock))throw Error('ATTEMPT_ALREADY_USED');
 try{writeFileSync(lock,new Date().toISOString(),{flag:'wx',mode:0o600});}catch{throw Error('ATTEMPT_ALREADY_USED');}
 const started=performance.now();
 const report={variant,runKind:fakeOnly?'FAKE_UPSTREAM_ONLY':'REAL_SINGLE_REQUEST',attempts:1,startedAt:new Date().toISOString(),requestSHA256:metadata.requestSHA256,sourceHashes:metadata.sourceHashes??{},codeCommit:metadata.codeCommit??null,requestBytes,reservedTokens,estimatedMaxUSD,upstreamStatus:null,usage:null,usageDetails:null,providerCost:null,outcome:'DISPATCHING',completed:false};
 const save=()=>writeFileSync(reportDir+'/report.json',JSON.stringify(report,null,2),{mode:0o600});save();
 try{
  const response=await fetchImpl('https://api.deepseek.com/chat/completions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(limits.timeoutMs),headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},body:serialized});
  report.upstreamStatus=response.status;
  if(!response.ok){await response.body?.cancel();report.outcome='UPSTREAM_HTTP_ERROR';return report;}
  let raw;try{raw=await readJson(response.body,limits.maxResponseBytes);}catch{report.outcome='INVALID_UPSTREAM_JSON';return report;}
  if(raw.usage!=null){
   const u=raw.usage;const valid=n=>Number.isSafeInteger(n)&&n>=0;
   if(valid(u.prompt_tokens)&&valid(u.completion_tokens)){
    report.usage={inputTokens:u.prompt_tokens,outputTokens:u.completion_tokens};
    const optional=n=>n==null?null:valid(n)?n:undefined;
    const direct=optional(u.prompt_cache_hit_tokens),nested=optional(u.prompt_tokens_details?.cached_tokens),hit=direct??nested,miss=optional(u.prompt_cache_miss_tokens),total=optional(u.total_tokens),reasoning=optional(u.completion_tokens_details?.reasoning_tokens);
    if([direct,nested,hit,miss,total,reasoning].includes(undefined)||(direct!==null&&nested!==null&&direct!==nested)||(hit!==null&&hit>u.prompt_tokens)||(miss!==null&&miss>u.prompt_tokens)||(hit!==null&&miss!==null&&hit+miss!==u.prompt_tokens)||(total!==null&&total!==u.prompt_tokens+u.completion_tokens)||(reasoning!==null&&reasoning>u.completion_tokens))report.accountingWarning='INVALID_USAGE_DETAILS';
    else report.usageDetails={cacheHitTokens:hit,cacheMissTokens:miss,totalTokens:total,reasoningTokens:reasoning};
   }else report.accountingWarning='INVALID_USAGE';
   if(typeof u.cost==='number'&&Number.isFinite(u.cost)&&u.cost>=0)report.providerCost=u.cost;
  }
  report.responseModel=typeof raw.model==='string'&&/^[a-zA-Z0-9_.-]{1,100}$/.test(raw.model)?raw.model:null;
  const choice=raw.choices?.[0];const content=choice?.message?.content;
  if(typeof content==='string'){
   if(content.includes(apiKey)){report.outcome='CONTENT_WITHHELD';return report;}
   writeFileSync(reportDir+'/raw-content.txt',content,{flag:'wx',mode:0o600});report.rawContentSHA256=sha(content);
  }
  if(choice?.finish_reason!=='stop'||choice?.message?.refusal||typeof content!=='string'){report.outcome='TRUNCATED_REFUSAL_OR_MISSING_CONTENT';return report;}
  try{
   const parsed=JSON.parse(content);const mapped=validateVariant(parsed,variant);
   writeFileSync(reportDir+'/raw-output.json',JSON.stringify(parsed,null,2),{flag:'wx',mode:0o600});
   writeFileSync(reportDir+'/mapped-output.json',JSON.stringify(mapped,null,2),{flag:'wx',mode:0o600});
   report.metrics=speechMetrics(mapped);report.outcome=report.accountingWarning?'INVALID_ACCOUNTING':'VALID';
  }catch{report.outcome='INVALID_OUTPUT';}
  return report;
 }catch{report.outcome='NETWORK_OR_TIMEOUT';return report;}
 finally{report.completed=true;report.finishedAt=new Date().toISOString();report.durationMs=Math.round(performance.now()-started);save();}
}
