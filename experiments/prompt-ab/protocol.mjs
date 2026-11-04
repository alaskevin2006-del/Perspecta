import {validateOutput} from '../../backend/src/validation.js';
import {ids,topic,schedule,roster} from './builders.mjs';
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,expected)=>obj(v)&&Object.keys(v).length===expected.length&&expected.every(k=>Object.hasOwn(v,k));
const text=(v,max=600)=>typeof v==='string'&&v.trim()&&[...v].length<=max;
const fail=code=>{throw Error(code);};
const quotes=[/(?:^|[。！？：:\n])\s*(?:回应\s*)?(?:你所说|你说过|你提到|你指出|你强调|你提出|你认为|你说)\s*[:：]?\s*[“"]([^”"\n]{6,80})[”"]/gu,/(?:回应|(?:你|他|她)(?:所说|说|提到|强调|提出|指出))[^“"\n:：]{0,24}[：:]?\s*[“"]([^”"\n]{2,80})[”"]/gu];
function common(value){
 if(!keys(value,['messages','summary'])||!Array.isArray(value.messages)||value.messages.length!==16||!keys(value.summary,['consensus','disagreements','decisionFactors','nextActions']))fail('SCHEMA');
 const prior=new Map(),bodies=new Set();
 for(const [i,m]of value.messages.entries()){
  if(!keys(m,['id','round','roleId','content','replyTo'])||m.id!==`m${i+1}`||m.round!==schedule[i].round||m.roleId!==schedule[i].roleId||!text(m.content))fail('MESSAGE_OR_SCHEDULE');
  const body=m.content.normalize('NFC').replace(/\s+/gu,'');if(bodies.has(body))fail('EXACT_DUPLICATE');bodies.add(body);
  if(m.round===1){if(m.replyTo!==null)fail('FIRST_REFERENCE');}
  else{const target=prior.get(m.replyTo);if(!target||target.roleId===m.roleId)fail('REFERENCE');for(const regex of quotes)for(const [,q]of m.content.matchAll(regex))if(!target.content.includes(q))fail('MISQUOTE');}
  if(/我会先问|如果我是这个人物|作为(?:一个)?(?:AI|人工智能)/u.test(m.content))fail('META_NARRATION');
  prior.set(m.id,m);
 }
 for(const round of [2,3,4]){
  const phase=value.messages.filter(m=>m.round===round);
  if(phase.filter(m=>prior.get(m.replyTo).round<round).length<2)fail('CROSS_ROUND');
  if(phase.every(m=>value.messages.findIndex(p=>p.id===m.replyTo)===value.messages.indexOf(m)-1))fail('RELAY_ONLY');
  if(new Set(phase.map(m=>prior.get(m.replyTo).roleId)).size<2)fail('TARGET_DIVERSITY');
 }
 for(const list of Object.values(value.summary))if(!Array.isArray(list)||list.length<1||list.length>3||list.some(v=>!text(v)))fail('SUMMARY');
 return value;
}
export function validateVariant(raw,variant){
 if(variant==='A'){common(raw);if(raw.messages.some((m,i)=>m.replyTo!==schedule[i].replyTo))fail('FIXED_REPLY_DRIFT');return validateOutput(raw,ids,{rounds:4});}
 if(variant!=='B')fail('UNKNOWN_VARIANT');
 if(!keys(raw,['topic','roster','rounds','utterances','summary'])||raw.topic!==topic||raw.rounds!==4||!Array.isArray(raw.roster)||raw.roster.length!==4||!Array.isArray(raw.utterances)||raw.utterances.length!==16)fail('RAW_B_SCHEMA');
 raw.roster.forEach((r,i)=>{if(!keys(r,['id','name','seat'])||r.id!==ids[i]||r.seat!==i+1||r.name!==roster[i].name)fail('RAW_B_ROSTER');});
 const prior=new Set();const map=new Map(raw.utterances.map((u,i)=>[u?.id,`m${i+1}`]));
 raw.utterances.forEach((u,i)=>{if(!keys(u,['id','round','speaker','replyTo','text'])||u.id!==`u${i+1}`||u.round!==schedule[i].round||u.speaker!==schedule[i].roleId||!text(u.text))fail('RAW_B_MESSAGE');if(u.round===1?u.replyTo!==null:!prior.has(u.replyTo))fail('RAW_B_REFERENCE');prior.add(u.id);});
 // Mapping is mechanical only after the original B schema/references pass.
 return common({messages:raw.utterances.map(u=>({id:map.get(u.id),round:u.round,roleId:u.speaker,replyTo:u.replyTo===null?null:map.get(u.replyTo),content:u.text})),summary:raw.summary});
}
export function speechMetrics(value){
 const speeches=value.messages??value.utterances??[];const lines=speeches.map(m=>m.content??m.text??'');const chars=lines.map(s=>[...s].length);
 return {speeches:lines.length,brotherForms:lines.reduce((n,s)=>n+[...s.matchAll(/雪峰兄|雷军兄|德峰兄|素娟兄|张兄|雷兄|王兄|杜兄/gu)].length,0),announcerPhrases:lines.reduce((n,s)=>n+[...s.matchAll(/我想追问的是|我想接一句|我想补一个判断条件|我会先问|我想补充一个条件|我想追问一句/gu)].length,0),contentColons:lines.reduce((n,s)=>n+[...s.matchAll(/[:：]/gu)].length,0),minChars:chars.length?Math.min(...chars):0,maxChars:chars.length?Math.max(...chars):0,meanChars:chars.length?Math.round(chars.reduce((a,b)=>a+b,0)/chars.length):0,semanticVerdict:'HUMAN_REVIEW_REQUIRED'};
}
