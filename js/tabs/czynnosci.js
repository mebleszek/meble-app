// js/tabs/czynnosci.js
// Zakładka CZYNNOŚCI — placeholder w osobnym module.

(function(){
  'use strict';
  window.FC = window.FC || {};

  function render(ctx){
    const list = ctx && ctx.listEl;
    if(!list) return;
    list.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'build-card';
    card.innerHTML = '<h3>Czynności</h3><p class="muted">Sekcja w przygotowaniu.</p>';
    list.appendChild(card);
  }

  window.FC.tabsCzynnosci = window.FC.tabsCzynnosci || { render };

  function registerWithRetry(tries){
    tries = tries || 0;
    const reg = (window.FC && window.FC.tabsRouter && typeof window.FC.tabsRouter.register === 'function')
      ? window.FC.tabsRouter.register
      : ((window.FC.tabs && typeof window.FC.tabs.register === 'function') ? window.FC.tabs.register : null);
    if(typeof reg === 'function'){
      reg('czynnosci', { mount(){}, render, unmount(){} });
      return;
    }
    if(tries < 30) setTimeout(()=>registerWithRetry(tries + 1), 25);
  }

  registerWithRetry(0);
})();
