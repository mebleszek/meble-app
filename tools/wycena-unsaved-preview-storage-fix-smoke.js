#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg){ if(!cond){ console.error('FAIL:', msg); process.exit(1); } }
const shell = read('js/app/wycena/wycena-tab-shell.js');
const preview = read('js/app/wycena/wycena-tab-preview.js');
const store = read('js/app/quote/quote-snapshot-store.js');
const diag = read('js/app/wycena/wycena-diagnostics.js');
const css = read('css/wycena.css');
const index = read('index.html');
const VERSION = '20260616_project_preparation_section_v1';
assert(index.includes(VERSION), 'index.html ma aktualny cache-busting dla poprawki WYCENY');
assert(diag.includes("const BUILD = '20260616_project_preparation_section_v1'"), 'diagnostyka WYCENY ma aktualny build');
assert(shell.includes('function isSnapshotStorageError'), 'shell rozpoznaje błąd zapisu historii WYCENY');
assert(shell.includes('function buildUnsavedStoragePreviewQuote'), 'shell buduje podgląd bez zapisu historii');
assert(shell.includes('quoteStorageSaveFailedUnsavedPreview'), 'shell zapisuje diagnostykę podglądu bez historii');
assert(shell.includes("previewSnapshotId:''"), 'podgląd bez historii nie udaje zapisanego snapshotu');
assert(preview.includes('quote-storage-warning'), 'preview pokazuje ostrzeżenie o braku zapisu historii');
assert(preview.includes('Podgląd bez zapisu historii'), 'preview ma czytelną etykietę podglądu bez historii');
assert(store.includes('unsavedDueToStorage'), 'normalizacja snapshotu zachowuje flagę unsavedDueToStorage');
assert(store.includes('storageErrorMessage'), 'normalizacja snapshotu zachowuje komunikat błędu storage');
assert(css.includes('.quote-storage-warning'), 'CSS ma styl ostrzeżenia storage w WYCENIE');
console.log('wycena unsaved preview storage fix smoke: OK');
