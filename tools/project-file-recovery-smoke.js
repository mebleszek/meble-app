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

class QuotaStorage{
  constructor(){ this.map = new Map(); this.blocked = new Set(); }
  getItem(key){ return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
  setItem(key, value){
    const k = String(key);
    if(this.blocked.has(k)){
      const error = new Error('QuotaExceededError: smoke full');
      error.name = 'QuotaExceededError';
      throw error;
    }
    this.map.set(k, String(value));
  }
  removeItem(key){ this.map.delete(String(key)); }
  block(key){ this.blocked.add(String(key)); }
  unblock(key){ this.blocked.delete(String(key)); }
}

function createSandbox(){
  const localStorage = new QuotaStorage();
  const sessionStorage = new QuotaStorage();
  const investors = new Map();
  let currentInvestorId = null;
  const choices = [];
  const infos = [];
  const sandbox = {
    console,
    JSON, Date, Math,
    setTimeout, clearTimeout,
    localStorage, sessionStorage,
    alert(message){ infos.push({ type:'alert', message:String(message || '') }); },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.FC = {
    utils:{ clone },
    constants:{ STORAGE_KEYS:{ projects:'fc_projects_v1', currentProjectId:'fc_current_project_id_v1', projectData:'fc_project_v1' } },
    schema:{
      CURRENT_SCHEMA_VERSION:1,
      DEFAULT_PROJECT:{ schemaVersion:1, pokoj:{ cabinets:[], fronts:[], sets:[], settings:{} } },
      normalizeProject(value){ return clone(value || this.DEFAULT_PROJECT); },
    },
    choiceBox:{ ask(payload){ choices.push(payload); return Promise.resolve('back'); } },
    infoBox:{ open(payload){ infos.push({ type:'infoBox', payload }); } },
    investors:{
      normalizeInvestor:clone,
      getById(id){ return investors.has(String(id)) ? clone(investors.get(String(id))) : null; },
      upsert(inv){ if(!(inv && inv.id)) return null; investors.set(String(inv.id), clone(inv)); return clone(inv); },
      setCurrentId(id){ currentInvestorId = id ? String(id) : null; },
      getCurrentId(){ return currentInvestorId; },
    },
  };
  sandbox.window.FC = sandbox.FC;
  vm.createContext(sandbox);
  [
    'js/app/shared/storage.js',
    'js/app/project/project-model.js',
    'js/app/project/project-store.js',
    'js/app/project/project-file-recovery.js',
  ].forEach((file)=> vm.runInContext(read(file), sandbox, { filename:file }));
  return { sandbox, localStorage, investors, choices, infos, getCurrentInvestorId:()=>currentInvestorId };
}

function testExportImportRoundTrip(){
  const ctx = createSandbox();
  const FC = ctx.sandbox.FC;
  FC.investors.upsert({ id:'inv_recovery', name:'Test inwestor', phone:'123456789' });
  FC.investors.setCurrentId('inv_recovery');

  const original = FC.projectStore.upsert({
    id:'proj_recovery',
    investorId:'inv_recovery',
    title:'Kuchnia testowa',
    status:'w_realizacji',
    projectData:{
      schemaVersion:1,
      pokoj:{
        cabinets:[{ id:'cab_recovery_1', name:'Blat biurka', width:1000, height:500 }],
        fronts:[], sets:[], settings:{ roomHeight:250 },
      },
    },
    createdAt:111,
    updatedAt:222,
    meta:{ source:'smoke' },
  });
  assert(original && original.id === 'proj_recovery', 'Nie udało się przygotować projektu do eksportu', original);

  const payload = FC.projectFileRecovery.buildPayload(original);
  assert(payload && payload.kind === 'meble-app-project-emergency', 'Eksport nie tworzy właściwego payloadu awaryjnego', payload);
  assert(payload.investor && payload.investor.id === 'inv_recovery', 'Kopia awaryjna nie zawiera inwestora potrzebnego do ponownego przypięcia projektu', payload);
  const text = FC.projectFileRecovery.stringifyPayload(payload);
  const parsed = FC.projectFileRecovery.parseImportPayload(text);
  assert(parsed && parsed.project && parsed.project.id === original.id, 'Wyeksportowany projekt nie daje się ponownie odczytać', parsed);

  ctx.localStorage.removeItem('fc_projects_v1');
  ctx.localStorage.removeItem('fc_current_project_id_v1');
  ctx.investors.clear();
  FC.investors.setCurrentId(null);

  const result = FC.projectFileRecovery.importPayload(parsed);
  assert(result && result.ok === true, 'Import kopii awaryjnej nie zakończył się sukcesem', result);
  const restored = FC.projectStore.getById('proj_recovery');
  assert(restored && restored.id === original.id, 'Zaimportowany projekt nie trafił do centralnego projectStore', restored);
  assert(JSON.stringify(restored.projectData) === JSON.stringify(original.projectData), 'Projekt po eksporcie i imporcie nie jest zgodny 1:1', { original:original.projectData, restored:restored && restored.projectData });
  assert(FC.investors.getById('inv_recovery'), 'Import nie odtworzył inwestora dołączonego do kopii awaryjnej');
  assert(ctx.getCurrentInvestorId() === 'inv_recovery', 'Import nie ustawił inwestora projektu jako bieżącego', ctx.getCurrentInvestorId());
  assert(FC.projectStore.getCurrentProjectId() === 'proj_recovery', 'Import nie ustawił wczytanego projektu jako bieżącego');
}

function testInvalidPayloadDoesNotImport(){
  const ctx = createSandbox();
  const FC = ctx.sandbox.FC;
  assert(FC.projectFileRecovery.parseImportPayload('{"kind":"wrong","version":1}') === null, 'Nieprawidłowy rodzaj pliku nie może przejść walidacji');
  assert(FC.projectFileRecovery.parseImportPayload('to nie json') === null, 'Uszkodzony JSON nie może przejść walidacji');
  assert(FC.projectFileRecovery.importPayload({ kind:'wrong' }).ok === false, 'Nieprawidłowy payload nie może zostać zapisany');
  assert(FC.projectStore.readAll().length === 0, 'Nieprawidłowy import nie może zmienić centralnego magazynu projektów');
}

async function testWriteFailureCapturesEmergencyProject(){
  const ctx = createSandbox();
  const FC = ctx.sandbox.FC;
  ctx.localStorage.block('fc_projects_v1');
  const saved = FC.projectStore.upsert({
    id:'proj_full',
    investorId:'inv_full',
    title:'Projekt pełna pamięć',
    projectData:{ schemaVersion:1, pokoj:{ cabinets:[{ id:'cab_unsaved' }], fronts:[], sets:[], settings:{} } },
  });
  assert(saved === null, 'Zapis przy pełnym storage powinien się nie udać', saved);
  const pending = FC.projectFileRecovery.lastPendingRecord();
  assert(pending && pending.id === 'proj_full', 'Przy błędzie zapisu aktualny projekt nie został zachowany w pamięci jako kopia awaryjna', pending);
  assert(pending.projectData && pending.projectData.pokoj && pending.projectData.pokoj.cabinets.some((row)=> row && row.id === 'cab_unsaved'), 'Kopia awaryjna nie zawiera ostatnich niezapisanych zmian', pending);
  await Promise.resolve();
  assert(ctx.choices.length === 1, 'Błąd zapisu powinien uruchomić okno ratunkowe z wyborem działania', ctx.choices);
  const labels = (ctx.choices[0].actions || []).map((row)=>String(row.text || ''));
  assert(labels.includes('Pobierz kopię awaryjną') && labels.includes('Spróbuj zapisać ponownie') && labels.includes('Wróć do programu'), 'Okno awaryjne nie zawiera wszystkich uzgodnionych działań', labels);
}

function testSettingsExposeProjectImport(){
  const source = read('js/app/ui/data-settings-backup-actions.js');
  assert(source.includes("text:'Wczytaj projekt z pliku'"), 'Backup i dane nie pokazuje przycisku Wczytaj projekt z pliku');
  assert(source.includes('recovery.parseImportPayload'), 'Import projektu nie korzysta z walidatora kopii awaryjnej');
  assert(source.includes('projectFileRecovery') || source.includes('const recovery = FC.projectFileRecovery'), 'Import projektu nie korzysta z centralnego modułu recovery');
}

(async ()=>{
  try{
    testExportImportRoundTrip();
    testInvalidPayloadDoesNotImport();
    await testWriteFailureCapturesEmergencyProject();
    testSettingsExposeProjectImport();
    console.log('project-file-recovery smoke: OK');
  }catch(error){
    console.error('project-file-recovery smoke: FAIL');
    console.error('- ' + (error && error.message ? error.message : String(error)));
    if(error && error.details !== undefined) console.error(JSON.stringify(error.details, null, 2));
    process.exit(1);
  }
})();
