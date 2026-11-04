import {ids,topic,roster} from './builders.mjs';
import {buildTurnPlan} from '../../backend/src/discussion.js';
import {mockDebate} from '../../backend/src/mock.js';
function fixtureA(){const {messages,summary}=mockDebate({topic,roleIds:ids,rounds:4});return {messages,summary};}
function fixtureB(){const schedule=buildTurnPlan(ids);const utterances=schedule.map((t,i)=>{const target=t.round===1?null:schedule.find(p=>p.round===t.round-1&&p.roleId===ids[(ids.indexOf(t.roleId)+1)%4]);return {id:`u${i+1}`,round:t.round,speaker:t.roleId,text:`观点${i+1}：这项具体前提仍需要放到真实处境中检验，不能把换一个例子当成新增的论证。`,replyTo:target?`u${schedule.indexOf(target)+1}`:null};});return {topic,roster:structuredClone(roster),rounds:4,utterances,summary:fixtureA().summary};}
export {fixtureA,fixtureB};
