(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});

  function getValidationApi(){ return (window.FC && window.FC.cabinetModalValidation) || {}; }
  function getSetWizardApi(){ return (window.FC && window.FC.cabinetModalSetWizard) || {}; }
  function validateBottomColor(room,draft,showInfo){
    const back=ns.cabinetCutlist?.backGeometry?.(draft,room);
    if(back?.code==='BACK_POSITION_REQUIRED'){
      if(typeof showInfo==='function')showInfo('Wybierz montaż pleców','Plecy 18 mm wymagają wyboru: wewnętrzne albo zewnętrzne.');
      return false;
    }
    const drawers=ns.cabinetDrawerRequirements;
    if(drawers?.needsBottomColor(room,draft)&&!drawers.bottomMaterial(draft)){
      if(typeof showInfo==='function')showInfo('Wybierz kolor płyt szuflad','Dno i tył szuflady systemowej 16 mm oraz dno skrzynkowej 10 mm muszą mieć wybrany kolor: biały albo szary.');
      return false;
    }
    if(ns.cabinetInnerDrawers&&!ns.cabinetInnerDrawers.validate(room,draft,showInfo))return false;
    return true;
  }

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
  function cleanDrawerTrashSafe(cab){
    try{
      const api = ns.cabinetDrawerRequirements;
      if(api && typeof api.cleanDrawerTrash === 'function') api.cleanDrawerTrash(cab);
    }catch(_){ }
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
    const previousError = ns.storage?.getLastWriteError?.();
    const roomId = uiState.roomType, room = projectData[roomId];
    let next = projectData;
    if(Array.isArray(room?.drawing2d?.placements)){
      const ids = new Set(room.cabinets.map(cabinet=>cabinet.id));
      const placements = room.drawing2d.placements.filter(placement=>ids.has(placement.cabinetId));
      if(placements.length!==room.drawing2d.placements.length){
        next = {...projectData,[roomId]:{...room,drawing2d:{...room.drawing2d,placements}}};
      }
    }
    const saved = ns.project.saveConfirmed(next,{draft:!!ns.applicationWrite});
    if(!saved.ok){
      const failure = ns.storage?.getLastWriteError?.();
      if(failure !== previousError && failure?.error) throw failure.error;
      throw Object.assign(Error('Zapis projektu niepotwierdzony'), {code:saved.code || 'LF_APPLICATION_SAVE_UNCONFIRMED'});
    }
    projectData = saved.project;
    if(ns.storage && typeof ns.storage.setJSON === 'function' && typeof STORAGE_KEYS !== 'undefined' && STORAGE_KEYS && STORAGE_KEYS.ui){
      if(!ns.storage.setJSON(STORAGE_KEYS.ui, uiState)) throw ns.storage.getLastWriteError?.()?.error || Error('LF_APPLICATION_SAVE_UNCONFIRMED');
    }
    return projectData;
  }

  function beginCabinetDraft(){
    if(ns.session?.begin() === true) return true;
    if(ns.applicationWrite && ns.session?.lastError?.code){
      throw Object.assign(Error('Sesja edycji niepotwierdzona'), {code:ns.session.lastError.code});
    }
    return false;
  }

  function refreshDerivedFactsSafe(room, cabinet){
    try{
      const api = ns.cabinetDerivedFacts || null;
      if(api && typeof api.ensureCabinetFacts === 'function') api.ensureCabinetFacts(room, cabinet, { recalculate:true });
    }catch(_){ }
    return cabinet;
  }

  function finalizeAddedCabinet(room, draft){
    cleanDrawerTrashSafe(draft);
    const newCab = cloneSafe(draft);
    cleanDrawerTrashSafe(newCab);
    newCab.id = (ns.utils && typeof ns.utils.uid === 'function') ? ns.utils.uid() : ('cab_' + Date.now());
    projectData[room].cabinets.push(newCab);

    uiState.expanded = {};
    uiState.expanded[String(newCab.id)] = true;
    uiState.selectedCabinetId = newCab.id;
    uiState.lastAddedAt = Date.now();
    uiState.lastAddedCabinetId = String(newCab.id);
    uiState.lastAddedCabinetType = String(newCab.type || '');

    if(typeof generateFrontsForCabinet === 'function') generateFrontsForCabinet(room, newCab);
    refreshDerivedFactsSafe(room, newCab);
    return newCab;
  }

  function finalizeEditedCabinet(room, draft, editingId){
    const id = String(editingId || '');
    projectData[room].cabinets = projectData[room].cabinets.map(function(cab){
      if(String(cab && cab.id || '') !== id) return cab;
      const next = Object.assign({}, cloneSafe(draft), { id:id });
      cleanDrawerTrashSafe(next);
      return next;
    });
    const updated = projectData[room].cabinets.find(function(cab){ return String(cab && cab.id || '') === id; });
    if(updated && typeof generateFrontsForCabinet === 'function') generateFrontsForCabinet(room, updated);
    if(updated) refreshDerivedFactsSafe(room, updated);
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

      syncDraftFromCabinetModalFormSafe(draft);
      const draftApi = ns.cabinetModalDraft;
      if(!isAddMode() && draftApi && typeof draftApi.isEditDirty === 'function' && !draftApi.isEditDirty()) return false;
      ensureFrontCountRulesSafe(draft);
      cleanDrawerTrashSafe(draft);

      if((draft.type==='stojąca'||draft.type==='moduł') && draft.subType==='szuflady'){
        const geometry=ns.cabinetCutlist.resolveDrawerFrontGeometry(draft,room);
        if(!geometry.ok){
          if(typeof showInfo==='function') showInfo('Nieprawidłowe fronty szuflad',geometry.message);
          return false;
        }
      }

      const aventos = validateAventosForDraftSafe(room, draft);
      if(aventos && aventos.ok === false){
        applyAventosValidationUISafe(room, draft);
        return false;
      }
      if(!validateBottomColor(room,draft,showInfo))return false;
      for(const group of ns.cabinetDrawerSelection?.capacityGroups(room,draft)||[]){
        if(group.forced)draft.details={...draft.details,[group.key]:group.options[0]};
      }

      if(!beginCabinetDraft()) return false;
      projectData[room] = projectData[room] || { cabinets:[], fronts:[], sets:[], settings:{} };
      projectData[room].cabinets = Array.isArray(projectData[room].cabinets) ? projectData[room].cabinets : [];

      const beforeCount = (projectData[room].cabinets || []).length;
      if(isAddMode()) finalizeAddedCabinet(room, draft);
      else if(!finalizeEditedCabinet(room, draft, cabinetModalState && cabinetModalState.editingId)) return false;

      persistProjectAndUi();

      const afterCount = (projectData[room].cabinets || []).length;
      if(isAddMode() && afterCount <= beforeCount){
        if(typeof showInfo === 'function') showInfo('Nie udało się dodać szafki', 'Wystąpił błąd logiki zapisu.');
        return false;
      }

      const complete = ()=>{
        ns.views?.refreshSessionButtons?.();
        if(typeof renderCabinetsFn === 'function') renderCabinetsFn();
        if(typeof closeFn === 'function') closeFn();
      };
      if(ns.applicationWrite) ns.applicationWrite.afterCommit(complete);
      else complete();
      return true;
    }catch(err){
      if(ns.applicationWrite) throw err;
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
        return setApi.saveSetDraft();
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
    const save = function(e){ return handleTopSaveClick(e, ctx || {}); };
    btn.onclick = async function(e){
      e.preventDefault();
      e.stopPropagation();
      if(btn.disabled) return false;
      const cancel = document.getElementById('cabinetModalCancel');
      const cancelDisabled = cancel?.disabled;
      btn.disabled = true;
      if(cancel) cancel.disabled = true;
      try{
        if(getSetWizardApi().isSetModeActive?.()){
          const spec=ns.cabinetModalSetMaterials?.getSpec?.();
          if(spec?.backMaterial==='18 mm pod kolor korpusu'&&!['internal','external'].includes(spec.backPosition)){ctx.showCabinetInfo?.('Wybierz montaż pleców','Plecy 18 mm wymagają wyboru: wewnętrzne albo zewnętrzne.');return false;}
        }else if(ctx?.draft){
          syncDraftFromCabinetModalFormSafe(ctx.draft);
          if(!validateBottomColor(uiState.roomType,ctx.draft,ctx.showCabinetInfo))return false;
        }
        return await (ns.applicationWrite ? ns.applicationWrite.draftHandler(save)(e) : save(e));
      }finally{
        btn.disabled = false;
        if(cancel) cancel.disabled = cancelDisabled;
      }
    };
    return btn;
  }

  ns.cabinetModalFinalize = {
    persistProjectAndUi,
    beginCabinetDraft,
    refreshDerivedFactsSafe,
    finalizeAddedCabinet,
    finalizeEditedCabinet,
    isAddMode,
    saveRegularCabinetDraft,
    handleTopSaveClick,
    bindTopSaveButton,
  };
})();
