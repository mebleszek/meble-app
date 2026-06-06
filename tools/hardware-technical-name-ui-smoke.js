#!/usr/bin/env node
// Smoke: edycja okucia ma nazwę katalogową + podgląd nazwy technicznej, bez widocznego starego pickera Typ/Cecha.
const fs = require('fs');
const path = require('path');
const root = process.cwd();
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(ok, msg){ if(!ok) throw new Error(msg); }
const html = read('index.html');
const form = read('js/app/material/price-modal-hardware-form.js');
const itemForm = read('js/app/material/price-modal-item-form.js');
const help = read('js/app/material/price-modal-field-help.js');
const dict = read('js/app/material/price-modal-hardware-dictionaries.js');
const tech = read('js/app/catalog/hardware-technical-params.js');
const css = read('css/price-item-popup.css');
const exportXlsx = read('js/app/catalog/hardware-catalog-export-xlsx.js');
const supplierExport = read('js/app/catalog/hardware-supplier-price-export.js');

assert(html.includes('id="formNameLabel"'), 'Brak labela Nazwa katalogowa / Nazwa');
assert(html.includes('id="hardwareTechnicalNamePreviewWrap"') && html.includes('Nazwa techniczna'), 'Brak podglądu Nazwy technicznej pod nazwą katalogową');
assert(!html.includes('<label>Typ / cecha</label>'), 'Widoczne pole Typ / cecha nadal jest w formularzu');
assert(html.includes('id="hardwareTypeHiddenWrap" style="display:none"'), 'Wewnętrzne pole hardwareType nie jest ukryte');
assert(itemForm.includes("setFormNameLabel(cfg.formKind === 'accessory' ? 'Nazwa katalogowa' : 'Nazwa')"), 'Edycja okucia nie zmienia labela na Nazwa katalogowa');
assert(form.includes('function updateTechnicalNamePreview') && form.includes('syncHardwareTypeFromTechnicalParams'), 'Formularz nie aktualizuje podglądu nazwy technicznej');
assert(!help.includes("id:'hardwareType'"), 'Helper nadal traktuje hardwareType jako widoczne pole formularza');
assert(dict.includes('Użyj do porównania') && dict.includes('Buduje nazwę techniczną'), 'Słowniki nie mają nowych nazw checkboxów');
assert(!dict.includes('Cecha kluczowa') && !dict.includes('Buduje typ'), 'Słowniki nadal zawierają stare etykiety checkboxów');
assert(tech.includes('buildTechnicalName:buildTypeLabel'), 'Brak aliasu buildTechnicalName');
assert(css.includes('.hardware-technical-name-preview'), 'Brak CSS podglądu nazwy technicznej');
assert(exportXlsx.includes('nazwa_techniczna') && !exportXlsx.includes("'typ_cecha','hardwareType'"), 'Eksport XLSX nie używa nazwa_techniczna jako widocznej kolumny');
assert(supplierExport.includes('nazwa_techniczna') && !supplierExport.includes("['typ_cecha','itemType']"), 'Eksport cen dostawców nie używa nazwa_techniczna');
console.log('OK hardware technical name UI smoke');
