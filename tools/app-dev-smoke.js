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
  'js/app/ui/tabs-router.js',
  'js/app/ui/work-mode-hub.js',
  'js/app/service/service-orders.js',
  'js/app/service/cutting/service-cutting-common.js',
  'js/app/service/cutting/service-cutting-rozrys.js',
  'js/app/service/cutting/service-order-detail.js',
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
  'js/app/quote/quote-offer-store.js',
  'js/app/quote/quote-snapshot-store.js',
  'js/app/quote/quote-scope-entry.js',
  'js/app/project/project-status-sync.js',
  'js/app/project/project-status-manual-guard.js',
  'js/app/rozrys/rozrys-choice.js',
  'js/app/rozrys/rozrys-prefs.js',
  'js/app/rozrys/rozrys-project-source.js',
  'js/app/rozrys/rozrys-part-helpers.js',
  'js/app/rozrys/rozrys-runtime-utils.js',
  'js/app/rozrys/rozrys-plan-helpers.js',
  'js/app/rozrys/rozrys-engine-bridge.js',
  'js/app/rozrys/rozrys-ui-tools.js',
  'js/app/rozrys/rozrys-ui-bridge.js',
  'js/app/rozrys/rozrys-panel-workspace.js',
  'js/app/rozrys/rozrys-runtime-bundle.js',
  'js/app/rozrys/rozrys-controller-bridges.js',
  'js/app/rozrys/rozrys-run-controller.js',
  'js/app/rozrys/rozrys-output-controller.js',
  'js/app.js',
  'js/app/quote/quote-snapshot.js',
  'js/app/quote/quote-pdf.js',
  'js/app/wycena/wycena-core.js',
  'js/app/wycena/wycena-tab-helpers.js',
  'js/app/wycena/wycena-tab-selection.js',
  'js/app/wycena/wycena-tab-editor.js',
  'js/app/wycena/wycena-tab-scroll.js',
  'js/app/wycena/wycena-tab-history.js',
  'js/app/wycena/wycena-tab-status-bridge.js',
  'js/tabs/wycena.js',
  'js/app/optimizer/cut-optimizer.js',
  'js/app/rozrys/rozrys-engine.js',
  'js/app/rozrys/rozrys-stock.js',
  'js/app/rozrys/rozrys-scope.js',
  'js/app/rozrys/rozrys.js',
  'js/app/rozrys/rozrys-state.js',
  'js/app/cabinet/cabinet-cutlist.js',
  'js/app/cabinet/cabinet-fronts.js',
  'js/app/cabinet/cabinet-modal-validation.js',
  'js/app/cabinet/cabinet-modal-draft.js',
  'js/app/cabinet/cabinet-modal-fields.js',
  'js/app/cabinet/cabinet-modal-finalize.js',
  'js/app/cabinet/cabinet-modal-set-wizard.js',
  'js/app/cabinet/cabinet-modal-standing-corner-standard.js',
  'js/app/cabinet/cabinet-modal-standing-specials.js',
  'js/app/cabinet/cabinet-modal-standing-extras.js',
  'js/app/cabinet/cabinet-modal-standing-front-controls.js',
  'js/app/cabinet/cabinet-modal-standing.js',
  'js/app/cabinet/cabinet-modal-hanging.js',
  'js/app/cabinet/cabinet-modal-module.js',
  'js/app/cabinet/cabinet-choice-launchers.js',
  'js/app/cabinet/cabinet-modal.js',
  'js/app/cabinet/cabinet-actions.js',
  'js/testing/shared/harness.js',
  'js/testing/test-data-manager.js',
  'js/testing/project/tests.js',
  'js/testing/investor/tests.js',
  'js/testing/wycena/fixtures.js',
  'js/testing/wycena/suites/core-offer-basics.js',
  'js/testing/wycena/suites/core-offer-workflow.js',
  'js/testing/wycena/suites/central-status-sync.js',
  'js/testing/wycena/suites/scope-entry.js',
  'js/testing/wycena/suites/investor-integration.js',
  'js/testing/wycena/suites/cross-systems.js',
  'js/testing/wycena/suites/status-anti-regression.js',
  'js/testing/wycena/tests.js',
  'js/testing/material/tests.js',
  'js/testing/cabinet/tests.js',
  'js/testing/service/tests.js',
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

(async ()=>{
  const reports = [
    await sandbox.FC.projectDevTests.runAll(),
    await sandbox.FC.investorDevTests.runAll(),
    await sandbox.FC.materialDevTests.runAll(),
    await sandbox.FC.wycenaDevTests.runAll(),
    await sandbox.FC.cabinetDevTests.runAll(),
    await sandbox.FC.serviceDevTests.runAll(),
  ];
  const final = mergeReports(reports);
  const text = sandbox.FC.testHarness.makeClipboardReport(final);
  console.log(text);
  if(final.failed > 0) process.exit(1);
})().catch((error)=>{
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(2);
});
