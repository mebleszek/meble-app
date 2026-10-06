#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const HISTORY = 'fc_quote_snapshots_v1';
const SESSION = 'fc_edit_session_v1';
const PROJECTS = 'fc_projects_v1';
const project = (title)=> JSON.stringify([{ id:'A', projectData:{ title } }]);

function runtime(rows = {}){
  // A separate prototype per runtime keeps session storage hooks isolated.
  class MemoryStorage{
    constructor(){ this.map = new Map(Object.entries(rows)); this.calls = []; this.failWrites = 0; }
    get length(){ return this.map.size; }
    key(i){ return Array.from(this.map.keys())[i] || null; }
    getItem(key){ return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
    setItem(key, value){
      key = String(key);
      this.calls.push({ method:'setItem', key });
      if(key === HISTORY && this.failWrites > 0){
        this.failWrites -= 1;
        const error = new Error('Forced history write failure');
        error.name = 'QuotaExceededError';
        throw error;
      }
      this.map.set(key, String(value));
    }
    removeItem(key){ this.calls.push({ method:'removeItem', key:String(key) }); this.map.delete(String(key)); }
    clear(){ this.calls.push({ method:'clear' }); throw new Error('localStorage.clear is forbidden'); }
  }
  const storage = new MemoryStorage();
  const events = [];
  const sandbox = {
    console, Date, localStorage:storage, Storage:MemoryStorage,
    uiState:{ activeTab:'wycena', roomType:'' },
    document:{ querySelector(){ return null; } },
    FC:{ wycenaDiagnostics:{ recordSnapshotStoreEvent(label){ events.push(label); } } },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  [
    'js/app/shared/constants.js',
    'js/app/shared/data-storage-keys.js',
    'js/app/investor/session.js',
    'js/app/quote/quote-snapshot-scope.js',
    'js/app/quote/quote-snapshot-selection.js',
    'js/app/quote/quote-snapshot-storage-maintenance.js',
    'js/app/quote/quote-snapshot-store.js',
  ].forEach((file)=> vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename:file }));
  const session = sandbox.FC.session;
  let commits = 0;
  const commit = session.commit;
  session.commit = function(){ commits += 1; return commit.apply(this, arguments); };
  return { storage, events, session, get commits(){ return commits; },
    store:sandbox.FC.quoteSnapshotStore, maintenance:sandbox.FC.quoteSnapshotStorageMaintenance };
}

function offer(id, total = 10){
  return { id, project:{ id:'A' }, investor:{ id:'I' },
    scope:{ selectedRooms:['room_A'], roomLabels:['A'] },
    lines:{ materials:[{ name:'Płyta', qty:1, total }] },
    totals:{ materials:total, grand:total }, commercial:{ versionName:id } };
}

function seedHistory(r){
  r.store.save(offer('OLD'));
  const raw = JSON.stringify(JSON.parse(r.storage.getItem(HISTORY)), null, 2);
  r.storage.setItem(HISTORY, raw); // Preserve even whitespace on failed writes.
  r.storage.calls.length = 0;
  r.events.length = 0;
  return raw;
}

function activeRuntime(){
  const r = runtime({ [PROJECTS]:project('P1'), fc_ui_v1:JSON.stringify({ activeTab:'wycena' }) });
  seedHistory(r);
  r.session.begin();
  r.storage.setItem(PROJECTS, project('P2'));
  assert.equal(r.session.isDirty(), true);
  return r;
}

function assertNoRemoval(storage, keys){
  assert.deepEqual(storage.calls.filter((call)=> call.method === 'clear'
    || (call.method === 'removeItem' && keys.includes(call.key))), []);
}

function assertActive(r, raw){
  assert.equal(r.commits, 0, 'Maintenance must not commit a session');
  assert.equal(r.session.active, true);
  assert.equal(r.session.isDirty(), true);
  assert.equal(r.storage.getItem(SESSION), raw, 'Durable session must remain byte-for-byte intact');
  assertNoRemoval(r.storage, [SESSION]);
}

function permanentFailure(){
  const r = runtime();
  const before = seedHistory(r);
  r.storage.failWrites = Infinity;
  assert.throws(()=> r.store.save(offer('NEW')), (error)=> error.code === 'quote_snapshot_storage_write_failed');
  assert.equal(r.storage.calls.filter((call)=> call.method === 'setItem' && call.key === HISTORY).length, 3);
  assert.ok(r.events.includes('storage-maintenance:normal'));
  assert.ok(r.events.includes('storage-maintenance:aggressive'));
  assert.ok(!r.events.includes('save:after'), 'No success event after a failed write');
  assert.equal(r.storage.getItem(HISTORY), before, 'B1: failed retries destroyed OLD history');
  assertNoRemoval(r.storage, [HISTORY]);
  assert.equal(r.store.getById('OLD').id, 'OLD');
  assert.equal(r.store.getById('NEW'), null);
}

function technicalCleanup(){
  const r = activeRuntime();
  const raw = r.storage.getItem(SESSION);
  r.storage.setItem('fc_rozrys_plan_cache_v2', 'cache');
  r.maintenance.removeKnownTechnicalKeys();
  assertActive(r, raw);
  assert.equal(r.storage.getItem('fc_rozrys_plan_cache_v2'), null, 'Technical cache cleanup still works');
}

function failedWritePreservesReload(){
  const r = activeRuntime();
  const raw = r.storage.getItem(SESSION);
  r.storage.failWrites = Infinity;
  assert.throws(()=> r.store.save(offer('NEW')), (error)=> error.code === 'quote_snapshot_storage_write_failed');
  assertActive(r, raw);
  const reloaded = runtime(Object.fromEntries(r.storage.map));
  assertActive(reloaded, raw);
  reloaded.session.cancel();
  assert.equal(reloaded.storage.getItem(PROJECTS), project('P1'), 'Reload must retain rollback to P1');
}

function noHeuristicCommit(){
  const r = activeRuntime();
  const raw = r.storage.getItem(SESSION);
  for(const options of [{}, { force:true }, { force:true, dryRun:true }]){
    const result = r.maintenance.cleanupStaleEditSession(options);
    assert.equal(result.removed, false);
    assert.ok(!result.wouldRemove);
    assertActive(r, raw);
  }
}

function protectEitherActiveSource(){
  const source = activeRuntime();
  const activeRaw = source.storage.getItem(SESSION);
  const diskOnly = runtime();
  diskOnly.storage.setItem(SESSION, activeRaw);
  for(const aggressive of [false, true]){
    diskOnly.maintenance.prepareForSnapshotWrite({ aggressive });
    assert.equal(diskOnly.storage.getItem(SESSION), activeRaw, 'Persisted active session must survive without active RAM');
    assert.equal(diskOnly.commits, 0);
    assertNoRemoval(diskOnly.storage, [SESSION]);
  }
  // Even a stale disk payload is protected while RAM has an active session.
  const inactiveRaw = JSON.stringify({ active:false, snapshot:null });
  source.storage.setItem(SESSION, inactiveRaw);
  source.maintenance.prepareForSnapshotWrite({ aggressive:true });
  assertActive(source, inactiveRaw);
}

function safeDeadSessionCleanup(){
  for(const payload of [
    { active:false, snapshot:null },
    { active:true, snapshot:{ [PROJECTS]:project('old orphan') } },
  ]){
    const r = runtime();
    const raw = JSON.stringify(payload);
    r.storage.setItem(SESSION, raw);
    assert.equal(r.maintenance.cleanupStaleEditSession({ dryRun:true }).wouldRemove, true);
    assert.equal(r.storage.getItem(SESSION), raw);
    assert.equal(r.maintenance.cleanupStaleEditSession().removed, true);
    assert.equal(r.storage.getItem(SESSION), null);
    assert.equal(r.commits, 0);
  }
  const r = runtime();
  for(const raw of ['{invalid', JSON.stringify({ active:false, snapshot:{ [PROJECTS]:project('P1') } })]){
    r.storage.setItem(SESSION, raw);
    assert.equal(r.maintenance.cleanupStaleEditSession({ force:true }).removed, false);
    assert.equal(r.storage.getItem(SESSION), raw, 'Ambiguous payload must be preserved');
  }
}

function successfulWrites(){
  for(const failedAttempts of [0, 1, 2]){
    const r = activeRuntime();
    const raw = r.storage.getItem(SESSION);
    r.storage.calls.length = 0;
    r.storage.failWrites = failedAttempts;
    assert.equal(r.store.save(offer('NEW')).id, 'NEW');
    assert.equal(r.storage.calls.filter((call)=> call.method === 'setItem' && call.key === HISTORY).length, failedAttempts + 1);
    assert.equal(r.store.readAll().length, 2);
    assertActive(r, raw);
    assert.equal(r.store.replaceSnapshot('OLD', offer('replacement', 25)).id, 'OLD');
    assert.equal(r.store.getById('OLD').totals.grand, 25);
    assert.equal(r.store.remove('NEW'), true);
    assert.equal(r.store.getById('NEW'), null);
    assert.equal(r.store.remove('OLD'), true);
    assert.equal(r.store.readAll().length, 0);
    assert.equal(r.storage.getItem(HISTORY), '[]');
    assertNoRemoval(r.storage, [HISTORY, SESSION]);
    assert.equal(r.session.active, true);
    assert.equal(r.commits, 0);
  }
}

const tests = [
  ['B1 permanent failure', permanentFailure],
  ['B3 technical cleanup', technicalCleanup],
  ['B3 failed write and reload', failedWritePreservesReload],
  ['B9 no heuristic commit', noHeuristicCommit],
  ['B3 either active source', protectEitherActiveSource],
  ['Safe dead-session cleanup', safeDeadSessionCleanup],
  ['Normal writes, retries, replacement and removal', successfulWrites],
];
let failures = 0;
for(const [name, test] of tests){
  try{ test(); console.log('PASS: ' + name); }
  catch(error){ failures += 1; console.error('FAIL: ' + name + ': ' + error.message); }
}
console.log(`quote-history-session-safety smoke: ${tests.length - failures}/${tests.length} PASS`);
if(failures) process.exitCode = 1;
