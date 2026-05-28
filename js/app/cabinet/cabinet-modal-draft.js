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
      frontCount: 2,
      details: { insideMode: 'polki', innerDrawerCount: '1', innerDrawerType: 'blum', shelves: 1, cornerOption: 'polki', dishWasherWidth: '60', ovenOption: 'szuflada_dol', ovenHeight: '60', sinkOption: 'zwykle_drzwi', fridgeOption: 'zabudowa', fridgeWidth: '60', drawerCount: '3', subTypeOption: 'polki', fridgeFrontCount: '2' }
    };

    try{
      if(ns.cabinetFronts && typeof ns.cabinetFronts.applyTypeRules === 'function'){
        ns.cabinetFronts.applyTypeRules(room, draft, type);
      }
    }catch(_){ draft.type = type; }

    try{
      if(ns.roomPreferences && typeof ns.roomPreferences.applyZoneDefaultsToDraft === 'function'){
        ns.roomPreferences.applyZoneDefaultsToDraft(room, draft, type);
      } else {
        if(ns.programDefaults && typeof ns.programDefaults.applyMaterialsToDraft === 'function'){
          ns.programDefaults.applyMaterialsToDraft(draft);
        }
        if(ns.roomPreferences && typeof ns.roomPreferences.applyPreferencesToDraft === 'function'){
          ns.roomPreferences.applyPreferencesToDraft(room, draft);
        }
      }
    }catch(_){ }
    return draft;
  }

  function makeDefaultCabinetDraftForType(room, typeValue){
    const type = String(typeValue || getDefaultTypeForRoom(room));
    if(type && type !== 'zestaw'){
      const lastSameType = findLastCabinet(room, type);
      if(lastSameType) return sanitizeClonedCabinet(lastSameType);
    }
    return buildFreshDraft(room, type === 'zestaw' ? getDefaultTypeForRoom(room) : type);
  }

  function makeDefaultCabinetDraftForRoom(room){
    const last = findLastCabinet(room, '');
    if(last) return sanitizeClonedCabinet(last);
    return makeDefaultCabinetDraftForType(room, getDefaultTypeForRoom(room));
  }

  function beginAddState(room){
    cabinetModalState.mode = 'add';
    cabinetModalState.editingId = null;
    cabinetModalState.setEditId = null;
    cabinetModalState.chosen = null;
    cabinetModalState.setPreset = null;
    cabinetModalState.draft = makeDefaultCabinetDraftForRoom(room);
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
    return cabinetModalState;
  }

  function beginSetEditState(setId, set){
    cabinetModalState.mode = 'add';
    cabinetModalState.editingId = null;
    cabinetModalState.setEditId = String(setId);
    cabinetModalState.chosen = 'zestaw';
    cabinetModalState.setPreset = set && set.presetId ? set.presetId : null;
    cabinetModalState.draft = null;
    return cabinetModalState;
  }

  ns.cabinetModalDraft = {
    makeDefaultCabinetDraftForRoom,
    makeDefaultCabinetDraftForType,
    beginAddState,
    beginEditState,
    beginSetEditState,
  };
})();
