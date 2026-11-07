'use strict';
// Exact release dependencies; each script must appear once, with the same version in both entry points.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const DERIVED_VERSION = '20261023_wycena_labor_v1';
const versions = Object.freeze({
  "js/app/wycena/wycena-tab-manual-labor.js":"20261106_work_plan_v1",
  "js/app/wycena/wycena-work-plan-view.js":"20261107_pattern_accordions_v1",
  "js/app/pricing/labor-work-plan.js":"20261106_work_plan_v1",
  "js/tabs/czynnosci.js":"20261106_work_plan_v1",
  "js/app/cabinet/cabinet-actions.js":"20261106_local_first_room_actions_v1",
  "js/app/quote/quote-offer-store.js":"20261106_work_plan_v1",
  "js/app/rozrys/rozrys-pickers.js":"20261106_local_first_room_actions_v1",
  "js/app/wycena/wycena-tab-selection-pickers.js":"20261106_local_first_room_actions_v1",
  "js/app/project/project-store.js":"20261104_investor_scope_v1",
  "js/app/cabinet/cabinet-modal-finalize.js":"20261104_cabinet_transaction_v1",
  "js/app/ui/wywiad-room-settings.js":"20261103_local_first_start_v1",
  "js/app/investor/project-autosave.js":"20261103_local_first_start_v1",
  "js/app/investor/investor-room-actions.js":"20261103_local_first_start_v1",
  "js/app/catalog/catalog-store.js":"20261101_production_sync_v1",
  "js/app/material/price-modal-hardware-dictionaries.js":"20261101_one_app_v1",
  "js/app/material/price-modal-hardware-manufacturers.js":"20261101_one_app_v1",
  "js/app/material/price-modal-hardware-suppliers.js":"20261101_one_app_v1",
  "js/app/shared/room-registry-modals-add-edit.js":"20261101_one_app_v1",
  "js/app/ui/data-settings-business-costs-view.js":"20261101_one_app_v1",
  "js/app/ui/data-settings-company-view.js":"20261101_one_app_v1",
  "js/app/ui/data-settings-defaults-view.js":"20261101_one_app_v1",
  "js/core/actions.js":"20261101_one_app_v1",
 "js/app/cloud/offline-update.js":"20261031_safe_sw_v1",
  "js/app/shared/data-backup-snapshot-apply.js":"20261031_investor_delete_v2",
  "js/app/investor/investor-actions.js": "20261104_investor_scope_v1",
  "js/app/investor/investor-ui.js": "20261031_investor_delete_v2",
  "js/app/investor/investor-deletion.js": "20261031_investor_delete_v2",
  "js/app/shared/data-storage-classifier.js": "20261031_investor_delete_v2",
  "js/app/investor/investor-ui-render.js": "20261101_compact_list",
  "js/app/investor/investors-store.js": "20261104_investor_scope_v1",
  "js/app/investor/investors-local-repository.js": "20261104_investor_scope_v1",
  "js/app/ui/actions-register.js": "20261101_one_app_v1",
  "js/app/ui/session-navigation.js": "20261031_historical_owner_v1",
  "js/app/project/project-bridge.js": "20261031_historical_owner_v1",
  "js/app/project/project-pcv-policy.js": "20261031_historical_owner_v1",
  "js/app/investor/investor-project-runtime.js": "20261031_historical_owner_v1",
  "js/app/investor/investor-project-patches.js": "20261025_empty_installation_v1",
  "js/app/shared/backup-archive-idb.js": "20261025_archive_lifecycle_v1",
  "js/app/shared/storage-recovery-export.js": "20261103_android_globals_recovery_v1",
  "js/app/settings/company-profile-store.js": "20261102_neutral_code_rebuild_v1",
  "js/app/ui/storage-recovery-panel.js": "20261103_android_globals_recovery_v1",
  "js/app/ui/info-box.js": "20261025_storage_recovery_repair_v1",

  "js/app/wycena/wycena-summary-details-modal.js": "20261024_session_quota_exact_v1",
  "js/app/ui/session-diagnostics.js": "20261102_global_diagnostics_v1",
  "js/app/ui/session-diagnostics-readonly.js": "20261102_global_diagnostics_v1",
  "js/app/pricing/labor-catalog-definitions.js": "20261106_work_plan_v1",
  "js/app/pricing/labor-catalog.js": "20261106_work_plan_v1",
  "js/app/pricing/work-quantity-sources.js": "20261105_pdf_labor_v1",
  "js/app/material/price-modal-field-help.js": "20261023_wycena_labor_v1",
  "js/app/material/price-modal-item-form.js": "20261106_work_plan_v1",
  "js/app/material/price-modal-list.js": "20261023_wycena_labor_v1",
  "js/app/cabinet/cabinet-cutlist.js": "20261023_wycena_labor_v1",
  "js/app/project/project-export-contract.js": "20261023_wycena_labor_v1",
  "js/app/cabinet/cabinet-hardware-requirements.js": "20261023_wycena_labor_v1",
  "js/app/pricing/work-quantity-facts.js": "20261105_pdf_labor_v1",
  "js/app/cabinet/cabinet-derived-facts.js": "20261023_wycena_labor_v1",
  "js/app/cabinet/cabinet-modal-draft.js": "20261023_wycena_labor_v1",
  "js/app/cabinet/cabinet-modal-labor.js": "20261023_wycena_labor_v1",
  "js/app/quote/quote-calculation-register.js": "20261106_work_plan_v1",
  "js/app/quote/quote-snapshot.js": "20261106_work_plan_v1",
  "js/app/wycena/wycena-core-selection.js": "20260628_drawer_systems_materials_v1",
  "js/app/wycena/wycena-core-utils.js": "20260628_drawer_systems_materials_v1",
  "js/app/wycena/wycena-core-catalog.js": "20260628_drawer_systems_materials_v1",
  "js/app/wycena/wycena-core-source.js": "20261014_c2_1b2c3a",
  "js/app/wycena/wycena-core-material-plan.js": "20261024_session_quota_exact_ci_repair_v1",
  "js/app/wycena/wycena-core-offer.js": "20261106_work_plan_v1",
  "js/app/wycena/wycena-core-lines.js": "20261105_pdf_labor_v1",
  "js/app/wycena/wycena-core-labor.js": "20261106_work_plan_v1",
  "js/app/wycena/wycena-core.js": "20261106_work_plan_v1",
  "js/app/quote/quote-snapshot-store.js":"20261106_work_plan_v1",
  "js/app/wycena/wycena-tab-selection-version.js":"20260628_drawer_systems_materials_v1",
  "js/app/wycena/wycena-diagnostics.js":"20261019_project_context",
  "js/app/wycena/wycena-tab-shell.js":"20261106_work_plan_v1"
});
const authVersions=Object.freeze({
  "js/app/cloud/offline-shell.js": "20261103_local_first_start_v1",
  "js/app/cloud/local-access-profile.js": "20261103_android_globals_recovery_v1",
  "js/app/cloud/application-bootstrap.js": "20261103_local_first_start_v1",
  "js/main-login.js": "20261103_local_first_start_v1"
});
function assertHtmlVersions(index, dev){
  const sources=Array.from(index.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi),m=>m[1]);
  for(const [file,version]of Object.entries(authVersions))assert.deepEqual(sources.filter(src=>src.split("?")[0]===file),[file+"?v="+version],"Exact Auth entry version");
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
module.exports={authVersions,versions,DERIVED_VERSION,assertVersions,assertHtmlVersions};
