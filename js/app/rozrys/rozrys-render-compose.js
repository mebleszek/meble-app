(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function buildWorkspaceCtx(config){
    config = config || {};
    return {
      h: config.h,
      labelWithInfo: config.labelWithInfo,
      createChoiceLauncher: config.createChoiceLauncher,
      getSelectOptionLabel: config.getSelectOptionLabel,
      setChoiceLaunchValue: config.setChoiceLaunchValue,
      openRozrysChoiceOverlay: config.openRozrysChoiceOverlay,
      card: config.card,
      state: config.state,
      panelPrefs: config.panelPrefs,
      getSelectedRooms: config.getSelectedRooms,
      getMaterialScope: config.getMaterialScope,
      encodeRoomsSelection: config.encodeRoomsSelection,
      encodeMaterialScope: config.encodeMaterialScope,
      loadPanelPrefs: config.loadPanelPrefs,
      savePanelPrefs: config.savePanelPrefs,
      rozState: config.rozState,
    };
  }

  function buildWorkspaceDeps(config){
    config = config || {};
    return {
      normalizeCutDirection: config.normalizeCutDirection,
    };
  }

  function buildSelectionBridgeConfig(config){
    config = config || {};
    return {
      ctx: {
        h: config.h,
        state: config.state,
        roomsPickerBtn: config.roomsPickerBtn,
        matPickerBtn: config.matPickerBtn,
        roomsPickerValue: config.roomsPickerValue,
        matPickerValue: config.matPickerValue,
        roomsSel: config.roomsSel,
        matSel: config.matSel,
        rozState: config.rozState,
        getRooms: config.getRooms,
        getSelectedRooms: config.getSelectedRooms,
        setSelectedRooms: config.setSelectedRooms,
        getMaterialScope: config.getMaterialScope,
        setMaterialScope: config.setMaterialScope,
        getAggregate: config.getAggregate,
        setAggregate: config.setAggregate,
        tryAutoRenderFromCache: config.tryAutoRenderFromCache,
      },
      deps: {
        scopeApiFallback: config.scopeApi,
        getRooms: config.getRooms,
        aggregatePartsForProject: config.aggregatePartsForProject,
        savePanelPrefs: config.savePanelPrefs,
        loadPanelPrefs: config.loadPanelPrefs,
        encodeRoomsSelection: config.encodeRoomsSelection,
        encodeMaterialScope: config.encodeMaterialScope,
        normalizeMaterialScopeForAggregate: config.normalizeMaterialScopeForAggregate,
        askRozrysConfirm: config.askRozrysConfirm,
        normalizeRoomSelection: config.normalizeRoomSelection,
        roomLabel: config.roomLabel,
        splitMaterialAccordionTitle: config.splitMaterialAccordionTitle,
        makeMaterialScope: config.makeMaterialScope,
      },
    };
  }

  function buildPlanHelpersConfig(config){
    config = config || {};
    return {
      FC: config.FC,
      materials: config.materials,
      controls: { unitSel: config.unitSel },
      computePlan: config.computePlan,
      computePlanPanelProAsync: config.computePlanPanelProAsync,
      isPartRotationAllowed: config.isPartRotationAllowed,
      partSignature: config.partSignature,
      loadEdgeStore: config.loadEdgeStore,
      tryAutoRenderFromCache: config.tryAutoRenderFromCache,
      askRozrysConfirm: config.askRozrysConfirm,
      openRozrysInfo: config.openRozrysInfo,
      setMaterialGrainExceptions: config.setMaterialGrainExceptions,
      getMaterialGrainEnabled: config.getMaterialGrainEnabled,
      getMaterialGrainExceptions: config.getMaterialGrainExceptions,
      materialPartDirectionLabel: config.materialPartDirectionLabel,
      mmToUnitStr: config.mmToUnitStr,
      h: config.h,
    };
  }

  function buildOutputBridgeConfig(config){
    config = config || {};
    return {
      ctx: {
        out: config.out,
        getController: config.getController,
        getSetGenBtnMode: config.getSetGenBtnMode,
      },
    };
  }

  function buildOutputControllerConfig(config){
    config = config || {};
    return {
      ctx: {
        out: config.out,
        getAggregate: config.getAggregate,
        getMatSelValue: config.getMatSelValue,
        getBaseState: config.getBaseState,
        setCacheState: config.setCacheState,
        isRozrysRunning: config.isRozrysRunning,
        getSetGenBtnMode: config.getSetGenBtnMode,
      },
      deps: {
        normalizeMaterialScopeForAggregate: config.normalizeMaterialScopeForAggregate,
        decodeMaterialScope: config.decodeMaterialScope,
        aggregatePartsForProject: config.aggregatePartsForProject,
        getOrderedMaterialsForSelection: config.getOrderedMaterialsForSelection,
        getGroupPartsForScope: config.getGroupPartsForScope,
        getAccordionPref: config.getAccordionPref,
        setAccordionPref: config.setAccordionPref,
        materialHasGrain: config.materialHasGrain,
        getMaterialGrainEnabled: config.getMaterialGrainEnabled,
        getMaterialGrainExceptions: config.getMaterialGrainExceptions,
        setMaterialGrainEnabled: config.setMaterialGrainEnabled,
        openMaterialGrainExceptions: config.openMaterialGrainExceptions,
        formatHeurLabel: config.formatHeurLabel,
        scheduleSheetCanvasRefresh: config.scheduleSheetCanvasRefresh,
        buildRozrysDiagnostics: config.buildRozrysDiagnostics,
        validationSummaryLabel: config.validationSummaryLabel,
        openValidationListModal: config.openValidationListModal,
        openSheetListModal: config.openSheetListModal,
        buildCsv: config.buildCsv,
        downloadText: config.downloadText,
        openPrintView: config.openPrintView,
        measurePrintHeaderMm: config.measurePrintHeaderMm,
        mmToUnitStr: config.mmToUnitStr,
        drawSheet: config.drawSheet,
        cutOptimizer: config.cutOptimizer,
        loadPlanCache: config.loadPlanCache,
        toMmByUnit: config.toMmByUnit,
        getRealHalfStockForMaterial: config.getRealHalfStockForMaterial,
        getExactSheetStockForMaterial: config.getExactSheetStockForMaterial,
        getLargestSheetFormatForMaterial: config.getLargestSheetFormatForMaterial,
        partSignature: config.partSignature,
        buildStockSignatureForMaterial: config.buildStockSignatureForMaterial,
        makePlanCacheKey: config.makePlanCacheKey,
        getAccordionScopeKey: config.getAccordionScopeKey,
        getRozrysScopeMode: config.getRozrysScopeMode,
      },
    };
  }

  function buildRunControllerConfig(config){
    config = config || {};
    return {
      ctx: {
        FC: config.FC,
        statusBox: config.statusBox,
        statusMain: config.statusMain,
        statusSub: config.statusSub,
        statusMeta: config.statusMeta,
        statusProg: config.statusProg,
        statusProgBar: config.statusProgBar,
        genBtn: config.genBtn,
        addStockBtn: config.addStockBtn,
        openOptionsBtnInline: config.openOptionsBtnInline,
        matSel: config.matSel,
        unitSel: config.unitSel,
        edgeSel: config.edgeSel,
        inW: config.inW,
        inH: config.inH,
        inK: config.inK,
        inTrim: config.inTrim,
        inMinW: config.inMinW,
        inMinH: config.inMinH,
        heurSel: config.heurSel,
        dirSel: config.dirSel,
        out: config.out,
        getAggregate: config.getAggregate,
        setUiState: config.setUiState,
      },
      deps: {
        createProgressApi: config.createProgressApi,
        openAddStockModalBridge: config.openAddStockModalBridge,
        openOptionsModalBridge: config.openOptionsModalBridge,
        applyUnitChange: config.applyUnitChange,
        persistOptionPrefs: config.persistOptionPrefs,
        tryAutoRenderFromCache: config.tryAutoRenderFromCache,
        h: config.h,
        labelWithInfo: config.labelWithInfo,
        getDefaultRozrysOptionValues: config.getDefaultRozrysOptionValues,
        normalizeMaterialScopeForAggregate: config.normalizeMaterialScopeForAggregate,
        decodeMaterialScope: config.decodeMaterialScope,
        normalizeCutDirection: config.normalizeCutDirection,
        loadPlanCache: config.loadPlanCache,
        savePlanCache: config.savePlanCache,
        materialHasGrain: config.materialHasGrain,
        getMaterialGrainEnabled: config.getMaterialGrainEnabled,
        getMaterialGrainExceptions: config.getMaterialGrainExceptions,
        partSignature: config.partSignature,
        getRealHalfStockForMaterial: config.getRealHalfStockForMaterial,
        getExactSheetStockForMaterial: config.getExactSheetStockForMaterial,
        getLargestSheetFormatForMaterial: config.getLargestSheetFormatForMaterial,
        buildStockSignatureForMaterial: config.buildStockSignatureForMaterial,
        makePlanCacheKey: config.makePlanCacheKey,
        renderOutput: config.renderOutput,
        formatHeurLabel: config.formatHeurLabel,
        getRozrysScopeMode: config.getRozrysScopeMode,
        getOptimaxProfilePreset: config.getOptimaxProfilePreset,
        speedLabel: config.speedLabel,
        directionLabel: config.directionLabel,
        renderLoadingInto: config.renderLoadingInto,
        computePlanPanelProAsync: config.computePlanPanelProAsync,
        loadEdgeStore: config.loadEdgeStore,
        isPartRotationAllowed: config.isPartRotationAllowed,
        applySheetStockLimit: config.applySheetStockLimit,
        computePlan: config.computePlan,
        buildEntriesForScope: config.buildEntriesForScope,
        getAccordionScopeKey: config.getAccordionScopeKey,
        getAccordionPref: config.getAccordionPref,
        createMaterialAccordionSection: config.createMaterialAccordionSection,
        setAccordionPref: config.setAccordionPref,
        setMaterialGrainEnabled: config.setMaterialGrainEnabled,
        openMaterialGrainExceptions: config.openMaterialGrainExceptions,
        splitMaterialAccordionTitle: config.splitMaterialAccordionTitle,
        parseLocaleNumber: config.parseLocaleNumber,
        openRozrysInfo: config.openRozrysInfo,
        askRozrysConfirm: config.askRozrysConfirm,
        createChoiceLauncher: config.createChoiceLauncher,
        getSelectOptionLabel: config.getSelectOptionLabel,
        setChoiceLaunchValue: config.setChoiceLaunchValue,
        openRozrysChoiceOverlay: config.openRozrysChoiceOverlay,
      },
    };
  }

  function createApi(){
    return {
      buildWorkspaceCtx,
      buildWorkspaceDeps,
      buildSelectionBridgeConfig,
      buildPlanHelpersConfig,
      buildOutputBridgeConfig,
      buildOutputControllerConfig,
      buildRunControllerConfig,
    };
  }

  FC.rozrysRenderCompose = { createApi };
})();
