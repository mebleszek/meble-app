#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const read = (file)=> fs.readFileSync(path.join(ROOT, file), 'utf8');

function runtime(){
  const ui = { panel:null, writes:0, begins:0 };
  function createElement(tag){
    const node = {
      tag, children:[], attributes:{}, listeners:{}, className:'', textContent:'',
      appendChild(child){ this.children.push(child); return child; },
      setAttribute(key, value){ this.attributes[key] = String(value); },
      addEventListener(event, handler){ this.listeners[event] = handler; },
      click(){ if(this.attributes.disabled) return; return this.listeners.click && this.listeners.click(); },
      set innerHTML(value){ this.children = []; },
    };
    node.classList = {
      add(name){ this.toggle(name, true); },
      toggle(name, on){
        const classes = new Set(node.className.split(/\s+/).filter(Boolean));
        if(on) classes.add(name); else classes.delete(name);
        node.className = [...classes].join(' ');
      },
    };
    return node;
  }
  const sandbox = {
    console, document:{ createElement },
    localStorage:{
      getItem(){ return null; },
      setItem(){ ui.writes += 1; }, removeItem(){ ui.writes += 1; },
      clear(){ throw new Error('clear forbidden'); },
    },
    FC:{
      session:{ begin(){ ui.begins += 1; return true; } },
      panelBox:{ open(cfg){ ui.panel = cfg; }, close(){} },
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for(const file of ['js/app/material/material-part-options.js', 'js/app/material/material-edge-store.js']){
    vm.runInContext(read(file), sandbox, { filename:file });
  }
  const config = {
    sig:'test', aCm:80.2, bCm:51, initialDirection:'default',
    fmtCm:(value)=> String(value).replace('.', ','),
    edges:{ w1:true, w2:false, h1:true, h2:false },
  };
  const open = (overrides = {})=> sandbox.FC.materialPartOptions.openOptionsModal({ ...config, ...overrides });
  const all = (node = ui.panel.contentNode)=> [node, ...node.children.flatMap((child)=> all(child))];
  const byClass = (name)=> all().find((node)=> node.className.split(/\s+/).includes(name));
  const edges = ()=> ['1a', '1b', '2a', '2b'].map((code)=> byClass('material-part-options__edge--' + code));
  const footer = ()=> byClass('material-part-options__footer-actions').children.map((node)=> node.textContent);
  const select = (label)=> all().find((node)=> node.tag === 'button' && node.children.some((child)=> child.textContent === label)).click();
  return { sandbox, ui, open, all, byClass, edges, footer, select };
}

const cases = [
  ['dimensions and explicit config flow', ()=>{
    const r = runtime();
    const original = r.sandbox.FC.materialPartOptions.openOptionsModal;
    let received;
    r.sandbox.FC.materialPartOptions.openOptionsModal = (cfg)=> { received = cfg; original(cfg); };
    r.sandbox.FC.materialEdgeStore.createEdgeStore({}).openPartOptions(
      { name:'Bok', a:80.2, b:51, material:'Płyta' }, 'test',
      { fmtCm:(value)=> String(value).replace('.', ','), edges:{ w1:true, w2:false, h1:true, h2:false } },
    );
    assert.equal(received.aCm, 80.2);
    assert.equal(received.bCm, 51);
    assert.deepEqual(r.edges().map((node)=> node.children[1].textContent),
      ['1A · 80,2 cm', '1B · 80,2 cm', '2A · 51 cm', '2B · 51 cm']);
    for(const node of r.edges()) assert.doesNotMatch(node.children[1].textContent, /góra|dół|lewo|prawo/i);
    assert.match(read('js/tabs/material.js'), /openPartOptions\(p, sig,[\s\S]*?edges:e,/);
  }],
  ['passive PCV mapping and read-only opening', ()=>{
    const r = runtime(); r.open();
    assert.deepEqual(r.edges().map((node)=> !!node.children[0].attributes.checked), [true, false, true, false]);
    for(const node of r.edges()){
      assert.equal(node.children[0].attributes.disabled, 'disabled');
      assert.deepEqual(node.children[0].listeners, {});
      node.children[0].click();
    }
    const surface = r.byClass('material-part-options__surface');
    assert.match(surface.className, /has-w1/); assert.match(surface.className, /has-h1/);
    assert.doesNotMatch(surface.className, /has-w2|has-h2/);
    assert.equal(r.ui.writes, 0); assert.equal(r.ui.begins, 0);
  }],
  ['bounded proportional geometry', ()=>{
    for(const [a, b, expected] of [[80,50,1.6], [50,80,0.625], [200,20,2.6], [20,200,0.45], [60,60,1]]){
      const r = runtime(); r.open({ aCm:a, bCm:b });
      const style = r.byClass('material-part-options__map').attributes.style;
      const width = Number(style.match(/--part-map-width:([\d.]+)px/)[1]);
      const ratio = Number(style.match(/--part-map-ratio:([\d.]+)/)[1]);
      assert.equal(ratio, expected);
      assert.ok(width <= 300); assert.ok(width / ratio <= 216.000001);
      if(a > b) assert.ok(width > width / ratio);
      if(a < b) assert.ok(width < width / ratio);
      if(a === b) assert.equal(width, width / ratio);
    }
  }],
  ['grain changes preserve technical mapping', ()=>{
    const r = runtime(); r.open();
    const before = r.edges().map((node)=> node.children[1].textContent);
    for(const [label, direction] of [['Domyślny z materiału','default'], ['Poziom','horizontal'], ['Pion','vertical'], ['Bez znaczenia','none']]){
      r.select(label);
      assert.match(r.byClass('material-part-options__surface').className, new RegExp('is-' + direction));
      assert.deepEqual(r.edges().map((node)=> node.children[1].textContent), before);
    }
    assert.equal(r.ui.writes, 0); assert.equal(r.ui.begins, 0);
  }],
  ['local dirty and revert contract', ()=>{
    const r = runtime(); r.open();
    assert.deepEqual(r.footer(), ['Wyjdź']);
    r.select('Poziom'); assert.deepEqual(r.footer(), ['Anuluj', 'Zapisz']);
    r.select('Domyślny z materiału'); assert.deepEqual(r.footer(), ['Wyjdź']);
    assert.equal(r.ui.writes, 0); assert.equal(r.ui.begins, 0);
  }],
  ['responsive DOM and CSS contract', ()=>{
    const r = runtime(); r.open();
    assert.ok(r.byClass('material-part-options__map'));
    assert.equal(r.byClass('material-part-options__map-note').textContent, 'Widok poglądowy — proporcje orientacyjne.');
    const css = read('css/rozrys-main.css');
    assert.doesNotMatch(css, /aspect-ratio:\s*1\.5\s*\/\s*1/);
    assert.match(css, /grid-template-columns:var\(--edge-label-width\) minmax\(0,var\(--part-map-width\)\) var\(--edge-label-width\)/);
    assert.match(css, /max-width:100%;max-height:216px;aspect-ratio:var\(--part-map-ratio\)/);
    assert.match(css, /@media \(max-width:430px\)\{[\s\S]*?--edge-label-width:52px;--edge-gap:5px/);
    assert.match(css, /map-note\{[^}]*color:#b91c1c/);
    // Reserved side labels plus two gaps leave positive surface space even
    // with a conservative 80 px allowance for modal/backdrop padding.
    for(const viewport of [320, 360, 390, 430]){
      const available = viewport - 80;
      const surfaceSpace = available - 2 * 52 - 2 * 5;
      assert.ok(surfaceSpace > 0);
      for(const ratio of [0.45, 1, 2.6]){
        const width = Math.min(300, 216 * ratio, surfaceSpace);
        assert.ok(width + 2 * 52 + 2 * 5 <= available);
        assert.ok(width / ratio <= 216.000001);
      }
    }
  }],
];
let passed = 0;
for(const [name, test] of cases){
  try{ test(); passed += 1; console.log('PASS ' + name); }
  catch(error){ console.error('FAIL ' + name); console.error(error); process.exitCode = 1; }
}
console.log(`Material part visual map: ${passed}/${cases.length} PASS`);
