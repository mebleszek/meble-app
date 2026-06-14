#!/usr/bin/env node
const fs = require('fs');
const vm = require('vm');
const path = require('path');
function read(file){ return fs.readFileSync(path.join(process.cwd(), file), 'utf8'); }
function assert(condition, message, data){ if(!condition){ throw new Error(message + (data ? '\n' + JSON.stringify(data, null, 2) : '')); } }
function near(a,b,msg){ if(Math.abs(Number(a)-Number(b)) > 0.001) throw new Error(`${msg}: ${a} !== ${b}`); }

const registerSrc = read('js/app/quote/quote-calculation-register.js');
const snapshotSrc = read('js/app/quote/quote-snapshot.js');
const preview = read('js/app/wycena/wycena-tab-preview.js');
const details = read('js/app/wycena/wycena-summary-details-modal.js');
const core = read('js/app/wycena/wycena-core.js');
const labor = read('js/app/wycena/wycena-core-labor.js');

assert(registerSrc.includes("carrying:'Wnoszenie mebli'"), 'Rejestr musi mieć osobną sekcję Wnoszenie mebli');
assert(preview.includes("['Wnoszenie mebli', totals.carrying, 'carrying']"), 'Podsumowanie WYCENY musi pokazywać Wnoszenie mebli');
assert(details.includes("['Wnoszenie mebli', totals.carrying]"), 'Szczegóły WYCENY muszą pokazywać Wnoszenie mebli');
assert(core.includes('carryingLines') && core.includes('collectCarryingLines'), 'Core WYCENY musi zbierać carryingLines');
assert(labor.includes('function collectCarryingLines') && !labor.includes('addCarryingLabor(components, entry, defs, rates, volumeM3);\n    addGenericQuantitySourceLabor'), 'Wnoszenie nie może być dopisane do robocizny szafek');

const sandbox = { console, window:{}, globalThis:null };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.FC = { utils:{ clone:(v)=> JSON.parse(JSON.stringify(v)) }, wycenaCoreUtils:{ slug:(v)=> String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') } };
vm.createContext(sandbox);
vm.runInContext(registerSrc, sandbox, { filename:'quote-calculation-register.js' });
const reg = sandbox.FC.quoteCalculationRegister.buildRegister({
  labor:[{ name:'Szafka #1', details:[{ name:'Montaż frontu', category:'Elementy szafki', quantity:1, unit:'szt.', total:100, hours:1, hourlyRate:100, sourceRole:'front-labor' }] }],
  carrying:[{ name:'Wnoszenie — szafka #1', details:[{ name:'Wnoszenie korpusu', category:'Wnoszenie mebli', quantity:2, unit:'poziom', total:50, hours:0.5, hourlyRate:100, sourceRole:'carrying-labor', quantitySource:'carrying.floor_units' }] }]
}, {});
near(reg.totals.labor, 100, 'Robocizna szafek bez wnoszenia');
near(reg.totals.carrying, 50, 'Wnoszenie osobno');
near(reg.totals.subtotal, 150, 'Subtotal zawiera osobne wnoszenie');
assert(reg.lines.some((row)=> row.section === 'carrying'), 'Rejestr musi zawierać linię section=carrying');
assert(!reg.lines.some((row)=> row.section === 'labor' && /Wnoszenie/i.test(row.name)), 'Wnoszenie nie może być w sekcji labor');

vm.runInContext(snapshotSrc, sandbox, { filename:'quote-snapshot.js' });
const totals = sandbox.FC.quoteSnapshot.computeTotals({}, { materials:[], accessories:[], agdServices:[], quoteRates:[], labor:[{ total:100 }], carrying:[{ total:50 }] }, {});
near(totals.labor, 100, 'Snapshot labor');
near(totals.carrying, 50, 'Snapshot carrying');
near(totals.subtotal, 150, 'Snapshot subtotal');
console.log('carrying-separate-quote-smoke OK');
