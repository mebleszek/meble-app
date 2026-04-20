(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function createFallbackPlanHelpers(deps){
    const computePlan = typeof deps.computePlan === 'function' ? deps.computePlan : (()=> ({ sheets:[] }));
    return {
      getRealHalfStockForMaterial: ()=> ({ qty:0, width:0, height:0 }),
      toMmByUnit: ()=> 0,
      fromMmByUnit: ()=> 0,
      sameSheetFormat: ()=> false,
      getDefaultRozrysOptionValues: ()=> ({ unit:'cm', edge:'0', boardW:280, boardH:207, kerf:0.4, trim:1, minW:0, minH:0 }),
      getSheetRowsForMaterial: ()=> [],
      buildStockSignatureForMaterial: ()=> '',
      canPartFitSheet: ()=> false,
      filterPartsForSheet: ()=> [],
      getExactSheetStockForMaterial: (material, boardWmm, boardHmm)=> ({ qty:0, width:Math.round(Number(boardWmm)||0), height:Math.round(Number(boardHmm)||0) }),
      getLargestSheetFormatForMaterial: (material, fallbackWmm, fallbackHmm)=> ({ width:Math.round(Number(fallbackWmm)||0), height:Math.round(Number(fallbackHmm)||0), qty:0 }),
      clonePlanSheetsWithSupply: (sheets)=> Array.isArray(sheets) ? sheets.slice() : [],
      countPlacedPartsByKey: ()=> new Map(),
      subtractPlacedParts: (parts)=> Array.isArray(parts) ? parts.slice() : [],
      buildPlanMetaFromState: ()=> ({ trim:10, boardW:2800, boardH:2070, unit:'mm' }),
      computePlanWithCurrentEngine: async (st, parts)=> computePlan(st, parts),
      applySheetStockLimit: async (material, st, parts, plan)=> (plan && typeof plan === 'object') ? plan : { sheets:[] },
      materialHasGrain: ()=> false,
      openMaterialGrainExceptions: ()=> undefined,
      loadPlanCache: ()=> ({}),
      savePlanCache: ()=> undefined,
      makePlanCacheKey: ()=> 'plan_fallback',
    };
  }

  function createFallbackOutputController(ctx){
    return {
      buildEntriesForScope: ()=> [],
      splitMaterialAccordionTitle: (material)=> ({ line1:String(material || 'Materiał'), line2:'' }),
      createMaterialAccordionSection: ()=> {
        const wrap = document.createElement('div');
        const body = document.createElement('div');
        wrap.appendChild(body);
        return { wrap, body, trigger:null, setOpenState:()=>{} };
      },
      renderOutput: (plan, meta, target)=> {
        const tgt = target || ctx.out;
        if(tgt) tgt.innerHTML = '';
        return undefined;
      },
      renderLoadingInto: (target)=> {
        const tgt = target || ctx.out;
        if(tgt) tgt.innerHTML = '';
        return null;
      },
      renderLoading: (text)=> {
        const tgt = ctx.out;
        if(tgt) tgt.innerHTML = '';
        return null;
      },
      renderMaterialAccordionPlans: ()=> false,
      tryAutoRenderFromCache: ()=> {
        const tgt = ctx.out;
        if(tgt) tgt.innerHTML = '';
        const fn = typeof ctx.getSetGenBtnMode === 'function' ? ctx.getSetGenBtnMode() : null;
        if(typeof fn === 'function') fn('idle');
        return false;
      },
    };
  }

  function createFallbackRunController(){
    return {
      progressCtrl:null,
      setGenBtnMode: ()=> undefined,
      requestCancel: ()=> undefined,
      isRozrysRunning: ()=> false,
      getRozrysBtnMode: ()=> 'idle',
      generate: ()=> undefined,
      openAddStockModal: ()=> undefined,
      bindInteractions: ()=> undefined,
      init: ()=> undefined,
    };
  }

  function createApi(baseDeps){
    baseDeps = baseDeps || {};
    const apiFC = baseDeps.FC || FC;

    function createPlanHelpers(deps){
      if(apiFC.rozrysPlanHelpers && typeof apiFC.rozrysPlanHelpers.createApi === 'function'){
        return apiFC.rozrysPlanHelpers.createApi(deps || {});
      }
      return createFallbackPlanHelpers(deps || {});
    }

    function createOutputController(config){
      const ctx = config && config.ctx ? config.ctx : {};
      const deps = config && config.deps ? config.deps : {};
      if(apiFC.rozrysOutputController && typeof apiFC.rozrysOutputController.createApi === 'function'){
        const outputApi = apiFC.rozrysOutputController.createApi({ FC:apiFC });
        if(outputApi && typeof outputApi.createController === 'function') return outputApi.createController(ctx, deps);
      }
      return createFallbackOutputController(ctx);
    }

    function createRunController(config){
      const ctx = config && config.ctx ? config.ctx : {};
      const deps = config && config.deps ? config.deps : {};
      if(apiFC.rozrysRunController && typeof apiFC.rozrysRunController.createApi === 'function'){
        const runApi = apiFC.rozrysRunController.createApi({ FC:apiFC });
        if(runApi && typeof runApi.createController === 'function') return runApi.createController(ctx, deps);
      }
      return createFallbackRunController();
    }

    return {
      createPlanHelpers,
      createOutputController,
      createRunController,
    };
  }

  FC.rozrysRuntimeBundle = { createApi };
})();
