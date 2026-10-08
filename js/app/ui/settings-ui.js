/*
  settings-ui.js
  Helpery ustawień pokoju i rozwijania kart wyjęte z app.js.
  Bez zmian UI; app.js zachowuje fallback przez callExtracted(...).
*/
(function(){
  const ns = (window.FC = window.FC || {});
  function renderTopHeight(roomArg){
    const room = String(roomArg || (uiState && uiState.roomType) || '').trim() || 'kuchnia';
    const el = document.getElementById('autoTopHeight');
    if(el) el.textContent = calculateAvailableTopHeight(room);
  }
  function toggleExpandAll(id){
    const key = String(id);
    const isOpen = !!(uiState.expanded && uiState.expanded[key]);
    uiState.expanded = {};
    if(!isOpen){
      uiState.expanded[key] = true;
      uiState.selectedCabinetId = key;
    }
    FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
    const activeTab = String(uiState.activeTab || '');
    if(activeTab !== 'pokoje' && activeTab !== 'inwestor' && activeTab !== 'rozrys' && activeTab !== 'magazyn'){
      renderCabinets();
    }
  }
  function handleSettingChange(field, value){
    // Do not throw into app.js's legacy, mutating fallback.
    try{
      const api = ns.wywiadRoomSettings;
      return api && typeof api.applySetting === 'function' ? api.applySetting(field, value) : { ok:false };
    }catch(_){
      try{ ns.roomPreferences.notifyRoomSaveFailure(); }catch(_){ }
      return { ok:false };
    }
  }
  ns.settingsUI = Object.assign({}, ns.settingsUI || {}, {
    renderTopHeight,
    toggleExpandAll,
    handleSettingChange,
  });
})();
