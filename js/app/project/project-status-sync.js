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




  function persistStatusPlan(record, investor, roomStatusMap, manualStatusMap, targetRoomIds, masterStatus, historyRows, options){
    if(!record || !investor || record.investorId !== investor.id || !targetRoomIds.length
      || targetRoomIds.some(id=>!Object.prototype.hasOwnProperty.call(record.projectData || {},id))) return {ok:false,reason:'invalid-status-owner'};
    if(FC.projectStore.readAll().some(other=>other.id !== record.id && other.investorId === record.investorId
      && targetRoomIds.some(id=>Object.prototype.hasOwnProperty.call(other.projectData || {},id)))) return {ok:false,reason:'ambiguous-investor-room-mirror'};
    const data = JSON.parse(JSON.stringify(record.projectData));
    const meta = data.meta || (data.meta = {}), defs = meta.roomDefs || (meta.roomDefs = {});
    const target = new Set(targetRoomIds);
    const statusChanges = [];
    for(const id of target){
      const prev = defs[id] || { id };
      const before = {projectStatus:prev.projectStatus || '',lastManualProjectStatus:prev.lastManualProjectStatus || ''};
      const after = {projectStatus:roomStatusMap[id] || before.projectStatus || 'nowy',lastManualProjectStatus:manualStatusMap[id] || before.lastManualProjectStatus};
      defs[id] = Object.assign({},prev,after);
      statusChanges.push({id,before,after});
    }
    meta.projectStatus = masterStatus;
    const nextInvestor = Object.assign({},investor,{rooms:(investor.rooms || []).map(room=>target.has(String(room.id))
      ? Object.assign({},room,defs[room.id],{id:room.id}) : room)});
    const result = {ok:true,investor:nextInvestor,projectRecord:Object.assign({},record,{status:masterStatus,projectData:data}),
      loadedProject:data,masterStatus,mirrorStatus:masterStatus,aggregateStatus:masterStatus,roomStatusMap,roomIds:targetRoomIds,projectId:record.id,investorId:investor.id};
    Object.assign(result,options.operationResult || {});
    if(options.preview === true) return result;
    if(!FC.projectDomainOperations) return {ok:false,reason:'missing-confirmed-status-store'};
    const histories = FC.projectDomainOperations.readHistory();
    const requestKey = options.requestKey || 'status:'+JSON.stringify([record.id,targetRoomIds,masterStatus]);
    const pending = record.meta && record.meta.pendingDomainOperation;
    if(pending) return pending.kind === 'offerStatus' && pending.requestKey === requestKey
      ? FC.projectDomainOperations.recoverProject(record.id) : {ok:false,partial:true,reason:'different-pending-operation'};
    const intentResult = {masterStatus,mirrorStatus:masterStatus,roomStatusMap,roomIds:targetRoomIds,projectId:record.id,investorId:investor.id};
    const extra = options.operationResult || {};
    Object.assign(intentResult,{roomIds:Array.isArray(extra.roomIds) ? extra.roomIds : targetRoomIds,snapshotId:extra.selectedSnapshot && extra.selectedSnapshot.id || '',promoted:!!extra.convertedSnapshot,
      releasedRoomIds:extra.releasedRoomIds || [],affectedRoomIds:extra.affectedRoomIds || targetRoomIds});
    const spec = {kind:'offerStatus',beforeStatus:record.status,afterStatus:masterStatus,beforeMetaStatus:record.projectData.meta && record.projectData.meta.projectStatus || '',
      statusChanges,mirrorChanges:FC.projectDomainOperations.rowChanges(investor.rooms || [],nextInvestor.rooms),
      historyChanges:FC.projectDomainOperations.rowChanges(histories,historyRows || histories),requestKey,result:intentResult};
    const written = FC.projectDomainOperations.start(record,spec);
    return written.ok ? Object.assign({},result,written) : written;
  }

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
    if(options.preview !== true && FC.session && FC.session.active) return {ok:false,reason:'active-session'};
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
    if(!projectId && investorId) projectRecord = getProjectRecordByInvestorId(investorId);
    if(!projectId && projectRecord && projectRecord.id) projectId = String(projectRecord.id || '');
    if(!investorId && projectRecord && projectRecord.investorId) investorId = String(projectRecord.investorId || '');

    const historyBefore = FC.projectDomainOperations.readHistory();
    let plannedHistory = Array.isArray(options.historyRows) ? options.historyRows : historyBefore;
    if(syncSelection){
      const selection = FC.quoteSnapshotStore.previewSelection('syncSelectionForProjectStatus',[projectId,nextStatus,targetRoomIds.length ? {roomIds:targetRoomIds} : undefined],plannedHistory);
      plannedHistory = selection.rows;
    }

    const releasedRoomIds = [];
    if(syncSelection){
      historyBefore.filter(row=>String(row.project && row.project.id) === projectId && row.meta && row.meta.selectedByClient).forEach(row=>{
        const after = plannedHistory.find(item=>item.id === row.id);
        const ids = getSnapshotRoomIds(row);
        if(after && !(after.meta && after.meta.selectedByClient) && ids.some(id=>targetRoomIds.includes(id)))
          ids.filter(id=>!targetRoomIds.includes(id)).forEach(id=>{if(!releasedRoomIds.includes(id)) releasedRoomIds.push(id);});
      });
    }
    const investor = getSelectedInvestor(investorId);
    const loadedProject = projectRecord && projectRecord.projectData;
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
      historyRows:plannedHistory,
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


    const masterRoomIds = resolveAggregateScopeRoomIds(targetRoomIds, knownRoomIds);
    const masterStatus = resolveScopedMasterStatus(masterRoomIds, roomStatusMap, {
      fallbackStatus: nextStatus,
      projectRecord,
      loadedProject,
      allowMirrorFallback:false,
    });

    if(releasedRoomIds.length){
      const released = computeRecommendedRoomStatusMap(projectId,releasedRoomIds,currentStatusMap,{
        fallbackStatus:'nowy',preserveCurrentWhenNoQuoteRows:false,historyRows:plannedHistory,
      });
      releasedRoomIds.forEach(id=>{roomStatusMap[id] = released[id] === 'nowy' && manualStatusMap[id] ? manualStatusMap[id] : released[id];});
    }
    const affectedRoomIds = normalizeRoomIds(targetRoomIds.concat(releasedRoomIds));
    const result = persistStatusPlan(projectRecord,investor,roomStatusMap,manualStatusMap,affectedRoomIds,masterStatus,plannedHistory,options);
    if(result && result.ok){ result.roomIds = targetRoomIds; result.affectedRoomIds = affectedRoomIds; result.releasedRoomIds = releasedRoomIds; }
    if(result.ok && refreshUi && options.preview !== true) refreshStatusViews();
    return result;
  }

  function reconcileProjectStatuses(params){
    const options = params && typeof params === 'object' ? params : {};
    if(options.preview !== true && FC.session && FC.session.active) return {ok:false,reason:'active-session'};
    let projectId = String(options.projectId || getCurrentProjectId() || '');
    let investorId = String(options.investorId || getCurrentInvestorId() || '');
    let projectRecord = projectId ? getProjectRecordById(projectId) : null;
    if(!projectId && investorId) projectRecord = getProjectRecordByInvestorId(investorId);
    if(!projectId && projectRecord && projectRecord.id) projectId = String(projectRecord.id || '');
    if(!investorId && projectRecord && projectRecord.investorId) investorId = String(projectRecord.investorId || '');

    const investor = getSelectedInvestor(investorId);
    const loadedProject = projectRecord && projectRecord.projectData;
    const mergedRoomDefs = getMergedRoomDefs(projectRecord, loadedProject);
    const explicitRoomIds = normalizeRoomIds(options.roomIds);
    const knownRoomIds = options.restrictToRoomIds
      ? explicitRoomIds
      : getKnownProjectRoomIds(projectId, investor, loadedProject, explicitRoomIds);
    const currentStatusMap = getRoomStatusMap(knownRoomIds, {
      investorRooms: investor && investor.rooms,
      roomDefs: mergedRoomDefs,
    });
    const roomStatusMap = computeRecommendedRoomStatusMap(projectId, knownRoomIds, currentStatusMap, { fallbackStatus: options.fallbackStatus || 'nowy',historyRows:options.historyRows });
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

    const masterRoomIds = resolveAggregateScopeRoomIds(explicitRoomIds, knownRoomIds);
    const masterStatus = resolveScopedMasterStatus(masterRoomIds, roomStatusMap, {
      fallbackStatus: options.fallbackStatus || 'nowy',
      projectRecord,
      loadedProject,
      allowMirrorFallback:false,
    });
    const result = persistStatusPlan(projectRecord,investor,roomStatusMap,restoreManualStatusMap,knownRoomIds,masterStatus,options.historyRows,options);
    if(result.ok && options.refreshUi !== false && options.preview !== true) refreshStatusViews();
    return result;
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
    persistStatusPlan,
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
