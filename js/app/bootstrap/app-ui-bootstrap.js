(function(){
  'use strict';

  function scheduleWarmup(ctx){
    try{
      if(ctx && typeof ctx.scheduleRozrysWarmup === 'function') ctx.scheduleRozrysWarmup();
    }catch(_){ }
  }

  const FALLBACK_VIEW_IDS = ['homeView','modeHubView','roomsView','appView','investorView','rozrysView','magazynView','investorsListView','serviceOrdersListView'];

  function fallbackShowOnly(ctx, ids){
    const doc = ctx && ctx.document ? ctx.document : document;
    FALLBACK_VIEW_IDS.forEach((id)=>{
      const el = doc.getElementById(id);
      if(!el) return;
      el.style.display = ids.includes(id) ? 'block' : 'none';
    });
  }

  function fallbackSetTopBarVisible(ctx, on){
    const doc = ctx && ctx.document ? ctx.document : document;
    const topBar = doc.getElementById('topBar');
    if(topBar) topBar.style.display = on ? 'flex' : 'none';
  }

  function fallbackSetTabsVisible(ctx, on){
    const doc = ctx && ctx.document ? ctx.document : document;
    const tabs = doc.getElementById('topTabs');
    if(tabs) tabs.style.display = on ? 'grid' : 'none';
    fallbackSetTopBarVisible(ctx, !!on);
  }

  function fallbackSetSessionButtonsVisible(ctx, on){
    const doc = ctx && ctx.document ? ctx.document : document;
    const sessionButtons = doc.getElementById('sessionButtons');
    if(sessionButtons) sessionButtons.style.display = on ? 'flex' : 'none';
  }

  function fallbackSetFloatingVisible(ctx, on){
    const doc = ctx && ctx.document ? ctx.document : document;
    const fab = doc.getElementById('floatingAdd');
    if(fab) fab.style.display = on ? 'flex' : 'none';
  }

  function fallbackReadCurrentInvestorId(ctx, uiState){
    try{
      if(uiState && uiState.currentInvestorId) return String(uiState.currentInvestorId);
    }catch(_){ }
    try{
      if(ctx && ctx.FC && ctx.FC.investorPersistence && typeof ctx.FC.investorPersistence.getCurrentInvestorId === 'function'){
        return ctx.FC.investorPersistence.getCurrentInvestorId() || null;
      }
    }catch(_){ }
    return null;
  }

  function fallbackShowView(ctx, viewId, opts){
    const cfg = Object.assign({ tabs:false, session:false, floating:false }, opts || {});
    fallbackShowOnly(ctx, [viewId]);
    fallbackSetTabsVisible(ctx, cfg.tabs);
    fallbackSetSessionButtonsVisible(ctx, cfg.session);
    fallbackSetFloatingVisible(ctx, cfg.floating);
  }

  function applyViewsFallback(ctx, uiState){
    const st = uiState && typeof uiState === 'object' ? uiState : {};
    const entry = st.entry ? String(st.entry) : 'home';
    const tab = st.activeTab ? String(st.activeTab) : '';
    const currentInvestorId = fallbackReadCurrentInvestorId(ctx, st);

    if(tab === 'inwestor') return fallbackShowView(ctx, 'investorView', { tabs:true, session:true, floating:false });
    if(st.roomType && (!st.entry || st.entry === 'home')) return fallbackShowView(ctx, 'appView', { tabs:true, session:true, floating:true });
    if(entry === 'home') return fallbackShowView(ctx, 'homeView', { tabs:false, session:false, floating:false });
    if(entry === 'modeHub') return fallbackShowView(ctx, 'modeHubView', { tabs:false, session:false, floating:false });
    if(entry === 'investorsList') return fallbackShowView(ctx, 'investorsListView', { tabs:false, session:false, floating:false });
    if(entry === 'serviceOrdersList') return fallbackShowView(ctx, 'serviceOrdersListView', { tabs:false, session:false, floating:false });
    if(tab === 'rozrys') return fallbackShowView(ctx, 'rozrysView', { tabs:true, session:true, floating:false });
    if(tab === 'magazyn') return fallbackShowView(ctx, 'magazynView', { tabs:true, session:true, floating:false });
    if(tab === 'pokoje') return fallbackShowView(ctx, 'roomsView', { tabs:true, session:true, floating:false });
    if(entry === 'app' && st.roomType) return fallbackShowView(ctx, 'appView', { tabs:true, session:true, floating:true });
    if(entry === 'rooms' || currentInvestorId) return fallbackShowView(ctx, 'roomsView', { tabs:true, session:true, floating:false });
    return fallbackShowView(ctx, 'homeView', { tabs:false, session:false, floating:false });
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

    try{ applyViewsFallback(ctx, uiState); }catch(_){ }
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
