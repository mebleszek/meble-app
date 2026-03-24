(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};

  const STORAGE_KEY = 'fc_rozrys_grain_state_v1';

  function loadAll(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object') ? obj : {};
    }catch(_){ return {}; }
  }

  function saveAll(state){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state || {})); }catch(_){ }
  }

  function normalizeEntry(entry, defaults){
    const base = defaults || {};
    const src = (entry && typeof entry === 'object') ? entry : {};
    const exceptions = (src.exceptions && typeof src.exceptions === 'object') ? src.exceptions : {};
    return {
      enabled: ('enabled' in src) ? !!src.enabled : !!base.enabled,
      exceptions
    };
  }

  function getEntry(material, defaults){
    const name = String(material || '').trim();
    const all = loadAll();
    return normalizeEntry(name ? all[name] : null, defaults);
  }

  function setEntry(material, patch, defaults){
    const name = String(material || '').trim();
    if(!name) return;
    const all = loadAll();
    const next = Object.assign({}, getEntry(name, defaults), patch || {});
    all[name] = normalizeEntry(next, defaults);
    saveAll(all);
  }

  function getMaterialEnabled(material, hasGrain){
    return !!getEntry(material, { enabled: !!hasGrain }).enabled;
  }

  function setMaterialEnabled(material, enabled, hasGrain){
    setEntry(material, { enabled: !!enabled }, { enabled: !!hasGrain });
  }

  function getMaterialExceptions(material){
    return Object.assign({}, getEntry(material, { enabled:true }).exceptions || {});
  }

  function setMaterialExceptions(material, exceptions, hasGrain){
    const next = (exceptions && typeof exceptions === 'object') ? exceptions : {};
    setEntry(material, { exceptions: next }, { enabled: !!hasGrain });
  }

  function pruneMaterialExceptions(material, allowedKeys, hasGrain){
    const allow = new Set(Array.isArray(allowedKeys) ? allowedKeys.map((k)=> String(k || '')) : []);
    const src = getMaterialExceptions(material);
    const next = {};
    Object.keys(src).forEach((key)=>{
      if(allow.has(String(key || ''))) next[key] = !!src[key];
    });
    setMaterialExceptions(material, next, hasGrain);
    return next;
  }

  root.FC.rozrysGrain = {
    STORAGE_KEY,
    loadAll,
    saveAll,
    getEntry,
    setEntry,
    getMaterialEnabled,
    setMaterialEnabled,
    getMaterialExceptions,
    setMaterialExceptions,
    pruneMaterialExceptions,
  };
})();
