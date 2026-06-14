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

const wywiad = read('js/tabs/wywiad.js');
const wywiadSummary = read('js/tabs/wywiad-labor-summary.js');
const czynnosci = read('js/tabs/czynnosci.js');
const manualLabor = read('js/app/wycena/wycena-tab-manual-labor.js');
const diag = read('js/app/wycena/wycena-diagnostics.js');

assert(wywiad.includes('renderHeaderSummary(cab)'), 'WYWIAD ma zachować pomarańczową listę czynności w nagłówku szafki');
assert(!wywiad.includes('renderCabinetLaborSummary(cab)'), 'WYWIAD nie może już renderować dolnego bloku Czynności robocizny przy szafce');
assert(wywiadSummary.includes('cabinet-header__labor-line--item'), 'Pomarańczowe linie ręcznych czynności u góry pozostają jedna pod drugą');

assert(czynnosci.includes('padStart(2'), 'CZYNNOŚCI mają formatować czas jako h:mm');
assert(czynnosci.includes("text:'Brak informacji o czasie'"), 'CZYNNOŚCI mają pokazać brak informacji o czasie, gdy cennik nie daje normoczasu');
assert(!/toFixed\(2\)\}\s*h/.test(czynnosci), 'CZYNNOŚCI nie powinny pokazywać czasu technicznie jako 1.50 h');
assert(czynnosci.includes('hideMoney:true'), 'Zakładka CZYNNOŚCI ukrywa złotówki w ręcznych czynnościach');
assert(manualLabor.includes('const hideMoney'), 'Manual labor editor obsługuje tryb ukrycia pieniędzy dla CZYNNOŚCI');

assert(diag.includes("text:'Zapisz raport'"), 'Diagnostyka WYCENY ma przycisk Zapisz raport');
assert(!diag.includes('Kopiuj raport'), 'Diagnostyka WYCENY nie może pokazywać przycisku Kopiuj raport');
assert(diag.includes('new Blob([textValue]'), 'Diagnostyka zapisuje raport jako plik tekstowy');
assert(diag.includes('reportFileName'), 'Diagnostyka tworzy nazwę pliku raportu z buildem i timestampem');

console.log('OK wywiad-czynnosci-report-ui smoke');
