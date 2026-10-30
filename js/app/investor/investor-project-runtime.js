// js/app/investor/investor-project-runtime.js
// Runtime aktywnego projektu inwestora: normalizacja, save/load i odświeżenie aplikacji.
(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const repo = FC.investorProjectRepository || {};
  let bootLoaded = false;
  const firstActivations = new WeakMap();
  const creationActivations = new WeakMap();

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
    if(FC.session && FC.session.canSwitchInvestor && !FC.session.canSwitchInvestor(id)) return null;
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
        const row=FC.projectStore && FC.projectStore.getCurrentRecord();
        if(!row || String(row.investorId)!==String(id) || String(projectData.meta?.assignedInvestorId)!==String(id))return null;
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
      const current = store && typeof store.getCurrentRecord === 'function' ? store.getCurrentRecord() : null;
      const record = current && String(current.investorId || '') === String(id || '') ? current : null;
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

  function activateProjectFromInvestor(id, initialRead, options){
    if(!id) return;
    if(FC.session && FC.session.canSwitchInvestor && !FC.session.canSwitchInvestor(id)) return;
    // Re-entering the same investor must not replace an active local draft.
    if(FC.session && FC.session.active) return false;
    try{
      const store = FC.projectStore;
      const current = store && store.getCurrentRecord ? store.getCurrentRecord() : null;
      const target = store && store.getByInvestorId ? store.getByInvestorId(id) : null;
      if(!target) return false;
      if(!initialRead && typeof projectData !== 'undefined' && projectData){
        const ram = JSON.stringify(comparableProjectData(projectData));
        if(ram !== JSON.stringify(comparableProjectData(current && current.projectData))
          && ram !== JSON.stringify(comparableProjectData(target.projectData))
          && !consumeCreation(options,id,target,ram) && !consumeFirstActivation(options, id, target, ram)) return false;
      }
      const previousProject = typeof projectData !== 'undefined' ? projectData : window.projectData;
      const proj = loadProjectFor(id);
      if(store.getCurrentProjectId() !== String(target.id)) return false;
      try{ proj.meta = proj.meta || {}; proj.meta.assignedInvestorId = id; }catch(_){ }
      try{
        if(typeof projectData !== 'undefined') projectData = proj;
      }catch(_){ }
      window.projectData = proj;
      let policyResult;
      try{ policyResult = FC.projectPcvPolicy && FC.projectPcvPolicy.ensureProjectMode(); }catch(_){ }
      if(!policyResult || policyResult.ok !== true){
        // The investor wrapper restores its previous investor on refusal. Restore
        // the matching RAM/pointer too, so a retry cannot save target data as it.
        if(store.setCurrentProjectId(current && current.id || '') === false
          && FC.session && FC.session.markUnconfirmedProjectWrite) FC.session.markUnconfirmedProjectWrite();
        if(typeof projectData !== 'undefined') projectData = previousProject;
        window.projectData = previousProject;
        return false;
      }
      persistAsActiveProject(proj);
      refreshProjectUi();
      return true;
    }catch(_){ return false; }
  }

  function setActiveProjectFromInvestor(id, options){ return activateProjectFromInvestor(id, false, options); }

  function ensureInvestorProjectLoadedOnBoot(){
    if(bootLoaded) return;
    const id = repo && typeof repo.getCurrentInvestorId === 'function' ? repo.getCurrentInvestorId() : null;
    if(!id) return;
    if(FC.session && FC.session.canSwitchInvestor && !FC.session.canSwitchInvestor(id)) return;

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
      bootLoaded = activateProjectFromInvestor(id, true) === true;
      return;
    }

    const proj = normalizeProject(freshProject());
    try{ proj.meta = proj.meta || {}; proj.meta.assignedInvestorId = id; }catch(_){ }
    // Brak rekordu centralnego oznacza utworzenie nowego rekordu centralnego.
    // Istniejący legacy slot nie jest importowany automatycznie w zwykłym bootcie.
    writeProjectFor(id, proj);
    bootLoaded = activateProjectFromInvestor(id, true) === true;
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
    try{
      const store = FC.projectStore;
      const current = store && typeof store.getCurrentRecord === 'function' ? store.getCurrentRecord() : null;
      if(current && (!id || String(current.investorId || '') === String(id))) return current.projectData || null;
      if(id && store && typeof store.readAll === 'function'){
        const matches = store.readAll().filter(row=>String(row.investorId || '') === String(id));
        return matches.length === 1 ? matches[0].projectData : null;
      }
    }catch(_){ }
    return null;
  }

  function hasProjectDivergence(nextData){
    const central = currentCentralProjectForSessionCompare();
    // project-bridge.load() uses DEFAULT_PROJECT when there is no owner. Passing
    // null through the legacy migrations produces different defaults (e.g. a
    // 1.8 cm bathroom worktop instead of 2 cm) and invents an unsaved edit.
    // Only a strictly empty, unowned installation may use that default baseline.
    if(!central && !isEmptyUnownedContext()) return true;
    const before = comparableProjectData(central || freshProject());
    const next = comparableProjectData(nextData);
    let beforeRaw = null;
    let nextRaw = null;
    try{ beforeRaw = JSON.stringify(before); }catch(_){ beforeRaw = null; }
    try{ nextRaw = JSON.stringify(next); }catch(_){ nextRaw = null; }
    return beforeRaw !== nextRaw;
  }

  function isEmptyUnownedContext(transientId){
    try{
      const s = FC.session;
      if(!s || s.active || s.durable || s.snapshot || s.context || s.projectId || s.roomId
        || s.expectedOwnerKnown || s.expectedOwnerRaw !== null
        || s.startedAt || s.updatedAt || s.comparableKeys
        || (s.lastError && s.lastError.code !== 'SESSION_OWNER_MISSING')) return false;
      if(localStorage.getItem('fc_edit_session_v1') !== null) return false;
      for(const key of ['fc_projects_v1','fc_investors_v1']){
        const raw = localStorage.getItem(key);
        const rows = raw === null ? [] : JSON.parse(raw);
        if(!Array.isArray(rows) || rows.length !== 0) return false;
      }
      if(String(localStorage.getItem('fc_current_project_id_v1') || '').trim()
        || String(localStorage.getItem('fc_current_investor_v1') || '').trim()) return false;
      const uiRaw = localStorage.getItem('fc_ui_v1');
      const ui = uiRaw === null ? null : JSON.parse(uiRaw);
      if(uiRaw !== null && (!ui || typeof ui !== 'object' || Array.isArray(ui))) return false;
      if(ui && ui.currentInvestorId && ui.currentInvestorId !== transientId) return false;
      if(typeof uiState !== 'undefined' && uiState && uiState.currentInvestorId && uiState.currentInvestorId !== transientId) return false;
      // Legacy project evidence must not acquire a new default baseline.
      for(let i=0;i<localStorage.length;i++){
        const key = localStorage.key(i);
        if(key === 'fc_project_v1' || key === 'fc_project_backup_v1' || /^fc_project_inv_.+_v1$/.test(key || '')) return false;
      }
      return true;
    }catch(_){ return false; }
  }

  function prepareCreation(){
    try{
      if(FC.session?.active || localStorage.getItem('fc_edit_session_v1')!==null)return null;
      const data=typeof projectData!=='undefined'?projectData:window.projectData;
      if(hasProjectDivergence(data))return null;
      const token=Object.freeze({});
      creationActivations.set(token,{ram:JSON.stringify(comparableProjectData(data)),rows:FC.projectStore.readAll()});
      return token;
    }catch(_){return null;}
  }
  function consumeCreation(options,id,target,ram){
    const token=options?.creationActivation,proof=token && creationActivations.get(token);
    if(token)creationActivations.delete(token);
    if(!proof || proof.ram!==ram || FC.session?.active || localStorage.getItem('fc_edit_session_v1')!==null)return false;
    const rows=FC.projectStore.readAll();
    return rows.length===proof.rows.length+1 && proof.rows.every(old=>JSON.stringify(rows.find(r=>r.id===old.id))===JSON.stringify(old))
      && String(target.investorId)===String(id) && JSON.stringify(comparableProjectData(target.projectData))===JSON.stringify(comparableProjectData(options.expectedProject));
  }

  function prepareFirstProjectActivation(){
    try{
      const data = typeof projectData !== 'undefined' ? projectData : window.projectData;
      // The investor form may point at its own unsaved draft. It is not a
      // project owner; accept only the exact live transient form at this explicit
      // create checkpoint, never a stale or arbitrary UI owner ID.
      const ui = FC.investorUI;
      const draft = ui && ui.getTransientInvestor && ui.getTransientInvestor();
      const transientId = draft && ui.state && ui.state.selectedId === draft.id
        && ui.state.newlyCreatedId === draft.id ? draft.id : undefined;
      if(!isEmptyUnownedContext(transientId)
        || JSON.stringify(comparableProjectData(data)) !== JSON.stringify(comparableProjectData(freshProject()))) return null;
      const token = Object.freeze({});
      firstActivations.set(token, JSON.stringify(comparableProjectData(data)));
      return token;
    }catch(_){ return null; }
  }

  function consumeFirstActivation(options, id, target, ram){
    const token = options && options.firstActivation;
    const baseline = token && firstActivations.get(token);
    if(token) firstActivations.delete(token);
    if(!baseline || ram !== baseline || !options.expectedProject) return false;
    try{
      const s = FC.session;
      if(!s || s.active || s.durable || s.snapshot || s.context || s.projectId || s.roomId
        || s.expectedOwnerKnown || s.expectedOwnerRaw !== null || s.startedAt || s.updatedAt || s.comparableKeys
        || localStorage.getItem('fc_edit_session_v1') !== null) return false;
      const investors = JSON.parse(localStorage.getItem('fc_investors_v1'));
      const projects = JSON.parse(localStorage.getItem('fc_projects_v1'));
      if(!Array.isArray(investors) || investors.length !== 1 || String(investors[0].id) !== String(id)
        || !Array.isArray(projects) || projects.length !== 1 || String(projects[0].id) !== String(target.id)
        || String(projects[0].investorId) !== String(id)) return false;
      const expected = comparableProjectData(options.expectedProject);
      expected.meta = Object.assign({}, expected.meta, {productionPcvMode:'project'});
      return JSON.stringify(comparableProjectData(target.projectData)) === JSON.stringify(expected);
    }catch(_){ return false; }
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
    prepareFirstProjectActivation,
    prepareCreation,
    shouldTrackProjectSession,
  };
})();
