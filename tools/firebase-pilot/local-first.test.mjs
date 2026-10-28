// Called as a nested suite after the unchanged 14 CLOUD-SYNC-1 scenarios.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import * as app from 'firebase/app';
import * as auth from 'firebase/auth';
import * as f from 'firebase/firestore';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {runtime,model,seed} from './cloud-sync-fixture.mjs';
import {startLocalFirstServer,openBrowserDevice} from '../helpers/local-first-browser.mjs';
import {createGlobalChannel,createDurableSynchronizer} from '../../sync/local-first-sync.mjs';
import {createProjectChannel,validateProjectDependencies} from '../../sync/local-first-project.mjs';
const require=createRequire(import.meta.url),{fixture}=require('../project-selective-export-smoke.js');
const root=new URL('../../',import.meta.url),clone=v=>JSON.parse(JSON.stringify(v));
export async function runLocalFirstSuite(t){
  for(const [key,port]of [['FIRESTORE_EMULATOR_HOST',18080],['FIREBASE_AUTH_EMULATOR_HOST',19099]])assert.equal(process.env[key],`127.0.0.1:${port}`);
  const original=fs.readFileSync(new URL('./firestore.rules',import.meta.url),'utf8');
  const marker='    match /{document=**}';assert.equal(original.split(marker).length,2);
  const fragment=fs.readFileSync(new URL('../../sync/local-first-project.rules',import.meta.url),'utf8');
  const rules=original.replace(marker,()=>fragment+'\n'+marker);
  const env=await initializeTestEnvironment({projectId:'demo-meble-app',firestore:{host:'127.0.0.1',port:18080,rules}});
  const server=await startLocalFirstServer(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'meble-lf-sdk-'));
  const lifetimes=[],devices=[];let serial=0;
  t.after(async()=>{for(const d of devices){d.sync?.close();await d.browser?.close();}
    await Promise.all(lifetimes.map(c=>c.close()));await env.cleanup();await server.close();fs.rmSync(directory,{recursive:true,force:true,maxRetries:3});});
  await env.clearFirestore();
  async function client(sdk=f){
    const r=runtime();for(const n of ['cloud-pilot-contract','firebase-pilot-transport'])new Function('window',fs.readFileSync(new URL('js/app/cloud/'+n+'.js',root),'utf8'))(r.s);
    const h=await r.FC.firebasePilotTransport.create({target:'emulator',projectId:'demo-meble-app',appName:'lf-'+(++serial),
      emulator:{host:'127.0.0.1',authPort:19099,firestorePort:18080},sdk:{app,auth,firestore:f}});
    lifetimes.push(h.transport);
    const payload=Buffer.from(JSON.stringify({sub:'synthetic-lf-owner',email:'synthetic-lf@example.invalid',email_verified:true})).toString('base64url');
    await auth.signInWithCredential(h.auth,auth.GoogleAuthProvider.credential('e30.'+payload+'.'));await h.transport.ready();
    return {r,...h,uid:h.auth.currentUser.uid,connection:{...h,firestore:sdk,session:h.transport,assertAccess(){}}};
  }
  async function device(label,sdk=f,projectId='A'){
    const writer=await client(sdk),reader=await client();
    await env.withSecurityRulesDisabled(ctx=>f.setDoc(f.doc(ctx.firestore(),'authorizedUsers',writer.uid),{appEnabled:true,enabled:false,globalDataEnabled:true,globalSchemaVersion:1}));
    const browser=await openBrowserDevice(server,path.join(directory,label));
    const binding={name:'meble-lf-test-'+label,ownerUid:writer.uid,deviceId:label,instanceId:'instance-'+label,initialize:true};
    const store=await browser.open(binding),g=createGlobalChannel({writer:writer.connection,reader:reader.connection,ownerUid:writer.uid,
      contract:writer.r.FC.globalDataContract,factory:writer.r.FC.firebaseGlobalTransport});
    const pf=fixture();
    // Domain/export scripts run in the same realm as the real SDK payloads.
    for(const n of ['cloud-pilot-contract','firebase-pilot-transport'])new Function('window',fs.readFileSync(new URL('js/app/cloud/'+n+'.js',root),'utf8'))(pf.s);
    const p=createProjectChannel({writer:writer.connection,reader:reader.connection,ownerUid:writer.uid,deviceId:label,projectId,investorId:'inv-'+projectId,
      pilotContract:pf.FC.cloudPilotContract,pilotFactory:pf.FC.firebasePilotTransport,globalContract:writer.r.FC.globalDataContract,
      projectContract:pf.FC.projectExportContract,globals:g});
    const d={writer,reader,browser,binding,store,g,p,pf,projectId,online:false,events:new EventTarget(),states:[]};devices.push(d);
    d.connect=()=>{d.sync=createDurableSynchronizer({store:d.store,channels:[g,p],eventTarget:d.events,online:()=>d.online,onState:s=>d.states.push(s)});};
    d.connect();return d;
  }
  async function reconnect(d){d.online=true;d.events.dispatchEvent(new Event('online'));await new Promise(resolve=>setTimeout(resolve,0));return d.sync.flush();}
  async function waitUntil(check){for(let i=0;i<200;i++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,25));}assert.fail('Automatic synchronization did not complete');}
  async function submitGlobal(d,value,operationId){seed(d.writer.r,value);const snap=await d.store.snapshot('globals');
    return d.sync.submitGlobals({source:d.writer.r.storage,operationId,expectedVersion:snap.replica?.version||0});}
  const build=d=>d.pf.FC.projectSelectiveExport.build({projectId:d.projectId,investorId:'inv-'+d.projectId,purpose:'pilot'});
  async function submitProject(d,operationId){const built=await build(d);assert.equal(built.ok,true,JSON.stringify(built));
    const snap=await d.store.snapshot(d.projectId);return d.sync.submitProject({projectId:d.projectId,operationId,document:built.document,source:d.pf.storage,
      expectedVersion:snap.replica.version,projectContract:d.pf.FC.projectExportContract,globalContract:d.writer.r.FC.globalDataContract});}
  const phone=await device('phone'),computer=await device('computer');
  const initial=await phone.pf.build();assert.equal(initial.ok,true);
  const globals=model();
  globals.labor.push({id:'synthetic-lf-task',name:'Synthetic task',pricingMode:'perUnit',price:7.125});
  // Build explicit synthetic catalog records for native fixture selectors.
  for(const dep of phone.pf.FC.projectExportContract.dependencies(initial.document.payload).filter(d=>d.domain==='material')){
    if(!globals.materials.some(r=>[r.id,r.name,r.materialType].includes(dep.reference)))globals.materials.push({id:'synthetic-required-'+globals.materials.length,
      name:dep.reference,materialType:'synthetic',price:12.375,priceUnit:'sheet'});
  }
  await t.test('LOCAL-FIRST 01: phone offline -> real IDB -> Auth/Firestore -> computer; complete 14 domains',async()=>{
    seed(phone.writer.r,globals);const before=[...phone.writer.r.rows];const local=await submitGlobal(phone,globals,'phone-globals-1');assert.equal(local.localConfirmed,true);assert.equal(local.cloudConfirmed,false);
    assert.equal((await phone.store.snapshot('globals')).operations[0].phase,'queued');
    assert.equal((await reconnect(phone)).ok,true);assert.equal((await reconnect(computer)).ok,true);
    const received=await computer.store.snapshot('globals');assert.deepEqual(JSON.parse(received.replica.json),globals);
    assert.equal(Object.keys(JSON.parse(received.replica.json)).length,14);assert.equal(received.replica.dirty,false);
    assert.deepEqual([...phone.writer.r.rows],before);
    assert.deepEqual(phone.writer.r.calls,[]);
  });
  await t.test('LOCAL-FIRST 02: computer -> phone; prices, stock, labor and compatible fields remain exact',async()=>{
    const changed=clone(globals);changed.materials[0].price=281.123456789;changed.stock[0].qty=17;
    changed.labor.push({id:'new-task',name:'Synthetic new task',price:23.75,pricingMode:'perUnit'});
    assert.equal((await submitGlobal(computer,changed,'computer-globals-2')).localConfirmed,true);
    assert.equal((await computer.sync.flush()).ok,true);
    // Phone is already online: its server-head listener must wake the receiver.
    await waitUntil(async()=>JSON.parse((await phone.store.snapshot('globals')).replica.json).stock[0].qty===17);
    assert.deepEqual(JSON.parse((await phone.store.snapshot('globals')).replica.json),changed);
  });
  let firstEditor;
  await t.test('LOCAL-FIRST 03: one editor, offline native project edit, second device refused without timeout takeover',async()=>{
    const global=await phone.store.snapshot('globals'),bundle={document:initial.document,globals:{head:global.replica.base,model:JSON.parse(global.replica.json)},
      requirements:phone.pf.FC.projectExportContract.dependencies(initial.document.payload)};
    validateProjectDependencies(phone.pf.FC.projectExportContract,phone.writer.r.FC.globalDataContract,bundle.document,bundle.globals.model);
    await phone.store.apply({scope:'A',value:clone(bundle),head:null,expectedVersion:0});
    await phone.sync.acquireEditor('A');firstEditor=(await phone.store.snapshot('A')).replica.editor;
    assert.equal((await submitProject(phone,'project-first')).localConfirmed,true);assert.equal((await phone.sync.flush()).ok,true);
    assert.equal((await computer.sync.flush()).ok,true);await assert.rejects(computer.sync.acquireEditor('A'),/LF_EDITOR_BUSY_OR_HEAD_CHANGED/);
    phone.online=false;await Promise.all([f.disableNetwork(phone.writer.db),f.disableNetwork(phone.reader.db)]);
    phone.pf.mutate(p=>{p.projectData.kuchnia.cabinets[0].width=81.125;});
    assert.equal((await submitProject(phone,'project-offline')).localConfirmed,true);
    const saved=await phone.store.snapshot('A');assert.equal(saved.replica.dirty,true);
    await assert.rejects(computer.sync.acquireEditor('A'),/LF_EDITOR_BUSY_OR_HEAD_CHANGED/);
    await assert.rejects(phone.sync.releaseEditor('A'),/LF_HANDOVER_PENDING_LOCAL_WORK/);
    await Promise.all([f.enableNetwork(phone.writer.db),f.enableNetwork(phone.reader.db)]);
    assert.equal((await reconnect(phone)).ok,true);assert.equal((await computer.sync.flush()).ok,true);
    const a=await phone.store.snapshot('A'),b=await computer.store.snapshot('A');assert.equal(a.replica.dirty,false);assert.equal(a.replica.json,b.replica.json);
    assert.equal(JSON.parse(b.replica.json).document.payload.project.projectData.kuchnia.cabinets[0].width,81.125);
  });
  await t.test('LOCAL-FIRST 04: confirmed handover, new editor publication, old editor rejected and RAW/history preserved',async()=>{
    const sourceA=phone.pf.rows(),sourceB=computer.pf.rows();
    await phone.sync.releaseEditor('A');await computer.sync.acquireEditor('A');
    const edit=(await computer.store.snapshot('A')).replica.editor;assert.equal(edit.deviceId,'computer');assert.equal(edit.epoch,firstEditor.epoch+1);
    const old=await phone.store.snapshot('A');
    await assert.rejects(phone.p.prepare(JSON.parse(old.replica.json),old.replica.base,firstEditor),/LF_EDITOR_CONFLICT/);
    const current=JSON.parse((await computer.store.snapshot('A')).replica.json);
    // Rebuild from actual native stores rather than editing a serialized hash.
    computer.pf.mutate(p=>{p.projectData.kuchnia.cabinets[0].width=92.5;});const editedSourceB=computer.pf.rows();
    assert.equal((await submitProject(computer,'computer-project')).localConfirmed,true);assert.equal((await computer.sync.flush()).ok,true);
    assert.equal((await phone.sync.flush()).ok,true);
    assert.equal(JSON.parse((await phone.store.snapshot('A')).replica.json).document.payload.project.projectData.kuchnia.cabinets[0].width,92.5);
    const receivedBundle=JSON.parse((await phone.store.snapshot('A')).replica.json),received=receivedBundle.document.payload.project.projectData;
    const restored=fixture();restored.mutate(p=>{p.projectData=clone(received);});
    const drawing=r=>clone(r.FC.cabinetCutlist.getCabinetCutList(r.s.projectData.kuchnia.cabinets[0],'kuchnia'));
    assert.deepEqual(drawing(restored),drawing(computer.pf));
    for(const r of [restored,computer.pf])for(const n of ['labor-catalog-definitions','labor-catalog'])
      vm.runInContext(fs.readFileSync(new URL('js/app/pricing/'+n+'.js',root),'utf8'),r.s);
    const price=(r,bundle)=>clone(r.FC.laborCatalog.calculateDefinition(bundle.globals.model.labor.find(row=>row.id==='synthetic-lf-task'),{quantity:3}));
    assert.equal(price(restored,receivedBundle).total,21.375);assert.deepEqual(price(restored,receivedBundle),price(computer.pf,current));
    assert.deepEqual(phone.pf.rows(),sourceA);assert.deepEqual(computer.pf.rows(),editedSourceB);assert.notDeepEqual(editedSourceB,sourceB);
    assert.equal(current.globals.model.stock[0].qty,17);
    await assertFails(f.getDoc(f.doc(env.authenticatedContext('foreign-lf',{firebase:{sign_in_provider:'google.com'}}).firestore(),'users',phone.writer.uid,'localFirstProjects','A')));
  });
  await t.test('LOCAL-FIRST 05: concurrent global revisions conflict and preserve the losing local model/outbox',async()=>{
    phone.online=false;computer.online=false;
    const a=JSON.parse((await phone.store.snapshot('globals')).replica.json),b=clone(a);a.stock[0].qty=99;b.stock[0].qty=77;
    await submitGlobal(phone,a,'concurrent-phone');await submitGlobal(computer,b,'concurrent-computer');
    assert.equal((await reconnect(phone)).ok,true);assert.equal((await reconnect(computer)).ok,false);
    const losing=await computer.store.snapshot('globals');assert.equal(losing.replica.dirty,true);
    assert.equal(JSON.parse(losing.replica.json).stock[0].qty,77);assert.equal(losing.operations.at(-1).phase,'conflict');
  });
  await t.test('LOCAL-FIRST 06: real commit loses ACK and browser process; restart resolves by independent READ without another WRITE',async()=>{
    let drop=true,publications=0,doomed;
    const sdk={...f,runTransaction:async(db,fn,options)=>{let publication=false;
      const result=await f.runTransaction(db,tx=>fn(new Proxy(tx,{get(target,key){
        if(key==='set')return(ref,data)=>{if(ref.path.endsWith('/globalData/current'))publication=true;return target.set(ref,data);};
        const value=target[key];return typeof value==='function'?value.bind(target):value;}})),options);
      if(publication){publications++;if(drop){drop=false;await doomed.browser.close();throw Object.assign(Error('synthetic lost ACK'),{code:'unavailable'});}}return result;}};
    doomed=await device('restart',sdk);
    // Match the verified latest server baseline before making a new local edit.
    assert.equal((await reconnect(doomed)).ok,true);doomed.online=false;
    const changed=JSON.parse((await doomed.store.snapshot('globals')).replica.json);changed.materials[0].price=399.875;
    await submitGlobal(doomed,changed,'restart-operation');doomed.online=true;assert.equal((await doomed.sync.flush()).ok,false);doomed.sync.close();
    doomed.browser=await openBrowserDevice(server,path.join(directory,'restart'));
    doomed.store=await doomed.browser.open({...doomed.binding,initialize:false});
    const pending=await doomed.store.snapshot('globals');assert.equal(pending.operations.at(-1).phase,'inflight');
    doomed.connect();assert.equal((await doomed.sync.flush()).ok,true);
    assert.equal((await doomed.store.snapshot('globals')).operations.at(-1).phase,'verified');assert.equal(publications,1);
    assert.deepEqual(JSON.parse((await doomed.store.snapshot('globals')).replica.json),changed);
  });
  await t.test('LOCAL-FIRST 07: incomplete dependencies and unresolved historical RAW refuse publication without deletion',async()=>{
    const local=await device('blocked',f,'B');assert.equal((await reconnect(local)).ok,true);
    const g=await local.store.snapshot('globals'),doc=await build(local);assert.equal(doc.ok,true);
    const incomplete=clone(JSON.parse(g.replica.json));delete incomplete.stock;
    assert.throws(()=>validateProjectDependencies(local.pf.FC.projectExportContract,local.writer.r.FC.globalDataContract,doc.document,incomplete),/GLOBAL_BUNDLE_INCOMPLETE/);
    await local.store.apply({scope:'B',value:{document:doc.document,globals:{head:g.replica.base,model:JSON.parse(g.replica.json)},
      requirements:local.pf.FC.projectExportContract.dependencies(doc.document.payload)},head:null,expectedVersion:0});
    await local.sync.acquireEditor('B');
    local.pf.storage.rows.set('fc_quote_snapshots_v1','SYNTHETIC-PROTECTED-HISTORY');
    const {protectProjectRows}=await import('../../sync/local-first-project.mjs');
    const protection=protectProjectRows(local.pf.storage);assert.deepEqual(protection.blockers,['LF_PROJECT_OWNERSHIP_PENDING']);
    assert.equal(protection.protectedRows.fc_quote_snapshots_v1,'SYNTHETIC-PROTECTED-HISTORY');
    const before=local.pf.rows(),queued=await submitProject(local,'blocked-history');assert.equal(queued.localConfirmed,true);
    assert.deepEqual(queued.blockers,['LF_PROJECT_OWNERSHIP_PENDING']);
    assert.equal((await local.sync.flush()).code,'LF_PROJECT_OWNERSHIP_PENDING');
    const saved=await local.store.snapshot('B');assert.equal(saved.operations[0].phase,'blocked');assert.equal(saved.replica.dirty,true);
    assert.equal(JSON.parse(saved.protected[0].json).fc_quote_snapshots_v1,'SYNTHETIC-PROTECTED-HISTORY');
    assert.equal((await f.getDocFromServer(f.doc(local.reader.db,'users',local.writer.uid,'localFirstProjects','B'))).exists(),false);
    assert.deepEqual(local.pf.rows(),before);
    assert.equal(local.pf.storage.getItem('fc_quote_snapshots_v1'),'SYNTHETIC-PROTECTED-HISTORY');
  });
}
