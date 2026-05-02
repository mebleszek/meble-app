(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function normalizeRoomIds(roomIds){
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.normalizeRoomIds === 'function') return FC.quoteSnapshotStore.normalizeRoomIds(roomIds);
    }catch(_){ }
    return Array.isArray(roomIds)
      ? Array.from(new Set(roomIds.map((item)=> String(item || '').trim()).filter(Boolean)))
      : [];
  }

  function normalizeDraftSelection(draft){
    try{
      if(FC.wycenaCore && typeof FC.wycenaCore.normalizeQuoteSelection === 'function') return FC.wycenaCore.normalizeQuoteSelection(draft && draft.selection);
    }catch(_){ }
    return {
      selectedRooms:[],
      materialScope:{ kind:'all', material:'', includeFronts:true, includeCorpus:true },
    };
  }

  function buildSelectionScopeSummary(selection){
    const selectedRooms = normalizeRoomIds(selection && selection.selectedRooms);
    if(FC.quoteScopeEntry && typeof FC.quoteScopeEntry.getScopeSummary === 'function'){
      try{ return FC.quoteScopeEntry.getScopeSummary(selectedRooms); }catch(_){ }
    }
    const labels = selectedRooms.slice();
    return {
      roomIds:selectedRooms,
      roomLabels:labels,
      scopeLabel:labels.join(', ') || 'wybrany zakres',
      isMultiRoom:selectedRooms.length > 1,
    };
  }

  function getRoomLabel(roomId){
    try{ return FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function' ? FC.roomRegistry.getRoomLabel(roomId) : String(roomId || ''); }
    catch(_){ return String(roomId || ''); }
  }

  function getActiveRoomIds(){
    try{ return FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomIds === 'function' ? FC.roomRegistry.getActiveRoomIds() : []; }
    catch(_){ return []; }
  }

  function getRoomLabelsFromSelection(selection){
    const rows = Array.isArray(selection && selection.selectedRooms) ? selection.selectedRooms : [];
    return rows.map((roomId)=> getRoomLabel(roomId)).filter(Boolean);
  }

  function getRoomsPickerMeta(selection){
    try{
      if(FC.rozrysScope && typeof FC.rozrysScope.getRoomsSummary === 'function'){
        return FC.rozrysScope.getRoomsSummary(selection && selection.selectedRooms, { getRooms:getActiveRoomIds }) || { title:'Brak pomieszczeń', subtitle:'' };
      }
    }catch(_){ }
    const roomLabels = getRoomLabelsFromSelection(selection);
    return {
      title: roomLabels.length ? roomLabels.join(', ') : 'Brak pomieszczeń',
      subtitle: roomLabels.length ? `${roomLabels.length} wybrane` : '',
    };
  }

  function getScopePickerMeta(selection, deps){
    const getMaterialScopeLabel = deps && typeof deps.getMaterialScopeLabel === 'function'
      ? deps.getMaterialScopeLabel
      : (()=> 'Fronty + korpusy');
    return {
      title:'Zakres wyceny',
      subtitle:getMaterialScopeLabel(selection),
      detail:'Wybór jak w ROZRYS',
    };
  }

  function buildSelectionSummary(selection, deps){
    const roomLabels = getRoomLabelsFromSelection(selection);
    const roomsMeta = getRoomsPickerMeta(selection);
    const scopeMeta = getScopePickerMeta(selection, deps);
    const getMaterialScopeLabel = deps && typeof deps.getMaterialScopeLabel === 'function'
      ? deps.getMaterialScopeLabel
      : (()=> 'Fronty + korpusy');
    return {
      roomLabels,
      roomsMeta,
      scopeMeta,
      roomsText: roomLabels.length ? roomLabels.join(', ') : 'Brak pomieszczeń',
      scopeText: getMaterialScopeLabel(selection),
    };
  }

  FC.wycenaTabSelectionScope = {
    normalizeRoomIds,
    normalizeDraftSelection,
    buildSelectionScopeSummary,
    getRoomLabel,
    getActiveRoomIds,
    getRoomLabelsFromSelection,
    getRoomsPickerMeta,
    getScopePickerMeta,
    buildSelectionSummary,
  };
})();
