const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { APP_DEV_SMOKE_FILES } = require('./app-dev-smoke-lib/file-list');
const { SmokeStorage, makeStorage } = require('./app-dev-smoke-lib/smoke-storage');
const { makeMiniDocument } = require('./app-dev-smoke-lib/mini-document');

function createSandbox(){
  const sandbox = {
    console,
    setTimeout, clearTimeout,
    requestAnimationFrame:(fn)=> setTimeout(fn, 0),
    Date, Math, JSON,
    localStorage: makeStorage(),
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

function assert(condition, message, details){
  if(!condition){
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

function clone(value){ return JSON.parse(JSON.stringify(value)); }

function main(){
  const sandbox = loadSmokeFiles(createSandbox());
  const FC = sandbox.FC;
  if(FC.investorProject && typeof FC.investorProject.init === 'function') FC.investorProject.init();

  const investor = {
    id:'inv_real_context',
    kind:'person',
    name:'Realny Inwestor',
    phone:'123',
    rooms:[{ id:'room_real_lazienka', baseType:'lazienka', name:'Łazienka', label:'Łazienka', projectStatus:'nowy' }],
  };
  const realProject = {
    schemaVersion:2,
    meta:{
      assignedInvestorId:'inv_real_context',
      roomDefs:{ room_real_lazienka:{ id:'room_real_lazienka', baseType:'lazienka', name:'Łazienka', label:'Łazienka' } },
      roomOrder:['room_real_lazienka'],
    },
    room_real_lazienka:{ cabinets:[{ id:'cab_real_1', name:'Szafka testowa' }], fronts:[], sets:[], settings:{} },
  };
  const phantomProject = {
    schemaVersion:2,
    meta:{ roomDefs:{ a:{ id:'a', baseType:'pokoj', name:'a', label:'a' }, S:{ id:'S', baseType:'pokoj', name:'S', label:'S' } }, roomOrder:['a','S'] },
    a:{ cabinets:[], fronts:[], sets:[], settings:{} },
    S:{ cabinets:[], fronts:[], sets:[], settings:{} },
  };

  FC.investors.writeAll([investor]);
  FC.investors.setCurrentId('inv_real_context');
  FC.projectStore.writeAll([
    { id:'proj_real_context', investorId:'inv_real_context', title:'Realny projekt', status:'nowy', projectData:clone(realProject), createdAt:1, updatedAt:1, meta:{} },
    { id:'proj_phantom_snapshot', investorId:'inv_phantom', title:'Projekt meblowy', status:'nowy', projectData:clone(phantomProject), createdAt:1, updatedAt:1, meta:{ source:'quote-snapshot' } },
  ]);
  FC.projectStore.setCurrentProjectId('proj_phantom_snapshot');
  sandbox.localStorage.setItem('fc_project_v1', JSON.stringify(phantomProject));
  sandbox.projectData = clone(phantomProject);
  sandbox.window.projectData = sandbox.projectData;
  sandbox.localStorage.setItem('fc_ui_v1', JSON.stringify({ currentInvestorId:'inv_real_context', activeTab:'wycena', entry:'rooms' }));
  FC.quoteOfferStore.writeAll([
    { projectId:'proj_phantom_snapshot', investorId:'inv_real_context', selection:{ selectedRooms:['a','S'], materialScope:{ kind:'all', includeFronts:true, includeCorpus:true } }, commercial:{ preliminary:false, versionName:'Oferta' }, rateSelections:[], updatedAt:1 },
    { projectId:'proj_real_context', investorId:'inv_real_context', selection:{ selectedRooms:['a','S'], materialScope:{ kind:'all', includeFronts:true, includeCorpus:true } }, commercial:{ preliminary:false, versionName:'Oferta' }, rateSelections:[], updatedAt:1 },
  ]);
  FC.quoteSnapshotStore.writeAll([
    { id:'snap_phantom', investor:{ id:'inv_phantom' }, project:{ id:'proj_phantom_snapshot', investorId:'inv_phantom', title:'Projekt meblowy' }, scope:{ selectedRooms:['a','S'], roomLabels:['a','S'] }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, totals:{ grand:0 }, commercial:{ preliminary:false, versionName:'Oferta' }, meta:{ source:'quote-snapshot' } },
  ]);

  const result = FC.wycenaContextRepair.repairActiveQuoteContext({ reason:'test' });
  assert(result && result.ok, 'Naprawa kontekstu WYCENY nie zwróciła OK', result);
  assert(FC.projectStore.getCurrentProjectId() === 'proj_real_context', 'Nie ustawiono realnego projektu jako aktywnego', { current:FC.projectStore.getCurrentProjectId(), result });
  assert(Array.isArray(result.activeRoomIds) && result.activeRoomIds.length === 1 && result.activeRoomIds[0] === 'room_real_lazienka', 'Aktywne pokoje nie zostały odtworzone z realnego projektu', result);
  assert(sandbox.window.projectData && sandbox.window.projectData.room_real_lazienka, 'Globalny projectData nie wskazuje realnego projektu', sandbox.window.projectData);
  assert(!(sandbox.window.projectData && sandbox.window.projectData.a), 'Globalny projectData nadal wskazuje fantomowe pokoje snapshotu', sandbox.window.projectData);
  const draft = FC.quoteOfferStore.getDraft({ projectId:'proj_real_context', investorId:'inv_real_context' });
  assert(draft && draft.selection && Array.isArray(draft.selection.selectedRooms), 'Brak draftu realnego projektu po naprawie', draft);
  assert(draft.selection.selectedRooms.length === 1 && draft.selection.selectedRooms[0] === 'room_real_lazienka', 'Draft wyceny nie został oczyszczony ze starych pokojów snapshotu', draft);
  const history = FC.quoteSnapshotStore.listForProject('proj_real_context');
  assert(Array.isArray(history) && history.length === 0, 'Historia realnego projektu nie może mieszać fantomowych snapshotów innego projektu', history);
  console.log('[wycena-local-storage-context-repair-smoke] OK');
}


function runEmptyCentralRecordRicherLegacyScenario(){
  const sandbox = loadSmokeFiles(createSandbox());
  const FC = sandbox.FC;
  if(FC.investorProject && typeof FC.investorProject.init === 'function') FC.investorProject.init();

  const investor = { id:'inv_richer_legacy', kind:'person', name:'Inwestor Legacy', rooms:[{ id:'room_dynamic', baseType:'kuchnia', name:'Kuchnia robocza', label:'Kuchnia robocza', projectStatus:'nowy' }] };
  const emptyCentral = {
    schemaVersion:2,
    meta:{ assignedInvestorId:'inv_richer_legacy', roomDefs:{ room_dynamic:{ id:'room_dynamic', baseType:'kuchnia', name:'Kuchnia robocza', label:'Kuchnia robocza' } }, roomOrder:['room_dynamic'] },
    room_dynamic:{ cabinets:[], fronts:[], sets:[], settings:{} },
  };
  const richLegacy = {
    schemaVersion:2,
    meta:{ assignedInvestorId:'inv_richer_legacy', roomDefs:{ room_dynamic:{ id:'room_dynamic', baseType:'kuchnia', name:'Kuchnia robocza', label:'Kuchnia robocza' } }, roomOrder:['room_dynamic'] },
    room_dynamic:{ cabinets:[{ id:'cab_dynamic_1', name:'Szafka z legacy slotu', w:60, h:82, d:56 }], fronts:[], sets:[], settings:{} },
  };

  FC.investors.writeAll([investor]);
  FC.investors.setCurrentId('inv_richer_legacy');
  FC.projectStore.writeAll([
    { id:'proj_empty_central', investorId:'inv_richer_legacy', title:'Pusty centralny', status:'nowy', projectData:clone(emptyCentral), createdAt:1, updatedAt:1, meta:{ source:'project-store' } },
  ]);
  FC.projectStore.setCurrentProjectId('proj_empty_central');
  sandbox.localStorage.setItem('fc_project_inv_inv_richer_legacy_v1', JSON.stringify(richLegacy));
  sandbox.localStorage.setItem('fc_project_v1', JSON.stringify(emptyCentral));
  sandbox.projectData = clone(emptyCentral);
  sandbox.window.projectData = sandbox.projectData;
  sandbox.localStorage.setItem('fc_ui_v1', JSON.stringify({ currentInvestorId:'inv_richer_legacy', activeTab:'wycena' }));

  const result = FC.wycenaContextRepair.repairActiveQuoteContext({ reason:'test-richer-legacy' });
  assert(result && result.ok, 'Naprawa kontekstu dla bogatszego legacy slotu nie zwróciła OK', result);
  assert(result.projectData && result.projectData.room_dynamic && result.projectData.room_dynamic.cabinets.length === 1, 'Nie wybrano bogatszego legacy slotu zamiast pustego rekordu centralnego', result);
  const saved = FC.projectStore.getById('proj_empty_central');
  assert(saved && saved.projectData && saved.projectData.room_dynamic && saved.projectData.room_dynamic.cabinets.length === 1, 'Bogatszy projekt nie został zapisany z powrotem do centralnego projectStore', saved);
  const draft = FC.quoteOfferStore.getDraft({ projectId:'proj_empty_central', investorId:'inv_richer_legacy' });
  assert(draft && draft.selection && draft.selection.selectedRooms[0] === 'room_dynamic', 'Draft nie wskazuje realnego dynamicznego pokoju po naprawie', draft);
}

try{
  main();
  runEmptyCentralRecordRicherLegacyScenario();
}
catch(err){
  console.error('[wycena-local-storage-context-repair-smoke] FAIL:', err && err.message ? err.message : err);
  if(err && err.details) console.error(JSON.stringify(err.details, null, 2));
  process.exit(1);
}
