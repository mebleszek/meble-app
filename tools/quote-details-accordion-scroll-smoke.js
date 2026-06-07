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
const token = '20260607_quote_details_mobile_accordion_fit_v1';

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
  'const directTop = Math.max(0, (group.offsetTop || 0) - 10);',
  'body.scrollTo({ top:directTop, behavior:scrollBehavior });',
  'const viewportTop = bodyRect.top + 10;',
  'const viewportBottom = bodyRect.bottom - 16;',
  'const fitsViewport = groupRect.height <= Math.max(0, viewportBottom - viewportTop);',
  "body.scrollTo({ top:Math.max(0, target), behavior:scrollBehavior })",
  "group.scrollIntoView({ block:'start'",
  'window.requestAnimationFrame(runner);',
  "setGroupOpen(box, !box.classList.contains('is-open'), { closeOthers:true })",
  "current === 'labor' ? 'sourceLabel' : 'subsection'",
  "class:'quote-detail-group quote-detail-group--warnings'",
  "class:'quote-detail-group__panel quote-detail-warnings__panel'",
  "`${warnings.length} ${warnings.length === 1 ? 'pozycja' : 'pozycji'}`",
  "Przy pierwszym otwarciu zostawiamy body na początku modala.",
].forEach((needle)=> { if(!has(js, needle)) fail(`Modal szczegółów nie zawiera zabezpieczenia: ${needle}`); });

if(has(js, "setTimeout(()=> scrollGroupIntoDetailsBody(openGroup, 'auto'), 0)")){
  fail('Totalny audyt nie może już automatycznie przewijać przy pierwszym otwarciu modala.');
}
if(has(css, '.quote-detail-warnings{') || /quote-detail-warnings\{[^}]*overflow-y:auto/.test(css) || /quote-detail-warnings\{[^}]*max-height/.test(css)){
  fail('Ostrzeżenia nie mogą być osobnym małym okienkiem z własnym scrollem.');
}
if(!/#quoteSummaryDetailsModal \.quote-detail-modal\{[^}]*height:calc\(100dvh - var\(--quote-detail-top-offset\) - var\(--quote-detail-bottom-offset\)\)[^}]*display:grid[^}]*grid-template-rows:auto minmax\(0,1fr\) auto/.test(css)){
  fail('Modal szczegółów nie ma jednolitego układu grid i stałej wysokości viewport na desktop/tablet.');
}
if(!/#quoteSummaryDetailsModal \.quote-detail-modal__body\{[^}]*overflow-y:auto[^}]*scroll-padding-top:8px[^}]*scroll-padding-bottom:18px[^}]*padding:14px 16px 28px/.test(css)){
  fail('Body modala szczegółów nie ma własnego scrolla i buforów odsłaniających pełną sekcję.');
}
if(!/\.quote-detail-group\{[^}]*scroll-margin-top:10px[^}]*scroll-margin-bottom:18px/.test(css)){
  fail('Sekcje akordeonu nie mają marginesów scroll dla spójnego odsłaniania.');
}
if(!/\.quote-detail-group__header\{[^}]*display:grid[^}]*grid-template-columns:minmax\(0,1fr\) auto[^}]*min-height:74px/.test(css)){
  fail('Nagłówek akordeonu audytu nie ma bezpiecznego gridu i wysokości dla długich tytułów.');
}
if(!/\.quote-detail-group:not\(\.is-open\) \.quote-detail-group__header\{[^}]*border-bottom:0[^}]*min-height:76px/.test(css)){
  fail('Zwinięte akordeony nie mają osobnej minimalnej wysokości bez przycinania.');
}
if(!/\.quote-detail-group__title\{[^}]*font-size:16px[^}]*line-height:1\.18/.test(css)){
  fail('Tytuły akordeonów nie mają jawnego line-height chroniącego przed ucięciem.');
}
if(!/\.quote-detail-group--warnings\{[^}]*border-color:#fed7aa/.test(css) || !/\.quote-detail-warnings__panel\{[^}]*padding:6px 14px 12px/.test(css)){
  fail('Ostrzeżenia nie mają stylu normalnego akordeonu WYCENY.');
}
if(!/#quoteSummaryDetailsModal\.quote-detail-modal-back\{[^}]*--quote-detail-mobile-top-offset:clamp\(18px, 6dvh, 52px\)/.test(css)){
  fail('Mobile modal szczegółów nie ma powiększonego użytecznego obszaru okna.');
}
if(!/#quoteSummaryDetailsModal \.quote-detail-modal\{[^}]*height:calc\(100dvh - var\(--quote-detail-mobile-top-offset\)[^}]*grid-template-rows:auto minmax\(0,1fr\) auto/.test(css)){
  fail('Mobile modal szczegółów nie ma stałej wysokości viewport i jednolitego układu grid.');
}
if(!/#quoteSummaryDetailsModal \.quote-detail-modal__body\{[^}]*padding:12px 12px 34px[^}]*scroll-padding-top:10px[^}]*scroll-padding-bottom:26px/.test(css)){
  fail('Mobile body modala szczegółów nie ma większego dolnego bufora scroll.');
}
if(!/@media \(max-width: 640px\)\{[\s\S]*\.quote-detail-group:not\(\.is-open\) \.quote-detail-group__header\{[^}]*min-height:80px/.test(css)){
  fail('Mobile zwinięte akordeony nie mają zwiększonej wysokości zabezpieczającej długie tytuły.');
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
console.log(' - modal ma jednolity grid, body scroll i scroll-padding');
console.log(' - ostrzeżenia są zwykłym akordeonem bez zagnieżdżonego małego scrolla');
