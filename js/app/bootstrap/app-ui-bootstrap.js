(function(){
  'use strict';

  function scheduleWarmup(ctx){
    try{
      if(ctx && typeof ctx.scheduleRozrysWarmup === 'function') ctx.scheduleRozrysWarmup();
    }catch(_){ }
  }

  function applyViews(ctx, uiState){
    try{
      if(!uiState.entry) uiState.entry = 'home';
      if(uiState.roomType && (!uiState.entry || uiState.entry === 'home')){
        uiState.entry = 'app';
        try{ ctx.FC && ctx.FC.storage && typeof ctx.FC.storage.setJSON === 'function' && ctx.FC.storage.setJSON(ctx.storageKeys.ui, uiState); }catch(_){ }
      }
      if(ctx.FC && ctx.FC.views && typeof ctx.FC.views.applyFromState === 'function'){
        ctx.FC.views.applyFromState(uiState);
        return;
      }
    }catch(_){ }

    try{
      if(uiState.roomType){
        ctx.document.getElementById('roomsView').style.display='none';
        ctx.document.getElementById('appView').style.display='block';
        ctx.document.getElementById('topTabs').style.display = 'grid';
      } else {
        ctx.document.getElementById('roomsView').style.display='block';
        ctx.document.getElementById('appView').style.display='none';
        ctx.document.getElementById('topTabs').style.display = 'none';
      }
    }catch(_){ }
  }

  try{
    window.FC = window.FC || {};
    const ns = window.FC.appUiBootstrap = window.FC.appUiBootstrap || {};

    if(typeof ns.registerCoreActions !== 'function'){
      ns.registerCoreActions = function registerCoreActions(ctx){
        ctx = ctx || {};
        const FC = ctx.FC || window.FC || {};
        window.FC = window.FC || {};
        FC.actions = window.FC.actions || FC.actions;
        FC.modal = window.FC.modal || FC.modal;
        if(!FC.actions || !FC.modal) throw new Error('Brak core actions/modal');

        try{
          FC.modal.register('priceModal', () => { try{ ctx.closePriceModal && ctx.closePriceModal(); }catch(_){ } });
          FC.modal.register('priceItemModal', () => { try{ ctx.closePriceItemModal && ctx.closePriceItemModal(); }catch(_){ } });
          FC.modal.register('cabinetModal', () => { try{ ctx.closeCabinetModal && ctx.closeCabinetModal(); }catch(_){ } });
        }catch(_){ }

        return FC;
      };
    }

    if(typeof ns.initApp !== 'function'){
      ns.initApp = function initApp(ctx){
        ctx = ctx || {};
        if(typeof ctx.validateRequiredDOM === 'function') ctx.validateRequiredDOM();
        if(typeof ctx.registerCoreActions === 'function') ctx.registerCoreActions();
        if(ctx.FC && ctx.FC.actions && typeof ctx.FC.actions.validateDOMActions === 'function'){
          ctx.FC.actions.validateDOMActions(ctx.document || document);
        }
        if(typeof ctx.initUI === 'function') return ctx.initUI();
      };
    }

    if(typeof ns.initUI !== 'function'){
      ns.initUI = function initUI(ctx){
        ctx = ctx || {};
        const FC = ctx.FC || window.FC || {};
        const uiDefaults = ctx.uiDefaults || {};
        let uiState = (typeof ctx.getUiState === 'function' ? ctx.getUiState() : null) || uiDefaults;

        try{
          const reloadRestore = typeof ctx.applyReloadRestoreSnapshot === 'function'
            ? ctx.applyReloadRestoreSnapshot()
            : null;
          if(reloadRestore && reloadRestore.uiState && typeof reloadRestore.uiState === 'object'){
            uiState = Object.assign({}, uiDefaults, uiState || {}, reloadRestore.uiState || {});
            if(FC.uiState && typeof FC.uiState.save === 'function') uiState = FC.uiState.save(uiState);
            else if(FC.storage && typeof FC.storage.setJSON === 'function') FC.storage.setJSON(ctx.storageKeys.ui, uiState);
            if(typeof ctx.setUiState === 'function') ctx.setUiState(uiState);
          }
        }catch(_){ }

        try{ if(typeof ctx.installBindings === 'function') ctx.installBindings(); }catch(_){ }
        try{ if(typeof ctx.installProjectAutosave === 'function') ctx.installProjectAutosave(); }catch(_){ }

        applyViews({ FC, document: ctx.document || document, storageKeys: ctx.storageKeys || {} }, uiState);

        try{
          (ctx.document || document).querySelectorAll('.tab-btn').forEach((t)=>{
            t.style.background = (t.getAttribute('data-tab') === uiState.activeTab) ? '#e6f7ff' : 'var(--card)';
          });
        }catch(_){ }

        if(typeof ctx.renderTopHeight === 'function') ctx.renderTopHeight();
        if(typeof ctx.renderCabinets === 'function') ctx.renderCabinets();
        scheduleWarmup(ctx);
        try{ if(typeof ctx.restoreReloadScroll === 'function') ctx.restoreReloadScroll(); }catch(_){ }
        if(typeof ctx.setUiState === 'function') ctx.setUiState(uiState);
        return uiState;
      };
    }
  }catch(_){ }
})();
