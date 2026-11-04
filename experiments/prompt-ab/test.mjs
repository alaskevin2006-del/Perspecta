import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildRequest,ids} from './builders.mjs';
import {validateVariant,speechMetrics} from './protocol.mjs';
import {buildTurnPlan} from '../../backend/src/discussion.js';
import {mockDebate} from '../../backend/src/mock.js';
const topic='大学阶段时间有限，应该优先投入绩点还是项目实践？';
import {fixtureA,fixtureB} from './support.mjs';
test('two requests share all provider controls and freeze the same roster schedule',()=>{
 const a=buildRequest('A'),b=buildRequest('B');const {messages:am,...ap}=a,{messages:bm,...bp}=b;assert.deepEqual(ap,bp);assert.equal(ap.model,'deepseek-flash');assert.equal(ap.max_tokens,4500);assert.equal(ap.temperature,.8);assert.equal(ap.top_p,1);assert.equal(am.length,2);assert.equal(bm.length,2);
 const av=JSON.parse(am[1].content),bv=JSON.parse(bm[1].content);assert.equal(av.topic,bv.topic);assert.deepEqual(av.turnPlan.map(t=>t.roleId),bv.speakerSchedule.map(t=>t.speaker));assert.ok(bv.speakerSchedule.every(t=>!('replyTo'in t)));
});
test('B contains full byte-identical team guides and A retains fused supported positions',()=>{
 const a=JSON.parse(buildRequest('A').messages[1].content),b=JSON.parse(buildRequest('B').messages[1].content);
 for(const [id,file]of [['lei_jun','leijunSKILL.md'],['wang_defeng','wangdefengSKILL.md']])assert.equal(b.roles.find(r=>r.id===id).sourceText,readFileSync(new URL(`../../人物画像/${file}`,import.meta.url),'utf8'));
 assert.ok(a.roles.find(r=>r.id==='zhang_xuefeng').supportedPositions.length);assert.ok(b.roles.find(r=>r.id==='zhang_xuefeng').profile.supportedPositions.length);
});
test('B free cross-round graph is legal without A callbacks and maps text verbatim',()=>{
 const raw=fixtureB(),mapped=validateVariant(raw,'B');assert.equal(mapped.messages[8].id,'m9');assert.equal(mapped.messages[8].content,raw.utterances[8].text);assert.equal(mapped.messages[8].replyTo,'m8');assert.deepEqual(mapped.summary,raw.summary);assert.throws(()=>validateVariant(mapped,'A'));
 assert.doesNotThrow(()=>validateVariant(fixtureA(),'A'));
});
test('B does not silently repair extra fields, future refs, missing summary or changed schedule',()=>{
 for(const mutate of [v=>{v.extra=true;},v=>{v.utterances[4].replyTo='u16';},v=>{delete v.summary;},v=>{v.utterances[4].speaker=ids[1];}]){const v=fixtureB();mutate(v);assert.throws(()=>validateVariant(v,'B'));}
});
test('style observations count only speeches and never grant semantic PASS',()=>{
 const r=speechMetrics({messages:[{id:'m1',content:'雪峰兄，我想追问的是：这个判断凭什么成立？'},{id:'m2',content:'条件不一样，别急着把两种选择混起来。'}]});assert.equal(r.brotherForms,1);assert.equal(r.announcerPhrases,1);assert.equal(r.contentColons,1);assert.equal(r.semanticVerdict,'HUMAN_REVIEW_REQUIRED');
});

test('A fixed reference cannot drift to another otherwise legal older target',()=>{const v=fixtureA();v.messages[12].replyTo='m8';assert.throws(()=>validateVariant(v,'A'));});
test('B roster identity cannot be silently lost during mapping',()=>{const v=fixtureB();v.roster[0].name='another-person';assert.throws(()=>validateVariant(v,'B'));});
