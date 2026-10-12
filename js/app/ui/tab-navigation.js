(function(){
  window.FC = window.FC || {};
  window.FC.tabNavigation = window.FC.tabNavigation || {};

  function scrollToAndFlash(el){
    if(!el) return;
    try{ el.scrollIntoView({behavior:'smooth', block:'start'}); } catch(_){ el.scrollIntoView(true); }
    el.classList.remove('focus-flash');
    void el.offsetWidth;
    el.classList.add('focus-flash');
    window.setTimeout(() => el.classList.remove('focus-flash'), 1300);
  }

  function applyTab(tabName){
    if(window.FC && window.FC.investorEditorState && typeof window.FC.investorEditorState.hasUiLock === 'function' && window.FC.investorEditorState.hasUiLock() && tabName !== 'inwestor') return;
    const proposed = Object.assign({}, uiState, { activeTab:tabName });
    if(FC.sessionNavigation && !FC.sessionNavigation.prepareEditState(proposed)) return false;
    if(tabName === 'wywiad' && !uiState.roomType){
      uiState.entry = 'rooms';
    }
    if(tabName === 'wycena' && !uiState.roomType && (uiState.entry === 'rooms' || uiState.currentInvestorId)) uiState.entry = 'app';
    uiState.activeTab = tabName;
    FC.storage.setJSON(STORAGE_KEYS.ui, uiState);

    try{
      document.querySelectorAll('.tab-btn').forEach(t => t.style.background = 'var(--card)');
      const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
      if(activeBtn) activeBtn.style.background = '#e6f7ff';
    }catch(_){ }

    try{
      if(window.FC && window.FC.views && typeof window.FC.views.applyFromState === 'function'){
        window.FC.views.applyFromState(uiState);
      }
    }catch(_){ }

    try{
      if(window.FC && window.FC.sections && typeof window.FC.sections.update === 'function'){
        window.FC.sections.update();
      }
    }catch(_){ }

    const isExtraTab = (tabName === 'pokoje' || tabName === 'inwestor' || tabName === 'rozrys' || tabName === 'magazyn');
    if(!isExtraTab){
      try{ renderCabinets(); }catch(_){ }
    }

    try{ window.scrollTo({top:0, behavior:'smooth'}); } catch(_){ try{ window.scrollTo(0,0); }catch(__){} }
  }

  function setActiveTab(tabName){
    const name = String(tabName || '');
    if(['pokoje','wycena','rozrys'].includes(name)){
      const nav = window.FC && window.FC.sessionNavigation;
      if(nav && typeof nav.requestTransition === 'function'){
        return nav.requestTransition(name === 'pokoje' ? 'listy pomieszczeń' : name.toUpperCase(), ()=> applyTab(name));
      }
      // Read-only calculation tabs keep the edit owner; generation has its own gate.
      if(window.FC && window.FC.session && window.FC.session.active) return false;
    }
    return applyTab(name);
  }

  function jumpToMaterialsForCabinet(cabId){
    if(!cabId) return;
    uiState.matExpandedId = String(cabId);
    uiState._focusCabAfterRender = { tab:'material', id: String(cabId) };
    FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
    setActiveTab('material');
    window.setTimeout(() => {
      const el = document.getElementById(`mat-${cabId}`);
      scrollToAndFlash(el);
    }, 80);
  }

  function jumpToCabinetFromMaterials(cabId){
    if(!cabId) return;
    uiState.selectedCabinetId = String(cabId);
    uiState.expanded = {};
    uiState.expanded[String(cabId)] = true;
    uiState._focusCabAfterRender = { tab:'wywiad', id: String(cabId) };
    FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
    setActiveTab('wywiad');
    window.setTimeout(() => {
      const el = document.getElementById(`cab-${cabId}`);
      scrollToAndFlash(el);
    }, 80);
  }

  window.FC.tabNavigation.setActiveTab = setActiveTab;
  window.FC.tabNavigation.jumpToMaterialsForCabinet = jumpToMaterialsForCabinet;
  window.FC.tabNavigation.jumpToCabinetFromMaterials = jumpToCabinetFromMaterials;

  window.setActiveTab = setActiveTab;
  window.jumpToMaterialsForCabinet = jumpToMaterialsForCabinet;
  window.jumpToCabinetFromMaterials = jumpToCabinetFromMaterials;
})();
