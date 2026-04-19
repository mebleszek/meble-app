(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});

  function callCabinetFrontsHelper(fnName, args, fallback){
    try{
      const mod = window.FC && window.FC.cabinetFronts;
      const impl = mod && mod[fnName];
      if(typeof impl === 'function') return impl.apply(null, args || []);
    }catch(_){ }
    try{
      const globalImpl = window && window[fnName];
      if(typeof globalImpl === 'function') return globalImpl.apply(null, args || []);
    }catch(_){ }
    if(typeof fallback === 'function') return fallback.apply(null, args || []);
    throw new Error('Brak helpera cabinetFronts: ' + fnName);
  }

  function callCalcHelper(fnName, args, fallback){
    try{
      const mod = window.FC && window.FC.calc;
      const impl = mod && mod[fnName];
      if(typeof impl === 'function') return impl.apply(null, args || []);
    }catch(_){ }
    try{
      const globalImpl = window && window[fnName];
      if(typeof globalImpl === 'function') return globalImpl.apply(null, args || []);
    }catch(_){ }
    if(typeof fallback === 'function') return fallback.apply(null, args || []);
    throw new Error('Brak helpera calc: ' + fnName);
  }

  function calcTopForSetSafe(room, blende, sumLowerHeights){
    return callCalcHelper('calcTopForSet', [projectData, room, blende, sumLowerHeights], function(pd, rm, bl, sumLower){
      try{
        const s = pd && pd[rm] && pd[rm].settings ? pd[rm].settings : {};
        const h = (Number(s.roomHeight)||0) - (Number(sumLower)||0) - (Number(bl)||0);
        return h > 0 ? Math.round(h * 10) / 10 : 0;
      }catch(_){ return 0; }
    });
  }

  function getSubTypeOptionsForTypeSafe(typeVal){
    return callCabinetFrontsHelper('getSubTypeOptionsForType', [typeVal], function(){
      return [{ v:'standardowa', t:'Standardowa' }];
    });
  }

  function applyTypeRulesSafe(room, updated, typeVal){
    return callCabinetFrontsHelper('applyTypeRules', [room, updated, typeVal], function(){
      updated.type = typeVal;
      return updated;
    });
  }

  function applySubTypeRulesSafe(room, updated, subTypeVal){
    return callCabinetFrontsHelper('applySubTypeRules', [room, updated, subTypeVal], function(){
      updated.subType = subTypeVal;
      return updated;
    });
  }

  function ensureFrontCountRulesSafe(cab){
    return callCabinetFrontsHelper('ensureFrontCountRules', [cab], function(){ return cab; });
  }

  function cabinetAllowsFrontCountSafe(cab){
    return callCabinetFrontsHelper('cabinetAllowsFrontCount', [cab], function(){ return true; });
  }

  function getFlapFrontCountSafe(cab){
    return callCabinetFrontsHelper('getFlapFrontCount', [cab], function(){ return Number(cab && cab.frontCount) || 0; });
  }

  function syncDraftFromCabinetModalFormSafe(draft){
    return callCabinetFrontsHelper('syncDraftFromCabinetModalForm', [draft], function(){ return draft; });
  }

  function validateAventosForDraftSafe(room, draft){
    return callCabinetFrontsHelper('validateAventosForDraft', [room, draft], function(){ return null; });
  }

  function applyAventosValidationUISafe(room, draft){
    return callCabinetFrontsHelper('applyAventosValidationUI', [room, draft], function(){ return null; });
  }

  function addFrontSafe(room, front){
    return callCabinetFrontsHelper('addFront', [room, front], function(){
      projectData[room].fronts = projectData[room].fronts || [];
      projectData[room].fronts.push(front);
      return front;
    });
  }

  function removeFrontsForSetSafe(room, setId){
    return callCabinetFrontsHelper('removeFrontsForSet', [room, setId], function(){
      projectData[room].fronts = (projectData[room].fronts || []).filter(function(front){ return String(front && front.setId) !== String(setId); });
    });
  }

  function normalizeLegacySubType(value){
    const raw = String(value || '');
    return raw === 'szufladowa' ? 'szuflady' : raw;
  }

  ns.cabinetModalValidation = {
    callCabinetFrontsHelper,
    callCalcHelper,
    calcTopForSetSafe,
    getSubTypeOptionsForTypeSafe,
    applyTypeRulesSafe,
    applySubTypeRulesSafe,
    ensureFrontCountRulesSafe,
    cabinetAllowsFrontCountSafe,
    getFlapFrontCountSafe,
    syncDraftFromCabinetModalFormSafe,
    validateAventosForDraftSafe,
    applyAventosValidationUISafe,
    addFrontSafe,
    removeFrontsForSetSafe,
    normalizeLegacySubType,
  };
})();
