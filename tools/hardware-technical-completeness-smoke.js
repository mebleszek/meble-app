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

const defs=[{category:'Test',key:'finish',label:'Wykończenie',fieldType:'text',options:['A','B'],typePart:true,active:true}];
const source={technicalParams:{finish:{value:'A'}}};const described=api.describeLegacyValues(source,defs,'Test');
const expected=api.mergeLegacyValues(source,defs,'Test');assert(JSON.stringify(described.technicalParams)===JSON.stringify(expected),'Combined description preserves every normalized value');
assert(described.hardwareTypeAuto===api.buildTypeLabel(defs,'Test',expected),'Combined description preserves the exact generated technical label');
const snapshotDescribe=api.createLegacyDescriber(defs);
assert(JSON.stringify(snapshotDescribe(source,'Test'))===JSON.stringify(described),'A build snapshot preserves the full original description');
described.technicalParams.finish.value='mutated';assert(source.technicalParams.finish.value==='A','Description does not alias source values');
source.technicalParams.finish.value='B';defs[0].options=['B'];assert(api.describeLegacyValues(source,defs,'Test').technicalParams.finish.value==='B','A later call observes changed source and definitions without stale cache');
assert(snapshotDescribe(source,'Test').technicalParams.finish.value==='B','A build snapshot reads each new row rather than caching source values');
assert(snapshotDescribe({technicalParams:{finish:{value:'A'}}},'Test').technicalParams.finish.value==='A','The explicit build snapshot stays detached from later definition edits');
assert(api.createLegacyDescriber(defs)({technicalParams:{finish:{value:'A'}}},'Test').technicalParams.finish===undefined,'A new build observes changed definitions rather than reusing the previous snapshot');
