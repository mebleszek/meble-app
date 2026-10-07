#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const PROJECTS = 'fc_projects_v1';
const SESSION = 'fc_edit_session_v1';
const OPTIONS = 'fc_material_part_options_v1';
const EDGES = 'fc_edge_v1';
const clone = (value)=> JSON.parse(JSON.stringify(value));
const project = (width)=> ({ schemaVersion:1, room:{ cabinets:[{ id:'cabinet', width }], fronts:[{ cabinetId:'cabinet' }], sets:[], settings:{} } });

function runtime(rows, seed = true){
  class MemoryStorage{
    constructor(initial){ this.map = new Map(Object.entries(initial || {})); this.calls = []; this.failures = new Set(); }
    get length(){ return this.map.size; }
    key(index){ return Array.from(this.map.keys())[index] || null; }
    getItem(key){ return this.map.get(String(key)) ?? null; }
    check(method, key){
      this.calls.push({ method, key });
      if(this.failures.has(method + ':' + key)){
        const error = new Error('Forced durability failure: ' + key);
        error.name = 'QuotaExceededError';
        throw error;
      }
    }
    setItem(key, value){ key = String(key); this.check('setItem', key); this.map.set(key, String(value)); }
    removeItem(key){ key = String(key); this.check('removeItem', key); this.map.delete(key); }
    clear(){ throw new Error('localStorage.clear is forbidden'); }
  }
  const storage = new MemoryStorage(rows);
  const ui = { messages:[], refreshes:0, projectSaves:0, frontRemovals:0, panel:null, closes:0 };
  const nodes = [];
  function createElement(tag){
    const node = {
      tag, children:[], className:'', textContent:'', listeners:{}, attributes:{},
      appendChild(child){ this.children.push(child); return child; },
      setAttribute(key, value){ this.attributes[key] = value; },
      addEventListener(event, handler){ this.listeners[event] = handler; },
      click(){ return this.listeners.click && this.listeners.click(); },
      set innerHTML(value){ this.children = []; },
    };
    node.classList = {
      add(name){ this.toggle(name, true); },
      toggle(name, on){
        const classes = new Set(node.className.split(/\s+/).filter(Boolean));
        if(on) classes.add(name); else classes.delete(name);
        node.className = Array.from(classes).join(' ');
      },
    };
    nodes.push(node);
    return node;
  }
  const timers = new Map();
  let timerId = 0;
  const sandbox = {
    console, Date, Storage:MemoryStorage, localStorage:storage, sessionStorage:new MemoryStorage(),
    setTimeout(callback, delay){ const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id){ timers.delete(id); },
    document:{ createElement },
    uiState:{ activeTab:'wywiad', roomType:'room', currentInvestorId:'investor-A', selectedCabinetId:'cabinet' },
    removeFrontsForCab(){ ui.frontRemovals += 1; },
    FC:{
      utils:{ clone },
      schema:{ CURRENT_SCHEMA_VERSION:1, DEFAULT_PROJECT:{ schemaVersion:1 } },
      infoBox:{ open(payload){ ui.messages.push(payload); } },
      confirmBox:{ async ask(){ return true; } },
      views:{ refreshSessionButtons(){ ui.refreshes += 1; } },
      panelBox:{ open(payload){ ui.panel = payload; }, close(){ ui.closes += 1; } },
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for(const file of [
    'js/app/shared/constants.js', 'js/app/shared/storage.js',
    'js/app/project/project-model.js', 'js/app/project/project-store.js', 'js/app/project/project-bridge.js',
    'js/app/investor/investor-project-repository.js', 'js/app/investor/investor-project-runtime.js',
    'js/app/investor/session.js', 'js/app/investor/investor-project-patches.js',
    'js/app/investor/project-autosave.js', 'js/app/cabinet/cabinet-actions.js',
    'js/app/material/material-part-options.js', 'js/app/material/material-edge-store.js',
  ]) vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename:file });
  const FC = sandbox.FC;
  sandbox.STORAGE_KEYS = FC.constants.STORAGE_KEYS;
  if(seed){
    assert.ok(FC.projectStore.upsert({ id:'A', investorId:'investor-A', projectData:project(60) }));
    FC.projectStore.setCurrentProjectId('A');
    storage.setItem('fc_current_investor_v1', 'investor-A');
  }
  sandbox.projectData = FC.project.normalize(project(60));
  const originalSave = FC.project.save;
  FC.project.save = (data)=> { ui.projectSaves += 1; return originalSave(data); };
  FC.investorProjectPatches.patchProjectSave();
  storage.calls.length = 0;
  const autosave = ()=>{
    FC.projectAutosave.scheduleProjectAutosave();
    const entry = Array.from(timers.entries()).find(([, timer])=> timer.delay === 180);
    assert.ok(entry, 'Exercise the unchanged normal autosave flow');
    timers.delete(entry[0]);
    entry[1].callback();
  };
  return { storage, sandbox, FC, session:FC.session, ui, nodes, autosave };
}

function assertPersisted(r, snapshot){
  const payload = JSON.parse(r.storage.getItem(SESSION));
  assert.equal(payload.active, true);
  assert.deepEqual(payload.snapshot, clone(snapshot));
  assert.equal(payload.startedAt, r.session.startedAt);
  assert.deepEqual(payload.context, clone(r.session.context));
  assert.equal(r.session.durable, true);
}

function normalBegin(){
  const r = runtime();
  assert.equal(r.session.begin(), true);
  assert.equal(r.session.active, true);
  assert.ok(r.session.snapshot);
  assertPersisted(r, r.session.snapshot);
}

function failedBegin(){
  const r = runtime();
  const before = r.storage.getItem(PROJECTS);
  r.sandbox.projectData = project(65);
  r.storage.failures.add('setItem:' + SESSION);
  assert.equal(r.session.begin(), false);
  assert.equal(r.session.active, true);
  assert.equal(r.session.durable, false);
  assert.equal(r.session.snapshot[PROJECTS], before);
  assert.equal(r.storage.getItem(SESSION), null);
  assert.equal(r.session.suspendTracking, false);
  assert.equal(r.ui.messages.length, 1);
  assert.equal(r.ui.messages[0].title, 'Nie udało się zabezpieczyć sesji edycji');
  assert.equal(r.ui.messages[0].message, 'Nie udało się zapisać stanu potrzebnego do bezpiecznego cofnięcia zmian. Zapis zmian został wstrzymany. Nie zamykaj programu i spróbuj ponownie.');
  assert.equal(r.ui.messages[0].okOnly, true);
  assert.equal(r.session.begin(), false);
  assert.equal(r.session.begin(), false);
  assert.equal(r.ui.messages.length, 1, 'Repeated failed autosaves must not spam the same warning');
  return r;
}

function retryBegin(){
  const r = failedBegin();
  const snapshot = r.session.snapshot;
  const context = r.session.context;
  const startedAt = r.session.startedAt;
  r.sandbox.projectData = project(70);
  r.storage.setItem('fc_ui_v1', '{"activeTab":"material"}');
  r.storage.failures.clear();
  assert.equal(r.session.begin(), true);
  assert.equal(r.session.snapshot, snapshot);
  assert.equal(r.session.context, context);
  assert.equal(r.session.startedAt, startedAt);
  assert.equal(snapshot.fc_ui_v1, null, 'Later storage state must not become the rollback baseline');
  assertPersisted(r, snapshot);
}

function autosaveBlockedAndRetry(){
  const r = runtime();
  const before = r.storage.getItem(PROJECTS);
  r.sandbox.projectData = project(65);
  r.storage.failures.add('setItem:' + SESSION);
  r.autosave();
  const snapshot = r.session.snapshot;
  assert.equal(snapshot[PROJECTS], before);
  r.autosave();
  assert.equal(r.storage.getItem(PROJECTS), before);
  assert.equal(r.sandbox.projectData.room.cabinets[0].width, 65);
  assert.equal(r.session.active, true);
  assert.equal(r.session.durable, false);
  assert.equal(r.ui.projectSaves, 0, 'Do not call the central save before durable begin');
  assert.equal(r.storage.calls.filter(({ method, key })=> method === 'setItem' && key === PROJECTS).length, 0);
  assert.equal(r.ui.messages.length, 1);
  assert.equal(r.ui.refreshes, 2, 'Refresh buttons even when the save is blocked');
  r.storage.failures.clear();
  r.storage.calls.length = 0;
  r.autosave();
  assertPersisted(r, snapshot);
  assert.equal(r.session.snapshot, snapshot);
  assert.equal(r.ui.projectSaves, 1);
  assert.equal(JSON.parse(r.storage.getItem(PROJECTS))[0].projectData.room.cabinets[0].width, 65);
  const sessionWrite = r.storage.calls.findIndex(({ method, key })=> method === 'setItem' && key === SESSION);
  const centralWrite = r.storage.calls.findIndex(({ method, key })=> method === 'setItem' && key === PROJECTS);
  assert.ok(sessionWrite >= 0 && centralWrite > sessionWrite, 'Persist the original rollback snapshot before writing the project');
  assert.deepEqual(r.storage.calls.filter(({ key })=> key === 'fc_project_v1' || /^fc_project_inv_/.test(key)), []);
}

async function cabinetDeleteBlocked(){
  const r = runtime();
  let begins = 0;
  r.FC.session = { active:true, begin(){ begins += 1; return false; } };
  const before = clone(r.sandbox.projectData);
  await r.FC.cabinetActions.deleteCabinetById('cabinet');
  assert.equal(begins, 1, 'An active session must still pass the begin gate');
  assert.deepEqual(clone(r.sandbox.projectData), before);
  assert.equal(r.ui.frontRemovals, 0);
  assert.equal(r.ui.projectSaves, 0);
  assert.equal(r.sandbox.uiState.selectedCabinetId, 'cabinet');
}

function partOptionsBlocked(){
  const r = runtime();
  r.storage.setItem(OPTIONS, '{"part":"horizontal"}');
  const before = r.storage.getItem(OPTIONS);
  r.storage.calls.length = 0;
  r.FC.session = { active:true, begin(){ return false; } };
  assert.equal(r.FC.materialPartOptions.setDirection('part', 'vertical'), false);
  assert.equal(r.storage.getItem(OPTIONS), before);
  assert.deepEqual(r.storage.calls.filter(({ key })=> key === OPTIONS), [], 'No direct write or fallback may bypass failed begin');
  assert.equal(r.FC.materialPartOptions.getDirection('part'), 'horizontal');
}

function modalKeepsDraftAndRetries(){
  const r = runtime();
  let ready = false;
  let saves = 0;
  r.FC.session = { begin(){ return ready; } };
  r.FC.materialPartOptions.openOptionsModal({ sig:'part', onSave(){ saves += 1; } });
  const choice = r.nodes.find((node)=> node.children.some((child)=> child.textContent === 'Pion'));
  const save = r.nodes.find((node)=> node.textContent === 'Zapisz');
  assert.ok(choice && save && r.ui.panel);
  choice.click();
  save.click();
  assert.equal(saves, 0);
  assert.equal(r.ui.closes, 0);
  assert.equal(r.storage.getItem(OPTIONS), null);
  assert.match(choice.className, /is-selected/, 'The failed save must preserve the selected draft');
  ready = true;
  save.click();
  assert.equal(saves, 1);
  assert.equal(r.ui.closes, 1);
  assert.equal(r.FC.materialPartOptions.getDirection('part'), 'vertical');
}

function edgeStoreBlockedAndRetries(){
  const r = runtime();
  let ready = false;
  let afterSaves = 0;
  r.FC.session = { active:true, begin(){ return ready; } };
  const api = r.FC.materialEdgeStore.createEdgeStore({ onAfterSave(){ afterSaves += 1; } });
  const part = { name:'Front', material:'Front: laminat • Test', qty:1, a:60, b:40 };
  const sig = api.signatureFromPart(part);
  const defaults = api.getEdges(sig, part, {});
  const previous = api.store[sig];
  assert.equal(api.setEdges(sig, { w1:false }), false);
  assert.equal(api.store[sig], previous, 'Restore the prior in-memory value for this operation');
  assert.deepEqual(clone(api.getEdges(sig, part, {})), clone(defaults));
  assert.equal(api.setEdges('new-part', { w1:true }), false);
  assert.equal(Object.hasOwn(api.store, 'new-part'), false, 'Remove a new RAM override after failed persist');
  assert.equal(r.storage.getItem(EDGES), null);
  assert.equal(afterSaves, 0);
  assert.deepEqual(r.storage.calls.filter(({ key })=> key === EDGES), []);
  ready = true;
  assert.equal(api.setEdges(sig, { w1:false }), true);
  assert.equal(JSON.parse(r.storage.getItem(EDGES))[sig].w1, false);
  assert.equal(api.store[sig].w1, false);
  assert.equal(afterSaves, 1);
}

function durableIdempotency(){
  const r = runtime();
  assert.equal(r.session.begin(), true);
  const snapshot = r.session.snapshot;
  const startedAt = r.session.startedAt;
  const raw = r.storage.getItem(SESSION);
  r.storage.setItem('fc_ui_v1', '{"later":true}');
  r.storage.failures.add('setItem:' + SESSION);
  r.storage.calls.length = 0;
  assert.equal(r.session.begin(), true);
  assert.equal(r.session.snapshot, snapshot);
  assert.equal(r.session.startedAt, startedAt);
  assert.equal(r.storage.getItem(SESSION), raw);
  assert.deepEqual(r.storage.calls.filter(({ key })=> key === SESSION), [], 'Durable begin needs no rewrite or new baseline');
}

function restoreAndEndDurability(){
  const r = runtime();
  assert.equal(r.session.begin(), true);
  const restored = runtime(Object.fromEntries(r.storage.map), false);
  assert.equal(restored.session.active, true);
  assertPersisted(restored, r.session.snapshot);
  assert.equal(restored.session.begin(), true);
  restored.storage.failures.add('removeItem:' + SESSION);
  assert.equal(restored.session.commit(), false);
  assert.equal(restored.session.durable, true);
  restored.storage.failures.clear();
  assert.equal(restored.session.commit(), true);
  assert.equal(restored.session.durable, false);
  assert.equal(restored.session.active, false);
  assert.equal(restored.session.begin(), true);
  restored.storage.failures.add('removeItem:' + SESSION);
  assert.equal(restored.session.cancel(), false);
  assert.equal(restored.session.durable, true);
  restored.storage.failures.clear();
  assert.equal(restored.session.cancel(), true);
  assert.equal(restored.session.durable, false);
  assert.equal(restored.storage.getItem(SESSION), null);
}

(async()=>{
  const scenarios = [
    ['normal begin is active and durable', normalBegin],
    ['failed begin preserves RAM snapshot and suppresses repeated warnings', failedBegin],
    ['retry persists the original snapshot', retryBegin],
    ['autosave blocked until original snapshot is durable', autosaveBlockedAndRetry],
    ['cabinet delete blocked before any mutation', cabinetDeleteBlocked],
    ['material part options cannot bypass failed begin', partOptionsBlocked],
    ['options modal preserves draft and allows retry', modalKeepsDraftAndRetries],
    ['edge store restores RAM and skips success callbacks on failed begin', edgeStoreBlockedAndRetries],
    ['active durable begin is idempotent', durableIdempotency],
    ['restore and successful commit/cancel maintain durability state', restoreAndEndDurability],
  ];
  for(const [name, run] of scenarios){ await run(); console.log('PASS: ' + name); }
  console.log('project-session-begin-durability-smoke: PASS (' + scenarios.length + '/' + scenarios.length + ')');
})().catch((error)=>{ console.error(error); process.exitCode = 1; });
