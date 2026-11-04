export type Role = { id: string; name: string; tagline: string; description?: string; avatar?: string };
export type Message = { id: string; round: 1 | 2 | 3 | 4; roleId: string; content: string; replyTo: string | null };
export const discussionStages=['抛出争点','质疑与反例','回应与修正','条件与未决'] as const;
export function roundLabel(round:number,rounds:2|3|4=4){return rounds===4?`第${round}阶段 · ${discussionStages[round-1]??'讨论'}`:round===1?'第一轮 · 独立陈述':round===2?'第二轮 · 观点交锋':'第三轮 · 继续交锋';}
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
export function makeMock(topic: string, ids: string[], rounds:2|3|4=4): Debate {
 const first: Message[] = ids.map((roleId,i)=>({id:`m${i+1}`,round:1,roleId,content:opinions[Math.max(0,roles.findIndex(r=>r.id===roleId))],replyTo:null}));
 const second: Message[] = ids.map((roleId,i)=>({id:`m${ids.length+i+1}`,round:2,roleId,replyTo:first[(i+1)%ids.length].id,content:`回应${roles.find(r=>r.id===ids[(i+1)%ids.length])?.name ?? '另一位嘉宾'}的观点：${['我认可通过实践取得反馈，但试错也要考虑时间和资源。如果尚未达到必要门槛，可以先用每周固定的小段时间验证兴趣，再决定是否扩大投入。','现实条件需要被认真对待，但也要避免用短期评价排除所有尝试。可以先做一个四周内可完成的实验，用实际成果判断是否值得继续。','探索与规划并不矛盾，真正的分歧在于如何评价投入的价值。先说明自己的目标和可承担的代价，讨论才不会停留在彼此都正确的口号上。','我赞同明确条件，也想补充：目标可能会随着经验改变。给自己设置一次回顾的时间，比要求现在就作出永远正确的选择更可行。'][i%4]}`}));
 const legacy:Debate={discussionId:`demo-${Date.now()}`,topic,messages:[...first,...second],summary:{consensus:['先明确个人目标与现实条件，再讨论时间如何分配。','实践需要产生反馈，规划也应保留调整的空间。'],disagreements:['有限时间应先满足外部门槛，还是优先投资探索与长期能力？'],decisionFactors:['目标是否存在硬性门槛，以及当前离门槛有多远。','可投入时间、试错成本与项目能否形成真实成果。','当前目标的确定程度，以及选择能否回退。'],nextActions:['列出目标、硬性条件与每周可支配时间。','设计一个四周内能交付的小任务，并约定回顾日期。']},usage:null};
 if(rounds===3)return {...legacy,messages:[...first,...second,...ids.map((roleId,i)=>({id:`m${2*ids.length+i+1}`,round:3 as const,roleId,replyTo:second[(i+1)%ids.length].id,content:'回应前面的观点：既要确认现实条件，也要给尝试留出空间。可以从小规模行动开始，得到反馈后再调整投入，不必把一种选择当作所有人的答案。'}))]};
 if(rounds===2)return legacy;
 const orders:Record<number,number[][]>={2:[[0,1],[0,1],[0,1],[0,1]],3:[[0,1,2],[1,0,2],[0,2,1],[2,1,0]],4:[[0,1,2,3],[0,3,2,1],[2,0,3,1],[3,1,0,2]]};
 const points=['先把必要条件与资源查清，再比较投入；同一条路径的要求不同，不能把分数或项目数量直接当作价值。','这个判断还缺一个反例：必要条件满足后，继续刷同一指标可能回报有限，真实任务的反馈也应进入比较。','刚才讨论的前提值得追问：行动本身是否有价值？承担现实责任并不等于只承认一种外部排名。','这条反例说明不能一刀切，但探索也有代价；若支持条件不足，应缩小尝试并约定回看，而不是押上全部资源。'];
 const messages:Message[]=orders[ids.length].flatMap((order,r)=>order.map((i,j)=>{const serial=r*ids.length+j+1;return {id:`m${serial}`,round:(r+1) as Message['round'],roleId:ids[i],content:points[(serial-1)%4],replyTo:serial===1?null:`m${serial-1}`};}));
 return {...legacy,messages};
}
export function validateDebate(value: unknown, ids: string[], rounds:2|3|4=4): asserts value is Debate {
 if (!value || typeof value !== 'object') throw new Error('讨论结果为空');
 const d=value as Debate;
 if(typeof d.discussionId!=='string'||typeof d.topic!=='string'||!Array.isArray(d.messages)||d.messages.length!==ids.length*rounds) throw new Error('讨论结果的字段或发言数量不完整');
 const seen=new Set<string>();const targets=new Map(ids.map(id=>[id,new Set<string>()]));
 d.messages.forEach((m,i)=>{
  if(!m||typeof m.id!=='string'||!m.id.trim()||seen.has(m.id)||!ids.includes(m.roleId)||m.round!==Math.floor(i/ids.length)+1||typeof m.content!=='string'||!m.content.trim()||[...m.content].length>600) throw new Error('讨论发言格式有误');
  seen.add(m.id);
  if(rounds===4){
   if(i===0&&m.replyTo!==null)throw new Error('首条发言不应包含回应');
   if(i>0){const previous=d.messages[i-1];if(m.replyTo!==previous.id||m.roleId===previous.roleId)throw new Error('讨论必须紧接上一位嘉宾的发言');targets.get(m.roleId)!.add(previous.roleId);}
  }else{
   if(m.round===1&&m.replyTo!==null) throw new Error('第一轮不应包含回应');
   if(m.round>1&&!d.messages.slice(0,rounds===3?i:ids.length).some(x=>x.id===m.replyTo&&x.roleId!==m.roleId)) throw new Error('第二轮必须回应另一位角色的第一轮观点');
  }
 });
 if(rounds===3&&!d.messages.some(m=>m.round===3&&d.messages.find(x=>x.id===m.replyTo)?.round===2))throw new Error('第三轮必须继续回应第二轮');
 for(const id of ids)for(let round=1;round<=rounds;round++)if(d.messages.filter(m=>m.roleId===id&&m.round===round).length!==1)throw new Error('角色发言分配有误');
 if(rounds===4&&ids.length>2&&[...targets.values()].some(set=>set.size<2))throw new Error('讨论接话对象过于单一');
 for(const [key] of sections)if(!Array.isArray(d.summary?.[key])||!d.summary[key].length||d.summary[key].length>3||d.summary[key].some(x=>typeof x!=='string'||!x.trim()||[...x].length>600))throw new Error('讨论总结不完整');
}
export function avatarImageSource(value?:string){
 if(!value)return undefined;
 if(value.startsWith('/assets/')&&!value.includes('..')&&!value.includes('\\'))return value;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:undefined;}catch{return undefined;}
}
export function formatDebateText(result:Debate,catalog:Role[],mode:BackendMode){
 const name=(id:string)=>catalog.find(r=>r.id===id)?.name??id;
 const rounds=(result.messages.at(-1)?.round??2) as 2|3|4;
 return [modeNotice(mode),result.topic,...result.messages.map(m=>`${roundLabel(m.round,rounds)} · ${name(m.roleId)}${m.replyTo?`（接${name(result.messages.find(x=>x.id===m.replyTo)?.roleId??'')}）`:''}：${m.content}`),...sections.map(([key,title])=>`${title}\n${result.summary[key].join('\n')}`)].join('\n\n');
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
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),60000);
 try {
  const response=await fetch(path,{...init,signal:controller.signal});
  let data;
  try {data=await response.json();}
  catch(error) {
   if(error instanceof Error&&error.name==='AbortError') throw error;
   throw new Error(response.ok?'服务返回格式异常，请重试':'服务暂时不可用，请重试');
  }
  if(!response.ok) {
   const message=data?.error?.message;
   throw new Error(typeof message==='string'&&message.trim()?message:'服务暂时不可用，请重试');
  }
  return {data,mode:readBackendMode(response.headers)};
 }
 catch(error) {
  if(error instanceof Error&&error.name==='AbortError') throw new Error('讨论生成超时，请重试');
  if(error instanceof TypeError) throw new Error('服务暂时无法连接，请稍后重试');
  throw error;
 }
 finally {clearTimeout(timer);}
}
export async function getCatalog() {if(isMock)return {roles,topics,mode:'mock' as BackendMode};const [r,t]=await Promise.all([request('/api/roles'),request('/api/topics')]);if(!Array.isArray(r.data?.roles)||!Array.isArray(t.data?.topics))throw new Error('角色或议题数据格式有误');return {roles:r.data.roles as Role[],topics:t.data.topics as typeof topics,mode:r.mode===t.mode?r.mode:'unknown' as BackendMode};}
export async function generateDebate(topic: string, ids: string[]) {
 const response=isMock?{data:await new Promise<Debate>(resolve=>setTimeout(()=>resolve(makeMock(topic,ids)),700)),mode:'mock' as BackendMode}:await request('/api/debate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic,roleIds:ids,rounds:4})});
 const data:unknown=response.data;validateDebate(data,ids);return {...data,mode:response.mode};
}
