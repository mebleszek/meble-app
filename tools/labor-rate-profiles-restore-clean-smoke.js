#!/usr/bin/env node
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = process.cwd();
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg){ if(!cond){ throw new Error(msg); } }
function load(rel, ctx){ vm.runInContext(read(rel), ctx, { filename: rel }); }

const index = read('index.html');
const itemForm = read('js/app/material/price-modal-item-form.js');
const catalog = read('js/app/pricing/labor-catalog.js');

assert(index.includes('laborIsHourlyRate'), 'Brak checkboxa trybu stawki godzinowej.');
assert(index.includes('laborRateCode'), 'Brak pola kodu technicznego stawki godzinowej.');
assert(index.includes('Kwota stawki godzinowej') || itemForm.includes('Kwota stawki godzinowej'), 'Brak uproszczonej etykiety kwoty stawki.');
assert(!index.includes('laborAutomatCreateBtn'), 'Nie wolno przywracać UI tworzenia automatów w tym etapie.');
assert(!index.includes('cmWorkFactsPreview'), 'Nie wolno podłączać podglądu źródeł do modala szafki w tym etapie.');
assert(!index.includes('cabinet-work-facts-preview.js'), 'Nie wolno ładować panelu podglądu szafki w tym etapie.');
assert(index.includes('20260609_labor_quantity_source_selector_v1'), 'Brak aktualnego cache-bustingu w index.html.');
assert(read('dev_tests.html').includes('20260609_labor_quantity_source_selector_v1'), 'Brak aktualnego cache-bustingu w dev_tests.html.');

assert(catalog.includes('dedupeHourlyRateDefinitions'), 'Brak deduplikacji stawek godzinowych.');
assert(catalog.includes('validateRateProfile'), 'Brak walidacji profilu stawki godzinowej.');
assert(catalog.includes('buildRateProfiles'), 'Brak budowania profili stawek godzinowych.');

const ctx = vm.createContext({
  window: {},
  console,
});
ctx.window.FC = { utils:{ clone:(v)=> JSON.parse(JSON.stringify(v)), uid:()=> 'uid_test' } };
load('js/app/pricing/labor-catalog-definitions.js', ctx);
load('js/app/pricing/labor-catalog.js', ctx);
const labor = ctx.window.FC.laborCatalog;
assert(labor, 'FC.laborCatalog nie został zarejestrowany.');

const rates = labor.buildHourlyRates([]);
assert(rates.workshop === 150, 'Warsztatowa powinna mieć 150 zł/h.');
assert(rates.assembly === 250, 'Montażowa powinna mieć 250 zł/h.');
assert(rates.specialist === 300, 'Specjalistyczna powinna mieć 300 zł/h.');
assert(rates.helper === 80, 'Pomocnika powinna mieć 80 zł/h.');

const rows = labor.ensureDefaultDefinitions([
  { id:'legacy_assembly_wrong', category:'Stawki godzinowe', name:'Stawka montażowa', price:150, autoRole:'hourlyRate', rateKey:'assembly', starterPrice:true },
  { id:'legacy_specialist_wrong', category:'Stawki godzinowe', name:'Stawka specjalistyczna', price:250, autoRole:'hourlyRate', rateKey:'specialist', starterPrice:true },
]);
const profiles = labor.buildRateProfiles(rows);
const byCode = Object.fromEntries(profiles.map((row)=> [row.code, row]));
assert(byCode.assembly.price === 250, 'Deduplikacja musi zostawić montażową 250 zł/h.');
assert(byCode.specialist.price === 300, 'Deduplikacja musi zostawić specjalistyczną 300 zł/h.');
assert(byCode.workshop.nonDeletable === true, 'Stawka systemowa musi być nieusuwalna.');

const valid = labor.validateRateProfile({ code:'painter', label:'Lakiernik', price:220 }, rows);
assert(valid.ok === true, 'Nowa stawka painter powinna przejść walidację.');
const badFormat = labor.validateRateProfile({ code:'lakiernik ą', label:'Lakiernik', price:220 }, rows);
assert(badFormat.ok === false && badFormat.code === 'format', 'Kod ze spacją/polskim znakiem powinien zostać odrzucony.');
const immutable = labor.validateRateProfile({ code:'paint_master', label:'Lakiernik', price:220 }, rows, { oldCode:'painter' });
assert(immutable.ok === false && immutable.code === 'immutable', 'Zmiana kodu istniejącej stawki powinna być blokowana.');

const withPainter = rows.concat([{ id:'labor_rate_painter', category:'Stawki godzinowe', name:'Lakiernik', price:220, autoRole:'hourlyRate', rateKey:'painter', rateCode:'painter', rateType:'painter', active:true, nonDeletable:true }]);
const options = labor.rateProfileOptions(withPainter, 'painter');
assert(options.some((row)=> row.value === 'painter' && /Lakiernik/.test(row.label)), 'Nowa stawka painter powinna być dostępna w wyborze stawki godzinowej.');
const hourly = labor.buildHourlyRates(withPainter);
assert(hourly.painter === 220, 'WYCENA musi móc pobrać kwotę po dokładnym kodzie painter.');

console.log('labor-rate-profiles-restore-clean-smoke: OK');
