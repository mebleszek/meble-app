// Public safe APIs and boot adapters extracted from app.js.
(function(){
  try{
    window.FC = Object.assign(window.FC || {}, window.FC || {});
    window.App = window.App || {};
    const FC = window.FC;

    if (typeof FC.init !== 'function' && typeof initApp === 'function') FC.init = initApp;
    if (typeof window.App.init !== 'function' && typeof initApp === 'function') window.App.init = initApp;

    FC.openRoom = function(room){
      const open = ()=>{
        try{
          if(FC.session && FC.session.canSwitchRoom && !FC.session.canSwitchRoom(room)) return false;
          if(typeof uiState === 'undefined' || !uiState) return false;
          uiState.roomType = room;
          uiState.entry = 'app';
          uiState.activeTab = 'wywiad';
          FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
          if(FC.views && typeof FC.views.applyFromState === 'function') FC.views.applyFromState(uiState);
          else{
            const rv = document.getElementById('roomsView');
            const av = document.getElementById('appView');
            const tabs = document.getElementById('topTabs');
            if(rv) rv.style.display = 'none';
            if(av) av.style.display = 'block';
            if(tabs) tabs.style.display = 'inline-block';
          }
          try{ renderTopHeight(); }catch(_){ }
          try{ renderCabinets(); }catch(_){ }
          try{ window.scrollTo({top:0, behavior:'smooth'}); }catch(_){ }
          return true;
        }catch(_){ return false; }
      };
      const nav = FC.sessionNavigation;
      if(nav && typeof nav.requestTransition === 'function') return nav.requestTransition('innego pomieszczenia', open);
      if(FC.session && FC.session.active) return false;
      return open();
    };

    FC.setActiveTabSafe = function(tab){
      try{ setActiveTab(tab); }catch(_){ }
    };

    FC.openPriceListSafe = function(kind){
      try{
        if(!['materials','accessories','quoteRates','workshopServices'].includes(kind)) kind = 'materials';
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
