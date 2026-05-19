(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function clone(value){
    try{ return (FC.utils && typeof FC.utils.clone === 'function') ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }

  function defaultSplitter(list){
    const rows = Array.isArray(list) ? list : [];
    const out = { sheetMaterials:[], accessories:[] };
    rows.forEach((row)=>{
      const src = row && typeof row === 'object' ? row : {};
      const materialType = String(src.materialType || '').trim().toLowerCase();
      if(materialType === 'akcesoria' || materialType === 'accessories' || materialType === 'akcesorium'){
        const accessory = Object.assign({}, src);
        delete accessory.materialType;
        delete accessory.hasGrain;
        out.accessories.push(accessory);
      }else{
        out.sheetMaterials.push(src);
      }
    });
    return out;
  }

  function buildSeeds(opts){
    const cfg = Object.assign({
      preferStoredSplit:false,
      legacyMaterials:[],
      legacyServices:[],
      storedSheetMaterials:null,
      storedAccessories:null,
      storedQuoteRates:null,
      storedWorkshopServices:null,
      storedServiceOrders:null,
      storedHardwareManufacturers:null,
      storedHardwareSuppliers:null,
      storedHardwareSettings:null,
      storedHardwareCategories:null,
      storedHardwareTypes:null,
      storedHardwareTechnicalParams:null,
      defaults:{ sheetMaterials:[], accessories:[], quoteRates:[], workshopServices:[], serviceOrders:[], hardwareManufacturers:[], hardwareSuppliers:[], hardwareSettings:{}, hardwareCategories:[], hardwareTypes:[], hardwareTechnicalParams:[] },
      splitLegacyMaterials:null,
    }, opts || {});

    const split = typeof cfg.splitLegacyMaterials === 'function'
      ? cfg.splitLegacyMaterials(cfg.legacyMaterials || [])
      : defaultSplitter(cfg.legacyMaterials || []);

    const preferStored = !!cfg.preferStoredSplit;
    return {
      sheetMaterials: preferStored && Array.isArray(cfg.storedSheetMaterials) ? clone(cfg.storedSheetMaterials) : clone(split.sheetMaterials || cfg.defaults.sheetMaterials || []),
      accessories: preferStored && Array.isArray(cfg.storedAccessories) ? clone(cfg.storedAccessories) : clone(split.accessories || cfg.defaults.accessories || []),
      quoteRates: preferStored && Array.isArray(cfg.storedQuoteRates) ? clone(cfg.storedQuoteRates) : clone(cfg.legacyServices || cfg.defaults.quoteRates || []),
      workshopServices: Array.isArray(cfg.storedWorkshopServices) ? clone(cfg.storedWorkshopServices) : clone(cfg.defaults.workshopServices || []),
      serviceOrders: Array.isArray(cfg.storedServiceOrders) ? clone(cfg.storedServiceOrders) : clone(cfg.defaults.serviceOrders || []),
      hardwareManufacturers: Array.isArray(cfg.storedHardwareManufacturers) ? clone(cfg.storedHardwareManufacturers) : clone(cfg.defaults.hardwareManufacturers || []),
      hardwareSuppliers: Array.isArray(cfg.storedHardwareSuppliers) ? clone(cfg.storedHardwareSuppliers) : clone(cfg.defaults.hardwareSuppliers || []),
      hardwareSettings: cfg.storedHardwareSettings && typeof cfg.storedHardwareSettings === 'object' ? clone(cfg.storedHardwareSettings) : clone(cfg.defaults.hardwareSettings || {}),
      hardwareCategories: Array.isArray(cfg.storedHardwareCategories) ? clone(cfg.storedHardwareCategories) : clone(cfg.defaults.hardwareCategories || []),
      hardwareTypes: Array.isArray(cfg.storedHardwareTypes) ? clone(cfg.storedHardwareTypes) : clone(cfg.defaults.hardwareTypes || []),
      hardwareTechnicalParams: Array.isArray(cfg.storedHardwareTechnicalParams) ? clone(cfg.storedHardwareTechnicalParams) : clone(cfg.defaults.hardwareTechnicalParams || []),
    };
  }

  FC.catalogMigration = {
    buildSeeds,
  };
})();
