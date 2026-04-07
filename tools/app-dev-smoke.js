const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILES = [
  'js/app/shared/utils.js',
  'js/app/shared/constants.js',
  'js/app/shared/storage.js',
  'js/app/shared/schema.js',
  'js/app/project/project-model.js',
  'js/app/project/project-store.js',
  'js/app/project/project-bridge.js',
  'js/app/shared/validate.js',
  'js/app/material/material-common.js',
  'js/app/material/material-registry.js',
  'js/app/catalog/catalog-domain.js',
  'js/app/catalog/catalog-migration.js',
  'js/app/service/service-order-store.js',
  'js/app/catalog/catalog-store.js',
  'js/app/catalog/catalog-selectors.js',
  'js/app/material/price-modal.js',
  'js/app/ui/work-mode-hub.js',
  'js/app/service/service-orders.js',
  'js/app/investor/investors-store.js',
  'js/app/investor/investor-persistence.js',
  'js/app/investor/investor-navigation-guard.js',
  'js/app/investor/investor-pdf.js',
  'js/app/investor/investor-field-render.js',
  'js/app/investor/investor-actions.js',
  'js/app/shared/room-registry.js',
  'js/app/investor/investor-room-actions.js',
  'js/app/investor/investor-editor-state.js',
  'js/app/investor/project-bootstrap.js',
  'js/app/quote/quote-snapshot.js',
  'js/app/wycena/wycena-core.js',
  'js/app/rozrys/rozrys-stock.js',
  'js/app/rozrys/rozrys-state.js',
  'js/app/cabinet/cabinet-cutlist.js',
  'js/testing/shared/harness.js',
  'js/testing/project/tests.js',
  'js/testing/investor/tests.js',
  'js/testing/wycena/tests.js',
  'js/testing/material/tests.js',
  'js/testing/cabinet/tests.js',
];

function makeStorage(){
  const data = new Map();
  return {
    getItem(key){ return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value){ data.set(String(key), String(value)); },
    removeItem(key){ data.delete(String(key)); },
    clear(){ data.clear(); },
  };
}

const sandbox = {
  console,
  setTimeout, clearTimeout,
  Date, Math, JSON,
  localStorage: makeStorage(),
  structuredClone: global.structuredClone || ((x)=> JSON.parse(JSON.stringify(x))),
  crypto: require('crypto').webcrypto,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.FC = {};
vm.createContext(sandbox);

FILES.forEach((file)=>{
  const code = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  vm.runInContext(code, sandbox, { filename:file });
});

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

const reports = [
  sandbox.FC.projectDevTests.runAll(),
  sandbox.FC.investorDevTests.runAll(),
  sandbox.FC.materialDevTests.runAll(),
  sandbox.FC.wycenaDevTests.runAll(),
  sandbox.FC.cabinetDevTests.runAll(),
];
const final = mergeReports(reports);
const text = sandbox.FC.testHarness.makeClipboardReport(final);
console.log(text);
if(final.failed > 0) process.exit(1);
