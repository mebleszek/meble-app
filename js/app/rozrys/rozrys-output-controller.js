(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function createController(ctx, deps){
    const cfg = Object.assign({
      out:null,
      getAggregate:null,
      getMatSelValue:null,
      getBaseState:null,
      setCacheState:null,
      isRozrysRunning:null,
      getSetGenBtnMode:null,
    }, ctx || {});
    const d = Object.assign({
      normalizeMaterialScopeForAggregate:null,
      decodeMaterialScope:null,
      aggregatePartsForProject:null,
      getOrderedMaterialsForSelection:null,
      getGroupPartsForScope:null,
      getAccordionPref:null,
      setAccordionPref:null,
      materialHasGrain:null,
      getMaterialGrainEnabled:null,
      getMaterialGrainExceptions:null,
      setMaterialGrainEnabled:null,
      openMaterialGrainExceptions:null,
      formatHeurLabel:null,
      scheduleSheetCanvasRefresh:null,
      buildRozrysDiagnostics:null,
      validationSummaryLabel:null,
      openValidationListModal:null,
      openSheetListModal:null,
      buildCsv:null,
      downloadText:null,
      openPrintView:null,
      measurePrintHeaderMm:null,
      mmToUnitStr:null,
      drawSheet:null,
      cutOptimizer:null,
      loadPlanCache:null,
      toMmByUnit:null,
      getRealHalfStockForMaterial:null,
      getExactSheetStockForMaterial:null,
      getLargestSheetFormatForMaterial:null,
      partSignature:null,
      buildStockSignatureForMaterial:null,
      makePlanCacheKey:null,
      getAccordionScopeKey:null,
      getRozrysScopeMode:null,
    }, deps || {});

    const api = {};

    api.buildEntriesForScope = function buildEntriesForScope(selection, aggregate){
      if(FC.rozrysRender && typeof FC.rozrysRender.buildEntriesForScope === 'function'){
        return FC.rozrysRender.buildEntriesForScope(selection, aggregate, {
          normalizeMaterialScopeForAggregate: d.normalizeMaterialScopeForAggregate,
          aggregatePartsForProject: d.aggregatePartsForProject,
          getOrderedMaterialsForSelection: d.getOrderedMaterialsForSelection,
          getGroupPartsForScope: d.getGroupPartsForScope,
        });
      }
      return [];
    };

    api.splitMaterialAccordionTitle = function splitMaterialAccordionTitle(material){
      if(FC.rozrysAccordion && typeof FC.rozrysAccordion.splitMaterialAccordionTitle === 'function'){
        return FC.rozrysAccordion.splitMaterialAccordionTitle(material);
      }
      return { line1:String(material || 'Materiał'), line2:'' };
    };

    api.createMaterialAccordionSection = function createMaterialAccordionSection(material, options){
      if(FC.rozrysAccordion && typeof FC.rozrysAccordion.createMaterialAccordionSection === 'function'){
        return FC.rozrysAccordion.createMaterialAccordionSection(material, options, {
          scheduleSheetCanvasRefresh: d.scheduleSheetCanvasRefresh,
        });
      }
      const wrap = document.createElement('div');
      const body = document.createElement('div');
      wrap.appendChild(body);
      return { wrap, body, trigger:null, setOpenState:()=>{} };
    };

    api.renderOutput = function renderOutput(plan, meta, target){
      if(FC.rozrysRender && typeof FC.rozrysRender.renderOutput === 'function'){
        return FC.rozrysRender.renderOutput(plan, meta, {
          target: target || cfg.out,
          out: cfg.out,
          buildRozrysDiagnostics: d.buildRozrysDiagnostics,
          validationSummaryLabel: d.validationSummaryLabel,
          openValidationListModal: d.openValidationListModal,
          openSheetListModal: d.openSheetListModal,
          buildCsv: d.buildCsv,
          downloadText: d.downloadText,
          openPrintView: d.openPrintView,
          measurePrintHeaderMm: d.measurePrintHeaderMm,
          mmToUnitStr: d.mmToUnitStr,
          drawSheet: d.drawSheet,
          cutOptimizer: d.cutOptimizer,
        });
      }
      if(target || cfg.out) (target || cfg.out).innerHTML = '';
      return undefined;
    };

    api.renderLoadingInto = function renderLoadingInto(target, text, subText){
      if(FC.rozrysRender && typeof FC.rozrysRender.renderLoadingInto === 'function'){
        return FC.rozrysRender.renderLoadingInto(target, text, subText, { out: cfg.out });
      }
      const tgt = target || cfg.out;
      if(tgt) tgt.innerHTML = '';
      return null;
    };

    api.renderLoading = function renderLoading(text){
      return api.renderLoadingInto(null, text);
    };

    api.renderMaterialAccordionPlans = function renderMaterialAccordionPlans(scopeKey, scopeMode, entries){
      if(FC.rozrysAccordion && typeof FC.rozrysAccordion.renderMaterialAccordionPlans === 'function'){
        return FC.rozrysAccordion.renderMaterialAccordionPlans(scopeKey, scopeMode, entries, {
          out: cfg.out,
          getAccordionPref: d.getAccordionPref,
          materialHasGrain: d.materialHasGrain,
          getMaterialGrainEnabled: d.getMaterialGrainEnabled,
          setAccordionPref: d.setAccordionPref,
          setMaterialGrainEnabled: d.setMaterialGrainEnabled,
          tryAutoRenderFromCache: api.tryAutoRenderFromCache,
          openMaterialGrainExceptions: d.openMaterialGrainExceptions,
          renderOutput: api.renderOutput,
          formatHeurLabel: d.formatHeurLabel,
          scheduleSheetCanvasRefresh: d.scheduleSheetCanvasRefresh,
        });
      }
      if(cfg.out) cfg.out.innerHTML = '';
      return false;
    };

    api.tryAutoRenderFromCache = function tryAutoRenderFromCache(){
      if(FC.rozrysRender && typeof FC.rozrysRender.tryAutoRenderFromCache === 'function'){
        return FC.rozrysRender.tryAutoRenderFromCache({
          _rozrysRunning: typeof cfg.isRozrysRunning === 'function' ? cfg.isRozrysRunning() : false,
          normalizeMaterialScopeForAggregate: d.normalizeMaterialScopeForAggregate,
          decodeMaterialScope: d.decodeMaterialScope,
          matSelValue: typeof cfg.getMatSelValue === 'function' ? cfg.getMatSelValue() : '',
          agg: typeof cfg.getAggregate === 'function' ? cfg.getAggregate() : { materials:[], groups:{}, selectedRooms:[] },
          buildEntriesForScope: api.buildEntriesForScope,
          out: cfg.out,
          setGenBtnMode: typeof cfg.getSetGenBtnMode === 'function' ? cfg.getSetGenBtnMode() : undefined,
          loadPlanCache: d.loadPlanCache,
          getBaseState: cfg.getBaseState,
          toMmByUnit: d.toMmByUnit,
          getRealHalfStockForMaterial: d.getRealHalfStockForMaterial,
          getExactSheetStockForMaterial: d.getExactSheetStockForMaterial,
          getLargestSheetFormatForMaterial: d.getLargestSheetFormatForMaterial,
          materialHasGrain: d.materialHasGrain,
          getMaterialGrainEnabled: d.getMaterialGrainEnabled,
          getMaterialGrainExceptions: d.getMaterialGrainExceptions,
          partSignature: d.partSignature,
          buildStockSignatureForMaterial: d.buildStockSignatureForMaterial,
          makePlanCacheKey: d.makePlanCacheKey,
          getAccordionScopeKey: d.getAccordionScopeKey,
          getRozrysScopeMode: d.getRozrysScopeMode,
          renderMaterialAccordionPlans: api.renderMaterialAccordionPlans,
          setCacheState: typeof cfg.setCacheState === 'function' ? cfg.setCacheState : undefined,
        });
      }
      if(cfg.out) cfg.out.innerHTML = '';
      const setGenBtnMode = typeof cfg.getSetGenBtnMode === 'function' ? cfg.getSetGenBtnMode() : null;
      if(typeof setGenBtnMode === 'function') setGenBtnMode('idle');
      return false;
    };

    return api;
  }

  FC.rozrysOutputController = {
    createApi(){
      return { createController };
    }
  };
})();
