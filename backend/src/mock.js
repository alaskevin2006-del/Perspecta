import { demo } from './catalog.js';

// Fixed fixture for integration only. It is not a generated answer to arbitrary topics.
export function mockDebate({topic, roleIds}) {
  const messages = [1, 2].flatMap(round => roleIds.map((roleId, index) => {
    const original = demo.messages.find(m => m.round === round && m.roleId === roleId);
    return {...original, id: `m${(round - 1) * roleIds.length + index + 1}`,
      replyTo: round === 1 ? null : `m${(index + 1) % roleIds.length + 1}`};
  }));
  return {...structuredClone(demo), topic, messages};
}
