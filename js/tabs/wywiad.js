// js/tabs/wywiad.js
// Zakładka WYWIAD (lista szafek + szczegóły).

(function(){
  'use strict';
  window.FC = window.FC || {};

  function render(ctx){
    try{
      if(typeof window.renderWywiadTab === 'function'){
        window.renderWywiadTab(ctx.listEl, ctx.room);
        return;
      }
      if(typeof window.renderCabinets === 'function') window.renderCabinets();
    }catch(_){ }
  }

  window.FC.tabsWywiad = {
    renderWywiadTab(list, room){
      if(typeof window.renderWywiadTab === 'function') return window.renderWywiadTab(list, room);
    }
  };

  (window.FC.tabsRouter || window.FC.tabs || {}).register?.('wywiad', { mount(){}, render, unmount(){} });
})();
