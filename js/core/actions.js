// js/core/actions.js
// Central registry for UI actions (data-action="...").
// This file is intentionally tiny and dependency-free.
// It should load before app.js.

(function(){
  'use strict';

  const root = (typeof window !== 'undefined') ? window : globalThis;
  root.FC = root.FC || {};

  const registry = Object.create(null);
  const locks = Object.create(null);

  function register(map){
    if(!map || typeof map !== 'object') return;
    for(const k of Object.keys(map)){
      if(typeof map[k] === 'function') registry[k] = map[k];
    }
  }

  function has(action){
    return typeof registry[action] === 'function';
  }

  // One-shot lock to guard pointerup->click replays on mobile.
  function lock(action, ms){
    const ttl = Number.isFinite(ms) ? ms : 800;
    locks[action] = Date.now() + ttl;
  }
  function isLocked(action){
    return (locks[action] || 0) > Date.now();
  }

  function dispatch(action, ctx){
    const fn = registry[action];
    if(typeof fn !== 'function') return false;
    try{
      return !!fn(ctx || {});
    }catch(e){
      // Let boot.js banner catch it.
      throw e;
    }
  }

  // Fail-fast validation: if the DOM contains data-action that isn't registered,
  // throw with a readable list (caught by boot.js banner).
  function validateDOMActions(){
    const nodes = root.document ? root.document.querySelectorAll('[data-action]') : [];
    const unknown = new Set();
    for(const el of nodes){
      const a = el.getAttribute('data-action');
      if(!a) continue;
      if(!has(a)) unknown.add(a);
    }
    if(unknown.size){
      throw new Error('Nieznane data-action w HTML: ' + Array.from(unknown).join(', ') + '. Dodaj je do Actions registry.');
    }
    return true;
  }

  root.FC.actions = { register, dispatch, has, validateDOMActions, lock, isLocked };
})();
