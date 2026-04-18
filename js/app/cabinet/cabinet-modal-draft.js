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

  function makeDefaultCabinetDraftForRoom(room){
    const arr = getRoomCabinets(room);
    const last = arr[arr.length - 1];
    const NOW = Date.now();
    const RECENT_WINDOW_MS = 90 * 1000;
    const recentlyAdded = (uiState && Number.isFinite(Number(uiState.lastAddedAt)) && (NOW - Number(uiState.lastAddedAt) <= RECENT_WINDOW_MS));
    const allowCloneLast = !!last && recentlyAdded;

    if(allowCloneLast){
      const cloned = cloneSafe(last);
      cloned.id = null;
      delete cloned.setId;
      delete cloned.setPreset;
      delete cloned.setRole;
      delete cloned.setName;
      delete cloned.setNumber;
      return cloned;
    }

    const isKitchen = room === 'kuchnia';
    const baseLaminat = getBaseLaminat();
    return {
      id: null,
      width: 60,
      height: isKitchen ? projectData.kuchnia.settings.bottomHeight : 200,
      depth: isKitchen ? 51 : 60,
      type: isKitchen ? 'stojąca' : 'moduł',
      subType: 'standardowa',
      bodyColor: baseLaminat,
      frontMaterial: 'laminat',
      frontColor: baseLaminat,
      openingSystem: 'uchwyt klienta',
      backMaterial: 'HDF 3mm biała',
      frontCount: 2,
      details: { insideMode: 'polki', innerDrawerCount: '1', innerDrawerType: 'blum', shelves: 1, cornerOption: 'polki', dishWasherWidth: '60', ovenOption: 'szuflada_dol', ovenHeight: '60', sinkOption: 'zwykle_drzwi', fridgeOption: 'zabudowa', fridgeWidth: '60', drawerCount: '3', subTypeOption: 'polki', fridgeFrontCount: '2' }
    };
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
    beginAddState,
    beginEditState,
    beginSetEditState,
  };
})();
