// js/app/catalog/hardware-catalog-supplier-price-xlsx.js
// Cienka fasada arkusza `Ceny_dostawcow`. Parser/import i eksport są rozdzielone na osobne moduły.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const exporter = FC.hardwareSupplierPriceExport || {};
  const importer = FC.hardwareSupplierPriceImport || {};

  FC.hardwareSupplierPriceXlsx = {
    SUPPLIER_PRICE_COLUMNS:exporter.SUPPLIER_PRICE_COLUMNS || importer.SUPPLIER_PRICE_COLUMNS || [],
    buildSupplierPriceRows:exporter.buildSupplierPriceRows,
    supplierPriceValidations:exporter.supplierPriceValidations,
    parseSupplierPriceRow:importer.parseSupplierPriceRow,
    hasSupplierPriceData:importer.hasSupplierPriceData,
    applySupplierPriceRows:importer.applySupplierPriceRows,
    createAccessoriesFromSupplierPriceRows:importer.createAccessoriesFromSupplierPriceRows,
    supplierPriceCreateRequiredGaps:importer.supplierPriceCreateRequiredGaps,
    supplierPriceMissingSupplierGaps:importer.supplierPriceMissingSupplierGaps,
    _debug:Object.assign({}, exporter._debug || {}, importer._debug || {})
  };
})();
