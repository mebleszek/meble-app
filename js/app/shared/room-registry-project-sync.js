(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const foundation = FC.roomRegistryFoundation;
  const definitions = FC.roomRegistryDefinitions;
  const impact = FC.roomRegistryImpact;

  if(!(foundation && definitions && impact)){
    try{ console.error('[room-registry-project-sync] Missing registry foundation/definitions/impact before project-sync load'); }catch(_){ }
    FC.roomRegistryProjectSync = FC.roomRegistryProjectSync || {
      ensureRoomData:()=> null,
      removeRoomsData:()=> {},
      updateInvestorRooms:()=> {},
      removeRoomById:()=> null,
      getManageableRooms:()=> [],
      applyManageRoomsDraft:()=> [],
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
  const {
    normalizeRoomDef,
    hasLegacyKitchen,
    createLegacyKitchenDef,
    getActiveRoomDefs,
  } = definitions;
  const {
    syncRoomSelectionAfterRemoval,
    reconcileStatusesAfterRoomSetChange,
    removeQuotesForRooms,
  } = impact;

  function ensureRoomData(id, baseType){
    const proj = getProject();
    if(!proj || !id) return null;
    const meta = ensureProjectMeta(proj);
    if(!proj[id]) proj[id] = roomTemplate(baseType);
    if(!meta.roomDefs[id]) meta.roomDefs[id] = { id, baseType, name: BASE_LABELS[baseType] || id, label: BASE_LABELS[baseType] || id };
    if(!meta.roomOrder.includes(id)) meta.roomOrder.push(id);
    saveProject(proj);
    return proj[id];
  }

  function removeRoomsData(proj, meta, roomIds){
    const ids = Array.isArray(roomIds) ? roomIds.map((id)=> String(id || '').trim()).filter(Boolean) : [];
    ids.forEach((selectedId)=>{
      try{ delete proj[selectedId]; }catch(_){ }
      try{ if(meta && meta.roomDefs) delete meta.roomDefs[selectedId]; }catch(_){ }
      try{ if(meta && Array.isArray(meta.roomOrder)) meta.roomOrder = meta.roomOrder.filter((id)=> String(id || '') !== selectedId); }catch(_){ }
      syncRoomSelectionAfterRemoval(selectedId);
    });
  }

  function updateInvestorRooms(inv, rooms){
    try{ FC.investors && FC.investors.update && FC.investors.update(inv.id, { rooms }); }catch(_){ }
  }

  function removeRoomById(roomId){
    const inv = getCurrentInvestor();
    const selectedId = String(roomId || '').trim();
    if(!(inv && selectedId)) return null;
    const proj = getProject() || {};
    const meta = ensureProjectMeta(proj);
    removeRoomsData(proj, meta, [selectedId]);
    saveProject(proj);
    removeQuotesForRooms(inv, [selectedId]);
    const currentRooms = Array.isArray(inv.rooms) ? inv.rooms : [];
    const nextRooms = currentRooms.filter((room)=> String(room && room.id || '') !== selectedId).map((room)=> ({
      id: room.id,
      baseType: room.baseType,
      name: room.name,
      label: room.label,
      projectStatus: room.projectStatus || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy'
    }));
    updateInvestorRooms(inv, nextRooms);
    reconcileStatusesAfterRoomSetChange(inv, nextRooms.map((room)=> room.id));
    return selectedId;
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

  function applyManageRoomsDraft(inv, drafts){
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
      return {
        id: room.id,
        baseType: room.baseType,
        name: room.name,
        label: room.label,
        projectStatus: prev.projectStatus || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy'
      };
    });
    updateInvestorRooms(inv, nextRooms);
    reconcileStatusesAfterRoomSetChange(inv, nextRooms.map((room)=> room.id));
    return nextRooms;
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

  FC.roomRegistryProjectSync = {
    ensureRoomData,
    removeRoomsData,
    updateInvestorRooms,
    removeRoomById,
    getManageableRooms,
    applyManageRoomsDraft,
    getEditableRoom,
  };
})();
