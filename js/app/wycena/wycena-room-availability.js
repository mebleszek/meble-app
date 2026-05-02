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

  function getProject(){
    try{ return FC.rozrys && typeof FC.rozrys.safeGetProject === 'function' ? FC.rozrys.safeGetProject() : null; }
    catch(_){ }
    try{ return typeof projectData !== 'undefined' ? projectData : null; }
    catch(_){ return null; }
  }

  function getRoomData(roomId){
    const project = getProject() || {};
    const key = String(roomId || '').trim();
    return key && project && typeof project === 'object' ? (project[key] || null) : null;
  }

  function getRoomCabinets(roomId){
    const room = getRoomData(roomId);
    return room && Array.isArray(room.cabinets) ? room.cabinets.filter(Boolean) : [];
  }

  function hasCabinets(roomId){
    return getRoomCabinets(roomId).length > 0;
  }

  function getQuoteBlockReason(roomId){
    return hasCabinets(roomId) ? '' : 'Brak szafek';
  }

  function isQuoteableRoom(roomId){
    return !getQuoteBlockReason(roomId);
  }

  function filterQuoteableRoomIds(roomIds){
    return normalizeRoomIds(roomIds).filter((roomId)=> isQuoteableRoom(roomId));
  }

  function summarizeRoomAvailability(roomIds){
    return normalizeRoomIds(roomIds).map((roomId)=> ({
      roomId,
      hasCabinets: hasCabinets(roomId),
      blocked: !isQuoteableRoom(roomId),
      reason: getQuoteBlockReason(roomId),
    }));
  }

  FC.wycenaRoomAvailability = {
    normalizeRoomIds,
    getProject,
    getRoomData,
    getRoomCabinets,
    hasCabinets,
    getQuoteBlockReason,
    isQuoteableRoom,
    filterQuoteableRoomIds,
    summarizeRoomAvailability,
  };
})();
