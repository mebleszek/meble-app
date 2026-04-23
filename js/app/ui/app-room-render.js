(function(){
  'use strict';
  window.FC = window.FC || {};
  const ns = window.FC.appRoomRender = window.FC.appRoomRender || {};

  function getUiState(ctx){
    try{
      if(ctx && typeof ctx.getUiState === 'function') return ctx.getUiState() || {};
    }catch(_){ }
    return {};
  }

  function persistUiState(ctx, nextState){
    try{
      if(ctx && typeof ctx.persistUiState === 'function') return ctx.persistUiState(nextState) || nextState;
    }catch(_){ }
    const FC = (ctx && ctx.FC) || window.FC || {};
    try{
      if(FC.uiState && typeof FC.uiState.set === 'function') return FC.uiState.set(nextState) || nextState;
      if(FC.storage && typeof FC.storage.setJSON === 'function' && ctx && ctx.storageKeys && ctx.storageKeys.ui){
        FC.storage.setJSON(ctx.storageKeys.ui, nextState);
      }
    }catch(_){ }
    return nextState;
  }

  function restorePendingScroll(FC){
    try{ if(FC && FC.listScrollMemory && typeof FC.listScrollMemory.restorePending === 'function') FC.listScrollMemory.restorePending(); }catch(_){ }
  }

  function getById(root, id){
    if(!root || !id) return null;
    try{
      if(typeof root.getElementById === 'function') return root.getElementById(id);
    }catch(_){ }
    try{
      if(typeof root.querySelector === 'function') return root.querySelector('#' + String(id));
    }catch(_){ }
    return null;
  }

  function getRoomLabel(FC, room){
    const raw = String(room || '').trim();
    try{
      if(FC && FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function'){
        const label = String(FC.roomRegistry.getRoomLabel(room) || '').trim();
        if(label){
          const normalizedRaw = raw.toLowerCase();
          const normalizedLabel = label.toLowerCase();
          if((normalizedLabel !== normalizedRaw && !/^room_/i.test(label)) || /[A-ZĄĆĘŁŃÓŚŹŻ]/.test(label) || !/^room_/i.test(label)){
            return label;
          }
        }
      }
    }catch(_){ }
    try{
      if(FC && FC.roomRegistryDefinitions){
        const defs = FC.roomRegistryDefinitions;
        const pretty = typeof defs.prettifyTechnicalRoomText === 'function'
          ? defs.prettifyTechnicalRoomText(raw, '')
          : raw;
        const display = typeof defs.toDisplayRoomLabel === 'function'
          ? defs.toDisplayRoomLabel(pretty, raw)
          : pretty;
        if(String(display || '').trim()) return String(display).trim();
      }
    }catch(_){ }
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Pomieszczenie';
  }

  function normalizeTabName(tabName){
    return String(tabName || '').trim().toLowerCase();
  }

  function getDirectTabRenderer(FC, tabName){
    const tab = normalizeTabName(tabName);
    if(!tab) return null;
    if(tab === 'wywiad'){
      return function(ctx){
        if(FC && FC.tabsWywiad && typeof FC.tabsWywiad.renderWywiadTab === 'function'){
          return FC.tabsWywiad.renderWywiadTab(ctx && ctx.listEl, ctx && ctx.room);
        }
        if(typeof window.renderWywiadTab === 'function') return window.renderWywiadTab(ctx && ctx.listEl, ctx && ctx.room);
      };
    }
    if(tab === 'wycena'){
      return function(ctx){
        if(FC && FC.tabsWycena && typeof FC.tabsWycena.renderWycenaTab === 'function') return FC.tabsWycena.renderWycenaTab(ctx);
      };
    }
    if(tab === 'material'){
      return function(ctx){
        if(FC && FC.tabsMaterial && typeof FC.tabsMaterial.renderMaterialsTab === 'function') return FC.tabsMaterial.renderMaterialsTab(ctx && ctx.listEl, ctx && ctx.room);
      };
    }
    if(tab === 'rysunek'){
      return function(ctx){
        if(FC && FC.tabsRysunek && typeof FC.tabsRysunek.renderDrawingTab === 'function') return FC.tabsRysunek.renderDrawingTab(ctx && ctx.listEl, ctx && ctx.room);
      };
    }
    if(tab === 'czynnosci'){
      return function(ctx){
        if(FC && FC.tabsCzynnosci && typeof FC.tabsCzynnosci.render === 'function') return FC.tabsCzynnosci.render(ctx);
      };
    }
    return null;
  }

  function renderActiveTab(FC, tabName, ctx){
    const tab = normalizeTabName(tabName);
    const router = FC && FC.tabsRouter;
    try{
      if(router && typeof router.get === 'function'){
        const mod = router.get(tab);
        if(mod && typeof mod.render === 'function'){
          if(typeof router.switchTo === 'function') return router.switchTo(tab, ctx);
          return mod.render(ctx);
        }
      }
    }catch(_){ }
    try{
      const direct = getDirectTabRenderer(FC, tab);
      if(typeof direct === 'function') return direct(ctx);
    }catch(_){ }
    return false;
  }

  function renderCabinets(ctx){
    const FC = (ctx && ctx.FC) || window.FC || {};
    const doc = ctx && ctx.document;
    const list = getById(doc, 'cabinetsList');
    if(!list) return;
    list.innerHTML = '';

    const uiState = getUiState(ctx);
    const projectData = (ctx && ctx.projectData) || window.projectData || {};
    const requestedRoom = String((uiState && uiState.roomType) || '').trim();
    const roomData = requestedRoom && projectData && projectData[requestedRoom] && typeof projectData[requestedRoom] === 'object'
      ? projectData[requestedRoom]
      : null;
    const room = roomData ? requestedRoom : '';

    const roomSettingsCardEl = getById(doc, 'roomSettingsCard');
    if(roomSettingsCardEl){
      const shouldHide = !!(ctx && typeof ctx.shouldHideRoomSettingsForTab === 'function' && ctx.shouldHideRoomSettingsForTab(uiState && uiState.activeTab));
      roomSettingsCardEl.style.display = shouldHide ? 'none' : '';
    }

    const roomTitleEl = getById(doc, 'roomTitle');
    if(roomTitleEl) roomTitleEl.textContent = room ? getRoomLabel(FC, room) : 'Pomieszczenie';

    if(!room){
      const roomlessTab = normalizeTabName(uiState && uiState.activeTab);
      if(roomlessTab === 'wycena'){
        try{
          if(FC.tabsRouter && typeof FC.tabsRouter.switchTo === 'function'){
            renderActiveTab(FC, 'wycena', { listEl: list, room:'' });
            restorePendingScroll(FC);
            return;
          }
        }catch(_){ }
      }

      if(requestedRoom){
        const hasInvestorContext = !!((uiState && uiState.currentInvestorId)
          || (FC && FC.investors && typeof FC.investors.getCurrentId === 'function' && FC.investors.getCurrentId()));
        const nextState = Object.assign({}, uiState || {}, {
          roomType: null,
          selectedCabinetId: null,
          expanded: {},
          entry: hasInvestorContext ? 'rooms' : ((uiState && uiState.workMode) ? 'modeHub' : 'home'),
        });
        if(nextState.activeTab === 'wywiad' || nextState.activeTab === 'rysunek' || nextState.activeTab === 'material') nextState.activeTab = 'pokoje';
        const appliedState = persistUiState(ctx, nextState);
        try{ if(FC.views && typeof FC.views.applyFromState === 'function') FC.views.applyFromState(appliedState); }catch(_){ }
      }
      return;
    }

    try{ if(ctx && typeof ctx.renderTopHeight === 'function') ctx.renderTopHeight(); }catch(_){ }
    try{
      if(FC.wywiadRoomSettings){
        if(typeof FC.wywiadRoomSettings.renderSummary === 'function') FC.wywiadRoomSettings.renderSummary(room);
        if(typeof FC.wywiadRoomSettings.bindTriggerButtons === 'function') FC.wywiadRoomSettings.bindTriggerButtons(doc);
      }
    }catch(_){ }

    try{
      if(renderActiveTab(FC, uiState && uiState.activeTab, { listEl: list, room } ) !== false){
        restorePendingScroll(FC);
        return;
      }
    }catch(_){ }

    if(normalizeTabName(uiState && uiState.activeTab) === 'material'){
      try{ if(ctx && typeof ctx.renderMaterialsTab === 'function') ctx.renderMaterialsTab(list, room); }catch(_){ }
      restorePendingScroll(FC);
      return;
    }
    if(normalizeTabName(uiState && uiState.activeTab) === 'rysunek'){
      try{ if(ctx && typeof ctx.renderDrawingTab === 'function') ctx.renderDrawingTab(list, room); }catch(_){ }
      restorePendingScroll(FC);
      return;
    }
    try{ if(ctx && typeof ctx.renderWywiadTab === 'function') ctx.renderWywiadTab(list, room); }catch(_){ }
    restorePendingScroll(FC);
  }

  ns.renderCabinets = renderCabinets;
})();
