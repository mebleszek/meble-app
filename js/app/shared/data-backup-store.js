(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const snapApi = FC.dataBackupSnapshot;
  const policy = FC.dataBackupPolicy || {};
  const storage = FC.dataBackupStorage || {};
  const records = FC.dataBackupRecords || {};
  const STORE_KEY = storage.STORE_KEY || (snapApi && snapApi.BACKUP_STORE_KEY) || 'fc_data_backups_v1';
  const sortNewest = policy.sortNewest || ((rows)=> Array.isArray(rows) ? rows.slice() : []);
  const pruneBackups = policy.pruneBackups || ((rows)=> sortNewest(rows));

  function readStore(){ return storage.readStore ? storage.readStore() : []; }
  function writeStore(list){ return storage.writeStore ? storage.writeStore(list) : null; }

  function saveSnapshotBackup(snapshot, hash, options){
    const opts = Object.assign({ dedupe:true, dedupeAny:false }, options || {});
    const list = readStore();
    const newest = sortNewest(list)[0] || null;
    const existing = opts.dedupe === false
      ? null
      : (opts.dedupeAny ? records.findBackupByHash(hash, list) : (records.getBackupHash(newest) === String(hash || '').trim() ? newest : null));
    if(existing){
      existing.lastSeenAt = records.iso ? records.iso() : new Date().toISOString();
      existing.lastSeenAtMs = records.now ? records.now() : Date.now();
      existing.seenCount = Number(existing.seenCount || 1) + 1;
      writeStore(pruneBackups(list));
      return { created:false, duplicate:true, backup:existing };
    }
    const backup = records.buildBackupFromSnapshot(snapshot, hash, opts);
    const next = pruneBackups([backup].concat(list));
    writeStore(next);
    return { created:true, duplicate:false, backup };
  }

  function createBackup(options){
    if(!snapApi) throw new Error('Brak modułu snapshotu backupu.');
    const opts = Object.assign({ reason:'manual', dedupe:true, pinned:false, safeState:false }, options || {});
    const snapshot = snapApi.collectSnapshot({ reason:opts.reason, label:opts.label || '' });
    const hash = snapApi.hashSnapshot(snapshot);
    return saveSnapshotBackup(snapshot, hash, opts);
  }

  function ensureCurrentStateBackup(options){
    if(!snapApi) throw new Error('Brak modułu snapshotu backupu.');
    const opts = Object.assign({ reason:'before-restore', label:'Przed przywróceniem backupu', dedupe:false }, options || {});
    const snapshot = snapApi.collectSnapshot({ reason:opts.reason, label:opts.label || '' });
    const hash = snapApi.hashSnapshot(snapshot);
    const existing = records.findBackupByHash(hash, readStore());
    if(existing) return { created:false, duplicate:true, backup:existing, alreadySaved:true };
    return saveSnapshotBackup(snapshot, hash, Object.assign({}, opts, { dedupe:false }));
  }

  function listBackups(){ return sortNewest(readStore()); }
  function listBackupGroups(){ return policy.groupBackups ? policy.groupBackups(readStore()) : { app:listBackups(), test:[] }; }
  function findBackup(id){
    const key = String(id || '');
    return readStore().find((item)=> String(item.id || '') === key) || null;
  }

  function updateBackup(id, patch){
    const key = String(id || '');
    const next = readStore().map((item)=> String(item.id || '') === key ? Object.assign({}, item, patch || {}) : item);
    writeStore(pruneBackups(next));
    return findBackup(id);
  }

  function deleteBackup(id){
    const key = String(id || '');
    const list = readStore();
    if(list.length <= 1) throw new Error('Nie można usunąć ostatniego backupu.');
    const item = list.find((row)=> String(row.id || '') === key);
    const protection = policy.getBackupProtection ? policy.getBackupProtection(item, list) : { protected:false };
    if(item && protection.protected){
      if(protection.latestProtected) throw new Error('Ten backup jest chroniony, bo należy do 3 najnowszych backupów w tej grupie.');
      throw new Error('Ten backup jest chroniony. Najpierw go odepnij.');
    }
    writeStore(list.filter((row)=> String(row.id || '') !== key));
    return true;
  }

  function restoreBackup(id){
    const backup = findBackup(id);
    if(!(backup && backup.snapshot)) throw new Error('Nie znaleziono backupu do przywrócenia.');
    ensureCurrentStateBackup({ reason:'before-restore', label:'Przed przywróceniem backupu' });
    return snapApi.applySnapshot(backup.snapshot, { clearMissing:true });
  }

  function importSnapshot(snapshot){
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

  function exportBackupPayload(id){
    const backup = findBackup(id);
    if(!backup) throw new Error('Nie znaleziono backupu do eksportu.');
    const date = snapApi.safeFilenamePart(String(backup.createdAt || '').slice(0, 19));
    return { filename:'meble-app-backup-' + date + '.json', payload:snapApi.makeBackupFilePayload(backup), backup };
  }

  function exportBackup(id){
    const pack = exportBackupPayload(id);
    snapApi.downloadJson(pack.filename, pack.payload);
  }

  function getStats(){
    const current = snapApi.collectSnapshot({ reason:'stats' });
    const stats = snapApi.readStatsFromSnapshot(current);
    const backups = readStore();
    const appBackups = backups.filter((item)=> !(policy.isTestBackup && policy.isTestBackup(item)));
    const testBackups = backups.filter((item)=> policy.isTestBackup && policy.isTestBackup(item));
    const isProtected = policy.isProtected || (()=> false);
    return Object.assign({}, stats, {
      backups:backups.length,
      appBackups:appBackups.length,
      testBackups:testBackups.length,
      protectedBackups:backups.filter((item)=> isProtected(item, backups)).length,
    });
  }

  function pruneNow(){
    const next = pruneBackups(readStore());
    writeStore(next);
    return next;
  }

  FC.dataBackupStore = {
    STORE_KEY,
    RETENTION_DAYS:policy.RETENTION_DAYS || 7,
    MIN_KEEP:policy.MIN_KEEP || 10,
    AUTO_PROTECT_LATEST:policy.AUTO_PROTECT_LATEST || 3,
    createBackup,
    ensureCurrentStateBackup,
    listBackups,
    listBackupGroups,
    findBackup,
    updateBackup,
    deleteBackup,
    restoreBackup,
    importSnapshot,
    exportCurrent,
    exportBackup,
    exportBackupPayload,
    getStats,
    pruneNow,
    isProtected:policy.isProtected,
    isPinnedProtected:policy.isPinnedProtected,
    isTestBackup:policy.isTestBackup,
    getBackupGroup:policy.getBackupGroup,
    getBackupProtection:policy.getBackupProtection,
  };
})();
