#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function load(ctx, rel){ vm.runInContext(read(rel), ctx, { filename:rel }); }
function assert(cond, msg, details){
  if(!cond){
    console.error('FAIL:', msg);
    if(details !== undefined){ try{ console.error(JSON.stringify(details, null, 2)); }catch(_){ console.error(details); } }
    process.exit(1);
  }
}
function clone(v){ return JSON.parse(JSON.stringify(v)); }
const FC = {
  utils:{ clone },
  frontHardware:{ getCabinetFrontCutListForMaterials(){ return []; }, getHingeCountForCabinet(){ return 0; } },
  cabinetHardwareRequirements:{ getHingeRequirementsWithQty(){ return []; }, getHingeRequirementWithQty(){ return null; } }
};
const ctx = { window:{ FC }, FC, console, JSON, String, Number, Array, Object, Set, Map, Math };
ctx.globalThis = ctx.window;
ctx.projectData = { kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{}, preferences:{ hardwareDrawerSystems:{ drawers:'gtv_axis_pro' }, hardwareProducers:{ drawers:'GTV' } } } };
ctx.window.projectData = ctx.projectData;
vm.createContext(ctx);
[
  'js/app/material/material-common.js',
  'js/app/room-preferences/room-preferences-model.js',
  'js/app/cabinet/cabinet-drawer-requirements.js',
  'js/app/cabinet/cabinet-cutlist.js'
].forEach((file)=> load(ctx, file));

const prefsApi = ctx.window.FC.roomPreferences;
const drawerApi = ctx.window.FC.cabinetDrawerRequirements;
const cutApi = ctx.window.FC.cabinetCutlist;
assert(prefsApi && drawerApi && cutApi, 'API szuflad/preferencji/cutlisty musi być dostępne');
const pref = prefsApi.normalizeRoomPreferences({ hardwareDrawerSystems:{ drawers:'gtv_axis_pro' } });
assert(pref.hardwareDrawerSystems.drawers === 'gtv_axis_pro', 'Preferencje normalizują system GTV Axis Pro', pref);
assert(/GTV Axis Pro/.test(prefsApi.getHardwareProducerSummary(pref)), 'Podsumowanie preferencji pokazuje konkretny system, nie tylko producenta', prefsApi.getHardwareProducerSummary(pref));

const boxCab = { id:'box', type:'stojąca', subType:'szuflady', width:60, height:82, depth:51, bodyColor:'Laminat korpus 18 mm', backMaterial:'HDF', frontMaterial:'laminat', frontColor:'biały', frontCount:3, details:{ drawerLayout:'3_equal', drawerSystem:'skrzynkowe', innerDrawerType:'brak' } };
const boxReqs = drawerApi.getDrawerRequirements('kuchnia', clone(boxCab));
assert(boxReqs.length === 1 && boxReqs[0].qty === 3, 'Skrzynkowa szafka zwraca 3 wymagania prowadnic', boxReqs);
assert(boxReqs[0].technical.drawerKind === 'box', 'Skrzynkowe mają drawerKind=box', boxReqs[0]);
assert(boxReqs[0].technical.boxSidesThicknessMm === 18 && boxReqs[0].technical.boxBottomThicknessMm === 10, 'Skrzynkowe zapisują 18 mm na skrzynkę i 10 mm na dno', boxReqs[0]);
const parts = cutApi.getCabinetCutList(clone(boxCab), 'kuchnia');
const boxParts = parts.filter((part)=> part && part.group === 'Szuflady skrzynkowe');
assert(boxParts.length >= 3, 'Cutlista dodaje osobną podgrupę Szuflady skrzynkowe', parts);
assert(boxParts.some((part)=> /^Bok szuflady/.test(part.name) && part.qty === 6 && part.materialThicknessMm === 18 && part.material === 'Laminat korpus 18 mm'), 'Boki szuflad skrzynkowych są z materiału korpusu 18 mm', boxParts);
assert(boxParts.some((part)=> /^Tył szuflady/.test(part.name) && part.qty === 3 && part.materialThicknessMm === 18), 'Tyły szuflad skrzynkowych są z 18 mm', boxParts);
assert(boxParts.some((part)=> /^Dno szuflady.*10 mm/.test(part.name) && part.qty === 3 && part.materialThicknessMm === 10 && /10 mm/.test(part.material) && part.pcvEligible === false), 'Dna szuflad skrzynkowych są osobnym materiałem 10 mm bez PCV', boxParts);
assert(parts.some((part)=> part && part.hardwareRequirement && part.hardwareRequirement.category === 'Szuflady / prowadnice' && /prowadnice/.test(part.material)), 'Skrzynkowe dodają prowadnice jako okucie z wymaganiem katalogowym', parts);

const systemCab = { id:'sys', type:'stojąca', subType:'szuflady', width:60, height:82, depth:51, bodyColor:'Laminat', backMaterial:'HDF', frontCount:3, details:{ drawerLayout:'3_equal', drawerSystem:'systemowe', drawerBrand:'gtv', drawerModel:'axis_pro', innerDrawerType:'brak' } };
const systemReq = drawerApi.getDrawerRequirements('kuchnia', clone(systemCab))[0];
assert(systemReq.technical.drawerKind === 'system' && systemReq.technical.drawerSystemKey === 'gtv_axis_pro', 'Systemowe GTV Axis Pro zapisuje konkretny system techniczny', systemReq);
const systemParts = cutApi.getCabinetCutList(clone(systemCab), 'kuchnia');
assert(systemParts.some((part)=> part && part.hardwareRequirement && /system szuflady/i.test(part.material)), 'Systemowe dodają komplet systemu jako okucie', systemParts);
assert(!systemParts.some((part)=> part && part.group === 'Szuflady skrzynkowe'), 'Systemowe nie generują formatek skrzynkowych z 18/10 mm', systemParts);

console.log('OK drawer-systems-materials smoke');
console.log(' - preferencje szuflad przechowują konkretny system/model');
console.log(' - skrzynkowe generują prowadnice + formatki 18 mm i dno 10 mm');
console.log(' - systemowe zapisują wymaganie katalogowe bez udawania skrzynkowych');
