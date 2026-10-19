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
  assert(sandbox.localStorage.getItem('fc_edit_session_v1') === JSON.stringify(legacyPayload), 'Nie wolno odrzucić aktywnego starego snapshotu bez właściciela');
  assert(sandbox.FC.session.active === true, 'Aktywna sesja musi pozostać dostępna');
  assert(sandbox.FC.session.cancel() === false, 'Nieustalony właściciel blokuje rollback');
  assert(sandbox.localStorage.getItem('fc_edit_session_v1') === JSON.stringify(legacyPayload), 'Failed cancel zachowuje trwały snapshot');
}

function runSessionMetadataAndDeleteReferenceCleanup(){
  const sandbox = loadSmokeFiles(createSandbox());
  const FC = sandbox.FC;
  const initialRows = [makeSnapshot('snap_keep'), makeSnapshot('snap_delete')];
  FC.quoteSnapshotStore.writeAll(initialRows);
  FC.projectStore.upsert({ id:'A', projectData:{} });
  FC.projectStore.setCurrentProjectId('A');
  assert(FC.session.begin() === true, 'Sesja wymaga jednoznacznego projektu A');
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
  assert(!Object.hasOwn(sessionAfter.snapshot, 'fc_quote_snapshots_v1'), 'Historia ofert jest niezależna od rollbacku projektu');
  assert(FC.session.cancel() === true, 'Anuluj projekt powinno się udać');
  assert(FC.quoteSnapshotStore.getById('snap_keep'), 'Anuluj nie usuwa niezależnej historii');
  assert(!FC.quoteSnapshotStore.getById('snap_delete'), 'Anuluj nie odtwarza usuniętej oferty');
}

function runCacheBustCheck(){
  const version = '20260628_drawer_systems_materials_v1';
  const index = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  const dev = fs.readFileSync(path.join(process.cwd(), 'dev_tests.html'), 'utf8');
  [
    'js/app/investor/session.js',
    'js/app/quote/quote-snapshot-store.js',
    'js/app/wycena/wycena-diagnostics.js',
    'js/app/wycena/wycena-tab-shell.js',
  ].forEach((script)=>{
    const expectedVersion = script === 'js/app/investor/session.js' ? '20261019_initial_session_retry' : script === 'js/app/wycena/wycena-tab-shell.js' ? '20261019_quote_performance' : ['js/app/wycena/wycena-tab-shell.js','js/app/wycena/wycena-diagnostics.js'].includes(script) ? '20261019_project_context' : script === 'js/app/wycena/wycena-tab-shell.js' ? '20261018_pcv_ram_quote_fix' : script === 'js/app/quote/quote-snapshot-store.js' ? '20261014_c2_1b2c3b' : ['js/app/wycena/wycena-tab-shell.js','js/app/quote/quote-snapshot-store.js'].includes(script) ? '20261014_c2_1b2c3a' : script === 'js/app/investor/session.js' ? '20261013_c2_1b2c1' : ['js/app/wycena/wycena-tab-shell.js', 'js/app/quote/quote-snapshot-store.js'].includes(script) ? '20261012_c2_0b' : version;
    assert(index.includes(`${script}?v=${expectedVersion}`), `index.html nie ma cache-bustingu ${version} dla ${script}`);
    assert(dev.includes(`${script}?v=${expectedVersion}`), `dev_tests.html nie ma cache-bustingu ${version} dla ${script}`);
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
