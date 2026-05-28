(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const schema = FC.schema || {};
  const utils = FC.utils || {};
  const DEFAULT_PROJECT_DATA = schema.DEFAULT_PROJECT || { schemaVersion:1 };
  const CURRENT_SCHEMA_VERSION = Number(schema.CURRENT_SCHEMA_VERSION) || Number(DEFAULT_PROJECT_DATA.schemaVersion) || 1;

  function clone(value){
    try{ return typeof utils.clone === 'function' ? utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }

  function normalizeProjectData(raw){
    const src = raw && typeof raw === 'object' ? clone(raw) : {};
    const base = clone(DEFAULT_PROJECT_DATA) || { schemaVersion:CURRENT_SCHEMA_VERSION };
    let out = null;
    try{
      if(schema && typeof schema.normalizeProject === 'function') out = schema.normalizeProject(clone(src));
    }catch(_){ out = null; }
    if(!(out && typeof out === 'object')) out = Object.assign({}, base);
    out = Object.assign({}, base, out, { schemaVersion:CURRENT_SCHEMA_VERSION });
    if(src.meta && typeof src.meta === 'object'){
      out.meta = Object.assign({}, out.meta && typeof out.meta === 'object' ? out.meta : {}, clone(src.meta));
    }
    function normalizeRoomValue(roomBase, roomOut, roomSrc){
      const baseRoom = roomBase && typeof roomBase === 'object' ? roomBase : {};
      const outRoom = roomOut && typeof roomOut === 'object' ? roomOut : {};
      const srcRoom = roomSrc && typeof roomSrc === 'object' ? roomSrc : {};
      return Object.assign({}, baseRoom, outRoom, srcRoom, {
        cabinets: Array.isArray(srcRoom.cabinets) ? clone(srcRoom.cabinets) : (Array.isArray(outRoom.cabinets) ? clone(outRoom.cabinets) : clone(baseRoom.cabinets || [])),
        fronts: Array.isArray(srcRoom.fronts) ? clone(srcRoom.fronts) : (Array.isArray(outRoom.fronts) ? clone(outRoom.fronts) : clone(baseRoom.fronts || [])),
        sets: Array.isArray(srcRoom.sets) ? clone(srcRoom.sets) : (Array.isArray(outRoom.sets) ? clone(outRoom.sets) : clone(baseRoom.sets || [])),
        settings: Object.assign({}, baseRoom.settings || {}, outRoom.settings || {}, srcRoom.settings || {}),
        preferences: (FC.roomPreferences && typeof FC.roomPreferences.normalizeRoomPreferences === 'function')
          ? FC.roomPreferences.normalizeRoomPreferences(Object.assign({}, baseRoom.preferences || {}, outRoom.preferences || {}, srcRoom.preferences || {}))
          : Object.assign({}, baseRoom.preferences || {}, outRoom.preferences || {}, srcRoom.preferences || {}),
      });
    }
    Object.keys(base || {}).forEach((key)=>{
      if(key === 'schemaVersion' || key === 'meta') return;
      const roomBase = base[key];
      const roomSrc = src && src[key] && typeof src[key] === 'object' ? src[key] : {};
      const roomOut = out && out[key] && typeof out[key] === 'object' ? out[key] : {};
      if(roomBase && typeof roomBase === 'object' && Array.isArray(roomBase.cabinets)){
        out[key] = normalizeRoomValue(roomBase, roomOut, roomSrc);
      }
    });
    Object.keys(src || {}).forEach((key)=>{
      if(key === 'schemaVersion' || key === 'meta') return;
      if(Object.prototype.hasOwnProperty.call(out, key)) return;
      const roomSrc = src[key];
      if(!(roomSrc && typeof roomSrc === 'object')) return;
      const looksLikeRoom = Array.isArray(roomSrc.cabinets) || Array.isArray(roomSrc.fronts) || Array.isArray(roomSrc.sets) || !!roomSrc.settings || !!roomSrc.preferences;
      if(looksLikeRoom) out[key] = normalizeRoomValue({}, {}, roomSrc);
    });
    try{
      const meta = out.meta && typeof out.meta === 'object' ? out.meta : {};
      const defs = meta.roomDefs && typeof meta.roomDefs === 'object' ? meta.roomDefs : {};
      Object.keys(defs).forEach((key)=>{
        if(Object.prototype.hasOwnProperty.call(out, key)) return;
        const srcRoom = src && src[key] && typeof src[key] === 'object' ? src[key] : {};
        out[key] = normalizeRoomValue({}, {}, srcRoom);
      });
    }catch(_){ }
    return out;
  }

  function roomKeysFromData(projectData){
    const data = normalizeProjectData(projectData);
    const keys = [];
    Object.keys(data || {}).forEach((key)=>{
      if(key === 'schemaVersion' || key === 'meta') return;
      const room = data[key];
      if(room && typeof room === 'object' && Array.isArray(room.cabinets)) keys.push(key);
    });
    return keys;
  }

  function summarizeProjectData(projectData){
    const data = normalizeProjectData(projectData);
    const roomKeys = roomKeysFromData(data);
    let cabinetCount = 0;
    roomKeys.forEach((key)=>{ cabinetCount += Array.isArray(data[key] && data[key].cabinets) ? data[key].cabinets.length : 0; });
    return {
      roomKeys,
      roomCount: roomKeys.length,
      cabinetCount,
    };
  }

  function normalizeProjectRecord(record){
    const src = record && typeof record === 'object' ? record : {};
    const srcMeta = src.meta && typeof src.meta === 'object' ? src.meta : {};
    const now = Date.now();
    const normalizedProjectData = normalizeProjectData(src.projectData);
    const summary = summarizeProjectData(normalizedProjectData);
    const hasRoomCount = Object.prototype.hasOwnProperty.call(src, 'roomCount') && Number.isFinite(Number(src.roomCount));
    const hasCabinetCount = Object.prototype.hasOwnProperty.call(src, 'cabinetCount') && Number.isFinite(Number(src.cabinetCount));
    const out = {
      id: String(src.id || ''),
      investorId: String(src.investorId || ''),
      title: String(src.title || ''),
      status: String(src.status || 'nowy'),
      projectData: normalizedProjectData,
      roomKeys: Array.isArray(src.roomKeys) && src.roomKeys.length ? src.roomKeys.map((item)=> String(item || '')).filter(Boolean) : summary.roomKeys,
      roomCount: hasRoomCount ? Number(src.roomCount) : summary.roomCount,
      cabinetCount: hasCabinetCount ? Number(src.cabinetCount) : summary.cabinetCount,
      createdAt: Number(src.createdAt) > 0 ? Number(src.createdAt) : now,
      updatedAt: Number(src.updatedAt) > 0 ? Number(src.updatedAt) : now,
      meta: src.meta && typeof src.meta === 'object' ? clone(src.meta) : {},
    };
    if(src.__test === true || srcMeta.__test === true || out.meta.testData){
      out.__test = true;
      out.__testRunId = String(src.__testRunId || srcMeta.__testRunId || srcMeta.testRunId || out.meta.testRunId || '');
      out.meta.__test = true;
      out.meta.__testRunId = out.__testRunId;
    }
    return out;
  }

  FC.projectModel = {
    CURRENT_SCHEMA_VERSION,
    DEFAULT_PROJECT_DATA,
    normalizeProjectData,
    normalizeProjectRecord,
    roomKeysFromData,
    summarizeProjectData,
  };
})();
