(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function createApi(deps){
    deps = deps || {};
    const apiFC = deps.FC || FC;
    const getProject = typeof deps.getProject === 'function' ? deps.getProject : function(){ return null; };
    const saveProject = typeof deps.saveProject === 'function' ? deps.saveProject : function(){};
    const getCurrentInvestor = typeof deps.getCurrentInvestor === 'function' ? deps.getCurrentInvestor : function(){ return null; };
    const core = deps.core || {};
    const ensureProjectMeta = core.ensureProjectMeta || function(proj){ return proj && proj.meta ? proj.meta : null; };
    const discoverProjectRoomKeys = core.discoverProjectRoomKeys || function(){ return []; };
    const roomTemplate = core.roomTemplate || function(){ return { cabinets:[], fronts:[], sets:[], settings:{} }; };
    const normalizeRoomDef = core.normalizeRoomDef || function(room){ return room || null; };
    const hasLegacyKitchen = core.hasLegacyKitchen || function(){ return false; };
    const getRoomLabel = core.getRoomLabel || function(id){ return String(id || ''); };

    function syncRoomSelectionAfterRemoval(selectedId){
      const id = String(selectedId || '').trim();
      if(!id) return;
      try{
        if(apiFC.quoteOfferStore && typeof apiFC.quoteOfferStore.getSelectedRooms === 'function' && typeof apiFC.quoteOfferStore.setSelectedRooms === 'function'){
          const rooms = (apiFC.quoteOfferStore.getSelectedRooms() || []).map((room)=> String(room || '')).filter(Boolean);
          if(!rooms.includes(id)) return;
          const next = rooms.filter((room)=> room !== id);
          apiFC.quoteOfferStore.setSelectedRooms(next);
        }
      }catch(_){ }
    }

    function syncQuoteDraftSelectionAfterRoomChange(keepIds){
      const allowed = new Set((Array.isArray(keepIds) ? keepIds : []).map((id)=> String(id || '')).filter(Boolean));
      try{
        if(apiFC.quoteOfferStore && typeof apiFC.quoteOfferStore.getDraft === 'function' && typeof apiFC.quoteOfferStore.saveDraft === 'function'){
          const draft = apiFC.quoteOfferStore.getDraft() || {};
          const selection = draft.selection || {};
          const selectedRooms = Array.isArray(selection.selectedRooms) ? selection.selectedRooms.map((id)=> String(id || '')).filter(Boolean) : [];
          const nextRooms = allowed.size ? selectedRooms.filter((id)=> allowed.has(id)) : [];
          const changed = nextRooms.length !== selectedRooms.length || nextRooms.some((id, index)=> id !== selectedRooms[index]);
          if(changed){
            const nextDraft = Object.assign({}, draft, {
              selection: Object.assign({}, selection, { selectedRooms: nextRooms })
            });
            apiFC.quoteOfferStore.saveDraft(nextDraft);
          }
        }
      }catch(_){ }
    }

    function reconcileStatusesAfterRoomSetChange(inv, keepIds){
      const ids = Array.isArray(keepIds) ? keepIds.map((id)=> String(id || '').trim()).filter(Boolean) : [];
      syncQuoteDraftSelectionAfterRoomChange(ids);
      try{
        if(apiFC.projectStatusSync && typeof apiFC.projectStatusSync.reconcileProjectStatuses === 'function'){
          apiFC.projectStatusSync.reconcileProjectStatuses({
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
        if(apiFC.projectStore && typeof apiFC.projectStore.getByInvestorId === 'function'){
          const record = apiFC.projectStore.getByInvestorId(inv && inv.id || '');
          if(record && apiFC.projectStore && typeof apiFC.projectStore.upsert === 'function'){
            apiFC.projectStore.upsert(Object.assign({}, record, { status:'nowy', updatedAt:Date.now() }));
          }
        }
      }catch(_){ }
      try{
        const proj = getProject() || {};
        const meta = ensureProjectMeta(proj);
        if(meta) meta.projectStatus = 'nowy';
        saveProject(proj);
      }catch(_){ }
    }

    function getCurrentProjectRecord(inv){
      const investorId = String(inv && inv.id || getCurrentInvestor() && getCurrentInvestor().id || '').trim();
      if(!investorId) return null;
      try{
        if(apiFC.projectStore && typeof apiFC.projectStore.getByInvestorId === 'function'){
          return apiFC.projectStore.getByInvestorId(investorId) || null;
        }
      }catch(_){ }
      return null;
    }

    function getSnapshotVersionName(snapshot){
      const name = snapshot && snapshot.commercial && snapshot.commercial.versionName;
      if(name) return name;
      const metaName = snapshot && snapshot.meta && snapshot.meta.versionName;
      return metaName || 'Oferta';
    }

    function listSnapshotsForRoomRemoval(inv, roomIds){
      const ids = Array.isArray(roomIds) ? roomIds.map((id)=> String(id || '').trim()).filter(Boolean) : [];
      if(!ids.length) return [];
      const record = getCurrentProjectRecord(inv);
      const projectId = String(record && record.id || '');
      if(!projectId) return [];
      try{
        if(apiFC.quoteSnapshotStore && typeof apiFC.quoteSnapshotStore.listOverlappingScopeSnapshots === 'function'){
          return apiFC.quoteSnapshotStore.listOverlappingScopeSnapshots(projectId, ids, { includeRejected:true }) || [];
        }
      }catch(_){ }
      return [];
    }

    function countCabinetsForRoomIds(roomIds){
      const proj = getProject() || {};
      const ids = Array.isArray(roomIds) ? roomIds.map((id)=> String(id || '').trim()).filter(Boolean) : [];
      return ids.reduce((sum, roomId)=>{
        const room = proj && proj[roomId];
        const count = Array.isArray(room && room.cabinets) ? room.cabinets.length : 0;
        return sum + count;
      }, 0);
    }

    function buildRoomRemovalWarningMessage(inv, roomIds, options){
      const ids = Array.isArray(roomIds) ? roomIds.map((id)=> String(id || '').trim()).filter(Boolean) : [];
      const opts = options && typeof options === 'object' ? options : {};
      const snapshots = listSnapshotsForRoomRemoval(inv, ids);
      const deferred = !!opts.deferred;
      const roomNames = ids.map((id)=> getRoomLabel(id)).filter(Boolean);
      const roomLabel = roomNames.length === 1 ? roomNames[0] : (roomNames.length ? roomNames.join(', ') : 'wybrane pomieszczenia');
      const cabinetCount = countCabinetsForRoomIds(ids);
      const cabinetLabel = cabinetCount === 1 ? 'szafkę' : (cabinetCount >= 2 && cabinetCount <= 4 ? 'szafki' : 'szafek');
      const lines = [];

      lines.push(deferred
        ? `Usuwając pomieszczenie „${roomLabel}”, po kliknięciu Zapisz usuniesz powiązane dane.`
        : `Usuwając pomieszczenie „${roomLabel}”, usuniesz powiązane dane.`);

      if(cabinetCount > 0){
        lines.push(`Usuniesz też ${cabinetCount} ${cabinetLabel} z tego pomieszczenia.`);
      }

      if(snapshots.length){
        if(snapshots.length <= 3){
          const names = snapshots.map((snapshot)=> `• ${getSnapshotVersionName(snapshot)}`).join('\n');
          lines.push(`Zostaną też usunięte powiązane wyceny:\n${names}`);
        } else {
          lines.push(`Zostanie też usuniętych ${snapshots.length} wycen powiązanych z tym pomieszczeniem.`);
        }
      }

      if(!cabinetCount && !snapshots.length){
        lines.push('Tej operacji nie cofnisz.');
      }

      return { message: lines.join('\n\n'), snapshots, cabinetCount };
    }

    async function askDeleteRoomWithQuotes(inv, roomIds, options){
      const ids = Array.isArray(roomIds) ? roomIds.map((id)=> String(id || '').trim()).filter(Boolean) : [];
      if(!ids.length) return false;
      const warning = buildRoomRemovalWarningMessage(inv, ids, options);
      try{
        if(apiFC.confirmBox && typeof apiFC.confirmBox.ask === 'function'){
          return await apiFC.confirmBox.ask({
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
      const ids = Array.isArray(roomIds) ? roomIds.map((id)=> String(id || '').trim()).filter(Boolean) : [];
      if(!ids.length) return [];
      const record = getCurrentProjectRecord(inv);
      const projectId = String(record && record.id || '');
      if(!projectId) return [];
      try{
        if(apiFC.quoteSnapshotStore && typeof apiFC.quoteSnapshotStore.removeSnapshotsForProjectRooms === 'function'){
          return apiFC.quoteSnapshotStore.removeSnapshotsForProjectRooms(projectId, ids, { includeRejected:true });
        }
      }catch(_){ }
      return [];
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
      try{ apiFC.investors && apiFC.investors.update && apiFC.investors.update(inv.id, { rooms }); }catch(_){ }
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
        projectStatus: room.projectStatus || (apiFC.investors && apiFC.investors.DEFAULT_PROJECT_STATUS) || 'nowy'
      }));
      updateInvestorRooms(inv, nextRooms);
      reconcileStatusesAfterRoomSetChange(inv, nextRooms.map((room)=> room.id));
      return selectedId;
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
          projectStatus: prev.projectStatus || (apiFC.investors && apiFC.investors.DEFAULT_PROJECT_STATUS) || 'nowy'
        };
      });
      updateInvestorRooms(inv, nextRooms);
      reconcileStatusesAfterRoomSetChange(inv, nextRooms.map((room)=> room.id));
      return nextRooms;
    }

    return {
      syncRoomSelectionAfterRemoval,
      syncQuoteDraftSelectionAfterRoomChange,
      reconcileStatusesAfterRoomSetChange,
      getCurrentProjectRecord,
      getSnapshotVersionName,
      listSnapshotsForRoomRemoval,
      countCabinetsForRoomIds,
      buildRoomRemovalWarningMessage,
      askDeleteRoomWithQuotes,
      removeQuotesForRooms,
      removeRoomsData,
      updateInvestorRooms,
      removeRoomById,
      applyManageRoomsDraft,
    };
  }

  FC.roomRegistryRemoval = { createApi };
})();
