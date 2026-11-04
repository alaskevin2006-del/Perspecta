import{readFileSync}from'node:fs';
import{buildMessages}from'../../backend/src/prompt.js';
import{buildMessages as teamMessages}from'../decision-ab/sources/B/backend/src/prompt.js';
const cases=JSON.parse(readFileSync(new URL('../decision-ab/sources/B/backend/data/persona-decision-cases.json',import.meta.url),'utf8'));
export function buildRevision(variant,input,selected){
 if(!['A2','B2'].includes(variant)||input.rounds!==4)throw Error('EXPLICIT_FOUR_ROUND_REVISION_REQUIRED');
 const common=buildMessages(input,selected);if(variant==='A2')return common;
 // B2 keeps the original B profile projection, including position strings and all four cases.
 // Apply the same natural-dialogue protocol as A2, adding each case's original scope as data.
 const original=JSON.parse(teamMessages(input,selected)[1].content),user=JSON.parse(common[1].content);
 user.roles=original.roles.map(role=>({...role,...(cases[role.id]?{decisionCases:cases[role.id].map(({runtime,scope})=>({basis:runtime,scope}))}:{})}));
 return [common[0],{role:'user',content:JSON.stringify(user)}];
}
