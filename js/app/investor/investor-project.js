// js/app/investor/investor-project.js
// Orkiestracja izolacji projektu per inwestor.
// Szczegóły odpowiedzialności są rozdzielone na:
//  - investor-project-repository.js: legacy sloty + projectStore boundary
//  - investor-project-runtime.js: active project save/load + UI refresh
//  - investor-project-patches.js: patch public APIs
(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function init(){
    try{ if(FC.investorProjectPatches && typeof FC.investorProjectPatches.patchInvestorsAPI === 'function') FC.investorProjectPatches.patchInvestorsAPI(); }catch(_){ }
    try{ if(FC.investorProjectPatches && typeof FC.investorProjectPatches.patchProjectSave === 'function') FC.investorProjectPatches.patchProjectSave(); }catch(_){ }
    try{ if(FC.investorProjectRuntime && typeof FC.investorProjectRuntime.ensureInvestorProjectLoadedOnBoot === 'function') FC.investorProjectRuntime.ensureInvestorProjectLoadedOnBoot(); }catch(_){ }
  }

  FC.investorProject = Object.assign({}, FC.investorProject || {}, { init });

  try{ setTimeout(init, 0); }catch(_){ }
})();
