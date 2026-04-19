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
    const dirty = !!(session && typeof session.isDirty === 'function' && session.isDirty());
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
    if(FC.uiState && FC.uiState.set) FC.uiState.set({ entry:'home', roomType:null, workMode:null });
    applyFromState({ entry:'home', roomType:null, activeTab:'pokoje', workMode:null });
  }

  function openModeHub(mode){
    const resolved = String(mode || 'furnitureProjects');
    if(FC.uiState && FC.uiState.set) FC.uiState.set({ entry:'modeHub', workMode:resolved, activeTab:null, roomType:null });
    applyFromState({ entry:'modeHub', workMode:resolved, activeTab:null, roomType:null });
  }

  function openInvestorsList(){
    if(FC.uiState && FC.uiState.set) FC.uiState.set({ entry:'investorsList', activeTab:null, currentInvestorId:null, workMode:'furnitureProjects' });
    applyFromState({ entry:'investorsList', activeTab:null, currentInvestorId:null, workMode:'furnitureProjects' });
  }

  function openServiceOrdersList(){
    if(FC.uiState && FC.uiState.set) FC.uiState.set({ entry:'serviceOrdersList', activeTab:null, roomType:null, currentInvestorId:null, workMode:'workshopServices' });
    applyFromState({ entry:'serviceOrdersList', activeTab:null, roomType:null, currentInvestorId:null, workMode:'workshopServices' });
  }

  function openRooms(){
    if(FC.uiState && FC.uiState.set) FC.uiState.set({ entry:'rooms', activeTab:'pokoje' });
    applyFromState({ entry:'rooms', activeTab:'pokoje' });
  }

  function openRoom(room){
    if(!room) return;
    if(FC.uiState && FC.uiState.set) FC.uiState.set({ entry:'app', roomType:room });
    applyFromState({ entry:'app', roomType:room });
  }

  function back(){
    const st = (FC.uiState && FC.uiState.get) ? FC.uiState.get() : {};
    if(st && st.entry === 'app'){
      if(FC.uiState && FC.uiState.set) FC.uiState.set({ entry:'rooms', roomType:null, activeTab:'pokoje' });
      return applyFromState({ entry:'rooms', roomType:null, activeTab:'pokoje' });
    }
    if(st && st.entry === 'investorsList') return openModeHub('furnitureProjects');
    if(st && st.entry === 'serviceOrdersList') return openModeHub('workshopServices');
    return openHome();
  }

  FC.views = FC.views || {};
  FC.views.showHome = showHome;
  FC.views.showModeHub = showModeHub;
  FC.views.showInvestorsList = showInvestorsList;
  FC.views.showServiceOrdersList = showServiceOrdersList;
  FC.views.showRooms = showRooms;
  FC.views.showApp = showApp;
  FC.views.showInvestor = showInvestor;
  FC.views.showRozrys = showRozrys;
  FC.views.showMagazyn = showMagazyn;
  FC.views.applyFromState = applyFromState;
  FC.views.openHome = openHome;
  FC.views.openModeHub = openModeHub;
  FC.views.openInvestorsList = openInvestorsList;
  FC.views.openServiceOrdersList = openServiceOrdersList;
  FC.views.openRooms = openRooms;
  FC.views.openRoom = openRoom;
  FC.views.back = back;
  FC.views.refreshSessionButtons = refreshSessionButtons;
  FC.views.shouldOpenRoomlessWycena = shouldOpenRoomlessWycena;
})();
