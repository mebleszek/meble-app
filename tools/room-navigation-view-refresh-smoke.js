#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { runtime } = require('./project-session-owner-rollback-smoke');
const { makeMiniDocument } = require('./app-dev-smoke-lib/mini-document');
const root = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
function setup(seed){
  const r = runtime(seed), s = r.s, FC = r.FC;
  s.document = makeMiniDocument();
  // MiniDocument lacks class+attribute selectors used by the production tab bar.
  const query = s.document.querySelector.bind(s.document);
  s.document.querySelector = selector => {
    const tab = selector.match(/^\.tab-btn\[data-tab="([^"]+)"\]$/);
    return tab ? [...s.document.querySelectorAll('.tab-btn')].find(b=>b.getAttribute('data-tab')===tab[1]) || null : query(selector);
  };
  s.scrollTo = () => {};
  s.STORAGE_KEYS = FC.constants.STORAGE_KEYS;
  const app = s.document.getElementById('appView');
  app.innerHTML = '<h2 id="roomTitle"></h2><div id="roomSettingsCard"><div id="roomSettingsSummary"></div></div><div id="cabinetsList"></div>';
  if(!seed){
    const row = FC.projectStore.getById('A');
    row.projectData.room.settings.roomHeight = 260;
    row.projectData.other = { cabinets:[{id:'cab-salon',width:70,height:80,depth:50,type:'stojąca',subType:'drzwi'}], fronts:[], sets:[], settings:{roomHeight:280} };
    row.projectData.meta.roomDefs = {room:{id:'room',label:'Kuchnia'},other:{id:'other',label:'Salon'}};
    row.projectData.meta.roomOrder = ['room','other'];
    assert.ok(FC.projectStore.upsert(row));
  }
  s.projectData = FC.project.load();
  FC.roomRegistry = {getRoomLabel:room=>s.projectData.meta.roomDefs[room].label};
  const load = file => vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),s,{filename:file});
  for(const file of ['js/app/project/project-pcv-policy.js','js/app/shared/ui-state.js','js/app/ui/views.js','js/app/ui/tab-navigation.js','js/app/shared/public-api.js',
    'js/app/ui/choice-box.js','js/app/ui/sections.js','js/app/ui/tabs-router.js','js/app/ui/cabinets-render.js',
    'js/tabs/wywiad.js','js/app/ui/wywiad-room-settings.js']) load(file);
  // Same adapter contract as app.js; actual production renderers build the DOM.
  s.renderCabinets = () => FC.cabinetsRender.renderCabinets({document:s.document,getUiState:()=>s.uiState,getProjectData:()=>s.projectData});
  s.uiState = FC.uiState.get();
  if(!seed) s.uiState = FC.uiState.set({entry:'rooms',activeTab:'pokoje',roomType:null,currentInvestorId:'inv-A'});
  r.element = id=>s.document.getElementById(id);
  r.open = room=>r.handlers['open-room']({element:{getAttribute:()=>room}});
  r.decision = async (room, index) => {
    const pending = r.open(room);
    const buttons = [...s.document.querySelectorAll('.confirm-actions button')];
    assert.deepEqual(buttons.map(b=>b.textContent),['Zapisz i przejdź','Anuluj zmiany i przejdź','Wróć do edycji']);
    buttons[index].click();
    return pending;
  };
  r.visible = (room,width) => {
    assert.equal(r.element('appView').style.display,'block');
    assert.equal(r.element('investorView').style.display,'none');
    assert.equal(r.element('roomTitle').textContent,room==='room'?'Kuchnia':'Salon');
    const cards = [...r.element('cabinetsList').querySelectorAll('.cabinet')];
    assert.deepEqual(cards.map(c=>c.id),[room==='room'?'cab-cab-A':'cab-cab-salon']);
    assert.match(cards[0].textContent,new RegExp(String(width)+' ×'));
    assert.ok(cards[0].querySelector('button[data-act="edit"]'));
    assert.equal(r.element('roomSettingInline_roomHeight').value,room==='room'?'260':'280');
    const active = [...s.document.querySelectorAll('.tab-btn')].filter(b=>b.style.background==='#e6f7ff');
    assert.deepEqual(active.map(b=>b.getAttribute('data-tab')),['wywiad']);
    assert.equal(FC.session.projectId,'A');
    assert.equal(FC.session.roomId,room);
  };
  r.start = async () => { await FC.openRoom('room'); await FC.tabNavigation.setActiveTab('wywiad'); r.visible('room',60); };
  return r;
}
const tests = [], test = (name,fn)=>tests.push([name,fn]);
test('INWESTOR → Salon / Discard immediately renders Salon, settings, cards and WYWIAD',async()=>{
  const r=setup();await r.start();r.s.projectData.room.cabinets[0].width=65;
  assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);
  await r.FC.tabNavigation.setActiveTab('inwestor');
  assert.equal(await r.decision('other',1),true);r.visible('other',70);
  assert.equal(r.row('A').projectData.room.cabinets[0].width,60);
});
test('INWESTOR → Salon / Save renders immediately and preserves saved Kitchen',async()=>{
  const r=setup();await r.start();r.s.projectData.room.cabinets[0].width=65;
  const salon=clone(r.row('A').projectData.other);
  await r.FC.tabNavigation.setActiveTab('inwestor');
  assert.equal(await r.decision('other',0),true);r.visible('other',70);
  assert.equal(r.row('A').projectData.room.cabinets[0].width,65);
  assert.deepEqual(r.row('A').projectData.other,salon);
});
test('Back retains Kitchen DOM, active investor tab, snapshot and edited RAM',async()=>{
  const r=setup();await r.start();r.s.projectData.room.cabinets[0].width=65;
  await r.FC.tabNavigation.setActiveTab('inwestor');const snapshot=r.FC.session.snapshot;
  assert.equal(await r.decision('other',2),false);
  assert.equal(r.element('roomTitle').textContent,'Kuchnia');assert.ok(r.element('cab-cab-A'));assert.equal(r.element('cab-cab-salon'),null);
  assert.equal(r.element('investorView').style.display,'block');
  assert.equal(r.s.uiState.activeTab,'inwestor');assert.equal(r.FC.session.snapshot,snapshot);
  assert.equal(r.FC.session.roomId,'room');assert.equal(r.s.projectData.room.cabinets[0].width,65);
});
test('Repeated open refreshes DOM without dialog, session duplication or project write',async()=>{
  const r=setup();await r.start();const snapshot=r.FC.session.snapshot,started=r.FC.session.startedAt;
  await r.FC.tabNavigation.setActiveTab('inwestor');
  r.storage.calls.length=0;
  assert.equal(await r.open('room'),true);r.visible('room',60);
  assert.equal(r.s.document.querySelector('.confirm-actions'),null);
  assert.equal(r.FC.session.snapshot,snapshot);assert.equal(r.FC.session.startedAt,started);
  assert.equal(r.storage.calls.filter(c=>['fc_projects_v1','fc_edit_session_v1'].includes(c[1])).length,0);
});
test('Active Salon exposes only Salon cabinet editing controls',async()=>{
  const r=setup();await r.start();assert.equal(await r.open('other'),true);r.visible('other',70);
  assert.equal(r.element('cabinetsList').querySelectorAll('button[data-act="edit"]').length,1);
  assert.equal(r.element('cab-cab-A'),null);
  const payload=JSON.parse(r.storage.getItem('fc_edit_session_v1'));
  assert.equal(payload.roomId,'other');assert.equal(payload.projectId,'A');
});
test('Room list → Salon → Kitchen refreshes both ways with no stale editable cards',async()=>{
  const r=setup();r.FC.views.applyFromState(r.s.uiState);
  assert.equal(await r.open('other'),true);r.visible('other',70);
  assert.equal(await r.open('room'),true);r.visible('room',60);
  assert.equal(r.element('cab-cab-salon'),null);
  assert.equal(await r.open('other'),true);r.visible('other',70);
  assert.equal(r.element('cab-cab-A'),null);
});
test('Failed save and rollback keep old DOM and session, then retry renders destination',async()=>{
  for(const action of [0,1]){
    const r=setup();await r.start();r.s.projectData.room.cabinets[0].width=65;
    assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);
    await r.FC.tabNavigation.setActiveTab('inwestor');const snapshot=r.FC.session.snapshot;
    r.storage.fail.set('set:fc_projects_v1','throw');assert.equal(await r.decision('other',action),false);
    assert.equal(r.element('roomTitle').textContent,'Kuchnia');assert.ok(r.element('cab-cab-A'));assert.equal(r.element('cab-cab-salon'),null);
    assert.equal(r.element('investorView').style.display,'block');assert.equal(r.FC.session.snapshot,snapshot);
    assert.equal(r.FC.session.roomId,'room');assert.equal(r.FC.session.active,true);
    r.storage.fail.clear();assert.equal(await r.decision('other',action),true);r.visible('other',70);
  }
});
test('Reload reads saved rooms and restores Salon ownership without rollback or write',async()=>{
  const r=setup();await r.start();r.s.projectData.room.cabinets[0].width=65;
  assert.equal(await r.decision('other',0),true);r.visible('other',70);
  const raw=r.storage.getItem('fc_projects_v1'),restored=setup(r.rows());
  restored.storage.calls.length=0;
  restored.FC.views.applyFromState(restored.s.uiState);
  await restored.FC.tabNavigation.setActiveTab(restored.s.uiState.activeTab);
  restored.visible('other',70);assert.equal(restored.row('A').projectData.room.cabinets[0].width,65);
  assert.equal(restored.storage.getItem('fc_projects_v1'),raw);
  assert.equal(restored.storage.calls.filter(c=>['fc_projects_v1','fc_edit_session_v1'].includes(c[1])).length,0);
});
async function changedKitchen(persist=true){
  const r=setup();await r.start();r.FC.confirmBox={ask:async cfg=>{assert.equal(cfg.title,'ANULOWAĆ ZMIANY?');return true;}};
  r.s.projectData.room.cabinets[0].width=65;
  if(persist)assert.equal(r.FC.project.saveConfirmed(r.s.projectData).ok,true);
  r.s.renderCabinets();r.FC.views.refreshSessionButtons();
  assert.equal(r.element('sessionCancel').textContent,'Anuluj');assert.equal(r.element('sessionSave').style.display,'');
  return r;
}
test('Cancel restores Kitchen in the rendered editor and starts a new clean durable session',async()=>{
  const r=await changedKitchen(),snapshot=r.FC.session.snapshot;
  const newer=r.FC.projectStore.getById('A');newer.projectData.other.cabinets[0].width=75;assert.ok(r.FC.projectStore.upsert(newer));
  const salon=clone(r.row('A').projectData.other);
  await r.handlers['session-cancel']({});r.visible('room',60);
  assert.equal(r.s.location.reloads,0);assert.equal(r.FC.session.active,true);assert.equal(r.FC.session.durable,true);
  assert.notEqual(r.FC.session.snapshot,snapshot);assert.equal(r.FC.session.isDirty(),false);
  assert.equal(r.element('sessionCancel').textContent,'Wyjdź');assert.equal(r.element('sessionSave').style.display,'none');
  assert.deepEqual(r.row('A').projectData.other,salon);assert.equal(JSON.parse(r.storage.getItem('fc_edit_session_v1')).roomId,'room');
});
test('Failed central reload hides the editor; later tab entry cannot skip a new durable session',async()=>{
  const r=await changedKitchen(),reload=r.FC.sessionNavigation.reloadCentral;
  r.FC.sessionNavigation.reloadCentral=()=>false;await r.handlers['session-cancel']({});
  assert.equal(r.row('A').projectData.room.cabinets[0].width,60);assert.equal(r.FC.session.active,false);
  assert.equal(r.element('appView').style.display,'none');assert.equal(r.s.location.reloads,0);
  r.FC.sessionNavigation.reloadCentral=reload;assert.equal(reload(),true);
  await r.FC.tabNavigation.setActiveTab('wywiad');r.visible('room',60);assert.equal(r.FC.session.durable,true);
});
test('RAM-only Cancel stays in Kitchen without writing the project',async()=>{
  const r=await changedKitchen(false),raw=r.storage.getItem('fc_projects_v1');r.storage.calls.length=0;
  await r.handlers['session-cancel']({});r.visible('room',60);
  assert.equal(r.storage.getItem('fc_projects_v1'),raw);assert.ok(!r.storage.calls.some(c=>c[1]==='fc_projects_v1'));assert.equal(r.s.location.reloads,0);
});
test('Next edit saves inside the new session, and clean Exit still leaves the editor',async()=>{
  const r=await changedKitchen();await r.handlers['session-cancel']({});r.visible('room',60);
  r.s.projectData.room.cabinets[0].width=66;r.s.renderCabinets();r.FC.views.refreshSessionButtons();
  r.handlers['session-save']({});
  assert.equal(r.row('A').projectData.room.cabinets[0].width,66);assert.equal(r.FC.session.active,false);
  assert.equal(r.element('appView').style.display,'block');assert.equal(r.element('roomTitle').textContent,'Kuchnia');assert.match(r.element('cab-cab-A').textContent,/66 ×/);
  assert.equal(r.element('sessionCancel').textContent,'Wyjdź');assert.equal(r.element('sessionSave').style.display,'none');
  await r.handlers['session-cancel']({});assert.equal(r.element('appView').style.display,'none');assert.equal(r.element('homeView').style.display,'block');assert.equal(r.s.location.reloads,0);
});
test('Declined Cancel keeps edited DOM, RAM and the original durable snapshot',async()=>{
  const r=await changedKitchen(),snapshot=r.FC.session.snapshot,payload=r.storage.getItem('fc_edit_session_v1'),raw=r.storage.getItem('fc_projects_v1');
  r.FC.confirmBox.ask=async()=>false;await r.handlers['session-cancel']({});r.visible('room',65);
  assert.equal(r.FC.session.snapshot,snapshot);assert.equal(r.storage.getItem('fc_edit_session_v1'),payload);assert.equal(r.storage.getItem('fc_projects_v1'),raw);
  assert.equal(r.element('sessionCancel').textContent,'Anuluj');assert.equal(r.s.location.reloads,0);
});
test('Confirmation error never cancels or replaces the editing session',async()=>{
  const r=await changedKitchen(),snapshot=r.FC.session.snapshot,raw=r.storage.getItem('fc_projects_v1');
  r.FC.confirmBox.ask=async()=>{throw Error('Dialog unavailable');};await r.handlers['session-cancel']({});r.visible('room',65);
  assert.equal(r.FC.session.snapshot,snapshot);assert.equal(r.storage.getItem('fc_projects_v1'),raw);assert.equal(r.s.location.reloads,0);
});
test('Rollback and cleanup failure keep the current editor and snapshot; retry stays in Kitchen',async()=>{
  for(const failure of ['set:fc_projects_v1','remove:fc_edit_session_v1']){
    const r=await changedKitchen(),snapshot=r.FC.session.snapshot,payload=r.storage.getItem('fc_edit_session_v1'),salon=clone(r.row('A').projectData.other);
    r.storage.fail.set(failure,'throw');await r.handlers['session-cancel']({});r.visible('room',65);
    assert.equal(r.FC.session.snapshot,snapshot);assert.equal(r.storage.getItem('fc_edit_session_v1'),payload);assert.equal(r.s.location.reloads,0);
    assert.deepEqual(r.row('A').projectData.other,salon);r.storage.fail.clear();await r.handlers['session-cancel']({});r.visible('room',60);
  }
});
test('Failed new durable baseline hides unsafe editor, preserves rollback and permits reopening',async()=>{
  const r=await changedKitchen(),salon=clone(r.row('A').projectData.other);
  r.storage.fail.set('set:fc_edit_session_v1','throw');await r.handlers['session-cancel']({});
  assert.equal(r.row('A').projectData.room.cabinets[0].width,60);assert.deepEqual(r.row('A').projectData.other,salon);
  assert.equal(r.s.uiState.roomType,'room');assert.equal(r.s.uiState.currentInvestorId,'inv-A');assert.equal(r.FC.projectStore.getCurrentProjectId(),'A');
  assert.equal(r.element('appView').style.display,'none');assert.equal(r.s.location.reloads,0);
  assert.equal(r.FC.session.active,true);assert.equal(r.FC.session.durable,false);const snapshot=r.FC.session.snapshot;
  assert.ok(r.messages.some(m=>/zabezpieczyć|zabezpieczenia/.test(m.title+' '+m.message)));
  r.storage.fail.clear();assert.equal(await r.open('room'),true);r.visible('room',60);assert.equal(r.FC.session.snapshot,snapshot);assert.equal(r.FC.session.durable,true);
});
test('Clean Exit after local Cancel still leaves the room rather than cancelling again',async()=>{
  const r=await changedKitchen();await r.handlers['session-cancel']({});r.visible('room',60);
  let confirmations=0;r.FC.confirmBox.ask=async()=>{confirmations++;return true;};
  await r.handlers['session-cancel']({});assert.equal(confirmations,0);assert.equal(r.FC.session.active,false);
  assert.equal(r.s.uiState.entry,'rooms');assert.equal(r.element('appView').style.display,'none');assert.equal(r.element('roomsView').style.display,'block');
});
(async()=>{let failed=0;for(const [name,fn] of tests){try{await fn();console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack);}}console.log(`${tests.length-failed}/${tests.length} PASS`);process.exitCode=failed?1:0;})();
