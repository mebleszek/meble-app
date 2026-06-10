#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(condition, message, details){
  if(!condition){
    console.error('FAIL:', message);
    if(details !== undefined) console.error(details);
    process.exit(1);
  }
}
const modal = read('js/app/wycena/wycena-summary-details-modal.js');
const qcr = read('js/app/quote/quote-calculation-register.js');
const coreLabor = read('js/app/wycena/wycena-core-labor.js');
const snapshotStore = read('js/app/quote/quote-snapshot-store.js');
const css = read('css/wycena.css');

assert(modal.includes('function renderLaborLine'), 'modal ma osobny renderer robocizny');
assert(modal.includes("text(row && row.section) === 'labor'"), 'modal kieruje linie robocizny do czytelnego renderera');
['Dotyczy','Ilość','Czas','Stawka','Warunki','Źródło ilości','Wyliczenie'].forEach((label)=>{
  assert(modal.includes(label), `brak etykiety ${label} w czytelnym audycie robocizny`);
});
assert(modal.includes('quote-detail-line__facts'), 'audyt robocizny używa listy faktów zamiast jednego zdania z kropkami');
assert(modal.includes('cleanLaborNoteFacts'), 'modal czyści techniczne notatki robocizny z głównego widoku');
assert(!/return bits\.join\(' • '\)/.test(coreLabor), 'rozbicie zawiasów nie skleja techniki zawiasów kropkami w opisie robocizny');
assert(/return label \+ ': ' \+ qty \+ ' szt\.'/.test(coreLabor), 'rozbicie zawiasów zostawia ludzką ilość per drzwiczki');
['hourlyRate','hours','baseHours','multiplier','volumeM3','volumePrice','fixedPrice','sourceRole','sourceKind'].forEach((field)=>{
  assert(qcr.includes(field), `quoteCalculationRegister zachowuje pole ${field} dla czytelnego audytu`);
  assert(snapshotStore.includes(field), `quoteSnapshotStore zachowuje pole ${field} w lekkim snapshotcie`);
});
assert(css.includes('.quote-detail-line__fact'), 'CSS ma style dla czytelnych faktów robocizny');
assert(css.includes('white-space:pre-line'), 'CSS pozwala pokazać rozbicia jedno pod drugim');
console.log('OK labor-audit-readable-lines smoke');
