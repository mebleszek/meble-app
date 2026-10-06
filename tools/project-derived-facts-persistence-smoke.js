#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function clone(value){ return value == null ? value : JSON.parse(JSON.stringify(value)); }
function assert(condition, message, details){
  if(condition) return;
  const error = new Error(message);
  if(details !== undefined) error.details = details;
  throw error;
}

class MemoryStorage{
  constructor(){ this.map = new Map(); }
  get length(){ return this.map.size; }
  key(index){ return Array.from(this.map.keys())[index] || null; }
  getItem(key){ return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
  setItem(key, value){ this.map.set(String(key), String(value)); }
  removeItem(key){ this.map.delete(String(key)); }
  clear(){ this.map.clear(); }
}

function createSandbox(){
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const sandbox = { console, JSON, Date, Math, setTimeout, clearTimeout, localStorage, sessionStorage };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.FC = {
    utils:{ clone },
    constants:{ STORAGE_KEYS:{
      projects:'fc_projects_v1',
      currentProjectId:'fc_current_project_id_v1',
      projectData:'fc_project_v1',
      projectBackup:'fc_project_backup_v1',
      projectBackupMeta:'fc_project_backup_meta_v1',
    } },
    schema:{
      CURRENT_SCHEMA_VERSION:1,
      DEFAULT_PROJECT:{ schemaVersion:1, pokoj:{ cabinets:[], fronts:[], sets:[], settings:{}, preferences:{} } },
      normalizeProject(value){ return clone(value || this.DEFAULT_PROJECT); },
    },
    investors:{ getCurrentId(){ return 'inv_cache'; } },
  };
  sandbox.window.FC = sandbox.FC;
  vm.createContext(sandbox);
  [
    'js/app/shared/storage.js',
    'js/app/project/project-model.js',
    'js/app/project/project-store.js',
    'js/app/project/project-file-recovery.js',
    'js/app/project/project-bridge.js',
    'js/app/investor/investor-project-repository.js',
  ].forEach((file)=> vm.runInContext(read(file), sandbox, { filename:file }));
  return { sandbox, localStorage };
}

function sampleProject(){
  return {
    schemaVersion:1,
    meta:{ roomDefs:{ room_custom:{ id:'room_custom', name:'Gabinet' } }, roomOrder:['room_custom'] },
    pokoj:{
      cabinets:[{
        id:'cab_source', width:100, height:80, depth:50,
        details:{ shelves:2 },
        hardwareRequirementOverrides:{ left:{ typeId:'hinge_manual', note:'ręczny wybór' } },
        drawerRequirements:[{ id:'drawer_manual', system:'Axis Pro', qty:2 }],
        projectUnusual:true,
        derivedFacts:{ kind:'cabinet-derived-facts', inputHash:'abc', cutlists:{ all:[{ name:'Bok', qty:2 }] }, hardwareRequirements:[{ typeId:'hinge_manual', qty:4 }] },
      }],
      fronts:[], sets:[], settings:{ roomHeight:250 }, preferences:{},
    },
    room_custom:{
      cabinets:[{
        id:'cab_custom', width:60,
        hardwareRequirementOverrides:{ right:{ typeId:'hinge_custom' } },
        derivedFacts:{ kind:'cabinet-derived-facts', inputHash:'custom' },
      }],
      fronts:[], sets:[], settings:{}, preferences:{},
    },
  };
}

function noDerived(value){ return !JSON.stringify(value).includes('"derivedFacts"'); }
function hasManualChoices(value){
  const text = JSON.stringify(value);
  return text.includes('hinge_manual') && text.includes('drawer_manual') && text.includes('projectUnusual') && text.includes('hinge_custom');
}

try{
  const ctx = createSandbox();
  const FC = ctx.sandbox.FC;
  const source = sampleProject();
  const sourceBefore = clone(source);

  const persistedData = FC.projectStore.prepareProjectDataForPersistence(source);
  assert(noDerived(persistedData), 'Sanitizer trwałego zapisu pozostawił derivedFacts', persistedData);
  assert(hasManualChoices(persistedData), 'Sanitizer usunął ręczne decyzje użytkownika', persistedData);
  assert(JSON.stringify(source) === JSON.stringify(sourceBefore), 'Sanitizer zmodyfikował obiekt projektu pracujący w RAM');

  const record = {
    id:'proj_cache', investorId:'inv_cache', title:'Projekt cache', status:'nowy',
    projectData:source, createdAt:111, updatedAt:222, meta:{ source:'smoke' },
  };
  const returned = FC.projectStore.upsert(record);
  assert(returned && returned.projectData.pokoj.cabinets[0].derivedFacts, 'Centralny zapis usunął derivedFacts również z obiektu zwracanego do RAM');
  const centralRaw = ctx.localStorage.getItem('fc_projects_v1');
  assert(centralRaw && !centralRaw.includes('"derivedFacts"'), 'fc_projects_v1 nadal zapisuje derivedFacts', centralRaw && centralRaw.slice(0, 500));
  assert(hasManualChoices(JSON.parse(centralRaw)[0].projectData), 'fc_projects_v1 zgubił ręczne decyzje użytkownika');

  // 2B.3b: FC.project.save zapisuje już tylko centralny ProjectStore. Stary fc_project_v1
  // może nadal istnieć jako nieużywana kopia, ale zwykły zapis nie może go modyfikować.
  ctx.localStorage.setItem('fc_project_v1', JSON.stringify(source));
  const activeLegacyBefore = ctx.localStorage.getItem('fc_project_v1');
  const activeReturned = FC.project.save(source);
  assert(activeReturned && activeReturned.pokoj.cabinets[0].derivedFacts, 'FC.project.save usunął cache z obiektu w RAM');
  assert(ctx.localStorage.getItem('fc_project_v1') === activeLegacyBefore, 'FC.project.save nadal nadpisuje fc_project_v1');
  assert(noDerived(JSON.parse(ctx.localStorage.getItem('fc_project_backup_v1'))), 'Backup aktywnego projektu nadal kopiuje derivedFacts');

  FC.investorProjectRepository.writeLegacySlotProject('inv_cache', source);
  assert(noDerived(JSON.parse(ctx.localStorage.getItem('fc_project_inv_inv_cache_v1'))), 'Legacy slot inwestora nadal zapisuje derivedFacts');
  FC.investorProjectRepository.writeActiveProject(source);
  assert(noDerived(JSON.parse(ctx.localStorage.getItem('fc_project_v1'))), 'writeActiveProject nadal zapisuje derivedFacts');

  const payload = FC.projectFileRecovery.buildPayload(record);
  assert(payload && noDerived(payload), 'Kopia awaryjna nadal zawiera derivedFacts', payload);
  assert(hasManualChoices(payload.project.projectData), 'Kopia awaryjna zgubiła ręczne decyzje użytkownika');
  assert(!FC.projectFileRecovery.stringifyPayload(payload).includes('"derivedFacts"'), 'JSON kopii awaryjnej zawiera derivedFacts');

  const sourceFiles = [
    'js/app/bootstrap/app-state-bootstrap.js',
    'js/app/bootstrap/app-core-namespace.js',
    'js/app/project/project-recalculate.js',
    'js/app/cabinet/cabinet-actions.js',
    'js/app/cabinet/cabinet-derived-facts.js',
    'js/app.js',
  ].map(read).join('\n');
  assert(sourceFiles.includes('prepareProjectDataForPersistence'), 'Fallbackowe ścieżki zapisu projektu nie korzystają z centralnego sanitizera');

  console.log('project-derived-facts-persistence smoke: OK');
  console.log(' - derivedFacts zostaje w RAM, nie trafia do centralnego/backup zapisu, a normalny save nie dotyka fc_project_v1');
  console.log(' - ręczne wybory szafki pozostają w trwałych danych źródłowych');
  console.log(' - kopia awaryjna JSON nie zawiera ciężkiego cache');
}catch(error){
  console.error('project-derived-facts-persistence smoke: FAIL');
  console.error('- ' + (error && error.message ? error.message : String(error)));
  if(error && error.details !== undefined) console.error(JSON.stringify(error.details, null, 2));
  process.exit(1);
}
