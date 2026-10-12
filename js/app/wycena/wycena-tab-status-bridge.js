(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function normalizeOptions(value){
    return value && typeof value === 'object' ? value : {};
  }

  function warnMissingProjectStatusSync(){
    try{
      if(!warnMissingProjectStatusSync._done && typeof console !== 'undefined' && console && typeof console.warn === 'function'){
        warnMissingProjectStatusSync._done = true;
        console.warn('[Wycena] Brak FC.projectStatusSync — używam ograniczonego fallbacku statusów.');
      }
    }catch(_){ }
  }

  function warnMissingProjectStatusSyncMethod(methodName){
    const name = String(methodName || '').trim();
    if(!name) return;
    try{
      const warned = warnMissingProjectStatusSyncMethod._warned || (warnMissingProjectStatusSyncMethod._warned = Object.create(null));
      if(warned[name]) return;
      warned[name] = true;
      if(typeof console !== 'undefined' && console && typeof console.warn === 'function'){
        console.warn(`[Wycena] Brak FC.projectStatusSync.${name} — pomijam stary fallback lokalnego zapisu statusów.`);
      }
    }catch(_){ }
  }

  function currentProjectStatus(snapshot, deps){
    const d = normalizeOptions(deps);
    try{
      if(FC.projectStatusSync && typeof FC.projectStatusSync.resolveCurrentProjectStatus === 'function'){
        return d.normalizeStatusKey(FC.projectStatusSync.resolveCurrentProjectStatus(snapshot));
      }
    }catch(_){ }
    warnMissingProjectStatusSync();
    const snap = d.normalizeSnapshot(snapshot) || {};
    const projectId = String(snap && snap.project && snap.project.id || (typeof d.getCurrentProjectId === 'function' ? d.getCurrentProjectId() : '') || '');
    try{
      if(projectId && FC.projectStore && typeof FC.projectStore.getById === 'function'){
        const projectRecord = FC.projectStore.getById(projectId);
        if(projectRecord && projectRecord.status) return d.normalizeStatusKey(projectRecord.status);
      }
    }catch(_){ }
    return d.normalizeStatusKey(snap && snap.project && snap.project.status || '');
  }

  async function askConfirm(cfg){
    try{
      if(FC.confirmBox && typeof FC.confirmBox.ask === 'function') return !!(await FC.confirmBox.ask(cfg));
    }catch(_){ }
    return true;
  }

  function canAcceptSnapshot(snapshot, history, deps){
    const d = normalizeOptions(deps);
    const snap = d.normalizeSnapshot(snapshot) || null;
    if(!snap || !d.getSnapshotId(snap)) return false;
    if(d.isSelectedSnapshot(snap) || d.isRejectedSnapshot(snap)) return false;
    const list = Array.isArray(history) ? history : d.getSnapshotHistory();
    const projectStatus = d.getProjectStatusForHistory(list);
    return !d.isArchivedPreliminary(snap, list, projectStatus);
  }

  function commitAcceptedSnapshotWithSync(snapshot, status, options, deps){
    const d = normalizeOptions(deps);
    const snap = d.normalizeSnapshot(snapshot) || null;
    const nextStatus = d.normalizeStatusKey(status);
    if(!snap || !nextStatus) return null;
    try{
      if(FC.projectStatusSync && typeof FC.projectStatusSync.commitAcceptedSnapshot === 'function'){
        return FC.projectStatusSync.commitAcceptedSnapshot(snap, nextStatus, normalizeOptions(options));
      }
    }catch(_){ }
    warnMissingProjectStatusSyncMethod('commitAcceptedSnapshot');
    return null;
  }

  function reconcileAfterSnapshotRemoval(snapshot, options, deps){
    const d = normalizeOptions(deps);
    const snap = d.normalizeSnapshot(snapshot) || null;
    if(!snap) return null;
    try{
      if(FC.projectStatusSync && typeof FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval === 'function'){
        return FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval(snap, normalizeOptions(options));
      }
    }catch(_){ }
    warnMissingProjectStatusSyncMethod('reconcileStatusAfterSnapshotRemoval');
    return null;
  }

  function promotePreliminarySnapshotToFinal(snapshot, options, deps){
    const d = normalizeOptions(deps);
    const snap = d.normalizeSnapshot(snapshot) || null;
    if(!snap) return null;
    try{
      if(FC.projectStatusSync && typeof FC.projectStatusSync.promotePreliminarySnapshotToFinal === 'function'){
        return FC.projectStatusSync.promotePreliminarySnapshotToFinal(snap, normalizeOptions(options));
      }
    }catch(_){ }
    warnMissingProjectStatusSyncMethod('promotePreliminarySnapshotToFinal');
    return null;
  }

  async function acceptSnapshot(snapshot, ctx, options, deps){
    const d = normalizeOptions(deps);
    const snap = d.normalizeSnapshot(snapshot) || null;
    if(!snap) return false;
    const snapId = d.getSnapshotId(snap);
    const opts = normalizeOptions(options);
    const history = Array.isArray(opts.history) ? opts.history : d.getSnapshotHistory();
    if(!canAcceptSnapshot(snap, history, d)) return false;
    const targetStatus = d.isPreliminarySnapshot(snap) ? 'pomiar' : 'zaakceptowany';
    if(opts.rememberScroll && typeof d.rememberQuoteScroll === 'function') d.rememberQuoteScroll(String(opts.anchorId || ''), String(opts.fallbackAnchorId || ''));
    const impact = FC.projectStatusSnapshotFlow && FC.projectStatusSnapshotFlow.getAcceptanceImpact(snap);
    const scopeNote = impact ? '\n\nZakres: '+impact.roomIds.join(', ')+(impact.releasedRoomIds.length ? '\nRozpięcie poprzedniej wspólnej oferty przywróci statusy: '+impact.releasedRoomIds.join(', ') : '') : '';
    const confirmed = await askConfirm({
      title:'OZNACZYĆ OFERTĘ?',
      message:(d.isPreliminarySnapshot(snap)
        ? 'Ta wersja zostanie zaakceptowana, a status projektu zmieni się na „Pomiar”.'
        : 'Ta wersja zostanie zaakceptowana, a status projektu zmieni się na „Zaakceptowany”.')+scopeNote,
      confirmText:'Zaakceptuj ofertę',
      cancelText:'Wróć',
      confirmTone:'success',
      cancelTone:'neutral'
    });
    if(!confirmed){
      if(opts.rememberScroll && typeof d.clearRememberedQuoteScroll === 'function') d.clearRememberedQuoteScroll();
      return false;
    }
    const commitResult = commitAcceptedSnapshotWithSync(snap, targetStatus, undefined, d);
    if(!(commitResult && commitResult.ok === true)) return false;
    const selected = commitResult && (commitResult.selectedSnapshot || commitResult.snapshot) || null;
    if(!selected) return false;
    if(typeof d.setHistoryPreviewState === 'function'){
      d.setHistoryPreviewState({
        previewSnapshotId: snapId,
        lastQuote: selected,
      });
    }
    if(typeof d.render === 'function') d.render(ctx);
    return true;
  }

  function setProjectStatusFromSnapshot(snapshot, status, options, deps){
    const d = normalizeOptions(deps);
    const snap = d.normalizeSnapshot(snapshot) || {};
    const nextStatus = d.normalizeStatusKey(status);
    if(!nextStatus) return;
    try{
      if(FC.projectStatusSync && typeof FC.projectStatusSync.setStatusFromSnapshot === 'function'){
        return FC.projectStatusSync.setStatusFromSnapshot(snap, nextStatus, normalizeOptions(options));
      }
    }catch(_){ }

    // A missing or failed confirmed service cannot degrade to independent mirror/history writes.
    warnMissingProjectStatusSync();
    return {ok:false,reason:'confirmed-status-service-unavailable'};
  }

  function syncGeneratedQuoteStatus(snapshot, deps){
    const d = normalizeOptions(deps);
    const snap = d.normalizeSnapshot(snapshot);
    if(!snap || !snap.project) return;
    const preliminary = d.isPreliminarySnapshot(snap);
    const targetStatus = preliminary ? 'wstepna_wycena' : 'wycena';
    const currentStatus = currentProjectStatus(snap, d);
    if(d.statusRank(currentStatus) > d.statusRank(targetStatus)) return;
    setProjectStatusFromSnapshot(snap, targetStatus, { syncSelection:true }, d);
  }

  FC.wycenaTabStatusBridge = Object.assign({}, FC.wycenaTabStatusBridge || {}, {
    currentProjectStatus,
    askConfirm,
    canAcceptSnapshot,
    commitAcceptedSnapshotWithSync,
    reconcileAfterSnapshotRemoval,
    promotePreliminarySnapshotToFinal,
    acceptSnapshot,
    setProjectStatusFromSnapshot,
    syncGeneratedQuoteStatus,
  });
})();
