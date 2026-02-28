// js/app/tabs-router.js
// Centralny router zakładek: każda zakładka ma swój moduł (mount/render/unmount).
// Minimalny, odporny na błędy (fail-soft): jeśli moduł nie istnieje — pokazuje placeholder.

(function(){
  'use strict';

  window.FC = window.FC || {};

  const registry = Object.create(null);
  let current = null;
  const mounted = Object.create(null);

  function register(tabName, mod){
    if(!tabName) return;
    registry[String(tabName)] = mod || {};
  }

  function get(tabName){
    return registry[String(tabName)] || null;
  }

  function _safeCall(fn, ctx){
    try{ if(typeof fn === 'function') fn(ctx); }catch(e){
      try{ console.error('[tabs-router] error:', e); }catch(_){ }
    }
  }

  function renderPlaceholder(ctx){
    const list = ctx && ctx.listEl;
    if(!list) return;
    list.innerHTML = '';
    const buildCard = document.createElement('div');
    buildCard.className='build-card';
    buildCard.innerHTML = '<h3>Strona w budowie</h3><p class="muted">Sekcja jest w trakcie przygotowania.</p>';
    list.appendChild(buildCard);
  }

  function switchTo(tabName, ctx){
    const next = String(tabName || '');
    const nextMod = get(next);

    if(current && current !== next){
      const prevMod = get(current);
      _safeCall(prevMod && prevMod.unmount, ctx);
    }

    current = next;

    if(nextMod){
      if(!mounted[next]){
        mounted[next] = true;
        _safeCall(nextMod.mount, ctx);
      }
      if(typeof nextMod.render === 'function'){
        _safeCall(nextMod.render, ctx);
        return;
      }
    }

    renderPlaceholder(ctx);
  }

  window.FC.tabs = window.FC.tabs || { register, get };
  window.FC.tabsRouter = { register, get, switchTo };
})();
