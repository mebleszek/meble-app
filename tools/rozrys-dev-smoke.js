#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');
const files = [
  'js/app/cut-optimizer.js',
  'js/app/rozrys-validation.js',
  'js/app/rozrys-cache.js',
  'js/app/rozrys-state.js',
  'js/app/rozrys-scope.js',
  'js/app/rozrys-sheet-model.js',
  'js/app/rozrys-engine.js',
  'js/app/rozrys-print-layout.js',
  'js/app/rozrys.js',
  'js/app/rozrys-dev-fixtures.js',
  'js/app/rozrys-dev-tests.js',
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

process.exit(report.ok ? 0 : 1);
