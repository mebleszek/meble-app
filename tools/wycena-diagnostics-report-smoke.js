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

  const index = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  const devTests = fs.readFileSync(path.join(process.cwd(), 'dev_tests.html'), 'utf8');
  assert(index.includes('js/app/wycena/wycena-diagnostics.js?v=20260610_labor_conditions_editor_preview_v1'), 'index.html nie ładuje diagnostyki z cache-bustingiem');
  assert(devTests.includes('js/app/wycena/wycena-diagnostics.js?v=20260610_labor_conditions_editor_preview_v1'), 'dev_tests.html nie ładuje diagnostyki z cache-bustingiem');
  console.log('[wycena-diagnostics-report-smoke] OK');
}

main().catch((err)=>{
  console.error('[wycena-diagnostics-report-smoke] FAIL:', err && err.message ? err.message : err);
  if(err && err.details) console.error(JSON.stringify(err.details, null, 2));
  process.exit(1);
});
