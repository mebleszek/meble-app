(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function createSelectionBridge(apiFC, config){
    const ctx = (config && config.ctx) || {};
    const deps = (config && config.deps) || {};
    const renderScopeApi = (apiFC.rozrysScope && typeof apiFC.rozrysScope.createApi === 'function')
      ? apiFC.rozrysScope.createApi({
          getRooms: deps.getRooms,
          getAggregatePartsForProject: ()=> deps.aggregatePartsForProject,
          splitMaterialAccordionTitle: deps.splitMaterialAccordionTitle,
        })
      : (deps.scopeApiFallback || {});
    const selectionUi = (apiFC.rozrysSelectionUi && typeof apiFC.rozrysSelectionUi.createController === 'function')
      ? apiFC.rozrysSelectionUi.createController(ctx, Object.assign({}, deps, {
          getScopeSummary: renderScopeApi.getScopeSummary,
          getRoomsSummary: renderScopeApi.getRoomsSummary,
        }))
      : null;

    function call(name, args, fallback){
      if(selectionUi && typeof selectionUi[name] === 'function') return selectionUi[name].apply(selectionUi, args || []);
      return typeof fallback === 'function' ? fallback() : fallback;
    }

    return {
      controller: selectionUi,
      renderScopeApi,
      updateRoomsPickerButton: ()=> call('updateRoomsPickerButton'),
      updateMaterialPickerButton: ()=> call('updateMaterialPickerButton'),
      persistSelectionPrefs: ()=> call('persistSelectionPrefs'),
      syncHiddenSelections: ()=> call('syncHiddenSelections'),
      refreshSelectionState: (opts)=> call('refreshSelectionState', [opts]),
      buildScopeDraftControls: (holder, draftScope, hasFronts, hasCorpus, opts)=> call('buildScopeDraftControls', [holder, draftScope, hasFronts, hasCorpus, opts]),
      openRoomsPicker: ()=> call('openRoomsPicker'),
      openMaterialPicker: ()=> call('openMaterialPicker'),
      init: ()=> {
        call('updateRoomsPickerButton');
        call('updateMaterialPickerButton');
        call('syncHiddenSelections');
        if(ctx.roomsPickerBtn && typeof ctx.roomsPickerBtn.addEventListener === 'function') ctx.roomsPickerBtn.addEventListener('click', ()=> call('openRoomsPicker'));
        if(ctx.matPickerBtn && typeof ctx.matPickerBtn.addEventListener === 'function') ctx.matPickerBtn.addEventListener('click', ()=> call('openMaterialPicker'));
      },
    };
  }

  function createOutputBridge(config){
    const ctx = (config && config.ctx) || {};
    const getController = typeof ctx.getController === 'function' ? ctx.getController : (()=> null);

    function call(name, args, fallback){
      const controller = getController();
      if(controller && typeof controller[name] === 'function') return controller[name].apply(controller, args || []);
      return typeof fallback === 'function' ? fallback() : fallback;
    }

    return {
      buildEntriesForScope: (selection, aggregate)=> call('buildEntriesForScope', [selection, aggregate], ()=> []),
      splitMaterialAccordionTitle: (material)=> call('splitMaterialAccordionTitle', [material], ()=> ({ line1:String(material || 'Materiał'), line2:'' })),
      createMaterialAccordionSection: (material, options)=> call('createMaterialAccordionSection', [material, options], ()=> { const wrap = document.createElement('div'); const body = document.createElement('div'); wrap.appendChild(body); return { wrap, body, trigger:null, setOpenState:()=>{} }; }),
      renderOutput: (plan, meta, target)=> call('renderOutput', [plan, meta, target], ()=> { const tgt = target || ctx.out; if(tgt) tgt.innerHTML = ''; return undefined; }),
      renderLoadingInto: (target, text, subText)=> call('renderLoadingInto', [target, text, subText], ()=> { const tgt = target || ctx.out; if(tgt) tgt.innerHTML = ''; return null; }),
      renderLoading: (text)=> call('renderLoading', [text], ()=> { const tgt = ctx.out; if(tgt) tgt.innerHTML = ''; return null; }),
      renderMaterialAccordionPlans: (scopeKey, scopeMode, entries)=> call('renderMaterialAccordionPlans', [scopeKey, scopeMode, entries], ()=> { if(ctx.out) ctx.out.innerHTML = ''; return false; }),
      tryAutoRenderFromCache: ()=> call('tryAutoRenderFromCache', [], ()=> { if(ctx.out) ctx.out.innerHTML = ''; const fn = typeof ctx.getSetGenBtnMode === 'function' ? ctx.getSetGenBtnMode() : null; if(typeof fn === 'function') fn('idle'); return false; }),
    };
  }

  function createApi(baseDeps){
    baseDeps = baseDeps || {};
    const apiFC = baseDeps.FC || FC;
    return {
      createSelectionBridge: (config)=> createSelectionBridge(apiFC, config),
      createOutputBridge,
    };
  }

  FC.rozrysControllerBridges = { createApi };
})();
