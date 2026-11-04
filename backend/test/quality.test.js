import test from 'node:test';
import assert from 'node:assert/strict';
import {qualityReview} from '../src/quality.js';
const repeated='资格条件需要按具体学校核实，不能把项目经历直接当成资格替代；目标还不清楚时，应同时考虑可投入时间、资源和截止节点，不能拿一个统一模板替所有人作选择。';
test('advisory review flags close speeches without claiming semantic failure',()=>{const r=qualityReview({messages:[{id:'m1',content:repeated},{id:'m2',content:repeated+'这个前提值得继续核对。'}],summary:{consensus:['张与杜接受核查。']}});assert.ok(r.flags.some(f=>f.code==='SIMILAR_SPEECH'));assert.equal(r.semanticVerdict,'HUMAN_REVIEW_REQUIRED');});
test('summary absolutes and cross-field identical text are review prompts, not errors',()=>{const r=qualityReview({messages:[],summary:{consensus:['所有人一致认为必须先保底。'],disagreements:['所有人一致认为必须先保底。']}});assert.ok(r.flags.some(f=>f.code==='SUMMARY_ABSOLUTE'));assert.ok(r.flags.some(f=>f.code==='SUMMARY_REPEATED'));assert.equal(r.semanticVerdict,'HUMAN_REVIEW_REQUIRED');});
test('a shared term alone does not flag two distinct arguments',()=>{const r=qualityReview({messages:[{id:'m1',content:'绩点并不是生活的全部价值。'},{id:'m2',content:'未知要求应向教务核实，但不必因信息不足取消所有尝试。'}],summary:{consensus:['张与杜认可核查。']}});assert.deepEqual(r.flags,[]);});
