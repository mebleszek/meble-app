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
  kuchnia:{ cabinets:[
    {
      id:'cab_standard_doors', type:'stojąca', subType:'standardowa', width:60, height:82, depth:51, frontCount:2,
      details:{ shelves:0, insideMode:'polki', drawerCount:'3', innerDrawerCount:'1', innerDrawerType:'blum' }
    },
    {
      id:'cab_real_drawers', type:'stojąca', subType:'szuflady', width:60, height:82, depth:51, frontCount:3,
      details:{ drawerLayout:'3_1_2_2', drawerCount:'3', innerDrawerType:'brak', innerDrawerCount:'2' }
    },
    {
      id:'cab_inner_drawers', type:'stojąca', subType:'standardowa', width:60, height:82, depth:51, frontCount:2,
      details:{ shelves:0, insideMode:'szuflady_wew', innerDrawerCount:'2', innerDrawerType:'blum', drawerCount:'4' }
    }
  ] }
};
const FC = {
  utils:{ clone, slug },
  wycenaCoreUtils:{ slug },
  wycenaCoreSource:{
    project:()=> projectData,
    roomLabel:(id)=> id === 'kuchnia' ? 'Kuchnia' : String(id || '')
  },
  frontHardware:{ getCabinetFrontCutListForMaterials(room, cab){ return [{ name:'Front', qty:Number(cab.frontCount)||0, a:30, b:72, dims:'30 × 72' }]; } },
  cabinetHardwareRequirements:{ getHingeRequirementsWithQty(){ return []; } },
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

const factsApi = FC.workQuantityFacts;
const standardMap = factsApi.buildCabinetFactMap('kuchnia', projectData.kuchnia.cabinets[0]);
assert(standardMap['drawer.count'].value === 0, 'standardowa szafka z drzwiczkami nie może liczyć ukrytego drawerCount/innerDrawerCount', standardMap['drawer.count']);
const realDrawerMap = factsApi.buildCabinetFactMap('kuchnia', projectData.kuchnia.cabinets[1]);
assert(realDrawerMap['drawer.count'].value === 3, 'wariant szuflady liczy realny układ szuflad', realDrawerMap['drawer.count']);
const innerMap = factsApi.buildCabinetFactMap('kuchnia', projectData.kuchnia.cabinets[2]);
assert(innerMap['drawer.count'].value === 2, 'standardowa szafka liczy szuflady tylko gdy wnętrze jawnie wybrano jako szuflady wewnętrzne', innerMap['drawer.count']);

const laborLines = FC.wycenaCoreLabor.collectCabinetLabor(['kuchnia']);
const byCab = Object.fromEntries(laborLines.map((row)=> [row.cabinetId, row]));
function drawerRows(id){ return ((byCab[id] && byCab[id].details) || []).filter((row)=> row.name === 'Montaż szuflady / prowadnic'); }
assert(drawerRows('cab_standard_doors').length === 0, 'WYCENA nie dodaje montażu szuflad dla standardowej szafki z drzwiczkami', byCab.cab_standard_doors);
assert(drawerRows('cab_real_drawers').some((row)=> Number(row.quantity) === 3 && row.quantitySource === 'drawer.count'), 'WYCENA liczy montaż szuflad dla realnej szafki szufladowej', drawerRows('cab_real_drawers'));
assert(drawerRows('cab_inner_drawers').some((row)=> Number(row.quantity) === 2 && row.quantitySource === 'drawer.count'), 'WYCENA liczy montaż szuflad dla jawnych szuflad wewnętrznych', drawerRows('cab_inner_drawers'));

const source = read('js/app/pricing/work-quantity-facts.js');
assert(source.includes('Ukryte domyślne pola') || source.includes('historyczne domyślne pola'), 'work-quantity-facts dokumentuje ochronę przed ukrytymi domyślnymi polami modala');
assert(!read('js/app/cabinet/cabinet-modal.js').includes('drawer.count'), 'poprawka nie dotyka modala szafki przez dopinanie drawer.count');
console.log('OK labor-drawer-count-context smoke');
console.log(' - drawer.count nie liczy ukrytych domyślnych pól dla drzwiczek');
console.log(' - drawer.count liczy tylko realne szuflady albo jawne szuflady wewnętrzne');
