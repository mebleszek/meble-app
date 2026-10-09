#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeMiniDocument } = require('./app-dev-smoke-lib/mini-document');
const ROOT = path.resolve(__dirname, '..');
const PROJECTS = 'fc_projects_v1';
const SESSION = 'fc_edit_session_v1';
const clone = value => JSON.parse(JSON.stringify(value));
const raw = value => JSON.stringify(value);
const selection = { zones:{ lower:true }, fields:{ body:true, front:true, back:true, opening:true, pcv:true } };
function project(){
  const old = { bodyColor:'Old body', frontMaterial:'laminat', frontColor:'Old front', backMaterial:'HDF', openingSystem:'Uchwyt', bodyPcvMode:'body' };
  return { schemaVersion:12, kuchnia:{
    settings:{ roomHeight:260, bottomHeight:86, legHeight:10, counterThickness:4, gapHeight:60, ceilingBlende:5 },
    preferences:{ zones:{ lower:{ bodyColor:'New body', frontMaterial:'MDF', frontColor:'New front', backMaterial:'Płyta 18', openingSystem:'TIP-ON', bodyPcvMode:'front', bodyPcvCustomColor:'New PCV' } } },
    cabinets:[{ ...old, id:'drawer', type:'stojąca', subType:'szuflady', width:60, height:86, frontCount:1, details:{ drawerLayout:'3_equal' } }, { ...old, id:'member', setId:'set', type:'stojąca' }],
    fronts:[{ id:'old-drawer-front', cabId:'drawer', material:'laminat', color:'Old front' }, { id:'set-front', setId:'set', material:'laminat', color:'Old front', frontMaterialSource:{ source:'lower' } }],
    sets:[{ ...old, id:'set', frontSource:{ source:'lower' } }],
  } };
}
function runtime(){
  class Storage {
    constructor(){ this.rows = new Map(); this.calls = []; this.fail = new Set(); }
    get length(){ return this.rows.size; }
    key(i){ return [...this.rows.keys()][i] ?? null; }
    getItem(k){ return this.rows.get(k) ?? null; }
    setItem(k,v){ this.calls.push(['set',k]); if(this.fail.has(k)) throw new Error('QuotaExceededError'); this.rows.set(k,String(v)); }
    removeItem(k){ this.calls.push(['remove',k]); this.rows.delete(k); }
    clear(){ throw new Error('clear forbidden'); }
  }
  const storage = new Storage();
  const ui = { begin:0, saves:0, renders:0, refreshes:0, closes:0, generated:0, messages:[], order:[], saveMode:'ok', panel:null, choice:'New body', picks:[], beforeSave:null };
  const s = { console, String, Number, Math, Map, Set, Date, Promise,
    Storage, localStorage:storage, document:makeMiniDocument(), projectData:project(),
    uiState:{ roomType:'kuchnia', activeTab:'wywiad' },
    setTimeout(){ return 1; }, clearTimeout(){}, requestAnimationFrame(fn){ fn(); }, addEventListener(){},
    renderCabinets(){ ui.renders++; }, renderTopHeight(){},
  };
  s.window = s; s.globalThis = s;
  let id = 0;
  s.FC = {
    utils:{ clone, uid:()=> 'generated-' + (++id) },
    infoBox:{ open(msg){ ui.messages.push(msg); } },
    views:{ refreshSessionButtons(){ ui.refreshes++; } },
    panelBox:{ open(cfg){ ui.panel = cfg; }, close(){ ui.closes++; } },
    catalogStore:{ getSheetMaterials(){ return [{ materialType:'laminat', name:'New body' }]; }, getHardwareManufacturers(){ return ['Blum','GTV','Rejs']; } },
    rozrysChoice:{
      createChoiceLauncher(label){ const b = s.document.createElement('button'); b.textContent = label; return b; },
      setChoiceLaunchValue(b,label){ b.textContent = label; },
      async openRozrysChoiceOverlay(){ return ui.picks.length ? ui.picks.shift() : ui.choice; },
    },
    project:{ save(){ throw new Error('Unconfirmed save forbidden'); }, saveConfirmed(next){
      ui.saves++; ui.order.push('save');
      assert.equal(s.FC.session.active, true); assert.equal(s.FC.session.durable, true);
      assert.notEqual(storage.getItem(SESSION), null);
      if(ui.beforeSave) ui.beforeSave(next);
      if(ui.saveMode === 'throw') throw new Error('Central save exception');
      if(ui.saveMode === 'fail') return { ok:false, project:clone(next) };
      storage.setItem(PROJECTS, raw(next));
      return { ok:true, project:clone(next) };
    } },
  };
  storage.setItem(PROJECTS, raw(s.projectData)); storage.calls = [];
  vm.createContext(s);
  const load = file => vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),s,{ filename:file });
  [ 'js/app/investor/session.js', 'js/app/room-preferences/room-preferences-model.js',
    'js/app/room-preferences/room-preferences-bulk-plan.js', 'js/app/room-preferences/room-preferences-bulk-apply.js',
    'js/app/cabinet/cabinet-fronts.js', 'js/app/ui/wywiad-room-accordion-actions.js',
    'js/app/ui/wywiad-room-settings.js', 'js/app/ui/settings-ui.js',
    'js/app/ui/wywiad-room-preferences.js', 'js/app/ui/wywiad-room-hardware-producers.js',
    'js/app/ui/wywiad-room-preferences-bulk-modal.js' ].forEach(load);
  const FC = s.FC;
  const begin = FC.session.begin.bind(FC.session);
  FC.session.begin = ()=> { ui.begin++; ui.order.push('begin'); return begin(); };
  const cancel = FC.session.cancel.bind(FC.session);
  FC.session.commit = ()=> { throw new Error('Local save must not commit global session'); };
  FC.session.cancel = ()=> { throw new Error('Local failure must not cancel global session'); };
  const generate = FC.cabinetFronts.generateFrontsForCabinet;
  FC.cabinetFronts.generateFrontsForCabinet = (...args)=> { ui.generated++; return generate(...args); };
  const apply = (options = selection)=> FC.roomPreferencesBulkApply.apply('kuchnia',
    vm.runInContext('(' + raw(options) + ')',s));
  return { s, FC, storage, ui, cancel, apply };
}
function settingsForm(r){
  const host = r.s.document.createElement('div'); host.id = 'roomSettingsSummary'; r.s.document.body.appendChild(host);
  r.FC.wywiadRoomSettings.renderSummary('kuchnia');
  return { host, input:host.querySelector('#roomSettingInline_roomHeight'), save:host.querySelector('.wywiad-room-inline-form__save') };
}
function button(node,label){ return Array.from(node.querySelectorAll('button')).find(b=> b.textContent === label); }
async function choose(node){ node.click(); for(let i=0;i<18;i++) await Promise.resolve(); }
function prefsNext(r){ const p = r.FC.roomPreferences.getRoomPreferences('kuchnia'); p.zones.lower.bodyColor = 'Changed'; return p; }
function preserved(r, baseline, central){
  assert.equal(raw(r.s.projectData), baseline);
  assert.equal(r.storage.getItem(PROJECTS), central);
}
const tests = [];
function test(name, fn){ tests.push([name, fn]); }

test('1 SETTINGS NO-OP', ()=>{
  const r = runtime(); const f = settingsForm(r); f.save.click();
  assert.equal(r.ui.begin,0); assert.equal(r.ui.saves,0); assert.equal(r.FC.session.isDirty(),false);
  assert.equal(r.FC.settingsUI.handleSettingChange('roomHeight','260.0').ok,true);
  assert.equal(r.ui.begin,0); assert.equal(r.storage.calls.length,0);
});
test('2 SETTINGS BEGIN FAIL keeps inputs', ()=>{
  const r = runtime(); const before = raw(r.s.projectData); const f = settingsForm(r); f.input.value = '270';
  r.storage.fail.add(SESSION); f.save.click();
  preserved(r,before,before); assert.equal(r.ui.saves,0); assert.equal(f.input.value,'270');
  assert.equal(f.host.querySelector('#roomSettingInline_roomHeight'),f.input);
  assert.equal(r.FC.session.active,true); assert.equal(r.FC.session.durable,false); assert.ok(r.ui.messages.length);
});
test('3 SETTINGS CENTRAL FAIL and legacy entry points', ()=>{
  const r = runtime(); const original = r.s.projectData; const before = raw(original); const f = settingsForm(r);
  r.ui.saveMode = 'fail'; f.input.value = '275'; f.save.click();
  preserved(r,before,before); assert.equal(r.s.projectData,original); assert.equal(f.input.value,'275');
  assert.equal(f.host.querySelector('#roomSettingInline_roomHeight'),f.input); assert.equal(r.ui.renders,0);
  assert.equal(r.FC.settingsUI.handleSettingChange('legHeight',15).ok,false);
  assert.equal(r.FC.wywiadRoomSettings.applySetting('bottomHeight',90).ok,false);
  preserved(r,before,before); assert.ok(r.ui.messages.length);
});
test('4 SETTINGS SUCCESS adopts confirmed project only after save', ()=>{
  const r = runtime(); const original = r.s.projectData; const before = raw(original);
  r.ui.beforeSave = next=> { assert.equal(raw(r.s.projectData),before); assert.notEqual(next,original); assert.equal(next.kuchnia.settings.roomHeight,280); };
  const result = r.FC.wywiadRoomSettings.applySettingsValues('kuchnia',{ roomHeight:280 });
  assert.equal(result.ok,true); assert.deepEqual(r.ui.order,['begin','save']);
  assert.equal(r.s.projectData,result.project); assert.equal(r.s.projectData.kuchnia.settings.roomHeight,280);
  assert.equal(raw(original),before); assert.equal(r.storage.getItem(PROJECTS),raw(r.s.projectData));
});
test('5 PREFERENCES normalized NO-OP and read-only preparation', ()=>{
  const r = runtime(); const before = raw(r.s.projectData);
  const p = r.FC.roomPreferences.getRoomPreferences('kuchnia');
  assert.equal(r.FC.roomPreferences.setRoomPreferencesConfirmed('kuchnia',p).changed,false);
  r.FC.roomPreferences.ensureProjectRoom('kuchnia').settings.roomHeight = 1;
  assert.equal(raw(r.s.projectData),before); assert.equal(r.ui.begin,0); assert.equal(r.ui.saves,0);
});
for(const [name,mode] of [['6 PREFERENCES BEGIN FAIL','begin'],['7 PREFERENCES CENTRAL FAIL','fail']]) test(name,async()=>{
  const r = runtime(); const before = raw(r.s.projectData); r.FC.wywiadRoomPreferences.open();
  const panel = r.ui.panel.contentNode; const choice = panel.querySelector('.wywiad-zone-card--lower button');
  r.ui.choice = 'Changed'; await choose(choice);
  if(mode === 'begin') r.storage.fail.add(SESSION); else r.ui.saveMode = 'fail';
  button(panel,'Zapisz zmiany').click(); // inline footer must preserve the same draft too
  button(panel,'Zapisz').click();
  preserved(r,before,before); assert.equal(r.ui.closes,0); assert.equal(r.ui.panel.contentNode,panel);
  assert.equal(choice.textContent,'Changed'); if(mode === 'begin') assert.equal(r.ui.saves,0);
  r.storage.fail.clear(); r.ui.saveMode = 'ok'; button(panel,'Zapisz').click();
  assert.equal(r.ui.closes,1); assert.equal(r.FC.roomPreferences.getRoomPreferences('kuchnia').zones.lower.bodyColor,'Changed');
});
test('8 HARDWARE FAILURE keeps draft cache and working selection', async()=>{
  for(const mode of ['begin','fail']){
    const r = runtime(); const before = raw(r.s.projectData); const api = r.FC.wywiadRoomHardwareProducers;
    const form = api.buildInlineForm('kuchnia',r.FC.roomPreferences.getRoomPreferences('kuchnia'));
    r.ui.picks = ['configure','system','Blum','blum_tandembox_antaro']; await choose(form.querySelector('[data-drawer-preference]'));
    if(mode === 'begin') r.storage.fail.add(SESSION); else r.ui.saveMode = 'fail';
    form.querySelector('.wywiad-room-inline-form__save').click(); preserved(r,before,before);
    const rebuilt = api.buildInlineForm('kuchnia',r.FC.roomPreferences.getRoomPreferences('kuchnia'));
    assert.equal(JSON.parse(rebuilt.querySelector('[data-drawer-preference]').getAttribute('data-drawer-preference')).systemKey,'blum_tandembox_antaro');
    assert.equal(r.ui.renders,0);
  }
});
test('9 HARDWARE SUCCESS clears draft only after confirmation', async()=>{
  const r = runtime(); const api = r.FC.wywiadRoomHardwareProducers;
  const form = api.buildInlineForm('kuchnia',r.FC.roomPreferences.getRoomPreferences('kuchnia'));
  r.ui.picks = ['configure','system','Blum','blum_tandembox_antaro']; await choose(form.querySelector('[data-drawer-preference]'));
  form.querySelector('.wywiad-room-inline-form__save').click();
  assert.equal(r.FC.roomPreferences.getRoomPreferences('kuchnia').drawerPreference.systemKey,'blum_tandembox_antaro');
  // A later external value must be used; an uncleared draft would resurrect Antaro.
  r.s.projectData.kuchnia.preferences.drawerPreference = null;
  r.s.projectData.kuchnia.preferences.hardwareDrawerSystems.drawers = '';
  r.s.projectData.kuchnia.preferences.hardwareProducers.drawers = '';
  const reopened = api.buildInlineForm('kuchnia',r.FC.roomPreferences.getRoomPreferences('kuchnia'));
  assert.equal(reopened.querySelector('[data-drawer-preference]').getAttribute('data-drawer-preference'),'null');
});
test('10 BULK no changes / not ready', ()=>{
  const r = runtime(); const before = raw(r.s.projectData);
  assert.equal(r.apply({ zones:{ lower:true },fields:{} }).ok,false);
  assert.equal(r.apply({ zones:{ upper:true },fields:{ body:true } }).ok,false);
  preserved(r,before,before); assert.equal(r.ui.begin,0); assert.equal(r.ui.generated,0); assert.equal(r.ui.saves,0);
});
test('11 BULK BEGIN FAIL: no mutations or regeneration', ()=>{
  const r = runtime(); const original = r.s.projectData; const before = raw(original); r.storage.fail.add(SESSION);
  assert.equal(r.apply().ok,false);
  preserved(r,before,before); assert.equal(r.s.projectData,original); assert.equal(r.ui.generated,0); assert.equal(r.ui.saves,0);
});
test('12 BULK CENTRAL FAIL restores full project, including thrown save', ()=>{
  for(const mode of ['fail','throw']){
    const r = runtime(); const before = raw(r.s.projectData); r.ui.saveMode = mode;
    r.ui.beforeSave = next=> { assert.notEqual(raw(next),before); assert.equal(next.kuchnia.sets[0].openingSystem,'TIP-ON'); assert.equal(next.kuchnia.cabinets[0].bodyPcvMode,'front'); };
    assert.equal(r.apply().ok,false);
    preserved(r,before,before); assert.equal(r.ui.generated,1); assert.equal(r.ui.renders,0);
    assert.equal(r.FC.session.active,true); assert.equal(r.FC.session.durable,true); assert.notEqual(r.storage.getItem(SESSION),null);
  }
});
test('13 BULK FRONT RESTORE and generation exception', ()=>{
  const r = runtime(); const before = raw(r.s.projectData); const fronts = raw(r.s.projectData.kuchnia.fronts);
  r.ui.saveMode = 'fail'; r.ui.beforeSave = next=> { assert.equal(next.kuchnia.cabinets[0].frontCount,3); assert.notEqual(raw(next.kuchnia.fronts),fronts); };
  assert.equal(r.apply().ok,false);
  assert.equal(raw(r.s.projectData.kuchnia.fronts),fronts); assert.equal(r.s.projectData.kuchnia.cabinets[0].frontCount,1);
  const generate = r.FC.cabinetFronts.generateFrontsForCabinet;
  r.FC.cabinetFronts.generateFrontsForCabinet = (...args)=> { generate(...args); throw new Error('Interrupted front generation'); };
  const saves = r.ui.saves;
  assert.equal(r.apply().ok,false);
  preserved(r,before,before); assert.equal(r.ui.saves,saves);
});
test('14 BULK SUCCESS persists cabinets, sets, fronts', ()=>{
  const r = runtime(); const result = r.apply();
  assert.equal(result.ok,true); const room = r.s.projectData.kuchnia;
  assert.equal(room.cabinets[0].frontCount,3); assert.equal(room.cabinets[0].frontMaterial,'MDF');
  assert.equal(room.sets[0].frontColor,'New front'); assert.equal(room.sets[0].bodyColor,'New body');
  assert.equal(room.fronts.find(f=> f.id === 'set-front').color,'New front');
  assert.equal(room.fronts.filter(f=>f.cabId === 'drawer').length,3);
  assert.equal(r.storage.getItem(PROJECTS),raw(r.s.projectData)); assert.deepEqual(r.ui.order,['begin','save']);
  assert.equal(r.FC.session.active,true); assert.equal(r.FC.session.isDirty(),true);
});
test('15 BULK MODAL FAILURE keeps selection/preview and allows retry', ()=>{
  const r = runtime(); r.FC.wywiadRoomPreferencesBulk.open('kuchnia'); const panel = r.ui.panel.contentNode;
  button(panel,'Otwieranie').click(); const toggle = button(panel,'Otwieranie'); const preview = panel.querySelector('.room-bulk-preview');
  const apply = button(panel,'Zastosuj'); r.ui.saveMode = 'fail'; apply.click();
  assert.equal(r.ui.closes,0); assert.equal(toggle.getAttribute('aria-pressed'),'true'); assert.equal(panel.querySelector('.room-bulk-preview'),preview);
  r.ui.saveMode = 'ok'; apply.click(); assert.equal(r.ui.closes,1); assert.equal(r.s.projectData.kuchnia.cabinets[0].openingSystem,'TIP-ON');
});
test('16 EXISTING DURABLE SESSION retains original baseline; global rollback remains possible', ()=>{
  const r = runtime(); const initial = r.storage.getItem(PROJECTS); assert.equal(r.FC.session.begin(),true);
  const snapshot = r.FC.session.snapshot; const started = r.FC.session.startedAt;
  r.s.projectData.kuchnia.settings.legHeight = 12; r.storage.setItem(PROJECTS,raw(r.s.projectData));
  assert.equal(r.FC.roomPreferences.setRoomPreferencesConfirmed('kuchnia',prefsNext(r)).ok,true);
  assert.equal(r.FC.session.snapshot,snapshot); assert.equal(r.FC.session.startedAt,started);
  assert.equal(r.FC.session.snapshot[PROJECTS],initial); assert.equal(r.FC.session.active,true);
  assert.equal(r.cancel(),true); assert.equal(r.storage.getItem(PROJECTS),initial);
});
test('17 RETRY settings and bulk after failed begin / save', ()=>{
  for(const kind of ['settings','bulk']){
    const r = runtime(); const before = raw(r.s.projectData); const f = kind === 'settings' ? settingsForm(r) : null;
    if(f) f.input.value = '285';
    const save = ()=> f ? f.save.click() : r.apply();
    r.storage.fail.add(SESSION); save(); preserved(r,before,before); const snapshot = r.FC.session.snapshot;
    r.storage.fail.clear(); r.ui.saveMode = 'fail'; save(); preserved(r,before,before);
    r.ui.saveMode = 'ok'; save(); assert.notEqual(raw(r.s.projectData),before); assert.equal(r.FC.session.snapshot,snapshot);
    assert.equal(r.FC.session.durable,true); assert.equal(r.storage.getItem(PROJECTS),raw(r.s.projectData));
    if(f) assert.equal(r.s.projectData.kuchnia.settings.roomHeight,285);
  }
});
(async()=>{
  for(const [name,fn] of tests){ await fn(); console.log('PASS ' + name); }
  console.log(`OK WYWIAD durable room save: ${tests.length}/${tests.length}`);
})().catch(error=> { console.error(error.stack || error); process.exitCode = 1; });
