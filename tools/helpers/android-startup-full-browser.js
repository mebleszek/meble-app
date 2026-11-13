'use strict';
// Full public business manifest/boot/runtime; only Firebase SDK replies are
// synthetic. Never replaces window.FC.init, __APP_STARTED__, authority or synchronizer.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {androidGlobalsFixture}=require('./android-globals-browser-fixture'),{connectionSdk}=require('../android-startup-auth-smoke');
const {injection}=require('../trusted-session-browser-smoke'),{documentNavigation,waitForGesturePoint}=require('./browser-test-readiness');
const root=path.resolve(__dirname,'../..'),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main({delayMs=46000,roomStartup=false}={}){
 const {openBrowserDevice}=await import('./local-first-browser.mjs'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-full-auth-'));
 const server=await androidGlobalsFixture({deployment:()=>root});let browser,phase='PREPARE';
 async function until(expression,ms=30000){const end=Date.now()+ms;while(Date.now()<end){if(await browser.evaluate(expression))return;await pause(40);}throw Error('FULL_STARTUP_TIMEOUT '+expression+' '+JSON.stringify(await browser.evaluate('({auth:document.body.dataset.authState,business:document.body.dataset.businessState,failure:window.fullFailure,diagnostic:window.FC.applicationStartup?.diagnostics()?.firstError,ui:window.uiState,session:{active:window.FC.session?.active,durable:window.FC.session?.durable,error:window.FC.session?.lastError?.code},writeCode:window.FC.applicationStartup?.inspect()?.writeCode,info:document.querySelector(".info-box")?.textContent,choice:document.querySelector(".choice-box")?.textContent,error:document.getElementById("auth-error")?.textContent?.slice(0,400),appError:document.getElementById("app-error")?.textContent})')));}
 async function load(file){await browser.evaluate(`new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/'+${JSON.stringify(file)};script.onload=()=>resolve(true);script.onerror=()=>reject(Error('FULL_SCRIPT_LOAD'));document.head.append(script);})`);}
 try{
  browser=await openBrowserDevice({base:server.base+'/fixture-host.html'},path.join(dir,'profile'));
  const navigation=documentNavigation(browser.send);browser.onEvent(event=>navigation.event(event));
  await browser.evaluate('navigator.serviceWorker.register("/fixture-worker.js").then(()=>navigator.serviceWorker.ready).then(()=>true)');
  await browser.send('Emulation.setScriptExecutionDisabled',{value:true});try{await navigation.navigate(server.base+'/index.html');}finally{await browser.send('Emulation.setScriptExecutionDisabled',{value:false});}
  const {model,context}=require('./code-global-catalogs').buildCodeCatalogs(),{applicationKeys}=await import('../../sync/application-authority.mjs'),{codeGlobalRows}=await import('../../sync/global-code-rebuild-plan.mjs'),{digest,json}=await import('../../sync/local-first-values.mjs');
  const rows=Object.fromEntries(applicationKeys(context.FC).map(k=>[k,null]));Object.assign(rows,codeGlobalRows(model,context.FC.globalDataContract),{fc_projects_v1:'[]',fc_investors_v1:'[]',fc_quote_snapshots_v1:'[]',fc_quote_offer_drafts_v1:'[]'});
  let project;
  if(roomStartup){
   project=require('../project-selective-export-smoke').fixture();
   for(const key of ['fc_projects_v1','fc_investors_v1','fc_current_project_id_v1','fc_current_investor_v1'])rows[key]=project.storage.getItem(key);
   rows.fc_ui_v1=JSON.stringify({entry:'app',activeTab:'wywiad',roomType:'kuchnia',currentInvestorId:'inv-A'});
   if(roomStartup==='draft'){assert.equal(project.FC.session.begin('kuchnia'),true);rows.fc_edit_session_v1=project.storage.getItem('fc_edit_session_v1');}
  }
  const packed=await context.FC.globalDataContract.pack(server.uid,model),head={ownerUid:server.uid,version:1,generation:1,revisionId:'11111111111111111111111111111111',directoryHash:packed.directoryHash,recordCount:packed.records.length};
  const encoded=json(model),protection=json(rows),binding={key:'binding',version:1,ownerUid:server.uid,deviceId:'synthetic-device',instanceId:'synthetic-instance'},receipt={version:1,name:server.name,ownerUid:server.uid,deviceId:binding.deviceId,instanceId:binding.instanceId,sourceHash:await digest(rows)};
  const tables={control:[binding,{key:'source',version:1,activationId:'synthetic-activation',rows,hash:receipt.sourceHash},{key:'application',version:1,rows,hash:await digest(json(rows))}],replicas:[{key:'globals',version:1,json:encoded,hash:await digest(encoded),base:head,dirty:false,editor:null}],protected:[{key:'synthetic-confirmed',scope:'globals',json:protection,hash:await digest(protection)}],outbox:[{key:'synthetic-confirmed',scope:'globals',localVersion:1,json:encoded,hash:await digest(encoded),phase:'verified',expected:head,receipt:head}]};
  if(roomStartup)for(const record of JSON.parse(rows.fc_projects_v1)){
   // A confirmed local project is already registered, like the phone image.
   for(const file of ['cloud/cloud-pilot-contract','project/business-project-contract'])require('node:vm').runInContext(fs.readFileSync(path.join(root,'js/app/'+file+'.js'),'utf8'),project.s);
   const built=await project.FC.businessProjectContract.build({getItem:key=>key==='fc_edit_session_v1'?null:rows[key]??null},record.id);
   const value=JSON.parse(JSON.stringify({document:built.document,globals:{head,model},requirements:project.FC.businessProjectContract.dependencies(built.document.payload)})),encoded=json(value);
   tables.replicas.push({key:record.id,version:1,json:encoded,hash:await digest(encoded),base:null,dirty:false,editor:roomStartup==='draft'?{deviceId:binding.deviceId,epoch:1,active:true}:null});
  }
  await browser.evaluate(`(async()=>{
   const tables=${JSON.stringify(tables)},rows=${JSON.stringify(rows)};
   for(const [key,raw]of Object.entries(rows))if(raw!==null)localStorage.setItem(key,raw);
   localStorage.setItem('meble_application_authority_v1',${JSON.stringify(JSON.stringify(receipt))});localStorage.setItem('meble_access_profile_v1',JSON.stringify({version:3,uid:${JSON.stringify(server.uid)},attemptId:'12345678-1234-4123-8123-123456789abc'}));
   const create=(name,stores,write)=>new Promise((resolve,reject)=>{const q=indexedDB.open(name,1);q.onupgradeneeded=()=>{for(const [name,keyPath]of stores)q.result.createObjectStore(name,keyPath?{keyPath}:undefined);};q.onerror=reject;q.onsuccess=()=>{const db=q.result,tx=db.transaction(stores.map(s=>s[0]),'readwrite',{durability:'strict'});write(tx);tx.oncomplete=()=>{db.close();resolve();};tx.onabort=reject;};});
   await create(${JSON.stringify(server.name)},['control','replicas','protected','outbox'].map(n=>[n,'key']),tx=>{for(const [name,rows]of Object.entries(tables))for(const row of rows)tx.objectStore(name).put(row);});
   await create('meble-access-profile-v1',[['ownership',null]],tx=>tx.objectStore('ownership').put({version:1,state:'active',uid:${JSON.stringify(server.uid)},attemptId:'12345678-1234-4123-8123-123456789abc'},'owner'));
   const get=Storage.prototype.getItem;window.fullSnapshot=async()=>{const db=await new Promise(resolve=>{const q=indexedDB.open(${JSON.stringify(server.name)},1);q.onsuccess=()=>resolve(q.result);});try{const data=await new Promise(resolve=>{const data={},tx=db.transaction(['control','replicas','protected','outbox'],'readonly');for(const name of ['control','replicas','protected','outbox']){const q=tx.objectStore(name).getAll();q.onsuccess=()=>{data[name]=q.result;};}tx.oncomplete=()=>resolve(data);});return {data,raw:Object.keys(localStorage).filter(k=>k.startsWith('fc_')||k.startsWith('hardware')||k==='meble_application_authority_v1').sort().map(k=>[k,get.call(localStorage,k)])};}finally{db.close();}};return true;
  })()`);
  for(const file of ['firebase-pilot-transport','cloud-auth','auth-access-gate','cloud-access-verifier','local-access-profile','local-device-access','main-business-loader','offline-shell','application-bootstrap'])await load('js/app/cloud/'+file+'.js');
  await browser.evaluate(injection+'\nFC_AUTH_TEST_OPTIONS={};window.testAccount='+JSON.stringify(server.uid)+';true');
  await browser.evaluate(`(()=>{
   const sdk=(${connectionSdk.toString()})(window,${JSON.stringify(server.uid)}),f=sdk.firestore,originalGet=f.getDocFromServer;
   f.doc=(_db,...path)=>({path,id:path.at(-1)});f.collection=(_db,...path)=>({path});f.query=(...parts)=>parts;f.orderBy=(...x)=>x;f.limit=x=>x;f.documentId=()=>null;f.startAfter=x=>x;f.onSnapshot=()=>()=>{};
   f.getDocsFromServer=async()=>({metadata:{fromCache:false,hasPendingWrites:false},docs:[],size:0});
   f.getDocFromServer=ref=>(ref.path?.includes('globalData')||ref.path?.includes('localFirstProjects'))?Promise.resolve({metadata:{fromCache:false,hasPendingWrites:false},exists:()=>false}):originalGet(ref);
   f.runTransaction=(_db,operation)=>operation({get:ref=>f.getDocFromServer(ref),set(){throw Error('UNEXPECTED_SYNTHETIC_SERVER_WRITE');}});
   let transport=window.FC.firebasePilotTransport;const configure=value=>{value.loadSdk=()=>new Promise(resolve=>{window.fullSdkWaitingAt=performance.now();window.fullRelease=()=>resolve(sdk);});};configure(transport);
   Object.defineProperty(FC,'firebasePilotTransport',{configurable:true,get:()=>transport,set:value=>{transport=value;configure(value);}});
   const gate=window.FC.authAccessGate.create;window.FC.authAccessGate.create=(auth,options)=>gate(auth,{...options,onState(state){window.fullCloudState=state;options.onState?.(state);}});
   const verifier=window.FC.cloudAccessVerifier.create;window.FC.cloudAccessVerifier.create=(...args)=>{const value=verifier(...args);return {...value,watch(){return()=>{};}};};
   window.FC.applicationStartup.configureEmulator({name:${JSON.stringify(server.name)}});const record=window.FC.applicationStartup.recordFailure;window.FC.applicationStartup.recordFailure=(error,...rest)=>{window.fullFailure||={name:error.name,message:error.message,stack:error.stack};return record(error,...rest);};return true;
  })()`);
  await load('js/main-login.js');await until('document.getElementById("auth-google").disabled===false');
  phase='FULL_BUSINESS_LOADING';const point=await waitForGesturePoint(browser.evaluate,'#auth-google',{stable:true});await browser.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  await until('typeof fullRelease==="function"');assert.equal(await browser.evaluate('__APP_STARTED__===true&&!!window.FC.catalogStore&&!!window.FC.session'),true);
  await browser.evaluate(`window.fullRamBefore=JSON.stringify(projectData);const input=document.createElement('input');input.id='full-unsaved';input.value='SYNTHETIC_FULL_FORM';document.getElementById('main-login').append(input);true`);
  const before=await browser.evaluate('fullSnapshot()');phase='EXPIRED_INITIAL_GRANT';
  const end=Date.now()+delayMs;while(Date.now()<end)await pause(Math.min(1000,end-Date.now()));
  if(delayMs>=45000){assert.equal(await browser.evaluate('fullCloudState.code'), 'AUTH_ACCESS_EXPIRED');assert.equal(await browser.evaluate('__FC_MAIN_ACCESS__.isValid()'),true);}
  phase='FRESH_PROOF_AND_REAL_RUNTIME';await browser.evaluate('fullRelease();true');await until('document.body.dataset.businessState==="ready"');
  assert.equal(await browser.evaluate('window.FC.applicationStartup.inspect().state'),'active');assert.equal(await browser.evaluate('window.FC.applicationStartup.diagnostics().stage'),'ready');
  assert.equal(await browser.evaluate('window.FC.applicationStartup.diagnostics().firstError'),null);assert.equal(await browser.evaluate('JSON.stringify(projectData)===fullRamBefore'),true);assert.equal(await browser.evaluate('document.getElementById("full-unsaved").value'),'SYNTHETIC_FULL_FORM');assert.equal(await browser.evaluate('popupCalls'),1);
  const after=await browser.evaluate('fullSnapshot()');assert.deepEqual(after.raw,before.raw);for(const name of ['replicas','protected','outbox'])assert.deepEqual(after.data[name],before.data[name]);
  for(const key of ['binding','source'])assert.deepEqual(after.data.control.find(r=>r.key===key),before.data.control.find(r=>r.key===key));
  const previous=before.data.control.find(r=>r.key==='application'),current=after.data.control.find(r=>r.key==='application');assert.equal(current.version,previous.version+1);
  for(const [key,value]of Object.entries(previous.rows))if(!['fc_ui_v1','fc_current_project_id_v1','fc_current_investor_v1'].includes(key))assert.equal(current.rows[key],value,key);
  assert.ok(await browser.evaluate('probeTransactions>=2'));assert.ok(await browser.evaluate('window.FC.applicationSyncActions.installed()'));
  if(roomStartup){
   assert.equal(await browser.evaluate('window.FC.session.active'),roomStartup==='draft');
   assert.equal(await browser.evaluate('window.FC.session.durable'),roomStartup==='draft');
   if(roomStartup!=='draft')assert.equal(await browser.evaluate('uiState.activeTab'),'inwestor');
   if(roomStartup==='draft'){
    const tap=async selector=>{let point;try{point=await waitForGesturePoint(browser.evaluate,selector,{stable:true});}catch(error){throw Error(error.message+' '+JSON.stringify(await browser.evaluate('({ui:uiState,buttons:document.getElementById("sessionButtons").style.cssText,button:document.getElementById("sessionCancel").style.cssText,active:window.FC.session.active,durable:window.FC.session.durable,app:document.getElementById("appView").style.cssText,info:document.querySelector(".info-box")?.textContent})')));}await browser.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});};
    await browser.send('Network.enable');await browser.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
    assert.equal(await browser.evaluate('window.FC.applicationWrite.checkpoint(()=>window.FC.session.commit())'),true);
    assert.equal(await browser.evaluate('window.FC.session.begin("kuchnia")'),false);
    assert.equal(await browser.evaluate('window.FC.session.lastError.code'),'SESSION_STORAGE_WRITE_FAILED');
    await until('!!document.querySelector(".info-box button")');await tap('.info-box .is-success');
    const refused=await browser.evaluate('({ram:JSON.stringify(projectData),snapshot:JSON.stringify(window.FC.session.snapshot)})'),beforeExit=await browser.evaluate('fullSnapshot()');
    await browser.evaluate(`window.exitPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='control'&&value?.key==='application'){window.exitAbortObserved=true;IDBObjectStore.prototype.put=window.exitPut;this.transaction.abort();throw new DOMException('synthetic durable abort','AbortError');}return window.exitPut.call(this,value,...args);};true`);
    await tap('#sessionCancel');await until('!!document.querySelector(".info-box button")');
    assert.match(await browser.evaluate('document.querySelector(".info-box").textContent'),/Anulowanie niepotwierdzone/);
    assert.equal(await browser.evaluate('window.exitAbortObserved'),true);
    assert.deepEqual(await browser.evaluate('fullSnapshot()'),beforeExit);
    assert.deepEqual(await browser.evaluate('({ram:JSON.stringify(projectData),snapshot:JSON.stringify(window.FC.session.snapshot)})'),refused);
    assert.equal(await browser.evaluate('window.FC.session.active&&!window.FC.session.durable'),true);
    await tap('.info-box .is-success');await tap('#sessionCancel');await until('uiState.entry==="investorsList"&&!window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending');
    const afterExit=await browser.evaluate('fullSnapshot()');assert.deepEqual(afterExit.raw,beforeExit.raw);
    for(const name of ['replicas','protected','outbox'])assert.deepEqual(afterExit.data[name],beforeExit.data[name]);
    const initial=beforeExit.data.control.find(r=>r.key==='application').rows,finished=afterExit.data.control.find(r=>r.key==='application').rows;
    assert.equal(finished.fc_edit_session_v1,null);
    for(const [key,value]of Object.entries(initial))if(!['fc_edit_session_v1','fc_ui_v1','fc_current_project_id_v1','fc_current_investor_v1'].includes(key))assert.equal(finished[key],value,key);
    console.log('PASS actual offline Exit: initial failed session secured only on explicit retry; native IDB abort retains RAM/form/snapshot/RAW/all stores, second Exit reaches investor list without business/catalog/outbox changes');
   }
   console.log('PASS cold synchronized '+(roomStartup==='draft'?'durable draft resumes with exact proof':'saved room opens investor without implicit session')+': real boot/authority/runtime, exact RAW/projects/catalogs/replicas/protected/outbox preserved');
  }else console.log((delayMs>=45000?'PASS full Chromium startup ':'DIAGNOSTIC full startup without duration proof ')+delayMs+'ms: real business manifest/window.FC.init/boot/runtime/authority/synchronizer, expired initial proof → fresh same-session server proof → active/ready; RAM/form/RAW/catalogs/replicas/protected/outbox preserved, only normal control checkpoint version/UI bookkeeping');
 }catch(error){throw Error(phase+': '+error.message);}
 finally{try{await browser?.close();}finally{await server.close();fs.rmSync(dir,{recursive:true,force:true});}}
}
module.exports={main};
