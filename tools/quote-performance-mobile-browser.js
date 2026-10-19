#!/usr/bin/env node
'use strict';
// Real Chromium, synthetic profile and original business markup/script order.
// No login fixture, credentials, Firebase SDK connection or production origin.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http');
const path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const ROOT=process.env.MEBLE_ROOT || path.resolve(__dirname,'..');
const size=Number(process.env.SIZE||9), multi=process.env.MULTI==='1';
const lifecycle=false;
function bytes(file){return fs.readFileSync(path.join(ROOT,file));}
function fixtureHtml(){
 const rows=require('./quote-performance-fixture').rows(size,multi);
 const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
 const fragment=id=>{const match=index.match(new RegExp('<template id="'+id+'">([\\s\\S]*?)</template>'));assert.ok(match,id);return match[1];};
 return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+fragment('business-styles')+'</head><body><script>if(!localStorage.getItem("fc_projects_v1")){for(const[k,v]of Object.entries('+JSON.stringify(rows)+'))localStorage.setItem(k,v);}</script>'+fragment('business-template')+'</body></html>';
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 const html=fixtureHtml(),external=[],errors=[],profile=fs.mkdtempSync(path.join(os.tmpdir(),'meble-context-test-'));
 const server=http.createServer((req,res)=>{
  res.setHeader('Content-Security-Policy',"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; worker-src 'self' blob:");
  const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  if(name==='/__synthetic_business'){res.setHeader('Content-Type','text/html');return res.end(html);}
  const file=path.resolve(ROOT,'.'+name);if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end();}
  try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(bytes(path.relative(ROOT,file)));}
  catch{res.writeHead(404);res.end();}
 });
 let browser,ws;const pending=new Map();let nextId=0,passed=0,loads=0;
 const pass=name=>{passed++;console.log('PASS '+name);};
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  browser=spawn(process.env.CHROMIUM_PATH || '/usr/bin/chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{detached:true,stdio:['ignore','ignore','pipe']});
  const endpoint=await new Promise((resolve,reject)=>{
   let output='';const timer=setTimeout(()=>reject(Error('Chromium startup timeout')),15000);
   browser.once('error',reject);browser.stderr.on('data',data=>{output+=data;const m=output.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});
  });
  const targets=await(await fetch('http://127.0.0.1:'+new URL(endpoint).port+'/json/list')).json();
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  const send=(method,params={})=>new Promise((resolve,reject)=>{
   const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},150000);
   pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
  });
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
   else if(m.method==='Page.loadEventFired')loads++;
   else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
   else if(m.method==='Fetch.requestPaused'){
    const local=new URL(m.params.request.url).origin==='http://127.0.0.1:'+server.address().port;
    if(!local)external.push(m.params.request.url);
    void send(local?'Fetch.continueRequest':'Fetch.failRequest',{requestId:m.params.requestId,...(local?{}:{errorReason:'BlockedByClient'})}).catch(()=>{});
   }
  };
  const evaluate=async expression=>{
   const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
   if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;
  };
  const until=async(expression,label,timeout=30000)=>{const start=Date.now();while(Date.now()-start<timeout){if(await evaluate(expression))return;await delay(50);}throw Error('Timeout: '+label+' '+JSON.stringify(await evaluate('({ready:document.readyState,hasTab:!!window.FC?.wycenaTabDebug,session:window.FC?.session?.active,ui:window.uiState,body:document.body.innerText.slice(-1800),banner:document.getElementById("app-error-msg")?.textContent})'))+' '+JSON.stringify(errors));};
  const touch=async selector=>{
   // Existing quote scroll restoration schedules callbacks through 420 ms.
   await delay(700);
   await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing touch target');el.scrollIntoView({block:'center',behavior:'instant'});})()`);
   await delay(150);
   const point=await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),b=el.getBoundingClientRect();const x=Math.max(1,Math.min(innerWidth-1,b.x+b.width/2)),y=Math.max(1,Math.min(innerHeight-1,b.y+b.height/2));const hit=document.elementFromPoint(x,y);if(!(b.width>0&&b.height>0&&hit&&el.contains(hit)))throw Error('Touch target covered or hidden: '+JSON.stringify({selector:${JSON.stringify(selector)},x,y,hit:hit?.outerHTML.slice(0,300)}));return{x,y};})()`);
   await evaluate('window.__perf&&window.__perf.clicked===null&&(window.__perf.clicked=performance.now())');
   await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,radiusX:4,radiusY:4,force:1,id:1}]});
   await delay(70);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(400);
  };
  const tab=async(name,ready)=>{
   await touch(`[data-tab="${name}"]`);
   await until(`uiState.activeTab===${JSON.stringify(name)}&&(${ready})`,'tab '+name);
  };
  await send('Runtime.enable');await send('Page.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  await send('Emulation.setDeviceMetricsOverride',{width:393,height:851,deviceScaleFactor:2.75,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true});
  const url='http://127.0.0.1:'+server.address().port+'/__synthetic_business';
  await send('Page.navigate',{url});await until('!!window.FC?.wycenaTabDebug&&!!window.FC?.session?.active','business startup');
  if(lifecycle){assert.equal(await evaluate('!!window.FC.projectStore.getById("A").meta.pendingDomainOperation'),false);pass('old sparse offerStatus intention recovered by actual startup before quote generation');}
  await evaluate('window.FC.actions.dispatch("session-save",{});window.FC.infoBox.close();');
  await tab('wycena','!!document.querySelector("[data-action=wycena-generate]")');
  await evaluate('window.FC.quoteOfferStore.patchCurrentDraft({selection:{selectedRooms:["room_test_A"],materialScope:{kind:"all",includeFronts:true,includeCorpus:true}},commercial:{versionName:"Audit single room"}});window.FC.rozrys.__projectOverride=window.FC.projectStore.getById("B").projectData;renderCabinets();');

  await evaluate(`(()=>{
   window.__perf={calls:{},longTasks:[],gaps:[]}; const m=window.__perf;
   new PerformanceObserver(list=>m.longTasks.push(...list.getEntries().map(x=>x.duration))).observe({entryTypes:['longtask']});
   let last=performance.now();setInterval(()=>{const now=performance.now();if(now-last>100)m.gaps.push(now-last);last=now;},20);
   const wrap=(obj,key,label)=>{if(!obj||typeof obj[key]!=='function')return;const orig=obj[key];obj[key]=function(...args){const row=m.calls[label]||(m.calls[label]={count:0,ms:0,max:0});row.count++;const t=performance.now(),end=()=>{const d=performance.now()-t;row.ms+=d;row.max=Math.max(row.max,d);if(label==='save')m.savedAt=performance.now();if(label==='plan')(m.plans||(m.plans=[])).push({material:args[0]?.material,ms:d});};try{const out=orig.apply(this,args);if(out&&typeof out.then==='function')return out.finally(end);end();return out;}catch(e){end();throw e;}};};
   const FC=window.FC;
   for(const [o,k,l]of [[FC.wycenaCore,'collectQuoteData','collect'],[FC.cabinetDerivedFacts,'ensureForRooms','facts'],[FC.cabinetCutlist,'getCabinetCutList','cutlist'],[FC.projectPcvOverrides,'getForCalculation','pcvAddress'],[FC.projectPcvResolver,'validateAggregate','pcvAggregate'],[FC.projectPcvResolver,'validateQuoteCandidate','pcvQuote'],[FC.rozrysEngine,'computePlanWithCurrentEngine','plan'],[FC.rozrysEngine,'computePlan','optimizer'],[FC.cutOptimizer,'packShelf','packing'],[FC.cutOptimizer,'makeItems','items'],[FC.quoteSnapshot,'buildSnapshot','snapshot'],[FC.quoteSnapshotStore,'save','save'],[FC.wycenaCoreMaterialPlan,'collectMaterialLines','materials'],[FC.wycenaCoreLabor,'collectCabinetLabor','labor'],[FC.wycenaCoreLabor,'collectProjectPreparationLines','projectLabor'],[FC.wycenaCoreLabor,'collectCarryingLines','carrying'],[FC.tabsRouter,'render','render']])wrap(o,k,l);
   const shellRender=FC.wycenaTabShell.render;FC.wycenaTabShell.render=function(...args){if(args[1])wrap(args[1],'render','render');return shellRender.apply(this,args);};
   window.__resetPerf=()=>{m.calls={};m.longTasks=[];m.gaps=[];m.savedAt=null;m.clicked=null;m.plans=[];m.start=performance.now();};
  })()`);
  const results=[];
  for(let attempt=0;attempt<2;attempt++){
   // Genuine new quote on warm run: a changed discount forces a distinct commercial fingerprint.
   await evaluate(`window.FC.quoteOfferStore.patchCurrentDraft({selection:{selectedRooms:${JSON.stringify(multi?['room_test_A','room_test_B','room_test_C']:['room_test_A'])},materialScope:{kind:'all',includeFronts:true,includeCorpus:true}},commercial:{versionName:'Measured '+${attempt},discountPercent:${attempt}}});renderCabinets();`);
   await delay(1600);
   await evaluate('window.__resetPerf()');
   const old=await evaluate('window.FC.wycenaTabShell._generateRuntime.lastAcceptedAt');
   await touch('[data-action="wycena-generate"]');
   await until('window.FC.wycenaTabShell._generateRuntime.lastAcceptedAt!=='+old,'actual touch accepted',10000);
   await until('!window.FC.wycenaTabShell._generateRuntime.inFlight||!!document.querySelector(".quote-scope-entry-name__input")','calculation',240000);
   if(await evaluate('!!document.querySelector(".quote-scope-entry-name__input")')){
    await evaluate(`(()=>{const i=document.querySelector('.quote-scope-entry-name__input');i.value='Measured '+${attempt};i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await touch('.quote-scope-entry-name__footer .btn-success');
    await until('!window.FC.wycenaTabShell._generateRuntime.inFlight','named calculation',240000);
   }
   await delay(100);
   const diagnostic=await evaluate('window.FC.wycenaDiagnostics.buildReport({dryRun:false}).then(r=>r.performance)');
   const result=await evaluate(`(()=>{const m=window.__perf,rows=window.FC.quoteSnapshotStore.readAll();return {attempt:${attempt},operationMs:window.FC.wycenaTabShell._generateRuntime.lastReleasedAt-window.FC.wycenaTabShell._generateRuntime.lastAcceptedAt,elapsed:performance.now()-m.clicked,savedMs:m.savedAt===null?null:m.savedAt-m.clicked,plans:m.plans,calls:m.calls,longTasks:m.longTasks,gaps:m.gaps,snapshots:rows,status:window.FC.wycenaTabDebug.getTabShellState().lastQuote?.error||null};})()`);
   assert.equal(result.status,null,JSON.stringify(result));assert.equal(result.snapshots.length,attempt+1);
   assert.ok(result.calls.render && result.calls.render.count>0,'Actual generate flow must render its result');
   if(process.env.EXPECT_SINGLE==='1')assert.equal(result.calls.collect.count,1,'One real calculation per unchanged request');
   result.diagnostic=diagnostic;results.push(result);console.log(JSON.stringify({attempt,size,multi,elapsed:result.elapsed,calls:result.calls,longest:Math.max(0,...result.longTasks)}));
  }

  if(process.argv.includes('--regressions')){
   const raw=()=>evaluate('localStorage.getItem("fc_quote_snapshots_v1")');
   const begin=async()=>{await delay(1600);await evaluate('window.__resetPerf()');await touch('[data-action="wycena-generate"]');};
   const finish=async()=>until('!window.FC.wycenaTabShell._generateRuntime.inFlight','real modal completion',30000);
   const naming=async(name)=>{
    await until('!!document.querySelector(".quote-scope-entry-name__input")','real naming dialog');
    await evaluate(`(()=>{const i=document.querySelector('.quote-scope-entry-name__input');i.value=${JSON.stringify(name)};i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await touch('.quote-scope-entry-name__footer .btn-success');await finish();
   };
   const patch=async commercial=>evaluate(`window.FC.quoteOfferStore.patchCurrentDraft({commercial:${JSON.stringify(commercial)}});renderCabinets();`);
   const frozen=await raw();
   await begin();await until('!!document.querySelector(".confirm-box")','duplicate dialog');await touch('.confirm-btn.is-danger');await finish();
   assert.equal(await raw(),frozen);assert.equal(await evaluate('window.__perf.calls.collect.count'),1);pass('real duplicate cancellation preserves exact history and runs one calculation');
   await begin();await until('!!document.querySelector(".confirm-box")','duplicate replacement');await touch('.confirm-btn.is-success');await finish();
   assert.equal(await evaluate('!!window.FC.wycenaTabDebug.getTabShellState().lastQuote?.error'),false);
   const replaced=await raw(),oldRows=JSON.parse(frozen),newRows=JSON.parse(replaced);
   assert.equal(newRows.length,2);assert.deepEqual(newRows.map(q=>q.id).sort(),oldRows.map(q=>q.id).sort());
   const math=q=>JSON.stringify({scope:q.scope,lines:q.lines,totals:q.totals,commercial:q.commercial});
   for(const q of newRows)assert.equal(math(q),math(oldRows.find(x=>x.id===q.id)));
   assert.equal(await evaluate('window.__perf.calls.collect.count'),1);pass('real duplicate replacement retains ids, math, metadata and valid result');
   await patch({discountPercent:2});await begin();await until('!!document.querySelector(".quote-scope-entry-name__input")','cancel name');
   await touch('.quote-scope-entry-name__footer .btn-danger');await finish();assert.equal(await raw(),replaced);pass('first physical cancellation of naming saves nothing');
   await patch({discountPercent:3});await begin();await naming('Real renamed variant');
   assert.equal(await evaluate('window.__perf.calls.collect.count'),1);const named=await raw();assert.equal(JSON.parse(named).length,3);
   for(const old of newRows)assert.deepEqual(JSON.parse(named).find(q=>q.id===old.id),old);
   assert.ok(JSON.parse(named).some(q=>q.commercial.versionName==='Real renamed variant'));pass('first physical naming confirmation creates an independent, correctly named variant');
   await patch({discountPercent:4});await begin();await until('!!document.querySelector(".quote-scope-entry-name__input")','price change across naming await');
   await evaluate('materials[0].price+=20;localStorage.setItem("fc_materials_v1",JSON.stringify(materials));');
   await naming('Recalculated catalog variant');assert.equal(await evaluate('window.__perf.calls.collect.count'),2);
   const repriced=await raw();assert.equal(JSON.parse(repriced).length,4);for(const old of JSON.parse(named))assert.deepEqual(JSON.parse(repriced).find(q=>q.id===old.id),old);
   pass('actual catalog change in naming reruns math and never changes archived quotes');
   await begin();await until('!!document.querySelector(".confirm-box")','price change across duplicate await');
   await evaluate('materials[0].price+=1;localStorage.setItem("fc_materials_v1",JSON.stringify(materials));');await touch('.confirm-btn.is-success');await finish();
   assert.equal(await raw(),repriced);assert.ok(await evaluate('window.FC.wycenaTabDebug.getTabShellState().lastQuote?.error'));
   pass('changed catalog while duplicate dialog is open rejects stale replacement');
   await send('Page.reload');await until('!!window.FC?.wycenaTabDebug','restart after new variants');assert.equal(await raw(),repriced);
   pass('actual restart preserves all four immutable historical variants');
  }
  fs.writeFileSync(process.env.PERF_OUTPUT||path.join(os.tmpdir(),'meble-quote-performance-result.json'),JSON.stringify({size,multi,results,external,errors},null,2));
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 }finally{
  if(ws?.readyState===1)ws.send(JSON.stringify({id:++nextId,method:'Browser.close'}));
  if(browser)await new Promise(resolve=>{if(browser.exitCode!==null)return resolve();browser.once('exit',resolve);setTimeout(resolve,1500);});
  ws?.close();if(browser?.exitCode===null)try{process.kill(-browser.pid,'SIGKILL');}catch(_){}server.close();for(const p of pending.values())clearTimeout(p.timer);
  // Remove only this runner's disposable browser profile, never app/user storage.
  if(browser)await new Promise(resolve=>{if(browser.exitCode!==null)return resolve();browser.once('exit',resolve);setTimeout(resolve,1500);});
  fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 }
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
