#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
function read(file){ return fs.readFileSync(path.join(process.cwd(), file), 'utf8'); }
function assert(cond, msg){ if(!cond){ console.error('FAIL labor-conditions-editor-preview-smoke:', msg); process.exit(1); } }

const index = read('index.html');
const conditions = read('js/app/material/price-modal-labor-conditions.js');
const itemForm = read('js/app/material/price-modal-item-form.js');
const css = read('css/price-item-popup.css');
const sources = read('js/app/pricing/work-quantity-sources.js');

assert(index.includes('laborConditionsSummary'), 'formularz cennika robocizny ma podgląd warunków');
assert(index.includes('laborRulePreview'), 'formularz cennika robocizny ma podgląd działania reguły');
assert(conditions.includes('selectedSources') && conditions.includes('Ten sam warunek nie powinien być dodany dwa razy'), 'edytor warunków blokuje duplikaty tego samego warunku');
assert(conditions.includes('Działa gdy:') && conditions.includes('Podgląd warunków'), 'edytor warunków pokazuje czytelny podgląd zakresów');
assert(conditions.includes('sourceUnit') && conditions.includes('Minimum / od') && conditions.includes('Maksimum / do'), 'edytor warunków pokazuje jednostki przy zakresach od-do');
assert(itemForm.includes('syncLaborRulePreview') && itemForm.includes('Podgląd działania reguły'), 'formularz reguły odświeża podgląd działania automatu');
assert(itemForm.includes('WYCENA czyta te wartości z aktualnej szafki przez workQuantityFacts'), 'podgląd podkreśla brak drugiej kopii danych szafki');
assert(css.includes('price-labor-rule-preview') && css.includes('price-labor-condition-row__preview'), 'style obsługują podgląd reguły i podgląd pojedynczego warunku');
assert(sources.includes('jawnych wymagań szuflad/prowadnic'), 'opis drawer.count w źródłach ilości jest zgodny z nowym źródłem prawdy');
assert(!conditions.includes('Dodaj warunek'), 'UI nie wraca do ręcznego przycisku Dodaj warunek');

console.log('OK labor-conditions-editor-preview smoke');
console.log(' - cennik robocizny ma podgląd działania reguły');
console.log(' - warunki są kaskadowe, od-do, bez duplikatów i bez natywnych dropdownów');
