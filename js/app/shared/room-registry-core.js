(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const BASE_LABELS = {
    kuchnia:'Kuchnia',
    szafa:'Szafa',
    pokoj:'Pokój',
    lazienka:'Łazienka'
  };

  function createApi(deps){
    deps = deps || {};
    const apiFC = deps.FC || FC;
    const getProject = typeof deps.getProject === 'function' ? deps.getProject : function(){
      try{ if(typeof projectData !== 'undefined' && projectData) return projectData; }catch(_){ }
      try{ if(window.projectData) return window.projectData; }catch(_){ }
      return null;
    };
    const getCurrentInvestor = typeof deps.getCurrentInvestor === 'function' ? deps.getCurrentInvestor : function(){
      try{
        if(apiFC.investors && typeof apiFC.investors.getCurrentId === 'function' && typeof apiFC.investors.getById === 'function'){
          const id = apiFC.investors.getCurrentId();
          return id ? apiFC.investors.getById(id) : null;
        }
      }catch(_){ }
      return null;
    };

    function clone(obj){
      try{ return (apiFC.utils && apiFC.utils.clone) ? apiFC.utils.clone(obj) : JSON.parse(JSON.stringify(obj)); }
      catch(_){ return JSON.parse(JSON.stringify(obj || {})); }
    }

    function ensureProjectMeta(proj){
      if(!proj || typeof proj !== 'object') return null;
      proj.meta = proj.meta || {};
      proj.meta.roomDefs = proj.meta.roomDefs || {};
      proj.meta.roomOrder = Array.isArray(proj.meta.roomOrder) ? proj.meta.roomOrder : [];
      return proj.meta;
    }

    function discoverProjectRoomKeys(proj){
      if(!proj || typeof proj !== 'object') return [];
      return Object.keys(proj).filter((key)=>{
        if(!key || key === 'schemaVersion' || key === 'meta') return false;
        const room = proj[key];
        return !!(room && typeof room === 'object' && (Array.isArray(room.cabinets) || Array.isArray(room.fronts) || Array.isArray(room.sets) || room.settings));
      });
    }

    function roomTemplate(baseType){
      const defs = (apiFC.project && apiFC.project.DEFAULT_PROJECT) || (apiFC.schema && apiFC.schema.DEFAULT_PROJECT) || {};
      return clone(defs[baseType] || defs.kuchnia || { cabinets:[], fronts:[], sets:[], settings:{} });
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
      const safeLabel = prettifyTechnicalRoomText(src.label || safeName, baseType) || safeName || BASE_LABELS[baseType] || id;
      return {
        id,
        baseType,
        name: normalizeLabel(safeName || BASE_LABELS[baseType] || id),
        label: normalizeLabel(safeLabel || safeName || BASE_LABELS[baseType] || id),
        legacy: !!src.legacy,
        projectStatus: src.projectStatus || ''
      };
    }

    function getProjectRoomDefs(proj){
      const meta = ensureProjectMeta(proj);
      const defs = meta && meta.roomDefs ? meta.roomDefs : {};
      const order = meta && Array.isArray(meta.roomOrder) ? meta.roomOrder.slice() : [];
      const out = [];
      order.forEach((roomId)=>{
        const def = normalizeRoomDef(defs[roomId], { id:roomId, baseType:'pokoj', name:BASE_LABELS.pokoj, label:BASE_LABELS.pokoj });
        if(def && def.id && !out.some((item)=> item.id === def.id)) out.push(def);
      });
      Object.keys(defs).forEach((roomId)=>{
        const def = normalizeRoomDef(defs[roomId], { id:roomId, baseType:'pokoj', name:BASE_LABELS.pokoj, label:BASE_LABELS.pokoj });
        if(def && def.id && !out.some((item)=> item.id === def.id)) out.push(def);
      });
      return out;
    }

    function hasLegacyKitchen(proj){
      const room = proj && proj.kuchnia;
      if(!room || typeof room !== 'object') return false;
      return Array.isArray(room.cabinets) || Array.isArray(room.fronts) || Array.isArray(room.sets) || !!room.settings;
    }

    function createLegacyKitchenDef(){
      return { id:'kuchnia', baseType:'kuchnia', name:BASE_LABELS.kuchnia, label:BASE_LABELS.kuchnia, legacy:true };
    }

    function hasCurrentInvestor(){ return !!getCurrentInvestor(); }

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
      const found = getActiveRoomDefs().find((room)=> String(room.id) === key);
      if(found && found.label) return found.label;
      return prettifyTechnicalRoomText(key, '') || key;
    }

    function ensureRoomData(id, baseType){
      const proj = getProject() || {};
      if(!proj[id]){
        proj[id] = roomTemplate(baseType || 'pokoj');
        if(typeof deps.saveProject === 'function') deps.saveProject(proj);
      }
      return proj[id];
    }

    function isRoomNameTaken(name, investor, exceptId){
      const inv = investor || getCurrentInvestor();
      if(!inv) return false;
      const target = normalizeComparableLabel(name);
      return (Array.isArray(inv.rooms) ? inv.rooms : []).some((room)=>{
        const roomId = String(room && room.id || '');
        if(exceptId && roomId === String(exceptId)) return false;
        return normalizeComparableLabel(room && (room.label || room.name) || '') === target;
      });
    }

    function getManageableRooms(inv){
      const roomMap = new Map();
      const activeRooms = getActiveRoomDefs();
      activeRooms.forEach((room)=> {
        const normalized = normalizeRoomDef(room, room);
        if(normalized && normalized.id) roomMap.set(String(normalized.id), normalized);
      });
      const investorRooms = Array.isArray(inv && inv.rooms) ? inv.rooms : [];
      investorRooms.forEach((room)=> {
        const normalized = normalizeRoomDef(room, room);
        if(!(normalized && normalized.id)) return;
        const key = String(normalized.id);
        roomMap.set(key, normalizeRoomDef(Object.assign({}, roomMap.get(key) || {}, normalized), roomMap.get(key) || normalized));
      });
      if(hasLegacyKitchen(getProject()) && !roomMap.has('kuchnia')){
        const legacy = createLegacyKitchenDef();
        roomMap.set('kuchnia', legacy);
      }
      return Array.from(roomMap.values()).filter((room)=> room && room.id);
    }

    function getEditableRoom(inv, roomId){
      const activeRooms = getActiveRoomDefs();
      const roomMap = new Map();
      activeRooms.forEach((room)=> {
        const normalized = normalizeRoomDef(room, room);
        if(normalized && normalized.id) roomMap.set(String(normalized.id), normalized);
      });
      const investorRooms = Array.isArray(inv && inv.rooms) ? inv.rooms : [];
      investorRooms.forEach((room)=> {
        const normalized = normalizeRoomDef(room, room);
        if(!(normalized && normalized.id)) return;
        const key = String(normalized.id);
        roomMap.set(key, normalizeRoomDef(Object.assign({}, roomMap.get(key) || {}, normalized), roomMap.get(key) || normalized));
      });
      if(hasLegacyKitchen(getProject()) && !roomMap.has('kuchnia')){
        const legacy = createLegacyKitchenDef();
        roomMap.set('kuchnia', legacy);
      }
      return roomMap.get(String(roomId || '')) || null;
    }

    return {
      BASE_LABELS,
      ensureProjectMeta,
      discoverProjectRoomKeys,
      roomTemplate,
      makeRoomId,
      normalizeLabel,
      normalizeComparableLabel,
      normalizeRoomDef,
      getProjectRoomDefs,
      hasLegacyKitchen,
      createLegacyKitchenDef,
      hasCurrentInvestor,
      getActiveRoomDefs,
      getActiveRoomIds,
      getRoomLabel,
      ensureRoomData,
      isRoomNameTaken,
      getManageableRooms,
      getEditableRoom,
    };
  }

  FC.roomRegistryCore = {
    BASE_LABELS,
    createApi,
  };
})();
