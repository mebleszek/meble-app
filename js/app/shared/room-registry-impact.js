(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const foundation = FC.roomRegistryFoundation;
  const definitions = FC.roomRegistryDefinitions;
  const roomScopeResolver = FC.roomScopeResolver;

  if(!(foundation && definitions)){
    try{ console.error('[room-registry-impact] Missing registry foundation/definitions before impact load'); }catch(_){ }
    FC.roomRegistryImpact = FC.roomRegistryImpact || {
      syncRoomSelectionAfterRemoval:()=> {},
      syncQuoteDraftSelectionAfterRoomChange:()=> {},
      reconcileStatusesAfterRoomSetChange:()=> {},
      getCurrentProjectRecord:()=> null,
      getSnapshotVersionName:(snapshot)=> String(snapshot && snapshot.meta && snapshot.meta.versionName || snapshot && snapshot.commercialName || '').trim() || 'Wycena',
      listSnapshotsForRoomRemoval:()=> [],
      listRoomRemovalSnapshots:()=> [],
      countCabinetsForRoomIds:()=> 0,
      buildRoomRemovalImpact:()=> ({ roomIds:[], roomNames:[], roomLabel:'', snapshots:[], cabinetCount:0, deferred:false, message:'' }),
      buildRoomRemovalWarningMessage:()=> ({ message:'', snapshots:[], cabinetCount:0 }),
      askDeleteRoomWithQuotes: async()=> true,
      removeQuotesForRooms:()=> [],
    };
    return;
  }

  const { getProject } = foundation;
  const { getRoomLabel } = definitions;

  function normalizeRoomIds(roomIds){
    try{
      if(roomScopeResolver && typeof roomScopeResolver.normalizeRoomIds === 'function') return roomScopeResolver.normalizeRoomIds(roomIds);
    }catch(_){ }
    return Array.isArray(roomIds)
      ? Array.from(new Set(roomIds.map((id)=> String(id || '').trim()).filter(Boolean)))
      : [];
  }

  function syncRoomSelectionAfterRemoval(selectedId){
    try{
      if(window.FC && window.FC.uiState && typeof window.FC.uiState.get === 'function' && typeof window.FC.uiState.set === 'function'){
        const st = window.FC.uiState.get();
        if(String(st.roomType || '') === String(selectedId)) window.FC.uiState.set({ roomType:null, lastRoomType:null });
      }else if(typeof uiState !== 'undefined' && uiState){
        if(String(uiState.roomType || '') === String(selectedId)){
          uiState.roomType = null;
          uiState.lastRoomType = null;
          try{ FC.storage && FC.storage.setJSON && typeof STORAGE_KEYS !== 'undefined' && FC.storage.setJSON(STORAGE_KEYS.ui, uiState); }catch(_){ }
        }
      }
    }catch(_){ }
  }

  function syncQuoteDraftSelectionAfterRoomChange(keepIds){
    const allowed = new Set(normalizeRoomIds(keepIds));
    try{
      if(!(FC.quoteOfferStore && typeof FC.quoteOfferStore.getCurrentDraft === 'function' && typeof FC.quoteOfferStore.patchCurrentDraft === 'function')) return;
      const draft = FC.quoteOfferStore.getCurrentDraft();
      const current = Array.isArray(draft && draft.selection && draft.selection.selectedRooms)
        ? draft.selection.selectedRooms.map((id)=> String(id || '').trim()).filter(Boolean)
        : [];
      const next = current.filter((id)=> allowed.has(id));
      if(current.length !== next.length) FC.quoteOfferStore.patchCurrentDraft({ selection:{ selectedRooms:next } });
    }catch(_){ }
  }

  function reconcileStatusesAfterRoomSetChange(inv, keepIds){
    const ids = normalizeRoomIds(keepIds);
    syncQuoteDraftSelectionAfterRoomChange(ids);
    try{
      if(FC.projectStatusSync && typeof FC.projectStatusSync.reconcileProjectStatuses === 'function'){
        FC.projectStatusSync.reconcileProjectStatuses({
          investorId: inv && inv.id,
          roomIds: ids,
          restrictToRoomIds:true,
          fallbackStatus:'nowy',
          refreshUi:false,
        });
        return;
      }
    }catch(_){ }

    try{
      if(!(FC.investors && typeof FC.investors.getById === 'function' && typeof FC.investors.update === 'function')) return;
      const investorId = inv && inv.id;
      if(!investorId) return;
      const latest = FC.investors.getById(investorId);
      if(!latest || !Array.isArray(latest.rooms)) return;
      const normalizedRooms = latest.rooms.map((room)=> {
        const id = String(room && room.id || '').trim();
        const allowed = !ids.length || ids.includes(id);
        return Object.assign({}, room, {
          projectStatus: allowed ? (room && room.projectStatus) || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy' : room && room.projectStatus
        });
      });
      FC.investors.update(investorId, { rooms:normalizedRooms });
    }catch(_){ }
  }

  function getCurrentProjectRecord(inv){
    const investorId = String(inv && inv.id || '');
    if(!investorId) return null;
    try{
      if(FC.projectStore && typeof FC.projectStore.getByInvestorId === 'function') return FC.projectStore.getByInvestorId(investorId) || null;
    }catch(_){ }
    return null;
  }

  function getSnapshotVersionName(snapshot){
    const metaName = String(snapshot && snapshot.meta && snapshot.meta.versionName || '').trim();
    const commercialName = String(snapshot && snapshot.commercialName || '').trim();
    return metaName || commercialName || 'Wycena';
  }

  function listRoomRemovalSnapshots(inv, roomIds){
    const ids = normalizeRoomIds(roomIds);
    if(!ids.length) return [];
    const record = getCurrentProjectRecord(inv);
    const projectId = String(record && record.id || '');
    if(!projectId) return [];
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.listOverlappingScopeSnapshots === 'function'){
        return FC.quoteSnapshotStore.listOverlappingScopeSnapshots(projectId, ids, { includeRejected:true });
      }
    }catch(_){ }
    return [];
  }

  function listSnapshotsForRoomRemoval(inv, roomIds){
    return listRoomRemovalSnapshots(inv, roomIds);
  }

  function countCabinetsForRoomIds(roomIds, inv){
    const ids = normalizeRoomIds(roomIds);
    if(!ids.length) return 0;
    const liveProject = getProject();
    const recordProject = (()=> {
      try{
        const record = getCurrentProjectRecord(inv || null);
        return record && record.projectData && typeof record.projectData === 'object' ? record.projectData : null;
      }catch(_){ return null; }
    })();
    const proj = (liveProject && typeof liveProject === 'object') ? liveProject : (recordProject || {});
    return ids.reduce((sum, roomId)=>{
      const room = proj && proj[roomId];
      const cabinets = Array.isArray(room && room.cabinets) ? room.cabinets.length : 0;
      return sum + cabinets;
    }, 0);
  }

  function buildRoomRemovalImpact(inv, roomIds, options){
    const ids = normalizeRoomIds(roomIds);
    const opts = options && typeof options === 'object' ? options : {};
    const snapshots = listRoomRemovalSnapshots(inv, ids);
    const deferred = !!opts.deferred;
    const roomNames = ids.map((id)=> getRoomLabel(id)).filter(Boolean);
    const roomLabel = roomNames.length === 1 ? roomNames[0] : (roomNames.length ? roomNames.join(', ') : 'wybrane pomieszczenia');
    const cabinetCount = countCabinetsForRoomIds(ids, inv);
    const cabinetLabel = cabinetCount === 1 ? 'szafkę' : (cabinetCount >= 2 && cabinetCount <= 4 ? 'szafki' : 'szafek');
    const lines = [];

    lines.push(deferred
      ? `Usuwając pomieszczenie „${roomLabel}”, po kliknięciu Zapisz usuniesz powiązane dane.`
      : `Usuwając pomieszczenie „${roomLabel}”, usuniesz powiązane dane.`);

    if(cabinetCount > 0) lines.push(`Usuniesz też ${cabinetCount} ${cabinetLabel} z tego pomieszczenia.`);

    if(snapshots.length){
      if(snapshots.length <= 3){
        const names = snapshots.map((snapshot)=> `• ${getSnapshotVersionName(snapshot)}`).join('\n');
        lines.push(`Zostaną też usunięte powiązane wyceny:\n${names}`);
      } else {
        lines.push(`Zostanie też usuniętych ${snapshots.length} wycen powiązanych z tym pomieszczeniem.`);
      }
    }

    if(!cabinetCount && !snapshots.length) lines.push('Tej operacji nie cofnisz.');

    return {
      roomIds: ids,
      roomNames,
      roomLabel,
      snapshots,
      cabinetCount,
      deferred,
      message: lines.join('\n\n'),
    };
  }

  function buildRoomRemovalWarningMessage(inv, roomIds, options){
    const impact = buildRoomRemovalImpact(inv, roomIds, options);
    return {
      message: impact.message,
      snapshots: impact.snapshots,
      cabinetCount: impact.cabinetCount,
      roomIds: impact.roomIds,
      roomNames: impact.roomNames,
      roomLabel: impact.roomLabel,
      deferred: impact.deferred,
    };
  }

  async function askDeleteRoomWithQuotes(inv, roomIds, options){
    const ids = normalizeRoomIds(roomIds);
    if(!ids.length) return false;
    const warning = buildRoomRemovalImpact(inv, ids, options);
    try{
      if(FC.confirmBox && typeof FC.confirmBox.ask === 'function'){
        return await FC.confirmBox.ask({
          title:'Usunąć pomieszczenie?',
          message: warning.message || 'Tej operacji nie cofnisz.',
          confirmText:'Usuń',
          cancelText:'Wróć',
          confirmTone:'danger',
          cancelTone:'neutral'
        });
      }
    }catch(_){ }
    return true;
  }

  function removeQuotesForRooms(inv, roomIds){
    const ids = normalizeRoomIds(roomIds);
    if(!ids.length) return [];
    const record = getCurrentProjectRecord(inv);
    const projectId = String(record && record.id || '');
    if(!projectId) return [];
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.removeSnapshotsForProjectRooms === 'function'){
        return FC.quoteSnapshotStore.removeSnapshotsForProjectRooms(projectId, ids, { includeRejected:true });
      }
    }catch(_){ }
    return [];
  }

  FC.roomRegistryImpact = {
    normalizeRoomIds,
    syncRoomSelectionAfterRemoval,
    syncQuoteDraftSelectionAfterRoomChange,
    reconcileStatusesAfterRoomSetChange,
    getCurrentProjectRecord,
    getSnapshotVersionName,
    listSnapshotsForRoomRemoval,
    listRoomRemovalSnapshots,
    countCabinetsForRoomIds,
    buildRoomRemovalImpact,
    buildRoomRemovalWarningMessage,
    askDeleteRoomWithQuotes,
    removeQuotesForRooms,
  };
})();
