#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');

function assert(cond, msg, details){
  if(!cond){
    console.error('FAIL:', msg);
    if(details !== undefined){
      try{ console.error(JSON.stringify(details, null, 2)); }
      catch(_){ console.error(details); }
    }
    process.exit(1);
  }
}

function slug(value){
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'x';
}

function createStorage(){
  const data = new Map();
  return {
    getItem(key){ return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value){ data.set(String(key), String(value)); },
    removeItem(key){ data.delete(String(key)); },
    clear(){ data.clear(); }
  };
}

function loadContext(opts){
  const cfg = Object.assign({ producer:'Blum' }, opts || {});
  const storage = createStorage();
  const FC = {
    utils:{ slug },
    roomPreferences:{
      resolveHardwareProducerPreference(_room, group, fallback){
        return group === 'hinges' ? (cfg.producer || fallback || 'Blum') : (fallback || '');
      }
    },
    wycenaCoreUtils:{ slug },
    wycenaCoreCatalog:{
      accessoryPriceLookup(){ return null; },
      servicePriceLookup(){ return null; }
    },
    wycenaCoreSource:{
      selectedCabinets(){ return []; },
      roomLabel(room){ return room === 'kuchnia' ? 'S' : String(room || '—'); },
      getSelectedAggregate(){ return { groups:{}, materials:[], selectedRooms:['kuchnia'] }; },
      getScopedMaterials(){ return []; }
    },
    wycenaCoreOffer:{ collectQuoteRateLines(){ return []; } },
    wycenaCoreSelection:{
      normalizeQuoteSelection(value){ return value || {}; },
      decodeSelectedRooms(){ return ['kuchnia']; },
      decodeMaterialScope(){ return { kind:'all' }; }
    }
  };
  const projectData = { kuchnia:{ settings:{ legHeight:0 }, cabinets:[], fronts:[], sets:[] } };
  const ctx = {
    window:{ FC, localStorage:storage, projectData },
    FC,
    localStorage:storage,
    projectData,
    console,
    document:{ getElementById(){ return null; } }
  };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  [
    'js/app/catalog/catalog-domain.js',
    'js/app/catalog/catalog-migration.js',
    'js/app/catalog/hardware-technical-params.js',
    'js/app/catalog/hardware-catalog.js',
    'js/app/catalog/hardware-catalog-seed-data.js',
    'js/app/catalog/hardware-catalog-seeds.js',
    'js/app/catalog/catalog-store.js',
    'js/app/cabinet/front-hardware-weights.js',
    'js/app/cabinet/front-hardware-fronts.js',
    'js/app/cabinet/front-hardware-hinges.js',
    'js/app/cabinet/front-hardware.js',
    'js/app/cabinet/cabinet-hardware-requirement-options.js',
    'js/app/cabinet/cabinet-hardware-requirements.js',
    'js/app/cabinet/cabinet-cutlist.js',
    'js/app/wycena/wycena-core-lines.js',
  ].forEach((file)=> vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename:file }));
  return ctx;
}

function collectHingeLines(FC){
  return FC.wycenaCoreLines.collectAccessories(['kuchnia']).filter((row)=> row && row.hardwareRequirement && row.hardwareRequirement.hardwareGroup === 'hinges');
}

function setSelectedCabinets(ctx, cabinets){
  const FC = ctx.window.FC;
  const arr = Array.isArray(cabinets) ? cabinets : [cabinets];
  ctx.window.projectData.kuchnia.cabinets = arr;
  ctx.projectData.kuchnia.cabinets = arr;
  FC.wycenaCoreSource.selectedCabinets = function(){
    return arr.map((cab)=> ({ roomId:'kuchnia', roomLabel:'S', cabinet:cab }));
  };
}

// Nowa bezpieczna reguła kg musi przejść aż do WYCENY, a nie tylko do panelu/MATERIAŁÓW.
{
  const ctx = loadContext({ producer:'Blum' });
  const FC = ctx.window.FC;
  const cab = {
    id:'cab66x105', type:'moduł', subType:'standard', width:66, height:105, depth:50,
    frontCount:1, frontMaterial:'akryl', frontColor:'biały', openingSystem:'uchwyt', details:{}
  };
  setSelectedCabinets(ctx, cab);
  const reqs = FC.cabinetHardwareRequirements.getHingeRequirementsWithQty('kuchnia', cab).filter((row)=> row.kind === 'hinge');
  assert(reqs.length === 1 && reqs[0].qty === 4, '66×105 akryl ma mieć 4 zawiasy w centralnym wymaganiu kg', reqs);
  const lines = collectHingeLines(FC);
  assert(lines.length === 1, 'WYCENA ma dostać jedną linię zawiasów dla jednego dużego frontu', lines);
  assert(lines[0].qty === 4, 'WYCENA ma przejąć ilość 4 z centralnego wymagania, bez własnego licznika', lines[0]);
  assert(lines[0].resolvedHardwareSymbol === '71B3550+173L6100', 'Domyślna preferencja Blum ma dobrać komplet 110° nakładany', lines[0]);
}

// Legacy szuflada+drzwi: front szuflady jest materiałem, ale nie może stać się drzwiczkami zawiasowymi.
{
  const ctx = loadContext({ producer:'Blum' });
  const FC = ctx.window.FC;
  const cab = {
    id:'cab_drawer_doors', type:'stojąca', subType:'szuflada_drzwi', width:60, height:82, depth:51,
    frontCount:3, frontMaterial:'laminat', frontColor:'biały', openingSystem:'uchwyt',
    details:{ drawerHeight:20 }
  };
  ctx.window.projectData.kuchnia.settings.legHeight = 0;
  setSelectedCabinets(ctx, cab);
  const doorPanels = FC.frontHardware.getDoorFrontPanelsForHinges('kuchnia', cab);
  assert(doorPanels.length === 2, 'Szuflada+drzwi z legacy frontCount=3 ma mieć 2 panele zawiasowe, nie 3', doorPanels);
  const reqs = FC.cabinetHardwareRequirements.getHingeRequirementsWithQty('kuchnia', cab).filter((row)=> row.kind === 'hinge');
  const totalQty = reqs.reduce((sum, row)=> sum + (Number(row.qty) || 0), 0);
  assert(totalQty === 4, 'Szuflada+drzwi ma mieć 4 zawiasy dla dwóch drzwiczek, bez frontu szuflady', reqs);
  const lines = collectHingeLines(FC);
  assert(lines.length === 1 && lines[0].qty === 4, 'WYCENA ma policzyć zawiasy szuflada+drzwi jako 4, nie 6', lines);
}

// Zestaw bez zapisanych frontów w room.fronts: fronty mają być odtworzone z rekordu zestawu i policzone tylko raz.
{
  const ctx = loadContext({ producer:'Blum' });
  const FC = ctx.window.FC;
  const lead = { id:'cab_set_lead', setId:'set1', type:'stojąca', subType:'standard', width:60, height:82, depth:51, frontCount:1, frontMaterial:'akryl', openingSystem:'uchwyt', details:{} };
  const follower = { id:'cab_set_follower', setId:'set1', type:'stojąca', subType:'standard', width:60, height:82, depth:51, frontCount:1, frontMaterial:'akryl', openingSystem:'uchwyt', details:{} };
  ctx.window.projectData.kuchnia.sets = [{ id:'set1', number:1, presetId:'C', frontCount:1, frontMaterial:'akryl', frontColor:'biały', params:{ w:66, hB:105, hTop:0 } }];
  ctx.window.projectData.kuchnia.fronts = [];
  setSelectedCabinets(ctx, [lead, follower]);
  const leadPanels = FC.frontHardware.getDoorFrontPanelsForHinges('kuchnia', lead);
  const followerPanels = FC.frontHardware.getDoorFrontPanelsForHinges('kuchnia', follower);
  assert(leadPanels.length === 1 && leadPanels[0].w === 66 && leadPanels[0].h === 105, 'Prowadzący korpus zestawu ma odtworzyć jeden front 66×105 z rekordu zestawu', leadPanels);
  assert(followerPanels.length === 0, 'Nieprowadzący korpus zestawu nie może dublować frontu ani zawiasów', followerPanels);
  const lines = collectHingeLines(FC);
  assert(lines.length === 1 && lines[0].qty === 4, 'WYCENA zestawu ma policzyć zawiasy tylko raz z odtworzonego frontu zestawu', lines);
}

// Preferencja producenta i zamiennik: 110° może dobrać GTV 107° w tej samej klasie, a nie narożny 170°.
{
  const ctx = loadContext({ producer:'GTV' });
  const FC = ctx.window.FC;
  const store = typeof FC.catalogStore === 'function' ? FC.catalogStore() : FC.catalogStore;
  const accessories = store.getAccessories()
    .filter((row)=> !(String(row && row.manufacturer || '').toLowerCase() === 'gtv' && String(row && row.hardwareCategory || '').toLowerCase().includes('zawias')));
  accessories.push({
    id:'hw_test_gtv_107_quote_flow',
    manufacturer:'GTV',
    symbol:'GTV107_QUOTE_FLOW',
    name:'Zawias GTV 107° standard 90–120 z hamulcem + prowadnik',
    hardwareCategory:'Zawiasy',
    hardwareUnit:'kpl.',
    price:7.77,
    catalogPriceGross:7.77,
    purchasePriceGross:7.77,
    priceSource:'test',
    status:'active',
    technicalParams:{
      rola_kompletu:{ value:'komplet zawiasowy' },
      system_kompatybilnosci:{ value:'GTV euro' },
      nalozenie:{ value:'nakładany' },
      kat_rzeczywisty:{ from:107, to:'' },
      klasa_kata:{ value:'standardowy 90–120°' },
      hamulec:{ value:true },
      sprezyna:{ value:true },
      typ_prowadnika:{ value:'standardowy' },
      forma_prowadnika:{ value:'krzyżowy' },
      pokrycie_prowadnika:{ value:'w komplecie' }
    }
  });
  store.savePriceList('accessories', accessories);
  const cab = { id:'cab_gtv', type:'moduł', subType:'standard', width:60, height:105, depth:50, frontCount:1, frontMaterial:'akryl', openingSystem:'uchwyt', details:{} };
  setSelectedCabinets(ctx, cab);
  const lines = collectHingeLines(FC);
  assert(lines.length === 1, 'Preferencja GTV ma dać jedną linię zawiasów', lines);
  assert(lines[0].resolvedHardwareSymbol === 'GTV107_QUOTE_FLOW', 'WYCENA ma dobrać GTV 107° jako zamiennik 110° w klasie 90–120°', lines[0]);
  assert(!String(lines[0].name || '').includes('170°'), 'WYCENA nie może dobrać 170° narożnego jako zamiennika 110°', lines[0]);
}

console.log('OK wycena-hinge-quote-replacement-flow smoke');
