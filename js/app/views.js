// js/app/views.js
// View/router helpers: home vs rooms vs app + placeholder sections.
// Load after ui-state.js and before js/app.js.

(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function $(id){ return document.getElementById(id); }

  function showOnly(ids){
    const all = ['homeView','roomsView','investorsListView','appView','investorView','rozrysView','magazynView'];
    all.forEach(id => {
      const el = $(id);
      if(!el) return;
      el.style.display = ids.includes(id) ? 'block' : 'none';
    });
  }

  function setTabsVisible(on){
    const tabs = $('topTabs');
    if(tabs) tabs.style.display = on ? 'grid' : 'none';
  }

  function setBackVisible(on){
    const back = $('backToRooms');
    if(back) back.style.display = on ? 'inline-block' : 'none';
  }

  function setFloatingVisible(on){
    const fab = $('floatingAdd');
    if(fab) fab.style.display = on ? 'flex' : 'none';
  }

  function showHome(){
    showOnly(['homeView']);
    setTabsVisible(false);
    setBackVisible(false);
    setFloatingVisible(false);
  }

  
  function showInvestorsList(){
    showOnly(['investorsListView']);
    setTabsVisible(false);
    setBackVisible(false);
    setFloatingVisible(false);
  }

function showRooms(){
    showOnly(['roomsView']);
    setTabsVisible(true);
    setBackVisible(true);
    setFloatingVisible(false);
  }

  function showApp(){
    showOnly(['appView']);
    setTabsVisible(true);
    setBackVisible(true);
    setFloatingVisible(true);
  }

  function showInvestor(){
    showOnly(['investorView']);
    setTabsVisible(true);
    setBackVisible(true);
    setFloatingVisible(false);
  }

  function showRozrys(){
    showOnly(['rozrysView']);
    setTabsVisible(true);
    setBackVisible(true);
    setFloatingVisible(false);
  }

  function showMagazyn(){
    showOnly(['magazynView']);
    setTabsVisible(true);
    setBackVisible(true);
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
    if(entry === 'investors'){
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
      FC.uiState.set({ entry: 'investors', roomType: null });
    }
    applyFromState({ entry:'investors', roomType:null, activeTab:'pokoje' });
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
  FC.views.showRooms = showRooms;
  FC.views.showApp = showApp;
  FC.views.showInvestor = showInvestor;
  FC.views.showRozrys = showRozrys;
  FC.views.showMagazyn = showMagazyn;
  FC.views.applyFromState = applyFromState;
  FC.views.openHome = openHome;
  FC.views.openRooms = openRooms;
  FC.views.openRoom = openRoom;
  FC.views.back = back;
})();
