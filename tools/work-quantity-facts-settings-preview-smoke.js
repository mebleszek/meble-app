#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg, details){
  if(!cond){
    console.error('FAIL:', msg);
    if(details !== undefined){ try{ console.error(JSON.stringify(details, null, 2)); }catch(_){ console.error(details); } }
    process.exit(1);
  }
}
const view = read('js/app/ui/data-settings-work-sources-view.js');
const css = read('css/data-settings.css');
const index = read('index.html');
const dev = read('dev_tests.html');
const modal = read('js/app/cabinet/cabinet-modal.js');
const render = read('js/app/ui/cabinets-render.js');
assert(view.includes('Podgląd odczytu z aktualnego projektu'), 'trybik ma podgląd odczytu z aktualnego projektu poza modalem szafki');
assert(view.includes('FC.workQuantityFacts') && view.includes('buildCabinetFactMap'), 'podgląd korzysta z read-only adaptera FC.workQuantityFacts');
assert(view.includes('getProjectData') && (view.includes('root.projectData') || view.includes('FC.project.load')), 'podgląd czyta aktualny projekt bez dotykania modala szafki');
assert(view.includes('podgląd tylko do odczytu') && view.includes('Niczego tu nie zapisujemy'), 'podgląd jasno informuje, że jest read-only');
assert(view.includes('FACT_ORDER') && view.includes('front.count') && view.includes('hinge.count'), 'podgląd pokazuje kluczowe fakty frontów i zawiasów');
assert(!view.includes('localStorage') && !view.includes('sessionStorage'), 'widok podglądu nie sięga bezpośrednio do storage');
assert(css.includes('data-settings-work-facts-preview-card') && css.includes('data-settings-work-fact-row'), 'CSS ma style podglądu faktów w trybiku');
assert(!modal.includes('cmWorkFactsPreview') && !modal.includes('workQuantityFacts'), 'cabinet-modal.js nie został podpięty do podglądu faktów');
assert(!render.includes('workQuantityFacts') && !render.includes('cmWorkFactsPreview'), 'cabinets-render.js nie został podpięty do podglądu faktów');
assert(index.includes('20260616_czynnosci_project_preparation_v1') && dev.includes('20260616_czynnosci_project_preparation_v1'), 'index/dev_tests mają cache-busting etapu podglądu poza modalem');
assert(index.includes('js/app/pricing/work-quantity-facts.js') && index.includes('js/app/ui/data-settings-work-sources-view.js'), 'index ładuje fakty i widok źródeł w ustawieniach');
console.log('OK work-quantity-facts-settings-preview smoke');
console.log(' - podgląd faktów szafki jest w trybiku, poza modalem szafki');
console.log(' - WYWIAD, cabinet-modal.js i cabinets-render.js nie są ruszone');
