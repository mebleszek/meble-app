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

async function main(){
  const sandbox = loadSmokeFiles(createSandbox());
  const FC = sandbox.FC;
  assert(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.buildReport === 'function', 'Brak modułu diagnostyki WYCENY');
  assert(typeof FC.wycenaDiagnostics.stringifyReport === 'function', 'Brak stringifyReport diagnostyki WYCENY');
  assert(typeof FC.wycenaDiagnostics.renderTopbarButton === 'function', 'Brak przycisku diagnostyki WYCENY');
  assert(typeof FC.wycenaDiagnostics.reportFileName === 'function', 'Brak generatora nazwy pliku raportu diagnostycznego');

  FC.wycenaDiagnostics.recordGenerateButtonEvent('test-button');
  FC.wycenaDiagnostics.beginGenerateTrace('test');
  FC.wycenaDiagnostics.markGenerateTrace('step', { ok:true });
  FC.wycenaDiagnostics.endGenerateTrace({ ok:true });

  const report = await FC.wycenaDiagnostics.buildReport({ dryRun:false });
  assert(report && report.kind === 'meble-app-wycena-diagnostics', 'Raport ma zły format', report);
  assert(report.runtime && report.storage && report.roomsAndSelection && report.snapshots && report.renderSources && report.versionNameDiagnostics && report.snapshotStorageDeepDive, 'Raport nie zawiera wymaganych sekcji render/source diagnostics', report);
  assert(Array.isArray(report.storage.topKeys), 'Raport nie zawiera LOCAL STORAGE TOP KEYS / topKeys', report.storage);

  assert(report.lastGenerateButtonEvent && report.lastGenerateButtonEvent.source === 'test-button', 'Raport nie zawiera zdarzenia przycisku WYCENY', report.lastGenerateButtonEvent);
  assert(report.lastGenerateTrace && report.lastGenerateTrace.result && report.lastGenerateTrace.result.ok === true, 'Raport nie zawiera śladu generowania WYCENY', report.lastGenerateTrace);
  const text = FC.wycenaDiagnostics.stringifyReport(report);
  assert(typeof text === 'string' && text.includes('RAPORT DIAGNOSTYCZNY WYCENA') && text.includes('OSTATNI KLIK WYCEN') && text.includes('ŹRÓDŁA EKRANU WYCENA') && text.includes('SNAPSHOT STORAGE DEEP DIVE'), 'Tekst raportu jest niekompletny', text.slice(0, 300));
  const filename = FC.wycenaDiagnostics.reportFileName(report);
  const diagSource = fs.readFileSync(path.join(process.cwd(), 'js/app/wycena/wycena-diagnostics.js'), 'utf8');
  const buildMatch = diagSource.match(/const BUILD = '([^']+)'/);
  assert(buildMatch && buildMatch[1], 'Diagnostyka musi deklarować własny BUILD');
  const escapedBuild = buildMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert(new RegExp(`^wycena_diag_${escapedBuild}_\\d{8}_\\d{6}\\.txt$`).test(filename), 'Nazwa pliku raportu ma zawierać BUILD modułu i timestamp', filename);

  const index = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  const devTests = fs.readFileSync(path.join(process.cwd(), 'dev_tests.html'), 'utf8');
  const assetPattern = /js\/app\/wycena\/wycena-diagnostics\.js\?v=([^"']+)/;
  const indexAsset = index.match(assetPattern);
  const devAsset = devTests.match(assetPattern);
  assert(indexAsset && indexAsset[1], 'index.html nie ładuje diagnostyki z cache-bustingiem');
  assert(devAsset && devAsset[1], 'dev_tests.html nie ładuje diagnostyki z cache-bustingiem');
  assert(indexAsset[1] === devAsset[1], 'index.html i dev_tests.html muszą ładować tę samą wersję assetu diagnostyki');
  assert(diagSource.includes('Zapisz raport') && !diagSource.includes('Kopiuj raport'), 'Diagnostyka ma zapisywać raport do pliku, bez przycisku kopiowania');
  console.log('[wycena-diagnostics-report-smoke] OK');
}

main().catch((err)=>{
  console.error('[wycena-diagnostics-report-smoke] FAIL:', err && err.message ? err.message : err);
  if(err && err.details) console.error(JSON.stringify(err.details, null, 2));
  process.exit(1);
});
