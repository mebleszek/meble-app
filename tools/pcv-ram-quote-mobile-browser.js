#!/usr/bin/env node
'use strict';
// Real Chromium, synthetic profile and original business markup/script order.
// No login fixture, credentials, Firebase SDK connection or production origin.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http');
const path=require('node:path'),os=require('node:os'),{spawn,execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),BASE='4d8dd96df9f293276dee07dc0c4cedf26edac08c';
const baseline=process.argv.includes('--baseline');
function bytes(file){return (baseline && ['js/app.js','js/app/investor/project-autosave.js','js/app/wycena/wycena-tab-shell.js','js/app/wycena/wycena-tab-history.js'].includes(file)
 || process.argv.includes('--baseline-autosave') && file==='js/app/investor/project-autosave.js')
 ? execFileSync('git',['show',BASE+':'+file],{cwd:ROOT}):fs.readFileSync(path.join(ROOT,file));}
function fixtureHtml(){
 const r=require('./project-pcv-ui-activation-smoke').fixture(),rows=r.rows();
 const records=JSON.parse(rows.fc_projects_v1);
 for(const record of records){
  record.__test=true;record.__testRunId='pcv-ram-quote-browser';
  const data=record.projectData;data.room_test_A=data.room;delete data.room;
  if(data.other){data.room_test_B=data.other;delete data.other;}
  const ids=Object.keys(data).filter(k=>k.startsWith('room_test_'));
  data.meta.productionPcvMode='project';data.meta.roomOrder=ids;
  data.meta.roomDefs=Object.fromEntries(ids.map(id=>[id,{id,baseType:'kuchnia',name:id,label:id}]));
 }
 rows.fc_projects_v1=JSON.stringify(records);
 rows.fc_investors_v1=JSON.stringify(records.map(record=>({id:record.investorId,name:'Syntetyczny '+record.id,__test:true,__testRunId:'pcv-ram-quote-browser',rooms:record.projectData.meta.roomOrder.map(id=>({id,baseType:'kuchnia',name:id,label:id}))})));
 rows.fc_materials_v1=JSON.stringify(r.s.materials.map(m=>({...m,priceUnit:m.materialType==='laminat'?'sheet':m.priceUnit})));
 rows.fc_ui_v1=JSON.stringify({...r.s.uiState,roomType:'room_test_A',entry:'app',activeTab:'wywiad'});
 const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
 const fragment=id=>{const match=index.match(new RegExp('<template id="'+id+'">([\\s\\S]*?)</template>'));assert.ok(match,id);return match[1];};
 return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+fragment('business-styles')+'</head><body><script>if(!localStorage.getItem("fc_projects_v1")){for(const[k,v]of Object.entries('+JSON.stringify(rows)+'))localStorage.setItem(k,v);}</script>'+fragment('business-template')+'</body></html>';
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 const html=fixtureHtml(),external=[],errors=[],profile=fs.mkdtempSync(path.join(os.tmpdir(),'meble-quote-test-'));
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
   const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},30000);
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
   await touch(`[data-tab="${name}"]`);
   await until(`uiState.activeTab===${JSON.stringify(name)}&&(${ready})`,'tab '+name);
  };
  await send('Runtime.enable');await send('Page.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  await send('Emulation.setDeviceMetricsOverride',{width:393,height:851,deviceScaleFactor:2.75,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true});
  const url='http://127.0.0.1:'+server.address().port+'/__synthetic_business';
  await send('Page.navigate',{url});await until('!!window.FC?.wycenaTabDebug&&!!window.FC?.session?.active','business startup');
  await until('window.__fcProjectAutosaveInstalled===true','full business startup with capture autosave');
  assert.equal(await evaluate('window.__fcProjectAutosaveInstalled'),true,'Real startup installs the capture autosave listener');
  const savedProjects=()=>evaluate('JSON.parse(localStorage.getItem("fc_projects_v1"))');
  const initial=await savedProjects(),b=initial.find(r=>r.id==='B'),other=initial.find(r=>r.id==='A').projectData.room_test_B;
  // Capture established catalogs after ordinary first-start seeding, then compare RAW.
  const globals=await evaluate('Object.fromEntries(Object.keys(localStorage).filter(k=>/catalog|materials|accessories|rates|suppliers|manufacturers|categories|types|settings|company|business|sheets|program_defaults|fc_edge|grain/.test(k)).map(k=>[k,localStorage.getItem(k)]))');
  await evaluate('openCabinetModalForEdit("one");document.getElementById("cmWidth").value="65";document.getElementById("cmWidth").dispatchEvent(new Event("input",{bubbles:true}));document.getElementById("cabinetModalSave").click();window.FC.actions.dispatch("session-save",{});window.FC.infoBox.close();');
  assert.equal(await evaluate('projectData.room_test_A.cabinets[0].width'),65);
  assert.equal(await evaluate('window.projectData===projectData'),true);
  assert.equal(await evaluate('window.FC.projectPcvPolicy.read().ok'),true);pass('actual cabinet form edit / Save keeps canonical project and both RAM names current');
  for(let i=0;i<2;i++)await evaluate('openCabinetModalForAdd();document.getElementById("cabinetModalSave").click();');
  await evaluate('window.FC.actions.dispatch("session-save",{});window.FC.infoBox.close();');
  assert.equal(await evaluate('projectData.room_test_A.cabinets.length'),4);
  assert.equal(await evaluate('new Set(projectData.room_test_A.cabinets.map(c=>c.id)).size'),4);
  assert.equal(await evaluate('window.FC.session.active'),false);pass('add and copy-last-cabinet defaults persist four independent IDs without restart');
  await tab('material','!!document.getElementById("projectEdgeTotals")');
  assert.equal(await evaluate('window.FC.materialTabData.collectRoomMaterials("room_test_A").cabinetRows.length'),4);
  assert.equal(await evaluate('window.FC.projectPcvPolicy.read().ok'),true);pass('real MATERIAL render and project PCV use four current cabinets');
  // Real capture listener schedules the unchanged 180 ms timer in MATERIAL.
  // Enter the calculation view before it fires; never cancel it in the fixture.
  await evaluate('window.FC.rozrysLazy.ensureFeatureLoaded()');
  await evaluate('document.querySelector(".material-recalculate-project-btn").click();window.FC.infoBox.close();');
  await tab('rozrys','!!document.querySelector(".rozrys-action-btn--generate")');
  await evaluate('(()=>{const original=window.FC.rozrysRunner.generate;window.FC.rozrysRunner.generate=(...args)=>{window.__testRozrysRun=original(...args);return window.__testRozrysRun;};})()');
  await evaluate('document.querySelector(".rozrys-action-btn--generate").click()');
  assert.notEqual(await evaluate('window.__testRozrysRun'),false,'Complete real runner, not the first material preview');
  assert.equal(await evaluate('document.body.innerText.includes("ROZRYS wymaga ponowienia")'),false);
  const placed=await evaluate('Array.from(document.querySelectorAll("#rozrysRoot canvas")).flatMap(c=>c.__rozrysDrawPayload?.sheet?.placements||[])');
  assert.ok(placed.length>0);const owners=new Set(placed.flatMap(p=>p.sourceRefs||[]).filter(s=>s.roomId==='room_test_A').map(s=>s.cabinetId));assert.equal(owners.size,4);pass('real optimizer and rendered ROZRYS placements contain every new cabinet');
  await tab('wycena','!!document.querySelector("[data-action=wycena-generate]")');
  await evaluate('window.FC.quoteOfferStore.patchCurrentDraft({selection:{selectedRooms:["room_test_A"],materialScope:{kind:"all",includeFronts:true,includeCorpus:true}}});renderCabinets();');
  const quote=async(name)=>{
   await touch('[data-action="wycena-generate"]');
   await until('!window.FC.wycenaTabShell._generateRuntime.inFlight||!!document.querySelector(".quote-scope-entry-name__input")','generation or version name');
   if(await evaluate('!!document.querySelector(".quote-scope-entry-name__input")')){
    await evaluate(`(()=>{const input=document.querySelector('.quote-scope-entry-name__input');input.value=${JSON.stringify(name)};input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await touch('.quote-scope-entry-name__footer .btn-success');
    await until('!window.FC.wycenaTabShell._generateRuntime.inFlight','named generation');
   }
   const trace=await evaluate('window.FC.wycenaDiagnostics.buildReport({dryRun:false}).then(r=>r.lastGenerateTrace)');
   assert.equal(trace?.result?.ok,true,JSON.stringify({trace,context:await evaluate('({session:window.FC.session.active,needsClosure:window.FC.sessionNavigation.needsClosure(),policy:window.FC.projectPcvPolicy.read().code,body:document.body.innerText.slice(-2500)})')}));
   return evaluate('JSON.parse(localStorage.getItem("fc_quote_snapshots_v1"))');
  };
  const first=await quote('Pierwsza');assert.equal(first.length,1);assert.deepEqual(first[0].scope.selectedRooms,['room_test_A']);
  assert.ok(first[0].lines.elements.length);assert.equal(await evaluate('document.querySelectorAll("[data-quote-history-id]").length'),1);
  pass('mobile touch -> action registry -> real quote calculation -> saved snapshot and render, one tap = one offer');
  await delay(1600);
  await tab('wywiad','document.getElementById("cabinetsList").textContent.includes("65 × 80 × 50")');
  await evaluate('openCabinetModalForEdit("one");document.getElementById("cmWidth").value="85";document.getElementById("cmWidth").dispatchEvent(new Event("input",{bubbles:true}));document.getElementById("cabinetModalSave").click();window.FC.actions.dispatch("session-save",{});window.FC.infoBox.close();');
  await tab('wycena','!!document.querySelector("[data-action=wycena-generate]")');
  const second=await quote('Po zmianie 85');assert.equal(second.length,2);assert.deepEqual(second.find(q=>q.id===first[0].id),first[0]);
  assert.notDeepEqual(second.find(q=>q.id!==first[0].id).lines.materials,first[0].lines.materials);pass('changed dimensions produce a new current offer while old snapshot stays identical');
  const previousLoads=loads;await send('Page.reload',{});
  const reloadStarted=Date.now();while(loads<=previousLoads){if(Date.now()-reloadStarted>30000)throw Error('Reload load event timeout');await delay(25);}
  await until('!!window.FC?.wycenaTabDebug&&typeof projectData!=="undefined"','restart');
  assert.equal(await evaluate('projectData.room_test_A.cabinets.length'),4);assert.equal(await evaluate('projectData.room_test_A.cabinets[0].width'),85);
  assert.equal(await evaluate('window.FC.projectPcvPolicy.read().ok'),true);pass('ordinary restart restores canonical cabinets, PCV and immutable history');
  const frozen=await evaluate('localStorage.getItem("fc_quote_snapshots_v1")');
  await tab('wycena','!!document.querySelector("[data-action=wycena-generate]")');
  // A malformed saved project is a real calculation refusal; no success/error stubs.
  await evaluate('(()=>{const draft=structuredClone(projectData);draft.room_test_A.cabinets[0].width=0;const saved=window.FC.project.saveConfirmed(draft);if(!saved.ok)throw Error("fixture write failed");projectData=saved.project;})()');
  await touch('[data-action="wycena-generate"]');await until('!window.FC.wycenaTabShell._generateRuntime.inFlight','real failed generation');
  assert.equal(await evaluate('!!window.FC.wycenaTabDebug.resolveDisplayedQuote()?.error'),true,JSON.stringify(await evaluate('window.FC.wycenaDiagnostics.buildReport({dryRun:false}).then(r=>({trace:r.lastGenerateTrace,shell:r.renderSources?.shellState,policy:window.FC.projectPcvPolicy.read(),closure:window.FC.sessionNavigation.needsClosure(),session:window.FC.session.active,body:document.body.innerText.slice(-1800)}))')));
  assert.equal(await evaluate('document.body.innerText.includes("Nie można utworzyć wyceny")'),true);
  assert.equal(await evaluate('localStorage.getItem("fc_quote_snapshots_v1")'),frozen);
  pass('real invalid geometry refusal stays visible despite existing history and releases the busy lock');
  await evaluate('window.FC.infoBox.close();(()=>{const draft=structuredClone(projectData);draft.room_test_A.cabinets[0].width=85;const saved=window.FC.project.saveConfirmed(draft);if(!saved.ok)throw Error("fixture restore failed");projectData=saved.project;})()');
  await delay(1600);await touch('[data-action="wycena-generate"]');
  await until('!!document.querySelector(".confirm-box")','actual duplicate offer decision');
  assert.equal(await evaluate('document.body.innerText.includes("TAKA SAMA OFERTA JUŻ ISTNIEJE")'),true);
  await touch('.confirm-btn.is-danger');
  await until('!window.FC.wycenaTabShell._generateRuntime.inFlight','duplicate cancel');
  assert.equal(await evaluate('localStorage.getItem("fc_quote_snapshots_v1")'),frozen);
  pass('retry after correcting the obstruction uses the real duplicate dialog without overwriting history');
  const records=await savedProjects();assert.deepEqual(records.find(r=>r.id==='B'),b);assert.deepEqual(records.find(r=>r.id==='A').projectData.room_test_B,other);
  const after=await evaluate('Object.fromEntries(Object.keys(localStorage).filter(k=>/catalog|materials|accessories|rates|suppliers|manufacturers|categories|types|settings|company|business|sheets|program_defaults|fc_edge|grain/.test(k)).map(k=>[k,localStorage.getItem(k)]))');
  assert.deepEqual(after,globals);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);pass('other project/room and global RAW unchanged; zero external requests or uncaught JS errors');
  console.log(`Chromium mobile: ${passed}/${passed} PASS, 0 FAIL, 0 SKIP`);
 }finally{
  ws?.close();browser?.kill();server.close();for(const p of pending.values())clearTimeout(p.timer);
  // Remove only this runner's disposable browser profile, never app/user storage.
  if(browser)await new Promise(resolve=>{if(browser.exitCode!==null)return resolve();browser.once('exit',resolve);setTimeout(resolve,1500);});
  fs.rmSync(profile,{recursive:true,force:true});
 }
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
