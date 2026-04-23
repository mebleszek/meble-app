(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const BASE_LABELS = {
    kuchnia:'Kuchnia',
    szafa:'Szafa',
    pokoj:'Pokój',
    lazienka:'Łazienka'
  };

  function clone(obj){
    try{ return (FC.utils && FC.utils.clone) ? FC.utils.clone(obj) : JSON.parse(JSON.stringify(obj)); }
    catch(_){ return JSON.parse(JSON.stringify(obj || {})); }
  }

  function getProject(){
    try{ if(typeof projectData !== 'undefined' && projectData) return projectData; }catch(_){ }
    try{ if(window.projectData) return window.projectData; }catch(_){ }
    return null;
  }

  function saveProject(proj, opts){
    const cfg = Object.assign({ suspendSessionTracking:true }, opts || {});
    try{
      if(typeof projectData !== 'undefined') projectData = proj;
      window.projectData = proj;
    }catch(_){ }
    try{
      if(FC.project && typeof FC.project.save === 'function'){
        const shouldSuspend = !!cfg.suspendSessionTracking;
        const previous = !!FC.project.__suspendSessionTracking;
        if(shouldSuspend) FC.project.__suspendSessionTracking = true;
        try{ FC.project.save(proj); }
        finally{ FC.project.__suspendSessionTracking = previous; }
      }
    }catch(_){ }
  }

  function getCurrentInvestor(){
    try{
      if(FC.investors && typeof FC.investors.getCurrentId === 'function' && typeof FC.investors.getById === 'function'){
        const id = FC.investors.getCurrentId();
        const investor = id ? FC.investors.getById(id) : null;
        if(investor) return investor;
      }
    }catch(_){ }
    try{
      if(FC.investorPersistence && typeof FC.investorPersistence.getCurrentInvestorId === 'function' && typeof FC.investorPersistence.getInvestorById === 'function'){
        const id = FC.investorPersistence.getCurrentInvestorId();
        const investor = id ? FC.investorPersistence.getInvestorById(id) : null;
        if(investor) return investor;
      }
    }catch(_){ }
    try{
      if(FC.uiState && typeof FC.uiState.get === 'function' && typeof FC.investorPersistence?.getInvestorById === 'function'){
        const state = FC.uiState.get() || {};
        const id = state.currentInvestorId ? String(state.currentInvestorId) : '';
        const investor = id ? FC.investorPersistence.getInvestorById(id) : null;
        if(investor) return investor;
      }
    }catch(_){ }
    try{
      if(FC.investorUI && FC.investorUI.state){
        const state = FC.investorUI.state;
        const transient = state.transientInvestor && typeof state.transientInvestor === 'object' ? state.transientInvestor : null;
        if(transient && transient.id) return transient;
        if(state.selectedId && FC.investorPersistence && typeof FC.investorPersistence.getInvestorById === 'function'){
          const investor = FC.investorPersistence.getInvestorById(String(state.selectedId || ''));
          if(investor) return investor;
        }
      }
    }catch(_){ }
    return null;
  }

  function ensureProjectMeta(proj){
    if(!proj || typeof proj !== 'object') return null;
    proj.meta = proj.meta || {};
    proj.meta.roomDefs = proj.meta.roomDefs || {};
    proj.meta.roomOrder = Array.isArray(proj.meta.roomOrder) ? proj.meta.roomOrder : [];
    return proj.meta;
  }

  function discoverProjectRoomKeys(proj){
    if(!proj || typeof proj !== 'object') return [];
    return Object.keys(proj).filter((key)=>{
      if(!key || key === 'schemaVersion' || key === 'meta') return false;
      const room = proj[key];
      return !!(room && typeof room === 'object' && (Array.isArray(room.cabinets) || Array.isArray(room.fronts) || Array.isArray(room.sets) || room.settings));
    });
  }

  function roomTemplate(baseType){
    const defs = (FC.project && FC.project.DEFAULT_PROJECT) || (FC.schema && FC.schema.DEFAULT_PROJECT) || {};
    return clone(defs[baseType] || defs.kuchnia || { cabinets:[], fronts:[], sets:[], settings:{} });
  }

  function hasCurrentInvestor(){
    return !!getCurrentInvestor();
  }

  FC.roomRegistryFoundation = {
    BASE_LABELS,
    clone,
    getProject,
    saveProject,
    getCurrentInvestor,
    ensureProjectMeta,
    discoverProjectRoomKeys,
    roomTemplate,
    hasCurrentInvestor,
  };
})();
