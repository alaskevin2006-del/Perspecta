import{readFileSync,writeFileSync,existsSync,readdirSync}from'node:fs';
import{execFileSync}from'node:child_process';
import{resolve}from'node:path';
import{input,params,limits,sha}from'../decision-ab/prepare.mjs';
import{buildMessages}from'../../backend/src/prompt.js';
import{roles}from'../../backend/src/catalog.js';
const root=resolve('experiments/voice-fbdf116');
export function prepare(){
 if(existsSync(root+'/manifest.json'))throw Error('FROZEN_MANIFEST_EXISTS');
 const request={model:params.model,messages:buildMessages(input,input.roleIds.map(id=>roles.find(r=>r.id===id))),stream:params.stream,response_format:params.response_format,max_tokens:params.max_tokens,thinking:params.thinking};
 const body=JSON.stringify(request),requestBytes=Buffer.byteLength(body);if(requestBytes>limits.maxInputBytes)throw Error('INPUT_BUDGET');
 const paths=[...readdirSync('backend/src').filter(p=>p.endsWith('.js')).map(p=>'backend/src/'+p),...readdirSync('backend/data').filter(p=>p.endsWith('.json')).map(p=>'backend/data/'+p),'experiments/voice-fbdf116/freeze.mjs','experiments/voice-fbdf116/run-once.mjs','experiments/decision-ab/prepare.mjs','experiments/decision-ab/runner.mjs','experiments/decision-ab/protocol.mjs','experiments/decision-ab/sources/A/backend/src/validation.js','experiments/decision-ab/sources/A/backend/src/errors.js','experiments/decision-ab/sources/A/backend/src/discussion.js'];
 const manifest={studyVariant:'B3',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),personaCommit:'fbdf1168ad24682f23abf06f712291517a5a06f3',previousRequest:'natural-revisions/request-B2.json',preparedAt:new Date().toISOString(),input,params,limits,requestSHA256:sha(body),requestBytes,reservedTokens:requestBytes+512+params.max_tokens,estimatedMaxUSD:((requestBytes+512)*.3+params.max_tokens*1.2)/1e6,fileHashes:Object.fromEntries(paths.map(p=>[p,sha(readFileSync(p))]))};
 writeFileSync(root+'/request.json',JSON.stringify(request,null,2)+'\n',{flag:'wx'});writeFileSync(root+'/manifest.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;
}
export function loadFrozen(){
 const m=JSON.parse(readFileSync(root+'/manifest.json','utf8'));for(const[p,h]of Object.entries(m.fileHashes))if(sha(readFileSync(p))!==h)throw Error('SOURCE_OR_HARNESS_DRIFT');const request=JSON.parse(readFileSync(root+'/request.json','utf8'));if(sha(JSON.stringify(request))!==m.requestSHA256)throw Error('REQUEST_DRIFT');return{request,metadata:{...m,sourceHashes:m.fileHashes}};
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname)console.log(JSON.stringify(prepare(),null,2));
