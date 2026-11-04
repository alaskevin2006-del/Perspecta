import { ApiError, invalidModelOutput } from './errors.js';

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

export function validateOutput(value, roleIds, {rounds=2,legacyFour=false} = {}) {
  if (rounds===4) return legacyFour?validateLegacyConversation(value,roleIds):validateConversation(value,roleIds);
  const invalid = (reason,path) => {throw invalidModelOutput(reason,path);};
  validateEnvelope(value,rounds*roleIds.length);
  const first = new Map();
  const prior = new Map();
  const ids = new Set();
  for (const [index, message] of value.messages.entries()) {
    const round = Math.floor(index/roleIds.length)+1;
    if (!keys(message, ['id', 'round', 'roleId', 'content', 'replyTo']) || !text(message.id, 80) || ids.has(message.id) ||
      message.round !== round || !roleIds.includes(message.roleId) || !text(message.content, 600)) invalid('MESSAGE_STRUCTURE',`messages[${index}]`);
    ids.add(message.id);
    if (round === 1) {if (message.replyTo !== null) invalid('REFERENCE_INVALID',`messages[${index}].replyTo`); first.set(message.id, message);}
    else {
      const allowed=rounds===3?prior:first;
      if (typeof message.replyTo !== 'string' || !allowed.has(message.replyTo) || allowed.get(message.replyTo).roleId === message.roleId) invalid('REFERENCE_INVALID',`messages[${index}].replyTo`);
      for (const [,quote] of message.content.matchAll(attributedQuote)) {
        if (!allowed.get(message.replyTo).content.includes(quote)) invalid('QUOTE_MISMATCH',`messages[${index}].content`);
      }
    }
    prior.set(message.id,message);
  }
  if(rounds===3&&!value.messages.some(m=>m.round===3&&prior.get(m.replyTo)?.round===2))invalid();
  for (let round=1;round<=rounds;round++) {
    const messages = value.messages.filter(m => m.round === round);
    if (new Set(messages.map(m => m.roleId)).size !== roleIds.length) invalid();
  }
  validateSummary(value.summary);
  return value;
}


const conversationalQuote=/(?:回应|(?:你|他|她)(?:所说|说|提到|强调|提出|指出))[^“"\n:：]{0,24}[：:]?\s*[“"]([^”"\n]{2,80})[”"]/gu;
function validateLegacyConversation(value,roleIds){
 const invalid=(reason,path)=>{throw invalidModelOutput(reason,path);};
 validateEnvelope(value,4*roleIds.length);
 const ids=new Set();const targets=new Map(roleIds.map(id=>[id,new Set()]));
 for(const [index,message] of value.messages.entries()){
  if(!keys(message,['id','round','roleId','content','replyTo'])||!text(message.id,80)||ids.has(message.id)||
   message.round!==Math.floor(index/roleIds.length)+1||!roleIds.includes(message.roleId)||!text(message.content,600)||
   /我会先问|如果我是这个人物|作为(?:一个)?(?:AI|人工智能)/u.test(message.content))invalid('MESSAGE_STRUCTURE',`messages[${index}]`);
  ids.add(message.id);
  if(index===0){if(message.replyTo!==null)invalid('REFERENCE_INVALID',`messages[${index}].replyTo`);}
  else{
   const previous=value.messages[index-1];
   if(message.replyTo!==previous.id||message.roleId===previous.roleId)invalid('REFERENCE_INVALID',`messages[${index}].replyTo`);
   targets.get(message.roleId).add(previous.roleId);
   for(const regex of [attributedQuote,conversationalQuote])for(const [,quote]of message.content.matchAll(regex))if(!previous.content.includes(quote))invalid('QUOTE_MISMATCH',`messages[${index}].content`);
  }
 }
 for(const round of [1,2,3,4])if(new Set(value.messages.filter(m=>m.round===round).map(m=>m.roleId)).size!==roleIds.length)invalid();
 if(roleIds.length>2&&[...targets.values()].some(set=>set.size<2))invalid();
 validateSummary(value.summary);
 return value;
}

function validateConversation(value,roleIds){
 const invalid=(reason,path)=>{throw invalidModelOutput(reason,path);};
 validateEnvelope(value,4*roleIds.length);
 const prior=new Map(),bodies=new Set(),targets=new Map(roleIds.map(id=>[id,new Set()]));
 for(const [index,message]of value.messages.entries()){
  if(!keys(message,['id','round','roleId','content','replyTo'])||!text(message.id,80)||prior.has(message.id)||message.round!==Math.floor(index/roleIds.length)+1||!roleIds.includes(message.roleId)||!text(message.content,600)||/我会先问|如果我是这个人物|作为(?:一个)?(?:AI|人工智能)/u.test(message.content))invalid('MESSAGE_STRUCTURE',`messages[${index}]`);
  const body=message.content.normalize('NFC').replace(/\s+/gu,'');if(bodies.has(body))invalid('DUPLICATE_CONTENT',`messages[${index}].content`);bodies.add(body);
  if(message.round===1){if(message.replyTo!==null)invalid('REFERENCE_INVALID',`messages[${index}].replyTo`);}
  else{
   const target=prior.get(message.replyTo);if(!target||target.roleId===message.roleId)invalid('REFERENCE_INVALID',`messages[${index}].replyTo`);
   targets.get(message.roleId).add(target.roleId);
   if(message.round===3&&prior.get(target.replyTo)?.roleId!==message.roleId)invalid('REFERENCE_INVALID',`messages[${index}].replyTo`);
   for(const regex of [attributedQuote,conversationalQuote])for(const [,quote]of message.content.matchAll(regex))if(!target.content.includes(quote))invalid('QUOTE_MISMATCH',`messages[${index}].content`);
  }
  prior.set(message.id,message);
 }
 for(const round of [1,2,3,4]){
  const phase=value.messages.filter(m=>m.round===round);if(new Set(phase.map(m=>m.roleId)).size!==roleIds.length)invalid();
  if(round>1){
   if(phase.filter(m=>prior.get(m.replyTo)?.round<round).length<Math.min(2,roleIds.length))invalid();
   if(!phase.some(m=>value.messages.findIndex(p=>p.id===m.replyTo)<value.messages.indexOf(m)-1))invalid();
  }
 }
 if(roleIds.length>2&&[...targets.values()].some(set=>set.size<2))invalid();
 validateSummary(value.summary);
 return value;
}

const summaryFields=['consensus','disagreements','decisionFactors','nextActions'];
function validateEnvelope(value,count){
 if(!keys(value,['messages','summary']))throw invalidModelOutput('OUTPUT_STRUCTURE','$');
 if(!Array.isArray(value.messages))throw invalidModelOutput('OUTPUT_STRUCTURE','messages');
 if(value.messages.length!==count)throw invalidModelOutput('MESSAGE_COUNT','messages');
 if(!keys(value.summary,summaryFields))throw invalidModelOutput('OUTPUT_STRUCTURE','summary');
}
function validateSummary(summary){
 for(const field of summaryFields){
  const list=summary[field];
  if(!Array.isArray(list))throw invalidModelOutput('OUTPUT_STRUCTURE',`summary.${field}`);
  if(list.length<1||list.length>3)throw invalidModelOutput('SUMMARY_COUNT',`summary.${field}`);
  if(list.some(item=>!text(item,600)))throw invalidModelOutput('SUMMARY_CONTENT',`summary.${field}`);
 }
}
