(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};

  const BACKUP_STORE_KEY = 'fc_data_backups_v1';
  const SNAPSHOT_KIND = 'meble-app-storage-snapshot';
  const EXPORT_KIND = 'meble-app-data-export';
  const BACKUP_KIND = 'meble-app-data-backup';
  const VERSION = 1;

  const SNAPSHOT_EXCLUDED_KEYS = new Set([
    BACKUP_STORE_KEY,
    'fc_project_backup_v1',
    'fc_project_backup_meta_v1',
    'fc_investors_backup_v1',
    'fc_investors_backup_meta_v1',
    'fc_rozrys_plan_cache_v1',
  ]);

  const VOLATILE_KEYS = new Set([
    'fc_edit_session_v1',
    'fc_reload_restore_v1',
    'fc_rozrys_plan_cache_v2',
  ]);

  const RESTORE_CLEANUP_KEYS = new Set([
    'fc_project_backup_v1',
    'fc_project_backup_meta_v1',
    'fc_investors_backup_v1',
    'fc_investors_backup_meta_v1',
    'fc_rozrys_plan_cache_v1',
  ]);

  function nowIso(){
    try{ return new Date().toISOString(); }catch(_){ return String(Date.now()); }
  }

  function isProjectSlotBackupKey(key){
    return /^fc_project_inv_.+_backup(?:_meta)?_v1$/.test(String(key || ''));
  }

  function isSnapshotExcludedKey(key){
    const k = String(key || '');
    return SNAPSHOT_EXCLUDED_KEYS.has(k) || isProjectSlotBackupKey(k);
  }

  function isAppDataKey(key){
    const k = String(key || '');
    if(!k) return false;
    if(isSnapshotExcludedKey(k)) return false;
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

  function cleanupAfterRestore(){
    cleanupVolatileKeys();
    RESTORE_CLEANUP_KEYS.forEach((key)=>{
      try{ localStorage.removeItem(key); }catch(_){ }
    });
    try{
      for(let i = localStorage.length - 1; i >= 0; i--){
        const key = String(localStorage.key(i) || '');
        if(isProjectSlotBackupKey(key)) localStorage.removeItem(key);
      }
    }catch(_){ }
  }

  root.FC.dataStorageKeys = {
    BACKUP_STORE_KEY,
    SNAPSHOT_KIND,
    EXPORT_KIND,
    BACKUP_KIND,
    VERSION,
    EXCLUDED_KEYS:Array.from(SNAPSHOT_EXCLUDED_KEYS),
    SNAPSHOT_EXCLUDED_KEYS:Array.from(SNAPSHOT_EXCLUDED_KEYS),
    VOLATILE_KEYS:Array.from(VOLATILE_KEYS),
    RESTORE_CLEANUP_KEYS:Array.from(RESTORE_CLEANUP_KEYS),
    nowIso,
    isProjectSlotBackupKey,
    isSnapshotExcludedKey,
    isAppDataKey,
    listStorageKeys,
    cleanupVolatileKeys,
    cleanupAfterRestore,
  };
})();
