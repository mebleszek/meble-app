(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const statusScope = FC.projectStatusScope || {};

  // Odpowiedzialność modułu: workflow snapshotów ofertowych powiązanych ze statusem.
  // Moduł rozszerza publiczne FC.projectStatusSync, ale nie wylicza samodzielnie
  // mapy statusów i nie zapisuje luster — deleguje to do silnika statusów.

  const normalizeStatus = (FC.projectStatusSync && FC.projectStatusSync.normalizeStatus)
    || statusScope.normalizeStatus
    || ((value)=> String(value || '').trim().toLowerCase());
  const normalizeRoomIds = (FC.projectStatusSync && FC.projectStatusSync.normalizeRoomIds)
    || statusScope.normalizeRoomIds
    || ((roomIds)=> Array.isArray(roomIds) ? Array.from(new Set(roomIds.map((item)=> String(item || '').trim()).filter(Boolean))) : []);
  const getCurrentProjectId = statusScope.getCurrentProjectId || (()=> '');
  const getCurrentInvestorId = statusScope.getCurrentInvestorId || (()=> '');
  const getTargetRoomIdsFromSnapshot = (FC.projectStatusSync && FC.projectStatusSync.getTargetRoomIdsFromSnapshot)
    || statusScope.getTargetRoomIdsFromSnapshot
    || (()=> []);
  const normalizeSnapshot = statusScope.normalizeSnapshot || ((snapshot)=> snapshot || null);

  function setStatusFromSnapshot(snapshot, status, options){
    if(FC.projectStatusSync && typeof FC.projectStatusSync.setStatusFromSnapshot === 'function'){
      return FC.projectStatusSync.setStatusFromSnapshot(snapshot, status, options);
    }
    return null;
  }

  function reconcileProjectStatuses(options){
    if(FC.projectStatusSync && typeof FC.projectStatusSync.reconcileProjectStatuses === 'function'){
      return FC.projectStatusSync.reconcileProjectStatuses(options);
    }
    return null;
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

  const api = {
    commitAcceptedSnapshot,
    reconcileStatusAfterSnapshotRemoval,
    promotePreliminarySnapshotToFinal,
  };

  FC.projectStatusSnapshotFlow = api;
  FC.projectStatusSync = FC.projectStatusSync || {};
  Object.assign(FC.projectStatusSync, api);
})();
