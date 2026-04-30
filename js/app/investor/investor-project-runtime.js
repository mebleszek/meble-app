// js/app/investor/investor-project-runtime.js
// Runtime aktywnego projektu inwestora: normalizacja, save/load i odświeżenie aplikacji.
(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const repo = FC.investorProjectRepository || {};

  function clone(obj){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(obj) : JSON.parse(JSON.stringify(obj)); }
    catch(_){ return obj; }
  }

  function normalizeProject(obj){
    try{
      if(FC.project && typeof FC.project.normalize === 'function') return FC.project.normalize(obj);
    }catch(_){ }
    return obj;
  }

  function freshProject(){
    try{
      if(FC.project && FC.project.DEFAULT_PROJECT) return clone(FC.project.DEFAULT_PROJECT);
    }catch(_){ }
    return { schemaVersion: 1 };
  }

  function loadProjectFor(id){
    try{
      if(repo && typeof repo.loadCentralProjectForInvestor === 'function'){
        const fromStore = repo.loadCentralProjectForInvestor(id, null);
        if(fromStore) return normalizeProject(fromStore);
      }
    }catch(_){ }
    try{
      if(repo && typeof repo.readLegacySlotProject === 'function'){
        const fromLegacySlot = repo.readLegacySlotProject(id);
        if(fromLegacySlot) return normalizeProject(fromLegacySlot);
      }
    }catch(_){ }
    return normalizeProject(freshProject());
  }

  function writeProjectFor(id, projectObj){
    if(!id) return;
    const normalized = normalizeProject(projectObj);
    try{ if(repo && typeof repo.writeLegacySlotProject === 'function') repo.writeLegacySlotProject(id, normalized); }catch(_){ }
    try{ if(repo && typeof repo.saveCentralProjectForInvestor === 'function') repo.saveCentralProjectForInvestor(id, normalized, { meta:{ source:'investor-project-slot' } }); }catch(_){ }
  }

  function saveActiveProjectToInvestor(id){
    if(!id) return;
    try{
      if(typeof projectData !== 'undefined' && projectData){
        writeProjectFor(id, normalizeProject(projectData));
      }
    }catch(_){ }
  }

  function persistAsActiveProject(proj){
    try{
      if(FC.project && typeof FC.project.save === 'function'){
        FC.project.__suspendSessionTracking = true;
        FC.project.save(proj);
      } else if(repo && typeof repo.writeActiveProject === 'function') {
        repo.writeActiveProject(proj);
      }
    }catch(_){ }
    finally{
      try{ if(FC.project) FC.project.__suspendSessionTracking = false; }catch(_){ }
    }
  }

  function refreshProjectUi(){
    try{ if(typeof normalizeProjectData === 'function') normalizeProjectData(); }catch(_){ }
    try{ if(FC.views && typeof FC.views.applyFromState === 'function' && typeof uiState !== 'undefined') FC.views.applyFromState(uiState); }catch(_){ }
    try{ if(typeof render === 'function') render(); }catch(_){ }
    try{ if(FC.sections && typeof FC.sections.update === 'function') FC.sections.update(); }catch(_){ }
  }

  function setActiveProjectFromInvestor(id){
    if(!id) return;
    try{
      const proj = loadProjectFor(id);
      try{ proj.meta = proj.meta || {}; proj.meta.assignedInvestorId = id; }catch(_){ }
      try{
        if(typeof projectData !== 'undefined') projectData = proj;
      }catch(_){ }
      persistAsActiveProject(proj);
      refreshProjectUi();
    }catch(_){ }
  }

  function ensureInvestorProjectLoadedOnBoot(){
    const id = repo && typeof repo.getCurrentInvestorId === 'function' ? repo.getCurrentInvestorId() : null;
    if(!id) return;
    const hasLegacySlot = repo && typeof repo.readLegacySlotRaw === 'function' ? !!repo.readLegacySlotRaw(id) : false;
    if(hasLegacySlot){
      setActiveProjectFromInvestor(id);
      return;
    }
    const proj = normalizeProject(freshProject());
    try{ proj.meta = proj.meta || {}; proj.meta.assignedInvestorId = id; }catch(_){ }
    writeProjectFor(id, proj);
    try{ if(repo && typeof repo.ensureCentralProjectForInvestor === 'function') repo.ensureCentralProjectForInvestor(id, { projectData:proj, title:'' }); }catch(_){ }
    setActiveProjectFromInvestor(id);
  }

  function refreshSessionButtons(){
    try{
      if(FC.views && typeof FC.views.refreshSessionButtons === 'function') FC.views.refreshSessionButtons();
    }catch(_){ }
  }

  function shouldTrackProjectSession(nextData){
    try{
      if(FC.project && FC.project.__suspendSessionTracking) return false;
    }catch(_){ }
    const session = FC.session;
    if(!(session && typeof session.begin === 'function')) return false;
    if(session.active) return false;
    let beforeRaw = null;
    try{ beforeRaw = repo && typeof repo.readActiveProjectRaw === 'function' ? repo.readActiveProjectRaw() : null; }catch(_){ beforeRaw = null; }
    let normalized = nextData;
    try{
      if(FC.project && typeof FC.project.normalize === 'function') normalized = FC.project.normalize(nextData);
    }catch(_){ }
    let nextRaw = null;
    try{ nextRaw = JSON.stringify(normalized); }catch(_){ nextRaw = null; }
    return beforeRaw !== nextRaw;
  }

  FC.investorProjectRuntime = {
    normalizeProject,
    freshProject,
    loadProjectFor,
    writeProjectFor,
    saveActiveProjectToInvestor,
    persistAsActiveProject,
    refreshProjectUi,
    setActiveProjectFromInvestor,
    ensureInvestorProjectLoadedOnBoot,
    refreshSessionButtons,
    shouldTrackProjectSession,
  };
})();
