'use strict';
// Real project/session/router/UI modules with controlled DOM/storage. Native
// touch, offline trust and responsive layout are mandatory in the browser smoke.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {fixture}=require('./project-navigation-blockers-smoke');
const {makeMiniDocument}=require('./app-dev-smoke-lib/mini-document');
function setup(){
 const r=fixture(),s=r.s,fc=r.FC;s.document=makeMiniDocument();s.scrollTo=()=>{};
 // The older non-UI fixture leaves Q's owner/policy metadata unspecified.
 // Use a complete persisted project; do not ask activation to migrate it.
 const q=fc.projectStore.getById('Q');q.projectData.meta={...q.projectData.meta,assignedInvestorId:'N',productionPcvMode:'project',roomDefs:{},roomOrder:[]};fc.projectStore.upsert(q);
 for(const id of ['homeView','modeHubView','roomsView','appView','investorView','rozrysView','magazynView','investorsListView','investorsListRoot','serviceOrdersListView','topBar','topTabs','sessionButtons','sessionCancel','sessionSave','floatingAdd','investorRoot']){
  const el=s.document.createElement('div');el.id=id;s.document.body.appendChild(el);
 }
 s.document.getElementById('investorView').appendChild(s.document.getElementById('investorRoot'));
 s.document.getElementById('investorsListView').appendChild(s.document.getElementById('investorsListRoot'));
 for(const tab of ['wywiad','material','rysunek','czynnosci','inwestor','wycena','rozrys','magazyn']){const b=s.document.createElement('button');b.className='tab-btn';b.setAttribute('data-tab',tab);s.document.getElementById('topTabs').appendChild(b);}
 r.load=file=>vm.runInContext(fs.readFileSync(file,'utf8'),s,{filename:file});
 for(const file of ['js/app/investor/investor-rooms.js','js/app/ui/sections.js','js/app/ui/views.js','js/app/ui/tab-navigation.js'])r.load(file);
 r.node=id=>s.document.getElementById(id);return r;
}
const tests=[],test=(name,fn)=>tests.push([name,fn]);
test('Room-required tabs without a selected room show INWESTOR with existing rooms and one explicit cue',()=>{
 for(const tab of ['wywiad','material','rysunek','czynnosci']){
  const r=setup();r.FC.tabNavigation.setActiveTab(tab);
  assert.equal(r.s.uiState.activeTab,'inwestor');assert.equal(r.node('investorView').style.display,'block');assert.equal(r.node('roomsView').style.display,'none');
  const root=r.node('investorRoot'),hint=r.node('investor-room-hint');assert.equal(hint.hidden,false);assert.equal(hint.textContent,'Wybierz pomieszczenie lub dodaj nowe.');
  assert.equal(root.querySelectorAll('.investor-room-cue').length,3);assert.equal(r.FC.session.active,false);
  r.FC.investorUI.render();assert.equal(r.node('investor-room-hint').hidden,true,'Ordinary render must not restart the cue');
 }
});
test('No-room investor highlights Add; actual existing block precedes Typ with no duplicate room list',()=>{
 const r=setup(),empty=r.FC.projectStore.getById('Q');delete empty.projectData.room_n;r.FC.projectStore.upsert(empty);
 r.FC.investors.setCurrentId('N');assert.notEqual(r.FC.investorProjectRuntime.setActiveProjectFromInvestor('N'),false);
 r.s.uiState=r.FC.uiState.set({entry:'rooms',currentInvestorId:'N',roomType:null,activeTab:'inwestor'});
 r.FC.tabNavigation.setActiveTab('wywiad');
 const root=r.node('investorRoot'),add=root.querySelector('.investor-add-room-btn');assert.ok(add.classList.contains('investor-room-cue'));
 const html=root.innerHTML;assert.ok(html.indexOf('Pomieszczenia')<html.indexOf('invKind'));assert.equal(root.querySelectorAll('.investor-rooms-head').length,1);assert.match(html,/Brak dodanych pomieszczeń/);
});
test('Missing investor opens the real list without creating owner or project',()=>{
 const r=setup();r.FC.investorPersistence.setCurrentInvestorId(null);r.s.uiState=r.FC.uiState.set({currentInvestorId:null,roomType:null,entry:'app'});
 const raw=r.storage.getItem('fc_projects_v1');r.FC.tabNavigation.setActiveTab('material');
 assert.equal(r.node('investorsListView').style.display,'block');assert.equal(r.storage.getItem('fc_projects_v1'),raw);assert.equal(r.FC.investors.getCurrentId(),null);
});
test('Selected Kitchen stays owned across all four tabs and ordinary INWESTOR visits',async()=>{
 const r=setup();assert.equal(await r.open(),true);const snapshot=r.FC.session.snapshot;
 for(const tab of ['wywiad','material','rysunek','czynnosci','inwestor','wywiad']){await r.FC.tabNavigation.setActiveTab(tab);assert.equal(r.s.uiState.roomType,'room_k');assert.equal(r.FC.session.snapshot,snapshot);assert.equal(r.FC.session.roomId,'room_k');}
});
test('Clean Exit from every project tab durably commits before list; no rollback, project write or reload',async()=>{
 for(const tab of ['wywiad','material','rysunek','czynnosci','inwestor','wycena','rozrys','magazyn']){
  const r=setup();r.FC.investorProjectPatches.patchInvestorsAPI();await r.open();await r.FC.tabNavigation.setActiveTab(tab);
  const raw=r.storage.getItem('fc_projects_v1'),history=r.storage.getItem('fc_quote_snapshots_v1'),active=r.FC.session.active;let commits=0;
  const commit=r.FC.session.commit;r.FC.session.commit=()=>{assert.notEqual(r.node('investorsListView').style.display,'block','Must not leave before durable close');commits++;return commit();};r.FC.session.cancel=()=>{throw Error('Clean Exit must not rollback');};
  assert.equal(await r.handlers['session-cancel']({}),true);assert.equal(r.FC.session.active,false);assert.equal(r.storage.getItem('fc_edit_session_v1'),null);
  assert.equal(r.s.uiState.entry,'investorsList');assert.equal(r.node('investorsListView').style.display,'block');assert.equal(r.s.uiState.roomType,null);assert.equal(r.FC.investors.getCurrentId(),null);
  assert.equal(r.storage.getItem('fc_projects_v1'),raw);assert.equal(r.storage.getItem('fc_quote_snapshots_v1'),history);assert.equal(r.s.location.reloads||0,0);assert.equal(commits,active?1:0);
 }
});
test('Unconfirmed clean cleanup or central read blocks Exit without moving UI',async()=>{
 for(const kind of ['cleanup','read','pointer']){
  const r=setup();await r.open();const scope=r.FC.session.snapshot;
  if(kind==='cleanup')r.storage.fail.set('remove:fc_edit_session_v1','throw');
  else if(kind==='read')r.FC.project.load=()=>{throw Error('Unconfirmed central read');};
  else r.storage.fail.set('remove:fc_current_investor_v1','throw');
  assert.equal(await r.handlers['session-cancel']({}),false);assert.equal(r.s.uiState.roomType,'room_k');assert.notEqual(r.node('investorsListView').style.display,'block');assert.ok(r.messages.length);
  if(kind==='cleanup'){assert.equal(r.FC.session.active,true);assert.equal(r.FC.session.snapshot,scope);}
 }
});
test('Dirty Cancel declined or failed preserves exact work/snapshot; accepted Cancel reopens same room',async()=>{
 const r=setup();await r.open();r.s.projectData.room_k.cabinets[0].width=65;const snapshot=r.FC.session.snapshot;
 r.FC.confirmBox={ask:async()=>false};await r.handlers['session-cancel']({});assert.equal(r.s.projectData.room_k.cabinets[0].width,65);assert.equal(r.FC.session.snapshot,snapshot);
 assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);r.storage.fail.set('fc_projects_v1','throw');r.FC.confirmBox.ask=async()=>true;
 await r.handlers['session-cancel']({});assert.equal(r.FC.session.snapshot,snapshot);assert.equal(r.s.uiState.roomType,'room_k');r.storage.fail.clear();
 await r.handlers['session-cancel']({});assert.equal(r.s.uiState.roomType,'room_k');assert.equal(r.FC.session.active,true);assert.equal(r.FC.session.isDirty(),false);assert.equal(r.s.projectData.room_k.cabinets[0].width,60);
});
test('Investor edit lock refuses redirects and Exit without committing form or project',async()=>{
 const r=setup();r.FC.investorEditorState.enter(r.inv());r.FC.investorEditorState.setField('name','UNSAVED');const raw=r.storage.getItem('fc_projects_v1');
 await r.FC.tabNavigation.setActiveTab('material');await r.handlers['session-cancel']({});assert.notEqual(r.s.uiState.entry,'investorsList');assert.equal(r.FC.investorEditorState.state.draft.name,'UNSAVED');assert.equal(r.storage.getItem('fc_projects_v1'),raw);
});
test('WYCENA and ROZRYS remain project-wide without room; compatibility openRooms never displays old panel',async()=>{
 for(const tab of ['wycena','rozrys']){const r=setup();await r.FC.tabNavigation.setActiveTab(tab);assert.equal(r.s.uiState.activeTab,tab);assert.equal(r.s.uiState.roomType,null);assert.equal(r.node(tab==='wycena'?'appView':'rozrysView').style.display,'block');assert.equal(r.node('roomsView').style.display,'none');}
 const r=setup();await r.FC.views.openRooms();assert.equal(r.node('investorView').style.display,'block');assert.equal(r.node('roomsView').style.display,'none');
});
test('Switching investor clears former selected room and retains all project/legacy RAW',async()=>{
 const r=setup();await r.open();assert.equal(r.FC.session.commit(),true);const projects=r.storage.getItem('fc_projects_v1');r.storage.setItem('fc_project_inv_K','LEGACY-EXACT');
 assert.equal(await r.handlers['open-investor']({element:{getAttribute:()=> 'N'}}),true);assert.equal(r.s.uiState.roomType,null);assert.equal(r.s.uiState.lastRoomType,null);assert.equal(r.s.uiState.currentInvestorId,'N');assert.equal(r.storage.getItem('fc_project_inv_K'),'LEGACY-EXACT');assert.equal(r.storage.getItem('fc_projects_v1'),projects);
});
test('Cue is three short nonblocking pulses with reduced-motion alternative; topbar keeps accessible warning/status',()=>{
 const css=fs.readFileSync('css/investor-layout.css','utf8'),html=fs.readFileSync('index.html','utf8');assert.match(css,/investor-room-cue \.45s ease-in-out 3/);assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/animation:none/);assert.equal(/investor-room-cue[^}]*pointer-events/.test(css),false);
 assert.match(html,/id="main-trust-phone"[^>]*aria-describedby="main-trust-note"/);assert.match(html,/> Zaufany<\/label>/);assert.match(html,/id="main-trust-status" role="status" aria-live="polite"/);assert.match(html,/flex-wrap:nowrap/);assert.match(html,/Każda osoba korzystająca z tego profilu uzyska dostęp do lokalnych danych/);
});
test('Navigation preserves existing backup/history/catalog/legacy RAW byte-for-byte without migration',async()=>{
 const r=setup(),keys=['fc_data_backups_v1','fc_quote_snapshots_v1','fc_quote_rates_v1','fc_sheets_v1','fc_project_inv_K_v1'];
 for(const key of keys)r.storage.setItem(key,' [ { "legacy": true, "unknownFutureField": "EXACT\\nRAW" } ] ');
 const before=new Map(keys.map(key=>[key,r.storage.getItem(key)]));await r.open();await r.handlers['session-cancel']({});
 for(const key of keys)assert.equal(r.storage.getItem(key),before.get(key),key);
});
async function main(){let failed=0;for(const[name,fn]of tests){try{await fn();console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack);}}console.log(`${tests.length-failed}/${tests.length} PASS`);if(failed)process.exitCode=1;}
if(require.main===module)main();module.exports={main,setup};
