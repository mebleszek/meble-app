const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { APP_DEV_SMOKE_FILES } = require('./app-dev-smoke-lib/file-list');
const { SmokeStorage, makeStorage } = require('./app-dev-smoke-lib/smoke-storage');
const { makeMiniDocument } = require('./app-dev-smoke-lib/mini-document');

function assert(condition, message, details){
  if(!condition){
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

function sleep(ms){ return new Promise((resolve)=> setTimeout(resolve, ms)); }

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

function makeDeps(sandbox, model){
  const FC = sandbox.FC;
  const state = { isBusy:false };
  FC.wycenaContextRepair = FC.wycenaContextRepair || {};
  FC.wycenaContextRepair.repairActiveQuoteContext = ()=> ({ ok:true, investorId:'inv_dup', projectId:'proj_dup', activeRoomIds:['room_A'], selectedRooms:['room_A'], repairs:[], hadProjectContent:true });
  FC.wycenaCore = FC.wycenaCore || {};
  FC.wycenaCore.collectQuoteData = async ()=> {
    model.collectCount += 1;
    const includeCorpus = model.includeCorpus !== false;
    const grand = includeCorpus ? 100 : 40;
    return {
      selectedRooms:['room_A'],
      roomLabels:['A'],
      materialScope:{ kind:'all', includeFronts:true, includeCorpus },
      selection:{ selectedRooms:['room_A'], materialScope:{ kind:'all', includeFronts:true, includeCorpus } },
      materialLines:[{ key:includeCorpus ? 'plyta' : 'front', name:includeCorpus ? 'Płyta' : 'Front', qty:1, unit:'ark.', unitPrice:grand, total:grand }],
      elementLines:[],
      accessoryLines:[],
      agdLines:[],
      quoteRateLines:[],
      laborLines:[],
      commercial:{ preliminary:false, versionName:model.versionName },
      totals:{ materials:grand, accessories:0, services:0, quoteRates:0, labor:0, subtotal:grand, discount:0, grand },
      generatedAt: Date.now(),
      investor:{ id:'inv_dup', kind:'person', name:'Test' },
      projectRecord:{ id:'proj_dup', investorId:'inv_dup', title:'Projekt testowy', status:'nowy' },
    };
  };
  return {
    getState:()=> state,
    setState:(patch)=> Object.assign(state, patch || {}),
    render:()=> { model.renderCount += 1; },
    normalizeDraftSelection:()=> ({ selectedRooms:['room_A'], materialScope:{ kind:'all', includeFronts:true, includeCorpus:model.includeCorpus !== false } }),
    getOfferDraft:()=> ({ selection:{ selectedRooms:['room_A'], materialScope:{ kind:'all', includeFronts:true, includeCorpus:model.includeCorpus !== false } }, commercial:{ preliminary:false, versionName:model.versionName } }),
    ensureVersionNameBeforeGenerate:async ()=> ({ cancelled:false, versionName:model.versionName }),
    getSnapshotId:(row)=> String(row && (row.id || row.snapshotId) || ''),
    syncGeneratedQuoteStatus:()=>{},
    getProjectStatusForHistory:()=> 'nowy',
    getSnapshotHistory:()=> FC.quoteSnapshotStore.listForProject('proj_dup'),
    askConfirm:async ()=> model.confirmReplace,
  };
}

async function runDuplicateGuard(){
  const sandbox = loadSmokeFiles(createSandbox());
  const FC = sandbox.FC;
  assert(FC.wycenaTabShell && typeof FC.wycenaTabShell.generateQuote === 'function', 'Brak FC.wycenaTabShell.generateQuote');
  assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.findDuplicateSnapshot === 'function', 'Brak findDuplicateSnapshot');
  assert(typeof FC.quoteSnapshotStore.replaceSnapshot === 'function', 'Brak replaceSnapshot');
  const model = { collectCount:0, renderCount:0, versionName:'Oferta — A', includeCorpus:true, confirmReplace:false, modalCalls:0, lastModalPayload:null };
  FC.choiceBox = Object.assign({}, FC.choiceBox || {}, { ask:async (payload)=>{ model.modalCalls += 1; model.lastModalPayload = payload; return model.confirmReplace ? 'replace' : 'cancel'; } });
  const deps = makeDeps(sandbox, model);

  await FC.wycenaTabShell.generateQuote({}, deps, { source:'test:first' });
  let rows = FC.quoteSnapshotStore.listForProject('proj_dup');
  assert(rows.length === 1, 'Pierwsze kliknięcie powinno utworzyć dokładnie jedną ofertę', rows);
  const firstId = rows[0].id;

  await sleep(1600);
  model.versionName = 'Oferta — A — wariant 2';
  model.confirmReplace = false;
  const modalCallsBeforeCancel = model.modalCalls;
  await FC.wycenaTabShell.generateQuote({}, deps, { source:'test:duplicate-cancel' });
  rows = FC.quoteSnapshotStore.listForProject('proj_dup');
  assert(rows.length === 1, 'Identyczna oferta po Anuluj nie może utworzyć duplikatu', rows);
  assert(rows[0].id === firstId, 'Anuluj przy duplikacie nie powinno zmienić istniejącego ID', rows);
  assert(model.modalCalls === modalCallsBeforeCancel + 1, 'Duplikat musi pokazać modal decyzji Anuluj/Zamień', { modalCalls:model.modalCalls, modalCallsBeforeCancel, lastModalPayload:model.lastModalPayload });
  assert(model.lastModalPayload && Array.isArray(model.lastModalPayload.actions) && model.lastModalPayload.actions.some((a)=> a.value === 'replace' && a.text === 'Zamień istniejącą') && model.lastModalPayload.actions.some((a)=> a.value === 'cancel' && a.text === 'Anuluj'), 'Modal duplikatu musi mieć przyciski Zamień istniejącą i Anuluj', model.lastModalPayload);

  await sleep(1600);
  model.confirmReplace = true;
  const modalCallsBeforeReplace = model.modalCalls;
  await FC.wycenaTabShell.generateQuote({}, deps, { source:'test:duplicate-replace' });
  rows = FC.quoteSnapshotStore.listForProject('proj_dup');
  assert(rows.length === 1, 'Zamiana identycznej oferty ma zachować jeden slot, a nie tworzyć duplikat', rows);
  assert(model.modalCalls === modalCallsBeforeReplace + 1, 'Zamiana identycznej oferty też musi przejść przez modal decyzji', { modalCalls:model.modalCalls, modalCallsBeforeReplace });
  assert(rows[0].id === firstId, 'Zamiana powinna zachować ID/status istniejącej oferty', rows);
  assert((rows[0].commercial && rows[0].commercial.versionName) === 'Oferta — A', 'Zamiana powinna zachować nazwę istniejącej oferty', rows[0]);

  await sleep(1600);
  model.includeCorpus = false;
  model.versionName = 'Oferta — A — wariant 2';
  model.confirmReplace = false;
  await FC.wycenaTabShell.generateQuote({}, deps, { source:'test:real-variant' });
  rows = FC.quoteSnapshotStore.listForProject('proj_dup');
  assert(rows.length === 2, 'Rzeczywiście inna oferta powinna utworzyć kolejny wariant', rows);
}

function runStaticChecks(){
  const version = '20260610_labor_conditions_editor_preview_v1';
  const shell = fs.readFileSync(path.join(process.cwd(), 'js/app/wycena/wycena-tab-shell.js'), 'utf8');
  const store = fs.readFileSync(path.join(process.cwd(), 'js/app/quote/quote-snapshot-store.js'), 'utf8');
  const index = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  const dev = fs.readFileSync(path.join(process.cwd(), 'dev_tests.html'), 'utf8');
  assert(shell.includes('TAKA SAMA OFERTA JUŻ ISTNIEJE'), 'Brak modala duplikatu oferty');
  assert(shell.includes('Zamień istniejącą'), 'Brak przycisku Zamień istniejącą');
  assert(shell.includes('duplicateFound'), 'Brak diagnostyki duplicateFound');
  assert(shell.includes('duplicateModalShown'), 'Brak diagnostyki duplicateModalShown');
  assert(shell.includes('duplicateModalDecision'), 'Brak diagnostyki duplicateModalDecision');
  assert(shell.includes('FC.choiceBox'), 'Modal duplikatu powinien używać aplikacyjnego choiceBox przed fallbackami');
  assert(store.includes('function findDuplicateSnapshot'), 'Brak findDuplicateSnapshot w store');
  assert(store.includes('function replaceSnapshot'), 'Brak replaceSnapshot w store');
  [
    'js/app/quote/quote-snapshot-store.js',
    'js/app/wycena/wycena-tab-shell.js',
    'js/app/wycena/wycena-diagnostics.js',
  ].forEach((script)=>{
    assert(index.includes(`${script}?v=${version}`), `index.html nie ma cache-bustingu ${version} dla ${script}`);
    assert(dev.includes(`${script}?v=${version}`), `dev_tests.html nie ma cache-bustingu ${version} dla ${script}`);
  });
}

(async ()=>{
  try{
    runStaticChecks();
    await runDuplicateGuard();
    console.log('[wycena-duplicate-offer-guard-smoke] OK');
  }catch(err){
    console.error('[wycena-duplicate-offer-guard-smoke] FAIL:', err && err.message ? err.message : err);
    if(err && err.details) console.error(JSON.stringify(err.details, null, 2));
    process.exit(1);
  }
})();
