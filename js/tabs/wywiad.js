// js/tabs/wywiad.js
// Zakładka WYWIAD (lista szafek + szczegóły). Wykorzystuje istniejące funkcje z app.js.

(function(){
  'use strict';
  window.FC = window.FC || {};

  function render(ctx){
    try{
      if(typeof window.renderWywiadTab === 'function'){
        window.renderWywiadTab(ctx.listEl, ctx.room);
        return;
      }
      // Fallback: jeśli coś pójdzie nie tak — spróbuj starego renderCabinets.
      if(typeof window.renderCabinets === 'function') window.renderCabinets();
    }catch(_){ }
  }

  (window.FC.tabsRouter || window.FC.tabs || {}).register?.('wywiad', { mount(){}, render, unmount(){} });
})();
