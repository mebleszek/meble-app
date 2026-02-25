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

  // Default handlers for core price-list edit buttons.
  // These are registered here so validateDOMActions can run early (before app.js extends the registry).
  // app.js may overwrite these with richer implementations later.
  register({
    'save-material': () => {
      const btn = document.getElementById('savePriceBtn');
      if(btn && typeof btn.onclick === 'function') { btn.onclick(); return true; }
      return false;
    },
    'cancel-material-edit': () => {
      const btn = document.getElementById('cancelEditBtn');
      if(btn && typeof btn.onclick === 'function') { btn.onclick(); return true; }
      return false;
    },
    'save-service': () => {
      const btn = document.getElementById('saveServiceBtn');
      if(btn && typeof btn.onclick === 'function') { btn.onclick(); return true; }
      return false;
    },
    'cancel-service-edit': () => {
      const btn = document.getElementById('cancelServiceEditBtn');
      if(btn && typeof btn.onclick === 'function') { btn.onclick(); return true; }
      return false;
    },
  });

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
