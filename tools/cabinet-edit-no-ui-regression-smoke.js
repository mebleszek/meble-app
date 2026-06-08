#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function assert(cond, msg){ if(!cond){ console.error('FAIL:', msg); process.exit(1); } }
const modal = fs.readFileSync(path.join(root, 'js/app/cabinet/cabinet-modal.js'), 'utf8');
const preview = fs.readFileSync(path.join(root, 'js/app/cabinet/cabinet-work-facts-preview.js'), 'utf8');
const render = fs.readFileSync(path.join(root, 'js/app/ui/cabinets-render.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(index.includes('20260608_cabinet_edit_no_ui_regression_fix_v1'), 'index ma cache-busting poprawki bez zmian UI');
assert(modal.includes('scheduleCabinetWorkFactsPreview') && modal.includes('Podgląd zostanie policzony po otwarciu okna'), 'modal zachowuje istniejący odroczony podgląd');
assert(!preview.includes('getCabinetFrontCutListForMaterials(room, clone(cab))'), 'podgląd nie odpala ciężkiego generatora frontów podczas edycji');
assert(!preview.includes('getHingeRequirementsWithQty(room, clone(cab))'), 'podgląd nie odpala ciężkiego generatora zawiasów podczas edycji');
assert(preview.includes('Use the current draft fields only') && preview.includes('Safe estimate for the preview only'), 'podgląd używa lekkiej ścieżki draftu');
assert(render.includes("doc.getElementById('floatingAdd')") && render.includes("fab.style.display = 'flex'"), 'render WYWIADU zabezpiecza widoczność istniejącego plusa');
const css = fs.readFileSync(path.join(root, 'css/cabinet-common.css'), 'utf8');
assert(css.includes('cabinet-work-facts-panel'), 'nie usunięto istniejącego panelu podglądu');
console.log('OK cabinet-edit-no-ui-regression smoke');
console.log(' - bez nowych wzorców UI');
console.log(' - podgląd szafki odciążony technicznie');
console.log(' - istniejący plus ma fallback widoczności');
