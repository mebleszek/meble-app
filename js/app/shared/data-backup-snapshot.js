(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const keysApi = FC.dataStorageKeys || {};
  const hashApi = FC.dataBackupHash || {};
  const normalizer = FC.dataBackupSnapshotNormalizer || {};
  const applyApi = FC.dataBackupSnapshotApply || {};
  const exportApi = FC.dataBackupExport || {};

  function collectSnapshot(meta){
    const keys = {};
    const listKeys = keysApi.listStorageKeys || (()=> []);
    listKeys().forEach((key)=>{
      try{ keys[key] = localStorage.getItem(key); }catch(_){ }
    });
    return {
      kind: keysApi.SNAPSHOT_KIND,
      version: keysApi.VERSION,
      createdAt: keysApi.nowIso ? keysApi.nowIso() : String(Date.now()),
      meta: Object.assign({}, meta || {}),
      keys,
    };
  }

  function parseJson(raw){
    if(typeof raw !== 'string') return null;
    try{ return JSON.parse(raw); }catch(_){ return null; }
  }

  function readStatsFromSnapshot(snapshot){
    const snap = (normalizer.normalizeSnapshot && normalizer.normalizeSnapshot(snapshot)) || collectSnapshot({});
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

  function readDataSummaryFromSnapshot(snapshot){
    const snap = (normalizer.normalizeSnapshot && normalizer.normalizeSnapshot(snapshot)) || collectSnapshot({});
    try{
      if(FC.dataStorageClassifier && typeof FC.dataStorageClassifier.buildSummary === 'function'){
        return FC.dataStorageClassifier.buildSummary(snap);
      }
    }catch(_){ }
    const entries = Object.keys(snap.keys || {}).sort().map((key)=> ({
      key,
      category:'user',
      baseCategory:'user',
      label:key,
      description:'',
      size:String(snap.keys[key] || '').length,
      recordCount:1,
      testRecords:0,
      hasTestData:false,
    }));
    const bytes = entries.reduce((sum, entry)=> sum + (Number(entry.size) || 0), 0);
    return {
      entries,
      user:{ keys:entries.length, bytes, records:entries.length },
      technical:{ keys:0, bytes:0, records:0 },
      test:{ keys:0, bytes:0, records:0 },
      byCategory:{ user:entries, technical:[], test:[] },
    };
  }

  function buildDiagnosticsReport(){
    const snapshot = collectSnapshot({ reason:'diagnostics' });
    const stats = readStatsFromSnapshot(snapshot);
    try{
      if(FC.dataStorageClassifier && typeof FC.dataStorageClassifier.buildDiagnosticsReport === 'function'){
        return FC.dataStorageClassifier.buildDiagnosticsReport(snapshot, stats);
      }
    }catch(_){ }
    const lines = [];
    lines.push('Meble-app — raport danych');
    lines.push('Data: ' + (keysApi.nowIso ? keysApi.nowIso() : String(Date.now())));
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
    BACKUP_STORE_KEY:keysApi.BACKUP_STORE_KEY,
    VOLATILE_KEYS:keysApi.VOLATILE_KEYS || [],
    SNAPSHOT_KIND:keysApi.SNAPSHOT_KIND,
    EXPORT_KIND:keysApi.EXPORT_KIND,
    BACKUP_KIND:keysApi.BACKUP_KIND,
    VERSION:keysApi.VERSION,
    isAppDataKey:keysApi.isAppDataKey,
    listStorageKeys:keysApi.listStorageKeys,
    cleanupVolatileKeys:keysApi.cleanupVolatileKeys,
    collectSnapshot,
    hashSnapshot:hashApi.hashSnapshot,
    parseImportPayload:normalizer.parseImportPayload,
    normalizeSnapshot:normalizer.normalizeSnapshot,
    applySnapshot:applyApi.applySnapshot,
    makeExportPayload:exportApi.makeExportPayload,
    makeBackupFilePayload:exportApi.makeBackupFilePayload,
    safeFilenamePart:exportApi.safeFilenamePart,
    downloadJson:exportApi.downloadJson,
    readStatsFromSnapshot,
    readDataSummaryFromSnapshot,
    buildDiagnosticsReport,
  };
})();
