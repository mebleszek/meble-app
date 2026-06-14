#!/usr/bin/env node
const fs = require('fs');
const css = fs.readFileSync('css/shared-overlays-choice.css', 'utf8');
function assert(cond, msg){
  if(!cond){
    console.error('FAIL:', msg);
    process.exit(1);
  }
}
const marker = 'globalna blokada kształtu helperów';
assert(css.includes(marker), 'Brak globalnej sekcji blokady kształtu helperów ?');
const idx = css.indexOf(marker);
const blockStart = css.indexOf('{', idx);
const blockEnd = css.indexOf('}', blockStart);
const block = css.slice(blockStart, blockEnd + 1).replace(/\s+/g, '');
[
  '--fc-info-trigger-size:28px;',
  'width:var(--fc-info-trigger-size)!important;',
  'height:var(--fc-info-trigger-size)!important;',
  'min-width:var(--fc-info-trigger-size)!important;',
  'min-height:var(--fc-info-trigger-size)!important;',
  'max-width:var(--fc-info-trigger-size)!important;',
  'max-height:var(--fc-info-trigger-size)!important;',
  'aspect-ratio:1/1!important;',
  'flex:00var(--fc-info-trigger-size)!important;',
  'align-self:center!important;',
  'justify-self:end!important;',
  'border-radius:999px!important;',
  'padding:0!important;',
  'overflow:hidden!important;'
].forEach((token)=> assert(block.includes(token), 'Brak globalnego zabezpieczenia: ' + token));
assert(!css.includes('--fc-info-trigger-size:var(--fc-info-trigger-size'), 'Zmienna rozmiaru helpera nie może być samoreferencyjna');
assert(css.includes('#priceItemModal .price-field-help .info-trigger{--fc-info-trigger-size:26px;}'), 'Brak zachowania rozmiaru helpera 26 px w formularzu okucia');
assert(css.includes('.table-list .table-cabcell .info-trigger,') && css.includes('--fc-info-trigger-size:24px;'), 'Brak zachowania małego helpera 24 px w tabelach');
const beforeIdx = css.indexOf('.info-trigger::before,', idx);
assert(beforeIdx > idx, 'Brak globalnej reguły pseudo-elementu ? po sekcji blokady');
const beforeBlock = css.slice(css.indexOf('{', beforeIdx), css.indexOf('}', beforeIdx) + 1).replace(/\s+/g, '');
['content:""!important;','position:absolute!important;','inset:4px!important;','background-repeat:no-repeat!important;','background-position:center!important;','background-size:contain!important;'].forEach((token)=> assert(beforeBlock.includes(token), 'Brak zabezpieczenia pseudo-elementu: ' + token));
console.log('help-qmark-global-shape-smoke OK');
