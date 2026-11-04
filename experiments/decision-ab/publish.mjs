import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {refs,sha} from './prepare.mjs';
const v=process.argv[2];if(!['A','B'].includes(v))throw Error('A_OR_B_REQUIRED');
const source=resolve('../Perspecta/backend/.env.prompt-ab-decision-20261104',v),dest=resolve('experiments/decision-ab/results',v);
const report=JSON.parse(readFileSync(source+'/report.json','utf8'));
if(!report.completed)throw Error('OUTCOME_UNCERTAIN_DO_NOT_REPEAT');
mkdirSync(dest,{recursive:true});
for(const file of ['report.json','raw-content.txt','raw-output.json','mapped-output.json'])if(existsSync(source+'/'+file)){if(existsSync(dest+'/'+file)&&sha(readFileSync(dest+'/'+file))!==sha(readFileSync(source+'/'+file)))throw Error('REFUSE_OVERWRITE');copyFileSync(source+'/'+file,dest+'/'+file);}
let raw=null;try{raw=JSON.parse(readFileSync(source+'/raw-content.txt','utf8'));}catch{}
const names={zhang_xuefeng:'张雪峰',lei_jun:'雷军',wang_defeng:'王德峰',du_sujuan:'杜素娟'},headings={consensus:'共识',disagreements:'分歧',decisionFactors:'判断因素',nextActions:'后续行动'};
let text=`Perspecta 新版对照 ${v}（AI模拟，不是真人参与或原话）\n\n来源提交：${refs[v]}\n测试执行提交：${report.codeCommit}\n开始：${report.startedAt}\n结束：${report.finishedAt}\nHTTP：${report.upstreamStatus}；校验：${report.outcome}；上游请求：1次，无重试\n模型：deepseek-flash；实际返回model：${report.responseModel??'未提供'}\n参数：非思考、JSON、max_tokens=4500；temperature/top_p未设置，服务端默认\n用量：${JSON.stringify(report.usage)}\n缓存：${JSON.stringify(report.usageDetails)}\n供应商账单费用：${report.providerCost??'未返回，见对照报告估算'}\n请求SHA256：${report.requestSHA256}\n原文SHA256：${report.rawContentSHA256??'无原文'}\n\n本记录不是产品验收。正文及摘要保持模型输出，不为通过校验手改。\n\n`;
if(raw?.messages){
 text+='议题：大学阶段时间有限，应该优先投入绩点还是项目实践？\n\n';
 for(const m of raw.messages){const target=raw.messages.find(t=>t.id===m.replyTo);text+=`[${m.id} / 第${m.round}阶段 / ${names[m.roleId]??m.roleId}${target?` / 回应${target.id} ${names[target.roleId]??target.roleId}`:' / 独立开场'}]\n${m.content}\n\n`;}
 text+='模型原始摘要\n\n';for(const [key,items]of Object.entries(raw.summary??{})){text+=(headings[key]??key)+'\n';for(const item of Array.isArray(items)?items:[items])text+='- '+String(item)+'\n';text+='\n';}
}else if(existsSync(source+'/raw-content.txt'))text+='模型原始输出（解析或结构可能失败）\n'+readFileSync(source+'/raw-content.txt','utf8')+'\n';
else text+='本次没有可用的完整模型正文。\n';
const path=`docs/chat-logs/20261104-decision-${v}.txt`;writeFileSync(path,text.trimEnd()+'\n');console.log(JSON.stringify({variant:v,outcome:report.outcome,path,rawPath:dest+'/raw-content.txt'}));
