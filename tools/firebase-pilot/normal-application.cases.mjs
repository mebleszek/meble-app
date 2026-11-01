// Full normal startup in two native profiles. No Node proxy for the synchronizer.
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import http from 'node:http';
import {createRequire} from 'node:module';
import {chromium} from 'playwright-core';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc} from 'firebase/firestore';
import {model,runtime} from './cloud-sync-fixture.mjs';
const require=createRequire(import.meta.url),{waitForGesturePoint,finishPendingTouchScroll,observeGesture}=require('../helpers/browser-test-readiness.js'),{startBrowser}=require('../helpers/chromium-runtime.js'),{injection}=require('../trusted-session-browser-smoke.js');
const root=path.resolve(new URL('../..',import.meta.url).pathname),uid='synthetic-phone-owner';
export async function runNormalApplication(t){
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:18080');assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:19099');
 const original=fs.readFileSync(path.join(root,'tools/firebase-pilot/firestore.rules'),'utf8'),fragment=fs.readFileSync(path.join(root,'sync/local-first-project.rules'),'utf8');
 const env=await initializeTestEnvironment({projectId:'demo-meble-app',firestore:{host:'127.0.0.1',port:18080,rules:original.replace('    match /{document=**}',()=>fragment+'\n    match /{document=**}')}});
 const response=await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/projects/demo-meble-app/accounts:batchCreate',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer owner'},body:JSON.stringify({allowOverwrite:true,users:[{localId:uid,email:uid+'@example.invalid',emailVerified:true,providerUserInfo:[{providerId:'google.com',rawId:uid,email:uid+'@example.invalid'}]}]})});assert.equal(response.ok,true);
 await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'authorizedUsers',uid),{appEnabled:true,enabled:false,globalDataEnabled:true,globalSchemaVersion:1});await setDoc(doc(c.firestore(),'appAccess',uid),{schemaVersion:1});});
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');let file;
  if(/^\/__sdk\/firebase-(app|auth|firestore)\.js$/.test(url.pathname))file=path.join(root,'tools/firebase-pilot/node_modules/firebase',path.basename(url.pathname));
  else file=path.resolve(root,'.'+url.pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{let bytes=fs.readFileSync(file);if(url.pathname.startsWith('/__sdk/'))bytes=Buffer.from(bytes.toString().replaceAll('https://www.gstatic.com/firebasejs/12.19.0/','/__sdk/'));
   res.setHeader('content-type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':/\.(mjs|js)$/.test(file)?'text/javascript':'application/octet-stream');res.end(bytes);
  }catch(_){res.writeHead(404);res.end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port,dir=fs.mkdtempSync(path.join(os.tmpdir(),'normal-local-first-')),devices=[];
 t.after(async()=>{for(const d of devices){await d.browser?.close();await d.owner?.close();}await env.cleanup();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
 const catalogs=model();for(const ref of ['laminat TEST','laminat','TEST','HDF'])if(!catalogs.materials.some(r=>[r.id,r.name,r.materialType].includes(ref)))catalogs.materials.push({id:'normal-material-'+catalogs.materials.length,name:ref,materialType:'synthetic',price:12.375,priceUnit:'sheet'});
 const sources=runtime().FC.globalDataContract.sources;
 async function login(d){await d.page.click('#auth-google');await d.page.waitForFunction(()=>['ready'].includes(document.body.dataset.businessState)||['profile-pending','error'].includes(document.body.dataset.authState));
  if(await d.page.evaluate(()=>document.body.dataset.authState==='error'))throw Error('Normal startup refused '+JSON.stringify(await d.page.evaluate(()=>({state:document.body.dataset,error:document.getElementById('auth-error')?.textContent}))));
  if(await d.page.locator('#auth-profile-admission').isVisible()){await d.page.check('#auth-profile-backup');await d.page.check('#auth-profile-owner');await d.page.click('#auth-profile-confirm');}
  try{await d.page.waitForFunction(()=>document.body.dataset.businessState==='ready');}catch(error){throw Error(error.message+' '+JSON.stringify(await d.page.evaluate(()=>({state:document.body.dataset,error:document.getElementById('auth-error')?.textContent,app:document.getElementById('app-error-msg')?.textContent}))));}}
 async function device(name){
  const owner=await startBrowser({profileDir:path.join(dir,name)}),browser=await chromium.connectOverCDP(owner.endpoint),page=browser.contexts()[0].pages()[0];
  const d={owner,browser,page,name};devices.push(d);await page.addInitScript({content:injection});await page.goto(origin+'/index.html');await login(d);
  await page.evaluate(({catalogs,sources})=>{for(const [domain,value]of Object.entries(catalogs))for(const key of sources[domain])localStorage.setItem(key,JSON.stringify(domain==='stock'?{sheets:value}:value));},{catalogs,sources});
  await page.evaluate(()=>window.FC.offlineShell.prepare());return d;
 }
 async function touch(d,selector){
  const cdp=await d.page.context().newCDPSession(d.page),evaluate=code=>d.page.evaluate(code);
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:d.name==='phone'?393:1024,height:852,deviceScaleFactor:1,mobile:d.name==='phone'});
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});
  await evaluate('('+finishPendingTouchScroll.toString()+')()');
  await evaluate('window.normalGesture=('+observeGesture.toString()+')('+JSON.stringify(selector)+')');
  try{const p=await waitForGesturePoint(evaluate,selector,{stable:true});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,radiusX:3,radiusY:3,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   const trace=await evaluate('window.normalGesture.snapshot()');for(const type of ['pointerdown','pointerup'])assert.equal(trace.events.filter(e=>e.type===type&&e.trusted&&e.onTarget).length,1);
  }finally{await evaluate('window.normalGesture.close();delete window.normalGesture');await cdp.detach();}
 }
 const phone=await device('phone');
 const ids=await phone.page.evaluate(()=>{
  const a=window.FC.investors.create({name:'Normal A'}),b=window.FC.investors.create({name:'Normal B'});
  if(!a||!b)throw Error('Native source creation refused');return [a.id,b.id];
 });
 const first=await phone.page.evaluate(()=>JSON.parse(localStorage.getItem('fc_projects_v1')));
 const pid=first.find(p=>p.investorId===ids[0]).id;
 const room=await phone.page.evaluate(async({pid,iid})=>{
  const fc=window.FC;if(await fc.actions.dispatch('open-investor',{element:{getAttribute:()=>iid}})!==true)throw Error('Fixture activation refused');
  const made=fc.roomRegistry._debug.createRoomRecord(fc.investors.getById(iid),{baseType:'kuchnia',name:'Normal kitchen'});if(!made.ok)throw Error('Fixture room refused');
  const row=fc.projectStore.getById(pid);row.projectData.meta.futureOwnedField={exact:7.125};
  row.projectData[made.room.id].cabinets=[{id:'normal-cabinet',type:'stojąca',subType:'standardowa',width:60.125,height:82,depth:51,frontCount:2,bodyColor:'laminat TEST',frontMaterial:'laminat',frontColor:'TEST',backMaterial:'HDF',bodyPcvMode:'body',details:{shelves:3}}];
  window.projectData=row.projectData;fc.layoutState.ensureLayout(made.room.id);row.projectData=window.projectData;
  if(!fc.projectStore.upsert(row))throw Error('Fixture cabinet refused');window.projectData=fc.project.load();
  if(!fc.storage.setJSON('fc_quote_snapshots_v1',[{id:'normal-offer',project:{id:pid},investor:{id:iid},frozen:{total:21.375,pcv:0.8125}}]))throw Error('Fixture history refused');
  return made.room.id;
 },{pid,iid:ids[0]});
 const source=await phone.page.evaluate(()=>({projects:localStorage.getItem('fc_projects_v1'),investors:localStorage.getItem('fc_investors_v1')}));
 assert.equal(JSON.parse(source.projects).length,2);
 const computer=await device('computer');
 async function configure(d){
  await d.page.addInitScript(({uid,name})=>{const raw=Storage.prototype.getItem;window.readNormalSource=key=>raw.call(localStorage,key);document.addEventListener('DOMContentLoaded',()=>{
   window.FC.applicationStartup.configureEmulator({name:'meble-lf-test-normal-'+name,async connections(input){
    try{const [app,auth,f]=await Promise.all([import('/__sdk/firebase-app.js'),import('/__sdk/firebase-auth.js'),import('/__sdk/firebase-firestore.js')]);
    const errors=window.normalSdkErrors=[];const observed={...f};for(const key of ['runTransaction','getDocFromServer','getDocsFromServer'])observed[key]=(...args)=>{const result=f[key](...args);result.catch(error=>{errors.push({method:key,code:error.code,message:error.message,stack:error.stack});if(errors.length>6)errors.shift();});return result;};
    const config={projectId:'demo-meble-app',apiKey:'demo-only',authDomain:'demo-meble-app.firebaseapp.com',appId:'demo-only'};
    let session=null,lease=null;
    if(input.authSession){
     const name='normal-auth-'+crypto.randomUUID();
     session=await window.FC.cloudAuth.create({target:'emulator',appName:name,firebaseConfig:config,
       emulator:{host:'127.0.0.1',port:19099,firestorePort:18080},sessionOnly:true,sdk:{app,auth,firestore:f}});
     const token='e30.'+btoa(JSON.stringify({sub:uid,email:uid+'@example.invalid',email_verified:true})).replaceAll('=','')+'.';
     await auth.signInWithCredential(auth.getAuth(app.getApp(name)),auth.GoogleAuthProvider.credential(token));
     window.normalGoogleLogins=(window.normalGoogleLogins||0)+1;
     lease={uid,assert(){if(session.identity().uid!==uid)throw Error('LF_AUTH_CHANGED');},isValid:()=>true};
    }
    const {createApplicationConnections}=await import('/sync/application-connections.mjs');
    const connections=await createApplicationConnections({window,authSession:session,lease,sdk:{app,auth,firestore:observed},
      localAccess:{...input.localAccess,firebaseConfig:config,target:'emulator',emulator:{host:'127.0.0.1',port:19099,firestorePort:18080}}});
    for(const conn of [connections.writer,connections.reader]){const assert=conn.assertAccess;conn.assertAccess=()=>{try{return assert();}catch(error){errors.push({method:'assertAccess',code:error.code,message:error.message,stack:error.stack});if(errors.length>6)errors.shift();throw error;}};}
    window.normalConnections=[connections.writer,connections.reader];window.normalConnectionEpoch=(window.normalConnectionEpoch||0)+1;
    return connections;
   }catch(error){window.normalConnectionError={name:error.name,code:error.code,message:error.message,stack:error.stack};throw error;}
   }});
  },{once:true});},{uid,name:d.name});
 }
 async function enable(d){await configure(d);await d.page.reload();await login(d);}
 await enable(phone);await enable(computer);
 async function until(check){for(let i=0;i<200;i++){if(await check())return;await new Promise(r=>setTimeout(r,25));}throw Error('Normal replication timeout '+JSON.stringify(await Promise.all(devices.map(d=>d.page.evaluate(()=>({...window.FC.applicationStartup.inspect(),connectionError:window.normalConnectionError,sdkErrors:window.normalSdkErrors}))))));}
 await until(async()=>await computer.page.evaluate(ids=>ids.every(id=>!!window.FC.investors.getById(id)),ids));
 assert.equal(await computer.page.evaluate(()=>window.FC.investors.readAll().length),2);
 assert.equal(await phone.page.evaluate(()=>window.FC.applicationStartup.inspect().state),'active');
 // An incompatible second document cannot write concurrently; source is retained.
 const extra=await phone.page.context().newPage();await extra.goto(origin+'/index.html');
 await assert.rejects(phone.page.evaluate(()=>window.FC.applicationWrite.globals(()=>true)),/LF_OLD_WRITER_EXCLUSIVITY_UNPROVEN/);
 await extra.close();
 await assert.rejects(phone.page.evaluate(()=>localStorage.setItem('fc_projects_v1','[]')),/LF_ASYNC_TRANSACTION_REQUIRED/);
 await assert.rejects(phone.page.evaluate(()=>window.FC.dataBackupStore.importSnapshot({})),/LF_ARCHIVE_RESTORE_PROTOCOL_REQUIRED/);
 // No injection of authority transactions: existing registry/navigation is wrapped.
 await phone.page.evaluate(()=>window.FC.actions.dispatch('open-investors-list'));
 await touch(phone,'[data-action="open-investor"][data-inv-id="'+ids[0]+'"]');
 await phone.page.waitForFunction(id=>window.FC.investors.getCurrentId()===id&&!window.FC.applicationStartup.inspect().transactionPending,ids[0]);
 // Native repositories now use the normal application transaction entry.
 await phone.page.evaluate(pid=>window.FC.applicationWrite.project(()=>{const row=window.FC.projectStore.getById(pid);row.title='Phone revision';if(!window.FC.projectStore.upsert(row))throw Error('Project write refused');}),pid);
 await until(async()=>await computer.page.evaluate(pid=>window.FC.projectStore.getById(pid)?.title,pid)==='Phone revision');
 await computer.page.evaluate(()=>window.FC.actions.dispatch('open-investors-list'));
 await computer.page.locator('[data-action="open-investor"][data-inv-id="'+ids[0]+'"]').click();
 await computer.page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending);
 await assert.rejects(computer.page.evaluate(()=>window.FC.applicationWrite.project(()=>true)),/LF_EDITOR_BUSY_OR_HEAD_CHANGED/);
 await phone.page.evaluate(()=>window.FC.actions.dispatch('open-investors-list'));
 await computer.page.evaluate(()=>window.FC.actions.dispatch('open-investors-list'));
 await computer.page.locator('[data-action="open-investor"][data-inv-id="'+ids[0]+'"]').click();
 await computer.page.waitForFunction(id=>window.FC.investors.getCurrentId()===id&&!window.FC.applicationStartup.inspect().transactionPending,ids[0]);
 await computer.page.evaluate(pid=>window.FC.applicationWrite.project(()=>{const row=window.FC.projectStore.getById(pid);row.title='Computer revision';if(!window.FC.projectStore.upsert(row))throw Error('Project write refused');}),pid);
 await until(async()=>await phone.page.evaluate(pid=>window.FC.projectStore.getById(pid)?.title,pid)==='Computer revision');
 // Real room action and original Save/Cancel, not a test-only authority call.
 await touch(computer,'.investor-room-quick-btn[data-room="'+room+'"]');
 await computer.page.waitForFunction(()=>window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending);
 await computer.page.evaluate(room=>{window.projectData[room].settings.roomHeight=287.125;window.FC.views.refreshSessionButtons();},room);
 await touch(computer,'#sessionSave');
 await until(async()=>!await computer.page.evaluate(()=>window.FC.session.active));
 await until(async()=>await phone.page.evaluate(({pid,room})=>window.FC.projectStore.getById(pid)?.projectData[room].settings.roomHeight,{pid,room})===287.125);
 await computer.page.locator('.info-box .is-success').click();
 await computer.page.evaluate(()=>window.FC.actions.dispatch('tab',{element:{getAttribute:()=> 'inwestor'}}));
 await touch(computer,'.investor-room-quick-btn[data-room="'+room+'"]');
 await computer.page.waitForFunction(()=>window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending);
 const approved=await computer.page.evaluate(()=>localStorage.getItem('fc_projects_v1'));
 await computer.page.evaluate(room=>{window.projectData[room].settings.roomHeight=299.25;window.FC.views.refreshSessionButtons();},room);
 await computer.page.click('#sessionCancel');await computer.page.locator('.confirm-box .is-danger').click();
 await computer.page.waitForFunction(room=>window.FC.session.active&&window.projectData[room].settings.roomHeight===287.125&&!window.FC.applicationStartup.inspect().transactionPending,room);
 assert.equal(await computer.page.evaluate(()=>localStorage.getItem('fc_projects_v1')),approved);
 await computer.page.click('#sessionCancel');await computer.page.waitForFunction(()=>!window.FC.session.active&&window.uiState.entry==='investorsList'&&!window.FC.applicationStartup.inspect().transactionPending);
 assert.equal(await computer.page.evaluate(id=>window.FC.actions.dispatch('open-investor',{element:{getAttribute:()=>id}}),ids[0]),true);
 const drawing=async d=>d.page.evaluate(({pid,room})=>window.FC.cabinetCutlist.getCabinetCutList(window.FC.projectStore.getById(pid).projectData[room].cabinets[0],room),{pid,room});
 assert.deepEqual(await drawing(phone),await drawing(computer));
 for(const d of [phone,computer]){
  assert.equal(await d.page.evaluate(()=>window.FC.laborCatalog.calculateDefinition({id:'stable-normal-task',name:'Fixture task',price:7.125,pricingMode:'perUnit'},{quantity:3}).total),21.375);
  assert.equal(await d.page.evaluate(pid=>window.FC.projectStore.getById(pid).projectData.meta.futureOwnedField.exact,pid),7.125);
  assert.equal(await d.page.evaluate(()=>window.FC.storage.getJSON('fc_quote_snapshots_v1')[0].frozen.total),21.375);
 }
 // Global UI writes use the same atomic image+outbox boundary.
 await phone.page.evaluate(()=>window.FC.applicationWrite.globals(()=>{const v=window.FC.storage.getJSON('fc_sheets_v1');v.sheets[0].qty=29;if(!window.FC.storage.setJSON('fc_sheets_v1',v))throw Error('Stock write refused');}));
 await until(async()=>await computer.page.evaluate(()=>window.FC.storage.getJSON('fc_sheets_v1').sheets[0].qty)===29);
 assert.equal(await computer.page.evaluate(()=>Object.keys(window.FC.globalDataContract.capture(localStorage,Object.keys(window.FC.globalDataContract.schemas)).model).length),14);
 await phone.page.evaluate(()=>window.FC.applicationWrite.globals(()=>{const rows=window.FC.storage.getJSON('fc_quote_rates_v1');rows[0].price=47.125;if(!window.FC.storage.setJSON('fc_quote_rates_v1',rows))throw Error('Price refused');}));
 await until(async()=>await computer.page.evaluate(()=>window.FC.storage.getJSON('fc_quote_rates_v1')[0].price)===47.125);
 for(const d of [phone,computer])assert.equal(await d.page.evaluate(()=>localStorage.getItem('fc_quote_rates_v1')===localStorage.getItem('fc_services_v1')),true);
 const expectedCatalogs=structuredClone(catalogs);expectedCatalogs.stock[0].qty=29;expectedCatalogs.labor[0].price=47.125;
 for(const d of [phone,computer])assert.deepEqual(await d.page.evaluate(()=>window.FC.globalDataContract.capture(localStorage,Object.keys(window.FC.globalDataContract.schemas)).model),expectedCatalogs,'Every value in all fourteen domains, not just their presence');
 assert.deepEqual(await computer.page.evaluate(pid=>window.FC.projectStore.getById(pid),pid),await phone.page.evaluate(pid=>window.FC.projectStore.getById(pid),pid),'Whole owned record, stable identifiers and unknown fields');


 assert.equal(await computer.page.locator('.info-backdrop').count(),0,'No failed navigation or premature handover notice '+await computer.page.locator('.info-box__title').allTextContents());
 // Explicit trusted-device admission persists only the independent SDK login;
 // local trust remains the existing WebCrypto/IDB proof, never a flag.
 await computer.page.check('#main-trust-phone');
 await computer.page.waitForFunction(()=>document.getElementById('main-trust-status').textContent.startsWith('Zaufano'));
 await computer.page.waitForFunction(()=>window.normalConnections?.[0]?.db.app.name==='meble-sync-trusted-writer-v1'&&window.FC.applicationStartup.inspect().stage==='ready');
 await computer.page.evaluate(pid=>window.FC.applicationWrite.project(()=>{const row=window.FC.projectStore.getById(pid);row.title='Online approved';if(!window.FC.projectStore.upsert(row))throw Error('Editor reservation refused');}),pid);
 await until(async()=>await phone.page.evaluate(pid=>window.FC.projectStore.getById(pid)?.title,pid)==='Online approved');
 await computer.page.context().setOffline(true);await computer.page.waitForFunction(()=>navigator.onLine===false);
 await computer.page.evaluate(pid=>window.FC.applicationWrite.project(()=>{const r=window.FC.projectStore.getById(pid);r.title='Same-window offline';if(!window.FC.projectStore.upsert(r))throw Error('Offline refused');}),pid);
 const previousConnection=await computer.page.evaluate(()=>window.normalConnectionEpoch);
 await computer.page.context().setOffline(false);
 await computer.page.waitForFunction(previous=>window.normalConnectionEpoch>previous&&window.FC.applicationStartup.inspect().stage==='ready',previousConnection);
 await until(async()=>await phone.page.evaluate(pid=>window.FC.projectStore.getById(pid)?.title,pid)==='Same-window offline');
 await computer.page.context().setOffline(true);
 await computer.page.waitForFunction(()=>navigator.onLine===false);
 await computer.page.evaluate(pid=>window.FC.applicationWrite.project(()=>{const row=window.FC.projectStore.getById(pid);row.title='Offline durable revision';if(!window.FC.projectStore.upsert(row))throw Error('Offline write refused');}),pid);
 assert.equal(await phone.page.evaluate(pid=>window.FC.projectStore.getById(pid).title,pid),'Same-window offline');
 const shutdown=await computer.browser.newBrowserCDPSession();await shutdown.send('Browser.close');
 const exited=await computer.owner.exited;assert.equal(exited.code,0);assert.equal(exited.signal,null);await computer.owner.close();
 computer.owner=await startBrowser({profileDir:path.join(dir,computer.name)});
 computer.browser=await chromium.connectOverCDP(computer.owner.endpoint);const context=computer.browser.contexts()[0];computer.page=await context.newPage();
 for(const page of context.pages())if(page!==computer.page)await page.close();
 await computer.page.addInitScript({content:injection});await configure(computer);
 const offlineCDP=await computer.page.context().newCDPSession(computer.page);
 await offlineCDP.send('Page.enable');await offlineCDP.send('Page.bringToFront');await offlineCDP.send('Network.enable');await offlineCDP.send('Debugger.enable');
 let offlinePauses=0;
 offlineCDP.on('Debugger.paused',async()=>{offlinePauses++;await offlineCDP.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await offlineCDP.send('Network.overrideNetworkState',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await offlineCDP.send('Debugger.resume');});
 await offlineCDP.send('Page.addScriptToEvaluateOnNewDocument',{source:'debugger;window.normalOfflineAtBoot=navigator.onLine;'});
 await offlineCDP.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await offlineCDP.send('Network.overrideNetworkState',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await computer.page.goto(origin+'/index.html');
 await offlineCDP.send('Debugger.disable');assert.ok(offlinePauses>0);assert.equal(await computer.page.evaluate(()=>window.normalOfflineAtBoot),false);

 try{await computer.page.waitForFunction(()=>document.body.dataset.businessState==='ready');}catch(error){throw Error('Cold startup '+JSON.stringify(await computer.page.evaluate(()=>({state:document.body.dataset,runtime:window.FC.applicationStartup?.inspect(),authCalls:window.authCalls}))))}
 assert.equal(await computer.page.evaluate(pid=>window.FC.projectStore.getById(pid).title,pid),'Offline durable revision');
 assert.equal(await computer.page.evaluate(()=>window.FC.applicationStartup.inspect().state),'offline');
 assert.equal(await computer.page.evaluate(()=>window.authCalls),0);
 assert.equal(await computer.page.evaluate(()=>window.normalGoogleLogins||0),0);
 await offlineCDP.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await offlineCDP.send('Network.overrideNetworkState',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await offlineCDP.detach();
 await computer.page.waitForFunction(()=>window.normalConnectionEpoch>0&&window.FC.applicationStartup.inspect().stage==='ready');
 await until(async()=>await phone.page.evaluate(pid=>window.FC.projectStore.getById(pid)?.title,pid)==='Offline durable revision');
 assert.equal(await computer.page.evaluate(()=>window.normalGoogleLogins||0),0,'Reconnect restores the approved SDK session, without a Google popup');
 // Preserve source copies even when the authoritative image changes.
 assert.deepEqual(await phone.page.evaluate(()=>({projects:readNormalSource('fc_projects_v1'),investors:readNormalSource('fc_investors_v1')})),source);
 assert.notEqual(await phone.page.evaluate(()=>readNormalSource('fc_sheets_v1')),await phone.page.evaluate(()=>localStorage.getItem('fc_sheets_v1')));
 // Manual logout offline seals every writer and removes the SDK login,
 // while keeping the authoritative image and the original source copy.
 await computer.page.context().setOffline(true);await computer.page.click('#main-signout');
 await computer.page.waitForFunction(()=>!window.__FC_MAIN_ACCESS__.isValid()&&window.normalConnections[0].auth.currentUser===null);
 await assert.rejects(computer.page.evaluate(()=>localStorage.getItem('fc_projects_v1')),/AUTH_ACCESS_REVOKED/);
 assert.equal(await computer.page.evaluate(()=>!!window.FC.applicationWrite),false);
 const retained=await computer.page.evaluate(async()=>{const {openLocalFirstStore}=await import('/sync/local-first-idb.mjs');const binding=JSON.parse(readNormalSource('meble_application_authority_v1'));const store=await openLocalFirstStore({...binding,initialize:false,indexedDB,locks:navigator.locks});try{return JSON.parse((await store.readApplication()).rows.fc_projects_v1).map(p=>p.title);}finally{store.close();}});
 assert.ok(retained.includes('Offline durable revision'));
 console.log('NORMAL STARTUP E2E PASS: two browser-owned coordinators; 14 domains, owned cabinet/offer, Save/Cancel, editor refusal/handover, same-window offline return and cold IDB recovery');
}
