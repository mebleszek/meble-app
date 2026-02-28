// js/app/session.js
// Minimal "session" layer: snapshot + restore localStorage keys.
// Used for Anuluj/Zapisz workflow (leave without saving vs commit).

(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const EXTRA_KEYS = [
    'fc_investors_v1',
    'fc_investors_current_v1',
    'fc_investor_ui_v1',
  ];

  function getKeysToSnapshot(){
    const keys = [];
    const K = FC.constants && FC.constants.STORAGE_KEYS ? FC.constants.STORAGE_KEYS : null;
    if(K){
      Object.keys(K).forEach(k => { if(K[k]) keys.push(String(K[k])); });
    }
    EXTRA_KEYS.forEach(k => keys.push(k));
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
