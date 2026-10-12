// js/app/ui/views.js
// View/router helpers: start + work mode hubs + project workflow views.

(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function $(id){ return document.getElementById(id); }

  function showOnly(ids){
    const all = ['homeView','modeHubView','roomsView','appView','investorView','rozrysView','magazynView','investorsListView','serviceOrdersListView'];
    all.forEach((id)=>{
      const el = $(id);
      if(!el) return;
      el.style.display = ids.includes(id) ? 'block' : 'none';
    });
  }

  function setTopBarVisible(on){ const tb = $('topBar'); if(tb) tb.style.display = on ? 'flex' : 'none'; }
  function setTabsVisible(on){ const tabs = $('topTabs'); if(tabs) tabs.style.display = on ? 'grid' : 'none'; setTopBarVisible(!!on); }
  function setFloatingVisible(on){ const fab = $('floatingAdd'); if(fab) fab.style.display = on ? 'flex' : 'none'; }

  function refreshSessionButtons(){
    const sb = $('sessionButtons');
    const cancelBtn = $('sessionCancel');
    const saveBtn = $('sessionSave');
    if(!sb || !cancelBtn || !saveBtn) return;
    const session = (FC && FC.session) ? FC.session : null;
    const storageDirty = !!(session && typeof session.isDirty === 'function' && session.isDirty());
    const runtime = FC.investorProjectRuntime;
    const dirty = storageDirty || !!(session && session.active && runtime && typeof runtime.hasProjectDivergence === 'function'
      && typeof projectData !== 'undefined' && runtime.hasProjectDivergence(projectData));
    if(dirty){
      cancelBtn.style.display = '';
      cancelBtn.textContent = 'Anuluj';
      cancelBtn.className = 'btn btn-danger';
      cancelBtn.setAttribute('data-action', 'session-cancel');
      saveBtn.style.display = '';
      saveBtn.textContent = 'Zapisz';
      saveBtn.className = 'btn btn-success';
      saveBtn.setAttribute('data-action', 'session-save');
      return;
    }
    cancelBtn.style.display = '';
    cancelBtn.textContent = 'Wyjdź';
    cancelBtn.className = 'btn btn-primary';
    cancelBtn.setAttribute('data-action', 'session-cancel');
    saveBtn.style.display = 'none';
  }

  function setSessionButtonsVisible(on){
    const sb = $('sessionButtons');
    if(sb) sb.style.display = on ? 'flex' : 'none';
    if(on) refreshSessionButtons();
  }

  function showHome(){
    showOnly(['homeView']);
    setTabsVisible(false);
    setSessionButtonsVisible(false);
    setFloatingVisible(false);
  }

  function showModeHub(mode){
    showOnly(['modeHubView']);
    setTabsVisible(false);
    setSessionButtonsVisible(false);
    setFloatingVisible(false);
    try{ FC.workModeHub && typeof FC.workModeHub.renderModeHub === 'function' && FC.workModeHub.renderModeHub(mode); }catch(_){ }
  }

  function showInvestorsList(){
    showOnly(['investorsListView']);
    setTabsVisible(false);
    setSessionButtonsVisible(false);
    setFloatingVisible(false);
    try{
      const root = $('investorsListRoot');
      if(root && FC.investorUI && typeof FC.investorUI.renderListOnly === 'function'){
        FC.investorUI.state.mode = 'list';
        FC.investorUI.state.allowListAccess = false;
        FC.investorUI.renderListOnly(root);
      }
    }catch(_){ }
  }

  function showServiceOrdersList(){
    showOnly(['serviceOrdersListView']);
    setTabsVisible(false);
    setSessionButtonsVisible(false);
    setFloatingVisible(false);
    try{ FC.serviceOrders && typeof FC.serviceOrders.renderList === 'function' && FC.serviceOrders.renderList(); }catch(_){ }
  }

  function showRooms(){
    showOnly(['roomsView']);
    setTabsVisible(true);
    setSessionButtonsVisible(true);
    setFloatingVisible(false);
    try{ if(FC.roomRegistry && typeof FC.roomRegistry.renderRoomsView === 'function') FC.roomRegistry.renderRoomsView(); }catch(_){ }
  }

  function showApp(){ showOnly(['appView']); setTabsVisible(true); setSessionButtonsVisible(true); setFloatingVisible(true); }
  function showInvestor(){ showOnly(['investorView']); setTabsVisible(true); setSessionButtonsVisible(true); setFloatingVisible(false); }
  function showRozrys(){ showOnly(['rozrysView']); setTabsVisible(true); setSessionButtonsVisible(true); setFloatingVisible(false); }
  function showMagazyn(){ showOnly(['magazynView']); setTabsVisible(true); setSessionButtonsVisible(true); setFloatingVisible(false); }

  function readCurrentInvestorId(state){
    const fromState = state && state.currentInvestorId ? String(state.currentInvestorId) : '';
    if(fromState) return fromState;
    try{ if(FC.investorPersistence && typeof FC.investorPersistence.getCurrentInvestorId === 'function') return FC.investorPersistence.getCurrentInvestorId() || null; }catch(_){ }
    return null;
  }

  function syncGlobalUiState(nextState){
    try{ if(typeof uiState !== 'undefined') uiState = nextState; }catch(_){ }
    return nextState;
  }

  function setUiStatePatch(patch){
    const nextPatch = patch && typeof patch === 'object' ? patch : {};
    try{
      if(FC.uiState && typeof FC.uiState.set === 'function'){
        return syncGlobalUiState(FC.uiState.set(nextPatch));
      }
    }catch(_){ }
    try{
      const current = (typeof uiState !== 'undefined' && uiState && typeof uiState === 'object') ? uiState : {};
      const next = Object.assign({}, current, nextPatch);
      if(FC.storage && typeof FC.storage.setJSON === 'function'){
        const storageKeys = (FC.constants && FC.constants.STORAGE_KEYS) || { ui:'fc_ui_v1' };
        FC.storage.setJSON(storageKeys.ui, next);
      }
      return syncGlobalUiState(next);
    }catch(_){ }
    return syncGlobalUiState(Object.assign({}, nextPatch));
  }

  function clearProjectContext(){
    try{ if(FC.investorPersistence && typeof FC.investorPersistence.setCurrentInvestorId === 'function') FC.investorPersistence.setCurrentInvestorId(null); }catch(_){ }
    try{ if(FC.reloadRestore && typeof FC.reloadRestore.clear === 'function') FC.reloadRestore.clear(); }catch(_){ }
  }

  function shouldOpenRoomlessWycena(state){
    const st = state && typeof state === 'object' ? state : {};
    const tab = String(st.activeTab || '').trim().toLowerCase();
    const entry = String(st.entry || '').trim().toLowerCase();
    const hasInvestorContext = !!readCurrentInvestorId(st);
    if(entry === 'home' || entry === 'modehub' || entry === 'investorslist' || entry === 'serviceorderslist') return false;
    return tab === 'wycena' && !st.roomType && (entry === 'app' || entry === 'rooms' || hasInvestorContext);
  }

  function applyFromState(state){
    const st = state || (FC.uiState && FC.uiState.get ? FC.uiState.get() : {});
    if(!FC.sessionNavigation && st.entry === 'app' && st.roomType) return false;
    if(FC.sessionNavigation && !FC.sessionNavigation.prepareEditState(st)) return false;
    const entry = st && st.entry ? st.entry : 'home';
    const tab = st && st.activeTab ? st.activeTab : null;
    const currentInvestorId = readCurrentInvestorId(st);
    const workMode = st && st.workMode ? st.workMode : null;

    if(tab === 'inwestor') return showInvestor();
    if(st && st.roomType && (entry === 'home' || !entry)) return showApp();
    if(shouldOpenRoomlessWycena(st)) return showApp();
    if(entry === 'home') return showHome();
    if(entry === 'modeHub') return showModeHub(workMode || 'furnitureProjects');
    if(entry === 'investorsList') return showInvestorsList();
    if(entry === 'serviceOrdersList') return showServiceOrdersList();
    if(tab === 'rozrys') return showRozrys();
    if(tab === 'magazyn') return showMagazyn();
    if(tab === 'pokoje') return showRooms();
    if(entry === 'app' && st && st.roomType) return showApp();
    if(entry === 'rooms' || currentInvestorId) return showRooms();
    return showHome();
  }

  function openHome(){
    clearProjectContext();
    const nextState = setUiStatePatch({
      entry:'home',
      workMode:null,
      activeTab:'pokoje',
      roomType:null,
      lastRoomType:null,
      currentInvestorId:null,
      selectedCabinetId:null,
      showPriceList:null,
    });
    applyFromState(nextState || { entry:'home', roomType:null, activeTab:'pokoje', workMode:null, currentInvestorId:null });
  }

  function openModeHub(mode){
    const resolved = String(mode || 'furnitureProjects');
    clearProjectContext();
    const nextState = setUiStatePatch({ entry:'modeHub', workMode:resolved, activeTab:null, roomType:null, lastRoomType:null, currentInvestorId:null, selectedCabinetId:null, showPriceList:null });
    applyFromState(nextState || { entry:'modeHub', workMode:resolved, activeTab:null, roomType:null, currentInvestorId:null });
  }

  function openInvestorsList(){
    try{ if(FC.investorPersistence && typeof FC.investorPersistence.setCurrentInvestorId === 'function') FC.investorPersistence.setCurrentInvestorId(null); }catch(_){ }
    const nextState = setUiStatePatch({ entry:'investorsList', activeTab:null, roomType:null, lastRoomType:null, currentInvestorId:null, selectedCabinetId:null, workMode:'furnitureProjects' });
    applyFromState(nextState || { entry:'investorsList', activeTab:null, currentInvestorId:null, workMode:'furnitureProjects' });
  }

  function openServiceOrdersList(){
    clearProjectContext();
    const nextState = setUiStatePatch({ entry:'serviceOrdersList', activeTab:null, roomType:null, lastRoomType:null, currentInvestorId:null, selectedCabinetId:null, workMode:'workshopServices' });
    applyFromState(nextState || { entry:'serviceOrdersList', activeTab:null, roomType:null, currentInvestorId:null, workMode:'workshopServices' });
  }

  function openRooms(){
    const nextState = setUiStatePatch({ entry:'rooms', activeTab:'pokoje', roomType:null, selectedCabinetId:null });
    applyFromState(nextState || { entry:'rooms', activeTab:'pokoje' });
  }

  function openRoom(room){
    if(!room) return false;
    const patch = { entry:'app', roomType:room, activeTab:'wywiad', currentInvestorId:FC.investors && FC.investors.getCurrentId() };
    const proposed = Object.assign({}, typeof uiState !== 'undefined' ? uiState : {}, patch);
    if(FC.sessionNavigation && !FC.sessionNavigation.prepareEditState(proposed,true)) return false;
    const nextState = setUiStatePatch(patch);
    return applyFromState(nextState || proposed) !== false;
  }

  function back(){
    const st = (FC.uiState && FC.uiState.get) ? FC.uiState.get() : {};
    if(st && st.entry === 'app'){
      const nextState = setUiStatePatch({ entry:'rooms', roomType:null, activeTab:'pokoje', selectedCabinetId:null });
      return applyFromState(nextState || { entry:'rooms', roomType:null, activeTab:'pokoje' });
    }
    if(st && st.entry === 'investorsList') return openModeHub('furnitureProjects');
    if(st && st.entry === 'serviceOrdersList') return openModeHub('workshopServices');
    return openHome();
  }

  function guardedView(destination, action, options){
    const nav = FC.sessionNavigation;
    if(nav && typeof nav.requestTransition === 'function') return nav.requestTransition(destination, action, options);
    if(FC.session && FC.session.active) return false;
    return action();
  }

  FC.views = FC.views || {};
  const directView = (patch, action)=>{
    const state = Object.assign({}, typeof uiState !== 'undefined' ? uiState : {}, patch);
    if(FC.sessionNavigation && !FC.sessionNavigation.canApplyUiState(state)) return false;
    return action();
  };
  FC.views.showHome = ()=> directView({ entry:'home' }, showHome);
  FC.views.showModeHub = mode=> directView({ entry:'modeHub' }, ()=> showModeHub(mode));
  FC.views.showInvestorsList = ()=> directView({ entry:'investorsList' }, showInvestorsList);
  FC.views.showServiceOrdersList = ()=> directView({ entry:'serviceOrdersList' }, showServiceOrdersList);
  FC.views.showRooms = ()=> directView({ roomType:null }, showRooms);
  FC.views.showApp = ()=>{ const state = typeof uiState !== 'undefined' ? uiState : {}; return FC.sessionNavigation && !FC.sessionNavigation.prepareEditState(state) ? false : showApp(); };
  FC.views.showInvestor = showInvestor;
  FC.views.showRozrys = ()=>directView({activeTab:'rozrys'},showRozrys);
  FC.views.showMagazyn = showMagazyn;
  FC.views.applyFromState = applyFromState;
  FC.views.openHome = (...args)=> guardedView('strony głównej', ()=> openHome(...args));
  FC.views.openModeHub = (...args)=> guardedView('wyboru trybu pracy', ()=> openModeHub(...args));
  FC.views.openInvestorsList = (...args)=> guardedView('listy inwestorów', ()=> openInvestorsList(...args));
  FC.views.openServiceOrdersList = (...args)=> guardedView('listy zleceń', ()=> openServiceOrdersList(...args));
  FC.views.openRooms = (...args)=> guardedView('listy pomieszczeń', ()=> openRooms(...args));
  FC.views.openRoom = room=> FC.sessionNavigation ? guardedView('innego pomieszczenia', ()=> openRoom(room), { roomId:room }) : false;
  FC.views.back = (...args)=> guardedView('poprzedniego ekranu', ()=> back(...args));
  FC.views.refreshSessionButtons = refreshSessionButtons;
  FC.views.shouldOpenRoomlessWycena = shouldOpenRoomlessWycena;
})();
