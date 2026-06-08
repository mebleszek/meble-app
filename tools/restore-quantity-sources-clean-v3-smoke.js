#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function assert(cond, msg){ if(!cond){ console.error('FAIL:', msg); process.exit(1); } }
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cabinetModal = fs.readFileSync(path.join(root, 'js/app/cabinet/cabinet-modal.js'), 'utf8');
const cabinetsRender = fs.readFileSync(path.join(root, 'js/app/ui/cabinets-render.js'), 'utf8');
assert(!index.includes('cabinet-work-facts-preview.js'), 'index nie może ładować panelu work facts preview');
assert(!fs.existsSync(path.join(root, 'js/app/cabinet/cabinet-work-facts-preview.js')), 'paczka nie może zawierać cabinet-work-facts-preview.js');
assert(!cabinetModal.includes('cmWorkFactsPreview'), 'modal szafki nie może mieć hosta cmWorkFactsPreview');
assert(!cabinetsRender.includes('ensureCabinet'), 'cabinets-render nie może zawierać sztucznej łaty plusa');
assert(index.includes('js/app/pricing/work-quantity-sources.js'), 'zostaje słownik Dane do czynności i wyceny');
assert(index.includes('css/cabinet-common.css?v=20260608_restore_quantity_sources_clean_v3'), 'cabinet-common ma świeży cache-busting');
assert(index.includes('js/app/cabinet/cabinet-modal.js?v=20260608_restore_quantity_sources_clean_v3'), 'cabinet-modal ma świeży cache-busting');
assert(index.includes('js/app/ui/cabinets-render.js?v=20260608_restore_quantity_sources_clean_v3'), 'cabinets-render ma świeży cache-busting');
console.log('OK restore-quantity-sources-clean-v3 smoke');
