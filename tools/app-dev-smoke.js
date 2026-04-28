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

function loadSmokeFiles(sandbox, files){
  vm.createContext(sandbox);
  files.forEach((file)=>{
    const code = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    vm.runInContext(code, sandbox, { filename:file });
  });
  return sandbox;
}

function makeLoadedSandbox(){
  return loadSmokeFiles(createSandbox(), APP_DEV_SMOKE_FILES);
}

function makeSingleGroupReport(label, groupName, tests){
  const started = Date.now();
  const results = tests.map((test)=>{
    try{
      const ok = !!test.check();
      return { group:groupName, name:test.name, explain:test.explain || '', ok, message: ok ? '' : (test.message || 'Warunek smoke nie został spełniony') };
    }catch(error){
      return { group:groupName, name:test.name, explain:test.explain || '', ok:false, message:error && error.message ? error.message : String(error) };
    }
  });
  const passed = results.filter((row)=> row.ok).length;
  const failed = results.length - passed;
  return {
    label,
    total:results.length,
    passed,
    failed,
    durationMs:Date.now() - started,
    groups:[{ name:groupName, total:results.length, passed, failed, results }],
    results,
  };
}

function runProjectNodeSmoke(sandbox){
  const FC = sandbox && sandbox.FC || {};
  return makeSingleGroupReport('PROJECT node smoke testy', 'Projekt ↔ Node smoke', [
    { name:'Project store jest dostępny', check:()=> !!(FC.projectStore && typeof FC.projectStore.readAll === 'function' && typeof FC.projectStore.writeAll === 'function') },
    { name:'Model projektu jest dostępny', check:()=> !!(FC.projectModel && typeof FC.projectModel.normalizeProjectData === 'function') },
    { name:'Bridge projektu jest dostępny', check:()=> !!(FC.project && typeof FC.project === 'object') },
  ]);
}

function runDataNodeSmoke(sandbox){
  const FC = sandbox && sandbox.FC || {};
  return makeSingleGroupReport('DATA node smoke testy', 'Dane ↔ Node smoke', [
    { name:'Storage facade jest dostępna', check:()=> !!(FC.storage && typeof FC.storage.getJSON === 'function' && typeof FC.storage.setJSON === 'function') },
    { name:'Backup store jest dostępny', check:()=> !!(FC.dataBackupStore && typeof FC.dataBackupStore.listBackups === 'function') },
    { name:'Audyt storage jest dostępny', check:()=> !!(FC.dataStorageAudit && typeof FC.dataStorageAudit.buildReport === 'function') },
  ]);
}

function runRysunekNodeSmoke(sandbox){
  const FC = sandbox && sandbox.FC || {};
  return makeSingleGroupReport('RYSUNEK node smoke testy', 'Rysunek ↔ Node smoke', [
    { name:'Zakładka RYSUNEK jest załadowana', check:()=> !!(FC.tabsRysunek && typeof FC.tabsRysunek.renderDrawingTab === 'function') },
    { name:'Testy RYSUNKU są zarejestrowane', check:()=> !!(FC.rysunekDevTests && typeof FC.rysunekDevTests.runAll === 'function') },
    { name:'Layout state jest dostępny dla RYSUNKU', check:()=> !!(FC.layoutState && typeof FC.layoutState.getActiveSegment === 'function') },
  ]);
}

function runInvestorNodeSmoke(sandbox){
  const FC = sandbox && sandbox.FC || {};
  return makeSingleGroupReport('INWESTOR node smoke testy', 'Inwestor ↔ Node smoke', [
    { name:'Investors store jest dostępny', check:()=> !!(FC.investors && typeof FC.investors.readAll === 'function' && typeof FC.investors.writeAll === 'function') },
    { name:'Persistence inwestora jest dostępne', check:()=> !!(FC.investorPersistence && typeof FC.investorPersistence.saveInvestorPatch === 'function') },
    { name:'Room registry jest dostępne', check:()=> !!(FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomDefs === 'function') },
  ]);
}

function runMaterialNodeSmoke(sandbox){
  const FC = sandbox && sandbox.FC || {};
  return makeSingleGroupReport('MATERIAŁ node smoke testy', 'Materiał ↔ Node smoke', [
    { name:'Material registry jest dostępny', check:()=> !!(FC.materialRegistry && typeof FC.materialRegistry.getManufacturersByKind === 'function') },
    { name:'Edge store jest dostępny', check:()=> !!(FC.materialEdgeStore && typeof FC.materialEdgeStore.createEdgeStore === 'function') },
    { name:'Price modal API jest dostępne', check:()=> !!(FC.priceModal && typeof FC.priceModal.renderPriceModal === 'function') },
  ]);
}

function runWycenaNodeSmoke(sandbox){
  const FC = sandbox && sandbox.FC || {};
  return makeSingleGroupReport('WYCENA node smoke testy', 'Wycena ↔ Node smoke', [
    { name:'Publiczne API Wyceny jest dostępne', explain:'Szybki kontrakt dla app-dev-smoke bez uruchamiania ciężkich regresji statusów w Node.', check:()=> !!(FC.wycenaCore && FC.quoteSnapshotScope && FC.quoteSnapshotStore && FC.projectStatusSync && FC.wycenaTabDebug) },
    { name:'Moduły renderu Wyceny są wydzielone', explain:'Pilnuje splitu tabs/wycena.js → dom/status-actions/preview/shell.', check:()=> !!(FC.wycenaTabPreview && typeof FC.wycenaTabPreview.renderPreview === 'function') && !!(FC.wycenaTabShell && typeof FC.wycenaTabShell.render === 'function') && !!(FC.wycenaTabStatusActions && typeof FC.wycenaTabStatusActions.acceptSnapshot === 'function') },
    { name:'Podstawowe fasady historii i statusów istnieją', explain:'Chroni wejścia używane przez render zakładki WYCENA po splicie.', check:()=> typeof FC.quoteSnapshotStore.listForProject === 'function' && typeof FC.projectStatusSync.resolveCurrentProjectStatus === 'function' },
  ]);
}

function runCabinetNodeSmoke(sandbox){
  const FC = sandbox && sandbox.FC || {};
  return makeSingleGroupReport('SZAFKI node smoke testy', 'Szafki ↔ Node smoke', [
    { name:'Publiczne API szafek jest dostępne', explain:'Szybki kontrakt dla app-dev-smoke bez uruchamiania ciężkich testów modalowego DOM w Node.', check:()=> !!(FC.cabinetModal && FC.cabinetActions && FC.cabinetFronts) },
    { name:'Moduły modalowe szafek są załadowane', explain:'Chroni podstawowe wejścia używane przez modal szafki po splitach.', check:()=> !!(FC.cabinetModalDraft && FC.cabinetModalFields && FC.cabinetModalFinalize) },
    { name:'Hardware frontów jest załadowany', explain:'Chroni kalkulatory i katalogi używane przy frontach/podnośnikach.', check:()=> !!(FC.frontHardware && FC.frontHardwareAventosCalc && FC.frontHardwareAventosData && FC.frontHardwareAventosSelector) },
  ]);
}

function runServiceNodeSmoke(sandbox){
  const FC = sandbox && sandbox.FC || {};
  return makeSingleGroupReport('USŁUGI node smoke testy', 'Usługi ↔ Node smoke', [
    { name:'Service order store jest dostępny', check:()=> !!(FC.serviceOrderStore && typeof FC.serviceOrderStore.readAll === 'function') },
    { name:'Service orders API jest dostępne', check:()=> !!(FC.serviceOrders && typeof FC.serviceOrders.openEditor === 'function') },
    { name:'Cutting service API jest dostępne', check:()=> !!(FC.serviceCuttingCommon && FC.serviceCuttingRozrys) },
  ]);
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

async function runFreshReport(run){
  const sandbox = makeLoadedSandbox();
  return run(sandbox);
}

async function runAppDevSmoke(){
  const sandbox = makeLoadedSandbox();
  const reports = [
    runProjectNodeSmoke(sandbox),
    runDataNodeSmoke(sandbox),
    runRysunekNodeSmoke(sandbox),
    runInvestorNodeSmoke(sandbox),
    runMaterialNodeSmoke(sandbox),
    runWycenaNodeSmoke(sandbox),
    runCabinetNodeSmoke(sandbox),
    runServiceNodeSmoke(sandbox),
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

module.exports = {
  createSandbox, loadSmokeFiles, makeLoadedSandbox, mergeReports, runFreshReport, runAppDevSmoke,
  runProjectNodeSmoke, runDataNodeSmoke, runRysunekNodeSmoke, runInvestorNodeSmoke, runMaterialNodeSmoke,
  runWycenaNodeSmoke, runCabinetNodeSmoke, runServiceNodeSmoke,
};
