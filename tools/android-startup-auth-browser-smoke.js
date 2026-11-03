'use strict';
// Real Chromium timers, Auth/gate/main and existing business IDB. Synthetic SDK
// replies and runtime isolate authorization from Firebase and business writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {androidGlobalsFixture}=require('./helpers/android-globals-browser-fixture'),{connectionSdk}=require('./android-startup-auth-smoke');
const {injection}=require('./trusted-session-browser-smoke'),{waitForGesturePoint}=require('./helpers/browser-test-readiness');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const {openBrowserDevice}=await import('./helpers/local-first-browser.mjs'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-startup-auth-'));
 const server=await androidGlobalsFixture();let device;
 const baseMain=execFileSync('git',['show','653d72d0d344fa3e87407ee5ebbee1a867022957:js/main-login.js'],{encoding:'utf8'});
 async function until(expression){for(let i=0;i<300;i++){if(await device.evaluate(expression))return;await pause(20);}throw Error('NATIVE_STARTUP_AUTH_TIMEOUT');}
 async function click(selector){const point=await waitForGesturePoint(device.evaluate,selector,{stable:true});await device.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await device.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});}
 async function configure(main,seed){
  await device.evaluate(`(async()=>{
   const data=${JSON.stringify(server.data)},owner=${JSON.stringify(server.uid)},attempt='12345678-1234-4123-8123-123456789abc';
   if(${seed}){
    for(const row of data.local.rows)localStorage.setItem(row.key,row.raw);
    localStorage.setItem('meble_access_profile_v1',JSON.stringify({version:3,uid:owner,attemptId:attempt}));
    const create=(name,stores,write)=>new Promise((resolve,reject)=>{const q=indexedDB.open(name,1);q.onupgradeneeded=()=>{for(const [name,keyPath]of stores)q.result.createObjectStore(name,keyPath?{keyPath}:undefined);};q.onerror=reject;q.onsuccess=()=>{const db=q.result,tx=db.transaction(stores.map(s=>s[0]),'readwrite',{durability:'strict'});write(tx);tx.oncomplete=()=>{db.close();resolve();};tx.onabort=reject;};});
    await create(${JSON.stringify(server.name)},['control','replicas','protected','outbox'].map(name=>[name,'key']),tx=>{for(const [name,rows]of Object.entries(data.databases.authority))for(const row of rows)tx.objectStore(name).put(row);});
    await create('meble-access-profile-v1',[['ownership',null]],tx=>tx.objectStore('ownership').put({version:1,state:'active',uid:owner,attemptId:attempt},'owner'));
   }
   const get=Storage.prototype.getItem;window.startupSnapshot=async()=>{
    const db=await new Promise(resolve=>{const q=indexedDB.open(${JSON.stringify(server.name)},1);q.onsuccess=()=>resolve(q.result);});
    try{const tables=await new Promise((resolve,reject)=>{const data={},names=['control','replicas','protected','outbox'],tx=db.transaction(names,'readonly');for(const name of names){const q=tx.objectStore(name).getAll();q.onsuccess=()=>{data[name]=q.result;};}tx.oncomplete=()=>resolve(data);tx.onabort=reject;});const {digest}=await import('/sync/local-first-values.mjs');
     return {tablesHash:await digest(tables),rawHash:await digest(Object.keys(localStorage).filter(k=>k.startsWith('fc_')||k.startsWith('hardware')||k==='meble_application_authority_v1').sort().map(k=>[k,get.call(localStorage,k)])),phases:tables.outbox.map(row=>row.phase)};
    }finally{db.close();}
   };
   window.projectData={unsaved:'SYNTHETIC_NATIVE_RAM',price:12.125};window.uiState={entry:'investorsList'};
   const input=document.createElement('input');input.id='startup-unsaved';input.value='SYNTHETIC_NATIVE_FORM';document.getElementById('main-login').append(input);
   window.startupCalls={connections:0,runtime:0,aborts:0,context:null};return true;
  })()`);
  for(const name of ['firebase-pilot-transport','cloud-auth','auth-access-gate','cloud-access-verifier','local-access-profile','local-device-access'])await device.evaluate(fs.readFileSync('js/app/cloud/'+name+'.js','utf8')+'\ntrue');
  await device.evaluate(injection+'\nFC_AUTH_TEST_OPTIONS={};window.testAccount='+JSON.stringify(server.uid)+';true');
  await device.evaluate(`(()=>{
   window.startupSdk=(${connectionSdk.toString()})(window,${JSON.stringify(server.uid)});
   const create=FC.cloudAccessVerifier.create;FC.cloudAccessVerifier.create=(...args)=>{const verifier=create(...args),verify=async id=>({...await verifier.verify(id),validUntil:Date.now()+4000});
    return {...verifier,verify,watch(id,reply){window.startupRenew=()=>verify(id).then(reply);return()=>{};}};};
   const gate=FC.authAccessGate.create;FC.authAccessGate.create=(auth,options)=>gate(auth,{...options,onState(state){window.startupCloudState=state;options.onState?.(state);}});
   FC.mainBusinessLoader={create:()=>({start:()=>new Promise(resolve=>{window.startupRelease=resolve;}),abort(){startupCalls.aborts++;}})};
   document.addEventListener('DOMContentLoaded',()=>{window.__APP_STARTED__=true;});
   window.startupImport=async file=>{
    if(file==='../../../sync/application-boot.mjs')return {prepareApplicationBoot:async()=>({})};
    if(file==='../../../sync/application-runtime.mjs')return {startApplicationRuntime:async()=>{startupCalls.runtime++;return {status:()=>({state:'active'})};}};
    if(['./global-data-contract.js','./cloud-pilot-contract.js','./firebase-global-transport.js'].includes(file))return {};
    throw Error('NATIVE_AUTH_UNEXPECTED_IMPORT');
   };return true;
  })()`);
  const bootstrap=fs.readFileSync('js/app/cloud/application-bootstrap.js','utf8').replace(/\bimport\(/g,'startupImport(');
  await device.evaluate('new Function("window","document","localStorage","location","navigator","startupImport",'+JSON.stringify(bootstrap)+')(window,document,localStorage,location,navigator,startupImport);true');
  await device.evaluate(`FC.applicationStartup.configureEmulator({name:${JSON.stringify(server.name)},connections:async input=>{
   startupCalls.connections++;startupCalls.context={context:!!input.authSession?.verificationContext(),identity:!!input.authSession?.identity().uid,lease:!!input.lease,mode:input.localAccess.mode};
   const {createApplicationConnections}=await import('/sync/application-connections.mjs');return createApplicationConnections({window,...input,sdk:startupSdk});
  }});true`);
  await device.evaluate(main+'\ntrue');await until('document.getElementById("auth-google").disabled===false');await click('#auth-google');await until('typeof startupRelease==="function"');
 }
 try{
  device=await openBrowserDevice(server,path.join(dir,'profile'));await configure(baseMain,true);const before=await device.evaluate('startupSnapshot()');assert.ok(before.phases.includes('uncertain'));
  // The synthetic server grants a shorter, valid lease (<= the unchanged 45s
  // policy). Real Chromium expiry fires while the native startup is held.
  await until('startupCloudState?.code==="AUTH_ACCESS_EXPIRED"');assert.equal(await device.evaluate('__FC_MAIN_ACCESS__.isValid()'),true);
  await device.evaluate('startupRelease();true');await until('FC.applicationStartup.diagnostics().firstError?.code==="LF_APPLICATION_AUTH_REQUIRED"');
  assert.deepEqual(await device.evaluate('startupCalls.context'),{context:true,identity:true,lease:false,mode:'desktop'});assert.deepEqual(await device.evaluate('startupSnapshot()'),before);
  console.log('PASS BASE Chromium reproduction: real lease timer clears lease while local access remains valid; context/UID present, lease absent, authorizing-cloud/LF_APPLICATION_AUTH_REQUIRED; RAW/all four stores/uncertain outbox unchanged');
  await device.send('Page.navigate',{url:server.base});await until('window.lfReady===true&&typeof startupCalls==="undefined"');await configure(fs.readFileSync('js/main-login.js','utf8'),false);
  await until('FC.applicationStartup.diagnostics().firstError?.code==="AUTH_ACCESS_EXPIRED"');
  assert.equal(await device.evaluate('__FC_MAIN_ACCESS__.isValid()'),false);assert.deepEqual(await device.evaluate('startupCalls'),{connections:0,runtime:0,aborts:1,context:null});
  await device.evaluate('startupRelease();true');await pause(50);
  assert.equal(await device.evaluate('document.body.dataset.businessState==="ready"'),false);assert.deepEqual(await device.evaluate('startupSnapshot()'),before);
  assert.deepEqual(await device.evaluate('({ram:projectData,input:document.getElementById("startup-unsaved").value})'),{ram:{unsaved:'SYNTHETIC_NATIVE_RAM',price:12.125},input:'SYNTHETIC_NATIVE_FORM'});
  assert.match(await device.evaluate('document.getElementById("auth-error").textContent'),/AUTH_ACCESS_EXPIRED/);
  console.log('PASS patched Chromium: actual expiry aborts delayed initial startup before connection/runtime, first AUTH_ACCESS_EXPIRED stays visible after late completion; exact RAM/form/RAW/IDB/outbox retained');
  await device.send('Page.navigate',{url:server.base});await until('window.lfReady===true&&typeof startupCalls==="undefined"');await configure(fs.readFileSync('js/main-login.js','utf8'),false);
  await pause(2000);await device.evaluate('startupRenew().then(()=>true)');await pause(2100);await device.evaluate('startupRelease();true');await until('document.body.dataset.businessState==="ready"');
  assert.deepEqual(await device.evaluate('startupCalls'),{connections:1,runtime:1,aborts:0,context:{context:true,identity:true,lease:true,mode:'desktop'}});assert.equal(await device.evaluate('popupCalls'),1);assert.deepEqual(await device.evaluate('startupSnapshot()'),before);
  console.log('PASS patched Chromium: current same-owner renewal allows delayed startup across the original deadline exactly once, no extra popup or persistent business changes');
 }finally{try{await device?.close();}finally{await server.close();fs.rmSync(dir,{recursive:true,force:true});}}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
