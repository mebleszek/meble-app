// js/tabs/wycena.js
// Zakładka WYCENA — placeholder w osobnym module.

(function(){
  'use strict';
  window.FC = window.FC || {};

  function render(ctx){
    const list = ctx && ctx.listEl;
    if(!list) return;
    list.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'build-card';
    card.innerHTML = '<h3>Wycena</h3><p class="muted">Sekcja w przygotowaniu.</p>';
    list.appendChild(card);
  }

  (window.FC.tabsRouter || window.FC.tabs || {}).register?.('wycena', { mount(){}, render, unmount(){} });
})();
