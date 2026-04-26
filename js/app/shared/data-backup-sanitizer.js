(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const keysApi = root.FC.dataStorageKeys || {};

  function cloneJson(value){
    try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; }
  }

  function sanitizeSnapshot(snapshot){
    const snap = cloneJson(snapshot || {});
    const keys = snap && snap.keys && typeof snap.keys === 'object' ? snap.keys : null;
    if(!keys) return snap;
    Object.keys(keys).forEach((key)=>{
      const keep = keysApi.isAppDataKey ? keysApi.isAppDataKey(key) : String(key || '').indexOf('fc_') === 0;
      if(!keep) delete keys[key];
    });
    return snap;
  }

  function sanitizeBackup(backup){
    const row = cloneJson(backup || {});
    if(row && row.snapshot) row.snapshot = sanitizeSnapshot(row.snapshot);
    return row;
  }

  function sanitizeBackups(list){
    return (Array.isArray(list) ? list : []).map(sanitizeBackup).filter((item)=> item && item.id && item.snapshot);
  }

  root.FC.dataBackupSanitizer = { sanitizeSnapshot, sanitizeBackup, sanitizeBackups };
})();
