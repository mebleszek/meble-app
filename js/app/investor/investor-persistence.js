(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function store(){ return FC.investors || null; }

  function getCurrentInvestorId(){
    const api = store();
    return api && typeof api.getCurrentId === 'function' ? (api.getCurrentId() || null) : null;
  }

  function setCurrentInvestorId(id){
    const api = store();
    if(!(api && typeof api.setCurrentId === 'function')) return null;
    api.setCurrentId(id || null);
    return id || null;
  }

  function getInvestorById(id){
    const api = store();
    return api && typeof api.getById === 'function' ? (api.getById(id) || null) : null;
  }

  function searchInvestors(query){
    const api = store();
    return api && typeof api.search === 'function' ? (api.search(query) || []) : [];
  }

  function createInvestor(initial){
    const api = store();
    return api && typeof api.create === 'function' ? (api.create(initial || {}) || null) : null;
  }

  function saveInvestorPatch(id, patch){
    const api = store();
    if(!(api && typeof api.update === 'function')) return null;
    return api.update(id, patch || {}) || null;
  }

  function updateInvestorRoom(id, roomId, patch){
    const investor = getInvestorById(id);
    if(!(investor && roomId)) return null;
    const rooms = Array.isArray(investor.rooms) ? investor.rooms.slice() : [];
    const idx = rooms.findIndex((room)=> room && String(room.id || '') === String(roomId));
    if(idx < 0) return investor;
    rooms[idx] = Object.assign({}, rooms[idx], patch || {});
    return saveInvestorPatch(id, { rooms });
  }


  const STATUS_RANK = {
    nowy:0,
    wstepna_wycena:1,
    pomiar:2,
    wycena:3,
    zaakceptowany:4,
    umowa:5,
    produkcja:6,
    montaz:7,
    zakonczone:8,
    odrzucone:-1,
  };

  function normalizeStatus(value){
    return String(value || '').trim().toLowerCase();
  }

  function statusRank(value){
    const key = normalizeStatus(value);
    return Object.prototype.hasOwnProperty.call(STATUS_RANK, key) ? STATUS_RANK[key] : -99;
  }

  function normalizeRoomIds(roomIds){
    return Array.isArray(roomIds)
      ? Array.from(new Set(roomIds.map((item)=> String(item || '').trim()).filter(Boolean)))
      : [];
  }

  function getInvestorRoomStatuses(investor){
    const rooms = investor && Array.isArray(investor.rooms) ? investor.rooms : [];
    return rooms
      .map((room)=> normalizeStatus(room && (room.projectStatus || room.status)))
      .filter(Boolean);
  }

  function getAggregateInvestorStatus(investor, fallbackStatus){
    const statuses = getInvestorRoomStatuses(investor);
    if(!statuses.length) return String(fallbackStatus || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy');
    let best = statuses[0];
    statuses.forEach((status)=> {
      if(statusRank(status) > statusRank(best)) best = status;
    });
    return best || String(fallbackStatus || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy');
  }


  function getKnownRoomIds(investor, projectRecord, loadedProject, fallbackRoomIds){
    const set = new Set(normalizeRoomIds(fallbackRoomIds));
    const rooms = investor && Array.isArray(investor.rooms) ? investor.rooms : [];
    rooms.forEach((room)=> {
      const key = String(room && room.id || '');
      if(key) set.add(key);
    });
    try{
      const defs = projectRecord && projectRecord.projectData && projectRecord.projectData.meta && projectRecord.projectData.meta.roomDefs;
      if(defs && typeof defs === 'object') Object.keys(defs).forEach((roomId)=> { if(roomId) set.add(roomId); });
    }catch(_){ }
    try{
      const defs = loadedProject && loadedProject.meta && loadedProject.meta.roomDefs;
      if(defs && typeof defs === 'object') Object.keys(defs).forEach((roomId)=> { if(roomId) set.add(roomId); });
    }catch(_){ }
    return Array.from(set);
  }

  function getRoomStatusMap(investor, roomIds, loadedProject){
    const ids = normalizeRoomIds(roomIds);
    const map = {};
    const investorRooms = investor && Array.isArray(investor.rooms) ? investor.rooms : [];
    const roomDefs = loadedProject && loadedProject.meta && loadedProject.meta.roomDefs && typeof loadedProject.meta.roomDefs === 'object' ? loadedProject.meta.roomDefs : null;
    ids.forEach((roomId)=> {
      const room = investorRooms.find((entry)=> String(entry && entry.id || '') === roomId);
      let status = normalizeStatus(room && (room.projectStatus || room.status));
      if(!status && roomDefs && roomDefs[roomId]) status = normalizeStatus(roomDefs[roomId].projectStatus || roomDefs[roomId].status);
      if(status) map[roomId] = status;
    });
    return map;
  }
  function setInvestorProjectStatus(id, roomId, status){
    const nextStatus = String(status || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy');
    try{
      if(FC.projectStatusSync && typeof FC.projectStatusSync.setInvestorRoomStatus === 'function'){
        const result = FC.projectStatusSync.setInvestorRoomStatus(String(id || ''), roomId, nextStatus, { syncSelection:true });
        return result && result.investor ? result.investor : getInvestorById(id);
      }
    }catch(_){ }
    const investor = updateInvestorRoom(id, roomId, { projectStatus:nextStatus });
    syncProjectAndQuoteStatus(String(id || ''), nextStatus, { roomIds:[roomId], investor });
    return investor;
  }



  function syncProjectAndQuoteStatus(investorId, status, options){
    const nextStatus = String(status || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy');
    try{
      if(FC.projectStatusSync && typeof FC.projectStatusSync.applyProjectStatusChange === 'function'){
        const result = FC.projectStatusSync.applyProjectStatusChange(Object.assign({}, options || {}, {
          investorId:String(investorId || ''),
          status:nextStatus,
          syncSelection: options && Object.prototype.hasOwnProperty.call(options, 'syncSelection') ? !!options.syncSelection : true,
        }));
        return result && result.investor ? result.investor : getInvestorById(investorId);
      }
    }catch(_){ }
    const roomIds = normalizeRoomIds(options && options.roomIds);
    let investor = options && options.investor ? options.investor : getInvestorById(investorId);
    let projectRecord = null;
    try{
      if(investorId && FC.projectStore && typeof FC.projectStore.getByInvestorId === 'function') projectRecord = FC.projectStore.getByInvestorId(investorId);
    }catch(_){ projectRecord = null; }
    let loadedProject = null;
    try{
      if(FC.project && typeof FC.project.load === 'function') loadedProject = FC.project.load() || null;
    }catch(_){ loadedProject = null; }

    try{
      if(projectRecord && projectRecord.id && FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.syncSelectionForProjectStatus === 'function'){
        FC.quoteSnapshotStore.syncSelectionForProjectStatus(projectRecord.id, nextStatus, roomIds.length ? { roomIds } : undefined);
      }
    }catch(_){ }

    const knownRoomIds = getKnownRoomIds(investor, projectRecord, loadedProject, roomIds);
    const currentStatusMap = getRoomStatusMap(investor, knownRoomIds, loadedProject);
    let roomStatusMap = Object.assign({}, currentStatusMap);
    try{
      if(projectRecord && projectRecord.id && FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getRecommendedStatusMapForProject === 'function'){
        roomStatusMap = Object.assign(roomStatusMap, FC.quoteSnapshotStore.getRecommendedStatusMapForProject(projectRecord.id, currentStatusMap, knownRoomIds) || {});
      }
    }catch(_){ }
    roomIds.forEach((roomId)=> {
      const key = String(roomId || '');
      if(key) roomStatusMap[key] = normalizeStatus(nextStatus);
    });

    let nextInvestor = investor;
    try{
      if(investor && typeof saveInvestorPatch === 'function'){
        const rooms = (Array.isArray(investor.rooms) ? investor.rooms : []).map((room)=> {
          const key = String(room && room.id || '');
          const resolvedStatus = normalizeStatus(roomStatusMap[key] || room && (room.projectStatus || room.status) || '');
          return Object.assign({}, room, resolvedStatus ? { projectStatus:resolvedStatus } : {});
        });
        if(rooms.length) nextInvestor = saveInvestorPatch(investor.id, { rooms }) || Object.assign({}, investor, { rooms });
      }
    }catch(_){ nextInvestor = investor; }

    const aggregateStatus = getAggregateInvestorStatus(nextInvestor, nextStatus);
    try{
      if(projectRecord && FC.projectStore && typeof FC.projectStore.upsert === 'function'){
        FC.projectStore.upsert(Object.assign({}, projectRecord, { status:aggregateStatus, updatedAt:Date.now() }));
      }
    }catch(_){ }
    try{
      if(FC.project && typeof FC.project.save === 'function'){
        const proj = loadedProject || {};
        const meta = proj && proj.meta && typeof proj.meta === 'object' ? proj.meta : null;
        if(meta){
          meta.projectStatus = aggregateStatus;
          if(meta.roomDefs && typeof meta.roomDefs === 'object'){
            Object.keys(meta.roomDefs).forEach((roomId)=> {
              const row = meta.roomDefs[roomId];
              if(!row || typeof row !== 'object') return;
              const resolvedStatus = normalizeStatus(roomStatusMap[roomId] || row.projectStatus || row.status || '');
              meta.roomDefs[roomId] = Object.assign({}, row, resolvedStatus ? { projectStatus:resolvedStatus } : {});
            });
          }
          FC.project.save(proj);
        }
      }
    }catch(_){ }
    return nextInvestor;
  }
  function removeInvestor(id){
    const api = store();
    if(!(api && typeof api.remove === 'function')) return false;
    api.remove(id);
    return true;
  }

  function getSelectedInvestor(fallbackId){
    return getInvestorById(fallbackId || getCurrentInvestorId());
  }

  FC.investorPersistence = {
    getCurrentInvestorId,
    setCurrentInvestorId,
    getInvestorById,
    getSelectedInvestor,
    searchInvestors,
    createInvestor,
    saveInvestorPatch,
    updateInvestorRoom,
    setInvestorProjectStatus,
    removeInvestor,
    _debug:{ normalizeStatus, statusRank, normalizeRoomIds, getAggregateInvestorStatus },
  };
})();
