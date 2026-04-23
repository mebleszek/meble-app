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
    const room = uiState.roomType; if(!room) return;
    projectData[room].settings[field] = value === '' ? 0 : parseFloat(value);
    projectData = FC.project.save(projectData);
    renderTopHeight();
    renderCabinets();
  }
  ns.settingsUI = Object.assign({}, ns.settingsUI || {}, {
    renderTopHeight,
    toggleExpandAll,
    handleSettingChange,
  });
})();
