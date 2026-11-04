import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync}from'node:fs';
import {buildRevision}from'./builders.mjs';
import {buildMessages}from'../../backend/src/prompt.js';
import {buildMessages as teamMessages}from'../decision-ab/sources/B/backend/src/prompt.js';
import{roles}from'../../backend/src/catalog.js';
import{input}from'../decision-ab/prepare.mjs';
const selected=input.roleIds.map(id=>roles.find(r=>r.id===id));
const cases=JSON.parse(readFileSync(new URL('../decision-ab/sources/B/backend/data/persona-decision-cases.json',import.meta.url),'utf8'));
test('A2 retains complete existing personas while B2 retains its case lineage and transmits source scopes',()=>{
 const a=buildRevision('A2',input,selected),b=buildRevision('B2',input,selected);assert.ok(Array.isArray(a)&&Array.isArray(b));
 assert.deepEqual(a,buildMessages(input,selected));const au=JSON.parse(a[1].content),bu=JSON.parse(b[1].content),old=JSON.parse(teamMessages(input,selected)[1].content);
 assert.equal(a[0].content,b[0].content);assert.deepEqual(au.turnPlan,bu.turnPlan);
 for(const role of au.roles){assert.deepEqual(role.supportedPositions,selected.find(r=>r.id===role.id).supportedPositions);}
 for(const role of bu.roles){const base=old.roles.find(r=>r.id===role.id);const {decisionCases:_,...rest}=role;const {decisionCases:__,...baseRest}=base;assert.deepEqual(rest,baseRest);if(cases[role.id])assert.deepEqual(role.decisionCases,cases[role.id].map(({runtime,scope})=>({basis:runtime,scope})));}
});
test('all B2 role orders and hostile length-boundary topics keep the original 24KB input protection',()=>{
 const permutations=(arr,n)=>n===0?[[]]:arr.flatMap((x,i)=>permutations(arr.filter((_,j)=>j!==i),n-1).map(rest=>[x,...rest]));let max=0,count=0;
 for(const n of [2,3,4])for(const ids of permutations(input.roleIds,n))for(const topic of ['汉'.repeat(300),'😀'.repeat(300),'\0'.repeat(300),'"'.repeat(300),'\\'.repeat(300)]){
  const messages=buildRevision('B2',{topic,roleIds:ids,rounds:4},ids.map(id=>roles.find(r=>r.id===id)));assert.ok(Array.isArray(messages));const bytes=Buffer.byteLength(JSON.stringify(messages));assert.ok(bytes<=24000,`${bytes}`);max=Math.max(max,bytes);count++;
 }
 console.log(JSON.stringify({variant:'B2',budgetCases:count,maxPromptBytes:max}));
});
