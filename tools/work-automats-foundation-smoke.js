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
  const FC = { utils:{ clone, slug } };
  const ctx = { window:{ FC }, FC, console, Date };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  return ctx;
}

const ctx = createContext();
load(ctx, ['js/app/pricing/labor-catalog-definitions.js', 'js/app/pricing/labor-catalog.js']);
const labor = ctx.FC.laborCatalog;
const required = ['cabinet_body','front_mount','hinge_mount','shelf_mount','dishwasher_mount','fridge_mount','oven_mount','hob_mount','hood_mount','microwave_mount','manual_hourly','manual_fixed'];
const automats = labor.ensureDefaultWorkAutomats([]);
required.forEach((code)=> assert(automats.some((row)=> row.code === code), `brakuje startowego automatu ${code}`, automats));

const duplicate = labor.validateWorkAutomat({ code:'front_mount', label:'Duplikat frontu' }, automats);
assert(!duplicate.ok && duplicate.code === 'duplicate', 'kod techniczny automatu musi być unikalny', duplicate);

['montaz frontu','montaż_frontu','FrontMount','front-mount'].forEach((code)=>{
  const result = labor.validateWorkAutomat({ code, label:'Błędny kod' }, []);
  assert(!result.ok && result.code === 'format', `błędny format kodu powinien być odrzucony: ${code}`, result);
});

const immutable = labor.validateWorkAutomat({ code:'front_mount_v2', label:'Nowy front' }, automats, { oldCode:'front_mount' });
assert(!immutable.ok && immutable.code === 'immutable', 'kod techniczny istniejącego automatu nie może się zmienić', immutable);

const labelEdit = labor.upsertWorkAutomat(automats, { code:'front_mount', label:'Montaż frontów — nazwa po edycji', active:true }, { oldCode:'front_mount' });
assert(labelEdit.ok, 'nazwa przyjazna automatu może się zmienić', labelEdit);
assert(labelEdit.item.code === 'front_mount' && labelEdit.item.label === 'Montaż frontów — nazwa po edycji', 'edycja nazwy nie zmienia kodu technicznego', labelEdit.item);

const added = labor.upsertWorkAutomat(automats, { code:'pipe_cutout', label:'Wcięcie na rury', active:true }, {});
assert(added.ok && added.item.code === 'pipe_cutout', 'można utworzyć nowy automat z własnym kodem technicznym', added);

const defs = labor.DEFAULT_HOURLY_RATES.concat(labor.DEFAULT_LABOR_DEFINITIONS).map((row)=> labor.normalizeDefinition(row));
function def(id){ return defs.find((row)=> row.id === id); }
assert(def('labor_body_h072').workAutomatCode === 'cabinet_body', 'skręcenie korpusu ma automat cabinet_body', def('labor_body_h072'));
assert(def('labor_mount_front').workAutomatCode === 'front_mount', 'montaż frontu ma automat front_mount', def('labor_mount_front'));
assert(def('labor_mount_hinge').workAutomatCode === 'hinge_mount', 'montaż zawiasu ma automat hinge_mount', def('labor_mount_hinge'));
assert(def('labor_loose_shelves').workAutomatCode === 'shelf_mount', 'półki mają automat shelf_mount', def('labor_loose_shelves'));
assert(def('labor_rate_workshop').workAutomatCode === 'manual_hourly', 'stawki godzinowe mają automat manual_hourly', def('labor_rate_workshop'));
assert(labor.inferWorkAutomatCode({ name:'Zmywarka do zabudowy' }) === 'dishwasher_mount', 'AGD: zmywarka mapuje się na osobny automat');
assert(labor.inferWorkAutomatCode({ name:'Lodówka do zabudowy' }) === 'fridge_mount', 'AGD: lodówka mapuje się na osobny automat');
assert(labor.inferWorkAutomatCode({ name:'Piekarnik do zabudowy' }) === 'oven_mount', 'AGD: piekarnik mapuje się na osobny automat');
assert(labor.inferWorkAutomatCode({ name:'Płyta indukcyjna / ceramiczna' }) === 'hob_mount', 'AGD: płyta mapuje się na osobny automat');
assert(labor.inferWorkAutomatCode({ name:'Okap podszafkowy / teleskopowy' }) === 'hood_mount', 'AGD: okap mapuje się na osobny automat');

load(ctx, ['js/app/shared/constants.js', 'js/app/catalog/catalog-migration.js', 'js/app/catalog/catalog-store.js', 'js/app/catalog/catalog-selectors.js']);
const storeAutomats = ctx.FC.catalogStore.getLaborAutomats();
required.forEach((code)=> assert(storeAutomats.some((row)=> row.code === code), `catalogStore przechowuje startowy automat ${code}`, storeAutomats));
assert(ctx.FC.catalogSelectors.getFurnitureCatalogSnapshot().laborAutomats.length >= required.length, 'snapshot katalogu zawiera słownik automatów robocizny');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(/id="laborAutoRole"[^>]*hidden=""|hidden=""[^>]*id="laborAutoRole"/.test(html), 'select automatu robocizny jest ukryty pod launcherem aplikacji');
assert(html.includes('id="laborAutomatCodePreview"'), 'formularz pokazuje kod techniczny automatu');
assert(html.includes('id="laborAutomatCreateBtn"') && html.includes('id="laborAutomatEditBtn"'), 'formularz ma aplikacyjne akcje dodania/edycji automatu');

console.log('OK work-automats-foundation smoke');
console.log(' - startowe automaty systemowe istnieją');
console.log(' - kod techniczny jest unikalny, walidowany i niezmienny');
console.log(' - nazwa przyjazna automatu może się zmienić');
console.log(' - istniejące stawki jednoznaczne mają workAutomatCode');
console.log(' - catalogStore przechowuje słownik automatów robocizny');
