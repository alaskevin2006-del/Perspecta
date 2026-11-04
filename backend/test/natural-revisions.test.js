import test from 'node:test';
import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{buildMessages,buildNaturalA2Messages}from'../src/prompt.js';
import{roles}from'../src/catalog.js';
import{generate}from'../src/model.js';
import{buildMessages as priorMessages}from'../../experiments/decision-ab/sources/A/backend/src/prompt.js';
const root=new URL('../../experiments/natural-revisions/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));
const selected=manifest.input.roleIds.map(id=>roles.find(r=>r.id===id));
const voice=JSON.parse(readFileSync(new URL('../data/discussion-guidance.json',import.meta.url),'utf8')).zhang_xuefeng.voice;
const evidence=JSON.parse(readFileSync(new URL('../data/persona-speech-evidence.json',import.meta.url),'utf8')).zhang_xuefeng.speechEvidence;
function onlyZhangVoiceChanged(actual,previous){
 assert.equal(actual[0].content,previous[0].content);const a=JSON.parse(actual[1].content),b=JSON.parse(previous[1].content);
 const z=a.roles.find(r=>r.id==='zhang_xuefeng'),old=b.roles.find(r=>r.id==='zhang_xuefeng');
 assert.equal(z.speakingStyle,selected.find(r=>r.id===z.id).speakingStyle);z.speakingStyle=old.speakingStyle;
 if(z.discussionGuidance){assert.equal(z.discussionGuidance.voice,voice);assert.equal(z.discussionGuidance.speechEvidence,evidence);z.discussionGuidance.voice=old.discussionGuidance.voice;z.discussionGuidance.speechEvidence=old.discussionGuidance.speechEvidence;}
 assert.deepEqual(a,b);
}
test('new teammate voice changes only the three expected Zhang fields and does not rewrite the frozen A2/B2 records',()=>{
 for(const v of ['A2','B2']){const frozen=JSON.parse(readFileSync(new URL(`request-${v}.json`,root),'utf8'));assert.equal(createHash('sha256').update(JSON.stringify(frozen)).digest('hex'),manifest.variants[v].requestSHA256);onlyZhangVoiceChanged(v==='A2'?buildNaturalA2Messages(manifest.input,selected):buildMessages(manifest.input,selected),frozen.messages);}
});
test('legacy two and three rounds retain their protocol with only the approved Zhang style update',()=>{
 for(const rounds of [2,3])for(const topic of ['大学生该如何理解亲密关系里的自由和责任？','人工智能艺术作品的价值应该如何判断？']){const input={...manifest.input,topic,rounds};onlyZhangVoiceChanged(buildMessages(input,selected),priorMessages(input,selected));}
});
test('production adapter still accepts the frozen historical B2 request and its original complete result',async()=>{
 const frozen=JSON.parse(readFileSync(new URL('request-B2.json',root),'utf8')),raw=JSON.parse(readFileSync(new URL('results/B2/raw-content.txt',root),'utf8'));let calls=0;
 const output=await generate(manifest.input,frozen.messages,{provider:'deepseek',baseUrl:'https://api.deepseek.com',apiKey:'FAKE-ONLY',model:'deepseek-flash',maxOutputTokens:4500,maxResponseBytes:65536},new AbortController().signal,async(url,options)=>{calls++;assert.equal(options.body,JSON.stringify(frozen));return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(raw)}}]});});
 assert.equal(calls,1);assert.deepEqual(output.messages,raw.messages);assert.deepEqual(output.summary,raw.summary);
});
test('current default request matches the separately frozen B3 version after teammate voice changes',()=>{
 const frozen=JSON.parse(readFileSync(new URL('../../experiments/voice-fbdf116/request.json',import.meta.url),'utf8'));
 const expected=JSON.stringify(frozen.messages),actual=JSON.stringify(buildMessages(manifest.input,selected));
 const hash=s=>createHash('sha256').update(s).digest('hex');assert.equal(hash(actual),hash(expected));
});
test('production adapter sends B3 exactly and accepts the unmodified real B3 result',async()=>{
 const latest=new URL('../../experiments/voice-fbdf116/',import.meta.url),frozen=JSON.parse(readFileSync(new URL('request.json',latest),'utf8')),raw=JSON.parse(readFileSync(new URL('results/B3/raw-content.txt',latest),'utf8'));let calls=0;
 const output=await generate(manifest.input,buildMessages(manifest.input,selected),{provider:'deepseek',baseUrl:'https://api.deepseek.com',apiKey:'FAKE-ONLY',model:'deepseek-flash',maxOutputTokens:4500,maxResponseBytes:65536},new AbortController().signal,async(url,options)=>{calls++;assert.equal(options.body,JSON.stringify(frozen));return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(raw)}}]});});assert.equal(calls,1);assert.deepEqual(output.messages,raw.messages);assert.deepEqual(output.summary,raw.summary);
});
