import { demo, roles } from './catalog.js';

// Fixed fixture for integration only. It is not a generated answer to arbitrary topics.
export function mockDebate({topic, roleIds}) {
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
  const third = roleIds.map((roleId, index) => ({id:`m${2*roleIds.length+index+1}`, round:3, roleId, replyTo:messages[roleIds.length+(index+1)%roleIds.length].id, content:'回应前面的观点：讨论还需要区分目标要求与实践机会。若现实条件允许，可以先安排一次有限的尝试，再根据结果调整，不必把一种选择视作所有人的答案。'}));
  return {...structuredClone(demo), topic, messages:[...messages,...third]};
}
