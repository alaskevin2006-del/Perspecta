import{readFileSync,writeFileSync}from'node:fs';
import{sha}from'../decision-ab/prepare.mjs';
import{validateVariant}from'../decision-ab/protocol.mjs';
import{qualityReview}from'../../backend/src/quality.js';
const manifest=JSON.parse(readFileSync('experiments/natural-revisions/manifest.json','utf8'));
const result={study:'natural-revisions-20261104',realRequests:2,retries:0,preflightCRealRequests:0,sourceManifest:'../manifest.json',priceSource:'https://api-docs.deepseek.com/quick_start/pricing/',variants:{},totals:{inputTokens:0,outputTokens:0,cacheHitTokens:0,estimatedPeakUSD:0,estimatedOffPeakUSD:0}};
for(const v of ['A2','B2']){
 const dir=`experiments/natural-revisions/results/${v}`,report=JSON.parse(readFileSync(dir+'/report.json','utf8')),text=readFileSync(dir+'/raw-content.txt','utf8'),raw=JSON.parse(text);
 if(sha(text)!==report.rawContentSHA256||report.requestSHA256!==manifest.variants[v].requestSHA256)throw Error('ARTIFACT_HASH_DRIFT');
 let diagnostic=null;try{validateVariant(raw,'A');}catch(e){diagnostic=e.outputDiagnostic??{reason:e.message};}
 let bodyStructureValid=false;try{validateVariant({...raw,summary:Object.fromEntries(['consensus','disagreements','decisionFactors','nextActions'].map(k=>[k,['仅离线正文结构探针占位，非模型摘要']]))},'A');bodyStructureValid=true;}catch{}
 const txt=readFileSync(`docs/chat-logs/20261104-natural-${v}.txt`,'utf8');for(const m of raw.messages)if(!txt.includes(m.content))throw Error('TXT_SPEECH_LOSS');for(const arr of Object.values(raw.summary))for(const s of arr)if(!txt.includes(s))throw Error('TXT_SUMMARY_LOSS');
 const d=report.usageDetails,u=report.usage,lens=raw.messages.map(m=>[...m.content].length),peak=(d.cacheHitTokens*.006+d.cacheMissTokens*.3+u.outputTokens*1.2)/1e6;
 result.variants[v]={studyVariant:v,protocolVariant:report.variant,sourceLineage:v==='A2'?[manifest.A2Source]:manifest.B2Sources,executionCommit:report.codeCommit,startedAt:report.startedAt,finishedAt:report.finishedAt,durationMs:report.durationMs,http:report.upstreamStatus,outcome:report.outcome,diagnostic,requestSHA256:report.requestSHA256,rawContentSHA256:report.rawContentSHA256,bodyStructureValid,bodyProbeDoesNotRepairOriginal:true,summaryCounts:Object.fromEntries(Object.entries(raw.summary).map(([k,a])=>[k,a.length])),lengths:{min:Math.min(...lens),max:Math.max(...lens),mean:Math.round(lens.reduce((a,b)=>a+b)/lens.length)},contentColons:raw.messages.reduce((n,m)=>n+[...m.content.matchAll(/[:：]/gu)].length,0),qualityReview:qualityReview(raw),usage:u,usageDetails:d,estimatedPeakUSD:peak,estimatedOffPeakUSD:peak/2,providerCost:report.providerCost,txtAllOriginalSpeechesAndSummaryPreserved:true};
 result.totals.inputTokens+=u.inputTokens;result.totals.outputTokens+=u.outputTokens;result.totals.cacheHitTokens+=d.cacheHitTokens;result.totals.estimatedPeakUSD+=peak;result.totals.estimatedOffPeakUSD+=peak/2;
}
writeFileSync('experiments/natural-revisions/results/analysis.json',JSON.stringify(result,null,2)+'\n');
writeFileSync('docs/chat-logs/20261104-natural-A2-B2-full.txt',['A2','B2'].map(v=>readFileSync(`docs/chat-logs/20261104-natural-${v}.txt`,'utf8')).join('\n\n===================== 下一个完整版本 =====================\n\n'));
console.log(JSON.stringify(result,null,2));
