(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const keysApi = FC.dataStorageKeys || {};
  const normalizer = FC.dataBackupSnapshotNormalizer || {};

  function safeFilenamePart(value){
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'backup';
  }

  function makeExportPayload(snapshot, meta){
    const snap = (normalizer.normalizeSnapshot && normalizer.normalizeSnapshot(snapshot))
      || (FC.dataBackupSnapshot && FC.dataBackupSnapshot.collectSnapshot ? FC.dataBackupSnapshot.collectSnapshot(meta || {}) : null);
    return {
      kind: keysApi.EXPORT_KIND,
      version: keysApi.VERSION,
      exportedAt: keysApi.nowIso ? keysApi.nowIso() : String(Date.now()),
      snapshot: snap,
    };
  }

  function makeBackupFilePayload(backup){
    return {
      kind: keysApi.BACKUP_KIND,
      version: keysApi.VERSION,
      exportedAt: keysApi.nowIso ? keysApi.nowIso() : String(Date.now()),
      backup,
    };
  }

  function downloadJson(filename, payload){
    const name = String(filename || 'meble-app-backup.json');
    const text = JSON.stringify(payload || {}, null, 2);
    const blob = new Blob([text], { type:'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    setTimeout(()=>{
      try{ URL.revokeObjectURL(url); }catch(_){ }
      try{ link.remove(); }catch(_){ }
    }, 0);
  }

  FC.dataBackupExport = { safeFilenamePart, makeExportPayload, makeBackupFilePayload, downloadJson };
})();
