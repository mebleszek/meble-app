(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const snapApi = FC.dataBackupSnapshot;
  const STORE_KEY = (snapApi && snapApi.BACKUP_STORE_KEY) || 'fc_data_backups_v1';
  const RETENTION_DAYS = 7;
  const MIN_KEEP = 5;

  function now(){ return Date.now(); }
  function iso(ts){ try{ return new Date(ts || now()).toISOString(); }catch(_){ return String(ts || now()); } }
  function uid(prefix){ return String(prefix || 'backup') + '_' + now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }

  function readStore(){
    try{
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter((item)=> item && item.id && item.snapshot) : [];
    }catch(_){ return []; }
  }

  function writeStore(list){
    try{ localStorage.setItem(STORE_KEY, JSON.stringify(Array.isArray(list) ? list : [])); }catch(err){ throw new Error('Nie udało się zapisać backupu. Możliwe, że pamięć przeglądarki jest pełna.'); }
  }

  function sortNewest(list){
    return (Array.isArray(list) ? list : []).slice().sort((a,b)=> Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
  }

  function makeLabel(reason){
    const map = {
      manual:'Ręczny backup',
      'safe-state':'Ostatni dobry stan',
      'before-tests':'Przed testami',
      'before-import':'Przed importem',
      'before-restore':'Przed przywróceniem',
      'before-migration':'Przed migracją',
    };
    return map[String(reason || '')] || 'Backup danych';
  }

  function isProtected(item){
    return !!(item && (item.pinned || item.safeState || String(item.reason || '') === 'safe-state'));
  }

  function pruneBackups(list, options){
    const opts = Object.assign({ retentionDays:RETENTION_DAYS, minKeep:MIN_KEEP }, options || {});
    const all = sortNewest(list);
    if(all.length <= opts.minKeep) return all;
    const cutoff = now() - (Number(opts.retentionDays || RETENTION_DAYS) * 24 * 60 * 60 * 1000);
    const keepIds = new Set();
    all.slice(0, Math.max(1, Number(opts.minKeep || MIN_KEEP))).forEach((item)=> keepIds.add(item.id));
    all.forEach((item)=>{
      if(isProtected(item)) keepIds.add(item.id);
      if(Number(item.createdAtMs || 0) >= cutoff) keepIds.add(item.id);
    });
    if(!keepIds.size && all[0]) keepIds.add(all[0].id);
    return all.filter((item)=> keepIds.has(item.id));
  }

  function getStats(){
    const current = snapApi.collectSnapshot({ reason:'stats' });
    const stats = snapApi.readStatsFromSnapshot(current);
    const backups = readStore();
    return Object.assign({}, stats, { backups:backups.length, protectedBackups:backups.filter(isProtected).length });
  }

  function createBackup(options){
    if(!snapApi) throw new Error('Brak modułu snapshotu backupu.');
    const opts = Object.assign({ reason:'manual', dedupe:true, pinned:false, safeState:false }, options || {});
    const snapshot = snapApi.collectSnapshot({ reason:opts.reason, label:opts.label || '' });
    const hash = snapApi.hashSnapshot(snapshot);
    const list = readStore();
    const newest = sortNewest(list)[0] || null;
    if(opts.dedupe !== false && newest && newest.hash === hash){
      newest.lastSeenAt = iso();
      newest.lastSeenAtMs = now();
      newest.seenCount = Number(newest.seenCount || 1) + 1;
      writeStore(pruneBackups(list));
      return { created:false, duplicate:true, backup:newest };
    }
    const createdAtMs = now();
    const backup = {
      id:uid('bak'),
      reason:String(opts.reason || 'manual'),
      label:String(opts.label || makeLabel(opts.reason)),
      createdAt:iso(createdAtMs),
      createdAtMs,
      hash,
      pinned:!!opts.pinned,
      safeState:!!opts.safeState || String(opts.reason || '') === 'safe-state',
      snapshot,
    };
    if(backup.safeState) backup.pinned = true;
    const next = pruneBackups([backup].concat(list));
    writeStore(next);
    return { created:true, duplicate:false, backup };
  }

  function listBackups(){ return sortNewest(readStore()); }

  function findBackup(id){
    const key = String(id || '');
    return readStore().find((item)=> String(item.id || '') === key) || null;
  }

  function updateBackup(id, patch){
    const key = String(id || '');
    const list = readStore();
    const next = list.map((item)=> String(item.id || '') === key ? Object.assign({}, item, patch || {}) : item);
    writeStore(pruneBackups(next));
    return findBackup(id);
  }

  function deleteBackup(id){
    const key = String(id || '');
    const list = readStore();
    if(list.length <= 1) throw new Error('Nie można usunąć ostatniego backupu.');
    const item = list.find((row)=> String(row.id || '') === key);
    if(item && isProtected(item)) throw new Error('Ten backup jest chroniony. Najpierw go odepnij.');
    const next = list.filter((row)=> String(row.id || '') !== key);
    writeStore(next);
    return true;
  }

  function restoreBackup(id){
    const backup = findBackup(id);
    if(!(backup && backup.snapshot)) throw new Error('Nie znaleziono backupu do przywrócenia.');
    createBackup({ reason:'before-restore', label:'Przed przywróceniem backupu', dedupe:false });
    return snapApi.applySnapshot(backup.snapshot, { clearMissing:true });
  }

  function importSnapshot(snapshot, options){
    const snap = snapApi.normalizeSnapshot(snapshot);
    if(!snap) throw new Error('Nieprawidłowy plik danych.');
    createBackup({ reason:'before-import', label:'Przed importem danych', dedupe:false });
    return snapApi.applySnapshot(snap, { clearMissing:true });
  }

  function exportCurrent(){
    const snapshot = snapApi.collectSnapshot({ reason:'manual-export' });
    const payload = snapApi.makeExportPayload(snapshot, { reason:'manual-export' });
    const date = snapApi.safeFilenamePart(new Date().toISOString().slice(0, 19));
    snapApi.downloadJson('meble-app-export-' + date + '.json', payload);
  }

  function exportBackup(id){
    const backup = findBackup(id);
    if(!backup) throw new Error('Nie znaleziono backupu do eksportu.');
    const date = snapApi.safeFilenamePart(String(backup.createdAt || '').slice(0, 19));
    snapApi.downloadJson('meble-app-backup-' + date + '.json', snapApi.makeBackupFilePayload(backup));
  }

  function pruneNow(){
    const next = pruneBackups(readStore());
    writeStore(next);
    return next;
  }

  FC.dataBackupStore = {
    STORE_KEY,
    RETENTION_DAYS,
    MIN_KEEP,
    createBackup,
    listBackups,
    findBackup,
    updateBackup,
    deleteBackup,
    restoreBackup,
    importSnapshot,
    exportCurrent,
    exportBackup,
    getStats,
    pruneNow,
    isProtected,
  };
})();
