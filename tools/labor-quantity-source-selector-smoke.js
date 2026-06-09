#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg){ if(!cond){ console.error('FAIL:', msg); process.exit(1); } }
function load(rel, ctx){ vm.runInContext(read(rel), ctx, { filename: rel }); }

const VERSION = '20260609_labor_quantity_source_selector_v1';
const index = read('index.html');
const dev = read('dev_tests.html');
const itemForm = read('js/app/material/price-modal-item-form.js');
const help = read('js/app/material/price-modal-field-help.js');
const catalog = read('js/app/pricing/labor-catalog.js');
const defs = read('js/app/pricing/labor-catalog-definitions.js');
const sources = read('js/app/pricing/work-quantity-sources.js');
const modal = read('js/app/cabinet/cabinet-modal.js');
const cabinetsRender = read('js/app/ui/cabinets-render.js');

assert(index.includes('id="laborQuantitySource"'), 'Brak pola laborQuantitySource w formularzu cennika robocizny.');
assert(index.includes('Źródło ilości'), 'Formularz musi pokazywać etykietę Źródło ilości.');
assert(itemForm.includes("id:'laborQuantitySource'"), 'laborQuantitySource musi być obsługiwane przez aplikacyjny launcher, nie natywny select.');
assert(itemForm.includes('refreshLaborQuantitySourceSelect'), 'Brak odświeżania listy źródeł ilości.');
assert(itemForm.includes('quantitySource:readString(\'laborQuantitySource\')'), 'Wybór źródła ilości musi zapisywać się w draftcie pozycji robocizny.');
assert(itemForm.includes("setValue('laborQuantitySource'"), 'Edycja pozycji musi przywracać zapisane źródło ilości.');
assert(help.includes('laborQuantitySource') && help.includes('Ten etap zapisuje wybór w cenniku'), 'Brak pomocy ? dla pola Źródło ilości.');
assert(catalog.includes('normalizeQuantitySource') && catalog.includes('quantitySourceOptions'), 'laborCatalog musi normalizować i wystawiać opcje źródeł ilości.');
assert(defs.includes("quantitySource:'front.count'") && defs.includes("quantitySource:'hinge.count'") && defs.includes("quantitySource:'shelf.count'"), 'Startowe pozycje robocizny powinny mieć sugestie źródeł ilości.');
assert(sources.includes('quantityOptions') && sources.includes('canUseAsQuantitySource'), 'Słownik źródeł musi wystawiać opcje do wyboru w cenniku.');
assert(!modal.includes('cmWorkFactsPreview') && !modal.includes('workQuantityFacts'), 'Nie wolno w tym etapie podpinać niczego do modala szafki.');
assert(!cabinetsRender.includes('workQuantityFacts') && !cabinetsRender.includes('cmWorkFactsPreview'), 'Nie wolno w tym etapie podpinać niczego do renderu szafek.');
assert(index.includes(VERSION) && dev.includes(VERSION), 'Brak aktualnego cache-bustingu etapu w index/dev_tests.');

const wycenaFiles = fs.readdirSync(path.join(root, 'js/app/wycena')).filter((name)=> name.endsWith('.js'));
wycenaFiles.forEach((name)=> {
  assert(!read('js/app/wycena/' + name).includes('quantitySource'), 'Ten etap nie powinien podpinać quantitySource do WYCENY: ' + name);
});

const ctx = vm.createContext({ window:{}, console });
ctx.window.FC = { utils:{ clone:(v)=> JSON.parse(JSON.stringify(v)), uid:()=> 'uid_test' } };
load('js/app/pricing/labor-catalog-definitions.js', ctx);
load('js/app/pricing/labor-catalog.js', ctx);
load('js/app/pricing/work-quantity-sources.js', ctx);
const FC = ctx.window.FC;
const labor = FC.laborCatalog;
const sourceApi = FC.workQuantitySources;
assert(labor && sourceApi, 'Nie zarejestrowano API laborCatalog/workQuantitySources.');
const opts = labor.quantitySourceOptions('hinge.count');
assert(opts.some((row)=> row.value === 'front.count'), 'Opcje źródeł muszą zawierać front.count.');
assert(opts.some((row)=> row.value === 'hinge.count'), 'Opcje źródeł muszą zawierać hinge.count.');
assert(opts.some((row)=> row.value === 'shelf.count'), 'Opcje źródeł muszą zawierać shelf.count.');
assert(!opts.some((row)=> row.value === 'appliance.type'), 'Tekstowy typ AGD nie powinien być źródłem ilości.');
assert(!opts.some((row)=> row.value === 'routing.count'), 'Planowane routing.count nie powinno być aktywnym wyborem ilości.');
const frontDef = labor.normalizeDefinition({ id:'labor_mount_front', category:'Elementy szafki', name:'Montaż frontu', autoRole:'none', rateType:'assembly' });
assert(frontDef.quantitySource === 'front.count', 'Montaż frontu powinien domyślnie wskazać front.count.');
const hingeDef = labor.normalizeDefinition({ id:'labor_mount_hinge', category:'Elementy szafki', name:'Montaż zawiasu', autoRole:'none', rateType:'assembly' });
assert(hingeDef.quantitySource === 'hinge.count', 'Montaż zawiasu powinien domyślnie wskazać hinge.count.');
const custom = labor.normalizeDefinition({ id:'labor_custom', name:'Frezowanie', quantitySource:'cabinet.height_mm', rateType:'specialist' });
assert(custom.quantitySource === 'cabinet.height_mm', 'Własne źródło ilości musi zostać zachowane w definicji.');
const bad = labor.normalizeDefinition({ id:'labor_bad', name:'Błąd', quantitySource:'Źle wpisane', rateType:'workshop' });
assert(bad.quantitySource === '', 'Niepoprawny kod źródła ilości nie może wejść do definicji.');

console.log('OK labor-quantity-source-selector smoke');
console.log(' - wybór źródła ilości zapisuje się w cenniku robocizny');
console.log(' - WYCENA i modal szafki nie są podpinane w tym etapie');
