// js/app/investor/investors-model.js
// Model i normalizacja danych inwestora. Bez storage, UI i recovery.
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
      lastManualProjectStatus: String(src.lastManualProjectStatus || src.manualProjectStatus || ''),
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
    const srcMeta = src.meta && typeof src.meta === 'object' ? src.meta : {};
    const createdAt = Number(src.createdAt) > 0 ? Number(src.createdAt) : now();
    const updatedAt = Number(src.updatedAt) > 0 ? Number(src.updatedAt) : createdAt;
    const kind = src.kind === 'company' ? 'company' : 'person';
    const out = {
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
    if(src.__test === true || srcMeta.__test === true || out.meta.testData){
      out.__test = true;
      out.__testRunId = String(src.__testRunId || srcMeta.__testRunId || srcMeta.testRunId || out.meta.testRunId || '');
      out.meta.__test = true;
      out.meta.__testRunId = out.__testRunId;
    }
    return out;
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
        lastManualProjectStatus: normalized.lastManualProjectStatus || prev.lastManualProjectStatus || '',
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

  FC.investorsModel = {
    KEY_INVESTORS,
    KEY_CURRENT,
    KEY_REMOVED,
    KEY_PROJECTS,
    KEY_QUOTE_SNAPSHOTS,
    DEFAULT_PROJECT_STATUS,
    now,
    uid,
    todayInput,
    toDateInput,
    prettifyTechnicalRoomText,
    normalizeRoom,
    normalizeMeta,
    normalizeInvestor,
    appendUniqueRoom,
    inferRoomBaseType,
  };
})();
