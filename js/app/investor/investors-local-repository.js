// js/app/investor/investors-local-repository.js
// Lokalna granica storage inwestorów. Bez logiki recovery i bez UI.
(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const model = FC.investorsModel || {};

  const KEY_INVESTORS = model.KEY_INVESTORS || 'fc_investors_v1';
  const KEY_CURRENT = model.KEY_CURRENT || 'fc_current_investor_v1';
  const KEY_REMOVED = model.KEY_REMOVED || 'fc_investor_removed_ids_v1';
  const KEY_PROJECTS = model.KEY_PROJECTS || 'fc_projects_v1';
  const KEY_QUOTE_SNAPSHOTS = model.KEY_QUOTE_SNAPSHOTS || 'fc_quote_snapshots_v1';
  const normalizeInvestor = typeof model.normalizeInvestor === 'function' ? model.normalizeInvestor : (item)=> item;

  function readSessionSnapshotInvestors(){
    try{
      const raw = localStorage.getItem('fc_edit_session_v1');
      if(!raw) return [];
      const parsed = JSON.parse(raw);
      const snapshot = parsed && parsed.snapshot && typeof parsed.snapshot === 'object' ? parsed.snapshot : null;
      const investorsRaw = snapshot && Object.prototype.hasOwnProperty.call(snapshot, KEY_INVESTORS)
        ? snapshot[KEY_INVESTORS]
        : null;
      if(!investorsRaw) return [];
      const arr = JSON.parse(investorsRaw);
      return Array.isArray(arr) ? arr.map(normalizeInvestor) : [];
    }catch(_){ return []; }
  }

  function mergeMissingContactFieldsFromSession(list){
    const current = Array.isArray(list) ? list.map(normalizeInvestor) : [];
    if(!current.length) return current;
    const sessionInvestors = readSessionSnapshotInvestors();
    if(!sessionInvestors.length) return current;
    const byId = new Map(sessionInvestors.map((inv)=> [String(inv && inv.id || ''), normalizeInvestor(inv)]));
    return current.map((inv)=> {
      const key = String(inv && inv.id || '').trim();
      const backup = byId.get(key);
      if(!backup) return inv;
      return normalizeInvestor(Object.assign({}, inv, {
        name: inv.name || backup.name || '',
        companyName: inv.companyName || backup.companyName || '',
        ownerName: inv.ownerName || backup.ownerName || '',
        phone: inv.phone || backup.phone || '',
        email: inv.email || backup.email || '',
        city: inv.city || backup.city || '',
        address: inv.address || backup.address || '',
        nip: inv.nip || backup.nip || '',
        notes: inv.notes || backup.notes || '',
        source: inv.source || backup.source || '',
        rooms: Array.isArray(inv.rooms) && inv.rooms.length ? inv.rooms : backup.rooms,
      }));
    });
  }

  function readStoredAll(){
    try{
      const raw = localStorage.getItem(KEY_INVESTORS);
      const arr = raw ? JSON.parse(raw) : [];
      const normalized = Array.isArray(arr) ? arr.map(normalizeInvestor) : [];
      return mergeMissingContactFieldsFromSession(normalized);
    }catch(_){ return []; }
  }

  function writeAll(list){
    try{ localStorage.setItem(KEY_INVESTORS, JSON.stringify((list || []).map(normalizeInvestor))); }catch(_){ }
  }

  function readRemovedIds(){
    try{
      const raw = localStorage.getItem(KEY_REMOVED);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr.map((item)=> String(item || '').trim()).filter(Boolean) : []);
    }catch(_){ return new Set(); }
  }

  function writeRemovedIds(ids){
    try{ localStorage.setItem(KEY_REMOVED, JSON.stringify(Array.from(ids || []).map((item)=> String(item || '').trim()).filter(Boolean))); }catch(_){ }
  }

  function markRemovedId(id){
    const key = String(id || '').trim();
    if(!key) return;
    const ids = readRemovedIds();
    ids.add(key);
    writeRemovedIds(ids);
  }

  function unmarkRemovedId(id){
    const key = String(id || '').trim();
    if(!key) return;
    const ids = readRemovedIds();
    if(!ids.has(key)) return;
    ids.delete(key);
    writeRemovedIds(ids);
  }

  function readStorageArray(key){
    try{
      if(FC.storage && typeof FC.storage.getJSON === 'function'){
        const rows = FC.storage.getJSON(key, []);
        return Array.isArray(rows) ? rows : [];
      }
    }catch(_){ }
    try{
      const raw = localStorage.getItem(key);
      const rows = raw ? JSON.parse(raw) : [];
      return Array.isArray(rows) ? rows : [];
    }catch(_){ return []; }
  }

  function readRawProjectRecords(){
    return readStorageArray(KEY_PROJECTS);
  }

  function readRawQuoteSnapshots(){
    return readStorageArray(KEY_QUOTE_SNAPSHOTS);
  }

  function getCurrentId(){
    try{ return localStorage.getItem(KEY_CURRENT) || null; }catch(_){ return null; }
  }

  function setCurrentId(id){
    try{
      if(!id) localStorage.removeItem(KEY_CURRENT);
      else localStorage.setItem(KEY_CURRENT, String(id));
    }catch(_){ }
  }

  FC.investorsLocalRepository = {
    readStoredAll,
    writeAll,
    readSessionSnapshotInvestors,
    mergeMissingContactFieldsFromSession,
    readRemovedIds,
    writeRemovedIds,
    markRemovedId,
    unmarkRemovedId,
    readStorageArray,
    readRawProjectRecords,
    readRawQuoteSnapshots,
    getCurrentId,
    setCurrentId,
  };
})();
