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

  function setInvestorProjectStatus(id, roomId, status){
    const nextStatus = String(status || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy');
    const investor = updateInvestorRoom(id, roomId, { projectStatus:nextStatus });
    syncProjectAndQuoteStatus(String(id || ''), nextStatus);
    return investor;
  }


  function syncProjectAndQuoteStatus(investorId, status){
    const nextStatus = String(status || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy');
    try{
      if(investorId && FC.projectStore && typeof FC.projectStore.getByInvestorId === 'function' && typeof FC.projectStore.upsert === 'function'){
        const record = FC.projectStore.getByInvestorId(investorId);
        if(record) FC.projectStore.upsert(Object.assign({}, record, { status:nextStatus, updatedAt:Date.now() }));
      }
    }catch(_){ }
    try{
      if(FC.project && typeof FC.project.load === 'function' && typeof FC.project.save === 'function'){
        const proj = FC.project.load() || {};
        const meta = proj && proj.meta && typeof proj.meta === 'object' ? proj.meta : null;
        if(meta){
          meta.projectStatus = nextStatus;
          if(meta.roomDefs && typeof meta.roomDefs === 'object'){
            Object.keys(meta.roomDefs).forEach((roomId)=>{
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
        if(record && record.id) FC.quoteSnapshotStore.syncSelectionForProjectStatus(record.id, nextStatus);
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
  };
})();
