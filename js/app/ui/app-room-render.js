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

  function getRoomLabel(FC, room){
    try{
      if(FC && FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function'){
        return FC.roomRegistry.getRoomLabel(room);
      }
    }catch(_){ }
    const raw = String(room || '').trim();
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Pomieszczenie';
  }

  function renderCabinets(ctx){
    const FC = (ctx && ctx.FC) || window.FC || {};
    const doc = ctx && ctx.document;
    const list = doc && typeof doc.getElementById === 'function' ? doc.getElementById('cabinetsList') : null;
    if(!list) return;
    list.innerHTML = '';

    const uiState = getUiState(ctx);
    const projectData = (ctx && ctx.projectData) || window.projectData || {};
    const requestedRoom = String((uiState && uiState.roomType) || '').trim();
    const roomData = requestedRoom && projectData && projectData[requestedRoom] && typeof projectData[requestedRoom] === 'object'
      ? projectData[requestedRoom]
      : null;
    const room = roomData ? requestedRoom : '';

    const roomSettingsCardEl = doc && typeof doc.getElementById === 'function' ? doc.getElementById('roomSettingsCard') : null;
    if(roomSettingsCardEl){
      const shouldHide = !!(ctx && typeof ctx.shouldHideRoomSettingsForTab === 'function' && ctx.shouldHideRoomSettingsForTab(uiState && uiState.activeTab));
      roomSettingsCardEl.style.display = shouldHide ? 'none' : '';
    }

    const roomTitleEl = doc && typeof doc.getElementById === 'function' ? doc.getElementById('roomTitle') : null;
    if(roomTitleEl) roomTitleEl.textContent = room ? getRoomLabel(FC, room) : 'Pomieszczenie';

    if(!room){
      const roomlessTab = String((uiState && uiState.activeTab) || '').trim().toLowerCase();
      if(roomlessTab === 'wycena'){
        try{
          if(FC.tabsRouter && typeof FC.tabsRouter.switchTo === 'function'){
            FC.tabsRouter.switchTo('wycena', { listEl: list, room:'' });
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
      if(FC.tabsRouter && typeof FC.tabsRouter.switchTo === 'function'){
        FC.tabsRouter.switchTo(uiState.activeTab, { listEl: list, room });
        restorePendingScroll(FC);
        return;
      }
    }catch(_){ }

    if(uiState.activeTab === 'material'){
      try{ if(ctx && typeof ctx.renderMaterialsTab === 'function') ctx.renderMaterialsTab(list, room); }catch(_){ }
      restorePendingScroll(FC);
      return;
    }
    if(uiState.activeTab === 'rysunek'){
      try{ if(ctx && typeof ctx.renderDrawingTab === 'function') ctx.renderDrawingTab(list, room); }catch(_){ }
      restorePendingScroll(FC);
      return;
    }
    try{ if(ctx && typeof ctx.renderWywiadTab === 'function') ctx.renderWywiadTab(list, room); }catch(_){ }
    restorePendingScroll(FC);
  }

  ns.renderCabinets = renderCabinets;
})();
