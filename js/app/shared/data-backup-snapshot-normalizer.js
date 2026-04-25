(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const keysApi = root.FC.dataStorageKeys || {};

  function parseJson(raw){
    if(typeof raw !== 'string') return null;
    try{ return JSON.parse(raw); }catch(_){ return null; }
  }

  function normalizeSnapshot(payload){
    const data = payload && typeof payload === 'object' ? payload : null;
    if(!data) return null;
    if(data.kind === keysApi.SNAPSHOT_KIND && data.keys && typeof data.keys === 'object') return data;
    if(data.kind === keysApi.EXPORT_KIND && data.snapshot && data.snapshot.keys) return data.snapshot;
    if(data.kind === keysApi.BACKUP_KIND && data.backup && data.backup.snapshot && data.backup.snapshot.keys) return data.backup.snapshot;
    if(data.snapshot && data.snapshot.keys) return data.snapshot;
    if(data.keys && typeof data.keys === 'object'){
      return {
        kind: keysApi.SNAPSHOT_KIND,
        version: keysApi.VERSION,
        createdAt: keysApi.nowIso ? keysApi.nowIso() : String(Date.now()),
        meta: data.meta || {},
        keys: data.keys,
      };
    }
    return null;
  }

  function parseImportPayload(raw){
    return normalizeSnapshot(parseJson(raw));
  }

  root.FC.dataBackupSnapshotNormalizer = { parseJson, normalizeSnapshot, parseImportPayload };
})();
