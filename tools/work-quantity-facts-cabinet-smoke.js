#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');

function assert(cond, msg, details){
  if(!cond){
    console.error('FAIL:', msg);
    if(details !== undefined){
      try{ console.error(JSON.stringify(details, null, 2)); }catch(_){ console.error(details); }
    }
    process.exit(1);
  }
}
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function load(rel, ctx){ vm.runInContext(read(rel), ctx, { filename:rel }); }

const FC = {
  utils:{ clone:(value)=> JSON.parse(JSON.stringify(value)) },
  frontHardware:{
    getCabinetFrontCutListForMaterials(room, cab){
      cab.frontCount = 99; // test ochrony przed mutacją oryginalnej szafki
      return [
        { name:'Front', qty:2, a:30, b:72, dims:'30 × 72' },
        { name:'Korpus', qty:1, a:60, b:72, dims:'60 × 72' }
      ];
    }
  },
  cabinetHardwareRequirements:{
    getHingeRequirementsWithQty(room, cab){
      cab.details = Object.assign({}, cab.details || {}, { mutatedByTest:true });
      return [
        { kind:'hinge', hardwareGroup:'hinges', label:'Zawias 110° nakładany', qty:4, doorLabel:'Drzwiczki' }
      ];
    }
  },
  laborApplianceRules:{
    getApplianceForCabinet(cab){
      return cab && cab.subType === 'piekarnikowa' ? { serviceName:'Piekarnik do zabudowy', label:'Piekarnik do zabudowy', subType:'piekarnikowa' } : null;
    }
  }
};
const ctx = { window:{ FC }, FC, console, JSON, String, Number, Array, Object, Set, Map, Math };
ctx.globalThis = ctx.window;
vm.createContext(ctx);
load('js/app/pricing/work-quantity-sources.js', ctx);
load('js/app/pricing/work-quantity-facts.js', ctx);

const api = ctx.FC.workQuantityFacts;
assert(api && typeof api.getCabinetFacts === 'function' && typeof api.buildCabinetFactMap === 'function', 'workQuantityFacts API jest dostępne');

const cabinet = {
  id:'cab_test_1',
  type:'stojąca',
  subType:'standardowa',
  width:60,
  height:82,
  depth:51,
  frontCount:2,
  details:{ shelves:1, drawerCount:'0' }
};
const before = JSON.stringify(cabinet);
const map = api.buildCabinetFactMap('kuchnia', cabinet);
assert(JSON.stringify(cabinet) === before, 'adapter faktów roboczych nie mutuje oryginalnej szafki', cabinet);
assert(map['cabinet.width_mm'].value === 600, 'szerokość 60 cm jest widoczna jako cabinet.width_mm = 600');
assert(map['cabinet.height_mm'].value === 820, 'wysokość 82 cm jest widoczna jako cabinet.height_mm = 820');
assert(map['cabinet.depth_mm'].value === 510, 'głębokość 51 cm jest widoczna jako cabinet.depth_mm = 510');
assert(map['cabinet.volume_m3'].value === 0.2509, 'objętość jest liczona z wymiarów, bez zapisu w szafce', map['cabinet.volume_m3']);
assert(map['front.count'].value === 2, 'front.count czyta ilość frontów z centralnego źródła frontów');
assert(/30 × 72/.test(map['front.dimensions'].displayValue), 'front.dimensions pokazuje wymiary frontów');
assert(map['front.area_m2'].value === 0.432, 'front.area_m2 liczy powierzchnię frontów');
assert(map['hinge.count'].value === 4, 'hinge.count czyta ilość zawiasów z wymagań zawiasów');
assert(/Zawias 110/.test(map['hinge.requirement'].displayValue), 'hinge.requirement pokazuje ludzki opis wymagania zawiasu');
assert(map['shelf.count'].value === 1, 'shelf.count czyta półki z danych szafki');
assert(map['cabinet.zone'].value === 'dolna', 'cabinet.zone klasyfikuje stojącą jako dolną');
assert(map['appliance.count'].value === 0, 'appliance.count dla zwykłej szafki wynosi 0');

const ovenMap = api.buildCabinetFactMap('kuchnia', Object.assign({}, cabinet, { subType:'piekarnikowa' }));
assert(ovenMap['appliance.count'].value === 1, 'appliance.count wykrywa AGD z reguł montażu sprzętu');
assert(ovenMap['appliance.type'].value === 'Piekarnik do zabudowy', 'appliance.type pokazuje typ AGD');
assert(ovenMap['worktop.length_m'].available === false, 'planowane źródła bez logiki pozostają niepodpięte');

const index = read('index.html');
const dev = read('dev_tests.html');
const loadGroups = read('tools/index-load-groups.js');
const fileList = read('tools/app-dev-smoke-lib/file-list.js');
[index, dev, loadGroups, fileList].forEach((src, idx)=> assert(src.includes('js/app/pricing/work-quantity-facts.js'), `plik ładowania ${idx} ładuje work-quantity-facts.js`));
assert(index.includes('20260609_labor_conditions_cascade_load_fix_v1') && dev.includes('20260609_labor_conditions_cascade_load_fix_v1'), 'index/dev_tests mają cache-busting faktów roboczych');
assert(!index.includes('cmWorkFactsPreview') && !index.includes('cabinet-work-facts-preview.js'), 'etap nie przywraca panelu w modalu szafki');
assert(!read('js/app/cabinet/cabinet-modal.js').includes('cmWorkFactsPreview'), 'cabinet-modal.js nie jest podłączony do panelu faktów');
assert(!read('js/app/ui/cabinets-render.js').includes('ensureAddCabinet'), 'cabinets-render.js nie ma awaryjnej łaty plusa');
assert(!read('js/app/pricing/work-quantity-facts.js').includes('localStorage'), 'work-quantity-facts nie używa localStorage');
assert(!read('js/app/pricing/work-quantity-facts.js').includes('document.'), 'work-quantity-facts nie dotyka DOM');

console.log('OK work-quantity-facts-cabinet smoke');
console.log(' - szafka ma czytane fakty robocze bez zapisu drugiej prawdy');
console.log(' - fronty i zawiasy są czytane przez istniejące centralne źródła');
console.log(' - modal szafki/WYWIAD nie zostały podpięte do nowego UI');
