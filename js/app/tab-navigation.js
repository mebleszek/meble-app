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

  function setActiveTab(tabName){
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
