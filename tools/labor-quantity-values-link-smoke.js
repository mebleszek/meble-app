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
    console.error('FAIL:', msg);
    if(details !== undefined){ try{ console.error(JSON.stringify(details, null, 2)); }catch(_){ console.error(details); } }
    process.exit(1);
  }
}
function clone(v){ return JSON.parse(JSON.stringify(v)); }
function slug(value){ return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x'; }

const projectData = {
  kuchnia:{ cabinets:[{
    id:'cab_quantity_source', type:'stojąca', subType:'szufladówka', width:60, height:82, depth:51, frontCount:2,
    details:{ shelves:1, drawerCount:3 }
  }] }
};
const FC = {
  utils:{ clone, slug },
  wycenaCoreUtils:{ slug },
  wycenaCoreSource:{
    project:()=> projectData,
    roomLabel:(id)=> id === 'kuchnia' ? 'Kuchnia' : String(id || '')
  },
  frontHardware:{
    getCabinetFrontCutListForMaterials(room, cab){
      return [{ name:'Front', qty:2, a:30, b:72, dims:'30 × 72' }];
    }
  },
  cabinetHardwareRequirements:{
    getHingeRequirementsWithQty(room, cab){
      return [{ kind:'hinge', hardwareGroup:'hinges', qty:4, label:'110° nakładany', doorLabel:'drzwi', ruleId:'standard' }];
    }
  },
  laborApplianceRules:{ getApplianceForCabinet:()=> null }
};
const ctx = { window:{ FC, projectData }, FC, projectData, console, JSON, String, Number, Array, Object, Set, Map, Math };
ctx.globalThis = ctx.window;
vm.createContext(ctx);
[
  'js/app/pricing/labor-catalog-definitions.js',
  'js/app/pricing/labor-catalog.js',
  'js/app/pricing/work-quantity-sources.js',
  'js/app/pricing/work-quantity-facts.js'
].forEach((file)=> load(ctx, file));
const rates = FC.laborCatalog.DEFAULT_HOURLY_RATES.concat(FC.laborCatalog.DEFAULT_LABOR_DEFINITIONS).map(clone);
FC.catalogSelectors = { getQuoteRates:()=> rates };
load(ctx, 'js/app/wycena/wycena-core-labor.js');
load(ctx, 'js/app/quote/quote-calculation-register.js');

const laborLines = FC.wycenaCoreLabor.collectCabinetLabor(['kuchnia']);
assert(laborLines.length === 1, 'ma powstać jedna linia robocizny dla jednej szafki', laborLines);
const details = laborLines[0].details || [];
function byId(id){ return details.find((row)=> String(row.key || '').includes(id) || String(row.name || '').toLowerCase().includes(id)); }
function sumByName(part){ return details.filter((row)=> String(row.name || '').includes(part)).reduce((sum, row)=> sum + Number(row.quantity || 0), 0); }
assert(details.some((row)=> row.quantitySource === 'cabinet.count' && Number(row.quantity) === 1), 'skręcenie korpusu używa cabinet.count = 1', details);
assert(details.some((row)=> row.quantitySource === 'shelf.count' && Number(row.quantity) === 1), 'półki używają shelf.count = 1', details);
assert(details.some((row)=> row.sourceRole === 'front-labor' && row.quantitySource === 'front.count' && Number(row.quantity) === 2), 'montaż frontu używa front.count = 2', details);
assert(sumByName('Montaż zawiasu') === 4, 'montaż zawiasu nadal rozbija wymagania zawiasów, ale suma ilości wynosi 4', details);
assert(details.some((row)=> row.name === 'Regulacja frontu' && row.quantitySource === 'hinge.count' && Number(row.quantity) === 4), 'regulacja frontu automatycznie używa hinge.count = 4', details);
assert(details.some((row)=> row.name === 'Montaż szuflady / prowadnic' && row.quantitySource === 'drawer.count' && Number(row.quantity) === 3), 'montaż szuflad używa drawer.count = 3', details);
assert(details.every((row)=> row.total >= 0), 'wszystkie komponenty mają bezpieczne sumy', details);
const register = FC.quoteCalculationRegister.buildRegister({ labor:laborLines }, {});
const laborRegisterLines = register.lines.filter((row)=> row.section === 'labor');
assert(laborRegisterLines.some((row)=> row.quantitySource === 'hinge.count' && /źródło ilości/i.test(row.note || '')), 'quoteCalculationRegister zachowuje źródło ilości i pokazuje je w nocie', laborRegisterLines);
assert(Math.abs(register.totals.labor - laborRegisterLines.reduce((sum, row)=> sum + Number(row.total || 0), 0)) < 0.01, 'suma labor w rejestrze zgadza się z liniami', register.totals);

const modal = read('js/app/cabinet/cabinet-modal.js');
const render = read('js/app/ui/cabinets-render.js');
assert(!modal.includes('cmWorkFactsPreview') && !modal.includes('workQuantityFacts'), 'nie wolno wracać z podglądem do modala szafki w tym etapie');
assert(!render.includes('cmWorkFactsPreview'), 'render szafek nie ma starego panelu podglądu');
console.log('OK labor-quantity-values-link smoke');
console.log(' - WYCENA szafek używa quantitySource z cennika przez FC.workQuantityFacts');
console.log(' - źródło ilości trafia do quoteCalculationRegister');
console.log(' - modal szafki i WYWIAD nie są ruszane');
