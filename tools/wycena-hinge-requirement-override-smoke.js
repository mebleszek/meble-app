#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');

function assert(cond, msg){
  if(!cond){
    console.error('FAIL:', msg);
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

function loadContext(){
  const storage = { getItem(){ return null; }, setItem(){}, removeItem(){} };
  const FC = {
    utils:{ slug },
    frontHardware:{
      getDoorFrontPanelsForHinges(_room, cab){
        const count = Math.max(0, Number(cab && cab.frontCount) || 0);
        const wEach = count ? ((Number(cab && cab.width) || 0) / count) : 0;
        const h = Number(cab && cab.height) || 0;
        return Array.from({ length:count }, ()=> ({ w:wEach, h, material:(cab && cab.frontMaterial) || 'laminat', hasHandle:true }));
      },
      blumHingesPerDoor(_w, h){ return Number(h) > 100 ? 3 : 2; },
      getHingeCountForCabinet(room, cab){
        return this.getDoorFrontPanelsForHinges(room, cab).reduce((sum, door)=> sum + this.blumHingesPerDoor(door.w, door.h), 0);
      }
    },
    roomPreferences:{
      resolveHardwareProducerPreference(_room, group, fallback){
        return group === 'hinges' ? (fallback || 'BLUM') : (fallback || '');
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

  const ctx = {
    window:{ FC, localStorage:storage },
    FC,
    localStorage:storage,
    console,
    document:{ getElementById(){ return null; } }
  };
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
    'js/app/wycena/wycena-core-lines.js',
  ].forEach((file)=> vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename:file }));
  return ctx;
}

const ctx = loadContext();
const FC = ctx.window.FC;
const reqApi = FC.cabinetHardwareRequirements;
const linesApi = FC.wycenaCoreLines;
const cab = {
  id:'cab-test',
  type:'stojąca',
  subType:'standard',
  width:60,
  height:82,
  depth:51,
  frontCount:2,
  frontMaterial:'laminat',
  details:{}
};

FC.wycenaCoreSource.selectedCabinets = function(){
  return [{ roomId:'kuchnia', roomLabel:'S', cabinet:cab }];
};

const defaultLines = linesApi.collectAccessories(['kuchnia']);
const defaultTotal = defaultLines.reduce((sum, row)=> sum + (Number(row.total) || 0), 0);
assert(defaultLines.length === 1, 'domyślne dwa fronty o tym samym wymaganiu powinny dać jedną linię akcesoriów');
assert(defaultLines[0].resolvedHardwareSymbol === '71B3550+173L6100', 'domyślne wymaganie 110° nakładane ma wskazać konkretny komplet BLUM z katalogu');
assert(defaultLines[0].qty === 4, 'domyślne dwa fronty mają łącznie 4 komplety zawiasowe');

// Zasymuluj stary/stale cutlist: nawet jeśli cutlista zwróci domyślne zawiasy,
// WYCENA ma brać wymagania zawiasów bezpośrednio z centralnego helpera szafki.
const staleReq = reqApi.getHingeRequirementPreset(reqApi.HINGE_TYPES.OVERLAY_110, 'stale_cutlist_default', { qty:4 });
FC.cabinetCutlist.getCabinetCutList = function(){
  return [{ name:'Stary zawias 110°', qty:4, a:0, b:0, material:'Okucia: komplet zawiasowy', hardwareRequirement:staleReq }];
};

reqApi.setHingeDoorOverride(cab, 'left', { typeId:reqApi.HINGE_TYPES.PARALLEL_INSET });
const overrideLines = linesApi.collectAccessories(['kuchnia']);
const overrideTotal = overrideLines.reduce((sum, row)=> sum + (Number(row.total) || 0), 0);
const symbols = overrideLines.map((row)=> row.resolvedHardwareSymbol).sort();

assert(overrideLines.length === 2, 'różne wymagania lewej i prawej strony muszą dać dwie linie akcesoriów w WYCENIE');
assert(symbols.includes('79B9550+173L6130'), 'ręczny override równoległy wpuszczany musi trafić do WYCENY jako konkretny komplet z katalogu');
assert(symbols.includes('71B3550+173L6100'), 'niezmieniona prawa strona ma zostać standardowym 110° nakładanym');
assert(Math.abs(defaultTotal - overrideTotal) > 0.01, 'zmiana wymagań zawiasu musi zmienić wynik finansowy WYCENY, jeśli dobrana pozycja ma inną cenę');
assert(overrideLines.some((row)=> row.hardwareRequirement && row.hardwareRequirement.overridden === true), 'linia WYCENY musi przenieść informację o ręcznym nadpisaniu wymagania');

console.log('OK wycena-hinge-requirement-override smoke');
