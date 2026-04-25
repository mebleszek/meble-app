(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};

  const BACKUP_STORE_KEY = 'fc_data_backups_v1';
  const SNAPSHOT_KIND = 'meble-app-storage-snapshot';
  const EXPORT_KIND = 'meble-app-data-export';
  const BACKUP_KIND = 'meble-app-data-backup';
  const VERSION = 1;

  const EXCLUDED_KEYS = new Set([BACKUP_STORE_KEY]);
  const VOLATILE_KEYS = new Set([
    'fc_edit_session_v1',
    'fc_reload_restore_v1',
    'fc_rozrys_plan_cache_v2',
  ]);

  function nowIso(){
    try{ return new Date().toISOString(); }catch(_){ return String(Date.now()); }
  }

  function isAppDataKey(key){
    const k = String(key || '');
    if(!k) return false;
    if(EXCLUDED_KEYS.has(k)) return false;
    if(VOLATILE_KEYS.has(k)) return false;
    return k.indexOf('fc_') === 0;
  }

  function listStorageKeys(){
    const keys = [];
    try{
      for(let i = 0; i < localStorage.length; i++){
        const key = localStorage.key(i);
        if(isAppDataKey(key)) keys.push(String(key));
      }
    }catch(_){ }
    return keys.sort();
  }

  function cleanupVolatileKeys(){
    VOLATILE_KEYS.forEach((key)=>{
      try{ localStorage.removeItem(key); }catch(_){ }
    });
  }

  root.FC.dataStorageKeys = {
    BACKUP_STORE_KEY,
    SNAPSHOT_KIND,
    EXPORT_KIND,
    BACKUP_KIND,
    VERSION,
    EXCLUDED_KEYS:Array.from(EXCLUDED_KEYS),
    VOLATILE_KEYS:Array.from(VOLATILE_KEYS),
    nowIso,
    isAppDataKey,
    listStorageKeys,
    cleanupVolatileKeys,
  };
})();
