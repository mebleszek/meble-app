// js/app/investors-store.js
// Lokalna baza inwestorów + cienka warstwa pod przyszły sync (Google).
// Loaded after storage.js and before any modules that use FC.investors.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const KEY = 'fc_investors_v1';

  function nowISO(){ return new Date().toISOString(); }
  function uid(){
    // short-ish id, good enough for local storage
    return 'inv_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
  }

  function loadAll(){
    const fallback = { version: 1, items: [] };
    const db = (FC.storage && FC.storage.getJSON) ? FC.storage.getJSON(KEY, fallback) : fallback;
    if(!db || !Array.isArray(db.items)) return fallback;
    return db;
  }

  function saveAll(db){
    if(FC.storage && FC.storage.setJSON){
      FC.storage.setJSON(KEY, db);
    }
  }

  function normalizeInvestor(inv){
    const base = {
      id: uid(),
      kind: 'osoba', // 'osoba' | 'firma'
      name: '',
      phone: '',
      email: '',
      address: '',
      source: '',
      notes: '',
      status: 'nowy', // nowy | wstepna | wycena | umowa | produkcja | montaz | zakonczone | odrzucone
      createdAt: nowISO(),
      updatedAt: nowISO(),
      rooms: [] // [{ roomType, label, updatedAt }]
    };
    const out = Object.assign({}, base, inv || {});
    if(!out.id) out.id = uid();
    if(!Array.isArray(out.rooms)) out.rooms = [];
    if(!out.createdAt) out.createdAt = nowISO();
    out.updatedAt = nowISO();
    return out;
  }

  function upsert(inv){
    const db = loadAll();
    const n = normalizeInvestor(inv);
    const idx = db.items.findIndex(x => x && x.id === n.id);
    if(idx >= 0) db.items[idx] = Object.assign({}, db.items[idx], n, { updatedAt: nowISO() });
    else db.items.unshift(n);
    saveAll(db);
    return n;
  }

  function getById(id){
    if(!id) return null;
    const db = loadAll();
    return db.items.find(x => x && x.id === id) || null;
  }

  function removeById(id){
    if(!id) return false;
    const db = loadAll();
    const before = db.items.length;
    db.items = db.items.filter(x => x && x.id !== id);
    saveAll(db);
    return db.items.length !== before;
  }

  function search(q){
    const db = loadAll();
    const query = String(q||'').trim().toLowerCase();
    if(!query) return db.items.slice();
    return db.items.filter(inv => {
      const hay = [
        inv.name, inv.phone, inv.email, inv.address, inv.source, inv.status
      ].join(' ').toLowerCase();
      return hay.includes(query);
    });
  }

  // Future sync placeholder (Google Drive/Sheets etc.)
  // Right now: local only.
  const sync = {
    isEnabled(){ return false; },
    async push(){ return { ok:false, reason:'local-only' }; },
    async pull(){ return { ok:false, reason:'local-only' }; }
  };

  FC.investors = {
    key: KEY,
    uid,
    loadAll,
    saveAll,
    normalizeInvestor,
    upsert,
    getById,
    removeById,
    search,
    sync
  };
})();
