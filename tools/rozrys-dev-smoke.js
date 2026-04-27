#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');
const files = [
  'js/app/optimizer/cut-optimizer.js',
  'js/app/optimizer/speed-max-core.js',
  'js/app/optimizer/speed-max-bands.js',
  'js/app/optimizer/speed-max-sheet-plan.js',
  'js/app/optimizer/speed-max-half-sheet.js',
  'js/app/optimizer/speed-max.js',
  'js/app/rozrys/rozrys-validation.js',
  'js/app/rozrys/rozrys-cache.js',
  'js/app/rozrys/rozrys-prefs.js',
  'js/app/rozrys/rozrys-project-source.js',
  'js/app/rozrys/rozrys-part-helpers.js',
  'js/app/rozrys/rozrys-runtime-utils.js',
  'js/app/rozrys/rozrys-plan-helpers.js',
  'js/app/rozrys/rozrys-engine-bridge.js',
  'js/app/rozrys/rozrys-ui-tools.js',
  'js/app/rozrys/rozrys-ui-bridge.js',
  'js/app/rozrys/rozrys-panel-workspace.js',
  'js/app/rozrys/rozrys-runtime-bundle.js',
  'js/app/rozrys/rozrys-controller-bridges.js',
  'js/app/rozrys/rozrys-render-compose.js',
  'js/app/rozrys/rozrys-run-controller.js',
  'js/app/rozrys/rozrys-output-controller.js',
  'js/app/rozrys/rozrys-state.js',
  'js/app/rozrys/rozrys-pickers.js',
  'js/app/rozrys/rozrys-selection-ui.js',
  'js/app/rozrys/rozrys-scope.js',
  'js/app/rozrys/rozrys-sheet-model.js',
  'js/app/rozrys/rozrys-engine.js',
  'js/app/rozrys/rozrys-stock.js',
  'js/app/rozrys/rozrys-lists.js',
  'js/app/rozrys/rozrys-summary.js',
  'js/app/rozrys/rozrys-render.js',
  'js/app/rozrys/rozrys-accordion.js',
  'js/app/rozrys/rozrys-print-layout.js',
  'js/app/rozrys/rozrys.js',
  'js/testing/rozrys/fixtures.js',
  'js/testing/rozrys/suites/state-ui-runtime.js',
  'js/testing/rozrys/suites/helpers-bridges.js',
  'js/testing/rozrys/suites/scope-runtime-controllers.js',
  'js/testing/rozrys/suites/output-bootstrap.js',
  'js/testing/rozrys/suites/project-stock.js',
  'js/testing/rozrys/suites/optimizer-contracts.js',
  'js/testing/rozrys/suites/validation-cache-render.js',
  'js/testing/rozrys/tests.js',
];

const storageData = new Map();
const localStorage = {
  getItem(key){ return storageData.has(key) ? storageData.get(key) : null; },
  setItem(key, value){ storageData.set(String(key), String(value)); },
  removeItem(key){ storageData.delete(String(key)); },
  clear(){ storageData.clear(); },
};


class FakeNode {
  constructor(tag){
    this.tagName = String(tag || '').toUpperCase();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.parentNode = null;
    this._className = '';
    this.textContent = '';
    this.innerHTML = '';
    this.__listeners = {};
    this.classList = {
      add: (...names)=>{
        const cur = new Set(String(this._className || '').split(/\s+/).filter(Boolean));
        names.forEach((name)=> cur.add(String(name)));
        this._className = Array.from(cur).join(' ');
      },
      remove: (...names)=>{
        const cur = new Set(String(this._className || '').split(/\s+/).filter(Boolean));
        names.forEach((name)=> cur.delete(String(name)));
        this._className = Array.from(cur).join(' ');
      },
      contains: (name)=> String(this._className || '').split(/\s+/).filter(Boolean).includes(String(name)),
      toggle: (name, force)=>{
        const exists = String(this._className || '').split(/\s+/).filter(Boolean).includes(String(name));
        const next = force === undefined ? !exists : !!force;
        if(next) this.classList.add(name); else this.classList.remove(name);
        return next;
      },
    };
  }
  appendChild(child){ if(child){ child.parentNode = this; this.children.push(child); } return child; }
  setAttribute(name, value){ this.attributes[name] = String(value); if(name === 'class') this._className = String(value); if(name.startsWith('data-')){ const key = name.replace(/^data-/, '').replace(/-([a-z])/g, (_m, ch)=> ch.toUpperCase()); this.dataset[key] = String(value); } }
  getAttribute(name){ if(name === 'class') return this._className; return this.attributes[name]; }
  addEventListener(type, fn){ (this.__listeners[type] = this.__listeners[type] || []).push(fn); }
  querySelectorAll(selector){
    const out = [];
    const walk = (node)=>{
      if(!node) return;
      if(selector === 'canvas[data-rozrys-sheet="1"]'){
        if(node.tagName === 'CANVAS' && node.dataset && String(node.dataset.rozrysSheet) === '1') out.push(node);
      } else if(selector === '[data-rozrys-sheet-card="1"]') {
        if(node.dataset && String(node.dataset.rozrysSheetCard) === '1') out.push(node);
      } else if(selector === '[data-rozrys-sheet="1"]') {
        if(node.dataset && String(node.dataset.rozrysSheet) === '1') out.push(node);
      }
      (node.children || []).forEach(walk);
    };
    walk(this);
    return out;
  }
  get className(){ return this._className; }
  set className(value){ this._className = String(value || ''); }
}

const fakeDocument = {
  createElement(tag){ return new FakeNode(tag); },
};

const context = {
  console,
  setTimeout,
  clearTimeout,
  localStorage,
  __DEV_ASSETS__: {
    'css/rozrys-reference-sync.css': fs.readFileSync(path.join(rootDir, 'css/rozrys-reference-sync.css'), 'utf8'),
    'css/rozrys-picker-exact-sync.css': fs.readFileSync(path.join(rootDir, 'css/rozrys-picker-exact-sync.css'), 'utf8'),
    'css/rozrys-panel-modal-sync.css': fs.readFileSync(path.join(rootDir, 'css/rozrys-panel-modal-sync.css'), 'utf8'),
    'css/rozrys-stock-modal-sync.css': fs.readFileSync(path.join(rootDir, 'css/rozrys-stock-modal-sync.css'), 'utf8'),
    'css/rozrys-scope-chip-room-sync.css': fs.readFileSync(path.join(rootDir, 'css/rozrys-scope-chip-room-sync.css'), 'utf8'),
    'css/rozrys-checkbox-chip-pattern.css': fs.readFileSync(path.join(rootDir, 'css/rozrys-checkbox-chip-pattern.css'), 'utf8'),
    'css/rozrys-checkbox-chip-selected-accent.css': fs.readFileSync(path.join(rootDir, 'css/rozrys-checkbox-chip-selected-accent.css'), 'utf8'),
    'js/app/rozrys/rozrys-pickers.js': fs.readFileSync(path.join(rootDir, 'js/app/rozrys/rozrys-pickers.js'), 'utf8'),
    'js/app/rozrys/rozrys-options-modal.js': fs.readFileSync(path.join(rootDir, 'js/app/rozrys/rozrys-options-modal.js'), 'utf8'),
    'js/app/rozrys/rozrys-stock-modal.js': fs.readFileSync(path.join(rootDir, 'js/app/rozrys/rozrys-stock-modal.js'), 'utf8'),
    'js/app/rozrys/rozrys-part-helpers.js': fs.readFileSync(path.join(rootDir, 'js/app/rozrys/rozrys-part-helpers.js'), 'utf8'),
    'js/app/rozrys/rozrys-scope.js': fs.readFileSync(path.join(rootDir, 'js/app/rozrys/rozrys-scope.js'), 'utf8'),
    'js/app/rozrys/rozrys-panel-workspace.js': fs.readFileSync(path.join(rootDir, 'js/app/rozrys/rozrys-panel-workspace.js'), 'utf8'),
    'js/app/rozrys/rozrys-runtime-bundle.js': fs.readFileSync(path.join(rootDir, 'js/app/rozrys/rozrys-runtime-bundle.js'), 'utf8'),
    'js/app/rozrys/rozrys-controller-bridges.js': fs.readFileSync(path.join(rootDir, 'js/app/rozrys/rozrys-controller-bridges.js'), 'utf8'),
    'js/app/rozrys/rozrys-render-compose.js': fs.readFileSync(path.join(rootDir, 'js/app/rozrys/rozrys-render-compose.js'), 'utf8'),
    'js/app/rozrys/rozrys-run-controller.js': fs.readFileSync(path.join(rootDir, 'js/app/rozrys/rozrys-run-controller.js'), 'utf8'),
    'js/app/rozrys/rozrys-output-controller.js': fs.readFileSync(path.join(rootDir, 'js/app/rozrys/rozrys-output-controller.js'), 'utf8'),
    'js/app/rozrys/rozrys.js': fs.readFileSync(path.join(rootDir, 'js/app/rozrys/rozrys.js'), 'utf8'),
    'js/app/rozrys/rozrys-lazy-manifest.js': fs.readFileSync(path.join(rootDir, 'js/app/rozrys/rozrys-lazy-manifest.js'), 'utf8'),
    'js/app/optimizer/start-along.js': fs.readFileSync(path.join(rootDir, 'js/app/optimizer/start-along.js'), 'utf8'),
    'js/app/optimizer/start-across.js': fs.readFileSync(path.join(rootDir, 'js/app/optimizer/start-across.js'), 'utf8'),
    'js/app/optimizer/start-optimax.js': fs.readFileSync(path.join(rootDir, 'js/app/optimizer/start-optimax.js'), 'utf8'),
    'js/app/optimizer/speed-max-core.js': fs.readFileSync(path.join(rootDir, 'js/app/optimizer/speed-max-core.js'), 'utf8'),
    'js/app/optimizer/speed-max-bands.js': fs.readFileSync(path.join(rootDir, 'js/app/optimizer/speed-max-bands.js'), 'utf8'),
    'js/app/optimizer/speed-max-sheet-plan.js': fs.readFileSync(path.join(rootDir, 'js/app/optimizer/speed-max-sheet-plan.js'), 'utf8'),
    'js/app/optimizer/speed-max-half-sheet.js': fs.readFileSync(path.join(rootDir, 'js/app/optimizer/speed-max-half-sheet.js'), 'utf8'),
    'js/app/optimizer/speed-max.js': fs.readFileSync(path.join(rootDir, 'js/app/optimizer/speed-max.js'), 'utf8'),
    'index.html': fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8'),
    'dev_tests.html': fs.readFileSync(path.join(rootDir, 'dev_tests.html'), 'utf8'),
  },
};
context.window = context;
context.globalThis = context;
context.FC = {};
context.Node = FakeNode;
context.document = fakeDocument;

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

(async ()=>{
  const report = await runner.runAll();
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
})().catch((error)=>{
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(2);
});
