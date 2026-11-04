// Offline advisory only. No text is returned, and no semantic verdict is inferred.
const normalize=text=>text.normalize('NFC').replace(/\s+/gu,'');
const grams=text=>{const chars=[...normalize(text)];return new Set(chars.slice(1).map((c,i)=>chars[i]+c));};
export function qualityReview({messages=[],summary={}}){
 const flags=[];
 for(let i=0;i<messages.length;i++)for(let j=i+1;j<messages.length;j++){
  const a=messages[i],b=messages[j];if(Math.min([...a.content].length,[...b.content].length)<60)continue;
  const left=grams(a.content),right=grams(b.content);const union=new Set([...left,...right]).size;const intersection=[...left].filter(g=>right.has(g)).length;
  const similarity=union?intersection/union:0;
  if(similarity>=.75)flags.push({code:'SIMILAR_SPEECH',messageIds:[a.id,b.id],similarity:Math.round(similarity*100)/100});
 }
 const seen=new Map();
 for(const [field,lines]of Object.entries(summary))for(const line of lines){
  if(/所有|全体|一致|一律|必须|绝对|没有弹性/u.test(line))flags.push({code:'SUMMARY_ABSOLUTE',summaryFields:[field]});
  const key=normalize(line);if(seen.has(key)&&seen.get(key)!==field)flags.push({code:'SUMMARY_REPEATED',summaryFields:[seen.get(key),field]});seen.set(key,field);
 }
 return {semanticVerdict:'HUMAN_REVIEW_REQUIRED',flags};
}
