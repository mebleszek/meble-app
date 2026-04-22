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
    render(ctx){ return render(ctx || {}); },
    renderWywiadTab(list, room){
      if(typeof window.renderWywiadTab === 'function') return window.renderWywiadTab(list, room);
    }
  };

  function registerWithRetry(tries){
    tries = tries || 0;
    const reg = (window.FC && window.FC.tabsRouter && typeof window.FC.tabsRouter.register === 'function')
      ? window.FC.tabsRouter.register
      : ((window.FC.tabs && typeof window.FC.tabs.register === 'function') ? window.FC.tabs.register : null);
    if(typeof reg === 'function'){
      reg('wywiad', { mount(){}, render, unmount(){} });
      return;
    }
    if(tries < 30) setTimeout(()=>registerWithRetry(tries + 1), 25);
  }

  registerWithRetry(0);
})();
