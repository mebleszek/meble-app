#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function fail(message, details){
  console.error('FAIL pricing-modes-calculation-coverage-smoke:', message);
  if(details !== undefined){
    try{ console.error(JSON.stringify(details, null, 2)); }
    catch(_){ console.error(details); }
  }
  process.exit(1);
}
function assert(condition, message, details){ if(!condition) fail(message, details); }
function assertClose(actual, expected, message){
  if(Math.abs(Number(actual) - Number(expected)) > 0.000001) fail(`${message}; oczekiwano ${expected}, jest ${actual}`);
}
function createSandbox(){
  const sandbox = {
    console,
    Date, Math, JSON, String, Number, Array, Object, Set, Map,
    setTimeout, clearTimeout,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.FC = {
    utils:{
      clone:(value)=> JSON.parse(JSON.stringify(value)),
      uid:()=> 'uid_smoke',
    },
    wycenaCoreUtils:{
      slug:(value)=> String(value == null ? '' : value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    },
  };
  vm.createContext(sandbox);
  return sandbox;
}
function run(rel, sandbox){ vm.runInContext(read(rel), sandbox, { filename:rel }); }

const version = '20260616_project_preparation_section_v1';
const index = read('index.html');
const devTests = read('dev_tests.html');
assert(index.includes(`?v=${version}`), 'index.html nie ma aktualnego cache-bustingu dla testów trybów naliczania');
assert(devTests.includes(version), 'dev_tests.html nie ma aktualnego cache-bustingu dla testów trybów naliczania');
assert(read('README.md').includes('site_pricing_modes_auto_tests_v1.zip'), 'README.md nie opisuje paczki testów trybów naliczania');
assert(read('DEV.md').includes('site_pricing_modes_auto_tests_v1.zip'), 'DEV.md nie opisuje paczki testów trybów naliczania');

const formSrc = read('js/app/material/price-modal-item-form.js');
assert(formSrc.includes('syncLaborPricingModeUi'), 'Formularz cennika nie ma synchronizacji pól zależnych od sposobu naliczania');
assert(formSrc.includes("setWrapperVisible('laborStartPrice', isStartPlusUnit)"), 'Kwota startowa nie jest kontrolowana przez tryb startPlusUnit');
assert(formSrc.includes("setWrapperVisible('laborTimeBlockHours', isTime || isAdvanced)"), 'Czas bazowy nie jest kontrolowany przez tryby czasowe');
assert(formSrc.includes("const timeMode = isTime || isTiers || isStartStep || isAdvanced"), 'Formularz nie wyznacza wspólnego trybu czasowego');
assert(formSrc.includes("setWrapperVisible('laborRateType', timeMode)"), 'Profil stawki godzinowej nie jest kontrolowany przez tryby czasowe');
assert(!index.includes('<option value="0.75">'), 'W formularzu nadal występuje wybór 45 min / 0,75 h');
assert(index.includes('<option value="0.08333333333333333">5 min</option>'), 'Formularz nie ma wyboru 5 min');

const sandbox = createSandbox();
run('js/app/pricing/labor-catalog-definitions.js', sandbox);
run('js/app/pricing/labor-catalog.js', sandbox);
run('js/app/quote/quote-calculation-register.js', sandbox);
run('js/app/wycena/wycena-core-offer.js', sandbox);

const labor = sandbox.FC.laborCatalog;
assert(labor && typeof labor.calculateDefinition === 'function', 'Brak centralnego kalkulatora laborCatalog.calculateDefinition');
assert(Array.isArray(labor.PRICING_MODES) && labor.PRICING_MODES.length >= 7, 'Brak pełnej listy sposobów naliczania ceny');
['fixed','perUnit','startPlusUnit','time','timeTiers','timeStartStep','advanced'].forEach((mode)=>{
  assert(labor.PRICING_MODES.some((row)=> row && row.key === mode), `Brakuje trybu naliczania ${mode}`);
});

const hourlyCatalog = labor.ensureDefaultDefinitions([
  { id:'labor_rate_lakiernik', category:'Stawki godzinowe', isHourlyRate:true, rateKey:'lakiernik', rateCode:'lakiernik', rateType:'lakiernik', name:'Lakiernik', price:180, active:true, nonDeletable:true, priceUserEditedAt:'2026-06-12T00:00:00.000Z' },
]);
const hourlyRates = labor.buildHourlyRates(hourlyCatalog);
assertClose(hourlyRates.workshop, 150, 'Stawka warsztatowa ma pochodzić z profili godzinowych');
assertClose(hourlyRates.assembly, 250, 'Stawka montażowa ma pochodzić z profili godzinowych');
assertClose(hourlyRates.specialist, 300, 'Stawka specjalistyczna ma pochodzić z profili godzinowych');
assertClose(hourlyRates.helper, 80, 'Stawka pomocnika ma pochodzić z profili godzinowych');
assertClose(hourlyRates.lakiernik, 180, 'Własna stawka godzinowa z trybika ma być dostępna dla czynności czasowych');

let calc = labor.calculateDefinition({ name:'Projekt', pricingMode:'fixed', price:300 }, { quantity:99, hourlyRates });
assertClose(calc.total, 300, 'Kwota stała nie może mnożyć się przez ilość');
assertClose(calc.fixedPrice, 300, 'Kwota stała ma być zapisana jako fixedPrice');

calc = labor.calculateDefinition({ name:'Kilometrówka', pricingMode:'perUnit', price:5, quantitySource:'transport.distance_km' }, { quantity:36, hourlyRates });
assertClose(calc.total, 180, 'Cena za ilość ma liczyć ilość × cena jednostkowa');
assertClose(calc.billableQty, 36, 'Cena za ilość ma zapisywać ilość płatną bez limitu startowego');

calc = labor.calculateDefinition({ name:'Transport bez limitu', pricingMode:'startPlusUnit', startPrice:50, includedQty:0, price:4, quantitySource:'transport.distance_km' }, { quantity:36, hourlyRates });
assertClose(calc.total, 194, 'Kwota startowa + ilość bez limitu ma liczyć start + km × cena');
assertClose(calc.billableQty, 36, 'Przy braku limitu płatne km mają być równe km do wyceny');

calc = labor.calculateDefinition({ name:'Transport z limitem', pricingMode:'startPlusUnit', startPrice:80, includedQty:10, price:4, quantitySource:'transport.distance_km' }, { quantity:36, hourlyRates });
assertClose(calc.total, 184, 'Kwota startowa + ilość z limitem ma odjąć km w cenie startowej');
assertClose(calc.billableQty, 26, 'Przy limicie 10 km i trasie 36 km płatne ma być 26 km');

calc = labor.calculateDefinition({ name:'Trzy fronty', pricingMode:'time', quantityMode:'linear', timeBlockHours:0.25, rateType:'workshop', quantitySource:'front.count' }, { quantity:3, hourlyRates:{ workshop:120 } });
assertClose(calc.quantityHours, 0.75, '3 × 15 min ma zostać 45 min jako wynik mnożenia');
assertClose(calc.total, 90, '3 × 15 min × 120 PLN/h powinno dawać 90 PLN');

calc = labor.calculateDefinition({ name:'Czynność lakiernika', pricingMode:'time', quantityMode:'linear', timeBlockHours:0.5, rateType:'lakiernik', quantitySource:'front.count' }, { quantity:2, hourlyRates });
assertClose(calc.total, 180, 'Czynność czasowa ma używać własnego profilu stawki godzinowej');
assertClose(calc.hourlyRate, 180, 'Kalkulator ma zapisać użyty profil PLN/h');

calc = labor.calculateDefinition({ name:'Progi półek', pricingMode:'timeTiers', quantityMode:'tiers', quantityTiers:[{ min:1, max:2, hours:0.25 },{ min:3, max:5, hours:0.5 },{ min:6, max:10, hours:1 }], rateType:'workshop', quantitySource:'shelf.count' }, { quantity:4, hourlyRates:{ workshop:150 } });
assertClose(calc.quantityHours, 0.5, 'Progi czasu mają wybrać właściwy próg dla ilości');
assertClose(calc.total, 75, '0.5 h × 150 PLN/h powinno dać 75 PLN');

calc = labor.calculateDefinition({ name:'Start + sztuki', pricingMode:'timeStartStep', quantityMode:'startStep', startHours:0.5, startQty:1, stepEveryQty:1, stepHours:0.25, rateType:'workshop' }, { quantity:4, hourlyRates:{ workshop:150 } });
assertClose(calc.quantityHours, 1.25, 'Czas startowy + kolejne sztuki ma liczyć start + kroki');
assertClose(calc.total, 187.5, '1.25 h × 150 PLN/h powinno dać 187.5 PLN');

calc = labor.calculateDefinition({ name:'Zaawansowane dopłata', pricingMode:'advanced', quantityMode:'linear', timeBlockHours:0.5, rateType:'workshop', volumeTimeMode:'none', volumePricePerM3:50 }, { quantity:2, volumeM3:0.4, hourlyRates:{ workshop:150 } });
assertClose(calc.quantityHours, 1, 'Zaawansowane z czasem bazowym ma liczyć czas ilościowy');
assertClose(calc.volumePrice, 20, 'Dopłata zł za gabaryt ma działać tylko jako pieniądze od m³');
assertClose(calc.total, 170, 'Zaawansowane: 1 h × 150 + 0.4 m³ × 50 = 170');

calc = labor.calculateDefinition({ name:'Zaawansowane gabarytoczas', pricingMode:'advanced', quantityMode:'linear', timeBlockHours:0.25, rateType:'workshop', volumeTimeMode:'perM3', volumeTimePerM3:1, volumePricePerM3:50 }, { quantity:2, volumeM3:0.5, hourlyRates:{ workshop:150 } });
assertClose(calc.quantityHours, 0.5, 'Gabarytoczas h/m³ ma zachować czas ilościowy');
assertClose(calc.volumeHours, 0.5, 'Gabarytoczas h/m³ ma doliczyć godziny od m³');
assertClose(calc.volumePrice, 0, 'Dopłata zł za gabaryt ma być wyłączona, gdy działa gabarytoczas');
assertClose(calc.total, 150, 'Zaawansowane z gabarytoczasem: (0.5 h + 0.5 h) × 150 = 150');

calc = labor.calculateDefinition({ name:'Legacy 45', pricingMode:'time', quantityMode:'linear', timeBlockHours:0.75, rateType:'workshop' }, { quantity:1, hourlyRates:{ workshop:150 } });
assertClose(calc.quantityHours, 1, 'Zapisane w cenniku 45 min ma zostać znormalizowane do 60 min');
assertClose(calc.total, 150, 'Legacy 45 min po normalizacji ma liczyć się jak 60 min');

const catalogForOffer = labor.ensureDefaultDefinitions([
  { id:'transport_distance_km', category:'Transport', name:'Transport do klienta', pricingMode:'startPlusUnit', startPrice:50, includedQty:10, price:4, quantitySource:'transport.distance_km', quantityMode:'linear', active:true, internalOnly:false, priceUserEditedAt:'2026-06-12T00:00:00.000Z' },
  { id:'manual_project', category:'Usługi dodatkowe', name:'Projekt techniczny', pricingMode:'fixed', price:300, active:true, internalOnly:false },
]);
sandbox.FC.catalogSelectors = { getQuoteRates:()=> catalogForOffer };
sandbox.FC.quoteOfferStore = { getCurrentDraft:()=> ({ rateSelections:[] }) };
sandbox.FC.investorTransport = { getCurrentTransportContext:()=> ({ billableKm:36, displayValue:'36 km do wyceny', investor:{ name:'Jan Kowalski' } }) };
const quoteLines = sandbox.FC.wycenaCoreOffer.collectQuoteRateLines();
assert(quoteLines.length === 1, 'Automatyczna WYCENA powinna dodać jedną linię transportu z Inwestora', quoteLines);
const transport = quoteLines[0];
assert(transport.sourceRole === 'transport-distance', 'Linia transportu musi mieć sourceRole transport-distance', transport);
assertClose(transport.total, 154, 'Transport w WYCENIE ma używać kalkulatora start + płatne km');
assertClose(transport.startPrice, 50, 'Linia transportu ma przenieść kwotę startową do audytu');
assertClose(transport.includedQty, 10, 'Linia transportu ma przenieść km w cenie startowej do audytu');
assertClose(transport.billableQty, 26, 'Linia transportu ma przenieść płatne km do audytu');
assert(String(transport.calculation || '').includes('max(0, 36 km - 10 km)'), 'Audyt transportu ma pokazywać limit km w cenie startowej', transport);

const register = sandbox.FC.quoteCalculationRegister.buildRegister({
  quoteRates:[
    transport,
    { name:'Projekt techniczny', category:'Usługi dodatkowe', qty:1, unit:'x', unitPrice:300, total:300, sourceId:'manual_project', pricingMode:'fixed' },
  ],
  labor:[
    { name:'Szafka #1', details:[{ name:'Montaż frontów', category:'Elementy szafki', sourceType:'cabinet', sourceLabel:'Szafka #1', quantity:3, unit:'szt.', total:90, hours:0.75, hourlyRate:120, timeBlockHours:0.25, quantityMode:'linear', rateType:'workshop', quantitySource:'front.count' }] },
  ],
}, {});
assertClose(register.totals.transport, 154, 'Rejestr wyliczeń musi trzymać transport w osobnej grupie');
assertClose(register.totals.quoteRates, 300, 'Usługi dodatkowe nie mogą mieszać się z transportem');
assertClose(register.totals.labor, 90, 'Robocizna szafek musi zostać w osobnej grupie');
assertClose(register.totals.subtotal, 544, 'Subtotal ma sumować robociznę, transport i usługi dodatkowe');
assert(register.lines.some((row)=> row.section === 'transport' && row.calculation.includes('Transport =')), 'Rejestr musi zachować audytową kalkulację transportu');
assert(register.lines.some((row)=> row.section === 'quoteRates' && row.name === 'Projekt techniczny'), 'Ręczne usługi dodatkowe mają trafić do sekcji Usługi dodatkowe');
assert(register.lines.some((row)=> row.section === 'labor' && row.hours === 0.75), 'Wynik 45 min z działania 3×15 min ma zostać w audycie robocizny');

console.log('OK pricing-modes-calculation-coverage smoke');
