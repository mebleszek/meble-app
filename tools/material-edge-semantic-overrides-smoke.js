#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const EDGE = 'fc_edge_v1';
const SESSION = 'fc_edit_session_v1';
const clone = (value)=> JSON.parse(JSON.stringify(value));
const cabinet = { type:'stojąca' };
const part = (name)=> ({ name, material:'laminat', qty:1, a:60, b:40 });
const target = part('Bok A');
const defaults = { w1:true, w2:false, h1:false, h2:false };

function runtime(){
  class MemoryStorage{
    constructor(){ this.map = new Map(); this.calls = []; this.failures = new Set(); }
    get length(){ return this.map.size; }
    key(index){ return Array.from(this.map.keys())[index] || null; }
    getItem(key){ return this.map.get(String(key)) ?? null; }
    check(method, key){
      this.calls.push({ method, key });
      if(this.failures.has(method + ':' + key)){
        const error = new Error('Forced edge write failure: ' + key);
        error.name = 'QuotaExceededError'; throw error;
      }
    }
    setItem(key, value){ key = String(key); this.check('setItem', key); this.map.set(key, String(value)); }
    removeItem(key){ key = String(key); this.check('removeItem', key); this.map.delete(key); }
    clear(){ throw new Error('localStorage.clear is forbidden'); }
  }
  const storage = new MemoryStorage();
  const metrics = { begins:0, afterSaves:0, messages:[] };
  const nodes = Object.fromEntries(['sessionButtons','sessionCancel','sessionSave'].map((id)=> [id, {
    style:{}, textContent:'', setAttribute(){},
  }]));
  const sandbox = {
    console, Date, Storage:MemoryStorage, localStorage:storage, sessionStorage:new MemoryStorage(),
    document:{ getElementById(id){ return nodes[id] || null; } },
    FC:{ utils:{ clone }, infoBox:{ open(payload){ metrics.messages.push(payload); } } },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for(const file of ['js/app/shared/constants.js', 'js/app/shared/storage.js', 'js/app/investor/session.js',
    'js/app/material/material-edge-store.js', 'js/app/ui/views.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename:file });
  }
  const FC = sandbox.FC;
  const originalBegin = FC.session.begin;
  FC.session.begin = ()=> { metrics.begins += 1; return originalBegin(); };
  const factory = ()=> FC.materialEdgeStore.createEdgeStore({ onAfterSave(){ metrics.afterSaves += 1; } });
  return { storage, metrics, FC, session:FC.session, factory, nodes };
}

function seed(r, raw){ if(raw !== null) r.storage.setItem(EDGE, raw); r.storage.calls.length = 0; }
function row(api, p = target){ const sig = api.signatureFromPart(p); return { sig, edges:api.getEdges(sig, p, cabinet) }; }
function edgeWrites(r){ return r.storage.calls.filter(({ key })=> key === EDGE); }
function assertCleanBaseline(r, raw){
  assert.equal(r.storage.getItem(EDGE), raw, 'Revert must preserve the exact raw session baseline');
  assert.equal(r.session.active, true);
  assert.equal(r.session.isDirty(), false);
  r.FC.views.refreshSessionButtons();
  assert.equal(r.nodes.sessionCancel.textContent, 'Wyjdź');
  assert.equal(r.nodes.sessionSave.style.display, 'none');
}

function readOnlyDefaults(){
  const r = runtime(), api = r.factory();
  for(const p of [target, part('Półka B'), part('Wieniec C')]){
    const { sig, edges } = row(api, p);
    assert.deepEqual(clone(edges), defaults);
    edges.w1 = false;
    assert.equal(api.getEdges(sig, p, cabinet).w1, true, 'Returned defaults are independent clones');
  }
  assert.deepEqual(clone(api.store), {});
  assert.equal(r.storage.getItem(EDGE), null);
  assert.equal(r.session.active, false);
  assert.equal(r.metrics.begins, 0);
  assert.deepEqual(r.storage.calls, []);
}

function onlyTargetPersists(){
  const r = runtime(), api = r.factory();
  const rows = [target, part('Półka B'), part('Wieniec C')].map((p)=> row(api, p));
  assert.equal(api.setEdges(rows[0].sig, { w1:false }), true);
  const stored = JSON.parse(r.storage.getItem(EDGE));
  assert.deepEqual(Object.keys(stored), [rows[0].sig]);
  assert.deepEqual(stored[rows[0].sig], { w1:false, w2:false, h1:false, h2:false });
  assert.equal(r.metrics.begins, 1);
  assert.equal(r.session.durable, true);
  assert.equal(r.session.snapshot[EDGE], null);
  const sessionWrite = r.storage.calls.findIndex(({ key })=> key === SESSION);
  const edgeWrite = r.storage.calls.findIndex(({ key })=> key === EDGE);
  assert.ok(sessionWrite >= 0 && edgeWrite > sessionWrite);
  assert.equal(r.session.isDirty(), true);
}

function defaultOverrideDefault(raw = null){
  const r = runtime(); seed(r, raw);
  let api = r.factory(); const { sig } = row(api);
  assert.equal(api.setEdges(sig, { w1:false }), true);
  assert.equal(r.session.isDirty(), true);
  assert.equal(r.nodes.sessionCancel.textContent, 'Anuluj');
  assert.equal(r.nodes.sessionSave.textContent, 'Zapisz');
  api = r.factory(); // Material rerender discards the original edge store instance.
  assert.equal(api.getEdges(sig, target, cabinet).w1, false);
  assert.equal(api.setEdges(sig, { w1:true }), true);
  assert.deepEqual(clone(api.store), {});
  assertCleanBaseline(r, raw);
}

function otherOverridesSurvive(){
  const r = runtime(); let api = r.factory();
  const x = row(api, part('Front X')).sig;
  const originalX = { h2:false, w2:true, h1:true, w1:false };
  const raw = '{\n  ' + JSON.stringify(x) + ': ' + JSON.stringify(originalX) + '\n}';
  seed(r, raw); api = r.factory();
  const { sig } = row(api);
  assert.equal(api.setEdges(sig, { w1:false }), true);
  assert.deepEqual(JSON.parse(r.storage.getItem(EDGE))[x], originalX);
  api = r.factory(); row(api);
  assert.equal(api.setEdges(sig, { w1:true }), true);
  assert.deepEqual(clone(api.store[x]), originalX);
  assert.equal(Object.hasOwn(api.store, sig), false);
  assertCleanBaseline(r, raw);
}

function existingOverrideRoundTrip(redundant){
  const r = runtime(); let api = r.factory(); const { sig } = row(api);
  const original = redundant ? { h2:false, h1:false, w2:false, w1:true } : { h2:false, h1:false, w2:false, w1:false };
  const raw = '{ ' + JSON.stringify(sig) + ': ' + JSON.stringify(original) + ' }';
  seed(r, raw); api = r.factory();
  assert.deepEqual(clone(api.getEdges(sig, target, cabinet)), { w1:original.w1, w2:original.w2, h1:original.h1, h2:original.h2 });
  assert.equal(r.storage.getItem(EDGE), raw, 'Reading legacy overrides must not migrate them');
  assert.equal(r.metrics.begins, 0); assert.deepEqual(edgeWrites(r), []);
  assert.equal(api.setEdges(sig, { w1:!original.w1 }), true);
  assert.equal(r.session.isDirty(), true);
  if(!redundant) assert.equal(Object.hasOwn(JSON.parse(r.storage.getItem(EDGE)), sig), false, 'Changing a real override to defaults must remove it');
  api = r.factory(); row(api);
  assert.equal(api.setEdges(sig, { w1:original.w1 }), true);
  assert.deepEqual(clone(api.store[sig]), original);
  assertCleanBaseline(r, raw);
}

function emptyRawRepresentations(){
  for(const raw of [null, '{}', ' {\n} ']) defaultOverrideDefault(raw);
}

function noOp(){
  for(const redundant of [false, true]){
    const r = runtime(); let api = r.factory(); const { sig } = row(api);
    const raw = redundant ? '{ ' + JSON.stringify(sig) + ':' + JSON.stringify(defaults) + ' }' : null;
    seed(r, raw); api = r.factory(); row(api);
    assert.equal(api.setEdges(sig, { w1:true }), true);
    assert.equal(r.storage.getItem(EDGE), raw);
    assert.equal(r.metrics.begins, 0); assert.equal(r.metrics.afterSaves, 0);
    assert.deepEqual(r.storage.calls, []);
    assert.equal(r.session.active, false);
  }
}

function failedBegin(){
  const r = runtime(), api = r.factory(); const { sig } = row(api);
  const before = JSON.stringify(api.store);
  r.storage.failures.add('setItem:' + SESSION);
  assert.equal(api.setEdges(sig, { w1:false }), false);
  assert.equal(JSON.stringify(api.store), before);
  assert.equal(r.storage.getItem(EDGE), null);
  assert.equal(r.metrics.afterSaves, 0); assert.deepEqual(edgeWrites(r), []);
  assert.equal(r.session.active, true); assert.equal(r.session.durable, false);
  assert.equal(r.session.snapshot[EDGE], null);
  r.storage.failures.clear();
  assert.equal(api.setEdges(sig, { w1:false }), true);
  assert.equal(r.session.durable, true);
  assert.equal(r.session.snapshot[EDGE], null);
  assert.equal(r.metrics.afterSaves, 1);
}

function failedWritesPreserveRam(){
  const r = runtime(), api = r.factory(); const { sig } = row(api);
  r.storage.failures.add('setItem:' + EDGE);
  assert.equal(api.setEdges(sig, { w1:false }), false);
  assert.deepEqual(clone(api.store), {});
  assert.equal(r.storage.getItem(EDGE), null); assert.equal(r.metrics.afterSaves, 0);
  r.storage.failures.clear(); assert.equal(api.setEdges(sig, { w1:false }), true);
  const raw = r.storage.getItem(EDGE), previous = api.store[sig];
  r.storage.failures.add('removeItem:' + EDGE);
  assert.equal(api.setEdges(sig, { w1:true }), false);
  assert.equal(api.store[sig], previous); assert.equal(r.storage.getItem(EDGE), raw);
  assert.equal(r.metrics.afterSaves, 1);
  r.storage.failures.clear(); assert.equal(api.setEdges(sig, { w1:true }), true);
  assertCleanBaseline(r, null);
}

function revertDoesNotUndoOtherEdits(){
  const r = runtime(); let api = r.factory();
  const a = row(api).sig, b = row(api, part('Półka B')).sig;
  assert.equal(api.setEdges(a, { w1:false }), true);
  assert.equal(api.setEdges(b, { w2:true }), true);
  api = r.factory(); row(api);
  assert.equal(api.setEdges(a, { w1:true }), true);
  const stored = JSON.parse(r.storage.getItem(EDGE));
  assert.deepEqual(Object.keys(stored), [b]);
  assert.equal(stored[b].w2, true);
  assert.equal(r.session.isDirty(), true, 'Another edited override must still count as dirty');
}

function unknownPartIsNotGuessed(){
  const r = runtime(), api = r.factory();
  assert.equal(api.setEdges('unread-part', { w1:true }), false);
  assert.deepEqual(clone(api.store), {});
  assert.equal(r.metrics.begins, 0);
  assert.deepEqual(r.storage.calls, []);
}

try{
  const scenarios = [
    ['read-only defaults never enter the override store', readOnlyDefaults],
    ['first real override persists only the target and all four flags', onlyTargetPersists],
    ['default -> override -> default across a rerender returns to null', defaultOverrideDefault],
    ['unrelated baseline overrides and raw formatting survive', otherOverridesSurvive],
    ['existing non-default override returns to exact baseline', ()=> existingOverrideRoundTrip(false)],
    ['legacy redundant baseline is restored without migration', ()=> existingOverrideRoundTrip(true)],
    ['null and empty-object raw representations return exactly', emptyRawRepresentations],
    ['no-op skips session begin, storage writes, and success callbacks', noOp],
    ['failed durable begin preserves storage and RAM, then allows retry', failedBegin],
    ['failed edge writes and removals preserve RAM for retry', failedWritesPreserveRam],
    ['reverting one override does not discard another edited override', revertDoesNotUndoOtherEdits],
    ['a signature without part defaults cannot create a guessed override', unknownPartIsNotGuessed],
  ];
  for(const [name, run] of scenarios){ run(); console.log('PASS: ' + name); }
  console.log('material-edge-semantic-overrides-smoke: PASS (' + scenarios.length + '/' + scenarios.length + ')');
}catch(error){ console.error(error); process.exitCode = 1; }
