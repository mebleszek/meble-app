#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg){
  if(!cond){
    console.error('FAIL czynnosci-manual-time-display-smoke:', msg);
    process.exit(1);
  }
}
const version = '20260615_project_recalculate_v1';
const index = read('index.html');
const dev = read('dev_tests.html');
const core = read('js/app/wycena/wycena-core-labor.js');
const czyn = read('js/tabs/czynnosci.js');
const wywiad = read('js/tabs/wywiad.js');

assert(index.includes(version) && dev.includes(version), 'index/dev_tests mają aktualny cache-busting');
assert(core.includes('manualFallbackComponent'), 'ręczne czynności bez dopasowania w cenniku muszą trafić do CZYNNOŚCI jako pozycja bez czasu');
const manualBlock = core.slice(core.indexOf('manual.forEach'), core.indexOf('const total = components.reduce', core.indexOf('manual.forEach')));
assert(manualBlock.includes('manualFallbackComponent') && !manualBlock.includes('if(!def) return;'), 'ręczna czynność nie może znikać tylko dlatego, że nie ma pozycji w cenniku');
assert(core.includes('allowZero:true'), 'ręczne czynności z zerową kwotą/czasem mają być przepuszczane do szczegółów');
assert(core.includes('opts.allowZero'), 'componentFromCalc obsługuje pozycje zerowe tylko jawnie');
assert(czyn.includes("breakdownRow('Czas jednostkowy'"), 'CZYNNOŚCI pokazują czas jednostkowy, a nie czas łączny jako jednostkowy');
assert(czyn.includes("breakdownRow('Wyliczenie czasu'"), 'CZYNNOŚCI pokazują działanie typu ilość × czas jednostkowy = razem');
assert(!czyn.includes('Czas / jednostkę albo pakiet'), 'stara myląca etykieta czasu nie może zostać w CZYNNOŚCIACH');
assert(czyn.includes("breakdownRow('Czas', 'Brak informacji o czasie')") && czyn.includes("text:'Brak informacji o czasie'"), 'brak czasu ma być pokazany jawnie, nie jako ukryta czynność');
assert(wywiad.includes('renderHeaderSummary(cab)') && !wywiad.includes('renderCabinetLaborSummary(cab)'), 'WYWIAD zostawia tylko pomarańczową listę u góry bez dolnego bloku robocizny');
console.log('OK czynnosci-manual-time-display smoke');
