import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {loadFrozen} from './prepare.mjs';
import {runOnce} from './runner.mjs';
const variant=process.argv[2];
if(!['A','B'].includes(variant)||process.argv[3]!=='--live'||process.argv.length!==4)throw Error('Use explicit A or B and --live; no default real call');
const root=process.env.PERSPECTA_AB_REPORT_ROOT;if(!root||resolve(root)!==root)throw Error('Explicit absolute private report root required');
const frozen=loadFrozen(variant);frozen.metadata.codeCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',env:{PATH:'/usr/bin:/bin'}}).trim();
try{
 const r=await runOnce({variant,request:frozen.request,metadata:frozen.metadata,reportDir:root+'/'+variant,apiKey:process.env.LLM_API_KEY});
 console.log(JSON.stringify({variant,attempts:r.attempts,upstreamStatus:r.upstreamStatus,outcome:r.outcome,usage:r.usage,durationMs:r.durationMs}));
 process.exitCode=r.outcome==='VALID'?0:1;
}catch{console.log(JSON.stringify({variant,outcome:'AB_RUN_FAILED_NO_RETRY'}));process.exitCode=1;}
