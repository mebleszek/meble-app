#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),tools=path.join(root,'tools');
const { runtime }=require(path.join(tools,'project-session-owner-rollback-smoke'));
const {makeMiniDocument}=require(path.join(tools,'app-dev-smoke-lib/mini-document'));
const clone=x=>JSON.parse(JSON.stringify(x)),PROJECTS='fc_projects_v1',SESSION='fc_edit_session_v1';
function setup(){
 const r=runtime(),record=r.FC.projectStore.getById('A');
 record.projectData.other={cabinets:[{id:'other',width:70}],fronts:[],sets:[],settings:{}};
 record.projectData.meta.roomDefs={room:{id:'room',label:'Kuchnia'},other:{id:'other',label:'Salon'}};record.projectData.meta.roomOrder=['room','other'];
 r.FC.projectStore.upsert(record);r.s.projectData=r.FC.project.load();
 r.s.uiState={roomType:'room',entry:'app',activeTab:'wywiad',currentInvestorId:'inv-A'};
 r.s.document=makeMiniDocument();r.s.scrollTo=()=>{};r.s.STORAGE_KEYS=r.FC.constants.STORAGE_KEYS;
 r.s.confirm=()=>true;r.s.DEFAULT_PROJECT={schemaVersion:1};r.s.renderCabinets=()=>{};
 for(const id of ['homeView','appView','topTabs','roomsView','investorView']){const n=r.s.document.getElementById(id)||r.s.document.createElement('div');n.id=id;if(!n.parentNode)r.s.document.body.appendChild(n);n.style.display=id==='appView'?'block':'none';}
 const load=file=>vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),r.s,{filename:file});r.load=load;
 for(const file of ['js/app/shared/ui-state.js','js/app/investor/investor-persistence.js','js/app/ui/views.js','js/app/ui/tab-navigation.js','js/app/shared/public-api.js'])load(file);
 r.FC.uiState.set(r.s.uiState);r.FC.choiceBox={async ask(){return'back';}};
 assert.equal(r.session.begin(),true);return r;
}
const tests=[],test=(name,fn)=>tests.push([name,fn]);
test('Repeated scoped save after accepting fresh unrelated room',()=>{
 const r=setup(),row=r.FC.projectStore.getById('A');row.projectData.other.cabinets[0].width=75;r.FC.projectStore.upsert(row);
 r.s.projectData.room.cabinets[0].width=65;let saved=r.FC.project.saveConfirmed(r.s.projectData);assert.equal(saved.ok,true);
 r.s.projectData=saved.project;r.s.projectData.room.cabinets[0].width=66;assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);
});
test('Room cancel recomputes durable cabinet summary',()=>{
 const r=setup();r.s.projectData.room.cabinets.push({id:'extra',width:20});const saved=r.FC.project.saveConfirmed(r.s.projectData);assert.equal(saved.ok,true);
 assert.equal(r.session.cancel(),true);const row=r.row('A');assert.equal(row.projectData.room.cabinets.length,1);assert.equal(row.cabinetCount,2);
});
test('WYCENA entry requires the approved closure dialog and Back keeps editing',async()=>{
 const r=setup();let asks=0;r.FC.choiceBox.ask=async()=>{asks++;return'back';};
 await r.FC.tabNavigation.setActiveTab('wycena');assert.equal(r.s.uiState.activeTab,'wywiad');assert.equal(asks,1);assert.equal(r.session.active,true);
});
test('UI-state API cannot switch a scoped active room',()=>{
 const r=setup(),raw=r.storage.getItem('fc_ui_v1');r.s.uiState=r.FC.uiState.set({roomType:'other'});
 assert.equal(r.s.uiState.roomType,'room');assert.equal(r.storage.getItem('fc_ui_v1'),raw);
});
test('Low-level investor repository cannot bypass active ownership',()=>{
 const r=setup();r.load('js/app/investor/investors-local-repository.js');r.FC.investorsLocalRepository.setCurrentId('inv-B');
 assert.equal(r.storage.getItem('fc_current_investor_v1'),'inv-A');
});
test('New-project action cannot reset active shared RAM before a navigation decision',async()=>{
 const r=setup(),before=clone(r.s.projectData);await r.handlers['new-project']({});assert.deepEqual(clone(r.s.projectData),before);
});
test('Assign-investor action cannot mutate owner metadata after denied switch',async()=>{
 const r=setup(),before=clone(r.s.projectData);await r.handlers['assign-investor']({element:{getAttribute:()=> 'inv-B'}});
 assert.deepEqual(clone(r.s.projectData),before);assert.equal(r.s.uiState.currentInvestorId,'inv-A');
});
test('Direct view renderer cannot hide active editor',()=>{
 const r=setup();r.FC.views.showHome();assert.equal(r.s.document.getElementById('appView').style.display,'block');
});
test('Same-investor activation cannot discard unsaved RAM',()=>{
 const r=setup();r.s.projectData.room.cabinets[0].width=66;r.FC.investorProjectRuntime.setActiveProjectFromInvestor('inv-A');
 assert.equal(r.s.projectData.room.cabinets[0].width,66);
});
test('Direct investor project save cannot overwrite a newer unowned room',()=>{
 const r=setup(),row=r.FC.projectStore.getById('A');row.projectData.other.cabinets[0].width=75;r.FC.projectStore.upsert(row);
 r.s.projectData.room.cabinets[0].width=65;r.FC.projectStore.saveProjectDataForInvestor('inv-A',r.s.projectData);
 assert.equal(r.row('A').projectData.other.cabinets[0].width,75);
});
test('A failed durable begin cannot be bypassed by saveConfirmed',()=>{
 const r=runtime();r.s.uiState.roomType='room';r.storage.fail.set('set:'+SESSION,'throw');assert.equal(r.session.begin(),false);
 r.s.projectData.room.cabinets[0].width=65;assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,false);assert.equal(r.row('A').projectData.room.cabinets[0].width,60);
});
test('Contradictory persisted room owner is rejected',()=>{
 const r=setup(),row=r.FC.projectStore.getById('A');row.projectData.other.cabinets[0].width=75;r.FC.projectStore.upsert(row);
 const payload=JSON.parse(r.storage.getItem(SESSION));payload.roomId='other';payload.expectedOwnerKnown=true;
 payload.expectedOwnerRaw=JSON.stringify({roomPresent:true,room:row.projectData.other,definitionPresent:true,definition:row.projectData.meta.roomDefs.other});
 r.storage.rows.set(SESSION,JSON.stringify(payload));const restored=runtime(r.rows());
 assert.equal(restored.session.cancel(),false);assert.equal(restored.row('A').projectData.other.cabinets[0].width,75);
});
test('Physical dialog uses all three actions and Back keeps the scope',async()=>{
 const r=setup();r.load('js/app/ui/choice-box.js');
 const before=r.storage.getItem('fc_ui_v1'),snapshot=r.session.snapshot;
 const transition=r.FC.views.openRoom('other');
 const buttons=[...r.s.document.querySelectorAll('.confirm-actions button')];
 assert.deepEqual(buttons.map(b=>b.textContent),['Zapisz i przejdź','Anuluj zmiany i przejdź','Wróć do edycji']);
 assert.match(buttons[0].className,/is-success/);assert.match(buttons[1].className,/is-danger/);assert.match(buttons[2].className,/is-neutral/);
 buttons[2].click();assert.equal(await transition,false);
 assert.equal(r.session.snapshot,snapshot);assert.equal(r.storage.getItem('fc_ui_v1'),before);assert.equal(r.s.uiState.roomType,'room');
});
test('Save and nested view transition preserve a newer Salon and its metadata',async()=>{
 const r=setup(),row=r.FC.projectStore.getById('A');row.projectData.other.cabinets[0].width=75;row.projectData.meta.roomDefs.other.projectStatus='umowa';row.meta.note='newer';row.status='umowa';r.FC.projectStore.upsert(row);
 r.s.projectData.room.cabinets[0].width=65;r.FC.choiceBox.ask=async()=> 'save';
 assert.equal(await r.FC.views.openRoom('other'),true);assert.equal(r.session.active,true);assert.equal(r.session.roomId,'other');
 assert.equal(r.s.uiState.roomType,'other');assert.equal(r.row('A').projectData.room.cabinets[0].width,65);
 assert.equal(r.row('A').projectData.other.cabinets[0].width,75);assert.equal(r.row('A').projectData.meta.roomDefs.other.projectStatus,'umowa');assert.equal(r.row('A').meta.note,'newer');assert.equal(r.row('A').status,'umowa');
});
test('Failed write and failed cleanup both block Save and Go, then retry works',async()=>{
 for(const [key,mode] of [['set:fc_projects_v1','throw'],['remove:fc_edit_session_v1','throw']]){
  const r=setup(),snapshot=r.session.snapshot,context=r.session.context;let entered=0;
  r.s.projectData.room.cabinets[0].width=65;r.FC.choiceBox.ask=async()=> 'save';r.storage.fail.set(key,mode);
  assert.equal(await r.FC.sessionNavigation.requestTransition('Salonu',()=>{entered++;}),false);
  assert.equal(entered,0);assert.equal(r.session.active,true);assert.equal(r.session.snapshot,snapshot);assert.equal(r.session.context,context);assert.equal(r.s.uiState.roomType,'room');assert.ok(r.storage.getItem(SESSION));
  r.storage.fail.clear();assert.equal(await r.FC.sessionNavigation.requestTransition('Salonu',()=>{entered++;}),true);
  assert.equal(entered,1);assert.equal(r.session.active,false);assert.equal(r.storage.getItem(SESSION),null);
 }
});
test('Discard and Go handles failed rollback and then restores only Kuchnia',async()=>{
 const r=setup();r.s.projectData.room.cabinets[0].width=65;assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);
 const row=r.FC.projectStore.getById('A');row.projectData.other.cabinets[0].width=75;r.FC.projectStore.upsert(row);
 r.FC.choiceBox.ask=async()=> 'discard';r.storage.fail.set('set:'+PROJECTS,'throw');
 assert.equal(await r.FC.views.openRoom('other'),false);assert.equal(r.s.uiState.roomType,'room');assert.equal(r.session.active,true);
 r.storage.fail.clear();assert.equal(await r.FC.views.openRoom('other'),true);
 assert.equal(r.row('A').projectData.room.cabinets[0].width,60);assert.equal(r.row('A').projectData.other.cabinets[0].width,75);assert.equal(r.s.uiState.roomType,'other');
});
test('Same room and internal tabs do not prompt or rebaseline',async()=>{
 const r=setup(),snapshot=r.session.snapshot;let prompts=0;r.FC.choiceBox.ask=async()=>{prompts++;return'back';};
 await r.FC.views.openRoom('room');await r.FC.openRoom('room');
 for(const tab of ['material','wywiad'])await r.FC.tabNavigation.setActiveTab(tab);
 assert.equal(prompts,0);assert.equal(r.session.snapshot,snapshot);assert.equal(r.session.active,true);assert.equal(r.session.roomId,'room');
});
test('Two physical project records of one investor use the explicit active ID',()=>{
 const r=setup();r.FC.projectStore.upsert({id:'A2',investorId:'inv-A',projectData:{other:{cabinets:[{id:'second',width:80}]}}});
 const other=r.row('A2');r.s.projectData.room.cabinets[0].width=66;
 assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);
 assert.equal(r.row('A').projectData.room.cabinets[0].width,66);assert.deepEqual(r.row('A2'),other);assert.equal(r.FC.projectStore.getByInvestorId('inv-A').id,'A');
});
test('Unknown room cannot silently start a whole-investor session',()=>{
 const r=runtime();r.s.uiState.roomType='missing-room';assert.equal(r.session.begin(),false);assert.equal(r.session.active,false);assert.equal(r.storage.getItem(SESSION),null);
});
test('Failed pointer persistence cannot report a successful project activation',()=>{
 const r=runtime(),before=r.s.projectData;r.storage.fail.set('set:fc_current_project_id_v1','throw');
 assert.equal(r.FC.projectStore.setCurrentProjectId('B'),false);assert.equal(r.FC.projectStore.getCurrentProjectId(),'A');assert.equal(r.s.projectData,before);
});
test('Reload retains room ownership and never performs an automatic rollback',()=>{
 const r=setup();r.s.projectData.room.cabinets[0].width=65;assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);
 const row=r.FC.projectStore.getById('A');row.projectData.other.cabinets[0].width=75;r.FC.projectStore.upsert(row);
 const before=r.storage.getItem(PROJECTS),reload=runtime(r.rows());
 reload.s.uiState=JSON.parse(reload.storage.getItem('fc_ui_v1'));
 assert.equal(reload.storage.getItem(PROJECTS),before);assert.equal(reload.session.projectId,'A');assert.equal(reload.session.roomId,'room');assert.equal(reload.session.active,true);
 assert.equal(reload.session.cancel(),true);assert.equal(reload.row('A').projectData.room.cabinets[0].width,60);assert.equal(reload.row('A').projectData.other.cabinets[0].width,75);
});
test('A pending async transition does not admit a second concurrent transition',async()=>{
 const r=setup();r.FC.choiceBox.ask=async()=> 'save';
 let release,entered;const delayed=new Promise(resolve=>{release=resolve;});const started=new Promise(resolve=>{entered=resolve;});
 const first=r.FC.sessionNavigation.requestTransition('operacji',async()=>{entered();await delayed;});
 await started;let concurrent=0;
 assert.equal(await r.FC.sessionNavigation.requestTransition('innego projektu',()=>{concurrent++;}),false);assert.equal(concurrent,0);
 release();assert.equal(await first,true);
});
(async()=>{let failed=0;for(const[name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(e){failed++;console.log('FAIL '+name+': '+e.message);}}console.log(`${tests.length-failed}/${tests.length} PASS`);process.exitCode=failed?1:0;})().catch(e=>{console.error(e);process.exitCode=1;});
