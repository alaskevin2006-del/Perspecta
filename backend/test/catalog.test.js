import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalog, roles, topics } from '../src/catalog.js';
import { mockDebate } from '../src/mock.js';
import { validateOutput } from '../src/validation.js';

test('persona delivery format without avatar keeps all five public card fields', () => {
  const data=structuredClone(roles);
  for (const role of data) delete role.avatar;
  const result=createCatalog(data,topics);
  assert.equal(result.publicRoles[0].avatar,'career');
  assert.deepEqual(Object.keys(result.publicRoles[0]).sort(),['avatar','description','id','name','tagline']);
  assert.ok(result.roles[0].coreValues.length > 0);
});

test('invalid or duplicate local role catalog fails at startup', () => {
  for (const data of [[], [roles[0],roles[0]], [{...roles[0],coreValues:null},roles[1]], [{...roles[0],name:''},roles[1]]]) {
    assert.throws(()=>createCatalog(data,topics));
  }
});

test('mock remains structurally valid after profile IDs are replaced', () => {
  const result=mockDebate({topic:'这是用于验证角色替换的测试议题',roleIds:['new_role_a','new_role_b']});
  assert.doesNotThrow(()=>validateOutput({messages:result.messages,summary:result.summary},['new_role_a','new_role_b']));
});
