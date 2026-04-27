// js/app/ui/cabinets-render.js
// Główny renderer kontenera zakładek wyciągnięty z app.js.
// Odpowiedzialność: wybór aktywnego pomieszczenia/zakładki i delegacja renderu do właściwego modułu.

(function(){
  'use strict';
  window.FC = window.FC || {};

  function safeCall(fn){
    try{ return typeof fn === 'function' ? fn() : undefined; }catch(_){ return undefined; }
  }

  function getRoomLabel(room){
    try{
      if(window.FC && window.FC.roomRegistry && typeof window.FC.roomRegistry.getRoomLabel === 'function'){
        return window.FC.roomRegistry.getRoomLabel(room);
      }
    }catch(_){ }
    return room ? room.charAt(0).toUpperCase() + room.slice(1) : 'Pomieszczenie';
  }

  function restorePendingScroll(){
    try{
      const mem = window.FC && window.FC.listScrollMemory;
      if(mem && typeof mem.restorePending === 'function') mem.restorePending();
    }catch(_){ }
  }

  function switchByRouter(tabName, list, room){
    try{
      if(window.FC && window.FC.tabsRouter && typeof window.FC.tabsRouter.switchTo === 'function'){
        window.FC.tabsRouter.switchTo(tabName, { listEl: list, room });
        restorePendingScroll();
        return true;
      }
    }catch(_){ }
    return false;
  }

  function renderCabinets(ctx){
    ctx = ctx || {};
    const doc = ctx.document || window.document;
    if(!doc) return;
    const FC = window.FC || {};
    const list = doc.getElementById('cabinetsList');
    if(!list) return;

    list.innerHTML = '';

    let uiState = typeof ctx.getUiState === 'function' ? (ctx.getUiState() || {}) : {};
    const projectData = typeof ctx.getProjectData === 'function' ? (ctx.getProjectData() || {}) : {};
    const requestedRoom = String((uiState && uiState.roomType) || '').trim();
    const roomData = requestedRoom && projectData && projectData[requestedRoom] && typeof projectData[requestedRoom] === 'object'
      ? projectData[requestedRoom]
      : null;
    const room = roomData ? requestedRoom : '';

    const shouldHide = typeof ctx.shouldHideRoomSettingsForTab === 'function'
      ? ctx.shouldHideRoomSettingsForTab(uiState && uiState.activeTab)
      : String((uiState && uiState.activeTab) || '') === 'wycena';

    const roomSettingsCardEl = doc.getElementById('roomSettingsCard');
    if(roomSettingsCardEl) roomSettingsCardEl.style.display = shouldHide ? 'none' : '';

    const roomTitleEl = doc.getElementById('roomTitle');
    if(roomTitleEl) roomTitleEl.textContent = room ? getRoomLabel(room) : 'Pomieszczenie';

    if(!room){
      const roomlessTab = String(uiState && uiState.activeTab || '').trim().toLowerCase();
      if(roomlessTab === 'wycena'){
        if(switchByRouter('wycena', list, '')) return;
      }

      if(requestedRoom){
        const hasInvestorContext = !!((uiState && uiState.currentInvestorId)
          || (FC.investors && typeof FC.investors.getCurrentId === 'function' && FC.investors.getCurrentId()));
        const nextState = Object.assign({}, uiState || {}, {
          roomType: null,
          selectedCabinetId: null,
          expanded: {},
          entry: hasInvestorContext ? 'rooms' : ((uiState && uiState.workMode) ? 'modeHub' : 'home'),
        });
        if(nextState.activeTab === 'wywiad' || nextState.activeTab === 'rysunek' || nextState.activeTab === 'material') nextState.activeTab = 'pokoje';
        uiState = nextState;
        try{
          if(FC.uiState && typeof FC.uiState.set === 'function') uiState = FC.uiState.set(nextState);
          else if(FC.storage && typeof FC.storage.setJSON === 'function') FC.storage.setJSON((ctx.storageKeys || {}).ui, uiState);
          if(typeof ctx.setUiState === 'function') ctx.setUiState(uiState);
        }catch(_){ }
        try{ if(FC.views && typeof FC.views.applyFromState === 'function') FC.views.applyFromState(uiState); }catch(_){ }
      }
      return;
    }

    safeCall(ctx.renderTopHeight);
    try{
      if(FC.wywiadRoomSettings){
        if(typeof FC.wywiadRoomSettings.renderSummary === 'function') FC.wywiadRoomSettings.renderSummary(room);
        if(typeof FC.wywiadRoomSettings.bindTriggerButtons === 'function') FC.wywiadRoomSettings.bindTriggerButtons(doc);
      }
    }catch(_){ }

    // Zakładki — routing przez moduły (js/app/ui/tabs-router.js + js/tabs/*).
    if(switchByRouter(uiState.activeTab, list, room)) return;

    // Fallback: zachowaj minimalne działanie, jeśli router nie jest dostępny.
    if(uiState.activeTab === 'material'){
      if(typeof ctx.renderMaterialsTab === 'function') ctx.renderMaterialsTab(list, room);
      restorePendingScroll();
      return;
    }
    if(uiState.activeTab === 'rysunek'){
      if(typeof ctx.renderDrawingTab === 'function') ctx.renderDrawingTab(list, room);
      restorePendingScroll();
      return;
    }
    if(typeof ctx.renderWywiadTab === 'function') ctx.renderWywiadTab(list, room);
    restorePendingScroll();
  }

  window.FC.cabinetsRender = {
    renderCabinets,
  };
})();
