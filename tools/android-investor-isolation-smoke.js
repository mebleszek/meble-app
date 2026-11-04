'use strict';
const assert=require('node:assert/strict');
const {setup}=require('./investor-navigation-exit-smoke');
(async()=>{
 const r=setup();r.FC.investorProjectPatches.patchInvestorsAPI();
 const before=r.storage.getItem('fc_projects_v1');
 const draft={id:'draft-test',rooms:[]};
 assert.match(r.FC.investorRooms.buildProjectCards(draft,true,[]),/Brak dodanych/,'Transient form must not show active investor rooms');
 const inv=r.FC.investors.create({name:'Second synthetic investor',rooms:[]});assert.ok(inv);
 assert.equal(r.s.projectData.meta.assignedInvestorId,inv.id,'New investor must own RAM immediately');
 assert.equal(r.FC.projectStore.getCurrentRecord().investorId,inv.id);
 assert.equal(r.FC.investorProjectRuntime.hasProjectDivergence(r.s.projectData),false);
 const rows=JSON.parse(before);for(const row of rows)assert.deepEqual(JSON.parse(r.storage.getItem('fc_projects_v1')).find(x=>x.id===row.id),row,'Create must not rewrite existing projects');
 assert.equal(await r.handlers['open-investor']({element:{getAttribute:()=> 'K'}}),true);
 assert.equal(r.s.projectData.room_k.cabinets[0].width,60);
 assert.equal(await r.handlers['open-investor']({element:{getAttribute:()=> inv.id}}),true);
 assert.equal(r.s.projectData.meta.assignedInvestorId,inv.id);assert.equal(r.s.projectData.room_k,undefined);
 const durable=r.storage.getItem('fc_projects_v1');
 r.s.projectData.meta.assignedInvestorId='foreign';assert.equal(r.FC.investorProjectRuntime.saveActiveProjectToInvestor(inv.id),null);
 assert.equal(r.storage.getItem('fc_projects_v1'),durable);
 const f=setup();f.load('js/app/investor/investor-modals.js');f.load('js/app/investor/investor-actions.js');f.FC.investorEditorState.enter(f.inv());
 for(const [key,value]of Object.entries({name:'Synthetic',phone:'123',city:'City',email:'test@example.invalid',address:'Address',source:'Ulotka',notes:'Keep draft'}))f.FC.investorEditorState.setField(key,value);
 f.FC.investorModals.confirmSaveInvestorChanges=async()=>true;f.FC.investorPersistence.saveInvestorPatch=()=>null;
 const retainedDraft=JSON.stringify(f.FC.investorEditorState.getDraft(f.inv()));
 await f.FC.investorActions.handleTopAction('save',()=>f.inv(),{});
 assert.equal(f.FC.investorEditorState.state.isEditing,true);assert.equal(JSON.stringify(f.FC.investorEditorState.getDraft(f.inv())),retainedDraft);
 // Real authority/committer and form handler; Linux CI also persists in native IDB.
 const {installOfflineEmulatorApplicationAuthority,applicationKeys}=await import('../sync/application-authority.mjs');
 const {createApplicationCommitter}=await import('../sync/application-replication.mjs');
 const {installApplicationWriteBoundary}=await import('../sync/application-write-boundary.mjs');
 const {codeGlobalRows}=await import('../sync/global-code-rebuild-plan.mjs');
 const code=require('./helpers/code-global-catalogs').buildCodeCatalogs(),c=code.context.FC.globalDataContract;
 let native=null,ordinal=0;
 if(process.platform==='linux'){
  const fs=require('fs'),os=require('os'),path=require('path'),api=await import('./helpers/local-first-browser.mjs');
  const server=await api.startLocalFirstServer(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-investor-form-'));
  try{native={server,dir,api,browser:await api.openBrowserDevice(server,path.join(dir,'profile'))};}catch(error){await server.close();fs.rmSync(dir,{recursive:true,force:true});throw error;}
 }
 try{
 async function scopedForm(){
  const a=setup(),w=a.s,fc=a.FC;fc.investorProjectPatches.patchInvestorsAPI();fc.globalDataContract=c;
  for(const key of [...Object.values(c.sources).flat(),'fc_materials_v1'])a.storage.removeItem(key);
  for(const [key,value]of Object.entries(codeGlobalRows(code.model,c)))a.storage.setItem(key,value);
  for(const key of ['fc_projects_v1','fc_investors_v1']){const rows=JSON.parse(a.storage.getItem(key));rows[0].unknownPreserved={exact:'synthetic RAW'};a.storage.setItem(key,JSON.stringify(rows));}
  a.storage.setItem('fc_quote_snapshots_v1',JSON.stringify([{id:'synthetic-frozen-offer',project:{id:'P'},investor:{id:'K'},frozenPrice:123.125,unknownPreserved:{exact:true}}]));
  w.location.hostname='localhost';w.__FC_MAIN_ACCESS__={assert(){},isValid:()=>true};w.addEventListener=()=>{};
  a.load('js/app/project/project-export-contract.js');a.load('js/app/project/business-project-contract.js');
  let image={version:1,rows:Object.fromEntries(applicationKeys(fc).map(k=>[k,a.storage.getItem(k)]))},abort=false;
  const binding={name:'meble-lf-test-investor-form-'+(++ordinal),ownerUid:'synthetic',deviceId:'phone',instanceId:'synthetic',initialize:true};
  let idb=native?await native.browser.open(binding):null;if(idb)image=await idb.initializeApplication(image.rows);
  const store={ownerUid:'synthetic',name:binding.name,readApplication:async()=>structuredClone(image),snapshot:async()=>({}),
   checkpointApplication:async next=>{assert.equal(next.expectedVersion,image.version);const fail=abort;abort=false;
    if(!idb){if(fail)throw Error('synthetic commit abort');image={version:image.version+1,rows:structuredClone(next.rows)};return;}
    if(fail)await native.browser.evaluate('window.originalInvestorPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==="control"){this.transaction.abort();throw new DOMException("synthetic abort","AbortError");}return window.originalInvestorPut.apply(this,args);};true');
    try{await idb.checkpointApplication(next);image=await idb.readApplication();}finally{if(fail)await native.browser.evaluate('IDBObjectStore.prototype.put=window.originalInvestorPut;true');}
   }};
  const local=createApplicationCommitter({store,globalContract:c,projectContract:fc.businessProjectContract,localOnly:true});
  const authority=await installOfflineEmulatorApplicationAuthority({window:w,store,ownerUid:'synthetic',localOnly:true,authorize:async()=>{},checkpoint:next=>store.checkpointApplication(next),commit:(kind,next)=>local.commit(kind,next,next.rows.fc_current_project_id_v1)});
  installApplicationWriteBoundary({window:w,authority,ensureEditor:async()=>{},localOnly:true});
  const transient=fc.investorsModel.normalizeInvestor({id:'draft-synthetic',kind:'person',rooms:[]});
  a.load('js/app/investor/investor-ui.js');fc.investorUI.setTransientInvestor(transient);fc.investorUI.state.newlyCreatedId=transient.id;fc.investorEditorState.enter(transient);
  for(const [key,value]of Object.entries({name:'Second synthetic',phone:'123',city:'City',email:'test@example.invalid',address:'Address',source:'Ulotka',notes:'Keep form'}))fc.investorEditorState.setField(key,value);
  fc.investorModals={confirmSaveInvestorChanges:async()=>true};a.load('js/app/investor/investor-actions.js');
  let click;const button={getAttribute:()=> 'save',addEventListener:(_type,handler)=>{click=handler;}};
  fc.investorActions.bindTopActions({querySelectorAll:()=>[button]},{getCurrentInvestor:()=>transient});
  return {a,fc,click,authority,read:()=>structuredClone(image),abort(){abort=true;},async reopen(){if(!native)return;const expected=structuredClone(image);await native.browser.crash();native.browser=await native.api.openBrowserDevice(native.server,require('path').join(native.dir,'profile'));idb=await native.browser.open({...binding,initialize:false});assert.deepEqual(await idb.readApplication(),expected,'Committed investors/projects must survive renderer loss and reopen without a backend');}};
 }
 const live=await scopedForm(),initialImage=live.read();await live.click();const after=live.read();
 assert.equal(JSON.parse(after.rows.fc_projects_v1).length,3,JSON.stringify({status:live.authority.status(),messages:live.a.messages}));assert.equal(JSON.parse(after.rows.fc_investors_v1).length,3);
 for(const key of ['fc_projects_v1','fc_investors_v1'])for(const row of JSON.parse(initialImage.rows[key]))assert.deepEqual(JSON.parse(after.rows[key]).find(r=>r.id===row.id),row,'Scoped create must preserve unrelated RAW, including unknown fields');
 for(const key of Object.values(c.sources).flat())assert.equal(after.rows[key],initialImage.rows[key],'Catalog RAW must remain exact');
 assert.equal(after.rows.fc_quote_snapshots_v1,initialImage.rows.fc_quote_snapshots_v1);assert.equal(live.fc.investorEditorState.state.isEditing,false);
 const current=live.read();await assert.rejects(live.authority.transaction('auto',()=>{const rows=JSON.parse(live.a.storage.getItem('fc_projects_v1'));rows.find(r=>r.id==='P').title='Unauthorized cross-project change';live.a.storage.setItem('fc_projects_v1',JSON.stringify(rows));}),/LF_APPLICATION_SCOPE_REFUSED/);assert.deepEqual(live.read(),current);
 await live.reopen();
 const refused=await scopedForm(),unchanged=refused.read(),draftBefore=JSON.stringify(refused.fc.investorEditorState.state);refused.abort();await refused.click();
 assert.deepEqual(refused.read(),unchanged);assert.equal(JSON.stringify(refused.fc.investorEditorState.state),draftBefore);assert.ok(refused.fc.investorUI.getTransientInvestor());assert.equal(refused.a.messages.at(-1).title,'Nie zapisano inwestora');
 await refused.click();assert.equal(JSON.parse(refused.read().rows.fc_projects_v1).length,3,'Explicit retry must create exactly one project');
 await refused.reopen();
 console.log('PASS real scoped form/authority/committer: existing RAW/catalogs/offers preserved, cross-project writes refused, abort retains draft and explicit retry succeeds without an unhandled promise');
 if(native)console.log('PASS native Chromium/IDB transaction abort and two renderer-loss/reopen checks; no backend');
 }finally{if(native){try{await native.browser.close();}finally{await native.server.close();require('fs').rmSync(native.dir,{recursive:true,force:true});}}}
 console.log('PASS two-investor create/switch/foreign RAM protection and transient room isolation');
})().catch(e=>{console.error(e);process.exitCode=1;});
