import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {prepareRoomCopy} from '../../sync/local-first-room-copy.mjs';
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
  const clone=value=>JSON.parse(JSON.stringify(value));
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
  const room=clone(FC.schema.DEFAULT_PROJECT.kuchnia);
  room.cabinets=[
    {id:'base-cabinet',type:'stojąca',subType:'standardowa',width:60,height:82,depth:51,frontCount:2,
      bodyColor:'Synthetic white',frontMaterial:'laminat',frontColor:'Synthetic white',backMaterial:'',
      bodyPcvMode:'body',details:{shelves:3}},
    {id:'set-cabinet',type:'stojąca',subType:'standardowa',width:30,height:72,depth:51,frontCount:2,
      bodyColor:'Synthetic white',frontMaterial:'laminat',frontColor:'Synthetic white',backMaterial:'',
      setId:'set-source',setPreset:'A',setNumber:1,details:{shelves:1}},
  ];
  room.sets=[{id:'set-source',presetId:'A',number:1,frontCount:2,params:{w1:30,w2:30,hB:72,hTop:20},
    frontMaterial:'laminat',frontColor:'Synthetic white'}];
  room.fronts=[
    {id:'front-one',cabId:'base-cabinet',width:30,height:72,material:'laminat',color:'Synthetic white'},
    {id:'front-two',cabId:'base-cabinet',width:30,height:72,material:'laminat',color:'Synthetic white'},
    {id:'front-set-left',setId:'set-source',setNumber:1,width:30,height:92,material:'laminat',color:'Synthetic white'},
    {id:'front-set-right',setId:'set-source',setNumber:1,width:30,height:92,material:'laminat',color:'Synthetic white'},
  ];
  const edges={w1:true,w2:false,h1:true,h2:false};
  room.production={partOverrides:{'base-cabinet':{'body.side.left':{edges}}},
    setGroupOverrides:{'set-source':{'front.A.left':{edges}}}};
  room.layout={activeSegmentId:'segment-source',segments:[{id:'segment-source',name:'Ściana',rows:{
    base:[{kind:'cabinet',id:'base-cabinet'},{kind:'gap',id:'gap-source',width:5,label:'Przerwa'},{kind:'cabinet',id:'set-cabinet'}],
    module:[],wall:[],
  }}]};
  const roomDefinition=id=>({id,baseType:'kuchnia',name:id,label:id});
  const project={id:projectId,investorId,title:'Potwierdzony projekt',
    projectData:{schemaVersion:12,meta:{assignedInvestorId:investorId,productionPcvMode:'project',
      roomOrder:['kitchen','wardrobe'],roomDefs:{kitchen:roomDefinition('kitchen'),wardrobe:roomDefinition('wardrobe')}},
      kitchen:room,wardrobe:{...clone(room),cabinets:[],fronts:[],sets:[],production:{},layout:{segments:[]}}}};
  Object.assign(project,clone(FC.projectModel.summarizeProjectData(project.projectData)));
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
  assert.deepEqual(status.roomCopy,{available:false,unresolved:['room-contract'],code:'LF_PROJECT_OWNERSHIP_PENDING'});
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

  // Room-only recovery retains the confirmed original rooms and publishes one
  // normal outbox operation, with persisted IDs across crashes.
  const roomContract={
    validateRoom:value=>FC.projectExportContract.validateOwnedRoom(value),
    summarize:data=>clone(FC.projectModel.summarizeProjectData(data)),
    async build(image,received){
      const built=await FC.businessProjectContract.build({getItem:key=>{
        if(key==='fc_investors_v1'){
          const all=JSON.parse(image[key]);
          return JSON.stringify(all.map(row=>row.id===investorId?received.value.document.payload.investor:row));
        }
        return image[key]??null;
      }},projectId);
      return {document:built.document,globals:received.value.globals,
        requirements:FC.businessProjectContract.dependencies(built.document.payload)};
    },
  };
  const copying=protocol=>createP0BProjectRecovery({store,protocol,channel:remoteChannel,investorId,assertAccess(){},roomContract});
  const draftImage=await store.readApplication();
  const editedProject=clone(project);
  editedProject.projectData.kitchen.cabinets[0].width=64;
  for(const front of editedProject.projectData.kitchen.fronts.filter(row=>row.cabId==='base-cabinet'))front.width=32;
  editedProject.projectData.kitchen.settings.roomHeight=277.125;
  const roomDraftRows={...draftImage.rows,
    fc_projects_v1:JSON.stringify([editedProject,extraProject]),
    fc_edit_session_v1:JSON.stringify({schemaVersion:4,projectId,roomId:'kitchen',active:true,expectedOwnerKnown:true}),
    fc_quote_offer_drafts_v1:JSON.stringify([{projectId,investorId,selection:{selectedRooms:['kitchen','wardrobe']},note:'Recalculate later'}]),
  };
  const beforeUnsent=await store.snapshot(projectId);
  const unsentValue=await makeValue({...roomDraftRows,fc_edit_session_v1:null,fc_quote_offer_drafts_v1:'[]'});
  await store.commit({scope:projectId,operationId:'queued-kitchen',expectedVersion:beforeUnsent.replica.version,
    editor:beforeUnsent.replica.editor,value:unsentValue,protectedRows:roomDraftRows,
    application:{expectedVersion:draftImage.version,rows:roomDraftRows}});
  let draftSource=await store.readApplication();
  const preCopy=await store.snapshot(projectId);
  const request={rows:roomDraftRows,baseline:remote.value,scope:projectId,
    roomId:'kitchen',name:'Kuchnia — odzyskana',validateRoom:roomContract.validateRoom};
  const extraChange=clone(roomDraftRows),changedElsewhere=JSON.parse(extraChange.fc_projects_v1);
  changedElsewhere[0].projectData.wardrobe.settings.roomHeight=999;
  extraChange.fc_projects_v1=JSON.stringify(changedElsewhere);
  assert.throws(()=>prepareRoomCopy({...request,rows:extraChange}),{code:'LF_ROOM_COPY_OTHER_CHANGES'});
  assert.throws(()=>prepareRoomCopy({...request,newId:()=> 'base-cabinet'}),{code:'LF_ROOM_COPY_ID_COLLISION'});
  const extension=clone(roomDraftRows),extensionRecords=JSON.parse(extension.fc_projects_v1);
  extensionRecords[0].projectData.kitchen.futureReference='base-cabinet';
  extension.fc_projects_v1=JSON.stringify(extensionRecords);
  assert.throws(()=>prepareRoomCopy({...request,rows:extension}),{code:'LF_ROOM_COPY_REFERENCE_UNCONFIRMED'});

  const current=await computer.protocol.projectStatus(investorId,projectId);
  const newerEditor=await computer.protocol.advanceEditor({iid:investorId,pid:projectId,expected:current,
    pinRevision:await computer.protocol.pin.verify(pin),deviceLabel:'Komputer'});
  const computerChannel=channel(computer,'recover-computer');
  t.after(()=>computerChannel.close());
  const newerProject=clone(project);
  newerProject.projectData.wardrobe.settings.roomHeight=301.125;
  const serverRows={...rows,fc_projects_v1:JSON.stringify([newerProject,extraProject]),
    fc_quote_snapshots_v1:JSON.stringify(history.concat(newerHistory))};
  await (await computerChannel.prepare(await makeValue(serverRows),remote.head,newerEditor)).publish();
  const latestRemote=await remoteChannel.read();
  const pinned=await remoteChannel.readPinned(preCopy.replica.base);
  assert.equal(pinned.head.currentRevisionId,remote.head.currentRevisionId);
  assert.notEqual(pinned.head.currentRevisionId,latestRemote.head.currentRevisionId);
  assert.deepEqual(clone(pinned.value),clone(remote.value),'Read exactly the last confirmed revision, including validated pinned catalogs');
  await assert.rejects(remoteChannel.readPinned({...preCopy.replica.base,currentRevisionId:'0'.repeat(32)}),{code:'LF_PROJECT_BASE_INCOMPLETE'});
  await assert.rejects(remoteChannel.readPinned({...preCopy.replica.base,fileSha256:'0'.repeat(64)}),{code:'CLOUD_INTEGRITY_INVALID'});
  await assert.rejects(remoteChannel.readPinned({...preCopy.replica.base,projectId:'foreign'}),{code:'CLOUD_BASE_INVALID'});
  const copyStatus=await copying(old.protocol).inspect();
  const withoutBaseReader=createP0BProjectRecovery({store,protocol:old.protocol,channel:{...remoteChannel,readPinned:undefined},
    investorId,assertAccess(){},roomContract});
  await assert.rejects(withoutBaseReader.start({variant:'room-copy',roomId:'kitchen',roomName:request.name,
    expected:copyStatus.status,pin,confirmed:true}),{code:'LF_ROOM_COPY_BASE_UNCONFIRMED'});
  assert.equal(await store.pendingProjectRecovery(projectId),null);
  assert.equal(copyStatus.requiresPin,true);
  assert.equal(copyStatus.roomCopy.available,true,'Project quote draft does not prevent a room copy');
  const technicalKeys=['fc_edge_v1','fc_material_part_options_v1','fc_rozrys_grain_state_v1','fc_rozrys_overrides_v1'];
  const technicalRows={...roomDraftRows,...Object.fromEntries(technicalKeys.map(key=>[key,'{"unresolved-signature":{"edges":{"w1":true}}}']))};
  await store.checkpointApplication({expectedVersion:draftSource.version,rows:technicalRows});
  const unresolvedImage=await store.readApplication();
  assert.deepEqual((await copying(old.protocol).inspect()).roomCopy.unresolved,technicalKeys);
  await assert.rejects(copying(old.protocol).start({variant:'room-copy',roomId:'kitchen',roomName:request.name,
    expected:copyStatus.status,pin,confirmed:true}),{code:'LF_PROJECT_OWNERSHIP_PENDING'});
  assert.deepEqual(await store.readApplication(),unresolvedImage);
  assert.equal(await store.pendingProjectRecovery(projectId),null);
  assert.deepEqual(await old.protocol.projectStatus(investorId,projectId),copyStatus.status);
  await store.checkpointApplication({expectedVersion:unresolvedImage.version,rows:roomDraftRows});
  draftSource=await store.readApplication();
  await f.disableNetwork(old.db);
  await assert.rejects(copying(old.protocol).start({variant:'room-copy',roomId:'kitchen',roomName:request.name,
    expected:copyStatus.status,pin,confirmed:true}));
  await f.enableNetwork(old.db);
  assert.deepEqual(await store.readApplication(),draftSource);
  assert.equal(await store.pendingProjectRecovery(projectId),null);

  // Use the existing panel/confirmation controls in real Chromium.
  async function recoveryUI(protocol){
    const playwright=await chromium.connectOverCDP(browser.endpoint);
    const page=playwright.contexts()[0].pages()[0];
    for(const file of ['ui/data-settings-dom','ui/panel-box','ui/confirm-box'])
      await page.evaluate(fs.readFileSync(new URL('../../js/app/'+file+'.js',import.meta.url),'utf8'));
    await page.exposeFunction('__inspectRecovery',()=>copying(protocol).inspect());
    await page.exposeFunction('__startRecovery',async options=>{
      try{return {ok:true,receipt:await copying(protocol).start(options)};}
      catch(error){return {ok:false,code:error.code||error.message};}
    });
    await page.evaluate(async()=>{
      const {openProjectRecovery}=await import('/sync/local-first-recovery-view.mjs');
      await openProjectRecovery({window,roomId:'kitchen',roomName:'Kuchnia — odzyskana',deviceLabel:'Telefon',
        service:{inspect:()=>window.__inspectRecovery(),async start(options){
          const response=await window.__startRecovery(options);
          if(!response.ok)throw Object.assign(Error(response.code),{code:response.code});
          return response.receipt;
        }},onConfirmed:receipt=>{window.copyReceipt=receipt;}});
    });
    return page;
  }
  let lostCopyAck=false;
  const page=await recoveryUI({...old.protocol,async advanceEditor(args){
    await old.protocol.advanceEditor(args);
    lostCopyAck=true;
    throw Object.assign(Error('Synthetic lost copy ACK'),{code:'LF_TEST_COPY_ACK_LOST'});
  }});
  await page.getByLabel('PIN przejęcia').fill(pin);
  await page.getByLabel('Nazwa kopii pomieszczenia').fill(request.name);
  await page.getByRole('button',{name:'Zachowaj kopię pomieszczenia',exact:true}).click();
  await page.getByRole('button',{name:'Odzyskaj projekt',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent.includes('Odzyskiwanie wstrzymane.'));
  assert.equal(lostCopyAck,true,'The server committed takeover before the injected ACK loss');
  assert.match(await page.getByRole('status').textContent(),/LF_TEST_COPY_ACK_LOST/);
  const serverCopy=await old.protocol.projectStatus(investorId,projectId);
  assert.equal(serverCopy.editor.deviceId,store.deviceId);
  assert.equal(serverCopy.editor.epoch,copyStatus.status.editor.epoch+1);
  const pendingCopy=await store.pendingProjectRecovery(projectId);
  assert.equal(pendingCopy.variant,'room-copy');
  assert.deepEqual(pendingCopy.roomCopy.confirmedBase.head,preCopy.replica.base);
  assert.equal(preCopy.replica.dirty,true);
  assert.deepEqual(preCopy.operations.map(op=>op.phase),['queued']);
  assert.deepEqual(await store.readApplication(),draftSource,'Lost ACK retains the complete local draft');
  const stableId=pendingCopy.roomCopy.id;
  await reboot();
  await browser.evaluate(`(() => {
    const nativeAdd=IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add=function(value,...args){
      const request=nativeAdd.call(this,value,...args);
      if(this.name==='outbox'&&value.key.startsWith('room-copy-'))this.transaction.abort();
      return request;
    };
  })()`);
  await assert.rejects(copying(old.protocol).resume());
  assert.deepEqual(await store.readApplication(),draftSource);
  assert.deepEqual(await store.snapshot(projectId),preCopy,'Abort must not partially replace the source or queue');
  assert.deepEqual(await store.pendingProjectRecovery(projectId),pendingCopy);
  await reboot();
  const copied=await copying({...old.protocol,advanceEditor(){assert.fail('No replay after server ACK');}}).resume();
  assert.equal(copied.roomId,stableId);
  const copiedImage=await store.readApplication(),copySnap=await store.snapshot(projectId);
  assert.equal(copySnap.replica.dirty,true);
  assert.deepEqual(copySnap.operations.map(op=>[op.key,op.phase]),[[copied.operationId,'queued']]);
  assert.equal(copySnap.replica.base.currentRevisionId,latestRemote.head.currentRevisionId);
  const merged=JSON.parse(copiedImage.rows.fc_projects_v1)[0];
  assert.deepEqual(merged.projectData.kitchen,newerProject.projectData.kitchen);
  assert.deepEqual(merged.projectData.wardrobe,newerProject.projectData.wardrobe);
  assert.deepEqual(JSON.parse(copiedImage.rows.fc_projects_v1)[1],extraProject);
  const recoveredRoom=merged.projectData[stableId],map=pendingCopy.roomCopy.mapping;
  assert.equal(recoveredRoom.cabinets[0].id,map['base-cabinet']);
  assert.equal(recoveredRoom.cabinets[1].setId,map['set-source']);
  assert.equal(recoveredRoom.fronts[0].cabId,map['base-cabinet']);
  assert.equal(recoveredRoom.fronts[2].setId,map['set-source']);
  assert.equal(recoveredRoom.layout.segments[0].rows.base[0].id,map['base-cabinet']);
  assert.equal(recoveredRoom.layout.activeSegmentId,map['segment-source']);
  assert.deepEqual(recoveredRoom.production.partOverrides[map['base-cabinet']],room.production.partOverrides['base-cabinet']);
  assert.deepEqual(recoveredRoom.production.setGroupOverrides[map['set-source']],room.production.setGroupOverrides['set-source']);
  assert.equal(recoveredRoom.cabinets[0].width,64);
  assert.equal(recoveredRoom.settings.roomHeight,277.125);
  const reverse=Object.fromEntries(Object.entries(map).map(([oldId,newId])=>[newId,oldId]));
  const restore=value=>{
    if(typeof value==='string')return reverse[value]||value;
    if(Array.isArray(value))return value.map(restore);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[reverse[key]||key,restore(item)]));
    return value;
  };
  assert.deepEqual(restore(recoveredRoom),editedProject.projectData.kitchen,'Every saved room field survives identity remapping');
  assert.equal(Object.values(map).length,new Set(Object.values(map)).size);
  assert.equal(Object.values(map).some(value=>Object.hasOwn(map,value)),false);
  assert.equal(copiedImage.rows.fc_quote_rates_v1,draftSource.rows.fc_quote_rates_v1);
  assert.equal(copiedImage.rows.fc_investors_v1,draftSource.rows.fc_investors_v1);
  assert.deepEqual(JSON.parse(copiedImage.rows.fc_quote_snapshots_v1),history.concat(newerHistory));
  assert.deepEqual(JSON.parse(copiedImage.rows.fc_quote_offer_drafts_v1),[]);
  const archivedCopy=JSON.parse(copySnap.protected.find(row=>row.key===copied.archiveId).json);
  assert.equal(archivedCopy.image.rows.fc_quote_offer_drafts_v1,roomDraftRows.fc_quote_offer_drafts_v1);
  assert.deepEqual(archivedCopy.operations,preCopy.operations);
  await reboot();
  assert.deepEqual(await copying(old.protocol).resume(),copied);
  assert.equal((await store.snapshot(projectId)).operations.length,1);
  let online=false;
  const copySync=createDurableSynchronizer({store,channels:[remoteChannel],eventTarget:new EventTarget(),online:()=>online});
  try{
    assert.equal((await copySync.flush()).code,'LF_OFFLINE');
    assert.equal((await remoteChannel.read()).head.generation,latestRemote.head.generation);
    online=true;
    assert.equal((await copySync.flush()).ok,true);
    const afterAck=await store.snapshot(projectId);
    assert.equal(afterAck.operations[0].phase,'verified');
    const received=await computerChannel.read();
    assert.equal(received.head.generation,latestRemote.head.generation+1);
    assert.deepEqual(clone(received.value.document.payload.project),merged);
    assert.equal((await copySync.flush()).ok,true);
    assert.equal((await computerChannel.read()).head.generation,received.head.generation,'No duplicate room publication');
  }finally{await copySync.close();}
  const lastHead=await remoteChannel.read(),lastEditor=(await old.protocol.projectStatus(investorId,projectId)).editor;
  await old.protocol.release({iid:investorId,pid:projectId,expectedHead:lastHead.head.currentRevisionId,expectedEditor:lastEditor});
  const latestPage=await recoveryUI(old.protocol);
  assert.equal(await latestPage.getByLabel('PIN przejęcia').count(),0,'Free project requires no PIN');
  await latestPage.getByRole('button',{name:'Pobierz najnowszą wersję',exact:true}).click();
  await latestPage.getByRole('button',{name:'Odzyskaj projekt',exact:true}).click();
  await latestPage.waitForFunction(()=>!!window.copyReceipt);
  assert.deepEqual(JSON.parse((await store.readApplication()).rows.fc_projects_v1)[0],merged);
  assert.deepEqual((await store.snapshot(projectId)).operations,[]);
  assert.deepEqual(await remoteChannel.read(),lastHead,'Latest option does not publish a project');

  for(const phase of ['inflight','uncertain']){
    const startImage=await store.readApplication(),startReplica=await store.snapshot(projectId);
    const confirmed=await remoteChannel.read();
    const localProject=clone(confirmed.value.document.payload.project);
    localProject.projectData.kitchen.cabinets[0].width+=2;
    for(const front of localProject.projectData.kitchen.fronts.filter(row=>row.cabId==='base-cabinet'))front.width+=1;
    const pendingRows={...startImage.rows,fc_projects_v1:JSON.stringify(
      JSON.parse(startImage.rows.fc_projects_v1).map(row=>row.id===projectId?localProject:row))};
    const pendingValue=await roomContract.build(pendingRows,confirmed);
    const operationId='unsent-kitchen-'+phase;
    await store.commit({scope:projectId,operationId,expectedVersion:startReplica.replica.version,
      editor:startReplica.replica.editor,value:pendingValue,protectedRows:pendingRows,
      application:{expectedVersion:startImage.version,rows:pendingRows}});
    const publication=await remoteChannel.prepare(pendingValue,confirmed.head,startReplica.replica.editor);
    await store.transition(operationId,'queued','inflight',{expected:publication.expected});
    if(phase==='uncertain'){
      await publication.publish();
      await store.transition(operationId,'inflight','uncertain',{code:'LF_ACK_UNRESOLVED'});
    }
    await reboot();
    const unchangedSource=await store.readApplication(),oldQueue=await store.snapshot(projectId);
    assert.equal(oldQueue.replica.dirty,true);
    assert.equal(oldQueue.operations.at(-1).phase,phase);
    assert.deepEqual(oldQueue.replica.base,confirmed.head,'Uncertain publication is not its own acknowledged base');

    const phoneWitness=await computer.protocol.projectStatus(investorId,projectId);
    const phoneEditor=await computer.protocol.advanceEditor({iid:investorId,pid:projectId,expected:phoneWitness,
      pinRevision:await computer.protocol.pin.verify(pin),deviceLabel:'Telefon'});
    const phoneBase=await computerChannel.read(),phoneProject=clone(phoneBase.value.document.payload.project);
    phoneProject.projectData.kitchen.settings.roomHeight+=5;
    phoneProject.projectData.wardrobe.settings.roomHeight+=3;
    const phoneRows={...unchangedSource.rows,fc_projects_v1:JSON.stringify(
      JSON.parse(unchangedSource.rows.fc_projects_v1).map(row=>row.id===projectId?phoneProject:row))};
    await (await computerChannel.prepare(await roomContract.build(phoneRows,phoneBase),phoneBase.head,phoneEditor)).publish();
    const newest=await remoteChannel.read(),currentStatus=await copying(old.protocol).inspect();

    // Neither a stale observation nor an unrelated local room may be discarded.
    await assert.rejects(copying(old.protocol).start({variant:'room-copy',roomId:'kitchen',roomName:'Odzyskana '+phase,
      expected:phoneWitness,pin,confirmed:true}),{code:'LF_PROJECT_RECOVERY_CONFLICT'});
    const foreignChange=JSON.parse(unchangedSource.rows.fc_projects_v1);
    foreignChange[0].projectData.wardrobe.settings.roomHeight+=99;
    await store.checkpointApplication({expectedVersion:unchangedSource.version,rows:{
      ...unchangedSource.rows,fc_projects_v1:JSON.stringify(foreignChange)
    }});
    const foreignImage=await store.readApplication();
    await assert.rejects(copying(old.protocol).start({variant:'room-copy',roomId:'kitchen',roomName:'Odzyskana '+phase,
      expected:currentStatus.status,pin,confirmed:true}),{code:'LF_ROOM_COPY_OTHER_CHANGES'});
    assert.deepEqual(await store.readApplication(),foreignImage);
    assert.deepEqual(await store.snapshot(projectId),oldQueue);
    assert.equal(await store.pendingProjectRecovery(projectId),null);
    assert.deepEqual(await old.protocol.projectStatus(investorId,projectId),currentStatus.status);
    await store.checkpointApplication({expectedVersion:foreignImage.version,rows:unchangedSource.rows});

    const recoveredPending=await copying(old.protocol).start({variant:'room-copy',roomId:'kitchen',roomName:'Odzyskana '+phase,
      expected:currentStatus.status,pin,confirmed:true,deviceLabel:'Komputer'});
    await assert.rejects(publication.publish(),{code:phase==='uncertain'?'CLOUD_WRITE_CONFLICT':'LF_EDITOR_OR_DEPENDENCY_CONFLICT'},phase);
    assert.deepEqual((await remoteChannel.read()).head,newest.head,'The stale publication cannot replace the newer head');
    const pendingSnapshot=await store.snapshot(projectId);
    assert.deepEqual(pendingSnapshot.operations.map(row=>[row.key,row.phase]),[[recoveredPending.operationId,'queued']]);
    const archived=JSON.parse(pendingSnapshot.protected.find(row=>row.key===recoveredPending.archiveId).json);
    assert.deepEqual(archived.operations,oldQueue.operations);
    const mergedProject=JSON.parse((await store.readApplication()).rows.fc_projects_v1)[0];
    for(const roomId of phoneProject.projectData.meta.roomOrder)
      assert.deepEqual(mergedProject.projectData[roomId],phoneProject.projectData[roomId]);
    assert.equal(mergedProject.projectData[recoveredPending.roomId].cabinets[0].width,localProject.projectData.kitchen.cabinets[0].width);
    assert.equal(mergedProject.projectData[recoveredPending.roomId].settings.roomHeight,localProject.projectData.kitchen.settings.roomHeight);

    let writes=0;
    const lostAckChannel={...remoteChannel,async prepare(...args){
      const prepared=await remoteChannel.prepare(...args);
      return {...prepared,async publish(){
        writes++;await prepared.publish();
        throw Object.assign(Error('Synthetic copy ACK loss'),{code:'unavailable'});
      }};
    }};
    const uncertainSync=createDurableSynchronizer({store,channels:[lostAckChannel],eventTarget:new EventTarget()});
    try{
      assert.equal((await uncertainSync.flush()).ok,false);
      assert.equal((await store.snapshot(projectId)).operations[0].phase,'uncertain');
      assert.equal(writes,1);
    }finally{await uncertainSync.close();}
    await reboot();
    assert.deepEqual(await copying(old.protocol).resume(),recoveredPending);
    const receiptSync=createDurableSynchronizer({store,channels:[remoteChannel],eventTarget:new EventTarget()});
    try{
      assert.equal((await receiptSync.flush()).ok,true);
      const snapshot=await store.snapshot(projectId);
      assert.equal(snapshot.operations.length,1);
      assert.equal(snapshot.operations[0].phase,'verified');
      assert.equal(snapshot.replica.dirty,false);
      const received=await computerChannel.read();
      assert.equal(received.head.generation,newest.head.generation+1);
      assert.deepEqual(clone(received.value.document.payload.project),mergedProject);
      assert.equal(writes,1,'Restart resolves the uncertain copy by reading, without republishing');
    }finally{await receiptSync.close();}
  }
}
function refPin(db,uid){return f.doc(db,'users',uid,'p0bSettings','projectPin');}
