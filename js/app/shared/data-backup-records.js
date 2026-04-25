(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const policy = FC.dataBackupPolicy || {};
  const snapApi = FC.dataBackupSnapshot || {};

  function now(){ return policy.now ? policy.now() : Date.now(); }
  function iso(ts){ try{ return new Date(ts || now()).toISOString(); }catch(_){ return String(ts || now()); } }
  function uid(prefix){ return String(prefix || 'backup') + '_' + now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }

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

  function getBackupHash(item){
    if(!item) return '';
    const stored = String(item.hash || '').trim();
    if(stored) return stored;
    try{ return item.snapshot ? String(snapApi.hashSnapshot(item.snapshot) || '') : ''; }catch(_){ return ''; }
  }

  function findBackupByHash(hash, list){
    const target = String(hash || '').trim();
    if(!target) return null;
    const sorter = policy.sortNewest || ((rows)=> Array.isArray(rows) ? rows.slice() : []);
    return sorter(list).find((item)=> getBackupHash(item) === target) || null;
  }

  function buildBackupFromSnapshot(snapshot, hash, options){
    const opts = Object.assign({ reason:'manual', pinned:false, safeState:false }, options || {});
    const createdAtMs = now();
    const backup = {
      id:uid('bak'),
      reason:String(opts.reason || 'manual'),
      label:String(opts.label || makeLabel(opts.reason)),
      createdAt:iso(createdAtMs),
      createdAtMs,
      hash:String(hash || snapApi.hashSnapshot(snapshot) || ''),
      pinned:!!opts.pinned,
      safeState:!!opts.safeState || String(opts.reason || '') === 'safe-state',
      snapshot,
    };
    if(backup.safeState) backup.pinned = true;
    return backup;
  }

  FC.dataBackupRecords = { now, iso, uid, makeLabel, getBackupHash, findBackupByHash, buildBackupFromSnapshot };
})();
