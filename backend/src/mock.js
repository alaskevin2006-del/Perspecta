import { demo, roles } from './catalog.js';
import {buildTurnPlan} from './discussion.js';

// Fixed fixture for integration only. It is not a generated answer to arbitrary topics.
export function mockDebate({topic, roleIds, rounds=2}) {
  if(rounds===4){
    const plan=buildTurnPlan(roleIds);
    const points=[
      '先明确必要资格与可支配资源，再比较额外投入；如果不知道目标条件，分数和项目数量都不能直接代表路径价值。',
      '这个排序还缺一个反例：达到必要条件后，继续刷同一指标可能少有收获；应比较真实任务反馈，而不是把忙碌当成长。',
      '刚才把评价标准放在了结果上，这个前提仍可追问：行动本身是否有价值？接受现实责任，并不等于只承认单一排名。',
      '反例提醒了探索的必要，但不能据此忽略支持条件；若时间和资源不足，应缩小尝试，而不是把选择说成非此即彼。',
    ];
    const messages=plan.map((turn,i)=>({...turn,content:i===0?points[0]:`${roles.find(r=>r.id===plan[i-1].roleId)?.name??plan[i-1].roleId}，${points[i%points.length]}`}));
    return {...structuredClone(demo),topic,messages};
  }
  const messages = [1, 2].flatMap(round => roleIds.map((roleId, index) => {
    const roundFixtures = demo.messages.filter(message => message.round === round);
    const original = roundFixtures.find(message => message.roleId === roleId) ?? roundFixtures[index % roundFixtures.length];
    const originalTarget = demo.messages.find(m => m.id === original.replyTo)?.roleId;
    const target = roleIds.includes(originalTarget) && originalTarget !== roleId ? roleIds.indexOf(originalTarget) : (index + 1) % roleIds.length;
    const content = round === 2 && roleIds[target] !== originalTarget
      ? `回应${roles.find(role => role.id === roleIds[target])?.name ?? roleIds[target]}的第一轮观点：还需要确认当前目标的必要门槛与可投入时间；只有在这些条件清晰时，才能比较额外成绩与项目成果的实际价值。`
      : original.content;
    return {...original, roleId, content, id: `m${(round - 1) * roleIds.length + index + 1}`,
      replyTo: round === 1 ? null : `m${target + 1}`};
  }));
  if(rounds===3)messages.push(...roleIds.map((roleId,index)=>({id:`m${2*roleIds.length+index+1}`,round:3,roleId,replyTo:messages[roleIds.length+(index+1)%roleIds.length].id,content:'回应前面的观点：讨论还需要区分目标要求与实践机会。若现实条件允许，可以先安排一次有限的尝试，再根据结果调整，不必把一种选择视作所有人的答案。'})));
  return {...structuredClone(demo), topic, messages};
}
