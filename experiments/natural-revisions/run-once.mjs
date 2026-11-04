import{execFileSync}from'node:child_process';
import{resolve}from'node:path';
import{loadFrozen}from'./prepare.mjs';
import{runOnce}from'../decision-ab/runner.mjs';
const studyVariant=process.argv[2];if(!['A2','B2'].includes(studyVariant)||process.argv[3]!=='--live'||process.argv.length!==4)throw Error('Use explicit A2 or B2 --live');
const root=process.env.PERSPECTA_NATURAL_REVISIONS_REPORT_ROOT;if(!root||resolve(root)!==root)throw Error('Explicit absolute private root required');
const frozen=loadFrozen(studyVariant);frozen.metadata.codeCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',env:{PATH:'/usr/bin:/bin'}}).trim();
// Reuse protocol A because both revisions retain exactly its API fields and fixed reply graph.
// Original numeric report.variant=A identifies that validator, not the prompt lineage.
try{const r=await runOnce({variant:'A',request:frozen.request,metadata:frozen.metadata,reportDir:root+'/'+studyVariant,apiKey:process.env.LLM_API_KEY});console.log(JSON.stringify({studyVariant,protocolVariant:r.variant,attempts:r.attempts,upstreamStatus:r.upstreamStatus,outcome:r.outcome,usage:r.usage,durationMs:r.durationMs}));process.exitCode=r.outcome==='VALID'?0:1;}catch{console.log(JSON.stringify({studyVariant,outcome:'RUN_FAILED_NO_RETRY'}));process.exitCode=1;}
