import {useEffect,useRef,useState} from 'react';
import {toPng} from 'html-to-image';
import {seatLayouts} from './seat-layout';
import {getSceneArtwork,type SceneArtwork} from './scene-artwork';
import {getCatalog,generateDebate,isMock,modeNotice,sections,topics,type BackendMode,type Role,type Debate} from './data';

type Phase='setup'|'loading'|'playing'|'completed'|'error';
const sceneAssets={2:'/assets/scenes/two.png',3:'/assets/scenes/three.png',4:'/assets/scenes/four.png'};
type SceneCount=keyof typeof sceneAssets;
// Keep all guest previews in the original design's consistent portrait style.
const guestPortraits:Record<string,{position:string}>={
 zhang_xuefeng:{position:'4.67% 52.91%'},
 lei_jun:{position:'4.67% 60.80%'},
 wang_defeng:{position:'4.67% 68.80%'},
 du_sujuan:{position:'4.67% 76.91%'},
};
function guestPortraitStyle(id:string){
 const portrait=guestPortraits[id];
 return portrait?{backgroundImage:'url(/assets/characters/guest-portrait-source.png)',backgroundPosition:portrait.position,backgroundSize:'2533.333% auto'}:undefined;
}
export function App(){
 const [catalog,setCatalog]=useState<{roles:Role[];topics:typeof topics}>({roles:[],topics:[]});
 const [catalogError,setCatalogError]=useState('');const [catalogRetry,setCatalogRetry]=useState(0);
 const [topic,setTopic]=useState('');const [selected,setSelected]=useState<string[]>([]);
 const [sceneCount,setSceneCount]=useState<SceneCount>(4);
 const [submittedRoleIds,setSubmittedRoleIds]=useState<string[]|null>(null);
 const sceneArtwork=getSceneArtwork(submittedRoleIds??[]);
 const [readyArtworkSrc,setReadyArtworkSrc]=useState('');
 const showSceneArtwork=!!sceneArtwork&&readyArtworkSrc===sceneArtwork.src;
 const [sceneScale,setSceneScale]=useState(()=>Math.min(window.innerWidth/1671,Math.max(1,window.innerHeight)/941));
 useEffect(()=>{const resize=()=>setSceneScale(Math.min(window.innerWidth/1671,Math.max(1,window.innerHeight)/941));window.addEventListener('resize',resize);resize();return()=>window.removeEventListener('resize',resize);},[]);
 useEffect(()=>{setReadyArtworkSrc('');if(!sceneArtwork)return;let active=true;const img=new Image();img.src=sceneArtwork.src;void img.decode().then(()=>{if(active)setReadyArtworkSrc(sceneArtwork.src);}).catch(()=>{/* Retain name seats if the artwork cannot load. */});return()=>{active=false;};},[sceneArtwork]);
 const [phase,setPhase]=useState<Phase>('setup');const [error,setError]=useState('');
 const [validation,setValidation]=useState<'topic'|'guests'|null>(null);
 useEffect(()=>{setValidation(null);},[topic,selected]);
 const [result,setResult]=useState<Debate|null>(null);const [index,setIndex]=useState(0);const [paused,setPaused]=useState(false);
 const [tab,setTab]=useState<'summary'|'history'>('summary');const [expanded,setExpanded]=useState<string|null>(null);
 const [exporting,setExporting]=useState(false);const [pngUrl,setPngUrl]=useState('');const [notice,setNotice]=useState('');const [resetOpen,setResetOpen]=useState(false);
 const exportRef=useRef<HTMLDivElement>(null);const inFlight=useRef(false);const alive=useRef(true);
 const aboutRef=useRef<HTMLDialogElement>(null);
 const [catalogMode,setCatalogMode]=useState<BackendMode>(isMock?'mock':'unknown');
 const [resultMode,setResultMode]=useState<BackendMode>('unknown');
 const displayedMode=result?resultMode:catalogMode;
 const dataNotice=modeNotice(displayedMode);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{let active=true;setCatalogError('');getCatalog().then(c=>{if(active){setCatalog(c);setCatalogMode(c.mode);}}).catch(e=>{if(active)setCatalogError(e.message);});return()=>{active=false;};},[catalogRetry]);
 const current=result?.messages[phase==='completed'?result.messages.length-1:index];const completedCount=phase==='completed'?result?.messages.length??0:index;
 const reduced=useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const advance=()=>{if(!result)return;if(index+1>=result.messages.length){setPhase('completed');setTab('summary');}else setIndex(i=>i+1);};
 useEffect(()=>{if(phase!=='playing'||paused||!result||reduced.current)return;const timer=setTimeout(()=>{if(index+1>=result.messages.length){setPhase('completed');setTab('summary');}else setIndex(i=>i+1);},Math.max(6500,(current?.content.length??0)*110));return()=>clearTimeout(timer);},[phase,paused,index,result,current]);
 const editable=phase==='setup'||phase==='error';const valid=[...topic.trim()].length>=10&&[...topic.trim()].length<=300&&selected.length>=2&&selected.length<=4;
 const role=(id:string)=>catalog.roles.find(r=>r.id===id);
 const toggle=(id:string)=>setSelected(ids=>ids.includes(id)?ids.filter(x=>x!==id):ids.length<4?[...ids,id]:ids);
 async function start(){if(inFlight.current)return;if(!valid){setError('');setValidation([...topic.trim()].length<10||[...topic.trim()].length>300?'topic':'guests');if([...topic.trim()].length<10)document.getElementById('topic')?.focus();return;}inFlight.current=true;setSubmittedRoleIds([...selected]);setSceneCount(selected.length as SceneCount);setPhase('loading');setError('');setNotice('');setResult(null);setIndex(0);setExpanded(null);setPaused(false);try{const d=await generateDebate(topic.trim(),[...selected]);if(alive.current){setResult(d);setResultMode(d.mode);setPhase('playing');setTab('history');}}catch(e){if(alive.current){setError(e instanceof Error?e.message:'生成失败，请重试');setPhase('error');}}finally{inFlight.current=false;}}
 function reset(){setSubmittedRoleIds(null);setSceneCount(4);setPhase('setup');setResult(null);setIndex(0);setExpanded(null);setPaused(false);setError('');setNotice('');setResetOpen(false);}
 async function saveImage(){if(!exportRef.current||exporting)return;setExporting(true);setNotice('');try{await document.fonts.ready;const url=await toPng(exportRef.current,{pixelRatio:2,backgroundColor:'#f4f0e8'});const a=document.createElement('a');a.href=url;a.download=`Perspecta_思辨札记_${localDate()}.png`;a.click();setPngUrl(url);setNotice('思辨札记已生成，请查看浏览器下载。');}catch{setNotice('图片生成失败，请重试或复制文本。');}finally{setExporting(false);}}
 async function copy(){if(!result)return;try{await navigator.clipboard.writeText([result.topic,...result.messages.map(m=>`${role(m.roleId)?.name}：${m.content}`),...sections.map(([k,t])=>`${t}\n${result.summary[k].join('\n')}`)].join('\n\n'));setNotice('已复制完整讨论与总结。');}catch{setNotice('复制失败，请检查浏览器剪贴板权限。');}}
 return <main className="app">
 <div className="ambient-backdrop" aria-hidden="true"><div className="ambient-image" style={{backgroundImage:`url(${sceneAssets[sceneCount]})`}}/></div>
 <div className="scene-wrap" id="roundtable"><div className="scene-fit" style={{width:1671*sceneScale,height:941*sceneScale}}><div className="scene" style={{backgroundImage:`url(${sceneAssets[4]})`,transform:`scale(${sceneScale})`}}>
 <SceneBackdrop count={sceneCount} artwork={showSceneArtwork?sceneArtwork:undefined}/>
 <header className="masthead"><div className="brand brand-gold"><span className="brand-art"><img src="/assets/brand/perspecta-gold.png" alt="Perspecta 金色指南针标志" width={2188} height={718}/></span></div><nav className="top-nav" aria-label="主导航"><a href="#roundtable" aria-current="page">圆桌讨论</a><button type="button" aria-haspopup="dialog" onClick={()=>aboutRef.current?.showModal()}>关于我们</button></nav></header>
 <section className="book question" aria-label="提问手记"><div className="eyebrow"><span>01</span> QUESTION &amp; COMPANY</div><h1>提问手记</h1>
 {editable?<><label className="question-label" htmlFor="topic">写下此刻的困惑</label><textarea id="topic" aria-invalid={validation==='topic'} aria-describedby={validation==='topic'?'topic-validation':undefined} placeholder="关于选择，你正在犹豫什么？" value={topic} maxLength={600} onChange={e=>setTopic(e.target.value)}/><div className="count">{[...topic.trim()].length} / 300 <span id="topic-validation" role={validation==='topic'?'alert':undefined}>{validation==='topic'?([...topic.trim()].length>300?'请控制在 300 字以内':'至少写满10字，或选下方议题'):''}</span></div><div className="suggestions">{catalog.topics.map(t=><button key={t.id} onClick={()=>setTopic(t.prompt)}>{t.title}<span>↗</span></button>)}</div></>:<blockquote className="chosen-topic" tabIndex={0} aria-label="本场议题，可滚动阅读">{topic}</blockquote>}
 <div className="guest-heading"><h2>本场嘉宾</h2><small className={validation==='guests'?'validation-hint':undefined} role={validation==='guests'?'alert':undefined}>{validation==='guests'?'请至少邀请 2 位嘉宾':<>已邀请 {selected.length}/4</>}</small></div>
 <div className="guest-list">{catalog.roles.map((r,i)=><label className={`guest ${selected.includes(r.id)?'selected':''}`} key={r.id}><span className="guest-number" aria-hidden="true">{String(i+1).padStart(2,'0')}</span><span className="guest-avatar" aria-hidden="true" style={guestPortraitStyle(r.id)}>{!guestPortraits[r.id]&&<span>{r.name.slice(-2)}</span>}</span><span className="guest-copy"><strong>{r.name}</strong><small>{r.tagline}</small></span><input type="checkbox" aria-label={`邀请${r.name}`} checked={selected.includes(r.id)} disabled={!editable} onChange={()=>toggle(r.id)}/></label>)}</div>
 {catalogError&&<div role="alert">{catalogError}<button onClick={()=>setCatalogRetry(n=>n+1)}>重新加载</button></div>}
 <div className="question-bottom">{editable?<><button className="primary" onClick={start}><span className="cta-copy"><span className="cta-label">开启这场对话</span></span><span className="cta-arrow" aria-hidden="true"><span>↗</span></span></button></>:<button className="text-button" disabled={phase==='loading'} onClick={()=>setResetOpen(true)}>↶ 调整议题与嘉宾</button>}{error&&<p className="error" role="alert">{error}</p>}</div></section>
 <section className="stage" aria-label="圆桌舞台"><div className="stage-title"><div className="eyebrow">PERSPECTIVES, IN CONVERSATION</div><h2>让选择，在对话中清晰</h2></div>
 {phase==='loading'?<div className="speaker loading" role="status"><div className="eyebrow">请稍候</div><h3>观点正在酝酿，请稍候…</h3><p>正在围绕你的问题，准备不同视角的讨论。</p></div>:current&&result?<div className="speaker" key={current.id}><div className="speaker-meta"><span>{current.round===1?'第一轮 · 独立陈述':'第二轮 · 观点交锋'}</span><span>{phase==='completed'?result.messages.length:index+1} / {result.messages.length}</span></div><h3>{role(current.roleId)?.name}</h3><p>{current.content}</p></div>:<div className="invitation"><span className="invitation-rule"/><p>重要的不是立刻有答案，<br/>而是看见更多可能。</p></div>}
 {!showSceneArtwork&&<div className="seats">{selected.map((id,i)=><div className={`seat ${current?.roleId===id?'speaking':''}`} style={{left:`${seatLayouts[selected.length]?.centers[i]??50}%`,width:`${seatLayouts[selected.length]?.width??30}%`}} key={id}><div className="seat-avatar guest-avatar" aria-hidden="true" style={guestPortraitStyle(id)}>{!guestPortraits[id]&&<span>{role(id)?.name.slice(-2)}</span>}</div><span>{role(id)?.name}</span></div>)}</div>}
 <div className={`stage-bottom${phase==='playing'?' playback-controls':''}`}>{phase==='playing'?<><div className="playback"><button onClick={()=>setPaused(p=>!p)}>{paused?'继续播放':'暂停播放'}</button><button onClick={advance}>下一位 →</button><button onClick={()=>{setPhase('completed');setTab('summary');}}>跳过播放</button></div><div className="progress"><span style={{width:`${index/(result?.messages.length||1)*100}%`}}/></div></>:<div className="steps"><span className={current?.round===1?'active':''}><em>01</em> 独立陈述</span><b>—</b><span className={current?.round===2?'active':''}><em>02</em> 观点交锋</span><b>—</b><span className={phase==='completed'?'active':''}><em>03</em> 思辨札记</span></div>}</div></section>
 <section className="book notes" aria-label="思辨札记"><div className="eyebrow"><span>02</span> A NOTE TO YOURSELF</div><h2 className="notes-title">思辨札记</h2>
 {phase==='completed'&&<div className="tabs"><button className={tab==='summary'?'active':''} onClick={()=>setTab('summary')}>思辨总结</button><button className={tab==='history'?'active':''} onClick={()=>setTab('history')}>讨论记录</button></div>}
 <div className="notes-scroll">{!result?<div className="empty-note"><div className="note-mark">“</div><h3>答案之外，<br/>还有值得留下的思考。</h3><div className="fine-rule"/><p className="note-preface">对话开始后，这里将记下<br/>彼此的共识、分歧<br/>与新的可能。</p><small className="note-colophon"><span>留一页空白，</span><span>给尚未发生的启发。</span></small></div>:phase==='completed'&&tab==='summary'?<Summary result={result}/>:<div className="history">{([1,2] as const).map(round=><div key={round}><h3>{round===1?'PART I · 独立陈述':'PART II · 观点交锋'}</h3>{result.messages.map((m,i)=>m.round===round&&(i<completedCount||(phase==='playing'&&i===index))?<div className="history-item" key={m.id}><button aria-expanded={expanded===m.id} onClick={()=>setExpanded(expanded===m.id?null:m.id)} disabled={i>=completedCount}><span className="history-number">{String(i+1).padStart(2,'0')}</span><strong>{role(m.roleId)?.name}</strong><small>{i<completedCount?'已完成':'正在发言'}</small><span>{expanded===m.id?'−':'⌄'}</span></button>{expanded===m.id&&<div className="history-content">{m.replyTo&&<small>回应 {role(result.messages.find(x=>x.id===m.replyTo)?.roleId??'')?.name}</small>}<p>{m.content}</p></div>}</div>:null)}</div>)}</div>}</div>
 {phase==='completed'&&<div className="export-actions"><button className="primary" disabled={exporting} onClick={saveImage}><span className="cta-copy"><span className="cta-label">{exporting?'正在生成图片…':'保存为图片'}</span></span><span className="cta-arrow" aria-hidden="true"><span>↓</span></span></button><button className="text-button" onClick={copy}>复制完整讨论</button></div>}<p className="notice" role="status">{notice}</p>{phase!=='completed'&&<footer className="book-footer">— 静候一场有意义的对谈 —</footer>}</section>
 <footer className="disclaimer">{dataNotice} 仅供思考参考。</footer></div></div></div>
 <dialog ref={aboutRef} className="about-dialog" aria-labelledby="about-title" onClick={e=>{if(e.target===e.currentTarget){const rect=e.currentTarget.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)e.currentTarget.close();}}}>
 <div className="about-heading"><span className="eyebrow">ABOUT PERSPECTA</span><button type="button" className="about-close" aria-label="关闭关于我们" onClick={()=>aboutRef.current?.close()} autoFocus>×</button></div>
 <h2 id="about-title">关于我们</h2><p className="about-lead">让选择，在对话中清晰。</p><p>Perspecta 是一个多视角圆桌讨论空间。写下此刻的困惑，邀请不同视角的嘉宾，在观点的交汇中，看见选择的更多可能。</p><div className="about-process"><span>01 · 写下困惑</span><span>02 · 邀请嘉宾</span><span>03 · 留下思考</span></div><p>我们希望陪你梳理共识与分歧，留下一页属于自己的思辨札记。</p><button type="button" className="about-return" onClick={()=>aboutRef.current?.close()}>回到圆桌 <span aria-hidden="true">↗</span></button>
 </dialog>
 {result&&<div className="export-offscreen" aria-hidden="true"><div className="export-note" ref={exportRef}><div className="export-brand">✧ Perspecta <span>思辨札记</span></div><div className="eyebrow">NOTES FROM THE ROUNDTABLE</div><h1>{result.topic}</h1><p className="export-guests">{selected.map(id=>role(id)?.name).join(' / ')} · {displayedMode==='mock'?'模拟演示':displayedMode==='live'?'AI 模拟视角':'数据模式待确认'}</p><Summary result={result}/><footer>{dataNotice}<br/>仅供思考参考 · {localDate()}</footer></div></div>}
 {pngUrl&&<div className="modal-backdrop"><section className="image-preview" role="dialog" aria-modal="true" aria-label="思辨札记图片预览"><div><a href={pngUrl} download={`Perspecta_思辨札记_${localDate()}.png`}>下载 PNG 图片</a><button onClick={()=>setPngUrl('')}>关闭预览 ×</button></div><img src={pngUrl} alt="当前讨论的思辨札记导出图片"/></section></div>}
 {resetOpen&&<div className="modal-backdrop reset-backdrop"><section className="modal reset-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description"><div className="eyebrow">A NEW CONVERSATION</div><h2 id="reset-title">开启新的思考？</h2><p id="reset-description">重新发起会清除当前讨论结果，保留你的议题与嘉宾选择。可先保存图片或复制文本。</p><button className="primary" onClick={reset}><span className="cta-copy"><span className="cta-label">确认重新发起</span></span><span className="cta-arrow" aria-hidden="true"><span>↗</span></span></button><button className="text-button" autoFocus onClick={()=>setResetOpen(false)}>保留当前讨论</button></section></div>}
 </main>;
}
function SceneBackdrop({count,artwork:a}:{count:SceneCount;artwork:SceneArtwork|undefined}){
 const height=a?a.width*a.sourceHeight/a.sourceWidth:1;
 const fx=a?a.feather/a.width*100:0,fy=a?a.feather/height*100:0;
 const [ready,setReady]=useState<Partial<Record<SceneCount,boolean>>>({});
 const [displayed,setDisplayed]=useState<SceneCount>(4);
 useEffect(()=>{if(ready[count])setDisplayed(count);},[count,ready]);
 return <div className="scene-backdrops" aria-hidden="true">{([2,3,4] as const).map(n=><img key={n} src={sceneAssets[n]} alt="" decoding="async" className={displayed===n?'active':''} onLoad={e=>{const img=e.currentTarget;void img.decode().then(()=>setReady(previous=>({...previous,[n]:true}))).catch(()=>{/* Keep the previous scene if decoding fails. */});}}/>)}{a&&displayed===a.roleIds.length&&<img className="conversation-artwork" src={a.src} alt="" style={{left:`${a.left/a.backgroundWidth*100}%`,top:`${a.top/a.backgroundHeight*100}%`,width:`${a.width/a.backgroundWidth*100}%`,opacity:a.opacity,maskImage:`linear-gradient(to right,transparent,#000 ${fx}%,#000 ${100-fx}%,transparent),linear-gradient(to bottom,transparent,#000 ${fy}%,#000 ${100-fy}%,transparent)`}}/>}</div>;
}
function Summary({result}:{result:Debate}){return <div className="summary">{sections.map(([key,title],i)=><section key={key}><span className="summary-number">0{i+1}</span><div><h3>{title}</h3>{result.summary[key].map((line,j)=><p key={j}>{line}</p>)}</div></section>)}</div>;}
function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
