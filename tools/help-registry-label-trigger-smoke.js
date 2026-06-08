#!/usr/bin/env node
const fs = require('fs');
const src = fs.readFileSync('js/app/shared/help-registry.js', 'utf8');
function assert(cond, msg){
  if(!cond){
    console.error('FAIL:', msg);
    process.exit(1);
  }
}
const start = src.indexOf('function labelWithInfo');
assert(start >= 0, 'Brak funkcji labelWithInfo w help-registry');
const end = src.indexOf('function auditInfoButtons', start);
assert(end > start, 'Nie znaleziono końca funkcji labelWithInfo');
const block = src.slice(start, end);
assert(block.includes("triggerClassName:'info-trigger'"), 'labelWithInfo musi mieć osobną klasę triggera info-trigger');
assert(block.includes('const triggerCfg = Object.assign({}, cfg'), 'labelWithInfo musi budować osobny triggerCfg dla przycisku ?');
assert(block.includes("className:text(cfg.triggerClassName) || 'info-trigger'"), 'Przycisk ? nie może dziedziczyć klasy wiersza label-help');
assert(!/row\.appendChild\(createTrigger\(cfg\)\)/.test(block), 'labelWithInfo nadal przekazuje do przycisku klasę wiersza label-help');
assert(!/btn\.className\s*=\s*text\(cfg\.className\)\s*\|\|\s*'label-help'/.test(src), 'createTrigger nie może tworzyć przycisku z domyślną klasą label-help');

const index = fs.readFileSync('index.html', 'utf8');
assert(index.includes('js/app/shared/help-registry.js?v=20260609_work_quantity_sources_settings_clean_v1'), 'index.html musi ładować help-registry.js z cache-bustingiem v2');
console.log('help-registry-label-trigger-smoke OK');
