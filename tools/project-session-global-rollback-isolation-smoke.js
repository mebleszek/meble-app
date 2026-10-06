#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const SESSION_KEY = 'fc_edit_session_v1';
const PROJECT_KEY = 'fc_projects_v1';
const GLOBAL_KEYS = [
  'fc_materials_v1', 'fc_services_v1', 'fc_sheet_materials_v1',
  'fc_accessories_v1', 'fc_hardware_manufacturers_v1',
  'fc_hardware_suppliers_v1', 'fc_hardware_settings_v1',
  'fc_hardware_categories_v1', 'fc_hardware_types_v1',
  'fc_hardware_technical_params_v1', 'fc_program_defaults_v1',
  'fc_company_profile_v1', 'fc_business_costs_v1', 'fc_quote_rates_v1',
  'fc_workshop_services_v1', 'fc_service_orders_v1', 'fc_sheets_v1',
];
const UNKNOWN_KEYS = ['fc_future_global_v1', 'unrecognized_key', 'fc_project_inv_A_v2'];
const PROTECTED_KEYS = [...GLOBAL_KEYS, ...UNKNOWN_KEYS];
const ALLOWED_KEYS = [
  PROJECT_KEY, 'fc_current_project_id_v1', 'fc_investors_v1',
  'fc_current_investor_v1', 'fc_investor_ui_v1', 'fc_quote_snapshots_v1',
  'fc_quote_offer_drafts_v1', 'fc_edge_v1', 'fc_material_part_options_v1',
  'fc_ui_v1', 'fc_project_backup_v1', 'fc_project_backup_meta_v1',
  'fc_project_v1', 'fc_project_inv_A_v1',
];

function projectRaw(version){
  return JSON.stringify([{ id:'A', projectData:{ title:version } }]);
}

function initialRows(){
  const rows = Object.fromEntries(GLOBAL_KEYS.map((key)=> [key, 'before:' + key]));
  rows[PROJECT_KEY] = projectRaw('P1');
  rows.fc_current_project_id_v1 = 'A';
  rows.fc_quote_rates_v1 = '100';
  rows.fc_accessories_v1 = '10';
  UNKNOWN_KEYS.forEach((key)=> { rows[key] = 'before:' + key; });
  // A known global key absent at begin, then created during the session.
  delete rows.fc_services_v1;
  return rows;
}

function makeRuntime(rows){
  // Each VM gets a fresh prototype: session.js patches Storage.prototype.
  class MemoryStorage{
    constructor(){ this.map = new Map(Object.entries(rows)); this.operations = []; }
    get length(){ return this.map.size; }
    key(index){ return Array.from(this.map.keys())[index] || null; }
    getItem(key){ return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
    setItem(key, value){
      this.operations.push({ method:'setItem', key:String(key) });
      this.map.set(String(key), String(value));
    }
    removeItem(key){
      this.operations.push({ method:'removeItem', key:String(key) });
      this.map.delete(String(key));
    }
    clear(){
      this.operations.push({ method:'clear' });
      throw new Error('localStorage.clear() is forbidden');
    }
  }
  const storage = new MemoryStorage();
  const sandbox = { console, Date, localStorage:storage, Storage:MemoryStorage };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/app/shared/constants.js'), 'utf8'), sandbox);
  // Future constants must not expand project rollback rights automatically.
  sandbox.FC.constants.STORAGE_KEYS.futureGlobal = UNKNOWN_KEYS[0];
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/app/investor/session.js'), 'utf8'), sandbox);
  return { storage, session:sandbox.FC.session };
}

function changeGlobals(storage){
  PROTECTED_KEYS.forEach((key)=> storage.setItem(key, 'after:' + key));
  storage.setItem('fc_quote_rates_v1', '250');
  storage.setItem('fc_accessories_v1', '25');
  storage.removeItem('fc_materials_v1');
  storage.setItem('fc_new_global_after_begin_v1', 'created');
}

function assertClean(session){
  assert.equal(session.isDirty(), false, 'Global-only edits must not dirty the project');
  assert.equal(session.changedKeys.size, 0, 'Mutation tracking must ignore globals');
  session.invalidateDirtyCache();
  assert.equal(session.isDirty(), false, 'Uncached comparison must ignore globals');
  assert.equal(session.isDirty(), false, 'Cached comparison must ignore globals');
  for(const key of PROTECTED_KEYS){
    assert.ok(!session.comparableKeys.includes(key), 'Comparable keys include ' + key);
  }
}

function assertCancel(runtime){
  const { storage, session } = runtime;
  const keys = [...PROTECTED_KEYS, 'fc_new_global_after_begin_v1'];
  const currentGlobals = new Map(keys.map((key)=> [key, storage.getItem(key)]));
  storage.operations.length = 0;
  session.cancel();
  assert.equal(storage.getItem(PROJECT_KEY), projectRaw('P1'), 'Cancel must restore project P2 -> P1');
  assert.equal(storage.getItem('fc_quote_rates_v1'), '250');
  assert.equal(storage.getItem('fc_accessories_v1'), '25');
  assert.equal(storage.getItem('fc_materials_v1'), null, 'Deleted global must stay deleted');
  assert.equal(storage.getItem('fc_services_v1'), 'after:fc_services_v1', 'Created global must survive');
  for(const [key, raw] of currentGlobals){
    assert.equal(storage.getItem(key), raw, 'Cancel changed protected key ' + key);
  }
  assert.deepEqual(storage.operations.filter((op)=> keys.includes(op.key) || op.method === 'clear'), [],
    'Cancel must never call setItem/removeItem for protected keys or clear');
  assert.ok(storage.operations.some((op)=> op.key === PROJECT_KEY && op.method === 'setItem'),
    'Disabling cancel entirely must not pass');
  assert.equal(session.active, false);
  assert.equal(session.isDirty(), false);
  assert.equal(storage.getItem(SESSION_KEY), null);
}

function testNewSession(){
  const runtime = makeRuntime(initialRows());
  const { storage, session } = runtime;
  session.begin();
  const persisted = JSON.parse(storage.getItem(SESSION_KEY));
  for(const key of PROTECTED_KEYS){
    assert.ok(!Object.hasOwn(session.snapshot, key), 'Runtime snapshot includes ' + key);
    assert.ok(!Object.hasOwn(persisted.snapshot, key), 'Saved snapshot includes ' + key);
  }
  changeGlobals(storage);
  assertClean(session);
  storage.setItem(PROJECT_KEY, projectRaw('P2'));
  assert.equal(session.isDirty(), true, 'Project edit must remain dirty');
  assertCancel(runtime);
}

function oldPayload(rows){
  return {
    schemaVersion:2, active:true, startedAt:1234, updatedAt:1235,
    context:{ projectId:'A', investorId:'' },
    snapshot:{ ...Object.fromEntries(ALLOWED_KEYS.map((key)=> [key, null])), ...rows,
      fc_services_v1:null },
  };
}

function testOldSession(projectChanged){
  const before = initialRows();
  const staging = makeRuntime(before);
  changeGlobals(staging.storage);
  if(projectChanged) staging.storage.setItem(PROJECT_KEY, projectRaw('P2'));
  const rows = Object.fromEntries(staging.storage.map);
  rows[SESSION_KEY] = JSON.stringify(oldPayload(before));
  const runtime = makeRuntime(rows);
  const { session } = runtime;
  assert.equal(session.active, true, 'Old schema-2 session must be accepted');
  assert.equal(session.snapshot[PROJECT_KEY], projectRaw('P1'));
  for(const key of PROTECTED_KEYS){
    assert.ok(!Object.hasOwn(session.snapshot, key), 'restoreSession accepted ' + key);
  }
  if(projectChanged) assert.equal(session.isDirty(), true);
  else assertClean(session);
  assertCancel(runtime);
}

function testInjectedRuntimeSnapshot(){
  const runtime = makeRuntime(initialRows());
  const { storage, session } = runtime;
  session.begin();
  changeGlobals(storage);
  // Bypass restore filtering: cancel must enforce its own final write guard.
  PROTECTED_KEYS.forEach((key, index)=> {
    session.snapshot[key] = index % 2 ? null : 'injected-old-value';
    session.comparableKeys.push(key);
    session.changedKeys.add(key);
  });
  session.lastDirtyCheckAt = Date.now();
  session.lastDirtyValue = true;
  assertClean(session);
  // Also exercise rebuilding the comparable-key cache from a tainted snapshot.
  session.comparableKeys = null;
  assertClean(session);
  storage.setItem(PROJECT_KEY, projectRaw('P2'));
  assert.equal(session.isDirty(), true);
  assertCancel(runtime);
}

function testTemporaryRollbackScope(){
  const rows = Object.fromEntries(ALLOWED_KEYS.map((key)=> [key, 'before:' + key]));
  const { storage, session } = makeRuntime(rows);
  session.begin();
  ALLOWED_KEYS.forEach((key)=> {
    storage.setItem(key, 'after:' + key);
    assert.ok(session.changedKeys.has(key), 'Allowed mutation was not tracked: ' + key);
  });
  session.cancel();
  ALLOWED_KEYS.forEach((key)=> assert.equal(storage.getItem(key), rows[key], 'Lost existing rollback: ' + key));
}

testNewSession();
testOldSession(true);
testOldSession(false);
testInjectedRuntimeSnapshot();
testTemporaryRollbackScope();
console.log('project-session-global-rollback-isolation smoke: PASS (5 scenarios)');
