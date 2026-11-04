import {validateOutput} from './sources/A/backend/src/validation.js';
import {buildTurnPlan} from './sources/A/backend/src/discussion.js';
import {input} from './prepare.mjs';
export function validateVariant(value,variant){
 if(!['A','B'].includes(variant))throw Error('UNKNOWN_VARIANT');
 validateOutput(value,input.roleIds,{rounds:4});
 const plan=buildTurnPlan(input.roleIds);
 if(value.messages.some((m,i)=>['id','round','roleId','replyTo'].some(k=>m[k]!==plan[i][k])))throw Error('FIXED_REPLY_DRIFT');
 return value;
}
export function speechMetrics(value){
 const lines=value.messages.map(m=>m.content),count=re=>lines.reduce((n,s)=>n+[...s.matchAll(re)].length,0),lens=lines.map(s=>[...s].length);
 return {speeches:lines.length,brotherForms:count(/(?:雪峰|雷军|德峰|素娟|张|雷|王|杜)兄/gu),announcerPhrases:count(/我(?:想|要)?(?:追问|补充|补一个|接一句|检验)|我的(?:反例|改判条件)是|我修正(?:一下|一点)|我收回一半/gu),contentColons:count(/[:：]/gu),minChars:Math.min(...lens),maxChars:Math.max(...lens),semanticVerdict:'HUMAN_REVIEW_REQUIRED'};
}
