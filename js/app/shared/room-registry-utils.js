(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function createElement(tag, attrs, children, doc){
    const documentRef = doc || document;
    const el = documentRef.createElement(tag);
    if(attrs){
      Object.keys(attrs).forEach((key)=>{
        const value = attrs[key];
        if(key === 'class') el.className = value;
        else if(key === 'text') el.textContent = value;
        else if(value !== undefined && value !== null) el.setAttribute(key, value);
      });
    }
    (children || []).forEach((child)=> child && el.appendChild(child));
    return el;
  }

  function cloneRoomDrafts(list){
    return Array.isArray(list)
      ? list.map((room)=> ({
          id: room && room.id,
          baseType: room && room.baseType,
          name: room && room.name,
          label: room && room.label,
          legacy: !!(room && room.legacy),
        }))
      : [];
  }

  function normalizeRoomDraftValue(value, normalizeLabel){
    const normalize = typeof normalizeLabel === 'function'
      ? normalizeLabel
      : (entry)=> String(entry || '').trim();
    return normalize(value);
  }

  function areRoomDraftsEqual(left, right, normalizeLabel){
    const a = Array.isArray(left) ? left : [];
    const b = Array.isArray(right) ? right : [];
    if(a.length !== b.length) return false;
    for(let i = 0; i < a.length; i++){
      const lhs = a[i] || {};
      const rhs = b[i] || {};
      if(String(lhs.id || '') !== String(rhs.id || '')) return false;
      if(String(lhs.baseType || '') !== String(rhs.baseType || '')) return false;
      if(normalizeRoomDraftValue(lhs.name, normalizeLabel) !== normalizeRoomDraftValue(rhs.name, normalizeLabel)) return false;
      if(normalizeRoomDraftValue(lhs.label, normalizeLabel) !== normalizeRoomDraftValue(rhs.label, normalizeLabel)) return false;
      if(!!lhs.legacy !== !!rhs.legacy) return false;
    }
    return true;
  }

  function serializeRoomDrafts(list, normalizeLabel){
    const normalize = typeof normalizeLabel === 'function'
      ? normalizeLabel
      : (value)=> String(value || '').trim();
    return JSON.stringify((Array.isArray(list) ? list : []).map((room)=> ({
      id: room && room.id,
      baseType: room && room.baseType,
      name: normalize(room && room.name),
      label: normalize(room && room.label),
    })));
  }

  function mergeRoomCollections(config){
    const cfg = config && typeof config === 'object' ? config : {};
    const normalizeRoomDef = typeof cfg.normalizeRoomDef === 'function' ? cfg.normalizeRoomDef : (value)=> value;
    const roomMap = new Map();

    const pushRoom = (room, fallback)=>{
      const normalized = normalizeRoomDef(room, fallback || room);
      if(!(normalized && normalized.id)) return;
      const key = String(normalized.id);
      const merged = roomMap.has(key)
        ? normalizeRoomDef(Object.assign({}, roomMap.get(key), normalized), roomMap.get(key))
        : normalized;
      roomMap.set(key, merged);
    };

    (Array.isArray(cfg.activeRooms) ? cfg.activeRooms : []).forEach((room)=> pushRoom(room, room));
    (Array.isArray(cfg.investorRooms) ? cfg.investorRooms : []).forEach((room)=> pushRoom(room, room));

    if(cfg.includeLegacyKitchen && cfg.legacyRoom && !roomMap.has('kuchnia')){
      pushRoom(cfg.legacyRoom, cfg.legacyRoom);
    }

    return Array.from(roomMap.values()).filter((room)=> room && room.id);
  }

  FC.roomRegistryUtils = {
    createElement,
    cloneRoomDrafts,
    areRoomDraftsEqual,
    serializeRoomDrafts,
    mergeRoomCollections,
  };
})();
