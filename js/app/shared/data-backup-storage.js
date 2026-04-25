(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const keysApi = root.FC.dataStorageKeys || {};
  const STORE_KEY = keysApi.BACKUP_STORE_KEY || 'fc_data_backups_v1';

  function readStore(){
    try{
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter((item)=> item && item.id && item.snapshot) : [];
    }catch(_){ return []; }
  }

  function describeWriteError(err){
    const name = String(err && err.name || '');
    const message = String(err && err.message || '').trim();
    const quotaLike = /quota|exceed|full|memory|storage/i.test(name + ' ' + message);
    if(quotaLike) return 'Nie udało się zapisać backupu w pamięci programu. Prawdopodobnie limit localStorage dla tej strony został przekroczony.';
    return 'Nie udało się zapisać backupu w pamięci programu.' + (message ? ' Szczegóły: ' + message : '');
  }

  function writeStore(list){
    try{ localStorage.setItem(STORE_KEY, JSON.stringify(Array.isArray(list) ? list : [])); }
    catch(err){ throw new Error(describeWriteError(err)); }
  }

  root.FC.dataBackupStorage = { STORE_KEY, readStore, writeStore, describeWriteError };
})();
