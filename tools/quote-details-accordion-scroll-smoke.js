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
const token = '20260611_hourly_rates_settings_v1';

[
  ['total', "['Suma przed rabatem', totals.subtotal, 'total']"],
  ['grand-total', "['Razem', totals.grand, 'total']"],
  ['materials', "['Materiały', totals.materials, 'materials']"],
  ['accessories', "['Akcesoria', totals.accessories, 'accessories']"],
  ['labor', "['Robocizna szafek', totals.labor, 'labor']"],
  ['quoteRates', "['Usługi dodatkowe', totals.quoteRates, 'quoteRates']"],
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
  "group.classList.add('is-ui-pattern-animating')",
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
  "current === 'labor' ? laborCabinetGroupLabel : 'subsection'",
  "class:'quote-detail-group rozrys-material-accordion'",
  "class:'quote-detail-group quote-detail-group--warnings rozrys-material-accordion'",
  "class:'quote-detail-group__toggle rozrys-material-accordion__trigger'",
  "class:'rozrys-material-accordion__title'",
  "class:'rozrys-material-accordion__title-line1'",
  "class:'rozrys-material-accordion__title-line2'",
  "class:'rozrys-material-accordion__chevron'",
  "class:'quote-detail-group__panel rozrys-material-accordion__body'",
  "class:'quote-detail-group__panel quote-detail-warnings__panel rozrys-material-accordion__body'",
  "'data-ui-pattern-accordion':'true'",
  "'data-ui-pattern-accordion-group':'true'",
  'panel.hidden = true;',
  "`${warnings.length} ${warnings.length === 1 ? 'pozycja' : 'pozycji'} • Sprawdź`",
  "metaParts.push(money(sum));",
  "Przy pierwszym otwarciu zostawiamy body na początku modala.",
].forEach((needle)=> { if(!has(js, needle)) fail(`Modal szczegółów nie zawiera zabezpieczenia/wzorca: ${needle}`); });

if(has(js, "setTimeout(()=> scrollGroupIntoDetailsBody(openGroup, 'auto'), 0)")){
  fail('Totalny audyt nie może już automatycznie przewijać przy pierwszym otwarciu modala.');
}
if(has(js, "setTimeout(()=> scrollGroupIntoDetailsBody(openGroup, 'auto'), 0)")){
  fail('Totalny audyt nie może już automatycznie przewijać przy pierwszym otwarciu modala.');
}
if(has(js, "quote-detail-group__right") || has(js, "quote-detail-group__sum") || has(js, "quote-detail-group__header")){
  fail('Akordeon audytu nie może już mieć bocznego układu kwoty/chevrona ani własnego headera WYCENY — ma być 1:1 jak Accordion ROZRYS + ruch.');
}
if(has(css, '.quote-detail-warnings{') || /quote-detail-warnings\{[^}]*overflow-y:auto/.test(css) || /quote-detail-warnings\{[^}]*max-height/.test(css)){
  fail('Ostrzeżenia nie mogą być osobnym małym okienkiem z własnym scrollem.');
}
if(!/#quoteSummaryDetailsModal \.quote-detail-modal\{[^}]*height:calc\(100dvh - var\(--quote-detail-top-offset\) - var\(--quote-detail-bottom-offset\)\)[^}]*display:grid[^}]*grid-template-rows:auto minmax\(0,1fr\) auto/.test(css)){
  fail('Modal szczegółów nie ma jednolitego układu grid i stałej wysokości viewport na desktop/tablet.');
}
if(!/#quoteSummaryDetailsModal \.quote-detail-modal__body\{[^}]*display:block[^}]*overflow-y:auto[^}]*scroll-padding-top:8px[^}]*scroll-padding-bottom:18px[^}]*padding:14px 16px 28px/.test(css)){
  fail('Body modala szczegółów musi być blokowe jak wzorzec UI, z własnym scrollem i bez flex-shrink dzieci.');
}
if(/#quoteSummaryDetailsModal \.quote-detail-modal__body\{[^}]*display:flex/.test(css) || /#quoteSummaryDetailsModal \.quote-detail-modal__body\{[^}]*flex-direction:column/.test(css)){
  fail('Body modala szczegółów nie może być flex-kolumną, bo flex shrink ścina zwinięte akordeony.');
}
if(!/\.quote-detail-group\.rozrys-material-accordion\{[^}]*margin-top:12px[^}]*flex:0 0 auto[^}]*scroll-margin-top:10px[^}]*scroll-margin-bottom:18px/.test(css)){
  fail('Sekcje audytu muszą mieć naturalną wysokość bez flex-shrink i odstęp jak wzorzec Accordion ROZRYS + ruch.');
}
if(!/\.quote-detail-group\.rozrys-material-accordion:first-child\{margin-top:0;\}/.test(css)){
  fail('Pierwszy akordeon audytu musi startować bez dodatkowego marginesu jak pierwszy element wzorca UI.');
}
if(!/#quoteSummaryDetailsModal \.ui-pattern-accordion-motion \.rozrys-material-accordion__trigger\{align-items:center;padding:16px;\}/.test(css)){
  fail('Nagłówek audytu nie kopiuje ustawienia triggera z Accordion ROZRYS + ruch.');
}
if(!/#quoteSummaryDetailsModal \.ui-pattern-accordion-motion \.rozrys-material-accordion__chevron\{margin-left:auto;flex:0 0 auto;\}/.test(css)){
  fail('Chevron audytu nie kopiuje ustawienia z Accordion ROZRYS + ruch.');
}
if(!/#quoteSummaryDetailsModal \.ui-pattern-accordion-motion \.rozrys-material-accordion__body\{transition:max-height \.42s cubic-bezier\(\.22,\.72,\.18,1\),opacity \.30s ease,transform \.36s ease;will-change:max-height,opacity,transform;\}/.test(css)){
  fail('Animacja body audytu nie kopiuje wzorca Accordion ROZRYS + ruch.');
}
if(!/#quoteSummaryDetailsModal \.ui-pattern-accordion-motion \.rozrys-material-accordion\.is-ui-pattern-animating \.rozrys-material-accordion__body\{overflow:hidden;\}/.test(css)){
  fail('Stan animacji audytu nie używa klasy is-ui-pattern-animating jak wzorzec UI.');
}
if(!/#quoteSummaryDetailsModal \.ui-pattern-accordion-motion \.rozrys-material-accordion__body\[hidden\]\{display:none!important;\}/.test(css)){
  fail('Hidden paneli audytu nie jest zabezpieczony jak we wzorcu UI.');
}
if(!/\.quote-detail-group__panel\.rozrys-material-accordion__body\{padding:0 20px 20px[^}]*border-top:1px solid rgba\(15,23,42,\.10\)/.test(css)){
  fail('Panel audytu nie zachowuje proporcji body wzorca ROZRYS.');
}
if(/\.quote-detail-group__header\.rozrys-material-accordion__trigger/.test(css) || /\.quote-detail-group__chevron\.rozrys-material-accordion__chevron/.test(css) || /\.quote-detail-group__right/.test(css) || /\.quote-detail-group__sum/.test(css)){
  fail('CSS audytu nadal zawiera stare własne reguły nagłówka/chevrona/kwoty zamiast wzorca 1:1.');
}
if(/\.quote-detail-group--warnings\.rozrys-material-accordion\{/.test(css) || /quote-detail-group--warnings[^\n{]*\.quote-detail-group__/.test(css)){
  fail('Zewnętrzny akordeon ostrzeżeń nie może mieć osobnego wyglądu; tylko treść ostrzeżeń zostaje pomarańczowa.');
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
