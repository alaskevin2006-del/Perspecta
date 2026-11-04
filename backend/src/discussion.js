// Bounded turn skeletons vary partners without consecutive same-speaker boundaries.
const orders={
 2:[[0,1],[0,1],[0,1],[0,1]],
 3:[[0,1,2],[1,0,2],[0,2,1],[2,1,0]],
 4:[[0,1,2,3],[0,3,2,1],[2,0,3,1],[3,1,0,2]],
};
export const discussionStages=['抛出争点','质疑与反例','回应与修正','条件与未决'];
export function buildTurnPlan(roleIds){
 if(!orders[roleIds.length]||new Set(roleIds).size!==roleIds.length)throw new Error('Invalid discussion roster');
 return orders[roleIds.length].flatMap((order,r)=>order.map((i,j)=>{
  const serial=r*roleIds.length+j+1;
  return {id:`m${serial}`,round:r+1,roleId:roleIds[i],replyTo:serial===1?null:`m${serial-1}`};
 }));
}
