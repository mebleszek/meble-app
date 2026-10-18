#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm');
const {fixture,activate,load,reopen}=require('./project-pcv-ui-activation-smoke');
const clone=value=>JSON.parse(JSON.stringify(value));
const tests=[],test=(name,run)=>tests.push([name,run]);
function runtime(){
 const r=fixture();activate(r);
 r.storage.rows.set('fc_materials_v1',JSON.stringify(r.s.materials));
 r.storage.rows.set('fc_ui_v1',JSON.stringify(r.s.uiState));
 for(const file of ['js/app/bootstrap/app-core-namespace.js','js/app/bootstrap/app-state-bootstrap.js','js/app.js',
  'js/app/cabinet/cabinet-modal-draft.js','js/app/cabinet/cabinet-modal-finalize.js'])load(r,file);
 r.eval=code=>vm.runInContext(code,r.s);
 r.data=()=>r.eval('projectData');
 r.assign=data=>{r.s.__testInput=data;r.eval('projectData=window.__testInput');delete r.s.__testInput;};
 r.save=()=>r.handlers['session-save']({});
 r.edit=width=>{
  r.FC.cabinetModalDraft.beginEditState('one',r.data().room.cabinets[0]);
  r.eval('cabinetModalState.draft.width='+Number(width));
  assert.equal(r.FC.cabinetModalFinalize.saveRegularCabinetDraft({draft:r.eval('cabinetModalState.draft')}),true);
 };
 r.add=()=>{
  r.FC.cabinetModalDraft.beginAddState('room');
  assert.equal(r.FC.cabinetModalFinalize.saveRegularCabinetDraft({draft:r.eval('cabinetModalState.draft')}),true);
 };
 return r;
}
function consistent(r){
 assert.equal(r.s.projectData,r.data(),'window and classic-script binding must expose the same working object');
 const persist=r.FC.projectStore.prepareProjectDataForPersistence;
 assert.deepEqual(clone(persist(r.data())),clone(persist(r.row('A').projectData)));
 assert.equal(r.policy.read().ok,true,JSON.stringify(r.policy.read()));
}
test('Actual app bootstrap exposes one RAM object through both existing bindings',()=>consistent(runtime()));
test('Real edit/save and repeated add (copy latest defaults) remain current without restart',()=>{
 const r=runtime(),other=clone(r.row('A').projectData.other),b=clone(r.row('B'));
 r.edit(65);r.save();consistent(r);assert.equal(r.data().room.cabinets[0].width,65);
 r.add();r.add();r.save();consistent(r);
 assert.equal(r.data().room.cabinets.length,4);
 assert.equal(new Set(r.data().room.cabinets.map(c=>c.id)).size,4);
 assert.deepEqual(clone(r.row('A').projectData.other),other);assert.deepEqual(r.row('B'),b);
 const model=r.FC.materialTabData.collectRoomMaterials('room');assert.equal(model.cabinetRows.length,4);
 const aggregate=r.roz(['room']);assert.ok(aggregate.materials.length);assert.equal(aggregate.edgeMeters,model.projectEdgeMeters);
 const fresh=reopen(r);assert.equal(fresh.s.projectData.room.cabinets.length,4);assert.equal(fresh.FC.projectPcvPolicy.read().ok,true);
});
test('Assignments in either direction cannot detach an active draft',()=>{
 const r=runtime();assert.equal(r.session.begin('room'),true);
 const draft=clone(r.data());draft.room.cabinets[0].width=69;r.assign(draft);
 assert.equal(r.s.projectData,draft);assert.equal(r.FC.sessionNavigation.canCalculate(),false);
 const next=clone(draft);next.room.cabinets[0].width=71;r.s.projectData=next;
 assert.equal(r.data(),next);assert.equal(r.row('A').projectData.room.cabinets[0].width,60);
});
test('Failed write preserves shared draft, active session and all unrelated data',()=>{
 const r=runtime(),b=clone(r.row('B'));r.storage.fail.set('set:fc_projects_v1','throw');
 r.edit(67);r.save();assert.equal(r.data().room.cabinets[0].width,67);
 assert.equal(r.s.projectData,r.data());assert.equal(r.row('A').projectData.room.cabinets[0].width,60);
 assert.equal(r.session.active,true);assert.equal(r.FC.sessionNavigation.canCalculate(),false);assert.deepEqual(r.row('B'),b);
});
test('Unconfirmed session revision cannot publish success or clear the draft',()=>{
 const r=runtime();assert.equal(r.session.begin('room'),true);r.storage.fail.set('set:fc_edit_session_v1','throw');
 r.edit(68);r.save();assert.equal(r.session.active,true);assert.equal(r.session.commit(),false);
 assert.equal(r.s.projectData,r.data());assert.equal(r.data().room.cabinets[0].width,68);
 assert.equal(r.FC.sessionNavigation.canCalculate(),false);
});
test('Unobserved external revision still blocks the owner save and preserves both revisions',()=>{
 const r=runtime();assert.equal(r.session.begin('room'),true);const draft=clone(r.data());draft.room.cabinets[0].width=66;r.assign(draft);
 const rows=JSON.parse(r.storage.getItem('fc_projects_v1'));rows.find(x=>x.id==='A').projectData.room.cabinets[0].width=72;
 r.storage.rows.set('fc_projects_v1',JSON.stringify(rows));r.save();
 assert.equal(r.row('A').projectData.room.cabinets[0].width,72);assert.equal(r.data().room.cabinets[0].width,66);
 assert.equal(r.session.active,true);assert.equal(r.session.lastError.code,'PROJECT_WRITE_CONFLICT');
});
test('Real calculation failure with existing history stays visible and preserves frozen offers',async()=>{
 const r=runtime();load(r,'js/app/wycena/wycena-tab-history.js');
 const baseline=await r.candidate();const saved=r.FC.quoteSnapshotStore.save(baseline);
 const raw=r.storage.getItem('fc_quote_snapshots_v1');
 const state={lastQuote:saved,previewSnapshotId:saved.id};let displayed;
 const historyDeps={getSnapshotHistory:()=>r.FC.quoteSnapshotStore.listForProject('A'),getState:()=>state,setState:p=>Object.assign(state,p),
  isSelectedSnapshot:()=>false,isArchivedPreliminary:()=>false,isPreliminarySnapshot:()=>false,isFinalStatus:()=>false,
  currentProjectStatus:()=> 'wycena',snapshotById:(id,rows)=>rows.find(x=>x.id===id),normalizeSnapshot:x=>x,getSnapshotId:x=>x.id};
 const deps={getState:()=>state,setState:p=>Object.assign(state,p),render:()=>{displayed=r.FC.wycenaTabHistory.resolveDisplayedQuote(historyDeps);},
  getOfferDraft:()=>r.draft,normalizeDraftSelection:d=>d.selection};
 // Corrupt geometry is a genuine rejection by the real PCV resolver, not a thrown stub.
 const next=clone(r.data());next.room.cabinets[0].width=0;const result=r.FC.project.saveConfirmed(next);assert.equal(result.ok,true);r.assign(result.project);
 await r.FC.wycenaTabShell.generateQuote({},deps);
 assert.ok(displayed && displayed.error,'A frozen offer must not hide the current generation failure');
 assert.match(displayed.error,/PCV|geometr/i);
 assert.ok(r.messages.some(m=>m.title==='Nie można utworzyć wyceny' && /PCV|geometr/i.test(m.message)),'Explain the genuine obstruction through the existing infoBox');
 assert.equal(state.isBusy,false);assert.equal(r.storage.getItem('fc_quote_snapshots_v1'),raw);
});
test('Real candidates after cabinet changes preserve old prices/scope and global RAW',async()=>{
 const r=runtime();
 const keys=['fc_materials_v1','fc_sheet_materials_v1','fc_services_v1','fc_quote_rates_v1','fc_hourly_rates_v1','fc_accessories_v1',
  'fc_hardware_manufacturers_v1','fc_hardware_suppliers_v1','fc_hardware_categories_v1','fc_hardware_types_v1','fc_hardware_technical_params_v1',
  'fc_hardware_settings_v1','fc_company_profile_v1','fc_business_costs_v1','fc_program_defaults_v1','fc_sheets_v1',
  'fc_edge_v1','fc_material_part_options_v1','fc_rozrys_grain_state_v1'];
 for(const key of keys)if(r.storage.getItem(key)===null)r.storage.rows.set(key,JSON.stringify({preserve:key}));
 const before=Object.fromEntries(keys.map(key=>[key,r.storage.getItem(key)]));
 const first=r.FC.quoteSnapshotStore.save(await r.candidate());
 r.edit(75);r.add();r.save();consistent(r);
 const second=r.FC.quoteSnapshotStore.save(await r.candidate());
 assert.notEqual(first.id,second.id);assert.notDeepEqual(clone(first.lines.materials),clone(second.lines.materials));
 assert.deepEqual(clone(r.FC.quoteSnapshotStore.getById(first.id)),clone(first));
 assert.deepEqual(clone(second.scope.selectedRooms),['room']);
 for(const key of keys)assert.equal(r.storage.getItem(key),before[key],key);
});
test('Failed read-back retains the shared draft and durable refusal, without stale overwrite',()=>{
 const r=runtime();assert.equal(r.session.begin('room'),true);const next=clone(r.data());next.room.cabinets[0].width=67;r.assign(next);
 const upsert=r.FC.projectStore.upsert;
 r.FC.projectStore.upsert=function(...args){const saved=upsert(...args);assert.ok(saved);
  const rows=JSON.parse(r.storage.getItem('fc_projects_v1'));rows.find(row=>row.id==='A').projectData.other.cabinets[0].width=99;
  r.storage.rows.set('fc_projects_v1',JSON.stringify(rows));return saved;
 };
 const result=r.FC.project.saveConfirmed(r.data());assert.equal(result.ok,false);assert.equal(result.code,'SAVE_UNCONFIRMED');assert.equal(result.projectSaved,true);
 assert.equal(r.s.projectData,r.data());assert.equal(r.data().room.cabinets[0].width,67);
 const raw=r.storage.getItem('fc_projects_v1'),payload=r.storage.getItem('fc_edit_session_v1');r.save();
 assert.equal(r.session.commit(),false);assert.equal(r.session.cancel(),false);assert.equal(r.FC.sessionNavigation.canCalculate(),false);
 assert.equal(r.storage.getItem('fc_projects_v1'),raw);assert.equal(r.storage.getItem('fc_edit_session_v1'),payload);
});
test('Genuine unsaved RAM divergence is still rejected by PCV, never silently refreshed',()=>{
 const r=runtime(),raw=r.storage.getItem('fc_projects_v1');const draft=clone(r.data());draft.room.cabinets[0].width=77;r.assign(draft);
 assert.equal(r.policy.read().code,'RAM_DIVERGENCE');assert.equal(r.FC.sessionNavigation.canCalculate(),false);
 assert.equal(r.data(),draft);assert.equal(r.storage.getItem('fc_projects_v1'),raw);
});
test('Calculation-view clicks and delayed callbacks cannot rewrite the revision being calculated',()=>{
 for(const tab of ['rozrys','wycena']){
  const r=runtime();let scheduled;r.s.setTimeout=fn=>{scheduled=fn;return 1;};r.s.clearTimeout=()=>{};
  load(r,'js/app/investor/project-autosave.js');
  r.FC.projectAutosave.scheduleProjectAutosave();
  r.s.uiState.activeTab=tab;const raw=r.storage.getItem('fc_projects_v1');r.storage.calls.length=0;scheduled();
  assert.equal(r.storage.getItem('fc_projects_v1'),raw,'A read-only calculation must not invalidate its source revision');
  assert.equal(r.storage.calls.length,0);
 }
});
test('Calculation-view callback retains an unfinished draft; normal edit autosave still works',()=>{
 const r=runtime();assert.equal(r.session.begin('room'),true);const draft=clone(r.data());draft.room.cabinets[0].width=79;r.assign(draft);
 let scheduled;r.s.setTimeout=fn=>{scheduled=fn;return 1;};r.s.clearTimeout=()=>{};load(r,'js/app/investor/project-autosave.js');
 const raw=r.storage.getItem('fc_projects_v1'),payload=r.storage.getItem('fc_edit_session_v1');
 r.FC.projectAutosave.scheduleProjectAutosave();r.s.uiState.activeTab='wycena';scheduled();
 assert.equal(r.data(),draft);assert.equal(r.session.active,true);assert.equal(r.storage.getItem('fc_projects_v1'),raw);assert.equal(r.storage.getItem('fc_edit_session_v1'),payload);
 assert.equal(r.FC.sessionNavigation.canCalculate(),false);
 r.s.uiState.activeTab='wywiad';r.FC.projectAutosave.scheduleProjectAutosave();scheduled();consistent(r);assert.equal(r.row('A').projectData.room.cabinets[0].width,79);
});
if(require.main===module)(async()=>{let failed=0;for(const[name,run]of tests){try{await run();console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack);}}console.log(`pcv-ram-quote-save-regression: ${tests.length-failed}/${tests.length} PASS`);process.exitCode=failed?1:0;})();
module.exports={runtime,consistent};
