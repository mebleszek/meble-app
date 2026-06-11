#!/usr/bin/env node
const fs = require('fs');
const vm = require('vm');
const path = require('path');
function read(file){ return fs.readFileSync(path.join(process.cwd(), file), 'utf8'); }
function assert(condition, message){ if(!condition) throw new Error(message); }
const index = read('index.html');
const defs = read('js/app/pricing/labor-catalog-definitions.js');
const laborCatalogSrc = read('js/app/pricing/labor-catalog.js');
const itemForm = read('js/app/material/price-modal-item-form.js');
const offer = read('js/app/wycena/wycena-core-offer.js');
const details = read('js/app/wycena/wycena-summary-details-modal.js');

assert(index.includes('id="laborPricingMode"'), 'Formularz cennika nie ma pola Sposób naliczania ceny');
assert(index.includes('id="laborStartPrice"'), 'Formularz cennika nie ma pola Kwota startowa');
assert(index.includes('id="laborIncludedQty"'), 'Formularz cennika nie ma pola Ilość w cenie startowej');
assert(defs.includes('PRICING_MODES'), 'Brak centralnej listy sposobów naliczania ceny');
assert(defs.includes("pricingMode:'startPlusUnit'"), 'Transport startowy nie ma trybu kwota startowa + ilość');
assert(itemForm.includes('syncLaborPricingModeUi'), 'Formularz nie ukrywa pól zależnie od sposobu naliczania');
assert(itemForm.includes("setWrapperVisible('laborStartPrice', isStartPlusUnit)"), 'Kwota startowa nie jest widoczna tylko dla właściwego trybu');
assert(offer.includes('calc.startPrice') && offer.includes('billableQty'), 'Transport w WYCENIE nie korzysta z kalkulatora kwoty startowej');
assert(details.includes('Kwota startowa'), 'Audyt WYCENY nie pokazuje kwoty startowej');

const sandbox = { console, window:{}, globalThis:null, setTimeout, clearTimeout };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.FC = { utils:{ clone:(v)=> JSON.parse(JSON.stringify(v)), uid:()=> 'uid_test' } };
vm.createContext(sandbox);
vm.runInContext(defs, sandbox, { filename:'labor-catalog-definitions.js' });
vm.runInContext(laborCatalogSrc, sandbox, { filename:'labor-catalog.js' });
const labor = sandbox.FC.laborCatalog;

let calc = labor.calculateDefinition({ id:'transport_distance_km', category:'Transport', name:'Transport do klienta', pricingMode:'startPlusUnit', price:4, startPrice:50, includedQty:10, quantitySource:'transport.distance_km' }, { quantity:36 });
assert(calc.total === 154, `Transport powinien liczyć 50 + (36-10)*4 = 154, jest ${calc.total}`);
assert(calc.billableQty === 26, 'Transport powinien zapisać ilość płatną po odjęciu limitu startowego');

calc = labor.calculateDefinition({ name:'Dodatkowy wyjazd', pricingMode:'perUnit', price:25, quantitySource:'transport.distance_km' }, { quantity:3 });
assert(calc.total === 75, 'Cena za ilość powinna liczyć ilość × cena jednostkowa');

calc = labor.calculateDefinition({ name:'Pomiar', pricingMode:'fixed', price:150 }, { quantity:7 });
assert(calc.total === 150, 'Kwota stała w silniku reguł ma być jedną kwotą, nie ilość × cena');

calc = labor.calculateDefinition({ name:'Montaż', pricingMode:'time', rateType:'assembly', timeBlockHours:0.5, quantityMode:'linear' }, { quantity:2, hourlyRates:{ assembly:250 } });
assert(calc.total === 250, 'Czas × stawka godzinowa powinien liczyć 2 × 0.5 h × 250');

calc = labor.calculateDefinition({ name:'Start szuflad', pricingMode:'timeStartStep', rateType:'workshop', startHours:0.5, startQty:1, stepEveryQty:1, stepHours:0.25, quantityMode:'startStep' }, { quantity:4, hourlyRates:{ workshop:150 } });
assert(calc.total === 187.5, 'Czas startowy + kolejne sztuki powinien liczyć start + kroki × stawka');

console.log('pricing-modes-smoke: OK');
