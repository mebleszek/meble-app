// js/app/catalog/hardware-catalog-import-export.js
// Fasada importu/eksportu katalogu okuć. Właściwe odpowiedzialności są w modułach export/import-parser/import-plan.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const exporter = FC.hardwareCatalogExportXlsx || {};
  const parser = FC.hardwareCatalogImportParser || {};
  const planner = FC.hardwareCatalogImportPlan || {};

  FC.hardwareCatalogImportExport = {
    KIND:exporter.KIND || 'meble-app.hardware-catalog.export',
    VERSION:exporter.VERSION || 8,
    ACCESSORY_COLUMNS:exporter.ACCESSORY_COLUMNS || [],
    SUPPLIER_COLUMNS:exporter.SUPPLIER_COLUMNS || [],
    BUNDLE_COLUMNS:exporter.BUNDLE_COLUMNS || [],
    getSnapshot:exporter.getSnapshot,
    makeExportPayload:exporter.makeExportPayload,
    exportJson:exporter.exportJson,
    exportXlsx:exporter.exportXlsx,
    parseFile:parser.parseFile,
    parseWorkbook:parser.parseWorkbook,
    parseJson:parser.parseJson,
    buildImportPlan:planner.buildImportPlan,
    applyImportPlan:planner.applyImportPlan,
    findRequiredGaps:planner.findRequiredGaps,
    getRequiredChoiceOptions:planner.getRequiredChoiceOptions,
    _debug:Object.assign({}, exporter._debug || {}, parser._debug || {}, planner._debug || {})
  };
})();
