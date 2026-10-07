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
const project = (width)=> ({ schemaVersion:1, room:{ cabinets:[{ id:'cabinet', width }], fronts:[], sets:[], settings:{} } });

function runtime(withRecovery = true){
  class MemoryStorage{
    constructor(){ this.map = new Map(); this.failures = new Set(); }
    get length(){ return this.map.size; }
    key(index){ return Array.from(this.map.keys())[index] || null; }
    getItem(key){ return this.map.get(String(key)) ?? null; }
    check(method, key){
      if(this.failures.has(method + ':' + key)){
        const error = new Error('Forced storage failure: ' + key);
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
  const timers = new Map();
  let timerId = 0;
  const nodes = Object.fromEntries(['sessionButtons', 'sessionCancel', 'sessionSave'].map((id)=> [id, {
    style:{}, textContent:'', className:'', attributes:{},
    setAttribute(name, value){ this.attributes[name] = value; },
  }]));
  const ui = { messages:[], confirmations:[], recovery:[], reloads:0, errors:[] };
  const sandbox = {
    console:{ log:console.log, error(...args){ ui.errors.push(args); } }, Date,
    Storage:MemoryStorage, localStorage:storage, sessionStorage:new MemoryStorage(),
    setTimeout(callback, delay){ const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id){ timers.delete(id); },
    document:{ getElementById(id){ return nodes[id] || null; } },
    location:{ reload(){ ui.reloads += 1; } },
    uiState:{ activeTab:'wywiad', currentInvestorId:'investor-A' },
    alert(message){ ui.messages.push({ message }); },
    FC:{
      utils:{ clone },
      schema:{ CURRENT_SCHEMA_VERSION:1, DEFAULT_PROJECT:{ schemaVersion:1 } },
      actions:{ register(actions){ Object.assign(handlers, actions); } },
      infoBox:{ open(payload){ ui.messages.push(payload); } },
      confirmBox:{ async ask(payload){ ui.confirmations.push(payload); return false; } },
    },
  };
  if(withRecovery) sandbox.FC.choiceBox = { async ask(payload){ ui.recovery.push(payload); return 'back'; } };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for(const file of [
    'js/app/shared/constants.js', 'js/app/shared/storage.js',
    'js/app/project/project-model.js', 'js/app/project/project-store.js',
    'js/app/project/project-file-recovery.js', 'js/app/project/project-bridge.js',
    'js/app/investor/investor-project-repository.js', 'js/app/investor/investor-project-runtime.js',
    'js/app/investor/session.js', 'js/app/investor/investor-project-patches.js',
    'js/app/investor/project-autosave.js', 'js/app/ui/views.js', 'js/app/ui/actions-register.js',
  ]) vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename:file });
  const FC = sandbox.FC;
  assert.ok(FC.projectStore.upsert({ id:'A', investorId:'investor-A', projectData:project(60) }));
  FC.projectStore.setCurrentProjectId('A');
  storage.setItem('fc_current_investor_v1', 'investor-A');
  sandbox.projectData = FC.project.normalize(project(60));
  FC.investorProjectPatches.patchProjectSave();
  const autosave = ()=>{
    FC.projectAutosave.scheduleProjectAutosave();
    const entry = Array.from(timers.entries()).find(([, timer])=> timer.delay === 180);
    assert.ok(entry, 'Use the existing autosave flow and unchanged delay');
    timers.delete(entry[0]);
    entry[1].callback();
  };
  return { storage, sandbox, FC, ui, nodes, autosave, saveUi:()=> handlers['session-save']({}), cancelUi:()=> handlers['session-cancel']({}) };
}

function width(r){ return JSON.parse(r.storage.getItem(PROJECTS))[0].projectData.room.cabinets[0].width; }
function successes(r){ return r.ui.messages.filter(({ title })=> title === 'Projekt zapisany'); }

function failedAutosave(withRecovery = true){
  const r = runtime(withRecovery);
  r.sandbox.projectData = project(65);
  const before = r.storage.getItem(PROJECTS);
  r.storage.failures.add('setItem:' + PROJECTS);
  r.autosave();
  assert.equal(r.storage.getItem(PROJECTS), before);
  assert.equal(width(r), 60);
  assert.equal(r.sandbox.projectData.room.cabinets[0].width, 65);
  assert.equal(r.FC.session.active, true);
  assert.equal(r.FC.session.isDirty(), false, 'Storage did not change despite a real RAM edit');
  assert.ok(r.storage.getItem(SESSION));
  return r;
}

function failedAutosaveButtons(){
  const r = failedAutosave();
  assert.equal(r.FC.investorProjectRuntime.hasProjectDivergence(r.sandbox.projectData), true);
  assert.equal(r.FC.investorProjectRuntime.shouldTrackProjectSession(r.sandbox.projectData), false, 'Already active: do not begin a second session');
  r.FC.views.refreshSessionButtons();
  assert.equal(r.nodes.sessionCancel.textContent, 'Anuluj');
  assert.equal(r.nodes.sessionSave.textContent, 'Zapisz');
  assert.equal(r.nodes.sessionCancel.style.display, '');
  assert.equal(r.nodes.sessionSave.style.display, '');
  assert.equal(successes(r).length, 0, 'Autosave must never show the manual success dialog');
}

async function cancelRequiresConfirmation(){
  const r = failedAutosave();
  const ram = r.sandbox.projectData;
  const snapshot = r.FC.session.snapshot;
  let cancels = 0;
  r.FC.session.cancel = ()=> { cancels += 1; throw new Error('Declined cancel must not be called'); };
  await r.cancelUi();
  assert.equal(r.ui.confirmations.length, 1);
  assert.equal(r.ui.confirmations[0].title, 'ANULOWAĆ ZMIANY?');
  assert.match(r.ui.confirmations[0].message, /Niezapisane zmiany zostaną utracone/);
  assert.equal(r.ui.confirmations[0].cancelText, 'WRÓĆ');
  assert.equal(cancels, 0);
  assert.equal(r.ui.reloads, 0);
  assert.equal(r.sandbox.projectData, ram);
  assert.equal(r.FC.session.active, true);
  assert.equal(r.FC.session.snapshot, snapshot);
}

function derivedFactsStayClean(){
  const r = runtime();
  r.FC.session.begin();
  const cabinet = r.sandbox.projectData.room.cabinets[0];
  cabinet.derivedFacts = { inputHash:'rebuilt', cutlists:{ all:[{ name:'Side' }] } };
  cabinet._derivedFacts = { temporary:true };
  assert.equal(r.FC.investorProjectRuntime.hasProjectDivergence(r.sandbox.projectData), false);
  assert.equal(r.FC.session.isDirty(), false);
  r.FC.views.refreshSessionButtons();
  assert.equal(r.nodes.sessionCancel.textContent, 'Wyjdź');
  assert.equal(r.nodes.sessionSave.style.display, 'none', 'Active alone must not make UI dirty');
}

function storageDirtyAndInactiveControls(){
  const r = runtime();
  r.sandbox.projectData = project(65);
  r.FC.views.refreshSessionButtons();
  assert.equal(r.nodes.sessionSave.style.display, 'none', 'RAM divergence contributes only for an active session');
  r.sandbox.projectData = r.FC.project.normalize(project(60));
  r.FC.session.begin();
  r.storage.setItem('fc_quote_offer_drafts_v1', '[{"id":"edited"}]');
  assert.equal(r.FC.investorProjectRuntime.hasProjectDivergence(r.sandbox.projectData), false);
  assert.equal(r.FC.session.isDirty(), true);
  r.FC.views.refreshSessionButtons();
  assert.equal(r.nodes.sessionCancel.textContent, 'Anuluj');
  assert.equal(r.nodes.sessionSave.style.display, '');
}

function manualSaveSuccess(){
  const r = runtime();
  r.FC.session.begin();
  r.sandbox.projectData = project(65);
  r.saveUi();
  assert.equal(width(r), 65);
  assert.equal(r.FC.session.active, false);
  assert.equal(r.storage.getItem(SESSION), null);
  assert.equal(r.ui.messages.length, 1);
  assert.equal(successes(r).length, 1);
  assert.equal(r.ui.messages[0].message, 'Wszystkie zmiany zostały zapisane poprawnie.');
  assert.equal(r.ui.messages[0].okOnly, true, 'Existing infoBox must display its OK button');
}

async function saveFailureRecovery(){
  const r = failedAutosave();
  r.saveUi();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(successes(r).length, 0);
  assert.equal(r.FC.session.active, true);
  assert.ok(r.FC.session.snapshot);
  assert.ok(r.storage.getItem(SESSION));
  assert.equal(r.FC.projectFileRecovery.lastPendingRecord().projectData.room.cabinets[0].width, 65);
  assert.equal(r.ui.recovery.length, 1, 'Recovery handles repeated storage failures without a second dialog');
  assert.equal(r.ui.messages.length, 0, 'No fallback dialog while recovery handles the failure');
}

function saveFailureFallback(){
  const r = runtime();
  r.FC.session.begin();
  r.sandbox.projectData = project(65);
  r.FC.project.saveConfirmed = ()=> ({ ok:false, project:r.sandbox.projectData });
  r.saveUi();
  assert.equal(successes(r).length, 0);
  assert.equal(r.FC.session.active, true);
  assert.ok(r.FC.session.snapshot);
  assert.equal(r.ui.messages.length, 1);
  assert.equal(r.ui.messages[0].title, 'Nie udało się zapisać projektu');
  assert.match(r.ui.messages[0].message, /Zmiany nie zostały zapisane.*Sesja edycji pozostała aktywna.*Nie zamykaj programu/);
}

function storageNoticeIsNotDuplicated(){
  const r = runtime(false);
  r.FC.session.begin();
  r.sandbox.projectData = project(65);
  r.storage.failures.add('setItem:' + PROJECTS);
  r.saveUi();
  assert.equal(successes(r).length, 0);
  assert.equal(r.FC.session.active, true);
  assert.equal(r.ui.messages.length, 1, 'Keep the existing storage notice without an additional fallback');
  assert.match(r.ui.messages[0].message, /NIE został wykonany/);
}

function commitFailure(){
  const r = runtime();
  r.FC.session.begin();
  const snapshot = r.FC.session.snapshot;
  const raw = r.storage.getItem(SESSION);
  r.sandbox.projectData = project(65);
  r.storage.failures.add('removeItem:' + SESSION);
  r.saveUi();
  assert.equal(width(r), 65);
  assert.equal(successes(r).length, 0);
  assert.equal(r.ui.messages.length, 1);
  assert.match(r.ui.messages[0].message, /Projekt został zapisany, ale nie udało się zakończyć sesji edycji/);
  assert.equal(r.FC.session.active, true);
  assert.equal(r.FC.session.snapshot, snapshot);
  assert.equal(r.storage.getItem(SESSION), raw);
}

function noLegacyComparison(){
  const r = runtime();
  r.storage.removeItem(PROJECTS);
  let legacyReads = 0;
  r.FC.investorProjectRepository.readActiveProjectRaw = ()=> { legacyReads += 1; return JSON.stringify(r.sandbox.projectData); };
  assert.equal(r.FC.investorProjectRuntime.hasProjectDivergence(r.sandbox.projectData), true);
  assert.equal(legacyReads, 0, 'Missing central data must never make legacy a source of truth');
}

(async()=>{
  const scenarios = [
    ['failed autosave exposes RAM divergence in UI', failedAutosaveButtons],
    ['cancel confirms RAM loss and respects WRÓĆ', cancelRequiresConfirmation],
    ['derivedFacts and active clean session stay clean', derivedFactsStayClean],
    ['storage dirty and inactive session controls', storageDirtyAndInactiveControls],
    ['manual save displays exactly one full success', manualSaveSuccess],
    ['save failure preserves session and existing recovery', saveFailureRecovery],
    ['save failure fallback when recovery did not take over', saveFailureFallback],
    ['existing storage notice is not duplicated', storageNoticeIsNotDuplicated],
    ['commit failure preserves partial-success message', commitFailure],
    ['comparison never falls back to legacy', noLegacyComparison],
  ];
  for(const [name, run] of scenarios){ await run(); console.log('PASS: ' + name); }
  console.log('project-session-ram-central-dirty-smoke: PASS (' + scenarios.length + '/' + scenarios.length + ')');
})().catch((error)=>{ console.error(error); process.exitCode = 1; });
