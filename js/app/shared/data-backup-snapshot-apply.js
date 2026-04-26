(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const keysApi = root.FC.dataStorageKeys || {};
  const normalizer = root.FC.dataBackupSnapshotNormalizer || {};

  function applySnapshot(snapshot, options){
    const snap = normalizer.normalizeSnapshot ? normalizer.normalizeSnapshot(snapshot) : null;
    if(!(snap && snap.keys && typeof snap.keys === 'object')) throw new Error('Nieprawidłowy format backupu danych.');
    const opts = Object.assign({ clearMissing:true }, options || {});
    const isAppDataKey = keysApi.isAppDataKey || (()=> false);
    const incoming = Object.keys(snap.keys).filter(isAppDataKey).sort();
    if(opts.clearMissing && typeof keysApi.listStorageKeys === 'function'){
      keysApi.listStorageKeys().forEach((key)=>{
        if(!incoming.includes(key)){
          try{ localStorage.removeItem(key); }catch(_){ }
        }
      });
    }
    incoming.forEach((key)=>{
      const raw = snap.keys[key];
      try{
        if(raw == null) localStorage.removeItem(key);
        else localStorage.setItem(key, String(raw));
      }catch(_){ }
    });
    if(opts.clearVolatile !== false){
      if(typeof keysApi.cleanupAfterRestore === 'function') keysApi.cleanupAfterRestore();
      else if(typeof keysApi.cleanupVolatileKeys === 'function') keysApi.cleanupVolatileKeys();
    }
    return { restoredKeys: incoming.length };
  }

  root.FC.dataBackupSnapshotApply = { applySnapshot };
})();
