#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');

function assert(cond, msg, details){
  if(!cond){
    console.error('FAIL:', msg);
    if(details !== undefined){
      try{ console.error(JSON.stringify(details, null, 2)); }catch(_){ console.error(details); }
    }
    process.exit(1);
  }
}
function clone(v){ return JSON.parse(JSON.stringify(v)); }
function slug(value){ return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x'; }
function load(ctx, files){ files.forEach((file)=> vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename:file })); }
function createContext(){
  const storageData = new Map();
  const FC = {
    utils:{ clone, slug, uid:()=> 'uid_' + Math.random().toString(36).slice(2,8) },
    storage:{
      getJSON(key, fallback){ return storageData.has(key) ? clone(storageData.get(key)) : clone(fallback); },
      setJSON(key, value){ storageData.set(key, clone(value)); }
    },
    catalogDomain:{},
  };
  const ctx = { window:{ FC }, FC, console, Date, Math, JSON, RegExp, Number, String, Array, Object, Map, Set };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  return ctx;
}

const ctx = createContext();
load(ctx, [
  'js/app/pricing/labor-catalog-definitions.js',
  'js/app/pricing/labor-catalog.js',
  'js/app/shared/constants.js',
  'js/app/catalog/catalog-migration.js',
  'js/app/catalog/catalog-store.js',
  'js/app/catalog/catalog-selectors.js'
]);
const labor = ctx.FC.laborCatalog;

const defaultRows = labor.ensureDefaultDefinitions([]).map((row)=> labor.normalizeDefinition(row));
const rates = labor.buildRateProfiles(defaultRows);
const expected = {
  workshop:150,
  assembly:250,
  helper:80,
  specialist:300,
};
Object.entries(expected).forEach(([code, price])=>{
  const profile = rates.find((row)=> row.code === code);
  assert(profile, `brakuje systemowej stawki ${code}`, rates);
  assert(Number(profile.price) === price, `stawka ${code} ma cenę startową ${price}`, profile);
  assert(profile.nonDeletable === true && profile.systemRate === true, `stawka ${code} jest systemowa i nieusuwalna`, profile);
});


const duplicateHourlyRows = labor.ensureDefaultDefinitions([
  { id:'old_assembly_wrong_price', category:'Stawki godzinowe', name:'Stawka montażowa', price:150, autoRole:'hourlyRate', rateKey:'assembly', rateCode:'assembly', rateType:'assembly', active:true, starterPrice:false, priceUserEditedAt:'2026-06-07T20:00:00.000Z' },
  { id:'old_specialist_wrong_price', category:'Stawki godzinowe', name:'Stawka specjalistyczna', price:250, autoRole:'hourlyRate', rateKey:'specialist', rateCode:'specialist', rateType:'specialist', active:true, starterPrice:false, priceUserEditedAt:'2026-06-07T20:01:00.000Z' },
]);
const duplicateHourly = duplicateHourlyRows.filter((row)=> labor.isHourlyRateDefinition(row));
const duplicateCounts = duplicateHourly.reduce((acc, row)=>{ const code = labor.hourlyRateCodeFromRow(row); acc[code] = (acc[code] || 0) + 1; return acc; }, {});
Object.keys(expected).forEach((code)=> assert(duplicateCounts[code] === 1, `po migracji zostaje jedna stawka godzinowa dla ${code}`, { duplicateCounts, duplicateHourly }));
const duplicateMap = labor.buildHourlyRates(duplicateHourlyRows);
assert(Number(duplicateMap.assembly) === 250 && Number(duplicateMap.specialist) === 300, 'migracja usuwa zdublowane błędne systemowe stawki i przywraca ceny bazowe', duplicateMap);

const customRate = { id:'labor_rate_painter', category:'Stawki godzinowe', name:'Lakiernik', price:220, autoRole:'hourlyRate', workAutomatCode:'manual_hourly', rateKey:'painter', rateCode:'painter', rateType:'painter', active:true, nonDeletable:true };
const rowsWithCustom = defaultRows.concat([customRate]);
const customProfile = labor.findRateProfile(rowsWithCustom, 'painter');
assert(customProfile && customProfile.label === 'Lakiernik' && Number(customProfile.price) === 220, 'nowa stawka godzinowa jest widoczna jako profil', customProfile);
assert(labor.rateProfileOptions(rowsWithCustom, 'painter').some((row)=> row.value === 'painter' && /Lakiernik/.test(row.label)), 'nowa stawka pojawia się w opcjach pola Stawka godzinowa');

const invalid = labor.validateRateProfile({ rateKey:'lakiernik ąć', name:'Lakiernik', price:220 }, rowsWithCustom);
assert(!invalid.ok && invalid.code === 'format', 'kod stawki bez spacji i polskich znaków', invalid);
const duplicate = labor.validateRateProfile({ rateKey:'painter', name:'Duplikat', price:230 }, rowsWithCustom);
assert(!duplicate.ok && duplicate.code === 'duplicate', 'kod stawki godzinowej jest unikalny', duplicate);
const immutable = labor.validateRateProfile({ rateKey:'painter_v2', name:'Lakiernik', price:220 }, rowsWithCustom, { oldCode:'painter' });
assert(!immutable.ok && immutable.code === 'immutable', 'kod stawki godzinowej nie zmienia się po utworzeniu', immutable);
const friendlyEdit = labor.validateRateProfile({ rateKey:'painter', name:'Lakiernik premium', price:240 }, rowsWithCustom.filter((row)=> row.id !== 'labor_rate_painter'), { oldCode:'painter' });
assert(friendlyEdit.ok && friendlyEdit.item.code === 'painter' && friendlyEdit.item.label === 'Lakiernik premium', 'nazwa przyjazna i kwota mogą się zmienić bez zmiany kodu', friendlyEdit);

const hourlyMap = labor.buildHourlyRates(rowsWithCustom);
assert(Number(hourlyMap.helper) === 80 && Number(hourlyMap.painter) === 220, 'mapa stawek ma systemowe i własne profile', hourlyMap);
const calcPainter = labor.calculateDefinition({ id:'labor_custom_paint', name:'Lakierowanie próbne', price:0, autoRole:'none', rateType:'painter', timeBlockHours:1, defaultMultiplier:1, quantityMode:'none', active:true }, { quantity:1, hourlyRates:hourlyMap });
assert(calcPainter && Number(calcPainter.total) === 220, 'czynność liczona jest po wybranym rateType painter, nie po najniższej stawce', calcPainter);
const calcHelper = labor.calculateDefinition({ id:'labor_custom_carry', name:'Wnoszenie próbne', price:0, autoRole:'none', rateType:'helper', timeBlockHours:1, defaultMultiplier:1, quantityMode:'none', active:true }, { quantity:1, hourlyRates:hourlyMap });
assert(calcHelper && Number(calcHelper.total) === 80, 'ta sama reguła może użyć innego wybranego profilu stawki', calcHelper);

const stored = ctx.FC.catalogSelectors.getQuoteRates();
const storedRates = labor.buildRateProfiles(stored);
Object.keys(expected).forEach((code)=> assert(storedRates.some((row)=> row.code === code), `catalogStore zachowuje systemową stawkę ${code}`, storedRates));

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(html.includes('id="laborIsHourlyRate"'), 'formularz ma ptaszek: To jest stawka godzinowa');
assert(html.includes('id="laborRateCode"'), 'formularz ma kod techniczny stawki godzinowej');
assert(html.includes('id="laborRateProfileFields"') && html.includes('id="laborRuleFields"'), 'formularz rozdziela prostą stawkę godzinową od reguły czynności');

console.log('OK labor-rate-profiles-foundation smoke');
console.log(' - systemowe stawki godzinowe mają ceny 150/250/80/300 i są nieusuwalne');
console.log(' - można dodać własną stawkę godzinową, np. painter / Lakiernik');
console.log(' - kod stawki jest unikalny, walidowany i niezmienny');
console.log(' - czynność liczy po wybranym rateType, nie po najniższej stawce');
console.log(' - UI ma tryb prostej stawki godzinowej');
