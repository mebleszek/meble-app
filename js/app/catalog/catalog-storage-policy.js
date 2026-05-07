(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const BACKUP_KEYS = {
    hardwareSuppliers: 'fc_hardware_suppliers_v1',
    hardwareSettings: 'fc_hardware_settings_v1',
  };

  const LEGACY_KEYS = {
    hardwareSuppliers: 'hardwareSuppliers',
    hardwareSettings: 'hardwareSettings',
  };

  function cloneFallback(value, cloneFn){
    try{ return typeof cloneFn === 'function' ? cloneFn(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return value; }
  }

  function hasManagedKey(key){
    return Object.prototype.hasOwnProperty.call(BACKUP_KEYS, String(key || ''));
  }

  function resolveKey(constantsKeys, logicalKey){
    const key = String(logicalKey || '');
    return (constantsKeys && constantsKeys[key]) || BACKUP_KEYS[key] || key;
  }

  function legacyKey(logicalKey){
    return LEGACY_KEYS[String(logicalKey || '')] || '';
  }

  function readRaw(storage, key){
    try{
      if(storage && typeof storage.getRaw === 'function') return storage.getRaw(key);
      if(typeof localStorage !== 'undefined') return localStorage.getItem(key);
    }catch(_){ }
    return null;
  }

  function removeRaw(storage, key){
    try{
      if(storage && typeof storage.removeRaw === 'function') storage.removeRaw(key);
      else if(typeof localStorage !== 'undefined') localStorage.removeItem(key);
    }catch(_){ }
  }

  function parseJson(raw, fallback, cloneFn){
    if(typeof raw !== 'string' || raw === '') return cloneFallback(fallback, cloneFn);
    try{ return JSON.parse(raw); }
    catch(_){ return cloneFallback(fallback, cloneFn); }
  }

  function readJSON(storage, constantsKeys, logicalKey, fallback, cloneFn){
    const primary = resolveKey(constantsKeys, logicalKey);
    const legacy = legacyKey(logicalKey);
    const primaryRaw = readRaw(storage, primary);
    if(primaryRaw != null) return parseJson(primaryRaw, fallback, cloneFn);
    if(legacy && legacy !== primary){
      const legacyRaw = readRaw(storage, legacy);
      if(legacyRaw != null) return parseJson(legacyRaw, fallback, cloneFn);
    }
    return cloneFallback(fallback, cloneFn);
  }

  function writeJSON(storage, constantsKeys, logicalKey, value){
    const primary = resolveKey(constantsKeys, logicalKey);
    const legacy = legacyKey(logicalKey);
    try{
      if(storage && typeof storage.setJSON === 'function') storage.setJSON(primary, value);
    }catch(_){ }
    const primarySaved = readRaw(storage, primary) != null;
    if(primarySaved && legacy && legacy !== primary && readRaw(storage, legacy) != null) removeRaw(storage, legacy);
    return value;
  }

  FC.catalogStoragePolicy = {
    BACKUP_KEYS,
    LEGACY_KEYS,
    hasManagedKey,
    resolveKey,
    legacyKey,
    readJSON,
    writeJSON,
  };
})();
