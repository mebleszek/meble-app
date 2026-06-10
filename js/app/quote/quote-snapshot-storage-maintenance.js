(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  // Odpowiedzialność modułu: awaryjne odchudzanie lokalnego storage przed zapisem historii WYCENY.
  // Nie liczy oferty i nie zmienia danych domenowych projektu; usuwa wyłącznie cache, techniczne kopie
  // i nadmiar lokalnych backupów, żeby snapshot oferty miał szansę zapisać się w localStorage.

  const BACKUP_KEY = 'fc_data_backups_v1';
  const APP_KEEP_NORMAL = 3;
  const APP_KEEP_AGGRESSIVE = 1;
  const TEST_KEEP_NORMAL = 1;
  const TEST_KEEP_AGGRESSIVE = 0;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function bytes(value){ return value == null ? 0 : String(value).length; }
  function raw(key){ try{ return localStorage.getItem(String(key || '')); }catch(_){ return null; } }
  function remove(key){ try{ localStorage.removeItem(String(key || '')); return true; }catch(_){ return false; } }
  function jsonBytes(value){ try{ return JSON.stringify(value == null ? null : value).length; }catch(_){ return 0; } }
  function parseArray(value){ try{ const parsed = JSON.parse(String(value || '[]')); return Array.isArray(parsed) ? parsed : []; }catch(_){ return []; } }
  function storageKeys(){
    const out = [];
    try{
      for(let i = 0; i < localStorage.length; i += 1){
        const key = localStorage.key(i);
        if(key) out.push(String(key));
      }
    }catch(_){ }
    return out.sort();
  }
  function totalFcBytes(){
    return storageKeys().filter((key)=> key.indexOf('fc_') === 0).reduce((sum, key)=> sum + bytes(raw(key)), 0);
  }
  function isTestBackup(item){ return text(item && item.reason) === 'before-tests'; }
  function isProtectedBackup(item){ return !!(item && (item.pinned || item.safeState || text(item.reason) === 'safe-state')); }
  function sortNewest(list){ return (Array.isArray(list) ? list : []).slice().sort((a,b)=> Number(b && b.createdAtMs || 0) - Number(a && a.createdAtMs || 0)); }

  function writeRawShrinking(key, value){
    const k = String(key || '');
    const rawValue = String(value == null ? '' : value);
    try{ localStorage.setItem(k, rawValue); return true; }
    catch(firstErr){
      try{ localStorage.removeItem(k); }catch(_){ }
      try{ localStorage.setItem(k, rawValue); return true; }
      catch(secondErr){ return false; }
    }
  }

  function removeKnownTechnicalKeys(){
    const removed = [];
    const fixed = [
      'fc_edit_session_v1',
      'fc_reload_restore_v1',
      'fc_project_backup_v1',
      'fc_project_backup_meta_v1',
      'fc_investors_backup_v1',
      'fc_investors_backup_meta_v1',
      'fc_rozrys_plan_cache_v1',
      'fc_rozrys_plan_cache_v2'
    ];
    fixed.forEach((key)=>{
      const before = bytes(raw(key));
      if(before > 0 && remove(key)) removed.push({ key, bytes:before });
    });
    storageKeys().forEach((key)=>{
      if(!/^fc_project_inv_.+_backup(?:_meta)?_v1$/.test(key)) return;
      const before = bytes(raw(key));
      if(before > 0 && remove(key)) removed.push({ key, bytes:before });
    });
    try{ if(FC.dataStorageKeys && typeof FC.dataStorageKeys.cleanupVolatileKeys === 'function') FC.dataStorageKeys.cleanupVolatileKeys(); }catch(_){ }
    return removed;
  }

  function compactBackupStore(aggressive){
    const key = (FC.dataBackupStorage && FC.dataBackupStorage.STORE_KEY) || (FC.dataStorageKeys && FC.dataStorageKeys.BACKUP_STORE_KEY) || BACKUP_KEY;
    const beforeRaw = raw(key);
    const beforeBytes = bytes(beforeRaw);
    const list = parseArray(beforeRaw);
    if(!beforeBytes || !list.length) return { key, beforeBytes, afterBytes:beforeBytes, beforeCount:list.length, afterCount:list.length, changed:false };
    const keepApp = aggressive ? APP_KEEP_AGGRESSIVE : APP_KEEP_NORMAL;
    const keepTest = aggressive ? TEST_KEEP_AGGRESSIVE : TEST_KEEP_NORMAL;
    const protectedRows = sortNewest(list).filter(isProtectedBackup);
    const protectedIds = new Set(protectedRows.map((item)=> text(item && item.id)).filter(Boolean));
    const appRows = sortNewest(list).filter((item)=> !isTestBackup(item) && !protectedIds.has(text(item && item.id))).slice(0, keepApp);
    const testRows = sortNewest(list).filter((item)=> isTestBackup(item) && !protectedIds.has(text(item && item.id))).slice(0, keepTest);
    let next = sortNewest(protectedRows.concat(appRows, testRows));
    if(aggressive && next.length > 3){
      const protectedOnly = protectedRows.slice(0, 3);
      next = sortNewest(protectedOnly.length ? protectedOnly : sortNewest(list).filter((item)=> !isTestBackup(item)).slice(0, 1));
    }
    const nextRaw = JSON.stringify(next);
    const afterBytes = bytes(nextRaw);
    if(afterBytes >= beforeBytes && next.length === list.length) return { key, beforeBytes, afterBytes:beforeBytes, beforeCount:list.length, afterCount:list.length, changed:false };
    const ok = writeRawShrinking(key, nextRaw);
    return {
      key,
      beforeBytes,
      afterBytes: ok ? bytes(raw(key)) : beforeBytes,
      beforeCount:list.length,
      afterCount: ok ? next.length : list.length,
      removed: ok ? Math.max(0, list.length - next.length) : 0,
      changed:!!ok && (next.length !== list.length || afterBytes !== beforeBytes),
      aggressive:!!aggressive,
      writeOk:!!ok,
    };
  }

  function prepareForSnapshotWrite(options){
    const opts = options && typeof options === 'object' ? options : {};
    const before = { fcBytes:totalFcBytes(), snapshotBytes:jsonBytes(opts.rows || []), backupBytes:bytes(raw((FC.dataBackupStorage && FC.dataBackupStorage.STORE_KEY) || BACKUP_KEY)) };
    const technicalRemoved = removeKnownTechnicalKeys();
    const backup = compactBackupStore(!!opts.aggressive);
    const after = { fcBytes:totalFcBytes(), backupBytes:bytes(raw(backup.key || BACKUP_KEY)) };
    return {
      reason:text(opts.reason),
      aggressive:!!opts.aggressive,
      before,
      after,
      freedBytes:Math.max(0, Number(before.fcBytes || 0) - Number(after.fcBytes || 0)),
      technicalRemoved,
      backup,
    };
  }

  function auditSnapshotWriteCandidate(snapshot, rows){
    const snapshotBytes = jsonBytes(snapshot || null);
    const rowsBytes = jsonBytes(rows || []);
    return {
      snapshotBytes,
      rowsBytes,
      estimate30SnapshotBytes:snapshotBytes * 30,
      currentFcBytes:totalFcBytes(),
      backupStoreBytes:bytes(raw((FC.dataBackupStorage && FC.dataBackupStorage.STORE_KEY) || BACKUP_KEY)),
      quoteSnapshotStoreBytes:bytes(raw('fc_quote_snapshots_v1')),
    };
  }

  FC.quoteSnapshotStorageMaintenance = {
    prepareForSnapshotWrite,
    compactBackupStore,
    removeKnownTechnicalKeys,
    auditSnapshotWriteCandidate,
    totalFcBytes,
  };
})();
