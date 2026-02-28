// js/app/investors-store.js
// Lokalna baza inwestorów (localStorage). Przygotowane pod przyszły sync.
(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const KEY_INVESTORS = 'fc_investors_v1';
  const KEY_CURRENT = 'fc_current_investor_v1';

  function now(){ return Date.now(); }
  function uid(){ return 'inv_' + Math.random().toString(36).slice(2,10) + '_' + now().toString(36); }

  function readAll(){
    try{
      const raw = localStorage.getItem(KEY_INVESTORS);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(_){ return []; }
  }

  function writeAll(list){
    try{ localStorage.setItem(KEY_INVESTORS, JSON.stringify(list || [])); }catch(_){ }
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

  function getById(id){
    if(!id) return null;
    const list = readAll();
    return list.find(x => x && x.id === id) || null;
  }

  function upsert(inv){
    if(!inv || !inv.id) return null;
    const list = readAll();
    const idx = list.findIndex(x => x && x.id === inv.id);
    if(idx >= 0) list[idx] = inv;
    else list.unshift(inv);
    writeAll(list);
    return inv;
  }

  function create(initial){
    const ts = now();
    const inv = {
      id: uid(),
      kind: (initial && initial.kind) || 'person', // person|company
      name: (initial && initial.name) || '',
      companyName: (initial && initial.companyName) || '',
      phone: (initial && initial.phone) || '',
      email: (initial && initial.email) || '',
      city: (initial && initial.city) || '',
      address: (initial && initial.address) || '',
      source: (initial && initial.source) || '',
      notes: (initial && initial.notes) || '',
      status: (initial && initial.status) || 'nowy',
      // lista skrótów do pomieszczeń/projektów (dla MVP: tylko pokoje w aktualnym projekcie)
      rooms: Array.isArray(initial && initial.rooms) ? initial.rooms : [],
      createdAt: ts,
      updatedAt: ts,
    };
    const list = readAll();
    list.unshift(inv);
    writeAll(list);
    setCurrentId(inv.id);
    return inv;
  }

  function update(id, patch){
    const inv = getById(id);
    if(!inv) return null;
    const next = Object.assign({}, inv, patch || {});
    next.updatedAt = now();
    return upsert(next);
  }

  function remove(id){
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
        inv.name, inv.companyName, inv.phone, inv.email, inv.city, inv.address, inv.notes
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
    KEY_INVESTORS,
    KEY_CURRENT,
  };
})();
