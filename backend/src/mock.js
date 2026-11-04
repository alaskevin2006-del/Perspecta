import { demo, roles } from './catalog.js';

// Fixed fixture for integration only. It is not a generated answer to arbitrary topics.
export function mockDebate({topic, roleIds}) {
  const messages = [1, 2].flatMap(round => roleIds.map((roleId, index) => {
    const original = demo.messages.find(m => m.round === round && m.roleId === roleId) ?? demo.messages[(round - 1) * 3 + index];
    const originalTarget = demo.messages.find(m => m.id === original.replyTo)?.roleId;
    const target = roleIds.includes(originalTarget) && originalTarget !== roleId ? roleIds.indexOf(originalTarget) : (index + 1) % roleIds.length;
    const content = round === 2 && roleIds[target] !== originalTarget
      ? `回应${roles.find(role => role.id === roleIds[target])?.name ?? roleIds[target]}的第一轮观点：还需要确认当前目标的必要门槛与可投入时间；只有在这些条件清晰时，才能比较额外成绩与项目成果的实际价值。`
      : original.content;
    return {...original, roleId, content, id: `m${(round - 1) * roleIds.length + index + 1}`,
      replyTo: round === 1 ? null : `m${target + 1}`};
  }));
  return {...structuredClone(demo), topic, messages};
}
