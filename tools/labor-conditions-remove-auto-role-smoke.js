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

const index = read('index.html');
const itemForm = read('js/app/material/price-modal-item-form.js');
const conditionForm = read('js/app/material/price-modal-labor-conditions.js');
assert(!index.includes('id="laborAutoRole"'), 'formularz nie może mieć pola Automat / laborAutoRole');
assert(!index.includes('laborHeightMinMm') && !index.includes('laborHeightMaxMm'), 'formularz nie może mieć starych pól wysokości od/do');
assert(index.includes('laborConditionsWrap') && index.includes('Warunki zastosowania'), 'formularz ma sekcję Warunki zastosowania');
assert(!index.includes('laborConditionSourceLaunch'), 'formularz nie ma osobnego przycisku/launchera Dodaj warunek poza listą kaskadową');
assert(!itemForm.includes('laborAutoRole'), 'stary launcher laborAutoRole nie jest ładowany w formularzu');
assert(conditionForm.includes('Wybierz wartość warunku'), 'formularz montuje kaskadowy wybór wartości warunku bez przycisku Dodaj warunek');
const laborConditionsScript = 'js/app/material/price-modal-labor-conditions.js';
const fieldHelpScript = 'js/app/material/price-modal-field-help.js';
const itemFormScript = 'js/app/material/price-modal-item-form.js';
assert(index.includes(laborConditionsScript), 'realny index.html musi ładować moduł kaskadowych warunków robocizny');
assert(index.indexOf(fieldHelpScript) < index.indexOf(laborConditionsScript) && index.indexOf(laborConditionsScript) < index.indexOf(itemFormScript), 'realny index.html musi ładować warunki robocizny po helperach pól i przed formularzem pozycji');
assert(!itemForm.includes("autoRole:readString('laborAutoRole')") && !conditionForm.includes("autoRole:readString('laborAutoRole')"), 'nowy zapis pozycji nie czyta autoRole z UI');
assert(!itemForm.includes('heightMinMm:read') && !itemForm.includes('heightMaxMm:read'), 'nowy zapis pozycji nie czyta starych heightMinMm/heightMaxMm z UI');
assert(conditionForm.includes("renderRow(list, { source:''"), 'sekcja warunków zawsze renderuje pusty kolejny wybór warunku');
assert(conditionForm.includes('hasSelectedIncompleteRange'), 'formularz ma walidację wybranego warunku bez minimum/maksimum');
assert(read('js/app/material/price-modal-persistence.js').includes('Niekompletny warunek zastosowania'), 'zapis blokuje wybrany warunek bez minimum/maksimum');

const projectData = {
  kuchnia:{ cabinets:[{
    id:'cab_conditions_smoke', type:'stojąca', subType:'szuflady', width:60, height:82, depth:51, frontCount:2,
    details:{ shelves:2, drawerLayout:'3_1_2_2', drawerCount:3, innerDrawerType:'brak', innerDrawerCount:'2' }
  }] }
};
const FC = {
  utils:{ clone, slug },
  wycenaCoreUtils:{ slug },
  wycenaCoreSource:{ project:()=> projectData, roomLabel:(id)=> id === 'kuchnia' ? 'Kuchnia' : String(id || '') },
  frontHardware:{ getCabinetFrontCutListForMaterials(){ return [{ name:'Front', qty:2, a:30, b:72, dims:'30 × 72' }]; } },
  cabinetHardwareRequirements:{ getHingeRequirementsWithQty(){ return [{ kind:'hinge', hardwareGroup:'hinges', qty:4, label:'110° nakładany', doorLabel:'drzwi', ruleId:'standard' }]; } },
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

const labor = FC.laborCatalog;
const oldRoleInput = labor.normalizeDefinition({
  id:'old_role_input', name:'Stary wpis z autoRole', category:'Korpusy', autoRole:'cabinetBody', heightMinMm:721, heightMaxMm:1500,
  timeBlockHours:0.5, quantityMode:'linear', rateType:'workshop', active:true
});
assert(!Object.prototype.hasOwnProperty.call(oldRoleInput, 'autoRole'), 'znormalizowany wpis nie zapisuje autoRole', oldRoleInput);
assert(!Object.prototype.hasOwnProperty.call(oldRoleInput, 'legacyAutoRole'), 'znormalizowany wpis nie zapisuje legacyAutoRole', oldRoleInput);
assert(oldRoleInput.quantitySource === '', 'stare autoRole nie jest migrowane ani używane do zgadywania źródła ilości', oldRoleInput);
assert(Array.isArray(oldRoleInput.conditions) && oldRoleInput.conditions.length === 0, 'stare heightMinMm/heightMaxMm nie tworzą warunków — warunki zapisuje tylko conditions[].min/max', oldRoleInput);
const oldShelvesInput = labor.normalizeDefinition({ id:'old_shelves_input', name:'Stare półki', autoRole:'cabinetLooseShelves', timeBlockHours:0.25, quantityMode:'linear', rateType:'workshop' });
assert(oldShelvesInput.quantitySource === '', 'stare autoRole cabinetLooseShelves nie zgaduje shelf.count — źródło ilości musi być jawne', oldShelvesInput);
const oldHourlyInput = labor.normalizeDefinition({ id:'old_hourly_input', name:'Stara stawka', autoRole:'hourlyRate', price:123 });
assert(oldHourlyInput.isHourlyRate !== true, 'stare autoRole hourlyRate nie tworzy stawki godzinowej — służy do tego isHourlyRate/kategoria/rateKey', oldHourlyInput);
const fresh = labor.normalizeDefinition({ id:'fresh_rule', name:'Nowa reguła', quantitySource:'front.count', timeBlockHours:0.25, rateType:'assembly', active:true });
assert(!Object.prototype.hasOwnProperty.call(fresh, 'autoRole'), 'nowo normalizowana reguła nie ma autoRole', fresh);
assert(!Object.prototype.hasOwnProperty.call(fresh, 'heightMinMm') && !Object.prototype.hasOwnProperty.call(fresh, 'heightMaxMm'), 'nowy model nie zwraca heightMinMm/heightMaxMm', fresh);
assert(fresh.conditions.length === 0, 'reguła bez warunków ma pustą listę conditions', fresh);

const conditionCodes = FC.workQuantitySources.conditionList().map((row)=> row.code);
['cabinet.height_mm','cabinet.width_mm','cabinet.depth_mm','cabinet.volume_m3','front.count','hinge.count','shelf.count','drawer.count','appliance.count'].forEach((code)=> assert(conditionCodes.includes(code), `warunek ${code} jest dostępny`, conditionCodes));
['cabinet.weight_kg','cabinet.zone','cabinet.kind','appliance.type','hinge.requirement','front.max_width_mm','front.max_height_mm'].forEach((code)=> assert(!conditionCodes.includes(code), `warunek ${code} nie może być aktywny bez świadomego etapu wdrożenia`, conditionCodes));

const rates = [
  { id:'labor_rate_workshop', category:'Stawki godzinowe', name:'Warsztatowa', price:100, isHourlyRate:true, rateKey:'workshop', rateCode:'workshop', rateType:'workshop', active:true },
  { id:'labor_rate_assembly', category:'Stawki godzinowe', name:'Montażowa', price:120, isHourlyRate:true, rateKey:'assembly', rateCode:'assembly', rateType:'assembly', active:true },
  { id:'body_general', category:'Korpusy', name:'Smoke korpus ogólny', quantitySource:'cabinet.count', timeBlockHours:0.25, quantityMode:'linear', rateType:'workshop', active:true },
  { id:'body_height_ok', category:'Korpusy', name:'Smoke korpus wysokość OK', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.height_mm', operator:'range', min:721, max:1500 }], timeBlockHours:0.25, quantityMode:'linear', rateType:'workshop', active:true },
  { id:'body_height_skip', category:'Korpusy', name:'Smoke korpus wysokość NIE', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.height_mm', operator:'range', min:1501, max:2500 }], timeBlockHours:0.25, quantityMode:'linear', rateType:'workshop', active:true },
  { id:'body_missing_condition', category:'Korpusy', name:'Smoke brak danych warunku', quantitySource:'cabinet.count', conditions:[{ source:'cabinet.weight_kg', operator:'range', min:1, max:999 }], timeBlockHours:1, quantityMode:'linear', rateType:'workshop', active:true },
  { id:'shelves_rule', category:'Wnętrze', name:'Smoke półki', quantitySource:'shelf.count', timeBlockHours:0.25, quantityMode:'linear', rateType:'workshop', active:true },
  { id:'drawers_rule', category:'Wnętrze', name:'Smoke szuflady', quantitySource:'drawer.count', timeBlockHours:0.25, quantityMode:'linear', rateType:'workshop', active:true },
  { id:'labor_mount_front', category:'Elementy szafki', name:'Montaż frontu', quantitySource:'front.count', timeBlockHours:0.25, quantityMode:'linear', rateType:'assembly', active:true },
  { id:'labor_mount_hinge', category:'Elementy szafki', name:'Montaż zawiasu', quantitySource:'hinge.count', timeBlockHours:0.25, quantityMode:'linear', rateType:'assembly', active:true },
  { id:'labor_adjust_front', category:'Elementy szafki', name:'Regulacja frontu', quantitySource:'hinge.count', timeBlockHours:0.25, quantityMode:'linear', rateType:'assembly', active:true }
].map((row)=> labor.normalizeDefinition(row));
FC.catalogSelectors = { getQuoteRates:()=> rates };
load(ctx, 'js/app/wycena/wycena-core-labor.js');
load(ctx, 'js/app/quote/quote-calculation-register.js');

const laborRows = FC.wycenaCoreLabor.collectCabinetLabor(['kuchnia']);
assert(laborRows.length === 1, 'powinna powstać jedna linia robocizny dla jednej szafki', laborRows);
const details = laborRows[0].details || [];
function findName(name){ return details.find((row)=> row.name === name); }
assert(findName('Smoke korpus ogólny') && findName('Smoke korpus ogólny').quantitySource === 'cabinet.count', 'korpus bez warunku liczy się przez cabinet.count', details);
assert(findName('Smoke korpus wysokość OK') && findName('Smoke korpus wysokość OK').matchedConditions.length === 1, 'korpus z warunkiem wysokości liczy się, gdy zakres pasuje', details);
assert(!findName('Smoke korpus wysokość NIE'), 'reguła z niespełnionym warunkiem nie liczy się', details);
assert(!findName('Smoke brak danych warunku'), 'reguła z niedostępnym warunkiem nie liczy się i nie jest traktowana jak bezwarunkowa', details);
assert(findName('Smoke półki') && Number(findName('Smoke półki').quantity) === 2 && findName('Smoke półki').quantitySource === 'shelf.count', 'półki liczą się przez shelf.count', details);
assert(findName('Smoke szuflady') && Number(findName('Smoke szuflady').quantity) === 3 && findName('Smoke szuflady').quantitySource === 'drawer.count', 'szuflady liczą się przez drawer.count', details);
assert(details.some((row)=> row.sourceRole === 'front-labor' && row.quantitySource === 'front.count' && Number(row.quantity) === 2), 'montaż frontów dalej liczy się przez front.count', details);
assert(details.some((row)=> row.name === 'Regulacja frontu' && row.quantitySource === 'hinge.count' && Number(row.quantity) === 4), 'regulacja frontu dalej może liczyć się przez hinge.count', details);

const register = FC.quoteCalculationRegister.buildRegister({ labor:laborRows }, {});
const laborRegisterLines = register.lines.filter((row)=> row.section === 'labor');
assert(laborRegisterLines.some((row)=> row.name === 'Smoke korpus wysokość OK' && row.conditions.length === 1 && row.matchedConditions.length === 1), 'quoteCalculationRegister zapisuje warunki użyte przy policzeniu', laborRegisterLines);
assert(laborRegisterLines.every((row)=> row.name !== 'Smoke brak danych warunku'), 'quoteCalculationRegister nie dostaje pozycji pominiętej przez brak danych warunku', laborRegisterLines);
assert(Math.abs(register.totals.labor - laborRegisterLines.reduce((sum, row)=> sum + Number(row.total || 0), 0)) < 0.01, 'WYCENA i quoteCalculationRegister mają zgodne sumy', register.totals);

console.log('OK labor-conditions-clean-model smoke');
console.log(' - UI nie pokazuje pola Automat ani starych wysokości od/do');
console.log(' - autoRole nie jest już migrowane ani używane do zgadywania nowych reguł');
console.log(' - warunki AND są sprawdzane i niedostępny warunek nie liczy reguły');
console.log(' - quoteCalculationRegister zachowuje quantitySource oraz matchedConditions');
