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
    return Object.assign({},prev,{
      id: room.id,
      baseType: room.baseType,
      name: room.name,
      label: room.label,
      projectStatus: prev.projectStatus || room.projectStatus || getDefaultProjectStatus(),
    });
  }

  function functionalRoomIds(data){
    const defs = data && data.meta && data.meta.roomDefs || {};
    return discoverProjectRoomKeys(data).filter(id=>Object.prototype.hasOwnProperty.call(defs,id) || id.startsWith('room_')
      || ['cabinets','fronts','sets'].some(field=>Array.isArray(data[id][field]) && data[id][field].length));
  }
  function context(inv){
    const investor = inv || getCurrentInvestor();
    const record = FC.projectStore && FC.projectStore.getCurrentRecord();
    if(!investor || !record || String(record.investorId) !== String(investor.id)) return null;
    if(FC.session && FC.session.active) return null;
    if(FC.investorProjectRuntime && FC.investorProjectRuntime.hasProjectDivergence(getProject())) return null;
    // Investor room entries have no projectId. Refuse an ambiguous compatibility mirror.
    const ids = functionalRoomIds(record.projectData);
    if(FC.projectStore.readAll().some(other=>other.id !== record.id && other.investorId === record.investorId
      && functionalRoomIds(other.projectData).some(id=>ids.includes(id)))) return null;
    return { investor:FC.investors.getById(investor.id), record, project:foundation.clone(record.projectData) };
  }
  function rejected(reason){
    try{ if(FC.infoBox && FC.infoBox.open) FC.infoBox.open({ title:'Nie zapisano pomieszczenia', message:'Zakończ bieżącą edycję lub ponów operację po odzyskaniu danych. Formularz pozostaje otwarty.', okOnly:true }); }catch(_){ }
    return { ok:false, reason:reason || 'edit-or-context-conflict' };
  }
  function resumed(inv, requestKey){
    const record = FC.projectStore && FC.projectStore.getCurrentRecord();
    const op = record && record.meta && record.meta.pendingDomainOperation;
    if(!op) return null;
    if(!inv || record.investorId !== inv.id || op.kind !== 'rooms' || op.requestKey !== requestKey) return rejected('different-pending-operation');
    const result = FC.projectDomainOperations.recoverProject(record.id);
    return result.ok ? Object.assign({},op.result,result) : result;
  }
  function persistRooms(ctx, nextProject, nextRooms, result, requestKey){
    if(!ctx || !FC.projectDomainOperations) return rejected();
    const normalized = FC.project.normalize(nextProject);
    const owned = new Set([...discoverProjectRoomKeys(ctx.record.projectData),...discoverProjectRoomKeys(normalized)]);
    const previous = ctx.investor.rooms || [];
    const desired = previous.filter(room=>!owned.has(String(room.id))).concat(nextRooms);
    const changes = FC.projectDomainOperations.rowChanges(previous,desired);
    // Room order is canonical in projectData.meta.roomOrder, not in the compatibility list.
    if(JSON.stringify(normalized) === JSON.stringify(ctx.record.projectData) && !changes.length) return Object.assign({ok:true,project:ctx.record.projectData},result);
    const written = FC.projectDomainOperations.start(ctx.record,{kind:'rooms',afterData:normalized,mirrorChanges:changes,requestKey,result});
    if(!written.ok) return written;
    try{ invalidateCache(); }catch(_){ }
    return Object.assign({},result,written);
  }
  function ensureRoomData(id, baseType){
    const existing = getProject();
    if(existing && existing[id]) return existing[id];
    // Read/render must never invent and persist a missing functional project.
    return null;
  }
  function removeRoomsData(proj, meta, roomIds){
    impact.normalizeRoomIds(roomIds).forEach(id=>{
      delete proj[id];
      if(meta.roomDefs) delete meta.roomDefs[id];
      if(Array.isArray(meta.roomOrder)) meta.roomOrder = meta.roomOrder.filter(key=>key !== id);
    });
  }
  function updateInvestorRooms(){ return false; } // Mirrors are persisted by the confirmed room operation only.
  function createRoomRecord(inv, payload){
    const investor = inv || getCurrentInvestor();
    const patch = sanitizeRoomPatch('',payload,'kuchnia');
    const key = 'create:'+JSON.stringify(patch);
    const retry = resumed(investor,key); if(retry) return retry;
    const ctx = context(investor); if(!ctx || !patch.name) return rejected();
    if(getManageableRooms(investor).some(room=>definitions.normalizeComparableLabel(room.label) === definitions.normalizeComparableLabel(patch.name))) return rejected('duplicate-name');
    const id = makeRoomId(patch.baseType,patch.name);
    if(ctx.project[id]) return rejected('room-id-collision');
    const room = Object.assign({},patch,{id});
    const meta = ensureProjectMeta(ctx.project);
    meta.roomDefs[id] = Object.assign({},room,{legacy:false,projectStatus:getDefaultProjectStatus()});
    meta.roomOrder.push(id); ctx.project[id] = roomTemplate(room.baseType);
    const rooms = getManageableRooms(investor).map(item=>buildInvestorRoomRecord(item,(ctx.investor.rooms || []).find(r=>r.id === item.id))).concat([buildInvestorRoomRecord(room)]);
    return persistRooms(ctx,ctx.project,rooms,{room,rooms},key);
  }
  function updateRoomRecord(inv, roomId, payload){
    const investor = inv || getCurrentInvestor();
    const id = String(roomId || '');
    const key = 'update:'+id+':'+JSON.stringify(payload);
    const retry = resumed(investor,key); if(retry) return retry;
    const ctx = context(investor); if(!ctx || !ctx.project[id]) return rejected();
    const prev = getEditableRoom(investor,id); if(!prev) return rejected();
    const patch = sanitizeRoomPatch(id,payload,prev.baseType);
    if(!patch.name) return rejected('missing-name');
    const meta = ensureProjectMeta(ctx.project);
    const room = Object.assign({},meta.roomDefs[id] || prev,patch);
    meta.roomDefs[id] = room;
    const rooms = getManageableRooms(investor).map(item=>buildInvestorRoomRecord(item.id === id ? room : item,(ctx.investor.rooms || []).find(r=>r.id === item.id)));
    return persistRooms(ctx,ctx.project,rooms,{room,rooms},key);
  }
  function removeRoomByIdDetailed(roomId){
    const investor = getCurrentInvestor(),id = String(roomId || '');
    const key = 'remove:'+id;
    const retry = resumed(investor,key); if(retry) return retry;
    const ctx = context(investor); if(!ctx || !ctx.project[id]) return rejected();
    const meta = ensureProjectMeta(ctx.project);
    removeRoomsData(ctx.project,meta,[id]);
    const rooms = getManageableRooms(investor).filter(room=>room.id !== id).map(room=>buildInvestorRoomRecord(room,(ctx.investor.rooms || []).find(r=>r.id === room.id)));
    // Historical offers remain immutable, including scopes referencing a deleted room.
    const result = persistRooms(ctx,ctx.project,rooms,{roomId:id,rooms,removedRoomIds:[id]},key);
    if(result.ok) syncRoomSelectionAfterRemoval(id);
    return result;
  }
  function removeRoomById(roomId){
    const result = removeRoomByIdDetailed(roomId);
    return result.ok ? result.roomId : null;
  }
  function getManageableRooms(inv){
    const project = getProject();
    const ids = new Set(functionalRoomIds(project || {}));
    return mergeRoomCollections({activeRooms:definitions.getProjectRoomDefs(foundation.clone(project || {})).filter(room=>ids.has(room.id)),
      investorRooms:[],includeLegacyKitchen:hasLegacyKitchen(project),legacyRoom:createLegacyKitchenDef(),normalizeRoomDef});
  }
  function applyManageRoomsDraftDetailed(inv, drafts){
    const key = 'manage:'+JSON.stringify(drafts);
    const retry = resumed(inv,key); if(retry) return retry;
    const ctx = context(inv); if(!ctx) return rejected();
    const rooms = (Array.isArray(drafts) ? drafts : []).map(room=>normalizeRoomDef(room,room)).filter(room=>room.id);
    if(new Set(rooms.map(room=>room.id)).size !== rooms.length) return rejected('duplicate-room');
    const keep = new Set(rooms.map(room=>room.id));
    const removedRoomIds = discoverProjectRoomKeys(ctx.project).filter(id=>!keep.has(id) && !(id === 'kuchnia' && hasLegacyKitchen(ctx.project)));
    const meta = ensureProjectMeta(ctx.project);
    removeRoomsData(ctx.project,meta,removedRoomIds);
    rooms.forEach(room=>{
      if(!ctx.project[room.id]) return;
      meta.roomDefs[room.id] = Object.assign({},meta.roomDefs[room.id] || {},room);
    });
    if(rooms.some(room=>!ctx.project[room.id])) return rejected('unknown-room');
    meta.roomOrder = rooms.map(room=>room.id);
    const nextRooms = rooms.map(room=>buildInvestorRoomRecord(room,(ctx.investor.rooms || []).find(r=>r.id === room.id)));
    return persistRooms(ctx,ctx.project,nextRooms,{rooms:nextRooms,removedRoomIds},key);
  }
  function applyManageRoomsDraft(inv, drafts){
    const result = applyManageRoomsDraftDetailed(inv,drafts);
    return result.ok ? result.rooms : [];
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
