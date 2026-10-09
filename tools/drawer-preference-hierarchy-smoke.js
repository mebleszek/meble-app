#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeMiniDocument } = require('./app-dev-smoke-lib/mini-document');
const ROOT = path.resolve(__dirname,'..');
const KEY = 'fc_program_defaults_v1';
const clone = value=>JSON.parse(JSON.stringify(value));
const antaro = { kind:'system', systemKey:'blum_tandembox_antaro' };
function runtime(seed){
  const rows = new Map(seed ? [[KEY,seed]] : []), writes = [], choices = [], picks = [], messages = [];
  const catalog = [
    { manufacturer:'Blum', hardwareCategory:'Szuflady / prowadnice', technicalParams:{ rodzaj_prowadnicy:{ value:'dolnego montażu' } }, series:'MOVENTO', name:'MOVENTO 500 mm', status:'active' },
    { manufacturer:'Blum', hardwareCategory:'Szuflady / prowadnice', technicalParams:{ rodzaj_prowadnicy:{ value:'dolnego montażu' } }, series:'MOVENTO', name:'MOVENTO 450 mm' },
    { manufacturer:'Blum', hardwareCategory:'Szuflady / prowadnice', technicalParams:{ rodzaj_prowadnicy:'kulkowa' }, series:'Ball family' },
    { manufacturer:'GTV', hardwareCategory:'Szuflady / prowadnice', technicalParams:{ rodzaj_prowadnicy:'kulkowa' }, hardwareSystem:'GTV family' },
    { manufacturer:'Rejs', hardwareCategory:'Szuflady / prowadnice', technicalParams:{ rodzaj_prowadnicy:'rolkowa' }, hardwareType:'Rejs family' },
    { manufacturer:'Length SKU', hardwareCategory:'Szuflady / prowadnice', technicalParams:{ rodzaj_prowadnicy:'rolkowa' }, hardwareType:'Prowadnica L500' },
    { manufacturer:'No family', hardwareCategory:'Szuflady / prowadnice', technicalParams:{ rodzaj_prowadnicy:'rolkowa' }, name:'SKU 500 mm' },
    { manufacturer:'Hidden', hardwareCategory:'Szuflady / prowadnice', technicalParams:{ rodzaj_prowadnicy:'kulkowa' }, series:'Hidden', status:'hidden' },
    { manufacturer:'Blum', hardwareCategory:'Zawiasy' }, { manufacturer:'Archived', hardwareCategory:'Zawiasy', status:'archived' },
    { manufacturer:'Inactive', hardwareCategory:'Zawiasy', active:false }, { manufacturer:'LiftOnly', hardwareCategory:'Podnośniki' }
  ];
  const s = { console, document:makeMiniDocument(), projectData:{schemaVersion:12,kuchnia:{cabinets:[],fronts:[],sets:[],settings:{},preferences:{}}},
    localStorage:{getItem:k=>rows.get(k) ?? null,setItem(k,v){writes.push(k);rows.set(k,String(v));},removeItem(k){writes.push(k);rows.delete(k);},clear(){throw Error('clear forbidden');}}
  };
  s.window=s; s.globalThis=s;
  let begins=0,saves=0;
  s.FC={utils:{clone}, catalogStore:{getAccessories:()=>catalog,getSheetMaterials:()=>[{materialType:'laminat',name:'W1100'},{materialType:'obrzeże',name:'PCV'},{materialType:'akryl',name:'Acrylic'}]},
    infoBox:{open:cfg=>messages.push(cfg)},session:{begin(){begins++;return true;}},project:{saveConfirmed(p){saves++;return {ok:true,project:clone(p)};}},
    rozrysChoice:{createChoiceLauncher(label){const b=s.document.createElement('button');b.textContent=label;return b;},setChoiceLaunchValue(b,label){b.textContent=label;},
      async openRozrysChoiceOverlay(cfg){choices.push(cfg);return picks.shift() ?? null;}}
  };
  vm.createContext(s);
  for(const file of ['js/app/catalog/hardware-technical-params.js','js/app/settings/program-defaults-store.js','js/app/room-preferences/room-preferences-model.js',
    'js/app/cabinet/cabinet-drawer-requirements.js','js/app/cabinet/cabinet-modal-module.js','js/app/cabinet/cabinet-modal-standing-specials.js','js/app/ui/data-settings-dom.js','js/app/ui/data-settings-defaults-view.js',
    'js/app/ui/wywiad-room-accordion-actions.js','js/app/ui/wywiad-room-preferences.js','js/app/ui/wywiad-room-hardware-producers.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),s,{filename:file});
  }
  const api=s.FC.roomPreferences;
  return {s,api,choices,picks,messages,writes,catalog,
    counts:()=>({begins,saves}),
    settings(){const node=s.document.createElement('div');s.FC.dataSettingsDefaultsView.render(node);return node;},
    room(){return s.FC.wywiadRoomHardwareProducers.buildInlineForm('kuchnia',api.getRoomPreferences('kuchnia'));},
    async flow(values,inherit=false){picks.push(...values);return api.chooseDrawerPreference((title,options,value)=>s.FC.rozrysChoice.openRozrysChoiceOverlay({title,options,value}),null,inherit);}
  };
}
async function click(r,button,values){r.picks.push(...values);button.click();for(let i=0;i<18;i++)await Promise.resolve();}
function drawer(form){return form.querySelector('[data-drawer-preference]');}
function save(form){form.querySelector('.btn-success').click();}
const tests=[];const test=(name,fn)=>tests.push([name,fn]);
test('1 System Blum only',()=>{const r=runtime();assert.deepEqual(clone(r.api.systemsForManufacturer('Blum')).map(x=>x.key),['blum_tandembox_antaro','blum_legrabox','blum_merivobox']);});
test('2 System GTV only',()=>{const r=runtime();assert.deepEqual(clone(r.api.systemsForManufacturer('GTV')).map(x=>x.key),['gtv_axis_pro']);});
test('3 Complete Antaro preference, single persisted truth',async()=>{
  const r=runtime(),form=r.settings();await click(r,drawer(form),['system','Blum','blum_tandembox_antaro']);save(form);
  const hardware=JSON.parse(r.s.localStorage.getItem(KEY)).hardware;assert.deepEqual(hardware.drawerPreference,antaro);
  assert.ok(!Object.hasOwn(hardware,'drawerSystemManufacturer'));assert.ok(!Object.hasOwn(hardware,'drawerSystemKey'));
});
test('4 Antaro cabinet mapping',()=>{const r=runtime();r.s.projectData.kuchnia.preferences={drawerPreference:antaro};const d={};r.api.applyDrawerSystemPreferenceToDetails('kuchnia',d);assert.equal(d.drawerSystem,'systemowe');assert.equal(d.drawerBrand,'blum');assert.equal(d.drawerModel,'tandembox_antaro');});
test('5 Cancel after producer preserves previous draft',async()=>{
  const r=runtime();r.s.FC.programDefaults.write({hardware:{drawerPreference:antaro}});const form=r.settings(),label=drawer(form).textContent;
  await click(r,drawer(form),['system','GTV',null]);assert.equal(drawer(form).textContent,label);save(form);
  assert.deepEqual(JSON.parse(r.s.localStorage.getItem(KEY)).hardware.drawerPreference,antaro);
});
test('6 Incomplete manufacturer is not a complete selection',()=>{const r=runtime();assert.equal(r.api.normalizeDrawerPreference({manufacturer:'Blum'}),null);assert.equal(r.api.normalizeDrawerPreference({kind:'system',systemKey:''}),null);});
test('7 Box runner types',async()=>{const r=runtime();await r.flow(['box',null]);assert.deepEqual(clone(r.choices[1].options).filter(x=>x.value!=='__back').map(x=>[x.value,x.label]),[['ball','Kulkowe'],['undermount','Dolnego montażu'],['roller','Rolkowe']]);});
test('8 Runner producers from matching active catalogue',()=>{const r=runtime();assert.deepEqual(clone(r.api.runnerManufacturers('ball')),['Blum','GTV']);assert.deepEqual(clone(r.api.runnerManufacturers('undermount')),['Blum']);});
test('9 Runner families filtered, not length SKU',()=>{const r=runtime();assert.deepEqual(clone(r.api.runnerSeries('undermount','Blum')),['MOVENTO']);assert.deepEqual(clone(r.api.runnerSeries('ball','GTV')),['GTV family']);assert.deepEqual(clone(r.api.runnerSeries('roller','Rejs')),['Rejs family']);assert.deepEqual(clone(r.api.runnerSeries('roller','Length SKU')),[]);});
test('10 Missing family informs and permits return',async()=>{
  const r=runtime();const result=await r.flow(['box','roller','No family','__back','Rejs','Rejs family']);
  assert.equal(r.messages.length,1);assert.match(r.messages[0].title,/Brak modeli/);assert.equal(result.value.runnerSeries,'Rejs family');assert.ok(!JSON.stringify(result).includes('500'));
});
test('11 One settings drawer field',()=>{const r=runtime(),form=r.settings();assert.equal(form.querySelectorAll('[data-drawer-preference]').length,1);assert.ok(!/Domyślne szuflady|System \/ model szuflad/.test(form.textContent));});
test('12 Same flow in WYWIAD',async()=>{const r=runtime(),form=r.room();await click(r,drawer(form),['configure','system','Blum','blum_tandembox_antaro']);save(form);assert.deepEqual(clone(r.api.getRoomPreferences('kuchnia').drawerPreference),antaro);assert.equal(r.counts().saves,1);});
test('13 Room inherits global Antaro',()=>{const r=runtime();r.s.FC.programDefaults.write({hardware:{drawerPreference:antaro}});const form=r.room();assert.equal(drawer(form).textContent,'Blum TANDEMBOX Antaro');assert.equal(form.querySelector('.wywiad-hardware-field--drawers .wywiad-zone-field__source').textContent,'z ustawień globalnych');});
test('14 Room wins',()=>{const r=runtime();r.s.FC.programDefaults.write({hardware:{drawerPreference:antaro}});r.s.projectData.kuchnia.preferences={drawerPreference:{kind:'system',systemKey:'gtv_axis_pro'}};const form=r.room();assert.equal(drawer(form).textContent,'GTV Axis Pro');assert.equal(form.querySelector('.wywiad-hardware-field--drawers .wywiad-zone-field__source').textContent,'ustawienie tego pomieszczenia');});
test('15 Clear restores inheritance',async()=>{const r=runtime();r.s.FC.programDefaults.write({hardware:{drawerPreference:antaro}});r.s.projectData.kuchnia.preferences={drawerPreference:{kind:'system',systemKey:'gtv_axis_pro'}};const form=r.room();await click(r,drawer(form),['inherit']);save(form);assert.equal(r.api.getRoomPreferences('kuchnia').drawerPreference,null);assert.equal(drawer(r.room()).textContent,'Blum TANDEMBOX Antaro');});
test('16 Legacy complete migration is read-only',()=>{const raw=JSON.stringify({version:2,hardware:{drawerSystemManufacturer:'Blum',drawerSystemKey:'blum_tandembox_antaro'}}),r=runtime(raw);assert.deepEqual(clone(r.s.FC.programDefaults.read().hardware.drawerPreference),antaro);assert.deepEqual(clone(r.api.normalizeRoomPreferences({hardwareProducers:{drawers:'Blum'},hardwareDrawerSystems:{drawers:'blum_tandembox_antaro'}}).drawerPreference),antaro);assert.equal(r.s.localStorage.getItem(KEY),raw);assert.equal(r.writes.length,0);});
test('17 Legacy incomplete preserved, never Antaro',()=>{const r=runtime(JSON.stringify({hardware:{drawerSystemManufacturer:'Blum',drawerSystemKey:''}}));assert.equal(r.s.FC.programDefaults.read().hardware.drawerPreference,null);assert.match(drawer(r.settings()).textContent,/Blum.*niekompletna/);assert.ok(!drawer(r.room()).textContent.includes('Antaro'));});
test('18 Read-only render',()=>{const r=runtime(),before=JSON.stringify(r.s.projectData);r.settings();r.room();assert.equal(JSON.stringify(r.s.projectData),before);assert.equal(r.writes.length,0);assert.deepEqual(r.counts(),{begins:0,saves:0});});
test('19 Front material excludes obrzeże in both forms',async()=>{const r=runtime();for(const form of [r.settings(),r.s.FC.wywiadRoomPreferences.buildInlineForm('kuchnia',r.api.getRoomPreferences('kuchnia'))]){const b=Array.from(form.querySelectorAll('button')).find(b=>/Wybierz.*[Mm]ateriał frontu/.test(b.getAttribute('aria-label')||''));await click(r,b,[null]);assert.ok(!r.choices.at(-1).options.some(x=>x.value==='obrzeże'));assert.ok(r.choices.at(-1).options.some(x=>x.value==='laminat'));}});
test('20 Hinge producers only, stale selection survives',async()=>{const r=runtime();assert.deepEqual(clone(r.api.hardwareManufacturersForGroup('hinges')),['Blum']);r.s.projectData.kuchnia.preferences={hardwareProducers:{hinges:'OldMaker'}};const form=r.room();assert.equal(form.querySelector('[data-hardware-producer-key="hinges"]').textContent,'OldMaker');save(form);assert.equal(r.api.getRoomPreferences('kuchnia').hardwareProducers.hinges,'OldMaker');});
test('21 Global changes without room copy',()=>{const r=runtime();r.s.FC.programDefaults.write({hardware:{drawerPreference:antaro}});const before=JSON.stringify(r.s.projectData);r.room();r.s.FC.programDefaults.write({hardware:{drawerPreference:{kind:'system',systemKey:'gtv_axis_pro'}}});assert.equal(drawer(r.room()).textContent,'GTV Axis Pro');assert.equal(JSON.stringify(r.s.projectData),before);});
test('22 Box mapping and technical requirements',()=>{
  const r=runtime();r.s.projectData.kuchnia.preferences={drawerPreference:{kind:'box',runnerType:'undermount',manufacturer:'Blum',runnerSeries:'MOVENTO'}};
  const d={};r.api.applyDrawerSystemPreferenceToDetails('kuchnia',d);assert.equal(d.drawerSystem,'skrzynkowe');assert.equal(d.drawerRunnerType,'undermount');assert.equal(d.drawerRunnerSeries,'MOVENTO');
  const req=r.s.FC.cabinetDrawerRequirements.getDrawerRequirements('kuchnia',{type:'stojąca',subType:'szuflady',details:d})[0];
  assert.equal(req.technical.drawerKind,'box');assert.equal(req.technical.manufacturer,'Blum');assert.equal(req.technical.runnerSeries,'MOVENTO');assert.equal(req.technicalParams.rodzaj_prowadnicy.value,'dolnego montażu');assert.equal(req.qty,3);
  const param=r.s.FC.hardwareTechnicalParams.DEFAULT_DEFINITIONS.find(x=>x.key==='rodzaj_prowadnicy');assert.equal(param.typePart,true);assert.equal(param.compareMode,'equal');
});
test('23 Real new-cabinet modal paths carry box metadata',()=>{
  const r=runtime();r.s.projectData.kuchnia.preferences={drawerPreference:{kind:'box',runnerType:'ball',manufacturer:'GTV',runnerSeries:'GTV family'}};
  for(const type of ['stojąca','moduł']){
    const draft={type,subType:'szuflady',details:{drawerLayout:'5_equal'}};
    const ctx={draft,details:draft.details,subType:'szuflady',uiState:{roomType:'kuchnia'},container:r.s.document.createElement('div'),addSelect(){},renderCabinetModal(){}};
    if(type==='stojąca')r.s.FC.cabinetModalStandingSpecials.renderDrawerExtras(ctx);else r.s.FC.cabinetModalModule.renderExtraDetails(ctx);
    assert.equal(draft.details.drawerSystem,'skrzynkowe');assert.equal(draft.details.drawerBrand,'gtv');
    assert.equal(draft.details.drawerRunnerType,'ball');assert.equal(draft.details.drawerRunnerSeries,'GTV family');
    const req=r.s.FC.cabinetDrawerRequirements.getDrawerRequirements('kuchnia',draft)[0];assert.equal(req.qty,5);assert.equal(req.technical.runnerSeries,'GTV family');
  }
});
test('24 Box flow persists family and reopens',async()=>{
  const r=runtime(),form=r.settings();await click(r,drawer(form),['box','undermount','Blum','MOVENTO']);save(form);
  const expected={kind:'box',runnerType:'undermount',manufacturer:'Blum',runnerSeries:'MOVENTO'};
  assert.deepEqual(JSON.parse(r.s.localStorage.getItem(KEY)).hardware.drawerPreference,expected);
  assert.match(drawer(r.settings()).textContent,/Skrzynkowe.*dolnego montażu.*Blum.*MOVENTO/);
  assert.match(drawer(r.room()).textContent,/MOVENTO/);assert.deepEqual(r.s.projectData.kuchnia.preferences,{});
});
test('25 Cancellation at every picker preserves complete choice',async()=>{
  for(const flow of [[null],['system',null],['system','Blum',null],['box',null],['box','ball',null],['box','ball','GTV',null]]){
    const r=runtime();r.s.FC.programDefaults.write({hardware:{drawerPreference:antaro}});const before=r.s.localStorage.getItem(KEY),form=r.settings();
    await click(r,drawer(form),flow);assert.equal(drawer(form).textContent,'Blum TANDEMBOX Antaro');assert.equal(r.s.localStorage.getItem(KEY),before);
  }
});
test('26 Producer/category filters apply to both UI pickers',async()=>{
  const r=runtime();const globalForm=r.settings();const hinge=Array.from(globalForm.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')==='Wybierz: Domyślne zawiasy');
  await click(r,hinge,[null]);assert.deepEqual(clone(r.choices.at(-1).options).filter(x=>x.value).map(x=>x.value),['Blum']);
  const roomForm=r.room();await click(r,roomForm.querySelector('[data-hardware-producer-key="hinges"]'),[null]);
  assert.deepEqual(clone(r.choices.at(-1).options).filter(x=>x.value).map(x=>x.value),['Blum']);
  assert.deepEqual(clone(r.api.hardwareManufacturersForGroup('lifts')),['LiftOnly']);
});
(async()=>{for(const [name,fn] of tests){await fn();console.log('PASS '+name);}console.log('Drawer preference hierarchy: '+tests.length+'/'+tests.length+' PASS');})().catch(e=>{console.error(e);process.exitCode=1;});
