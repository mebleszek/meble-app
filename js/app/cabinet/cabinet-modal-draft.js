(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});

  function cloneSafe(value){
    try{
      if(ns.utils && typeof ns.utils.clone === 'function') return ns.utils.clone(value);
    }catch(_){ }
    try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; }
  }

  function getRoomCabinets(room){
    try{
      const data = projectData && projectData[room];
      return Array.isArray(data && data.cabinets) ? data.cabinets : [];
    }catch(_){ return []; }
  }

  function getBaseLaminat(){
    try{
      const list = Array.isArray(materials) ? materials : [];
      return (list.find(function(m){ return m && m.materialType === 'laminat'; }) || {}).name || '';
    }catch(_){ return ''; }
  }

  function sanitizeClonedCabinet(cab){
    const cloned = cloneSafe(cab || {});
    cloned.id = null;
    delete cloned.setId;
    delete cloned.setPreset;
    delete cloned.setRole;
    delete cloned.setName;
    delete cloned.setNumber;
    try{
      if(ns.cabinetDrawerRequirements && typeof ns.cabinetDrawerRequirements.cleanDrawerTrash === 'function'){
        ns.cabinetDrawerRequirements.cleanDrawerTrash(cloned);
      }
    }catch(_){ }
    return cloned;
  }

  function findLastCabinet(room, typeValue){
    const arr = getRoomCabinets(room);
    const desired = String(typeValue || '');
    for(let i = arr.length - 1; i >= 0; i -= 1){
      const cab = arr[i];
      if(!cab) continue;
      if(desired && String(cab.type || '') !== desired) continue;
      return cab;
    }
    return null;
  }

  function getRoomSettings(room){
    try{
      return (projectData && projectData[room] && projectData[room].settings) || {};
    }catch(_){ return {}; }
  }

  function getDefaultTypeForRoom(room){ return room === 'kuchnia' ? 'stojąca' : 'moduł'; }

  function applyCurrentDefaultsToDraft(room, draft, typeValue){
    const target = draft && typeof draft === 'object' ? draft : {};
    const type = String(typeValue || target.type || getDefaultTypeForRoom(room));
    try{
      if(ns.roomPreferences && typeof ns.roomPreferences.applyZoneDefaultsToDraft === 'function'){
        ns.roomPreferences.applyZoneDefaultsToDraft(room, target, type);
        return target;
      }
      if(ns.programDefaults && typeof ns.programDefaults.applyMaterialsToDraft === 'function'){
        ns.programDefaults.applyMaterialsToDraft(target);
      }
      if(ns.roomPreferences && typeof ns.roomPreferences.applyPreferencesToDraft === 'function'){
        ns.roomPreferences.applyPreferencesToDraft(room, target);
      }
    }catch(_){ }
    return target;
  }

  function buildFreshDraft(room, typeValue){
    const settings = getRoomSettings(room);
    const baseLaminat = getBaseLaminat();
    const type = String(typeValue || getDefaultTypeForRoom(room));
    const draft = {
      id: null,
      width: 60,
      height: room === 'kuchnia' ? settings.bottomHeight : 200,
      depth: room === 'kuchnia' ? 51 : 60,
      type,
      subType: 'standardowa',
      bodyColor: baseLaminat,
      frontMaterial: 'laminat',
      frontColor: baseLaminat,
      openingSystem: 'uchwyt klienta',
      backMaterial: 'HDF 3mm biała',
      bodyPcvMode: 'body',
      frontCount: 2,
      details: { insideMode: 'polki', shelves: 1, cornerOption: 'polki', dishWasherWidth: '60', ovenOption: 'szuflada_dol', ovenHeight: '60', sinkOption: 'zwykle_drzwi', fridgeOption: 'zabudowa', fridgeWidth: '60', subTypeOption: 'polki', fridgeFrontCount: '2' }
    };

    try{
      if(ns.cabinetFronts && typeof ns.cabinetFronts.applyTypeRules === 'function'){
        ns.cabinetFronts.applyTypeRules(room, draft, type);
      }
    }catch(_){ draft.type = type; }

    applyCurrentDefaultsToDraft(room, draft, type);
    try{
      if(ns.cabinetDrawerRequirements && typeof ns.cabinetDrawerRequirements.cleanDrawerTrash === 'function'){
        ns.cabinetDrawerRequirements.cleanDrawerTrash(draft);
      }
    }catch(_){ }
    return draft;
  }

  function makeDefaultCabinetDraftForType(room, typeValue){
    const type = String(typeValue || getDefaultTypeForRoom(room));
    if(type && type !== 'zestaw'){
      const lastSameType = findLastCabinet(room, type);
      if(lastSameType){
        const cloned = sanitizeClonedCabinet(lastSameType);
        return applyCurrentDefaultsToDraft(room, cloned, type);
      }
    }
    return buildFreshDraft(room, type === 'zestaw' ? getDefaultTypeForRoom(room) : type);
  }

  function makeDefaultCabinetDraftForRoom(room){
    const last = findLastCabinet(room, '');
    if(last){
      const cloned = sanitizeClonedCabinet(last);
      return applyCurrentDefaultsToDraft(room, cloned, cloned.type || getDefaultTypeForRoom(room));
    }
    return makeDefaultCabinetDraftForType(room, getDefaultTypeForRoom(room));
  }

  function beginAddState(room){
    cabinetModalState.mode = 'add';
    cabinetModalState.editingId = null;
    cabinetModalState.setEditId = null;
    cabinetModalState.chosen = null;
    cabinetModalState.setPreset = null;
    cabinetModalState.draft = makeDefaultCabinetDraftForRoom(room);
    cabinetModalState.initialDraft = null;
    cabinetModalState.initialComparableDraft = null;
    try{ cabinetModalState.chosen = cabinetModalState.draft && cabinetModalState.draft.type ? cabinetModalState.draft.type : null; }catch(_){ }
    return cabinetModalState;
  }

  function beginEditState(cabId, cab){
    cabinetModalState.mode = 'edit';
    cabinetModalState.editingId = String(cabId);
    cabinetModalState.setEditId = null;
    cabinetModalState.chosen = cab && cab.type ? cab.type : null;
    cabinetModalState.setPreset = null;
    cabinetModalState.draft = cloneSafe(cab);
    cabinetModalState.initialDraft = cloneSafe(cab);
    cabinetModalState.initialComparableDraft = null;
    return cabinetModalState;
  }

  function beginSetEditState(setId, set){
    cabinetModalState.mode = 'add';
    cabinetModalState.editingId = null;
    cabinetModalState.setEditId = String(setId);
    cabinetModalState.chosen = 'zestaw';
    cabinetModalState.setPreset = set && set.presetId ? set.presetId : null;
    cabinetModalState.draft = null;
    cabinetModalState.initialDraft = null;
    cabinetModalState.initialComparableDraft = null;
    return cabinetModalState;
  }

  function comparableCabinetDraft(value){
    const copy = cloneSafe(value || {});
    if(copy === value) throw new Error('Nie można sklonować draftu szafki');
    delete copy.derivedFacts;
    delete copy._derivedFacts;
    const drawerApi = ns.cabinetDrawerRequirements;
    if(drawerApi && typeof drawerApi.cleanDrawerTrash === 'function') drawerApi.cleanDrawerTrash(copy);
    const numericFields = new Set(['width','height','depth','frontCount','shelves','legHeightCm','blindPart','ovenHeight',
      'dishWasherWidth','fridgeWidth','fridgeNicheHeight','innerDrawerCount','sinkExtraCount','techShelfCount',
      'techDividerCount','podInnerDrawerCount','gl','gp','st','sp']);
    function canonical(data, key){
      if(Array.isArray(data)) return data.map(function(item){ return canonical(item, ''); });
      if(data && typeof data === 'object'){
        return Object.fromEntries(Object.keys(data).sort().filter(function(k){
          return k !== 'derivedFacts' && k !== '_derivedFacts' && typeof data[k] !== 'undefined';
        }).map(function(k){ return [k, canonical(data[k], k)]; }));
      }
      if(numericFields.has(key) && typeof data === 'string' && data.trim()){
        const number = Number(data.trim().replace(',', '.'));
        if(Number.isFinite(number)) return number;
      }
      return data;
    }
    return canonical(copy, '');
  }

  function syncLocalDraft(){
    const api = ns.cabinetModalValidation;
    if(api && typeof api.syncDraftFromCabinetModalFormSafe === 'function'){
      api.syncDraftFromCabinetModalFormSafe(cabinetModalState.draft);
    }
  }

  function captureEditBaseline(){
    if(cabinetModalState.mode !== 'edit' || !cabinetModalState.initialDraft || cabinetModalState.initialComparableDraft) return;
    syncLocalDraft();
    // Capture the first rendered form's equivalent defaults once. Keep the original clone untouched.
    cabinetModalState.initialComparableDraft = comparableCabinetDraft(cabinetModalState.draft);
  }

  function isEditDirty(){
    if(cabinetModalState.mode !== 'edit' || !cabinetModalState.draft || !cabinetModalState.initialDraft) return false;
    syncLocalDraft();
    const baseline = cabinetModalState.initialComparableDraft || comparableCabinetDraft(cabinetModalState.initialDraft);
    return JSON.stringify(comparableCabinetDraft(cabinetModalState.draft)) !== JSON.stringify(baseline);
  }

  ns.cabinetModalDraft = {
    makeDefaultCabinetDraftForRoom,
    makeDefaultCabinetDraftForType,
    beginAddState,
    beginEditState,
    beginSetEditState,
    comparableCabinetDraft,
    captureEditBaseline,
    isEditDirty,
  };
})();
