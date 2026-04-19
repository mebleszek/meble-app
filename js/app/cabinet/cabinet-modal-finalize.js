(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});

  function getValidationApi(){ return (window.FC && window.FC.cabinetModalValidation) || {}; }
  function getSetWizardApi(){ return (window.FC && window.FC.cabinetModalSetWizard) || {}; }

  function syncDraftFromCabinetModalFormSafe(draft){
    const api = getValidationApi();
    if(api && typeof api.syncDraftFromCabinetModalFormSafe === 'function') return api.syncDraftFromCabinetModalFormSafe(draft);
    return draft;
  }
  function ensureFrontCountRulesSafe(cab){
    const api = getValidationApi();
    if(api && typeof api.ensureFrontCountRulesSafe === 'function') return api.ensureFrontCountRulesSafe(cab);
    return cab;
  }
  function validateAventosForDraftSafe(room, draft){
    const api = getValidationApi();
    if(api && typeof api.validateAventosForDraftSafe === 'function') return api.validateAventosForDraftSafe(room, draft);
    return null;
  }
  function applyAventosValidationUISafe(room, draft){
    const api = getValidationApi();
    if(api && typeof api.applyAventosValidationUISafe === 'function') return api.applyAventosValidationUISafe(room, draft);
    return null;
  }

  function cloneSafe(value){
    try{
      if(ns.utils && typeof ns.utils.clone === 'function') return ns.utils.clone(value);
    }catch(_){ }
    try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; }
  }

  function persistProjectAndUi(){
    if(ns.project && typeof ns.project.save === 'function') projectData = ns.project.save(projectData);
    if(ns.storage && typeof ns.storage.setJSON === 'function' && typeof STORAGE_KEYS !== 'undefined' && STORAGE_KEYS && STORAGE_KEYS.ui){
      ns.storage.setJSON(STORAGE_KEYS.ui, uiState);
    }
    return projectData;
  }

  function finalizeAddedCabinet(room, draft){
    const newCab = cloneSafe(draft);
    newCab.id = (ns.utils && typeof ns.utils.uid === 'function') ? ns.utils.uid() : ('cab_' + Date.now());
    projectData[room].cabinets.push(newCab);

    uiState.expanded = {};
    uiState.expanded[String(newCab.id)] = true;
    uiState.selectedCabinetId = newCab.id;
    uiState.lastAddedAt = Date.now();
    uiState.lastAddedCabinetId = String(newCab.id);
    uiState.lastAddedCabinetType = String(newCab.type || '');

    if(typeof generateFrontsForCabinet === 'function') generateFrontsForCabinet(room, newCab);
    return newCab;
  }

  function finalizeEditedCabinet(room, draft, editingId){
    const id = String(editingId || '');
    projectData[room].cabinets = projectData[room].cabinets.map(function(cab){
      return String(cab && cab.id || '') === id ? Object.assign({}, cloneSafe(draft), { id:id }) : cab;
    });
    const updated = projectData[room].cabinets.find(function(cab){ return String(cab && cab.id || '') === id; });
    if(updated && typeof generateFrontsForCabinet === 'function') generateFrontsForCabinet(room, updated);
    return updated;
  }

  function isAddMode(){
    return !!(cabinetModalState && (cabinetModalState.mode === 'add' || !cabinetModalState.editingId));
  }

  function saveRegularCabinetDraft(ctx){
    const showInfo = ctx && ctx.showCabinetInfo;
    const renderCabinetsFn = ctx && ctx.renderCabinets;
    const closeFn = ctx && ctx.closeCabinetModal;
    const draft = ctx && ctx.draft;

    try{
      if(!uiState || !uiState.roomType){
        if(typeof showInfo === 'function') showInfo('Brak pomieszczenia', 'Wybierz pomieszczenie.');
        return false;
      }
      const room = uiState.roomType;
      projectData[room] = projectData[room] || { cabinets:[], fronts:[], sets:[], settings:{} };
      projectData[room].cabinets = Array.isArray(projectData[room].cabinets) ? projectData[room].cabinets : [];

      syncDraftFromCabinetModalFormSafe(draft);
      ensureFrontCountRulesSafe(draft);

      const aventos = validateAventosForDraftSafe(room, draft);
      if(aventos && aventos.ok === false){
        applyAventosValidationUISafe(room, draft);
        return false;
      }

      const beforeCount = (projectData[room].cabinets || []).length;
      if(isAddMode()) finalizeAddedCabinet(room, draft);
      else finalizeEditedCabinet(room, draft, cabinetModalState && cabinetModalState.editingId);

      persistProjectAndUi();
      if(typeof renderCabinetsFn === 'function') renderCabinetsFn();

      const afterCount = (projectData[room].cabinets || []).length;
      if(isAddMode() && afterCount <= beforeCount){
        if(typeof showInfo === 'function') showInfo('Nie udało się dodać szafki', 'Wystąpił błąd logiki zapisu.');
        return false;
      }

      if(typeof closeFn === 'function') closeFn();
      return true;
    }catch(err){
      try{ console.error('Błąd zapisu szafki:', err); }catch(_){ }
      if(typeof showInfo === 'function') showInfo('Błąd podczas zapisu', 'Sprawdź konsolę. Modal pozostaje otwarty.');
      return false;
    }
  }

  function handleTopSaveClick(e, ctx){
    if(e){
      try{ e.preventDefault(); }catch(_){ }
      try{ e.stopPropagation(); }catch(_){ }
    }

    try{
      const setApi = getSetWizardApi();
      const inSetMode = !!(setApi && typeof setApi.isSetModeActive === 'function' && setApi.isSetModeActive());
      if(inSetMode){
        if(setApi && typeof setApi.handleTopSaveClick === 'function') return setApi.handleTopSaveClick(e);
        return true;
      }
      return saveRegularCabinetDraft(ctx);
    } finally {
      try{ if(e && e.target && typeof e.target.blur === 'function') e.target.blur(); }catch(_){ }
    }
  }

  function bindTopSaveButton(ctx){
    const btn = document.getElementById('cabinetModalSave');
    if(!btn) return null;
    btn.onclick = function(e){ return handleTopSaveClick(e, ctx || {}); };
    return btn;
  }

  ns.cabinetModalFinalize = {
    persistProjectAndUi,
    finalizeAddedCabinet,
    finalizeEditedCabinet,
    isAddMode,
    saveRegularCabinetDraft,
    handleTopSaveClick,
    bindTopSaveButton,
  };
})();
