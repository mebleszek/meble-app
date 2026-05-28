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


  function setInvestorProjectStatus(id, roomId, status, options){
    const investorId = String(id || '');
    const targetRoomId = String(roomId || '');
    const nextStatus = String(status || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy');
    const opts = options && typeof options === 'object' ? options : {};
    const currentInvestor = getInvestorById(investorId);
    try{
      if(!opts.skipGuard && FC.projectStatusManualGuard && typeof FC.projectStatusManualGuard.validateManualStatusChange === 'function'){
        const validation = FC.projectStatusManualGuard.validateManualStatusChange(investorId, targetRoomId, nextStatus);
        if(validation && validation.blocked){
          return opts.returnDetails ? { applied:false, blocked:true, investor:currentInvestor, validation } : currentInvestor;
        }
      }
    }catch(_){ }
    try{
      if(!opts.explicitRoomOnly && FC.projectStatusManualGuard && typeof FC.projectStatusManualGuard.buildManualStatusScopeChoices === 'function'){
        const scopeDecision = FC.projectStatusManualGuard.buildManualStatusScopeChoices(investorId, targetRoomId, nextStatus);
        const autoRoomIds = scopeDecision && scopeDecision.autoChoice && Array.isArray(scopeDecision.autoChoice.roomIds) ? scopeDecision.autoChoice.roomIds : [];
        if(scopeDecision && scopeDecision.needsDecision !== true && autoRoomIds.length > 1){
          return setInvestorProjectStatusScope(investorId, autoRoomIds, nextStatus, Object.assign({}, opts, { skipGuard:true, syncSelection:true }));
        }
      }
    }catch(_){ }
    try{
      if(FC.projectStatusSync && typeof FC.projectStatusSync.setInvestorRoomStatus === 'function'){
        const result = FC.projectStatusSync.setInvestorRoomStatus(investorId, targetRoomId, nextStatus, { syncSelection:true });
        const investor = result && result.investor ? result.investor : getInvestorById(investorId);
        return opts.returnDetails ? { applied:true, blocked:false, investor, result:result || null } : investor;
      }
    }catch(_){ }
    const investor = updateInvestorRoom(investorId, targetRoomId, { projectStatus:nextStatus, lastManualProjectStatus:nextStatus });
    return opts.returnDetails ? { applied:true, blocked:false, investor, result:null } : investor;
  }


  function setInvestorProjectStatusScope(id, roomIds, status, options){
    const investorId = String(id || '');
    const ids = Array.isArray(roomIds) ? Array.from(new Set(roomIds.map((roomId)=> String(roomId || '').trim()).filter(Boolean))) : [];
    const nextStatus = String(status || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy');
    const opts = options && typeof options === 'object' ? options : {};
    if(!ids.length) return opts.returnDetails ? { applied:false, blocked:false, investor:getInvestorById(investorId), result:null } : getInvestorById(investorId);
    try{
      if(FC.projectStatusSync && typeof FC.projectStatusSync.applyProjectStatusChange === 'function'){
        const result = FC.projectStatusSync.applyProjectStatusChange({
          investorId,
          roomIds:ids,
          status:nextStatus,
          syncSelection: Object.prototype.hasOwnProperty.call(opts, 'syncSelection') ? !!opts.syncSelection : true,
          refreshUi: opts.refreshUi,
          preserveCurrentWhenNoQuoteRows: Object.prototype.hasOwnProperty.call(opts, 'preserveCurrentWhenNoQuoteRows') ? !!opts.preserveCurrentWhenNoQuoteRows : true,
        });
        const investor = result && result.investor ? result.investor : getInvestorById(investorId);
        return opts.returnDetails ? { applied:true, blocked:false, investor, result:result || null } : investor;
      }
    }catch(_){ }
    ids.forEach((roomId)=> updateInvestorRoom(investorId, roomId, { projectStatus:nextStatus, lastManualProjectStatus:nextStatus }));
    const investor = getInvestorById(investorId);
    return opts.returnDetails ? { applied:true, blocked:false, investor, result:null } : investor;
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
    setInvestorProjectStatusScope,
    removeInvestor,
  };
})();
