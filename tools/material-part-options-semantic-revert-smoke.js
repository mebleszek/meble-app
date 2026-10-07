#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const KEY = 'fc_material_part_options_v1';
const SESSION = 'fc_edit_session_v1';

function runtime(initial = {}){
  class MemoryStorage{
    constructor(rows){ this.map = new Map(Object.entries(rows || {})); this.calls = []; this.failures = new Set(); }
    get length(){ return this.map.size; }
    key(index){ return [...this.map.keys()][index] ?? null; }
    getItem(key){ return this.map.get(String(key)) ?? null; }
    check(method, key){
      this.calls.push({ method, key });
      if(this.failures.has(method + ':' + key)){
        const error = new Error('Forced storage failure'); error.name = 'QuotaExceededError'; throw error;
      }
    }
    setItem(key, value){ key = String(key); this.check('setItem', key); this.map.set(key, String(value)); }
    removeItem(key){ key = String(key); this.check('removeItem', key); this.map.delete(key); }
    clear(){ throw new Error('localStorage.clear forbidden'); }
  }
  const storage = new MemoryStorage(initial);
  const metrics = { begins:0, refreshes:0, warnings:0 };
  const sandbox = {
    console, Date, Storage:MemoryStorage, localStorage:storage, sessionStorage:new MemoryStorage(),
    FC:{
      utils:{ clone:(value)=> JSON.parse(JSON.stringify(value)) },
      views:{ refreshSessionButtons(){ metrics.refreshes += 1; } },
      infoBox:{ open(){ metrics.warnings += 1; } },
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for(const file of ['js/app/shared/constants.js', 'js/app/shared/storage.js', 'js/app/investor/session.js', 'js/app/material/material-part-options.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename:file });
  }
  const session = sandbox.FC.session;
  const begin = session.begin;
  session.begin = ()=> { metrics.begins += 1; return begin(); };
  return { storage, session, api:sandbox.FC.materialPartOptions, metrics };
}
const seeded = (raw)=> runtime(raw === null ? {} : { [KEY]:raw });
const writes = (r)=> r.storage.calls.filter((call)=> call.key === KEY);
function roundtrip(raw, first, restored){
  const r = seeded(raw);
  assert.equal(r.api.setDirection('part', first), true);
  assert.equal(r.session.active, true);
  assert.equal(r.session.durable, true);
  assert.equal(r.session.snapshot[KEY], raw);
  assert.equal(r.session.isDirty(), true);
  assert.equal(r.api.setDirection('part', restored), true);
  assert.equal(r.storage.getItem(KEY), raw);
  assert.equal(r.session.isDirty(), false);
  return r;
}
const cases = [
  ['null roundtrip restores absence and clean state', ()=>{
    const r = roundtrip(null, 'vertical', 'default');
    assert.equal(writes(r).at(-1).method, 'removeItem');
  }],
  ['empty object roundtrip preserves exact raw', ()=>{
    const r = roundtrip('{}', 'horizontal', 'default');
    assert.equal(writes(r).at(-1).method, 'setItem');
  }],
  ['whitespace and key ordering roundtrip', ()=>{
    roundtrip('{ "inne":"vertical", "part":"horizontal" }', 'vertical', 'horizontal');
  }],
  ['existing non-default override roundtrip', ()=>{
    roundtrip('{\n  "part": "vertical"\n}', 'horizontal', 'vertical');
  }],
  ['legacy explicit default record survives', ()=>{
    const raw = '{\n  "part":"default"\n}';
    const r = roundtrip(raw, 'vertical', 'default');
    assert.equal(JSON.parse(r.storage.getItem(KEY)).part, 'default');
  }],
  ['other records survive the target edit', ()=>{
    const raw = '{ "partA":"none", "partB":"horizontal", "partC":"vertical" }';
    const r = seeded(raw);
    assert.equal(r.api.setDirection('partB', 'none'), true);
    const rows = JSON.parse(r.storage.getItem(KEY));
    assert.deepEqual(rows, { partA:'none', partB:'none', partC:'vertical' });
    assert.equal(r.api.setDirection('partB', 'horizontal'), true);
    assert.equal(r.storage.getItem(KEY), raw);
    assert.equal(r.session.isDirty(), false);
  }],
  ['effective no-op performs no begin or storage mutation', ()=>{
    for(const [raw, dir] of [['{ "part":"vertical" }','vertical'], [null,'default'], ['{ "part":"default" }','default']]){
      const r = seeded(raw);
      assert.equal(r.api.setDirection('part', dir), true);
      assert.equal(r.metrics.begins, 0);
      assert.deepEqual(r.storage.calls, []);
      assert.equal(r.storage.getItem(KEY), raw);
    }
  }],
  ['failed begin blocks writes and removals', ()=>{
    for(const [raw, dir] of [[null,'vertical'], ['{"part":"vertical"}','default']]){
      const r = seeded(raw); r.session.begin = ()=> false;
      assert.equal(r.api.setDirection('part', dir), false);
      assert.deepEqual(writes(r), []);
      assert.equal(r.storage.getItem(KEY), raw);
    }
    const r = seeded(null);
    r.storage.failures.add('setItem:' + SESSION);
    assert.equal(r.api.setDirection('part', 'vertical'), false);
    assert.equal(r.session.active, true); assert.equal(r.session.durable, false);
    assert.equal(r.storage.getItem(KEY), null); assert.deepEqual(writes(r), []);
    r.storage.failures.clear();
    assert.equal(r.api.setDirection('part', 'vertical'), true);
    assert.equal(r.session.snapshot[KEY], null);
  }],
  ['setItem and removeItem failures report false and permit retry', ()=>{
    const r = seeded(null);
    r.storage.failures.add('setItem:' + KEY);
    assert.equal(r.api.setDirection('part', 'vertical'), false);
    assert.equal(r.storage.getItem(KEY), null);
    r.storage.failures.clear();
    assert.equal(r.api.setDirection('part', 'vertical'), true);
    const edited = r.storage.getItem(KEY);
    r.storage.failures.add('removeItem:' + KEY);
    assert.equal(r.api.setDirection('part', 'default'), false);
    assert.equal(r.storage.getItem(KEY), edited);
    assert.equal(r.session.isDirty(), true);
    r.storage.failures.clear();
    assert.equal(r.api.setDirection('part', 'default'), true);
    assert.equal(r.storage.getItem(KEY), null);
    assert.equal(r.session.isDirty(), false);
  }],
  ['reload restores the session baseline for a fresh API call', ()=>{
    const raw = '{ "other":"none", "part":"horizontal" }';
    const r = seeded(raw);
    assert.equal(r.api.setDirection('part', 'vertical'), true);
    const reloaded = runtime(Object.fromEntries(r.storage.map));
    assert.equal(reloaded.session.active, true); assert.equal(reloaded.session.durable, true);
    assert.equal(reloaded.session.snapshot[KEY], raw);
    assert.equal(reloaded.api.setDirection('part', 'horizontal'), true);
    assert.equal(reloaded.storage.getItem(KEY), raw);
    assert.equal(reloaded.session.isDirty(), false);
  }],
  ['invalid baseline JSON is never restored or repaired', ()=>{
    for(const raw of ['{bad JSON', '{']){
      const r = seeded(raw);
      assert.equal(r.api.setDirection('part', 'vertical'), true);
      assert.equal(r.api.setDirection('part', 'default'), true);
      assert.equal(r.storage.getItem(KEY), '{}');
      assert.equal(r.session.isDirty(), true);
    }
  }],
  ['reverting one record does not discard another pending edit', ()=>{
    const raw = '{ "part":"horizontal", "other":"vertical" }';
    const r = seeded(raw);
    assert.equal(r.api.setDirection('part', 'vertical'), true);
    assert.equal(r.api.setDirection('other', 'none'), true);
    assert.equal(r.api.setDirection('part', 'horizontal'), true);
    assert.deepEqual(JSON.parse(r.storage.getItem(KEY)), { part:'horizontal', other:'none' });
    assert.equal(r.session.isDirty(), true);
    assert.equal(r.api.setDirection('other', 'vertical'), true);
    assert.equal(r.storage.getItem(KEY), raw);
    assert.equal(r.session.isDirty(), false);
  }],
];
let passed = 0;
for(const [name, test] of cases){
  try{ test(); passed += 1; console.log('PASS ' + name); }
  catch(error){ console.error('FAIL ' + name); console.error(error); process.exitCode = 1; }
}
console.log(`Material part options semantic revert: ${passed}/${cases.length} PASS`);
