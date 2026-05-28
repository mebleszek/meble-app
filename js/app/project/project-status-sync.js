(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const statusScope = FC.projectStatusScope || {};
  const statusMirrors = FC.projectStatusMirrors || {};

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
  const syncStatusMirrors = statusMirrors.syncStatusMirrors || (()=> ({ mirrorStatus:'nowy', projectRecord:null, loadedProject:null }));
  const saveInvestorRooms = statusMirrors.saveInvestorRooms || ((investor)=> investor || null);
  const updateLoadedProject = statusMirrors.updateLoadedProject || ((loadedProject)=> loadedProject || null);
  const refreshStatusViews = statusMirrors.refreshStatusViews || (()=> {});




  function getLastManualStatusMap(roomIds, sources){
    const ids = normalizeRoomIds(roomIds);
    const src = sources && typeof sources === 'object' ? sources : {};
    const investorRooms = Array.isArray(src.investorRooms) ? src.investorRooms : [];
    const roomDefs = src.roomDefs && typeof src.roomDefs === 'object' ? src.roomDefs : {};
    const out = {};
    ids.forEach((roomId)=> {
      const key = String(roomId || '');
      if(!key) return;
      const investorRoom = investorRooms.find((room)=> String(room && room.id || '') === key) || null;
      const value = normalizeStatus(investorRoom && investorRoom.lastManualProjectStatus || roomDefs[key] && roomDefs[key].lastManualProjectStatus || '');
      if(value) out[key] = value;
    });
    return out;
  }

  function mergeManualStatusMaps(){
    const out = {};
    Array.from(arguments).forEach((map)=> {
      if(!(map && typeof map === 'object')) return;
      Object.keys(map).forEach((key)=> {
        const status = normalizeStatus(map[key]);
        if(key && status) out[key] = status;
      });
    });
    return out;
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
    const roomStatusMap = computeRecommendedRoomStatusMap(projectId, knownRoomIds, currentStatusMap, {
      fallbackStatus:nextStatus,
      suggestionFallbackStatus:'nowy',
      touchedRoomIds:targetRoomIds,
      preserveCurrentForUntouched:true,
      preserveCurrentWhenNoQuoteRows: !!options.preserveCurrentWhenNoQuoteRows,
    });
    const existingManualStatusMap = getLastManualStatusMap(knownRoomIds, {
      investorRooms: investor && investor.rooms,
      roomDefs: mergedRoomDefs,
    });
    const manualStatusMap = mergeManualStatusMaps(existingManualStatusMap, options.manualBaseStatusMap);
    const recordManualStatus = !snapshot && options.recordManualStatus !== false;
    if(recordManualStatus){
      targetRoomIds.forEach((roomId)=> {
        const key = String(roomId || '');
        if(key) manualStatusMap[key] = nextStatus;
      });
    }
    const preserveForwardProgress = !!options.preserveForwardProgress;
    const forceStatusSet = new Set(normalizeRoomIds(options.forceStatusRoomIds));
    const acceptedRank = statusRank('zaakceptowany');
    targetRoomIds.forEach((roomId)=> {
      const key = String(roomId || '');
      if(!key) return;
      const current = normalizeStatus(currentStatusMap && currentStatusMap[key] || '');
      if(forceStatusSet.has(key) && (!current || statusRank(current) <= acceptedRank)){
        roomStatusMap[key] = nextStatus;
        return;
      }
      if(preserveForwardProgress && current && statusRank(current) > statusRank(nextStatus)){
        roomStatusMap[key] = current;
        return;
      }
      roomStatusMap[key] = nextStatus;
    });

    const nextInvestor = saveInvestorRooms(investor, roomStatusMap, { manualStatusMap }) || investor;
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
    const existingManualStatusMap = getLastManualStatusMap(knownRoomIds, {
      investorRooms: investor && investor.rooms,
      roomDefs: mergedRoomDefs,
    });
    const restoreManualStatusMap = mergeManualStatusMaps(existingManualStatusMap, options.restoreManualStatusMap);
    if(options.restoreManualForReleasedRooms !== false){
      knownRoomIds.forEach((roomId)=> {
        const key = String(roomId || '');
        const currentResolved = normalizeStatus(roomStatusMap[key] || '');
        const manual = normalizeStatus(restoreManualStatusMap[key] || '');
        if(key && manual && (!currentResolved || currentResolved === 'nowy')) roomStatusMap[key] = manual;
      });
    }
    const nextInvestor = investor ? (saveInvestorRooms(investor, roomStatusMap, { manualStatusMap: restoreManualStatusMap }) || investor) : investor;
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
      preserveCurrentWhenNoQuoteRows: options && Object.prototype.hasOwnProperty.call(options, 'preserveCurrentWhenNoQuoteRows') ? !!options.preserveCurrentWhenNoQuoteRows : true,
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
      getLastManualStatusMap,
      resolveScopedMasterStatus,
      syncStatusMirrors,
    },
  };
})();
