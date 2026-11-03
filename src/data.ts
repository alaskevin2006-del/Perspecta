export type Role = { id: string; name: string; tagline: string; description?: string; avatar?: string };
export type Message = { id: string; round: 1 | 2; roleId: string; content: string; replyTo: string | null };
export const sections = [['consensus','主要共识'],['disagreements','核心分歧'],['decisionFactors','关键变量'],['nextActions','下一步行动']] as const;
export type Debate = { discussionId: string; topic: string; messages: Message[]; summary: Record<typeof sections[number][0], string[]>; usage: { inputTokens: number; outputTokens: number } | null };
export const roles: Role[] = [
 {id:'zhang_xuefeng',name:'张雪峰',tagline:'教育规划 · 现实选择'},
 {id:'lei_jun',name:'雷军',tagline:'实践创新 · 长期成长'},
 {id:'wang_defeng',name:'王德峰',tagline:'哲学思辨 · 人生意义'},
 {id:'du_sujuan',name:'杜素娟',tagline:'文学教育 · 自我发现'},
];
export const topics = [
 {id:'gpa_or_projects',title:'绩点，还是项目实践？',prompt:'大学阶段时间有限，应该优先提高绩点还是积累项目实践？'},
 {id:'postgraduate_or_work',title:'考研，还是直接就业？',prompt:'对大二学生而言，何时开始确定考研还是就业方向更合理？'},
 {id:'stability_or_exploration',title:'尽早确定，还是继续探索？',prompt:'大学生应该尽早确定未来方向，还是广泛尝试不同的可能性？'},
];
// These are authored demonstration perspectives, not quotations or verified personal positions.
const opinions = [
 '先把目标的硬性门槛弄清楚。如果升学或求职确实有成绩要求，就先守住底线，再把剩余时间交给能拿出成果的实践。关键不是把时间填满，而是确认投入能否帮助你走到下一步。',
 '实践的价值是获得真实反馈。成绩达到必要要求后，不妨做一个能完整交付的小项目，体验从想法到结果的过程。但项目也要有清楚的目标，忙碌本身并不等于能力成长。',
 '选择之前，也要追问自己为什么这样选择。一个外部评价可以提供参照，却不能代替你认识自己的生活。既要承认现实条件，也要留下一点空间，判断这条道路是否值得持续投入。',
 '不要急着用一种标准概括自己。通过具体的课程、项目和人与人的交流，观察哪些事情让你愿意持续学习。探索需要边界，但对自己的了解，往往来自行动之后的反思。',
];
export function makeMock(topic: string, ids: string[]): Debate {
 const first: Message[] = ids.map((roleId,i)=>({id:`m${i+1}`,round:1,roleId,content:opinions[Math.max(0,roles.findIndex(r=>r.id===roleId))],replyTo:null}));
 const second: Message[] = ids.map((roleId,i)=>({id:`m${ids.length+i+1}`,round:2,roleId,replyTo:first[(i+1)%ids.length].id,content:`回应${roles.find(r=>r.id===ids[(i+1)%ids.length])?.name ?? '另一位嘉宾'}的观点：${['我认可通过实践取得反馈，但试错也要考虑时间和资源。如果尚未达到必要门槛，可以先用每周固定的小段时间验证兴趣，再决定是否扩大投入。','现实条件需要被认真对待，但也要避免用短期评价排除所有尝试。可以先做一个四周内可完成的实验，用实际成果判断是否值得继续。','探索与规划并不矛盾，真正的分歧在于如何评价投入的价值。先说明自己的目标和可承担的代价，讨论才不会停留在彼此都正确的口号上。','我赞同明确条件，也想补充：目标可能会随着经验改变。给自己设置一次回顾的时间，比要求现在就作出永远正确的选择更可行。'][i%4]}`}));
 return {discussionId:`demo-${Date.now()}`,topic,messages:[...first,...second],summary:{consensus:['先明确个人目标与现实条件，再讨论时间如何分配。','实践需要产生反馈，规划也应保留调整的空间。'],disagreements:['有限时间应先满足外部门槛，还是优先投资探索与长期能力？'],decisionFactors:['目标是否存在硬性门槛，以及当前离门槛有多远。','可投入时间、试错成本与项目能否形成真实成果。','当前目标的确定程度，以及选择能否回退。'],nextActions:['列出目标、硬性条件与每周可支配时间。','设计一个四周内能交付的小任务，并约定回顾日期。']},usage:null};
}
export function validateDebate(value: unknown, ids: string[]): asserts value is Debate {
 if (!value || typeof value !== 'object') throw new Error('讨论结果为空');
 const d=value as Debate;
 if(typeof d.discussionId!=='string'||typeof d.topic!=='string'||!Array.isArray(d.messages)||d.messages.length!==ids.length*2) throw new Error('讨论结果的字段或发言数量不完整');
 const seen=new Set<string>();
 d.messages.forEach((m,i)=>{
 if(!m||typeof m.id!=='string'||seen.has(m.id)||!ids.includes(m.roleId)||m.round!==(i<ids.length?1:2)||typeof m.content!=='string'||!m.content.trim()) throw new Error('讨论发言格式有误');
 seen.add(m.id);
 if(m.round===1&&m.replyTo!==null) throw new Error('第一轮不应包含回应');
 if(m.round===2&&!d.messages.slice(0,ids.length).some(x=>x.id===m.replyTo&&x.roleId!==m.roleId)) throw new Error('第二轮必须回应另一位角色的第一轮观点');
 });
 for(const id of ids) for(const round of [1,2]) if(d.messages.filter(m=>m.roleId===id&&m.round===round).length!==1) throw new Error('角色发言分配有误');
 for(const [key] of sections) if(!Array.isArray(d.summary?.[key])||!d.summary[key].length||d.summary[key].some(x=>typeof x!=='string'||!x.trim())) throw new Error('讨论总结不完整');
}
export const isMock = import.meta.env?.VITE_API_MODE !== 'live';
export type BackendMode = 'mock' | 'live' | 'unknown';
export function readBackendMode(headers: Headers): BackendMode {
 const value=headers.get('X-Perspecta-Mode');
 return value==='mock'||value==='live'?value:'unknown';
}
export function modeNotice(mode: BackendMode): string {
 return mode==='mock'?'当前为模拟演示数据，不代表人物真实观点。':mode==='live'?'基于公开资料的 AI 模拟讨论，非本人发言。':'数据模式待确认，不代表人物真实观点。';
}
async function request(path: string, init?: RequestInit) {
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),45000);
 try { const response=await fetch(path,{...init,signal:controller.signal}); const data=await response.json(); if(!response.ok) throw new Error(data.error?.message || '服务暂时不可用，请重试'); return {data,mode:readBackendMode(response.headers)}; }
 catch(error) { if(error instanceof Error&&error.name==='AbortError') throw new Error('讨论生成超时，请重试');throw error; }
 finally {clearTimeout(timer);}
}
export async function getCatalog() {if(isMock)return {roles,topics,mode:'mock' as BackendMode};const [r,t]=await Promise.all([request('/api/roles'),request('/api/topics')]);if(!Array.isArray(r.data.roles)||!Array.isArray(t.data.topics))throw new Error('角色或议题数据格式有误');return {roles:r.data.roles as Role[],topics:t.data.topics as typeof topics,mode:r.mode===t.mode?r.mode:'unknown' as BackendMode};}
export async function generateDebate(topic: string, ids: string[]) {
 if(!isMock&&ids.length>Number(import.meta.env?.VITE_API_MAX_ROLES||3))throw new Error('当前服务暂不支持四人讨论，请先选择两至三位嘉宾');
 const response=isMock?{data:await new Promise<Debate>(resolve=>setTimeout(()=>resolve(makeMock(topic,ids)),700)),mode:'mock' as BackendMode}:await request('/api/debate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic,roleIds:ids})});
 const data:unknown=response.data;validateDebate(data,ids);return {...data,mode:response.mode};
}
