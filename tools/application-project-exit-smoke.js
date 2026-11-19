'use strict';
// Real session/navigation/autosave/authority; synthetic owner, no Firebase I/O.
const assert=require('node:assert/strict'),{setup}=require('./investor-navigation-exit-smoke');
async function fixture({draftBoot=false,loading=false,corruptDraft=false,receipt={localConfirmed:true,cloudConfirmed:false,operationId:'queued'}}={}){
 let timer,abort=false,published=0;const r=setup({timers:{setTimeout:fn=>{timer=fn;return 1;},clearTimeout(){}}}),w=r.s,fc=r.FC;
 const list=JSON.parse(r.storage.getItem('fc_projects_v1'));for(const row of list)row.projectData.meta.productionPcvMode='project';r.storage.setItem('fc_projects_v1',JSON.stringify(list));w.projectData=fc.project.load();
 fc.globalDataContract=require('./helpers/code-global-catalogs').buildCodeCatalogs().context.FC.globalDataContract;
 w.location.hostname='localhost';w.__FC_MAIN_ACCESS__={assert(){},isValid:()=>true,isLoading:()=>loading};w.addEventListener=()=>{};
 const {applicationKeys,installOfflineEmulatorApplicationAuthority,createApplicationActionBinding}=await import('../sync/application-authority.mjs');
 if(draftBoot)assert.equal(await r.open(),true);
 if(corruptDraft){const raw=JSON.parse(r.storage.getItem('fc_edit_session_v1'));raw.expectedOwnerKnown=false;r.storage.setItem('fc_edit_session_v1',JSON.stringify(raw));}
 let image={version:1,rows:Object.fromEntries(applicationKeys(fc).map(k=>[k,r.storage.getItem(k)]))};
 const source=Object.fromEntries(r.storage.rows),project=JSON.parse(image.rows.fc_projects_v1).find(p=>p.id==='P');
 const store={ownerUid:'synthetic',name:'meble-lf-test-project-exit',readApplication:async()=>structuredClone(image),snapshot:async scope=>scope==='P'?{replica:{dirty:false,json:JSON.stringify({document:{payload:{project}}})}}:{},
  async checkpointApplication(a){assert.equal(a.expectedVersion,image.version);if(abort){abort=false;throw Object.assign(Error('synthetic abort'),{name:'AbortError'});}image={version:image.version+1,rows:structuredClone(a.rows)};}};
 const {createApplicationCommitter}=await import('../sync/application-replication.mjs');
 const committer=createApplicationCommitter({store,projectContract:{validate:()=>true},summarizeLocal:fc.projectModel.summarizeProjectData});
 const authority=await installOfflineEmulatorApplicationAuthority({window:w,store,ownerUid:'synthetic',authorize:async()=>{},checkpoint:(a,k)=>committer.checkpoint(a,k),commit:async(_k,a)=>{await store.checkpointApplication(a);published++;return receipt;}});
 const {installApplicationWriteBoundary}=await import('../sync/application-write-boundary.mjs');
 installApplicationWriteBoundary({window:w,authority,ensureEditor:async()=>{},localOnly:false});
 r.load('js/app/cloud/application-sync-actions.js');fc.applicationSyncActions.install(createApplicationActionBinding({window:w,authority}));
 fc.investorProjectPatches.patchProjectSave();r.load('js/app/investor/project-autosave.js');
 return {r,w,fc,authority,source,published:()=>published,read:()=>structuredClone(image),abort(){abort=true;},async autosave(){fc.projectAutosave.scheduleProjectAutosave();timer();for(let n=0;n<8;n++)await new Promise(resolve=>setImmediate(resolve));},exit:()=>fc.applicationLifecycle.dispatch('session-cancel',()=>r.handlers['session-cancel']({}))};
}
const cases=[];const test=(name,fn)=>cases.push([name,fn]);
test('A proven online draft may resume only during initial loading',async()=>{
 const f=await fixture({draftBoot:true,loading:true});assert.equal(f.fc.session.active,true);assert.equal(f.fc.session.durable,true);assert.ok(f.read().rows.fc_edit_session_v1);
 await assert.rejects(fixture({draftBoot:true,loading:false}),/LF_ACTIVE_RAM_PROTECTED/);
 await assert.rejects(fixture({draftBoot:true,loading:true,corruptDraft:true}),/LF_ACTIVE_RAM_PROTECTED/);
});
test('Synchronized autosave uses authority transaction and persists a valid active draft',async()=>{
 const f=await fixture();assert.equal(await f.authority.transaction('auto',()=>f.r.open()),true);
 f.w.projectData.room_k.cabinets[0].width=65;await f.autosave();
 assert.equal(JSON.parse(f.read().rows.fc_projects_v1).find(p=>p.id==='P').projectData.room_k.cabinets[0].width,65);
 assert.equal(f.fc.session.active,true);assert.equal(f.fc.session.durable,true);assert.equal(f.fc.session.lastError,null);
 assert.equal(f.published(),0,'Autosave must not enter the commit/outbox boundary');
 assert.deepEqual(Object.fromEntries(f.r.storage.rows),f.source,'Physical originals stay exact');
});
test('Cancel after a durable draft restores the room without calling the publishing boundary',async()=>{
 const f=await fixture();assert.equal(await f.authority.transaction('auto',()=>f.r.open()),true);
 const baseline=JSON.parse(f.read().rows.fc_projects_v1);
 f.w.projectData.room_k.cabinets[0].width=71;await f.autosave();
 assert.equal(f.fc.session.isDirty(),true);
 f.fc.confirmBox={ask:async()=>true};
 assert.equal(await f.exit(),true);
 assert.deepEqual(JSON.parse(f.read().rows.fc_projects_v1),baseline);
 assert.equal(f.published(),0);
});
test('A timer after session close cannot invent an undurable session or save untracked RAM',async()=>{
 const f=await fixture();assert.equal(await f.authority.transaction('auto',()=>f.r.open()),true);await f.authority.transaction('checkpoint',()=>f.fc.session.commit());
 f.w.projectData.room_k.cabinets[0].width=65;const before=f.read();await f.autosave();
 assert.equal(f.fc.session.active,false);assert.equal(f.fc.session.lastError,null);assert.deepEqual(f.read(),before);assert.equal(f.w.projectData.room_k.cabinets[0].width,65);
});
test('Exit cannot replace a session after an unconfirmed project write',async()=>{
 const f=await fixture();assert.equal(await f.authority.transaction('auto',()=>f.r.open()),true);f.fc.session.markUnconfirmedProjectWrite();
 const before=f.read(),snapshot=JSON.stringify(f.fc.session.snapshot),ram=JSON.stringify(f.w.projectData);
 assert.equal(await f.exit(),false);assert.deepEqual(f.read(),before);assert.equal(JSON.stringify(f.fc.session.snapshot),snapshot);assert.equal(JSON.stringify(f.w.projectData),ram);assert.equal(f.fc.session.active,true);
});
for(const abort of [false,true])test('Clean Exit secures the original failed begin; IDB abort preserves state: '+abort,async()=>{
 const f=await fixture();assert.equal(await f.authority.transaction('auto',()=>f.r.open()),true);await f.authority.transaction('checkpoint',()=>f.fc.session.commit());
 assert.equal(f.fc.session.begin('room_k'),false);assert.equal(f.fc.session.lastError.code,'SESSION_STORAGE_WRITE_FAILED');
 const before=f.read(),snapshot=JSON.stringify(f.fc.session.snapshot),ram=JSON.stringify(f.w.projectData);if(abort)f.abort();
 const result=await f.exit();
 if(abort){assert.equal(result,false);assert.deepEqual(f.read(),before);assert.equal(f.fc.session.active,true);assert.equal(f.fc.session.durable,false);assert.equal(JSON.stringify(f.fc.session.snapshot),snapshot);assert.equal(JSON.stringify(f.w.projectData),ram);assert.notEqual(f.w.uiState.entry,'investorsList');assert.equal(await f.exit(),true,'Explicit retry after IDB abort must retain the original begin permission');assert.equal(f.w.uiState.entry,'investorsList');}
 else{assert.equal(result,true);assert.equal(f.w.uiState.entry,'investorsList');assert.equal(f.fc.session.active,false);assert.equal(f.read().rows.fc_edit_session_v1,null);assert.equal(f.read().rows.fc_projects_v1,before.rows.fc_projects_v1);}
 assert.deepEqual(Object.fromEntries(f.r.storage.rows),f.source);
});
const eventsSettled=async()=>{for(let n=0;n<8;n++)await new Promise(resolve=>setImmediate(resolve));};
test('Manage rooms commits the confirmed Kitchen removal inside the application write boundary',async()=>{
 const f=await fixture();let panel,closed=0;
 f.fc.panelBox={open:cfg=>{panel=cfg;},close:()=>closed++};
 f.fc.confirmBox={ask:async()=>true};
 const before=f.read(),old=JSON.parse(before.rows.fc_projects_v1),project=old.find(p=>p.id==='P');
 const result=f.fc.roomRegistry.openManageRoomsModal();
 const row=[...panel.contentNode.querySelectorAll('.room-registry-manage-row')].find(el=>el.querySelector('input').value==='Kuchnia');
 assert.ok(row);row.querySelector('.room-registry-manage-row__remove').click();await eventsSettled();
 [...panel.contentNode.querySelectorAll('button')].find(btn=>btn.textContent==='Zapisz').click();await eventsSettled();
 assert.equal(closed,1,JSON.stringify(f.r.messages));assert.equal((await result).saved,true);
 const after=f.read(),projects=JSON.parse(after.rows.fc_projects_v1),saved=projects.find(p=>p.id==='P');
 assert.equal(saved.projectData.room_k,undefined);assert.equal(saved.meta.pendingDomainOperation,undefined);
 assert.deepEqual(saved.projectData.room_s,project.projectData.room_s);
 assert.deepEqual(projects.find(p=>p.id==='Q'),old.find(p=>p.id==='Q'));
 assert.equal(after.rows.fc_quote_snapshots_v1,before.rows.fc_quote_snapshots_v1);
 assert.equal(f.published(),1);
});
test('Incoming replication cannot replace a pending room operation or its archived offers',async()=>{
 const {projectApplicationRows}=await import('../sync/application-replication.mjs');
 const f=await fixture(),before=f.read().rows;
 const projects=JSON.parse(before.fc_projects_v1),record=projects.find(row=>row.id==='P');
 const incoming={value:{document:{payload:{project:structuredClone(record),investor:JSON.parse(before.fc_investors_v1).find(row=>row.id==='K'),offers:[]}}}};
 record.meta.pendingDomainOperation={version:1,kind:'rooms',projectId:'P',investorId:'K',requestKey:'remove:room_k'};
 const local={...before,fc_projects_v1:JSON.stringify(projects)};
 const exact=structuredClone(local);
 assert.throws(()=>projectApplicationRows(local,{scope:'P'},incoming,null,{validate(){}}),/LF_PROJECT_OPERATION_PENDING/);
 assert.deepEqual(local,exact);
});
test('Flush reports a skipped project, preserves the shared investor, receives independent projects and retries after recovery',async()=>{
 const {createApplicationReplication}=await import('../sync/application-replication.mjs');
 const f=await fixture(),before=f.read().rows,projects=JSON.parse(before.fc_projects_v1),investors=JSON.parse(before.fc_investors_v1);
 const intent={version:1,kind:'rooms',projectId:'P',investorId:'K',requestKey:'remove:room_k'};
 projects.push({...projects.find(p=>p.id==='P'),id:'P-shared'});
 const history={id:'archived',project:{id:'P'},investor:{id:'K'}};
 const channels=projects.map(project=>({scope:project.id,kind:'project',async read(){
  reads.push(project.id);
  const record={...project,title:'Remote '+project.id};
  const owner=investors.find(row=>row.id===project.investorId);
  const investor=project.id==='P-shared'?{...owner,rooms:[]}:owner;
  return {head:{generation:2},value:{document:{payload:{project:record,investor,offers:project.id==='P'?[history]:[]}}}};
 }}));
 let rows={...before,fc_quote_snapshots_v1:JSON.stringify([history]),
  fc_projects_v1:JSON.stringify(projects.map(p=>p.id==='P'?{...p,meta:{...p.meta,pendingDomainOperation:intent}}:p))};
 const replicas=new Map(channels.map(ch=>[ch.scope,{base:{generation:1},version:1}]));
 const applied=[],reads=[],states=[],events=new EventTarget();let online=false;
 const store={exclusive:fn=>fn(),readApplication:async()=>({rows}),
  snapshot:async scope=>({replica:replicas.get(scope),operations:[]}),
  async apply({scope,head,application,expectedVersion}){
   assert.equal(expectedVersion,replicas.get(scope).version);
   applied.push(scope);rows=application;replicas.set(scope,{base:head,version:expectedVersion+1});
  }};
 const sync=createApplicationReplication({store,channels:[{scope:'globals',read:async()=>{throw Object.assign(Error('GLOBAL_NOT_FOUND'),{code:'GLOBAL_NOT_FOUND'});}},...channels],
  projectContract:{validate(){}},eventTarget:events,online:()=>online,onState:value=>states.push(value),incoming:next=>next,refresh(){},assertIdle(){}});
 const project=id=>JSON.parse(rows.fc_projects_v1).find(p=>p.id===id);
 const blocked={ok:false,code:'LF_PROJECT_OPERATION_PENDING',blockedScopes:['P','P-shared']};
 try{
  await sync.flush();online=true;
  assert.deepEqual(await sync.flush(),blocked);
  assert.deepEqual(states.at(-1),blocked);
  assert.deepEqual(applied,['Q']);
  assert.deepEqual(project('P').meta.pendingDomainOperation,intent);
  assert.deepEqual(JSON.parse(rows.fc_investors_v1).find(row=>row.id==='K'),investors.find(row=>row.id==='K'));
  assert.equal(rows.fc_quote_snapshots_v1,JSON.stringify([history]));
  const readsBefore=reads.length;sync.notify('Q');await eventsSettled();
  assert.deepEqual(reads.slice(readsBefore),['Q'],'Unrelated notifications do not spin on the blocked scope');
  assert.deepEqual(states.at(-1),blocked,'Completing an unrelated scope cannot turn the overall result green');
  // The domain has recovered its validated journal and notified this scope.
  const recovered=project('P');delete recovered.meta.pendingDomainOperation;
  rows={...rows,fc_projects_v1:JSON.stringify([recovered,project('Q'),project('P-shared')])};
  assert.deepEqual(await sync.flush(),{ok:true});
  assert.deepEqual(states.at(-1),{ok:true});
  assert.deepEqual(applied,['Q','P','P-shared']);
  assert.equal(project('P').title,'Remote P');
  assert.equal(rows.fc_quote_snapshots_v1,JSON.stringify([history]));
 }finally{await sync.close();}
});
test('Reopen observes the complete handover while its real ACK is pending',async()=>{
 const {createApplicationHandover}=await import('../sync/application-replication.mjs');
 const request={deviceId:'computer',epoch:7},editor={...request,active:true};
 let completeAck,started,acknowledged=false,releases=0,errors=[];
 const entered=new Promise(resolve=>started=resolve);
 const ack=new Promise(resolve=>completeAck=resolve);
 const store={deviceId:'computer',pendingHandover:async()=>request,
  snapshot:async()=>({replica:{editor,base:{generation:1},dirty:!acknowledged},operations:acknowledged?[]:[{phase:'inflight'}]})};
 const sync={notify(){},async flush(){started();await ack;acknowledged=true;return {ok:true};},
  async releaseRequestedEditor(scope,actual){assert.equal(scope,'P');assert.deepEqual(actual,request);assert.equal(acknowledged,true);releases++;}};
 const handover=createApplicationHandover({store,getSync:()=>sync,online:()=>true,onError:e=>errors.push(e)});
 const exit=handover.start('P');await entered;
 const pending=handover.pending('P');assert.ok(pending instanceof Promise,'The flush is part of the pending handover, not an invisible gap');
 let settled=false;pending.then(()=>settled=true);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(settled,false);assert.equal(releases,0);
 completeAck();await exit;await pending;
 assert.equal(releases,1);assert.deepEqual(errors,[]);assert.equal(handover.pending('P'),undefined);
});

test('Explicit Save distinguishes confirmed local commit, queued publication and verified revision',async()=>{
 for(const [receipt,text] of [
  [{localConfirmed:true,cloudConfirmed:false},'Zmiany zapisano na tym urządzeniu.'],
  [{localConfirmed:true,cloudConfirmed:false,operationId:'queued'},'Zmiany zapisano na tym urządzeniu. Synchronizacja oczekuje na potwierdzenie.'],
  [{localConfirmed:true,cloudConfirmed:true,unchanged:true},'Zmiany zapisano na tym urządzeniu. Bieżąca rewizja jest już potwierdzona przez Firebase.']
 ]){
  const f=await fixture({receipt});
  assert.equal(await f.authority.transaction('auto',()=>f.r.open()),true);
  f.w.projectData.room_k.cabinets[0].width=65;
  const save=()=>f.fc.applicationLifecycle.dispatch('session-save',()=>f.r.handlers['session-save']({}));
  const before=f.read();f.abort();await save();
  assert.deepEqual(f.read(),before);assert.equal(f.fc.session.active,true);
  assert.equal(f.r.messages.some(n=>n.title==='Projekt zapisany'),false);
  await save();
  assert.equal(f.fc.session.active,false);
  assert.equal(f.r.messages.filter(n=>n.title==='Projekt zapisany').at(-1)?.message,text);
 }
});
(async()=>{let failed=0;for(const [name,fn]of cases){try{await fn();console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack);}}console.log((cases.length-failed)+'/'+cases.length+' PASS');if(failed)process.exitCode=1;})().catch(e=>{console.error(e);process.exitCode=1;});
