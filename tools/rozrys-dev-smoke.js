#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');
const files = [
  'js/app/optimizer/cut-optimizer.js',
  'js/app/rozrys/rozrys-validation.js',
  'js/app/rozrys/rozrys-cache.js',
  'js/app/rozrys/rozrys-state.js',
  'js/app/rozrys/rozrys-pickers.js',
  'js/app/rozrys/rozrys-selection-ui.js',
  'js/app/rozrys/rozrys-scope.js',
  'js/app/rozrys/rozrys-sheet-model.js',
  'js/app/rozrys/rozrys-engine.js',
  'js/app/rozrys/rozrys-print-layout.js',
  'js/app/rozrys/rozrys.js',
  'js/testing/rozrys/fixtures.js',
  'js/testing/rozrys/tests.js',
];

const storageData = new Map();
const localStorage = {
  getItem(key){ return storageData.has(key) ? storageData.get(key) : null; },
  setItem(key, value){ storageData.set(String(key), String(value)); },
  removeItem(key){ storageData.delete(String(key)); },
  clear(){ storageData.clear(); },
};

const context = {
  console,
  setTimeout,
  clearTimeout,
  localStorage,
  __DEV_ASSETS__: {
    'css/rozrys-scope-chip-room-sync.css': fs.readFileSync(path.join(rootDir, 'css/rozrys-scope-chip-room-sync.css'), 'utf8'),
    'css/rozrys-checkbox-chip-pattern.css': fs.readFileSync(path.join(rootDir, 'css/rozrys-checkbox-chip-pattern.css'), 'utf8'),
  },
};
context.window = context;
context.globalThis = context;
context.FC = {};

vm.createContext(context);

for(const rel of files){
  const abs = path.join(rootDir, rel);
  const code = fs.readFileSync(abs, 'utf8');
  vm.runInContext(code, context, { filename: rel });
}

const runner = context.FC && context.FC.rozrysDevTests;
if(!runner || typeof runner.runAll !== 'function'){
  console.error('Brak FC.rozrysDevTests.runAll()');
  process.exit(2);
}

const report = runner.runAll();
console.log(`ROZRYS smoke tests: ${report.passed}/${report.total} OK (${report.durationMs} ms)`);
for(const row of report.results){
  const prefix = row.ok ? '✔' : '✘';
  console.log(`${prefix} ${row.name}`);
  if(!row.ok){
    if(row.message) console.log(`    ${row.message}`);
    if(row.details) console.log(`    details: ${JSON.stringify(row.details)}`);
  }
}

process.exit(report.failed > 0 ? 1 : 0);
