// js/app/investor/investors-store.js
// Publiczna fasada inwestorów: CRUD/search/current/sync. Model, storage i recovery są w osobnych modułach.
(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const model = FC.investorsModel || {};
  const repo = FC.investorsLocalRepository || {};
  const recovery = FC.investorsRecovery || {};

  const KEY_INVESTORS = model.KEY_INVESTORS || 'fc_investors_v1';
  const KEY_CURRENT = model.KEY_CURRENT || 'fc_current_investor_v1';
  const KEY_REMOVED = model.KEY_REMOVED || 'fc_investor_removed_ids_v1';
  const DEFAULT_PROJECT_STATUS = model.DEFAULT_PROJECT_STATUS || 'nowy';
  const now = typeof model.now === 'function' ? model.now : ()=> Date.now();
  const uid = typeof model.uid === 'function' ? model.uid : ()=> 'inv_' + Math.random().toString(36).slice(2,10) + '_' + now().toString(36);
  const toDateInput = typeof model.toDateInput === 'function' ? model.toDateInput : ()=> '';
  const normalizeInvestor = typeof model.normalizeInvestor === 'function' ? model.normalizeInvestor : (item)=> item;
  const normalizeRoom = typeof model.normalizeRoom === 'function' ? model.normalizeRoom : (item)=> item;

  function readStoredAll(){
    return typeof repo.readStoredAll === 'function' ? repo.readStoredAll() : [];
  }

  function writeAll(list){
    if(typeof repo.writeAll === 'function') repo.writeAll(list);
  }

  function readAll(){
    const stored = readStoredAll();
    return typeof recovery.recoverMissingInvestors === 'function' ? recovery.recoverMissingInvestors(stored) : stored;
  }

  function getCurrentId(){
    return typeof repo.getCurrentId === 'function' ? repo.getCurrentId() : null;
  }

  function setCurrentId(id){
    if(typeof repo.setCurrentId === 'function') repo.setCurrentId(id);
  }

  function getById(id){
    if(!id) return null;
    const list = readAll();
    return list.find(x => x && x.id === id) || null;
  }

  function upsert(inv){
    if(!inv || !inv.id) return null;
    const normalized = normalizeInvestor(inv);
    if(typeof repo.unmarkRemovedId === 'function') repo.unmarkRemovedId(normalized.id);
    const list = readAll();
    const idx = list.findIndex(x => x && x.id === normalized.id);
    if(idx >= 0) list[idx] = normalized;
    else list.unshift(normalized);
    writeAll(list);
    return normalized;
  }

  function create(initial){
    const ts = now();
    const inv = normalizeInvestor({
      id: uid(),
      kind: (initial && initial.kind) || 'person',
      name: (initial && initial.name) || '',
      companyName: (initial && initial.companyName) || '',
      ownerName: (initial && (initial.ownerName || initial.companyOwner)) || '',
      phone: (initial && initial.phone) || '',
      email: (initial && initial.email) || '',
      city: (initial && initial.city) || '',
      address: (initial && initial.address) || '',
      source: (initial && initial.source) || '',
      nip: (initial && initial.nip) || '',
      notes: (initial && Object.prototype.hasOwnProperty.call(initial, 'notes')) ? (initial.notes || '') : 'BRAK',
      rooms: Array.isArray(initial && initial.rooms) ? initial.rooms : [],
      addedDate: (initial && (initial.addedDate || initial.createdDate)) || toDateInput(ts, ts),
      createdAt: ts,
      updatedAt: ts,
      meta: initial && initial.meta,
    });
    const list = readAll();
    list.unshift(inv);
    writeAll(list);
    setCurrentId(inv.id);
    return inv;
  }

  function update(id, patch){
    const inv = getById(id);
    if(!inv) return null;
    const next = normalizeInvestor(Object.assign({}, inv, patch || {}, { updatedAt: now() }));
    return upsert(next);
  }

  function remove(id){
    if(typeof repo.markRemovedId === 'function') repo.markRemovedId(id);
    const list = readAll().filter(x => x && x.id !== id);
    writeAll(list);
    const cur = getCurrentId();
    if(cur === id) setCurrentId(null);
  }

  function search(q){
    const query = String(q || '').trim().toLowerCase();
    const list = readAll();
    if(!query) return list;
    return list.filter(inv => {
      if(!inv) return false;
      const hay = [
        inv.name, inv.companyName, inv.ownerName, inv.phone, inv.email, inv.city, inv.address, inv.nip, inv.notes, inv.addedDate
      ].join(' ').toLowerCase();
      return hay.includes(query);
    });
  }

  // Placeholder pod przyszły sync (na razie no-op)
  async function sync(){
    return { ok: true, mode: 'local-only' };
  }

  FC.investors = {
    readAll,
    writeAll,
    search,
    getById,
    create,
    update,
    remove,
    getCurrentId,
    setCurrentId,
    sync,
    normalizeInvestor,
    normalizeRoom,
    DEFAULT_PROJECT_STATUS,
    KEY_INVESTORS,
    KEY_CURRENT,
    KEY_REMOVED,
    _debug: {
      readStoredAll,
      readSessionSnapshotInvestors: repo.readSessionSnapshotInvestors,
      buildRecoveryCandidates: recovery.buildRecoveryCandidates,
      recoverMissingInvestors: recovery.recoverMissingInvestors,
      readRemovedIds: repo.readRemovedIds,
      isDevTestInvestorRecord: recovery.isDevTestInvestorRecord,
      stripDevTestInvestorsForApp: recovery.stripDevTestInvestorsForApp,
    },
  };
})();
