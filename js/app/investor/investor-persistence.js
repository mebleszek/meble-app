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

  function setInvestorStatus(id, status){
    return saveInvestorPatch(id, { status:String(status || 'nowy') });
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
    setInvestorStatus,
    removeInvestor,
  };
})();
