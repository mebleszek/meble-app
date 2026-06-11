#!/usr/bin/env node
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = process.cwd();
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg){ if(!cond) throw new Error(msg); }
function load(rel, ctx){ vm.runInContext(read(rel), ctx, { filename:rel }); }

const index = read('index.html');
const domainSrc = read('js/app/catalog/catalog-domain.js');
assert(domainSrc.includes('Cennik robocizny i usług'), 'Brak nowej nazwy cennika robocizny i usług.');
assert(index.includes('js/app/settings/hourly-rates-store.js'), 'Brak ładowania store stawek godzinowych.');
assert(index.includes('js/app/ui/data-settings-hourly-rates-view.js'), 'Brak ładowania widoku stawek godzinowych w trybiku.');
assert(!read('js/app/catalog/catalog-domain.js').includes("'Stawki godzinowe','Korpusy'"), 'Kategoria Stawki godzinowe nie powinna być kategorią cennika usług.');
assert(read('js/app/wycena/wycena-tab-preview.js').includes("['Usługi dodatkowe', totals.quoteRates, 'quoteRates']"), 'Podsumowanie WYCENY powinno mówić Usługi dodatkowe.');
assert(read('js/app/material/price-modal-item-form.js').includes('function isHourlyRateMode(){ return false; }'), 'Dodawanie stawki godzinowej nie powinno być już trybem formularza cennika.');

const saved = [];
const ctx = vm.createContext({ window:{}, console });
ctx.window.FC = {
  utils:{ clone:(v)=> JSON.parse(JSON.stringify(v)), uid:()=> 'uid_test' },
  storage:{ getJSON:()=> [], setJSON:()=>{} },
};
load('js/app/pricing/labor-catalog-definitions.js', ctx);
load('js/app/pricing/labor-catalog.js', ctx);
const quoteRows = ctx.window.FC.laborCatalog.DEFAULT_HOURLY_RATES.concat([
  { id:'labor_body_h072', category:'Korpusy', name:'Skręcenie smoke', price:0, rateType:'workshop', quantitySource:'cabinet.count', timeBlockHours:0.5, active:true },
]);
ctx.window.FC.catalogStore = {
  getPriceList(kind){ return kind === 'quoteRates' ? quoteRows.slice() : []; },
  savePriceList(kind, rows){ saved.push({ kind, rows }); return rows; },
};
load('js/app/settings/hourly-rates-store.js', ctx);
const settings = ctx.window.FC.hourlyRatesSettings;
const rates = settings.read();
assert(rates.some((row)=> row.rateCode === 'workshop' && Number(row.price) === 150), 'Trybik musi czytać warsztatową 150 zł/h.');
const next = rates.concat([{ id:'draft_rate', name:'Lakiernik', price:220, rateCode:'painter', rateKey:'painter', rateType:'painter', active:true, isHourlyRate:true }]);
const result = settings.write(next);
assert(result.ok === true, 'Zapis własnej stawki painter powinien przejść.');
assert(saved.length === 1 && saved[0].kind === 'quoteRates', 'Stawki godzinowe powinny zapisać się do katalogu quoteRates jako źródła prawdy WYCENY.');
assert(saved[0].rows.some((row)=> row.rateCode === 'painter' && Number(row.price) === 220 && row.isHourlyRate === true), 'Zapis musi dodać własną stawkę painter.');
assert(saved[0].rows.some((row)=> row.id === 'labor_body_h072'), 'Zapis stawek nie może usunąć reguł robocizny z cennika.');
const bad = settings.write(next.concat([{ name:'Duplikat', price:200, rateCode:'painter', rateKey:'painter', rateType:'painter', active:true }]));
assert(bad.ok === false, 'Duplikat kodu stawki musi być zablokowany.');
console.log('hourly-rates-settings-smoke: OK');
