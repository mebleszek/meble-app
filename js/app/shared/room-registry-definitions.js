(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const foundation = FC.roomRegistryFoundation;

  if(!foundation){
    try{ console.error('[room-registry-definitions] Missing FC.roomRegistryFoundation before definitions load'); }catch(_){ }
    FC.roomRegistryDefinitions = FC.roomRegistryDefinitions || {
      slugify:(text)=> String(text || ''),
      makeRoomId:(baseType, name)=> 'room_' + String(baseType || 'pokoj') + '_' + String(name || 'pomieszczenie'),
      normalizeLabel:(text)=> String(text || '').trim(),
      prettifyTechnicalRoomText:(text)=> String(text || '').trim(),
      normalizeComparableLabel:(text)=> String(text || '').trim().toLowerCase(),
      normalizeRoomDef:(raw)=> Object.assign({ id:'', baseType:'pokoj', name:'', label:'', legacy:false }, raw || {}),
      getProjectRoomDefs:()=> [],
      hasLegacyKitchen:()=> false,
      createLegacyKitchenDef:()=> null,
      getActiveRoomDefs:()=> [],
      getActiveRoomIds:()=> [],
      getRoomLabel:(id)=> String(id || '') || 'Pomieszczenie',
      isRoomNameTaken:()=> false,
    };
    return;
  }

  const {
    BASE_LABELS,
    getProject,
    getCurrentInvestor,
    ensureProjectMeta,
    discoverProjectRoomKeys,
  } = foundation;

  function slugify(text){
    return String(text || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'pomieszczenie';
  }

  function makeRoomId(baseType, name){
    return 'room_' + String(baseType || 'pokoj') + '_' + slugify(name || BASE_LABELS[baseType] || 'pomieszczenie') + '_' + Date.now().toString(36).slice(-6);
  }

  function normalizeLabel(text){
    return String(text || '').trim().replace(/\s+/g, ' ');
  }

  function prettifyTechnicalRoomText(text, fallbackBaseType){
    const raw = String(text || '').trim();
    if(!raw) return '';
    const match = raw.match(/^room_([^_]+)_(.+)_([a-z0-9]{4,})$/i);
    if(!match) return raw;
    const baseType = String(match[1] || fallbackBaseType || '').trim();
    let middle = String(match[2] || '').trim();
    if(baseType && middle.toLowerCase().startsWith(baseType.toLowerCase() + '_')) middle = middle.slice(baseType.length + 1);
    middle = middle.replace(/_/g, ' ').trim();
    if(!middle) middle = BASE_LABELS[baseType] || baseType || raw;
    return middle;
  }

  function normalizeComparableLabel(text){
    return normalizeLabel(text)
      .toLowerCase()
      .replace(/[ąćęłńóśźż]/g, (ch)=> ({'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z'}[ch] || ch))
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function normalizeRoomDef(raw, fallback){
    const src = Object.assign({}, fallback || {}, raw || {});
    const baseType = String(src.baseType || src.kind || src.type || fallback && fallback.baseType || 'pokoj');
    const id = String(src.id || fallback && fallback.id || '');
    const rawName = src.name || src.label || fallback && fallback.name || BASE_LABELS[baseType] || id;
    const safeName = prettifyTechnicalRoomText(rawName, baseType);
    const safeLabel = prettifyTechnicalRoomText(src.label || safeName, baseType);
    const finalName = normalizeLabel(safeName || BASE_LABELS[baseType] || id);
    const finalLabel = normalizeLabel(safeLabel || finalName);
    return {
      id,
      baseType,
      name: finalName,
      label: finalLabel,
      legacy: !!src.legacy,
    };
  }

  function getProjectRoomDefs(proj){
    const meta = ensureProjectMeta(proj);
    const defs = [];
    if(meta){
      meta.roomOrder.forEach((id)=>{
        const raw = meta.roomDefs[id];
        if(raw && !defs.find((x)=> x.id === id)) defs.push(normalizeRoomDef(raw, { id, baseType: raw.baseType || id }));
      });
      Object.keys(meta.roomDefs).forEach((id)=>{
        const raw = meta.roomDefs[id];
        if(raw && !defs.find((x)=> x.id === id)) defs.push(normalizeRoomDef(raw, { id, baseType: raw.baseType || id }));
      });
    }
    if(defs.length) return defs;
    return discoverProjectRoomKeys(proj).map((id)=> normalizeRoomDef({ id, baseType:id, name:BASE_LABELS[id] || id, label:BASE_LABELS[id] || id }));
  }

  function hasLegacyKitchen(proj){
    if(!proj || typeof proj !== 'object') return false;
    const room = proj.kuchnia;
    return !!(room && typeof room === 'object' && (Array.isArray(room.cabinets) && room.cabinets.length || Array.isArray(room.fronts) && room.fronts.length || Array.isArray(room.sets) && room.sets.length));
  }

  function createLegacyKitchenDef(){
    return normalizeRoomDef({ id:'kuchnia', baseType:'kuchnia', name:'kuchnia stary program', label:'kuchnia stary program', legacy:true });
  }

  function getActiveRoomDefs(){
    const proj = getProject();
    const inv = getCurrentInvestor();
    const defs = [];
    const seen = new Set();
    const push = (room)=>{
      const normalized = normalizeRoomDef(room);
      if(!normalized.id || seen.has(normalized.id)) return;
      seen.add(normalized.id);
      defs.push(normalized);
    };

    const projectMetaRooms = getProjectRoomDefs(proj);
    const projectMap = new Map(projectMetaRooms.map((room)=> [room.id, room]));

    if(inv && Array.isArray(inv.rooms) && inv.rooms.length){
      inv.rooms.forEach((room)=>{
        const id = String(room && room.id || '');
        push(Object.assign({}, projectMap.get(id) || {}, room || {}, { id }));
      });
    }else{
      projectMetaRooms.filter((room)=> String(room.id || '').startsWith('room_')).forEach(push);
    }

    if(hasLegacyKitchen(proj) && !seen.has('kuchnia')){
      push(createLegacyKitchenDef());
    }

    return defs;
  }

  function getActiveRoomIds(){
    return getActiveRoomDefs().map((room)=> room.id).filter(Boolean);
  }

  function getRoomLabel(id){
    const key = String(id || '');
    const found = getActiveRoomDefs().find((room)=> room.id === key);
    if(found) return found.label || found.name || prettifyTechnicalRoomText(key, found.baseType) || key;
    return prettifyTechnicalRoomText(key, '') || key || 'Pomieszczenie';
  }

  function isRoomNameTaken(name, investor, exceptId){
    const normalized = normalizeComparableLabel(name);
    if(!normalized || !investor || !Array.isArray(investor.rooms)) return false;
    return investor.rooms.some((room)=>{
      if(!room) return false;
      if(exceptId && String(room.id || '') === String(exceptId)) return false;
      const label = normalizeComparableLabel(room.label || room.name || '');
      return label === normalized;
    });
  }

  FC.roomRegistryDefinitions = {
    slugify,
    makeRoomId,
    normalizeLabel,
    prettifyTechnicalRoomText,
    normalizeComparableLabel,
    normalizeRoomDef,
    getProjectRoomDefs,
    hasLegacyKitchen,
    createLegacyKitchenDef,
    getActiveRoomDefs,
    getActiveRoomIds,
    getRoomLabel,
    isRoomNameTaken,
  };
})();
