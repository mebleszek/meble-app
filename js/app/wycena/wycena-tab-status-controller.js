(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  // Odpowiedzialność modułu: adapter akcji statusowych zakładki WYCENA; deps dostaje z cienkiego shellu.

  function createController(getDeps){
    const actions = FC.wycenaTabStatusActions || {};
    const deps = ()=> (typeof getDeps === 'function' ? (getDeps() || {}) : {});

    function getAllActiveRoomIds(){ return actions.getAllActiveRoomIds(deps()); }
    function getTargetRoomIdsFromSnapshot(snapshot){ return actions.getTargetRoomIdsFromSnapshot(snapshot, deps()); }
    function getComparableHistoryForSnapshot(snapshot, history){ return actions.getComparableHistoryForSnapshot(snapshot, history, deps()); }
    function isArchivedPreliminary(snapshot, history, projectStatus){ return actions.isArchivedPreliminary(snapshot, history, projectStatus, deps()); }

    function currentProjectStatus(snapshot){
      if(actions && typeof actions.currentProjectStatus === 'function') return actions.currentProjectStatus(snapshot, deps());
      const normalizeStatusKey = deps().normalizeStatusKey;
      return typeof normalizeStatusKey === 'function' ? normalizeStatusKey('') : '';
    }

    async function askConfirm(cfg){
      if(actions && typeof actions.askConfirm === 'function') return !!(await actions.askConfirm(cfg, deps()));
      return true;
    }

    function canAcceptSnapshot(snapshot, history){
      if(actions && typeof actions.canAcceptSnapshot === 'function') return !!actions.canAcceptSnapshot(snapshot, history, deps());
      return false;
    }

    function commitAcceptedSnapshotWithSync(snapshot, status, options){
      if(actions && typeof actions.commitAcceptedSnapshotWithSync === 'function') return actions.commitAcceptedSnapshotWithSync(snapshot, status, options, deps());
      return null;
    }

    function reconcileAfterSnapshotRemoval(snapshot, options){
      if(actions && typeof actions.reconcileAfterSnapshotRemoval === 'function') return actions.reconcileAfterSnapshotRemoval(snapshot, options, deps());
      return null;
    }

    function promotePreliminarySnapshotToFinal(snapshot, options){
      if(actions && typeof actions.promotePreliminarySnapshotToFinal === 'function') return actions.promotePreliminarySnapshotToFinal(snapshot, options, deps());
      return null;
    }

    async function acceptSnapshot(snapshot, ctx, options){
      if(actions && typeof actions.acceptSnapshot === 'function') return !!(await actions.acceptSnapshot(snapshot, ctx, options, deps()));
      return false;
    }

    function setProjectStatusFromSnapshot(snapshot, status, options){
      if(actions && typeof actions.setProjectStatusFromSnapshot === 'function') return actions.setProjectStatusFromSnapshot(snapshot, status, options, deps());
    }

    function syncGeneratedQuoteStatus(snapshot){
      if(actions && typeof actions.syncGeneratedQuoteStatus === 'function') return actions.syncGeneratedQuoteStatus(snapshot, deps());
    }

    return {
      getAllActiveRoomIds,
      getTargetRoomIdsFromSnapshot,
      getComparableHistoryForSnapshot,
      isArchivedPreliminary,
      currentProjectStatus,
      askConfirm,
      canAcceptSnapshot,
      commitAcceptedSnapshotWithSync,
      reconcileAfterSnapshotRemoval,
      promotePreliminarySnapshotToFinal,
      acceptSnapshot,
      setProjectStatusFromSnapshot,
      syncGeneratedQuoteStatus,
    };
  }

  FC.wycenaTabStatusController = Object.assign({}, FC.wycenaTabStatusController || {}, { createController });
})();
