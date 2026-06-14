#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg){ if(!cond){ console.error('FAIL labor-readable-modes-accordion-smoke:', msg); process.exit(1); } }
const version = '20260615_project_recalculate_v1';
const index = read('index.html');
const dev = read('dev_tests.html');
const czyn = read('js/tabs/czynnosci.js');
const material = read('js/tabs/material.js');
const laborCore = read('js/app/wycena/wycena-core-labor.js');
const css = read('css/quote-labor-picker.css');
assert(index.includes(version), 'index.html ma aktualny cache-busting');
assert(dev.includes(version), 'dev_tests.html ma aktualny cache-busting');
assert(czyn.includes('function rateDisplay'), 'CZYNNOŚCI mają tłumacz polskich nazw stawek');
assert(czyn.includes('Stawka warsztatowa') && czyn.includes('Stawka montażowa'), 'CZYNNOŚCI mają polskie fallbacki stawek');
assert(czyn.includes('Czas jednostkowy'), 'Tryb liniowy pokazuje czas jednostkowy');
assert(czyn.includes('Wyliczenie czasu'), 'Tryb liniowy pokazuje działanie czasu');
assert(czyn.includes('Pierwsze') && czyn.includes('Kolejne'), 'Tryb start + kolejne sztuki ma ludzki opis');
assert(czyn.includes('Wybrany próg'), 'Tryb progów ma ludzki opis');
assert(!czyn.includes('Czas / pakiet'), 'CZYNNOŚCI nie pokazują mylącego Czas / pakiet');
assert(!czyn.includes('Stawka / automat'), 'CZYNNOŚCI nie pokazują technicznej etykiety Stawka / automat');
assert(laborCore.includes('quantityTiers:Array.isArray(def.quantityTiers)'), 'Szczegóły robocizny przenoszą progi ilościowe do widoku');
assert(laborCore.includes('volumeTimeTiers:Array.isArray(def.volumeTimeTiers)'), 'Szczegóły robocizny przenoszą progi gabarytoczasu do widoku');
assert(material.includes('material-cabinet-accordion wywiad-room-accordion'), 'MATERIAŁ używa wspólnego stylu akordeonu z WYWIADU');
assert(material.includes('wywiad-room-accordion__summary') && material.includes('wywiad-room-accordion__body'), 'MATERIAŁ ma nagłówek i body akordeonu jak WYWIAD');
assert(czyn.includes("czynnosci-cabinet wywiad-room-accordion"), 'CZYNNOŚCI używają wspólnego stylu akordeonu z WYWIADU');
assert(css.includes('wspólny wygląd akordeonów MATERIAŁ/CZYNNOŚCI'), 'CSS zawiera dopasowanie akordeonów');
console.log('OK labor-readable-modes-accordion smoke');
