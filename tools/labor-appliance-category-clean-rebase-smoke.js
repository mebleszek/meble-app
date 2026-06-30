#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function load(ctx, rel){ vm.runInContext(read(rel), ctx, { filename:rel }); }
function assert(cond, msg, details){
  if(!cond){
    console.error('FAIL labor-appliance-category-clean-rebase-smoke:', msg);
    if(details !== undefined){ try{ console.error(JSON.stringify(details, null, 2)); }catch(_){ console.error(details); } }
    process.exit(1);
  }
}
const FC = { utils:{ clone:(v)=> JSON.parse(JSON.stringify(v)), uid:()=> 'uid_smoke' }, wycenaCoreUtils:{ slug:(v)=> String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') } };
const ctx = { window:{ FC }, FC, console, JSON, String, Number, Array, Object, Set, Map, Math, Date };
ctx.globalThis = ctx.window;
vm.createContext(ctx);
[
  'js/app/catalog/catalog-domain.js',
  'js/app/pricing/labor-catalog-definitions.js',
  'js/app/pricing/labor-catalog.js',
  'js/app/wycena/wycena-core-catalog.js',
  'js/app/pricing/work-quantity-sources.js',
].forEach((file)=> load(ctx, file));

const cats = ctx.FC.catalogDomain.QUOTE_RATE_CATEGORIES;
assert(cats.includes('Montaż AGD'), 'Kategorie stawek mają Montaż AGD', cats);
assert(!cats.includes('AGD'), 'Stary dział AGD nie może być w bazowej liście kategorii', cats);

const cleaned = ctx.FC.laborCatalog.ensureDefaultDefinitions([
  { id:'svc_old_oven', category:'AGD', name:'Piekarnik do zabudowy', price:111 },
  { id:'hood_mount', category:'Montaż AGD', name:'Montaż okapu', quantitySource:'appliance.hood.count', timeBlockHours:0.5 },
  { id:'labor_rate_workshop', category:'Stawki godzinowe', rateCode:'workshop', price:150 },
]);
assert(!cleaned.some((row)=> String(row.category || '') === 'AGD'), 'Normalizacja robocizny usuwa stare seedowane AGD', cleaned.filter((row)=> /AGD/.test(String(row.category || ''))));
assert(!cleaned.some((row)=> String(row.id || '') === 'hood_mount'), 'Normalizacja usuwa stary generyczny automat hood_mount', cleaned.filter((row)=> /hood/i.test(String(row.id || row.name || ''))));
['dishwasher_mount','fridge_mount','oven_mount','hob_mount','hood_under_cabinet_mount','hood_chimney_mount','microwave_mount','washer_mount','dryer_mount','coffee_machine_mount','warming_drawer_mount'].forEach((id)=> assert(cleaned.some((row)=> row.id === id && row.category === 'Montaż AGD'), `brak automatu ${id} w Montaż AGD`, cleaned.map((row)=> [row.id,row.category])));
const dishwasher = cleaned.find((row)=> row.id === 'dishwasher_mount');
assert(Number(dishwasher.timeBlockHours) === 1, 'Baza nie może już zawierać opcji 45 min; startowe AGD ma 60 min', dishwasher);
assert(Number(ctx.FC.laborCatalog.normalizeDefinition({ name:'Legacy 45 min', timeBlockHours:0.75 }).timeBlockHours) === 1, 'Normalizacja ma zamieniać zapisane 45 min na 60 min', ctx.FC.laborCatalog.normalizeDefinition({ name:'Legacy 45 min', timeBlockHours:0.75 }));

const services = ctx.FC.wycenaCoreCatalog.ensureServiceCatalog([{ id:'legacy', category:'AGD', name:'Piekarnik do zabudowy', price:111 }]).list;
assert(!services.some((row)=> String(row.category || '') === 'AGD'), 'Fallback usług usuwa stare AGD', services);
assert(services.some((row)=> String(row.category || '') === 'Montaż AGD' && String(row.name || '') === 'Montaż piekarnika do zabudowy'), 'Fallback usług ma Montaż AGD', services);

const groups = ctx.FC.workQuantitySources.groupByCategory();
assert(Array.isArray(groups['Montaż AGD']) && groups['Montaż AGD'].some((row)=> row.code === 'appliance.hood_under_cabinet.count'), 'Źródła ilości AGD są pod Montaż AGD', groups);
assert(!groups.AGD, 'Źródła ilości nie tworzą już grupy AGD', groups);

const index = read('index.html');
const dev = read('dev_tests.html');
assert(index.includes('20260628_drawer_systems_materials_v1') && dev.includes('20260628_drawer_systems_materials_v1'), 'index/dev_tests mają aktualny cache-busting');

console.log('OK labor-appliance-category-clean-rebase smoke');
console.log(' - stary dział AGD jest odcinany');
console.log(' - Montaż AGD ma pełne automaty');
console.log(' - zapisane 45 min są zamieniane na 60 min bez zaokrąglania wyników typu 3×15 min');
