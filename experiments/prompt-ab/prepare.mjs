import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {buildRequest,sourceHashes,limits,params,ids,topic} from './builders.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
const folder=new URL('./snapshots/natural-v3/',import.meta.url);
const codeFiles=['builders.mjs','protocol.mjs','runner.mjs','prepare.mjs','run-once.mjs'];
export function prepare(){
 mkdirSync(folder,{recursive:true});const sources=sourceHashes();for(const file of codeFiles)sources['experiments/prompt-ab/'+file]=sha(readFileSync(new URL(file,import.meta.url)));
 const manifest={version:'natural-v3',baseCommit:'74ad42d3499b5e3f59a06d802c1a6410b4ae0a35',teamSourceCommit:'d53a545',selectedMain:'1f21a2f8b9641306ba088094bc995901ab4c9e3f',params,limits,topic,ids,sourceHashes:sources,requests:{}};
 for(const variant of ['A','B']){
  const request=buildRequest(variant),serialized=JSON.stringify(request),bytes=Buffer.byteLength(serialized),reserved=bytes+512+params.max_tokens;
  const estimatedMaxUSD=((bytes+512)*.3+params.max_tokens*1.2)/1e6;
  if(bytes>limits.maxInputBytes||reserved>limits.reservedTokenLimit||estimatedMaxUSD>=limits.maxEstimatedUSD)throw Error('PREFLIGHT_BUDGET');
  writeFileSync(new URL(`request-${variant}.json`,folder),JSON.stringify(request,null,2)+'\n',{flag:'wx'});
  manifest.requests[variant]={file:`request-${variant}.json`,requestSHA256:sha(serialized),bytes,reservedTokens:reserved,estimatedMaxUSD};
 }
 writeFileSync(new URL('manifest.json',folder),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;
}
export function loadFrozen(variant){
 if(!['A','B'].includes(variant))throw Error('UNKNOWN_VARIANT');
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',folder),'utf8'));
 for(const [path,expected]of Object.entries(manifest.sourceHashes))if(sha(readFileSync(new URL('../../'+path,import.meta.url)))!==expected)throw Error('SOURCE_CHANGED');
 const request=JSON.parse(readFileSync(new URL(manifest.requests[variant].file,folder),'utf8'));
 if(sha(JSON.stringify(request))!==manifest.requests[variant].requestSHA256)throw Error('SNAPSHOT_CHANGED');
 return {request,metadata:{requestSHA256:manifest.requests[variant].requestSHA256,sourceHashes:manifest.sourceHashes},manifest};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const m=prepare();console.log(JSON.stringify({version:m.version,requests:m.requests}));}
