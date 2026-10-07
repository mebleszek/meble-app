#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const PROJECTS = 'fc_projects_v1';
const SESSION = 'fc_edit_session_v1';
const clone = (value)=> JSON.parse(JSON.stringify(value));
const project = (width)=> ({ room:{ cabinets:[{ id:'cabinet', width }], fronts:[], sets:[], settings:{} } });

function runtime(withInvestor = true){
  class MemoryStorage{
    constructor(){ this.map = new Map(); this.calls = []; this.failures = new Set(); }
    get length(){ return this.map.size; }
    key(index){ return Array.from(this.map.keys())[index] || null; }
    getItem(key){ return this.map.get(String(key)) ?? null; }
    check(method, key){
      this.calls.push({ method, key });
      if(this.failures.has(method + ':' + key)){
        const error = new Error('Forced save failure: ' + key);
        error.name = 'QuotaExceededError';
        throw error;
      }
    }
    setItem(key, value){ key = String(key); this.check('setItem', key); this.map.set(key, String(value)); }
    removeItem(key){ key = String(key); this.check('removeItem', key); this.map.delete(key); }
    clear(){ throw new Error('localStorage.clear is forbidden'); }
  }
  const storage = new MemoryStorage();
  const handlers = {};
  const ui = { messages:[], recovery:[], refreshes:0, home:0, reloads:0 };
  const sandbox = {
    console, Date, setTimeout, clearTimeout,
    Storage:MemoryStorage, localStorage:storage, sessionStorage:new MemoryStorage(),
    uiState:{ activeTab:'wywiad', currentInvestorId:withInvestor ? 'investor-A' : null },
    location:{ reload(){ ui.reloads += 1; } },
    alert(message){ ui.messages.push({ message }); },
    FC:{
      utils:{ clone },
      schema:{ CURRENT_SCHEMA_VERSION:1, DEFAULT_PROJECT:{ schemaVersion:1 } },
      actions:{ register(actions){ Object.assign(handlers, actions); } },
      infoBox:{ open(payload){ ui.messages.push(payload); } },
      choiceBox:{ async ask(payload){ ui.recovery.push(payload); return 'back'; } },
      views:{ refreshSessionButtons(){ ui.refreshes += 1; }, openHome(){ ui.home += 1; } },
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for(const file of [
    'js/app/shared/constants.js', 'js/app/shared/storage.js',
    'js/app/project/project-model.js', 'js/app/project/project-store.js',
    'js/app/project/project-file-recovery.js', 'js/app/project/project-bridge.js',
    'js/app/investor/session.js', 'js/app/ui/actions-register.js',
  ]) vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename:file });
  const FC = sandbox.FC;
  assert.ok(FC.projectStore.upsert({ id:'A', investorId:withInvestor ? 'investor-A' : '', projectData:project(100) }));
  FC.projectStore.setCurrentProjectId('A');
  if(withInvestor) storage.setItem('fc_current_investor_v1', 'investor-A');
  FC.session.begin();
  sandbox.projectData = project(250);
  const state = {
    snapshot:FC.session.snapshot, context:FC.session.context,
    startedAt:FC.session.startedAt, raw:storage.getItem(SESSION),
  };
  const results = { saves:[], commits:[] };
  const save = FC.project.saveConfirmed;
  FC.project.saveConfirmed = (data)=> { const result = save(data); results.saves.push(result.ok); return result; };
  const commit = FC.session.commit;
  FC.session.commit = ()=> { const result = commit(); results.commits.push(result); return result; };
  storage.calls.length = 0;
  return { storage, sandbox, FC, ui, state, results, saveUi:()=> handlers['session-save']({}) };
}

function width(r){ return JSON.parse(r.storage.getItem(PROJECTS))[0].projectData.room.cabinets[0].width; }

function assertPreserved(r){
  assert.equal(r.FC.session.active, true);
  assert.equal(r.FC.session.snapshot, r.state.snapshot);
  assert.equal(r.FC.session.context, r.state.context);
  assert.equal(r.FC.session.startedAt, r.state.startedAt);
  assert.equal(r.storage.getItem(SESSION), r.state.raw);
  assert.equal(JSON.parse(r.state.raw).active, true);
  assert.equal(r.ui.refreshes, 0, 'No successful completion refresh on failure');
  assert.equal(r.ui.home, 0);
  assert.equal(r.ui.reloads, 0);
}

function assertFinished(r){
  assert.equal(width(r), 250);
  assert.equal(r.sandbox.projectData.schemaVersion, 1);
  assert.equal(r.FC.session.active, false);
  assert.equal(r.FC.session.snapshot, null);
  assert.equal(r.FC.session.context, null);
  assert.equal(r.FC.session.startedAt, 0);
  assert.equal(r.storage.getItem(SESSION), null);
  assert.equal(r.FC.session.isDirty(), false);
  assert.equal(r.ui.refreshes, 1);
  assert.equal(r.ui.home, 0);
  assert.equal(r.ui.reloads, 0);
  assert.deepEqual(r.storage.calls.filter(({ key })=> key === 'fc_project_v1' || /^fc_project_inv_/.test(key)), [],
    'Confirmed save must never write legacy project mirrors');
}

function normalSave(withInvestor){
  const r = runtime(withInvestor);
  assert.equal(r.FC.session.isDirty(), false, 'RAM edits may precede autosave: active clean must still save');
  r.saveUi();
  assert.deepEqual(r.results, { saves:[true], commits:[true] });
  assertFinished(r);
  const writeIndex = r.storage.calls.findIndex(({ method, key })=> method === 'setItem' && key === PROJECTS);
  const removeIndex = r.storage.calls.findIndex(({ method, key })=> method === 'removeItem' && key === SESSION);
  assert.ok(writeIndex >= 0 && removeIndex > writeIndex, 'Save central project before ending session');
}

async function centralFailureAndRetry(){
  const r = runtime();
  const before = r.storage.getItem(PROJECTS);
  r.storage.failures.add('setItem:' + PROJECTS);
  r.saveUi();
  assert.deepEqual(r.results, { saves:[false], commits:[] }, 'Central failure must not call commit');
  assert.equal(r.storage.getItem(PROJECTS), before);
  assert.equal(width(r), 100);
  assertPreserved(r);
  assert.deepEqual(r.storage.calls.filter(({ key })=> key === SESSION), []);
  assert.equal(r.FC.projectFileRecovery.lastPendingRecord().projectData.room.cabinets[0].width, 250);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(r.ui.recovery.length, 1, 'Existing project-file recovery must still notify the user');
  r.storage.failures.clear();
  r.saveUi();
  assert.deepEqual(r.results, { saves:[false, true], commits:[true] });
  assertFinished(r);
}

function cleanupFailureAndRetry(){
  const r = runtime();
  r.storage.failures.add('removeItem:' + SESSION);
  r.saveUi();
  assert.deepEqual(r.results, { saves:[true], commits:[false] });
  assert.equal(width(r), 250);
  assertPreserved(r);
  assert.deepEqual(r.storage.calls.filter(({ key })=> key === SESSION), [{ method:'removeItem', key:SESSION }]);
  assert.ok(r.ui.messages.some(({ message })=> /Projekt został zapisany.*nie udało się zakończyć sesji.*Spróbuj ponownie/.test(message)));
  r.storage.failures.clear();
  r.saveUi();
  assert.deepEqual(r.results, { saves:[true, true], commits:[false, true] });
  assertFinished(r);
}

function legacySaveCompatibility(){
  const r = runtime();
  const before = r.storage.getItem(PROJECTS);
  r.storage.failures.add('setItem:' + PROJECTS);
  const saved = r.FC.project.save(r.sandbox.projectData);
  assert.ok(saved && typeof saved === 'object', 'Existing save must still return projectData on failure');
  assert.equal(saved.schemaVersion, 1);
  assert.equal(saved.room.cabinets[0].width, 250);
  const confirmed = r.FC.project.saveConfirmed(r.sandbox.projectData);
  assert.equal(confirmed.ok, false);
  assert.deepEqual(clone(confirmed.project), clone(saved));
  assert.equal(r.storage.getItem(PROJECTS), before);
  assert.deepEqual(r.results.commits, []);
  assertPreserved(r);
  assert.deepEqual(r.storage.calls.filter(({ key })=> key === 'fc_project_v1' || /^fc_project_inv_/.test(key)), []);
}

(async()=>{
  const scenarios = [
    ['normal save, active clean session', ()=> normalSave(true)],
    ['normal save via current project without investor', ()=> normalSave(false)],
    ['central save failure, recovery and retry', centralFailureAndRetry],
    ['durable session cleanup failure and retry', cleanupFailureAndRetry],
    ['existing save compatibility on failure', legacySaveCompatibility],
  ];
  for(const [name, run] of scenarios){ await run(); console.log('PASS: ' + name); }
  console.log('project-session-confirmed-save-smoke: PASS (' + scenarios.length + '/' + scenarios.length + ')');
})().catch((error)=>{ console.error(error); process.exitCode = 1; });
