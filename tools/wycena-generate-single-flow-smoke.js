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

function makeDeps(sandbox, buildCounter){
  const FC = sandbox.FC;
  const state = { isBusy:false };
  const selection = { selectedRooms:['room_A'], materialScope:{ kind:'all', includeFronts:true, includeCorpus:true } };
  const draft = { selection, commercial:{ preliminary:false, versionName:'Oferta — A' } };
  FC.wycenaContextRepair = FC.wycenaContextRepair || {};
  FC.wycenaContextRepair.repairActiveQuoteContext = ()=> ({ ok:true, investorId:'inv_single', projectId:'proj_single', activeRoomIds:['room_A'], selectedRooms:['room_A'], repairs:[], hadProjectContent:true });
  FC.wycenaCore = FC.wycenaCore || {};
  FC.wycenaCore.buildQuoteSnapshot = async ()=>{
    buildCounter.count += 1;
    const id = 'snap_single_' + buildCounter.count;
    return FC.quoteSnapshotStore.save({
      id,
      generatedAt: Date.now(),
      investor:{ id:'inv_single', name:'Test' },
      project:{ id:'proj_single', investorId:'inv_single', title:'Test' },
      scope:{ selectedRooms:['room_A'], roomLabels:['A'], materialScope:selection.materialScope, materialScopeMode:'both' },
      lines:{ materials:[{ name:'Płyta', qty:1, total:100 }], accessories:[], agdServices:[], quoteRates:[], labor:[], elements:[] },
      totals:{ materials:100, accessories:0, services:0, quoteRates:0, labor:0, subtotal:100, discount:0, grand:100 },
      commercial:{ preliminary:false, versionName: buildCounter.count === 1 ? 'Oferta — A' : 'Oferta — A — wariant ' + buildCounter.count },
    });
  };
  return {
    getState:()=> state,
    setState:(patch)=> Object.assign(state, patch || {}),
    render:()=>{},
    normalizeDraftSelection:()=> selection,
    getOfferDraft:()=> draft,
    ensureVersionNameBeforeGenerate:async ()=> ({ cancelled:false, versionName:draft.commercial.versionName }),
    getSnapshotId:(row)=> String(row && (row.id || row.snapshotId) || ''),
    syncGeneratedQuoteStatus:()=>{},
    getProjectStatusForHistory:()=> 'nowy',
    getSnapshotHistory:()=> FC.quoteSnapshotStore.listForProject('proj_single'),
  };
}

async function runSingleFlowGuard(){
  const sandbox = loadSmokeFiles(createSandbox());
  const FC = sandbox.FC;
  assert(FC.wycenaTabShell && typeof FC.wycenaTabShell.generateQuote === 'function', 'Brak FC.wycenaTabShell.generateQuote');
  assert(FC.wycenaTabShell._generateRuntime, 'Shell WYCENY nie wystawia runtime locka do testu');
  const buildCounter = { count:0 };
  const deps = makeDeps(sandbox, buildCounter);

  await FC.wycenaTabShell.generateQuote({ listEl:null }, deps, { source:'test:first' });
  await FC.wycenaTabShell.generateQuote({ listEl:null }, deps, { source:'test:synthetic-click-replay' });
  let rows = FC.quoteSnapshotStore.listForProject('proj_single');
  assert(buildCounter.count === 1, 'Syntetyczny drugi event z tego samego kliknięcia zbudował drugi snapshot', { count:buildCounter.count, rows });
  assert(rows.length === 1, 'Po jednym kliknięciu i replayu eventu powinien istnieć dokładnie jeden snapshot', rows);

  await sleep(1600);
  await FC.wycenaTabShell.generateQuote({ listEl:null }, deps, { source:'test:intentional-second-click' });
  rows = FC.quoteSnapshotStore.listForProject('proj_single');
  assert(buildCounter.count === 2, 'Świadome drugie kliknięcie po oknie deduplikacji nie wygenerowało drugiego wariantu', { count:buildCounter.count, rows });
  assert(rows.length === 2, 'Po drugim świadomym kliknięciu powinny istnieć dwa snapshoty/warianty', rows);
}

function runStaticChecks(){
  const version = '20260530_wycena_generate_single_flow_v1';
  const shell = fs.readFileSync(path.join(process.cwd(), 'js/app/wycena/wycena-tab-shell.js'), 'utf8');
  const index = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  const dev = fs.readFileSync(path.join(process.cwd(), 'dev_tests.html'), 'utf8');
  assert(shell.includes('GENERATE_DEDUP_WINDOW_MS'), 'Brak okna deduplikacji generowania WYCENY');
  assert(shell.includes('generate-skipped-duplicate-event'), 'Brak diagnostyki pominiętego zdublowanego eventu generowania');
  assert(shell.includes('_generateRuntime:generateRuntime'), 'Runtime lock generowania nie jest dostępny do testów/debugu');
  ['js/app/wycena/wycena-tab-shell.js','js/app/wycena/wycena-diagnostics.js'].forEach((script)=>{
    assert(index.includes(`${script}?v=${version}`), `index.html nie ma cache-bustingu ${version} dla ${script}`);
    assert(dev.includes(`${script}?v=${version}`), `dev_tests.html nie ma cache-bustingu ${version} dla ${script}`);
  });
}

(async ()=>{
  try{
    runStaticChecks();
    await runSingleFlowGuard();
    console.log('[wycena-generate-single-flow-smoke] OK');
  }catch(err){
    console.error('[wycena-generate-single-flow-smoke] FAIL:', err && err.message ? err.message : err);
    if(err && err.details) console.error(JSON.stringify(err.details, null, 2));
    process.exit(1);
  }
})();
