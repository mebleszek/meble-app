'use strict';
// Genuine business manifest, boot, runtime, authority, forms and native IndexedDB.
// Synthetic owner enrollment only; no Firebase SDK/backend or production data.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {androidGlobalsFixture}=require('./helpers/android-globals-browser-fixture');
const crypto=require('node:crypto').webcrypto;
const {documentNavigation,waitForGesturePoint}=require('./helpers/browser-test-readiness');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),root=path.resolve(__dirname,'..');
async function main(){
 const {openBrowserDevice}=await import('./helpers/local-first-browser.mjs');
 let networkAvailable=true;const server=await androidGlobalsFixture({deployment:()=>root,unavailable:()=>!networkAvailable}),dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-local-start-'));let browser,phase='setup';const external=[];
 try{
  browser=await openBrowserDevice({base:server.base+'/fixture-host.html'},path.join(dir,'profile'));
  let navigation=documentNavigation(browser.send);let dialog,offline=false,offlineError=null;
  const onEvent=event=>{navigation.event(event);if(event.method==='Debugger.paused')void(async()=>{try{if(offline)await browser.send('Network.overrideNetworkState',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});}catch(error){offlineError=error;}finally{await browser.send('Debugger.resume');}})();if(event.method==='Page.javascriptDialogOpening')dialog=event.params;
   if(event.method==='Network.requestWillBeSent'&&!event.params.request.url.startsWith(server.base)&&!event.params.request.url.startsWith('data:'))external.push('EXTERNAL_REQUEST');};browser.onEvent(onEvent);
  await browser.send('Network.enable');await browser.send('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true});
  async function until(expression,ms=25000){const end=Date.now()+ms;while(Date.now()<end){if(await browser.evaluate(expression))return;if(expression.includes('RESET_COMPLETE')&&await browser.evaluate('document.querySelector("[data-rescue-status]")?.dataset.rescueStatus==="BLOCKED"'))break;await pause(40);}throw Error('LOCAL_START_TIMEOUT '+expression+' '+JSON.stringify(await browser.evaluate('({auth:document.body?.dataset.authState,business:document.body?.dataset.businessState,error:document.getElementById("auth-error")?.textContent?.slice(0,220),info:document.querySelector(".info-box")?.textContent,confirm:document.querySelector(".confirm-box")?.textContent,writeCode:window.FC.applicationStartup?.inspect().writeCode,rescue:document.querySelector("[data-rescue-status]")?.textContent,diag:window.FC.applicationStartup?.diagnostics()?.firstError})')));}
  async function tap(selector){let p;try{p=await waitForGesturePoint(browser.evaluate,selector,{stable:true});}catch(error){throw Error(error.message+' '+JSON.stringify(await browser.evaluate('({auth:document.body?.dataset.authState,info:document.querySelector(".info-box")?.textContent,confirm:document.querySelector(".confirm-box")?.textContent,writeCode:window.FC.applicationStartup?.inspect().writeCode})')));}await browser.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});}
  async function confirmReset(accept){const clicking=tap('[data-local-first-rescue] button:last-child');const end=Date.now()+5000;while(!dialog&&Date.now()<end)await pause(20);assert.ok(dialog,'Conscious native confirmation required');await browser.send('Page.handleJavaScriptDialog',{accept});dialog=null;await clicking;}
  async function fill(selector,value){await browser.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
  async function script(file){await browser.evaluate(`new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=${JSON.stringify('/'+file)};s.onload=()=>resolve(true);s.onerror=reject;document.head.append(s);})`);}
  await browser.evaluate('navigator.serviceWorker.register("/offline-worker.js").then(()=>navigator.serviceWorker.ready).then(()=>true)');
  const data=server.data,{digest,json,canonical}=await import('../sync/local-first-values.mjs');
  const keys=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']),publicKeySpki=new Uint8Array(await crypto.subtle.exportKey('spki',keys.publicKey));
  const decision={activationId:'synthetic-activation',database:'(default)',domain:'MEBLE_APPLICATION_DEPLOYMENT_V1',globalDomains:14,migrationApproved:true,origin:server.base+'/',ownerUid:server.uid,profile:'business-project-v1',projectId:'demo-meble-app',protocol:2,rulesApproved:true,rulesSha256:'a'.repeat(64),sourcePreserved:true};
  const signature=new Uint8Array(await crypto.subtle.sign('Ed25519',keys.privateKey,new TextEncoder().encode(canonical(decision))));
  const release={name:server.name,localOnly:true,trustedKeySha256:Buffer.from(await crypto.subtle.digest('SHA-256',publicKeySpki)).toString('hex'),envelope:{decision,publicKeySpki:[...publicKeySpki],signature:[...signature]}};
  data.identity.receipt.activationId=decision.activationId;
  // The rescue fixture deliberately carries opaque non-project records; use
  // valid empty project stores so this test isolates the reported globals fault.
  const source=data.databases.authority.control.find(r=>r.key==='source'),image=data.databases.authority.control.find(r=>r.key==='application');
  for(const key of ['fc_projects_v1','fc_investors_v1','fc_quote_offer_drafts_v1']){source.rows[key]='[]';const row=data.local.rows.find(r=>r.key===key);if(row)row.raw='[]';else data.local.rows.push({key,raw:'[]'});}
  image.rows=structuredClone(source.rows);source.hash=await digest(source.rows);image.hash=await digest(json(image.rows));data.identity.receipt.sourceHash=source.hash;data.local.rows.find(r=>r.key==='meble_application_authority_v1').raw=JSON.stringify(data.identity.receipt);
  await browser.evaluate(`(async()=>{
   const data=${JSON.stringify(data)};for(const r of data.local.rows)localStorage.setItem(r.key,r.raw);
   localStorage.setItem('meble_access_profile_v1',JSON.stringify({version:3,uid:${JSON.stringify(server.uid)},attemptId:'12345678-1234-4123-8123-123456789abc'}));
   const create=(name,stores,write)=>new Promise((resolve,reject)=>{const q=indexedDB.open(name,1);q.onupgradeneeded=()=>{for(const [n,k]of stores)q.result.createObjectStore(n,k?{keyPath:k}:undefined);};q.onerror=reject;q.onsuccess=()=>{const db=q.result,tx=db.transaction(stores.map(s=>s[0]),'readwrite');write(tx);tx.oncomplete=()=>{db.close();resolve();};tx.onabort=reject;};});
   await create(${JSON.stringify(server.name)},['control','replicas','protected','outbox'].map(n=>[n,'key']),tx=>{for(const [name,rows]of Object.entries(data.databases.authority))for(const r of rows)tx.objectStore(name).put(r);});
   await new Promise((resolve,reject)=>{const q=indexedDB.open('meble-foreign-synthetic-v1',7);q.onupgradeneeded=()=>{const records=q.result.createObjectStore('unrelated',{keyPath:'id'});records.createIndex('byKind','kind',{unique:false});q.result.createObjectStore('opaque');};q.onerror=reject;q.onsuccess=()=>{const db=q.result,tx=db.transaction(['unrelated','opaque'],'readwrite');tx.objectStore('unrelated').put({id:'synthetic-foreign',kind:'unrelated',unknown:{price:12.125,raw:' untouched '}});tx.objectStore('opaque').put('FOREIGN_BYTES','foreign-key');tx.oncomplete=()=>{db.close();resolve();};tx.onabort=reject;};});
   await create('meble-access-profile-v1',[['ownership',null]],tx=>tx.objectStore('ownership').put({version:1,state:'active',uid:${JSON.stringify(server.uid)},attemptId:'12345678-1234-4123-8123-123456789abc'},'owner'));
   sessionStorage.setItem('fc_reload_restore_v1','SYNTHETIC_OLD_SESSION');return true;
  })()`);
  await script('js/app/cloud/local-device-access.js');await browser.evaluate(`FC.localDeviceAccess.createTrust().enroll({uid:${JSON.stringify(server.uid)},profileAttemptId:'12345678-1234-4123-8123-123456789abc',consent:true,check(){}}).then(()=>true)`);
  await browser.send('Debugger.enable');
  const preload=`debugger;window.__LOCAL_BOOT_ONLINE__=navigator.onLine;(()=>{
   const fc=window.FC=window.FC||{};let startup;Object.defineProperty(fc,'applicationStartup',{configurable:true,get:()=>startup,set:value=>{startup=value;const release=${JSON.stringify(release)};release.envelope.publicKeySpki=new Uint8Array(release.envelope.publicKeySpki);release.envelope.signature=new Uint8Array(release.envelope.signature);void value.configureReleaseEmulator(release);}});
   const open=IDBFactory.prototype.open;window.foreignOpens=[];IDBFactory.prototype.open=function(name,...args){if(name==='meble-foreign-synthetic-v1')window.foreignOpens.push(name);return open.call(this,name,...args);};
   window.foreignProof=async()=>{const db=await new Promise((resolve,reject)=>{const q=open.call(indexedDB,'meble-foreign-synthetic-v1',7);q.onupgradeneeded=()=>q.transaction.abort();q.onerror=reject;q.onsuccess=()=>resolve(q.result);});try{return await new Promise((resolve,reject)=>{const stores={},tx=db.transaction([...db.objectStoreNames],'readonly');for(const name of db.objectStoreNames){const store=tx.objectStore(name);const value=stores[name]={keyPath:store.keyPath,autoIncrement:store.autoIncrement,indexes:[...store.indexNames].map(n=>{const i=store.index(n);return {name:n,keyPath:i.keyPath,unique:i.unique,multiEntry:i.multiEntry};})};const rows=store.getAll(),keys=store.getAllKeys();rows.onsuccess=()=>value.rows=rows.result;keys.onsuccess=()=>value.keys=keys.result;}tx.oncomplete=()=>resolve({name:db.name,version:db.version,stores});tx.onabort=reject;});}finally{db.close();}};
   const get=Storage.prototype.getItem;window.localProof=async()=>{const raw=Object.keys(localStorage).sort().map(k=>[k,get.call(localStorage,k)]);const db=await new Promise((resolve,reject)=>{const q=indexedDB.open(${JSON.stringify(server.name)},1);q.onupgradeneeded=()=>q.transaction.abort();q.onerror=reject;q.onsuccess=()=>resolve(q.result);});try{return await new Promise(resolve=>{const tables={},tx=db.transaction(['control','replicas','protected','outbox'],'readonly');for(const n of ['control','replicas','protected','outbox']){const q=tx.objectStore(n).getAll();q.onsuccess=()=>tables[n]=q.result;}tx.oncomplete=()=>resolve({raw,tables});});}finally{db.close();}};
  })();`;await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:preload});
  await navigation.navigate(server.base+'/index.html');
  await until('document.body?.dataset.authState==="error"&&!document.getElementById("auth-recovery").hidden');
  phase='fatal/recovery';const before=await browser.evaluate('localProof()'),foreignBefore=await browser.evaluate('foreignProof()');
  async function assertForeign(){assert.deepEqual(await browser.evaluate('foreignProof()'),foreignBefore,'Unrelated database schema, records and keys must remain exact');assert.deepEqual(await browser.evaluate('foreignOpens'),[],'Application must not open unrelated databases');}
  await assertForeign();await tap('#auth-recovery');
  await until('!!document.querySelector("[data-local-first-rescue]")');
  phase='refuse reset';await confirmReset(false);
  await until('document.querySelector("[data-rescue-status]").dataset.rescueStatus==="RESET_CANCELLED"');assert.deepEqual(await browser.evaluate('localProof()'),before);await assertForeign();
  console.log('PASS genuine Android globals failure → rescue; refused reset preserves every native RAW and all four stores');
  phase='second client';const second=await browser.send('Target.createTarget',{url:server.base+'/fixture-host.html'});await pause(100);await browser.send('Page.bringToFront');await confirmReset(true);
  await until('document.querySelector("[data-rescue-status]").dataset.rescueStatus==="BLOCKED"&&!document.querySelector("[data-local-first-rescue] button:last-child").disabled');assert.deepEqual(await browser.evaluate('localProof()'),before);await assertForeign();assert.equal(await browser.evaluate('localStorage.getItem("meble_local_reset_v1")'),null);await browser.send('Target.closeTarget',{targetId:second.targetId});await pause(100);
  console.log('PASS second application client refuses reset before a journal or data mutation');
  phase='interrupt reset';await browser.evaluate(`(()=>{const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...rest){const tx=original.call(this,stores,mode,...rest);if(mode==='readwrite'&&Array.from(stores).includes('outbox')){IDBDatabase.prototype.transaction=original;window.resetAbortObserved=true;queueMicrotask(()=>tx.abort());}return tx;};return true;})()`);await confirmReset(true);
  await until('document.querySelector("[data-rescue-status]").dataset.rescueStatus==="BLOCKED"&&!document.querySelector("[data-local-first-rescue] button:last-child").disabled');
  assert.equal(await browser.evaluate('window.resetAbortObserved===true'),true,await browser.evaluate('document.querySelector("[data-rescue-status]").textContent'));assert.equal(await browser.evaluate('JSON.parse(localStorage.getItem("meble_local_reset_v1")).state'),'pending');
  const interrupted=await browser.evaluate('localProof()');await assertForeign();assert.deepEqual(interrupted.tables,before.tables);assert.deepEqual(interrupted.raw.filter(([k])=>k!=='meble_local_reset_v1'),before.raw);
  await navigation.navigate(server.base+'/index.html');await until('document.body?.dataset.authState==="error"&&!document.getElementById("auth-recovery").hidden');
  assert.equal(await browser.evaluate('window.FC.applicationStartup.diagnostics().firstError.code'),'LF_LOCAL_RESET_INTERRUPTED');assert.deepEqual((await browser.evaluate('localProof()')).tables,before.tables);
  await tap('#auth-recovery');await until('!!document.querySelector("[data-local-first-rescue]")');
  console.log('PASS interrupted native transaction aborts; restart refuses normal startup and preserves original uncertain queue until another conscious confirmation');
  phase='accept reset';await confirmReset(true);
  await until('document.querySelector("[data-rescue-status]").dataset.rescueStatus==="RESET_COMPLETE"');
  await assertForeign();const cleared=await browser.evaluate('localProof()');for(const n of ['replicas','protected','outbox'])assert.deepEqual(cleared.tables[n],[]);assert.equal(cleared.tables.control.length,1);
  assert.equal(cleared.raw.some(([k])=>k.startsWith('fc_')||k.startsWith('hardware')),false);
  console.log('PASS confirmed reset ignores foreign database without opening it; exact version/schema/indexes/keys/records preserved');
  phase='restart after reset';await tap('[data-local-first-rescue] button:nth-of-type(2)');
  await until('document.body?.dataset.businessState==="ready"');assert.equal(await browser.evaluate('window.FC.applicationStartup.inspect().state'),'local-only');
  const model=await browser.evaluate('window.FC.globalDataContract.capture(localStorage,Object.keys(window.FC.globalDataContract.schemas)).model');
  const factory=server.candidate;assert.deepEqual(model,factory.model);
  phase='offline reload';networkAvailable=false;offline=true;await browser.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await browser.send('Network.overrideNetworkState',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await navigation.navigate(server.base+'/index.html');await until('document.body?.dataset.businessState==="ready"');if(offlineError)throw offlineError;assert.equal(await browser.evaluate('__LOCAL_BOOT_ONLINE__'),false);await browser.send('Network.overrideNetworkState',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});assert.equal(await browser.evaluate('navigator.onLine'),false);
  phase='offline investor/project';await until('window.FC.applicationWrite?.localOnly===true&&!window.FC.applicationStartup.inspect().transactionPending');await tap('#openFurnitureProjectsBtn');await until('uiState.entry==="modeHub"&&!window.FC.applicationStartup.inspect().transactionPending');await tap('#modeHubRoot [data-action="new-investor"]');await until('!!document.getElementById("invName")&&!window.FC.applicationStartup.inspect().transactionPending');
  for(const [id,value]of Object.entries({invName:'Synthetic Local Owner',invPhone:'123456789',invCity:'Test City',invEmail:'local@example.invalid',invAddress:'Synthetic address',invNotes:'Synthetic offline',invTransportDistanceKm:'12',invTransportDurationMin:'30',invCarryingFloorNumber:'0'}))await fill('#'+id,value);
  await browser.evaluate(`(()=>{const el=document.getElementById('invSource');el.value=[...el.options].find(o=>o.value)?.value;el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await tap('#investorActionBar [data-investor-action="save"]');await until('!!document.querySelector(".confirm-box")');await tap('.confirm-box .is-success');
  await until('window.FC.investors.readAll().length===1&&window.FC.projectStore.readAll().length===1&&!window.FC.applicationStartup.inspect().transactionPending');
  assert.equal(await browser.evaluate('window.FC.investors.readAll()[0].transport?.durationMin'), '30', 'Persisted synthetic investor must have manual travel time');
  await tap('[data-investor-action="add-room"]');await until('!!document.querySelector(".panel-box input[placeholder]")');await fill('.panel-box input[placeholder]','Synthetic Kitchen');await tap('.panel-box .btn-success');
  await until('window.FC.investors.readAll()[0].rooms.length===1&&!window.FC.applicationStartup.inspect().transactionPending');await tap('[data-action="open-room"][data-room^="room_"]');await until('window.FC.session.active&&window.FC.session.durable&&!window.FC.applicationStartup.inspect().transactionPending');
  await browser.evaluate('document.getElementById("roomParametersAccordion").open=true');await fill('#roomSettingInline_roomHeight','275');await tap('#roomSettingsSummary .wywiad-room-inline-form__save');await until('projectData[uiState.roomType].settings.roomHeight===275');await until('!window.FC.applicationStartup.inspect().transactionPending');assert.equal(await browser.evaluate('window.FC.projectStore.getCurrentRecord().projectData[uiState.roomType].settings.roomHeight'),275);assert.equal(await browser.evaluate('!!document.querySelector(".confirm-box")'),false);
  phase='three cabinets through the real form';if(await browser.evaluate('!!document.querySelector(".info-box button")'))await tap('.info-box button');
  for(const [index,width]of [60,70,80].entries()){
   phase='real cabinet form '+(index+1);
   await until('!window.FC.actions.isLocked("add-cabinet")');await tap('#floatingAdd');await until('document.getElementById("cabinetModal").style.display==="flex"');
   await tap('#cabinetTypeChoices .choice-tile:first-child');await fill('#cmWidth',String(width));await fill('#cmHeight','82');await fill('#cmDepth','50');
   await tap('#cabinetModalSave');await until('document.getElementById("cabinetModal").style.display==="none"&&!window.FC.applicationStartup.inspect().transactionPending');
   assert.equal(await browser.evaluate('projectData[uiState.roomType].cabinets.length'),index+1);
   assert.equal(await browser.evaluate('window.FC.session.active&&window.FC.session.durable'),true);
  }
  const cabinetIds=await browser.evaluate('projectData[uiState.roomType].cabinets.map(c=>c.id)');assert.equal(new Set(cabinetIds).size,3);
  async function editFirstCabinet(width){await tap('#cab-'+cabinetIds[0]+' [data-act="edit"]');await until('document.getElementById("cabinetModal").style.display==="flex"');await fill('#cmWidth',String(width));await tap('#cabinetModalSave');await until('document.getElementById("cabinetModal").style.display==="none"&&!window.FC.applicationStartup.inspect().transactionPending');}

  console.log('PASS three cabinets entered through actual modal controls in one durable local session, with distinct preserved IDs');
  phase='aborted cabinet commit';await until('!window.FC.actions.isLocked("add-cabinet")');await tap('#floatingAdd');await until('document.getElementById("cabinetModal").style.display==="flex"');await fill('#cmWidth','90');
  const beforeCabinetFailure=await browser.evaluate('localProof()');
  await browser.evaluate(`(()=>{const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...rest){const tx=original.call(this,stores,mode,...rest);if(this.name===${JSON.stringify(server.name)}&&mode==='readwrite'){IDBDatabase.prototype.transaction=original;window.cabinetAbortObserved=true;queueMicrotask(()=>tx.abort());}return tx;};return true;})()`);
  await tap('#cabinetModalSave');await until('!!document.querySelector(".info-box")&&!window.FC.applicationStartup.inspect().transactionPending');
  assert.equal(await browser.evaluate('cabinetAbortObserved===true'),true);assert.equal(await browser.evaluate('document.getElementById("cabinetModal").style.display'),'flex');assert.equal(await browser.evaluate('document.getElementById("cmWidth").value'),'90');
  assert.deepEqual(await browser.evaluate('localProof()'),beforeCabinetFailure);assert.deepEqual(await browser.evaluate('projectData[uiState.roomType].cabinets.map(c=>c.id)'),cabinetIds);
  await tap('.info-box button');await tap('#cabinetModalCancel');await until('document.getElementById("cabinetModal").style.display==="none"');
  console.log('PASS aborted cabinet transaction preserves form, RAM, native RAW and all four IDB stores; no premature close or success');
  await browser.evaluate('window.unsavedLocalRam=JSON.stringify(projectData);window.unsavedLocalDocument=crypto.randomUUID();true');
  const documentToken=await browser.evaluate('unsavedLocalDocument');
  await browser.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await browser.send('Network.overrideNetworkState',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await pause(100);
  await browser.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await browser.send('Network.overrideNetworkState',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  assert.equal(await browser.evaluate('unsavedLocalDocument'),documentToken);assert.equal(await browser.evaluate('JSON.stringify(projectData)===unsavedLocalRam&&window.FC.session.active'),true);
  phase='local save';await pause(220);await until('!window.FC.applicationStartup.inspect().transactionPending');await editFirstCabinet(61);await tap('#sessionSave');await until('!window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending');assert.equal(await browser.evaluate('window.FC.projectStore.getCurrentRecord().projectData[uiState.roomType].settings.roomHeight'),275);
  assert.equal(await browser.evaluate('window.FC.investorProjectRuntime.hasProjectDivergence(projectData)'),false,'Confirmed Save must leave RAM consistent with its durable project');
  if(process.argv.includes('--cabinet-variants-only')||process.argv.includes('--cabinet-base-probe')){
   phase='native cabinet variants';await require('./helpers/local-cabinet-native-cases')({getBrowser:()=>browser,tap,fill,until,reopen:()=>reopenOffline(61,false,null),baseProbe:process.argv.includes('--cabinet-base-probe')});
   await assertForeign();assert.deepEqual(external,[]);return;
  }
  if(process.argv.includes('--quote-final-only')){
   phase='quote final material modes';await require('./helpers/quote-final-material-browser')({browser,tap,fill,until});await assertForeign();assert.deepEqual(external,[]);return;
  }
  phase='basic WYCENA';const quote=await browser.evaluate(`(async()=>{const room=window.FC.investors.readAll()[0].rooms[0].id;const labor=window.FC.wycenaCore.collectCabinetLabor([room]);const quote=await window.FC.wycenaCore.collectQuoteData({selection:{selectedRooms:[room]}});return {labor:!!labor[0]?.details?.some(r=>r.total>0),totals:quote.totals};})()`);assert.equal(quote.labor,true);assert.ok(Object.values(quote.totals).some(n=>typeof n==='number'&&Number.isFinite(n)&&n>0));
  phase='quote deletion';await require('./helpers/quote-delete-browser')({browser,tap,until,abortNextProjectWrite,reopenOffline:async()=>{await reopenOffline();return browser;}});
  if(process.argv.includes('--quote-delete-only')){await assertForeign();assert.deepEqual(external,[]);return;}
  phase='material catalog';browser=await require('./helpers/material-catalog-browser')({browser,tap,until,fill,abortNextProjectWrite,reopenOffline:async()=>{await reopenOffline();return browser;}});
  if(process.argv.includes('--material-catalog-only')){await assertForeign();assert.deepEqual(external,[]);return;}
  const saved=await browser.evaluate('localProof()');assert.deepEqual(saved.tables.outbox,[]);assert.deepEqual(saved.tables.replicas,[]);assert.equal(await browser.evaluate('window.FC.applicationStartup.inspect().cloudConfirmed'),false);
  async function reopenOffline(expectedWidth=61,staleJournal=false,expectedIds=cabinetIds){assert.equal(await browser.evaluate('JSON.parse(localStorage.getItem("meble_local_reset_v1")).state'),'used','Ready runtime must consume the reset before closing');await browser.gracefulClose();browser=null;networkAvailable=true;
  browser=await openBrowserDevice({base:server.base+'/fixture-host.html'},path.join(dir,'profile'));const targets=await browser.send('Target.getTargets');for(const t of targets.targetInfos)if(t.type==='page'&&t.targetId!==browser.targetId){assert.ok(t.url==='about:blank'||t.url.startsWith(server.base));await browser.send('Target.closeTarget',{targetId:t.targetId});}assert.equal(await browser.evaluate('JSON.parse(localStorage.getItem("meble_local_reset_v1")).state'),'used','A new renderer must see the completed journal before app startup');navigation=documentNavigation(browser.send);browser.onEvent(onEvent);await browser.send('Network.enable');await browser.send('Debugger.enable');await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:preload});
  if(staleJournal)await browser.evaluate('(()=>{const key="meble_local_reset_v1",value=JSON.parse(localStorage.getItem(key));localStorage.setItem(key,JSON.stringify({...value,state:"pending"}));})()');networkAvailable=false;await browser.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await browser.send('Network.overrideNetworkState',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await navigation.navigate(server.base+'/index.html');await until('document.body?.dataset.businessState==="ready"');assert.equal(await browser.evaluate('__LOCAL_BOOT_ONLINE__'),false);await assertForeign();
  if(expectedIds===null)return;
  assert.equal(await browser.evaluate('window.FC.projectStore.readAll()[0].projectData[window.FC.investors.readAll()[0].rooms[0].id].cabinets[0].width'),expectedWidth);assert.deepEqual(await browser.evaluate('window.FC.projectStore.readAll()[0].projectData[window.FC.investors.readAll()[0].rooms[0].id].cabinets.map(c=>c.id)'),expectedIds);
  }
  phase='close and offline reopen';await reopenOffline(61,true);assert.equal(await browser.evaluate('JSON.parse(localStorage.getItem("meble_local_reset_v1")).state'),'used');console.log('PASS stale pending journal reconciles only verified receipt/binding/source/image; existing saved local data are preserved');
  assert.equal(await browser.evaluate('window.FC.investors.readAll().length'),1);assert.equal(await browser.evaluate('window.FC.projectStore.readAll().length'),1);
  phase='durable local draft';await tap('[data-action="open-room"][data-room^="room_"]');await until('window.FC.session.active&&window.FC.session.durable');
  await editFirstCabinet(62);await browser.evaluate('window.FC.projectAutosave.scheduleProjectAutosave();true');
  await until(`(async()=>{const p=await localProof(),a=p.tables.control.find(r=>r.key==='application');return JSON.parse(a.rows.fc_projects_v1)[0].projectData[window.FC.investors.readAll()[0].rooms[0].id].cabinets[0].width===62&&!window.FC.applicationStartup.inspect().transactionPending;})()`);
  assert.equal(await browser.evaluate('window.FC.session.active'),true);await reopenOffline(62);
  assert.equal(await browser.evaluate('window.FC.session.active&&window.FC.session.durable'),true);assert.equal(await browser.evaluate('projectData[window.FC.investors.readAll()[0].rooms[0].id].cabinets[0].width'),62);
  phase='local rollback';await tap('#sessionCancel');await until('!!document.querySelector(".confirm-box")');await tap('.confirm-box .is-danger');await until('projectData[window.FC.investors.readAll()[0].rooms[0].id].cabinets[0].width===61');
  const finalProof=await browser.evaluate('localProof()');assert.deepEqual(finalProof.tables.outbox,[]);const finalRows=finalProof.tables.control.find(r=>r.key==='application').rows;for(const keys of Object.values(factory.context.FC.globalDataContract.sources))for(const alias of keys.slice(1))assert.equal(finalRows[alias]??null,saved.tables.control.find(row=>row.key==='application').rows[alias]??null,'Cancel must preserve exact existing or missing historical aliases');
  console.log('PASS unsaved local edit is journaled by existing autosave/IDB, survives a second offline Chromium restart, and Cancel restores the saved baseline without cloud ACK');
  async function abortNextProjectWrite(){
    await browser.evaluate(`(()=>{const original=IDBDatabase.prototype.transaction;window.actionAbortObserved=false;IDBDatabase.prototype.transaction=function(stores,mode,...rest){const tx=original.call(this,stores,mode,...rest);if(this.name===${JSON.stringify(server.name)}&&mode==='readwrite'){IDBDatabase.prototype.transaction=original;window.actionAbortObserved=true;queueMicrotask(()=>tx.abort());}return tx;};return true;})()`);
  }
  async function expectAbortedAction(before){
    await until('window.actionAbortObserved&&!!document.querySelector(".info-box")&&!window.FC.applicationStartup.inspect().transactionPending');
    assert.deepEqual(await browser.evaluate('localProof()'),before);
    await tap('.info-box button');
  }
  phase='cabinet delete';const retained=cabinetIds.slice(0,2),deleteButton='#cab-'+cabinetIds[2]+' [data-act="del"]';
  if(!await browser.evaluate('uiState.roomType'))await tap('[data-action="open-room"][data-room^="room_"]');
  await until('uiState.activeTab==="wywiad"&&!window.FC.applicationStartup.inspect().transactionPending');
  const beforeDelete=await browser.evaluate('localProof()');
  const cabinetBeforeDelete=await browser.evaluate('JSON.stringify(projectData[uiState.roomType])');
  await tap(deleteButton);await until('!!document.querySelector(".confirm-box")');
  await abortNextProjectWrite();await tap('.confirm-box .is-danger');await expectAbortedAction(beforeDelete);
  assert.equal(await browser.evaluate('JSON.stringify(projectData[uiState.roomType])'),cabinetBeforeDelete);
  await tap(deleteButton);await until('!!document.querySelector(".confirm-box")');await tap('.confirm-box .is-danger');
  await until(`!document.getElementById(${JSON.stringify('cab-'+cabinetIds[2])})&&!window.FC.applicationStartup.inspect().transactionPending`);
  assert.deepEqual(await browser.evaluate('projectData[uiState.roomType].cabinets.map(c=>c.id)'),retained);
  assert.equal(await browser.evaluate(`projectData[uiState.roomType].fronts.some(f=>f.cabId===${JSON.stringify(cabinetIds[2])})`),false);
  const deleteState=await browser.evaluate('({active:window.FC.session.active,dirty:window.FC.session.isDirty(),button:getComputedStyle(document.querySelector("#sessionSave")).display,toolbar:getComputedStyle(document.querySelector("#sessionButtons")).display,tab:uiState.activeTab,entry:uiState.entry})');
  assert.equal(deleteState.dirty,true,JSON.stringify(deleteState));
  assert.notEqual(deleteState.button,"none",JSON.stringify(deleteState));
  assert.notEqual(deleteState.toolbar,"none",JSON.stringify(deleteState));
  await tap('#sessionSave');await until('!window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending');
  await until('!!document.querySelector(".info-box")');await tap('.info-box button');
  console.log('PASS cabinet delete waits for IDB commit and preserves the cabinet and room on abort');
  phase='second quoteable room';await tap('[data-action="tab"][data-tab="inwestor"]');await until('!window.FC.applicationStartup.inspect().transactionPending');
  await tap('[data-investor-action="add-room"]');await until('!!document.querySelector(".panel-box input[placeholder]")');
  await fill('.panel-box input[placeholder]','Synthetic J');await tap('.panel-box .btn-success');
  await until('window.FC.investors.readAll()[0].rooms.length===2&&!window.FC.applicationStartup.inspect().transactionPending');
  const roomIds=await browser.evaluate('window.FC.investors.readAll()[0].rooms.map(room=>room.id)');
  await tap(`[data-action="open-room"][data-room="${roomIds[1]}"]`);await until('window.FC.session.durable&&!window.FC.applicationStartup.inspect().transactionPending');
  await tap('#floatingAdd');await until('document.getElementById("cabinetModal").style.display==="flex"');
  await tap('#cabinetTypeChoices .choice-tile:first-child');await fill('#cmWidth','91');await fill('#cmHeight','82');await fill('#cmDepth','50');
  await tap('#cabinetModalSave');await until('document.getElementById("cabinetModal").style.display==="none"&&!window.FC.applicationStartup.inspect().transactionPending');
  await tap('#sessionSave');await until('!window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending');
  await until('!!document.querySelector(".info-box")');await tap('.info-box button');
  phase='quote room picker';await tap('[data-action="tab"][data-tab="wycena"]');
  await until('!!document.querySelector(".quote-selection-launch--rooms")&&!window.FC.applicationStartup.inspect().transactionPending');
  const roomPicker='.panel-box .rozrys-scope-chip--room-option';
  await tap('.quote-selection-launch--rooms');
  await until(`document.querySelectorAll('${roomPicker} input:checked').length===2`);
  await tap(roomPicker+':nth-child(2) .rozrys-room-chip__label');
  const beforeSelection=await browser.evaluate('localProof()');
  await abortNextProjectWrite();await tap('.panel-box .rozrys-picker-footer .btn-success');await expectAbortedAction(beforeSelection);
  assert.deepEqual(await browser.evaluate(`[...document.querySelectorAll('${roomPicker} input')].map(input=>input.checked)`),[true,false]);
  await tap('.panel-box .rozrys-picker-footer .btn-success');
  await until('!document.querySelector(".panel-box-backdrop")&&!window.FC.applicationStartup.inspect().transactionPending');
  assert.deepEqual(await browser.evaluate('window.FC.quoteOfferStore.getCurrentDraft().selection.selectedRooms'),[roomIds[0]]);
  assert.doesNotMatch(await browser.evaluate('document.querySelector(".quote-selection-launch--rooms").textContent'),/Synthetic J/);
  await tap('[data-action="wycena-generate"]');
  await until('window.FC.quoteSnapshotStore.listForProject(window.FC.projectStore.getCurrentProjectId()).length===1&&!window.FC.applicationStartup.inspect().transactionPending');
  assert.deepEqual(await browser.evaluate('window.FC.quoteSnapshotStore.listForProject(window.FC.projectStore.getCurrentProjectId())[0].scope.selectedRooms'),[roomIds[0]]);
  phase='offline reopen with delete and room selection';await reopenOffline(61,false,retained);
  assert.deepEqual(await browser.evaluate('window.FC.quoteOfferStore.getCurrentDraft().selection.selectedRooms'),[roomIds[0]]);
  assert.equal(await browser.evaluate(`window.FC.projectStore.getCurrentRecord().projectData[${JSON.stringify(roomIds[1])}].cabinets.length`),1);
  console.log('PASS a rejected room selection retains the picker and checkboxes; retry prices only Kitchen and survives offline reopen');
  phase='route through real investor panel';
  await browser.evaluate(`(()=>{const api=window.FC.openRouteServiceTransport;api.validateRouteInput=()=>({ok:true});api.calculateRoute=async()=>({distanceKm:0.3,durationMin:0,routeDistanceMeters:300,routeDurationSeconds:20,status:'success',source:'openrouteservice',destinationGeocode:{label:'Synthetic route'}});return true;})()`);
  const beforeRoute=await browser.evaluate('localProof()');
  await tap('[data-investor-transport-action="calculate-ors"]');await until('!!document.querySelector(".info-box")&&!window.FC.applicationStartup.inspect().transactionPending');
  assert.match(await browser.evaluate('document.querySelector(".info-box").textContent'),/Trasa przeliczona/);
  await tap('.info-box button');
  const afterRoute=await browser.evaluate('localProof()'),routeRows=afterRoute.tables.control.find(r=>r.key==='application').rows;
  assert.equal(JSON.parse(routeRows.fc_investors_v1)[0].transport.routeDurationSeconds,'20');assert.deepEqual(afterRoute.raw,beforeRoute.raw);
  assert.equal(routeRows.fc_quote_snapshots_v1,beforeRoute.tables.control.find(r=>r.key==='application').rows.fc_quote_snapshots_v1);
  const routedQuote=await browser.evaluate(`window.FC.wycenaCore.collectQuoteData({selection:{selectedRooms:[${JSON.stringify(roomIds[0])}]}}).then(q=>({schedule:q.schedule,lines:q.quoteRateLines}))`);
  assert.equal(routedQuote.schedule.status,'READY');assert.equal(routedQuote.schedule.assembly.travelMinutes,10);
  assert.equal(routedQuote.lines.find(l=>l.sourceRole==='transport-distance').qty,4);
  assert.ok(Math.abs(routedQuote.lines.find(l=>l.sourceRole==='transport-distance').unitPrice-1.4)<1e-10);
  console.log('PASS full production runtime/panel persists synthetic ORS result, fills table and prices the next WYCENA with identical reserved commute time; saved offer and physical originals unchanged');
  phase='catalog rule authority through actual UI';
  await require('./helpers/catalog-pricing-browser')({browser,tap,until,fill,roomId:roomIds[0]});
  const beforeSecondInvestor=(await browser.evaluate('localProof()')).tables.control.find(row=>row.key==='application').rows;
  phase='second investor through actual form';
  const retainedInvestor=await browser.evaluate('window.FC.investors.getCurrentId()');
  await browser.evaluate('window.FC.actions.dispatch("open-investors-list",{})');await until('uiState.entry==="investorsList"&&!window.FC.applicationStartup.inspect().transactionPending');
  await tap('[data-action="create-investor"]');await until('!!document.getElementById("invName")&&!window.FC.applicationStartup.inspect().transactionPending');
  for(const [id,value]of Object.entries({invName:'Synthetic deleted owner',invPhone:'987654321',invCity:'Second Test City',invEmail:'second@example.invalid',invAddress:'Second synthetic address',invNotes:'Synthetic second owner'}))await fill('#'+id,value);
  await browser.evaluate(`(()=>{const el=document.getElementById('invSource');el.value=[...el.options].find(o=>o.value)?.value;el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await tap('#investorActionBar [data-investor-action="save"]');await until('!!document.querySelector(".confirm-box")');await tap('.confirm-box .is-success');
  await until('window.FC.investors.readAll().length===2&&window.FC.projectStore.readAll().length===2&&!window.FC.applicationStartup.inspect().transactionPending');
  const removedInvestor=await browser.evaluate('window.FC.investors.getCurrentId()');assert.notEqual(removedInvestor,retainedInvestor);
  phase='delete through actual list and confirmation';await browser.evaluate('window.FC.actions.dispatch("open-investors-list",{})');
  await until('uiState.entry==="investorsList"&&!window.FC.applicationStartup.inspect().transactionPending');
  await tap('[data-action="remove-investor-from-list"]');await until('!!document.querySelector("[data-investor-delete-id]")');
  await tap(`[data-investor-delete-id="${removedInvestor}"]`);await tap('[data-action="remove-investor-from-list"]');await until('!!document.querySelector(".confirm-box")');
  const beforeCancel=await browser.evaluate('localProof()');await tap('.confirm-box .is-neutral');await until('!document.querySelector(".confirm-box")');assert.deepEqual(await browser.evaluate('localProof()'),beforeCancel);
  await tap('[data-action="remove-investor-from-list"]');await until('!!document.querySelector(".confirm-box")');await tap('.confirm-box .is-danger');
  await until('window.FC.investors.readAll().length===1&&!window.FC.applicationStartup.inspect().transactionPending');
  await until('!!document.querySelector(".info-box")');await tap('.info-box button');
  const afterFirst=await browser.evaluate('localProof()'),afterFirstRows=afterFirst.tables.control.find(r=>r.key==='application').rows;
  for(const key of ['fc_investors_v1','fc_projects_v1','fc_quote_snapshots_v1','fc_quote_offer_drafts_v1'])assert.equal(afterFirstRows[key]??null,beforeSecondInvestor[key]??null,'Remaining original data must stay exact: '+key);
  assert.equal(afterFirstRows.fc_current_project_id_v1,null);assert.equal(afterFirstRows.fc_current_investor_v1,null);
  assert.equal(await browser.evaluate('window.FC.investors.canRemoveFromList()'),true);
  await browser.evaluate(`window.FC.investorDeletion.prepare([${JSON.stringify(retainedInvestor)}]).then(()=>true)`);assert.deepEqual(await browser.evaluate('localProof()'),afterFirst,'Preparing another delete must remain read-only');
  await tap(`[data-action="open-investor"][data-inv-id="${retainedInvestor}"]`);
  await until(`window.FC.investors.getCurrentId()===${JSON.stringify(retainedInvestor)}&&uiState.entry==='rooms'&&!window.FC.applicationStartup.inspect().transactionPending`);
  assert.equal(await browser.evaluate('window.FC.investorOpenDiagnostics.state.outcome'),'approved');
  assert.equal(await browser.evaluate('window.FC.investorProjectRuntime.hasProjectDivergence(projectData)'),false);
  assert.deepEqual(await browser.evaluate('projectData[window.FC.investors.readAll()[0].rooms[0].id].cabinets.map(c=>c.id)'),retained);
  assert.deepEqual(afterFirst.raw,afterRoute.raw);for(const name of ['outbox','replicas'])assert.deepEqual(afterFirst.tables[name],afterRoute.tables[name]);
  console.log('PASS two real investors: deleting the selected owner leaves exact retained project/offers; immediate Open and delete preparation work in the SAME document, without session begin or restart');
  await browser.evaluate('window.FC.actions.dispatch("open-investors-list",{})');await until('uiState.entry==="investorsList"&&!window.FC.applicationStartup.inspect().transactionPending');
  await tap('[data-action="remove-investor-from-list"]');await until('!!document.querySelector("[data-investor-delete-id]")');
  await tap(`[data-investor-delete-id="${retainedInvestor}"]`);await tap('[data-action="remove-investor-from-list"]');await until('!!document.querySelector(".confirm-box")');await tap('.confirm-box .is-danger');
  await until('window.FC.investors.readAll().length===0&&!window.FC.applicationStartup.inspect().transactionPending');
  assert.equal(await browser.evaluate('window.FC.projectStore.readAll().length'),0);await until('!!document.querySelector(".info-box")');await tap('.info-box button');
  const erased=await browser.evaluate('localProof()');assert.deepEqual(erased.raw,afterRoute.raw);assert.deepEqual(erased.tables.outbox,afterRoute.tables.outbox);assert.deepEqual(erased.tables.replicas,afterRoute.tables.replicas);assert.equal(erased.tables.protected.filter(r=>r.scope==='investor-deletions').length,2);
  phase='offline restart after actual list deletion';await reopenOffline(61,false,null);assert.equal(await browser.evaluate('window.FC.investors.readAll().length'),0);assert.equal(await browser.evaluate('window.FC.projectStore.readAll().length'),0);
  const erasedRestart=await browser.evaluate('localProof()');assert.deepEqual(erasedRestart.raw,erased.raw);assert.deepEqual(erasedRestart.tables.protected,erased.tables.protected);assert.deepEqual(erasedRestart.tables.outbox,erased.tables.outbox);
  console.log('PASS full runtime/list/confirm: cancel changes nothing, conscious local investor+project+offer deletion survives offline Chromium restart; unrelated database, originals, globals, backups and queue preserved');
  await assertForeign();assert.deepEqual(external,[]);console.log('PASS confirmed reset → code catalogs / 14 domains → full offline startup → first investor/project/room → durable save → offline reopen; zero cloud requests and no fabricated ACK');
 }catch(error){console.error('FAIL local browser '+phase+': '+error.message);throw Error(phase+': '+error.message);}finally{try{await browser?.close();}finally{networkAvailable=true;await server.close();fs.rmSync(dir,{recursive:true,force:true});}}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
