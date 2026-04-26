(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const keysApi = FC.dataStorageKeys || {};

  function parseJson(raw){
    if(typeof raw !== 'string' || raw === '') return null;
    try{ return JSON.parse(raw); }catch(_){ return null; }
  }

  function formatBytes(value){
    try{
      if(FC.dataStorageClassifier && typeof FC.dataStorageClassifier.formatBytes === 'function') return FC.dataStorageClassifier.formatBytes(value);
    }catch(_){ }
    const n = Math.max(0, Number(value) || 0);
    if(n < 1024) return `${n} zn.`;
    if(n < 1024 * 1024) return `${Math.round(n / 102.4) / 10} KB`;
    return `${Math.round(n / 104857.6) / 10} MB`;
  }

  function readLocalStorageKeys(options){
    const opts = options && typeof options === 'object' ? options : {};
    const prefix = String(opts.prefix || 'fc_');
    const out = {};
    try{
      for(let i = 0; i < localStorage.length; i++){
        const key = String(localStorage.key(i) || '');
        if(!prefix || key.indexOf(prefix) === 0) out[key] = localStorage.getItem(key) || '';
      }
    }catch(_){ }
    return out;
  }

  function rawKeysFromSnapshot(snapshot, includeStore){
    const keys = Object.assign({}, snapshot && snapshot.keys ? snapshot.keys : {});
    if(includeStore && keysApi.BACKUP_STORE_KEY && !Object.prototype.hasOwnProperty.call(keys, keysApi.BACKUP_STORE_KEY)){
      try{
        const raw = localStorage.getItem(keysApi.BACKUP_STORE_KEY);
        if(raw != null) keys[keysApi.BACKUP_STORE_KEY] = raw;
      }catch(_){ }
    }
    return keys;
  }

  function getSize(rawKeys, key){
    return String(rawKeys && rawKeys[key] != null ? rawKeys[key] : '').length;
  }

  function makeRows(rawKeys){
    return Object.keys(rawKeys || {}).sort().map((key)=> ({ key, size:getSize(rawKeys, key) }));
  }

  function parseProjectSlotKey(key){
    const k = String(key || '');
    if(/^fc_project_inv_.+_backup(?:_meta)?_v1$/.test(k)) return null;
    const match = k.match(/^fc_project_inv_(.+)_v1$/);
    return match ? match[1] : null;
  }

  function isInternalBackupKey(key){
    const k = String(key || '');
    return k === 'fc_project_backup_v1'
      || k === 'fc_project_backup_meta_v1'
      || k === 'fc_investors_backup_v1'
      || k === 'fc_investors_backup_meta_v1'
      || /^fc_project_inv_.+_backup(?:_meta)?_v1$/.test(k);
  }

  function isCacheKey(key){
    return /^fc_rozrys_plan_cache_v[12]$/.test(String(key || ''));
  }

  function readArray(rawKeys, key){
    const parsed = parseJson(rawKeys && rawKeys[key]);
    return Array.isArray(parsed) ? parsed : [];
  }

  function readObject(rawKeys, key){
    const parsed = parseJson(rawKeys && rawKeys[key]);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  }

  function getKnownInvestorIds(rawKeys){
    const ids = new Set();
    readArray(rawKeys, 'fc_investors_v1').forEach((item)=>{
      const id = String(item && item.id || '').trim();
      if(id) ids.add(id);
    });
    readArray(rawKeys, 'fc_projects_v1').forEach((item)=>{
      const id = String(item && item.investorId || '').trim();
      if(id) ids.add(id);
      const assigned = String(item && item.projectData && item.projectData.meta && item.projectData.meta.assignedInvestorId || '').trim();
      if(assigned) ids.add(assigned);
    });
    const active = readObject(rawKeys, 'fc_project_v1');
    const activeId = String(active && active.meta && active.meta.assignedInvestorId || '').trim();
    if(activeId) ids.add(activeId);
    return ids;
  }

  function buildAuditFromKeys(rawKeys){
    const keys = rawKeys && typeof rawKeys === 'object' ? rawKeys : {};
    const rows = makeRows(keys);
    const knownInvestorIds = getKnownInvestorIds(keys);
    const projectSlots = rows.map((row)=> ({ row, investorId:parseProjectSlotKey(row.key) }))
      .filter((item)=> item.investorId)
      .map((item)=> ({ key:item.row.key, investorId:item.investorId, size:item.row.size, orphan:!knownInvestorIds.has(item.investorId) }));
    const orphanSlots = projectSlots.filter((item)=> item.orphan);
    const internalBackups = rows.filter((row)=> isInternalBackupKey(row.key));
    const cacheKeys = rows.filter((row)=> isCacheKey(row.key));
    const snapshotIncluded = rows.filter((row)=> keysApi.isAppDataKey ? keysApi.isAppDataKey(row.key) : row.key.indexOf('fc_') === 0);
    const snapshotExcluded = rows.filter((row)=> row.key.indexOf('fc_') === 0 && !(keysApi.isAppDataKey ? keysApi.isAppDataKey(row.key) : true));
    const sum = (items)=> items.reduce((total, item)=> total + (Number(item.size) || 0), 0);
    return {
      totalKeys:rows.length,
      totalBytes:sum(rows),
      backupStore:{ key:keysApi.BACKUP_STORE_KEY || 'fc_data_backups_v1', size:getSize(keys, keysApi.BACKUP_STORE_KEY || 'fc_data_backups_v1') },
      snapshotIncluded:{ keys:snapshotIncluded.length, bytes:sum(snapshotIncluded) },
      snapshotExcluded:{ keys:snapshotExcluded.length, bytes:sum(snapshotExcluded), rows:snapshotExcluded },
      projectSlots:{ keys:projectSlots.length, bytes:sum(projectSlots), rows:projectSlots },
      orphanProjectSlots:{ keys:orphanSlots.length, bytes:sum(orphanSlots), rows:orphanSlots },
      internalBackups:{ keys:internalBackups.length, bytes:sum(internalBackups), rows:internalBackups },
      cacheKeys:{ keys:cacheKeys.length, bytes:sum(cacheKeys), rows:cacheKeys },
      largestKeys:rows.slice().sort((a,b)=> b.size - a.size).slice(0, 12),
    };
  }

  function auditCurrent(){
    return buildAuditFromKeys(readLocalStorageKeys({ prefix:'fc_' }));
  }

  function auditSnapshot(snapshot){
    return buildAuditFromKeys(rawKeysFromSnapshot(snapshot, true));
  }

  function rowsReport(title, rows, limit){
    const list = Array.isArray(rows) ? rows.slice(0, limit || 10) : [];
    const lines = [title + ':'];
    if(!list.length){ lines.push('- Brak.'); return lines; }
    list.forEach((row)=> lines.push(`- ${row.key} — ${formatBytes(row.size)}`));
    return lines;
  }

  function buildReport(audit){
    const a = audit || auditCurrent();
    const lines = [];
    lines.push('Audyt pamięci i backupu:');
    lines.push('- Klucze fc_* razem: ' + (a.totalKeys || 0));
    lines.push('- Rozmiar kluczy fc_* razem: ' + formatBytes(a.totalBytes));
    lines.push('- Magazyn backupów: ' + formatBytes(a.backupStore && a.backupStore.size));
    lines.push('- Snapshot backupu obejmie: ' + (a.snapshotIncluded.keys || 0) + ' kluczy / ' + formatBytes(a.snapshotIncluded.bytes));
    lines.push('- Wykluczone ze snapshotu: ' + (a.snapshotExcluded.keys || 0) + ' kluczy / ' + formatBytes(a.snapshotExcluded.bytes));
    lines.push('- Sloty projektów inwestorów: ' + (a.projectSlots.keys || 0) + ' / ' + formatBytes(a.projectSlots.bytes));
    lines.push('- Osierocone sloty projektów: ' + (a.orphanProjectSlots.keys || 0) + ' / ' + formatBytes(a.orphanProjectSlots.bytes));
    lines.push('- Techniczne kopie awaryjne: ' + (a.internalBackups.keys || 0) + ' / ' + formatBytes(a.internalBackups.bytes));
    lines.push('- Cache ROZRYS: ' + (a.cacheKeys.keys || 0) + ' / ' + formatBytes(a.cacheKeys.bytes));
    lines.push('');
    rowsReport('Największe klucze', a.largestKeys, 12).forEach((line)=> lines.push(line));
    lines.push('');
    rowsReport('Największe osierocone sloty projektów', (a.orphanProjectSlots.rows || []).slice().sort((x,y)=> y.size - x.size), 12).forEach((line)=> lines.push(line));
    return lines.join('\n');
  }

  function appendDiagnosticsReport(baseReport, snapshot){
    const base = String(baseReport || '').trimEnd();
    const audit = snapshot ? auditSnapshot(snapshot) : auditCurrent();
    return base + '\n\n' + buildReport(audit);
  }

  FC.dataStorageAudit = {
    parseProjectSlotKey,
    isInternalBackupKey,
    isCacheKey,
    readLocalStorageKeys,
    rawKeysFromSnapshot,
    getKnownInvestorIds,
    buildAuditFromKeys,
    auditCurrent,
    auditSnapshot,
    buildReport,
    appendDiagnosticsReport,
    formatBytes,
  };
})();
