#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeStorage } = require('./app-dev-smoke-lib/smoke-storage');
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
  const storage = makeStorage();
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
    window:{ FC, localStorage:storage, projectData:{kuchnia:{settings:{legHeight:10}}} },
    FC,
    localStorage:storage,
    console,
    document:{ getElementById(){ return null; } }
  };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  [
    'js/app/shared/storage.js',
    'js/app/catalog/hardware-technical-read-snapshot.js','js/app/catalog/hardware-technical-params.js',
    'js/app/catalog/hardware-catalog.js',
    'js/app/catalog/hardware-support-catalog.js','js/app/catalog/hardware-lift-catalog.js','js/app/catalog/hardware-cargo-catalog.js','js/app/catalog/hardware-catalog-seed-data.js',
    'js/app/catalog/hardware-catalog-seeds.js',
    'js/app/catalog/catalog-store.js',
    'js/app/cabinet/cabinet-hardware-requirement-options.js',
    'js/app/cabinet/cabinet-hardware-requirements.js',
    'js/app/cabinet/cabinet-cutlist.js',
    'js/app/wycena/wycena-core-lines.js',
  ].forEach((file)=> vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename:file }));
  return ctx;
}

if(!process.argv.includes('--cargo-only')){
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

const defaultAccessories = linesApi.collectAccessories(['kuchnia']);
const defaultLines = defaultAccessories.filter(row=>row.hardwareRequirement && row.hardwareRequirement.kind === 'hinge');
const defaultTotal = defaultLines.reduce((sum, row)=> sum + (Number(row.total) || 0), 0);
assert(defaultLines.length === 1, 'domyślne dwa fronty o tym samym wymaganiu powinny dać jedną linię zawiasów');
assert(defaultLines[0].qty === 4, 'jedna linia zawiera po dwa zawiasy obu frontów');
assert(defaultAccessories.some(row=>row.hardwareRequirement && row.hardwareRequirement.kind === 'leg' && row.qty === 4), 'niezależne wymaganie nóg pozostaje widoczne');
const foot=defaultAccessories.find(row=>row.hardwareRequirement?.kind==='leg');
assert(foot.resolvedHardwareItemId==='hw_bivert_axilo_100'&&foot.unitPrice===5.4&&foot.total===21.6,'właściwy komplet AXILO100 ma cenę jednostkową, a nie cenę opakowania100 szt.',foot);
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
    prowadnik:{ value:'standardowy' },
    typ_prowadnika:{ value:'standardowy' },
    forma_prowadnika:{ value:'krzyżowy' }
  },
  qty:4
};
const originalGetHingeRequirementsWithQty = FC.cabinetHardwareRequirements.getHingeRequirementsWithQty;
FC.cabinetHardwareRequirements.getHingeRequirementsWithQty = function(){ return [legacy110Req]; };
const legacyLines = linesApi.collectAccessories(['kuchnia']).filter(row=>row.hardwareRequirement && row.hardwareRequirement.kind === 'hinge');
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
  store.savePriceList('accessories', baseAccessories);
  FCGtv.roomPreferences.resolveHardwareProducerPreference = function(_room, group, fallback){
    return group === 'hinges' ? 'GTV' : (fallback || '');
  };
  FCGtv.wycenaCoreSource.selectedCabinets = function(){
    return [{ roomId:'kuchnia', roomLabel:'S', cabinet:cab }];
  };
  FCGtv.cabinetHardwareRequirements.getHingeRequirementsWithQty = function(){ return [legacy110Req]; };
  const gtvLines = FCGtv.wycenaCoreLines.collectAccessories(['kuchnia']).filter(row=>row.hardwareRequirement && row.hardwareRequirement.kind === 'hinge');
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
  store.savePriceList('accessories', baseAccessories);
  FCGtvCentral.roomPreferences.resolveHardwareProducerPreference = function(_room, group, fallback){
    return group === 'hinges' ? 'GTV' : (fallback || '');
  };
  FCGtvCentral.wycenaCoreSource.selectedCabinets = function(){
    return [{ roomId:'kuchnia', roomLabel:'S', cabinet:cab }];
  };
  const centralLines = FCGtvCentral.wycenaCoreLines.collectAccessories(['kuchnia']).filter(row=>row.hardwareRequirement && row.hardwareRequirement.kind === 'hinge');
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
  const lines = FCIncomplete.wycenaCoreLines.collectAccessories(['kuchnia']).filter(row=>row.hardwareRequirement && row.hardwareRequirement.kind === 'hinge');
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
const overrideLines = linesApi.collectAccessories(['kuchnia']).filter(row=>row.hardwareRequirement && row.hardwareRequirement.kind === 'hinge');
const overrideTotal = overrideLines.reduce((sum, row)=> sum + (Number(row.total) || 0), 0);
const symbols = overrideLines.map((row)=> row.resolvedHardwareSymbol).sort();

assert(overrideLines.length === 2, 'różne wymagania lewej i prawej strony muszą dać dwie linie akcesoriów w WYCENIE');
assert(symbols.includes('79B9550+173L6130'), 'ręczny override równoległy wpuszczany musi trafić do WYCENY jako konkretny komplet z katalogu');
assert(symbols.includes('71B3550+173L6100'), 'niezmieniona prawa strona ma zostać standardowym 110° nakładanym');
assert(Math.abs(defaultTotal - overrideTotal) > 0.01, 'zmiana wymagań zawiasu musi zmienić wynik finansowy WYCENY, jeśli dobrana pozycja ma inną cenę');
assert(overrideLines.some((row)=> row.hardwareRequirement && row.hardwareRequirement.overridden === true), 'linia WYCENY musi przenieść informację o ręcznym nadpisaniu wymagania');

// The same central requirement drives pricing even if the older cutlist says110°.
vm.runInContext(fs.readFileSync(path.join(root,'js/app/cabinet/cabinet-drawer-requirements.js'),'utf8'),ctx);
cab.subType='standardowa';cab.details={insideMode:'szuflady_wew',innerDrawerType:'skrzynkowe',innerDrawerCount:'2',drawerBottomColor:'white'};
const innerLines=linesApi.collectAccessories(['kuchnia']).filter(row=>row.hardwareRequirement?.kind==='hinge');
assert(innerLines.length===1&&innerLines[0].qty===4,'Inner drawers keep the real door-based hinge quantity');
assert(innerLines[0].resolvedHardwareSymbol==='71B7550+173L6100'&&innerLines[0].total>0,'Pricing must use the catalogued zero-protrusion set, never the old110° cutlist or manual override');
// Real starter products, rather than synthetic price rows: one odd hinge
// quantity per door keeps the approved floor/ceil split and exact plates.
const priced=loadContext(),pricedFC=priced.window.FC;
vm.runInContext(fs.readFileSync(path.join(root,'js/app/cabinet/cabinet-drawer-requirements.js'),'utf8'),priced);
pricedFC.wycenaCoreSelection.createQuoteValidationError=(code,title,message)=>Object.assign(Error(message),{code,title});
let pricedCab={id:'priced-tipon',type:'stojąca',subType:'standardowa',width:60,height:130,depth:51,frontCount:1,frontMaterial:'laminat',backMaterial:'HDF',openingSystem:'tip-on',details:{}};
pricedFC.wycenaCoreSource.selectedCabinets=()=>[{roomId:'kuchnia',roomLabel:'S',cabinet:pricedCab}];
for(const [type,spring,plain]of [
 [pricedFC.cabinetHardwareRequirements.HINGE_TYPES.OVERLAY_110,'71T3550+173L6100','70T3550'],
 [pricedFC.cabinetHardwareRequirements.HINGE_TYPES.INSET_110,'71T3750','70T3750'],
 [pricedFC.cabinetHardwareRequirements.HINGE_TYPES.ZERO_155,'71T7550','70T7550']
]){
 pricedCab.details={};const door=pricedFC.cabinetHardwareRequirements.getHingeRequirementsWithQty('kuchnia',pricedCab).find(row=>row.kind==='hinge');pricedFC.cabinetHardwareRequirements.setHingeDoorOverride(pricedCab,door.doorKey,{typeId:type});
 const result=pricedFC.wycenaCoreLines.collectAccessories(['kuchnia']);
 const springLine=result.find(row=>row.resolvedHardwareSymbol===spring),plainLine=result.find(row=>row.resolvedHardwareSymbol===plain);
 assert(springLine?.qty===1&&plainLine?.qty===2,'Three hinges per door:1 spring and2 plain, without damper',result);
 const plateQty=result.filter(row=>row.resolvedHardwareSymbol==='173L6100').reduce((sum,row)=>sum+row.qty,0);
 assert(plateQty===(type===pricedFC.cabinetHardwareRequirements.HINGE_TYPES.OVERLAY_110?2:3),'One separate plate per bare hinge, none added to a complete set',result);
 assert(result.filter(row=>row.hardwareRequirement?.kind==='hinge').every(row=>row.unitPrice>0&&!row.warnings.length),'Every required TIP-ON hinge has a confirmed positive source price',result);
}
pricedCab={id:'priced-hanging',type:'wisząca',subType:'standardowa',width:60,height:72,depth:32,frontCount:2,frontMaterial:'laminat',backMaterial:'HDF',details:{}};
const supported=pricedFC.wycenaCoreLines.collectAccessories(['kuchnia']).filter(row=>['hanger','hanger-cover'].includes(row.hardwareRequirement?.kind));
assert(supported.length===4&&supported.every(row=>row.qty===1&&row.unitPrice>0&&!row.warnings.length),'A hanging cabinet has one left/right mechanism and one matching cover on each side',supported);
assert(Math.round(supported.reduce((sum,row)=>sum+row.total,0)*100)/100===8.28,'CAMAR806 pair plus covers has an actual priced total',supported);
assert(pricedFC.cabinetHardwareRequirements.supportQuantities(pricedCab).hangers===2,'Covers do not double the labor hanger quantity');
pricedCab.details.hangerCount=3;
require('node:assert/strict').throws(()=>pricedFC.wycenaCoreLines.collectAccessories(['kuchnia']),error=>error.code==='opening_hardware_unresolved','Unknown handedness cannot create a partially priced quote');
// A physical lift count is not a count of retail pairs. Exercise the actual
// cutlist->catalog collector, including every required component and prices.
const lifted=loadContext(),liftFC=lifted.window.FC;
vm.runInContext(fs.readFileSync(path.join(root,'js/app/cabinet/cabinet-drawer-requirements.js'),'utf8'),lifted);
liftFC.wycenaCoreSelection.createQuoteValidationError=(code,title,message)=>Object.assign(Error(message),{code,title});
let liftCab={id:'priced-lift',type:'wisząca',subType:'uchylne',width:60,height:50,depth:32,frontCount:1,frontMaterial:'laminat',backMaterial:'HDF',openingSystem:'uchwyt klienta',details:{flapVendor:'blum',flapKind:'HK-XS'}};
let liftInfo={kind:'HK-XS',model:'20K1301',liftQty:2,hkxsHinges:2,status:'ok'};
liftFC.frontHardware.getBlumAventosInfo=()=>liftInfo;
liftFC.wycenaCoreSource.selectedCabinets=()=>[{roomId:'kuchnia',roomLabel:'S',cabinet:liftCab}];
function liftLines(){return liftFC.wycenaCoreLines.collectAccessories(['kuchnia']).filter(row=>row.resolvedHardwareItemId?.startsWith('hw_bivert_lift_'));}
function pricedComponents(expected){
 const raw=liftLines(),bySymbol=new Map();
 assert(raw.every(row=>row.unitPrice>0&&!row.warnings.length),'Every lift component is resolved and priced');
 for(const row of raw){const previous=bySymbol.get(row.resolvedHardwareSymbol);bySymbol.set(row.resolvedHardwareSymbol,previous?{...row,qty:previous.qty+row.qty,total:previous.total+row.total}:{...row});}
 const actual=[...bySymbol.values()];
 assert(actual.length===Object.keys(expected).length,'Complete lift BOM must not lose or add components');
 for(const [symbol,qty]of Object.entries(expected))assert(actual.some(row=>row.resolvedHardwareSymbol===symbol&&row.qty===qty&&row.unitPrice>0&&!row.warnings.length),'Priced lift component '+symbol+' x'+qty+'; actual:'+JSON.stringify(actual.map(row=>({symbol:row.resolvedHardwareSymbol,qty:row.qty,warnings:row.warnings}))));
 return actual;
}
pricedComponents({'20K1301':2,'20K4101':2,'20K5101':2});
liftCab.details.flapKind='HK_top';liftInfo={kind:'HK_top',model:'22K2500',liftQty:2,status:'ok'};
const hk=pricedComponents({'22K2500':1,'20S4200':1,'22K8000 szary':1});
assert(Math.round(hk.reduce((sum,row)=>sum+row.total,0)*100)===25035,'HK top charges one pair and its complete fixing/cover pairs, with the existing20% markup');
liftInfo.liftQty=3;
pricedComponents({'22K2500':2,'20S4200':2,'22K8000 szary':2});
liftCab.details.flapKind='HK-S';liftInfo={kind:'HK-S',model:'20K2A00',liftQty:2,status:'ok'};
pricedComponents({'20K2B00.06 + zaślepki':1,'175H3100':2});
liftCab.details.flapKind='HKI';liftInfo={kind:'HKI',model:'24K2500',liftQty:2,status:'ok'};
require('node:assert/strict').throws(()=>liftLines(),e=>e.code==='opening_hardware_unresolved','Unknown HKi integration must not silently omit its cover');
liftCab.details.flapIntegration='full';
pricedComponents({'24K2500':1,'24K42E1':2});
const hkiSupports=liftFC.wycenaCoreLines.collectAccessories(['kuchnia']).filter(row=>row.resolvedHardwareItemId?.startsWith('hw_schach_camar816_'));
assert(hkiSupports.length===3&&hkiSupports.find(row=>row.resolvedHardwareSymbol==='103343188')?.qty===1&&hkiSupports.find(row=>row.resolvedHardwareSymbol==='103343189')?.qty===1&&hkiSupports.find(row=>row.resolvedHardwareSymbol==='103343193')?.qty===2,'HKi automatically receives exactly the chosen concealed CAMAR816 pair and matching white covers');
assert(Math.round(hkiSupports.reduce((sum,row)=>sum+row.total,0)*100)===2618,'Schachermayer net prices convert to gross once, then use the ordinary20% markup');
const priorSelectors=liftFC.catalogSelectors;liftFC.catalogSelectors={findSheetMaterial:()=>({materialType:'hdf',thicknessMm:10})};
require('node:assert/strict').throws(()=>liftLines(),e=>e.code==='opening_hardware_unresolved','Less than15 mm behind the rear panel cannot fit the concealed bracket');
liftFC.catalogSelectors=priorSelectors;
liftCab.type='moduł';
liftCab.details.flapIntegration='full';pricedComponents({'24K2500':1,'24K42E1':2});
liftCab.details.flapIntegration='partial';pricedComponents({'24K2500':1,'24K42E1':2,'24K8000 szary':1});
liftCab.type='wisząca';
// Use the actual manufacturer selector for families with a separate arm.
for(const file of ['front-hardware-weights','front-hardware-aventos-data','front-hardware-aventos-calc','front-hardware-aventos-selector'])
 vm.runInContext(fs.readFileSync(path.join(root,'js/app/cabinet/'+file+'.js'),'utf8'),lifted);
const actualSelector=liftFC.frontHardwareAventosSelector.getBlumAventosInfo;
liftFC.frontHardware.getBlumAventosInfo=actualSelector;
liftCab.height=72;liftCab.details.flapKind='HF_top';
const hf=pricedComponents({'22F2500':1,'22F3500':1,'22.8000 szary':1,'70T5550.TL':2,'78Z5500T czarny':2,'175H3100':8});
assert(liftFC.cabinetHardwareRequirements.getHingeRequirementsWithQty('kuchnia',liftCab).reduce((n,row)=>n+row.qty,0)===4,'HF upper and centre hinges are counted once in central labor facts');
assert(liftFC.hardwareLiftCatalog.hingeFittingCount('kuchnia',liftCab)===12,'HF has4 physical hinges and8 plates, not4 missing/duplicated hinge sets');
const materialHinges=liftFC.cabinetCutlist.getCabinetCutList(liftCab,'kuchnia').filter(row=>row.hardwareRequirement?.kind==='hinge');
assert(materialHinges.length===2&&materialHinges.every(row=>row.qty===2),'Material shows each upper/centre hinge row once');
liftCab.width=120;
assert(liftFC.hardwareLiftCatalog.hfHinges('kuchnia',liftCab).every(row=>row.qty===3)&&liftFC.hardwareLiftCatalog.hingeFittingCount('kuchnia',liftCab)===17,'At1200 mm HF uses3 upper+3 centre hinges and11 actual plates');
liftCab.width=180;
assert(liftFC.hardwareLiftCatalog.hfHinges('kuchnia',liftCab).every(row=>row.qty===4)&&liftFC.hardwareLiftCatalog.hingeFittingCount('kuchnia',liftCab)===22,'At1800 mm HF uses4 upper+4 centre hinges and14 actual plates');
liftCab.width=60;
const hfStore=typeof liftFC.catalogStore==='function'?liftFC.catalogStore():liftFC.catalogStore,hfCatalog=hfStore.getAccessories();
hfStore.savePriceList('accessories',hfCatalog.map(row=>row.id==='hw_bivert_lift_12528'?{...row,status:'archived'}:row));
require('node:assert/strict').throws(()=>liftLines(),e=>e.code==='opening_hardware_unresolved','A missing manufacturer-required HF plate cannot be replaced by an unverified generic plate or a zero-cost warning');
hfStore.savePriceList('accessories',hfCatalog);
liftCab.openingSystem='tip-on';
require('node:assert/strict').throws(()=>liftLines(),e=>e.code==='opening_hardware_unresolved','HF cannot substitute a door TIP-ON for the unsupported mechanical opening');
liftCab.openingSystem='uchwyt klienta';liftCab.height=60;liftCab.details.flapKind='HS_top';
pricedComponents({'22S2500':1,'22S3500':1,'22.8000 szary':1,'20S4200':1});
liftCab.height=50;liftCab.details.flapKind='HL_top';
const hl=actualSelector(liftCab,'kuchnia');assert(hl.model==='22L2500'&&hl.armModel==='22L3800','HL selects an existing mechanism and a separate arm by height and front weight');
pricedComponents({'22L2500':1,'22L3800':1,'22.8000 szary':1,'20S4200':1,'22Q1076U':1});
liftCab.width=130;
pricedComponents({'22L2500':1,'22L3800':1,'22.8000 szary':1,'20S4200':1,'22Q1076U':2,'22Q080Z':1});
liftCab.width=60;liftCab.height=30;const lowHL=actualSelector(liftCab,'kuchnia');assert(lowHL.model==='22L2200'&&lowHL.armModel==='22L3200','Low HL uses the appropriate arm, not an invented third actuator');
liftCab.height=50;
liftCab.details.flapKind='HK_top';liftInfo={kind:'HK_top',model:'22K2500',liftQty:2,status:'ok'};
liftFC.frontHardware.getBlumAventosInfo=()=>liftInfo;
liftCab.depth=20;
require('node:assert/strict').throws(()=>liftLines(),e=>e.code==='opening_hardware_unresolved','Inside depth excludes the rear HDF groove, not just the external side depth');
liftCab.depth=32;liftInfo.liftQty=4;
require('node:assert/strict').throws(()=>liftLines(),e=>e.code==='opening_hardware_unresolved','Four mechanisms need manufacturer confirmation rather than extrapolating the third-mechanism rule');
liftInfo.liftQty=2;
const liftStore=typeof liftFC.catalogStore==='function'?liftFC.catalogStore():liftFC.catalogStore;
const hardware=liftStore.getAccessories(),beforeHardware=JSON.stringify(hardware);
liftStore.savePriceList('accessories',hardware.map(row=>row.id==='hw_bivert_lift_121426'?{...row,status:'hidden'}:row));
require('node:assert/strict').throws(()=>liftLines(),e=>e.code==='opening_hardware_unresolved','Inactive mechanism cannot be replaced by an unrelated generic lift or a zero price');
assert(JSON.stringify(hardware)===beforeHardware,'Pricing must not mutate catalog input rows');
liftStore.savePriceList('accessories',hardware);
liftCab.details={flapVendor:'hafele',flapKind:'DUO',flapAngle:'90'};liftCab.height=35;liftCab.width=40;liftCab.depth=32;
const duo=()=>liftFC.hardwareLiftCatalog.duoInfo('kuchnia',liftCab);
assert(duo().status==='ok'&&duo().liftQty===1&&duo().model==='373.66.612','DUO selects an actual complete standard SKU from real front weight');
let duoLines=liftFC.wycenaCoreLines.collectAccessories(['kuchnia']).filter(row=>row.resolvedHardwareItemId?.includes('_lift_duo_'));
assert(duoLines.length===1&&duoLines[0].qty===1&&duoLines[0].unitPrice===41.62&&!duoLines[0].warnings.length,'DUO uses the verified gross set price and ordinary markup, including both mountings');
const weightFn=liftFC.frontHardwareAventosCalc.estimateFlapWeightKg;
let kg=3;liftFC.frontHardwareAventosCalc.estimateFlapWeightKg=()=>kg;
liftCab.height=50;liftCab.width=50;
for(const [angle,model]of [[75,'373.66.612'],[90,'373.66.612'],[110,'373.66.632']]){
 kg=2.8;liftCab.details.flapAngle=String(angle);
 assert(duo().model===model&&duo().liftQty===1,'Angle-dependent holding capacity, not the higher braking capacity');
}
kg=4.7;liftCab.height=35.1;liftCab.details.flapAngle='75';
assert(duo().model==='373.66.632'&&duo().liftQty===1,'Non-tabulated height uses the next taller conservative row');
liftCab.width=60;kg=0.5;
assert(duo().liftQty===2&&duo().model==='373.66.612','Manufacturer requires two mechanisms from600mm width despite low mass');
kg=10;liftCab.height=50;liftCab.details.flapAngle='75';
assert(duo().liftQty===2&&duo().model==='373.66.632','Heavy front chooses two forte units, not an under-capacity standard');
duoLines=liftFC.wycenaCoreLines.collectAccessories(['kuchnia']).filter(row=>row.resolvedHardwareItemId?.includes('_lift_duo_'));
assert(duoLines.length===1&&duoLines[0].qty===2&&duoLines[0].total===136.2,'Forte bills two physical complete sets once');
for(const mutate of [()=>{liftCab.depth=14;},()=>{liftCab.depth=32;liftCab.height=71;},()=>{liftCab.height=50;liftCab.details.flapAngle='';},()=>{liftCab.details.flapAngle='90';liftCab.openingSystem='tip-on';}]){
 mutate();require('node:assert/strict').throws(()=>liftFC.wycenaCoreLines.collectAccessories(['kuchnia']),e=>e.code==='opening_hardware_unresolved','Unproven DUO geometry/angle/opening must not yield a partial price');
}
liftFC.frontHardwareAventosCalc.estimateFlapWeightKg=weightFn;
console.log('OK wycena-hinge-requirement-override smoke');
}
{
 const context=loadContext(),fc=context.window.FC;
 vm.runInContext(fs.readFileSync(path.join(root,'js/app/cabinet/cabinet-drawer-requirements.js'),'utf8'),context);
 fc.wycenaCoreSelection.createQuoteValidationError=(code,title,message)=>Object.assign(Error(message),{code,title});
 let cab={id:'priced-cargo',type:'stojąca',subType:'cargo',width:20,height:82,depth:51,frontCount:1,frontMaterial:'laminat',backMaterial:'HDF',openingSystem:'uchwyt klienta',details:{cargoModel:'peka_snello_white',shelves:0}};
 fc.wycenaCoreSource.selectedCabinets=()=>[{roomId:'kuchnia',roomLabel:'S',cabinet:cab}];
 const parts=fc.cabinetCutlist.getCabinetCutList(cab,'kuchnia');
 assert(parts.some(p=>p.hardwareRequirement?.kind==='cargo'),'Cargo must contain a confirmed complete hardware set, not only a front and a generic body');
 const lines=()=>fc.wycenaCoreLines.collectAccessories(['kuchnia']);
 let priced=lines().filter(row=>row.hardwareRequirement?.kind==='cargo');
 assert(priced.length===1&&priced[0].qty===1&&priced[0].resolvedHardwareSymbol==='04.802.B'&&priced[0].unitPrice>0&&!priced[0].warnings.length,'SNELLO selects its20cm complete source SKU and price once');
 assert(!lines().some(row=>row.hardwareRequirement?.kind==='hinge'),'Cargo front has no door hinges');
 const api=fc.hardwareCargoCatalog;
 assert(api.laborFacts('kuchnia',cab).mini_runners===2&&api.laborFacts('kuchnia',cab).mini_catches===2,'Mini uses actual guides and two front mountings');
 cab.width=30;assert(api.select('kuchnia',cab).spec.symbol==='04.803.B','Width change selects the matching30cm set in the chosen family');
 cab.width=15;assert(api.select('kuchnia',cab).spec.symbol==='04.801.B','Existing15cm catalog ID remains the authority, including its private price');
 const store=typeof fc.catalogStore==='function'?fc.catalogStore():fc.catalogStore,all=store.getAccessories();
 store.savePriceList('accessories',all.map(row=>row.id==='hw_seed_peka_snello_150_white'?{...row,pricingMode:'manualPrice',quotePriceGross:0,price:0,priceUserEditedAt:'2026-11-25'}:row));
 priced=lines().filter(row=>row.hardwareRequirement?.kind==='cargo');assert(priced.length===1&&priced[0].total===0,'Explicit private zero remains a real price, not a missing product');
 store.savePriceList('accessories',all);
 fc.wycenaCoreSelection.createQuoteValidationError=(code,title,message)=>Object.assign(Error(message),{code,title});
 for(const mutate of [()=>{cab.depth=47;},()=>{cab.depth=51;cab.height=60;},()=>{cab.height=82;cab.width=25;},()=>{cab.width=20;cab.details.cargoModel='unknown';},()=>{cab.details.cargoModel='peka_snello_white';cab.openingSystem='TIP-ON';}]){
  mutate();require('node:assert/strict').throws(lines,e=>e.code==='opening_hardware_unresolved','Unproven Cargo width/inside height/depth/system/opening cannot yield a partial price');
 }
 cab.openingSystem='uchwyt klienta';cab.type='moduł';cab.width=50;cab.height=200;cab.depth=51;cab.details.cargoModel='nomet_prestige_maxi';
 assert(api.select('kuchnia',cab).spec.symbol==='W-5600-500.G2','High module uses the1910–2110mm complete MAXI set');
 assert(api.laborFacts('kuchnia',cab).tall_set===1&&api.laborFacts('kuchnia',cab).mini_runners===0,'Tall complete labor must not also receive mini-piece operations');
 cab.type='stojąca';cab.height=210;
 assert(api.select('kuchnia',cab).ok,'Approved standing MAXI uses the same verified inside dimensions');
 const tallParts=fc.cabinetCutlist.getCabinetCutList(cab,'kuchnia');
 assert(tallParts.filter(p=>p.name==='Wieniec górny').length===1&&!tallParts.some(p=>p.name.startsWith('Trawers')),'Standing MAXI has one full priced/cut top, not two traverses as well');
 assert(tallParts.find(p=>p.name==='Wieniec górny').a===46.4&&tallParts.find(p=>p.name==='Wieniec górny').b===51,'Full top dimensions come from the ordinary cabinet geometry');
 cab.details.backPosition='internal';cab.backMaterial='18 mm pod kolor korpusu';
 require('node:assert/strict').throws(lines,e=>e.code==='opening_hardware_unresolved','An internal18mm back cannot be ignored when verifying the510mm installation depth');
 console.log('PASS Cargo actual width/height/depth, complete prices/private zero, no hinges, mini/tall facts and incomplete-source refusals');
}
