(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function shouldHideRoomSettingsForTab(tabName){
    return String(tabName || '').trim().toLowerCase() === 'wycena';
  }

  FC.appView = FC.appView || {};
  FC.appView.shouldHideRoomSettingsForTab = shouldHideRoomSettingsForTab;
})();
