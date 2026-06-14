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
const FC = {
  utils:{ clone },
  frontHardware:{ getCabinetFrontCutListForMaterials(){ return []; } },
  cabinetHardwareRequirements:{ getHingeRequirementsWithQty(){ return []; } },
  laborApplianceRules:{ getApplianceForCabinet(){ return null; } }
};
const ctx = { window:{ FC }, FC, console, JSON, String, Number, Array, Object, Set, Map, Math };
ctx.globalThis = ctx.window;
vm.createContext(ctx);
load(ctx, 'js/app/pricing/work-quantity-sources.js');
load(ctx, 'js/app/cabinet/cabinet-drawer-requirements.js');
load(ctx, 'js/app/pricing/work-quantity-facts.js');
const api = ctx.FC.cabinetDrawerRequirements;
const facts = ctx.FC.workQuantityFacts;
function count(cab){ return api.countDrawerRequirements(api.getDrawerRequirements('kuchnia', clone(cab))); }
function fact(cab){ return facts.getCabinetFact('kuchnia', clone(cab), 'drawer.count'); }

const standardTrash = { type:'stojąca', subType:'standardowa', details:{ insideMode:'polki', drawerCount:'3', innerDrawerType:'blum', innerDrawerCount:'1' } };
assert(count(standardTrash) === 0, 'zwykła szafka z drzwiami ignoruje śmieci drawerCount/innerDrawerCount', api.getDrawerRequirements('kuchnia', standardTrash));
assert(fact(standardTrash).value === 0, 'drawer.count dla zwykłej szafki z ukrytymi polami wynosi 0', fact(standardTrash));

const explicit = { type:'stojąca', subType:'standardowa', drawerRequirements:[{ source:'manual_requirement', qty:2, label:'Kreator dodał szuflady' }], details:{ drawerCount:'99' } };
assert(count(explicit) === 2, 'jawne drawerRequirements liczą się niezależnie od typu szafki', api.getDrawerRequirements('kuchnia', explicit));
assert(fact(explicit).value === 2, 'drawer.count czyta jawne wymagania przyszłego kreatora', fact(explicit));

const drawers = { type:'stojąca', subType:'szuflady', details:{ drawerLayout:'3_1_2_2', drawerSystem:'skrzynkowe', innerDrawerType:'brak', innerDrawerCount:'2' } };
assert(count(drawers) === 3, 'szafka szufladowa liczy frontowe szuflady z drawerLayout, nie z innerDrawerCount przy typie brak', api.getDrawerRequirements('kuchnia', drawers));

const drawersInner = { type:'stojąca', subType:'szuflady', details:{ drawerLayout:'2_equal', drawerSystem:'skrzynkowe', innerDrawerType:'skrzynkowe', innerDrawerCount:'2' } };
assert(count(drawersInner) === 4, 'szafka szufladowa liczy frontowe + jawnie włączone wewnętrzne', api.getDrawerRequirements('kuchnia', drawersInner));

assert(count({ type:'stojąca', subType:'zlewowa', details:{ sinkFront:'szuflada', sinkExtra:'szuflada_wew', sinkExtraCount:'1' } }) === 2, 'zlewowa liczy dużą szufladę i szufladę wewnętrzną');
assert(count({ type:'stojąca', subType:'piekarnikowa', details:{ ovenOption:'szuflada_dol' } }) === 1, 'piekarnikowa z opcją szuflady liczy jedną szufladę');
assert(count({ type:'wisząca', subType:'dolna_podblatowa', frontCount:2, details:{ podFrontMode:'szuflady', podInnerDrawerCount:'2' } }) === 2, 'dolna podblatowa z frontami szufladowymi liczy fronty, nie ukryte podInnerDrawerCount');

const dirty = clone(standardTrash);
api.cleanDrawerTrash(dirty);
assert(!('drawerCount' in dirty.details) && !('innerDrawerCount' in dirty.details) && !('innerDrawerType' in dirty.details), 'cleanDrawerTrash usuwa śmieci szufladowe ze zwykłej szafki', dirty);
const drawerDirty = { type:'stojąca', subType:'szuflady', details:{ drawerCount:'5', drawerLayout:'5_equal', innerDrawerType:'blum', innerDrawerCount:'2' } };
api.cleanDrawerTrash(drawerDirty);
assert(!('drawerCount' in drawerDirty.details) && drawerDirty.details.innerDrawerType === 'brak' && drawerDirty.details.innerDrawerCount === '0', 'cleanDrawerTrash usuwa legacy drawerCount i zeruje wewnętrzne przy układzie 5_equal', drawerDirty);

const draftSource = read('js/app/cabinet/cabinet-modal-draft.js');
assert(!draftSource.includes("drawerCount: '3'") && !draftSource.includes("innerDrawerType: 'blum'") && !draftSource.includes("innerDrawerCount: '1'"), 'świeży draft nie zawiera ukrytych domyślnych szuflad');
const index = read('index.html');
assert(index.indexOf('js/app/cabinet/cabinet-drawer-requirements.js') > 0, 'index ładuje moduł wymagań szuflad');
assert(index.indexOf('js/app/cabinet/cabinet-drawer-requirements.js') < index.indexOf('js/app/pricing/work-quantity-facts.js'), 'wymagania szuflad ładują się przed work-quantity-facts');
assert(!read('js/app/cabinet/cabinet-modal.js').includes('cabinetDrawerRequirements'), 'cabinet-modal.js nie jest ruszony przez etap wymagań szuflad');
assert(!read('js/app/ui/cabinets-render.js').includes('cabinetDrawerRequirements'), 'cabinets-render.js nie jest ruszony przez etap wymagań szuflad');
console.log('OK cabinet-drawer-requirements smoke');
console.log(' - drawer.count czyta jawne wymagania szuflad/prowadnic');
console.log(' - zwykła szafka ignoruje legacy drawerCount/innerDrawerCount');
console.log(' - przyszły kreator może dodać drawerRequirements do dowolnej konstrukcji');
