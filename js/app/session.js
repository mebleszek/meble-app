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
  const SESSION_STORAGE_KEY = 'fc_edit_session_v1';

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

  function getComparableKeys(){
    const keys = new Set(Object.keys(session.snapshot || {}));
    try{ getKeysToSnapshot().forEach((k)=> keys.add(k)); }catch(_){ }
    return Array.from(keys);
  }

  function isDirty(){
    if(!session.active || !session.snapshot) return false;
    try{
      for(const k of getComparableKeys()){
        const before = Object.prototype.hasOwnProperty.call(session.snapshot, k) ? session.snapshot[k] : null;
        const now = readRaw(k);
        if(before !== now) return true;
      }
    }catch(_){ }
    return false;
  }

  function persistSession(){
    try{
      const payload = {
        active: !!session.active,
        snapshot: session.snapshot || null
      };
      if(!payload.active && !payload.snapshot){
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return;
      }
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    }catch(_){ }
  }

  function restoreSession(){
    try{
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if(!raw) return;
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== 'object') return;
      session.active = !!parsed.active;
      session.snapshot = parsed.snapshot && typeof parsed.snapshot === 'object' ? parsed.snapshot : null;
      if(!session.active && !session.snapshot){
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
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
      persistSession();
    },
    commit(){
      session.snapshot = null;
      session.active = false;
      persistSession();
      persistSession();
    },
    cancel(){
      if(!session.snapshot){ session.active = false; persistSession(); return; }
      for(const [k, raw] of Object.entries(session.snapshot)) writeRaw(k, raw);
      session.snapshot = null;
      session.active = false;
      persistSession();
    },
    isDirty
  };

  restoreSession();
  FC.session = session;
})();
