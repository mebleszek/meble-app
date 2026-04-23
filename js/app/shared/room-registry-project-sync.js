(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const foundation = FC.roomRegistryFoundation;
  const utils = FC.roomRegistryUtils;
  const definitions = FC.roomRegistryDefinitions;
  const impact = FC.roomRegistryImpact;

  if(!(foundation && utils && definitions && impact)){
    try{ console.error('[room-registry-project-sync] Missing registry foundation/utils/definitions/impact before project-sync load'); }catch(_){ }
    FC.roomRegistryProjectSync = FC.roomRegistryProjectSync || {
      ensureRoomData:()=> null,
      removeRoomsData:()=> {},
      updateInvestorRooms:()=> {},
      createRoomRecord:()=> ({ ok:false, room:null, rooms:[] }),
      updateRoomRecord:()=> ({ ok:false, room:null, rooms:[] }),
      removeRoomById:()=> null,
      removeRoomByIdDetailed:()=> ({ ok:false, roomId:null, rooms:[] }),
      getManageableRooms:()=> [],
      applyManageRoomsDraft:()=> [],
      applyManageRoomsDraftDetailed:()=> ({ ok:false, rooms:[] }),
      getEditableRoom:()=> null,
    };
    return;
  }

  const {
    BASE_LABELS,
    getProject,
    saveProject,
    getCurrentInvestor,
    ensureProjectMeta,
    discoverProjectRoomKeys,
    roomTemplate,
  } = foundation;
  const { mergeRoomCollections } = utils;
  const {
    makeRoomId,
    normalizeLabel,
    normalizeRoomDef,
    hasLegacyKitchen,
    createLegacyKitchenDef,
    getActiveRoomDefs,
    invalidateCache,
  } = definitions;
  const {
    syncRoomSelectionAfterRemoval,
    reconcileStatusesAfterRoomSetChange,
    removeQuotesForRooms,
  } = impact;

  function getDefaultProjectStatus(){
    return (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy';
  }

  function sanitizeRoomPatch(roomId, payload, fallbackBaseType){
    const src = payload && typeof payload === 'object' ? payload : {};
    const baseType = String(src.baseType || fallbackBaseType || 'pokoj').trim() || 'pokoj';
    const name = normalizeLabel(src.name || src.label || '');
    return {
      id: String(roomId || src.id || '').trim(),
      baseType,
      name,
      label: name,
      legacy: !!src.legacy,
    };
  }

  function buildInvestorRoomRecord(room, previous){
    const prev = previous && typeof previous === 'object' ? previous : {};
    return {
      id: room.id,
      baseType: room.baseType,
      name: room.name,
      label: room.label,
      projectStatus: prev.projectStatus || getDefaultProjectStatus(),
    };
  }

  function ensureRoomData(id, baseType){
    const proj = getProject();
    if(!proj || !id) return null;
    const meta = ensureProjectMeta(proj);
    let changed = false;
    if(!proj[id]){
      proj[id] = roomTemplate(baseType);
      changed = true;
    }
    if(!meta.roomDefs[id]){
      meta.roomDefs[id] = { id, baseType, name: BASE_LABELS[baseType] || id, label: BASE_LABELS[baseType] || id };
      changed = true;
    }
    if(!meta.roomOrder.includes(id)){
      meta.roomOrder.push(id);
      changed = true;
    }
    if(changed){
      try{ invalidateCache(); }catch(_){ }
      saveProject(proj);
    }
    return proj[id];
  }

  function removeRoomsData(proj, meta, roomIds){
    const ids = impact.normalizeRoomIds(roomIds);
    let changed = false;
    ids.forEach((selectedId)=>{
      try{
        if(Object.prototype.hasOwnProperty.call(proj || {}, selectedId)){
          delete proj[selectedId];
          changed = true;
        }
      }catch(_){ }
      try{
        if(meta && meta.roomDefs && Object.prototype.hasOwnProperty.call(meta.roomDefs, selectedId)){
          delete meta.roomDefs[selectedId];
          changed = true;
        }
      }catch(_){ }
      try{
        if(meta && Array.isArray(meta.roomOrder)) {
          const nextOrder = meta.roomOrder.filter((id)=> String(id || '') !== selectedId);
          if(nextOrder.length !== meta.roomOrder.length){
            meta.roomOrder = nextOrder;
            changed = true;
          }
        }
      }catch(_){ }
      syncRoomSelectionAfterRemoval(selectedId);
    });
    if(changed){
      try{ invalidateCache(); }catch(_){ }
    }
  }

  function updateInvestorRooms(inv, rooms){
    try{ FC.investors && FC.investors.update && FC.investors.update(inv.id, { rooms }); }catch(_){ }
    try{ invalidateCache(); }catch(_){ }
  }

  function createRoomRecord(inv, payload){
    const currentInvestor = inv || getCurrentInvestor();
    if(!currentInvestor) return { ok:false, room:null, rooms:[] };
    const roomPatch = sanitizeRoomPatch('', payload, 'kuchnia');
    if(!roomPatch.name) return { ok:false, room:null, rooms:Array.isArray(currentInvestor.rooms) ? currentInvestor.rooms.slice() : [] };
    const roomId = makeRoomId(roomPatch.baseType, roomPatch.name);
    const room = Object.assign({}, roomPatch, { id: roomId });
    const proj = getProject() || {};
    const meta = ensureProjectMeta(proj);
    meta.roomDefs[roomId] = { id:roomId, baseType:room.baseType, name:room.name, label:room.label, legacy:false };
    if(!meta.roomOrder.includes(roomId)) meta.roomOrder.push(roomId);
    if(!proj[roomId]) proj[roomId] = roomTemplate(room.baseType);
    saveProject(proj);
    const currentRooms = Array.isArray(currentInvestor.rooms) ? currentInvestor.rooms : [];
    const nextRooms = currentRooms.concat([buildInvestorRoomRecord(room)]);
    updateInvestorRooms(currentInvestor, nextRooms);
    return { ok:true, room, rooms:nextRooms, project:proj };
  }

  function updateRoomRecord(inv, roomId, payload){
    const currentInvestor = inv || getCurrentInvestor();
    const selectedId = String(roomId || '').trim();
    if(!(currentInvestor && selectedId)) return { ok:false, room:null, rooms:[] };
    const currentRoom = getEditableRoom(currentInvestor, selectedId);
    if(!(currentRoom && currentRoom.id)) return { ok:false, room:null, rooms:Array.isArray(currentInvestor.rooms) ? currentInvestor.rooms.slice() : [] };
    const room = sanitizeRoomPatch(selectedId, payload, currentRoom.baseType || 'pokoj');
    if(!room.name) return { ok:false, room:null, rooms:Array.isArray(currentInvestor.rooms) ? currentInvestor.rooms.slice() : [] };
    const proj = getProject() || {};
    const meta = ensureProjectMeta(proj);
    const currentDef = normalizeRoomDef(meta && meta.roomDefs && meta.roomDefs[selectedId], currentRoom);
    if(meta && meta.roomDefs){
      meta.roomDefs[selectedId] = Object.assign({}, currentDef, { id:selectedId, baseType:room.baseType, name:room.name, label:room.label });
    }
    if(!proj[selectedId]) proj[selectedId] = roomTemplate(room.baseType);
    saveProject(proj);
    const currentRooms = Array.isArray(currentInvestor.rooms) ? currentInvestor.rooms : [];
    const nextRooms = currentRooms.map((item)=> {
      if(String(item && item.id || '') !== selectedId) return item;
      return buildInvestorRoomRecord(room, item);
    });
    updateInvestorRooms(currentInvestor, nextRooms);
    return { ok:true, room, rooms:nextRooms, project:proj };
  }

  function removeRoomByIdDetailed(roomId){
    const inv = getCurrentInvestor();
    const selectedId = String(roomId || '').trim();
    if(!(inv && selectedId)) return { ok:false, roomId:null, rooms:[] };
    const proj = getProject() || {};
    const meta = ensureProjectMeta(proj);
    removeRoomsData(proj, meta, [selectedId]);
    saveProject(proj);
    removeQuotesForRooms(inv, [selectedId]);
    const currentRooms = Array.isArray(inv.rooms) ? inv.rooms : [];
    const nextRooms = currentRooms.filter((room)=> String(room && room.id || '') !== selectedId).map((room)=> buildInvestorRoomRecord(room, room));
    updateInvestorRooms(inv, nextRooms);
    reconcileStatusesAfterRoomSetChange(inv, nextRooms.map((room)=> room.id));
    return { ok:true, roomId:selectedId, rooms:nextRooms, project:proj };
  }

  function removeRoomById(roomId){
    const result = removeRoomByIdDetailed(roomId);
    return result && result.ok ? result.roomId : null;
  }

  function getManageableRooms(inv){
    return mergeRoomCollections({
      activeRooms: getActiveRoomDefs(),
      investorRooms: Array.isArray(inv && inv.rooms) ? inv.rooms : [],
      includeLegacyKitchen: hasLegacyKitchen(getProject()),
      legacyRoom: createLegacyKitchenDef(),
      normalizeRoomDef,
    });
  }

  function applyManageRoomsDraftDetailed(inv, drafts){
    const currentDrafts = Array.isArray(drafts) ? drafts.map((room)=> normalizeRoomDef(room, room)).filter((room)=> room && room.id) : [];
    const keepIds = new Set(currentDrafts.map((room)=> String(room.id || '')));
    const proj = getProject() || {};
    const meta = ensureProjectMeta(proj);
    const previousRooms = Array.isArray(inv && inv.rooms) ? inv.rooms : [];

    const removedRoomIds = [];
    discoverProjectRoomKeys(proj).forEach((roomId)=>{
      const key = String(roomId || '');
      if(key === 'kuchnia' && hasLegacyKitchen(proj)) return;
      if(keepIds.has(key)) return;
      removedRoomIds.push(key);
    });
    removeRoomsData(proj, meta, removedRoomIds);

    currentDrafts.forEach((room)=>{
      if(!proj[room.id]) proj[room.id] = roomTemplate(room.baseType);
      if(meta && meta.roomDefs) meta.roomDefs[room.id] = { id:room.id, baseType:room.baseType, name:room.name, label:room.label, legacy:!!room.legacy };
      if(meta && Array.isArray(meta.roomOrder) && !meta.roomOrder.includes(room.id)) meta.roomOrder.push(room.id);
    });
    try{ if(meta && Array.isArray(meta.roomOrder)) meta.roomOrder = meta.roomOrder.filter((id)=> keepIds.has(String(id || '')) || String(id || '') === 'kuchnia'); }catch(_){ }
    saveProject(proj);
    if(removedRoomIds.length) removeQuotesForRooms(inv, removedRoomIds);

    const nextRooms = currentDrafts.map((room)=> {
      const prev = previousRooms.find((item)=> String(item && item.id || '') === String(room.id || '')) || {};
      return buildInvestorRoomRecord(room, prev);
    });
    updateInvestorRooms(inv, nextRooms);
    reconcileStatusesAfterRoomSetChange(inv, nextRooms.map((room)=> room.id));
    return { ok:true, rooms:nextRooms, removedRoomIds, project:proj };
  }

  function applyManageRoomsDraft(inv, drafts){
    const result = applyManageRoomsDraftDetailed(inv, drafts);
    return result && result.ok ? result.rooms : [];
  }

  function getEditableRoom(inv, roomId){
    const rooms = getManageableRooms(inv);
    return rooms.find((room)=> String(room && room.id || '') === String(roomId || '')) || null;
  }

  FC.roomRegistryProjectSync = {
    ensureRoomData,
    removeRoomsData,
    updateInvestorRooms,
    createRoomRecord,
    updateRoomRecord,
    removeRoomById,
    removeRoomByIdDetailed,
    getManageableRooms,
    applyManageRoomsDraft,
    applyManageRoomsDraftDetailed,
    getEditableRoom,
  };
})();
