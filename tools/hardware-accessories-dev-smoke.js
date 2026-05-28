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
    Date, Math, JSON,
    localStorage: makeStorage(),
    sessionStorage: makeStorage(),
    Storage: SmokeStorage,
    document: makeMiniDocument(),
    structuredClone: global.structuredClone || ((x)=> JSON.parse(JSON.stringify(x))),
    crypto: require('crypto').webcrypto,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.FC = {};
  return sandbox;
}

function loadFiles(sandbox, files){
  vm.createContext(sandbox);
  files.forEach((file)=>{
    const code = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    vm.runInContext(code, sandbox, { filename:file });
  });
  return sandbox;
}

function printReport(report){
  const lines = [];
  lines.push(`${report.label}: ${report.passed}/${report.total} OK`);
  lines.push(`Błędy: ${report.failed}`);
  (report.groups || []).forEach((group)=>{
    lines.push('');
    lines.push(`[${group.name}] ${group.passed}/${group.total} OK`);
    (group.results || []).forEach((row)=>{
      lines.push(`- ${row.ok ? 'OK' : 'BŁĄD'}: ${row.name}`);
      if(!row.ok && row.message) lines.push(`  Powód: ${row.message}`);
      if(!row.ok && row.details){
        try{ lines.push(`  Szczegóły: ${JSON.stringify(row.details, null, 2)}`); }
        catch(_){ lines.push(`  Szczegóły: ${String(row.details)}`); }
      }
    });
  });
  console.log(lines.join('\n'));
}

async function main(){
  const sandbox = createSandbox();
  loadFiles(sandbox, APP_DEV_SMOKE_FILES.concat([
    'js/testing/shared/harness.js',
    'js/testing/material/accessories-tests.js',
  ]));
  const FC = sandbox.FC || {};
  if(!(FC.materialAccessoryTests && typeof FC.materialAccessoryTests.collectTests === 'function')){
    throw new Error('Brak FC.materialAccessoryTests.collectTests');
  }
  const tests = FC.materialAccessoryTests.collectTests();
  const report = await FC.testHarness.runSuite('Akcesoria dev smoke', tests);
  printReport(report);
  if(report.failed) process.exitCode = 1;
}

main().catch((error)=>{
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
