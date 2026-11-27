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
  require('./script-versions.js').assertVersions(process.cwd());
  const versions = {
    'js/app/quote/quote-snapshot-store.js':require('./script-versions').versions['js/app/quote/quote-snapshot-store.js'],
    'js/app/quote/quote-snapshot.js':require('./script-versions').versions['js/app/quote/quote-snapshot.js'],
    'js/app/wycena/wycena-core.js':require('./script-versions').versions['js/app/wycena/wycena-core.js'],
    'js/app/wycena/wycena-tab-selection-version.js':'20260628_drawer_systems_materials_v1',
    'js/app/wycena/wycena-diagnostics.js':'20261019_project_context',
    'js/app/wycena/wycena-tab-shell.js':require('./script-versions').versions['js/app/wycena/wycena-tab-shell.js'],
  };
  const index = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  const dev = fs.readFileSync(path.join(process.cwd(), 'dev_tests.html'), 'utf8');
  Object.entries(versions).forEach(([script, version])=>{
    assert(index.includes(`${script}?v=${version}`), `index.html nie ma cache-bustingu ${version} dla ${script}`);
    assert(dev.includes(`${script}?v=${version}`), `dev_tests.html nie ma cache-bustingu ${version} dla ${script}`);
  });
}

async function runForeignHistoryPreservation(){
  const strict = require('node:assert/strict');
  const {createApplicationQuoteLedger} = await import('../sync/application-quote-ledger.mjs');
  const {digest,equal} = await import('../sync/local-first-values.mjs');
  const sandbox = loadSmokeFiles(createSandbox()),store = sandbox.FC.quoteSnapshotStore;
  store.save(snapshot('old', 'Earlier offer', 2000));
  const original = JSON.parse(sandbox.localStorage.getItem('fc_quote_snapshots_v1'))[0];
  const record = {id:'new-room',investorId:'new-investor'},recordHash = await digest(record),documentHash = 'a'.repeat(64);
  const head = {projectId:record.id,investorId:record.investorId,currentRevisionId:'confirmed-room',documentSha256:documentHash};
  const encoded = JSON.stringify({document:{payload:{project:record},integrity:{documentSha256:documentHash}}});
  for(const kind of ['missing-optional-field','unknown-fields']){
    const old = structuredClone(original);
    if(kind==='missing-optional-field') delete old.meta.storageWarning;
    else{old.meta.privateExtension={exact:17.125};old.lines.materials[0].privateExtension={exact:27.125};}
    old.meta.selectedByClient=true;old.meta.acceptedAt=1000;old.meta.acceptedStage='zaakceptowany';
    const other = structuredClone(old);
    other.id='other-old';other.generatedAt=3000;other.investor.id='another-foreign-investor';
    const prior = [old,other],beforeRaw = JSON.stringify(prior);
    sandbox.FC.applicationWrite={registry:'p0b-rooms-v1'};
    sandbox.localStorage.setItem('fc_quote_snapshots_v1',beforeRaw);
    store.readAll();strict.equal(sandbox.localStorage.getItem('fc_quote_snapshots_v1'),beforeRaw);
    const candidate = snapshot('new', 'New offer', 4000);
    candidate.investor.id=record.investorId;candidate.project={id:record.id,investorId:record.investorId};
    candidate.scope={selectedRooms:[record.id],roomLabels:['New room'],sourceProjects:[{projectId:record.id,roomId:record.id,investorId:record.investorId,recordHash,documentHash,revision:head}]};
    store.save(candidate);
    const next = JSON.parse(sandbox.localStorage.getItem('fc_quote_snapshots_v1'));
    strict.deepEqual(next.filter(row=>row.id!=='new').map(row=>row.id),prior.map(row=>row.id),'Appending must preserve the stored foreign history order');
    strict.deepEqual(next.find(row=>row.id==='old'),old,'Creating another investor offer cannot normalize frozen historical fields: '+kind);
    let committed;
    const ledger = createApplicationQuoteLedger({fc:{projectModel:{normalizeProjectRecord:value=>value}},store:{
      ownerUid:'test-owner',readApplication:async()=>({rows:{fc_quote_snapshots_v1:beforeRaw}}),
      snapshot:async scope=>scope===record.id?{replica:{key:scope,json:encoded,hash:await digest(encoded),dirty:false,base:head},operations:[]}:{replica:null,operations:[]},
      commitQuoteLedger:async args=>{committed=args;return {ok:true};}
    },getSync:()=>({channel:()=>({})})});
    const application={rows:{fc_quote_snapshots_v1:JSON.stringify(next),fc_current_investor_v1:record.investorId,fc_investors_v1:JSON.stringify([{id:record.investorId}])}};
    strict.equal((await ledger.commit(application,[])).ok,true);
    strict.equal(committed.value.investorId,record.investorId);strict.equal(committed.value.offers.length,1);
    strict.deepEqual(committed.application.rows,application.rows);
    const tampered=structuredClone(application),rows=JSON.parse(tampered.rows.fc_quote_snapshots_v1);
    rows.find(row=>row.id==='old').totals.grand=0;tampered.rows.fc_quote_snapshots_v1=JSON.stringify(rows);
    await strict.rejects(ledger.commit(tampered,[]),{code:'LF_QUOTE_OWNER_CHANGED'});
    const second={...structuredClone(candidate),id:'second',generatedAt:5000};store.save(second);
    const later=JSON.parse(sandbox.localStorage.getItem('fc_quote_snapshots_v1'));
    strict.deepEqual(later.find(row=>row.id==='old'),old);
    strict.ok(equal(later.find(row=>row.id==='new'),next.find(row=>row.id==='new')),'A second variant cannot rewrite the first');
    const protectedRaw=sandbox.localStorage.getItem('fc_quote_snapshots_v1'),resolver=sandbox.FC.projectPcvResolver;
    sandbox.FC.projectPcvResolver={...resolver,validateQuoteCandidate(){throw Object.assign(Error('PROJECT_PCV_READ_CONFLICT'),{code:'PROJECT_PCV_READ_CONFLICT'});}};
    try{strict.throws(()=>store.save({...structuredClone(candidate),id:'bad-new',pcvMode:'project'}),{code:'PROJECT_PCV_READ_CONFLICT'});}
    finally{sandbox.FC.projectPcvResolver=resolver;}
    strict.equal(sandbox.localStorage.getItem('fc_quote_snapshots_v1'),protectedRaw,'New candidates still require proof before any write');
  }
}

async function main(){try{
  runLegacyPurgeAndSlimSave();
  runStaleDraftVariantReset();
  runCacheBustCheck();
  await runForeignHistoryPreservation();
  console.log('[wycena-snapshot-clean-store-smoke] OK');
}catch(err){
  console.error('[wycena-snapshot-clean-store-smoke] FAIL:', err && err.message ? err.message : err);
  if(err && err.details) console.error(JSON.stringify(err.details, null, 2));
  process.exit(1);
}}
if(require.main===module)main();
