#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeMiniDocument } = require('./app-dev-smoke-lib/mini-document');
const ROOT = path.resolve(__dirname, '..');
const document = makeMiniDocument();

// Extend the existing mini DOM only with browser operations used by accordionBehavior.
const proto = Object.getPrototypeOf(document.body);
const queryAll = proto.querySelectorAll;
proto.querySelectorAll = function(selector){
  return [...new Set(selector.split(',').flatMap(part=>queryAll.call(this, part.trim())))];
};
proto.matches = function(selector){
  return selector.split(',').some(part=>{
    const container = document.createElement('div');
    container.children = [this];
    return queryAll.call(container, part.trim()).includes(this);
  });
};
proto.closest = function(selector){
  for(let node = this; node; node = node.parentNode) if(node.matches(selector)) return node;
  return null;
};
Object.defineProperty(proto, 'open', {
  get(){ return this.getAttribute('open') !== null; },
  set(value){ if(value) this.setAttribute('open', ''); else delete this.attributes.open; }
});
document.querySelectorAll = selector=>document.body.querySelectorAll(selector);
const s = { console, document, setTimeout:()=>0, clearTimeout(){}, addEventListener(){},
  localStorage:{ getItem:()=>null, setItem(){ throw new Error('Unexpected write'); }, removeItem(){ throw new Error('Unexpected removal'); } },
  FC:{ utils:{ clone:value=>JSON.parse(JSON.stringify(value)) } }
};
s.window = s; s.globalThis = s;
vm.createContext(s);
function load(file){ vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'), s, { filename:file }); }
for(const file of ['js/app/settings/program-defaults-store.js', 'js/app/room-preferences/room-preferences-model.js',
  'js/app/ui/data-settings-dom.js', 'js/app/ui/data-settings-defaults-view.js']) load(file);
const panel = document.createElement('div'); panel.className = 'panel-box'; document.body.appendChild(panel);
s.FC.dataSettingsDefaultsView.render(panel);
load('js/app/ui/accordion-behavior.js');
const details = panel.querySelectorAll('details.data-settings-accordion');
function named(title){
  const node = details.find(el=>el.querySelector(':scope > summary').querySelector('.data-settings-accordion__title').textContent === title);
  assert.ok(node, 'Missing accordion: ' + title); return node;
}
function clickSummary(node){
  const event = { target:node.querySelector(':scope > summary'), preventDefault(){}, stopPropagation(){} };
  for(const listener of document.__listeners.click || []) listener(event);
}
const materials = named('Materiały');
const hardware = named('Okucia');
const zones = materials.querySelectorAll('details.data-settings-accordion');
assert.equal(zones.length, 3);
const [lower, middle, upper] = zones;
clickSummary(materials);
assert.equal(materials.open, true);
console.log('PASS 1 top-level Materials opens');
clickSummary(lower);
assert.equal(materials.open, true, 'Opening Lower must preserve Materials');
console.log('PASS 2 Lower preserves its parent');
assert.equal(lower.open, true);
console.log('PASS 3 Lower opens');
clickSummary(upper);
assert.equal(lower.open, false); assert.equal(upper.open, true); assert.equal(materials.open, true);
assert.equal(middle.open, false);
console.log('PASS 4 Upper closes only its sibling zones');
clickSummary(hardware);
assert.equal(hardware.open, true); assert.equal(materials.open, false); assert.equal(upper.open, false);
clickSummary(materials);
assert.equal(materials.open, true); assert.equal(hardware.open, false);
console.log('PASS 5 top-level Hardware retains exclusive-group behavior');

const css = fs.readFileSync(path.join(ROOT,'css/data-settings.css'),'utf8');
const openToggleSelectors = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)]
  .flatMap(match=>match[1].trim().split(','))
  .filter(selector=>selector.includes('[open]') && selector.includes('.data-settings-accordion__toggle'));
assert.equal(openToggleSelectors.length, 3, 'Cover generic ::before, toggle appearance and chevron');
for(const selector of openToggleSelectors){
  assert.match(selector, /\.data-settings-accordion\[open\]\s*>\s*\.data-settings-accordion__summary\s+\.data-settings-accordion__toggle(?:::before)?$/);
  // Each rule selects a toggle only through its own direct summary, never through an ancestor body.
  const owner = lower.querySelector('.data-settings-accordion__toggle').closest('summary').parentNode;
  assert.equal(owner, lower); assert.equal(owner.open, false); assert.equal(materials.open, true);
}
assert.match(css, /\.data-settings-defaults-card \.data-settings-accordion__toggle::before\s*\{[^}]*transform:rotate\(45deg\)/);
assert.match(css, /\.data-settings-defaults-card \.data-settings-accordion\[open\]\s*>\s*\.data-settings-accordion__summary \.data-settings-accordion__toggle\s*\{[^}]*transform:rotate\(180deg\)/);
console.log('PASS 6 open CSS is scoped to the owning direct summary');
console.log('Nested defaults accordions: 6/6 PASS');
