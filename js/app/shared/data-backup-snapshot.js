(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;

  const BACKUP_STORE_KEY = 'fc_data_backups_v1';
  const SNAPSHOT_KIND = 'meble-app-storage-snapshot';
  const EXPORT_KIND = 'meble-app-data-export';
  const BACKUP_KIND = 'meble-app-data-backup';
  const VERSION = 1;

  const EXCLUDED_KEYS = new Set([
    BACKUP_STORE_KEY,
  ]);
  const VOLATILE_KEYS = new Set([
    // Techniczne stany pracy/cache. Nie są trwałymi danymi użytkownika,
    // a ich odkładanie w backupach potrafi niepotrzebnie powiększać snapshoty
    // albo po restore przywrócić stary tryb edycji.
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

  function collectSnapshot(meta){
    const keys = {};
    listStorageKeys().forEach((key)=>{
      try{ keys[key] = localStorage.getItem(key); }catch(_){ }
    });
    return {
      kind: SNAPSHOT_KIND,
      version: VERSION,
      createdAt: nowIso(),
      meta: Object.assign({}, meta || {}),
      keys,
    };
  }

  function stableStringify(value){
    const seen = new WeakSet();
    const normalize = (entry)=>{
      if(entry == null || typeof entry !== 'object') return entry;
      if(seen.has(entry)) return '[Circular]';
      seen.add(entry);
      if(Array.isArray(entry)) return entry.map(normalize);
      const out = {};
      Object.keys(entry).sort().forEach((key)=>{ out[key] = normalize(entry[key]); });
      return out;
    };
    try{ return JSON.stringify(normalize(value)); }catch(_){ return String(value || ''); }
  }

  function hashString(text){
    const value = String(text || '');
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for(let i = 0; i < value.length; i++){
      const ch = value.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const num = 4294967296 * (2097151 & h2) + (h1 >>> 0);
    return num.toString(36);
  }

  function hashSnapshot(snapshot){
    const source = snapshot && snapshot.keys ? snapshot.keys : {};
    return hashString(stableStringify(source));
  }

  function parseJson(raw){
    if(typeof raw !== 'string') return null;
    try{ return JSON.parse(raw); }catch(_){ return null; }
  }

  function normalizeSnapshot(payload){
    const data = payload && typeof payload === 'object' ? payload : null;
    if(!data) return null;
    if(data.kind === SNAPSHOT_KIND && data.keys && typeof data.keys === 'object') return data;
    if(data.kind === EXPORT_KIND && data.snapshot && data.snapshot.keys) return data.snapshot;
    if(data.kind === BACKUP_KIND && data.backup && data.backup.snapshot && data.backup.snapshot.keys) return data.backup.snapshot;
    if(data.snapshot && data.snapshot.keys) return data.snapshot;
    if(data.keys && typeof data.keys === 'object'){
      return {
        kind: SNAPSHOT_KIND,
        version: VERSION,
        createdAt: data.createdAt || nowIso(),
        meta: data.meta || {},
        keys: data.keys,
      };
    }
    return null;
  }

  function parseImportPayload(raw){
    return normalizeSnapshot(parseJson(raw));
  }

  function cleanupVolatileKeys(){
    VOLATILE_KEYS.forEach((key)=>{
      try{ localStorage.removeItem(key); }catch(_){ }
    });
  }

  function applySnapshot(snapshot, options){
    const snap = normalizeSnapshot(snapshot);
    if(!(snap && snap.keys && typeof snap.keys === 'object')) throw new Error('Nieprawidłowy format backupu danych.');
    const opts = Object.assign({ clearMissing:true }, options || {});
    const incoming = Object.keys(snap.keys).filter(isAppDataKey).sort();
    if(opts.clearMissing){
      listStorageKeys().forEach((key)=>{
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
    if(opts.clearVolatile !== false) cleanupVolatileKeys();
    return { restoredKeys: incoming.length };
  }

  function makeExportPayload(snapshot, meta){
    const snap = normalizeSnapshot(snapshot) || collectSnapshot(meta || {});
    return {
      kind: EXPORT_KIND,
      version: VERSION,
      exportedAt: nowIso(),
      snapshot: snap,
    };
  }

  function makeBackupFilePayload(backup){
    return {
      kind: BACKUP_KIND,
      version: VERSION,
      exportedAt: nowIso(),
      backup,
    };
  }

  function safeFilenamePart(value){
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'backup';
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

  function readStatsFromSnapshot(snapshot){
    const snap = normalizeSnapshot(snapshot) || collectSnapshot({});
    const keys = snap.keys || {};
    const read = (key, fallback)=> parseJson(keys[key]) || fallback;
    const investors = read('fc_investors_v1', []);
    const projects = read('fc_projects_v1', []);
    const quoteSnapshots = read('fc_quote_snapshots_v1', []);
    const quoteDrafts = read('fc_quote_offer_drafts_v1', []);
    const serviceOrders = read('fc_service_orders_v1', []);
    const edge = read('fc_edge_v1', {});
    return {
      keys:Object.keys(keys).length,
      investors:Array.isArray(investors) ? investors.length : 0,
      projects:Array.isArray(projects) ? projects.length : 0,
      quoteSnapshots:Array.isArray(quoteSnapshots) ? quoteSnapshots.length : 0,
      quoteDrafts:Array.isArray(quoteDrafts) ? quoteDrafts.length : 0,
      serviceOrders:Array.isArray(serviceOrders) ? serviceOrders.length : 0,
      edgeEntries:edge && typeof edge === 'object' ? Object.keys(edge).length : 0,
    };
  }

  function buildDiagnosticsReport(){
    const snapshot = collectSnapshot({ reason:'diagnostics' });
    const stats = readStatsFromSnapshot(snapshot);
    const lines = [];
    lines.push('Meble-app — raport danych');
    lines.push('Data: ' + nowIso());
    lines.push('Klucze aplikacji: ' + stats.keys);
    lines.push('Inwestorzy: ' + stats.investors);
    lines.push('Projekty: ' + stats.projects);
    lines.push('Snapshoty wycen: ' + stats.quoteSnapshots);
    lines.push('Drafty ofert: ' + stats.quoteDrafts);
    lines.push('Zlecenia usługowe: ' + stats.serviceOrders);
    lines.push('Wpisy oklein: ' + stats.edgeEntries);
    lines.push('');
    lines.push('Klucze:');
    Object.keys(snapshot.keys || {}).sort().forEach((key)=>{
      const raw = snapshot.keys[key];
      lines.push('- ' + key + ' (' + String(raw || '').length + ' znaków)');
    });
    return lines.join('\n');
  }

  FC.dataBackupSnapshot = {
    BACKUP_STORE_KEY,
    VOLATILE_KEYS:Array.from(VOLATILE_KEYS),
    SNAPSHOT_KIND,
    EXPORT_KIND,
    BACKUP_KIND,
    VERSION,
    isAppDataKey,
    listStorageKeys,
    cleanupVolatileKeys,
    collectSnapshot,
    hashSnapshot,
    parseImportPayload,
    normalizeSnapshot,
    applySnapshot,
    makeExportPayload,
    makeBackupFilePayload,
    safeFilenamePart,
    downloadJson,
    readStatsFromSnapshot,
    buildDiagnosticsReport,
  };
})();
