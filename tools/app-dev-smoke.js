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

function loadSmokeFiles(sandbox, files){
  vm.createContext(sandbox);
  files.forEach((file)=>{
    const code = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    vm.runInContext(code, sandbox, { filename:file });
  });
  return sandbox;
}

function mergeReports(reports){
  const out = { label:'APP smoke testy', total:0, passed:0, failed:0, durationMs:0, groups:[] };
  reports.forEach((report)=>{
    if(!report) return;
    out.total += report.total || 0;
    out.passed += report.passed || 0;
    out.failed += report.failed || 0;
    out.durationMs += report.durationMs || 0;
    (report.groups || []).forEach((group)=> out.groups.push(group));
  });
  return out;
}

async function runAppDevSmoke(){
  const sandbox = loadSmokeFiles(createSandbox(), APP_DEV_SMOKE_FILES);
  const smokeDocument = sandbox.document;
  sandbox.document = smokeDocument;
  const projectReport = await sandbox.FC.projectDevTests.runAll();
  const dataReport = await sandbox.FC.dataSafetyDevTests.runAll();
  const rysunekReport = await sandbox.FC.rysunekDevTests.runAll();
  sandbox.document = undefined;
  const reports = [
    projectReport,
    dataReport,
    rysunekReport,
    await sandbox.FC.investorDevTests.runAll(),
    await sandbox.FC.materialDevTests.runAll(),
    await sandbox.FC.wycenaDevTests.runAll(),
    await sandbox.FC.cabinetDevTests.runAll(),
    await sandbox.FC.serviceDevTests.runAll(),
  ];
  const final = mergeReports(reports);
  const text = sandbox.FC.testHarness.makeClipboardReport(final);
  return { final, text };
}

if(require.main === module){
  runAppDevSmoke().then(({ final, text })=>{
    console.log(text);
    process.exit(final.failed > 0 ? 1 : 0);
  }).catch((error)=>{
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(2);
  });
}

module.exports = { createSandbox, loadSmokeFiles, mergeReports, runAppDevSmoke };
