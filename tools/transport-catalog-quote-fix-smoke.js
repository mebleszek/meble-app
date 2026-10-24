#!/usr/bin/env node
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function read(file){ return fs.readFileSync(path.join(process.cwd(), file), 'utf8'); }
function assert(condition, message){ if(!condition){ throw new Error(message); } }

const index = read('index.html');
const defs = read('js/app/pricing/labor-catalog-definitions.js');
const laborCatalogSrc = read('js/app/pricing/labor-catalog.js');
const persistence = read('js/app/material/price-modal-persistence.js');
const itemForm = read('js/app/material/price-modal-item-form.js');
const registerSrc = read('js/app/quote/quote-calculation-register.js');
const quoteSnapshot = read('js/app/quote/quote-snapshot.js');
const preview = read('js/app/wycena/wycena-tab-preview.js');
const details = read('js/app/wycena/wycena-summary-details-modal.js');
const store = read('js/app/quote/quote-snapshot-store.js');

const version = '20260628_drawer_systems_materials_v1';
assert(index.includes(`?v=${version}`), 'index.html ma zły cache-busting dla poprawki transportu');
assert(defs.includes("id:'transport_distance_km'"), 'Brak kanonicznej pozycji transport_distance_km');
assert(laborCatalogSrc.includes('consolidateDefaultDefinitionDuplicates'), 'Brak konsolidacji zdublowanych pozycji startowych');
assert(laborCatalogSrc.includes('isDefaultLaborDefinitionRow'), 'Brak rozpoznawania domyślnych pozycji robocizny/transportu');
assert(persistence.includes('Nie można usunąć pozycji startowej'), 'Usuwanie domyślnej pozycji nadal byłoby mylące');
assert(itemForm.includes('defaultQuoteRate'), 'Przycisk Usuń nie jest ukrywany dla domyślnej pozycji cennika');
assert(registerSrc.includes("transport:'Transport'") && registerSrc.includes('isTransportLine'), 'Rejestr wyliczeń nie rozdziela transportu od robocizny/stawki');
assert(quoteSnapshot.includes('isTransportQuoteLine') && quoteSnapshot.includes('const transport ='), 'Snapshot oferty nie liczy osobnego totalu transportu');
assert(preview.includes("['Transport', totals.transport, 'transport']"), 'Podsumowanie WYCENY nie pokazuje osobnego wiersza Transport');
assert(details.includes("['Transport', totals.transport]"), 'Szczegóły WYCENY nie pokazują transportu w podziale kosztów');
assert(store.includes('transport: roundFingerprintNumber(totals.transport)'), 'Fingerprint snapshotu nie uwzględnia transportu');

const sandbox = { console, window:{}, globalThis:null, setTimeout, clearTimeout };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.FC = { utils:{ clone:(v)=> JSON.parse(JSON.stringify(v)), uid:()=> 'uid_test' }, wycenaCoreUtils:{ slug:(v)=> String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') } };
vm.createContext(sandbox);
vm.runInContext(defs, sandbox, { filename:'labor-catalog-definitions.js' });
vm.runInContext(laborCatalogSrc, sandbox, { filename:'labor-catalog.js' });
const duplicated = [
  { id:'uid_manual_transport', category:'Transport', name:'Transport do klienta', price:5, usage:'project', rateType:'assembly', quantitySource:'transport.distance_km', quantityMode:'linear', active:true, internalOnly:false, starterPrice:false, priceUserEditedAt:'2026-06-11T18:00:00.000Z' },
  { id:'transport_distance_km', category:'Transport', name:'Transport do klienta', price:0, usage:'project', rateType:'assembly', quantitySource:'transport.distance_km', quantityMode:'linear', active:true, internalOnly:false, starterPrice:true }
];
const consolidated = sandbox.FC.laborCatalog.ensureDefaultDefinitions(duplicated).filter((row)=> row.category === 'Transport');
const distanceRows = consolidated.filter((row)=> row.id === 'transport_distance_km');
const travelRows = consolidated.filter((row)=> row.id === 'transport_travel_time');
assert(distanceRows.length === 1, `Transport km powinien zostać skonsolidowany do jednej pozycji, jest: ${distanceRows.length}`);
assert(travelRows.length === 1, 'Domyślna pozycja Czas dojazdu ma istnieć osobno w Transporcie');
assert(Number(distanceRows[0].price) === 0, 'Systemowe zero startowe nie jest przepisywane');
assert(consolidated.some(row=>row.id==='uid_manual_transport' && row.price===5), 'Prywatna stawka zachowuje ID i cenę');
const FC=sandbox.FC;
let rates=consolidated, selections=[];
FC.catalogSelectors={getQuoteRates:()=>rates};
FC.quoteOfferStore={getCurrentDraft:()=>({rateSelections:selections})};
FC.investorTransport={getCurrentTransportContext:()=>({billableKm:12})};
vm.runInContext(read('js/app/wycena/wycena-core-offer.js'),sandbox);
function automatic(){return FC.wycenaCoreOffer.collectQuoteRateLines();}
let actual=automatic();
assert(actual.length===1 && actual[0].unitPrice===5 && actual[0].total===60 && actual[0].sourceId==='uid_manual_transport','Automat: prywatne 5 zł/km × 12 km = 60 zł');
const before=JSON.stringify(rates);
selections=[{rateId:'uid_manual_transport',qty:3,note:'keep'}];
actual=automatic();assert(actual.length===1 && actual[0].sourceId==='uid_manual_transport' && actual[0].total===15,'Ręczne przypisanie zachowuje ilość i nie dubluje automatu');
assert(JSON.stringify(rates)===before,'Wycena nie modyfikuje cennika');
selections=[];
rates=JSON.parse(before);Object.assign(rates.find(row=>row.id==='transport_distance_km'),{price:0,starterPrice:false,priceUserEditedAt:'2026-10-24'});
assert(automatic().length===0,'Jawnie edytowane zero systemowe wygrywa z domyślnym wyborem');
rates=JSON.parse(before);Object.assign(rates.find(row=>row.id==='uid_manual_transport'),{price:0,starterPrice:true});
assert(automatic().length===0,'Prywatne edytowane zero pozostaje poprawne także przy historycznej fladze starterPrice');
rates=JSON.parse(before);rates.push({...rates.find(row=>row.id==='uid_manual_transport'),id:'private-second',price:7});
actual=automatic();assert(actual.length===1 && actual[0].sourceKind==='automatic-blocked' && actual[0].total===0 && actual[0].warnings.some(w=>w.includes('STOP:') && w.includes('private-second')),'Wieloznaczne stawki: audyt STOP, bez arbitralnej ceny');
FC.investorTransport.getCurrentTransportContext=()=>({billableKm:0});
assert(automatic().length===0,'Brak trasy nie uruchamia rozwiązywania ceny');
FC.investorTransport.getCurrentTransportContext=()=>({billableKm:12});
rates=JSON.parse(before);rates.find(row=>row.id==='transport_distance_km').active=false;
assert(automatic().length===0,'Wyłączenie systemowego automatu nie uruchamia go ponownie przez prywatną stawkę');
rates=JSON.parse(before).filter(row=>row.id!=='uid_manual_transport');
assert(automatic().length===0,'Samo zero startowe nie tworzy płatnego transportu');

vm.runInContext(registerSrc, sandbox, { filename:'quote-calculation-register.js' });
const reg = sandbox.FC.quoteCalculationRegister.buildRegister({ quoteRates:[
  { name:'Transport do klienta', category:'Transport', qty:1, unit:'km', unitPrice:5, total:5, sourceRole:'transport-distance', sourceType:'transport', sourceId:'transport_distance_km', quantitySource:'transport.distance_km' },
  { name:'Projekt', category:'Projekt', qty:1, unit:'x', unitPrice:100, total:100 }
] }, {});
assert(reg.totals.transport === 5, 'Transport powinien mieć osobny total 5');
assert(reg.totals.project === 100, 'Pozycja kategorii Projekt powinna trafić do osobnego totalu projektu');
assert(reg.totals.quoteRates === 0, 'Robocizna/stawki nie mogą zawierać transportu ani pozycji projektu');
assert(reg.totals.subtotal === 105 && reg.totals.grand === 105, 'Suma oferty powinna zawierać transport i projekt');
assert(reg.lines.some((row)=> row.section === 'transport'), 'Transport powinien być osobną sekcją rejestru');
assert(reg.lines.some((row)=> row.section === 'project'), 'Projekt powinien być osobną sekcją rejestru');

console.log('Transport catalog quote fix smoke: OK');
