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
function near(a, e, msg){
  const actual = Number(a); const expected = Number(e);
  assert(Number.isFinite(actual) && Math.abs(actual - expected) < 0.001, `${msg}: expected ${expected}, got ${actual}`);
}

const projectData = { kuchnia:{ cabinets:[{
  id:'cab_two_door', type:'stojąca', subType:'standardowa', width:60, height:82, depth:51, frontCount:2, details:{ shelves:1 }
}] } };
const FC = {
  utils:{ clone, slug },
  wycenaCoreUtils:{ slug, clone },
  wycenaCoreSource:{ project:()=> projectData, roomLabel:(id)=> id === 'kuchnia' ? 'S' : String(id || '') },
  frontHardware:{
    getCabinetFrontCutListForMaterials(){ return [
      { name:'Front', qty:1, a:30, b:72, dims:'30 × 72' },
      { name:'Front', qty:1, a:30, b:72, dims:'30 × 72' }
    ]; }
  },
  cabinetHardwareRequirements:{
    getHingeRequirementsWithQty(){ return [
      { kind:'hinge', hardwareGroup:'hinges', qty:2, label:'Zawias 110° nakładany', doorKey:'left', doorLabel:'Lewe drzwiczki', ruleId:'standard' },
      { kind:'hinge', hardwareGroup:'hinges', qty:2, label:'Zawias 110° nakładany', doorKey:'right', doorLabel:'Prawe drzwiczki', ruleId:'standard' }
    ]; }
  },
  cabinetDrawerRequirements:{ getDrawerRequirementsWithQty(){ return []; } },
  laborApplianceRules:{ getApplianceForCabinet(){ return null; } }
};
const ctx = { window:{ FC, projectData }, FC, projectData, console, JSON, String, Number, Array, Object, Set, Map, Math, Date };
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
assert(laborLines.length === 1, 'jedna szafka tworzy jedną linię robocizny', laborLines);
const details = laborLines[0].details || [];
const hinge = details.filter((row)=> row.sourceRole === 'hinge-labor' && row.name === 'Montaż zawiasu');
assert(hinge.length === 1, 'montaż zawiasu dla szafki dwudrzwiowej jest jedną pozycją kosztową, nie osobno lewy/prawy', details);
near(hinge[0].quantity, 4, 'montaż zawiasu ma łączną ilość 4 szt.');
near(hinge[0].total, 150, 'montaż zawiasu nie jest podwojony kosztowo');
assert(!/Lewe drzwiczki|Prawe drzwiczki/i.test(hinge[0].sourceLabel || ''), 'sourceLabel montażu zawiasu pozostaje na poziomie szafki', hinge[0]);
assert(/Lewe drzwiczki.*2 szt\.|Prawe drzwiczki.*2 szt\./i.test(hinge[0].note || ''), 'rozbicie lewe/prawe zostaje w opisie technicznym, nie w osobnych akordeonach', hinge[0].note);
const register = FC.quoteCalculationRegister.buildRegister({ labor:laborLines }, {});
const registerHinges = register.lines.filter((row)=> row.section === 'labor' && row.name === 'Montaż zawiasu');
assert(registerHinges.length === 1, 'quoteCalculationRegister dostaje tylko jedną linię Montaż zawiasu dla tej szafki', register.lines);
near(registerHinges[0].quantity, 4, 'rejestr zachowuje 4 szt. zawiasów');
assert(!register.lines.some((row)=> /—\s*(Lewe|Prawe)\s+drzwiczki$/i.test(row.sourceLabel || '')), 'rejestr nie tworzy osobnych głównych źródeł dla lewych/prawych drzwiczek', register.lines);
const modalSource = read('js/app/wycena/wycena-summary-details-modal.js');
assert(modalSource.includes('function laborCabinetGroupLabel'), 'modal audytu ma grupowanie robocizny po szafce');
assert(modalSource.includes("current === 'labor' ? laborCabinetGroupLabel : 'subsection'"), 'robocizna w modalach grupuje się po etykiecie szafki, nie po drzwiach');
console.log('OK labor-cabinet-single-accordion-dedupe smoke');
console.log(' - jedna szafka = jedna linia/akordeon robocizny');
console.log(' - montaż zawiasu liczony raz: suma lewe + prawe');
console.log(' - lewe/prawe drzwiczki są opisem technicznym, nie osobnymi głównymi grupami');
