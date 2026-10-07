#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const PROJECTS = 'fc_projects_v1';
const SESSION = 'fc_edit_session_v1';
const UI = 'fc_ui_v1';
const DRAFTS = 'fc_quote_offer_drafts_v1';
const GLOBAL = 'fc_quote_rates_v1';
const project = (title)=> JSON.stringify([{ id:'A', projectData:{ title } }]);

function runtime(rows = { [PROJECTS]:project('P1'), [UI]:'{"activeTab":"wywiad"}', [GLOBAL]:'100' }){
  class MemoryStorage{
    constructor(){ this.map = new Map(Object.entries(rows)); this.calls = []; this.failures = new Set(); }
    get length(){ return this.map.size; }
    key(i){ return Array.from(this.map.keys())[i] || null; }
    getItem(key){ return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
    check(method, key){
      this.calls.push({ method, key });
      if(this.failures.has(method + ':' + key)){
        const error = new Error('Forced rollback failure: ' + key);
        error.name = 'QuotaExceededError';
        throw error;
      }
    }
    setItem(key, value){ key = String(key); this.check('setItem', key); this.map.set(key, String(value)); }
    removeItem(key){ key = String(key); this.check('removeItem', key); this.map.delete(key); }
    clear(){ this.calls.push({ method:'clear' }); throw new Error('localStorage.clear is forbidden'); }
  }
  const storage = new MemoryStorage();
  const ui = { reloads:0, restores:0, writes:0, messages:[], confirmed:true };
  const handlers = {};
  const sandbox = {
    console, Date, localStorage:storage, Storage:MemoryStorage,
    uiState:{ activeTab:'wywiad' },
    location:{ reload(){ ui.reloads += 1; } },
    alert(message){ ui.messages.push({ message }); },
    FC:{
      actions:{ register(actions){ Object.assign(handlers, actions); } },
      confirmBox:{ async ask(){ return ui.confirmed; } },
      infoBox:{ open(message){ ui.messages.push(message); } },
      uiState:{ get(){ ui.restores += 1; return { activeTab:'wywiad' }; } },
      storage:{ setJSON(key, value){ ui.writes += 1; storage.setItem(key, JSON.stringify(value)); } },
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for(const file of ['js/app/shared/constants.js', 'js/app/investor/session.js', 'js/app/ui/actions-register.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename:file });
  }
  sandbox.STORAGE_KEYS = sandbox.FC.constants.STORAGE_KEYS;
  return { storage, session:sandbox.FC.session, sandbox, ui, cancelUi:()=> handlers['session-cancel']({}) };
}

function editedRuntime(){
  const r = runtime();
  r.session.begin();
  r.storage.setItem(PROJECTS, project('P2'));
  r.storage.setItem(UI, '{"activeTab":"wycena"}');
  r.storage.setItem(DRAFTS, '[{"id":"new-draft"}]');
  r.storage.setItem(GLOBAL, '250');
  assert.equal(r.session.isDirty(), true);
  r.storage.calls.length = 0;
  return r;
}

function assertNoSessionWrites(r){
  assert.deepEqual(r.storage.calls.filter((call)=> call.key === SESSION || call.method === 'clear'), [],
    'Failed cancel must neither remove nor overwrite the durable session');
}

function assertSuccess(r, snapshot){
  for(const [key, value] of Object.entries(snapshot)) assert.equal(r.storage.getItem(key), value, key);
  assert.equal(r.session.active, false);
  assert.equal(r.session.snapshot, null);
  assert.equal(r.storage.getItem(SESSION), null);
  assert.equal(r.session.isDirty(), false);
  assert.equal(r.storage.getItem(GLOBAL), '250');
  assert.deepEqual(r.storage.calls.filter((call)=> call.key === GLOBAL || call.method === 'clear'), []);
}

function failedCancelAndRetry(method, key, reload){
  const r = editedRuntime();
  const snapshot = r.session.snapshot;
  const beforeRaw = r.storage.getItem(SESSION);
  const context = r.session.context;
  const startedAt = r.session.startedAt;
  r.storage.failures.add(method + ':' + key);
  // Simulate a stale clean cache: failure must invalidate it before isDirty().
  r.session.changedKeys.clear();
  r.session.lastDirtyCheckAt = Date.now();
  r.session.lastDirtyValue = false;
  assert.equal(r.session.cancel(), false, 'A failed rollback must explicitly return false');
  assert.equal(r.session.active, true);
  assert.equal(r.session.snapshot, snapshot, 'Keep the original in-memory snapshot');
  assert.equal(snapshot[PROJECTS], project('P1'));
  assert.equal(r.session.context, context);
  assert.equal(r.session.startedAt, startedAt);
  assert.equal(r.session.suspendTracking, false);
  assert.equal(r.storage.getItem(SESSION), beforeRaw);
  const persisted = JSON.parse(beforeRaw);
  assert.equal(persisted.active, true);
  assert.equal(persisted.snapshot[PROJECTS], project('P1'));
  assertNoSessionWrites(r);
  assert.equal(r.storage.getItem(UI), snapshot[UI], 'Other keys may already have been restored');
  assert.equal(r.session.lastDirtyCheckAt, 0, 'Partial rollback must invalidate the dirty cache');
  assert.equal(r.session.changedKeys.size, 0);
  assert.equal(r.session.isDirty(), true);
  assert.ok(r.session.changedKeys.has(key), 'Dirty check must find the key that failed');
  r.storage.failures.clear();
  const retry = reload ? runtime(Object.fromEntries(r.storage.map)) : r;
  assert.equal(retry.session.active, true);
  assert.equal(retry.session.isDirty(), true);
  assert.equal(retry.session.cancel(), true, 'Retry must complete the rollback');
  assertSuccess(retry, snapshot);
}

function normalCancel(){
  const r = editedRuntime();
  const snapshot = r.session.snapshot;
  assert.equal(r.session.cancel(), true);
  assertSuccess(r, snapshot);
  assert.equal(r.session.cancel(), true, 'Repeated cancel without a snapshot is an explicit success');
}

function assertCleanupFailure(r, snapshot, raw){
  assert.equal(r.session.active, true);
  assert.equal(r.session.snapshot, snapshot);
  assert.equal(r.storage.getItem(SESSION), raw, 'Failed cleanup must preserve the durable payload');
  assert.equal(r.session.isDirty(), false, 'Successful data rollback is clean, but the session is still active');
  assert.equal(r.session.suspendTracking, false);
  assert.deepEqual(r.storage.calls.filter((call)=> call.key === SESSION), [
    { method:'removeItem', key:SESSION },
  ], 'Cleanup must attempt removal without writing an inactive replacement payload');
}

function cleanupFailureAndRetry(){
  const r = editedRuntime();
  const snapshot = r.session.snapshot;
  const raw = r.storage.getItem(SESSION);
  const context = r.session.context;
  const startedAt = r.session.startedAt;
  r.storage.failures.add('removeItem:' + SESSION);
  assert.equal(r.session.cancel(), false, 'Failed durable cleanup must not report success');
  assertCleanupFailure(r, snapshot, raw);
  assert.equal(r.session.context, context);
  assert.equal(r.session.startedAt, startedAt);
  for(const [key, value] of Object.entries(snapshot)) assert.equal(r.storage.getItem(key), value, key);
  r.storage.failures.clear();
  assert.equal(r.session.cancel(), true);
  assertSuccess(r, snapshot);
}

function cleanupFailureWithoutSnapshot(){
  for(const active of [true, false]){
    const r = editedRuntime();
    const raw = r.storage.getItem(SESSION);
    r.session.snapshot = null;
    r.session.active = active;
    r.storage.failures.add('removeItem:' + SESSION);
    assert.equal(r.session.cancel(), false, 'No snapshot does not imply durable cleanup success');
    assertCleanupFailure(r, null, raw);
    assert.equal(r.storage.calls.length, 1, 'Without a snapshot only session cleanup should be attempted');
    assert.equal(r.storage.getItem(PROJECTS), project('P2'));
    r.storage.failures.clear();
    assert.equal(r.session.cancel(), true);
    assert.equal(r.session.active, false);
    assert.equal(r.session.snapshot, null);
    assert.equal(r.storage.getItem(SESSION), null);
    assert.equal(r.session.isDirty(), false);
  }
}

async function uiCleanupFailureAndRetry(){
  const r = editedRuntime();
  const snapshot = r.session.snapshot;
  const raw = r.storage.getItem(SESSION);
  const results = [];
  const cancel = r.session.cancel;
  r.session.cancel = ()=> { const result = cancel(); results.push(result); return result; };
  r.storage.failures.add('removeItem:' + SESSION);
  for(let attempt = 1; attempt <= 2; attempt += 1){
    r.storage.calls.length = 0;
    await r.cancelUi();
    assertCleanupFailure(r, snapshot, raw);
    assert.equal(results.length, attempt, 'Retry must use cancel even when isDirty() is false');
    assert.equal(results[attempt - 1], false);
    assert.equal(r.storage.getItem(PROJECTS), project('P1'));
    assert.equal(r.ui.reloads, 0);
    assert.equal(r.ui.restores, 0);
    assert.equal(r.ui.writes, 0);
    assert.equal(r.ui.messages.length, attempt);
    assert.match(r.ui.messages[attempt - 1].message, /Sesja edycji została zachowana/);
  }
  r.storage.failures.clear();
  await r.cancelUi();
  assert.deepEqual(results, [false, false, true]);
  assertSuccess(r, snapshot);
  assert.equal(r.ui.reloads, 1);
  assert.equal(r.ui.restores, 1);
  assert.equal(r.ui.messages.length, 2);
}

function assertUiFailure(r){
  assert.equal(r.ui.reloads, 0, 'Failure must not reload');
  assert.equal(r.ui.restores, 0, 'Failure must not restore UI as if cancellation succeeded');
  assert.equal(r.ui.writes, 0, 'Failure must not write success-path UI state');
  assert.equal(r.session.active, true);
  assert.ok(r.session.snapshot);
  assertNoSessionWrites(r);
  assert.equal(r.ui.messages.length, 1);
  assert.match(r.ui.messages[0].message, /Nie udało się anulować wszystkich zmian/);
  assert.match(r.ui.messages[0].message, /Sesja edycji została zachowana/);
  assert.match(r.ui.messages[0].message, /Spróbuj ponownie/);
}

async function uiFailureAndRetry(){
  const r = editedRuntime();
  const raw = r.storage.getItem(SESSION);
  r.storage.failures.add('setItem:' + PROJECTS);
  await r.cancelUi();
  assertUiFailure(r);
  assert.equal(r.storage.getItem(SESSION), raw);
  assert.equal(r.session.isDirty(), true);
  r.storage.failures.clear();
  await r.cancelUi();
  assert.equal(r.ui.reloads, 1);
  assert.equal(r.ui.restores, 1);
  assert.equal(r.ui.messages.length, 1, 'Successful retry must not show another failure');
  assert.equal(r.storage.getItem(PROJECTS), project('P1'));
  assert.equal(r.session.active, false);
  assert.equal(r.storage.getItem(SESSION), null);
}

async function uiRequiresExplicitSuccess(){
  for(const outcome of ['false', 'undefined', 'throw']){
    const r = editedRuntime();
    r.session.cancel = ()=> {
      if(outcome === 'throw') throw new Error('Unexpected cancel error');
      return outcome === 'false' ? false : undefined;
    };
    await r.cancelUi();
    assertUiFailure(r);
  }
}

async function uiNormalAndDeclined(){
  const r = editedRuntime();
  r.ui.confirmed = false;
  await r.cancelUi();
  assert.equal(r.ui.reloads, 0);
  assert.equal(r.ui.messages.length, 0);
  assert.equal(r.session.active, true);
  assert.equal(r.storage.calls.length, 0);
  r.ui.confirmed = true;
  await r.cancelUi();
  assert.equal(r.ui.reloads, 1);
  assert.equal(r.ui.restores, 1);
  assert.equal(r.ui.messages.length, 0);
  assert.equal(r.storage.getItem(PROJECTS), project('P1'));
  assert.equal(r.session.active, false);
  assert.equal(r.storage.getItem(SESSION), null);
}

async function main(){
  const tests = [
    ['Failed setItem and retry', ()=> failedCancelAndRetry('setItem', PROJECTS, false)],
    ['Failed removeItem and retry', ()=> failedCancelAndRetry('removeItem', DRAFTS, false)],
    ['Failed cancel, reload and retry', ()=> failedCancelAndRetry('setItem', PROJECTS, true)],
    ['Normal cancel', normalCancel],
    ['Failed durable cleanup and retry', cleanupFailureAndRetry],
    ['Failed durable cleanup without snapshot', cleanupFailureWithoutSnapshot],
    ['UI durable cleanup failure and clean-state retry', uiCleanupFailureAndRetry],
    ['UI failure and successful retry', uiFailureAndRetry],
    ['UI requires explicit success', uiRequiresExplicitSuccess],
    ['UI normal cancel and declined confirmation', uiNormalAndDeclined],
  ];
  let failed = 0;
  for(const [name, test] of tests){
    try{ await test(); console.log('PASS: ' + name); }
    catch(error){ failed += 1; console.error('FAIL: ' + name + ': ' + error.message); }
  }
  console.log(`project-session-cancel-failure-safety smoke: ${tests.length - failed}/${tests.length} PASS`);
  if(failed) process.exitCode = 1;
}
main().catch((error)=> { console.error(error); process.exitCode = 1; });
