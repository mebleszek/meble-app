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
  if(preload && typeof preload === 'object') Object.entries(preload).forEach(([key, value])=> localStorage.setItem(key, value));
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

function legacySnapshot(id){
  return {
    version:6,
    id,
    investor:{ id:'inv_legacy' },
    project:{ id:'proj_legacy', investorId:'inv_legacy', title:'Legacy' },
    scope:{ selectedRooms:['room_A'], roomLabels:['A'] },
    catalogs:{ accessories:new Array(20).fill({ name:'Ciężki katalog', price:1 }) },
    lines:{ materials:[{ name:'Płyta', total:10 }], accessories:[], agdServices:[], quoteRates:[], labor:[] },
    totals:{ materials:10, accessories:0, services:0, quoteRates:0, labor:0, subtotal:10, discount:0, grand:10 },
    commercial:{ preliminary:false, versionName:'Oferta — A — wariant 2' },
    meta:{ source:'quote-snapshot', versionName:'Oferta — A — wariant 2', preliminary:false },
  };
}

function snapshot(id, name, generatedAt){
  return {
    id,
    investor:{ id:'inv_clean' },
    project:{ id:'proj_clean', investorId:'inv_clean', title:'Projekt clean' },
    scope:{ selectedRooms:['room_A'], roomLabels:['A'] },
    lines:{ materials:[{ name:'Płyta', total:100 }], accessories:[{ name:'Zawias', total:20 }], agdServices:[], quoteRates:[], labor:[{ name:'Montaż', total:50 }] },
    totals:{ materials:100, accessories:20, services:0, quoteRates:0, labor:50, subtotal:170, discount:0, grand:170 },
    commercial:{ preliminary:false, versionName:name },
    generatedAt,
  };
}

function runLegacyPurgeAndSlimSave(){
  const sandbox = loadSmokeFiles(createSandbox({
    fc_quote_snapshots_v1: JSON.stringify([legacySnapshot('snap_old_1'), legacySnapshot('snap_old_2')]),
  }));
  const FC = sandbox.FC;
  assert(Array.isArray(FC.quoteSnapshotStore.readAll()) && FC.quoteSnapshotStore.readAll().length === 0, 'Legacy ciężkie snapshoty nie zostały odcięte po starcie', FC.quoteSnapshotStore.readAll());
  const rawAfterLoad = sandbox.localStorage.getItem('fc_quote_snapshots_v1');
  assert(rawAfterLoad === '[]', 'Legacy snapshoty nie zostały fizycznie wyczyszczone ze storage', rawAfterLoad);

  const first = FC.quoteSnapshotStore.save(snapshot('snap_clean_1', 'Oferta — A', 2000));
  const second = FC.quoteSnapshotStore.save(snapshot('snap_clean_2', 'Oferta — A — wariant 2', 3000));
  const rows = FC.quoteSnapshotStore.listForProject('proj_clean');
  assert(rows.length === 2, 'Clean store nie zachował wielu wariantów projektu', rows);
  assert(rows.some((row)=> row.id === first.id) && rows.some((row)=> row.id === second.id), 'Clean store zgubił jeden z wariantów', rows);

  const rawRows = JSON.parse(sandbox.localStorage.getItem('fc_quote_snapshots_v1') || '[]');
  assert(rawRows.every((row)=> Number(row.version) >= 7), 'Nowe snapshoty nie mają wersji clean schema', rawRows);
  assert(rawRows.every((row)=> row.meta && row.meta.storageSchema === 'quote-snapshot-slim-v1'), 'Nowe snapshoty nie mają oznaczenia slim schema', rawRows);
  assert(rawRows.every((row)=> !Object.prototype.hasOwnProperty.call(row, 'catalogs')), 'Nowy snapshot nadal zapisuje pełne katalogi', rawRows);
  assert(rawRows.every((row)=> row.lines && row.lines.materials && row.lines.labor), 'Nowy snapshot nie zachował danych wykonawczych/linek do list robocizny i zakupów', rawRows);

  FC.quoteSnapshotStore.markSelectedForProject('proj_clean', first.id, { status:'zaakceptowany', roomIds:['room_A'] });
  const selected = FC.quoteSnapshotStore.getSelectedForProject('proj_clean', { roomIds:['room_A'] });
  assert(selected && selected.id === first.id, 'Clean store nie zachował korelacji statusu/wybranej oferty', { selected, rows:FC.quoteSnapshotStore.listForProject('proj_clean') });
}

function runStaleDraftVariantReset(){
  const sandbox = loadSmokeFiles(createSandbox());
  const FC = sandbox.FC;
  assert(FC.quoteSnapshotStore.readAll().length === 0, 'Test stale draft startuje z niepustym store');
  const deps = { getCurrentProjectId:()=> 'proj_empty' };
  const selection = { selectedRooms:['room_A'], materialScope:{ kind:'all', includeFronts:true, includeCorpus:true } };
  const draft = { commercial:{ preliminary:false, versionName:'Oferta — room_A — wariant 2' }, selection };
  const coerced = FC.wycenaTabSelectionVersion.coerceVersionNameForSelection(selection, draft, deps);
  assert(coerced === 'Oferta — room_A', 'Stary draft wariantu 2 nie został zresetowany, mimo pustego store snapshotów', { coerced });
}

function runCacheBustCheck(){
  const versions = {
    'js/app/quote/quote-snapshot-store.js':'20260614_carrying_high_fronts_v1',
    'js/app/quote/quote-snapshot.js':'20260614_carrying_high_fronts_v1',
    'js/app/wycena/wycena-core.js':'20260614_carrying_high_fronts_v1',
    'js/app/wycena/wycena-tab-selection-version.js':'20260614_carrying_high_fronts_v1',
    'js/app/wycena/wycena-diagnostics.js':'20260614_carrying_high_fronts_v1',
    'js/app/wycena/wycena-tab-shell.js':'20260614_carrying_high_fronts_v1',
  };
  const index = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  const dev = fs.readFileSync(path.join(process.cwd(), 'dev_tests.html'), 'utf8');
  Object.entries(versions).forEach(([script, version])=>{
    assert(index.includes(`${script}?v=${version}`), `index.html nie ma cache-bustingu ${version} dla ${script}`);
    assert(dev.includes(`${script}?v=${version}`), `dev_tests.html nie ma cache-bustingu ${version} dla ${script}`);
  });
}

try{
  runLegacyPurgeAndSlimSave();
  runStaleDraftVariantReset();
  runCacheBustCheck();
  console.log('[wycena-snapshot-clean-store-smoke] OK');
}catch(err){
  console.error('[wycena-snapshot-clean-store-smoke] FAIL:', err && err.message ? err.message : err);
  if(err && err.details) console.error(JSON.stringify(err.details, null, 2));
  process.exit(1);
}
