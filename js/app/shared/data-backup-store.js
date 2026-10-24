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

  async function readStore(){ return FC.backupArchive ? FC.backupArchive.list() : storage.readStore(); }
  async function mutate(run){
    if(!FC.backupArchive) throw new Error('ARCHIVE_MODULE_REQUIRED');
    return FC.backupArchive.mutate(run);
  }

  async function saveSnapshotBackup(snapshot, hash, options){
    const opts = Object.assign({ dedupe:true, dedupeAny:false }, options || {});
    return mutate(list=>{
      const newest = sortNewest(list)[0] || null;
      const existing = opts.dedupe === false ? null : (opts.dedupeAny
        ? records.findBackupByHash(hash, list)
        : (records.getBackupHash(newest) === String(hash || '').trim() ? newest : null));
      if(existing){
        existing.lastSeenAt = records.iso ? records.iso() : new Date().toISOString();
        existing.lastSeenAtMs = records.now ? records.now() : Date.now();
        existing.seenCount = Number(existing.seenCount || 1) + 1;
        return {rows:pruneBackups(list),value:{created:false,duplicate:true,backup:existing}};
      }
      const backup=records.buildBackupFromSnapshot(snapshot,hash,opts);
      return {rows:pruneBackups([backup].concat(list)),value:{created:true,duplicate:false,backup}};
    });
  }

  async function createBackup(options){
    FC.backupArchiveFormat.access();
    if(!snapApi) throw new Error('Brak modułu snapshotu backupu.');
    const opts = Object.assign({ reason:'manual', dedupe:true, pinned:false, safeState:false }, options || {});
    const snapshot = snapApi.collectSnapshot({ reason:opts.reason, label:opts.label || '' });
    const hash = snapApi.hashSnapshot(snapshot);
    return saveSnapshotBackup(snapshot, hash, opts);
  }

  async function ensureCurrentStateBackup(options){
    FC.backupArchiveFormat.access();
    if(!snapApi) throw new Error('Brak modułu snapshotu backupu.');
    const opts = Object.assign({ reason:'before-restore', label:'Przed przywróceniem backupu', dedupe:false }, options || {});
    const snapshot = snapApi.collectSnapshot({ reason:opts.reason, label:opts.label || '' });
    const hash = snapApi.hashSnapshot(snapshot);
    const existing = records.findBackupByHash(hash, await readStore());
    if(existing) return { created:false, duplicate:true, backup:existing, alreadySaved:true };
    return saveSnapshotBackup(snapshot, hash, Object.assign({}, opts, { dedupe:false }));
  }

  async function listBackups(){ return sortNewest(await readStore()); }
  async function listBackupGroups(){ return policy.groupBackups ? policy.groupBackups(await readStore()) : { app:await listBackups(), test:[] }; }
  async function findBackup(id){
    const key = String(id || '');
    return (await readStore()).find((item)=> String(item.id || '') === key) || null;
  }

  async function updateBackup(id, patch){
    return mutate(list=>{
      const item=list.find(row=>row.id===String(id));
      if(!item) throw new Error('Nie znaleziono backupu.');
      // Only user-editable metadata; never replace identity or RAW snapshot via a patch.
      const next=Object.assign({},item);
      for(const field of ['pinned','label'])if(Object.prototype.hasOwnProperty.call(patch||{},field))next[field]=patch[field];
      return {rows:pruneBackups(list.map(row=>row.id===item.id?next:row)),value:next};
    });
  }

  async function deleteBackup(id){
    return mutate(list=>{
      const item=list.find(row=>row.id===String(id));
      if(list.length<=1)throw new Error('Nie można usunąć ostatniego backupu.');
      const protection=policy.getBackupProtection(item,list);
      if(protection.protected)throw new Error('Ten backup jest chroniony.');
      return {rows:list.filter(row=>row.id!==String(id)),value:true};
    });
  }

  async function restoreBackup(id){
    const backup = await findBackup(id);
    if(!(backup && backup.snapshot)) throw new Error('Nie znaleziono backupu do przywrócenia.');
    await ensureCurrentStateBackup({ reason:'before-restore', label:'Przed przywróceniem backupu' });
    FC.backupArchiveFormat.access();
    return snapApi.applySnapshot(backup.snapshot, { clearMissing:true });
  }

  async function importSnapshot(snapshot){
    const snap = snapApi.normalizeSnapshot(snapshot);
    if(!snap) throw new Error('Nieprawidłowy plik danych.');
    await createBackup({ reason:'before-import', label:'Przed importem danych', dedupe:false });
    FC.backupArchiveFormat.access();
    return snapApi.applySnapshot(snap, { clearMissing:true });
  }

  function exportCurrent(){
    FC.backupArchiveFormat.access();
    const snapshot = snapApi.collectSnapshot({ reason:'manual-export' });
    const payload = snapApi.makeExportPayload(snapshot, { reason:'manual-export' });
    const date = snapApi.safeFilenamePart(new Date().toISOString().slice(0, 19));
    snapApi.downloadJson('meble-app-export-' + date + '.json', payload);
  }

  async function exportBackupPayload(id){
    const backup = await findBackup(id);
    if(!backup) throw new Error('Nie znaleziono backupu do eksportu.');
    const date = snapApi.safeFilenamePart(String(backup.createdAt || '').slice(0, 19));
    return { filename:'meble-app-backup-' + date + '.json', payload:snapApi.makeBackupFilePayload(backup), backup };
  }

  async function exportBackup(id){
    const pack = await exportBackupPayload(id);
    snapApi.downloadJson(pack.filename, pack.payload);
  }

  async function getStats(){
    FC.backupArchiveFormat.access();
    const current = snapApi.collectSnapshot({ reason:'stats' });
    const stats = snapApi.readStatsFromSnapshot(current);
    const backups = await readStore();
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

  async function pruneNow(){
    return mutate(list=>{ const rows=pruneBackups(list);return {rows,value:rows}; });
  }

  FC.dataBackupStore = {
    STORE_KEY,
    RETENTION_DAYS:policy.RETENTION_DAYS || 7,
    MIN_KEEP:policy.MIN_KEEP || 10,
    TEST_MAX_KEEP:policy.TEST_MAX_KEEP || 10,
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
