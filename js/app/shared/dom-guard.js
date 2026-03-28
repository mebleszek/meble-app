(function(){
  'use strict';
  const REQUIRED = ['#roomsView','#appView','#topTabs','#backToRooms','#floatingAdd','#openMaterialsBtn','#openServicesBtn','#priceModal','#closePriceModal','#cabinetModal','#closeCabinetModal'];

  function validateRequiredDOM(){
    const missing = [];
    for(const sel of REQUIRED){
      try{ if(!document.querySelector(sel)) missing.push(sel); }
      catch(_){ missing.push(sel); }
    }
    if(missing.length){
      throw new Error(
        'Brak wymaganych elementów DOM: ' + missing.join(', ') +
        '\nNajczęściej: zmieniłeś ID/strukturę w index.html albo wgrałeś niepełne pliki.'
      );
    }
  }

  window.FC = window.FC || {};
  window.FC.domGuard = Object.assign(window.FC.domGuard || {}, { REQUIRED, validateRequiredDOM });
  try{ window.APP_REQUIRED_SELECTORS = REQUIRED.slice(); }catch(_){ }
})();
