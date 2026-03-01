// js/app/investor-project.js
// Per-investor project isolation.
// Keeps a separate project snapshot (cabinets/rooms/material selections) for each investor.
// Implemented as:
//  - main working key: fc_project_v1 (what the rest of the app already uses)
//  - per investor slot: fc_project_inv_<INVESTOR_ID>_v1
// On investor switch we save current project into old slot and load the new slot into fc_project_v1.

(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const PREFIX = 'fc_project_inv_';
  const SUFFIX = '_v1';

  function invKey(id){ return id ? (PREFIX + String(id) + SUFFIX) : null; }

  function getCurrentInvestorId(){
    try{
      if(FC.investors && typeof FC.investors.getCurrentId === 'function') return FC.investors.getCurrentId();
    }catch(_){ }
    try{ return localStorage.getItem('fc_current_investor_v1') || null; }catch(_){ return null; }
  }

  function readProjectRawFor(id){
    const k = invKey(id);
    if(!k) return null;
    try{ return localStorage.getItem(k); }catch(_){ return null; }
  }

  function writeProjectFor(id, projectObj){
    const k = invKey(id);
    if(!k) return;
    try{ localStorage.setItem(k, JSON.stringify(projectObj)); }catch(_){ }
  }

  function normalizeProject(obj){
    try{
      if(FC.project && typeof FC.project.normalize === 'function') return FC.project.normalize(obj);
    }catch(_){ }
    return obj;
  }

  function freshProject(){
    try{
      if(FC.project && FC.project.DEFAULT_PROJECT) return FC.utils ? FC.utils.clone(FC.project.DEFAULT_PROJECT) : JSON.parse(JSON.stringify(FC.project.DEFAULT_PROJECT));
    }catch(_){ }
    return { schemaVersion: 1 };
  }

  function loadProjectFor(id){
    const raw = readProjectRawFor(id);
    if(raw){
      try{ return normalizeProject(JSON.parse(raw)); }catch(_){ }
    }
    return normalizeProject(freshProject());
  }

  function saveActiveProjectToInvestor(id){
    if(!id) return;
    try{
      if(typeof projectData !== 'undefined' && projectData){
        writeProjectFor(id, normalizeProject(projectData));
      }
    }catch(_){ }
  }

  function setActiveProjectFromInvestor(id){
    if(!id) return;
    try{
      const proj = loadProjectFor(id);
      // Ensure link for debugging/consistency
      try{ proj.meta = proj.meta || {}; proj.meta.assignedInvestorId = id; }catch(_){ }
      // Update global state used across the app
      if(typeof projectData !== 'undefined'){
        projectData = proj;
      }
      // Persist into main storage key so the rest of the app reads the right project.
      try{
        if(FC.project && typeof FC.project.save === 'function') FC.project.save(proj);
        else localStorage.setItem((FC.constants && FC.constants.STORAGE_KEYS && FC.constants.STORAGE_KEYS.projectData) || 'fc_project_v1', JSON.stringify(proj));
      }catch(_){ }

      // Re-normalize any derived fields in app.js if available
      try{ if(typeof normalizeProjectData === 'function') normalizeProjectData(); }catch(_){ }

      // Re-render
      try{ if(FC.views && typeof FC.views.applyFromState === 'function' && typeof uiState !== 'undefined') FC.views.applyFromState(uiState); }catch(_){ }
      try{ if(typeof render === 'function') render(); }catch(_){ }
      try{ if(FC.sections && typeof FC.sections.update === 'function') FC.sections.update(); }catch(_){ }
    }catch(_){ }
  }

  function ensureInvestorProjectLoadedOnBoot(){
    const id = getCurrentInvestorId();
    if(!id) return;
    // If we have a dedicated slot, load it into active project.
    const raw = readProjectRawFor(id);
    if(raw){
      setActiveProjectFromInvestor(id);
    } else {
      // First time for this investor: create a clean project slot.
      const proj = normalizeProject(freshProject());
      try{ proj.meta = proj.meta || {}; proj.meta.assignedInvestorId = id; }catch(_){ }
      writeProjectFor(id, proj);
      setActiveProjectFromInvestor(id);
    }
  }

  // ===== Patch investor switching to also switch project =====
  function patchInvestorsAPI(){
    if(!FC.investors) return;

    // Patch setCurrentId
    if(typeof FC.investors.setCurrentId === 'function' && !FC.investors.__patchedProject){
      const origSetCurrent = FC.investors.setCurrentId.bind(FC.investors);
      FC.investors.setCurrentId = function(id){
        const prev = getCurrentInvestorId();
        // Save current work into previous investor slot
        if(prev && prev !== id) saveActiveProjectToInvestor(prev);
        origSetCurrent(id);
        // Load new investor project
        if(id && prev !== id) setActiveProjectFromInvestor(id);
      };
      FC.investors.__patchedProject = true;
    }

    // Patch create (new investor should start with a clean project)
    if(typeof FC.investors.create === 'function' && !FC.investors.__patchedCreateProject){
      const origCreate = FC.investors.create.bind(FC.investors);
      FC.investors.create = function(initial){
        const prev = getCurrentInvestorId();
        if(prev) saveActiveProjectToInvestor(prev);
        const inv = origCreate(initial);
        if(inv && inv.id){
          const proj = normalizeProject(freshProject());
          try{ proj.meta = proj.meta || {}; proj.meta.assignedInvestorId = inv.id; }catch(_){ }
          writeProjectFor(inv.id, proj);
          setActiveProjectFromInvestor(inv.id);
        }
        return inv;
      };
      FC.investors.__patchedCreateProject = true;
    }
  }

  // ===== Mirror saves into investor slot =====
  function patchProjectSave(){
    if(!FC.project || typeof FC.project.save !== 'function' || FC.project.__patchedInvestorMirror) return;
    const origSave = FC.project.save.bind(FC.project);
    FC.project.save = function(data){
      const out = origSave(data);
      const id = getCurrentInvestorId();
      if(id) writeProjectFor(id, out);
      return out;
    };
    FC.project.__patchedInvestorMirror = true;
  }

  function init(){
    patchInvestorsAPI();
    patchProjectSave();
    ensureInvestorProjectLoadedOnBoot();
  }

  // Defer init until the rest (app.js) created global state.
  try{ setTimeout(init, 0); }catch(_){ }
})();
