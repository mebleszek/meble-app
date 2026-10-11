#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeMiniDocument } = require('./app-dev-smoke-lib/mini-document');
const ROOT = path.resolve(__dirname, '..');
const GLOBAL = 'fc_program_defaults_v1';
const clone = value=> JSON.parse(JSON.stringify(value));
function runtime(){
  const rows = new Map(); const writes = [];
  const ui = { begin:0, save:0, choices:[], picked:null, bulk:null };
  const s = { console, document:makeMiniDocument(), uiState:{ roomType:'kuchnia' },
    projectData:{ schemaVersion:12, kuchnia:{ settings:{}, cabinets:[], fronts:[], sets:[], preferences:{} } },
    localStorage:{ getItem:k=> rows.get(k) ?? null, setItem(k,v){ writes.push(k); rows.set(k,String(v)); }, removeItem(k){ writes.push(k); rows.delete(k); }, clear(){ throw new Error('clear forbidden'); } },
  };
  s.window = s;
  s.FC = {
    utils:{ clone }, session:{ begin(){ ui.begin++; return true; } },
    project:{ saveConfirmed(p){ ui.save++; return { ok:true, project:clone(p) }; } },
    catalogStore:{ getHardwareManufacturers:()=> ['Blum','GTV','Rejs','Hettich'], getSheetMaterials:()=> [
      { materialType:'laminat', name:'Egger W1100' }, { materialType:'laminat', name:'Egger U999' }, { materialType:'akryl', name:'Front global' },
    ] },
    rozrysChoice:{
      createChoiceLauncher(label){ const b = s.document.createElement('button'); b.textContent = label; return b; },
      setChoiceLaunchValue(b,label){ b.textContent = label; },
      async openRozrysChoiceOverlay(cfg){ ui.choices.push(cfg); return ui.picked; },
    },
    wywiadRoomPreferencesBulk:{ open(room){ ui.bulk = { room, preferences:s.FC.roomPreferences.getRoomPreferences(room) }; } },
  };
  vm.createContext(s);
  for(const file of ['js/app/settings/program-defaults-store.js','js/app/room-preferences/room-preferences-model.js',
    'js/app/ui/wywiad-room-accordion-actions.js','js/app/ui/wywiad-room-preferences.js','js/app/ui/wywiad-room-hardware-producers.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),s,{ filename:file });
  }
  s.FC.programDefaults.write({ materials:{ bodyColor:'Egger W1100',frontMaterial:'akryl',frontColor:'Front global',backMaterial:'HDF 3mm biała' },
    hardware:{ hingesManufacturer:'Blum', drawerSystemManufacturer:'Blum', liftManufacturer:'Rejs', cargoManufacturer:'GTV', accessoriesManufacturer:'Hettich' } });
  writes.length = 0;
  const api = s.FC.roomPreferences;
  return { s, ui, writes, api,
    materials:()=> s.FC.wywiadRoomPreferences.buildInlineForm('kuchnia',api.getRoomPreferences('kuchnia')),
    hardware:()=> s.FC.wywiadRoomHardwareProducers.buildInlineForm('kuchnia',api.getRoomPreferences('kuchnia')),
  };
}
function body(form){ return form.querySelector('.wywiad-zone-card--lower .wywiad-zone-field'); }
function producer(form,key){ return form.querySelector('.wywiad-hardware-field--' + key); }
function shows(field,value,source){
  assert.equal(field.querySelector('.wywiad-zone-choice').textContent,value);
  const meta = field.querySelector('.wywiad-zone-field__source');
  assert.equal(meta.getAttribute('data-preference-source'),source);
  assert.equal(meta.textContent,source === 'room' ? 'ustawienie tego pomieszczenia' : 'z ustawień globalnych');
}
async function choose(r,b,value){ r.ui.picked = value; b.click(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
const tests = [];
function test(name,fn){ tests.push([name,fn]); }
test('ROOM OVERRIDE',()=>{
  const r = runtime(); r.s.projectData.kuchnia.preferences = { zones:{ lower:{ bodyColor:'Egger U999' } } };
  shows(body(r.materials()),'Egger U999','room');
});
test('GLOBAL MATERIALS',()=>{
  const r = runtime(); const fields = r.materials().querySelectorAll('.wywiad-zone-card--lower .wywiad-zone-field');
  ['Egger W1100','akryl','Front global','HDF 3mm biała'].forEach((value,i)=> shows(fields[i],value,'global'));
  assert.equal(fields[4].querySelector('.wywiad-zone-field__source').getAttribute('data-preference-source'),'');
  assert.equal(fields[5].querySelector('.wywiad-zone-field__source').getAttribute('data-preference-source'),'global');
});
test('CLEAR OVERRIDE persists empty room value',async()=>{
  const r = runtime(); r.s.projectData.kuchnia.preferences = { zones:{ lower:{ bodyColor:'Egger U999' } } };
  const form = r.materials(); const field = body(form); await choose(r,field.querySelector('button'),'');
  assert.equal(r.ui.choices[0].options[0].label,'— użyj ustawienia globalnego —');
  assert.equal(r.ui.choices[0].options[0].value,''); shows(field,'Egger W1100','global');
  form.querySelector('.wywiad-room-inline-form__save').click();
  assert.equal(r.api.getRoomPreferences('kuchnia').zones.lower.bodyColor,'');
  assert.equal(r.s.projectData.kuchnia.preferences.zones.lower.frontMaterial,'');
  assert.equal(r.ui.begin,1); assert.equal(r.ui.save,1);
});
test('HARDWARE GLOBAL and no invented drawer model',()=>{
  const r = runtime(); const form = r.hardware();
  [['hinges','Blum'],['lifts','Rejs'],['cargo','GTV'],['accessories','Hettich']].forEach(([key,value])=> shows(producer(form,key),value,'global'));
  shows(producer(form,'drawers'),'Blum — konfiguracja niekompletna','global');
  assert.equal(form.querySelector('[data-drawer-preference]').getAttribute('data-drawer-preference'),'null');
  assert.ok(!/Antaro|LEGRABOX|MERIVOBOX/.test(form.querySelector('[data-drawer-preference]').textContent));
});
test('HARDWARE ROOM and clear override',async()=>{
  const r = runtime(); r.s.projectData.kuchnia.preferences = { hardwareProducers:{ hinges:'GTV' } };
  const form = r.hardware(); const field = producer(form,'hinges'); shows(field,'GTV','room');
  await choose(r,field.querySelector('button'),''); shows(field,'Blum','global');
  form.querySelector('.wywiad-room-inline-form__save').click();
  assert.equal(r.api.getRoomPreferences('kuchnia').hardwareProducers.hinges,'');
});
test('GLOBAL CHANGE is visible after rerender without room copy',()=>{
  const r = runtime(); const before = JSON.stringify(r.s.projectData); shows(producer(r.hardware(),'hinges'),'Blum','global');
  const defaults = r.s.FC.programDefaults.read(); defaults.hardware.hingesManufacturer = 'Hettich';
  r.s.FC.programDefaults.write(defaults); r.writes.length = 0;
  shows(producer(r.hardware(),'hinges'),'Hettich','global');
  assert.equal(JSON.stringify(r.s.projectData),before); assert.deepEqual(r.writes,[]);
});
test('READ ONLY rendering and no-op save do not copy globals',()=>{
  const r = runtime(); const before = JSON.stringify(r.s.projectData); const globalRaw = r.s.localStorage.getItem(GLOBAL);
  const materials = r.materials(); const hardware = r.hardware();
  assert.equal(JSON.stringify(r.s.projectData),before); assert.equal(r.s.localStorage.getItem(GLOBAL),globalRaw);
  assert.deepEqual(r.writes,[]); assert.equal(r.ui.begin,0); assert.equal(r.ui.save,0);
  materials.querySelector('.wywiad-room-inline-form__save').click(); hardware.querySelector('.wywiad-room-inline-form__save').click();
  assert.equal(JSON.stringify(r.s.projectData),before); assert.deepEqual(r.writes,[]); assert.equal(r.ui.begin,0); assert.equal(r.ui.save,0);
});
test('BULK action above all cards uses saved preferences',async()=>{
  const r = runtime(); const form = r.materials(); const access = form.querySelector('.wywiad-room-inline-form__bulk-access');
  const children = Array.from(form.children); assert.ok(children.indexOf(access) < children.indexOf(form.querySelector('.wywiad-zone-card')));
  assert.equal(form.querySelectorAll('.wywiad-room-inline-form__bulk').length,1);
  assert.ok(access.textContent.includes('Zastosowane zostaną zapisane preferencje pomieszczenia.'));
  await choose(r,body(form).querySelector('button'),'Egger U999');
  access.querySelector('button').click(); assert.equal(r.ui.bulk.room,'kuchnia');
  assert.equal(r.ui.bulk.preferences.zones.lower.bodyColor,''); assert.equal(r.ui.save,0); assert.equal(r.ui.begin,0);
});
(async()=>{
  for(const [name,fn] of tests){ await fn(); console.log('PASS ' + name); }
  console.log(`wywiad-effective-defaults-smoke: PASS (${tests.length}/${tests.length})`);
})().catch(error=>{ console.error(error.stack || error); process.exitCode = 1; });
