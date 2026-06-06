#!/usr/bin/env node
// Smoke: zmiany w słownikach parametrów technicznych muszą pokazać Zapisz/Anuluj i dać się zapisać.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = process.cwd();
function assert(cond, msg){ if(!cond) throw new Error(msg); }
const FC = {};
const ctx = { window:{ FC }, FC, console };
ctx.globalThis = ctx.window;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/app/catalog/hardware-technical-params.js'), 'utf8'), ctx, { filename:'hardware-technical-params.js' });
const api = ctx.window.FC.hardwareTechnicalParams;
assert(api && typeof api.normalizeDefinition === 'function', 'Brak normalizeDefinition');
const changedAngleClass = api.normalizeDefinition({
  category:'Zawiasy',
  key:'klasa_kata',
  label:'Klasa / zakres zamienności kąta',
  fieldType:'text',
  options:['standardowy 90–120°'],
  keyFeature:false,
  typePart:false,
  compareMode:'ignore',
  active:false,
  order:77
}, 0);
assert(changedAngleClass.keyFeature === false, 'normalizeDefinition nadpisuje Użyj do porównania dla klasa_kata');
assert(changedAngleClass.typePart === false, 'normalizeDefinition nadpisuje Buduje nazwę techniczną dla klasa_kata');
assert(changedAngleClass.compareMode === 'ignore', 'normalizeDefinition nadpisuje sposób porównania dla klasa_kata');
assert(changedAngleClass.active === false, 'normalizeDefinition nadpisuje aktywność dla klasa_kata');
assert(changedAngleClass.order === 77, 'normalizeDefinition nadpisuje kolejność dla klasa_kata');
const changedAngle = api.normalizeDefinition({
  category:'Zawiasy',
  key:'kat_rzeczywisty',
  label:'Kąt rzeczywisty / nominalny',
  keyFeature:true,
  typePart:false,
  compareMode:'equal'
}, 0);
assert(changedAngle.keyFeature === true, 'normalizeDefinition nie pozwala włączyć porównania kąta rzeczywistego');
assert(changedAngle.typePart === false, 'normalizeDefinition nie pozwala wyłączyć kąta z nazwy technicznej');
assert(changedAngle.compareMode === 'equal', 'normalizeDefinition nie zapisuje zmiany sposobu porównania kąta rzeczywistego');
const defaultAngle = api.normalizeDefinition({ category:'Zawiasy', key:'kat_rzeczywisty', label:'Kąt rzeczywisty / nominalny' }, 0);
assert(defaultAngle.keyFeature === false && defaultAngle.typePart === true && defaultAngle.compareMode === 'ignore', 'Domyślne ustawienia kąta rzeczywistego są niepoprawne');
const dict = fs.readFileSync(path.join(root, 'js/app/material/price-modal-hardware-dictionaries.js'), 'utf8');
assert(dict.includes('let userTouched = false'), 'Modal słowników nie ma flagi zmian użytkownika');
assert(dict.includes('function isDirty(){ return userTouched || signature(categories, params) !== cleanSignature; }'), 'Przyciski Zapisz/Anuluj nie reagują na samą zmianę użytkownika');
assert(dict.includes('function markTouched(){ userTouched = true; updateActions(); }'), 'Brak markTouched dla zmian w parametrach');
assert(dict.includes('categoryAccordion(cat, params, markTouched)'), 'Zmiany parametrów technicznych nie podpinają markTouched');
console.log('OK hardware dictionary save actions smoke');
