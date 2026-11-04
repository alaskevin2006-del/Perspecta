import{readFileSync,writeFileSync,existsSync}from'node:fs';
import{resolve}from'node:path';
import{input,params,limits,sha}from'../decision-ab/prepare.mjs';
import{buildRevision}from'./builders.mjs';
import{roles}from'../../backend/src/catalog.js';
const root=resolve('experiments/natural-revisions');
const aSource='1c3b424288250cd7c17897c5646f36c4092c1571',bSource='ac75a51009c3bd95cd3320eff0dc7f44442afaa4';
const current=['backend/src/prompt.js','backend/src/quality.js','backend/src/discussion.js','backend/src/validation.js','backend/src/errors.js','backend/src/catalog.js','backend/data/roles.json','backend/data/discussion-guidance.json','backend/data/persona-speech-evidence.json','backend/data/demo-debate.json','backend/data/topics.json'];
const harness=['experiments/natural-revisions/builders.mjs','experiments/natural-revisions/prepare.mjs','experiments/natural-revisions/run-once.mjs','experiments/decision-ab/prepare.mjs','experiments/decision-ab/runner.mjs','experiments/decision-ab/protocol.mjs','experiments/decision-ab/sources/A/backend/src/validation.js','experiments/decision-ab/sources/A/backend/src/errors.js','experiments/decision-ab/sources/A/backend/src/discussion.js'];
export function prepare(){
 if(existsSync(root+'/manifest.json'))throw Error('FROZEN_MANIFEST_EXISTS');
 const old=JSON.parse(readFileSync('experiments/decision-ab/manifest.json','utf8'));const paths=[...current,...harness,...Object.keys(old.variants.B.sourceHashes).map(p=>'experiments/decision-ab/sources/B/'+p)];
 const manifest={study:'natural-revisions-20261104',preparedAt:new Date().toISOString(),input,params,limits,A2Source:aSource,B2Sources:[bSource,aSource],fileHashes:Object.fromEntries(paths.map(p=>[p,sha(readFileSync(p))])),variants:{}};
 const selected=input.roleIds.map(id=>roles.find(r=>r.id===id));
 for(const v of ['A2','B2']){
  const request={model:params.model,messages:buildRevision(v,input,selected),stream:params.stream,response_format:params.response_format,max_tokens:params.max_tokens,thinking:params.thinking};const raw=JSON.stringify(request),bytes=Buffer.byteLength(raw);if(bytes>limits.maxInputBytes)throw Error('INPUT_BUDGET');
  manifest.variants[v]={requestSHA256:sha(raw),requestBytes:bytes,reservedTokens:bytes+512+params.max_tokens,estimatedMaxUSD:((bytes+512)*.3+params.max_tokens*1.2)/1e6};writeFileSync(root+`/request-${v}.json`,JSON.stringify(request,null,2)+'\n',{flag:'wx'});
 }
 writeFileSync(root+'/manifest.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;
}
export function loadFrozen(v){
 if(!['A2','B2'].includes(v))throw Error('VARIANT_REQUIRED');const m=JSON.parse(readFileSync(root+'/manifest.json','utf8'));for(const [p,h]of Object.entries(m.fileHashes))if(sha(readFileSync(p))!==h)throw Error('SOURCE_OR_HARNESS_DRIFT');
 const request=JSON.parse(readFileSync(root+`/request-${v}.json`,'utf8')),metadata={...m.variants[v],sourceHashes:m.fileHashes};if(sha(JSON.stringify(request))!==metadata.requestSHA256)throw Error('REQUEST_DRIFT');return{request,metadata};
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname)console.log(JSON.stringify(prepare(),null,2));
