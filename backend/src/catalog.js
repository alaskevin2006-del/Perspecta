import { readFileSync } from 'node:fs';

const read = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const avatars = {career_realist:'career', growth_explorer:'growth', risk_analyst:'risk'};
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 2000;
const list = value => Array.isArray(value) && value.length > 0 && value.length <= 20 && value.every(text);

export function createCatalog(roleData, topicData) {
  if (!Array.isArray(roleData) || roleData.length < 2 || roleData.length > 30 ||
    roleData.some(role => !role || typeof role.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(role.id) ||
      !['name','tagline','description','speakingStyle'].every(key => text(role[key])) ||
      !['coreValues','typicalQuestions','boundaries'].every(key => list(role[key])) ||
      !Array.isArray(role.sources) || (role.avatar !== undefined && !text(role.avatar))) ||
    new Set(roleData.map(role => role.id)).size !== roleData.length) throw new Error('Invalid local role catalog');
  if (!Array.isArray(topicData) || topicData.length < 1 || topicData.length > 20 ||
    topicData.some(topic => !topic || !['id','title','prompt'].every(key => text(topic[key]))) ||
    new Set(topicData.map(topic => topic.id)).size !== topicData.length) throw new Error('Invalid local topic catalog');
  return {roles: roleData, topics: topicData,
    publicRoles: roleData.map(({id,name,tagline,description,avatar}) => ({id,name,tagline,description,avatar:avatar ?? avatars[id] ?? 'career'}))};
}

export const {roles, topics, publicRoles} = createCatalog(read('roles'), read('topics'));
export const demo = read('demo-debate');
