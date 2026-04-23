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
      toDisplayRoomLabel:(text, fallback)=> String(text || fallback || '').trim(),
      normalizeRoomDef:(raw)=> Object.assign({ id:'', baseType:'pokoj', name:'', label:'', legacy:false }, raw || {}),
      getProjectRoomDefs:()=> [],
      hasLegacyKitchen:()=> false,
      createLegacyKitchenDef:()=> null,
      getActiveRoomDefs:()=> [],
      getActiveRoomIds:()=> [],
      getRoomLabel:(id)=> String(id || '') || 'Pomieszczenie',
      isRoomNameTaken:()=> false,
      invalidateCache:()=> {},
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

  const cache = {
    key: null,
    defs: null,
    ids: null,
    labelMap: null,
  };

  function invalidateCache(){
    cache.key = null;
    cache.defs = null;
    cache.ids = null;
    cache.labelMap = null;
  }

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
    const baseLabel = normalizeLabel(BASE_LABELS[baseType] || baseType || '');
    let middle = String(match[2] || '').trim();
    if(baseType && middle.toLowerCase().startsWith(baseType.toLowerCase() + '_')) middle = middle.slice(baseType.length + 1);
    middle = normalizeLabel(middle.replace(/_/g, ' '));
    if(!middle) return baseLabel || raw;
    const normalizedMiddle = normalizeComparableLabel(middle);
    const normalizedBase = normalizeComparableLabel(baseLabel);
    if(!normalizedBase) return middle;
    if(normalizedMiddle === normalizedBase) return baseLabel;
    if(normalizedMiddle.startsWith(normalizedBase + ' ')) return middle;
    return normalizeLabel(baseLabel + ' ' + middle);
  }

  function isTechnicalRoomText(text){
    const raw = String(text || '').trim();
    if(!raw) return false;
    return /^room_[^\s]+$/i.test(raw);
  }

  function scoreRoomTextCandidate(text, baseType){
    const raw = normalizeLabel(text);
    if(!raw) return -1;
    let score = 0;
    if(!isTechnicalRoomText(raw)) score += 4;
    const pretty = normalizeLabel(prettifyTechnicalRoomText(raw, baseType));
    if(pretty && normalizeComparableLabel(pretty) !== normalizeComparableLabel(raw)) score += 2;
    if(!/_/.test(raw)) score += 1;
    if(/\s/.test(raw)) score += 1;
    return score;
  }

  function choosePreferredRoomText(candidates, baseType, fallback){
    let best = '';
    let bestScore = -1;
    (Array.isArray(candidates) ? candidates : []).forEach((candidate)=>{
      const raw = normalizeLabel(candidate);
      if(!raw) return;
      const pretty = normalizeLabel(prettifyTechnicalRoomText(raw, baseType) || raw);
      const score = scoreRoomTextCandidate(raw, baseType);
      const finalScore = pretty ? score + 1 : score;
      if(finalScore > bestScore){
        bestScore = finalScore;
        best = pretty || raw;
      }
    });
    return normalizeLabel(best || fallback || '');
  }

  function normalizeComparableLabel(text){
    return normalizeLabel(text)
      .toLowerCase()
      .replace(/[ąćęłńóśźż]/g, (ch)=> ({'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z'}[ch] || ch))
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function deriveBaseTypeFromId(id, fallbackBaseType){
    const raw = String(id || '').trim();
    if(!raw) return String(fallbackBaseType || 'pokoj');
    const match = raw.match(/^room_([^_]+)_.+/i);
    return String((match && match[1]) || fallbackBaseType || raw || 'pokoj').trim() || 'pokoj';
  }

  function buildMergedRoomDef(projectRoom, investorRoom, fallbackId){
    const projectSrc = projectRoom && typeof projectRoom === 'object' ? projectRoom : {};
    const investorSrc = investorRoom && typeof investorRoom === 'object' ? investorRoom : {};
    const id = String(fallbackId || projectSrc.id || investorSrc.id || '').trim();
    const baseType = String(projectSrc.baseType || investorSrc.baseType || deriveBaseTypeFromId(id, 'pokoj')).trim() || 'pokoj';
    const merged = normalizeRoomDef({
      id,
      baseType,
      name: choosePreferredRoomText([
        projectSrc.name,
        projectSrc.label,
        investorSrc.name,
        investorSrc.label,
        prettifyTechnicalRoomText(id, baseType),
        BASE_LABELS[baseType],
        id,
      ], baseType, BASE_LABELS[baseType] || id),
      label: choosePreferredRoomText([
        projectSrc.label,
        projectSrc.name,
        investorSrc.label,
        investorSrc.name,
        prettifyTechnicalRoomText(id, baseType),
        BASE_LABELS[baseType],
        id,
      ], baseType, BASE_LABELS[baseType] || id),
      legacy: !!(projectSrc.legacy || investorSrc.legacy),
    });
    return merged;
  }

  function normalizeRoomDef(raw, fallback){
    const src = Object.assign({}, fallback || {}, raw || {});
    const baseType = String(src.baseType || src.kind || src.type || (fallback && fallback.baseType) || 'pokoj');
    const id = String(src.id || (fallback && fallback.id) || '');
    const finalName = choosePreferredRoomText([
      src.name,
      src.label,
      fallback && fallback.name,
      fallback && fallback.label,
      prettifyTechnicalRoomText(id, baseType),
      BASE_LABELS[baseType],
      id,
    ], baseType, BASE_LABELS[baseType] || id);
    const finalLabel = choosePreferredRoomText([
      src.label,
      src.name,
      fallback && fallback.label,
      fallback && fallback.name,
      finalName,
      prettifyTechnicalRoomText(id, baseType),
      BASE_LABELS[baseType],
      id,
    ], baseType, finalName || BASE_LABELS[baseType] || id);
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
        if(raw && !defs.find((x)=> x.id === id)) defs.push(normalizeRoomDef(raw, { id, baseType: raw.baseType || deriveBaseTypeFromId(id, id) }));
      });
      Object.keys(meta.roomDefs).forEach((id)=>{
        const raw = meta.roomDefs[id];
        if(raw && !defs.find((x)=> x.id === id)) defs.push(normalizeRoomDef(raw, { id, baseType: raw.baseType || deriveBaseTypeFromId(id, id) }));
      });
    }
    if(defs.length) return defs;
    return discoverProjectRoomKeys(proj).map((id)=> { const baseType = deriveBaseTypeFromId(id, id); return normalizeRoomDef({ id, baseType, name:BASE_LABELS[baseType] || id, label:BASE_LABELS[baseType] || id }); });
  }

  function hasLegacyKitchen(proj){
    if(!proj || typeof proj !== 'object') return false;
    const room = proj.kuchnia;
    return !!(room && typeof room === 'object' && ((Array.isArray(room.cabinets) && room.cabinets.length) || (Array.isArray(room.fronts) && room.fronts.length) || (Array.isArray(room.sets) && room.sets.length)));
  }

  function createLegacyKitchenDef(){
    return normalizeRoomDef({ id:'kuchnia', baseType:'kuchnia', name:'kuchnia stary program', label:'kuchnia stary program', legacy:true });
  }

  function buildProjectMetaSignature(proj){
    const meta = ensureProjectMeta(proj);
    if(meta && meta.roomDefs && Object.keys(meta.roomDefs).length){
      const orderedIds = [];
      const seen = new Set();
      (Array.isArray(meta.roomOrder) ? meta.roomOrder : []).forEach((id)=> {
        const key = String(id || '');
        if(!key || seen.has(key)) return;
        seen.add(key);
        orderedIds.push(key);
      });
      Object.keys(meta.roomDefs).forEach((id)=> {
        const key = String(id || '');
        if(!key || seen.has(key)) return;
        seen.add(key);
        orderedIds.push(key);
      });
      return orderedIds.map((id)=> {
        const raw = meta.roomDefs[id] || {};
        return [
          id,
          String(raw.baseType || ''),
          normalizeComparableLabel(raw.name || ''),
          normalizeComparableLabel(raw.label || ''),
          raw.legacy ? '1' : '0'
        ].join('~');
      }).join('|');
    }
    return 'fallback:' + discoverProjectRoomKeys(proj).join('|');
  }

  function buildInvestorRoomsSignature(inv){
    const rooms = Array.isArray(inv && inv.rooms) ? inv.rooms : [];
    return rooms.map((room)=> [
      String(room && room.id || ''),
      String(room && room.baseType || ''),
      normalizeComparableLabel(room && (room.label || room.name) || ''),
      String(room && (room.projectStatus || room.status) || '')
    ].join('~')).join('|');
  }

  function getActiveRoomsCacheKey(){
    const proj = getProject();
    const inv = getCurrentInvestor();
    return [
      String(inv && inv.id || ''),
      buildInvestorRoomsSignature(inv),
      buildProjectMetaSignature(proj),
      hasLegacyKitchen(proj) ? 'legacy1' : 'legacy0'
    ].join('||');
  }

  function toDisplayRoomLabel(text, fallback){
    const raw = normalizeLabel(text || fallback || '');
    if(!raw) return '';
    if(raw.length === 1) return raw.toUpperCase();
    return raw.replace(/(^|\s)([a-ząćęłńóśźż])/g, (_, prefix, ch)=> prefix + ch.toUpperCase());
  }

  function buildActiveRoomDefs(){
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
    const projectMap = new Map(projectMetaRooms.map((room)=> [String(room.id || ''), room]));
    const investorRooms = Array.isArray(inv && inv.rooms) ? inv.rooms : [];
    const investorMap = new Map(investorRooms.map((room)=> [String(room && room.id || ''), room]));

    investorRooms.forEach((room)=>{
      const id = String(room && room.id || '');
      if(!id) return;
      push(buildMergedRoomDef(projectMap.get(id), room, id));
    });

    projectMetaRooms.forEach((room)=> {
      const id = String(room && room.id || '');
      if(!id) return;
      push(buildMergedRoomDef(room, investorMap.get(id), id));
    });

    try{
      const ui = (FC.uiState && typeof FC.uiState.get === 'function') ? (FC.uiState.get() || {}) : {};
      [ui.roomType, ui.lastRoomType].forEach((roomId)=> {
        const id = String(roomId || '').trim();
        if(!id || seen.has(id) || !(proj && proj[id] && typeof proj[id] === 'object')) return;
        push(buildMergedRoomDef(projectMap.get(id) || { id, baseType:deriveBaseTypeFromId(id, 'pokoj') }, investorMap.get(id), id));
      });
    }catch(_){ }

    if(hasLegacyKitchen(proj) && !seen.has('kuchnia')) push(createLegacyKitchenDef());
    return defs;
  }

  function getCachedActiveRooms(){
    const key = getActiveRoomsCacheKey();
    if(cache.key === key && Array.isArray(cache.defs)) return cache.defs;
    const defs = buildActiveRoomDefs();
    cache.key = key;
    cache.defs = defs;
    cache.ids = defs.map((room)=> room.id).filter(Boolean);
    cache.labelMap = new Map(defs.map((room)=> [String(room.id || ''), room.label || room.name || prettifyTechnicalRoomText(room.id, room.baseType) || room.id]));
    return defs;
  }

  function getActiveRoomDefs(){
    return getCachedActiveRooms();
  }

  function getActiveRoomIds(){
    getCachedActiveRooms();
    return Array.isArray(cache.ids) ? cache.ids : [];
  }

  function getRoomLabel(id){
    const key = String(id || '');
    getCachedActiveRooms();
    if(cache.labelMap && cache.labelMap.has(key)){
      return toDisplayRoomLabel(cache.labelMap.get(key), key) || 'Pomieszczenie';
    }
    return toDisplayRoomLabel(prettifyTechnicalRoomText(key, ''), key) || 'Pomieszczenie';
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
    toDisplayRoomLabel,
    normalizeRoomDef,
    getProjectRoomDefs,
    hasLegacyKitchen,
    createLegacyKitchenDef,
    getActiveRoomDefs,
    getActiveRoomIds,
    getRoomLabel,
    isRoomNameTaken,
    invalidateCache,
  };
})();
