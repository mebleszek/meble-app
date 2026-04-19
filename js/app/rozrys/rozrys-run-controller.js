(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function createFallbackProgressApi(setUiState){
    return {
      controller: null,
      setGenBtnMode(mode){
        try{ if(typeof setUiState === 'function') setUiState({ buttonMode:String(mode || 'idle'), running: mode === 'running' }); }catch(_){ }
      },
      requestCancel(){
        try{ if(typeof setUiState === 'function') setUiState({ running:false }); }catch(_){ }
      },
      isRozrysRunning(){
        try{ if(typeof setUiState === 'function') setUiState({ running:false }); }catch(_){ }
        return false;
      },
      getRozrysBtnMode(){
        return 'idle';
      },
    };
  }

  function createController(ctx, deps){
    const cfg = Object.assign({
      FC,
      statusBox:null,
      statusMain:null,
      statusSub:null,
      statusMeta:null,
      statusProg:null,
      statusProgBar:null,
      genBtn:null,
      addStockBtn:null,
      openOptionsBtnInline:null,
      matSel:null,
      unitSel:null,
      edgeSel:null,
      inW:null,
      inH:null,
      inK:null,
      inTrim:null,
      inMinW:null,
      inMinH:null,
      heurSel:null,
      dirSel:null,
      out:null,
      getAggregate:null,
      setUiState:null,
    }, ctx || {});
    const d = Object.assign({
      createProgressApi:null,
      openAddStockModalBridge:null,
      openOptionsModalBridge:null,
      applyUnitChange:null,
      persistOptionPrefs:null,
      tryAutoRenderFromCache:null,
      normalizeMaterialScopeForAggregate:null,
      decodeMaterialScope:null,
      normalizeCutDirection:null,
      loadPlanCache:null,
      savePlanCache:null,
      materialHasGrain:null,
      getMaterialGrainEnabled:null,
      getMaterialGrainExceptions:null,
      partSignature:null,
      getRealHalfStockForMaterial:null,
      getExactSheetStockForMaterial:null,
      getLargestSheetFormatForMaterial:null,
      buildStockSignatureForMaterial:null,
      makePlanCacheKey:null,
      renderOutput:null,
      formatHeurLabel:null,
      getRozrysScopeMode:null,
      getOptimaxProfilePreset:null,
      speedLabel:null,
      directionLabel:null,
      renderLoadingInto:null,
      computePlanPanelProAsync:null,
      loadEdgeStore:null,
      isPartRotationAllowed:null,
      applySheetStockLimit:null,
      computePlan:null,
      buildEntriesForScope:null,
      getAccordionScopeKey:null,
      getAccordionPref:null,
      createMaterialAccordionSection:null,
      setAccordionPref:null,
      setMaterialGrainEnabled:null,
      tryAutoRenderFromCache:null,
      openMaterialGrainExceptions:null,
      splitMaterialAccordionTitle:null,
      parseLocaleNumber:null,
      openRozrysInfo:null,
      askRozrysConfirm:null,
      createChoiceLauncher:null,
      getSelectOptionLabel:null,
      setChoiceLaunchValue:null,
      openRozrysChoiceOverlay:null,
    }, deps || {});

    const progressApi = (typeof d.createProgressApi === 'function')
      ? d.createProgressApi({
          statusBox: cfg.statusBox,
          statusMain: cfg.statusMain,
          statusSub: cfg.statusSub,
          statusMeta: cfg.statusMeta,
          statusProg: cfg.statusProg,
          statusProgBar: cfg.statusProgBar,
          genBtn: cfg.genBtn,
          setUiState: cfg.setUiState,
        })
      : createFallbackProgressApi(cfg.setUiState);
    const progressCtrl = progressApi && Object.prototype.hasOwnProperty.call(progressApi, 'controller')
      ? progressApi.controller
      : null;

    const setGenBtnMode = (mode)=> progressApi && typeof progressApi.setGenBtnMode === 'function' ? progressApi.setGenBtnMode(mode) : undefined;
    const requestCancel = ()=> progressApi && typeof progressApi.requestCancel === 'function' ? progressApi.requestCancel() : undefined;
    const isRozrysRunning = ()=> progressApi && typeof progressApi.isRozrysRunning === 'function' ? progressApi.isRozrysRunning() : false;
    const getRozrysBtnMode = ()=> progressApi && typeof progressApi.getRozrysBtnMode === 'function' ? progressApi.getRozrysBtnMode() : 'idle';

    async function generate(force){
      if(!(cfg.FC && cfg.FC.rozrysRunner && typeof cfg.FC.rozrysRunner.generate === 'function')) return;
      const aggregate = typeof cfg.getAggregate === 'function' ? cfg.getAggregate() : cfg.agg;
      return cfg.FC.rozrysRunner.generate(force, {
        progressCtrl,
        normalizeMaterialScopeForAggregate: d.normalizeMaterialScopeForAggregate,
        decodeMaterialScope: d.decodeMaterialScope,
        matSelValue: cfg.matSel && cfg.matSel.value,
        agg: aggregate,
        unitValue: cfg.unitSel && cfg.unitSel.value,
        edgeValue: cfg.edgeSel && cfg.edgeSel.value,
        boardWValue: cfg.inW && cfg.inW.value,
        boardHValue: cfg.inH && cfg.inH.value,
        kerfValue: cfg.inK && cfg.inK.value,
        trimValue: cfg.inTrim && cfg.inTrim.value,
        minScrapWValue: cfg.inMinW && cfg.inMinW.value,
        minScrapHValue: cfg.inMinH && cfg.inMinH.value,
        heurValue: cfg.heurSel && cfg.heurSel.value,
        directionValue: cfg.dirSel && cfg.dirSel.value,
        normalizeCutDirection: d.normalizeCutDirection,
        loadPlanCache: d.loadPlanCache,
        savePlanCache: d.savePlanCache,
        materialHasGrain: d.materialHasGrain,
        getMaterialGrainEnabled: d.getMaterialGrainEnabled,
        getMaterialGrainExceptions: d.getMaterialGrainExceptions,
        partSignature: d.partSignature,
        getRealHalfStockForMaterial: d.getRealHalfStockForMaterial,
        getExactSheetStockForMaterial: d.getExactSheetStockForMaterial,
        getLargestSheetFormatForMaterial: d.getLargestSheetFormatForMaterial,
        buildStockSignatureForMaterial: d.buildStockSignatureForMaterial,
        makePlanCacheKey: d.makePlanCacheKey,
        renderOutput: d.renderOutput,
        formatHeurLabel: d.formatHeurLabel,
        getRozrysScopeMode: d.getRozrysScopeMode,
        getOptimaxProfilePreset: d.getOptimaxProfilePreset,
        speedLabel: d.speedLabel,
        directionLabel: d.directionLabel,
        renderLoadingInto: d.renderLoadingInto,
        computePlanPanelProAsync: d.computePlanPanelProAsync,
        loadEdgeStore: d.loadEdgeStore,
        isPartRotationAllowed: d.isPartRotationAllowed,
        applySheetStockLimit: d.applySheetStockLimit,
        computePlan: d.computePlan,
        out: cfg.out,
        buildEntriesForScope: d.buildEntriesForScope,
        getAccordionScopeKey: d.getAccordionScopeKey,
        getAccordionPref: d.getAccordionPref,
        createMaterialAccordionSection: d.createMaterialAccordionSection,
        setAccordionPref: d.setAccordionPref,
        setMaterialGrainEnabled: d.setMaterialGrainEnabled,
        tryAutoRenderFromCache: d.tryAutoRenderFromCache,
        openMaterialGrainExceptions: d.openMaterialGrainExceptions,
      });
    }

    function openAddStockModal(){
      if(typeof d.openAddStockModalBridge !== 'function') return undefined;
      const aggregate = typeof cfg.getAggregate === 'function' ? cfg.getAggregate() : cfg.agg;
      return d.openAddStockModalBridge({
        agg: aggregate,
        matSelValue: cfg.matSel && cfg.matSel.value,
        unitValue: cfg.unitSel && cfg.unitSel.value,
        boardWValue: cfg.inW && cfg.inW.value,
        boardHValue: cfg.inH && cfg.inH.value,
      }, {
        normalizeMaterialScopeForAggregate: d.normalizeMaterialScopeForAggregate,
        decodeMaterialScope: d.decodeMaterialScope,
        splitMaterialAccordionTitle: d.splitMaterialAccordionTitle,
        parseLocaleNumber: d.parseLocaleNumber,
        openRozrysInfo: d.openRozrysInfo,
        askRozrysConfirm: d.askRozrysConfirm,
        createChoiceLauncher: d.createChoiceLauncher,
        getSelectOptionLabel: d.getSelectOptionLabel,
        setChoiceLaunchValue: d.setChoiceLaunchValue,
        openRozrysChoiceOverlay: d.openRozrysChoiceOverlay,
      });
    }



    function openOptionsModal(){
      if(typeof d.openOptionsModalBridge !== 'function') return undefined;
      return d.openOptionsModalBridge({
        unitSel: cfg.unitSel,
        edgeSel: cfg.edgeSel,
        inW: cfg.inW,
        inH: cfg.inH,
        inK: cfg.inK,
        inTrim: cfg.inTrim,
        inMinW: cfg.inMinW,
        inMinH: cfg.inMinH,
      }, {
        h: d.h,
        labelWithInfo: d.labelWithInfo,
        createChoiceLauncher: d.createChoiceLauncher,
        getSelectOptionLabel: d.getSelectOptionLabel,
        setChoiceLaunchValue: d.setChoiceLaunchValue,
        openRozrysChoiceOverlay: d.openRozrysChoiceOverlay,
        askRozrysConfirm: d.askRozrysConfirm,
        parseLocaleNumber: d.parseLocaleNumber,
        getDefaultRozrysOptionValues: d.getDefaultRozrysOptionValues,
        applyUnitChange: d.applyUnitChange,
        persistOptionPrefs: d.persistOptionPrefs,
        tryAutoRenderFromCache: d.tryAutoRenderFromCache,
      });
    }

    let interactionsBound = false;
    function bindInteractions(){
      if(interactionsBound) return;
      interactionsBound = true;
      if(cfg.unitSel && typeof cfg.unitSel.addEventListener === 'function') cfg.unitSel.addEventListener('change', ()=>{
        try{ if(typeof d.applyUnitChange === 'function') d.applyUnitChange(cfg.unitSel.value); }catch(_){ }
        try{ if(typeof d.persistOptionPrefs === 'function') d.persistOptionPrefs(); }catch(_){ }
        try{ if(typeof d.tryAutoRenderFromCache === 'function') d.tryAutoRenderFromCache(); }catch(_){ }
      });
      if(cfg.heurSel && typeof cfg.heurSel.addEventListener === 'function') cfg.heurSel.addEventListener('change', ()=>{ try{ if(typeof d.tryAutoRenderFromCache === 'function') d.tryAutoRenderFromCache(); }catch(_){ } });
      if(cfg.dirSel && typeof cfg.dirSel.addEventListener === 'function') cfg.dirSel.addEventListener('change', ()=>{ try{ if(typeof d.tryAutoRenderFromCache === 'function') d.tryAutoRenderFromCache(); }catch(_){ } });
      if(cfg.openOptionsBtnInline && typeof cfg.openOptionsBtnInline.addEventListener === 'function') cfg.openOptionsBtnInline.addEventListener('click', openOptionsModal);
      if(cfg.inMinW && typeof cfg.inMinW.addEventListener === 'function') cfg.inMinW.addEventListener('change', ()=>{ try{ if(typeof d.persistOptionPrefs === 'function') d.persistOptionPrefs(); }catch(_){ } try{ if(typeof d.tryAutoRenderFromCache === 'function') d.tryAutoRenderFromCache(); }catch(_){ } });
      if(cfg.inMinH && typeof cfg.inMinH.addEventListener === 'function') cfg.inMinH.addEventListener('change', ()=>{ try{ if(typeof d.persistOptionPrefs === 'function') d.persistOptionPrefs(); }catch(_){ } try{ if(typeof d.tryAutoRenderFromCache === 'function') d.tryAutoRenderFromCache(); }catch(_){ } });
      if(cfg.edgeSel && typeof cfg.edgeSel.addEventListener === 'function') cfg.edgeSel.addEventListener('change', ()=>{ try{ if(typeof d.persistOptionPrefs === 'function') d.persistOptionPrefs(); }catch(_){ } try{ if(typeof d.tryAutoRenderFromCache === 'function') d.tryAutoRenderFromCache(); }catch(_){ } });
      if(cfg.addStockBtn && typeof cfg.addStockBtn.addEventListener === 'function') cfg.addStockBtn.addEventListener('click', openAddStockModal);
      if(cfg.genBtn && typeof cfg.genBtn.addEventListener === 'function') cfg.genBtn.addEventListener('click', ()=>{
        if(isRozrysRunning()){
          requestCancel();
          return;
        }
        const force = (getRozrysBtnMode() === 'done');
        generate(force);
      });
      [cfg.inW, cfg.inH].filter(Boolean).forEach((el)=>{
        if(typeof el.addEventListener !== 'function') return;
        el.addEventListener('input', ()=>{ try{ if(typeof d.tryAutoRenderFromCache === 'function') d.tryAutoRenderFromCache(); }catch(_){ } });
        el.addEventListener('change', ()=>{ try{ if(typeof d.tryAutoRenderFromCache === 'function') d.tryAutoRenderFromCache(); }catch(_){ } });
      });
      [cfg.inK, cfg.inTrim].filter(Boolean).forEach((el)=>{
        if(typeof el.addEventListener !== 'function') return;
        el.addEventListener('input', ()=>{ try{ if(typeof d.persistOptionPrefs === 'function') d.persistOptionPrefs(); }catch(_){ } try{ if(typeof d.tryAutoRenderFromCache === 'function') d.tryAutoRenderFromCache(); }catch(_){ } });
        el.addEventListener('change', ()=>{ try{ if(typeof d.persistOptionPrefs === 'function') d.persistOptionPrefs(); }catch(_){ } try{ if(typeof d.tryAutoRenderFromCache === 'function') d.tryAutoRenderFromCache(); }catch(_){ } });
      });
    }

    function init(){
      try{ if(typeof d.persistOptionPrefs === 'function') d.persistOptionPrefs(); }catch(_){ }
      try{ if(typeof d.tryAutoRenderFromCache === 'function') d.tryAutoRenderFromCache(); }catch(_){ }
    }
    return {
      progressCtrl,
      setGenBtnMode,
      requestCancel,
      isRozrysRunning,
      getRozrysBtnMode,
      generate,
      openOptionsModal,
      openAddStockModal,
      bindInteractions,
      init,
    };
  }

  FC.rozrysRunController = {
    createApi(){
      return { createController };
    }
  };
})();
