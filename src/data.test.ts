import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeMock,validateDebate,roles,readBackendMode,modeNotice} from './data';

test('backend response headers determine mock and live notices',()=>{
 for(const mode of ['mock','live'] as const){
  const response=new Response(JSON.stringify({mode:mode==='mock'?'live':'mock'}),{headers:{'x-perspecta-mode':mode}});
  assert.equal(readBackendMode(response.headers),mode);
 }
 assert.match(modeNotice(readBackendMode(new Headers({'X-Perspecta-Mode':'mock'}))),/模拟演示/);
 assert.match(modeNotice(readBackendMode(new Headers({'X-Perspecta-Mode':'live'}))),/AI 模拟讨论/);
});
test('missing or invalid backend mode stays unconfirmed',()=>{
 for(const value of [null,'','demo','LIVE']){
  const headers=new Headers();if(value!==null)headers.set('X-Perspecta-Mode',value);
  assert.equal(readBackendMode(headers),'unknown');
  assert.match(modeNotice(readBackendMode(headers)),/待确认/);
 }
});
for(const count of [2,3,4])test(`${count} guests preserve explicitly selected legacy rounds`,()=>{const ids=roles.slice(0,count).map(r=>r.id);const result=makeMock('测试一个现实选择中的议题',ids,2);assert.doesNotThrow(()=>validateDebate(result,ids,2));assert.equal(result.messages.length,count*2);});
test('reject a second-round reply to a second-round message',()=>{const ids=roles.map(r=>r.id);const d=makeMock('测试',ids,2);d.messages[7].replyTo=d.messages[4].id;assert.throws(()=>validateDebate(d,ids,2));});
test('reject duplicate speakers and absent summary',()=>{const ids=roles.map(r=>r.id);const d=makeMock('测试',ids);d.messages[1].roleId=d.messages[0].roleId;assert.throws(()=>validateDebate(d,ids));const s=makeMock('测试',ids);s.summary.nextActions=[];assert.throws(()=>validateDebate(s,ids));});
import {matchesApprovedTrio} from './scene-artwork';
test('approved trio artwork matches any selection order, but no extra or missing guest',()=>{
 assert.equal(matchesApprovedTrio(['wang_defeng','zhang_xuefeng','lei_jun']),true);
 assert.equal(matchesApprovedTrio(['zhang_xuefeng','lei_jun']),false);
 assert.equal(matchesApprovedTrio(['zhang_xuefeng','lei_jun','du_sujuan']),true);
 assert.equal(matchesApprovedTrio(['zhang_xuefeng','lei_jun','wang_defeng','du_sujuan']),false);
});

import {seatLayouts} from './seat-layout';
import {readFileSync} from 'node:fs';
test('seat slots remain separated and bounded for every supported count',()=>{
 for(const count of [1,2,3,4]){
  const {centers,width}=seatLayouts[count];assert.equal(centers.length,count);
  centers.forEach((center,i)=>{assert.ok(center-width/2>=0);assert.ok(center+width/2<=100);if(i)assert.ok(center-centers[i-1]>width);});
 }
});
test('long backend identities wrap without ellipsis and catalog can scroll',()=>{
 const css=readFileSync(new URL('./style.css',import.meta.url),'utf8');
 const lastSeat=css.slice(css.lastIndexOf('.seat>span{'));
 assert.match(lastSeat,/white-space:normal/);assert.match(lastSeat,/overflow-wrap:anywhere/);assert.match(lastSeat,/min-width:0/);assert.doesNotMatch(lastSeat,/text-overflow:ellipsis/);
 const lastRoster=css.slice(css.lastIndexOf('.question .guest-list{')).split('}')[0];
 assert.match(lastRoster,/flex:1 1 0/);assert.match(lastRoster,/min-height:0/);assert.match(lastRoster,/overflow-y:auto/);
});

import * as data from './data';
for(const count of [2,3,4])test(`new frontend conversation validates ${count*4} chained turns`,()=>{
 const ids=roles.slice(0,count).map(r=>r.id);const result=makeMock('用于检查角色接话的讨论议题',ids,4);
 assert.equal(result.messages.length,count*4);assert.doesNotThrow(()=>validateDebate(result,ids,4));
 for(let i=1;i<result.messages.length;i++)assert.equal(result.messages[i].replyTo,result.messages[i-1].id);
 const invalid=structuredClone(result);invalid.messages[count].replyTo=null;assert.throws(()=>validateDebate(invalid,ids,4));
});
test('legacy frontend validation stays available explicitly',()=>{
 const ids=roles.slice(0,3).map(r=>r.id);const result=makeMock('旧契约测试的讨论议题',ids,2);
 assert.equal(result.messages.length,6);assert.doesNotThrow(()=>validateDebate(result,ids,2));
 assert.throws(()=>validateDebate(result,ids,4));
});
test('four stage labels and exported text preserve mode and all messages',()=>{
 assert.equal(typeof data.formatDebateText,'function');assert.deepEqual(data.discussionStages,['抛出争点','质疑与反例','回应与修正','条件与未决']);
 const ids=roles.map(r=>r.id);const result=makeMock('导出测试议题需要足够长度',ids,4);const text=data.formatDebateText(result,roles,'mock');
 assert.match(text,/模拟演示/);for(const m of result.messages)assert.ok(text.includes(m.content));for(const key of ['consensus','disagreements','decisionFactors','nextActions'] as const)for(const line of result.summary[key])assert.ok(text.includes(line));
});
test('optional unknown-avatar URLs work without treating asset keys or scripts as images',()=>{
 assert.equal(typeof data.avatarImageSource,'function');assert.equal(data.avatarImageSource('career'),undefined);assert.equal(data.avatarImageSource('javascript:alert(1)'),undefined);
 assert.equal(data.avatarImageSource('https://example.test/portrait.png'),'https://example.test/portrait.png');assert.equal(data.avatarImageSource('/assets/portrait.png'),'/assets/portrait.png');
 assert.equal(data.avatarImageSource('https://user:password@example.test/image'),undefined);
});
