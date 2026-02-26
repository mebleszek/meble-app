// js/app/views.js
// View/router helpers: show rooms list vs app view, tab switching.
// Load after ui-state.js and before js/app.js.

(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function $(id){ return document.getElementById(id); }

  function showRooms(){
    const rv = $('roomsView');
    const av = $('appView');
    const tabs = $('topTabs');
    if(rv) rv.style.display = 'block';
    if(av) av.style.display = 'none';
    if(tabs) tabs.style.display = 'none';
  }

  function showApp(){
    const rv = $('roomsView');
    const av = $('appView');
    const tabs = $('topTabs');
    if(rv) rv.style.display = 'none';
    if(av) av.style.display = 'block';
    if(tabs) tabs.style.display = 'inline-block';
  }

  function applyFromState(state){
    const st = state || (FC.uiState && FC.uiState.get ? FC.uiState.get() : {});
    if(st && st.roomType){
      showApp();
    }else{
      showRooms();
    }
  }

  function openRoom(room){
    if(!room) return;
    if(FC.uiState && FC.uiState.set){
      FC.uiState.set({ roomType: room });
    }
    applyFromState({ roomType: room });
  }

  function backToRooms(){
    if(FC.uiState && FC.uiState.set){
      FC.uiState.set({ roomType: null });
    }
    applyFromState({ roomType: null });
  }

  function setActiveTab(tab){
    if(!tab) return;
    if(FC.uiState && FC.uiState.set){
      FC.uiState.set({ activeTab: tab });
    }
    // Actual tab UI updates (classes) are handled by app.js renderers.
    // We only persist state here.
  }

  FC.views = FC.views || {};
  FC.views.showRooms = showRooms;
  FC.views.showApp = showApp;
  FC.views.applyFromState = applyFromState;
  FC.views.openRoom = openRoom;
  FC.views.backToRooms = backToRooms;
  FC.views.setActiveTab = setActiveTab;
})();
