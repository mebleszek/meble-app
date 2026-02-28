// js/app/views.js
// View/router helpers: home vs rooms vs app + placeholder sections.
// Load after ui-state.js and before js/app.js.

(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function $(id){ return document.getElementById(id); }

  function showOnly(ids){
    const all = ['homeView','roomsView','appView','investorView','rozrysView','magazynView','investorsListView'];
    all.forEach(id => {
      const el = $(id);
      if(!el) return;
      el.style.display = ids.includes(id) ? 'block' : 'none';
    });
  }

  function setTopBarVisible(on){
    const tb = $('topBar');
    if(tb) tb.style.display = on ? 'flex' : 'none';
  }

  function setTabsVisible(on){
    const tabs = $('topTabs');
    if(tabs) tabs.style.display = on ? 'grid' : 'none';
    setTopBarVisible(!!on);
  }

  function setSessionButtonsVisible(on){
    const sb = $('sessionButtons');
    if(sb) sb.style.display = on ? 'flex' : 'none';
  }

  function setFloatingVisible(on){
    const fab = $('floatingAdd');
    if(fab) fab.style.display = on ? 'flex' : 'none';
  }

  function showHome(){
    showOnly(['homeView']);
    setTabsVisible(false);
    setSessionButtonsVisible(false);
    setFloatingVisible(false);
  }

  function showInvestorsList(){
    showOnly(['investorsListView']);
    setTabsVisible(false);
    setSessionButtonsVisible(false);
    setFloatingVisible(false);
    // best effort render for refresh
    try{
      const root = $('investorsListRoot');
      if(root && window.FC && window.FC.investorUI && typeof window.FC.investorUI.renderListOnly === 'function'){
        window.FC.investorUI.state.mode = 'list';
        window.FC.investorUI.state.allowListAccess = false;
        window.FC.investorUI.renderListOnly(root);
      }
    }catch(_){ }
  }

  function showRooms(){
    showOnly(['roomsView']);
    setTabsVisible(true);
    setSessionButtonsVisible(true);
    setFloatingVisible(false);
  }

  function showApp(){
    showOnly(['appView']);
    setTabsVisible(true);
    setSessionButtonsVisible(true);
    setFloatingVisible(true);
  }

  function showInvestor(){
    showOnly(['investorView']);
    setTabsVisible(true);
    setSessionButtonsVisible(true);
    setFloatingVisible(false);
  }

  function showRozrys(){
    showOnly(['rozrysView']);
    setTabsVisible(true);
    setSessionButtonsVisible(true);
    setFloatingVisible(false);
  }

  function showMagazyn(){
    showOnly(['magazynView']);
    setTabsVisible(true);
    setSessionButtonsVisible(true);
    setFloatingVisible(false);
  }

  function applyFromState(state){
    const st = state || (FC.uiState && FC.uiState.get ? FC.uiState.get() : {});
    const entry = st && st.entry ? st.entry : 'home';
    const tab = st && st.activeTab ? st.activeTab : null;

    if(entry === 'home'){
      showHome();
      return;
    }
    if(entry === 'investorsList'){
      showInvestorsList();
      return;
    }
    // entry rooms/app: tab may override
    if(tab === 'inwestor') return showInvestor();
    if(tab === 'rozrys') return showRozrys();
    if(tab === 'magazyn') return showMagazyn();
    if(tab === 'pokoje') return showRooms();

    if(entry === 'app' && st && st.roomType){
      return showApp();
    }
    // fallback
    return showRooms();
  }

  function openHome(){
    if(FC.uiState && FC.uiState.set){
      FC.uiState.set({ entry: 'home', roomType: null });
    }
    applyFromState({ entry:'home', roomType:null, activeTab:'pokoje' });
  }

  function openInvestorsList(){
    if(FC.uiState && FC.uiState.set){
      FC.uiState.set({ entry:'investorsList', activeTab:null });
    }
    applyFromState({ entry:'investorsList' });
  }

  function openRooms(){
    if(FC.uiState && FC.uiState.set){
      FC.uiState.set({ entry: 'rooms', activeTab: 'pokoje' });
    }
    applyFromState({ entry:'rooms', activeTab:'pokoje' });
  }

  function openRoom(room){
    if(!room) return;
    if(FC.uiState && FC.uiState.set){
      FC.uiState.set({ entry:'app', roomType: room });
    }
    applyFromState({ entry:'app', roomType: room });
  }

  function back(){
    const st = (FC.uiState && FC.uiState.get) ? FC.uiState.get() : {};
    if(st && st.entry === 'app'){
      // back to rooms
      if(FC.uiState && FC.uiState.set){
        FC.uiState.set({ entry:'rooms', roomType:null, activeTab:'pokoje' });
      }
      return applyFromState({ entry:'rooms', roomType:null, activeTab:'pokoje' });
    }
    // from rooms/placeholder -> home
    return openHome();
  }

  FC.views = FC.views || {};
  FC.views.showHome = showHome;
  FC.views.showInvestorsList = showInvestorsList;
  FC.views.showRooms = showRooms;
  FC.views.showApp = showApp;
  FC.views.showInvestor = showInvestor;
  FC.views.showRozrys = showRozrys;
  FC.views.showMagazyn = showMagazyn;
  FC.views.applyFromState = applyFromState;
  FC.views.openHome = openHome;
  FC.views.openInvestorsList = openInvestorsList;
  FC.views.openRooms = openRooms;
  FC.views.openRoom = openRoom;
  FC.views.back = back;
})();
