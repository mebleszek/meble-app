(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const auditApi = FC.dataStorageAudit || {};

  function planFromAudit(audit){
    const rows = audit && audit.orphanProjectSlots && Array.isArray(audit.orphanProjectSlots.rows)
      ? audit.orphanProjectSlots.rows.slice()
      : [];
    return {
      audit,
      rows,
      count:rows.length,
      bytes:rows.reduce((sum, row)=> sum + (Number(row && row.size) || 0), 0),
    };
  }

  function planFromKeys(rawKeys){
    const audit = auditApi.buildAuditFromKeys ? auditApi.buildAuditFromKeys(rawKeys || {}) : null;
    return planFromAudit(audit);
  }

  function analyzeCurrent(){
    const audit = auditApi.auditCurrent ? auditApi.auditCurrent() : null;
    return planFromAudit(audit);
  }

  function cleanupCurrent(){
    const before = analyzeCurrent();
    const removed = [];
    before.rows.forEach((row)=>{
      const key = String(row && row.key || '');
      if(!key) return;
      try{
        localStorage.removeItem(key);
        removed.push(row);
      }catch(_){ }
    });
    const bytes = removed.reduce((sum, row)=> sum + (Number(row && row.size) || 0), 0);
    return {
      removed:removed.length,
      removedBytes:bytes,
      rows:removed,
      before,
      after:analyzeCurrent(),
    };
  }

  function hasCurrentOrphans(){ return analyzeCurrent().count > 0; }

  FC.dataStorageOrphanCleanup = { planFromKeys, analyzeCurrent, cleanupCurrent, hasCurrentOrphans };
})();
