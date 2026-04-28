(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const statusScope = FC.projectStatusScope || {};

  // Odpowiedzialność modułu: centralny silnik statusów projektu scoped.
  // Tu składamy finalny wynik biznesowy (`masterStatus`) dla exact scope,
  // rekonsyliujemy statusy po zmianach oraz zapisujemy lustra zgodności.
  // Ten moduł może korzystać z historii snapshotów, ale to on ma nadawać
  // końcowy wynik statusowy — nie UI i nie sam snapshot store.

  const normalizeStatus = statusScope.normalizeStatus;
  const statusRank = statusScope.statusRank;
  const isFinalStatus = statusScope.isFinalStatus;
  const normalizeRoomIds = statusScope.normalizeRoomIds;
  const getSnapshotRoomIds = statusScope.getSnapshotRoomIds;
  const getCurrentProjectId = statusScope.getCurrentProjectId;
  const getCurrentInvestorId = statusScope.getCurrentInvestorId;
  const getTargetRoomIdsFromSnapshot = statusScope.getTargetRoomIdsFromSnapshot;
  const resolveAggregateScopeRoomIds = statusScope.resolveAggregateScopeRoomIds;
  const resolveAggregateFallbackStatus = statusScope.resolveAggregateFallbackStatus;
  const normalizeSnapshot = statusScope.normalizeSnapshot;
  const getSelectedInvestor = statusScope.getSelectedInvestor;
  const getProjectRecordById = statusScope.getProjectRecordById;
  const getProjectRecordByInvestorId = statusScope.getProjectRecordByInvestorId;
  const loadCurrentProject = statusScope.loadCurrentProject;
  const getMergedRoomDefs = statusScope.getMergedRoomDefs;
  const collectRoomStatuses = statusScope.collectRoomStatuses;
  const getAggregateStatus = statusScope.getAggregateStatus;
  const getRoomStatusMap = statusScope.getRoomStatusMap;
  const getKnownProjectRoomIds = statusScope.getKnownProjectRoomIds;
  const computeRecommendedRoomStatusMap = statusScope.computeRecommendedRoomStatusMap;
  const buildRecommendedRoomStatusMap = statusScope.buildRecommendedRoomStatusMap;
  const resolveScopedMasterStatus = statusScope.resolveScopedMasterStatus;


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


  function commitAcceptedSnapshot(snapshot, status, options){
    const snap = normalizeSnapshot(snapshot) || null;
    const nextStatus = normalizeStatus(status);
    if(!snap || !nextStatus) return null;
    const opts = options && typeof options === 'object' ? options : {};
    const projectId = String(snap && snap.project && snap.project.id || getCurrentProjectId() || '');
    const investorId = String(
      opts.investorId
      || snap && snap.investor && snap.investor.id
      || snap && snap.project && snap.project.investorId
      || getCurrentInvestorId()
      || ''
    );
    const targetRoomIds = normalizeRoomIds(opts.roomIds).length ? normalizeRoomIds(opts.roomIds) : getTargetRoomIdsFromSnapshot(snap);
    let selectedSnapshot = snap;
    let selectionCommitted = false;
    try{
      const snapshotId = String(snap && snap.id || '');
      if(projectId && snapshotId && FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.markSelectedForProject === 'function'){
        selectedSnapshot = FC.quoteSnapshotStore.markSelectedForProject(projectId, snapshotId, { status:nextStatus, roomIds:targetRoomIds }) || selectedSnapshot;
        selectionCommitted = true;
      }
    }catch(_){ }
    const statusResult = setStatusFromSnapshot(selectedSnapshot, nextStatus, Object.assign({}, opts, {
      investorId,
      roomIds:targetRoomIds,
      syncSelection: selectionCommitted ? false : !!opts.syncSelection,
    }));
    return {
      snapshot: normalizeSnapshot(selectedSnapshot) || snap,
      selectedSnapshot: normalizeSnapshot(selectedSnapshot) || snap,
      statusResult,
      masterStatus: normalizeStatus(statusResult && statusResult.masterStatus || nextStatus) || nextStatus,
      mirrorStatus: normalizeStatus(statusResult && statusResult.mirrorStatus || nextStatus) || nextStatus,
      roomIds:targetRoomIds,
      projectId: String(projectId || statusResult && statusResult.projectId || ''),
      investorId: String(investorId || statusResult && statusResult.investorId || ''),
    };
  }

  function reconcileStatusAfterSnapshotRemoval(snapshot, options){
    const snap = normalizeSnapshot(snapshot) || null;
    if(!snap) return null;
    const opts = options && typeof options === 'object' ? options : {};
    const roomIds = normalizeRoomIds(opts.roomIds).length ? normalizeRoomIds(opts.roomIds) : getTargetRoomIdsFromSnapshot(snap);
    return reconcileProjectStatuses({
      projectId: String(opts.projectId || snap && snap.project && snap.project.id || getCurrentProjectId() || ''),
      investorId: String(opts.investorId || snap && snap.investor && snap.investor.id || snap && snap.project && snap.project.investorId || getCurrentInvestorId() || ''),
      roomIds,
      restrictToRoomIds: roomIds.length > 0,
      fallbackStatus: opts.fallbackStatus || 'nowy',
      refreshUi: opts.refreshUi,
    });
  }

  function promotePreliminarySnapshotToFinal(snapshot, options){
    const snap = normalizeSnapshot(snapshot) || null;
    if(!snap) return null;
    const opts = options && typeof options === 'object' ? options : {};
    const projectId = String(opts.projectId || snap && snap.project && snap.project.id || getCurrentProjectId() || '');
    const snapshotId = String(snap && snap.id || '');
    if(!projectId || !snapshotId) return null;
    let converted = null;
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.convertPreliminaryToFinal === 'function'){
        converted = FC.quoteSnapshotStore.convertPreliminaryToFinal(projectId, snapshotId);
      }
    }catch(_){ converted = null; }
    if(!converted) return null;
    const statusResult = setStatusFromSnapshot(converted, 'zaakceptowany', Object.assign({}, opts, { syncSelection:false }));
    return {
      snapshot: normalizeSnapshot(converted) || converted,
      convertedSnapshot: normalizeSnapshot(converted) || converted,
      statusResult,
      masterStatus: normalizeStatus(statusResult && statusResult.masterStatus || 'zaakceptowany') || 'zaakceptowany',
      mirrorStatus: normalizeStatus(statusResult && statusResult.mirrorStatus || 'zaakceptowany') || 'zaakceptowany',
      projectId,
      investorId: String(opts.investorId || converted && converted.investor && converted.investor.id || converted && converted.project && converted.project.investorId || getCurrentInvestorId() || ''),
      roomIds: getTargetRoomIdsFromSnapshot(converted),
    };
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
    commitAcceptedSnapshot,
    reconcileStatusAfterSnapshotRemoval,
    promotePreliminarySnapshotToFinal,
    _debug:{
      getMergedRoomDefs,
      updateLoadedProject,
      saveInvestorRooms,
      resolveScopedMasterStatus,
      syncStatusMirrors,
    },
  };
})();
