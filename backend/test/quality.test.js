import test from 'node:test';
import assert from 'node:assert/strict';
import {qualityReview} from '../src/quality.js';
const repeated='资格条件需要按具体学校核实，不能把项目经历直接当成资格替代；目标还不清楚时，应同时考虑可投入时间、资源和截止节点，不能拿一个统一模板替所有人作选择。';
test('advisory review flags close speeches without claiming semantic failure',()=>{const r=qualityReview({messages:[{id:'m1',content:repeated},{id:'m2',content:repeated+'这个前提值得继续核对。'}],summary:{consensus:['张与杜接受核查。']}});assert.ok(r.flags.some(f=>f.code==='SIMILAR_SPEECH'));assert.equal(r.semanticVerdict,'HUMAN_REVIEW_REQUIRED');});
test('summary absolutes and cross-field identical text are review prompts, not errors',()=>{const r=qualityReview({messages:[],summary:{consensus:['所有人一致认为必须先保底。'],disagreements:['所有人一致认为必须先保底。']}});assert.ok(r.flags.some(f=>f.code==='SUMMARY_ABSOLUTE'));assert.ok(r.flags.some(f=>f.code==='SUMMARY_REPEATED'));assert.equal(r.semanticVerdict,'HUMAN_REVIEW_REQUIRED');});
test('a shared term alone does not flag two distinct arguments',()=>{const r=qualityReview({messages:[{id:'m1',content:'绩点并不是生活的全部价值。'},{id:'m2',content:'未知要求应向教务核实，但不必因信息不足取消所有尝试。'}],summary:{consensus:['张与杜认可核查。']}});assert.deepEqual(r.flags,[]);});

test('actual A/B announcers and unsupported first-person experience are advisory and never rewrite text',async()=>{
 const {readFileSync}=await import('node:fs');
 const a=JSON.parse(readFileSync(new URL('../../experiments/decision-ab/results/A/raw-content.txt',import.meta.url),'utf8'));
 const b=JSON.parse(readFileSync(new URL('../../experiments/decision-ab/results/B/raw-content.txt',import.meta.url),'utf8'));
 const before=JSON.stringify([a,b]);const ar=qualityReview(a),br=qualityReview(b);
 for(const id of ['m6','m7','m15','m16'])assert.ok(ar.flags.some(f=>f.code==='ANNOUNCER_SPEECH'&&f.messageIds.includes(id)),id);
 for(const id of ['m6','m7','m11'])assert.ok(br.flags.some(f=>f.code==='ANNOUNCER_SPEECH'&&f.messageIds.includes(id)),id);
 assert.ok(br.flags.some(f=>f.code==='FIRST_PERSON_EXPERIENCE'&&f.messageIds.includes('m4')));
 assert.equal(JSON.stringify([a,b]),before);assert.equal(br.semanticVerdict,'HUMAN_REVIEW_REQUIRED');
 assert.ok(br.flags.every(f=>!('content'in f)&&!('quote'in f)));
});
test('direct questions and conditional first-person judgments are not announcer warnings',()=>{
 const value={messages:[{id:'m1',content:'这两件事不一样。你说的是目标明确之后，那还没确定方向的人呢？'},{id:'m2',content:'我会看实际代价。如果时间已经不够，就先缩小尝试。'},{id:'m3',content:'我认为这个问题还没说清，不能把有限条件当成所有人的标准。'}]};
 assert.deepEqual(qualityReview(value).flags,[]);
});
test('B2 real variants without announcer suffixes still need review even when earlier dictionary reports no flags',async()=>{
 const {readFileSync}=await import('node:fs');const value=JSON.parse(readFileSync(new URL('../../experiments/natural-revisions/results/B2/raw-content.txt',import.meta.url),'utf8'));
 const result=qualityReview(value);for(const id of ['m3','m7','m11'])assert.ok(result.flags.some(f=>f.code==='ANNOUNCER_SPEECH'&&f.messageIds.includes(id)),id);assert.equal(result.semanticVerdict,'HUMAN_REVIEW_REQUIRED');
});
