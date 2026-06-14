#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');

function assert(cond, msg, details){
  if(!cond){
    console.error('FAIL:', msg);
    if(details !== undefined){
      try{ console.error(JSON.stringify(details, null, 2)); }catch(_){ console.error(details); }
    }
    process.exit(1);
  }
}

const FC = {};
const ctx = { window:{ FC }, FC, console, JSON, String, Number, Array, Object, Set, Map };
ctx.globalThis = ctx.window;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/app/pricing/work-quantity-sources.js'), 'utf8'), ctx, { filename:'js/app/pricing/work-quantity-sources.js' });

const api = ctx.FC.workQuantitySources;
assert(api && typeof api.list === 'function' && typeof api.groupByCategory === 'function', 'workQuantitySources API jest dostępne');
const list = api.list();
const expected = [
  'cabinet.count',
  'cabinet.width_mm',
  'cabinet.height_mm',
  'cabinet.depth_mm',
  'front.count',
  'front.dimensions',
  'front.area_m2',
  'hinge.count',
  'hinge.requirement',
  'shelf.count',
  'drawer.count',
  'appliance.count',
  'appliance.type',
];
expected.forEach((code)=> assert(list.some((row)=> row.code === code), `brakuje źródła ${code}`, list.map((row)=> row.code)));
list.forEach((row)=>{
  assert(row.code && /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(row.code), `źródło ${row.label} ma techniczną nazwę z kropką`, row);
  assert(row.label && row.unit && row.calculation, `źródło ${row.code} ma nazwę przyjazną, jednostkę i opis jak liczone`, row);
});
assert(api.find('front.count').label === 'Liczba frontów', 'front.count ma ludzką nazwę Liczba frontów');
assert(/wysokości szafki/i.test(api.find('cabinet.height_mm').calculation), 'cabinet.height_mm opisuje odczyt z pola wysokości');
assert(/wymagań technicznych zawiasów/i.test(api.find('hinge.count').calculation), 'hinge.count opisuje odczyt z wymagań zawiasów');
const groups = api.groupByCategory();
['Korpus i wymiary','Fronty i zawiasy','Wnętrze szafki','Montaż AGD'].forEach((name)=> assert(Array.isArray(groups[name]) && groups[name].length > 0, `grupa ${name} ma wpisy`, groups));

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dev = fs.readFileSync(path.join(root, 'dev_tests.html'), 'utf8');
const menu = fs.readFileSync(path.join(root, 'js/app/ui/data-settings-menu-view.js'), 'utf8');
const modal = fs.readFileSync(path.join(root, 'js/app/ui/data-settings-modal.js'), 'utf8');
const view = fs.readFileSync(path.join(root, 'js/app/ui/data-settings-work-sources-view.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/data-settings.css'), 'utf8');
const loadConfig = fs.readFileSync(path.join(root, 'tools/index-load-groups.js'), 'utf8');
const smokeList = fs.readFileSync(path.join(root, 'tools/app-dev-smoke-lib/file-list.js'), 'utf8');
[index, dev, loadConfig, smokeList].forEach((src, idx)=> assert(src.includes('js/app/pricing/work-quantity-sources.js'), `plik ładowania ${idx} zawiera work-quantity-sources.js`));
[index, dev, loadConfig, smokeList].forEach((src, idx)=> assert(src.includes('js/app/ui/data-settings-work-sources-view.js'), `plik ładowania ${idx} zawiera data-settings-work-sources-view.js`));
assert(menu.includes('Dane do czynności i wyceny') && menu.includes("setView('workSources')"), 'trybik ma kafelek Dane do czynności i wyceny');
assert(modal.includes("next === 'workSources'") && modal.includes('dataSettingsWorkSourcesView'), 'modal ustawień obsługuje widok źródeł danych');
assert(view.includes('Nazwa techniczna') || view.includes('data-work-source-code'), 'widok pokazuje techniczną nazwę źródła');
assert(view.includes('Tu ustalamy wspólny język programu') && view.includes('nie zapisuje kopii danych w szafkach'), 'widok jasno mówi, że to podgląd bez drugiego zapisu danych');
assert(css.includes('data-settings-work-source__calc') && css.includes('data-settings-work-source__badge--planned'), 'CSS ma style listy źródeł i statusów');
assert(index.includes('20260614_cabinet_derived_facts_v1') && dev.includes('20260614_cabinet_derived_facts_v1'), 'index/dev_tests mają aktualny cache-busting etapu');

console.log('OK work-quantity-sources-settings smoke');
console.log(' - źródła danych do czynności mają techniczne kody, ludzkie nazwy, jednostki i opisy liczenia');
console.log(' - trybik ustawień ma nową opcję Dane do czynności i wyceny');
console.log(' - etap jest podglądem słownika, bez zapisywania kopii danych w szafkach');
