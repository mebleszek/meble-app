// js/app/investor/investor-project-patches.js
// Patching public APIs: inwestor switch/create/remove + mirror zapisów projektu.
(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function repo(){ return FC.investorProjectRepository || {}; }
  function runtime(){ return FC.investorProjectRuntime || {}; }

  function patchInvestorsAPI(){
    if(!FC.investors) return;

    if(typeof FC.investors.setCurrentId === 'function' && !FC.investors.__patchedProject){
      const origSetCurrent = FC.investors.setCurrentId.bind(FC.investors);
      FC.investors.setCurrentId = function(id){
        const prev = repo().getCurrentInvestorId && repo().getCurrentInvestorId();
        if(FC.session && FC.session.canSwitchInvestor && !FC.session.canSwitchInvestor(id)) return prev || null;
        // Switching context never implicitly saves RAM. The navigation gate owns Save/Cancel.
        if(prev !== id && runtime().hasProjectDivergence && runtime().hasProjectDivergence(window.projectData)) return prev || null;
        try{ origSetCurrent(id); }catch(_){ return prev || null; }
        if(String(FC.investors.getCurrentId() || '') !== String(id || '')) return prev || null;
        if(id && prev !== id && runtime().setActiveProjectFromInvestor
          && runtime().setActiveProjectFromInvestor(id) === false){
          try{ origSetCurrent(prev || null); }catch(_){ }
          return prev || null;
        }
        return id || null;
      };
      FC.investors.__patchedProject = true;
    }

    if(typeof FC.investors.create === 'function' && !FC.investors.__patchedCreateProject){
      const origCreate = FC.investors.create.bind(FC.investors);
      FC.investors.create = function(initial){
        if(FC.session && FC.session.canSwitchInvestor && !FC.session.canSwitchInvestor('')) return null;
        const prev = repo().getCurrentInvestorId && repo().getCurrentInvestorId();
        const firstActivation = runtime().prepareFirstProjectActivation ? runtime().prepareFirstProjectActivation() : null;
        const creationActivation=runtime().prepareCreation && runtime().prepareCreation();
        if(!creationActivation && !firstActivation)return null;
        const inv = origCreate(initial);
        if(inv && inv.id){
          const proj = runtime().freshProject ? runtime().normalizeProject(runtime().freshProject()) : { schemaVersion:1 };
          try{ proj.meta = proj.meta || {}; proj.meta.assignedInvestorId = inv.id; proj.meta.productionPcvMode = 'project'; }catch(_){ }
          if(runtime().writeProjectFor) runtime().writeProjectFor(inv.id, proj);
          try{ if(repo().ensureCentralProjectForInvestor) repo().ensureCentralProjectForInvestor(inv.id, { projectData:proj, title:'' }); }catch(_){ }
          if(runtime().setActiveProjectFromInvestor) runtime().setActiveProjectFromInvestor(inv.id, {firstActivation, creationActivation, expectedProject:proj});
        }
        return inv;
      };
      FC.investors.__patchedCreateProject = true;
    }

    if(typeof FC.investors.remove === 'function' && !FC.investors.__patchedRemoveProject){
      const origRemove = FC.investors.remove.bind(FC.investors);
      FC.investors.remove = function(id){
        if(FC.projectStore && FC.projectStore.readAll().some(row=>String(row.investorId) === String(id) && row.meta && row.meta.pendingDomainOperation)) return false;
        if(FC.session && FC.session.active && FC.session.canSwitchInvestor && !FC.session.canSwitchInvestor('')) return false;
        try{ if(repo().removeCentralProjectByInvestor) repo().removeCentralProjectByInvestor(id); }catch(_){ }
        try{ if(repo().removeLegacySlot) repo().removeLegacySlot(id); }catch(_){ }
        return origRemove(id);
      };
      FC.investors.__patchedRemoveProject = true;
    }
  }

  function patchProjectSave(){
    if(!FC.project || typeof FC.project.save !== 'function' || FC.project.__patchedInvestorMirror) return;
    const origSave = FC.project.save.bind(FC.project);
    FC.project.save = function(data){
      const shouldBeginSession = runtime().shouldTrackProjectSession ? runtime().shouldTrackProjectSession(data) : false;
      const session = FC.session;
      if(shouldBeginSession || (session && session.active && session.durable !== true)){
        let ready = false;
        try{ ready = !!(session && typeof session.begin === 'function' && session.begin() === true); }catch(_){ }
        if(!ready){
          if(runtime().refreshSessionButtons) runtime().refreshSessionButtons();
          return data;
        }
      }
      if(session && session.canSaveProject && !session.canSaveProject()) return data;
      const out = origSave(data);
      if(runtime().refreshSessionButtons) runtime().refreshSessionButtons();
      return out;
    };
    FC.project.__patchedInvestorMirror = true;
  }

  FC.investorProjectPatches = {
    patchInvestorsAPI,
    patchProjectSave,
  };
})();
