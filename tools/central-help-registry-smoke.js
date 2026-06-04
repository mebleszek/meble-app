#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function assert(cond, msg, details){ if(!cond){ console.error('FAIL:', msg); if(details) console.error(details); process.exit(1); } }
function load(files){
  const FC = {};
  const ctx = { window:{ FC }, FC, console };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  files.forEach((file)=> vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename:file }));
  return ctx.window.FC;
}
const FC = load(['js/app/shared/help-registry.js', 'js/app/catalog/hardware-technical-params.js']);
assert(FC.helpRegistry && typeof FC.helpRegistry.lookup === 'function', 'Brak centralnego rejestru helperów');
assert(FC.hardwareTechnicalParams && FC.hardwareTechnicalParams.FIELD_HELP, 'Brak FIELD_HELP danych technicznych');
const help = FC.hardwareTechnicalParams.FIELD_HELP;
function msg(key){ return String(help[key] || ''); }
['pokrycie_prowadnika','forma_prowadnika','typ_prowadnika','system_kompatybilnosci','kat_rzeczywisty','klasa_kata','rola_kompletu','hamulec','sprezyna'].forEach((key)=>{
  assert(msg(key).length > 20, 'Brak indywidualnego opisu dla: ' + key);
  assert(!/To nazwa pola technicznego/i.test(msg(key)), 'Pole ma generyczny placeholder zamiast instrukcji: ' + key, msg(key));
});
assert(/w komplecie/i.test(msg('pokrycie_prowadnika')) && /osobno/i.test(msg('pokrycie_prowadnika')), 'Pokrycie prowadnika musi tłumaczyć w komplecie/osobno', msg('pokrycie_prowadnika'));
assert(/krzyżowy|prosty/i.test(msg('forma_prowadnika')), 'Forma prowadnika musi tłumaczyć prosty/krzyżowy', msg('forma_prowadnika'));
assert(/nie ustawiono/i.test(msg('hamulec')), 'Hamulec musi tłumaczyć trzeci stan „nie ustawiono”', msg('hamulec'));
const defs = FC.hardwareTechnicalParams.DEFAULT_DEFINITIONS || [];
const missing = [];
defs.filter((row)=> row && row.active !== false).forEach((row)=>{
  const key = String(row.key || '');
  if(!key) return;
  if(!msg(key)) missing.push(key);
});
assert(!missing.length, 'Aktywne parametry techniczne bez opisu helpera', missing.join(', '));
const formSrc = fs.readFileSync(path.join(root, 'js/app/material/price-modal-hardware-form.js'), 'utf8');
assert(formSrc.includes('resolveTechHelp'), 'Formularz okuć ma używać centralnego resolveTechHelp');
assert(formSrc.includes('field.key, { field'), 'Dynamiczne pola muszą podpinać helper po konkretnym kluczu pola');
assert(!formSrc.includes("field.fieldType === 'numberRange' ? 'valueFrom' : 'name'"), 'Dynamiczne pola nadal używają generycznego helpera name/valueFrom');
const dictSrc = fs.readFileSync(path.join(root, 'js/app/material/price-modal-hardware-dictionaries.js'), 'utf8');
assert(dictSrc.includes('FC.helpRegistry') && dictSrc.includes('hardwareTechnical.'), 'Słowniki okuć mają czytać helpy przez centralny rejestr');
const priceHelpSrc = fs.readFileSync(path.join(root, 'js/app/material/price-modal-field-help.js'), 'utf8');
assert(priceHelpSrc.includes("register('priceField'") && priceHelpSrc.includes('resolveFieldHelp'), 'Formularze cenników mają rejestrować helpy w centralnym rejestrze');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(index.indexOf('js/app/shared/help-registry.js') > -1 && index.indexOf('js/app/shared/help-registry.js') < index.indexOf('js/app/catalog/hardware-technical-params.js'), 'help-registry musi ładować się przed hardware-technical-params');
console.log('OK central-help-registry smoke');
