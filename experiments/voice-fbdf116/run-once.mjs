import{execFileSync}from'node:child_process';import{resolve}from'node:path';
import{loadFrozen}from'./freeze.mjs';import{runOnce}from'../decision-ab/runner.mjs';
if(process.argv[2]!=='B3'||process.argv[3]!=='--live'||process.argv.length!==4)throw Error('Explicit B3 --live required');
const root=process.env.PERSPECTA_VOICE_REPORT_ROOT;if(!root||resolve(root)!==root)throw Error('Explicit absolute private report root required');
const frozen=loadFrozen();frozen.metadata.codeCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',env:{PATH:'/usr/bin:/bin'}}).trim();
try{const r=await runOnce({variant:'A',request:frozen.request,metadata:frozen.metadata,reportDir:root+'/B3',apiKey:process.env.LLM_API_KEY});console.log(JSON.stringify({studyVariant:'B3',protocolVariant:r.variant,attempts:r.attempts,upstreamStatus:r.upstreamStatus,outcome:r.outcome,usage:r.usage,durationMs:r.durationMs}));process.exitCode=r.outcome==='VALID'?0:1;}catch{console.log(JSON.stringify({studyVariant:'B3',outcome:'RUN_FAILED_NO_RETRY'}));process.exitCode=1;}
