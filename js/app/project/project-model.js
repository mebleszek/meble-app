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
    Object.keys(base || {}).forEach((key)=>{
      if(key === 'schemaVersion' || key === 'meta') return;
      const roomBase = base[key];
      const roomSrc = src && src[key] && typeof src[key] === 'object' ? src[key] : {};
      const roomOut = out && out[key] && typeof out[key] === 'object' ? out[key] : {};
      if(roomBase && typeof roomBase === 'object' && Array.isArray(roomBase.cabinets)){
        out[key] = Object.assign({}, roomBase, roomOut, roomSrc, {
          cabinets: Array.isArray(roomSrc.cabinets) ? clone(roomSrc.cabinets) : (Array.isArray(roomOut.cabinets) ? clone(roomOut.cabinets) : clone(roomBase.cabinets || [])),
          fronts: Array.isArray(roomSrc.fronts) ? clone(roomSrc.fronts) : (Array.isArray(roomOut.fronts) ? clone(roomOut.fronts) : clone(roomBase.fronts || [])),
          sets: Array.isArray(roomSrc.sets) ? clone(roomSrc.sets) : (Array.isArray(roomOut.sets) ? clone(roomOut.sets) : clone(roomBase.sets || [])),
          settings: Object.assign({}, roomBase.settings || {}, roomOut.settings || {}, roomSrc.settings || {}),
        });
      }
    });
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
    const now = Date.now();
    const normalizedProjectData = normalizeProjectData(src.projectData);
    const summary = summarizeProjectData(normalizedProjectData);
    const hasRoomCount = Object.prototype.hasOwnProperty.call(src, 'roomCount') && Number.isFinite(Number(src.roomCount));
    const hasCabinetCount = Object.prototype.hasOwnProperty.call(src, 'cabinetCount') && Number.isFinite(Number(src.cabinetCount));
    return {
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
