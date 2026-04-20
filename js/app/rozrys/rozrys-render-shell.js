(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function getRenderComposeApi(apiFC){
    return (apiFC.rozrysRenderCompose && typeof apiFC.rozrysRenderCompose.createApi === 'function')
      ? apiFC.rozrysRenderCompose.createApi({ FC: apiFC })
      : {
          buildWorkspaceCtx: (config)=> config || {},
          buildWorkspaceDeps: (config)=> config || {},
          buildSelectionBridgeConfig: (config)=> config || { ctx:{}, deps:{} },
        };
  }

  function getPanelWorkspaceApi(apiFC){
    return (apiFC.rozrysPanelWorkspace && typeof apiFC.rozrysPanelWorkspace.createApi === 'function')
      ? apiFC.rozrysPanelWorkspace.createApi({ FC: apiFC })
      : { createWorkspace: ()=> null };
  }

  function getControllerBridgeApi(apiFC){
    return (apiFC.rozrysControllerBridges && typeof apiFC.rozrysControllerBridges.createApi === 'function')
      ? apiFC.rozrysControllerBridges.createApi({ FC: apiFC })
      : {
          createSelectionBridge: ()=> ({
            updateRoomsPickerButton: ()=> undefined,
            updateMaterialPickerButton: ()=> undefined,
            persistSelectionPrefs: ()=> undefined,
            syncHiddenSelections: ()=> undefined,
            refreshSelectionState: ()=> undefined,
            buildScopeDraftControls: ()=> undefined,
            openRoomsPicker: ()=> undefined,
            openMaterialPicker: ()=> undefined,
            init: ()=> undefined,
          }),
        };
  }

  function createSelectionControls(config){
    const h = config.h;
    const card = config.card;
    const labelWithInfo = config.labelWithInfo;
    const encodeRoomsSelection = config.encodeRoomsSelection;
    const encodeMaterialScope = config.encodeMaterialScope;

    const controls = h('div', { class:'rozrys-selection-grid', style:'margin-top:12px' });

    const roomsWrap = h('div', { class:'rozrys-field rozrys-selection-grid__rooms' });
    roomsWrap.appendChild(labelWithInfo('Pomieszczenia', 'Pomieszczenia', 'Wybierz, z których pomieszczeń mam zebrać formatki do rozrysu. Ten sam materiał z kilku pomieszczeń zostanie zsumowany.'));
    const roomsSel = h('input', { id:'rozRooms', type:'hidden', value:encodeRoomsSelection(config.getSelectedRooms()) });
    const roomsPickerBtn = h('button', { type:'button', class:'btn rozrys-picker-launch rozrys-picker-launch--rooms' });
    const roomsPickerValue = h('div', { class:'rozrys-picker-launch__value' });
    roomsPickerBtn.appendChild(roomsPickerValue);
    roomsWrap.appendChild(roomsPickerBtn);
    roomsWrap.appendChild(roomsSel);
    controls.appendChild(roomsWrap);

    const matWrap = h('div', { class:'rozrys-field rozrys-selection-grid__material' });
    matWrap.appendChild(labelWithInfo('Materiał / grupa', 'Materiał / grupa', 'Wybierz wszystkie materiały albo jeden kolor. Dla koloru, który ma i fronty, i korpusy, możesz zaznaczyć sam front, sam korpus albo oba.'));
    const matSel = h('input', { id:'rozMat', type:'hidden', value:encodeMaterialScope(config.getMaterialScope()) });
    const matPickerBtn = h('button', { type:'button', class:'btn rozrys-picker-launch rozrys-picker-launch--material' });
    const matPickerValue = h('div', { class:'rozrys-picker-launch__value' });
    matPickerBtn.appendChild(matPickerValue);
    matWrap.appendChild(matPickerBtn);
    matWrap.appendChild(matSel);
    controls.appendChild(matWrap);

    card.appendChild(controls);

    return {
      controls,
      roomsWrap,
      roomsSel,
      roomsPickerBtn,
      roomsPickerValue,
      matWrap,
      matSel,
      matPickerBtn,
      matPickerValue,
    };
  }

  function createSelectionApi(bridge){
    const safeBridge = bridge || {};
    return {
      bridge: safeBridge,
      updateRoomsPickerButton: typeof safeBridge.updateRoomsPickerButton === 'function' ? ()=> safeBridge.updateRoomsPickerButton() : (()=> undefined),
      updateMaterialPickerButton: typeof safeBridge.updateMaterialPickerButton === 'function' ? ()=> safeBridge.updateMaterialPickerButton() : (()=> undefined),
      persistSelectionPrefs: typeof safeBridge.persistSelectionPrefs === 'function' ? ()=> safeBridge.persistSelectionPrefs() : (()=> undefined),
      syncHiddenSelections: typeof safeBridge.syncHiddenSelections === 'function' ? ()=> safeBridge.syncHiddenSelections() : (()=> undefined),
      refreshSelectionState: typeof safeBridge.refreshSelectionState === 'function' ? (opts)=> safeBridge.refreshSelectionState(opts) : (()=> undefined),
      buildScopeDraftControls: typeof safeBridge.buildScopeDraftControls === 'function' ? (holder, draftScope, hasFronts, hasCorpus, opts)=> safeBridge.buildScopeDraftControls(holder, draftScope, hasFronts, hasCorpus, opts) : (()=> undefined),
      openRoomsPicker: typeof safeBridge.openRoomsPicker === 'function' ? ()=> safeBridge.openRoomsPicker() : (()=> undefined),
      openMaterialPicker: typeof safeBridge.openMaterialPicker === 'function' ? ()=> safeBridge.openMaterialPicker() : (()=> undefined),
    };
  }

  function createShell(apiFC, config){
    config = config || {};
    const h = typeof config.h === 'function' ? config.h : ((tag, attrs)=> {
      const el = document.createElement(tag);
      Object.keys(attrs || {}).forEach((key)=> {
        if(key === 'class') el.className = attrs[key];
        else if(key === 'text') el.textContent = attrs[key];
        else if(key === 'html') el.innerHTML = attrs[key];
        else el.setAttribute(key, attrs[key]);
      });
      return el;
    });
    if(!config.card) return { workspace:null, selection:createSelectionApi(null) };

    const renderComposeApi = getRenderComposeApi(apiFC);
    const panelWorkspaceApi = getPanelWorkspaceApi(apiFC);
    const controllerBridgeApi = getControllerBridgeApi(apiFC);

    const shell = createSelectionControls(Object.assign({}, config, { h }));

    const workspace = panelWorkspaceApi.createWorkspace(renderComposeApi.buildWorkspaceCtx({
      h,
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
    }), renderComposeApi.buildWorkspaceDeps({
      normalizeCutDirection: config.normalizeCutDirection,
    }));

    const selectionBridge = controllerBridgeApi.createSelectionBridge(renderComposeApi.buildSelectionBridgeConfig({
      h,
      state: config.state,
      roomsPickerBtn: shell.roomsPickerBtn,
      matPickerBtn: shell.matPickerBtn,
      roomsPickerValue: shell.roomsPickerValue,
      matPickerValue: shell.matPickerValue,
      roomsSel: shell.roomsSel,
      matSel: shell.matSel,
      rozState: config.rozState,
      getRooms: config.getRooms,
      getSelectedRooms: config.getSelectedRooms,
      setSelectedRooms: config.setSelectedRooms,
      getMaterialScope: config.getMaterialScope,
      setMaterialScope: config.setMaterialScope,
      getAggregate: config.getAggregate,
      setAggregate: config.setAggregate,
      tryAutoRenderFromCache: config.tryAutoRenderFromCache,
      scopeApi: config.scopeApi,
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
    }));
    if(selectionBridge && typeof selectionBridge.init === 'function') selectionBridge.init();

    return Object.assign({}, shell, {
      workspace,
      selection: createSelectionApi(selectionBridge),
    });
  }

  function createApi(baseDeps){
    const apiFC = (baseDeps && baseDeps.FC) || FC;
    return {
      createShell: (config)=> createShell(apiFC, config),
    };
  }

  FC.rozrysRenderShell = { createApi };
})();
