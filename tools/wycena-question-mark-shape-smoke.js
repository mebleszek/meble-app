#!/usr/bin/env node
const fs = require('fs');
const wycenaCss = fs.readFileSync('css/wycena.css', 'utf8');
const sharedCss = fs.readFileSync('css/shared-overlays-choice.css', 'utf8');
function assert(cond, msg){ if(!cond){ console.error('FAIL:', msg); process.exit(1); } }
assert(wycenaCss.includes('.quote-selection-grid .label-help .info-trigger{align-self:center;}'), 'WYCENA powinna zostawiać tylko lokalne wyrównanie helpera, bez osobnego plastru rozmiaru');
assert(!/\.quote-selection-grid \.label-help \.info-trigger\{[\s\S]*?width:28px!important[\s\S]*?\}/.test(wycenaCss), 'WYCENA nie może mieć już lokalnej blokady szerokości helpera — kształt ma być globalny');
assert(sharedCss.includes('globalna blokada kształtu helperów'), 'Brak globalnej blokady kształtu helperów ?');
assert(sharedCss.includes('width:var(--fc-info-trigger-size)!important;'), 'Globalny helper musi wymuszać szerokość');
assert(sharedCss.includes('height:var(--fc-info-trigger-size)!important;'), 'Globalny helper musi wymuszać wysokość');
assert(sharedCss.includes('aspect-ratio:1 / 1!important;'), 'Globalny helper musi wymuszać proporcję 1:1');
console.log('wycena-question-mark-shape-smoke OK');
