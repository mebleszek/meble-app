#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { makeMiniDocument } = require('./app-dev-smoke-lib/mini-document');
const ROOT = path.resolve(__dirname, '..');
const KEY = 'fc_program_defaults_v1';
const clone = value=>JSON.parse(JSON.stringify(value));
const v1 = { version:1, materials:{ bodyColor:'W1100', frontMaterial:'akryl', frontColor:'Front old', backMaterial:'HDF old' },
  hardware:{ hingesManufacturer:'Blum', drawerSystemManufacturer:'Rejs', liftManufacturer:'GTV', slidingSystemManufacturer:'Sevroll', cargoManufacturer:'Peka', accessoriesManufacturer:'Hettich' } };
function runtime(seed){
  const rows = new Map(seed ? [[KEY,seed]] : []); const writes = [];
  const ui = { messages:[], choices:[], picked:null, begins:0, saves:0, panel:null, closes:0, setView:null };
  const s = { console, document:makeMiniDocument(), uiState:{ roomType:'kuchnia' },
    projectData:{ schemaVersion:12, kuchnia:{ settings:{}, cabinets:[], fronts:[], sets:[], preferences:{} } },
    localStorage:{ getItem:key=>rows.get(key) ?? null,
      setItem(key,value){ writes.push(key); rows.set(key,String(value)); },
      removeItem(key){ writes.push(key); rows.delete(key); }, clear(){ throw new Error('clear forbidden'); } },
  };
  s.window = s; s.globalThis = s;
  s.FC = { utils:{ clone }, infoBox:{ open(cfg){ ui.messages.push(cfg); } },
    session:{ begin(){ ui.begins++; return true; } },
    project:{ saveConfirmed(project){ ui.saves++; return { ok:true, project:clone(project) }; } },
    panelBox:{ open(cfg){ ui.panel = cfg; }, close(){ ui.closes++; } },
    dataBackupStore:{}, dataBackupSnapshot:{},
    dataSettingsMenuView:{ render(scroll,setView){ ui.setView = setView; } },
    catalogStore:{ getHardwareManufacturers:()=>['Blum','Rejs','GTV','Hettich'], getSheetMaterials:()=>[
      { name:'W1100', materialType:'laminat' }, { name:'U999', materialType:'laminat' }, { name:'White acrylic', materialType:'akryl' },
    ] },
    rozrysChoice:{ createChoiceLauncher(label){ const btn = s.document.createElement('button'); btn.textContent = label; return btn; },
      setChoiceLaunchValue(btn,label){ btn.textContent = label; },
      async openRozrysChoiceOverlay(cfg){ ui.choices.push(cfg); return ui.picked; } },
  };
  vm.createContext(s);
  for(const file of ['js/app/settings/program-defaults-store.js','js/app/room-preferences/room-preferences-model.js',
    'js/app/cabinet/front-material-source.js','js/app/ui/data-settings-dom.js','js/app/ui/data-settings-defaults-view.js',
    'js/app/ui/data-settings-modal.js','js/app/ui/wywiad-room-accordion-actions.js',
    'js/app/ui/wywiad-room-preferences.js','js/app/ui/wywiad-room-hardware-producers.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),s,{ filename:file });
  }
  const FC = s.FC; const api = FC.roomPreferences;
  const settings = ()=>{ const scroll = s.document.createElement('div'); FC.dataSettingsDefaultsView.render(scroll); return scroll; };
  const room = ()=>FC.wywiadRoomPreferences.buildInlineForm('kuchnia',api.getRoomPreferences('kuchnia'));
  const update = fn=>{ const d = FC.programDefaults.read(); fn(d); return FC.programDefaults.write(d); };
  return { s, FC, api, ui, writes, settings, room, update };
}
function field(form,title){ return Array.from(form.querySelectorAll('button')).find(btn=> btn.getAttribute('aria-label') === title); }
function save(form){ form.querySelector('.btn-success').click(); }
async function pick(r,btn,value){ assert.ok(btn); r.ui.picked = value; btn.click(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
function custom(form,key){ return form.querySelector('[data-pcv-custom-zone="' + key + '"]'); }
function enter(input,value){ input.value = value; input.dispatchEvent({ type:'input' }); }
const tests = [];
const test = (name,fn)=>tests.push([name,fn]);
test('1 V1 READ as v2',()=>{ const r=runtime(JSON.stringify(v1)); assert.equal(r.FC.programDefaults.read().version,2); });
test('2 V1 MATERIAL PRESERVATION in every zone',()=>{
  const r=runtime(JSON.stringify(v1)); const d=r.FC.programDefaults.read();
  for(const key of ['lower','middle','upper']){
    for(const [field,value] of Object.entries(v1.materials)) assert.equal(d.zones[key][field],value);
    assert.equal(d.zones[key].openingSystem,''); assert.equal(d.zones[key].bodyPcvMode,'body'); assert.equal(d.zones[key].bodyPcvCustomColor,'');
  }
});
test('3 V1 HARDWARE PRESERVATION',()=>{
  const r=runtime(JSON.stringify(v1)); const h=r.FC.programDefaults.read().hardware;
  for(const [key,value] of Object.entries(v1.hardware)) assert.equal(h[key],value);
  assert.equal(h.drawerSystemKey,'');
});
test('4 READ DOES NOT MIGRATE RAW storage',()=>{
  const raw='  '+JSON.stringify(v1,null,2)+'\n'; const r=runtime(raw);
  r.FC.programDefaults.read(); r.FC.programDefaults.getMaterialDefaults('upper'); r.FC.programDefaults.getHardwareDefaults();
  assert.deepEqual(r.writes,[]); assert.equal(r.s.localStorage.getItem(KEY),raw);
});
test('5 V2 SAVE under same key preserves old data',()=>{
  const r=runtime(JSON.stringify(v1)); const form=r.settings(); save(form);
  const stored=JSON.parse(r.s.localStorage.getItem(KEY)); assert.equal(stored.version,2); assert.deepEqual(r.writes,[KEY]);
  assert.equal(stored.zones.upper.frontColor,v1.materials.frontColor); assert.equal(stored.hardware.accessoriesManufacturer,'Hettich');
  assert.equal(r.s.localStorage.getItem('fc_program_defaults_v2'),null);
});
test('6 GENERAL DEFAULTS inherit and room override wins',()=>{
  const r=runtime(); r.update(d=>{d.general.finishStandard='standard premium'; d.general.blendStandard='minimalne / tylko konieczne';});
  const p=r.api.getRoomPreferences('kuchnia'); const form=r.room();
  assert.equal(field(form,'Wybierz standard wykończenia').textContent,'standard premium');
  assert.equal(field(form,'Wybierz standard blend').textContent,'minimalne / tylko konieczne');
  assert.equal(r.api.getEffectiveGeneralPreference(p,'finishStandard').source,'global');
  p.finishStandard='standard dobry'; assert.equal(r.api.getEffectiveGeneralPreference(p,'finishStandard').source,'room');
});
test('7 ZONE OPENING uses separate lists and source resolution',async()=>{
  const r=runtime(); r.update(d=>{d.zones.lower.openingSystem='krawędziowy HEXA GTV'; d.zones.middle.openingSystem='UKW'; d.zones.upper.openingSystem='podchwyt';});
  const p=r.api.getRoomPreferences('kuchnia'); const form=r.room();
  for(const [key,value] of [['lower','krawędziowy HEXA GTV'],['middle','UKW'],['upper','podchwyt']]) assert.equal(r.api.getEffectiveZonePreference(p,key,'openingSystem').value,value);
  assert.equal(field(form,'Wybierz otwieranie — Górna').textContent,'podchwyt');
  const globalForm=r.settings(); await pick(r,field(globalForm,'Wybierz: Otwieranie — Górna'),null);
  assert.ok(r.ui.choices.at(-1).options.some(row=>row.value==='podchwyt'));
});
test('8 ZONE PCV values remain independent',()=>{
  const r=runtime(); r.update(d=>{d.zones.lower.bodyPcvMode='front'; d.zones.middle.bodyPcvMode='body'; d.zones.upper.bodyPcvMode='front';});
  const zones=r.FC.programDefaults.read().zones; assert.equal(zones.lower.bodyPcvMode,'front'); assert.equal(zones.middle.bodyPcvMode,'body'); assert.equal(zones.upper.bodyPcvMode,'front');
});
test('9 ROOM PCV INHERITANCE and cabinet defaults',()=>{
  const r=runtime(); r.update(d=>{d.zones.upper.bodyPcvMode='front';});
  const p=r.api.getRoomPreferences('kuchnia'); assert.equal(p.zones.upper.bodyPcvMode,'');
  assert.equal(r.api.getEffectiveZonePreference(p,'upper','bodyPcvMode').value,'front');
  const cab={type:'wisząca',bodyPcvMode:'body'}; r.api.applyZoneDefaultsToDraft('kuchnia',cab); assert.equal(cab.bodyPcvMode,'front');
  assert.equal(r.api.normalizePcvMode(''),'body');
});
test('10 ROOM PCV OVERRIDE and legacy preservation',()=>{
  const r=runtime(); r.update(d=>{d.zones.lower.bodyPcvMode='front';});
  r.s.projectData.kuchnia.preferences={zones:{lower:{bodyPcvMode:'body'}}};
  assert.equal(r.api.resolveZoneDefaults('kuchnia','lower',{}).bodyPcvMode,'body');
  assert.equal(r.api.getEffectiveZonePreference(r.api.getRoomPreferences('kuchnia'),'lower','bodyPcvMode').source,'room');
  assert.equal(r.api.normalizeRoomPreferences({bodyPcvMode:'front'}).zones.upper.bodyPcvMode,'front');
});
test('11 SAME AS GLOBAL canonicalizes empty and tracks future global changes',async()=>{
  const r=runtime(); r.s.projectData.kuchnia.preferences={zones:{lower:{bodyPcvMode:'front'}}}; const form=r.room();
  await pick(r,field(form,'Wybierz PCV korpusu — Dolna'),'body'); save(form);
  assert.equal(r.api.getRoomPreferences('kuchnia').zones.lower.bodyPcvMode,'');
  r.update(d=>{d.zones.lower.bodyPcvMode='front';}); assert.equal(field(r.room(),'Wybierz PCV korpusu — Dolna').textContent,'Pod kolor frontu');
});
test('12 PCV PICKER exactly two options in both forms',async()=>{
  const r=runtime();
  for(const [form,title] of [[r.room(),'Wybierz PCV korpusu — Dolna'],[r.settings(),'Wybierz: PCV korpusu — Dolna']]){
    await pick(r,field(form,title),null);
    assert.deepEqual(clone(r.ui.choices.at(-1).options),[{value:'body',label:'Pod kolor płyty'},{value:'front',label:'Pod kolor frontu'}]);
  }
});
test('13 DRAWER MODEL GLOBAL Antaro without room copy',async()=>{
  const r=runtime(); const defaultsForm=r.settings();
  await pick(r,field(defaultsForm,'Wybierz: System / model szuflad'),'blum_tandembox_antaro'); save(defaultsForm);
  assert.equal(r.FC.programDefaults.read().hardware.drawerSystemManufacturer,'Blum');
  assert.equal(r.FC.programDefaults.read().hardware.drawerSystemKey,'blum_tandembox_antaro');
  const before=JSON.stringify(r.s.projectData); const form=r.FC.wywiadRoomHardwareProducers.buildInlineForm('kuchnia',r.api.getRoomPreferences('kuchnia'));
  const btn=form.querySelector('[data-hardware-drawer-system-key]'); assert.equal(btn.textContent,'Blum TANDEMBOX Antaro');
  assert.equal(btn.getAttribute('data-hardware-drawer-system-value'),'');
  assert.equal(r.api.resolveDrawerSystemPreference('kuchnia').key,'blum_tandembox_antaro');
  assert.equal(JSON.stringify(r.s.projectData),before);
  assert.equal(btn.parentNode.querySelectorAll('.wywiad-zone-field__source')[1].getAttribute('data-preference-source'),'global');
  save(form); assert.equal(r.ui.begins,0); assert.equal(r.ui.saves,0);
  const details={}; r.api.applyDrawerSystemPreferenceToDetails('kuchnia',details);
  assert.equal(details.drawerPreferenceApplied,'blum_tandembox_antaro');
});
test('14 ACCESSORIES visible and saved in settings',async()=>{
  const r=runtime(); const form=r.settings(); await pick(r,field(form,'Wybierz: Pozostałe akcesoria'),'Hettich'); save(form);
  assert.equal(r.FC.programDefaults.read().hardware.accessoriesManufacturer,'Hettich');
});
test('15 NON-LAMINATE PCV exposes conditional inputs in both forms',()=>{
  const r=runtime(); r.update(d=>{d.zones.lower.bodyPcvMode='front'; d.zones.lower.frontMaterial='akryl';});
  assert.equal(custom(r.room(),'lower').parentNode.hidden,false); assert.equal(custom(r.settings(),'lower').parentNode.hidden,false);
  assert.equal(custom(r.room(),'upper').parentNode.hidden,true);
});
test('16 LAMINATE PCV needs no manual color; logical color resolves',()=>{
  const r=runtime(); r.update(d=>{d.zones.lower.bodyPcvMode='front'; d.zones.lower.frontMaterial='laminat'; d.zones.lower.frontColor='U999'; d.zones.lower.bodyColor='W1100';});
  assert.equal(custom(r.room(),'lower').parentNode.hidden,true); assert.equal(custom(r.settings(),'lower').parentNode.hidden,true);
  assert.equal(r.api.resolveBodyPcvColor('kuchnia','lower',{}).color,'U999'); assert.equal(r.api.validatePcvPreferences({}),true);
  r.update(d=>{d.zones.lower.bodyPcvMode='body';}); assert.equal(r.api.resolveBodyPcvColor('kuchnia','lower',{}).color,'W1100');
});
test('17 CUSTOM REQUIRED blocks both saves and retains form',()=>{
  const r=runtime(); r.update(d=>{d.zones.lower.bodyPcvMode='front'; d.zones.lower.frontMaterial='lakier';});
  const before=r.s.localStorage.getItem(KEY); const beforeProject=JSON.stringify(r.s.projectData); r.writes.length=0;
  for(const form of [r.settings(),r.room()]){ save(form); assert.equal(r.ui.messages.at(-1).title,'Podaj kolor PCV korpusu'); assert.ok(custom(form,'lower')); }
  assert.equal(r.s.localStorage.getItem(KEY),before); assert.equal(JSON.stringify(r.s.projectData),beforeProject);
  assert.deepEqual(r.writes,[]); assert.equal(r.ui.begins,0); assert.equal(r.ui.saves,0); assert.equal(r.ui.closes,0);
});
test('18 CUSTOM SAVE preserves multiword color and inherited custom',()=>{
  const r=runtime(); r.update(d=>{d.zones.lower.bodyPcvMode='front'; d.zones.lower.frontMaterial='akryl';});
  const globalForm=r.settings(); enter(custom(globalForm,'lower'),'czarne mat'); save(globalForm);
  assert.equal(r.FC.programDefaults.read().zones.lower.bodyPcvCustomColor,'czarne mat');
  assert.equal(r.api.resolveBodyPcvColor('kuchnia','lower',{}).color,'czarne mat');
  const roomForm=r.room(); enter(custom(roomForm,'lower'),'biały mat'); save(roomForm);
  assert.equal(r.api.getRoomPreferences('kuchnia').zones.lower.bodyPcvCustomColor,'biały mat');
  assert.equal(r.api.resolveBodyPcvColor('kuchnia','lower',{}).color,'biały mat');
});
test('19 NO GLOBAL COPY and isolated zone front sources',()=>{
  const r=runtime(); r.update(d=>{d.zones.lower.frontMaterial='akryl'; d.zones.lower.frontColor='A'; d.zones.upper.frontMaterial='laminat'; d.zones.upper.frontColor='W1100';});
  const before=JSON.stringify(r.s.projectData); const globalRaw=r.s.localStorage.getItem(KEY); r.writes.length=0; r.room();
  assert.equal(JSON.stringify(r.s.projectData),before); assert.equal(r.s.localStorage.getItem(KEY),globalRaw); assert.deepEqual(r.writes,[]);
  assert.equal(r.FC.frontMaterialSource.resolve('kuchnia',{source:'upper'},{}).color,'W1100');
  assert.equal(r.FC.programDefaults.getMaterialDefaults('upper').frontColor,'W1100');
});
test('20 SETTINGS FOOTER no Wyjdź; Wróć only in subview',()=>{
  const r=runtime(); assert.equal(r.FC.dataSettingsModal.open(),true); const panel=r.ui.panel.contentNode;
  assert.ok(!Array.from(panel.querySelectorAll('button')).some(btn=>btn.textContent==='Wyjdź'));
  const back=Array.from(panel.querySelectorAll('button')).find(btn=>btn.textContent==='Wróć'); assert.equal(back.style.display,'none');
  r.ui.setView('defaults'); assert.equal(back.style.display,''); back.click(); assert.equal(back.style.display,'none');
});
test('21 SETTINGS WRITE FAILURE keeps previous globals and current draft',async()=>{
  const r=runtime(JSON.stringify(v1)); const previous=r.s.localStorage.getItem(KEY); const form=r.settings();
  await pick(r,field(form,'Wybierz: Korpus — Dolna'),'U999');
  r.FC.storage={ setJSON(){ return false; } };
  save(form);
  assert.equal(r.s.localStorage.getItem(KEY),previous);
  assert.equal(field(form,'Wybierz: Korpus — Dolna').textContent,'U999');
  assert.equal(r.ui.messages.at(-1).title,'Nie zapisano ustawień');
});
(async()=>{ for(const [name,fn] of tests){await fn(); console.log('PASS '+name);} console.log(`program-defaults-v2-pcv-smoke: PASS (${tests.length}/${tests.length})`); })()
.catch(error=>{console.error(error.stack || error); process.exitCode=1;});
