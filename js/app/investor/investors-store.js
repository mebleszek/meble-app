// js/app/investor/investors-store.js
// Lokalna baza inwestorów (localStorage). Przygotowane pod przyszły sync.
(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const KEY_INVESTORS = 'fc_investors_v1';
  const KEY_CURRENT = 'fc_current_investor_v1';
  const KEY_REMOVED = 'fc_investor_removed_ids_v1';
  const DEFAULT_PROJECT_STATUS = 'nowy';
  const STORAGE_KEYS = (FC.constants && FC.constants.STORAGE_KEYS) || {};
  const KEY_PROJECTS = STORAGE_KEYS.projects || 'fc_projects_v1';
  const KEY_QUOTE_SNAPSHOTS = STORAGE_KEYS.quoteSnapshots || 'fc_quote_snapshots_v1';
  let _isRecovering = false;

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

  function prettifyTechnicalRoomText(text, fallbackBaseType){
    const raw = String(text || '').trim();
    if(!raw) return '';
    const match = raw.match(/^room_([^_]+)_(.+)_([a-z0-9]{4,})$/i);
    if(!match) return raw;
    const baseType = String(match[1] || fallbackBaseType || '').trim();
    let middle = String(match[2] || '').trim();
    if(baseType && middle.toLowerCase().startsWith(baseType.toLowerCase() + '_')) middle = middle.slice(baseType.length + 1);
    return middle.replace(/_/g, ' ').trim() || raw;
  }

  function normalizeRoom(room){
    const src = room && typeof room === 'object' ? room : {};
    const baseType = String(src.baseType || src.kind || src.type || '');
    const name = prettifyTechnicalRoomText(src.name || src.label || '', baseType);
    const label = prettifyTechnicalRoomText(src.label || src.name || '', baseType);
    return {
      id: String(src.id || ''),
      baseType,
      name: String(name || ''),
      label: String(label || name || ''),
      projectStatus: String(src.projectStatus || src.status || DEFAULT_PROJECT_STATUS),
    };
  }


  function normalizeMeta(meta){
    const src = meta && typeof meta === 'object' ? meta : {};
    return {
      testData: !!src.testData,
      testOwner: String(src.testOwner || ''),
      testRunId: String(src.testRunId || ''),
      createdBy: String(src.createdBy || ''),
      source: String(src.source || ''),
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
      ownerName: String(src.ownerName || src.companyOwner || ''),
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
      meta: normalizeMeta(src.meta),
    };
  }

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

  function appendUniqueRoom(target, room){
    const normalized = normalizeRoom(room);
    if(!normalized || !normalized.id) return target;
    const list = Array.isArray(target) ? target : [];
    const idx = list.findIndex((item)=> String(item && item.id || '') === normalized.id);
    if(idx >= 0){
      const prev = list[idx] || {};
      list[idx] = normalizeRoom({
        id: normalized.id,
        baseType: normalized.baseType || prev.baseType || '',
        name: normalized.name || prev.name || '',
        label: normalized.label || prev.label || normalized.name || prev.name || '',
        projectStatus: normalized.projectStatus || prev.projectStatus || DEFAULT_PROJECT_STATUS,
      });
      return list;
    }
    list.push(normalized);
    return list;
  }

  function inferRoomBaseType(roomId, def){
    const direct = String(def && (def.baseType || def.kind || def.type) || '').trim();
    if(direct) return direct;
    const key = String(roomId || '').trim();
    const match = key.match(/^room_([^_]+)/i);
    return match ? String(match[1] || '').trim() : '';
  }

  function roomsFromProjectRecord(record){
    const src = record && typeof record === 'object' ? record : {};
    const status = String(src.status || DEFAULT_PROJECT_STATUS);
    const out = [];
    const projectData = src.projectData && typeof src.projectData === 'object' ? src.projectData : {};
    const meta = projectData.meta && typeof projectData.meta === 'object' ? projectData.meta : {};
    const roomDefs = meta.roomDefs && typeof meta.roomDefs === 'object' ? meta.roomDefs : {};
    const roomOrder = Array.isArray(meta.roomOrder) ? meta.roomOrder.map((item)=> String(item || '').trim()).filter(Boolean) : [];
    roomOrder.forEach((roomId)=> {
      const def = roomDefs[roomId] && typeof roomDefs[roomId] === 'object' ? roomDefs[roomId] : {};
      appendUniqueRoom(out, {
        id: roomId,
        baseType: inferRoomBaseType(roomId, def),
        name: String(def.name || def.label || roomId || ''),
        label: String(def.label || def.name || roomId || ''),
        projectStatus: String(def.projectStatus || status || DEFAULT_PROJECT_STATUS),
      });
    });
    Object.keys(roomDefs).forEach((roomId)=> {
      const def = roomDefs[roomId] && typeof roomDefs[roomId] === 'object' ? roomDefs[roomId] : {};
      appendUniqueRoom(out, {
        id: roomId,
        baseType: inferRoomBaseType(roomId, def),
        name: String(def.name || def.label || roomId || ''),
        label: String(def.label || def.name || roomId || ''),
        projectStatus: String(def.projectStatus || status || DEFAULT_PROJECT_STATUS),
      });
    });
    Object.keys(projectData).forEach((roomId)=> {
      if(roomId === 'schemaVersion' || roomId === 'meta') return;
      const room = projectData[roomId];
      if(!(room && typeof room === 'object' && Array.isArray(room.cabinets))) return;
      const def = roomDefs[roomId] && typeof roomDefs[roomId] === 'object' ? roomDefs[roomId] : {};
      appendUniqueRoom(out, {
        id: roomId,
        baseType: inferRoomBaseType(roomId, def),
        name: String(def.name || def.label || roomId || ''),
        label: String(def.label || def.name || roomId || ''),
        projectStatus: String(def.projectStatus || status || DEFAULT_PROJECT_STATUS),
      });
    });
    return out;
  }

  function roomsFromSnapshot(snapshot){
    const src = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const scope = src.scope && typeof src.scope === 'object' ? src.scope : {};
    const ids = Array.isArray(scope.selectedRooms) ? scope.selectedRooms.map((item)=> String(item || '').trim()).filter(Boolean) : [];
    const labels = Array.isArray(scope.roomLabels) ? scope.roomLabels.map((item)=> String(item || '').trim()) : [];
    const status = String(src.project && src.project.status || src.meta && src.meta.acceptedStage || DEFAULT_PROJECT_STATUS);
    const out = [];
    ids.forEach((roomId, index)=> {
      appendUniqueRoom(out, {
        id: roomId,
        baseType: inferRoomBaseType(roomId, null),
        name: String(labels[index] || roomId || ''),
        label: String(labels[index] || roomId || ''),
        projectStatus: status || DEFAULT_PROJECT_STATUS,
      });
    });
    return out;
  }

  function mergeCandidateInto(map, investorLike, rooms, fallback){
    const src = investorLike && typeof investorLike === 'object' ? investorLike : {};
    const fb = fallback && typeof fallback === 'object' ? fallback : {};
    const id = String(src.id || fb.id || '').trim();
    if(!id) return;
    const existing = map.get(id) || normalizeInvestor({
      id,
      kind: src.kind || fb.kind || 'person',
      name: src.name || fb.name || fb.title || '',
      companyName: src.companyName || fb.companyName || '',
      ownerName: src.ownerName || src.companyOwner || fb.ownerName || fb.companyOwner || '',
      phone: src.phone || fb.phone || '',
      email: src.email || fb.email || '',
      city: src.city || fb.city || '',
      address: src.address || fb.address || '',
      source: src.source || fb.source || '',
      nip: src.nip || fb.nip || '',
      notes: src.notes || fb.notes || '',
      rooms: [],
      addedDate: src.addedDate || src.createdDate || fb.addedDate || fb.createdDate || '',
      createdAt: Number(src.createdAt) > 0 ? Number(src.createdAt) : (Number(fb.createdAt) > 0 ? Number(fb.createdAt) : now()),
      updatedAt: Number(src.updatedAt) > 0 ? Number(src.updatedAt) : (Number(fb.updatedAt) > 0 ? Number(fb.updatedAt) : now()),
      meta: Object.assign({}, fb.meta || {}, src.meta || {}),
    });
    const merged = normalizeInvestor(Object.assign({}, existing, {
      kind: src.kind || existing.kind || fb.kind || 'person',
      name: src.name || existing.name || fb.name || fb.title || '',
      companyName: src.companyName || existing.companyName || fb.companyName || '',
      ownerName: src.ownerName || src.companyOwner || existing.ownerName || fb.ownerName || fb.companyOwner || '',
      phone: src.phone || existing.phone || fb.phone || '',
      email: src.email || existing.email || fb.email || '',
      city: src.city || existing.city || fb.city || '',
      address: src.address || existing.address || fb.address || '',
      source: src.source || existing.source || fb.source || '',
      nip: src.nip || existing.nip || fb.nip || '',
      notes: src.notes || existing.notes || fb.notes || '',
      addedDate: existing.addedDate || src.addedDate || src.createdDate || fb.addedDate || fb.createdDate || '',
      createdAt: Math.min(Number(existing.createdAt) || now(), Number(src.createdAt) > 0 ? Number(src.createdAt) : (Number(fb.createdAt) > 0 ? Number(fb.createdAt) : now())),
      updatedAt: Math.max(Number(existing.updatedAt) || 0, Number(src.updatedAt) || 0, Number(fb.updatedAt) || 0, now()),
      meta: Object.assign({}, existing.meta || {}, fb.meta || {}, src.meta || {}),
    }));
    const nextRooms = Array.isArray(merged.rooms) ? merged.rooms.slice() : [];
    (Array.isArray(rooms) ? rooms : []).forEach((room)=> appendUniqueRoom(nextRooms, room));
    merged.rooms = nextRooms;
    map.set(id, normalizeInvestor(merged));
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

  function isTestRecoveryRecord(record){
    const src = record && typeof record === 'object' ? record : {};
    const meta = src.meta && typeof src.meta === 'object' ? src.meta : {};
    const source = String(meta.source || src.source || '').trim().toLowerCase();
    if(meta.testData === true) return true;
    return source.startsWith('test-');
  }

  function hasExplicitTestRecoverySources(){
    try{
      const projects = readRawProjectRecords();
      if((Array.isArray(projects) ? projects : []).some((record)=> isTestRecoveryRecord(record))) return true;
    }catch(_){ }
    try{
      const snapshots = readRawQuoteSnapshots();
      if((Array.isArray(snapshots) ? snapshots : []).some((snapshot)=> isTestRecoveryRecord(snapshot))) return true;
    }catch(_){ }
    return false;
  }

  function buildRecoveryCandidates(options){
    const cfg = options && typeof options === 'object' ? options : {};
    const testOnly = !!cfg.testOnly;
    const recovered = new Map();
    try{
      const projects = readRawProjectRecords();
      (Array.isArray(projects) ? projects : []).forEach((record)=> {
        if(testOnly && !isTestRecoveryRecord(record)) return;
        const investorId = String(record && record.investorId || '').trim();
        if(!investorId) return;
        mergeCandidateInto(recovered, { id:investorId, name:String(record && record.title || '') }, roomsFromProjectRecord(record), record);
      });
    }catch(_){ }
    try{
      const snapshots = readRawQuoteSnapshots();
      (Array.isArray(snapshots) ? snapshots : []).forEach((snapshot)=> {
        if(testOnly && !isTestRecoveryRecord(snapshot)) return;
        const investorId = String(snapshot && snapshot.investor && snapshot.investor.id || snapshot && snapshot.project && snapshot.project.investorId || '').trim();
        if(!investorId) return;
        const investorLike = Object.assign({}, snapshot && snapshot.investor || {}, { id:investorId });
        const fallback = {
          id: investorId,
          title: String(snapshot && snapshot.project && snapshot.project.title || ''),
          createdAt: Number(snapshot && snapshot.generatedAt) || 0,
          updatedAt: Number(snapshot && snapshot.generatedAt) || 0,
          source: String(snapshot && snapshot.meta && snapshot.meta.source || 'quote-snapshot-store'),
          meta: snapshot && snapshot.meta,
        };
        mergeCandidateInto(recovered, investorLike, roomsFromSnapshot(snapshot), fallback);
      });
    }catch(_){ }
    return recovered;
  }

  function isKnownLeakedTestInvestor(inv){
    const src = inv && typeof inv === 'object' ? inv : {};
    const id = String(src.id || '').trim();
    if(id === 'inv_new_only') return true;
    if(id === 'inv_missing_old') return true;
    if(id === 'inv_snapshot_only' || id === 'inv_snapshot_only_test' || id === 'inv_write_test_only') return true;
    const name = String(src.name || src.companyName || '').trim().toLowerCase();
    return id && name === 'jan test' && String(src.phone || '') === '111';
  }

  function recoverMissingInvestors(list){
    const current = Array.isArray(list) ? list.map(normalizeInvestor) : [];
    if(_isRecovering) return current;
    _isRecovering = true;
    try{
      const removedIds = readRemovedIds();
      const existingIds = new Set(current.map((inv)=> String(inv && inv.id || '')).filter(Boolean));
      let recovered = buildRecoveryCandidates({ testOnly: false });
      if(current.length === 0){
        const explicitTestSources = hasExplicitTestRecoverySources();
        if(explicitTestSources){
          const filtered = new Map();
          recovered.forEach((candidate, id)=> {
            if(isTestRecoveryRecord(candidate)) filtered.set(id, candidate);
          });
          recovered = filtered;
        }
      }
      const additions = [];
      recovered.forEach((candidate, id)=> {
        const key = String(id || '').trim();
        if(!key || existingIds.has(key) || removedIds.has(key)) return;
        additions.push(normalizeInvestor(candidate));
      });
      if(!additions.length) return current;
      const onlyLeakedFixture = current.length > 0 && current.every(isKnownLeakedTestInvestor);
      const additionsHaveRealData = additions.some((candidate)=> !isTestRecoveryRecord(candidate));
      const base = (onlyLeakedFixture && additionsHaveRealData) ? current.filter((inv)=> !isKnownLeakedTestInvestor(inv)) : current;
      return base.concat(additions);
    }finally{
      _isRecovering = false;
    }
  }

  function readAll(){
    return recoverMissingInvestors(readStoredAll());
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
    unmarkRemovedId(normalized.id);
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
    markRemovedId(id);
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
      readSessionSnapshotInvestors,
      buildRecoveryCandidates,
      recoverMissingInvestors,
      readRemovedIds,
    },
  };
})();
