import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {startLocalFirstServer,openBrowserDevice} from '../helpers/local-first-browser.mjs';
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
 const source={fc_projects_v1:JSON.stringify([record]),fc_investors_v1:'[{"id":"investor","name":"Owner"}]',fc_quote_snapshots_v1:'[]',fc_company_v1:' {"exact":13.125} '};
 await browser.evaluate('window.lf.enterP0BRegistry('+JSON.stringify({...source,fc_projects_v1:'[]',fc_investors_v1:'[]'})+')');await store.initializeApplication(source);
 await store.apply({scope:'kitchen',value:{document:{payload:{project:record},integrity:{documentSha256:hash}}},head,expectedVersion:0});
 const witness=(await store.snapshot('kitchen')).replica,recordHash=await digest(record);
 const offer={id:'offer',investor:{id:'investor'},project:{id:'kitchen',investorId:'investor'},scope:{selectedRooms:['kitchen'],sourceProjects:[{projectId:'kitchen',roomId:'kitchen',investorId:'investor',recordHash,documentHash:hash,revision:head}]},lines:{materials:[{total:17.125}]},totals:{grand:17.125},calculationRegister:{version:1},meta:{selectedByClient:true,acceptedAt:1}};
 const value={kind:'p0b-room-quotes',investorId:'investor',offers:[offer],pins:{offer:[{projectId:'kitchen',recordHash,documentHash:hash,head}]}};
 const application={expectedVersion:1,rows:{...source,fc_quote_snapshots_v1:JSON.stringify([offer])}},args={scope,operationId:'quote-one',expectedVersion:0,application,value,sourceWitness:[witness]};
 const write=input=>browser.evaluate('window.lf.commitQuoteLedger('+JSON.stringify(input)+')');
 await assert.rejects(write({...args,sourceWitness:[]}),/LF_QUOTE_SOURCE_UNCONFIRMED/);
 await browser.evaluate('(()=>{const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...args){const tx=original.call(this,stores,mode,...args);if(mode==="readwrite"){IDBDatabase.prototype.transaction=original;queueMicrotask(()=>tx.abort());}return tx;};return true;})()');
 await assert.rejects(write(args),/LF_IDB_ABORTED/);assert.deepEqual((await store.readApplication()).rows,source);assert.equal((await store.snapshot(scope)).operations.length,0);
 assert.equal((await write(args)).localConfirmed,true);assert.deepEqual((await store.snapshot('kitchen')).replica,witness);
 const stable=await store.readApplication(),saved=await store.snapshot(scope);
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
 const source={fc_current_project_id_v1:'kitchen',fc_current_investor_v1:'investor',fc_projects_v1:JSON.stringify([record,{id:'foreign',investorId:'other',exact:27.125}]),fc_investors_v1:'[{"id":"investor","name":"Owner","rooms":[]},{"id":"other","name":"Protected","rooms":[]}]',fc_quote_offer_drafts_v1:JSON.stringify([draft,foreignDraft]),fc_quote_snapshots_v1:'[]',fc_company_v1:' {"exact":13.125} '};
 await browser.evaluate('window.lf.enterP0BRegistry('+JSON.stringify({...source,fc_projects_v1:'[]',fc_investors_v1:'[]'})+')');await store.initializeApplication(source);
 await store.apply({scope:'kitchen',value:{document:{payload:{project:record},integrity:{documentSha256:hash}}},head,expectedVersion:0});
 const witness=(await store.snapshot('kitchen')).replica,recordHash=await digest(record);
 const pin={projectId:'kitchen',recordHash,documentHash:hash,head};
 const first={id:'first',investor:{id:'investor'},project:{id:'kitchen',investorId:'investor'},scope:{selectedRooms:['kitchen'],sourceProjects:[{projectId:'kitchen',roomId:'kitchen',investorId:'investor',recordHash,documentHash:hash,revision:head}]},lines:{materials:[{total:17.125}]},totals:{grand:17.125},calculationRegister:{version:1},commercial:{versionName:'First',discountAmount:0},meta:{selectedByClient:true,acceptedAt:1,acceptedStage:'zaakceptowany',versionName:'First'}};
 const ledger={kind:'p0b-room-quotes',investorId:'investor',offers:[first],pins:{first:[pin]}};
 const write=args=>browser.evaluate('window.lf.commitQuoteLedger('+JSON.stringify(args)+')');
 await write({scope,operationId:'first-op',value:ledger,expectedVersion:0,sourceWitness:[witness],application:{expectedVersion:1,rows:{...source,fc_quote_snapshots_v1:JSON.stringify([first])}}});
 const before=await store.readApplication(),queued=await store.snapshot(scope);
 const second={...structuredClone(first),id:'second',totals:{grand:16.125},commercial:{versionName:'Second',discountAmount:1},meta:{selectedByClient:false,acceptedAt:0,acceptedStage:'',versionName:'Second'}};
 const next={...ledger,offers:[second,first],pins:{...ledger.pins,second:[pin]}};
 const renamed={...structuredClone(draft),commercial:{...draft.commercial,versionName:'Second'},updatedAt:2};
 const args={scope,operationId:'second-op',value:next,expectedVersion:1,sourceWitness:[witness],application:{expectedVersion:before.version,rows:{...before.rows,fc_quote_snapshots_v1:JSON.stringify(next.offers),fc_quote_offer_drafts_v1:JSON.stringify([renamed,foreignDraft])}}};
 for(const mutate of [
  a=>{const d=JSON.parse(a.application.rows.fc_quote_offer_drafts_v1);d[0].services.push({id:'unrelated'});a.application.rows.fc_quote_offer_drafts_v1=JSON.stringify(d);},
  a=>{const d=JSON.parse(a.application.rows.fc_quote_offer_drafts_v1);d[0].commercial.discountAmount=2;a.application.rows.fc_quote_offer_drafts_v1=JSON.stringify(d);},
  a=>{const d=JSON.parse(a.application.rows.fc_quote_offer_drafts_v1);d[0].selection.selectedRooms=[];a.application.rows.fc_quote_offer_drafts_v1=JSON.stringify(d);},
  a=>{const d=JSON.parse(a.application.rows.fc_quote_offer_drafts_v1);d[0].unknown.preserve=false;a.application.rows.fc_quote_offer_drafts_v1=JSON.stringify(d);},
  a=>{const d=JSON.parse(a.application.rows.fc_quote_offer_drafts_v1);d[1].commercial.versionName='Overwrite';a.application.rows.fc_quote_offer_drafts_v1=JSON.stringify(d);},
  a=>{a.application.rows.fc_current_project_id_v1='foreign';},
  a=>{a.application.rows.fc_company_v1='{"overwritten":true}';},
  a=>{a.value=structuredClone(ledger);a.application.rows.fc_quote_snapshots_v1=JSON.stringify(a.value.offers);},
 ]){
  const invalid=structuredClone(args);mutate(invalid);await assert.rejects(write(invalid),/LF_APPLICATION_SCOPE_REFUSED/);
  assert.deepEqual(await store.readApplication(),before);assert.deepEqual(await store.snapshot(scope),queued);
 }
 const tampered=structuredClone(args);tampered.value.offers[1].totals.grand=0;tampered.application.rows.fc_quote_snapshots_v1=JSON.stringify(tampered.value.offers);
 await assert.rejects(write(tampered),/LF_QUOTE_HISTORY_IMMUTABLE/);
 await assert.rejects(write({...args,expectedVersion:0}),/LF_LOCAL_CONFLICT/);
 const stale=structuredClone(args);stale.sourceWitness[0].version++;await assert.rejects(write(stale),/LF_QUOTE_SOURCE_UNCONFIRMED/);
 await browser.evaluate('(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){const result=original.call(this,value,...args);if(this.name==="control"&&value?.key==="application"&&JSON.parse(value.rows.fc_quote_snapshots_v1||"[]").length===2){IDBObjectStore.prototype.put=original;queueMicrotask(()=>this.transaction.abort());}return result;};return true;})()');
 await assert.rejects(write(args),/LF_IDB_ABORTED/);assert.deepEqual(await store.readApplication(),before);assert.deepEqual(await store.snapshot(scope),queued);
 assert.equal((await write(args)).localConfirmed,true);
 const saved=await store.readApplication(),snapshot=await store.snapshot(scope);
 assert.equal(snapshot.operations.length,2);assert.deepEqual(JSON.parse(saved.rows.fc_quote_snapshots_v1).find(row=>row.id==='first'),first);
 assert.deepEqual((await store.snapshot('kitchen')).replica,witness);
 for(const key of ['fc_projects_v1','fc_investors_v1','fc_company_v1'])assert.equal(saved.rows[key],before.rows[key]);
 assert.deepEqual(JSON.parse(saved.rows.fc_quote_offer_drafts_v1),[renamed,foreignDraft]);
 await browser.crash();browser=await openBrowserDevice(server,path.join(dir,'computer'));store=await browser.open({...binding,initialize:false});
 assert.deepEqual(await store.readApplication(),saved);assert.deepEqual(await store.snapshot(scope),snapshot);
});
