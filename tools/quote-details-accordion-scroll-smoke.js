#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const root = process.cwd();
function read(file){ return fs.readFileSync(path.join(root, file), 'utf8'); }
function fail(msg){ failures.push(msg); }
function has(src, needle){ return src.includes(needle); }
const failures = [];
const js = read('js/app/wycena/wycena-summary-details-modal.js');
const css = read('css/wycena.css');
const preview = read('js/app/wycena/wycena-tab-preview.js');
const index = read('index.html');
const devTests = read('dev_tests.html');
const token = '20260606_quote_details_accordion_scroll_fix_v1';

[
  ['total', "['Suma przed rabatem', totals.subtotal, 'total']"],
  ['grand-total', "['Razem', totals.grand, 'total']"],
  ['materials', "['Materiały', totals.materials, 'materials']"],
  ['accessories', "['Akcesoria', totals.accessories, 'accessories']"],
  ['labor', "['Robocizna szafek', totals.labor, 'labor']"],
  ['quoteRates', "['Robocizna / stawki wyceny', totals.quoteRates, 'quoteRates']"],
  ['services', "['Montaż AGD', totals.services, 'services']"],
  ['discount', "['Rabat', totals.discount, 'discount']"],
].forEach(([name, needle])=> { if(!has(preview, needle)) fail(`Brak wejścia szczegółów WYCENY: ${name}`); });

[
  'function getDetailsBody(group)',
  'function scrollGroupIntoDetailsBody(group, behavior)',
  "body.scrollTo({ top:target, behavior:behavior || 'smooth' })",
  "group.scrollIntoView({ block:'start'",
  "setTimeout(()=> scrollGroupIntoDetailsBody(openGroup, 'auto'), 0)",
  "setGroupOpen(box, !box.classList.contains('is-open'), { closeOthers:true })",
  "current === 'labor' ? 'sourceLabel' : 'subsection'",
].forEach((needle)=> { if(!has(js, needle)) fail(`Modal szczegółów nie zawiera zabezpieczenia: ${needle}`); });

if(!/#quoteSummaryDetailsModal \.quote-detail-modal\{[^}]*height:calc\(100dvh - var\(--quote-detail-top-offset\) - var\(--quote-detail-bottom-offset\)\)/.test(css)){
  fail('Modal szczegółów nie ma stałej wysokości opartej o viewport na desktop/tablet.');
}
if(!/#quoteSummaryDetailsModal \.quote-detail-modal__body\{[^}]*overflow-y:auto/.test(css)){
  fail('Body modala szczegółów nie ma własnego przewijania.');
}
if(!/#quoteSummaryDetailsModal \.quote-detail-warnings\{[^}]*max-height:min\(34dvh, 360px\)[^}]*overflow-y:auto/.test(css)){
  fail('Ostrzeżenia w modalu szczegółów nie mają ograniczonej wysokości i własnego scrolla na mobile.');
}
if(!/#quoteSummaryDetailsModal \.quote-detail-modal\{[^}]*height:calc\(100dvh - clamp\(40px, 10dvh, 96px\)/.test(css)){
  fail('Mobile modal szczegółów nie ma stałej wysokości opartej o viewport.');
}

[
  ['index wycena.css', index, `css/wycena.css?v=${token}`],
  ['index modal js', index, `js/app/wycena/wycena-summary-details-modal.js?v=${token}`],
  ['dev_tests modal js', devTests, `js/app/wycena/wycena-summary-details-modal.js?v=${token}`],
].forEach(([label, src, needle])=> { if(!has(src, needle)) fail(`Cache-busting nieaktualny: ${label}`); });

if(failures.length){
  console.error('Quote details accordion scroll smoke FAILED');
  failures.forEach((msg)=> console.error(' - ' + msg));
  process.exit(1);
}
console.log('Quote details accordion scroll smoke OK');
console.log(' - wejścia szczegółów: total/materials/accessories/labor/quoteRates/services/discount');
console.log(' - modal ma stałą wysokość viewport, body scroll i przewijanie do otwartego akordeonu');
console.log(' - ostrzeżenia na mobile mają ograniczoną wysokość i własny scroll');
