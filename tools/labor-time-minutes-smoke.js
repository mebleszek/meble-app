#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg, details){
  if(!cond){
    console.error('FAIL labor-time-minutes-smoke:', msg);
    if(details !== undefined){ try{ console.error(JSON.stringify(details, null, 2)); }catch(_){ console.error(details); } }
    process.exit(1);
  }
}
const version = '20260628_drawer_systems_materials_v1';
const index = read('index.html');
const defs = read('js/app/pricing/labor-catalog-definitions.js');
const catalogSrc = read('js/app/pricing/labor-catalog.js');
const formSrc = read('js/app/material/price-modal-item-form.js');
assert(index.includes(version), 'index.html nie ma aktualnego cache-bustingu', version);
assert(read('dev_tests.html').includes(version), 'dev_tests.html nie ma aktualnego cache-bustingu', version);
assert(index.includes('<option value="0.08333333333333333">5 min</option>'), 'Czas bazowy nie ma opcji 5 min');
assert(index.includes('<option value="0.25">15 min</option>'), 'Czas bazowy nie pokazuje 15 min');
assert(index.includes('<option value="0.5">30 min</option>'), 'Czas bazowy nie pokazuje 30 min');
assert(index.includes('<option value="1">60 min</option>'), 'Czas bazowy nie pokazuje 60 min');
assert(!index.includes('<option value="0.75">0,75 h</option>'), 'Formularz nadal pokazuje opcję 45 min / 0,75 h');
assert(index.includes('id="laborStartHours"') && index.includes('id="laborStepHours"'), 'Brak pól czasu startowego lub czasu za krok');
assert(!defs.includes('timeBlockHours:0.75'), 'Definicje startowe nadal zawierają timeBlockHours:0.75');
assert(defs.includes("id:'dishwasher_mount'") && defs.includes("id:'fridge_mount'"), 'Brakuje automatów AGD do kontroli czasu');
assert(formSrc.includes('formatLaborTime'), 'Podgląd reguły nie ma formattera minut');
assert(catalogSrc.includes('normalizeLegacyFortyFiveMinutes'), 'Katalog nie ma kompatybilnego odczytu zapisanych minut');

const FC = { utils:{ clone:(v)=> JSON.parse(JSON.stringify(v)), uid:()=> 'uid_smoke' } };
const ctx = { window:{ FC }, FC, console, JSON, String, Number, Array, Object, Set, Map, Math, Date };
ctx.globalThis = ctx.window;
vm.createContext(ctx);
vm.runInContext(defs, ctx, { filename:'labor-catalog-definitions.js' });
vm.runInContext(catalogSrc, ctx, { filename:'labor-catalog.js' });
const labor = ctx.FC.laborCatalog;
let normalized = labor.normalizeDefinition({ name:'Legacy 45', pricingMode:'time', quantityMode:'linear', timeBlockHours:0.75, startHours:0.75, stepHours:0.75 });
assert(normalized.timeBlockHours === 0.75, 'timeBlockHours musi zachować zapisane 45 min', normalized);
assert(normalized.startHours === 0.75, 'startHours musi zachować zapisane 45 min', normalized);
assert(normalized.stepHours === 0.75, 'stepHours musi zachować zapisane 45 min', normalized);
normalized = labor.normalizeDefinition({ name:'Five minutes', pricingMode:'time', quantityMode:'linear', timeBlockHours:1/12 });
assert(Math.abs(normalized.timeBlockHours - (1/12)) < 0.000001, '5 minut ma być dozwolonym czasem bazowym', normalized);
const calc = labor.calculateDefinition({ name:'Trzy razy 15', pricingMode:'time', quantityMode:'linear', timeBlockHours:0.25, rateType:'workshop' }, { quantity:3, hourlyRates:{ workshop:120 } });
assert(calc.quantityHours === 0.75, 'Wynik 3×15 min ma nadal wynosić 45 min jako wynik mnożenia', calc);
assert(calc.total === 90, '3×15 min × 120 PLN/h powinno dawać 90 PLN', calc);
const dishwasher = labor.ensureDefaultDefinitions([]).find((row)=> row.id === 'dishwasher_mount');
const fridge = labor.ensureDefaultDefinitions([]).find((row)=> row.id === 'fridge_mount');
assert(dishwasher && Number(dishwasher.timeBlockHours) === 1, 'Zmywarka startowo ma mieć 60 min', dishwasher);
assert(fridge && Number(fridge.timeBlockHours) === 1, 'Lodówka startowo ma mieć 60 min', fridge);
assert(labor.formatHoursAsMinutes(0.25) === '15 min', 'Formatter ma pokazywać 0.25 h jako 15 min');
assert(labor.formatHoursAsMinutes(1) === '60 min', 'Formatter ma pokazywać 1 h jako 60 min');
const tiers = labor.parseTierText('1-2=15 min;3-5=30 min;6-10=60 min;11-12=0.75');
assert(Math.abs(tiers[0].hours - 0.25) < 0.000001, 'Progi powinny czytać zapis 15 min jako 0.25 h', tiers);
assert(Math.abs(tiers[1].hours - 0.5) < 0.000001, 'Progi powinny czytać zapis 30 min jako 0.5 h', tiers);
assert(tiers[2].hours === 1, 'Progi powinny czytać zapis 60 min jako 1 h', tiers);
assert(tiers[3].hours === 0.75, 'Stary zapis progu 0.75 h musi pozostać 45 min', tiers);
assert(labor.tiersToText([{min:1,max:2,hours:0.25}]).includes('15 min'), 'Progi mają pokazywać czas w minutach');

assert(labor.normalizeDefinition({timeBlockHours:1}).timeBlockHours === 1, 'Zapisane 60 min pozostaje 60 min');
const seventyFive = labor.calculateDefinition({pricingMode:'time',timeBlockHours:0.25}, {quantity:5,hourlyRates:{workshop:120}});
assert(seventyFive.pricedHours === 1.25 && seventyFive.total === 150, '5 × 15 = 75 min bez zaokrąglania', seventyFive);
for(const field of ['laborTimeBlockHours','laborStartHours','laborStepHours']){
  const select = index.match(new RegExp('<select[^>]*id="'+field+'"[^>]*>([\\s\\S]*?)</select>'));
  assert(select, 'Brak pola czasu '+field);
  const minutes = [...select[1].matchAll(/<option value="([^"]+)"/g)].map(row=>Math.round(Number(row[1])*60));
  assert(JSON.stringify(minutes) === '[0,1,5,15,30,60]', 'Wyłącznie standardowe bloki w '+field, minutes);
  assert(formSrc.includes("setDurationValue('"+field+"'"), 'Odczyt formularza musi zachować zapisane 45 min w '+field);
}
assert(read('js/app/material/price-modal-field-help.js').includes('Dostępne bloki planowania: 1, 5, 15, 30 i 60 minut. Wyniki obliczeń nie są zaokrąglane do tych bloków — np. 3 × 15 minut daje 45 minut.'), 'Brak uzgodnionej pomocy czasu');
console.log('OK labor-time-minutes smoke');
