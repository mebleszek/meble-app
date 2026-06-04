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
const complete = api.evaluateItemTechnicalStatus({ hardwareCategory:'Zawiasy', technicalParams:{ nalozenie:{ value:'nakładany' }, kat_rzeczywisty:{ from:107 }, klasa_kata:{ value:'standardowy 90–120°' }, hamulec:{ value:true }, sprezyna:{ value:false }, prowadnik:{ value:'standardowy' } } }, api.DEFAULT_DEFINITIONS);
assert(complete && complete.ok && !complete.needsAttention, 'kompletny zawias 107° standard powinien być OK');
const incomplete = api.evaluateItemTechnicalStatus({ hardwareCategory:'Zawiasy', technicalParams:{ nalozenie:{ value:'nakładany' }, kat_rzeczywisty:{ from:107 }, hamulec:{ value:true } } }, api.DEFAULT_DEFINITIONS);
assert(incomplete && incomplete.needsAttention, 'zawias bez klasy/prowadnika powinien być do uzupełnienia');
assert((incomplete.missing || []).some((row)=> row.key === 'klasa_kata'), 'status powinien wskazać brak klasy kąta');
assert((incomplete.missing || []).some((row)=> row.key === 'prowadnik'), 'status powinien wskazać brak prowadnika');
const uxSrc = fs.readFileSync(path.join(root, 'js/app/material/price-modal-hardware-ux.js'), 'utf8');
assert(uxSrc.includes('Do uzupełnienia tech.'), 'lista okuć musi mieć filtr/chip Do uzupełnienia tech.');
assert(uxSrc.includes("value:'techTodo'"), 'brak jednego filtra techTodo');
const formSrc = fs.readFileSync(path.join(root, 'js/app/material/price-modal-hardware-form.js'), 'utf8');
assert(formSrc.includes('Brakuje danych technicznych do automatycznej wyceny'), 'modal edycji powinien pokazywać listę brakujących danych technicznych');
console.log('OK hardware-technical-completeness smoke');
