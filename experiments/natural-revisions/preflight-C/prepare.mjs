import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {input,params,limits,sha} from '../decision-ab/prepare.mjs';
export const sourceCommit='8f1b3301b5d9e56b549577a4b6dc8281c800274a';
const root=resolve('experiments/natural-C');
const files=['backend/package.json','backend/src/prompt.js','backend/src/discussion.js','backend/src/validation.js','backend/src/errors.js','backend/src/quality.js','backend/data/roles.json','backend/data/discussion-guidance.json','backend/data/persona-speech-evidence.json'];
const harness=['experiments/natural-C/prepare.mjs','experiments/natural-C/run-once.mjs','experiments/decision-ab/prepare.mjs','experiments/decision-ab/runner.mjs','experiments/decision-ab/protocol.mjs','experiments/decision-ab/sources/A/backend/src/validation.js','experiments/decision-ab/sources/A/backend/src/errors.js','experiments/decision-ab/sources/A/backend/src/discussion.js'];
export async function prepare(){
 if(existsSync(root+'/manifest.json'))throw Error('FROZEN_MANIFEST_EXISTS');
 const sourceHashes={};for(const path of files){const raw=execFileSync('git',['show',`${sourceCommit}:${path}`]);const dest=root+'/source/'+path;mkdirSync(resolve(dest,'..'),{recursive:true});writeFileSync(dest,raw,{flag:'wx'});sourceHashes[path]=sha(raw);}
 const {buildMessages}=await import(pathToFileURL(root+'/source/backend/src/prompt.js'));
 const roles=JSON.parse(readFileSync(root+'/source/backend/data/roles.json','utf8'));const selected=input.roleIds.map(id=>roles.find(r=>r.id===id));
 const request={model:params.model,messages:buildMessages(input,selected),stream:params.stream,response_format:params.response_format,max_tokens:params.max_tokens,thinking:params.thinking};
 const serialized=JSON.stringify(request),requestBytes=Buffer.byteLength(serialized);if(requestBytes>limits.maxInputBytes)throw Error('INPUT_BUDGET');
 const manifest={studyVariant:'C',sourceCommit,preparedAt:new Date().toISOString(),input,params,limits,sourceHashes,harnessHashes:Object.fromEntries(harness.map(path=>[path,sha(readFileSync(path))])),requestSHA256:sha(serialized),requestBytes,reservedTokens:requestBytes+512+params.max_tokens,estimatedMaxUSD:((requestBytes+512)*.3+params.max_tokens*1.2)/1e6};
 writeFileSync(root+'/request.json',JSON.stringify(request,null,2)+'\n',{flag:'wx'});writeFileSync(root+'/manifest.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;
}
export function loadFrozen(){
 const metadata=JSON.parse(readFileSync(root+'/manifest.json','utf8'));
 for(const [path,hash]of Object.entries(metadata.sourceHashes))if(sha(readFileSync(root+'/source/'+path))!==hash)throw Error('SOURCE_DRIFT');
 for(const [path,hash]of Object.entries(metadata.harnessHashes))if(sha(readFileSync(path))!==hash)throw Error('HARNESS_DRIFT');
 const request=JSON.parse(readFileSync(root+'/request.json','utf8'));if(sha(JSON.stringify(request))!==metadata.requestSHA256)throw Error('REQUEST_DRIFT');return {request,metadata};
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname)console.log(JSON.stringify(await prepare(),null,2));
