// Fixed feasible reply graphs: cross-round revisits plus immediate exchanges.
const turns={
 2:[[0,1,null],[1,1,null],[0,2,2],[1,2,1],[0,3,4],[1,3,3],[0,4,6],[1,4,5]],
 3:[[0,1,null],[1,1,null],[2,1,null],[0,2,3],[1,2,1],[2,2,2],[0,3,5],[1,3,6],[2,3,4],[0,4,9],[1,4,7],[2,4,8]],
 4:[[0,1,null],[1,1,null],[2,1,null],[3,1,null],[0,2,4],[3,2,5],[2,2,2],[1,2,7],[0,3,6],[3,3,9],[2,3,8],[1,3,11],[0,4,12],[1,4,10],[2,4,9],[3,4,11]],
};
export const discussionStages=['抛出争点','质疑与反例','回应与修正','条件与未决'];
export function buildTurnPlan(roleIds){
 if(!turns[roleIds.length]||new Set(roleIds).size!==roleIds.length)throw new Error('Invalid discussion roster');
 return turns[roleIds.length].map(([i,round,target],k)=>({id:`m${k+1}`,round,roleId:roleIds[i],replyTo:target?`m${target}`:null}));
}
