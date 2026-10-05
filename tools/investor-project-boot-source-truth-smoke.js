#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const RUNTIME = 'js/app/investor/investor-project-runtime.js';

function read(rel){
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function clone(value){
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function assert(condition, message, details){
  if(condition) return;
  const error = new Error(message);
  if(details !== undefined) error.details = details;
  throw error;
}

function projectWithCabinets(investorId, cabinetIds){
  return {
    schemaVersion:2,
    meta:{ assignedInvestorId:investorId },
    kuchnia:{
      cabinets:(cabinetIds || []).map((id)=>({ id })),
      fronts:[], sets:[], settings:{},
    },
  };
}

function createRuntimeScenario(options){
  const opts = options || {};
  const investorId = String(opts.investorId || 'inv_boot');
  let centralProject = clone(opts.centralProject || null);
  let legacyProject = clone(opts.legacyProject || null);
  let activeProject = null;
  const writes = { central:[], legacy:[], active:[] };

  const sandbox = {
    console,
    JSON,
    Date,
    setTimeout,
    clearTimeout,
    projectData:clone(opts.initialProject || null),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.FC = {
    utils:{ clone },
    project:{
      DEFAULT_PROJECT:projectWithCabinets(investorId, []),
      normalize:clone,
      save(project){
        activeProject = clone(project);
        sandbox.projectData = clone(project);
        writes.active.push(clone(project));
        return clone(project);
      },
    },
    investorProjectRepository:{
      getCurrentInvestorId(){ return investorId; },
      loadCentralProjectForInvestor(_id, fallback){
        return centralProject == null ? fallback : clone(centralProject);
      },
      saveCentralProjectForInvestor(_id, project){
        centralProject = clone(project);
        writes.central.push(clone(project));
        return { id:'proj_boot', investorId, projectData:clone(project) };
      },
      ensureCentralProjectForInvestor(_id, optionsArg){
        if(centralProject == null){
          centralProject = clone(optionsArg && optionsArg.projectData || null);
          writes.central.push(clone(centralProject));
        }
        return { id:'proj_boot', investorId, projectData:clone(centralProject) };
      },
      readLegacySlotRaw(){
        return legacyProject == null ? null : JSON.stringify(legacyProject);
      },
      readLegacySlotProject(){ return clone(legacyProject); },
      writeLegacySlotProject(_id, project){
        legacyProject = clone(project);
        writes.legacy.push(clone(project));
        return clone(project);
      },
      writeActiveProject(project){
        activeProject = clone(project);
        writes.active.push(clone(project));
        return clone(project);
      },
      readActiveProjectRaw(){
        return activeProject == null ? null : JSON.stringify(activeProject);
      },
    },
    views:{ applyFromState(){} },
    sections:{ update(){} },
  };
  sandbox.window.FC = sandbox.FC;

  vm.createContext(sandbox);
  vm.runInContext(read(RUNTIME), sandbox, { filename:RUNTIME });

  return {
    sandbox,
    runtime:sandbox.FC.investorProjectRuntime,
    writes,
    getCentral:()=>clone(centralProject),
    getLegacy:()=>clone(legacyProject),
    getActive:()=>clone(activeProject),
  };
}

function cabinetIds(project){
  const rows = project && project.kuchnia && Array.isArray(project.kuchnia.cabinets)
    ? project.kuchnia.cabinets
    : [];
  return rows.map((row)=>String(row.id || ''));
}

function testCentralSurvivesWithoutLegacySlot(){
  const central = projectWithCabinets('inv_no_legacy', ['cab_keep_1']);
  const scenario = createRuntimeScenario({
    investorId:'inv_no_legacy',
    centralProject:central,
    legacyProject:null,
  });

  scenario.runtime.ensureInvestorProjectLoadedOnBoot();

  assert(cabinetIds(scenario.getCentral()).includes('cab_keep_1'),
    'Start bez legacy slotu nie może nadpisać istniejącego projektu centralnego',
    { central:scenario.getCentral(), writes:scenario.writes });
  assert(cabinetIds(scenario.getActive()).includes('cab_keep_1'),
    'Aktywny projekt po starcie ma pochodzić z centralnego projectStore',
    scenario.getActive());
  assert(scenario.writes.central.length === 0,
    'Samo uruchomienie przy istniejącym projekcie centralnym nie powinno tworzyć świeżego zapisu centralnego',
    scenario.writes);
}

function testCentralWinsAgainstConflictingLegacy(){
  const central = projectWithCabinets('inv_conflict', []);
  const legacy = projectWithCabinets('inv_conflict', ['cab_legacy_should_not_win']);
  const scenario = createRuntimeScenario({
    investorId:'inv_conflict',
    centralProject:central,
    legacyProject:legacy,
  });

  scenario.runtime.ensureInvestorProjectLoadedOnBoot();

  assert(cabinetIds(scenario.getActive()).length === 0,
    'Przy konflikcie centralny projekt ma wygrać ze starszym legacy slotem',
    { active:scenario.getActive(), legacy:scenario.getLegacy() });
  assert(cabinetIds(scenario.getCentral()).length === 0,
    'Legacy slot nie może nadpisać centralnego projektu podczas bootu',
    scenario.getCentral());
}

function testRestartKeepsCentralProject(){
  const central = projectWithCabinets('inv_restart', ['cab_restart_1', 'cab_restart_2']);
  const scenario = createRuntimeScenario({
    investorId:'inv_restart',
    centralProject:central,
    legacyProject:null,
  });

  scenario.runtime.ensureInvestorProjectLoadedOnBoot();
  const afterFirstBoot = scenario.getCentral();
  scenario.runtime.ensureInvestorProjectLoadedOnBoot();
  const afterSecondBoot = scenario.getCentral();

  assert(cabinetIds(afterFirstBoot).join(',') === 'cab_restart_1,cab_restart_2',
    'Pierwszy start musi zachować centralny projekt', afterFirstBoot);
  assert(cabinetIds(afterSecondBoot).join(',') === 'cab_restart_1,cab_restart_2',
    'Ponowny start nie może wyzerować ani zastąpić centralnego projektu', afterSecondBoot);
  assert(scenario.writes.central.length === 0,
    'Powtarzany boot istniejącego projektu nie powinien generować świeżych zapisów centralnych',
    scenario.writes);
}

try{
  testCentralSurvivesWithoutLegacySlot();
  testCentralWinsAgainstConflictingLegacy();
  testRestartKeepsCentralProject();
  console.log('investor-project-boot-source-truth smoke: OK');
}catch(error){
  console.error('investor-project-boot-source-truth smoke: FAIL');
  console.error('- ' + (error && error.message ? error.message : String(error)));
  if(error && error.details !== undefined) console.error(JSON.stringify(error.details, null, 2));
  process.exit(1);
}
