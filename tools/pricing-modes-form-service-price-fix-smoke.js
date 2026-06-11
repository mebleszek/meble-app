#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
function read(file){ return fs.readFileSync(path.join(process.cwd(), file), 'utf8'); }
function assert(condition, message){ if(!condition) throw new Error(message); }
const src = read('js/app/material/price-modal-item-form.js');
assert(src.includes('function formServicePriceWrapper()'), 'Brak helpera formServicePriceWrapper dla pola ceny usługi');
assert(src.includes("ctx.byId('formServicePrice')"), 'Helper ceny usługi nie wskazuje na formServicePrice');
const defIdx = src.indexOf('function formServicePriceWrapper()');
const useIdx = src.indexOf('formServicePriceWrapper()');
assert(defIdx >= 0 && useIdx >= 0 && defIdx <= useIdx, 'formServicePriceWrapper musi być zdefiniowany przed użyciem');
assert(src.includes("setServicePriceLabel('Cena za jednostkę po starcie (PLN)')"), 'Tryb start + ilość nie ustawia etykiety ceny jednostkowej');
console.log('pricing-modes-form-service-price-fix-smoke: OK');
