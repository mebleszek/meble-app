#!/usr/bin/env node
'use strict';
// Real Chromium, synthetic profile and original business markup/script order.
// No login fixture, credentials, Firebase SDK connection or production origin.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http');
const path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
function bytes(file){return fs.readFileSync(path.join(ROOT,file));}
function fixtureHtml(){
 const r=require(ROOT+'/tools/project-pcv-ui-activation-smoke').fixture(),rows=r.rows();
 const records=JSON.parse(rows.fc_projects_v1);
 for(const record of records){
  record.__test=true;record.__testRunId='project-context-browser';
  const data=record.projectData;data.room_test_A=data.room;delete data.room;
  if(data.other){data.room_test_B=data.other;delete data.other;}
  const ids=Object.keys(data).filter(k=>k.startsWith('room_test_'));
  data.meta.productionPcvMode='project';data.meta.roomOrder=ids;
  data.meta.roomDefs=Object.fromEntries(ids.map(id=>[id,{id,baseType:'kuchnia',name:id,label:id}]));
 }
 const active=records.find(r=>r.id==='A'),stale=records.find(r=>r.id==='B');
 const clone=x=>JSON.parse(JSON.stringify(x));
 const room=active.projectData.room_test_A,template=clone(room.cabinets[0]);
 room.cabinets=Array.from({length:8},(_,i)=>({...clone(template),id:'synth_cab_'+i}));room.fronts=[];
 for(const [key,count] of [['room_test_B',1],['room_test_C',1]]){active.projectData[key]=clone(room);active.projectData[key].cabinets=Array.from({length:count},(_,i)=>({...clone(template),id:key+'_cab_'+i}));active.projectData[key].fronts=[];}
 active.projectData.meta.roomOrder=['room_test_A','room_test_B','room_test_C'];
 active.projectData.meta.roomDefs=Object.fromEntries(active.projectData.meta.roomOrder.map(id=>[id,{id,baseType:'kuchnia',name:id,label:id}]));
 const staleRoom=clone(room);staleRoom.cabinets=Array.from({length:10},(_,i)=>({...clone(template),id:'stale_cab_'+i}));
 stale.projectData.room_stale=staleRoom;delete stale.projectData.room_test_A;
 stale.projectData.meta.roomOrder=['room_stale'];stale.projectData.meta.roomDefs={room_stale:{id:'room_stale',baseType:'kuchnia',name:'Stale',label:'Stale'}};
 rows.fc_project_v1=JSON.stringify(stale.projectData);
 rows.fc_projects_v1=JSON.stringify(records);
 rows.fc_investors_v1=JSON.stringify(records.map(record=>({id:record.investorId,name:'Syntetyczny '+record.id,__test:true,__testRunId:'project-context-browser',rooms:record.projectData.meta.roomOrder.map(id=>({id,baseType:'kuchnia',name:id,label:id}))})));
 rows.fc_materials_v1=JSON.stringify(r.s.materials.map(m=>({...m,priceUnit:m.materialType==='laminat'?'sheet':m.priceUnit})));
 rows.fc_ui_v1=JSON.stringify({...r.s.uiState,roomType:'room_test_A',entry:'app',activeTab:'wywiad'});
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
  browser=spawn(process.env.CHROMIUM_PATH || '/usr/bin/chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
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
   await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,radiusX:4,radiusY:4,force:1,id:1}]});
   await delay(70);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(400);
  };
  const tab=async(name,ready)=>{
   await evaluate(`document.querySelector('[data-tab="${name}"]').click()`);
   await until(`uiState.activeTab===${JSON.stringify(name)}&&(${ready})`,'tab '+name);
  };
  await send('Runtime.enable');await send('Page.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  await send('Emulation.setDeviceMetricsOverride',{width:393,height:851,deviceScaleFactor:2.75,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true});
  const url='http://127.0.0.1:'+server.address().port+'/__synthetic_business';
  await send('Page.navigate',{url});await until('!!window.FC?.wycenaTabDebug&&!!window.FC?.session?.active','business startup');
  await evaluate('window.FC.actions.dispatch("session-save",{});window.FC.infoBox.close();');
  await tab('wycena','!!document.querySelector("[data-action=wycena-generate]")');
  await evaluate('window.FC.quoteOfferStore.patchCurrentDraft({selection:{selectedRooms:["room_test_A"],materialScope:{kind:"all",includeFronts:true,includeCorpus:true}},commercial:{versionName:"Audit single room"}});window.FC.rozrys.__projectOverride=window.FC.projectStore.getById("B").projectData;renderCabinets();');
  const protectedRaw=()=>evaluate('Object.fromEntries(Object.keys(localStorage).filter(k=>k!=="fc_ui_v1"&&k!=="fc_reload_restore_v1").map(k=>[k,localStorage.getItem(k)]))');
  const beforeRender=await protectedRaw();
  await evaluate('renderCabinets();renderCabinets();window.FC.wycenaDiagnostics.buildReport({dryRun:false})');
  assert.deepEqual(await protectedRaw(),beforeRender);pass('quote render and diagnostic read never write project, drafts, history or global RAW');
  assert.equal(await evaluate('window.FC.rozrys.safeGetProject()===projectData'),true);
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("fc_project_v1")).meta.assignedInvestorId'), 'inv-B');
  assert.equal(await evaluate('window.FC.projectPcvOverrides.getForCalculation({projectId:"A",roomId:"room_test_A",cabinetId:"synth_cab_0",partRoleId:"front.door.right"}).ok'),true);
  pass('foreign legacy slot and override cannot replace active 8+1+1 project or native right front');
  assert.equal(await evaluate('document.querySelector(".quote-selection-launch--rooms").textContent.includes("Wszystkie pomieszczenia")'),false);
  assert.deepEqual(await evaluate('window.FC.wycenaTabDebug.normalizeDraftSelection(window.FC.quoteOfferStore.getCurrentDraft()).selectedRooms'),['room_test_A']);
  assert.deepEqual(await evaluate('window.FC.wycenaCoreSelection.normalizeQuoteSelection(window.FC.quoteOfferStore.getCurrentDraft().selection).selectedRooms'),['room_test_A']);
  pass('real room label, offer draft and calculator agree on the one selected room despite foreign override');
  const frozenGlobals=await evaluate('Object.fromEntries(Object.keys(localStorage).filter(k=>/catalog|materials|accessories|rates|suppliers|manufacturers|categories|types|settings|company|business|sheets|program_defaults|fc_edge|grain/.test(k)).map(k=>[k,localStorage.getItem(k)]))');
  const run=async()=>{
   await delay(1600);const previousAccepted=await evaluate('window.FC.wycenaTabShell._generateRuntime.lastAcceptedAt');await touch('[data-action="wycena-generate"]');
   await until('window.FC.wycenaTabShell._generateRuntime.lastAcceptedAt!=='+previousAccepted,'touch accepted by real action registry',10000);
   await until('!window.FC.wycenaTabShell._generateRuntime.inFlight||!!document.querySelector(".quote-scope-entry-name__input")','calculation',120000);
   if(await evaluate('!!document.querySelector(".quote-scope-entry-name__input")')){
    await evaluate('(()=>{const i=document.querySelector(".quote-scope-entry-name__input");i.value="Audit all rooms";i.dispatchEvent(new Event("input",{bubbles:true}));Array.from(document.querySelectorAll(".quote-scope-entry-name__footer button")).find(b=>b.textContent==="OK").click();})()');
    await until('!window.FC.wycenaTabShell._generateRuntime.inFlight','named calculation',120000);
   }
   return evaluate('window.FC.wycenaDiagnostics.buildReport({dryRun:false}).then(r=>{if(!r.lastGenerateTrace)throw Error(JSON.stringify({policy:window.FC.projectPcvPolicy.read(),session:window.FC.session.active,ui:uiState,button:r.lastGenerateButtonEvent}));return r.lastGenerateTrace;})');
  };
  const firstTrace=await run();assert.equal(firstTrace.result.ok,true,JSON.stringify(firstTrace));
  const first=await evaluate('JSON.parse(localStorage.getItem("fc_quote_snapshots_v1"))');assert.equal(first.length,1);assert.deepEqual(first[0].scope.selectedRooms,['room_test_A']);assert.ok(first[0].lines.elements.length);
  assert.equal(await evaluate('document.querySelectorAll("[data-quote-history-id]").length'),1);pass('touch -> action registry -> real optimizer and calculator -> durable single-room snapshot and render');
  await evaluate('window.FC.quoteSnapshotStore.markSelectedForProject("A",JSON.parse(localStorage.getItem("fc_quote_snapshots_v1"))[0].id,{roomIds:["room_test_A"]})');
  const accepted=await evaluate('JSON.parse(localStorage.getItem("fc_quote_snapshots_v1"))[0]');assert.equal(accepted.meta.selectedByClient,true);
  await evaluate('window.FC.quoteOfferStore.patchCurrentDraft({selection:{selectedRooms:["room_test_A","room_test_B","room_test_C"],materialScope:{kind:"all",includeFronts:true,includeCorpus:true}},commercial:{versionName:"Audit all rooms"}});renderCabinets();');
  assert.equal(await evaluate('document.querySelector(".quote-selection-launch--rooms").textContent.includes("Wszystkie pomieszczenia")'),true);
  const allTrace=await run();assert.equal(allTrace.result.ok,true,JSON.stringify(allTrace));
  const all=await evaluate('JSON.parse(localStorage.getItem("fc_quote_snapshots_v1"))');assert.equal(all.length,2);assert.deepEqual(all.find(q=>q.id===accepted.id),accepted);
  assert.deepEqual(all.find(q=>q.id!==accepted.id).scope.selectedRooms,['room_test_A','room_test_B','room_test_C']);pass('all-room UI, draft and new 10-cabinet quote agree; accepted 8-cabinet snapshot is unchanged');
  const historyRaw=await evaluate('localStorage.getItem("fc_quote_snapshots_v1")');
  for(const inv of ['inv-B','inv-A']){
   await evaluate(`(()=>{const el=document.createElement('button');el.setAttribute('data-inv-id',${JSON.stringify(inv)});window.FC.actions.dispatch('open-investor',{element:el});})()`);
   await until(`window.FC.investors.getCurrentId()===${JSON.stringify(inv)}`,'investor switch');
   assert.equal(await evaluate('window.FC.rozrys.safeGetProject()===projectData'),true);
   assert.equal(await evaluate('window.FC.session.active'),false,'Investor navigation must not start or silently finish an edit');
  }
  assert.equal(await evaluate('localStorage.getItem("fc_quote_snapshots_v1")'),historyRaw);pass('actual A -> B -> A actions retain RAM/source identity and frozen history');
  await tab('wycena','document.getElementById("roomsView").style.display==="block"');
  await touch('[data-action="open-room"][data-room="room_test_A"]');
  await until('uiState.entry==="app"&&window.FC.session.active','actual room opening');
  await tab('wycena','!!document.querySelector("[data-action=wycena-generate]")&&uiState.entry==="app"&&!window.FC.session.active');
  pass('real room tile and guarded tab navigation reopen the visible quote application after investor selection');
  await tab('wycena','!!document.querySelector("[data-action=wycena-generate]")');
  const readOnly=await protectedRaw();await evaluate('renderCabinets();window.FC.wycenaDiagnostics.buildReport({dryRun:false})');assert.deepEqual(await protectedRaw(),readOnly);
  const loadBefore=loads;await send('Page.reload',{});const reloadStart=Date.now();while(loads<=loadBefore){if(Date.now()-reloadStart>30000)throw Error('Reload timeout');await delay(25);}
  await until('!!window.FC?.wycenaTabDebug&&typeof projectData!=="undefined"','restart');
  assert.equal(await evaluate('window.FC.rozrys.safeGetProject()===projectData'),true,JSON.stringify(await evaluate('({owner:projectData?.meta?.assignedInvestorId,current:window.FC.investors.getCurrentId(),project:window.FC.projectStore.getCurrentProjectId(),policy:window.FC.projectPcvPolicy.read(),session:window.FC.session.active,ui:uiState})')));assert.equal(await evaluate('projectData.room_test_A.cabinets.length+projectData.room_test_B.cabinets.length+projectData.room_test_C.cabinets.length'),10);
  assert.equal(await evaluate('localStorage.getItem("fc_quote_snapshots_v1")'),historyRaw);pass('restart restores exact 8+1+1 cabinets and accepted history without legacy activation');
  await tab('wycena','!!document.querySelector("[data-action=wycena-generate]")');await evaluate('window.FC.rozrysLazy.ensureFeatureLoaded()');
  // Pause the real optimizer at its Promise boundary and run an existing navigation action.
  await evaluate(`(()=>{const engine=window.FC.rozrysEngine,f=engine.computePlanWithCurrentEngine;let once=false;engine.computePlanWithCurrentEngine=async function(...args){const plan=await f.apply(this,args);if(!once){once=true;window.FC.actions.dispatch('create-investor',{});}return plan;};})()`);
  const failed=await run();assert.equal(failed.result.ok,false);assert.equal(failed.steps.find(s=>s.step==='error').value.code,'calculation_context_changed');
  assert.equal(await evaluate('localStorage.getItem("fc_quote_snapshots_v1")'),historyRaw);
  assert.equal(await evaluate('!!window.FC.wycenaTabDebug.getTabShellState().lastQuote?.error'),true);pass('real navigation during actual optimizer await discards result, retains error and saves no mixed-context quote');
  const afterGlobals=await evaluate('Object.fromEntries(Object.keys(localStorage).filter(k=>/catalog|materials|accessories|rates|suppliers|manufacturers|categories|types|settings|company|business|sheets|program_defaults|fc_edge|grain/.test(k)).map(k=>[k,localStorage.getItem(k)]))');
  assert.deepEqual(afterGlobals,frozenGlobals);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);pass('global catalog/price/stock RAW unchanged; zero external requests and uncaught errors');
  console.log(`Context mobile Chromium: ${passed}/${passed} PASS, 0 FAIL, 0 SKIP`);

 }finally{
  ws?.close();browser?.kill();server.close();for(const p of pending.values())clearTimeout(p.timer);
  // Remove only this runner's disposable browser profile, never app/user storage.
  if(browser)await new Promise(resolve=>{if(browser.exitCode!==null)return resolve();browser.once('exit',resolve);setTimeout(resolve,1500);});
  fs.rmSync(profile,{recursive:true,force:true});
 }
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
