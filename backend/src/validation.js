import { ApiError } from './errors.js';

export async function readJson(stream, limit = 8192) {
  if (!stream) throw new ApiError('INVALID_INPUT');
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new ApiError('INVALID_INPUT');
      }
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks)));
  } catch {
    throw new ApiError('INVALID_INPUT');
  } finally { reader.releaseLock(); }
}

export function validateInput(body, roles) {
  const validIds = new Set(roles.map(role => role.id));
  if (!body || Array.isArray(body) || typeof body !== 'object' || typeof body.topic !== 'string') throw new ApiError('INVALID_INPUT');
  const topic = body.topic.trim();
  const roleIds = body.roleIds;
  if ([...topic].length < 10 || [...topic].length > 300 || !Array.isArray(roleIds) || roleIds.length < 2 || roleIds.length > 4 ||
    new Set(roleIds).size !== roleIds.length || roleIds.some(id => typeof id !== 'string' || !validIds.has(id))) throw new ApiError('INVALID_INPUT');
  const rounds = body.rounds === undefined ? 2 : body.rounds;
  if (![2,3,4].includes(rounds)) throw new ApiError('INVALID_INPUT');
  return {topic, roleIds, rounds};
}

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, expected) => object(value) && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && [...value].length <= max;
// Bounded literal attribution check, not semantic/factual verification.
// Unquoted paraphrases and quotes introduced as new concepts are left to human review.
const attributedQuote = /(?:^|[。！？：:\n])\s*(?:回应\s*)?(?:你所说|你说过|你提到|你指出|你强调|你提出|你认为|你说)\s*[:：]?\s*[“"]([^”"\n]{6,80})[”"]/gu;

export function validateOutput(value, roleIds, {rounds=2} = {}) {
  if (rounds===4) return validateConversation(value,roleIds);
  const invalid = () => {throw new ApiError('INVALID_MODEL_OUTPUT');};
  if (!keys(value, ['messages', 'summary']) || !Array.isArray(value.messages) || value.messages.length !== rounds * roleIds.length ||
    !keys(value.summary, ['consensus', 'disagreements', 'decisionFactors', 'nextActions'])) invalid();
  const first = new Map();
  const prior = new Map();
  const ids = new Set();
  for (const [index, message] of value.messages.entries()) {
    const round = Math.floor(index/roleIds.length)+1;
    if (!keys(message, ['id', 'round', 'roleId', 'content', 'replyTo']) || !text(message.id, 80) || ids.has(message.id) ||
      message.round !== round || !roleIds.includes(message.roleId) || !text(message.content, 600)) invalid();
    ids.add(message.id);
    if (round === 1) {if (message.replyTo !== null) invalid(); first.set(message.id, message);}
    else {
      const allowed=rounds===3?prior:first;
      if (typeof message.replyTo !== 'string' || !allowed.has(message.replyTo) || allowed.get(message.replyTo).roleId === message.roleId) invalid();
      for (const [,quote] of message.content.matchAll(attributedQuote)) {
        if (!allowed.get(message.replyTo).content.includes(quote)) invalid();
      }
    }
    prior.set(message.id,message);
  }
  if(rounds===3&&!value.messages.some(m=>m.round===3&&prior.get(m.replyTo)?.round===2))invalid();
  for (let round=1;round<=rounds;round++) {
    const messages = value.messages.filter(m => m.round === round);
    if (new Set(messages.map(m => m.roleId)).size !== roleIds.length) invalid();
  }
  for (const values of Object.values(value.summary)) {
    if (!Array.isArray(values) || values.length < 1 || values.length > 3 || values.some(value => !text(value, 600))) invalid();
  }
  return value;
}


const conversationalQuote=/(?:回应|(?:你|他|她)(?:所说|说|提到|强调|提出|指出))[^“"\n:：]{0,24}[：:]?\s*[“"]([^”"\n]{2,80})[”"]/gu;
function validateConversation(value,roleIds){
 const invalid=()=>{throw new ApiError('INVALID_MODEL_OUTPUT');};
 if(!keys(value,['messages','summary'])||!Array.isArray(value.messages)||value.messages.length!==4*roleIds.length||
  !keys(value.summary,['consensus','disagreements','decisionFactors','nextActions']))invalid();
 const ids=new Set();const targets=new Map(roleIds.map(id=>[id,new Set()]));
 for(const [index,message] of value.messages.entries()){
  if(!keys(message,['id','round','roleId','content','replyTo'])||!text(message.id,80)||ids.has(message.id)||
   message.round!==Math.floor(index/roleIds.length)+1||!roleIds.includes(message.roleId)||!text(message.content,600)||
   /我会先问|如果我是这个人物|作为(?:一个)?(?:AI|人工智能)/u.test(message.content))invalid();
  ids.add(message.id);
  if(index===0){if(message.replyTo!==null)invalid();}
  else{
   const previous=value.messages[index-1];
   if(message.replyTo!==previous.id||message.roleId===previous.roleId)invalid();
   targets.get(message.roleId).add(previous.roleId);
   for(const regex of [attributedQuote,conversationalQuote])for(const [,quote]of message.content.matchAll(regex))if(!previous.content.includes(quote))invalid();
  }
 }
 for(const round of [1,2,3,4])if(new Set(value.messages.filter(m=>m.round===round).map(m=>m.roleId)).size!==roleIds.length)invalid();
 if(roleIds.length>2&&[...targets.values()].some(set=>set.size<2))invalid();
 for(const list of Object.values(value.summary))if(!Array.isArray(list)||list.length<1||list.length>3||list.some(item=>!text(item,600)))invalid();
 return value;
}
