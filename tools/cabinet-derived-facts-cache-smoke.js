#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function run(ctx, rel){ vm.runInContext(read(rel), ctx, { filename: rel }); }

let cutlistCalls = 0;
let frontCalls = 0;
let hingeCalls = 0;
let drawerCalls = 0;
let saved = 0;
let investor = {
  id:'inv_cache',
  carrying:{
    floorNumber:'3',
    elevatorStatus:'yes',
    elevator:{ doorWidthCm:'90', doorHeightCm:'220', cabinDepthCm:'120', cabinHeightCm:'220' },
    note:''
  }
};
const project = {
  kuchnia:{
    cabinets:[{
      id:'cab_cache_1',
      type:'stojąca',
      subType:'standardowa',
      width:60,
      height:82,
      depth:51,
      frontCount:2,
      details:{ shelves:1 }
    }]
  }
};

const context = {
  console,
  Date,
  Math,
  JSON,
  String,
  Number,
  Array,
  Object,
  Set,
  Map,
  performance:{ now(){ return Date.now(); } },
  projectData:project,
  window:null,
};
context.window = context;
context.globalThis = context;
context.FC = {
  utils:{ clone(value){ return JSON.parse(JSON.stringify(value)); } },
  rozrys:{ safeGetProject(){ return project; } },
  project:{ save(data){ saved += 1; return data; } },
  storage:{ setJSON(){} },
  investorPersistence:{ getCurrentInvestorId(){ return investor.id; }, getInvestorById(){ return investor; } },
  cabinetCutlist:{
    getCabinetCutList(cabinet){
      cutlistCalls += 1;
      return [
        { name:'Bok lewy', qty:2, a:cabinet.height || 82, b:cabinet.depth || 51, material:'Laminat W1100' },
        { name:'Wieniec', qty:2, a:cabinet.width || 60, b:cabinet.depth || 51, material:'Laminat W1100' },
        { name:'Plecy HDF', qty:1, a:Math.max(0, (cabinet.height || 82) - 2), b:Math.max(0, (cabinet.width || 60) - 2), material:'HDF 3mm' },
        { name:'Front', qty:2, a:78, b:29, material:'Front: laminat • W1100' }
      ];
    }
  },
  frontHardware:{
    FC_FRONT_WEIGHT_KG_M2:{ laminat:13 },
    getCabinetFrontCutListForMaterials(){
      frontCalls += 1;
      return [{ name:'Front', qty:2, a:78, b:29, material:'Front: laminat • W1100', dims:'29 × 78' }];
    }
  },
  cabinetHardwareRequirements:{
    getHingeRequirementsWithQty(){
      hingeCalls += 1;
      return [{ kind:'hinge', hardwareGroup:'hinges', label:'Zawias 110° nakładany', qty:4 }];
    },
    getCabinetHardwareRequirements(){ return [{ kind:'hinge', hardwareGroup:'hinges', label:'Zawias 110° nakładany', qty:4 }]; }
  },
  cabinetDrawerRequirements:{
    getDrawerRequirementsWithQty(){ drawerCalls += 1; return []; }
  },
  laborApplianceRules:{ getApplianceForCabinet(){ return null; }, isMountingEnabled(){ return false; } },
  materialCommon:{ totalsFromParts(parts){ return { 'Laminat W1100':parts.filter((p)=>String(p.material).includes('Laminat')).length }; } },
  materialEdgeStore:{
    createEdgeStore(){ return { calcEdgeMetersByPcvModeForParts(){ return { body:4.2, front:1.8, total:6, mode:'body' }; } }; }
  },
  materialPartOptions:{ resolvePartForRozrys(part){ return { materialKey:String(part.material || ''), name:String(part.name || 'Element'), sourceSig:String(part.name || 'Element'), direction:'default', ignoreGrain:false, w:Math.round((Number(part.a) || 0) * 10), h:Math.round((Number(part.b) || 0) * 10), qty:Number(part.qty) || 1 }; } }
};
context.STORAGE_KEYS = { projectData:'project' };
vm.createContext(context);

run(context, 'js/app/pricing/work-quantity-sources.js');
run(context, 'js/app/pricing/carrying-logistics.js');
run(context, 'js/app/cabinet/cabinet-drawer-requirements.js');
run(context, 'js/app/pricing/work-quantity-facts.js');
run(context, 'js/app/cabinet/cabinet-derived-facts.js');

const api = context.FC.cabinetDerivedFacts;
assert.ok(api && api.VERSION === '20260616_project_preparation_section_v1', 'cabinetDerivedFacts API/version exists');
const cab = project.kuchnia.cabinets[0];

let first = api.ensureCabinetFacts('kuchnia', cab, { recalculate:true, persist:false });
assert.equal(first.status, 'missing', 'pierwszy zapis tworzy fakty z braku cache');
assert.ok(first.recalculated, 'pierwszy zapis przelicza fakty');
assert.ok(cab.derivedFacts && cab.derivedFacts.kind === 'cabinet-derived-facts', 'szafka ma zapisane derivedFacts');
assert.ok(cab.derivedFacts.inputHash, 'cache ma inputHash');
assert.equal(cab.derivedFacts.version, api.VERSION, 'cache ma wersję kalkulatora');
assert.ok(cab.derivedFacts.cutlists.all.length >= 4, 'cache zawiera formatki');
assert.equal(cab.derivedFacts.workFacts.rawValues['hinge.count'], 4, 'cache zawiera wymagania robocizny/hinge.count');
assert.equal(cab.derivedFacts.logistics.floorUnits, 2, 'logistyka windy działa w cache');
assert.ok(cab.derivedFacts.material.edgeMetersByMode.total === 6, 'PCV/metraż oklein jest zapisany w faktach');
assert.ok(cab.derivedFacts.highFronts, 'cache zawiera sekcję wysokich frontów');
const callsAfterFirst = { cutlistCalls, frontCalls, hingeCalls, drawerCalls };

let second = api.ensureCabinetFacts('kuchnia', cab, { recalculate:true, persist:false });
assert.equal(second.status, 'hit', 'aktualny hash czyta cache');
assert.equal(cutlistCalls, callsAfterFirst.cutlistCalls, 'hit nie odpala ponownie ciężkiego cutlist');

const facts = context.FC.workQuantityFacts.getCabinetFacts('kuchnia', cab);
assert.ok(Array.isArray(facts) && facts.some((row)=>row.code === 'cabinet.weight_kg'), 'workQuantityFacts czyta fakty z cache');
assert.equal(cutlistCalls, callsAfterFirst.cutlistCalls, 'CZYNNOŚCI/fakty robocze nie liczą cutlist na hit cache');

const oldHash = cab.derivedFacts.inputHash;
cab.width = 70;
let stale = api.ensureCabinetFacts('kuchnia', cab, { recalculate:true, persist:false });
assert.equal(stale.status, 'stale', 'edycja szafki unieważnia hash');
assert.notEqual(cab.derivedFacts.inputHash, oldHash, 'edycja zmienia inputHash');

cab.derivedFacts.version = 'old_calculator';
let version = api.ensureCabinetFacts('kuchnia', cab, { recalculate:true, persist:false });
assert.equal(version.status, 'version', 'zmiana wersji kalkulatora wymusza przeliczenie');

const hashBeforeCarrying = cab.derivedFacts.inputHash;
investor.carrying.floorNumber = '5';
let carryingStale = api.ensureCabinetFacts('kuchnia', cab, { recalculate:true, persist:false });
assert.equal(carryingStale.status, 'stale', 'zmiana danych wnoszenia unieważnia logistykę/fakty');
assert.notEqual(cab.derivedFacts.inputHash, hashBeforeCarrying, 'zmiana wnoszenia zmienia hash');

const aggregate = api.aggregatePartsForRooms(['kuchnia'], { ensure:true, persist:false });
assert.ok(Array.isArray(aggregate.materials) && aggregate.materials.length > 0, 'WYCENA/ROZRYS może agregować formatki z cache');
assert.ok(!read('js/app/cabinet/cabinet-derived-facts.js').includes('localStorage'), 'derivedFacts nie tworzy nowego localStorage');
assert.ok(!read('js/app/cabinet/cabinet-derived-facts.js').includes('document.'), 'derivedFacts nie dotyka DOM');
assert.ok(!read('index.html').includes('capacityKg') && !read('dev_tests.html').includes('cabinWidthCm'), 'nie przywrócono martwych pól windy');
assert.ok(read('index.html').includes('js/app/cabinet/cabinet-derived-facts.js?v=20260616_project_preparation_section_v1'), 'index ładuje cabinet-derived-facts');
assert.ok(read('dev_tests.html').includes('js/app/cabinet/cabinet-derived-facts.js?v=20260616_project_preparation_section_v1'), 'dev_tests ładuje cabinet-derived-facts');
assert.ok(read('tools/app-dev-smoke-lib/file-list.js').includes('js/app/cabinet/cabinet-derived-facts.js'), 'app-dev smoke ładuje cabinet-derived-facts');
assert.ok(read('js/app/wycena/wycena-core-source.js').includes('aggregatePartsForRooms'), 'WYCENA materiałowa ma odczyt agregatu z cache faktów');
assert.ok(read('js/app/wycena/wycena-core-labor.js').includes('getLogistics'), 'WYCENA robocizny ma odczyt logistyki z cache faktów');
assert.ok(read('js/app/wycena/wycena-core.js').includes('factCacheHits') && read('js/app/wycena/wycena-core.js').includes('ensureForRooms'), 'WYCENA mierzy i odczytuje cache faktów przed naliczeniem');
assert.ok(read('js/app/wycena/wycena-diagnostics.js').includes('WYDAJNOŚĆ WYCENY / CACHE FAKTÓW'), 'diagnostyka WYCENY raportuje wydajność i cache faktów');

const summary = api.ensureForRooms(['kuchnia'], { persist:true, recalculate:true });
assert.ok(summary.cacheHits >= 1, 'ensureForRooms czyta gotowy cache');
assert.equal(saved, 0, 'persist nie zapisuje projektu, gdy nie było przeliczeń');

console.log('OK cabinet-derived-facts-cache smoke');
console.log(' - zapis/edycja szafki tworzy i odświeża fakty pochodne');
console.log(' - hash, wersja kalkulatora i dane wnoszenia unieważniają cache');
console.log(' - CZYNNOŚCI/WYCENA mogą czytać formatki, robociznę i logistykę bez ponownego ciężkiego liczenia');
