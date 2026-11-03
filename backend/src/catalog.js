import { readFileSync } from 'node:fs';

const read = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
export const roles = read('roles');
export const topics = read('topics');
export const demo = read('demo-debate');
export const publicRoles = roles.map(({id, name, tagline, description, avatar}) => ({id, name, tagline, description, avatar}));
