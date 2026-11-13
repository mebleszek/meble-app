'use strict';
// Real session/navigation/autosave/authority; synthetic owner, no Firebase I/O.
const assert=require('node:assert/strict'),{setup}=require('./investor-navigation-exit-smoke');
async function fixture({draftBoot=false,loading=false,corruptDraft=false}={}){
 let timer,abort=false;const r=setup({timers:{setTimeout:fn=>{timer=fn;return 1;},clearTimeout(){}}}),w=r.s,fc=r.FC;
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
 const committer=createApplicationCommitter({store});
 const authority=await installOfflineEmulatorApplicationAuthority({window:w,store,ownerUid:'synthetic',authorize:async()=>{},checkpoint:(a,k)=>committer.checkpoint(a,k),commit:(_k,a)=>store.checkpointApplication(a)});
 const {installApplicationWriteBoundary}=await import('../sync/application-write-boundary.mjs');
 installApplicationWriteBoundary({window:w,authority,ensureEditor:async()=>{},localOnly:false});
 r.load('js/app/cloud/application-sync-actions.js');fc.applicationSyncActions.install(createApplicationActionBinding({window:w,authority}));
 fc.investorProjectPatches.patchProjectSave();r.load('js/app/investor/project-autosave.js');
 return {r,w,fc,authority,source,read:()=>structuredClone(image),abort(){abort=true;},async autosave(){fc.projectAutosave.scheduleProjectAutosave();timer();for(let n=0;n<8;n++)await new Promise(resolve=>setImmediate(resolve));},exit:()=>fc.applicationLifecycle.dispatch('session-cancel',()=>r.handlers['session-cancel']({}))};
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
 assert.deepEqual(Object.fromEntries(f.r.storage.rows),f.source,'Physical originals stay exact');
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
(async()=>{let failed=0;for(const [name,fn]of cases){try{await fn();console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack);}}console.log((cases.length-failed)+'/'+cases.length+' PASS');if(failed)process.exitCode=1;})().catch(e=>{console.error(e);process.exitCode=1;});
