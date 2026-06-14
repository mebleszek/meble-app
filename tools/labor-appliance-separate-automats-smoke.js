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
    console.error('FAIL labor-appliance-separate-automats-smoke:', msg);
    if(details !== undefined){ try{ console.error(JSON.stringify(details, null, 2)); }catch(_){ console.error(details); } }
    process.exit(1);
  }
}
function clone(v){ return JSON.parse(JSON.stringify(v)); }
function slug(value){ return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x'; }

const projectData = {
  kuchnia:{ cabinets:[
    { id:'cab_dishwasher', type:'stojąca', subType:'zmywarkowa', width:60, height:82, depth:56, details:{ applianceMountingMode:'mount' } },
    { id:'cab_oven', type:'stojąca', subType:'piekarnikowa', width:60, height:82, depth:56, details:{ applianceMountingMode:'mount' } },
    { id:'cab_fridge_no_mount', type:'stojąca', subType:'lodowkowa', width:60, height:220, depth:58, details:{ fridgeOption:'zabudowa', applianceMountingMode:'none' } },
    { id:'cab_hood', type:'wisząca', subType:'okap', width:60, height:72, depth:35, details:{ applianceMountingMode:'mount' } },
  ] }
};
const FC = {
  utils:{ clone, slug },
  wycenaCoreUtils:{ slug },
  wycenaCoreSource:{
    project:()=> projectData,
    roomLabel:(id)=> id === 'kuchnia' ? 'Kuchnia' : String(id || ''),
    selectedCabinets:(rooms)=> (Array.isArray(rooms) ? rooms : []).flatMap((roomId)=> (projectData[roomId] && projectData[roomId].cabinets || []).map((cabinet)=> ({ roomId, roomLabel:'Kuchnia', cabinet })))
  },
  wycenaCoreSelection:{ normalizeQuoteSelection:(v)=> v || {} },
  wycenaCoreOffer:{},
  wycenaCoreCatalog:{ servicePriceLookup:()=> null },
  frontHardware:{ getCabinetFrontCutListForMaterials:()=> [] },
  cabinetHardwareRequirements:{ getHingeRequirementsWithQty:()=> [] },
  cabinetDrawerRequirements:{ getDrawerRequirementsWithQty:()=> [] },
};
const ctx = { window:{ FC, projectData }, FC, projectData, console, JSON, String, Number, Array, Object, Set, Map, Math };
ctx.globalThis = ctx.window;
vm.createContext(ctx);
[
  'js/app/pricing/labor-appliance-rules.js',
  'js/app/pricing/labor-catalog-definitions.js',
  'js/app/pricing/labor-catalog.js',
  'js/app/pricing/work-quantity-sources.js',
  'js/app/pricing/work-quantity-facts.js',
].forEach((file)=> load(ctx, file));
const defs = FC.laborCatalog.DEFAULT_HOURLY_RATES.concat(FC.laborCatalog.DEFAULT_LABOR_DEFINITIONS).map(clone);
FC.catalogSelectors = { getQuoteRates:()=> defs };
load(ctx, 'js/app/wycena/wycena-core-lines.js');
load(ctx, 'js/app/wycena/wycena-core-labor.js');

const ids = defs.map((row)=> String(row.id || ''));
['dishwasher_mount','fridge_mount','oven_mount','hob_mount','hood_under_cabinet_mount','hood_chimney_mount','microwave_mount','washer_mount','dryer_mount','coffee_machine_mount','warming_drawer_mount'].forEach((id)=> assert(ids.includes(id), `brak osobnego automatu AGD ${id}`, ids));
const sourceCodes = FC.workQuantitySources.list().map((row)=> row.code);
['appliance.dishwasher.count','appliance.fridge.count','appliance.oven.count','appliance.hob.count','appliance.hood_under_cabinet.count','appliance.hood_chimney.count','appliance.microwave.count','appliance.washer.count','appliance.dryer.count','appliance.coffee_machine.count','appliance.warming_drawer.count'].forEach((code)=> assert(sourceCodes.includes(code), `brak źródła ilości ${code}`, sourceCodes));

const agd = FC.wycenaCoreLines.collectBuiltInAppliances(['kuchnia']);
assert(agd.length === 3, 'AGD z włączonym montażem ma dać trzy linie, lodówka bez montażu ma być pominięta', agd);
['dishwasher_mount','oven_mount','hood_under_cabinet_mount'].forEach((id)=> assert(agd.some((row)=> row.laborCode === id && row.sourceRole === 'appliance-labor' && Number(row.total) > 0), `brak wyceny z automatu ${id}`, agd));
assert(!agd.some((row)=> /fridge_mount/.test(String(row.laborCode || ''))), 'lodówka z Bez montażu nie może tworzyć automatu AGD', agd);
assert(agd.every((row)=> /^appliance\.[a-z_]+\.count$/.test(String(row.quantitySource || ''))), 'każda linia AGD musi mieć osobne źródło ilości', agd);
assert(agd.every((row)=> /Automat AGD:/.test(String(row.note || ''))), 'linie AGD mają pokazywać kod techniczny automatu w audycie', agd);

const factDishwasher = FC.workQuantityFacts.getCabinetFact('kuchnia', projectData.kuchnia.cabinets[0], 'appliance.dishwasher.count');
const factOvenOnDishwasher = FC.workQuantityFacts.getCabinetFact('kuchnia', projectData.kuchnia.cabinets[0], 'appliance.oven.count');
const factFridgeNoMount = FC.workQuantityFacts.getCabinetFact('kuchnia', projectData.kuchnia.cabinets[2], 'appliance.fridge.count');
assert(Number(factDishwasher.value) === 1, 'zmywarka z montażem daje appliance.dishwasher.count = 1', factDishwasher);
assert(Number(factOvenOnDishwasher.value) === 0, 'zmywarka nie może uruchamiać automatu piekarnika', factOvenOnDishwasher);
assert(Number(factFridgeNoMount.value) === 0, 'lodówka bez montażu daje appliance.fridge.count = 0', factFridgeNoMount);

const labor = FC.wycenaCoreLabor.collectCabinetLabor(['kuchnia']);
const laborDetails = labor.flatMap((row)=> row.details || []);
assert(!laborDetails.some((row)=> ['dishwasher_mount','fridge_mount','oven_mount','hob_mount','hood_under_cabinet_mount','hood_chimney_mount','microwave_mount','washer_mount','dryer_mount','coffee_machine_mount','warming_drawer_mount'].includes(String(row.key || row.name || '')) || String(row.quantitySource || '').indexOf('appliance.') === 0), 'osobne automaty AGD nie mogą dublować się w Robocizna szafek', laborDetails);

console.log('OK labor-appliance-separate-automats smoke');
console.log(' - AGD ma osobne techniczne automaty i źródła ilości');
console.log(' - Montaż AGD liczy się z cennika robocizny/stawki wyceny, bez wspólnego appliance_mount');
console.log(' - Bez montażu nie tworzy linii, a automaty AGD nie dublują Robocizny szafek');
