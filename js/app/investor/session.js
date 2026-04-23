// js/app/investor/session.js
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
    // material tab per-part settings / edge choices
    'fc_edge_v1',
    'fc_material_part_options_v1',
  ];

  const PROJECT_INV_PREFIX = 'fc_project_inv_';
  const PROJECT_INV_SUFFIX = '_v1';
  const SESSION_STORAGE_KEY = 'fc_edit_session_v1';
  const DIRTY_CACHE_WINDOW_MS = 120;
  const TRACKING_IGNORE_KEYS = new Set([SESSION_STORAGE_KEY]);

  function getKeysToSnapshot(){
    const keys = [];
    const K = FC.constants && FC.constants.STORAGE_KEYS ? FC.constants.STORAGE_KEYS : null;
    if(K){
      Object.keys(K).forEach((k)=> { if(K[k]) keys.push(String(K[k])); });
    }
    EXTRA_KEYS.forEach((k)=> keys.push(k));

    // Include all per-investor project slots so Cancel can restore them.
    // (Without this, Cancel could revert only the active project and leave investor slots modified.)
    try{
      for(let i = 0; i < localStorage.length; i++){
        const k = localStorage.key(i);
        if(!k) continue;
        if(k.startsWith(PROJECT_INV_PREFIX) && k.endsWith(PROJECT_INV_SUFFIX)) keys.push(k);
      }
    }catch(_){ }
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

  function invalidateDirtyCache(){
    session.lastDirtyCheckAt = 0;
    session.lastDirtyValue = false;
    session.changedKeys = new Set();
  }


  function hasComparableKey(key){
    const comparable = getComparableKeys();
    return comparable.includes(String(key || ''));
  }

  function shouldTrackKey(key){
    const normalizedKey = String(key || '');
    if(!normalizedKey || TRACKING_IGNORE_KEYS.has(normalizedKey)) return false;
    if(!session.active || !session.snapshot || session.suspendTracking) return false;
    if(hasComparableKey(normalizedKey)) return true;
    return normalizedKey.startsWith(PROJECT_INV_PREFIX) && normalizedKey.endsWith(PROJECT_INV_SUFFIX);
  }

  function trackKeyMutation(key, nextRaw){
    const normalizedKey = String(key || '');
    if(!shouldTrackKey(normalizedKey)) return;
    const before = Object.prototype.hasOwnProperty.call(session.snapshot || {}, normalizedKey) ? session.snapshot[normalizedKey] : null;
    if(before !== nextRaw) session.changedKeys.add(normalizedKey);
    else session.changedKeys.delete(normalizedKey);
    session.lastDirtyCheckAt = Date.now();
    session.lastDirtyValue = session.changedKeys.size > 0;
  }

  function withTrackingSuspended(work){
    const previous = !!session.suspendTracking;
    session.suspendTracking = true;
    try{ return typeof work === 'function' ? work() : undefined; }
    finally{ session.suspendTracking = previous; }
  }

  function installStorageTracking(){
    try{
      const storage = localStorage;
      if(!storage || storage.__fcSessionTrackingInstalled) return;
      const rawSetItem = typeof storage.setItem === 'function' ? storage.setItem.bind(storage) : null;
      const rawRemoveItem = typeof storage.removeItem === 'function' ? storage.removeItem.bind(storage) : null;
      const rawClear = typeof storage.clear === 'function' ? storage.clear.bind(storage) : null;
      if(rawSetItem){
        storage.setItem = function(key, value){
          rawSetItem(key, value);
          trackKeyMutation(key, String(value));
        };
      }
      if(rawRemoveItem){
        storage.removeItem = function(key){
          rawRemoveItem(key);
          trackKeyMutation(key, null);
        };
      }
      if(rawClear){
        storage.clear = function(){
          rawClear();
          try{
            getComparableKeys().forEach((key)=> trackKeyMutation(key, null));
          }catch(_){ }
        };
      }
      storage.__fcSessionTrackingInstalled = true;
    }catch(_){ }
  }

  function getComparableKeys(){
    if(Array.isArray(session.comparableKeys) && session.comparableKeys.length) return session.comparableKeys;
    const keys = new Set(Object.keys(session.snapshot || {}));
    try{ getKeysToSnapshot().forEach((k)=> keys.add(k)); }catch(_){ }
    session.comparableKeys = Array.from(keys);
    return session.comparableKeys;
  }

  function isDirty(){
    if(!session.active || !session.snapshot) return false;
    if(session.changedKeys && session.changedKeys.size) return true;
    const now = Date.now();
    if(session.lastDirtyCheckAt && (now - session.lastDirtyCheckAt) < DIRTY_CACHE_WINDOW_MS){
      return !!session.lastDirtyValue;
    }
    let dirty = false;
    try{
      for(const k of getComparableKeys()){
        const before = Object.prototype.hasOwnProperty.call(session.snapshot, k) ? session.snapshot[k] : null;
        const current = readRaw(k);
        if(before !== current){
          dirty = true;
          if(session.changedKeys) session.changedKeys.add(k);
          break;
        }
      }
    }catch(_){ }
    session.lastDirtyCheckAt = now;
    session.lastDirtyValue = dirty;
    return dirty;
  }

  function persistSession(){
    try{
      withTrackingSuspended(()=> {
        const payload = {
          active: !!session.active,
          snapshot: session.snapshot || null
        };
        if(!payload.active && !payload.snapshot){
          localStorage.removeItem(SESSION_STORAGE_KEY);
          return;
        }
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
      });
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
      session.comparableKeys = session.snapshot ? Array.from(new Set(Object.keys(session.snapshot))) : null;
      session.changedKeys = new Set();
      if(!session.active && !session.snapshot){
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }catch(_){ }
    invalidateDirtyCache();
  }

  const session = {
    active: false,
    snapshot: null,
    comparableKeys: null,
    changedKeys: new Set(),
    suspendTracking: false,
    lastDirtyCheckAt: 0,
    lastDirtyValue: false,
    begin(){
      // Idempotent: once we started an edit session, do not overwrite the snapshot.
      if(session.active && session.snapshot) return;
      const keys = getKeysToSnapshot();
      const snap = {};
      keys.forEach((k)=> { snap[k] = readRaw(k); });
      session.snapshot = snap;
      session.comparableKeys = keys.slice();
      session.active = true;
      invalidateDirtyCache();
      persistSession();
    },
    commit(){
      withTrackingSuspended(()=> {
        session.snapshot = null;
        session.comparableKeys = null;
        session.active = false;
        invalidateDirtyCache();
        persistSession();
      });
    },
    cancel(){
      if(!session.snapshot){
        withTrackingSuspended(()=> {
          session.active = false;
          session.comparableKeys = null;
          invalidateDirtyCache();
          persistSession();
        });
        return;
      }
      withTrackingSuspended(()=> {
        for(const [k, raw] of Object.entries(session.snapshot)) writeRaw(k, raw);
        session.snapshot = null;
        session.comparableKeys = null;
        session.active = false;
        invalidateDirtyCache();
        persistSession();
      });
    },
    invalidateDirtyCache,
    isDirty,
    trackKeyMutation,
    withTrackingSuspended
  };

  restoreSession();
  installStorageTracking();
  FC.session = session;
})();
