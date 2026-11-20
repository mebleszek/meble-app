// Full normal startup in two native profiles. No Node proxy for the synchronizer.
import assert from 'node:assert/strict';
import fs from 'node:fs';import {fileURLToPath} from 'node:url';import os from 'node:os';import path from 'node:path';import http from 'node:http';
import {createRequire} from 'node:module';
import {chromium} from 'playwright-core';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,query,limit,updateDoc,deleteDoc,serverTimestamp,writeBatch} from 'firebase/firestore';
import {model,runtime} from './cloud-sync-fixture.mjs';
const require=createRequire(import.meta.url),{waitForGesturePoint,finishPendingTouchScroll,observeGesture}=require('../helpers/browser-test-readiness.js'),{startBrowser}=require('../helpers/chromium-runtime.js'),{injection}=require('../trusted-session-browser-smoke.js');
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url))),defaultUid='synthetic-phone-owner';
export async function runNormalApplication(t,{deployment=false,catalogCutover=false,runUi,p0bDemo=false,p0bRegistry=false,startupProbe,testOwner=defaultUid}={}){
 const uid=testOwner,authInjection='window.testAccount='+JSON.stringify(testOwner)+';\n'+injection;
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:18080');assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:19099');
 const original=fs.readFileSync(path.join(root,'tools/firebase-pilot/firestore.rules'),'utf8'),fragment=fs.readFileSync(path.join(root,'sync/local-first-project.rules'),'utf8');
 const rules=p0bRegistry?require('./p0b-application-rules.js').p0bApplicationRules({normal:true}):p0bDemo?require('./p0b-application-rules.js').p0bApplicationRules():deployment?require('./application-rules.js').applicationRules():original.replace('    match /{document=**}',()=>fragment+'\n    match /{document=**}');
 const env=await initializeTestEnvironment({projectId:'demo-meble-app',firestore:{host:'127.0.0.1',port:18080,rules}});
 const response=await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/projects/demo-meble-app/accounts:batchCreate',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer owner'},body:JSON.stringify({allowOverwrite:true,users:[{localId:uid,email:uid+'@example.invalid',emailVerified:true,providerUserInfo:[{providerId:'google.com',rawId:uid,email:uid+'@example.invalid'}]}]})});assert.equal(response.ok,true);
 await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'authorizedUsers',uid),{appEnabled:true,enabled:false,globalDataEnabled:true,globalSchemaVersion:1});await setDoc(doc(c.firestore(),'appAccess',uid),{schemaVersion:1});if(deployment||p0bDemo||p0bRegistry){await setDoc(doc(c.firestore(),'syncConfig','owner'),{ownerUid:uid,activationId:'synthetic-deployment',schemaVersion:1});await setDoc(doc(c.firestore(),'syncAccess',uid),{activationId:'synthetic-deployment',schemaVersion:1});}});
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
 const catalogs=model();for(const ref of ['laminat TEST','laminat','TEST','HDF',...(p0bRegistry?['HDF 3mm biała']:[])])if(!catalogs.materials.some(r=>[r.id,r.name,r.materialType].includes(ref)))catalogs.materials.push({id:'normal-material-'+catalogs.materials.length,name:ref,materialType:'synthetic',price:12.375,priceUnit:'sheet'});
 const sources=runtime().FC.globalDataContract.sources;
 let releaseSlot=null;if(deployment){const keys=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']),publicKeySpki=new Uint8Array(await crypto.subtle.exportKey('spki',keys.publicKey));const {canonical,digest}=await import('../../sync/local-first-values.mjs');const decision={domain:'MEBLE_APPLICATION_DEPLOYMENT_V1',protocol:p0bRegistry?3:2,...(p0bRegistry?{registry:'p0b-rooms-v1',legacyDataPolicy:'preserve-outside-registry'}:{}),projectId:'demo-meble-app',database:'(default)',profile:p0bRegistry?'business-room-v1':'business-project-v1',globalDomains:14,ownerUid:uid,activationId:'synthetic-deployment',origin:origin+'/',migrationApproved:true,sourcePreserved:true,rulesApproved:true,rulesSha256:await digest(rules)};releaseSlot={envelope:{decision,publicKeySpki:[...publicKeySpki],signature:[...new Uint8Array(await crypto.subtle.sign('Ed25519',keys.privateKey,new TextEncoder().encode(canonical(decision))))]},trustedKeySha256:Buffer.from(await crypto.subtle.digest('SHA-256',publicKeySpki)).toString('hex')};}
 async function login(d){await d.page.evaluate(()=>window.normalReleaseReady);await d.page.click('#auth-google');try{await d.page.waitForFunction(()=>['ready'].includes(document.body.dataset.businessState)||['profile-pending','error'].includes(document.body.dataset.authState));}catch(error){throw Error('Login phase '+JSON.stringify(await d.page.evaluate(()=>({state:document.body.dataset,phase:window.FC.applicationStartup?.inspect(),connectionError:window.normalConnectionError,rpc:window.normalRpcTimeline,pendingRpc:window.normalPendingRpc,sdkErrors:window.normalSdkErrors,held:window.normalHeldRead===true}))));}
  if(await d.page.evaluate(()=>document.body.dataset.authState==='error')){
   const evidence=await d.page.evaluate(async name=>{
    const status={state:{...document.body.dataset},error:document.getElementById('auth-error')?.textContent};
    if(window.FC.applicationStartup.inspect().code!=='LF_P0B_BINDING_UNCONFIRMED')return status;
    const {applicationKeys}=await import('/sync/application-authority.mjs'),{digest,equal}=await import('/sync/local-first-values.mjs');
    const source=Object.fromEntries(applicationKeys(window.FC).map(key=>[key,window.readNormalSource(key)]));
    const q=indexedDB.open('meble-lf-test-normal-'+name,1);
    const db=await new Promise((resolve,reject)=>{q.onupgradeneeded=()=>q.transaction.abort();q.onerror=()=>reject(q.error);q.onsuccess=()=>resolve(q.result);});
    try{const tx=db.transaction(['control','protected'],'readonly'),control=tx.objectStore('control');
     const requests={binding:control.get('binding'),image:control.get('application'),marker:control.get('p0b-registry'),archive:tx.objectStore('protected').get('p0b-previous-registry')};
     const values=await new Promise((resolve,reject)=>{tx.onabort=()=>reject(tx.error);tx.oncomplete=()=>resolve(Object.fromEntries(Object.entries(requests).map(([key,q])=>[key,q.result])));});
     const {binding,image,marker,archive}=values,preserved=archive&&JSON.parse(archive.json);
     return {...status,bindingEvidence:{schema:[...db.objectStoreNames],binding,marker,imagePresent:!!image,
      imageHash:!!image&&await digest(image.rows)===image.hash,archivePresent:!!archive,archiveHash:!!archive&&await digest(archive.json)===archive.hash,
      archiveKind:preserved?.kind,archiveRegistry:preserved?.registry,archiveScope:archive?.scope,
      changedSourceKeys:preserved?.sourceRows&&Object.keys(source).filter(key=>!equal(source[key],preserved.sourceRows[key]??null))}};
    }finally{db.close();}
   },d.name);
   throw Error('Normal startup refused '+JSON.stringify(evidence));
  }
  if(await d.page.locator('#auth-profile-admission').isVisible()){await d.page.check('#auth-profile-backup');await d.page.check('#auth-profile-owner');await d.page.click('#auth-profile-confirm');}
  try{await d.page.waitForFunction(()=>document.body.dataset.businessState==='ready');}catch(error){throw Error(error.message+' '+JSON.stringify(await d.page.evaluate(()=>({state:document.body.dataset,error:document.getElementById('auth-error')?.textContent,app:document.getElementById('app-error-msg')?.textContent}))));}}
 async function device(name){
  const owner=await startBrowser({profileDir:path.join(dir,name)}),browser=await chromium.connectOverCDP(owner.endpoint),page=browser.contexts()[0].pages()[0];
  const d={owner,browser,page,name};devices.push(d);await page.addInitScript({content:authInjection});if(deployment&&name==='computer'){await configure(d);await page.goto(origin+'/index.html');await login(d);return d;}await page.goto(origin+'/index.html');await login(d);
  await page.evaluate(({catalogs,sources})=>{for(const [domain,value]of Object.entries(catalogs))for(const key of sources[domain])localStorage.setItem(key,JSON.stringify(domain==='stock'?{sheets:value}:value));},{catalogs,sources});
  await page.evaluate(()=>window.FC.offlineShell.prepare());return d;
 }
 const touchSessions=new WeakMap();
 async function touch(d,selector){
  const page=d.page,evaluate=code=>page.evaluate(code);
  let cdp=touchSessions.get(page);
  if(!cdp){
   cdp=await page.context().newCDPSession(page);
   await cdp.send('Emulation.setDeviceMetricsOverride',{width:d.name==='phone'?393:1024,height:852,deviceScaleFactor:1,mobile:d.name==='phone'});
   await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});
   // Detaching a CDP session while offline emits a spurious online event
   // even though Playwright still blocks HTTP. Keep it until the page closes.
   touchSessions.set(page,cdp);
  }
  await evaluate('('+finishPendingTouchScroll.toString()+')()');
  await evaluate('window.normalGesture=('+observeGesture.toString()+')('+JSON.stringify(selector)+')');
  try{const p=await waitForGesturePoint(evaluate,selector,{stable:true});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,radiusX:3,radiusY:3,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   const trace=await evaluate('window.normalGesture.snapshot()');for(const type of ['pointerdown','pointerup'])assert.equal(trace.events.filter(e=>e.type===type&&e.trusted&&e.onTarget).length,1);
  }finally{await evaluate('window.normalGesture.close();delete window.normalGesture');}
 }
 if(catalogCutover){
  const pixel=await device('computer');
  const selected=await pixel.page.evaluate(()=>{
   const c=window.FC.globalDataContract;
   return c.capture(localStorage,Object.keys(c.schemas)).model;
  });
  const previous=structuredClone(selected);
  previous.materials[0].price+=1;
  const contract=runtime().FC.globalDataContract;
  const base=await contract.pack(uid,previous),next=await contract.pack(uid,selected);
  const head={ownerUid:uid,version:1,generation:1,revisionId:'1'.repeat(32),directoryHash:base.directoryHash,recordCount:base.records.length};
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore(),batch=writeBatch(db);
   for(const record of base.records)batch.set(doc(db,'users',uid,'globalRecords',record.hash),record);
   batch.set(doc(db,'users',uid,'globalRevisions',head.revisionId),{...head,directory:base.directoryJson,baseGeneration:0,baseRevisionId:'',baseDirectoryHash:'',createdAt:serverTimestamp()});
   batch.set(doc(db,'users',uid,'globalData','current'),{...head,updatedAt:serverTimestamp()});
   await batch.commit();
  });
  const owner=env.authenticatedContext(uid,{email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
  const parent=doc(owner,'users',uid,'globalRevisions',head.revisionId);
  const saved=(await getDoc(parent)).data();
  const witness={previousRevision:head.revisionId,previousHash:head.directoryHash,previousCount:head.recordCount,
   pixelHash:next.directoryHash,pixelCount:next.records.length};
  await pixel.page.evaluate(witness=>sessionStorage.setItem('synthetic-catalog-cutover',JSON.stringify(witness)),witness);
  await pixel.page.reload();
  await login(pixel);
  const active=(await getDoc(doc(owner,'users',uid,'globalData','current'))).data();
  assert.equal(active.generation,2);
  assert.equal(active.directoryHash,next.directoryHash);
  for(const name of ['desktop-receiver','tablet-receiver']){
   const handle=await startBrowser({profileDir:path.join(dir,name)});
   const browser=await chromium.connectOverCDP(handle.endpoint),page=browser.contexts()[0].pages()[0];
   const receiver={owner:handle,browser,page,name};devices.push(receiver);
   await page.addInitScript({content:authInjection});
   await configure(receiver,witness);
   await page.goto(origin+'/index.html');await login(receiver);
   const view=await page.evaluate(()=>{
    const c=window.FC.globalDataContract;
    return {model:c.capture(localStorage,Object.keys(c.schemas)).model,state:window.FC.applicationStartup.inspect().state};
   });
   assert.equal(view.state,'active');
   assert.equal(Object.keys(view.model).length,14);
   assert.deepEqual(view.model,selected);
  }
  assert.deepEqual((await getDoc(parent)).data(),saved);
  assert.equal((await getDoc(doc(owner,'users',uid,'globalData','current'))).data().revisionId,active.revisionId);
  const counters=()=>Promise.all(devices.map(d=>d.page.evaluate(()=>({...window.normalReadBudget}))));
  await Promise.all(devices.map(d=>d.page.evaluate(()=>clearInterval(window.normalGrantTimer))));
  await Promise.all(devices.map(d=>d.page.waitForFunction(()=>!window.normalPendingRpc?.length)));
  const baseline=await counters();
  await Promise.all(devices.map(d=>d.page.evaluate(async()=>{
   if(!window.normalGrantTick)throw Error('Missing real sync-grant interval');
   for(let i=0;i<120;i++){
    await window.normalGrantTick();
    if(window.normalSdkErrors.length)throw Error(JSON.stringify(window.normalSdkErrors));
   }
  })));
  const idle=(await counters()).map((end,i)=>Object.fromEntries(Object.entries(end).map(([k,v])=>[k,v-(baseline[i][k]||0)])));
  console.log('Three-profile 120 idle ticks SDK counters: '+JSON.stringify(idle));
  for(const count of idle){
   assert.equal(count.auth,120);
   assert.equal(count.catalogs,0);
   assert.equal(count.projects,0);
   assert.equal(count.queries,0);
   assert.equal(count.writes,0);
  }
  return;
 }
 const phone=await device('phone');
 const ids=await phone.page.evaluate(seedE1=>{
  const a=window.FC.investors.create({name:'Normal A'}),b=window.FC.investors.create({name:'Normal B'});
  if(!a||!b)throw Error('Native source creation refused');
  if(seedE1){
   const investors=window.FC.storage.getJSON('fc_investors_v1',[]);
   for(const investor of investors)investor.futureOwnedField={exact:13.125};
   if(!window.FC.storage.setJSON('fc_investors_v1',investors))throw Error('Investor fixture refused');
  }
  return [a.id,b.id];
 },!!runUi);
 const first=await phone.page.evaluate(()=>JSON.parse(localStorage.getItem('fc_projects_v1')));
 const pid=first.find(p=>p.investorId===ids[0]).id;
 const {room,room2}=await phone.page.evaluate(async({pid,iid,seedLegacyOffer})=>{
  const fc=window.FC;if(await fc.actions.dispatch('open-investor',{element:{getAttribute:()=>iid}})!==true)throw Error('Fixture activation refused');
  const made=fc.roomRegistry._debug.createRoomRecord(fc.investors.getById(iid),{baseType:'kuchnia',name:'Normal kitchen'});if(!made.ok)throw Error('Fixture room refused');
  const second=seedLegacyOffer?null:fc.roomRegistry._debug.createRoomRecord(fc.investors.getById(iid),{baseType:'kuchnia',name:'Normal second kitchen'});
  if(second&&!second.ok)throw Error('Second fixture room refused');
  const row=fc.projectStore.getById(pid);row.projectData.meta.futureOwnedField={exact:7.125};
  row.projectData[made.room.id].cabinets=[{id:'normal-cabinet',type:'stojąca',subType:'standardowa',width:60.125,height:82,depth:51,frontCount:2,bodyColor:'laminat TEST',frontMaterial:'laminat',frontColor:'TEST',backMaterial:'HDF',bodyPcvMode:'body',details:{shelves:3}}];
  window.projectData=row.projectData;
  fc.cabinetFronts.generateFrontsForCabinet(made.room.id,row.projectData[made.room.id].cabinets[0]);
  fc.layoutState.ensureLayout(made.room.id);
  if(second){
   const id=second.room.id;
   row.projectData[id].cabinets=[{...structuredClone(row.projectData[made.room.id].cabinets[0]),id:'normal-second-cabinet',width:65}];
   fc.cabinetFronts.generateFrontsForCabinet(id,row.projectData[id].cabinets[0]);
   fc.layoutState.ensureLayout(id);
  }
  row.projectData=window.projectData;
  if(!fc.projectStore.upsert(row))throw Error('Fixture cabinet refused');window.projectData=fc.project.load();
  if(seedLegacyOffer&&!fc.storage.setJSON('fc_quote_snapshots_v1',[{id:'normal-offer',project:{id:pid},investor:{id:iid},frozen:{total:21.375,pcv:0.8125}}]))throw Error('Fixture history refused');
  return {room:made.room.id,room2:second?.room.id};
 },{pid,iid:ids[0],seedLegacyOffer:!runUi});
 const source=await phone.page.evaluate(()=>({projects:localStorage.getItem('fc_projects_v1'),investors:localStorage.getItem('fc_investors_v1')}));
 assert.equal(JSON.parse(source.projects).length,2);
 let computer;if(!deployment)computer=await device('computer');
 async function configure(d,receiverWitness){
  await d.page.addInitScript(({uid,name,releaseSlot,catalogCutover,receiverWitness,p0bRegistry})=>{const raw=Storage.prototype.getItem;window.readNormalSource=key=>raw.call(localStorage,key);const prepare=()=>{
   const emulatorCatalogWitness=receiverWitness||JSON.parse(sessionStorage.getItem('synthetic-catalog-cutover')||'null');
   const config={p0bDemo:p0bRegistry&&!releaseSlot,name:'meble-lf-test-normal-'+name,async connections(input){
    try{const [app,auth,f]=await Promise.all([import('/__sdk/firebase-app.js'),import('/__sdk/firebase-auth.js'),import('/__sdk/firebase-firestore.js')]);
    const budget=window.normalReadBudget??={documents:0,catalogRecords:0,transactions:0,attempts:0,queries:0,writes:0,auth:0,catalogs:0,projects:0};
    const countRead=ref=>{
     budget.documents++;
     if(/^(syncAccess|appAccess)\//.test(ref.path))budget.auth++;
     if(/\/global(?:Data|Records|Revisions)\//.test(ref.path))budget.catalogs++;
     if(ref.path.includes('/globalRecords/'))budget.catalogRecords++;
     if(/\/localFirst(?:Projects|Editors)\//.test(ref.path))budget.projects++;
    };
    const measured={...f,
     async setDoc(ref,value,...args){
      const result=await f.setDoc(ref,value,...args);
      if(ref.path.includes('/p0bRoomQuotes/')&&ref.parent.id==='chunks'&&window.normalPauseQuoteChunk){
       window.normalPauseQuoteChunk=false;window.normalQuoteChunkStaged={path:ref.path,index:value.index};
       await new Promise(resolve=>window.normalContinueQuoteChunk=resolve);
      }
      return result;
     },
     getDocFromServer(ref){countRead(ref);return f.getDocFromServer(ref);},
     async getDocsFromServer(query){budget.queries++;const rows=await f.getDocsFromServer(query);budget.documents+=rows.size;return rows;},
     runTransaction(db,run,options,rpc){budget.transactions++;let quoteHeadWrite=false,roomHeadWrite=null;return f.runTransaction(db,tx=>{
      budget.attempts++;
      return run({
       get(ref){countRead(ref);const collection=ref.parent.id;if(rpc&&!rpc.collections.includes(collection))rpc.collections.push(collection);return tx.get(ref);},
       set(...args){budget.writes++;if(args[0]?.parent?.id==='p0bRoomQuotes')quoteHeadWrite=true;if(args[0]?.parent?.id==='p0bRoomProjects')roomHeadWrite=args[0].id;return tx.set(...args);}
      });
     },options).then(async value=>{
      if(roomHeadWrite&&window.normalHoldStatusHead===roomHeadWrite){window.normalHoldStatusHead=null;window.normalStatusHeadCommitted=true;await new Promise(resolve=>window.normalReleaseStatusHead=resolve);}
      // Lose delivery only AFTER the real emulator head transaction commits.
      if(quoteHeadWrite&&window.normalLoseQuoteAck){window.normalLoseQuoteAck=false;window.normalQuoteHeadCommitted=true;await new Promise(resolve=>window.normalReleaseQuoteAckLoss=resolve);throw Object.assign(Error('LF_TEST_QUOTE_ACK_LOST'),{code:'LF_TEST_QUOTE_ACK_LOST'});}
      return value;
     });}
    };
    const errors=window.normalSdkErrors=[];const observed={...measured};for(const key of ['runTransaction','getDocFromServer','getDocsFromServer'])observed[key]=(...args)=>{const began=performance.now(),pending=window.normalPendingRpc||(window.normalPendingRpc=[]),rpc={method:key,app:args[0]?.app?.name,collections:[]};pending.push(rpc);let result;try{result=key==='runTransaction'?measured[key](args[0],args[1],args[2],rpc):measured[key](...args);}catch(error){pending.splice(pending.indexOf(rpc),1);throw error;}const completed=()=>{pending.splice(pending.indexOf(rpc),1);const log=window.normalRpcTimeline||(window.normalRpcTimeline=[]);log.push({...rpc,ms:Math.round(performance.now()-began)});if(log.length>12)log.shift();};result.then(completed,completed);result.catch(error=>{errors.push({method:key,code:error.code,message:error.message,stack:error.stack});if(errors.length>6)errors.shift();});if(key==='runTransaction'&&window.holdOldReader===args[0]?.app?.name&&!window.normalReadArmed){window.normalReadArmed=true;return result.then(value=>{window.normalHeldRead=true;return new Promise(resolve=>window.releaseOldRead=()=>resolve(value));});}return result;};
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
    const setIntervalOriginal=window.setInterval;
    if(catalogCutover)window.setInterval=(fn,ms,...args)=>{
     const timer=setIntervalOriginal.call(window,fn,ms,...args);
     if(ms===30000){window.normalGrantTick=fn;window.normalGrantTimer=timer;}
     return timer;
    };
    let connections;
    try{connections=await createApplicationConnections({window,authSession:session,lease,release:input.release,sdk:{app,auth,firestore:observed},
      localAccess:{...input.localAccess,firebaseConfig:config,target:'emulator',emulator:{host:'127.0.0.1',port:19099,firestorePort:18080}}});}
    finally{window.setInterval=setIntervalOriginal;}
    for(const conn of [connections.writer,connections.reader]){const assert=conn.assertAccess;conn.assertAccess=()=>{try{return assert();}catch(error){errors.push({method:'assertAccess',code:error.code,message:error.message,stack:error.stack});if(errors.length>6)errors.shift();throw error;}};}
    window.normalConnections=[connections.writer,connections.reader];window.normalConnectionEpoch=(window.normalConnectionEpoch||0)+1;
    return connections;
   }catch(error){window.normalConnectionError={name:error.name,code:error.code,message:error.message,stack:error.stack};throw error;}
   }};
   if(catalogCutover)Object.assign(config,{localOnly:!emulatorCatalogWitness,firstCatalogSync:!!emulatorCatalogWitness,emulatorCatalogWitness});
   if(releaseSlot){config.envelope={...releaseSlot.envelope,publicKeySpki:new Uint8Array(releaseSlot.envelope.publicKeySpki),signature:new Uint8Array(releaseSlot.envelope.signature)};config.trustedKeySha256=releaseSlot.trustedKeySha256;window.normalReleaseReady=window.FC.applicationStartup.configureReleaseEmulator(config);}else window.FC.applicationStartup.configureEmulator(config);
  };if(releaseSlot){const fc=window.FC=window.FC||{};Object.defineProperty(fc,'applicationStartup',{configurable:true,set(value){Object.defineProperty(fc,'applicationStartup',{configurable:true,writable:true,value});prepare();}});}else document.addEventListener('DOMContentLoaded',prepare,{once:true});},{uid,name:d.name,releaseSlot,catalogCutover,receiverWitness,p0bRegistry});
 }
 async function enable(d){await configure(d);await d.page.reload();await login(d);}
 async function restartProbe(d,{crash=false}={}){
  if(crash)await d.owner.crash();else{const shutdown=await d.browser.newBrowserCDPSession();await shutdown.send('Browser.close');assert.equal((await d.owner.exited).code,0);await d.owner.close();}
  await d.browser.close().catch(()=>{});
  d.owner=await startBrowser({profileDir:path.join(dir,d.name)});d.browser=await chromium.connectOverCDP(d.owner.endpoint);
  const context=d.browser.contexts()[0];d.page=context.pages()[0];for(const page of context.pages())if(page!==d.page)await page.close();
  await d.page.addInitScript({content:authInjection});await configure(d);await d.page.goto(origin+'/index.html');await login(d);
 }
 if(startupProbe)return startupProbe({phone,computer,device,configure,login,restartProbe,env,source,ownerUid:uid,touch,until});
 await enable(phone);const ownerClient=env.authenticatedContext(uid,{email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
 const beforeReceiver=deployment?(await getDoc(doc(ownerClient,'users',uid,'globalData','current'))).data():null;
 if(deployment)computer=await device('computer');else await enable(computer);
 if(deployment)assert.equal((await getDoc(doc(ownerClient,'users',uid,'globalData','current'))).data().revisionId,beforeReceiver.revisionId,'Empty device must never publish defaults over the server');
 async function until(check){for(let i=0;i<200;i++){if(await check())return;await new Promise(r=>setTimeout(r,25));}throw Error('Normal replication timeout '+JSON.stringify(await Promise.all(devices.map(d=>d.page.evaluate(()=>({...window.FC.applicationStartup.inspect(),connectionError:window.normalConnectionError,sdkErrors:window.normalSdkErrors}))))));}
 // The receiving device may display a remote project revision before its
 // application transaction becomes idle. Wait for that boundary, invoke the
 // real navigation exactly once and require its actual list to contain the ID.
 async function openConfirmedInvestorList(d,id){
  await until(async()=>await d.page.evaluate(()=>!window.FC.applicationStartup.inspect().transactionPending));
  const observed=await d.page.evaluate(async id=>{
   const navigation=await window.FC.actions.dispatch('open-investors-list');
   const root=document.getElementById('investorsListRoot');
   const buttons=Array.from(root?.querySelectorAll('[data-action="open-investor"]')||[]);
   const status=window.FC.applicationStartup.inspect();
   return {
    refused:navigation===false,
    entry:window.uiState?.entry,
    visible:document.getElementById('investorsListView')?.style.display==='block',
    buttonPresent:buttons.some(button=>button.getAttribute('data-inv-id')===id),
    renderedInvestorIds:buttons.map(button=>button.getAttribute('data-inv-id')),
    investorKnown:!!window.FC.investors.getById(id),
    transactionPending:status.transactionPending,
    currentInvestorId:window.FC.investors.getCurrentId(),
    status
   };
  },id);
  assert.ok(!observed.refused && observed.entry==='investorsList' &&
   observed.visible && observed.buttonPresent && observed.investorKnown && !observed.transactionPending,
   'Real two-device investor-list navigation/renderer invariant: '+JSON.stringify(observed));
 }
 if(runUi){
  async function restart(d){
   const shutdown=await d.browser.newBrowserCDPSession();
   await shutdown.send('Browser.close');
   assert.equal((await d.owner.exited).code,0);
   await d.owner.close();
   d.owner=await startBrowser({profileDir:path.join(dir,d.name)});
   d.browser=await chromium.connectOverCDP(d.owner.endpoint);
   const context=d.browser.contexts()[0];
   d.page=context.pages()[0];
   for(const page of context.pages())if(page!==d.page)await page.close();
   await d.page.addInitScript({content:authInjection});
   await configure(d);
   await d.page.goto(origin+'/index.html');
   await login(d);
  }
  return runUi({phone,computer,pid,room,room2,ids,uid,ownerClient,restart});
 }
 await until(async()=>await computer.page.evaluate(ids=>ids.every(id=>!!window.FC.investors.getById(id)),ids));
 assert.equal(await computer.page.evaluate(()=>window.FC.investors.readAll().length),2);
 assert.equal(await phone.page.evaluate(()=>window.FC.applicationStartup.inspect().state),'active');
 // An incompatible second document cannot write concurrently; source is retained.
 const extra=await phone.page.context().newPage();const extraResponse=await extra.goto(origin+'/index.html');if(deployment)assert.equal(extraResponse.status(),423);
 await assert.rejects(phone.page.evaluate(()=>window.FC.applicationWrite.globals(()=>true)),/LF_OLD_WRITER_EXCLUSIVITY_UNPROVEN|LF_OTHER_APPLICATION_CLIENT/);
 await extra.close();
 await assert.rejects(phone.page.evaluate(()=>localStorage.setItem('fc_projects_v1','[]')),/LF_ASYNC_TRANSACTION_REQUIRED/);
 await assert.rejects(phone.page.evaluate(()=>window.FC.dataBackupStore.importSnapshot({})),/LF_ARCHIVE_RESTORE_PROTOCOL_REQUIRED/);
 await assert.rejects(phone.page.evaluate(id=>window.FC.investorDeletion.prepare([id]),ids[0]),/DELETE_LOCAL_FIRST_ACTIVE/);
 // No injection of authority transactions: existing registry/navigation is wrapped.
 await phone.page.evaluate(()=>window.FC.actions.dispatch('open-investors-list'));
 await touch(phone,'[data-action="open-investor"][data-inv-id="'+ids[0]+'"]');
 await phone.page.waitForFunction(id=>window.FC.investors.getCurrentId()===id&&!window.FC.applicationStartup.inspect().transactionPending,ids[0]);
 // Native repositories now use the normal application transaction entry.
 await phone.page.evaluate(pid=>window.FC.applicationWrite.project(()=>{const row=window.FC.projectStore.getById(pid);row.title='Phone revision';if(!window.FC.projectStore.upsert(row))throw Error('Project write refused');}),pid);
 await until(async()=>await computer.page.evaluate(pid=>window.FC.projectStore.getById(pid)?.title,pid)==='Phone revision');
 await openConfirmedInvestorList(computer,ids[0]);
 await computer.page.locator('[data-action="open-investor"][data-inv-id="'+ids[0]+'"]').click();
 await computer.page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending);
 await assert.rejects(computer.page.evaluate(()=>window.FC.applicationWrite.project(()=>true)),/LF_EDITOR_BUSY_OR_HEAD_CHANGED/);
 await phone.page.evaluate(()=>window.FC.actions.dispatch('open-investors-list'));
 await until(async()=>{
  const editor=(await getDoc(doc(ownerClient,'users',uid,'localFirstEditors',pid))).data();
  return editor?.active===false;
 });
 await openConfirmedInvestorList(computer,ids[0]);
 await computer.page.locator('[data-action="open-investor"][data-inv-id="'+ids[0]+'"]').click();
 await computer.page.waitForFunction(id=>window.FC.investors.getCurrentId()===id&&!window.FC.applicationStartup.inspect().transactionPending,ids[0]);
 await computer.page.evaluate(pid=>window.FC.applicationWrite.project(()=>{const row=window.FC.projectStore.getById(pid);row.title='Computer revision';if(!window.FC.projectStore.upsert(row))throw Error('Project write refused');}),pid);
 await until(async()=>await phone.page.evaluate(pid=>window.FC.projectStore.getById(pid)?.title,pid)==='Computer revision');
 // Explicit trusted-device admission persists only the independent SDK login;
 // local trust remains the existing WebCrypto/IDB proof, never a flag.
 await computer.page.check('#main-trust-phone');
 await computer.page.waitForFunction(()=>document.getElementById('main-trust-status').textContent.startsWith('Zaufano'));
 await computer.page.waitForFunction(()=>window.normalConnections?.[0]?.db.app.name==='meble-sync-trusted-writer-v1'&&window.FC.applicationStartup.inspect().stage==='ready');
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
 const projectHead=doc(ownerClient,'users',uid,'localFirstProjects',pid);
 const beforeDraftHead=(await getDoc(projectHead)).data();
 const pendingExit=()=>computer.page.evaluate(async pid=>{
  const {openLocalFirstStore}=await import('/sync/local-first-idb.mjs');
  const binding=JSON.parse(readNormalSource('meble_application_authority_v1'));
  const store=await openLocalFirstStore({...binding,initialize:false,indexedDB,locks:navigator.locks});
  try{return await store.pendingHandover(pid);}finally{store.close();}
 },pid);
 const readDraft=(full=false)=>computer.page.evaluate(async({name,pid,room,full})=>{
  const request=indexedDB.open('meble-lf-test-normal-'+name);
  const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onupgradeneeded=()=>request.transaction.abort();});
  try{return await new Promise((resolve,reject)=>{
   const tx=db.transaction(['control','outbox'],'readonly');
   const image=tx.objectStore('control').get('application'),outbox=tx.objectStore('outbox').getAll();
   tx.onabort=()=>reject(tx.error);
   tx.oncomplete=()=>{const rows=image.result.rows;if(full){resolve({rows,outbox:outbox.result});return;}resolve({draft:JSON.parse(rows.fc_edit_session_v1),cabinets:JSON.parse(rows.fc_projects_v1).find(p=>p.id===pid).projectData[room].cabinets,outbox:outbox.result.filter(row=>row.scope===pid)});};
  });}finally{db.close();}
 },{name:computer.name,pid,room,full});
 const beforeDraft=await readDraft();
 const waitForCabinetAck=async()=>{
  await computer.page.waitForFunction(()=>!window.FC.applicationStartup.inspect().transactionPending);
  const modal=computer.page.locator('#cabinetModal');
  assert.equal(await modal.isVisible(),false,await computer.page.locator('.info-box').allTextContents());
 };
 const browserContext=computer.page.context();
 const editCabinet=async(id,width)=>{
  await computer.page.evaluate(id=>window.FC.cabinetModal.openCabinetModalForEdit(id),id);
  await computer.page.locator('#cmWidth').fill(String(width));
  await computer.page.click('#cabinetModalSave');
  await waitForCabinetAck();
 };
 await computer.page.click('#floatingAdd');
 await computer.page.locator('#cabinetTypeChoices .choice-tile').first().click();
 await computer.page.locator('#cmWidth').fill('66');
 await computer.page.locator('#cmHeight').fill('82');
 await computer.page.locator('#cmDepth').fill('50');
 await computer.page.evaluate(name=>{
  const original=IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction=function(stores,mode,...rest){
   const tx=original.call(this,stores,mode,...rest);
   if(this.name==='meble-lf-test-normal-'+name&&mode==='readwrite'&&Array.from(stores).includes('control')){
    IDBDatabase.prototype.transaction=original;
    queueMicrotask(()=>tx.abort());
   }
   return tx;
  };
 },computer.name);
 await computer.page.click('#cabinetModalSave');
 await computer.page.locator('.info-box').filter({hasText:'LF_IDB_ABORTED'}).waitFor();
 assert.equal(await computer.page.locator('#cabinetModal').isVisible(),true);
 assert.equal(await computer.page.locator('#cmWidth').inputValue(),'66');
 assert.deepEqual(await readDraft(),beforeDraft);
 assert.deepEqual((await getDoc(projectHead)).data(),beforeDraftHead);
 await computer.page.locator('.info-box .is-success').click();
 await computer.page.click('#cabinetModalSave');
 await waitForCabinetAck();
 const added=await readDraft();
 assert.equal(added.cabinets.length,beforeDraft.cabinets.length+1);
 assert.deepEqual(added.outbox,beforeDraft.outbox);
 assert.deepEqual((await getDoc(projectHead)).data(),beforeDraftHead);
 t.diagnostic('P0-A: add and forced IDB abort passed with exact local image/outbox and remote head checks');
 const addedId=added.cabinets.at(-1).id;
 await computer.page.evaluate(id=>{void window.FC.cabinetActions.deleteCabinetById(id);},addedId);
 await computer.page.locator('.confirm-box .is-danger').click();
 await computer.page.waitForFunction(length=>window.projectData[window.uiState.roomType].cabinets.length===length&&!window.FC.applicationStartup.inspect().transactionPending,beforeDraft.cabinets.length);
 const deleted=await readDraft();
 assert.ok(!deleted.cabinets.some(c=>c.id===addedId));
 assert.deepEqual(deleted.outbox,beforeDraft.outbox);
 t.diagnostic('P0-A: delete passed in IDB without new outbox entry');
 await browserContext.setOffline(true);
 await computer.page.waitForFunction(()=>!navigator.onLine);
 await editCabinet('normal-cabinet',64);
 const edited=await readDraft();
 assert.equal(edited.cabinets[0].width,64);
 assert.equal(edited.draft.active,true);
 assert.deepEqual(edited.outbox,beforeDraft.outbox);
 t.diagnostic('P0-A: offline edit passed in IDB without new outbox entry');
 const version=await computer.page.evaluate(()=>window.normalConnectionEpoch);
 await computer.page.context().setOffline(false);
 await computer.page.waitForFunction(version=>window.normalConnectionEpoch>version&&window.FC.applicationStartup.inspect().stage==='ready',version);
 assert.deepEqual((await getDoc(projectHead)).data(),beforeDraftHead);
 assert.deepEqual((await readDraft()).outbox,beforeDraft.outbox);
 await computer.page.evaluate(room=>{window.projectData[room].settings.roomHeight=299.25;window.FC.views.refreshSessionButtons();},room);
 await computer.page.click('#sessionCancel');await computer.page.locator('.confirm-box .is-danger').click();
 await computer.page.waitForFunction(room=>window.FC.session.active&&window.projectData[room].settings.roomHeight===287.125&&!window.FC.applicationStartup.inspect().transactionPending,room);
 assert.equal(await computer.page.evaluate(()=>localStorage.getItem('fc_projects_v1')),approved);
 assert.deepEqual((await readDraft()).outbox,beforeDraft.outbox);
 t.diagnostic('P0-A: Cancel restored the approved project and preserved outbox');
 await browserContext.setOffline(true);
 await computer.page.waitForFunction(()=>!navigator.onLine);
 await editCabinet('normal-cabinet',65);
 await computer.page.click('#sessionSave');
 await computer.page.waitForFunction(()=>!window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending);
 await computer.page.locator('.info-box').filter({hasText:'Synchronizacja oczekuje na potwierdzenie.'}).waitFor();
 const savedCabinet=await readDraft();
 assert.equal(savedCabinet.draft,null);
 assert.equal(savedCabinet.cabinets[0].width,65);
 assert.equal(savedCabinet.outbox.length,beforeDraft.outbox.length+1);
 const newKey=savedCabinet.outbox.find(row=>!beforeDraft.outbox.some(old=>old.key===row.key)).key;
 t.diagnostic('P0-A: main Save committed locally with exactly one new outbox entry');
 assert.deepEqual((await getDoc(projectHead)).data(),beforeDraftHead);
 const saveEpoch=await computer.page.evaluate(()=>window.normalConnectionEpoch);
 await browserContext.setOffline(false);
 await computer.page.waitForFunction(version=>window.normalConnectionEpoch>version&&window.FC.applicationStartup.inspect().stage==='ready',saveEpoch);
 await until(async()=>(await getDoc(projectHead)).data().generation===beforeDraftHead.generation+1);
 await until(async()=>await phone.page.evaluate(({pid,room})=>window.FC.projectStore.getById(pid).projectData[room].cabinets[0].width,{pid,room})===65);
 const ack=await readDraft();
 assert.equal(ack.outbox.length,beforeDraft.outbox.length+1);
 assert.equal(ack.outbox.find(row=>row.key===newKey)?.phase,'verified');
 t.diagnostic('P0-A: same outbox operation verified after reconnect and one Firestore generation');
 await computer.page.locator('.info-box .is-success').click();
 await computer.page.click('#sessionCancel');await computer.page.waitForFunction(()=>!window.FC.session.active&&window.uiState.entry==='investorsList'&&!window.FC.applicationStartup.inspect().transactionPending);
 assert.equal(await computer.page.evaluate(id=>window.FC.actions.dispatch('open-investor',{element:{getAttribute:()=>id}}),ids[0]),true);
 if(deployment){
  await touch(computer,'.investor-room-quick-btn[data-room="'+room+'"]');
  await computer.page.waitForFunction(()=>window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending);
  const approved=await readDraft(true);
  await editCabinet('normal-cabinet',68);
  const dirty=await readDraft(true);
  const originalGeneration=(await getDoc(projectHead)).data();
  const globalHead=doc(ownerClient,'users',uid,'globalData','current');
  const oldHead=(await getDoc(globalHead)).data();
  const id='receive-after-room-exit';
  await phone.page.evaluate(id=>window.FC.applicationWrite.globals(()=>{
   const key='fc_sheet_materials_v1';
   const rows=window.FC.storage.getJSON(key);
   rows.push({id,name:id,materialType:'synthetic',price:23,priceUnit:'sheet'});
   if(!window.FC.storage.setJSON(key,rows))throw Error('Fixture catalog write refused');
  }),id);
  await until(async()=>(await getDoc(globalHead)).data().generation===oldHead.generation+1);
  const published=(await getDoc(globalHead)).data();
  const hasCatalog=()=>computer.page.evaluate(id=>window.FC.catalogStore.getSheetMaterials().some(row=>row.id===id&&row.price===23),id);
  await computer.page.waitForFunction(()=>window.FC.applicationStartup.inspect().states.some(state=>state.code==='LF_ACTIVE_RAM_PROTECTED'));
  assert.equal(await hasCatalog(),false);
  assert.deepEqual(await readDraft(true),dirty);
  assert.equal(await computer.page.locator('#sessionCancel').textContent(),'Anuluj');
  await computer.page.click('#sessionCancel');
  await computer.page.locator('.confirm-box .is-danger').click();
  await computer.page.waitForFunction(()=>window.FC.session.active&&window.FC.session.durable&&document.getElementById('sessionCancel').textContent==='Wyjdź'&&!window.FC.applicationStartup.inspect().transactionPending);
  const cancelled=await readDraft(true);
  assert.equal(cancelled.rows.fc_projects_v1,approved.rows.fc_projects_v1);
  assert.equal(cancelled.rows.fc_sheet_materials_v1,approved.rows.fc_sheet_materials_v1);
  assert.deepEqual(cancelled.outbox,approved.outbox);
  assert.equal(await hasCatalog(),false);
  await computer.page.click('#sessionCancel');
  await computer.page.waitForFunction(()=>!window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending);
  await until(hasCatalog);
  const received=await readDraft(true);
  assert.ok(JSON.parse(received.rows.fc_sheet_materials_v1).some(row=>row.id===id&&row.price===23));
  for(const key of ['fc_projects_v1','fc_investors_v1','fc_quote_snapshots_v1'])assert.equal(received.rows[key],approved.rows[key],key);
  assert.deepEqual(received.outbox,approved.outbox);
  assert.deepEqual((await getDoc(globalHead)).data(),published);
  assert.deepEqual((await getDoc(projectHead)).data(),originalGeneration);
  t.diagnostic('P0-A: active RAM refused catalog receive; Anuluj restored data; Wyjdź applied catalogs automatically without publication');
  assert.equal(await computer.page.evaluate(id=>window.FC.actions.dispatch('open-investor',{element:{getAttribute:()=>id}}),ids[0]),true);
 }
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
 await until(async()=>await computer.page.evaluate(()=>window.FC.storage.getJSON('fc_quote_rates_v1')[0].price===47.125&&window.FC.catalogStore.getQuoteRates()[0].price===47.125));
 for(const d of [phone,computer])assert.equal(await d.page.evaluate(()=>localStorage.getItem('fc_quote_rates_v1')===localStorage.getItem('fc_services_v1')),true);
 const expectedCatalogs=structuredClone(catalogs);if(deployment)expectedCatalogs.materials.push({id:'receive-after-room-exit',name:'receive-after-room-exit',materialType:'synthetic',price:23,priceUnit:'sheet'});expectedCatalogs.stock[0].qty=29;expectedCatalogs.labor[0].price=47.125;
 for(const d of [phone,computer])assert.equal(await d.page.evaluate(()=>window.FC.catalogStore.getQuoteRates()[0].price),47.125,'Live catalog reader refreshed');
 for(const d of [phone,computer])assert.deepEqual(await d.page.evaluate(()=>window.FC.globalDataContract.capture(localStorage,Object.keys(window.FC.globalDataContract.schemas)).model),expectedCatalogs,'Every value in all fourteen domains, not just their presence');
 assert.deepEqual(await computer.page.evaluate(pid=>window.FC.projectStore.getById(pid),pid),await phone.page.evaluate(pid=>window.FC.projectStore.getById(pid),pid),'Whole owned record, stable identifiers and unknown fields');


 // A new explicit Save may use newly confirmed catalogs; old immutable offers stay frozen.
 if(deployment){
  await phone.page.evaluate(()=>window.FC.applicationWrite.globals(()=>{const rows=window.FC.catalogStore.getSheetMaterials();rows.push({id:'confirmed-new-material',name:'Confirmed new material',materialType:'synthetic',price:17.875,priceUnit:'sheet'});if(!window.FC.catalogStore.savePriceList('materials',rows))throw Error('Catalog save refused');}));
  await until(async()=>await computer.page.evaluate(()=>window.FC.catalogStore.getSheetMaterials().some(r=>r.id==='confirmed-new-material')));
  await computer.page.evaluate(({pid,room})=>window.FC.applicationWrite.project(()=>{const row=window.FC.projectStore.getById(pid);row.projectData[room].cabinets[0].bodyColor='confirmed-new-material';if(!window.FC.projectStore.upsert(row))throw Error('New dependency save refused');}),{pid,room});
  await until(async()=>await phone.page.evaluate(({pid,room})=>window.FC.projectStore.getById(pid).projectData[room].cabinets[0].bodyColor,{pid,room})==='confirmed-new-material');
  for(const d of [phone,computer])assert.equal(await d.page.evaluate(()=>window.FC.storage.getJSON('fc_quote_snapshots_v1')[0].frozen.total),21.375);
 }


 assert.equal(await computer.page.locator('.info-backdrop').count(),0,'No failed navigation or premature handover notice '+await computer.page.locator('.info-box__title').allTextContents());
 await computer.page.evaluate(pid=>window.FC.applicationWrite.project(()=>{const row=window.FC.projectStore.getById(pid);row.title='Online approved';if(!window.FC.projectStore.upsert(row))throw Error('Editor reservation refused');}),pid);
 await until(async()=>await phone.page.evaluate(pid=>window.FC.projectStore.getById(pid)?.title,pid)==='Online approved');
 const beforeOfflineHead=(await getDoc(doc(ownerClient,'users',uid,'localFirstProjects',pid))).data();
 if(deployment){await computer.page.evaluate(()=>{window.holdOldReader=window.normalConnections[1].db.app.name;dispatchEvent(new Event('meble-sync-authorized'));});await computer.page.waitForFunction(()=>window.normalHeldRead===true);}
 await computer.page.context().setOffline(true);await computer.page.waitForFunction(()=>navigator.onLine===false);
 await computer.page.evaluate(pid=>window.FC.applicationWrite.project(()=>{const r=window.FC.projectStore.getById(pid);r.title='Same-window offline';if(!window.FC.projectStore.upsert(r))throw Error('Offline refused');}),pid);
 const previousConnection=await computer.page.evaluate(()=>window.normalConnectionEpoch);
 await computer.page.context().setOffline(false);
 if(deployment){await computer.page.waitForFunction(previous=>window.normalConnectionEpoch>previous,previousConnection);assert.equal(await computer.page.evaluate(()=>window.FC.applicationStartup.inspect().stage),'reconnect-runtime','A new SDK must not report ready while the old read is still in flight');await computer.page.evaluate(()=>window.releaseOldRead());}
 await computer.page.waitForFunction(previous=>window.normalConnectionEpoch>previous&&window.FC.applicationStartup.inspect().stage==='ready',previousConnection);
 await until(async()=>await phone.page.evaluate(pid=>window.FC.projectStore.getById(pid)?.title,pid)==='Same-window offline');
 assert.equal((await getDoc(doc(ownerClient,'users',uid,'localFirstProjects',pid))).data().generation,beforeOfflineHead.generation+1,'Exactly one committed project WRITE across reconnect');
 await computer.page.context().setOffline(true);
 await computer.page.waitForFunction(()=>navigator.onLine===false);
 await computer.page.evaluate(pid=>window.FC.applicationWrite.project(()=>{
  const row=window.FC.projectStore.getById(pid);
  row.title='Offline durable revision';
  if(!window.FC.projectStore.upsert(row))throw Error('Offline write refused');
  window.projectData=window.FC.project.load();
 }),pid);
 assert.equal(await phone.page.evaluate(pid=>window.FC.projectStore.getById(pid).title,pid),'Same-window offline');
 assert.equal(await computer.page.evaluate(()=>window.FC.actions.dispatch('open-investors-list')),true,'Offline Exit commits locally');
 await computer.page.waitForFunction(()=>window.uiState.entry==='investorsList'&&!window.FC.applicationStartup.inspect().transactionPending);
 assert.ok(await pendingExit(),'Offline Exit persists the intended release');
 if(deployment){
  await phone.page.evaluate(()=>window.FC.applicationWrite.globals(()=>{
   const rows=window.FC.catalogStore.getSheetMaterials();
   rows.push({id:'cold-start-newer-catalog',name:'Cold start newer catalog',materialType:'synthetic',price:19,priceUnit:'sheet'});
   if(!window.FC.catalogStore.savePriceList('materials',rows))throw Error('Catalog save refused');
  }));
  await until(async()=>{
   const head=(await getDoc(doc(ownerClient,'users',uid,'globalData','current'))).data();
   const project=(await getDoc(doc(ownerClient,'users',uid,'localFirstProjects',pid))).data();
   return head.revisionId!==project.globalRevisionId;
  });
 }
 assert.equal(await computer.page.evaluate(id=>window.FC.actions.dispatch('open-investor',{element:{getAttribute:()=>id}}),ids[0]),true);
 await touch(computer,'.investor-room-quick-btn[data-room="'+room+'"]');
 await computer.page.waitForFunction(()=>window.FC.session.active&&!window.FC.applicationStartup.inspect().transactionPending);
 assert.equal(await computer.page.evaluate(()=>navigator.onLine),false,'A touch gesture preserves the offline network controller');
 assert.equal(await pendingExit(),null,'Explicit reopening withdraws a release that never reached the server');
 const beforeRestartDraft=await readDraft();
 await editCabinet('normal-cabinet',67);
 const restartDraft=await readDraft();
 assert.equal(restartDraft.cabinets[0].width,67);
 assert.deepEqual(restartDraft.outbox,beforeRestartDraft.outbox);
 if(deployment)await computer.page.evaluate(()=>localStorage.removeItem('meble_application_authority_v1')); // Simulated cutover receipt ACK loss, source/image retained.
 const shutdown=await computer.browser.newBrowserCDPSession();await shutdown.send('Browser.close');
 const exited=await computer.owner.exited;assert.equal(exited.code,0);assert.equal(exited.signal,null);await computer.owner.close();
 await openConfirmedInvestorList(phone,ids[0]);
 await phone.page.locator('[data-action="open-investor"][data-inv-id="'+ids[0]+'"]').click();
 await phone.page.waitForFunction(id=>window.FC.investors.getCurrentId()===id&&!window.FC.applicationStartup.inspect().transactionPending,ids[0]);
 await assert.rejects(phone.page.evaluate(()=>window.FC.applicationWrite.project(()=>true)),/LF_EDITOR_BUSY_OR_HEAD_CHANGED/);
 await phone.page.evaluate(()=>window.FC.actions.dispatch('open-investors-list'));
 computer.owner=await startBrowser({profileDir:path.join(dir,computer.name)});
 computer.browser=await chromium.connectOverCDP(computer.owner.endpoint);const context=computer.browser.contexts()[0];computer.page=await context.newPage();
 for(const page of context.pages())if(page!==computer.page)await page.close();
 await computer.page.addInitScript({content:authInjection});await configure(computer);
 // One network controller owns both cold-start isolation and restoration.
 // Switching a second CDP session online can wake reconnect while transport
 // is still offline, permanently failing this document's first SDK import.
 const sdkRequests=[];
 computer.page.on('requestfailed',request=>{
  if(new URL(request.url()).pathname.startsWith('/__sdk/'))sdkRequests.push(request.failure()?.errorText);
 });
 await computer.page.addInitScript(()=>{window.normalOfflineAtBoot=navigator.onLine;});
 await context.setOffline(true);
 await computer.page.goto(origin+'/index.html');
 assert.equal(await computer.page.evaluate(()=>window.normalOfflineAtBoot),false);

 try{await computer.page.waitForFunction(()=>document.body.dataset.businessState==='ready');}catch(error){throw Error('Cold startup '+JSON.stringify(await computer.page.evaluate(()=>({state:document.body.dataset,runtime:window.FC.applicationStartup?.inspect(),authCalls:window.authCalls}))))}
 assert.equal(await computer.page.evaluate(pid=>window.FC.projectStore.getById(pid).title,pid),'Offline durable revision');
 if(deployment){
  const pinned=(await getDoc(doc(ownerClient,'users',uid,'localFirstProjects',pid))).data();
  const latest=(await getDoc(doc(ownerClient,'users',uid,'globalData','current'))).data();
  assert.notEqual(pinned.globalRevisionId,latest.revisionId);
  assert.equal(await computer.page.evaluate(pid=>window.FC.projectStore.getById(pid).projectData.meta.assignedInvestorId,pid),ids[0]);
 }
 assert.equal(await computer.page.evaluate(()=>window.FC.applicationStartup.inspect().state),'offline');
 assert.deepEqual(await readDraft(),restartDraft,'Cold restart must reopen the exact draft and outbox');
 assert.equal(await computer.page.evaluate(()=>window.FC.session.active&&window.FC.session.durable),true);
 t.diagnostic('P0-A: cold restart restored exact draft and outbox');
 await computer.page.click('#sessionCancel');
 await computer.page.locator('.confirm-box .is-danger').click();
 await computer.page.waitForFunction(()=>window.projectData[window.uiState.roomType].cabinets[0].width===65&&!window.FC.applicationStartup.inspect().transactionPending);
 assert.deepEqual((await readDraft()).outbox,restartDraft.outbox);
 assert.equal(await pendingExit(),null,'Cancel preserves the current editor and creates no Exit request');
 const currentEditor=doc(ownerClient,'users',uid,'localFirstEditors',pid);
 const beforeExitEditor=(await getDoc(currentEditor)).data();
 assert.equal(beforeExitEditor?.active,true);
 // Cancel reopens a clean room. Exit it before receiving newer remote catalogs.
 await computer.page.click('#sessionCancel');
 await computer.page.waitForFunction(()=>!window.FC.session.active&&window.uiState.entry==='investorsList'&&!window.FC.applicationStartup.inspect().transactionPending);
 assert.deepEqual((await readDraft()).outbox,restartDraft.outbox);
 assert.deepEqual(await pendingExit(),{key:'handover:'+pid,deviceId:beforeExitEditor.deviceId,epoch:beforeExitEditor.epoch});
 assert.deepEqual((await getDoc(currentEditor)).data(),beforeExitEditor,'Offline Exit keeps the server editor');
 assert.equal(await computer.page.evaluate(()=>window.authCalls),0);
 assert.equal(await computer.page.evaluate(()=>window.normalGoogleLogins||0),0);
 assert.deepEqual(sdkRequests,[],'Offline boot must not fail an SDK module request');
 await context.setOffline(false);
 await computer.page.waitForFunction(()=>window.normalConnectionEpoch>0&&window.FC.applicationStartup.inspect().stage==='ready').catch(async error=>{throw Error(error.message+' '+JSON.stringify(await computer.page.evaluate(()=>({online:navigator.onLine,state:window.FC.applicationStartup.inspect(),connectionError:window.normalConnectionError,pendingRpc:window.normalPendingRpc,sdkErrors:window.normalSdkErrors}))));});
 await until(async()=>await phone.page.evaluate(pid=>window.FC.projectStore.getById(pid)?.title,pid)==='Offline durable revision');
 await until(async()=>(await getDoc(currentEditor)).data()?.active===false&&await pendingExit()===null);
 assert.deepEqual(sdkRequests,[],'Reconnect SDK modules must load without network errors');
 assert.equal(await computer.page.evaluate(()=>window.normalGoogleLogins||0),0,'Reconnect restores the approved SDK session, without a Google popup');
 if(deployment){
  const foreign=env.authenticatedContext('synthetic-foreign',{email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore(),guest=env.unauthenticatedContext().firestore();
  for(const db of [foreign,guest]){
   await assertFails(getDoc(doc(db,'users',uid,'globalData','current')));
   await assertFails(getDocs(query(collection(db,'users',uid,'localFirstProjects'),limit(10))));
   await assertFails(setDoc(doc(db,'syncConfig','owner'),{ownerUid:'synthetic-foreign'}));
  }
  await assertFails(updateDoc(doc(ownerClient,'syncAccess',uid),{activationId:'forged'}));
  await assertFails(deleteDoc(doc(ownerClient,'users',uid,'localFirstProjects',pid)));
  await assertFails(getDocs(collection(ownerClient,'users',uid,'localFirstProjects')));
  const head=(await getDoc(doc(ownerClient,'users',uid,'globalData','current'))).data();
  const revision=(await getDoc(doc(ownerClient,'users',uid,'globalRevisions',head.revisionId))).data(),recordHash=Object.values(JSON.parse(revision.directory)).flat()[0].hash;
  await assertFails(updateDoc(doc(ownerClient,'users',uid,'globalRecords',recordHash),{json:'tampered'}));
  await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'syncAccess',uid),{activationId:'revoked-deployment'}));
  await assertFails(getDoc(doc(ownerClient,'users',uid,'globalData','current')));
  await assertFails(getDoc(doc(ownerClient,'syncAccess',uid)));
  assert.equal(await computer.page.evaluate(()=>window.__FC_MAIN_ACCESS__.isValid()),true,'Cloud revocation does not erase approved local data');
  for(const d of [phone,computer]){
   const original=await d.page.evaluate(async()=>{const {openLocalFirstStore}=await import('/sync/local-first-idb.mjs');const binding=JSON.parse(readNormalSource('meble_application_authority_v1')),s=await openLocalFirstStore({...binding,initialize:false,indexedDB,locks:navigator.locks});try{return (await s.readPreservedSource()).rows;}finally{s.close();}});
   assert.equal(original.fc_projects_v1,d===phone?source.projects:null);assert.equal(original.fc_investors_v1,d===phone?source.investors:null);
  }
 }
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
 if(deployment){assert.equal(await computer.page.evaluate(()=>readNormalSource('fc_projects_v1')),null,'A new device kept its empty source, without publishing it');}
 console.log('NORMAL STARTUP E2E PASS: two browser-owned coordinators; 14 domains, owned cabinet/offer, Save/Cancel, editor refusal/handover, same-window offline return and cold IDB recovery');
}
