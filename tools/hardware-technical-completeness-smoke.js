#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function assert(cond, msg){ if(!cond){ console.error('FAIL:', msg); process.exit(1); } }
const FC = {};
const ctx = { window:{ FC }, FC, console };
ctx.globalThis = ctx.window;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/app/catalog/hardware-technical-params.js'), 'utf8'), ctx, { filename:'hardware-technical-params.js' });
const api = ctx.window.FC.hardwareTechnicalParams;
assert(api && typeof api.evaluateItemTechnicalStatus === 'function', 'brak evaluateItemTechnicalStatus');
const complete = api.evaluateItemTechnicalStatus({ hardwareCategory:'Zawiasy', technicalParams:{
  rola_kompletu:{ value:'komplet zawiasowy' },
  system_kompatybilnosci:{ value:'GTV clip-on' },
  nalozenie:{ value:'nakładany' },
  kat_rzeczywisty:{ from:107 },
  klasa_kata:{ value:'standardowy 90–120°' },
  hamulec:{ value:true },
  sprezyna:{ value:false },
  typ_prowadnika:{ value:'standardowy' },
  forma_prowadnika:{ value:'krzyżowy' },
  pokrycie_prowadnika:{ value:'osobno' }
} }, api.DEFAULT_DEFINITIONS);
assert(complete && complete.ok && !complete.needsAttention, 'kompletny zawias 107° standard powinien być OK');
const incomplete = api.evaluateItemTechnicalStatus({ hardwareCategory:'Zawiasy', technicalParams:{ nalozenie:{ value:'nakładany' }, kat_rzeczywisty:{ from:107 }, hamulec:{ value:true } } }, api.DEFAULT_DEFINITIONS);
assert(incomplete && incomplete.needsAttention, 'zawias bez klasy/prowadnika powinien być do uzupełnienia');
assert((incomplete.missing || []).some((row)=> row.key === 'klasa_kata'), 'status powinien wskazać brak klasy kąta');
assert((incomplete.missing || []).some((row)=> row.key === 'typ_prowadnika'), 'status powinien wskazać brak typu prowadnika');
assert((incomplete.missing || []).some((row)=> row.key === 'system_kompatybilnosci'), 'status powinien wskazać brak systemu kompatybilności');
const missingBool = api.evaluateItemTechnicalStatus({ hardwareCategory:'Zawiasy', technicalParams:{
  rola_kompletu:{ value:'komplet zawiasowy' }, system_kompatybilnosci:{ value:'GTV clip-on' }, nalozenie:{ value:'nakładany' }, kat_rzeczywisty:{ from:107 }, klasa_kata:{ value:'standardowy 90–120°' }, typ_prowadnika:{ value:'standardowy' }, forma_prowadnika:{ value:'krzyżowy' }, pokrycie_prowadnika:{ value:'w komplecie' }
} }, api.DEFAULT_DEFINITIONS);
assert((missingBool.missing || []).some((row)=> row.key === 'hamulec'), 'brak boolean hamulec ma być brakiem, a nie wartością NIE');
const driver = api.evaluateItemTechnicalStatus({ hardwareCategory:'Prowadniki', technicalParams:{ rola_kompletu:{ value:'prowadnik' }, system_kompatybilnosci:{ value:'GTV clip-on' }, typ_prowadnika:{ value:'standardowy' }, forma_prowadnika:{ value:'krzyżowy' } } }, api.DEFAULT_DEFINITIONS);
assert(driver && driver.ok && !driver.needsAttention, 'kompletny prowadnik powinien być OK');
const uxSrc = fs.readFileSync(path.join(root, 'js/app/material/price-modal-hardware-ux.js'), 'utf8');
assert(uxSrc.includes('Do uzupełnienia tech.'), 'lista okuć musi mieć filtr/chip Do uzupełnienia tech.');
assert(uxSrc.includes("value:'techTodo'"), 'brak jednego filtra techTodo');
const formSrc = fs.readFileSync(path.join(root, 'js/app/material/price-modal-hardware-form.js'), 'utf8');
assert(formSrc.includes('is-tech-required-missing'), 'modal edycji powinien oznaczać konkretne brakujące pola');
assert(formSrc.includes('Wymagane do wyceny'), 'brak podpisu przy wymaganym polu');
assert(formSrc.includes('Nie ustawiono'), 'boolean musi mieć stan Nie ustawiono');
console.log('OK hardware-technical-completeness smoke');
