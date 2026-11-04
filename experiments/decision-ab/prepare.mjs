import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export const refs={A:'73caf61d59287cf019c02daadded46b6d2a87a0f',B:'ac75a51009c3bd95cd3320eff0dc7f44442afaa4'};
export const input={topic:'大学阶段时间有限，应该优先投入绩点还是项目实践？',roleIds:['zhang_xuefeng','lei_jun','wang_defeng','du_sujuan'],rounds:4};
export const params={model:'deepseek-flash',stream:false,response_format:{type:'json_object'},max_tokens:4500,thinking:{type:'disabled'}};
export const limits={maxInputBytes:24000,reservedTokenLimit:30000,maxEstimatedUSD:.32,timeoutMs:45000,maxResponseBytes:65536};
export const sha=v=>createHash('sha256').update(v).digest('hex');
const root=resolve('experiments/decision-ab');
const sourceFiles=['backend/package.json','backend/src/prompt.js','backend/src/discussion.js','backend/src/validation.js','backend/src/errors.js','backend/data/roles.json','backend/data/discussion-guidance.json','backend/data/persona-speech-evidence.json'];
export async function prepare(){
 if(existsSync(root+'/manifest.json'))throw Error('FROZEN_MANIFEST_EXISTS');
 const manifest={study:'decision-evidence-20261104',preparedAt:new Date().toISOString(),input,params,limits,variants:{}};
 for(const [v,commit]of Object.entries(refs)){
  const files=[...sourceFiles,...(v==='B'?['backend/data/persona-decision-cases.json']:[])];const sourceHashes={};
  for(const file of files){const raw=execFileSync('git',['show',`${commit}:${file}`]);const dest=root+'/sources/'+v+'/'+file;mkdirSync(resolve(dest,'..'),{recursive:true});writeFileSync(dest,raw,{flag:'wx'});sourceHashes[file]=sha(raw);}
  const {buildMessages}=await import(pathToFileURL(root+'/sources/'+v+'/backend/src/prompt.js'));
  const roles=JSON.parse(readFileSync(root+'/sources/'+v+'/backend/data/roles.json','utf8'));const selected=input.roleIds.map(id=>roles.find(r=>r.id===id));
  const request={model:params.model,messages:buildMessages(input,selected),stream:params.stream,response_format:params.response_format,max_tokens:params.max_tokens,thinking:params.thinking};
  const serialized=JSON.stringify(request),requestBytes=Buffer.byteLength(serialized);
  if(requestBytes>limits.maxInputBytes)throw Error('INPUT_BUDGET');
  writeFileSync(root+`/request-${v}.json`,JSON.stringify(request,null,2)+'\n',{flag:'wx'});
  manifest.variants[v]={sourceCommit:commit,sourceHashes,requestSHA256:sha(serialized),requestBytes,reservedTokens:requestBytes+512+params.max_tokens,estimatedMaxUSD:((requestBytes+512)*.3+params.max_tokens*1.2)/1e6};
 }
 manifest.harnessHashes={};for(const file of ['prepare.mjs','runner.mjs','protocol.mjs','run-once.mjs'])manifest.harnessHashes[file]=sha(readFileSync(root+'/'+file));
 writeFileSync(root+'/manifest.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;
}
export function loadFrozen(variant){
 if(!Object.hasOwn(refs,variant))throw Error('VARIANT_REQUIRED');
 const manifest=JSON.parse(readFileSync(root+'/manifest.json','utf8')),metadata=manifest.variants[variant];
 for(const [file,hash]of Object.entries(metadata.sourceHashes))if(sha(readFileSync(root+'/sources/'+variant+'/'+file))!==hash)throw Error('SOURCE_DRIFT');
 for(const [file,hash]of Object.entries(manifest.harnessHashes))if(sha(readFileSync(root+'/'+file))!==hash)throw Error('HARNESS_DRIFT');
 const request=JSON.parse(readFileSync(root+`/request-${variant}.json`,'utf8'));if(sha(JSON.stringify(request))!==metadata.requestSHA256)throw Error('REQUEST_DRIFT');
 return {request,metadata:{...metadata,sourceHashes:{...metadata.sourceHashes,...manifest.harnessHashes}}};
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname)console.log(JSON.stringify(await prepare(),null,2));
