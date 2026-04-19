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
    const confirmed = await askConfirm({
      title:'OZNACZYĆ OFERTĘ?',
      message:d.isPreliminarySnapshot(snap)
        ? 'Ta wersja zostanie zaakceptowana, a status projektu zmieni się na „Pomiar”.'
        : 'Ta wersja zostanie zaakceptowana, a status projektu zmieni się na „Zaakceptowany”.',
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
        FC.projectStatusSync.setStatusFromSnapshot(snap, nextStatus, normalizeOptions(options));
        return;
      }
    }catch(_){ }

    warnMissingProjectStatusSync();
    const opts = normalizeOptions(options);
    const syncSelection = !!opts.syncSelection;
    const projectId = String(snap && snap.project && snap.project.id || (typeof d.getCurrentProjectId === 'function' ? d.getCurrentProjectId() : '') || '');
    const investorId = String(
      snap && snap.investor && snap.investor.id
      || snap && snap.project && snap.project.investorId
      || (typeof d.getCurrentInvestorId === 'function' ? d.getCurrentInvestorId() : '')
      || ''
    );
    const targetRoomIds = d.getTargetRoomIdsFromSnapshot(snap);

    if(syncSelection){
      try{
        if(projectId && FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.syncSelectionForProjectStatus === 'function'){
          FC.quoteSnapshotStore.syncSelectionForProjectStatus(projectId, nextStatus, targetRoomIds.length ? { roomIds:targetRoomIds } : undefined);
        }
      }catch(_){ }
    }

    try{
      if(investorId && targetRoomIds.length && FC.investorPersistence && typeof FC.investorPersistence.updateInvestorRoom === 'function'){
        targetRoomIds.forEach((roomId)=> {
          const key = String(roomId || '');
          if(key) FC.investorPersistence.updateInvestorRoom(investorId, key, { projectStatus:nextStatus });
        });
      }
    }catch(_){ }

    try{
      if(projectId && FC.projectStore && typeof FC.projectStore.getById === 'function' && typeof FC.projectStore.upsert === 'function'){
        const record = FC.projectStore.getById(projectId) || (typeof FC.projectStore.getCurrentRecord === 'function' ? FC.projectStore.getCurrentRecord() : null);
        if(record) FC.projectStore.upsert(Object.assign({}, record, { status:nextStatus, updatedAt:Date.now() }));
      }
    }catch(_){ }

    try{
      if(FC.project && typeof FC.project.save === 'function'){
        const proj = FC.project.load ? (FC.project.load() || {}) : {};
        const meta = proj && proj.meta && typeof proj.meta === 'object' ? proj.meta : null;
        if(meta){
          meta.projectStatus = nextStatus;
          if(meta.roomDefs && typeof meta.roomDefs === 'object'){
            targetRoomIds.forEach((roomId)=> {
              const key = String(roomId || '');
              const row = meta.roomDefs[key];
              if(row && typeof row === 'object') meta.roomDefs[key] = Object.assign({}, row, { projectStatus:nextStatus });
            });
          }
          FC.project.save(proj);
        }
      }
    }catch(_){ }

    try{ if(FC.views && typeof FC.views.refreshSessionButtons === 'function') FC.views.refreshSessionButtons(); }catch(_){ }
    try{ if(FC.investorUI && typeof FC.investorUI.render === 'function') FC.investorUI.render(); }catch(_){ }
    try{ if(FC.roomRegistry && typeof FC.roomRegistry.renderRoomsView === 'function') FC.roomRegistry.renderRoomsView(); }catch(_){ }
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
