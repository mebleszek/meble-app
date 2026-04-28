(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  // Odpowiedzialność modułu: cienki adapter statusów dla zakładki WYCENA.
  // Logika synchronizacji zostaje w wycena-tab-status-bridge/project-status-sync.

  function normalizeDeps(deps){ return deps && typeof deps === 'object' ? deps : {}; }
  function getBridge(){ return FC.wycenaTabStatusBridge || {}; }

  function currentProjectStatus(snapshot, deps){
    const d = normalizeDeps(deps);
    const bridge = getBridge();
    if(bridge && typeof bridge.currentProjectStatus === 'function'){
      try{
        return bridge.currentProjectStatus(snapshot, {
          normalizeSnapshot:d.normalizeSnapshot,
          normalizeStatusKey:d.normalizeStatusKey,
          getCurrentProjectId:d.getCurrentProjectId,
        });
      }catch(_){ }
    }
    return d.normalizeStatusKey ? d.normalizeStatusKey('') : '';
  }

  async function askConfirm(cfg){
    const bridge = getBridge();
    if(bridge && typeof bridge.askConfirm === 'function'){
      try{ return !!(await bridge.askConfirm(cfg)); }catch(_){ }
    }
    return true;
  }



  function getAllActiveRoomIds(deps){
    const d = normalizeDeps(deps);
    try{ return FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomIds === 'function' ? d.normalizeRoomIds(FC.roomRegistry.getActiveRoomIds()) : []; }catch(_){ return []; }
  }

  function getTargetRoomIdsFromSnapshot(snapshot, deps){
    const d = normalizeDeps(deps);
    const scoped = d.getSnapshotRoomIds(snapshot);
    if(scoped.length) return scoped;
    const active = getAllActiveRoomIds(d);
    return active.length === 1 ? active : [];
  }

  function getComparableHistoryForSnapshot(snapshot, history, deps){
    const d = normalizeDeps(deps);
    const list = Array.isArray(history) ? history : d.getSnapshotHistory();
    const targetRooms = d.getSnapshotRoomIds(snapshot);
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.sameRoomScope === 'function'){
        return list.filter((row)=> FC.quoteSnapshotStore.sameRoomScope(d.getSnapshotRoomIds(row), targetRooms));
      }
    }catch(_){ }
    return list.filter((row)=> {
      const rowRooms = d.getSnapshotRoomIds(row);
      if(rowRooms.length !== targetRooms.length) return false;
      return rowRooms.every((roomId, idx)=> roomId === targetRooms[idx]);
    });
  }

  function isArchivedPreliminary(snapshot, history, projectStatus, deps){
    const d = normalizeDeps(deps);
    if(!d.isPreliminarySnapshot(snapshot) || d.isRejectedSnapshot(snapshot)) return false;
    const list = getComparableHistoryForSnapshot(snapshot, history, d);
    const currentStatus = d.normalizeStatusKey(d.currentProjectStatus(snapshot));
    if(d.statusRank(currentStatus) < d.statusRank('wycena')) return false;
    if(list.some((row)=> !d.isPreliminarySnapshot(row) && !d.isRejectedSnapshot(row) && d.isSelectedSnapshot(row))) return true;
    const generatedAt = Number(snapshot && snapshot.generatedAt || 0);
    return list.some((row)=> !d.isPreliminarySnapshot(row) && !d.isRejectedSnapshot(row) && Number(row && row.generatedAt || 0) > generatedAt);
  }
  function canAcceptSnapshot(snapshot, history, deps){
    const d = normalizeDeps(deps);
    const bridge = getBridge();
    if(bridge && typeof bridge.canAcceptSnapshot === 'function'){
      try{
        return !!bridge.canAcceptSnapshot(snapshot, history, {
          normalizeSnapshot:d.normalizeSnapshot,
          getSnapshotId:d.getSnapshotId,
          isSelectedSnapshot:d.isSelectedSnapshot,
          isRejectedSnapshot:d.isRejectedSnapshot,
          getSnapshotHistory:d.getSnapshotHistory,
          getProjectStatusForHistory:d.getProjectStatusForHistory,
          isArchivedPreliminary:d.isArchivedPreliminary,
        });
      }catch(_){ }
    }
    return false;
  }

  function commitAcceptedSnapshotWithSync(snapshot, status, options, deps){
    const d = normalizeDeps(deps);
    const bridge = getBridge();
    if(bridge && typeof bridge.commitAcceptedSnapshotWithSync === 'function'){
      try{
        return bridge.commitAcceptedSnapshotWithSync(snapshot, status, options, {
          normalizeSnapshot:d.normalizeSnapshot,
          normalizeStatusKey:d.normalizeStatusKey,
        });
      }catch(_){ }
    }
    return null;
  }

  function reconcileAfterSnapshotRemoval(snapshot, options, deps){
    const d = normalizeDeps(deps);
    const bridge = getBridge();
    if(bridge && typeof bridge.reconcileAfterSnapshotRemoval === 'function'){
      try{ return bridge.reconcileAfterSnapshotRemoval(snapshot, options, { normalizeSnapshot:d.normalizeSnapshot }); }catch(_){ }
    }
    return null;
  }

  function promotePreliminarySnapshotToFinal(snapshot, options, deps){
    const d = normalizeDeps(deps);
    const bridge = getBridge();
    if(bridge && typeof bridge.promotePreliminarySnapshotToFinal === 'function'){
      try{ return bridge.promotePreliminarySnapshotToFinal(snapshot, options, { normalizeSnapshot:d.normalizeSnapshot }); }catch(_){ }
    }
    return null;
  }

  async function acceptSnapshot(snapshot, ctx, options, deps){
    const d = normalizeDeps(deps);
    const bridge = getBridge();
    if(bridge && typeof bridge.acceptSnapshot === 'function'){
      try{
        return !!(await bridge.acceptSnapshot(snapshot, ctx, options, {
          normalizeSnapshot:d.normalizeSnapshot,
          normalizeStatusKey:d.normalizeStatusKey,
          getSnapshotId:d.getSnapshotId,
          getSnapshotHistory:d.getSnapshotHistory,
          isSelectedSnapshot:d.isSelectedSnapshot,
          isRejectedSnapshot:d.isRejectedSnapshot,
          isPreliminarySnapshot:d.isPreliminarySnapshot,
          rememberQuoteScroll:d.rememberQuoteScroll,
          clearRememberedQuoteScroll:d.clearRememberedQuoteScroll,
          render:d.render,
          setHistoryPreviewState:d.setHistoryPreviewState,
          getProjectStatusForHistory:d.getProjectStatusForHistory,
          isArchivedPreliminary:d.isArchivedPreliminary,
          canAcceptSnapshot:d.canAcceptSnapshot,
          commitAcceptedSnapshotWithSync:d.commitAcceptedSnapshotWithSync,
        }));
      }catch(_){ }
    }
    return false;
  }

  function setProjectStatusFromSnapshot(snapshot, status, options, deps){
    const d = normalizeDeps(deps);
    const bridge = getBridge();
    if(bridge && typeof bridge.setProjectStatusFromSnapshot === 'function'){
      try{
        return bridge.setProjectStatusFromSnapshot(snapshot, status, options, {
          normalizeSnapshot:d.normalizeSnapshot,
          normalizeStatusKey:d.normalizeStatusKey,
          getCurrentProjectId:d.getCurrentProjectId,
          getCurrentInvestorId:d.getCurrentInvestorId,
          getTargetRoomIdsFromSnapshot:d.getTargetRoomIdsFromSnapshot,
        });
      }catch(_){ }
    }
  }

  function syncGeneratedQuoteStatus(snapshot, deps){
    const d = normalizeDeps(deps);
    const bridge = getBridge();
    if(bridge && typeof bridge.syncGeneratedQuoteStatus === 'function'){
      try{
        return bridge.syncGeneratedQuoteStatus(snapshot, {
          normalizeSnapshot:d.normalizeSnapshot,
          isPreliminarySnapshot:d.isPreliminarySnapshot,
          statusRank:d.statusRank,
          currentProjectStatus:d.currentProjectStatus,
          setProjectStatusFromSnapshot:d.setProjectStatusFromSnapshot,
        });
      }catch(_){ }
    }
  }

  FC.wycenaTabStatusActions = {
    currentProjectStatus,
    askConfirm,
    getAllActiveRoomIds,
    getTargetRoomIdsFromSnapshot,
    getComparableHistoryForSnapshot,
    isArchivedPreliminary,
    canAcceptSnapshot,
    commitAcceptedSnapshotWithSync,
    reconcileAfterSnapshotRemoval,
    promotePreliminarySnapshotToFinal,
    acceptSnapshot,
    setProjectStatusFromSnapshot,
    syncGeneratedQuoteStatus,
  };
})();
