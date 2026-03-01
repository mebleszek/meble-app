// js/tabs/rysunek.js
// Zakładka RYSUNEK — wykorzystuje renderer z app.js.

(function(){
  'use strict';
  window.FC = window.FC || {};

  function render(ctx){
    const list = ctx && ctx.listEl;
    const room = ctx && ctx.room;
    if(!list || !room) return;

    try{
      if(typeof window.renderDrawingTab === 'function'){
        window.renderDrawingTab(list, room);
        return;
      }
    }catch(e){
      try{ console.error('[rysunek] render error', e); }catch(_){ }
    }

    // Fail-soft: pokaż cokolwiek zamiast pustej sekcji
    try{
      list.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'build-card';
      card.innerHTML = '<h3>Rysunek</h3><p class="muted">Nie udało się wyrenderować widoku. Odśwież stronę.</p>';
      list.appendChild(card);
    }catch(_){ }
  }

  function registerWithRetry(tries){
    tries = tries || 0;
    const reg = (window.FC && window.FC.tabsRouter && typeof window.FC.tabsRouter.register === 'function')
      ? window.FC.tabsRouter.register
      : ((window.FC.tabs && typeof window.FC.tabs.register === 'function') ? window.FC.tabs.register : null);

    if(typeof reg === 'function'){
      reg('rysunek', { mount(){}, render, unmount(){} });
      return;
    }

    if(tries < 30){
      setTimeout(()=>registerWithRetry(tries+1), 25);
    }
  }

  registerWithRetry(0);
})();
