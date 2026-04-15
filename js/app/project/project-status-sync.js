(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

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
    try{ return FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomIds === 'function' ? normalizeRoomIds(FC.roomRegistry.getActiveRoomIds()) : []; }
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

  function buildRecommendedRoomStatusMap(projectId, roomIds, currentStatusMap, fallbackRoomIds, fallbackStatus){
    const ids = normalizeRoomIds(roomIds);
    const targetSet = new Set(normalizeRoomIds(fallbackRoomIds));
    const map = {};
    try{
      if(projectId && FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getRecommendedStatusMapForProject === 'function'){
        Object.assign(map, FC.quoteSnapshotStore.getRecommendedStatusMapForProject(projectId, currentStatusMap || {}, ids, { matchMode:'exact', fallbackStatus:'nowy', allowProjectWideExact: ids.length === 1 }) || {});
      }
    }catch(_){ }
    ids.forEach((roomId)=> {
      const key = String(roomId || '');
      const current = normalizeStatus(currentStatusMap && currentStatusMap[key] || '');
      const suggested = normalizeStatus(map[key] || '');
      if(suggested){
        map[key] = suggested;
        return;
      }
      map[key] = targetSet.has(key) ? normalizeStatus(fallbackStatus || current || '') : (current || 'nowy');
    });
    return map;
  }


  function computeRecommendedRoomStatusMap(projectId, roomIds, currentStatusMap, options){
    const ids = normalizeRoomIds(roomIds);
    const opts = options && typeof options === 'object' ? options : {};
    const fallbackStatus = normalizeStatus(opts.fallbackStatus || 'nowy') || 'nowy';
    const map = {};
    let suggestedMap = {};
    try{
      if(projectId && FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getRecommendedStatusMapForProject === 'function'){
        suggestedMap = FC.quoteSnapshotStore.getRecommendedStatusMapForProject(projectId, currentStatusMap || {}, ids, {
          matchMode:'exact',
          fallbackStatus,
          allowProjectWideExact: ids.length === 1,
        }) || {};
      }
    }catch(_){ suggestedMap = {}; }
    ids.forEach((roomId)=> {
      const key = String(roomId || '');
      if(!key) return;
      const suggested = normalizeStatus(suggestedMap[key] || '');
      map[key] = suggested || fallbackStatus;
    });
    return map;
  }

  function saveInvestorRooms(investor, roomStatusMap){
    if(!(investor && investor.id)) return investor || null;
    const roomMap = new Map();
    const currentRooms = Array.isArray(investor.rooms) ? investor.rooms : [];
    const explicitStatusMap = roomStatusMap && typeof roomStatusMap === 'object' ? roomStatusMap : {};
    currentRooms.forEach((room)=> {
      const key = String(room && room.id || '');
      if(!key) return;
      const resolvedStatus = normalizeStatus(explicitStatusMap[key] || room && (room.projectStatus || room.status) || '');
      roomMap.set(key, Object.assign({}, room, resolvedStatus ? { projectStatus:resolvedStatus } : {}));
    });
    try{
      if(FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomDefs === 'function'){
        const defs = FC.roomRegistry.getActiveRoomDefs() || [];
        defs.forEach((room)=> {
          const key = String(room && room.id || '');
          if(!key) return;
          const hasExplicitStatus = Object.prototype.hasOwnProperty.call(explicitStatusMap, key);
          const resolvedStatus = normalizeStatus(hasExplicitStatus ? explicitStatusMap[key] : '');
          if(roomMap.has(key) && !hasExplicitStatus) return;
          if(!roomMap.has(key) && !hasExplicitStatus) return;
          const nextRoom = Object.assign({}, room || {}, roomMap.get(key) || {}, { id:key });
          if(resolvedStatus) nextRoom.projectStatus = resolvedStatus;
          roomMap.set(key, nextRoom);
        });
      }
    }catch(_){ }
    const rooms = Array.from(roomMap.values());
    if(!rooms.length) return investor;
    try{
      if(FC.investorPersistence && typeof FC.investorPersistence.saveInvestorPatch === 'function'){
        return FC.investorPersistence.saveInvestorPatch(investor.id, { rooms }) || Object.assign({}, investor, { rooms });
      }
    }catch(_){ }
    try{
      if(FC.investors && typeof FC.investors.update === 'function'){
        return FC.investors.update(investor.id, { rooms }) || Object.assign({}, investor, { rooms });
      }
    }catch(_){ }
    return Object.assign({}, investor, { rooms });
  }

  function updateProjectRecord(projectRecord, mirrorStatus){
    if(!(projectRecord && projectRecord.id)) return null;
    try{
      if(FC.projectStore && typeof FC.projectStore.upsert === 'function'){
        return FC.projectStore.upsert(Object.assign({}, projectRecord, { status:mirrorStatus, updatedAt:Date.now() }));
      }
    }catch(_){ }
    return projectRecord;
  }

  function updateLoadedProject(loadedProject, mirrorStatus, roomStatusMap){
    try{
      if(!(FC.project && typeof FC.project.save === 'function')) return loadedProject || null;
      const proj = loadedProject && typeof loadedProject === 'object' ? loadedProject : {};
      const meta = proj.meta && typeof proj.meta === 'object' ? proj.meta : (proj.meta = {});
      meta.projectStatus = mirrorStatus;
      if(meta.roomDefs && typeof meta.roomDefs === 'object'){
        Object.keys(meta.roomDefs).forEach((roomId)=> {
          const row = meta.roomDefs[roomId];
          if(!row || typeof row !== 'object') return;
          const resolvedStatus = normalizeStatus(roomStatusMap && roomStatusMap[roomId] || row.projectStatus || row.status || '');
          meta.roomDefs[roomId] = Object.assign({}, row, resolvedStatus ? { projectStatus:resolvedStatus } : {});
        });
      }
      return FC.project.save(proj) || proj;
    }catch(_){ return loadedProject || null; }
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

  function syncStatusMirrors(projectRecord, loadedProject, masterStatus, roomStatusMap){
    const mirrorStatus = normalizeStatus(masterStatus || '') || 'nowy';
    return {
      mirrorStatus,
      projectRecord: projectRecord ? updateProjectRecord(projectRecord, mirrorStatus) : null,
      loadedProject: updateLoadedProject(loadedProject, mirrorStatus, roomStatusMap),
    };
  }

  function refreshStatusViews(){
    try{ if(FC.views && typeof FC.views.refreshSessionButtons === 'function') FC.views.refreshSessionButtons(); }catch(_){ }
    try{ if(FC.investorUI && typeof FC.investorUI.render === 'function') FC.investorUI.render(); }catch(_){ }
    try{ if(FC.roomRegistry && typeof FC.roomRegistry.renderRoomsView === 'function') FC.roomRegistry.renderRoomsView(); }catch(_){ }
  }

  function resolveCurrentProjectStatus(snapshot){
    const snap = normalizeSnapshot(snapshot) || {};
    const projectId = String(snap && snap.project && snap.project.id || getCurrentProjectId() || '');
    const investorId = String(snap && snap.project && snap.project.investorId || snap && snap.investor && snap.investor.id || getCurrentInvestorId() || '');
    const targetRoomIds = getTargetRoomIdsFromSnapshot(snap);
    const projectRecord = projectId ? getProjectRecordById(projectId) : null;
    const loadedProject = loadCurrentProject();
    const investor = getSelectedInvestor(investorId);
    const scopedStatuses = collectRoomStatuses(targetRoomIds, {
      investorRooms: investor && investor.rooms,
      roomDefs: getMergedRoomDefs(projectRecord, loadedProject),
    });
    if(scopedStatuses.length) return getAggregateStatus(scopedStatuses, snap && snap.project && snap.project.status);
    if(projectRecord && projectRecord.status) return normalizeStatus(projectRecord.status);
    return normalizeStatus(snap && snap.project && snap.project.status || '');
  }

  function applyProjectStatusChange(params){
    const options = params && typeof params === 'object' ? params : {};
    const snapshot = normalizeSnapshot(options.snapshot) || null;
    const nextStatus = normalizeStatus(options.status);
    if(!nextStatus) return null;

    let projectId = String(options.projectId || snapshot && snapshot.project && snapshot.project.id || getCurrentProjectId() || '');
    let investorId = String(
      options.investorId
      || snapshot && snapshot.investor && snapshot.investor.id
      || snapshot && snapshot.project && snapshot.project.investorId
      || getCurrentInvestorId()
      || ''
    );
    let targetRoomIds = normalizeRoomIds(options.roomIds);
    if(!targetRoomIds.length && snapshot) targetRoomIds = getTargetRoomIdsFromSnapshot(snapshot);
    const syncSelection = !!options.syncSelection;
    const refreshUi = options.refreshUi !== false;

    let projectRecord = projectId ? getProjectRecordById(projectId) : null;
    if(!projectRecord && investorId) projectRecord = getProjectRecordByInvestorId(investorId);
    if(!projectId && projectRecord && projectRecord.id) projectId = String(projectRecord.id || '');
    if(!investorId && projectRecord && projectRecord.investorId) investorId = String(projectRecord.investorId || '');

    if(syncSelection){
      try{
        if(projectId && FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.syncSelectionForProjectStatus === 'function'){
          FC.quoteSnapshotStore.syncSelectionForProjectStatus(projectId, nextStatus, targetRoomIds.length ? { roomIds:targetRoomIds } : undefined);
        }
      }catch(_){ }
    }

    const investor = getSelectedInvestor(investorId);
    const loadedProject = loadCurrentProject();
    const mergedRoomDefs = getMergedRoomDefs(projectRecord, loadedProject);
    const knownRoomIds = getKnownProjectRoomIds(projectId, investor, loadedProject, targetRoomIds);
    const currentStatusMap = getRoomStatusMap(knownRoomIds, {
      investorRooms: investor && investor.rooms,
      roomDefs: mergedRoomDefs,
    });
    const roomStatusMap = buildRecommendedRoomStatusMap(projectId, knownRoomIds, currentStatusMap, targetRoomIds, nextStatus);
    targetRoomIds.forEach((roomId)=> {
      const key = String(roomId || '');
      if(key) roomStatusMap[key] = nextStatus;
    });

    const nextInvestor = saveInvestorRooms(investor, roomStatusMap) || investor;
    const masterRoomIds = resolveAggregateScopeRoomIds(targetRoomIds, knownRoomIds);
    const masterStatus = resolveScopedMasterStatus(masterRoomIds, roomStatusMap, {
      fallbackStatus: nextStatus,
      projectRecord,
      loadedProject,
      allowMirrorFallback:false,
    });

    const mirrorSync = syncStatusMirrors(projectRecord, loadedProject, masterStatus, roomStatusMap);
    const nextProjectRecord = mirrorSync.projectRecord;
    const nextLoadedProject = mirrorSync.loadedProject;
    const mirrorStatus = mirrorSync.mirrorStatus;

    if(refreshUi) refreshStatusViews();

    return {
      investor: nextInvestor,
      projectRecord: nextProjectRecord,
      loadedProject: nextLoadedProject,
      masterStatus,
      mirrorStatus,
      aggregateStatus:masterStatus,
      roomStatusMap,
      roomIds: targetRoomIds,
      projectId,
      investorId,
    };
  }

  function reconcileProjectStatuses(params){
    const options = params && typeof params === 'object' ? params : {};
    let projectId = String(options.projectId || getCurrentProjectId() || '');
    let investorId = String(options.investorId || getCurrentInvestorId() || '');
    let projectRecord = projectId ? getProjectRecordById(projectId) : null;
    if(!projectRecord && investorId) projectRecord = getProjectRecordByInvestorId(investorId);
    if(!projectId && projectRecord && projectRecord.id) projectId = String(projectRecord.id || '');
    if(!investorId && projectRecord && projectRecord.investorId) investorId = String(projectRecord.investorId || '');

    const investor = getSelectedInvestor(investorId);
    const loadedProject = loadCurrentProject();
    const mergedRoomDefs = getMergedRoomDefs(projectRecord, loadedProject);
    const explicitRoomIds = normalizeRoomIds(options.roomIds);
    const knownRoomIds = options.restrictToRoomIds
      ? explicitRoomIds
      : getKnownProjectRoomIds(projectId, investor, loadedProject, explicitRoomIds);
    const currentStatusMap = getRoomStatusMap(knownRoomIds, {
      investorRooms: investor && investor.rooms,
      roomDefs: mergedRoomDefs,
    });
    const roomStatusMap = computeRecommendedRoomStatusMap(projectId, knownRoomIds, currentStatusMap, { fallbackStatus: options.fallbackStatus || 'nowy' });
    const nextInvestor = investor ? (saveInvestorRooms(investor, roomStatusMap) || investor) : investor;
    const masterRoomIds = resolveAggregateScopeRoomIds(explicitRoomIds, knownRoomIds);
    const masterStatus = resolveScopedMasterStatus(masterRoomIds, roomStatusMap, {
      fallbackStatus: options.fallbackStatus || 'nowy',
      projectRecord,
      loadedProject,
      allowMirrorFallback:false,
    });
    const mirrorSync = syncStatusMirrors(projectRecord, loadedProject, masterStatus, roomStatusMap);
    const nextProjectRecord = mirrorSync.projectRecord;
    const nextLoadedProject = mirrorSync.loadedProject;
    const mirrorStatus = mirrorSync.mirrorStatus;
    if(options.refreshUi !== false) refreshStatusViews();
    return {
      investor: nextInvestor,
      projectRecord: nextProjectRecord,
      loadedProject: nextLoadedProject,
      masterStatus,
      mirrorStatus,
      aggregateStatus:masterStatus,
      roomStatusMap,
      roomIds: knownRoomIds,
      projectId,
      investorId,
    };
  }

  function setInvestorRoomStatus(investorId, roomId, status, options){
    return applyProjectStatusChange(Object.assign({}, options || {}, {
      investorId,
      roomIds:[roomId],
      status,
      syncSelection: options && Object.prototype.hasOwnProperty.call(options, 'syncSelection') ? !!options.syncSelection : true,
    }));
  }

  function setStatusFromSnapshot(snapshot, status, options){
    return applyProjectStatusChange(Object.assign({}, options || {}, {
      snapshot,
      status,
    }));
  }

  FC.projectStatusSync = {
    normalizeStatus,
    statusRank,
    isFinalStatus,
    normalizeRoomIds,
    getSnapshotRoomIds,
    getTargetRoomIdsFromSnapshot,
    collectRoomStatuses,
    getAggregateStatus,
    getRoomStatusMap,
    getKnownProjectRoomIds,
    resolveAggregateScopeRoomIds,
    resolveAggregateFallbackStatus,
    resolveScopedMasterStatus,
    syncStatusMirrors,
    buildRecommendedRoomStatusMap,
    computeRecommendedRoomStatusMap,
    resolveCurrentProjectStatus,
    applyProjectStatusChange,
    reconcileProjectStatuses,
    setInvestorRoomStatus,
    setStatusFromSnapshot,
    _debug:{
      getMergedRoomDefs,
      updateLoadedProject,
      saveInvestorRooms,
      resolveScopedMasterStatus,
      syncStatusMirrors,
    },
  };
})();
