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

function stripDerived(project){
  const out = clone(project || {});
  Object.keys(out || {}).forEach((key)=> {
    const room = out[key];
    if(!(room && typeof room === 'object' && Array.isArray(room.cabinets))) return;
    room.cabinets.forEach((cabinet)=> {
      if(!cabinet || typeof cabinet !== 'object') return;
      delete cabinet.derivedFacts;
      delete cabinet._derivedFacts;
    });
  });
  return out;
}

function makeProject(width){
  return {
    schemaVersion:12,
    meta:{ assignedInvestorId:'inv_session' },
    room_test:{
      cabinets:[{ id:'cab_1', width:Number(width) || 60, height:82, depth:51, type:'stojąca', details:{ shelves:1 } }],
      fronts:[], sets:[], settings:{}, preferences:{},
    },
  };
}

function testDerivedFactsDoNotStartProjectSession(){
  let central = makeProject(60);
  let sessionBegins = 0;
  let baseSaves = 0;
  const localStorage = new MemoryStorage();
  localStorage.setItem('fc_project_v1', JSON.stringify(stripDerived(central)));

  const sandbox = { console, JSON, Date, Math, localStorage, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.FC = {
    utils:{ clone },
    projectStore:{
      prepareProjectDataForPersistence:stripDerived,
      getCurrentRecord(){ return { id:'proj_session', investorId:'inv_session', projectData:clone(central) }; },
    },
    project:{
      normalize:clone,
      DEFAULT_PROJECT:makeProject(0),
      save(data){ baseSaves += 1; return data; },
    },
    session:{
      active:false,
      begin(){ sessionBegins += 1; this.active = true; },
    },
    investorProjectRepository:{
      getCurrentInvestorId(){ return 'inv_session'; },
      loadCentralProjectForInvestor(_id, fallback){ return central ? clone(central) : fallback; },
      readActiveProjectRaw(){ return localStorage.getItem('fc_project_v1'); },
      saveCentralProjectForInvestor(_id, data){ central = stripDerived(data); return { id:'proj_session', investorId:'inv_session', projectData:clone(central) }; },
      writeLegacySlotProject(){},
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(read('js/app/investor/investor-project-runtime.js'), sandbox, { filename:'investor-project-runtime.js' });
  vm.runInContext(read('js/app/investor/investor-project-patches.js'), sandbox, { filename:'investor-project-patches.js' });
  sandbox.FC.investorProjectPatches.patchProjectSave();

  const cacheOnly = makeProject(60);
  cacheOnly.room_test.cabinets[0].derivedFacts = { kind:'cabinet-derived-facts', inputHash:'abc', cutlists:{ all:[{ name:'Bok' }] } };
  sandbox.FC.project.save(cacheOnly);
  assert(sessionBegins === 0, 'Samo dodanie/odbudowanie derivedFacts uruchomiło sesję Zapisz/Anuluj', { sessionBegins });
  assert(baseSaves === 1, 'Bazowy zapis projektu nie został wywołany w scenariuszu kontrolnym', { baseSaves });

  sandbox.FC.session.active = false;
  const realEdit = clone(cacheOnly);
  realEdit.room_test.cabinets[0].width = 70;
  sandbox.FC.project.save(realEdit);
  assert(sessionBegins === 1, 'Prawdziwa zmiana danych źródłowych szafki nie uruchomiła sesji', { sessionBegins });
}

function testMaterialDefaultsAreReadOnlyUntilManualChange(){
  const localStorage = new MemoryStorage();
  let sessionBegins = 0;
  const sandbox = { console, JSON, Date, Math, localStorage };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.FC = {
    session:{
      active:false,
      begin(){ sessionBegins += 1; this.active = true; },
    },
    views:{ refreshSessionButtons(){} },
  };
  vm.createContext(sandbox);
  vm.runInContext(read('js/app/material/material-edge-store.js'), sandbox, { filename:'material-edge-store.js' });

  const edgeApi = sandbox.FC.materialEdgeStore.createEdgeStore();
  const part = { name:'Front', qty:1, a:72, b:30, material:'Front: laminat • W1100' };
  const cabinet = { type:'stojąca' };
  const sig = edgeApi.signatureFromPart(part);
  const defaults = edgeApi.getEdges(sig, part, cabinet);

  assert(defaults.w1 && defaults.w2 && defaults.h1 && defaults.h2, 'Domyślne okleiny frontu nie zostały wyliczone');
  assert(localStorage.getItem('fc_edge_v1') === null, 'Sam odczyt domyślnej okleiny zapisał fc_edge_v1');
  assert(sessionBegins === 0, 'Sam render/odczyt domyślnej okleiny uruchomił sesję');

  edgeApi.setEdges(sig, { w1:false });
  const storedRaw = localStorage.getItem('fc_edge_v1');
  const stored = storedRaw ? JSON.parse(storedRaw) : {};
  assert(sessionBegins === 1, 'Ręczna zmiana okleiny nie uruchomiła sesji');
  assert(stored[sig] && stored[sig].w1 === false, 'Ręczna zmiana okleiny nie została zapisana', stored);
  assert(stored[sig].w2 === true && stored[sig].h1 === true && stored[sig].h2 === true,
    'Pierwszy ręczny checkbox zgubił pozostałe domyślne krawędzie', stored[sig]);
}

try{
  testDerivedFactsDoNotStartProjectSession();
  testMaterialDefaultsAreReadOnlyUntilManualChange();
  console.log('project-false-edit-session smoke: OK');
  console.log(' - derivedFacts w RAM nie tworzy fałszywej sesji, ale prawdziwa edycja projektu nadal ją uruchamia');
  console.log(' - domyślne okleiny MATERIAŁU są tylko odczytem; ręczna zmiana zapisuje override i uruchamia sesję');
}catch(error){
  console.error('project-false-edit-session smoke: FAIL');
  console.error('- ' + (error && error.message ? error.message : String(error)));
  if(error && error.details !== undefined) console.error(JSON.stringify(error.details, null, 2));
  process.exit(1);
}
