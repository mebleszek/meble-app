// js/app/investor/investors-store.js
// Lokalna baza inwestorów (localStorage). Przygotowane pod przyszły sync.
(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const KEY_INVESTORS = 'fc_investors_v1';
  const KEY_CURRENT = 'fc_current_investor_v1';
  const DEFAULT_PROJECT_STATUS = 'nowy';

  function now(){ return Date.now(); }
  function uid(){ return 'inv_' + Math.random().toString(36).slice(2,10) + '_' + now().toString(36); }

  function todayInput(){
    try{ return new Date().toISOString().slice(0, 10); }catch(_){ return ''; }
  }

  function toDateInput(value, fallback){
    const text = String(value == null ? '' : value).trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    if(Number.isFinite(Number(text)) && Number(text) > 0){
      try{ return new Date(Number(text)).toISOString().slice(0, 10); }catch(_){ }
    }
    const fb = String(fallback == null ? '' : fallback).trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(fb)) return fb;
    if(Number.isFinite(Number(fb)) && Number(fb) > 0){
      try{ return new Date(Number(fb)).toISOString().slice(0, 10); }catch(_){ }
    }
    return todayInput();
  }

  function normalizeRoom(room){
    const src = room && typeof room === 'object' ? room : {};
    return {
      id: String(src.id || ''),
      baseType: String(src.baseType || src.kind || src.type || ''),
      name: String(src.name || src.label || ''),
      label: String(src.label || src.name || ''),
      projectStatus: String(src.projectStatus || src.status || DEFAULT_PROJECT_STATUS),
    };
  }

  function normalizeInvestor(inv){
    const src = inv && typeof inv === 'object' ? inv : {};
    const createdAt = Number(src.createdAt) > 0 ? Number(src.createdAt) : now();
    const updatedAt = Number(src.updatedAt) > 0 ? Number(src.updatedAt) : createdAt;
    const kind = src.kind === 'company' ? 'company' : 'person';
    return {
      id: String(src.id || uid()),
      kind,
      name: String(src.name || ''),
      companyName: String(src.companyName || ''),
      phone: String(src.phone || ''),
      email: String(src.email || ''),
      city: String(src.city || ''),
      address: String(src.address || ''),
      source: String(src.source || ''),
      nip: String(src.nip || ''),
      notes: String(src.notes || ''),
      rooms: Array.isArray(src.rooms) ? src.rooms.map(normalizeRoom) : [],
      addedDate: toDateInput(src.addedDate || src.createdDate, createdAt),
      createdAt,
      updatedAt,
    };
  }

  function readAll(){
    try{
      const raw = localStorage.getItem(KEY_INVESTORS);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.map(normalizeInvestor) : [];
    }catch(_){ return []; }
  }

  function writeAll(list){
    try{ localStorage.setItem(KEY_INVESTORS, JSON.stringify((list || []).map(normalizeInvestor))); }catch(_){ }
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
    const normalized = normalizeInvestor(inv);
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
      phone: (initial && initial.phone) || '',
      email: (initial && initial.email) || '',
      city: (initial && initial.city) || '',
      address: (initial && initial.address) || '',
      source: (initial && initial.source) || '',
      nip: (initial && initial.nip) || '',
      notes: (initial && initial.notes) || '',
      rooms: Array.isArray(initial && initial.rooms) ? initial.rooms : [],
      addedDate: (initial && (initial.addedDate || initial.createdDate)) || toDateInput(ts, ts),
      createdAt: ts,
      updatedAt: ts,
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
        inv.name, inv.companyName, inv.phone, inv.email, inv.city, inv.address, inv.nip, inv.notes, inv.addedDate
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
  };
})();
