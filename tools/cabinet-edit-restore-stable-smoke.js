#!/usr/bin/env node
const fs = require('fs');
function assert(cond, msg){ if(!cond){ console.error('FAIL:', msg); process.exitCode = 1; } }
const index = fs.readFileSync('index.html','utf8');
const modal = fs.readFileSync('js/app/cabinet/cabinet-modal.js','utf8');
const render = fs.readFileSync('js/app/ui/cabinets-render.js','utf8');
assert(!index.includes('cmWorkFactsPreview'), 'modal szafki nie może mieć hosta cmWorkFactsPreview w awaryjnej paczce stabilizującej');
assert(!index.includes('cabinet-work-facts-preview.js'), 'index nie może ładować modułu cabinet-work-facts-preview.js w awaryjnej paczce stabilizującej');
assert(!fs.existsSync('js/app/cabinet/cabinet-work-facts-preview.js'), 'moduł cabinet-work-facts-preview.js nie powinien być w paczce stabilizującej');
assert(!modal.includes('cabinetWorkFactsPreview'), 'cabinet-modal.js nie może odwoływać się do cabinetWorkFactsPreview');
assert(!render.includes('floatingAdd') || !render.includes('appView && appView.style.display'), 'cabinets-render.js nie może mieć sztucznego wymuszania plusa dodanego jako łata UI');
assert(index.includes('js/app/cabinet/cabinet-modal.js?v=20260608_cabinet_edit_restore_stable_v1'), 'cabinet-modal.js musi mieć nowy cache-busting stabilizacji');
if(!process.exitCode) console.log('OK cabinet edit restore stable smoke');
