// Public safe APIs and boot adapters extracted from app.js.
(function(){
  try{
    window.FC = Object.assign(window.FC || {}, window.FC || {});
    window.App = window.App || {};
    const FC = window.FC;

    if (typeof FC.init !== 'function' && typeof initApp === 'function') FC.init = initApp;
    if (typeof window.App.init !== 'function' && typeof initApp === 'function') window.App.init = initApp;

    FC.openRoom = function(room){
      try{
        uiState.roomType = room;
        uiState.entry = 'app';
        uiState.activeTab = uiState.activeTab || 'wywiad';
        FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
        const rv = document.getElementById('roomsView');
        const av = document.getElementById('appView');
        const tabs = document.getElementById('topTabs');
        if(rv) rv.style.display = 'none';
        if(av) av.style.display = 'block';
        if(tabs) tabs.style.display = 'inline-block';
        try{ document.querySelectorAll('.tab-btn').forEach(tbtn => tbtn.style.background = (tbtn.getAttribute('data-tab') === uiState.activeTab) ? '#e6f7ff' : 'var(--card)'); }catch(_){}
        try{ renderTopHeight(); }catch(_){}
        try{ renderCabinets(); }catch(_){}
        try{ window.scrollTo({top:0, behavior:'smooth'}); } catch(_){ window.scrollTo(0,0); }
      }catch(_){ }
    };

    FC.setActiveTabSafe = function(tab){
      try{ setActiveTab(tab); }catch(_){ }
    };

    FC.openPriceListSafe = function(kind){
      try{
        if(kind !== 'materials' && kind !== 'services') kind = 'materials';
        uiState.showPriceList = kind;
        FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
        renderPriceModal();
        const pm = document.getElementById('priceModal');
        if(pm) pm.style.display = 'flex';
      }catch(_){ }
    };

    FC.closePriceModalSafe = function(){
      try{
        const pm = document.getElementById('priceModal');
        if(pm) pm.style.display = 'none';
        uiState.showPriceList = null;
        uiState.editingId = null;
        FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      }catch(_){ }
    };

    FC.addCabinetSafe = function(){
      try{ addCabinet(); }catch(_){ }
    };

    FC.closeCabinetModalSafe = function(){
      try{ closeCabinetModal(); }catch(_){ }
    };
  }catch(_){ }
})();
