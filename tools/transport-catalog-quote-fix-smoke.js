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

const version = '20260615_project_recalculate_v1';
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
assert(distanceRows[0].id === 'transport_distance_km', 'Cena użytkownika musi przejść na kanoniczny transport_distance_km');
assert(Number(distanceRows[0].price) === 5, 'Cena transportu po konsolidacji powinna zostać 5 PLN/km');
assert(distanceRows[0].starterPrice === false, 'Po edycji transport km nie może zostać oznaczony jako Cena startowa');

vm.runInContext(registerSrc, sandbox, { filename:'quote-calculation-register.js' });
const reg = sandbox.FC.quoteCalculationRegister.buildRegister({ quoteRates:[
  { name:'Transport do klienta', category:'Transport', qty:1, unit:'km', unitPrice:5, total:5, sourceRole:'transport-distance', sourceType:'transport', sourceId:'transport_distance_km', quantitySource:'transport.distance_km' },
  { name:'Projekt', category:'Projekt', qty:1, unit:'x', unitPrice:100, total:100 }
] }, {});
assert(reg.totals.transport === 5, 'Transport powinien mieć osobny total 5');
assert(reg.totals.quoteRates === 100, 'Robocizna/stawki nie mogą zawierać transportu');
assert(reg.totals.subtotal === 105 && reg.totals.grand === 105, 'Suma oferty powinna zawierać transport');
assert(reg.lines.some((row)=> row.section === 'transport'), 'Transport powinien być osobną sekcją rejestru');

console.log('Transport catalog quote fix smoke: OK');
