#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function assert(condition, message, details){
  if(condition) return;
  const error = new Error(message);
  if(details !== undefined) error.details = details;
  throw error;
}

class QuotaStorage{
  constructor(){ this.map = new Map(); this.blockedKeys = new Set(); }
  get length(){ return this.map.size; }
  key(index){ return Array.from(this.map.keys())[index] || null; }
  getItem(key){ return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
  setItem(key, value){
    const k = String(key);
    if(this.blockedKeys.has(k)){
      const error = new Error('QuotaExceededError: smoke storage full');
      error.name = 'QuotaExceededError';
      throw error;
    }
    this.map.set(k, String(value));
  }
  removeItem(key){ this.map.delete(String(key)); }
  block(key){ this.blockedKeys.add(String(key)); }
  unblock(key){ this.blockedKeys.delete(String(key)); }
}

function cabinets(count, prefix){
  return Array.from({ length:count }, (_, index)=> ({ id:(prefix || 'cab') + '_' + (index + 1) }));
}
function project(count, investorId, prefix){
  return {
    schemaVersion:1,
    meta:{ assignedInvestorId:investorId },
    pokoj:{ cabinets:cabinets(count, prefix), fronts:[], sets:[], settings:{} },
  };
}
function countCabinets(value){
  return value && value.pokoj && Array.isArray(value.pokoj.cabinets) ? value.pokoj.cabinets.length : 0;
}
function storedJson(storage, key){
  const raw = storage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

function createSandbox(){
  const localStorage = new QuotaStorage();
  const sessionStorage = new QuotaStorage();
  let currentInvestorId = 'inv_a';
  const notices = [];
  const sandbox = {
    console,
    JSON, Date, Math,
    setTimeout, clearTimeout,
    localStorage,
    sessionStorage,
    alert(message){ notices.push(String(message || '')); },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.FC = {
    utils:{ clone(value){ return value == null ? value : JSON.parse(JSON.stringify(value)); } },
    constants:{ STORAGE_KEYS:{
      projects:'fc_projects_v1',
      currentProjectId:'fc_current_project_id_v1',
      projectData:'fc_project_v1',
      projectBackup:'fc_project_backup_v1',
      projectBackupMeta:'fc_project_backup_meta_v1',
    } },
    schema:{ CURRENT_SCHEMA_VERSION:1, DEFAULT_PROJECT:{ schemaVersion:1 } },
    investors:{ getCurrentId(){ return currentInvestorId; } },
    session:{ active:false, durable:false, begin(){ this.active = true; this.durable = true; return true; } },
    views:{ refreshSessionButtons(){} },
    infoBox:{ open(payload){ notices.push(String(payload && payload.message || '')); } },
  };
  sandbox.window.FC = sandbox.FC;
  vm.createContext(sandbox);
  [
    'js/app/shared/storage.js',
    'js/app/project/project-model.js',
    'js/app/project/project-store.js',
    'js/app/project/project-bridge.js',
    'js/app/investor/investor-project-repository.js',
    'js/app/investor/investor-project-runtime.js',
    'js/app/investor/investor-project-patches.js',
  ].forEach((file)=> vm.runInContext(read(file), sandbox, { filename:file }));
  sandbox.FC.investorProjectPatches.patchProjectSave();
  return {
    sandbox,
    localStorage,
    notices,
    setCurrentInvestorId(value){ currentInvestorId = value; },
  };
}

function testNormalSaveOnlyChangesCentralProject(){
  const { sandbox, localStorage } = createSandbox();
  const FC = sandbox.FC;

  FC.projectStore.saveProjectDataForInvestor('inv_a', project(9, 'inv_a', 'central_before'));
  const centralBefore = FC.projectStore.getByInvestorId('inv_a');
  assert(centralBefore && countCabinets(centralBefore.projectData) === 9, 'Nie udało się przygotować centralnego projektu 9 szafek');

  localStorage.setItem('fc_project_v1', JSON.stringify(project(3, 'inv_a', 'active_legacy')));
  localStorage.setItem('fc_project_inv_inv_a_v1', JSON.stringify(project(5, 'inv_a', 'slot_legacy')));
  localStorage.setItem('fc_project_backup_v1', JSON.stringify(project(7, 'inv_a', 'backup_old')));

  const activeLegacyBefore = localStorage.getItem('fc_project_v1');
  const slotLegacyBefore = localStorage.getItem('fc_project_inv_inv_a_v1');

  FC.project.save(project(10, 'inv_a', 'central_after'));

  const centralAfter = FC.projectStore.getByInvestorId('inv_a');
  assert(centralAfter && countCabinets(centralAfter.projectData) === 10,
    'Normalny zapis nie zaktualizował centralnego ProjectStore do 10 szafek', centralAfter);
  assert(localStorage.getItem('fc_project_v1') === activeLegacyBefore,
    'Normalny zapis nadal aktualizuje pełną kopię fc_project_v1');
  assert(localStorage.getItem('fc_project_inv_inv_a_v1') === slotLegacyBefore,
    'Normalny zapis nadal aktualizuje legacy slot fc_project_inv_*');

  const backup = storedJson(localStorage, 'fc_project_backup_v1');
  assert(countCabinets(backup) === 9,
    'Backup po poprawnym zapisie powinien zawierać poprzedni centralny stan 9 szafek', backup);

  const loaded = FC.project.load();
  assert(countCabinets(loaded) === 10,
    'Po zapisie normalny odczyt nie wraca do centralnego projektu 10 szafek', loaded);
}

function testFailedCentralSaveDoesNotAdvanceBackupOrLegacy(){
  const { sandbox, localStorage } = createSandbox();
  const FC = sandbox.FC;

  FC.projectStore.saveProjectDataForInvestor('inv_a', project(4, 'inv_a', 'central_ok'));
  localStorage.setItem('fc_project_v1', JSON.stringify(project(2, 'inv_a', 'active_legacy')));
  localStorage.setItem('fc_project_inv_inv_a_v1', JSON.stringify(project(3, 'inv_a', 'slot_legacy')));
  localStorage.setItem('fc_project_backup_v1', JSON.stringify(project(1, 'inv_a', 'backup_sentinel')));

  const activeBefore = localStorage.getItem('fc_project_v1');
  const slotBefore = localStorage.getItem('fc_project_inv_inv_a_v1');
  const backupBefore = localStorage.getItem('fc_project_backup_v1');

  localStorage.block('fc_projects_v1');
  FC.project.save(project(6, 'inv_a', 'central_should_fail'));
  localStorage.unblock('fc_projects_v1');

  const central = FC.projectStore.getByInvestorId('inv_a');
  assert(central && countCabinets(central.projectData) === 4,
    'Nieudany centralny zapis zmienił źródło prawdy', central);
  assert(localStorage.getItem('fc_project_v1') === activeBefore,
    'Nieudany centralny zapis zmienił fc_project_v1');
  assert(localStorage.getItem('fc_project_inv_inv_a_v1') === slotBefore,
    'Nieudany centralny zapis zmienił legacy slot inwestora');
  assert(localStorage.getItem('fc_project_backup_v1') === backupBefore,
    'Backup został przesunięty mimo nieudanego zapisu centralnego');
}

function testInvestorActivationDoesNotRewriteFullLegacyCopies(){
  const { sandbox, localStorage, setCurrentInvestorId } = createSandbox();
  const FC = sandbox.FC;

  FC.projectStore.saveProjectDataForInvestor('inv_a', project(2, 'inv_a', 'a'));
  FC.projectStore.saveProjectDataForInvestor('inv_b', project(6, 'inv_b', 'b'));
  localStorage.setItem('fc_project_v1', JSON.stringify(project(1, 'inv_a', 'active_stale')));
  localStorage.setItem('fc_project_inv_inv_b_v1', JSON.stringify(project(3, 'inv_b', 'slot_stale')));

  const activeBefore = localStorage.getItem('fc_project_v1');
  const slotBefore = localStorage.getItem('fc_project_inv_inv_b_v1');
  setCurrentInvestorId('inv_b');
  FC.investorProjectRuntime.setActiveProjectFromInvestor('inv_b');

  assert(localStorage.getItem('fc_project_v1') === activeBefore,
    'Aktywacja inwestora nadal nadpisuje fc_project_v1');
  assert(localStorage.getItem('fc_project_inv_inv_b_v1') === slotBefore,
    'Aktywacja inwestora nadal nadpisuje jego legacy slot');
  const currentId = FC.projectStore.getCurrentProjectId();
  const current = FC.projectStore.getById(currentId);
  assert(current && current.investorId === 'inv_b' && countCabinets(current.projectData) === 6,
    'Po aktywacji currentProjectId nie wskazuje centralnego projektu inwestora B', { currentId, current });
}

try{
  testNormalSaveOnlyChangesCentralProject();
  testFailedCentralSaveDoesNotAdvanceBackupOrLegacy();
  testInvestorActivationDoesNotRewriteFullLegacyCopies();
  console.log('project-single-write-source smoke: OK');
}catch(error){
  console.error('project-single-write-source smoke: FAIL');
  console.error('- ' + (error && error.message ? error.message : String(error)));
  if(error && error.details !== undefined) console.error(JSON.stringify(error.details, null, 2));
  process.exit(1);
}
