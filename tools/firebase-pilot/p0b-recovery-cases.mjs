import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as f from 'firebase/firestore';
import {runtime,model} from './cloud-sync-fixture.mjs';
import {createP0BProjectRecovery} from './p0b-project-recovery.mjs';
import {createGlobalChannel,createDurableSynchronizer} from '../../sync/local-first-sync.mjs';
import {createProjectChannel} from '../../sync/local-first-project.mjs';
import {startLocalFirstServer,openBrowserDevice} from '../helpers/local-first-browser.mjs';

export async function runP0BRecovery(t,{env,client,uid,pin,wrongPin,contact}){
  const old=client('recover-phone'), reader=client('recover-reader'), computer=client('recover-computer');
  const projectId='recover-project', investorId='recover-investor';
  const r=runtime();
  r.load('js/app/shared/schema.js');
  r.load('js/app/project/project-model.js');
  for(const file of ['project/business-project-contract','cloud/cloud-pilot-contract','cloud/firebase-pilot-transport']){
    new Function('window',fs.readFileSync(new URL('../../js/app/'+file+'.js',import.meta.url),'utf8'))(r.s);
  }
  const FC=r.FC;
  const globals=createGlobalChannel({writer:old.connection,reader:reader.connection,ownerUid:uid,
    contract:FC.globalDataContract,factory:FC.firebaseGlobalTransport});
  t.after(()=>globals.close());
  await (await globals.prepare(model(),null)).publish();
  const receivedGlobals=await globals.read();
  const global={head:receivedGlobals.head,model:receivedGlobals.value};
  function channel(writer,deviceId){
    return createProjectChannel({writer:writer.connection,reader:reader.connection,ownerUid:uid,deviceId,projectId,investorId,
      pilotContract:FC.cloudPilotContract,pilotFactory:FC.firebasePilotTransport,
      projectContract:FC.businessProjectContract,globalContract:FC.globalDataContract,globals});
  }
  const remoteChannel=channel(old,'recover-phone');
  t.after(()=>remoteChannel.close());
  await old.protocol.createInvestor(investorId,contact);
  const invested={...contact,id:investorId,rooms:[]};
  const extraProject={id:'foreign',investorId:'foreign-investor',title:'Chroniony projekt'};
  const history=[{id:'accepted-history',project:{id:projectId},investor:{id:investorId},frozen:{total:149.125}}];
  const project={id:projectId,investorId,title:'Potwierdzony projekt',
    projectData:{schemaVersion:12,meta:{assignedInvestorId:investorId,roomOrder:[],roomDefs:{}}}};
  const rows={
    fc_projects_v1:JSON.stringify([project,extraProject]),fc_investors_v1:JSON.stringify([invested,{id:extraProject.investorId}]),
    fc_quote_snapshots_v1:JSON.stringify(history),fc_current_project_id_v1:projectId,fc_current_investor_v1:investorId,
    fc_quote_offer_drafts_v1:JSON.stringify([]),fc_edit_session_v1:null,fc_edge_v1:'{}',
    fc_quote_rates_v1:'[{"id":"preserved-pricing","price":17.125}]',
  };
  const makeValue=async input=>{
    const built=await FC.businessProjectContract.build({getItem:key=>input[key]??null},projectId);
    return {document:built.document,globals:global,requirements:FC.businessProjectContract.dependencies(built.document.payload)};
  };
  const newerHistory={...history[0],id:'newer-accepted-history'};
  const initial=await makeValue({...rows,fc_quote_snapshots_v1:JSON.stringify(history.concat(newerHistory))});
  const editor=await old.protocol.acquire({iid:investorId,pid:projectId,expectedHead:'',deviceLabel:'Telefon'});
  await (await remoteChannel.prepare(initial,null,editor)).publish();
  const remote=await remoteChannel.read();

  const browserServer=await startLocalFirstServer(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'meble-takeover-'));
  const binding={name:'meble-lf-test-takeover',ownerUid:uid,instanceId:'recover-profile',deviceId:'recover-phone',initialize:true};
  let browser=await openBrowserDevice(browserServer,directory),store=await browser.open(binding);
  t.after(async()=>{await browser.close();await browserServer.close();fs.rmSync(directory,{recursive:true,force:true});});
  async function reboot(){
    await browser.kill();
    browser=await openBrowserDevice(browserServer,directory);
    store=await browser.open({...binding,initialize:false});
  }
  await store.initializeApplication(rows);
  await store.apply({scope:projectId,value:remote.value,head:remote.head,expectedVersion:0,editor});
  const changed={...rows,fc_projects_v1:JSON.stringify([{...project,title:'Oczekująca praca telefonu'},extraProject])};
  const localValue=await makeValue(changed);
  const stagedOld=await remoteChannel.prepare(localValue,remote.head,editor);
  const dirty={...changed,fc_edit_session_v1:JSON.stringify({schemaVersion:4,projectId,active:true,expectedOwnerKnown:true}),
    fc_quote_offer_drafts_v1:JSON.stringify([{projectId,investorId,privateSelection:'preserved in archive'}])};
  await store.commit({scope:projectId,operationId:'old-queue',expectedVersion:1,editor,value:localValue,protectedRows:dirty,
    application:{expectedVersion:1,rows:dirty}});
  const before=await store.snapshot(projectId),image=await store.readApplication();
  const settings=refPin(computer.db,uid);
  const configured=await computer.protocol.pin.status();
  const revision=configured.configured?await computer.protocol.pin.verify(pin):(await computer.protocol.pin.save({
    expectedRevision:0,newPin:pin,confirmation:pin
  })).revision;
  const pinDoc=(await f.getDocFromServer(settings)).data();
  assert.deepEqual(Object.keys(pinDoc).sort(),['format','revision','salt','verifier']);
  assert.equal(pinDoc.salt.length,32);assert.equal(pinDoc.verifier.length,64);
  const guest=env.unauthenticatedContext().firestore(),foreign=env.authenticatedContext('different-uid').firestore();
  for(const outsider of [guest,foreign]){
    await assert.rejects(f.getDocFromServer(refPin(outsider,uid)),{code:'permission-denied'});
    await assert.rejects(f.setDoc(refPin(outsider,uid),{...pinDoc,revision:revision+1}),{code:'permission-denied'});
  }
  await assert.rejects(f.updateDoc(settings,{revision:revision+1,unexpected:true}),{code:'permission-denied'});
  const expected=await computer.protocol.projectStatus(investorId,projectId);
  const args={iid:investorId,pid:projectId,expected,deviceLabel:'Komputer w pracowni'};
  await assert.rejects(computer.protocol.advanceEditor(args),{code:'LF_P0B_PIN_CONFLICT'});
  await assert.rejects(f.updateDoc(f.doc(computer.db,'users',uid,'localFirstEditors',projectId),{epoch:editor.epoch+2,deviceId:'recover-computer'}),{code:'permission-denied'});
  const takeover=await computer.protocol.advanceEditor({...args,pinRevision:revision});
  assert.equal(takeover.epoch,editor.epoch+1);
  await assert.rejects(stagedOld.publish(),{code:'LF_EDITOR_OR_DEPENDENCY_CONFLICT'});
  const headRef=f.doc(old.db,'users',uid,'localFirstProjects',projectId);
  const oldHead=(await f.getDocFromServer(headRef)).data();
  const originalRef=f.doc(headRef,'revisions',oldHead.currentRevisionId);
  const oldRevision=(await f.getDocFromServer(originalRef)).data();
  const refusalId=crypto.randomUUID().replaceAll('-','');
  const blockedRevisionRef=f.doc(headRef,'revisions',refusalId);
  const batch=f.writeBatch(old.db);
  batch.set(blockedRevisionRef,{...oldRevision,revisionId:refusalId,generationCandidate:oldHead.generation+1,
    baseGeneration:oldHead.generation,baseRevisionId:oldHead.currentRevisionId,baseFileSha256:oldHead.fileSha256,
    baseDocumentSha256:oldHead.documentSha256,basePayloadSha256:oldHead.payloadSha256,createdAt:f.serverTimestamp()});
  for(let index=0;index<oldHead.chunkCount;index++){
    const key=String(index);
    batch.set(f.doc(blockedRevisionRef,'chunks',key),(await f.getDocFromServer(f.doc(originalRef,'chunks',key))).data());
  }
  await batch.commit();
  await assert.rejects(f.setDoc(headRef,{...oldHead,currentRevisionId:refusalId,generation:oldHead.generation+1,
    updatedAt:f.serverTimestamp()}),{code:'permission-denied'});
  assert.deepEqual((await f.getDocFromServer(headRef)).data(),oldHead);
  await assert.rejects(computer.protocol.advanceEditor({...args,pinRevision:revision}),{code:'LF_P0B_EDITOR_CONFLICT'});
  await assert.rejects(old.protocol.heartbeat(projectId,editor),{code:'LF_P0B_EDITOR_CONFLICT'});

  let advances=0;
  const service=protocol=>createP0BProjectRecovery({store,protocol,channel:remoteChannel,investorId,assertAccess(){}});
  const standard=service(old.protocol);
  const status=await standard.inspect();
  assert.equal(status.deviceLabel,'Komputer w pracowni');
  assert.equal(status.requiresPin,true);
  assert.equal(status.ownershipLost,true);
  assert.deepEqual(status.roomCopy,{available:false,unresolved:['fc_quote_offer_drafts_v1'],code:'LF_PROJECT_OWNERSHIP_PENDING'});
  await assert.rejects(standard.start({variant:'room-copy',expected:status.status,pin,confirmed:true}),{code:'LF_PROJECT_OWNERSHIP_PENDING'});
  assert.deepEqual(await old.protocol.projectStatus(investorId,projectId),status.status);
  await assert.rejects(standard.start({variant:'latest',expected:status.status,pin,confirmed:false}),{code:'LF_PROJECT_RECOVERY_CONFIRMATION_REQUIRED'});
  await assert.rejects(standard.start({variant:'latest',expected:status.status,pin:wrongPin,confirmed:true}),{code:'LF_P0B_PIN_INCORRECT'});
  assert.equal(await store.pendingProjectRecovery(projectId),null);
  assert.deepEqual(await store.snapshot(projectId),before);

  // Crash after Firestore commit, before the client acknowledges it.
  await assert.rejects(service({...old.protocol,async advanceEditor(value){
    advances++;
    await old.protocol.advanceEditor(value);
    throw Error('lost-takeover-ack');
  }}).start({variant:'latest',expected:status.status,pin,confirmed:true,deviceLabel:'Telefon'}),/lost-takeover-ack/);
  await reboot();
  const pending=await store.pendingProjectRecovery(projectId);
  assert.ok(pending);
  assert.deepEqual(await store.snapshot(projectId),before);
  const sync=createDurableSynchronizer({store,channels:[remoteChannel],eventTarget:new EventTarget()});
  try{
    const paused=await sync.flush();
    assert.equal(paused.ok,false);assert.deepEqual(paused.blockedScopes,[projectId]);
    assert.deepEqual(await store.snapshot(projectId),before);
  }finally{await sync.close();}
  await browser.evaluate(`(() => {
    const nativeAdd=IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add=function(value,...args){
      const request=nativeAdd.call(this,value,...args);
      if(this.name==='protected'&&value.key.startsWith('recovery-'))this.transaction.abort();
      return request;
    };
  })()`);
  const noReplay={...old.protocol,advanceEditor(){assert.fail('Do not replay a committed takeover');}};
  await assert.rejects(service(noReplay).resume());
  assert.deepEqual(await store.readApplication(),image);
  assert.deepEqual(await store.snapshot(projectId),before);
  assert.deepEqual(await store.pendingProjectRecovery(projectId),pending);
  await reboot();
  const result=await service(noReplay).resume();
  assert.equal(advances,1);
  assert.equal(result.editor.epoch,takeover.epoch+1);
  let local=await store.snapshot(projectId),recovered=await store.readApplication();
  assert.equal(await store.pendingProjectRecovery(projectId),null);
  assert.deepEqual(local.operations,[]);
  assert.deepEqual(local.replica.base,remote.head);
  assert.deepEqual(JSON.parse(local.replica.json),JSON.parse(JSON.stringify(remote.value)));
  assert.deepEqual(JSON.parse(recovered.rows.fc_projects_v1),[project,extraProject]);
  assert.equal(recovered.rows.fc_edit_session_v1,null);
  assert.deepEqual(JSON.parse(recovered.rows.fc_quote_offer_drafts_v1),[]);
  assert.equal(recovered.rows.fc_investors_v1,rows.fc_investors_v1);
  assert.deepEqual(JSON.parse(recovered.rows.fc_quote_snapshots_v1),history.concat(newerHistory));
  assert.equal(recovered.rows.fc_quote_rates_v1,rows.fc_quote_rates_v1);
  const archived=local.protected.find(row=>row.key===result.archiveId);
  assert.deepEqual(JSON.parse(archived.json),{kind:'project-recovery',sourceScope:projectId,
    image,replica:before.replica,operations:before.operations,receipt:result});
  for(const raw of before.protected)assert.ok(local.protected.some(row=>row.hash===raw.hash&&row.json===raw.json));
  assert.deepEqual(await remoteChannel.read(),remote,'Recovery does not publish another revision');
  await reboot();
  assert.deepEqual(await service(old.protocol).resume(),result,'Confirm the local checkpoint after a lost local ACK without replay');
  assert.deepEqual(await store.snapshot(projectId),local);

  // A free project uses the same recovery checkpoint and skips the PIN.
  await old.protocol.release({iid:investorId,pid:projectId,expectedHead:remote.head.currentRevisionId,expectedEditor:result.editor});
  const free=await service(old.protocol).inspect();
  assert.equal(free.requiresPin,false);
  // Crash before sending the operation. The exact old CAS can safely resume.
  await assert.rejects(service({...old.protocol,advanceEditor:async()=>{
    throw Error('before-takeover-send');
  }}).start({variant:'latest',expected:free.status,confirmed:true}),/before-takeover-send/);
  await reboot();
  const fromFree=await service(old.protocol).resume();
  assert.equal(fromFree.editor.epoch,result.editor.epoch+1);
  assert.equal((await store.snapshot(projectId)).operations.length,0);
  assert.equal(await store.pendingProjectRecovery(projectId),null);
  assert.deepEqual(await remoteChannel.read(),remote);
}
function refPin(db,uid){return f.doc(db,'users',uid,'p0bSettings','projectPin');}
