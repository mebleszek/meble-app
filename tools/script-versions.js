'use strict';
// Exact release dependencies; each script must appear once, with the same version in both entry points.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const DERIVED_VERSION = '20261023_wycena_labor_v1';
const versions = Object.freeze({
  "js/app/shared/data-backup-snapshot-apply.js":"20261031_investor_delete_v2",
  "js/app/investor/investor-actions.js": "20261031_investor_delete_v2",
  "js/app/investor/investor-ui.js": "20261031_investor_delete_v2",
  "js/app/investor/investor-deletion.js": "20261031_investor_delete_v2",
  "js/app/shared/data-storage-classifier.js": "20261031_investor_delete_v2",
  "js/app/investor/investor-ui-render.js": "20261031_investor_delete_v2",
  "js/app/investor/investors-store.js": "20261031_investor_delete_v2",
  "js/app/investor/investors-local-repository.js": "20261031_investor_delete_v2",
  "js/app/ui/actions-register.js": "20261031_investor_delete_v2",
  "js/app/ui/session-navigation.js": "20261031_historical_owner_v1",
  "js/app/project/project-bridge.js": "20261031_historical_owner_v1",
  "js/app/project/project-pcv-policy.js": "20261031_historical_owner_v1",
  "js/app/investor/investor-project-runtime.js": "20261031_historical_owner_v1",
  "js/app/investor/investor-project-patches.js": "20261025_empty_installation_v1",
  "js/app/shared/backup-archive-idb.js": "20261025_archive_lifecycle_v1",
  "js/app/shared/storage-recovery-export.js": "20261025_archive_lifecycle_v1",
  "js/app/ui/storage-recovery-panel.js": "20261025_archive_lifecycle_v1",
  "js/app/ui/info-box.js": "20261025_storage_recovery_repair_v1",

  "js/app/wycena/wycena-summary-details-modal.js": "20261024_session_quota_exact_v1",
  "js/app/ui/session-diagnostics.js": "20261031_historical_owner_v1",
  "js/app/ui/session-diagnostics-readonly.js": "20261031_historical_owner_v1",
  "js/app/pricing/labor-catalog-definitions.js": "20261023_wycena_labor_v1",
  "js/app/pricing/labor-catalog.js": "20261024_wycena_labor_repair_v1",
  "js/app/pricing/work-quantity-sources.js": "20261023_wycena_labor_v1",
  "js/app/material/price-modal-field-help.js": "20261023_wycena_labor_v1",
  "js/app/material/price-modal-item-form.js": "20261023_wycena_labor_v1",
  "js/app/material/price-modal-list.js": "20261023_wycena_labor_v1",
  "js/app/cabinet/cabinet-cutlist.js": "20261023_wycena_labor_v1",
  "js/app/project/project-export-contract.js": "20261023_wycena_labor_v1",
  "js/app/cabinet/cabinet-hardware-requirements.js": "20261023_wycena_labor_v1",
  "js/app/pricing/work-quantity-facts.js": "20261023_wycena_labor_v1",
  "js/app/cabinet/cabinet-derived-facts.js": "20261023_wycena_labor_v1",
  "js/app/cabinet/cabinet-modal-draft.js": "20261023_wycena_labor_v1",
  "js/app/cabinet/cabinet-modal-labor.js": "20261023_wycena_labor_v1",
  "js/app/quote/quote-calculation-register.js": "20261024_session_quota_exact_ci_repair_v1",
  "js/app/quote/quote-snapshot.js": "20261023_wycena_labor_v1",
  "js/app/wycena/wycena-core-selection.js": "20260628_drawer_systems_materials_v1",
  "js/app/wycena/wycena-core-utils.js": "20260628_drawer_systems_materials_v1",
  "js/app/wycena/wycena-core-catalog.js": "20260628_drawer_systems_materials_v1",
  "js/app/wycena/wycena-core-source.js": "20261014_c2_1b2c3a",
  "js/app/wycena/wycena-core-material-plan.js": "20261024_session_quota_exact_ci_repair_v1",
  "js/app/wycena/wycena-core-offer.js": "20261024_session_quota_exact_v1",
  "js/app/wycena/wycena-core-lines.js": "20261024_wycena_labor_repair_v1",
  "js/app/wycena/wycena-core-labor.js": "20261024_wycena_labor_shelf_boundary_v1",
  "js/app/wycena/wycena-core.js": "20261019_project_context",
  "js/app/quote/quote-snapshot-store.js":"20261014_c2_1b2c3b",
  "js/app/wycena/wycena-tab-selection-version.js":"20260628_drawer_systems_materials_v1",
  "js/app/wycena/wycena-diagnostics.js":"20261019_project_context",
  "js/app/wycena/wycena-tab-shell.js":"20261019_quote_performance"
});
function assertHtmlVersions(index, dev){
  for(const [file, expected] of Object.entries(versions)){
    for(const [label, html] of [['index.html',index],['dev_tests.html',dev]]){
      const sources = Array.from(html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi), m=>m[1]);
      const found = sources.filter(src=>src.split('?')[0] === file);
      assert.deepEqual(found,[file+'?v='+expected],label+': exact cache version for '+file);
    }
  }
}
function assertVersions(root, apiVersion){
  assertHtmlVersions(fs.readFileSync(path.join(root,'index.html'),'utf8'),fs.readFileSync(path.join(root,'dev_tests.html'),'utf8'));
  const source = fs.readFileSync(path.join(root,'js/app/cabinet/cabinet-derived-facts.js'),'utf8');
  assert.equal(source.match(/const VERSION = '([^']+)'/)?.[1],DERIVED_VERSION,'derivedFacts source version');
  if(apiVersion !== undefined) assert.equal(apiVersion,DERIVED_VERSION,'derivedFacts API version');
}
module.exports={versions,DERIVED_VERSION,assertVersions,assertHtmlVersions};
