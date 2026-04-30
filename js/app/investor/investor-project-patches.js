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
        if(prev && prev !== id && runtime().saveActiveProjectToInvestor) runtime().saveActiveProjectToInvestor(prev);
        origSetCurrent(id);
        if(id && prev !== id && runtime().setActiveProjectFromInvestor) runtime().setActiveProjectFromInvestor(id);
      };
      FC.investors.__patchedProject = true;
    }

    if(typeof FC.investors.create === 'function' && !FC.investors.__patchedCreateProject){
      const origCreate = FC.investors.create.bind(FC.investors);
      FC.investors.create = function(initial){
        const prev = repo().getCurrentInvestorId && repo().getCurrentInvestorId();
        if(prev && runtime().saveActiveProjectToInvestor) runtime().saveActiveProjectToInvestor(prev);
        const inv = origCreate(initial);
        if(inv && inv.id){
          const proj = runtime().freshProject ? runtime().normalizeProject(runtime().freshProject()) : { schemaVersion:1 };
          try{ proj.meta = proj.meta || {}; proj.meta.assignedInvestorId = inv.id; }catch(_){ }
          if(runtime().writeProjectFor) runtime().writeProjectFor(inv.id, proj);
          try{ if(repo().ensureCentralProjectForInvestor) repo().ensureCentralProjectForInvestor(inv.id, { projectData:proj, title:'' }); }catch(_){ }
          if(runtime().setActiveProjectFromInvestor) runtime().setActiveProjectFromInvestor(inv.id);
        }
        return inv;
      };
      FC.investors.__patchedCreateProject = true;
    }

    if(typeof FC.investors.remove === 'function' && !FC.investors.__patchedRemoveProject){
      const origRemove = FC.investors.remove.bind(FC.investors);
      FC.investors.remove = function(id){
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
      if(shouldBeginSession){
        try{ FC.session && typeof FC.session.begin === 'function' && FC.session.begin(); }catch(_){ }
      }
      const out = origSave(data);
      const id = repo().getCurrentInvestorId && repo().getCurrentInvestorId();
      if(id && runtime().writeProjectFor) runtime().writeProjectFor(id, out);
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
