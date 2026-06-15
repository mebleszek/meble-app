#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg, data){
  if(!cond){ throw new Error(msg + (data ? '\n' + JSON.stringify(data, null, 2) : '')); }
}

const index = read('index.html');
const dev = read('dev_tests.html');
const derived = read('js/app/cabinet/cabinet-derived-facts.js');
const view = read('js/app/ui/data-settings-work-sources-view.js');
const material = read('js/tabs/material.js');

assert(index.includes('js/app/project/project-recalculate.js'), 'index.html ładuje project-recalculate.js');
assert(dev.includes('js/app/project/project-recalculate.js'), 'dev_tests.html ładuje project-recalculate.js');
assert(derived.includes("const VERSION = '20260616_project_preparation_section_v1'"), 'derived facts ma nową wersję cache');
assert(derived.includes('force:opts.force === true'), 'ensureForRooms przekazuje force do ensureCabinetFacts');
assert(derived.includes("status === 'hit' && !force"), 'force ma wymuszać przeliczenie nawet przy cache hit');
assert(view.includes('Przelicz projekt'), 'trybik Dane do czynności i wyceny ma przycisk Przelicz projekt');
assert(material.includes('material-recalculate-project-btn'), 'MATERIAŁ ma przycisk Przelicz projekt');

let saved = false;
let ensured = null;
let rendered = false;
const projectData = {
  kuchnia:{ cabinets:[{ id:'cab1' }, { id:'cab2' }], settings:{} },
  room_x:{ cabinets:[{ id:'cab3' }], settings:{} },
  meta:{}
};
const ctx = {
  window:{},
  globalThis:null,
  console,
  Date,
  projectData,
  renderCabinets(){ rendered = true; },
  uiState:{ activeTab:'material', roomType:'kuchnia' },
};
ctx.window = ctx;
ctx.globalThis = ctx;
ctx.FC = {
  cabinetDerivedFacts:{
    ensureForRooms(rooms, opts){
      ensured = { rooms, opts };
      return { cabinetCount:3, recalculations:3, errors:0, persisted:true, totalMs:12 };
    }
  },
  project:{ save(project){ saved = true; return project; } },
  infoBox:{ open(){} }
};
ctx.window.FC = ctx.FC;
vm.createContext(ctx);
vm.runInContext(read('js/app/project/project-recalculate.js'), ctx, { filename:'project-recalculate.js' });
const result = ctx.FC.projectRecalculator.recalculateCurrentProject({ refresh:true });
assert(ensured && ensured.rooms.length === 2 && ensured.rooms.includes('kuchnia') && ensured.rooms.includes('room_x'), 'Przeliczanie ma objąć pokoje z szafkami', ensured);
assert(ensured.opts && ensured.opts.force === true && ensured.opts.persist === true && ensured.opts.recalculate === true, 'Przeliczanie ma wymusić rebuild i zapis', ensured);
assert(result.persisted === true, 'Projekt ma zostać zapisany przez ensureForRooms albo fallback persist');
assert(rendered === true, 'Widok ma zostać odświeżony');
assert(result.recalculations === 3, 'Zwraca podsumowanie przeliczenia');
console.log('project-recalculate-smoke OK');
