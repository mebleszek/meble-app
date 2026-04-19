(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function createApi(deps){
    deps = deps || {};
    const apiFC = deps.FC || FC;
    const controls = deps.controls || {};
    const unitSel = controls.unitSel || { value:'cm' };
    const materials = Array.isArray(deps.materials) ? deps.materials : [];
    const computePlan = typeof deps.computePlan === 'function' ? deps.computePlan : (()=> ({ sheets:[] }));
    const computePlanPanelProAsync = typeof deps.computePlanPanelProAsync === 'function' ? deps.computePlanPanelProAsync : null;
    const isPartRotationAllowed = typeof deps.isPartRotationAllowed === 'function' ? deps.isPartRotationAllowed : (()=> true);
    const partSignature = typeof deps.partSignature === 'function' ? deps.partSignature : ((part)=> `${part && part.material || ''}||${part && part.name || ''}||${part && part.w || 0}x${part && part.h || 0}`);
    const loadEdgeStore = typeof deps.loadEdgeStore === 'function' ? deps.loadEdgeStore : (()=> ({}));
    const tryAutoRenderFromCache = typeof deps.tryAutoRenderFromCache === 'function' ? deps.tryAutoRenderFromCache : (()=> false);
    const askRozrysConfirm = typeof deps.askRozrysConfirm === 'function' ? deps.askRozrysConfirm : (()=> Promise.resolve(false));
    const openRozrysInfo = typeof deps.openRozrysInfo === 'function' ? deps.openRozrysInfo : (()=> {});
    const setMaterialGrainExceptions = typeof deps.setMaterialGrainExceptions === 'function' ? deps.setMaterialGrainExceptions : (()=> {});
    const getMaterialGrainEnabled = typeof deps.getMaterialGrainEnabled === 'function' ? deps.getMaterialGrainEnabled : (()=> true);
    const getMaterialGrainExceptions = typeof deps.getMaterialGrainExceptions === 'function' ? deps.getMaterialGrainExceptions : (()=> ({}));
    const materialPartDirectionLabel = typeof deps.materialPartDirectionLabel === 'function' ? deps.materialPartDirectionLabel : (()=> 'Domyślny z materiału');
    const mmToUnitStr = typeof deps.mmToUnitStr === 'function' ? deps.mmToUnitStr : ((mm)=> String(Math.round(Number(mm) || 0)));
    const h = typeof deps.h === 'function' ? deps.h : null;

    function getRealHalfStockForMaterial(material, fullWmm, fullHmm){
      if(apiFC.rozrysStock && typeof apiFC.rozrysStock.getRealHalfStockForMaterial === 'function'){
        return apiFC.rozrysStock.getRealHalfStockForMaterial(material, fullWmm, fullHmm);
      }
      return { qty:0, width:0, height:0 };
    }

    function toMmByUnit(unit, value){
      if(apiFC.rozrysStock && typeof apiFC.rozrysStock.toMmByUnit === 'function'){
        return apiFC.rozrysStock.toMmByUnit(unit, value);
      }
      return 0;
    }

    function fromMmByUnit(unit, valueMm){
      if(apiFC.rozrysStock && typeof apiFC.rozrysStock.fromMmByUnit === 'function'){
        return apiFC.rozrysStock.fromMmByUnit(unit, valueMm);
      }
      return 0;
    }

    function sameSheetFormat(aW, aH, bW, bH){
      if(apiFC.rozrysStock && typeof apiFC.rozrysStock.sameSheetFormat === 'function'){
        return apiFC.rozrysStock.sameSheetFormat(aW, aH, bW, bH);
      }
      return false;
    }

    function getDefaultRozrysOptionValues(unit){
      if(apiFC.rozrysStock && typeof apiFC.rozrysStock.getDefaultRozrysOptionValues === 'function'){
        return apiFC.rozrysStock.getDefaultRozrysOptionValues(unit);
      }
      return { unit:'cm', edge:'0', boardW:280, boardH:207, kerf:0.4, trim:1, minW:0, minH:0 };
    }

    function getSheetRowsForMaterial(material, opts){
      if(apiFC.rozrysStock && typeof apiFC.rozrysStock.getSheetRowsForMaterial === 'function'){
        return apiFC.rozrysStock.getSheetRowsForMaterial(material, opts);
      }
      return [];
    }

    function buildStockSignatureForMaterial(material){
      if(apiFC.rozrysStock && typeof apiFC.rozrysStock.buildStockSignatureForMaterial === 'function'){
        return apiFC.rozrysStock.buildStockSignatureForMaterial(material);
      }
      return '';
    }

    function canPartFitSheet(part, boardWmm, boardHmm, trimMm, allowRotate){
      if(apiFC.rozrysStock && typeof apiFC.rozrysStock.canPartFitSheet === 'function'){
        return apiFC.rozrysStock.canPartFitSheet(part, boardWmm, boardHmm, trimMm, allowRotate);
      }
      return false;
    }

    function filterPartsForSheet(parts, boardWmm, boardHmm, trimMm, grainOn, overrides){
      if(apiFC.rozrysStock && typeof apiFC.rozrysStock.filterPartsForSheet === 'function'){
        return apiFC.rozrysStock.filterPartsForSheet(parts, boardWmm, boardHmm, trimMm, grainOn, overrides, { isPartRotationAllowed });
      }
      return [];
    }

    function getExactSheetStockForMaterial(material, boardWmm, boardHmm){
      if(apiFC.rozrysStock && typeof apiFC.rozrysStock.getExactSheetStockForMaterial === 'function'){
        return apiFC.rozrysStock.getExactSheetStockForMaterial(material, boardWmm, boardHmm);
      }
      return { qty:0, width:Math.round(Number(boardWmm) || 0), height:Math.round(Number(boardHmm) || 0) };
    }

    function getLargestSheetFormatForMaterial(material, fallbackWmm, fallbackHmm){
      if(apiFC.rozrysStock && typeof apiFC.rozrysStock.getLargestSheetFormatForMaterial === 'function'){
        return apiFC.rozrysStock.getLargestSheetFormatForMaterial(material, fallbackWmm, fallbackHmm);
      }
      return { width:Math.round(Number(fallbackWmm) || 0), height:Math.round(Number(fallbackHmm) || 0), qty:0 };
    }

    function clonePlanSheetsWithSupply(sheets, opts){
      if(apiFC.rozrysStock && typeof apiFC.rozrysStock.clonePlanSheetsWithSupply === 'function'){
        return apiFC.rozrysStock.clonePlanSheetsWithSupply(sheets, opts);
      }
      return Array.isArray(sheets) ? sheets.slice() : [];
    }

    function countPlacedPartsByKey(sheets){
      if(apiFC.rozrysStock && typeof apiFC.rozrysStock.countPlacedPartsByKey === 'function'){
        return apiFC.rozrysStock.countPlacedPartsByKey(sheets);
      }
      return new Map();
    }

    function subtractPlacedParts(parts, usedMap){
      if(apiFC.rozrysStock && typeof apiFC.rozrysStock.subtractPlacedParts === 'function'){
        return apiFC.rozrysStock.subtractPlacedParts(parts, usedMap, { partSignature });
      }
      return Array.isArray(parts) ? parts.slice() : [];
    }

    function buildPlanMetaFromState(st){
      if(apiFC.rozrysStock && typeof apiFC.rozrysStock.buildPlanMetaFromState === 'function'){
        return apiFC.rozrysStock.buildPlanMetaFromState(st);
      }
      return { trim:10, boardW:2800, boardH:2070, unit:'mm' };
    }

    async function computePlanWithCurrentEngine(st, parts, panelOpts){
      if(apiFC.rozrysEngine && typeof apiFC.rozrysEngine.computePlanWithCurrentEngine === 'function'){
        return apiFC.rozrysEngine.computePlanWithCurrentEngine(st, parts, panelOpts, {
          computePlan,
          computePlanPanelProAsync,
        });
      }
      return computePlan(st, parts);
    }

    async function applySheetStockLimit(material, st, parts, plan, opts){
      if(apiFC.rozrysStock && typeof apiFC.rozrysStock.applySheetStockLimit === 'function'){
        return apiFC.rozrysStock.applySheetStockLimit(material, st, parts, plan, opts, {
          computePlanWithCurrentEngine,
          partSignature,
          isPartRotationAllowed,
        });
      }
      return plan && typeof plan === 'object' ? plan : { sheets:[] };
    }

    function materialHasGrain(name){
      try{
        return !!(apiFC && typeof apiFC.materialHasGrain === 'function' && apiFC.materialHasGrain(name, materials));
      }catch(_){ return false; }
    }

    function openMaterialGrainExceptions(material, parts){
      if(apiFC.rozrysGrainModal && typeof apiFC.rozrysGrainModal.openMaterialGrainExceptions === 'function'){
        return apiFC.rozrysGrainModal.openMaterialGrainExceptions({
          material,
          parts,
          unitValue: unitSel && unitSel.value,
          h,
          tryAutoRenderFromCache,
        }, {
          askRozrysConfirm,
          openRozrysInfo,
          setMaterialGrainExceptions,
          getMaterialGrainEnabled,
          getMaterialGrainExceptions,
          materialHasGrain,
          partSignature,
          materialPartDirectionLabel,
          mmToUnitStr,
        });
      }
    }

    function loadPlanCache(){
      if(apiFC.rozrysCache && typeof apiFC.rozrysCache.loadPlanCache === 'function'){
        return apiFC.rozrysCache.loadPlanCache();
      }
      return {};
    }

    function savePlanCache(cache){
      if(apiFC.rozrysCache && typeof apiFC.rozrysCache.savePlanCache === 'function'){
        apiFC.rozrysCache.savePlanCache(cache);
      }
    }

    function makePlanCacheKey(st, parts){
      if(apiFC.rozrysCache && typeof apiFC.rozrysCache.makePlanCacheKey === 'function'){
        return apiFC.rozrysCache.makePlanCacheKey(st, parts, { partSignature, isPartRotationAllowed, loadEdgeStore });
      }
      return 'plan_fallback';
    }

    return {
      getRealHalfStockForMaterial,
      toMmByUnit,
      fromMmByUnit,
      sameSheetFormat,
      getDefaultRozrysOptionValues,
      getSheetRowsForMaterial,
      buildStockSignatureForMaterial,
      canPartFitSheet,
      filterPartsForSheet,
      getExactSheetStockForMaterial,
      getLargestSheetFormatForMaterial,
      clonePlanSheetsWithSupply,
      countPlacedPartsByKey,
      subtractPlacedParts,
      buildPlanMetaFromState,
      computePlanWithCurrentEngine,
      applySheetStockLimit,
      materialHasGrain,
      openMaterialGrainExceptions,
      loadPlanCache,
      savePlanCache,
      makePlanCacheKey,
    };
  }

  FC.rozrysPlanHelpers = { createApi };
})();
