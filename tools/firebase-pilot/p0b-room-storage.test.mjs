import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {startLocalFirstServer,openBrowserDevice} from '../helpers/local-first-browser.mjs';
import {digest} from '../../sync/local-first-values.mjs';
import {quoteReservationEditor,quoteReservationMarker,quoteReservationRequest,releasedQuoteReservation} from '../../sync/quote-reservation-contract.mjs';

test('P0-B room storage: offline quotation survives conflict and restart without entering the outbox',async t=>{
 const server=await startLocalFirstServer(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'p0b-offline-quote-'));
 let browser=await openBrowserDevice(server,path.join(dir,'computer'));
 t.after(async()=>{await browser.close();await server.close();fs.rmSync(dir,{recursive:true,force:true});});
 const binding={name:'meble-lf-test-offline-quote',ownerUid:'owner',deviceId:'device',instanceId:'instance',initialize:true};
 let store=await browser.open(binding);
 const room=(id,width)=>({id,investorId:'investor',meta:{roomProject:{version:1,roomId:id}},
  projectData:{meta:{roomDefs:{[id]:{id,name:id}}}},width});
 const project=room('kitchen',85),wardrobe=room('wardrobe',120);
 const rows={fc_projects_v1:JSON.stringify([project,wardrobe]),fc_investors_v1:'[{"id":"investor","phone":"preserved"}]',
  fc_current_project_id_v1:'kitchen',fc_current_investor_v1:'investor',fc_edit_session_v1:null,
  fc_quote_snapshots_v1:'[{"id":"accepted","meta":{"acceptedAt":17}}]'};
 await browser.evaluate('window.lf.enterP0BRegistry('+JSON.stringify({fc_projects_v1:'[]',fc_investors_v1:'[]'})+')');
 await store.initializeApplication(rows);
 const owned={ownerUid:'owner',investorId:'investor',projectId:'kitchen',deviceId:'device',deviceLabel:'Computer',epoch:1,active:true,headRevision:'a'.repeat(32)};
 const base={ownerUid:'owner',investorId:'investor',projectId:'kitchen',generation:1,currentRevisionId:owned.headRevision};
 const value=project=>({document:{payload:{project,offers:[]}}});
 await store.apply({scope:'kitchen',value:value(room('kitchen',70)),head:base,editor:owned,expectedVersion:0});
 await store.commit({scope:'kitchen',value:value(project),operationId:'pending-room',expectedVersion:1,editor:owned,protectedRows:rows});
 await store.apply({scope:'wardrobe',value:value(wardrobe),head:{...base,projectId:'wardrobe'},expectedVersion:0});
 const image=await store.readApplication(),current=await store.snapshot('kitchen'),peer=await store.snapshot('wardrobe');
 const snapshot={id:'local-quote',investor:{id:'investor'},project:{id:'kitchen',investorId:'investor'},
  scope:{selectedRooms:['kitchen'],sourceProjects:[{projectId:'kitchen',roomId:'kitchen',investorId:'investor',recordHash:await digest(project)}]},
  totals:{grand:3012.54},meta:{acceptedAt:0,selectedByClient:false}};
 const save=value=>browser.evaluate('window.lf.saveOfflineQuote({...'+JSON.stringify({image,snapshot:value})+',assertCurrent(){}})');
 const list=(iid='investor')=>browser.evaluate('window.lf.readOfflineQuotes('+JSON.stringify(iid)+')');
 await assert.rejects(save({...snapshot,meta:{acceptedAt:1}}),/LF_OFFLINE_QUOTE_INVALID/);
 await assert.rejects(save({...snapshot,scope:{...snapshot.scope,sourceProjects:[{...snapshot.scope.sourceProjects[0],revision:{generation:1}}]}}),/LF_OFFLINE_QUOTE_SOURCE_INVALID/);
 await browser.evaluate('(()=>{const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...args){const tx=original.call(this,stores,mode,...args);if(mode==="readwrite"){IDBDatabase.prototype.transaction=original;queueMicrotask(()=>tx.abort());}return tx;};return true;})()');
 await assert.rejects(save(snapshot),/LF_IDB_ABORTED/);assert.deepEqual(await list(),[]);
 assert.deepEqual(await save(snapshot),{id:snapshot.id,localConfirmed:true,cloudConfirmed:false});
 await save(snapshot);
 await assert.rejects(save({...snapshot,totals:{grand:3}}),/LF_OPERATION_REUSED/);
 assert.deepEqual(await store.readApplication(),image);
 // An independently received room replaces the old image. The local quotation
 // retains exactly what was calculated and cannot be queued by this replacement.
 const remote={head:{...base,generation:2,currentRevisionId:'b'.repeat(32)},value:value(room('kitchen',60))};
 const expectedEditor={...owned,deviceId:'phone',deviceLabel:'Phone',epoch:2,headRevision:remote.head.currentRevisionId};
 const chooseRemote=(overrides={})=>browser.evaluate('window.lf.receiveConflictRemote({...'+JSON.stringify({
  scope:'kitchen',before:{image,...current},remote,expectedEditor,...overrides})+',assertAccess(){}})');
 await assert.rejects(chooseRemote({expectedEditor:owned}),/LF_ROOM_CONFLICT_WITNESS_REQUIRED/);
 await assert.rejects(chooseRemote({before:{image:{...image,version:image.version-1},...current}}),/LF_APPLICATION_INVALID|LF_APPLICATION_CONFLICT/);
 await browser.evaluate('(()=>{const original=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(value,...args){const result=original.call(this,value,...args);if(this.name==="protected"&&value?.key?.startsWith("room-conflict-")){IDBObjectStore.prototype.add=original;queueMicrotask(()=>this.transaction.abort());}return result;};return true;})()');
 await assert.rejects(chooseRemote(),/LF_IDB_ABORTED/);
 assert.deepEqual(await store.readApplication(),image);assert.deepEqual(await store.snapshot('kitchen'),current);assert.deepEqual(await list(),[snapshot]);
 const receipt=await chooseRemote();
 assert.equal(receipt.cloudConfirmed,true);assert.equal(receipt.remoteRevision,remote.head.currentRevisionId);
 await assert.rejects(chooseRemote(),/LF_ROOM_CONFLICT_CHANGED/);
 await assert.rejects(save({...snapshot,id:'stale-quote'}),/LF_OFFLINE_QUOTE_CONTEXT_CHANGED/);
 await browser.crash();browser=await openBrowserDevice(server,path.join(dir,'computer'));store=await browser.open({...binding,initialize:false});
 assert.deepEqual(await list(),[snapshot]);assert.deepEqual(await list('other'),[]);
 const rowsAfter=(await store.readApplication()).rows;
 assert.deepEqual(JSON.parse(rowsAfter.fc_projects_v1),[remote.value.document.payload.project,wardrobe]);
 assert.equal(JSON.parse(rowsAfter.fc_investors_v1)[0].phone,'preserved');
 assert.equal(rowsAfter.fc_quote_snapshots_v1,rows.fc_quote_snapshots_v1);
 assert.deepEqual(await store.snapshot('wardrobe'),peer);
 const after=await store.snapshot('kitchen');
 assert.deepEqual(after.operations,[]);assert.equal(after.replica.editor,null);assert.equal(after.replica.dirty,false);
 const archive=JSON.parse(after.protected.find(row=>row.key===receipt.archiveId).json);
 assert.deepEqual(archive.image,image);assert.deepEqual(archive.replica,current.replica);assert.deepEqual(archive.operations,current.operations);
 assert.deepEqual((await store.snapshot('p0b_offline_quotes_'+await digest('investor'))).operations,[]);
});

test('P0-B room storage: choosing local keeps one recovery after an aborted checkpoint and restart',async t=>{
 const server=await startLocalFirstServer({modules:['tools/firebase-pilot/p0b-project-recovery.mjs']});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p0b-conflict-local-'));
 let browser=await openBrowserDevice(server,path.join(dir,'computer'));
 t.after(async()=>{await browser.close();await server.close();fs.rmSync(dir,{recursive:true,force:true});});
 const binding={name:'meble-lf-test-conflict-local',ownerUid:'owner',deviceId:'computer',instanceId:'instance',initialize:true};
 let store=await browser.open(binding);
 const scope='kitchen',investorId='investor';
 const define=(width,status='nowy')=>({id:scope,investorId,status,meta:{roomProject:{version:1,roomId:scope}},
  projectData:{meta:{roomDefs:{[scope]:{id:scope,projectStatus:status}}},[scope]:{width}}});
 const contact={id:investorId,name:'Keep contact'},offers='[{"id":"accepted","meta":{"acceptedAt":17}}]';
 const value=project=>({document:{payload:{project,investor:contact,offers:[]}}});
 const rows={fc_projects_v1:JSON.stringify([define(72)]),fc_investors_v1:JSON.stringify([contact]),
  fc_current_investor_v1:investorId,fc_current_project_id_v1:scope,fc_edit_session_v1:null,fc_quote_snapshots_v1:offers};
 await browser.evaluate('window.lf.enterP0BRegistry('+JSON.stringify({fc_projects_v1:'[]',fc_investors_v1:'[]'})+')');
 await store.initializeApplication(rows);
 const editor={ownerUid:'owner',investorId,projectId:scope,deviceId:'computer',deviceLabel:'Computer',epoch:1,active:true,headRevision:'a'.repeat(32)};
 const initial={head:{ownerUid:'owner',investorId,projectId:scope,generation:1,currentRevisionId:editor.headRevision},value:value(define(60))};
 await store.apply({scope,...initial,editor,expectedVersion:0});
 await store.commit({scope,value:value(define(72)),operationId:'old-generation',expectedVersion:1,editor,protectedRows:rows});
 const base=await store.readApplication(),old=await store.snapshot(scope);
 const remote={head:{...initial.head,generation:2,currentRevisionId:'b'.repeat(32)},value:value(define(90,'zaakceptowany'))};
 remote.value.document.payload.project.projectData.meta.roomDefs[scope].lastManualProjectStatus='wycena';
 const expected={revision:remote.head.currentRevisionId,editor:{...editor,epoch:2,deviceId:'phone',deviceLabel:'Phone',headRevision:remote.head.currentRevisionId}};
 const configure=observed=>browser.evaluate(`(async ({scope,investorId,initial,remote,observed})=>{
  const {createP0BProjectRecovery}=await import('/tools/firebase-pilot/p0b-project-recovery.mjs');
  window.roomRecoveryWitness=observed; window.roomRecoveryWrites=0;
  const channel={scope,read:async()=>remote,readPinned:async head=>{if(head.currentRevisionId!==initial.head.currentRevisionId)throw Error('Wrong base');return initial;},
   async prepare(bundle,head,editor){if(head.currentRevisionId!==remote.head.currentRevisionId||editor.deviceId!=='computer')throw Error('Wrong CAS');return bundle;}};
  const protocol={projectStatus:async()=>window.roomRecoveryWitness,pin:{async verify(pin){if(pin!=='1234')throw Error('LF_P0B_PIN_INCORRECT');return 1;}},
   async advanceEditor({expected,deviceLabel,pinRevision}){if(pinRevision!==1)throw Error('PIN missing');window.roomRecoveryWrites++;
    const editor={...expected.editor,active:true,epoch:expected.editor.epoch+1,deviceId:'computer',deviceLabel,headRevision:expected.revision};
    window.roomRecoveryWitness={editor,revision:expected.revision};return editor;}};
  window.roomRecovery=createP0BProjectRecovery({store:window.lf,protocol,channel,investorId,assertAccess(){},
   roomContract:{validateProject(){},normalizeProject:project=>project,
    async build(rows){return {document:{payload:{project:JSON.parse(rows.fc_projects_v1)[0],investor:remote.value.document.payload.investor,offers:[]}}};}}});
  return true;
 })(${JSON.stringify({scope,investorId,initial,remote,observed})})`);
 await configure(expected);
 assert.equal((await browser.evaluate('window.roomRecovery.inspect()')).syncConflict,'conflict');
 const select=(pin,witness=expected)=>browser.evaluate('window.roomRecovery.start({...'+JSON.stringify({
  variant:'local-wins',expected:witness,pin,confirmed:true,deviceLabel:'Computer'})+',assertIdle(){}})');
 await assert.rejects(select('1234',{...expected,revision:initial.head.currentRevisionId}),/LF_PROJECT_RECOVERY_CONFLICT/);
 await assert.rejects(select('2345'),/LF_P0B_PIN_INCORRECT/);
 assert.equal(await browser.evaluate('window.roomRecoveryWrites'),0);
 await browser.evaluate('(()=>{const original=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(value,...args){const result=original.call(this,value,...args);if(this.name==="protected"&&value?.key?.startsWith("recovery-")){IDBObjectStore.prototype.add=original;queueMicrotask(()=>this.transaction.abort());}return result;};return true;})()');
 await assert.rejects(select('1234'),/LF_IDB_ABORTED/);
 assert.deepEqual(await store.readApplication(),base);assert.deepEqual(await store.snapshot(scope),old);
 assert.equal(await browser.evaluate('window.roomRecoveryWrites'),1);
 const observed=await browser.evaluate('window.roomRecoveryWitness');
 await browser.crash();browser=await openBrowserDevice(server,path.join(dir,'computer'));store=await browser.open({...binding,initialize:false});
 await configure(observed);
 const receipt=await browser.evaluate('window.roomRecovery.resume()');
 assert.equal(await browser.evaluate('window.roomRecoveryWrites'),0);
 assert.deepEqual(await browser.evaluate('window.roomRecovery.resume()'),receipt);
 const saved=await store.readApplication(),after=await store.snapshot(scope);
 const savedProject=define(72,'zaakceptowany');
 savedProject.projectData.meta.roomDefs[scope].lastManualProjectStatus='wycena';
 assert.deepEqual(JSON.parse(saved.rows.fc_projects_v1),[savedProject]);
 assert.equal(saved.rows.fc_quote_snapshots_v1,offers);assert.equal(JSON.parse(saved.rows.fc_investors_v1)[0].name,contact.name);
 assert.equal(after.operations.length,1);assert.equal(after.operations[0].key,receipt.operationId);
 assert.equal(after.operations[0].phase,'queued');assert.deepEqual(after.operations[0].base,remote.head);
 assert.equal((await store.pendingHandover(scope)).epoch,observed.editor.epoch);
 const archived=JSON.parse(after.protected.find(row=>row.key===receipt.archiveId).json);
 assert.deepEqual(archived.image,base);assert.deepEqual(archived.operations,old.operations);
 assert.deepEqual(archived.replacedRemote,{head:remote.head,document:remote.value.document});
});

test('P0-B room storage: reservation intents keep the same token until a verified release survives restart',async t=>{
 const server=await startLocalFirstServer(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'p0b-reservation-journal-'));
 let browser=await openBrowserDevice(server,path.join(dir,'computer'));
 t.after(async()=>{await browser.close();await server.close();fs.rmSync(dir,{recursive:true,force:true});});
 const binding={name:'meble-lf-test-reservation-journal',ownerUid:'owner',deviceId:'receiver',instanceId:'instance',initialize:true};
 let store=await browser.open(binding);
 const projectId='kitchen',investorId='investor',revision='a'.repeat(32);
 const room={id:projectId,investorId,meta:{roomProject:{version:1,roomId:projectId}}};
 const wardrobe={id:'wardrobe',investorId,meta:{roomProject:{version:1,roomId:'wardrobe'}}};
 const rows={fc_projects_v1:JSON.stringify([room,wardrobe]),fc_current_investor_v1:investorId,fc_edit_session_v1:null,
  fc_investors_v1:'[{"id":"investor"}]',fc_quote_snapshots_v1:'[{"id":"frozen"}]'};
 await browser.evaluate('window.lf.enterP0BRegistry('+JSON.stringify({fc_projects_v1:'[]',fc_investors_v1:'[]'})+')');
 await store.initializeApplication(rows);
 const source=await store.readApplication();
 const intent={key:'quote-reservation:'+projectId,version:1,operationId:crypto.randomUUID(),token:crypto.randomUUID(),
  ownerUid:binding.ownerUid,deviceId:binding.deviceId,deviceLabel:'Receiver',investorId,projectId,mode:'free',pinRevision:null,
  expected:{revision,editor:{ownerUid:binding.ownerUid,investorId,projectId,deviceId:'phone',deviceLabel:'Phone',epoch:1,active:false,headRevision:revision}}};
 const commit=(method,args)=>browser.evaluate('window.lf['+JSON.stringify(method)+']({...'+JSON.stringify(args)+',assertAccess(){}})');
 const list=()=>browser.evaluate('window.lf.pendingQuoteReservations()');
 const stage=()=>commit('stageQuoteReservation',{intent,image:source});
 const abandoned={...intent,operationId:crypto.randomUUID(),token:crypto.randomUUID()};
 const unsent=await commit('stageQuoteReservation',{intent:abandoned,image:source});
 const transition=(name,row)=>browser.evaluate('window.lf['+JSON.stringify(name)+']('+JSON.stringify(row)+',()=>{})');
 assert.equal(unsent.sent,false);
 await transition('cancelUnsentQuoteReservation',unsent);
 assert.deepEqual(await list(),[]);
 const staged=await stage();assert.equal(staged.phase,'prepared');assert.deepEqual(await stage(),staged);
 const sent=await transition('markQuoteReservationSent',staged);
 assert.equal(sent.sent,true);
 await assert.rejects(transition('cancelUnsentQuoteReservation',sent),/LF_QUOTE_RESERVATION_UNCONFIRMED/);
 await assert.rejects(commit('stageQuoteReservation',{intent:{...intent,token:crypto.randomUUID()},image:source}),/LF_QUOTE_RESERVATION_PENDING/);
 const status={editor:quoteReservationEditor(intent),revision},marker=quoteReservationMarker(intent);
 await assert.rejects(commit('confirmQuoteReservation',{expected:sent,observed:{status,marker:{...marker,epoch:3}}}),/LF_QUOTE_RESERVATION_UNCONFIRMED/);
 const held=await commit('confirmQuoteReservation',{expected:sent,observed:{status,marker}});
 const releasing=await browser.evaluate('window.lf.beginQuoteReservationRelease('+JSON.stringify(held)+',()=>{})');
 const donorEditor={...intent.expected.editor,active:true,deviceId:binding.deviceId,deviceLabel:'Receiver',
  projectId:wardrobe.id,epoch:7};
 const donorIntent={...intent,key:'quote-reservation:wardrobe',projectId:wardrobe.id,operationId:crypto.randomUUID(),token:crypto.randomUUID(),
  mode:'request',deviceId:'phone',deviceLabel:'Phone',expected:{editor:donorEditor,revision}};
 const request=quoteReservationRequest(donorIntent),published={currentRevisionId:revision};
 await store.apply({scope:wardrobe.id,expectedVersion:0,head:published,value:{project:wardrobe},editor:donorEditor});
 const donorSnapshot=await store.snapshot(wardrobe.id),grants=()=>browser.evaluate('window.lf.pendingQuoteGrants()');
 const grant=await commit('stageQuoteGrant',{request,image:source,replica:donorSnapshot.replica});
 const ordinaryRelease=()=>browser.evaluate('window.lf.setEditor("wardrobe",'+donorSnapshot.replica.version+','+JSON.stringify(donorEditor)+','+JSON.stringify({...donorEditor,active:false})+')');
 await assert.rejects(ordinaryRelease(),/LF_QUOTE_ROOM_RESERVED/);

 await browser.crash();browser=await openBrowserDevice(server,path.join(dir,'computer'));store=await browser.open({...binding,initialize:false});
 assert.deepEqual(await grants(),[grant]);
 await assert.rejects(ordinaryRelease(),/LF_QUOTE_ROOM_RESERVED/);
 const grantProof={status:{editor:quoteReservationEditor(donorIntent,revision),revision},
  marker:quoteReservationMarker(donorIntent,revision),request:{...request,state:'granted',revision}};
 await assert.rejects(commit('finishQuoteGrant',{expected:grant,observed:{...grantProof,
  marker:{...grantProof.marker,token:crypto.randomUUID()}}}),/LF_QUOTE_RESERVATION_UNCONFIRMED/);
 assert.deepEqual((await store.snapshot(wardrobe.id)).replica,donorSnapshot.replica);
 assert.equal((await commit('finishQuoteGrant',{expected:grant,observed:grantProof})).granted,true);
 const donorAfter=await store.snapshot(wardrobe.id);
 assert.deepEqual(await grants(),[]);assert.deepEqual(donorAfter.operations,[]);
 assert.deepEqual(donorAfter.replica,{...donorSnapshot.replica,version:donorSnapshot.replica.version+1,editor:null});
 assert.ok(donorAfter.protected.some(row=>row.key==='quote-grant-receipt:'+request.requestId));
 assert.deepEqual(await list(),[releasing]);
 const released=releasedQuoteReservation(status,marker);
 await assert.rejects(commit('finishQuoteReservation',{expected:releasing,observed:{...released,marker:{...released.marker,token:crypto.randomUUID()}}}),/LF_QUOTE_RESERVATION_UNCONFIRMED/);
 await browser.evaluate('(()=>{const put=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(value,...args){const result=put.call(this,value,...args);if(this.name==="protected"&&value?.key?.startsWith("quote-reservation-receipt:")){IDBObjectStore.prototype.add=put;queueMicrotask(()=>this.transaction.abort());}return result;};return true;})()');
 await assert.rejects(commit('finishQuoteReservation',{expected:releasing,observed:released}),/LF_IDB_ABORTED/);
 assert.deepEqual(await list(),[releasing]);
 const outcome=await commit('finishQuoteReservation',{expected:releasing,observed:released});
 assert.equal(outcome.localConfirmed,true);assert.deepEqual(await list(),[]);
 const state=await store.snapshot(projectId);
 assert.deepEqual(state.operations,[]);assert.equal(state.replica,null);
 assert.deepEqual(JSON.parse(state.protected.find(row=>row.key===outcome.key).json),{version:1,expected:releasing,observed:released});
 assert.deepEqual(await store.readApplication(),source);
});

test('P0-B room storage: P1 queued saves coalesce atomically with durable RAW, restart and uncertain-generation protection',async t=>{
 const server=await startLocalFirstServer(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'p1-room-batch-')),profile=path.join(dir,'computer');
 let browser=await openBrowserDevice(server,profile);
 t.after(async()=>{await browser.close();await server.close();fs.rmSync(dir,{recursive:true,force:true});});
 const binding={name:'meble-lf-test-p1-room-batch',ownerUid:'p1-owner',deviceId:'p1-device',instanceId:'p1-instance',initialize:true};
 let store=await browser.open(binding);const editor={active:true,deviceId:binding.deviceId,epoch:1};
 const room=(id,value)=>({id,investorId:'investor',meta:{roomProject:{version:1,roomId:id}},value});
 const source={fc_projects_v1:JSON.stringify([room('kitchen',1),room('wardrobe',13)]),fc_investors_v1:'[{"id":"investor","rooms":[]}]',fc_company_v1:' {"price":17.125} '};
 await browser.evaluate('window.lf.enterP0BRegistry('+JSON.stringify({...source,fc_projects_v1:'[]',fc_investors_v1:'[]'})+')');
 await store.initializeApplication(source);
 await store.apply({scope:'kitchen',value:{document:{payload:{project:room('kitchen',1),offers:[]}},globals:{pin:1}},head:{generation:1},expectedVersion:0,editor});
 const write=async(id,value)=>{
  const image=await store.readApplication(),snap=await store.snapshot('kitchen');
  const record=room('kitchen',value),rows={...image.rows,fc_projects_v1:JSON.stringify([record,room('wardrobe',13)])};
  const args={entries:[{scope:'kitchen',operationId:id,expectedVersion:snap.replica.version,editor,batchable:true,value:{document:{payload:{project:record,offers:[]}},globals:{pin:1}}}],application:{expectedVersion:image.version,rows}};
  return {args,result:await browser.evaluate('window.lf.commitRoomBatch('+JSON.stringify(args)+')')};
 };
 const first=await write('p1-save-a',2),before=await store.snapshot('kitchen'),image=await store.readApplication();
 assert.equal(first.result.localConfirmed,true);assert.equal(first.result.cloudConfirmed,false);
 assert.equal(before.operations.length,1);assert.equal(before.operations[0].batch.version,1);
 await browser.evaluate('(()=>{const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...args){const tx=original.call(this,stores,mode,...args);if(mode==="readwrite"){IDBDatabase.prototype.transaction=original;queueMicrotask(()=>tx.abort());}return tx;};return true;})()');
 await assert.rejects(write('p1-aborted',3),/LF_IDB_ABORTED/);
 assert.deepEqual(await store.snapshot('kitchen'),before);assert.deepEqual(await store.readApplication(),image);
 const second=await write('p1-save-b',4),after=await store.snapshot('kitchen');
 assert.equal(after.operations.length,1);assert.equal(after.operations[0].key,'p1-save-b');assert.equal(after.operations[0].previousOperation,null);
 assert.equal(after.operations[0].batch.firstAt,before.operations[0].batch.firstAt);
 assert.deepEqual(after.protected.map(row=>row.key).sort(),['p1-save-a','p1-save-b']);
 const archive=await browser.evaluate('new Promise((resolve,reject)=>{const q=indexedDB.open('+JSON.stringify(binding.name)+');q.onsuccess=()=>{const db=q.result,tx=db.transaction("control","readonly"),r=tx.objectStore("control").get("p1-coalesced:p1-save-a");r.onsuccess=()=>resolve(r.result);tx.oncomplete=()=>db.close();};q.onerror=()=>reject(q.error);})');
 assert.deepEqual(archive.operation,before.operations[0]);assert.equal(archive.replacedBy,'p1-save-b');assert.equal(archive.operation.phase,'queued');
 const proof=op=>browser.evaluate('window.lf.wasProjectCoalesced('+JSON.stringify(op)+')');
 assert.equal(await proof(before.operations[0]),true);assert.equal(await proof({...before.operations[0],hash:'b'.repeat(64)}),false);assert.equal(await proof(after.operations[0]),false);

 const duplicate=await browser.evaluate('window.lf.commitRoomBatch('+JSON.stringify(first.args)+')');assert.equal(duplicate.duplicate,true);assert.equal(duplicate.cloudConfirmed,false);
 assert.deepEqual(await store.snapshot('kitchen'),after);
 await browser.close();browser=await openBrowserDevice(server,profile);store=await browser.open({...binding,initialize:false});
 assert.deepEqual(await store.snapshot('kitchen'),after);assert.equal((await store.readApplication()).rows.fc_company_v1,source.fc_company_v1);
 assert.equal(JSON.parse((await store.readApplication()).rows.fc_projects_v1)[1].value,13);
 await store.transition('p1-save-b','queued','inflight',{expected:{generation:2}});
 const inflight=(await store.snapshot('kitchen')).operations[0];await write('p1-save-c',5);
 assert.deepEqual((await store.snapshot('kitchen')).operations.find(op=>op.key==='p1-save-b'),inflight);
 await store.transition('p1-save-b','inflight','uncertain');const uncertain=(await store.snapshot('kitchen')).operations.find(op=>op.key==='p1-save-b');
 await write('p1-save-d',6);const pending=(await store.snapshot('kitchen')).operations;
 assert.equal(pending.length,2);assert.deepEqual(pending.find(op=>op.key==='p1-save-b'),uncertain);
 assert.equal(pending.find(op=>op.key==='p1-save-d').previousOperation,'p1-save-b');
 assert.equal(second.result.localConfirmed,true);
});
test('P0-B room storage: batch abort, per-room CAS and foreign/global protection are atomic in IndexedDB',async t=>{
 const server=await startLocalFirstServer(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'p0b-room-atomic-'));
 const browser=await openBrowserDevice(server,path.join(dir,'computer'));
 t.after(async()=>{await browser.close();await server.close();fs.rmSync(dir,{recursive:true,force:true});});
 const binding={name:'meble-lf-test-room-atomic',ownerUid:'room-owner',deviceId:'room-device',instanceId:'room-instance',initialize:true};
 const store=await browser.open(binding),editor={active:true,deviceId:binding.deviceId,epoch:1};
 const record=id=>({id,investorId:'investor',meta:{roomProject:{version:1,roomId:id}},value:1});
 const records=['kitchen','wardrobe','protected'].map(record),source={fc_projects_v1:JSON.stringify(records),fc_investors_v1:'[{"id":"investor","phone":"111","rooms":[]}]',fc_company_v1:' {"exact":17.125} '};
 await browser.evaluate('window.lf.enterP0BRegistry('+JSON.stringify({...source,fc_projects_v1:'[]',fc_investors_v1:'[]'})+')');await store.initializeApplication(source);
 for(const row of records)await store.apply({scope:row.id,value:{document:{payload:{project:row}}},head:{generation:1},expectedVersion:0,editor});
 const next=records.map(row=>row.id==='protected'?row:{...row,value:2});
 const entries=next.filter(row=>row.id!=='protected').map(row=>({scope:row.id,operationId:'save-'+row.id,expectedVersion:1,editor,value:{document:{payload:{project:row}}}}));
 const application={expectedVersion:1,rows:{...source,fc_projects_v1:JSON.stringify(next)}};
 const write=args=>browser.evaluate('window.lf.commitRoomBatch('+JSON.stringify(args)+')');
 await browser.evaluate('(()=>{const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...args){const tx=original.call(this,stores,mode,...args);if(mode==="readwrite"){IDBDatabase.prototype.transaction=original;queueMicrotask(()=>tx.abort());}return tx;};return true;})()');
 await assert.rejects(write({entries,application}),/LF_IDB_ABORTED/);
 assert.deepEqual((await store.readApplication()).rows,source);for(const row of records)assert.equal((await store.snapshot(row.id)).operations.length,0);
 const receipt=await write({entries,application});assert.equal(receipt.localConfirmed,true);assert.equal(receipt.cloudConfirmed,false);
 assert.deepEqual((await store.readApplication()).rows,application.rows);assert.equal((await store.snapshot('protected')).replica.version,1);
 for(const scope of ['kitchen','wardrobe']){const snapshot=await store.snapshot(scope);assert.equal(snapshot.operations.length,1);assert.equal(snapshot.operations[0].phase,'queued');assert.equal(snapshot.replica.version,2);}
 const stable=await store.readApplication();
 await assert.rejects(write({entries:entries.map(row=>({...row,operationId:row.operationId+'-stale'})),application:{...application,expectedVersion:stable.version}}),/LF_LOCAL_CONFLICT/);
 const stolen={...application.rows,fc_company_v1:'{"changed":true}'};
 await assert.rejects(write({entries:entries.map(row=>({...row,expectedVersion:2,operationId:row.operationId+'-foreign'})),application:{expectedVersion:stable.version,rows:stolen}}),/LF_APPLICATION_SCOPE_REFUSED/);
 assert.deepEqual(await store.readApplication(),stable);for(const scope of ['kitchen','wardrobe'])assert.equal((await store.snapshot(scope)).operations.length,1);
});

test('P0-B room storage: quote history abort, source proof, CAS, frozen content and tombstone protect IndexedDB',async t=>{
 const server=await startLocalFirstServer(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'p0b-quote-atomic-'));
 let browser=await openBrowserDevice(server,path.join(dir,'computer'));
 t.after(async()=>{await browser.close();await server.close();fs.rmSync(dir,{recursive:true,force:true});});
 const binding={name:'meble-lf-test-quote-atomic',ownerUid:'quote-owner',deviceId:'quote-device',instanceId:'quote-instance',initialize:true};
 let store=await browser.open(binding);
 const {digest}=await import('../../sync/local-first-values.mjs'),{quoteScope}=await import('../../sync/local-first-quote-contract.mjs');
 const scope=await quoteScope('investor'),hash='a'.repeat(64),record={id:'kitchen',investorId:'investor',cabinets:[{id:'cab',width:66}]};
 const head={generation:1,projectId:'kitchen',investorId:'investor',currentRevisionId:'b'.repeat(32),documentSha256:hash,roomDeleted:false};
 const source={fc_projects_v1:JSON.stringify([record]),fc_investors_v1:'[{"id":"investor","name":"Owner","rooms":[]}]',fc_quote_snapshots_v1:'[]',fc_company_v1:' {"exact":13.125} '};
 await browser.evaluate('window.lf.enterP0BRegistry('+JSON.stringify({...source,fc_projects_v1:'[]',fc_investors_v1:'[]'})+')');await store.initializeApplication(source);
 await store.apply({scope:'kitchen',value:{document:{payload:{project:record},integrity:{documentSha256:hash}}},head,expectedVersion:0});
 const witness=(await store.snapshot('kitchen')).replica,recordHash=await digest(record);
 const offer={id:'offer',investor:{id:'investor'},project:{id:'kitchen',investorId:'investor'},scope:{selectedRooms:['kitchen'],sourceProjects:[{projectId:'kitchen',roomId:'kitchen',investorId:'investor',recordHash,documentHash:hash,revision:head}]},lines:{materials:[{total:17.125}]},totals:{grand:17.125},calculationRegister:{version:1},meta:{selectedByClient:true,acceptedAt:1}};
 const value={kind:'p0b-room-quotes',investorId:'investor',offers:[offer],pins:{offer:[{projectId:'kitchen',recordHash,documentHash:hash,head}]}};
 const application={expectedVersion:1,rows:{...source,fc_quote_snapshots_v1:JSON.stringify([offer])}},args={scope,operationId:'quote-one',expectedVersion:0,application,value,sourceWitness:[witness]};
 const write=input=>browser.evaluate('window.lf.commitQuoteLedger('+JSON.stringify(input)+')');
 await assert.rejects(write({...args,sourceWitness:[]}),/LF_QUOTE_SOURCE_UNCONFIRMED/);
 await assert.rejects(write({...args,generationOnly:true}),/LF_QUOTE_HISTORY_IMMUTABLE/);
 await assert.rejects(write({...args,generationOnly:true,rooms:[{scope:'kitchen'}]}),/LF_APPLICATION_SCOPE_REFUSED/);
 await browser.evaluate('(()=>{const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...args){const tx=original.call(this,stores,mode,...args);if(mode==="readwrite"){IDBDatabase.prototype.transaction=original;queueMicrotask(()=>tx.abort());}return tx;};return true;})()');
 await assert.rejects(write(args),/LF_IDB_ABORTED/);assert.deepEqual((await store.readApplication()).rows,source);assert.equal((await store.snapshot(scope)).operations.length,0);
 assert.equal((await write(args)).localConfirmed,true);assert.deepEqual((await store.snapshot('kitchen')).replica,witness);
 const stable=await store.readApplication(),saved=await store.snapshot(scope);
 await assert.rejects(write({...args,generationOnly:true,expectedVersion:saved.replica.version,operationId:'changed-readonly-owner',application:{expectedVersion:stable.version,rows:{...stable.rows,fc_current_investor_v1:'other'}}}),/LF_APPLICATION_SCOPE_REFUSED/);
 await assert.rejects(write({...args,operationId:'stale',application:{...application,expectedVersion:stable.version}}),/LF_LOCAL_CONFLICT/);
 const tampered=structuredClone(value);tampered.offers[0].totals.grand=1;
 await assert.rejects(write({...args,expectedVersion:1,operationId:'tampered',value:tampered,application:{expectedVersion:stable.version,rows:{...application.rows,fc_quote_snapshots_v1:JSON.stringify(tampered.offers)}}}),/LF_QUOTE_HISTORY_IMMUTABLE/);
 await assert.rejects(write({...args,expectedVersion:1,operationId:'foreign',application:{expectedVersion:stable.version,rows:{...application.rows,fc_company_v1:'{"changed":true}'}}}),/LF_APPLICATION_SCOPE_REFUSED/);
 assert.deepEqual(await store.readApplication(),stable);assert.deepEqual(await store.snapshot(scope),saved);
 await browser.crash();browser=await openBrowserDevice(server,path.join(dir,'computer'));store=await browser.open({...binding,initialize:false});
 assert.deepEqual(await store.readApplication(),stable);assert.deepEqual(await store.snapshot(scope),saved);
 await browser.evaluate('window.lf.fenceP0BTombstones('+JSON.stringify([{ownerUid:binding.ownerUid,investorId:'investor',schemaVersion:1,deletionId:'deleted',generation:2,projects:{kitchen:false}}])+')');
 assert.equal(await browser.evaluate('window.lf.retired('+JSON.stringify(scope)+')'),true);
 assert.deepEqual(await store.snapshot(scope),saved,'Tombstone archives rather than erases unsent history/outbox');
 const quarantine=(await store.snapshot('p0b-archives')).protected.map(row=>JSON.parse(row.json)).find(row=>row.kind==='p0b-deletion-quarantine');
 assert.ok(quarantine.operations.some(row=>row.scope===scope&&row.key==='quote-one'));
 await assert.rejects(write({...args,expectedVersion:1,operationId:'resurrection',application:{...application,expectedVersion:stable.version}}),/LF_P0B_SCOPE_RETIRED/);
 assert.equal((await store.readApplication()).rows.fc_company_v1,source.fc_company_v1);
});


test('P0-B room storage: accepted quote and all room statuses share CAS, abort and restart boundaries',async t=>{
 const server=await startLocalFirstServer(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'p0b-acceptance-atomic-'));
 let browser=await openBrowserDevice(server,path.join(dir,'computer'));
 t.after(async()=>{await browser.close();await server.close();fs.rmSync(dir,{recursive:true,force:true});});
 const binding={name:'meble-lf-test-acceptance-atomic',ownerUid:'accept-owner',deviceId:'accept-device',instanceId:'accept-instance',initialize:true};
 let store=await browser.open(binding);
 const {digest}=await import('../../sync/local-first-values.mjs'),{quoteScope}=await import('../../sync/local-first-quote-contract.mjs');
 const scope=await quoteScope('investor'),hash='a'.repeat(64),editor={active:true,deviceId:binding.deviceId,epoch:1};
 const records=['kitchen','wardrobe','protected'].map(id=>({id,investorId:'investor',status:'nowy',updatedAt:1,meta:{roomProject:{version:1,roomId:id}},
  projectData:{meta:{roomDefs:{[id]:{id,projectStatus:'nowy'}}},[id]:{cabinets:[{id:'cab-'+id,width:66}],settings:{unknown:17.125}}}}));
 const head=id=>({generation:1,projectId:id,investorId:'investor',currentRevisionId:'b'.repeat(32),documentSha256:hash,roomDeleted:false});
 const refs=await Promise.all(records.slice(0,2).map(async record=>({projectId:record.id,roomId:record.id,investorId:'investor',recordHash:await digest(record),documentHash:hash,revision:head(record.id)})));
 const offer={id:'offer',investor:{id:'investor'},project:{id:'kitchen',investorId:'investor',status:'nowy'},scope:{selectedRooms:['kitchen','wardrobe'],sourceProjects:refs},lines:{materials:[{total:17.125}]},totals:{grand:17.125},calculationRegister:{version:1},meta:{selectedByClient:false,acceptedAt:0}};
 const previous={kind:'p0b-room-quotes',investorId:'investor',offers:[offer],pins:{offer:refs.map(ref=>({projectId:ref.projectId,recordHash:ref.recordHash,documentHash:hash,head:ref.revision}))}};
 const investor={id:'investor',name:'Protected contact',unknown:{exact:13.125},rooms:records.map(row=>({id:row.id,name:row.id,projectStatus:'nowy'}))};
 const source={fc_projects_v1:JSON.stringify(records),fc_investors_v1:JSON.stringify([investor]),fc_quote_snapshots_v1:JSON.stringify([offer]),fc_company_v1:' {"exact":13.125} '};
 await browser.evaluate('window.lf.enterP0BRegistry('+JSON.stringify({...source,fc_projects_v1:'[]',fc_investors_v1:'[]',fc_quote_snapshots_v1:'[]'})+')');await store.initializeApplication(source);
 for(const record of records)await store.apply({scope:record.id,value:{document:{payload:{project:record},integrity:{documentSha256:hash}}},head:head(record.id),expectedVersion:0,editor});
 await store.apply({scope,value:previous,head:{generation:1,revisionId:'c'.repeat(32)},expectedVersion:0});
 const next=structuredClone(records);for(const record of next.slice(0,2)){record.status='zaakceptowany';record.updatedAt=2;record.projectData.meta.projectStatus='zaakceptowany';record.projectData.meta.roomDefs[record.id].projectStatus='zaakceptowany';}
 const accepted=structuredClone(offer);accepted.meta.selectedByClient=true;accepted.meta.acceptedAt=2;accepted.project.status='zaakceptowany';
 const value={...previous,offers:[accepted]},nextInvestor=structuredClone(investor);for(const room of nextInvestor.rooms.slice(0,2))room.projectStatus='zaakceptowany';
 const application={expectedVersion:1,rows:{...source,fc_projects_v1:JSON.stringify(next),fc_investors_v1:JSON.stringify([nextInvestor]),fc_quote_snapshots_v1:JSON.stringify([accepted])}};
 const rooms=next.slice(0,2).map(record=>({scope:record.id,operationId:'status-'+record.id,expectedVersion:1,editor,value:{document:{payload:{project:record},integrity:{documentSha256:hash}}}}));
 const args={scope,operationId:'accept-quote',expectedVersion:1,application,value,rooms};
 const write=input=>browser.evaluate('window.lf.commitQuoteLedger('+JSON.stringify(input)+')');
 const before={image:await store.readApplication(),states:await Promise.all([scope,...records.map(row=>row.id)].map(id=>store.snapshot(id)))};
 const unchanged=async()=>{assert.deepEqual(await store.readApplication(),before.image);assert.deepEqual(await Promise.all([scope,...records.map(row=>row.id)].map(id=>store.snapshot(id))),before.states);};
 await assert.rejects(write({...args,rooms:rooms.map(row=>row.scope==='wardrobe'?{...row,expectedVersion:0}:row)}),/LF_LOCAL_CONFLICT/);await unchanged();
 await assert.rejects(write({...args,rooms:rooms.map(row=>row.scope==='wardrobe'?{...row,editor:{...editor,epoch:2}}:row)}),/LF_EDITOR_REQUIRED/);await unchanged();
 const altered=structuredClone(args);altered.rooms[0].value.document.payload.project.projectData.kitchen.settings.unknown=999;
 const changedProjects=JSON.parse(altered.application.rows.fc_projects_v1);changedProjects[0].projectData.kitchen.settings.unknown=999;altered.application.rows.fc_projects_v1=JSON.stringify(changedProjects);
 await assert.rejects(write(altered),/LF_APPLICATION_SCOPE_REFUSED/);await unchanged();
 await assert.rejects(write({...args,application:{...application,expectedVersion:2}}),/LF_APPLICATION_CONFLICT/);await unchanged();
 await browser.evaluate('(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){const result=original.call(this,value,...args);if(this.name==="control"&&value?.key==="application"){IDBObjectStore.prototype.put=original;queueMicrotask(()=>this.transaction.abort());}return result;};return true;})()');
 await assert.rejects(write(args),/LF_IDB_ABORTED/);await unchanged();
 const result=await write(args);assert.equal(result.localConfirmed,true);assert.equal(result.cloudConfirmed,false);
 const quote=await store.snapshot(scope);assert.equal(quote.operations.length,1);assert.equal(quote.operations[0].dependencies.length,2);
 for(const row of rooms){const state=await store.snapshot(row.scope);assert.equal(state.operations.length,1);assert.equal(state.operations[0].applicationHash,quote.operations[0].applicationHash);assert.equal(quote.operations[0].dependencies.find(dep=>dep.scope===row.scope).hash,state.operations[0].hash);}
 assert.deepEqual((await store.snapshot('protected')),before.states[3]);
 await browser.crash();browser=await openBrowserDevice(server,path.join(dir,'computer'));store=await browser.open({...binding,initialize:false});
 assert.deepEqual((await store.readApplication()).rows,application.rows);
 assert.deepEqual((await store.snapshot(scope)),quote);for(const row of rooms)assert.equal((await store.snapshot(row.scope)).operations.length,1);
 assert.equal((await store.readApplication()).rows.fc_company_v1,source.fc_company_v1);
});

test('P0-B room storage: variant naming is atomic and cannot change settings or another owner',async t=>{
 const server=await startLocalFirstServer(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'p0b-variant-atomic-'));
 let browser=await openBrowserDevice(server,path.join(dir,'computer'));
 t.after(async()=>{await browser.close();await server.close();fs.rmSync(dir,{recursive:true,force:true});});
 const binding={name:'meble-lf-test-variant-atomic',ownerUid:'variant-owner',deviceId:'variant-device',instanceId:'variant-instance',initialize:true};
 let store=await browser.open(binding);
 const {digest}=await import('../../sync/local-first-values.mjs'),{quoteScope}=await import('../../sync/local-first-quote-contract.mjs');
 const scope=await quoteScope('investor'),hash='a'.repeat(64),record={id:'kitchen',investorId:'investor',unknown:{exact:13.125}};
 const head={generation:1,projectId:'kitchen',investorId:'investor',currentRevisionId:'b'.repeat(32),documentSha256:hash,roomDeleted:false};
 const draft={projectId:'kitchen',investorId:'investor',helperHours:0,services:[],rateSelections:[],selection:{selectedRooms:['kitchen']},commercial:{versionName:'First',discountAmount:1,unknown:{exact:17.125}},updatedAt:1,unknown:{preserve:true}};
 const foreignDraft={...structuredClone(draft),projectId:'foreign',investorId:'other'};
 const foreignOffer={id:'foreign-offer',investor:{id:'other'},project:{id:'foreign',investorId:'other'},totals:{grand:717.125},meta:{selectedByClient:true,privateExtension:{exact:27.125}}};
 const history=offers=>JSON.stringify([...offers,foreignOffer]);
 const source={fc_current_project_id_v1:'kitchen',fc_current_investor_v1:'investor',fc_projects_v1:JSON.stringify([record,{id:'foreign',investorId:'other',exact:27.125}]),fc_investors_v1:'[{"id":"investor","name":"Owner","rooms":[]},{"id":"other","name":"Protected","rooms":[]}]',fc_quote_offer_drafts_v1:JSON.stringify([draft,foreignDraft]),fc_quote_snapshots_v1:history([]),fc_company_v1:' {"exact":13.125} '};
 await browser.evaluate('window.lf.enterP0BRegistry('+JSON.stringify({...source,fc_projects_v1:'[]',fc_investors_v1:'[]'})+')');await store.initializeApplication(source);
 await store.apply({scope:'kitchen',value:{document:{payload:{project:record},integrity:{documentSha256:hash}}},head,expectedVersion:0});
 const witness=(await store.snapshot('kitchen')).replica,recordHash=await digest(record);
 const pin={projectId:'kitchen',recordHash,documentHash:hash,head};
 const first={id:'first',investor:{id:'investor'},project:{id:'kitchen',investorId:'investor'},scope:{selectedRooms:['kitchen'],sourceProjects:[{projectId:'kitchen',roomId:'kitchen',investorId:'investor',recordHash,documentHash:hash,revision:head}]},lines:{materials:[{total:17.125}]},totals:{grand:17.125},calculationRegister:{version:1},commercial:{versionName:'First',discountAmount:0},meta:{selectedByClient:true,acceptedAt:1,acceptedStage:'zaakceptowany',versionName:'First'}};
 const ledger={kind:'p0b-room-quotes',investorId:'investor',offers:[first],pins:{first:[pin]}};
 const write=args=>browser.evaluate('window.lf.commitQuoteLedger('+JSON.stringify(args)+')');
 await write({scope,operationId:'first-op',value:ledger,expectedVersion:0,sourceWitness:[witness],application:{expectedVersion:1,rows:{...source,fc_quote_snapshots_v1:history([first])}}});
 const before=await store.readApplication(),queued=await store.snapshot(scope);
 const second={...structuredClone(first),id:'second',totals:{grand:16.125},commercial:{versionName:'Second',discountAmount:1},meta:{selectedByClient:false,acceptedAt:0,acceptedStage:'',versionName:'Second'}};
 const next={...ledger,offers:[second,first],pins:{...ledger.pins,second:[pin]}};
 const renamed={...structuredClone(draft),commercial:{...draft.commercial,versionName:'Second'},updatedAt:2};
 const args={scope,operationId:'second-op',value:next,expectedVersion:1,sourceWitness:[witness],application:{expectedVersion:before.version,rows:{...before.rows,fc_quote_snapshots_v1:history(next.offers),fc_quote_offer_drafts_v1:JSON.stringify([renamed,foreignDraft])}}};
 for(const mutate of [
  a=>{const d=JSON.parse(a.application.rows.fc_quote_offer_drafts_v1);d[0].services.push({id:'unrelated'});a.application.rows.fc_quote_offer_drafts_v1=JSON.stringify(d);},
  a=>{const d=JSON.parse(a.application.rows.fc_quote_offer_drafts_v1);d[0].commercial.discountAmount=2;a.application.rows.fc_quote_offer_drafts_v1=JSON.stringify(d);},
  a=>{const d=JSON.parse(a.application.rows.fc_quote_offer_drafts_v1);d[0].selection.selectedRooms=[];a.application.rows.fc_quote_offer_drafts_v1=JSON.stringify(d);},
  a=>{const d=JSON.parse(a.application.rows.fc_quote_offer_drafts_v1);d[0].unknown.preserve=false;a.application.rows.fc_quote_offer_drafts_v1=JSON.stringify(d);},
  a=>{const d=JSON.parse(a.application.rows.fc_quote_offer_drafts_v1);d[1].commercial.versionName='Overwrite';a.application.rows.fc_quote_offer_drafts_v1=JSON.stringify(d);},
  a=>{a.application.rows.fc_current_project_id_v1='foreign';},
  a=>{a.application.rows.fc_company_v1='{"overwritten":true}';},
  a=>{a.value=structuredClone(ledger);a.application.rows.fc_quote_snapshots_v1=history(a.value.offers);},
 ]){
  const invalid=structuredClone(args);mutate(invalid);await assert.rejects(write(invalid),/LF_APPLICATION_SCOPE_REFUSED/);
  assert.deepEqual(await store.readApplication(),before);assert.deepEqual(await store.snapshot(scope),queued);
 }
 const foreignChanged=structuredClone(args),foreignRows=JSON.parse(foreignChanged.application.rows.fc_quote_snapshots_v1);
 foreignRows.find(row=>row.id==='foreign-offer').totals.grand=0;foreignChanged.application.rows.fc_quote_snapshots_v1=JSON.stringify(foreignRows);
 await assert.rejects(write(foreignChanged),/LF_QUOTE_OWNER_CHANGED/);
 assert.deepEqual(await store.readApplication(),before);assert.deepEqual(await store.snapshot(scope),queued);
 const tampered=structuredClone(args);tampered.value.offers[1].totals.grand=0;tampered.application.rows.fc_quote_snapshots_v1=history(tampered.value.offers);
 await assert.rejects(write(tampered),/LF_QUOTE_HISTORY_IMMUTABLE/);
 await assert.rejects(write({...args,expectedVersion:0}),/LF_LOCAL_CONFLICT/);
 const stale=structuredClone(args);stale.sourceWitness[0].version++;await assert.rejects(write(stale),/LF_QUOTE_SOURCE_UNCONFIRMED/);
 await browser.evaluate('(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){const result=original.call(this,value,...args);if(this.name==="control"&&value?.key==="application"&&JSON.parse(value.rows.fc_quote_snapshots_v1||"[]").some(row=>row.id==="second")){IDBObjectStore.prototype.put=original;queueMicrotask(()=>this.transaction.abort());}return result;};return true;})()');
 await assert.rejects(write(args),/LF_IDB_ABORTED/);assert.deepEqual(await store.readApplication(),before);assert.deepEqual(await store.snapshot(scope),queued);
 assert.equal((await write(args)).localConfirmed,true);
 const saved=await store.readApplication(),snapshot=await store.snapshot(scope);
 assert.equal(snapshot.operations.length,2);assert.deepEqual(JSON.parse(saved.rows.fc_quote_snapshots_v1).find(row=>row.id==='first'),first);
 assert.deepEqual(JSON.parse(saved.rows.fc_quote_snapshots_v1).find(row=>row.id==='foreign-offer'),foreignOffer);
 assert.deepEqual((await store.snapshot('kitchen')).replica,witness);
 for(const key of ['fc_projects_v1','fc_investors_v1','fc_company_v1'])assert.equal(saved.rows[key],before.rows[key]);
 assert.deepEqual(JSON.parse(saved.rows.fc_quote_offer_drafts_v1),[renamed,foreignDraft]);
 await browser.crash();browser=await openBrowserDevice(server,path.join(dir,'computer'));store=await browser.open({...binding,initialize:false});
 assert.deepEqual(await store.readApplication(),saved);assert.deepEqual(await store.snapshot(scope),snapshot);
});

test('P0-B room storage: PIN release intents are atomic, restartable and preserve room drafts/outboxes',async t=>{
 const server=await startLocalFirstServer(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'p0b-quote-release-'));
 let browser=await openBrowserDevice(server,path.join(dir,'computer'));
 t.after(async()=>{await browser.close();await server.close();fs.rmSync(dir,{recursive:true,force:true});});
 const binding={name:'meble-lf-test-quote-release',ownerUid:'owner',deviceId:'receiver',instanceId:'instance',initialize:true};
 let store=await browser.open(binding);
 const records=['kitchen','wardrobe'].map(id=>({id,investorId:'investor',meta:{roomProject:{version:1,roomId:id}},unknown:{exact:17.125}}));
 const source={fc_projects_v1:JSON.stringify(records),fc_investors_v1:'[{"id":"investor","rooms":[]}]',fc_current_investor_v1:'investor',fc_company_v1:' {"exact":13.125} '};
 await browser.evaluate('window.lf.enterP0BRegistry('+JSON.stringify({...source,fc_projects_v1:'[]',fc_investors_v1:'[]'})+')');await store.initializeApplication(source);
 for(const row of records)await store.apply({scope:row.id,value:{document:{payload:{project:row}}},head:{generation:1},expectedVersion:0});
 const call=(method,...args)=>browser.evaluate('window.lf['+JSON.stringify(method)+'](...'+JSON.stringify(args)+')');
 const application=await store.readApplication(),before=await Promise.all(records.map(row=>store.snapshot(row.id)));
 const expected=projectId=>({revision:'a'.repeat(32),editor:{ownerUid:binding.ownerUid,investorId:'investor',projectId,deviceId:'other-device',deviceLabel:'Other',active:true,epoch:3,headRevision:'a'.repeat(32)}});
 const args={investorId:'investor',targets:records.map(row=>({projectId:row.id,expected:expected(row.id)})),pinRevision:1,deviceLabel:'Receiver',application};
 const pending=()=>call('pendingQuoteReleases');
 await assert.rejects(call('stageQuoteReleases',{...args,application:{...application,version:0}}),/LF_QUOTE_RELEASE_SOURCE_CHANGED/);assert.deepEqual(await pending(),[]);
 await assert.rejects(call('stageQuoteReleases',{...args,targets:[...args.targets,{projectId:'foreign',expected:expected('foreign')}]}),/LF_APPLICATION_SCOPE_REFUSED/);assert.deepEqual(await pending(),[]);
 await browser.evaluate('(()=>{const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...args){const tx=original.call(this,stores,mode,...args);if(mode==="readwrite"){IDBDatabase.prototype.transaction=original;queueMicrotask(()=>tx.abort());}return tx;};return true;})()');
 await assert.rejects(call('stageQuoteReleases',args),/LF_IDB_ABORTED/);assert.deepEqual(await pending(),[]);
 const staged=await call('stageQuoteReleases',args);assert.equal(staged.length,2);assert.deepEqual(await store.readApplication(),application);
 await assert.rejects(call('stageQuoteReleases',args),/LF_QUOTE_RELEASE_PENDING/);
 await browser.crash();browser=await openBrowserDevice(server,path.join(dir,'computer'));store=await browser.open({...binding,initialize:false});assert.deepEqual(await pending(),staged);
 const {quoteReleaseEditor}=await import('../../sync/local-first-quote-release.mjs');
 const row=staged[0],observed={revision:row.expected.revision,editor:{...quoteReleaseEditor(row),active:false}};
 await browser.evaluate('(()=>{const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...args){const tx=original.call(this,stores,mode,...args);if(mode==="readwrite"){IDBDatabase.prototype.transaction=original;queueMicrotask(()=>tx.abort());}return tx;};return true;})()');
 await assert.rejects(call('finishQuoteRelease',row,'released',observed),/LF_IDB_ABORTED/);assert.deepEqual(await pending(),staged);
 await call('finishQuoteRelease',row,'released',observed);assert.equal((await pending()).length,1);
 await assert.rejects(call('finishQuoteRelease',row,'released',observed),/LF_QUOTE_RELEASE_SOURCE_CHANGED/);
 for(let i=0;i<records.length;i++)assert.deepEqual(await store.snapshot(records[i].id),before[i]);assert.deepEqual(await store.readApplication(),application);
 const control=await browser.evaluate('new Promise((resolve,reject)=>{const q=indexedDB.open('+JSON.stringify(binding.name)+');q.onsuccess=()=>{const db=q.result,tx=db.transaction("control","readonly"),r=tx.objectStore("control").getAll();r.onsuccess=()=>resolve(r.result);tx.oncomplete=()=>db.close();};q.onerror=()=>reject(q.error);})');
 const receipt=control.find(r=>r.key==='quote-release-done:'+row.operationId+':'+row.projectId);assert.deepEqual(receipt.observed,observed);assert.deepEqual(receipt.intent,row);
});
