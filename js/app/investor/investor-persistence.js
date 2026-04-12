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

  function setInvestorProjectStatus(id, roomId, status){
    const nextStatus = String(status || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy');
    const investor = updateInvestorRoom(id, roomId, { projectStatus:nextStatus });
    syncProjectAndQuoteStatus(String(id || ''), nextStatus, { roomIds:[roomId], investor });
    return investor;
  }


  function syncProjectAndQuoteStatus(investorId, status, options){
    const nextStatus = String(status || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy');
    const roomIds = normalizeRoomIds(options && options.roomIds);
    const investor = options && options.investor ? options.investor : getInvestorById(investorId);
    const aggregateStatus = getAggregateInvestorStatus(investor, nextStatus);
    try{
      if(investorId && FC.projectStore && typeof FC.projectStore.getByInvestorId === 'function' && typeof FC.projectStore.upsert === 'function'){
        const record = FC.projectStore.getByInvestorId(investorId);
        if(record) FC.projectStore.upsert(Object.assign({}, record, { status:aggregateStatus, updatedAt:Date.now() }));
      }
    }catch(_){ }
    try{
      if(FC.project && typeof FC.project.load === 'function' && typeof FC.project.save === 'function'){
        const proj = FC.project.load() || {};
        const meta = proj && proj.meta && typeof proj.meta === 'object' ? proj.meta : null;
        if(meta){
          meta.projectStatus = aggregateStatus;
          if(meta.roomDefs && typeof meta.roomDefs === 'object'){
            const targetIds = roomIds.length ? roomIds : Object.keys(meta.roomDefs);
            targetIds.forEach((roomId)=>{
              const row = meta.roomDefs[roomId];
              if(!row || typeof row !== 'object') return;
              meta.roomDefs[roomId] = Object.assign({}, row, { projectStatus: nextStatus });
            });
          }
          FC.project.save(proj);
        }
      }
    }catch(_){ }
    try{
      if(investorId && FC.projectStore && typeof FC.projectStore.getByInvestorId === 'function' && FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.syncSelectionForProjectStatus === 'function'){
        const record = FC.projectStore.getByInvestorId(investorId);
        if(record && record.id) FC.quoteSnapshotStore.syncSelectionForProjectStatus(record.id, nextStatus, roomIds.length ? { roomIds } : undefined);
      }
    }catch(_){ }
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
