#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function fail(message, details){
  console.error('FAIL pcv-front-color-mode-smoke:', message);
  if(details !== undefined){ try{ console.error(JSON.stringify(details, null, 2)); }catch(_){ console.error(details); } }
  process.exit(1);
}
function assert(cond, msg, details){ if(!cond) fail(msg, details); }
function close(actual, expected, msg){ if(Math.abs(Number(actual)-Number(expected)) > 1e-6) fail(`${msg}; oczekiwano ${expected}, jest ${actual}`); }
function run(rel, sandbox){ vm.runInContext(read(rel), sandbox, { filename:rel }); }
function sandbox(){
  const s = { console, Date, Math, JSON, String, Number, Array, Object, Set, Map, RegExp,
    setTimeout, clearTimeout,
    localStorage:{ getItem(){ return null; }, setItem(){}, removeItem(){} },
    materials:[
      { materialType:'laminat', manufacturer:'Egger', symbol:'W1100', name:'Egger W1100 ST9 Biały Alpejski', price:280, priceUnit:'sheet' },
      { materialType:'obrzeże', manufacturer:'Start', symbol:'PCV-STD', name:'Obrzeże PCV standard', price:3, priceUnit:'mb' },
      { materialType:'obrzeże', manufacturer:'Start', symbol:'PCV-FRONT', name:'PCV pod kolor frontów', price:5, priceUnit:'mb' },
    ],
    projectData:{ kuchnia:{ preferences:{ zones:{ lower:{ bodyColor:'Egger W1100 ST9 Biały Alpejski', frontMaterial:'laminat', frontColor:'Grafit', backMaterial:'HDF 3mm biała', openingSystem:'uchwyt klienta', bodyPcvMode:'front' } } }, cabinets:[] } },
  };
  s.window = s;
  s.globalThis = s;
  s.FC = {
    utils:{ clone:(v)=> JSON.parse(JSON.stringify(v)), uid:()=> 'uid_smoke' },
    project:{ save:(pd)=> pd },
    views:{ refreshSessionButtons(){} },
    materialCommon:{ totalsFromParts(){ return {}; }, mergeTotals(dst, src){ Object.keys(src||{}).forEach((k)=>{ dst[k]=(Number(dst[k])||0)+(Number(src[k])||0); }); return dst; } },
    frontHardware:{},
    wycenaCoreUtils:{
      clone:(v)=> JSON.parse(JSON.stringify(v)),
      slug:(v)=> String(v == null ? '' : v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''),
      normalizeText:(v)=> String(v == null ? '' : v).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' '),
    },
  };
  vm.createContext(s);
  return s;
}

const version = '20260614_diag_file_labor_view_v1';
const index = read('index.html');
assert(index.includes(version), 'index.html nie ma nowego cache-bustingu PCV');
assert(index.includes('id="cmBodyPcvMode"'), 'Modal szafki nie ma pola PCV korpusu');
assert(index.includes('Pod kolor płyty') && index.includes('Pod kolor frontów'), 'Modal szafki nie ma obu opcji PCV');
const launchers = read('js/app/cabinet/cabinet-choice-launchers.js');
assert(launchers.includes("id:'cmBodyPcvMode'"), 'PCV korpusu nie jest podpięte pod launcher aplikacyjny');
const prefsUi = read('js/app/ui/wywiad-room-preferences.js');
assert(prefsUi.includes("label:'PCV korpusu'"), 'Preferencje strefowe nie mają pola PCV korpusu');
const catalog = read('js/app/catalog/catalog-store.js');
assert(catalog.includes("symbol:'PCV-FRONT'") && catalog.includes("name:'PCV pod kolor frontów'"), 'Cennik materiałów nie ma seeda PCV pod kolor frontów');
assert(catalog.includes('!list.some(isFrontColorEdgeRow)'), 'Seed PCV pod kolor frontów nie jest dodawany do istniejących baz z PCV standard');
const materialPlan = read('js/app/wycena/wycena-core-material-plan.js');
assert(materialPlan.includes('pcv_pod_kolor_frontow_zapas_10'), 'WYCENA nie buduje osobnej linii PCV pod kolor frontów');
assert(materialPlan.includes("findEdgePriceItem('front')"), 'WYCENA nie szuka osobnej ceny PCV pod kolor frontów');

const s = sandbox();
run('js/app/material/material-edge-store.js', s);
assert(s.FC.materialEdgeStore.normalizePcvMode('pod kolor frontów') === 'front', 'Normalizacja PCV frontów nie działa');
assert(s.FC.materialEdgeStore.normalizePcvMode('cokolwiek') === 'body', 'Nieznana opcja PCV powinna wracać do standardu');
const edge = s.FC.materialEdgeStore.createEdgeStore({ initialStore:{}, persist:false });
const part = { name:'Bok lewy', qty:2, a:100, b:50, material:'Egger W1100 ST9 Biały Alpejski' };
let split = edge.calcEdgeMetersByPcvModeForParts([part], { id:'cab_body', bodyPcvMode:'body' });
close(split.body, 2, 'PCV pod kolor płyty powinno trafić do koszyka standardowego');
close(split.front, 0, 'PCV pod kolor płyty nie może wpadać do koszyka frontowego');
close(split.total, 2, 'Suma PCV standard powinna wynosić 2 mb');
split = edge.calcEdgeMetersByPcvModeForParts([part], { id:'cab_front', bodyPcvMode:'front' });
close(split.body, 0, 'PCV pod kolor frontów nie może wpadać do standardowego koszyka');
close(split.front, 2, 'PCV pod kolor frontów powinno trafić do koszyka frontowego');
close(split.total, 2, 'Suma PCV front powinna wynosić 2 mb');

run('js/app/room-preferences/room-preferences-model.js', s);
const draft = { type:'stojąca', bodyPcvMode:'body' };
s.FC.roomPreferences.applyZoneDefaultsToDraft('kuchnia', draft, 'lower');
assert(draft.bodyPcvMode === 'front', 'Domyślna opcja PCV ze strefy ma wejść do nowej szafki', draft);
assert(s.FC.roomPreferences.getSummary(s.projectData.kuchnia.preferences).includes('PCV: pod kolor frontów'), 'Podsumowanie preferencji ma pokazać PCV pod fronty');

s.getCabinetCutList = (cab)=> [part];
s.projectData.kuchnia.cabinets = [
  { id:'c1', type:'stojąca', bodyPcvMode:'body' },
  { id:'c2', type:'stojąca', bodyPcvMode:'front' },
];
run('js/app/material/material-tab-data.js', s);
const basis = s.FC.materialTabData.collectEdgeMetersForRooms(['kuchnia'], { persist:false });
close(basis.edgeMetersByMode.body, 2, 'MATERIAŁ ma zsumować standardowe PCV osobno');
close(basis.edgeMetersByMode.front, 2, 'MATERIAŁ ma zsumować PCV pod fronty osobno');
close(basis.edgeMeters, 4, 'MATERIAŁ ma zachować łączną sumę PCV dla kompatybilności');

s.FC.wycenaCoreCatalog = { materialPriceLookup:()=> null };
s.FC.wycenaCoreSource = { getScopedMaterials:()=> [], roomLabel:(r)=> r };
s.FC.wycenaCoreSelection = { decodeMaterialScope:()=> ({ kind:'all', includeFronts:true, includeCorpus:true }) };
run('js/app/wycena/wycena-core-material-plan.js', s);
Promise.resolve(s.FC.wycenaCoreMaterialPlan.collectMaterialLines({ selectedRooms:['kuchnia'], groups:{}, materials:[] }, null)).then((lines)=>{
  const std = lines.find((row)=> row.key === 'pcv_standard_zapas_10');
  const front = lines.find((row)=> row.key === 'pcv_pod_kolor_frontow_zapas_10');
  assert(std, 'WYCENA ma wystawić osobną linię PCV standard');
  assert(front, 'WYCENA ma wystawić osobną linię PCV pod kolor frontów');
  close(std.qty, 2.2, 'PCV standard ma mieć zapas +10%');
  close(front.qty, 2.2, 'PCV pod fronty ma mieć zapas +10%');
  close(std.unitPrice, 3, 'PCV standard ma brać cenę standardową');
  close(front.unitPrice, 5, 'PCV pod fronty ma brać osobną cenę frontową');
  close(std.total, 6.6, 'PCV standard ma liczyć cenę osobno');
  close(front.total, 11, 'PCV pod fronty ma liczyć cenę osobno');
  console.log('OK pcv-front-color-mode smoke');
}).catch((err)=> fail('Błąd asynchroniczny testu WYCENY PCV', err && err.stack || err));
