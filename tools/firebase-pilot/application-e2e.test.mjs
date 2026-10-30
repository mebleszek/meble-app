// Targeted actual application/Chromium + IDB + Auth/Firestore Emulator Suite.
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import * as app from 'firebase/app';import * as auth from 'firebase/auth';import * as f from 'firebase/firestore';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {runtime,model,seed} from './cloud-sync-fixture.mjs';
import {createGlobalChannel,createDurableSynchronizer} from '../../sync/local-first-sync.mjs';
import {createApplicationReplication,createEmulatorProjectDiscovery} from '../../sync/application-replication.mjs';
import {createProjectChannel} from '../../sync/local-first-project.mjs';
import {proxyStore} from '../helpers/local-first-browser.mjs';
const require=createRequire(import.meta.url),{startBrowser}=require('../helpers/chromium-runtime'),{injection}=require('../trusted-session-browser-smoke');
const root=path.resolve(new URL('../..',import.meta.url).pathname);
export async function runApplicationE2E(t){
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:18080');assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:19099');
 const original=fs.readFileSync(path.join(root,'tools/firebase-pilot/firestore.rules'),'utf8');
 const fragment=fs.readFileSync(path.join(root,'sync/local-first-project.rules'),'utf8');
 assert.equal(original.split('    match /{document=**}').length,2);
 const env=await initializeTestEnvironment({projectId:'demo-meble-app',firestore:{host:'127.0.0.1',port:18080,rules:original.replace('    match /{document=**}',()=>fragment+'\n    match /{document=**}')}});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-app-e2e-')),devices=[],clients=[];let serial=0;
 const server=http.createServer((req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1'),file=path.resolve(root,'.'+url.pathname);
  if(!file.startsWith(root+path.sep))throw Error();res.setHeader('content-type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':/\.(js|mjs)$/.test(file)?'text/javascript':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.jpg')?'image/jpeg':'application/octet-stream');res.end(fs.readFileSync(file));}catch(_){res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{for(const d of devices){d.sync?.close();await d.browser?.close();await d.owner?.close();}for(const c of clients)await c.transport.close();await env.cleanup();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
 async function client(sdk=f,foreign=false){const r=runtime();for(const file of ['project/business-project-contract','cloud/cloud-pilot-contract','cloud/firebase-pilot-transport'])new Function('window',fs.readFileSync(path.join(root,'js/app/'+file+'.js'),'utf8'))(r.s);
  const h=await r.FC.firebasePilotTransport.create({target:'emulator',projectId:'demo-meble-app',appName:'e2e-'+(++serial),emulator:{host:'127.0.0.1',authPort:19099,firestorePort:18080},sdk:{app,auth,firestore:f}});clients.push(h);
  const payload=Buffer.from(JSON.stringify({sub:foreign?'synthetic-foreign-e2e':'synthetic-application-e2e',email:foreign?'foreign@example.invalid':'application@example.invalid',email_verified:true})).toString('base64url');
  await auth.signInWithCredential(h.auth,auth.GoogleAuthProvider.credential('e30.'+payload+'.'));await h.transport.ready();
  return {...h,r,uid:h.auth.currentUser.uid,connection:{...h,firestore:sdk,session:h.transport,assertAccess(){}}};}
 const a=await client(),b=await client();await env.withSecurityRulesDisabled(ctx=>f.setDoc(f.doc(ctx.firestore(),'authorizedUsers',a.uid),{appEnabled:true,enabled:false,globalDataEnabled:true,globalSchemaVersion:1}));
 async function device(name,initialRows,sdk=f,catalogs=null){
  const writer=await client(sdk),reader=await client(),owner=await startBrowser({profileDir:path.join(dir,name)});const d={owner,writer,reader};devices.push(d);const browser=await chromium.connectOverCDP(owner.endpoint),page=browser.contexts()[0].pages()[0];d.browser=browser;
  const globals=catalogs||model(),c=writer.r.FC.globalDataContract;
  const raw=initialRows||Object.fromEntries(Object.entries(globals).map(([k,v])=>[c.sources[k][0],JSON.stringify(k==='stock'?{sheets:v}:v)]));
  await page.addInitScript({content:injection.replaceAll('synthetic-phone-owner',writer.uid)});
  await page.addInitScript(rows=>{if(!localStorage.getItem('e2e-seeded')){for(const [k,v]of Object.entries(rows))localStorage.setItem(k,v);localStorage.setItem('e2e-seeded','yes');}},raw);
  await page.goto(origin+'/index.html');await page.click('#auth-google');await page.waitForFunction(()=>document.body.dataset.businessState==='ready'||document.body.dataset.authState==='profile-pending');if(await page.locator('#auth-profile-admission').isVisible()){await page.check('#auth-profile-backup');await page.check('#auth-profile-owner');await page.click('#auth-profile-confirm');}try{await page.waitForFunction(()=>document.body.dataset.businessState==='ready');}catch(e){throw Error(e.message+' '+JSON.stringify(await page.evaluate(()=>({state:document.body.dataset,error:document.getElementById('auth-error')?.textContent,app:document.getElementById('app-error-msg')?.textContent}))));}
  await page.evaluate(({globals,sources})=>{for(const [domain,value]of Object.entries(globals))for(const key of sources[domain]){if(!window.FC.storage.setJSON(key,domain==='stock'?{sheets:value}:value))throw Error('Catalog fixture setter refused');}},{globals,sources:c.sources});
  await page.evaluate(async()=>{await import('/js/app/cloud/global-data-contract.js');await import('/js/app/cloud/cloud-pilot-contract.js');await import('/js/app/project/business-project-contract.js');const {openLocalFirstStore}=await import('/sync/local-first-idb.mjs');window.openE2E=b=>openLocalFirstStore({...b,indexedDB,locks:navigator.locks}).then(s=>{window.lf=s;});});
  const binding={name:'meble-lf-test-app-'+name,ownerUid:writer.uid,deviceId:name,instanceId:name+'-instance',initialize:true};await page.evaluate(b=>window.openE2E(b),binding);
  const evaluate=expression=>page.evaluate(expression),store=proxyStore(evaluate,binding),g=createGlobalChannel({writer:writer.connection,reader:reader.connection,ownerUid:writer.uid,contract:c,factory:writer.r.FC.firebaseGlobalTransport});
  Object.assign(d,{writer,reader,owner,browser,page,store,g,binding,online:false,events:new EventTarget(),channels:[g]});return d;
 }
 async function waitFor(check){for(let i=0;i<200;i++){if(await check())return;await new Promise(r=>setTimeout(r,25));}const evidence=[];for(const d of devices){try{evidence.push({states:d.states,global:await d.store.snapshot('globals').then(s=>({qty:JSON.parse(s.replica.json).stock[0].qty,version:s.replica.version,generation:s.replica.base?.generation,operations:s.operations.map(o=>({phase:o.phase,code:o.code}))})),local:await d.page.evaluate(()=>({active:window.FC.session.active,divergent:window.FC.investorProjectRuntime.hasProjectDivergence(window.projectData),stock:window.FC.storage.getJSON('fc_sheets_v1')?.sheets?.[0]?.qty,authority:window.applicationAuthority?.status()}))});}catch(_){}}assert.fail('Automatic application replication did not complete '+JSON.stringify(evidence));}
 const phone=await device('phone');
 await phone.page.evaluate(()=>{const a=window.FC.investors.create({name:'Application Owner A'}),b=window.FC.investors.create({name:'Application Owner B'});if(!a||!b)throw Error('Fixture creation refused');});
 let rows=await phone.page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));
 const records=JSON.parse(rows.fc_projects_v1);assert.equal(records.length,2);const project=records[0],second=records[1],pid=project.id,iid=project.investorId;
 // Real domain room creation, retained unknown data and an owned frozen offer.
 const room=await phone.page.evaluate(async({pid,iid})=>{const fc=window.FC;
  if(await fc.actions.dispatch('open-investor',{element:{getAttribute:()=>iid}})!==true)throw Error('Owner activation refused');
  const made=fc.roomRegistry._debug.createRoomRecord(fc.investors.getById(iid),{baseType:'kuchnia',name:'E2E Kitchen'});if(!made.ok)throw Error('Real room operation refused');
  const row=fc.projectStore.getById(pid);row.projectData.meta.futureOwnedField={exact:7.125};row.projectData[made.room.id].cabinets=[{id:'owned-cabinet',type:'stojąca',subType:'standardowa',width:60.125,height:82,depth:51,frontCount:2,bodyColor:'laminat TEST',frontMaterial:'laminat',frontColor:'TEST',backMaterial:'HDF',bodyPcvMode:'body',details:{shelves:3}}];window.projectData=row.projectData;fc.layoutState.ensureLayout(made.room.id);row.projectData=window.projectData;
  if(!fc.projectStore.upsert(row))throw Error('Owned room persistence refused');window.projectData=fc.project.load();
  if(!fc.storage.setJSON('fc_quote_snapshots_v1',[{id:'owned-offer',project:{id:pid},investor:{id:iid},frozen:{total:21.375,pcv:0.8125}}]))throw Error('Owned history setup refused');
  return made.room.id;
 },{pid,iid});
 let computer,lossArmed=false,crashCompleted=false,publications=0;
 const crashSDK={...f,runTransaction:async(db,fn,options)=>{let published=false;
  const result=await f.runTransaction(db,tx=>fn(new Proxy(tx,{get(target,key){if(key==='set')return(ref,data)=>{if(ref.path.endsWith('/localFirstProjects/'+pid))published=true;return target.set(ref,data);};const v=target[key];return typeof v==='function'?v.bind(target):v;}})),options);
  if(published){publications++;if(lossArmed){lossArmed=false;computer.sync.close();await computer.owner.crash();crashCompleted=true;throw Object.assign(Error('Synthetic lost ACK'),{code:'unavailable'});}}
  return result;}};
 // Complete explicitly declared dependencies of the isolated cabinet fixture.
 const catalogs=model();for(const reference of ['laminat TEST','laminat','TEST','HDF'])if(!catalogs.materials.some(r=>[r.id,r.name,r.materialType].includes(reference)))catalogs.materials.push({id:'fixture-material-'+catalogs.materials.length,name:reference,materialType:'synthetic',price:12.375,priceUnit:'sheet'});
 await phone.page.evaluate(({catalogs,sources})=>{for(const [domain,v]of Object.entries(catalogs))for(const key of sources[domain])if(!window.FC.storage.setJSON(key,domain==='stock'?{sheets:v}:v))throw Error('Complete catalog fixture refused');},{catalogs,sources:phone.writer.r.FC.globalDataContract.sources});
 rows=await phone.page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));
 computer=await device('computer',undefined,crashSDK,catalogs);
 function channel(d,record=project){return createProjectChannel({writer:d.writer.connection,reader:d.reader.connection,ownerUid:d.writer.uid,deviceId:d.binding.deviceId,projectId:record.id,investorId:record.investorId,pilotContract:d.writer.r.FC.cloudPilotContract,pilotFactory:d.writer.r.FC.firebasePilotTransport,globalContract:d.writer.r.FC.globalDataContract,projectContract:d.writer.r.FC.businessProjectContract,globals:d.g});}
 for(const d of [phone,computer]){d.p=channel(d);d.pB=channel(d,second);if(d===phone)d.channels.push(d.p,d.pB);}
 assert.equal(computer.channels.length,1,'Fresh receiver must not know either project scope');
 function connect(d){d.sync=createDurableSynchronizer({store:d.store,channels:d.channels,eventTarget:d.events,online:()=>d.online});}
 for(const d of [phone,computer])connect(d);
 const initial=phone.writer.r.FC.globalDataContract.capture({getItem:k=>rows[k]??null},Object.keys(phone.writer.r.FC.globalDataContract.schemas));
 await phone.store.commit({scope:'globals',operationId:'initial-globals',value:initial.model,expectedVersion:0});
 phone.online=true;assert.equal((await phone.sync.flush()).ok,true);computer.online=true;assert.equal((await computer.sync.flush()).ok,true);
 async function applicationRPC(d,method,arg){
  const reply=await d.page.evaluate(async({method,arg})=>{try{return {ok:true,value:await window.applicationAuthority[method](arg)};}catch(e){const c=e?.code||e?.message;return {ok:false,code:/^(LF_|GLOBAL_|CLOUD_)[A-Z_]+$/.test(c||'')?c:'LF_APPLICATION_UNCONFIRMED'};}},{method,arg});
  if(!reply.ok)throw Object.assign(Error(reply.code),{code:reply.code});return reply.value;
 }
 async function install(d){
  await d.page.exposeFunction('__commitApplication',(kind,application)=>d.sync.commit(kind,application,application.rows.fc_current_project_id_v1));
  await d.page.exposeFunction('__requestApplicationSync',()=>d.sync.notify());
  await d.page.exposeFunction('__closeApplicationSync',()=>d.sync.close());
  await d.page.exposeFunction('__authorizeApplication',async scope=>{const r=(await d.store.snapshot(scope)).replica;if(!r?.editor?.active||r.editor.deviceId!==d.binding.deviceId)throw Error('LF_EDITOR_REQUIRED');});
  await d.page.exposeFunction('__checkpointApplication',(a,kind)=>kind==='rollback'?d.sync.checkpoint(a,kind):d.store.checkpointApplication(a));
  await d.page.evaluate(async({connection,binding})=>{const {installEmulatorApplicationAuthority,createApplicationActionBinding}=await import('/sync/application-authority.mjs');
   // Browser receives only emulator identity metadata, never tokens/backend access.
   connection.db.app=connection.auth.app={options:{projectId:'demo-meble-app'}};
   connection.session={identity:()=>({uid:binding.ownerUid,epoch:1})};connection.auth.currentUser={uid:binding.ownerUid,providerData:[{providerId:'google.com'}]};
   const store={...binding,readApplication:()=>window.lf.readApplication(),initializeApplication:r=>window.lf.initializeApplication(r)};
   window.applicationAuthority=await installEmulatorApplicationAuthority({window,store,connection,commit:window.__commitApplication,checkpoint:window.__checkpointApplication,authorize:window.__authorizeApplication,onCommitted:()=>{void window.__requestApplicationSync();}});
   window.FC.applicationSyncActions.install(createApplicationActionBinding({window,authority:window.applicationAuthority,onClose:()=>{void window.__closeApplicationSync();}}));
  },{binding:d.binding,connection:{db:{_databaseId:{projectId:'demo-meble-app',database:'(default)'},_settings:{host:'127.0.0.1:18080',ssl:false}},auth:{emulatorConfig:{host:'127.0.0.1',port:19099,protocol:'http'}}}});d.authority=true;d.sync.close();
  const discovery=createEmulatorProjectDiscovery({writer:d.writer.connection,reader:d.reader.connection,ownerUid:d.writer.uid,deviceId:d.binding.deviceId,pilotContract:d.writer.r.FC.cloudPilotContract,pilotFactory:d.writer.r.FC.firebasePilotTransport,globalContract:d.writer.r.FC.globalDataContract,projectContract:d.writer.r.FC.businessProjectContract,globals:d.g});
  d.sync=createApplicationReplication({discovery,store:d.store,channels:d.channels,globalContract:d.writer.r.FC.globalDataContract,projectContract:d.writer.r.FC.businessProjectContract,
   eventTarget:d.events,online:()=>d.online,onState:state=>(d.states??=[]).push(state),incoming:rows=>applicationRPC(d,'incoming',rows),
   assertIdle:()=>applicationRPC(d,'assertIdle'),refresh:()=>applicationRPC(d,'refresh')});
 }
 await install(phone);await install(computer);
 const built=await phone.page.evaluate(pid=>window.FC.businessProjectContract.build(localStorage,pid),pid),global=await phone.store.snapshot('globals');
 const editor=await phone.p.acquire(null);
 await phone.store.apply({scope:pid,value:{document:built.document,globals:{head:global.replica.base,model:JSON.parse(global.replica.json)},requirements:[]},head:null,expectedVersion:0,editor});
 // Actual application repository mutation, durable data/outbox in one IDB tx.
 await phone.page.evaluate(pid=>window.applicationAuthority.transaction('project',()=>{const row=window.FC.projectStore.getById(pid);row.title='Phone approved edit';if(!window.FC.projectStore.upsert(row))throw Error('Actual project repository refused');}),pid);
 await waitFor(async()=>await computer.page.evaluate(pid=>window.FC.projectStore.getById(pid)?.title,pid)==='Phone approved edit');
 const drawing=async d=>d.page.evaluate(({pid,room})=>window.FC.cabinetCutlist.getCabinetCutList(window.FC.projectStore.getById(pid).projectData[room].cabinets[0],room),{pid,room});
 assert.deepEqual(await drawing(phone),await drawing(computer));
 for(const d of [phone,computer])assert.equal(await d.page.evaluate(()=>window.FC.laborCatalog.calculateDefinition({id:'stable-owned-task',name:'Fixture task',price:7.125,pricingMode:'perUnit'},{quantity:3}).total),21.375);
 await assert.rejects(f.getDocsFromServer(f.collection(computer.reader.db,'users',phone.writer.uid,'localFirstProjects')),e=>e.code==='permission-denied');
 const foreign=await client(f,true);await assert.rejects(f.getDocFromServer(f.doc(foreign.db,'users',phone.writer.uid,'localFirstProjects',pid)),e=>e.code==='permission-denied');
 await assert.rejects(f.getDocsFromServer(f.query(f.collection(foreign.db,'users',phone.writer.uid,'localFirstProjects'),f.limit(100))),e=>e.code==='permission-denied');
 const received=await computer.store.snapshot(pid);assert.equal(JSON.parse(received.replica.json).document.payload.project.title,'Phone approved edit');
 await assert.rejects(computer.p.acquire(received.replica.base),/LF_EDITOR_BUSY/);
 await assert.rejects(computer.page.evaluate(room=>window.applicationAuthority.transaction('draft',()=>window.FC.views.openRoom(room)),room),/LF_EDITOR_REQUIRED/);
 await phone.sync.releaseEditor(pid);await computer.sync.acquireEditor(pid);
 await assert.rejects(phone.page.evaluate(()=>window.applicationAuthority.transaction('project',()=>true)),/LF_EDITOR_REQUIRED/);
 await computer.page.evaluate(pid=>window.applicationAuthority.transaction('project',()=>{const row=window.FC.projectStore.getById(pid);row.title='Computer approved edit';if(!window.FC.projectStore.upsert(row))throw Error('Actual project repository refused');}),pid);
 await waitFor(async()=>await phone.page.evaluate(pid=>window.FC.projectStore.getById(pid)?.title,pid)==='Computer approved edit');
 assert.equal(await phone.page.evaluate(pid=>window.FC.projectStore.getById(pid).title,pid),'Computer approved edit');
 // Genuine transport disconnection. Local confirmed IDB Save survives offline.
 computer.online=false;await f.disableNetwork(computer.writer.db);await f.disableNetwork(computer.reader.db);
 await computer.page.evaluate(pid=>window.applicationAuthority.transaction('project',()=>{const row=window.FC.projectStore.getById(pid);row.title='Offline approved edit';if(!window.FC.projectStore.upsert(row))throw Error('Offline local write refused');}),pid);
 const pending=await computer.store.snapshot(pid);assert.equal(pending.replica.dirty,true);
 await f.enableNetwork(computer.writer.db);await f.enableNetwork(computer.reader.db);computer.online=true;computer.events.dispatchEvent(new Event('online'));await waitFor(async()=>await phone.page.evaluate(pid=>window.FC.projectStore.getById(pid)?.title,pid)==='Offline approved edit');
 assert.equal(await phone.page.evaluate(pid=>window.FC.projectStore.getById(pid).title,pid),'Offline approved edit');
 assert.equal(await phone.page.evaluate(()=>window.FC.investors.readAll().length),2);
 // Existing Save path: durable session -> RAM edit -> real Save gesture ->
 // IDB data+outbox commit before the success notice, then independent receive.
 await computer.page.evaluate(room=>window.applicationAuthority.transaction('draft',()=>window.FC.views.openRoom(room)),room);
 await computer.page.evaluate(room=>{if(!window.FC.session.active)throw Error('Real session not active');window.projectData[room].settings.roomHeight=287.125;window.FC.views.refreshSessionButtons();},room);
 await computer.page.click('#sessionSave');
 await waitFor(async()=>!await computer.page.evaluate(()=>window.FC.session.active));
 await waitFor(async()=>await phone.page.evaluate(({pid,room})=>window.FC.projectStore.getById(pid).projectData[room].settings.roomHeight,{pid,room})===287.125);
 assert.equal(await phone.page.evaluate(pid=>window.FC.projectStore.getById(pid).projectData.meta.futureOwnedField.exact,pid),7.125);
 assert.equal(await phone.page.evaluate(()=>window.FC.storage.getJSON('fc_quote_snapshots_v1',[])[0].frozen.total),21.375);
 assert.equal(await computer.page.locator('.info-box__title').textContent(),'Projekt zapisany');await computer.page.click('.info-box .is-success');
 // Real Cancel retains its confirmation and reopens the same protected room.
 const approvedRaw=await computer.page.evaluate(()=>localStorage.getItem('fc_projects_v1')),opCount=(await computer.store.snapshot(pid)).operations.length;
 await computer.page.evaluate(room=>window.applicationAuthority.transaction('draft',()=>window.FC.views.openRoom(room)),room);
 await computer.page.evaluate(room=>{window.projectData[room].settings.roomHeight=299.25;window.FC.views.refreshSessionButtons();},room);
 // A real remote catalog publication must not overwrite an active RAM draft.
 await phone.page.evaluate(()=>window.applicationAuthority.transaction('globals',()=>{const fc=window.FC,stock=fc.storage.getJSON('fc_sheets_v1');stock.sheets[0].qty=17;if(!fc.storage.setJSON('fc_sheets_v1',stock))throw Error('Global edit refused');}));
 await waitFor(async()=>!(await phone.store.snapshot('globals')).replica.dirty);
 assert.equal((await computer.sync.flush()).code,'LF_ACTIVE_RAM_PROTECTED');
 assert.equal(await computer.page.evaluate(room=>window.projectData[room].settings.roomHeight,room),299.25);
 assert.equal(await computer.page.evaluate(()=>window.FC.storage.getJSON('fc_sheets_v1').sheets[0].qty),3);
 await computer.page.click('#sessionCancel');await computer.page.waitForSelector('.confirm-box');await computer.page.click('.confirm-box .is-danger');
 await waitFor(async()=>await computer.page.evaluate(room=>window.FC.session.active&&window.FC.session.durable&&window.projectData[room].settings.roomHeight===287.125&&!window.applicationAuthority.status().transactionPending,room));
 assert.equal(await computer.page.evaluate(()=>localStorage.getItem('fc_projects_v1')),approvedRaw);assert.equal((await computer.store.snapshot(pid)).operations.length,opCount);
 await computer.page.evaluate(()=>window.applicationAuthority.transaction('checkpoint',()=>window.FC.session.commit()));
 await waitFor(async()=>await computer.page.evaluate(()=>window.FC.storage.getJSON('fc_sheets_v1').sheets[0].qty)===17);
 // All 14 real catalog sources are captured atomically; no manual sync call.
 await computer.page.evaluate(()=>window.applicationAuthority.transaction('globals',()=>{const fc=window.FC;for(const key of fc.globalDataContract.sources.stock){const stock=fc.storage.getJSON(key);stock.sheets[0].qty=23;if(!fc.storage.setJSON(key,stock))throw Error('Real catalog setter refused');}}));
 await waitFor(async()=>await phone.page.evaluate(()=>window.FC.storage.getJSON('fc_sheets_v1').sheets[0].qty)===23);
 assert.equal(Object.keys(JSON.parse((await phone.store.snapshot('globals')).replica.json)).length,14);
 // A locally confirmed draft transaction retains the original session proof
 // and edited central record across an actual process restart, without publish.
 const beforeDraftPublications=publications;
 await computer.page.evaluate(room=>window.applicationAuthority.transaction('draft',()=>window.FC.views.openRoom(room)),room);
 await computer.page.evaluate(room=>window.applicationAuthority.transaction('draft',()=>{window.projectData[room].settings.roomHeight=288.125;window.projectData=window.FC.project.save(window.projectData);return window.FC.session.canSaveProject();}),room);
 computer.sync.close();await computer.owner.crash();
 computer=await device('computer',undefined,crashSDK,catalogs);computer.p=channel(computer);computer.pB=channel(computer,second);for(const row of JSON.parse((await computer.store.readApplication()).rows.fc_projects_v1||'[]'))if((await computer.store.snapshot(row.id)).replica)computer.channels.push(channel(computer,row));connect(computer);await install(computer);
 assert.equal(await computer.page.evaluate(room=>window.FC.session.active&&window.FC.session.durable&&window.projectData[room].settings.roomHeight===288.125,room),true);
 assert.equal(publications,beforeDraftPublications,'Restoring a draft must not publish');
 computer.online=true;computer.events.dispatchEvent(new Event('online'));await computer.page.click('#sessionSave');
 await waitFor(async()=>await phone.page.evaluate(({pid,room})=>window.FC.projectStore.getById(pid).projectData[room].settings.roomHeight,{pid,room})===288.125);
 assert.equal(await computer.page.locator('.info-box__title').textContent(),'Projekt zapisany');await computer.page.click('.info-box .is-success');
 // A committed project head loses its ACK and the real owning Chromium.
 // Reopen the same profile/image and resolve only with independent server READ.
 const beforeCrash=publications;lossArmed=true;
 await computer.page.evaluate(pid=>window.applicationAuthority.transaction('project',()=>{const row=window.FC.projectStore.getById(pid);row.title='Approved before lost ACK';if(!window.FC.projectStore.upsert(row))throw Error('Approved Save refused');}),pid);
 await waitFor(()=>crashCompleted);await computer.sync.flush();
 computer=await device('computer',undefined,crashSDK,catalogs);computer.p=channel(computer);computer.pB=channel(computer,second);for(const row of JSON.parse((await computer.store.readApplication()).rows.fc_projects_v1||'[]'))if((await computer.store.snapshot(row.id)).replica)computer.channels.push(channel(computer,row));connect(computer);await install(computer);
 assert.equal((await computer.store.snapshot(pid)).operations.sort((a,b)=>a.localVersion-b.localVersion).at(-1).phase,'inflight');
 computer.online=true;computer.events.dispatchEvent(new Event('online'));
 await waitFor(async()=>(await computer.store.snapshot(pid)).operations.sort((a,b)=>a.localVersion-b.localVersion).at(-1).phase==='verified');
 assert.equal(publications,beforeCrash+1,'Recovery must not republish after lost ACK');
 assert.equal(await computer.page.evaluate(pid=>window.FC.projectStore.getById(pid).title,pid),'Approved before lost ACK');
 await waitFor(async()=>await phone.page.evaluate(pid=>window.FC.projectStore.getById(pid)?.title,pid)==='Approved before lost ACK');
 // Second owned investor/project travels through the same channels without
 // replacing the recipient's active first project, frozen offer or room list.
 await phone.page.evaluate(iid=>window.applicationAuthority.transaction('checkpoint',()=>{const before=JSON.parse(localStorage.getItem('fc_projects_v1'));window.FC.actions.dispatch('open-investor',{element:{getAttribute:()=>iid}});const after=JSON.parse(localStorage.getItem('fc_projects_v1'));const paths=[];function diff(a,b,p){if(JSON.stringify(a)===JSON.stringify(b))return;if(!a||!b||typeof a!=='object'||typeof b!=='object'){paths.push(p);return;}for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[k],b[k],p+'.'+k);}diff(before,after,'projects');if(paths.length)throw Error('Navigation changed fields: '+JSON.stringify(paths));return true;}),second.investorId);
 const builtB=await phone.page.evaluate(pid=>window.FC.businessProjectContract.build(localStorage,pid),second.id),gB=await phone.store.snapshot('globals'),editorB=await phone.pB.acquire(null);
 await phone.store.apply({scope:second.id,value:{document:builtB.document,globals:{head:gB.replica.base,model:JSON.parse(gB.replica.json)},requirements:[]},head:null,expectedVersion:0,editor:editorB});
 await phone.page.evaluate(pid=>window.applicationAuthority.transaction('project',()=>{const r=window.FC.projectStore.getById(pid);r.title='Independent second investor';if(!window.FC.projectStore.upsert(r))throw Error('Second owner Save refused');}),second.id);
 await waitFor(async()=>await computer.page.evaluate(pid=>window.FC.projectStore.getById(pid)?.title,second.id)==='Independent second investor');
 assert.equal(await computer.page.evaluate(()=>window.FC.investors.readAll().length),2);
 assert.equal(await computer.page.evaluate(pid=>window.FC.projectStore.getCurrentRecord().id,pid),pid);
 assert.equal(await computer.page.evaluate(({pid,room})=>!!window.FC.projectStore.getById(pid).projectData[room],{pid:second.id,room}),false);
 assert.equal(await computer.page.evaluate(()=>window.FC.storage.getJSON('fc_quote_snapshots_v1',[])[0].frozen.total),21.375);
 // Clean Exit changes the view only after durable session closure and never Auth.
 const beforeExit=await computer.page.evaluate(()=>localStorage.getItem('fc_projects_v1'));
 await computer.page.click('#sessionCancel');
 await waitFor(async()=>JSON.parse((await computer.store.readApplication()).rows.fc_ui_v1).entry==='investorsList');
 assert.equal(await computer.page.evaluate(()=>window.__FC_MAIN_ACCESS__.isValid()),true);
 assert.equal(await computer.page.evaluate(()=>localStorage.getItem('fc_projects_v1')),beforeExit);
 // A legacy writer is detected without deleting or copying over either source.
 await computer.page.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'fc_projects_v1'})));
 await assert.rejects(computer.page.evaluate(()=>window.applicationAuthority.transaction('globals',()=>true)),/LF_APPLICATION_CLOSED_OR_OLD_WRITER/);
 assert.equal((await computer.store.snapshot(pid)).operations.sort((a,b)=>a.localVersion-b.localVersion).at(-1).phase,'verified');
 const preserved=await phone.store.readApplication();await phone.page.click('#main-signout');await phone.page.waitForFunction(()=>!window.__FC_MAIN_ACCESS__.isValid());
 assert.deepEqual(await phone.store.readApplication(),preserved,'Logout preserves the authoritative image and queue');
 console.log('PASS actual application two-instance IDB/Auth/Firestore: phone -> computer -> phone, editor CAS/handover and offline confirmed outbox');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {test}=await import('node:test');test('LOCAL-FIRST actual application end-to-end',runApplicationE2E);
}
