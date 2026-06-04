#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function assert(cond, msg, details){ if(!cond){ console.error('FAIL:', msg); if(details) console.error(JSON.stringify(details, null, 2)); process.exit(1); } }
function slug(value){ return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x'; }
function loadContext(){
  const storage = { getItem(){ return null; }, setItem(){}, removeItem(){} };
  const FC = {
    utils:{ slug },
    frontHardware:{
      getDoorFrontPanelsForHinges(_room, cab){ const count = Math.max(0, Number(cab && cab.frontCount) || 0); return Array.from({ length:count }, ()=> ({ w:30, h:82, material:'laminat', hasHandle:true })); },
      blumHingesPerDoor(){ return 2; },
      getHingeCountForCabinet(){ return 4; }
    },
    roomPreferences:{ resolveHardwareProducerPreference(_room, group, fallback){ return group === 'hinges' ? 'GTV' : (fallback || ''); } },
    wycenaCoreUtils:{ slug },
    wycenaCoreCatalog:{ accessoryPriceLookup(){ return null; }, servicePriceLookup(){ return null; } },
    wycenaCoreSource:{ selectedCabinets(){ return []; }, roomLabel(room){ return String(room || '—'); }, getSelectedAggregate(){ return { groups:{}, materials:[], selectedRooms:['kuchnia'] }; }, getScopedMaterials(){ return []; } },
    wycenaCoreOffer:{ collectQuoteRateLines(){ return []; } },
    wycenaCoreSelection:{ normalizeQuoteSelection(v){ return v || {}; }, decodeSelectedRooms(){ return ['kuchnia']; }, decodeMaterialScope(){ return { kind:'all' }; } }
  };
  const ctx = { window:{ FC, localStorage:storage }, FC, localStorage:storage, console, document:{ getElementById(){ return null; } } };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  [
    'js/app/catalog/hardware-technical-params.js',
    'js/app/catalog/hardware-catalog.js',
    'js/app/catalog/hardware-catalog-seed-data.js',
    'js/app/catalog/hardware-catalog-seeds.js',
    'js/app/catalog/catalog-store.js',
    'js/app/cabinet/cabinet-hardware-requirement-options.js',
    'js/app/cabinet/cabinet-hardware-requirements.js',
    'js/app/cabinet/cabinet-cutlist.js',
    'js/app/wycena/wycena-core-lines.js'
  ].forEach((file)=> vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename:file }));
  return ctx;
}
const ctx = loadContext();
const FC = ctx.window.FC;
const store = typeof FC.catalogStore === 'function' ? FC.catalogStore() : FC.catalogStore;
const accessories = store.getAccessories()
  .filter((row)=> !(String(row && row.manufacturer || '').toLowerCase() === 'gtv'));
accessories.push({
  id:'test_gtv_hinge_107_no_plate', manufacturer:'GTV', symbol:'GTV-H107', name:'GTV zawias 107° bez prowadnika', hardwareCategory:'Zawiasy', hardwareUnit:'szt.',
  catalogPriceGross:5.00, purchasePriceGross:5.00, price:5.00, status:'active', priceSource:'test',
  technicalParams:{
    rola_kompletu:{ value:'zawias' }, system_kompatybilnosci:{ value:'GTV clip-on' }, nalozenie:{ value:'nakładany' },
    kat_rzeczywisty:{ from:107, to:'' }, klasa_kata:{ value:'standardowy 90–120°' }, hamulec:{ value:true }, sprezyna:{ value:true },
    typ_prowadnika:{ value:'standardowy' }, forma_prowadnika:{ value:'krzyżowy' }, pokrycie_prowadnika:{ value:'osobno' }
  }
});
accessories.push({
  id:'test_gtv_plate_standard_cross', manufacturer:'GTV', symbol:'GTV-P-ST-K', name:'GTV prowadnik standardowy krzyżowy', hardwareCategory:'Prowadniki', hardwareUnit:'szt.',
  catalogPriceGross:1.50, purchasePriceGross:1.50, price:1.50, status:'active', priceSource:'test',
  technicalParams:{
    rola_kompletu:{ value:'prowadnik' }, system_kompatybilnosci:{ value:'GTV clip-on' }, typ_prowadnika:{ value:'standardowy' }, forma_prowadnika:{ value:'krzyżowy' }
  }
});
store.savePriceList('accessories', accessories);
const cab = { id:'cab-components', type:'stojąca', subType:'standard', width:60, height:82, depth:51, frontCount:2, frontMaterial:'laminat', details:{} };
FC.wycenaCoreSource.selectedCabinets = function(){ return [{ roomId:'kuchnia', roomLabel:'S', cabinet:cab }]; };
const lines = FC.wycenaCoreLines.collectAccessories(['kuchnia']);
const symbols = lines.map((row)=> row.resolvedHardwareSymbol).sort();
assert(symbols.includes('GTV-H107'), 'WYCENA ma dobrać osobny zawias GTV 107° jako składnik kompletu', lines);
assert(symbols.includes('GTV-P-ST-K'), 'WYCENA ma dobrać osobny prowadnik GTV po producencie, systemie, typie i formie', lines);
const hinge = lines.find((row)=> row.resolvedHardwareSymbol === 'GTV-H107');
const plate = lines.find((row)=> row.resolvedHardwareSymbol === 'GTV-P-ST-K');
assert(hinge && hinge.qty === 4, 'osobny zawias ma mieć tę samą liczbę sztuk co komplety zawiasowe', hinge);
assert(plate && plate.qty === 4, 'osobny prowadnik ma mieć tę samą liczbę sztuk co komplety zawiasowe', plate);
assert(Math.abs(lines.reduce((sum, row)=> sum + Number(row.total || 0), 0) - 31.2) < 0.001, 'łączny koszt składanego kompletu powinien wynosić 4×6 + 4×1.8 po domyślnym narzucie testowym', lines);
console.log('OK hinge-driver-components smoke');
