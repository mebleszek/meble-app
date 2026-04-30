// js/app/investor/investor-project-repository.js
// Lokalna granica projektu inwestora: legacy sloty fc_project_inv_* + most do centralnego projectStore.
(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const storage = FC.storage || {
    getRaw(key){ try{ return localStorage.getItem(key); }catch(_){ return null; } },
    setRaw(key, raw){ try{ localStorage.setItem(key, raw); }catch(_){ } },
    removeRaw(key){ try{ localStorage.removeItem(key); }catch(_){ } },
  };

  const PREFIX = 'fc_project_inv_';
  const SUFFIX = '_v1';
  const CURRENT_INVESTOR_KEY = (FC.investorsModel && FC.investorsModel.KEY_CURRENT) || 'fc_current_investor_v1';
  const ACTIVE_PROJECT_KEY = (FC.constants && FC.constants.STORAGE_KEYS && FC.constants.STORAGE_KEYS.projectData) || 'fc_project_v1';

  function getProjectStore(){
    try{ return FC.projectStore || null; }catch(_){ return null; }
  }

  function invKey(id){
    const key = String(id || '').trim();
    return key ? (PREFIX + key + SUFFIX) : null;
  }

  function getCurrentInvestorId(){
    try{
      if(FC.investors && typeof FC.investors.getCurrentId === 'function') return FC.investors.getCurrentId();
    }catch(_){ }
    try{ return storage.getRaw(CURRENT_INVESTOR_KEY) || null; }catch(_){ return null; }
  }

  function readLegacySlotRaw(id){
    const key = invKey(id);
    if(!key) return null;
    try{ return storage.getRaw(key); }catch(_){ return null; }
  }

  function readLegacySlotProject(id){
    const raw = readLegacySlotRaw(id);
    if(!raw) return null;
    try{ return JSON.parse(raw); }catch(_){ return null; }
  }

  function writeLegacySlotProject(id, projectObj){
    const key = invKey(id);
    if(!key) return null;
    try{ storage.setRaw(key, JSON.stringify(projectObj)); }catch(_){ }
    return projectObj || null;
  }

  function removeLegacySlot(id){
    const key = invKey(id);
    if(!key) return;
    try{ storage.removeRaw(key); }catch(_){ }
  }

  function readActiveProjectRaw(){
    try{ return storage.getRaw(ACTIVE_PROJECT_KEY); }catch(_){ return null; }
  }

  function writeActiveProject(projectObj){
    try{ storage.setRaw(ACTIVE_PROJECT_KEY, JSON.stringify(projectObj)); }catch(_){ }
    return projectObj || null;
  }

  function saveCentralProjectForInvestor(id, projectObj, options){
    const projectStore = getProjectStore();
    try{
      if(projectStore && typeof projectStore.saveProjectDataForInvestor === 'function'){
        return projectStore.saveProjectDataForInvestor(id, projectObj, options || { meta:{ source:'investor-project-slot' } });
      }
    }catch(_){ }
    return null;
  }

  function loadCentralProjectForInvestor(id, fallback){
    const projectStore = getProjectStore();
    try{
      if(projectStore && typeof projectStore.loadProjectDataForInvestor === 'function'){
        return projectStore.loadProjectDataForInvestor(id, fallback);
      }
    }catch(_){ }
    return fallback;
  }

  function ensureCentralProjectForInvestor(id, options){
    const projectStore = getProjectStore();
    try{
      if(projectStore && typeof projectStore.ensureForInvestor === 'function') return projectStore.ensureForInvestor(id, options || {});
    }catch(_){ }
    return null;
  }

  function removeCentralProjectByInvestor(id){
    const projectStore = getProjectStore();
    try{
      if(projectStore && typeof projectStore.removeByInvestorId === 'function') projectStore.removeByInvestorId(id);
    }catch(_){ }
  }

  FC.investorProjectRepository = {
    PREFIX,
    SUFFIX,
    CURRENT_INVESTOR_KEY,
    ACTIVE_PROJECT_KEY,
    invKey,
    getCurrentInvestorId,
    readLegacySlotRaw,
    readLegacySlotProject,
    writeLegacySlotProject,
    removeLegacySlot,
    readActiveProjectRaw,
    writeActiveProject,
    saveCentralProjectForInvestor,
    loadCentralProjectForInvestor,
    ensureCentralProjectForInvestor,
    removeCentralProjectByInvestor,
  };
})();
