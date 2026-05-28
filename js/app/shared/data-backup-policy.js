(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};

  const RETENTION_DAYS = 7;
  const MIN_KEEP = 10;
  const AUTO_PROTECT_LATEST = 3;

  function now(){ return Date.now(); }

  function sortNewest(list){
    return (Array.isArray(list) ? list : []).slice().sort((a,b)=> Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
  }

  function isTestBackup(item){
    return String(item && item.reason || '') === 'before-tests';
  }

  function getBackupGroup(item){
    return isTestBackup(item) ? 'test' : 'app';
  }

  function isPinnedProtected(item){
    return !!(item && (item.pinned || item.safeState || String(item.reason || '') === 'safe-state'));
  }

  function groupBackups(list){
    const groups = { app:[], test:[] };
    sortNewest(list).forEach((item)=> groups[getBackupGroup(item)].push(item));
    return groups;
  }

  function getLatestProtectedIds(list, group){
    const grouped = groupBackups(list || []);
    return new Set((grouped[group] || []).slice(0, AUTO_PROTECT_LATEST).map((item)=> String(item.id || '')));
  }

  function getBackupProtection(item, list){
    const backup = item || {};
    const id = String(backup.id || '');
    const group = getBackupGroup(backup);
    const pinnedProtected = isPinnedProtected(backup);
    const latestProtected = !!(id && getLatestProtectedIds(list || [], group).has(id));
    return { group, protected:pinnedProtected || latestProtected, pinnedProtected, latestProtected };
  }

  function isProtected(item, list){
    return !!getBackupProtection(item, list).protected;
  }

  function pruneBackups(list, options){
    const opts = Object.assign({ retentionDays:RETENTION_DAYS, minKeep:MIN_KEEP }, options || {});
    const all = sortNewest(list);
    if(!all.length) return all;
    const cutoff = now() - (Number(opts.retentionDays || RETENTION_DAYS) * 24 * 60 * 60 * 1000);
    const keepIds = new Set();
    const grouped = groupBackups(all);
    Object.keys(grouped).forEach((group)=>{
      const groupList = grouped[group];
      groupList.slice(0, Math.max(1, Number(opts.minKeep || MIN_KEEP))).forEach((item)=> keepIds.add(String(item.id || '')));
      groupList.forEach((item)=>{
        if(isPinnedProtected(item)) keepIds.add(String(item.id || ''));
        if(Number(item.createdAtMs || 0) >= cutoff) keepIds.add(String(item.id || ''));
      });
    });
    if(!keepIds.size && all[0]) keepIds.add(String(all[0].id || ''));
    return all.filter((item)=> keepIds.has(String(item.id || '')));
  }

  root.FC.dataBackupPolicy = {
    RETENTION_DAYS,
    MIN_KEEP,
    AUTO_PROTECT_LATEST,
    now,
    sortNewest,
    isTestBackup,
    getBackupGroup,
    isPinnedProtected,
    groupBackups,
    getBackupProtection,
    isProtected,
    pruneBackups,
  };
})();
