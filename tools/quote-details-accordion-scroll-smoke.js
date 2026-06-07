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
const token = '20260607_quote_details_rozrys_accordion_sync_v1';

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
  'const QUOTE_DETAIL_ACCORDION_MS = 420;',
  'function openGroupAnimated(group)',
  'function closeGroupInstant(group)',
  'function resetGroupMotion(group)',
  'panel.hidden = !open;',
  "group.classList.add('is-quote-detail-animating')",
  'const targetHeight = Math.max(1, panel.scrollHeight || 1);',
  "panel.style.maxHeight = targetHeight + 'px';",
  'body.scrollTo({ top:directTop, behavior:scrollBehavior });',
  'const viewportTop = bodyRect.top + 10;',
  'const viewportBottom = bodyRect.bottom - 16;',
  'const fitsViewport = groupRect.height <= Math.max(0, viewportBottom - viewportTop);',
  "body.scrollTo({ top:Math.max(0, target), behavior:scrollBehavior })",
  "group.scrollIntoView({ block:'start'",
  'window.requestAnimationFrame(runner);',
  "setGroupOpen(box, !box.classList.contains('is-open'), { closeOthers:true })",
  "current === 'labor' ? 'sourceLabel' : 'subsection'",
  "class:'quote-detail-group rozrys-material-accordion'",
  "class:'quote-detail-group quote-detail-group--warnings rozrys-material-accordion'",
  "class:'quote-detail-group__header quote-detail-group__toggle rozrys-material-accordion__trigger'",
  "class:'quote-detail-group__panel rozrys-material-accordion__body'",
  "class:'quote-detail-group__panel quote-detail-warnings__panel rozrys-material-accordion__body'",
  "panel.hidden = true;",
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
if(!/\.quote-detail-group\.rozrys-material-accordion\{[^}]*border:2px solid rgba\(15,23,42,\.56\)[^}]*border-radius:22px[^}]*box-shadow:2px 3px 0 rgba\(15,23,42,\.16\)[^}]*scroll-margin-top:10px[^}]*scroll-margin-bottom:18px/.test(css)){
  fail('Sekcje akordeonu audytu nie korzystają z ramki/cienia i marginesów scroll wzorca ROZRYS.');
}
if(!/\.quote-detail-group__header\.rozrys-material-accordion__trigger\{[^}]*display:flex[^}]*align-items:flex-start[^}]*justify-content:space-between[^}]*padding:18px 20px 8px/.test(css)){
  fail('Nagłówek akordeonu audytu nie jest oparty o trigger ROZRYS z automatyczną wysokością.');
}
if(/\.quote-detail-group:not\(\.is-open\) \.quote-detail-group__header\{[^}]*min-height/.test(css) || /\.quote-detail-group__header\{[^}]*min-height:7/.test(css)){
  fail('Akordeony audytu nie mogą mieć twardych minimalnych wysokości powodujących przycinanie długich tytułów.');
}
if(!/\.quote-detail-group__title\.rozrys-material-accordion__title-line1\{[^}]*font-size:20px[^}]*line-height:1\.12/.test(css)){
  fail('Tytuły akordeonów nie dziedziczą proporcji linii ze wzorca ROZRYS na desktop/tablet.');
}
if(!/\.quote-detail-group__chevron\.rozrys-material-accordion__chevron\{[^}]*min-width:34px[^}]*font-size:30px[^}]*color:#16a34a/.test(css)){
  fail('Chevron akordeonu audytu nie jest spójny ze wzorcem ROZRYS.');
}
if(!/\.quote-detail-group__panel\.rozrys-material-accordion__body\{[^}]*padding:0 20px 20px[^}]*border-top:1px solid rgba\(15,23,42,\.10\)/.test(css)){
  fail('Panel akordeonu audytu nie korzysta z proporcji body ROZRYS.');
}
if(!/\.quote-detail-group__panel\[hidden\]\{display:none!important;\}/.test(css) || !/\.quote-detail-group\.is-quote-detail-animating > \.quote-detail-group__panel\{overflow:hidden;\}/.test(css)){
  fail('Panel akordeonu nie ma kontraktu hidden + animacja max-height jak wzorce UI.');
}
if(!/\.quote-detail-group--warnings\.rozrys-material-accordion\{[^}]*border-color:#fed7aa/.test(css) || !/\.quote-detail-warnings__panel\.rozrys-material-accordion__body\{[^}]*padding:0 20px 16px/.test(css)){
  fail('Ostrzeżenia nie mają stylu normalnego akordeonu WYCENY/ROZRYS.');
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
if(!/@media \(max-width: 640px\)\{[\s\S]*\.quote-detail-group__header\.rozrys-material-accordion__trigger\{[^}]*padding:16px 16px 8px[^}]*min-height:0/.test(css)){
  fail('Mobile akordeon audytu nie ma automatycznej wysokości i proporcji ze wzorca ROZRYS.');
}
if(!/@media \(max-width: 640px\)\{[\s\S]*\.quote-detail-group__title\.rozrys-material-accordion__title-line1\{[^}]*font-size:16px[^}]*line-height:1\.12/.test(css)){
  fail('Mobile tytuł akordeonu audytu nie ma proporcji ROZRYS mobile.');
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
console.log(' - akordeony szczegółów używają wzorca ROZRYS/UI patterns bez twardych wysokości');
