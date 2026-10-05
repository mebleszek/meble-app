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

function createSandbox(){
  const localStorage = new QuotaStorage();
  const sessionStorage = new QuotaStorage();
  const notices = [];
  const sandbox = {
    console,
    JSON, Date, Math,
    setTimeout, clearTimeout,
    localStorage,
    sessionStorage,
    alert(message){ notices.push({ type:'alert', message:String(message || '') }); },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.FC = {
    utils:{ clone(value){ return value == null ? value : JSON.parse(JSON.stringify(value)); } },
    constants:{ STORAGE_KEYS:{ projects:'fc_projects_v1', currentProjectId:'fc_current_project_id_v1', projectData:'fc_project_v1' } },
    schema:{ CURRENT_SCHEMA_VERSION:1, DEFAULT_PROJECT:{ schemaVersion:1 } },
    infoBox:{ open(payload){ notices.push({ type:'infoBox', payload }); } },
  };
  sandbox.window.FC = sandbox.FC;
  vm.createContext(sandbox);
  [
    'js/app/shared/storage.js',
    'js/app/project/project-model.js',
    'js/app/project/project-store.js',
    'js/app/investor/investors-model.js',
    'js/app/investor/investors-local-repository.js',
    'js/app/investor/investors-store.js',
  ].forEach((file)=> vm.runInContext(read(file), sandbox, { filename:file }));
  return { sandbox, localStorage, notices };
}

function testProjectWriteFailureIsVisibleAndNotReportedAsSaved(){
  const { sandbox, localStorage, notices } = createSandbox();
  const FC = sandbox.FC;
  localStorage.block('fc_projects_v1');

  const saved = FC.projectStore.saveProjectDataForInvestor('inv_quota', { schemaVersion:1, pokoj:{ cabinets:[{ id:'cab_1' }], fronts:[], sets:[], settings:{} } });

  assert(saved === null, 'Centralny zapis projektu przy QuotaExceededError musi zwrócić null zamiast udawać sukces', saved);
  const failure = FC.storage.getLastWriteError();
  assert(failure && failure.ok === false && failure.isQuotaExceeded === true, 'Storage musi zachować informację o QuotaExceededError', failure);
  assert(notices.some((row)=> row.type === 'infoBox' && /NIE został wykonany/i.test(String(row.payload && row.payload.message || ''))),
    'Użytkownik musi dostać wyraźne ostrzeżenie, że projekt NIE został zapisany', notices);
  assert(localStorage.getItem('fc_projects_v1') == null, 'Nieudany zapis nie może zostawić pozoru zapisanego projektu');
}

function testInvestorWriteFailureReturnsNull(){
  const { sandbox, localStorage, notices } = createSandbox();
  const FC = sandbox.FC;
  localStorage.block('fc_investors_v1');

  const created = FC.investors.create({ name:'Test pełnego storage' });

  assert(created === null, 'Tworzenie inwestora przy błędzie storage musi zwrócić null zamiast udawać sukces', created);
  assert(notices.some((row)=> row.type === 'infoBox' && /danych inwestora/i.test(String(row.payload && row.payload.message || ''))),
    'Użytkownik musi dostać ostrzeżenie o nieudanym zapisie inwestora', notices);
  assert(localStorage.getItem('fc_investors_v1') == null, 'Nieudany zapis inwestora nie może wyglądać jak zapisany');
}

function testSuccessfulWritesStillWork(){
  const { sandbox } = createSandbox();
  const FC = sandbox.FC;
  const investor = FC.investors.create({ name:'Zapis OK' });
  assert(investor && investor.id, 'Normalny zapis inwestora przestał działać', investor);
  const project = FC.projectStore.saveProjectDataForInvestor(investor.id, { schemaVersion:1, pokoj:{ cabinets:[{ id:'cab_ok' }], fronts:[], sets:[], settings:{} } });
  assert(project && project.projectData, 'Normalny zapis projektu przestał działać', project);
  const loaded = FC.projectStore.loadProjectDataForInvestor(investor.id, null);
  const cabinets = loaded && loaded.pokoj && Array.isArray(loaded.pokoj.cabinets) ? loaded.pokoj.cabinets : [];
  assert(cabinets.some((row)=> row && row.id === 'cab_ok'), 'Projekt po poprawnym zapisie nie daje się odczytać', loaded);
}

try{
  testProjectWriteFailureIsVisibleAndNotReportedAsSaved();
  testInvestorWriteFailureReturnsNull();
  testSuccessfulWritesStillWork();
  console.log('project-storage-write-failure smoke: OK');
}catch(error){
  console.error('project-storage-write-failure smoke: FAIL');
  console.error('- ' + (error && error.message ? error.message : String(error)));
  if(error && error.details !== undefined) console.error(JSON.stringify(error.details, null, 2));
  process.exit(1);
}
