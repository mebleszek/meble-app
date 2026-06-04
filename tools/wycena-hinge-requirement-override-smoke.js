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
assert(defaultTotal > 0, 'domyślna linia zawiasów musi mieć cenę z katalogu');

// Legacy/bez catalogOptionSourceItemIds: 110° nakładany nie może dobrać 170° tylko dlatego,
// że 170° spełnia szerokie porównanie typu „minimum taki sam albo większy”.
const legacy110Req = {
  kind:'hinge',
  requirementType:'hingeSet',
  displayTitle:'Komplet zawiasowy',
  hardwareGroup:'hinges',
  category:'Zawiasy',
  typeId:reqApi.HINGE_TYPES.OVERLAY_110,
  label:'Zawias 110° nakładany',
  ruleId:'legacy_110_without_source_ids',
  technicalParams:{
    nalozenie:{ value:'nakładany' },
    kat_otwarcia:{ from:110 },
    hamulec:{ value:true },
    prowadnik:{ value:'standardowy' }
  },
  qty:4
};
const originalGetHingeRequirementsWithQty = FC.cabinetHardwareRequirements.getHingeRequirementsWithQty;
FC.cabinetHardwareRequirements.getHingeRequirementsWithQty = function(){ return [legacy110Req]; };
const legacyLines = linesApi.collectAccessories(['kuchnia']);
assert(legacyLines.length === 1, 'legacy 110° bez source IDs nadal powinno dobrać jedną linię');
assert(legacyLines[0].resolvedHardwareSymbol === '71B3550+173L6100', 'legacy 110° nakładany nie może dobrać zawiasu 170° narożnego');
assert(!String(legacyLines[0].name || '').includes('170°'), 'nazwa pozycji dla legacy 110° nie może wskazywać 170° narożnego');

// Zamiennik: jeżeli preferowany producent nie ma dokładnie 110°, ale ma zawias 107°
// w tej samej klasie zamienności 90–120° oraz tych samych cechach, ma zostać dobrany.
{
  const ctxGtv = loadContext();
  const FCGtv = ctxGtv.window.FC;
  const store = typeof FCGtv.catalogStore === 'function' ? FCGtv.catalogStore() : FCGtv.catalogStore;
  const baseAccessories = store.getAccessories()
    .filter((row)=> !(String(row && row.manufacturer || '').toLowerCase() === 'gtv' && String(row && row.hardwareCategory || '').toLowerCase().includes('zawias')));
  baseAccessories.push({
    id:'hw_test_gtv_107_standard_range',
    manufacturer:'GTV',
    symbol:'GTV107_RANGE',
    name:'Zawias GTV 107° standard 90–120 z hamulcem + prowadnik',
    hardwareCategory:'Zawiasy',
    hardwareUnit:'kpl.',
    price:7.77,
    catalogPriceGross:7.77,
    purchasePriceGross:7.77,
    priceSource:'test',
    status:'active',
    technicalParams:{
      nalozenie:{ value:'nakładany' },
      kat_rzeczywisty:{ from:107, to:'' },
      klasa_kata:{ value:'standardowy 90–120°' },
      hamulec:{ value:true },
      sprezyna:{ value:false },
      prowadnik:{ value:'standardowy' }
    }
  });
  store.savePriceList('accessories', baseAccessories);
  FCGtv.roomPreferences.resolveHardwareProducerPreference = function(_room, group, fallback){
    return group === 'hinges' ? 'GTV' : (fallback || '');
  };
  FCGtv.wycenaCoreSource.selectedCabinets = function(){
    return [{ roomId:'kuchnia', roomLabel:'S', cabinet:cab }];
  };
  FCGtv.cabinetHardwareRequirements.getHingeRequirementsWithQty = function(){ return [legacy110Req]; };
  const gtvLines = FCGtv.wycenaCoreLines.collectAccessories(['kuchnia']);
  assert(gtvLines.length === 1, 'GTV 107° w klasie 90–120° powinien dać jedną linię zamiennika');
  assert(gtvLines[0].resolvedHardwareSymbol === 'GTV107_RANGE', 'przy preferencji GTV wymaganie 110° ma dobrać GTV 107° w klasie 90–120°, jeśli nie ma dokładnego 110°');
  assert(!String(gtvLines[0].name || '').includes('170°'), 'zamiennik z klasy 90–120° nie może przeskoczyć na 170° narożny');
}

// Zamiennik z centralnego wymagania: sourceItemIds z opcji katalogowej nie mogą blokować
// GTV 107° w tej samej klasie, gdy wymaganie domyślne 110° ma preferencję producenta GTV.
{
  const ctxGtvCentral = loadContext();
  const FCGtvCentral = ctxGtvCentral.window.FC;
  const store = typeof FCGtvCentral.catalogStore === 'function' ? FCGtvCentral.catalogStore() : FCGtvCentral.catalogStore;
  const baseAccessories = store.getAccessories()
    .filter((row)=> !(String(row && row.manufacturer || '').toLowerCase() === 'gtv' && String(row && row.hardwareCategory || '').toLowerCase().includes('zawias')));
  baseAccessories.push({
    id:'hw_test_gtv_107_standard_source_ids',
    manufacturer:'GTV',
    symbol:'GTV107_SOURCE_IDS',
    name:'Zawias GTV 107° standard 90–120 z hamulcem + prowadnik',
    hardwareCategory:'Zawiasy',
    hardwareUnit:'kpl.',
    price:7.77,
    catalogPriceGross:7.77,
    purchasePriceGross:7.77,
    priceSource:'test',
    status:'active',
    technicalParams:{
      nalozenie:{ value:'nakładany' },
      kat_rzeczywisty:{ from:107, to:'' },
      klasa_kata:{ value:'standardowy 90–120°' },
      hamulec:{ value:true },
      sprezyna:{ value:false },
      prowadnik:{ value:'standardowy' }
    }
  });
  store.savePriceList('accessories', baseAccessories);
  FCGtvCentral.roomPreferences.resolveHardwareProducerPreference = function(_room, group, fallback){
    return group === 'hinges' ? 'GTV' : (fallback || '');
  };
  FCGtvCentral.wycenaCoreSource.selectedCabinets = function(){
    return [{ roomId:'kuchnia', roomLabel:'S', cabinet:cab }];
  };
  const centralLines = FCGtvCentral.wycenaCoreLines.collectAccessories(['kuchnia']);
  assert(centralLines.length === 1, 'centralne domyślne wymaganie 110° powinno dać jedną linię dla dwóch frontów');
  assert(centralLines[0].resolvedHardwareSymbol === 'GTV107_SOURCE_IDS', 'sourceItemIds / bezpośrednie źródła opcji nie mogą zablokować preferowanego GTV 107° w klasie 90–120°');
}

// Okucie z brakującymi parametrami nie może być użyte automatycznie.
{
  const ctxIncomplete = loadContext();
  const FCIncomplete = ctxIncomplete.window.FC;
  const store = typeof FCIncomplete.catalogStore === 'function' ? FCIncomplete.catalogStore() : FCIncomplete.catalogStore;
  const baseAccessories = store.getAccessories()
    .filter((row)=> !(String(row && row.manufacturer || '').toLowerCase() === 'gtv' && String(row && row.hardwareCategory || '').toLowerCase().includes('zawias')));
  baseAccessories.push({
    id:'hw_test_gtv_incomplete_tech',
    manufacturer:'GTV',
    symbol:'GTV_INCOMPLETE',
    name:'Zawias GTV bez kompletu danych technicznych',
    hardwareCategory:'Zawiasy',
    hardwareUnit:'kpl.',
    price:1.11,
    catalogPriceGross:1.11,
    purchasePriceGross:1.11,
    priceSource:'test',
    status:'active',
    technicalParams:{
      nalozenie:{ value:'nakładany' },
      kat_rzeczywisty:{ from:107, to:'' },
      hamulec:{ value:true }
    }
  });
  store.savePriceList('accessories', baseAccessories);
  FCIncomplete.roomPreferences.resolveHardwareProducerPreference = function(_room, group, fallback){
    return group === 'hinges' ? 'GTV' : (fallback || '');
  };
  FCIncomplete.wycenaCoreSource.selectedCabinets = function(){
    return [{ roomId:'kuchnia', roomLabel:'S', cabinet:cab }];
  };
  const status = FCIncomplete.hardwareTechnicalParams.evaluateItemTechnicalStatus(baseAccessories.find((row)=> row.id === 'hw_test_gtv_incomplete_tech'), store.getHardwareTechnicalParams());
  assert(status && status.needsAttention, 'niepełny zawias musi dostać status do uzupełnienia technicznego');
  const lines = FCIncomplete.wycenaCoreLines.collectAccessories(['kuchnia']);
  assert(lines.length === 1, 'niepełny GTV nie powinien rozbić linii ani wejść jako dobrany produkt');
  assert(lines[0].resolvedHardwareSymbol !== 'GTV_INCOMPLETE', 'WYCENA nie może automatycznie użyć zawiasu z brakującymi parametrami technicznymi');
}

// Przywróć centralny helper po teście legacy.
FC.cabinetHardwareRequirements.getHingeRequirementsWithQty = originalGetHingeRequirementsWithQty;

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
