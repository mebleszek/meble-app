(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const roomScopeResolver = FC.roomScopeResolver;

  const STATUS_RANK = {
    nowy:0,
    wstepna_wycena:1,
    pomiar:2,
    wycena:3,
    zaakceptowany:4,
    umowa:5,
    produkcja:6,
    montaz:7,
    zakonczone:8,
    odrzucone:-1,
  };

  // Odpowiedzialność modułu: czyste helpery status/scope dla Wyceny i projektów.
  // Bez zapisu danych i bez zmian UI; project-status-sync używa tego modułu
  // jako źródła prawdy dla rang statusów, zakresów pomieszczeń i rekomendacji.

  function normalizeStatus(value){
    return String(value || '').trim().toLowerCase();
  }

  function statusRank(value){
    const key = normalizeStatus(value);
    return Object.prototype.hasOwnProperty.call(STATUS_RANK, key) ? STATUS_RANK[key] : -99;
  }

  function isFinalStatus(value){
    const key = normalizeStatus(value);
    return key === 'zaakceptowany' || key === 'umowa' || key === 'produkcja' || key === 'montaz' || key === 'zakonczone';
  }

  function normalizeRoomIds(roomIds){
    try{
      if(roomScopeResolver && typeof roomScopeResolver.normalizeRoomIds === 'function') return roomScopeResolver.normalizeRoomIds(roomIds);
    }catch(_){ }
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.normalizeRoomIds === 'function') return FC.quoteSnapshotStore.normalizeRoomIds(roomIds);
    }catch(_){ }
    return Array.isArray(roomIds)
      ? Array.from(new Set(roomIds.map((item)=> String(item || '').trim()).filter(Boolean)))
      : [];
  }

  function getSnapshotRoomIds(snapshot){
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getSnapshotRoomIds === 'function') return FC.quoteSnapshotStore.getSnapshotRoomIds(snapshot);
    }catch(_){ }
    return normalizeRoomIds(snapshot && snapshot.scope && snapshot.scope.selectedRooms);
  }

  function getCurrentProjectId(){
    try{ return FC.projectStore && typeof FC.projectStore.getCurrentProjectId === 'function' ? String(FC.projectStore.getCurrentProjectId() || '') : ''; }
    catch(_){ return ''; }
  }

  function getCurrentInvestorId(){
    try{ return FC.investors && typeof FC.investors.getCurrentId === 'function' ? String(FC.investors.getCurrentId() || '') : ''; }
    catch(_){ return ''; }
  }

  function getAllActiveRoomIds(){
    try{
      if(roomScopeResolver && typeof roomScopeResolver.getActiveRoomIds === 'function') return roomScopeResolver.getActiveRoomIds();
      return FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomIds === 'function' ? normalizeRoomIds(FC.roomRegistry.getActiveRoomIds()) : [];
    }
    catch(_){ return []; }
  }

  function getTargetRoomIdsFromSnapshot(snapshot){
    const scoped = getSnapshotRoomIds(snapshot);
    if(scoped.length) return scoped;
    const active = getAllActiveRoomIds();
    return active.length === 1 ? active : [];
  }

  function resolveAggregateScopeRoomIds(explicitRoomIds, knownRoomIds){
    const explicit = normalizeRoomIds(explicitRoomIds);
    if(explicit.length) return explicit;
    const known = normalizeRoomIds(knownRoomIds);
    return known.length === 1 ? known : [];
  }

  function resolveAggregateFallbackStatus(projectRecord, loadedProject, fallbackStatus){
    const projectStatus = normalizeStatus(projectRecord && projectRecord.status || '');
    if(projectStatus) return projectStatus;
    const metaStatus = normalizeStatus(loadedProject && loadedProject.meta && loadedProject.meta.projectStatus || '');
    if(metaStatus) return metaStatus;
    return normalizeStatus(fallbackStatus || '') || 'nowy';
  }

  function normalizeSnapshot(source){
    const snap = source && typeof source === 'object' ? source : null;
    if(!snap) return null;
    if(snap.lines && snap.totals) return snap;
    try{
      if(FC.quoteSnapshot && typeof FC.quoteSnapshot.buildSnapshot === 'function') return FC.quoteSnapshot.buildSnapshot(snap);
    }catch(_){ }
    return snap;
  }

  function getInvestorById(id){
    const key = String(id || '');
    if(!key) return null;
    try{ return FC.investors && typeof FC.investors.getById === 'function' ? (FC.investors.getById(key) || null) : null; }
    catch(_){ return null; }
  }

  function getSelectedInvestor(fallbackId){
    const byId = getInvestorById(fallbackId);
    if(byId) return byId;
    try{
      if(FC.investorPersistence && typeof FC.investorPersistence.getSelectedInvestor === 'function') return FC.investorPersistence.getSelectedInvestor(fallbackId || null) || null;
    }catch(_){ }
    return null;
  }

  function getProjectRecordById(projectId){
    const key = String(projectId || '');
    if(!key) return null;
    try{ return FC.projectStore && typeof FC.projectStore.getById === 'function' ? (FC.projectStore.getById(key) || null) : null; }
    catch(_){ return null; }
  }

  function getProjectRecordByInvestorId(investorId){
    const key = String(investorId || '');
    if(!key) return null;
    try{ return FC.projectStore && typeof FC.projectStore.getByInvestorId === 'function' ? (FC.projectStore.getByInvestorId(key) || null) : null; }
    catch(_){ return null; }
  }

  function loadCurrentProject(){
    try{ return FC.project && typeof FC.project.load === 'function' ? (FC.project.load() || null) : null; }
    catch(_){ return null; }
  }

  function getMergedRoomDefs(projectRecord, loadedProject){
    const out = {};
    try{
      const defs = projectRecord && projectRecord.projectData && projectRecord.projectData.meta && projectRecord.projectData.meta.roomDefs;
      if(defs && typeof defs === 'object') Object.keys(defs).forEach((roomId)=> { out[roomId] = Object.assign({}, defs[roomId]); });
    }catch(_){ }
    try{
      const defs = loadedProject && loadedProject.meta && loadedProject.meta.roomDefs;
      if(defs && typeof defs === 'object') Object.keys(defs).forEach((roomId)=> { out[roomId] = Object.assign({}, out[roomId] || {}, defs[roomId]); });
    }catch(_){ }
    return out;
  }

  function collectRoomStatuses(roomIds, sources){
    const ids = normalizeRoomIds(roomIds);
    const out = [];
    const investorRooms = sources && Array.isArray(sources.investorRooms) ? sources.investorRooms : [];
    const roomDefs = sources && sources.roomDefs && typeof sources.roomDefs === 'object' ? sources.roomDefs : null;
    ids.forEach((roomId)=> {
      let status = '';
      const investorRoom = investorRooms.find((room)=> String(room && room.id || '') === roomId);
      if(investorRoom && (investorRoom.projectStatus || investorRoom.status)) status = normalizeStatus(investorRoom.projectStatus || investorRoom.status);
      if(!status && roomDefs && roomDefs[roomId] && (roomDefs[roomId].projectStatus || roomDefs[roomId].status)){
        status = normalizeStatus(roomDefs[roomId].projectStatus || roomDefs[roomId].status);
      }
      if(status) out.push(status);
    });
    return out;
  }

  function getAggregateStatus(statuses, fallback){
    const rows = Array.isArray(statuses) ? statuses.map((value)=> normalizeStatus(value)).filter(Boolean) : [];
    if(!rows.length) return normalizeStatus(fallback);
    let best = rows[0];
    rows.forEach((status)=> {
      if(statusRank(status) > statusRank(best)) best = status;
    });
    return best || normalizeStatus(fallback);
  }

  function getRoomStatusMap(roomIds, sources){
    const ids = normalizeRoomIds(roomIds);
    const map = {};
    ids.forEach((roomId)=> {
      const status = collectRoomStatuses([roomId], sources)[0] || '';
      if(status) map[roomId] = status;
    });
    return map;
  }

  function getKnownProjectRoomIds(projectId, investor, loadedProject, fallbackRoomIds){
    const set = new Set(normalizeRoomIds(fallbackRoomIds));
    const investorRooms = investor && Array.isArray(investor.rooms) ? investor.rooms : [];
    investorRooms.forEach((room)=> {
      const key = String(room && room.id || '');
      if(key) set.add(key);
    });
    try{
      if(projectId && FC.projectStore && typeof FC.projectStore.getById === 'function'){
        const record = FC.projectStore.getById(projectId);
        const defs = record && record.projectData && record.projectData.meta && record.projectData.meta.roomDefs;
        if(defs && typeof defs === 'object') Object.keys(defs).forEach((roomId)=> { if(roomId) set.add(roomId); });
      }
    }catch(_){ }
    try{
      const defs = loadedProject && loadedProject.meta && loadedProject.meta.roomDefs;
      if(defs && typeof defs === 'object') Object.keys(defs).forEach((roomId)=> { if(roomId) set.add(roomId); });
    }catch(_){ }
    if(set.size) return Array.from(set);
    try{
      if(FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomIds === 'function'){
        normalizeRoomIds(FC.roomRegistry.getActiveRoomIds()).forEach((roomId)=> set.add(roomId));
      }
    }catch(_){ }
    return Array.from(set);
  }

  function computeRecommendedRoomStatusMap(projectId, roomIds, currentStatusMap, options){
    const ids = normalizeRoomIds(roomIds);
    const opts = options && typeof options === 'object' ? options : {};
    const fallbackStatus = normalizeStatus(opts.fallbackStatus || 'nowy') || 'nowy';
    const suggestionFallbackStatus = normalizeStatus(Object.prototype.hasOwnProperty.call(opts, 'suggestionFallbackStatus') ? opts.suggestionFallbackStatus : fallbackStatus);
    const touchedSet = new Set(normalizeRoomIds(opts.touchedRoomIds));
    const explicitStatusMap = opts.explicitStatusMap && typeof opts.explicitStatusMap === 'object' ? opts.explicitStatusMap : null;
    const preserveCurrentForUntouched = opts.preserveCurrentForUntouched !== false;
    const map = {};
    let suggestedMap = {};
    try{
      if(projectId && FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getRecommendedStatusMapForProject === 'function'){
        suggestedMap = FC.quoteSnapshotStore.getRecommendedStatusMapForProject(projectId, currentStatusMap || {}, ids, {
          matchMode:'exact',
          fallbackStatus:suggestionFallbackStatus || fallbackStatus,
          allowProjectWideExact: ids.length === 1,
          preserveCurrentWhenNoQuoteRows: !!opts.preserveCurrentWhenNoQuoteRows,
        }) || {};
      }
    }catch(_){ suggestedMap = {}; }
    ids.forEach((roomId)=> {
      const key = String(roomId || '');
      if(!key) return;
      const explicit = normalizeStatus(explicitStatusMap && explicitStatusMap[key] || '');
      if(explicit){
        map[key] = explicit;
        return;
      }
      const suggested = normalizeStatus(suggestedMap[key] || '');
      if(suggested){
        map[key] = suggested;
        return;
      }
      const current = normalizeStatus(currentStatusMap && currentStatusMap[key] || '');
      if(touchedSet.has(key)){
        map[key] = fallbackStatus || current || 'nowy';
        return;
      }
      map[key] = preserveCurrentForUntouched ? (current || 'nowy') : fallbackStatus;
    });
    return map;
  }

  // Compat wrapper z etapu przejściowego: stare wejścia korzystają z jednego silnika
  // computeRecommendedRoomStatusMap zamiast z osobnej, dublującej ścieżki fallbacków.
  function buildRecommendedRoomStatusMap(projectId, roomIds, currentStatusMap, fallbackRoomIds, fallbackStatus){
    return computeRecommendedRoomStatusMap(projectId, roomIds, currentStatusMap, {
      fallbackStatus,
      suggestionFallbackStatus:'nowy',
      touchedRoomIds:fallbackRoomIds,
      preserveCurrentForUntouched:true,
    });
  }


  function resolveScopedMasterStatus(scopedRoomIds, roomStatusMap, options){
    const ids = normalizeRoomIds(scopedRoomIds);
    const opts = options && typeof options === 'object' ? options : {};
    const fallbackStatus = normalizeStatus(opts.fallbackStatus || '') || 'nowy';
    const statuses = ids.map((roomId)=> normalizeStatus(roomStatusMap && roomStatusMap[roomId] || '')).filter(Boolean);
    if(statuses.length) return getAggregateStatus(statuses, fallbackStatus);
    if(ids.length) return fallbackStatus;
    if(opts.allowMirrorFallback) return resolveAggregateFallbackStatus(opts.projectRecord, opts.loadedProject, fallbackStatus);
    return fallbackStatus;
  }

  FC.projectStatusScope = {
    normalizeStatus,
    statusRank,
    isFinalStatus,
    normalizeRoomIds,
    getSnapshotRoomIds,
    getCurrentProjectId,
    getCurrentInvestorId,
    getAllActiveRoomIds,
    getTargetRoomIdsFromSnapshot,
    resolveAggregateScopeRoomIds,
    resolveAggregateFallbackStatus,
    normalizeSnapshot,
    getInvestorById,
    getSelectedInvestor,
    getProjectRecordById,
    getProjectRecordByInvestorId,
    loadCurrentProject,
    getMergedRoomDefs,
    collectRoomStatuses,
    getAggregateStatus,
    getRoomStatusMap,
    getKnownProjectRoomIds,
    computeRecommendedRoomStatusMap,
    buildRecommendedRoomStatusMap,
    resolveScopedMasterStatus,
  };
})();
