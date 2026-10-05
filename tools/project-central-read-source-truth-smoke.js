#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { APP_DEV_SMOKE_FILES } = require('./app-dev-smoke-lib/file-list');
const { SmokeStorage, makeStorage } = require('./app-dev-smoke-lib/smoke-storage');
const { makeMiniDocument } = require('./app-dev-smoke-lib/mini-document');

function clone(value){ return value == null ? value : JSON.parse(JSON.stringify(value)); }

function assert(condition, message, details){
  if(condition) return;
  const error = new Error(message);
  error.details = details;
  throw error;
}

function createSandbox(localStorage){
  const sandbox = {
    console,
    setTimeout, clearTimeout,
    requestAnimationFrame:(fn)=> setTimeout(fn, 0),
    Date, Math, JSON,
    localStorage: localStorage || makeStorage(),
    sessionStorage: makeStorage(),
    Storage: SmokeStorage,
    document: makeMiniDocument(),
    structuredClone: global.structuredClone || ((x)=> JSON.parse(JSON.stringify(x))),
    crypto: require('crypto').webcrypto,
    __DEV_ASSETS__: {
      'index.html': fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8'),
      'dev_tests.html': fs.readFileSync(path.join(process.cwd(), 'dev_tests.html'), 'utf8'),
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.FC = {};
  return sandbox;
}

function loadSmokeFiles(sandbox){
  vm.createContext(sandbox);
  APP_DEV_SMOKE_FILES.forEach((file)=>{
    const code = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    vm.runInContext(code, sandbox, { filename:file });
  });
  return sandbox;
}

function project(investorId, roomId, cabinetCount, prefix){
  const cabinets = Array.from({ length:cabinetCount }, (_, index)=>({
    id:`${prefix}_${index + 1}`,
    width:60,
    height:82,
    depth:51,
    type:'stojąca',
    subType:'standardowa',
    frontCount:2,
    details:{ shelves:1 },
  }));
  return {
    schemaVersion:12,
    meta:{
      assignedInvestorId:investorId,
      roomDefs:{ [roomId]:{ id:roomId, baseType:'kuchnia', name:roomId, label:roomId } },
      roomOrder:[roomId],
    },
    [roomId]:{ cabinets, fronts:[], sets:[], settings:{} },
  };
}

function cabinetCount(data, roomId){
  return data && data[roomId] && Array.isArray(data[roomId].cabinets) ? data[roomId].cabinets.length : 0;
}

function seedConflict(sandbox){
  const FC = sandbox.FC;
  const centralA = project('inv_A', 'room_A', 9, 'centralA');
  const centralB = project('inv_B', 'room_B', 2, 'centralB');
  const activeLegacy = project('inv_A', 'room_A', 3, 'activeLegacy');
  const backupLegacy = project('inv_A', 'room_A', 7, 'backupLegacy');
  const investorLegacy = project('inv_A', 'room_A', 5, 'investorLegacy');

  FC.projectStore.writeAll([
    { id:'proj_A', investorId:'inv_A', title:'A', status:'nowy', projectData:clone(centralA), createdAt:1, updatedAt:2, meta:{} },
    { id:'proj_B', investorId:'inv_B', title:'B', status:'nowy', projectData:clone(centralB), createdAt:1, updatedAt:2, meta:{} },
  ]);
  FC.projectStore.setCurrentProjectId('proj_A');
  sandbox.localStorage.setItem('fc_current_investor_v1', 'inv_A');
  sandbox.localStorage.setItem('fc_project_v1', JSON.stringify(activeLegacy));
  sandbox.localStorage.setItem('fc_project_backup_v1', JSON.stringify(backupLegacy));
  sandbox.localStorage.setItem('fc_project_inv_inv_A_v1', JSON.stringify(investorLegacy));
  return { centralA, centralB };
}

function testCentralWinsEveryNormalRead(){
  const sandbox = loadSmokeFiles(createSandbox());
  const FC = sandbox.FC;
  seedConflict(sandbox);

  const loaded = FC.project.load();
  assert(cabinetCount(loaded, 'room_A') === 9,
    'FC.project.load ma czytać projekt centralny, nie fc_project_v1/backup/legacy slot', loaded);

  sandbox.projectData = clone(loaded);
  sandbox.window.projectData = sandbox.projectData;
  const materialCabinets = FC.materialTabData.getRoomCabinets('room_A');
  assert(Array.isArray(materialCabinets) && materialCabinets.length === 9,
    'MATERIAŁ ma pracować na projectData załadowanym z centralnego projectStore', materialCabinets);

  sandbox.localStorage.setItem('fc_project_v1', '{uszkodzony-json');
  sandbox.localStorage.setItem('fc_project_backup_v1', '{uszkodzony-backup');
  sandbox.localStorage.setItem('fc_project_inv_inv_A_v1', '');
  const afterCorruption = FC.project.load();
  assert(cabinetCount(afterCorruption, 'room_A') === 9,
    'Uszkodzone/puste legacy dane nie mogą wpływać na normalny centralny odczyt', afterCorruption);
}


function testMissingCentralDoesNotReadLegacyCopies(){
  const sandbox = loadSmokeFiles(createSandbox());
  const FC = sandbox.FC;
  const legacy = project('inv_missing', 'room_missing', 6, 'legacyMissing');
  sandbox.localStorage.setItem('fc_current_investor_v1', 'inv_missing');
  sandbox.localStorage.setItem('fc_project_v1', JSON.stringify(legacy));
  sandbox.localStorage.setItem('fc_project_backup_v1', JSON.stringify(legacy));
  sandbox.localStorage.setItem('fc_project_inv_inv_missing_v1', JSON.stringify(legacy));
  FC.projectStore.writeAll([]);
  FC.projectStore.setCurrentProjectId('');

  const loaded = FC.project.load();
  assert(cabinetCount(loaded, 'room_missing') === 0,
    'Brak centralnego rekordu nie może powodować normalnego odczytu projektu z legacy/backup', loaded);
}

function testInvestorSwitchUsesMatchingCentralRecord(){
  const sandbox = loadSmokeFiles(createSandbox());
  const FC = sandbox.FC;
  seedConflict(sandbox);

  sandbox.localStorage.setItem('fc_current_investor_v1', 'inv_B');
  // Celowo zostawiamy stale currentProjectId=proj_A i legacy aktywnego projektu A.
  const loaded = FC.project.load();
  assert(cabinetCount(loaded, 'room_B') === 2 && !loaded.room_A,
    'Aktywny inwestor B ma dostać centralny projekt B mimo starego currentProjectId/legacy projektu A', loaded);
}

function testRestartStillUsesCentralStore(){
  const sharedStorage = makeStorage();
  const first = loadSmokeFiles(createSandbox(sharedStorage));
  seedConflict(first);

  const second = loadSmokeFiles(createSandbox(sharedStorage));
  const loaded = second.FC.project.load();
  assert(cabinetCount(loaded, 'room_A') === 9,
    'Po restarcie centralny projectStore ma nadal wygrać z równoległymi legacy kopiami', loaded);
}

try{
  testCentralWinsEveryNormalRead();
  testMissingCentralDoesNotReadLegacyCopies();
  testInvestorSwitchUsesMatchingCentralRecord();
  testRestartStillUsesCentralStore();
  console.log('project-central-read-source-truth smoke: OK');
}catch(error){
  console.error('project-central-read-source-truth smoke: FAIL');
  console.error('- ' + (error && error.message ? error.message : String(error)));
  if(error && error.details !== undefined) console.error(JSON.stringify(error.details, null, 2));
  process.exit(1);
}
