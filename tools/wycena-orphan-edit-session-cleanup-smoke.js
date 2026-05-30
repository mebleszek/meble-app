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

function createSandbox(preload){
  const localStorage = makeStorage();
  if(preload && typeof preload === 'object'){
    Object.entries(preload).forEach(([key, value])=> localStorage.setItem(key, value));
  }
  const sandbox = {
    console,
    setTimeout, clearTimeout,
    requestAnimationFrame:(fn)=> setTimeout(fn, 0),
    Date, Math, JSON,
    localStorage,
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

function makeSnapshot(id, projectId){
  return {
    id,
    investor:{ id:'inv_orphan_session' },
    project:{ id:projectId || 'proj_orphan_session', investorId:'inv_orphan_session', title:'Projekt testowy' },
    scope:{ selectedRooms:['room_A'], roomLabels:['A'] },
    lines:{ materials:[{ name:'Płyta', total:10 }], accessories:[], agdServices:[], quoteRates:[], labor:[] },
    totals:{ materials:10, accessories:0, services:0, quoteRates:0, labor:0, subtotal:10, discount:0, grand:10 },
    commercial:{ preliminary:false, versionName:'Oferta' },
    meta:{ source:'quote-snapshot', versionName:'Oferta', preliminary:false },
  };
}

function runLegacyOrphanSessionBootCleanup(){
  const legacyPayload = {
    active:true,
    snapshot:{
      fc_quote_snapshots_v1: JSON.stringify([makeSnapshot('snap_legacy_orphan')]),
      fc_investors_v1: JSON.stringify([{ id:'inv_orphan_session', name:'Test' }]),
    },
  };
  const sandbox = loadSmokeFiles(createSandbox({
    fc_edit_session_v1: JSON.stringify(legacyPayload),
  }));
  assert(!sandbox.localStorage.getItem('fc_edit_session_v1'), 'Legacy aktywna sesja bez metadanych nie została wyczyszczona na starcie');
  assert(sandbox.FC.session && sandbox.FC.session.active === false, 'Runtime FC.session nadal jest aktywny po czyszczeniu legacy orphan');
}

function runSessionMetadataAndDeleteReferenceCleanup(){
  const sandbox = loadSmokeFiles(createSandbox());
  const FC = sandbox.FC;
  const initialRows = [makeSnapshot('snap_keep'), makeSnapshot('snap_delete')];
  FC.quoteSnapshotStore.writeAll(initialRows);
  FC.session.begin();
  const sessionRawBefore = sandbox.localStorage.getItem('fc_edit_session_v1');
  const sessionBefore = JSON.parse(sessionRawBefore);
  assert(sessionBefore.schemaVersion >= 2, 'Nowa sesja edycji nie ma schemaVersion >= 2', sessionBefore);
  assert(Number(sessionBefore.startedAt || 0) > 0 && Number(sessionBefore.updatedAt || 0) > 0, 'Nowa sesja edycji nie zapisuje znaczników czasu', sessionBefore);
  assert(sessionBefore.context && typeof sessionBefore.context === 'object', 'Nowa sesja edycji nie zapisuje kontekstu', sessionBefore);

  const removed = FC.quoteSnapshotStore.remove('snap_delete');
  assert(removed === true, 'Usunięcie snapshotu z quoteSnapshotStore zwróciło false');
  assert(!FC.quoteSnapshotStore.getById('snap_delete'), 'Usunięty snapshot nadal jest w głównym store');
  const currentRows = FC.quoteSnapshotStore.readAll();
  assert(currentRows.length === 1 && currentRows[0].id === 'snap_keep', 'Główny store snapshotów ma niepoprawną zawartość po usunięciu', currentRows);

  const sessionAfter = JSON.parse(sandbox.localStorage.getItem('fc_edit_session_v1'));
  const sessionRows = JSON.parse(sessionAfter.snapshot.fc_quote_snapshots_v1 || '[]');
  assert(sessionRows.some((row)=> row.id === 'snap_keep'), 'Snapshot pozostający w historii zniknął z sesji edycji', sessionRows);
  assert(!sessionRows.some((row)=> row.id === 'snap_delete'), 'Usunięty snapshot nadal siedzi w fc_edit_session_v1 i mógłby wrócić po Anuluj', sessionRows);
}

function runCacheBustCheck(){
  const version = '20260530_wycena_render_source_diagnostics_v1';
  const index = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  const dev = fs.readFileSync(path.join(process.cwd(), 'dev_tests.html'), 'utf8');
  [
    'js/app/investor/session.js',
    'js/app/quote/quote-snapshot-store.js',
    'js/app/wycena/wycena-diagnostics.js',
    'js/app/wycena/wycena-tab-shell.js',
  ].forEach((script)=>{
    assert(index.includes(`${script}?v=${version}`), `index.html nie ma cache-bustingu ${version} dla ${script}`);
    assert(dev.includes(`${script}?v=${version}`), `dev_tests.html nie ma cache-bustingu ${version} dla ${script}`);
  });
}

try{
  runLegacyOrphanSessionBootCleanup();
  runSessionMetadataAndDeleteReferenceCleanup();
  runCacheBustCheck();
  console.log('[wycena-orphan-edit-session-cleanup-smoke] OK');
}catch(err){
  console.error('[wycena-orphan-edit-session-cleanup-smoke] FAIL:', err && err.message ? err.message : err);
  if(err && err.details) console.error(JSON.stringify(err.details, null, 2));
  process.exit(1);
}
