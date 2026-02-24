/* core/actions.js — single registry for all UI actions (data-action) */
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const registry = Object.create(null);
  const locks = Object.create(null);

  function register(map){
    Object.keys(map||{}).forEach((k)=>{
      registry[k] = map[k];
    });
  }

  function has(action){ return typeof registry[action] === 'function'; }

  function dispatch(action, ctx){
    const fn = registry[action];
    if(typeof fn !== 'function'){
      throw new Error(`Brak handlera dla data-action="${action}" (Actions registry).`);
    }
    return !!fn(ctx || {});
  }

  // Prevent duplicate firings on mobile and after alert/confirm
  function lock(action){
    locks[action] = true;
    // unlock next tick by default; action can re-lock if needed
    setTimeout(()=>{ locks[action] = false; }, 0);
  }
  function isLocked(action){ return !!locks[action]; }

  function validateDOMActions(root){
    const elRoot = root || document;
    const els = elRoot.querySelectorAll('[data-action]');
    const unknown = [];
    els.forEach(el=>{
      const act = el.getAttribute('data-action');
      if(!act) return;
      if(!has(act)) unknown.push(act);
    });
    if(unknown.length){
      const uniq = Array.from(new Set(unknown)).sort();
      throw new Error('Nieznane data-action w HTML: ' + uniq.join(', ') + '. Dodaj je do Actions registry.');
    }
  }

  FC.actions = { register, dispatch, has, validateDOMActions, lock, isLocked };
})();
