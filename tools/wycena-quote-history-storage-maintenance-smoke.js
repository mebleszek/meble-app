const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { APP_DEV_SMOKE_FILES } = require('./app-dev-smoke-lib/file-list');
const { SmokeStorage, makeStorage } = require('./app-dev-smoke-lib/smoke-storage');
const { makeMiniDocument } = require('./app-dev-smoke-lib/mini-document');

const VERSION = '20260610_labor_conditions_editor_preview_v1';

function assert(condition, message, details){
  if(!condition){
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

class QuotaStorage extends SmokeStorage{
  constructor(limit){ super(); this.limit = Number(limit) || Infinity; }
  totalAfterSet(key, value){
    const k = String(key);
    const v = String(value);
    let total = v.length;
    for(const [storedKey, storedValue] of this._data.entries()){
      if(String(storedKey) !== k) total += String(storedValue).length;
    }
    return total;
  }
  setItem(key, value){
    const total = this.totalAfterSet(key, value);
    if(total > this.limit){
      const err = new Error('QuotaExceededError: smoke storage full');
      err.name = 'QuotaExceededError';
      throw err;
    }
    super.setItem(key, value);
  }
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

function makeBackupRows(){
  const huge = 'x'.repeat(1100);
  return Array.from({ length:8 }, (_, index)=> ({
    id:'bak_' + index,
    reason:index % 2 ? 'manual' : 'before-tests',
    label:'Backup ' + index,
    createdAtMs:1000 + index,
    snapshot:{ kind:'meble-app-storage-snapshot', keys:{ ['fc_fake_' + index + '_v1']:huge } },
  }));
}

function makeSnapshot(id, projectId, total){
  return {
    id,
    investor:{ id:'inv_storage' },
    project:{ id:projectId || 'proj_storage', investorId:'inv_storage', title:'Projekt storage' },
    scope:{ selectedRooms:['room_A'], roomLabels:['A'] },
    lines:{
      materials:[{ key:'plyta_' + id, name:'Płyta ' + id, qty:1, unit:'ark.', unitPrice:total, total, calculation:'opis'.repeat(80) }],
      elements:Array.from({ length:8 }, (_, index)=> ({ key:'el_' + id + '_' + index, name:'Element', qty:1, unit:'szt.', width:600 + index, height:720, materialLabel:'Płyta' })),
      accessories:[], agdServices:[], quoteRates:[], labor:[],
    },
    totals:{ materials:total, accessories:0, services:0, quoteRates:0, labor:0, subtotal:total, discount:0, grand:total },
    commercial:{ preliminary:false, versionName:'Oferta — A — ' + id },
    generatedAt:100000 + total,
  };
}

function runMaintenanceWriteAfterQuota(){
  const storage = new QuotaStorage(Infinity);
  storage.setItem('fc_data_backups_v1', JSON.stringify(makeBackupRows()));
  storage.setItem('fc_rozrys_plan_cache_v2', 'cache'.repeat(500));
  storage.limit = 12000;
  const sandbox = loadSmokeFiles(createSandbox(storage));
  const FC = sandbox.FC;
  assert(FC.quoteSnapshotStorageMaintenance && typeof FC.quoteSnapshotStorageMaintenance.prepareForSnapshotWrite === 'function', 'Brak modułu maintenance dla snapshotów');
  const saved = FC.quoteSnapshotStore.save(makeSnapshot('snap_after_cleanup', 'proj_storage', 1500));
  assert(saved && saved.id === 'snap_after_cleanup', 'Snapshot nie zapisał się po awaryjnym odchudzeniu storage', saved);
  const rows = FC.quoteSnapshotStore.listForProject('proj_storage');
  assert(rows.length === 1 && rows[0].id === 'snap_after_cleanup', 'Historia nie widzi snapshotu po zapisie', rows);
  const backups = JSON.parse(storage.getItem('fc_data_backups_v1') || '[]');
  assert(backups.length < 8, 'Awaryjne odchudzanie nie skróciło starych backupów', { count:backups.length });
  assert(!storage.getItem('fc_rozrys_plan_cache_v2'), 'Cache ROZRYS nie został usunięty przy pełnym storage');
}

function runThirtyOffersPerProjectLimit(){
  const sandbox = loadSmokeFiles(createSandbox());
  const FC = sandbox.FC;
  for(let i = 0; i < 35; i += 1){
    FC.quoteSnapshotStore.save(makeSnapshot('snap_' + i, 'proj_limit', 100 + i));
  }
  const rows = FC.quoteSnapshotStore.listForProject('proj_limit');
  assert(rows.length === 30, 'Historia projektu powinna trzymać 30 najnowszych ofert bez śmieciowego wzrostu', { count:rows.length, ids:rows.map((r)=> r.id) });
  assert(rows[0].id === 'snap_34', 'Najnowszy wariant powinien być pierwszy', rows.slice(0, 3));
  assert(!rows.some((row)=> row.id === 'snap_0'), 'Najstarsze niezaakceptowane warianty powinny zostać odcięte po limicie 30', rows.map((r)=> r.id));
}

function runStaleWycenaEditSessionCleanupOnSave(){
  const staleSnapshot = {
    fc_quote_snapshots_v1: JSON.stringify([makeSnapshot('old_in_session', 'proj_session', 10)]),
    fc_project_v1: JSON.stringify({ schemaVersion:12 }),
    fc_projects_v1: JSON.stringify([]),
  };
  const sandbox = loadSmokeFiles(createSandbox());
  sandbox.localStorage.setItem('fc_ui_v1', JSON.stringify({ activeTab:'wycena' }));
  sandbox.localStorage.setItem('fc_edit_session_v1', JSON.stringify({
    schemaVersion:2,
    active:true,
    startedAt:1000,
    updatedAt:1000,
    context:{ activeTab:'wycena', projectId:'proj_session', investorId:'inv_storage', roomId:'' },
    snapshot:staleSnapshot,
  }));
  const FC = sandbox.FC;
  const saved = FC.quoteSnapshotStore.save(makeSnapshot('snap_after_stale_session_cleanup', 'proj_session', 220));
  assert(saved && saved.id === 'snap_after_stale_session_cleanup', 'Nie zapisano snapshotu po czyszczeniu martwej sesji WYCENY', saved);
  assert(!sandbox.localStorage.getItem('fc_edit_session_v1'), 'Martwa sesja edycji WYCENY nie została usunięta przed zapisem historii');
}

function runCompactQuoteFingerprint(){
  const sandbox = loadSmokeFiles(createSandbox());
  const FC = sandbox.FC;
  const snap = makeSnapshot('snap_fingerprint', 'proj_fingerprint', 333);
  snap.lines.labor = [{
    key:'labor_heavy', name:'Robocizna', qty:1, unit:'szt.', unitPrice:100, total:100,
    details:Array.from({ length:20 }, (_, index)=> ({ name:'Czynność ' + index, calculation:'bardzo długi opis '.repeat(80), total:index }))
  }];
  const saved = FC.quoteSnapshotStore.save(snap);
  assert(saved && saved.meta && /^qfp2:\d+:[0-9a-f]{8}:[0-9a-f]{8}$/.test(saved.meta.quoteFingerprint), 'Odcisk oferty nie jest kompaktowy qfp2', saved && saved.meta);
  assert(saved.meta.quoteFingerprint.length < 40, 'Odcisk oferty nadal jest zbyt duży', saved.meta.quoteFingerprint);
  const size = FC.quoteSnapshotStore.snapshotSizeBreakdown(saved);
  assert(size && size.parts && Number(size.parts.meta || 0) < 2000, 'Meta snapshotu nadal waży podejrzanie dużo po skróceniu fingerprintu', size);
}

function runStaticChecks(){
  const index = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  const dev = fs.readFileSync(path.join(process.cwd(), 'dev_tests.html'), 'utf8');
  const store = fs.readFileSync(path.join(process.cwd(), 'js/app/quote/quote-snapshot-store.js'), 'utf8');
  const diagnostics = fs.readFileSync(path.join(process.cwd(), 'js/app/wycena/wycena-diagnostics.js'), 'utf8');
  assert(index.includes(`js/app/quote/quote-snapshot-storage-maintenance.js?v=${VERSION}`), 'index.html nie ładuje maintenance snapshotów');
  assert(dev.includes(`js/app/quote/quote-snapshot-storage-maintenance.js?v=${VERSION}`), 'dev_tests.html nie ładuje maintenance snapshotów');
  assert(store.includes('MAX_SNAPSHOTS_PER_PROJECT = 30'), 'Store nie ma limitu 30 ofert na projekt');
  assert(store.includes('quoteSnapshotStorageMaintenance'), 'Store nie korzysta z maintenance przy błędzie storage');
  assert(diagnostics.includes("const BUILD = '" + VERSION + "'"), 'Diag ma zły build');
  assert(diagnostics.includes('summarizePreviewState'), 'Diag nadal może wyrzucać pełny lastQuote zamiast skrótu');
  assert(diagnostics.includes('summarizeTabShellState'), 'Diag nadal może wyrzucać pełny shellState.lastQuote zamiast skrótu');
  assert(diagnostics.includes('topKeys:getLocalStorageTopKeys'), 'Diag nie pokazuje największych kluczy localStorage');
}

try{
  runStaticChecks();
  runMaintenanceWriteAfterQuota();
  runThirtyOffersPerProjectLimit();
  runStaleWycenaEditSessionCleanupOnSave();
  runCompactQuoteFingerprint();
  console.log('[wycena-quote-history-storage-maintenance-smoke] OK');
}catch(err){
  console.error('[wycena-quote-history-storage-maintenance-smoke] FAIL:', err && err.message ? err.message : err);
  if(err && err.details) console.error(JSON.stringify(err.details, null, 2));
  process.exit(1);
}
