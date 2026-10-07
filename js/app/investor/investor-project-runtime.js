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
    // Legacy sloty pozostają danymi awaryjnymi, ale nie są już normalnym źródłem odczytu.
    return normalizeProject(freshProject());
  }

  function writeProjectFor(id, projectObj){
    if(!id) return null;
    const normalized = normalizeProject(projectObj);
    let centralSaved = null;
    try{
      if(repo && typeof repo.saveCentralProjectForInvestor === 'function'){
        centralSaved = repo.saveCentralProjectForInvestor(id, normalized, { meta:{ source:'investor-project-slot' } });
      }
    }catch(_){ centralSaved = null; }
    if(!centralSaved) return null;
    return normalized;
  }

  function saveActiveProjectToInvestor(id){
    if(!id) return;
    try{
      if(typeof projectData !== 'undefined' && projectData){
        return writeProjectFor(id, normalizeProject(projectData));
      }
    }catch(_){ }
    return null;
  }

  function persistAsActiveProject(proj){
    // 2B.3b: aktywacja projektu nie tworzy już pełnej kopii fc_project_v1.
    // loadCentralProjectForInvestor() ustawia currentProjectId; tutaj tylko upewniamy się,
    // że wskazanie ID odpowiada aktywnemu inwestorowi.
    try{
      const id = repo && typeof repo.getCurrentInvestorId === 'function' ? repo.getCurrentInvestorId() : null;
      const store = FC.projectStore || null;
      const record = id && store && typeof store.getByInvestorId === 'function' ? store.getByInvestorId(id) : null;
      if(record && store && typeof store.setCurrentProjectId === 'function') store.setCurrentProjectId(record.id);
    }catch(_){ }
    return proj || null;
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

    // Centralny projectStore jest autorytatywnym źródłem na starcie.
    // Brak legacy slotu nie może już powodować utworzenia świeżego projektu
    // i nadpisania istniejącego rekordu centralnego.
    let centralProject = null;
    try{
      if(repo && typeof repo.loadCentralProjectForInvestor === 'function'){
        centralProject = repo.loadCentralProjectForInvestor(id, null);
      }
    }catch(_){ centralProject = null; }
    if(centralProject){
      setActiveProjectFromInvestor(id);
      return;
    }

    const proj = normalizeProject(freshProject());
    try{ proj.meta = proj.meta || {}; proj.meta.assignedInvestorId = id; }catch(_){ }
    // Brak rekordu centralnego oznacza utworzenie nowego rekordu centralnego.
    // Istniejący legacy slot nie jest importowany automatycznie w zwykłym bootcie.
    writeProjectFor(id, proj);
    setActiveProjectFromInvestor(id);
  }

  function refreshSessionButtons(){
    try{
      if(FC.views && typeof FC.views.refreshSessionButtons === 'function') FC.views.refreshSessionButtons();
    }catch(_){ }
  }

  function comparableProjectData(value){
    let normalized = value;
    try{
      if(FC.project && typeof FC.project.normalize === 'function') normalized = FC.project.normalize(value);
    }catch(_){ }
    try{
      if(FC.projectStore && typeof FC.projectStore.prepareProjectDataForPersistence === 'function') {
        normalized = FC.projectStore.prepareProjectDataForPersistence(normalized);
      }
    }catch(_){ }
    return normalized;
  }

  function currentCentralProjectForSessionCompare(){
    const id = repo && typeof repo.getCurrentInvestorId === 'function' ? repo.getCurrentInvestorId() : null;
    if(id){
      try{
        if(repo && typeof repo.loadCentralProjectForInvestor === 'function') {
          const central = repo.loadCentralProjectForInvestor(id, null);
          if(central) return central;
        }
      }catch(_){ }
    }
    try{
      if(FC.projectStore && typeof FC.projectStore.getCurrentRecord === 'function') {
        const record = FC.projectStore.getCurrentRecord();
        if(record && record.projectData) return record.projectData;
      }
    }catch(_){ }
    return null;
  }

  function hasProjectDivergence(nextData){
    const before = comparableProjectData(currentCentralProjectForSessionCompare());
    const next = comparableProjectData(nextData);
    let beforeRaw = null;
    let nextRaw = null;
    try{ beforeRaw = JSON.stringify(before); }catch(_){ beforeRaw = null; }
    try{ nextRaw = JSON.stringify(next); }catch(_){ nextRaw = null; }
    return beforeRaw !== nextRaw;
  }

  function shouldTrackProjectSession(nextData){
    try{
      if(FC.project && FC.project.__suspendSessionTracking) return false;
    }catch(_){ }
    const session = FC.session;
    if(!(session && typeof session.begin === 'function')) return false;
    if(session.active) return false;
    return hasProjectDivergence(nextData);
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
    hasProjectDivergence,
    shouldTrackProjectSession,
  };
})();
