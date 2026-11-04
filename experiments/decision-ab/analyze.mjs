import {readFileSync,writeFileSync} from 'node:fs';
import {validateVariant,speechMetrics} from './protocol.mjs';
import {refs,sha} from './prepare.mjs';
const result={study:'decision-evidence-20261104',realRequests:2,retries:0,priceSource:'https://api-docs.deepseek.com/quick_start/pricing/',priceChecked:'2026-11-04',rateUSDPerMillion:{peak:{cacheHit:.006,cacheMiss:.3,output:1.2},offPeak:{cacheHit:.003,cacheMiss:.15,output:.6}},variants:{}};
for(const v of ['A','B']){
 const dir=`experiments/decision-ab/results/${v}`,report=JSON.parse(readFileSync(dir+'/report.json','utf8')),rawText=readFileSync(dir+'/raw-content.txt','utf8'),raw=JSON.parse(rawText);
 if(sha(rawText)!==report.rawContentSHA256)throw Error('RAW_HASH_DRIFT');
 let fullDiagnostic=null;try{validateVariant(raw,v);}catch(e){fullDiagnostic=e.outputDiagnostic??{reason:e.message};}
 // Diagnostic only: validate an in-memory copy's body separately. Do not publish this copy or repair the raw output.
 let bodyStructureValid=false;try{validateVariant({...raw,summary:Object.fromEntries(['consensus','disagreements','decisionFactors','nextActions'].map(k=>[k,['离线结构探针占位，非生成摘要']]))},v);bodyStructureValid=true;}catch{}
 const text=readFileSync(`docs/chat-logs/20261104-decision-${v}.txt`,'utf8');
 for(const m of raw.messages)if(!text.includes(m.content))throw Error('TXT_SPEECH_LOSS');
 for(const list of Object.values(raw.summary))for(const line of list)if(!text.includes(line))throw Error('TXT_SUMMARY_LOSS');
 const u=report.usage,d=report.usageDetails;const fee=rate=>(d.cacheHitTokens*rate.cacheHit+d.cacheMissTokens*rate.cacheMiss+u.outputTokens*rate.output)/1e6;
 result.variants[v]={sourceCommit:refs[v],executionCommit:report.codeCommit,startedAt:report.startedAt,finishedAt:report.finishedAt,requestSHA256:report.requestSHA256,rawContentSHA256:report.rawContentSHA256,http:report.upstreamStatus,outcome:report.outcome,fullDiagnostic,bodyStructureValid,bodyProbeDoesNotMakeOutputValid:true,summaryCounts:Object.fromEntries(Object.entries(raw.summary).map(([k,val])=>[k,val.length])),speechMetrics:speechMetrics(raw),usage:u,usageDetails:d,estimatedPeakUSD:fee(result.rateUSDPerMillion.peak),estimatedOffPeakUSD:fee(result.rateUSDPerMillion.offPeak),providerCost:report.providerCost,txtAllOriginalSpeechesAndSummaryPreserved:true};
}
result.totals={inputTokens:0,outputTokens:0,estimatedPeakUSD:0,estimatedOffPeakUSD:0};for(const r of Object.values(result.variants)){result.totals.inputTokens+=r.usage.inputTokens;result.totals.outputTokens+=r.usage.outputTokens;result.totals.estimatedPeakUSD+=r.estimatedPeakUSD;result.totals.estimatedOffPeakUSD+=r.estimatedOffPeakUSD;}
writeFileSync('experiments/decision-ab/results/analysis.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
const combined=['A','B'].map(v=>readFileSync(`docs/chat-logs/20261104-decision-${v}.txt`,'utf8')).join('\n\n===================== 下一个完整版本 =====================\n\n');writeFileSync('docs/chat-logs/20261104-decision-AB-full.txt',combined);
