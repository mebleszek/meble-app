// js/app/session.js
// Minimal "session" layer: snapshot + restore localStorage keys.
// Used for Anuluj/Zapisz workflow (leave without saving vs commit).

(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const EXTRA_KEYS = [
    // investors store
    'fc_investors_v1',
    // correct key for current investor
    'fc_current_investor_v1',
    // investor UI state
    'fc_investor_ui_v1',
  ];

  const PROJECT_INV_PREFIX = 'fc_project_inv_';
  const PROJECT_INV_SUFFIX = '_v1';

  function getKeysToSnapshot(){
    const keys = [];
    const K = FC.constants && FC.constants.STORAGE_KEYS ? FC.constants.STORAGE_KEYS : null;
    if(K){
      Object.keys(K).forEach(k => { if(K[k]) keys.push(String(K[k])); });
    }
    EXTRA_KEYS.forEach(k => keys.push(k));

    // Include all per-investor project slots so Cancel can restore them.
    // (Without this, Cancel could revert only the active project and leave investor slots modified.)
    try{
      for(let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i);
        if(!k) continue;
        if(k.startsWith(PROJECT_INV_PREFIX) && k.endsWith(PROJECT_INV_SUFFIX)) keys.push(k);
      }
    }catch(_){ }
    // unique
    return Array.from(new Set(keys));
  }

  function readRaw(key){
    try{ return localStorage.getItem(key); }catch(_){ return null; }
  }
  function writeRaw(key, raw){
    try{
      if(raw === null || typeof raw === 'undefined') localStorage.removeItem(key);
      else localStorage.setItem(key, raw);
    }catch(_){ }
  }

  const session = {
    active: false,
    snapshot: null,
    begin(){
      // Idempotent: once we started an edit session, do not overwrite the snapshot.
      if(session.active && session.snapshot) return;
      const snap = {};
      for(const k of getKeysToSnapshot()) snap[k] = readRaw(k);
      session.snapshot = snap;
      session.active = true;
    },
    commit(){
      session.snapshot = null;
      session.active = false;
    },
    cancel(){
      if(!session.snapshot){ session.active = false; return; }
      for(const [k, raw] of Object.entries(session.snapshot)) writeRaw(k, raw);
      session.snapshot = null;
      session.active = false;
    }
  };

  FC.session = session;
})();
