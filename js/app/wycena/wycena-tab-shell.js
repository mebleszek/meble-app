(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  // Odpowiedzialność modułu: shell/render głównej zakładki WYCENA oraz akcje topbara.
  // Nie przechowuje stanu samodzielnie — stan dostaje przez getState/setState z tabs/wycena.js.

  function normalizeDeps(deps){ return deps && typeof deps === 'object' ? deps : {}; }
  function getFn(deps, key, fallback){ return deps && typeof deps[key] === 'function' ? deps[key] : fallback; }

  function showQuoteValidationError(err){
    try{
      if(FC.infoBox && typeof FC.infoBox.open === 'function'){
        FC.infoBox.open({
          title:String(err && err.title || 'Nie można utworzyć wyceny'),
          message:String(err && err.message || 'Nie udało się utworzyć wyceny.'),
          okOnly:true,
          dismissOnOverlay:false,
          dismissOnEsc:false,
        });
      }
    }catch(_){ }
  }

  const GENERATE_DEDUP_WINDOW_MS = 1500;
  const GENERATE_RELEASE_DEDUP_WINDOW_MS = 1200;
  const generateRuntime = { inFlight:false, lastAcceptedAt:0, lastReleasedAt:0 };

  function recordGenerateSkip(reason, extra){
    try{
      if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.recordGenerateButtonEvent === 'function'){
        FC.wycenaDiagnostics.recordGenerateButtonEvent(reason || 'generate-skipped');
      }
      if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.recordRenderEvent === 'function'){
        FC.wycenaDiagnostics.recordRenderEvent(reason || 'generate-skipped', Object.assign({ skipped:true }, extra || {}));
      }
    }catch(_){ }
  }

  function acquireGenerateLock(source){
    const now = Date.now();
    if(generateRuntime.inFlight){
      recordGenerateSkip('generate-skipped-in-flight', { source:String(source || ''), lastAcceptedAt:generateRuntime.lastAcceptedAt });
      return false;
    }
    if(generateRuntime.lastAcceptedAt && now - generateRuntime.lastAcceptedAt < GENERATE_DEDUP_WINDOW_MS){
      recordGenerateSkip('generate-skipped-duplicate-event', { source:String(source || ''), deltaMs:now - generateRuntime.lastAcceptedAt, windowMs:GENERATE_DEDUP_WINDOW_MS });
      return false;
    }
    if(generateRuntime.lastReleasedAt && now - generateRuntime.lastReleasedAt < GENERATE_RELEASE_DEDUP_WINDOW_MS){
      recordGenerateSkip('generate-skipped-after-release-click', { source:String(source || ''), deltaMs:now - generateRuntime.lastReleasedAt, windowMs:GENERATE_RELEASE_DEDUP_WINDOW_MS });
      return false;
    }
    generateRuntime.inFlight = true;
    generateRuntime.lastAcceptedAt = now;
    return true;
  }

  function releaseGenerateLock(){
    generateRuntime.inFlight = false;
    generateRuntime.lastReleasedAt = Date.now();
  }

  function getSnapshotIdFromQuote(snapshot){
    return String(snapshot && (snapshot.id || snapshot.snapshotId) || '').trim();
  }

  function isSnapshotStorageError(err){
    const code = String(err && err.code || '').trim();
    const message = String(err && err.message || err || '');
    return code === 'quote_snapshot_storage_write_failed'
      || code === 'quote_snapshot_not_visible_after_save'
      || message.indexOf('Nie udało się zapisać historii WYCENY') !== -1
      || message.indexOf('Snapshot WYCENY został zbudowany, ale nie jest widoczny') !== -1
      || message.indexOf('Historia WYCENY nie została poprawnie zapisana') !== -1;
  }

  function buildUnsavedStoragePreviewQuote(snapshot, err){
    const warning = 'Wycena została policzona, ale nie zapisała się w historii. Prawdopodobnie magazyn przeglądarki jest pełny albo zawiera zbyt ciężkie stare dane. Wynik poniżej jest tylko podglądem do sprawdzenia.';
    let out = snapshot && typeof snapshot === 'object' ? snapshot : null;
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.normalizeSnapshot === 'function'){
        out = FC.quoteSnapshotStore.normalizeSnapshot(out || {}, { preserveExplicitLabels:true });
      }
    }catch(_){
      try{ out = JSON.parse(JSON.stringify(out || {})); }catch(__){ out = {}; }
    }
    if(!out || typeof out !== 'object') out = {};
    if(!String(out.id || '').trim()) out.id = 'unsaved_quote_' + Date.now();
    out.meta = Object.assign({}, out.meta || {}, {
      unsavedDueToStorage:true,
      storageWarning:warning,
      storageErrorCode:String(err && err.code || ''),
      storageErrorMessage:String(err && err.message || err || 'błąd zapisu historii'),
    });
    out.__unsavedDueToStorage = true;
    out.__storageErrorMessage = String(err && err.message || err || 'błąd zapisu historii');
    return out;
  }


  function buildUnsavedQuoteSnapshot(selection){
    if(!(FC.wycenaCore && typeof FC.wycenaCore.collectQuoteData === 'function')) throw new Error('Brak FC.wycenaCore.collectQuoteData');
    if(!(FC.quoteSnapshot && typeof FC.quoteSnapshot.buildSnapshot === 'function')) throw new Error('Brak FC.quoteSnapshot.buildSnapshot');
    return Promise.resolve(FC.wycenaCore.collectQuoteData({ selection })).then((data)=> FC.quoteSnapshot.buildSnapshot(data));
  }

  function saveQuoteSnapshot(snapshot){
    if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.save === 'function') return FC.quoteSnapshotStore.save(snapshot);
    if(FC.quoteSnapshot && typeof FC.quoteSnapshot.saveSnapshot === 'function') return FC.quoteSnapshot.saveSnapshot(snapshot);
    return snapshot;
  }

  function getVersionName(snapshot){
    return String(snapshot && (snapshot.commercial && snapshot.commercial.versionName || snapshot.meta && snapshot.meta.versionName) || '').trim();
  }

  function summarizeDuplicateSnapshot(snapshot){
    const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
    return {
      id:String(snap.id || snap.snapshotId || ''),
      versionName:getVersionName(snap),
      projectId:String(snap.project && snap.project.id || ''),
      investorId:String(snap.investor && snap.investor.id || snap.project && snap.project.investorId || ''),
      selectedRooms:Array.isArray(snap.scope && snap.scope.selectedRooms) ? snap.scope.selectedRooms.slice() : [],
      materialScope:snap.scope && snap.scope.materialScope || null,
      preliminary:!!(snap.meta && snap.meta.preliminary || snap.commercial && snap.commercial.preliminary),
      grand:snap.totals && snap.totals.grand,
      generatedAt:snap.generatedAt || null,
    };
  }


  function getDuplicateModalPayload(duplicate, candidate){
    return {
      title:'TAKA SAMA OFERTA JUŻ ISTNIEJE',
      message:'Nie utworzono nowej oferty, bo identyczna wycena już istnieje dla tego samego projektu, zakresu i ustawień. Istniejąca oferta została podświetlona w historii. Możesz zostawić ją bez zmian albo zastąpić świeżo przeliczoną wersją.',
      confirmText:'Zamień istniejącą',
      cancelText:'Anuluj',
      confirmTone:'success',
      cancelTone:'danger',
      dismissOnOverlay:false,
      dismissOnEsc:false,
      duplicate:summarizeDuplicateSnapshot(duplicate),
      candidate:summarizeDuplicateSnapshot(candidate),
    };
  }

  async function askDuplicateDecision(duplicate, candidate, deps){
    const d = normalizeDeps(deps);
    const payload = getDuplicateModalPayload(duplicate, candidate);
    try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('duplicateModalShown', { duplicate:payload.duplicate, candidate:payload.candidate }); }catch(_){ }
    try{
      if(FC.choiceBox && typeof FC.choiceBox.ask === 'function'){
        const result = await FC.choiceBox.ask({
          title:payload.title,
          message:payload.message,
          dismissValue:'cancel',
          dismissOnOverlay:false,
          dismissOnEsc:false,
          actions:[
            { value:'cancel', text:'Anuluj', tone:'danger' },
            { value:'replace', text:'Zamień istniejącą', tone:'success' },
          ],
        });
        const decision = result === 'replace' ? 'replace' : 'cancel';
        try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('duplicateModalDecision', { decision, source:'choiceBox' }); }catch(_){ }
        return decision;
      }
    }catch(err){
      try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('duplicateModalError', { source:'choiceBox', message:String(err && err.message || err || 'błąd') }); }catch(_){ }
    }
    try{
      if(FC.confirmBox && typeof FC.confirmBox.ask === 'function'){
        const ok = !!(await FC.confirmBox.ask(payload));
        const decision = ok ? 'replace' : 'cancel';
        try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('duplicateModalDecision', { decision, source:'confirmBox' }); }catch(_){ }
        return decision;
      }
    }catch(err){
      try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('duplicateModalError', { source:'confirmBox', message:String(err && err.message || err || 'błąd') }); }catch(_){ }
    }
    try{
      if(typeof d.askConfirm === 'function'){
        const ok = !!(await d.askConfirm(payload));
        const decision = ok ? 'replace' : 'cancel';
        try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('duplicateModalDecision', { decision, source:'deps.askConfirm' }); }catch(_){ }
        return decision;
      }
    }catch(err){
      try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('duplicateModalError', { source:'deps.askConfirm', message:String(err && err.message || err || 'błąd') }); }catch(_){ }
    }
    try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('duplicateModalUnavailable', { decision:'cancel' }); }catch(_){ }
    return 'cancel';
  }

  async function handleDuplicateSnapshot(candidate, selection, ctx, deps){
    const d = normalizeDeps(deps);
    if(!(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.findDuplicateSnapshot === 'function')) return null;
    const duplicate = FC.quoteSnapshotStore.findDuplicateSnapshot(candidate, { includeRejected:false });
    if(!duplicate) return null;
    const duplicateId = getSnapshotIdFromQuote(duplicate);
    try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('duplicateFound', { duplicate:summarizeDuplicateSnapshot(duplicate), candidate:summarizeDuplicateSnapshot(candidate) }); }catch(_){ }
    if(duplicateId && typeof d.setState === 'function'){
      d.setState({ lastQuote:duplicate, previewSnapshotId:duplicateId, shouldScrollToPreview:true });
      try{ if(typeof d.render === 'function') d.render(ctx); }catch(_){ }
    }
    const decision = await askDuplicateDecision(duplicate, candidate, d);
    const replace = decision === 'replace';
    if(!replace){
      try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('duplicateCancelled', { duplicateId }); }catch(_){ }
      return { handled:true, cancelled:true, snapshot:duplicate, duplicate };
    }
    let replaced = null;
    if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.replaceSnapshot === 'function') replaced = FC.quoteSnapshotStore.replaceSnapshot(duplicateId, candidate);
    else {
      const next = Object.assign({}, candidate || {}, { id:duplicateId });
      replaced = saveQuoteSnapshot(next);
    }
    const replacedId = getSnapshotIdFromQuote(replaced) || duplicateId;
    try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('duplicateReplaced', { duplicateId, replaced:summarizeDuplicateSnapshot(replaced) }); }catch(_){ }
    if(typeof d.setState === 'function') d.setState({ lastQuote:replaced, previewSnapshotId:replacedId, shouldScrollToPreview:true });
    return { handled:true, replaced:true, snapshot:replaced, duplicate };
  }

  function ensureSnapshotVisibleInStore(snapshot){
    let current = snapshot || null;
    let id = getSnapshotIdFromQuote(current);
    if(!current || current.error || !id) return current;
    try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function' && typeof FC.wycenaDiagnostics.summarizeSnapshotStoreForId === 'function') FC.wycenaDiagnostics.markGenerateTrace('snapshotStoreBeforeEnsure', FC.wycenaDiagnostics.summarizeSnapshotStoreForId(id)); }catch(_){ }
    try{
      const existing = FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getById === 'function'
        ? FC.quoteSnapshotStore.getById(id)
        : null;
      if(existing){
        try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function' && typeof FC.wycenaDiagnostics.summarizeSnapshotStoreForId === 'function') FC.wycenaDiagnostics.markGenerateTrace('snapshotAlreadyVisibleInStore', FC.wycenaDiagnostics.summarizeSnapshotStoreForId(id)); }catch(_){ }
        return existing;
      }
    }catch(_){ }
    try{
      if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('snapshotSaveRetry', { id });
    }catch(_){ }
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.save === 'function'){
        current = FC.quoteSnapshotStore.save(current) || current;
        id = getSnapshotIdFromQuote(current) || id;
      }
    }catch(err){
      try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('snapshotSaveRetryError', { id, message:String(err && err.message || err || 'błąd'), code:String(err && err.code || '') }); }catch(_){ }
      throw err;
    }
    try{
      const visible = FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getById === 'function'
        ? !!FC.quoteSnapshotStore.getById(id)
        : false;
      if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('snapshotVisibleInStore', { id, visible });
      if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function' && typeof FC.wycenaDiagnostics.summarizeSnapshotStoreForId === 'function') FC.wycenaDiagnostics.markGenerateTrace('snapshotStoreAfterEnsure', FC.wycenaDiagnostics.summarizeSnapshotStoreForId(id));
      if(!visible){
        const err = new Error('Snapshot WYCENY został policzony, ale nie zapisał się w historii.');
        err.code = 'quote_snapshot_not_visible_after_save';
        err.details = { id };
        throw err;
      }
    }catch(err){
      if(err && err.code === 'quote_snapshot_not_visible_after_save') throw err;
    }
    return current;
  }

  async function generateQuote(ctx, deps, meta){
    const d = normalizeDeps(deps);
    const source = meta && meta.source || '';
    if(!acquireGenerateLock(source || 'generateQuote')) return;
    const state = typeof d.getState === 'function' ? d.getState() : {};
    if(state.isBusy){
      recordGenerateSkip('generate-ignored-busy', { source:String(source || '') });
      releaseGenerateLock();
      return;
    }
    if(typeof d.setState === 'function') d.setState({ isBusy:true });
    try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.beginGenerateTrace === 'function') FC.wycenaDiagnostics.beginGenerateTrace('generateQuote'); }catch(_){ }
    if(typeof d.render === 'function') d.render(ctx);
    try{
      const contextRepair = FC.wycenaContextRepair && typeof FC.wycenaContextRepair.repairActiveQuoteContext === 'function'
        ? FC.wycenaContextRepair.repairActiveQuoteContext({ reason:'generate' })
        : { ok:true };
      try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('contextRepair', { ok:contextRepair && contextRepair.ok, code:contextRepair && contextRepair.code, investorId:contextRepair && contextRepair.investorId, projectId:contextRepair && contextRepair.projectId, activeRoomIds:contextRepair && contextRepair.activeRoomIds, selectedRooms:contextRepair && contextRepair.selectedRooms, repairs:contextRepair && contextRepair.repairs, hadProjectContent:contextRepair && contextRepair.hadProjectContent }); }catch(_){ }
      if(contextRepair && contextRepair.ok === false){
        if(typeof d.setState === 'function'){
          const errorQuote = FC.wycenaContextRepair && typeof FC.wycenaContextRepair.buildErrorQuote === 'function'
            ? FC.wycenaContextRepair.buildErrorQuote(contextRepair)
            : { error:String(contextRepair.message || 'Błąd kontekstu WYCENY'), totals:{ materials:0, accessories:0, services:0, quoteRates:0, subtotal:0, discount:0, grand:0 }, roomLabels:[] };
          d.setState({ lastQuote:errorQuote, previewSnapshotId:'', shouldScrollToPreview:true });
        }
        try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.endGenerateTrace === 'function') FC.wycenaDiagnostics.endGenerateTrace({ stopped:'context-repair-failed', code:contextRepair && contextRepair.code }); }catch(_){ }
        return;
      }
      const selection = d.normalizeDraftSelection(d.getOfferDraft());
      try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('selection', selection); }catch(_){ }
      let preflightQuote = await buildUnsavedQuoteSnapshot(selection);
      try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('preflightQuoteBuilt', { hasQuote:!!preflightQuote, id:preflightQuote && (preflightQuote.id || preflightQuote.snapshotId), totals:preflightQuote && preflightQuote.totals, versionName:getVersionName(preflightQuote) }); }catch(_){ }
      const duplicateBeforeNaming = await handleDuplicateSnapshot(preflightQuote, selection, ctx, d);
      if(duplicateBeforeNaming && duplicateBeforeNaming.handled){
        const snap = duplicateBeforeNaming.snapshot || null;
        const snapId = getSnapshotIdFromQuote(snap);
        if(snap && !duplicateBeforeNaming.cancelled){
          d.syncGeneratedQuoteStatus(snap);
          let liveStatus = '';
          try{ liveStatus = d.getProjectStatusForHistory(d.getSnapshotHistory()); }catch(_){ }
          if(typeof d.setState === 'function') d.setState({ lastQuote:snap, previewSnapshotId:snapId, shouldScrollToPreview:true, lastKnownProjectStatus:liveStatus });
        }
        try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.endGenerateTrace === 'function') FC.wycenaDiagnostics.endGenerateTrace({ ok:true, duplicate:true, cancelled:!!duplicateBeforeNaming.cancelled, replaced:!!duplicateBeforeNaming.replaced, id:snapId }); }catch(_){ }
        return;
      }
      const naming = await d.ensureVersionNameBeforeGenerate(selection);
      try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('naming', naming); }catch(_){ }
      if(naming && naming.cancelled){ try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.endGenerateTrace === 'function') FC.wycenaDiagnostics.endGenerateTrace({ stopped:'version-name-cancelled' }); }catch(_){ } return; }
      let nextQuote = await buildUnsavedQuoteSnapshot(selection);
      const duplicateAfterNaming = await handleDuplicateSnapshot(nextQuote, selection, ctx, d);
      if(duplicateAfterNaming && duplicateAfterNaming.handled){
        const snap = duplicateAfterNaming.snapshot || null;
        const snapId = getSnapshotIdFromQuote(snap);
        if(snap && !duplicateAfterNaming.cancelled){
          d.syncGeneratedQuoteStatus(snap);
          let liveStatus = '';
          try{ liveStatus = d.getProjectStatusForHistory(d.getSnapshotHistory()); }catch(_){ }
          if(typeof d.setState === 'function') d.setState({ lastQuote:snap, previewSnapshotId:snapId, shouldScrollToPreview:true, lastKnownProjectStatus:liveStatus });
        }
        try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.endGenerateTrace === 'function') FC.wycenaDiagnostics.endGenerateTrace({ ok:true, duplicate:true, cancelled:!!duplicateAfterNaming.cancelled, replaced:!!duplicateAfterNaming.replaced, id:snapId }); }catch(_){ }
        return;
      }
      try{
        nextQuote = saveQuoteSnapshot(nextQuote);
        try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('quoteBuilt', { hasQuote:!!nextQuote, error:nextQuote && nextQuote.error, id:nextQuote && (nextQuote.id || nextQuote.snapshotId), selectedRooms:nextQuote && nextQuote.selectedRooms, roomLabels:nextQuote && nextQuote.roomLabels, totals:nextQuote && nextQuote.totals, versionName:getVersionName(nextQuote), materialLines:Array.isArray(nextQuote && nextQuote.materialLines) ? nextQuote.materialLines.length : undefined, accessoryLines:Array.isArray(nextQuote && nextQuote.accessoryLines) ? nextQuote.accessoryLines.length : undefined }); }catch(_){ }
        nextQuote = ensureSnapshotVisibleInStore(nextQuote);
      }catch(saveErr){
        if(!isSnapshotStorageError(saveErr)) throw saveErr;
        const unsavedQuote = buildUnsavedStoragePreviewQuote(nextQuote, saveErr);
        const unsavedId = unsavedQuote && typeof d.getSnapshotId === 'function' ? d.getSnapshotId(unsavedQuote) : String(unsavedQuote && (unsavedQuote.id || unsavedQuote.snapshotId) || '');
        try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('quoteStorageSaveFailedUnsavedPreview', { id:unsavedId, message:String(saveErr && saveErr.message || saveErr || 'błąd'), code:String(saveErr && saveErr.code || ''), totals:unsavedQuote && unsavedQuote.totals }); }catch(_){ }
        if(typeof d.setState === 'function') d.setState({ lastQuote:unsavedQuote, previewSnapshotId:'', shouldScrollToPreview:!!unsavedQuote });
        try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.endGenerateTrace === 'function') FC.wycenaDiagnostics.endGenerateTrace({ ok:false, unsavedPreview:true, storageError:true, id:unsavedId, error:String(saveErr && saveErr.message || saveErr || 'błąd') }); }catch(_){ }
        return;
      }
      const nextQuoteId = nextQuote && typeof d.getSnapshotId === 'function' ? d.getSnapshotId(nextQuote) : String(nextQuote && (nextQuote.id || nextQuote.snapshotId) || '');
      if(typeof d.setState === 'function') d.setState({ lastQuote:nextQuote, previewSnapshotId:nextQuoteId, shouldScrollToPreview:!!nextQuote });
      if(nextQuote && !nextQuote.error){
        d.syncGeneratedQuoteStatus(nextQuote);
        let liveStatus = '';
        try{ liveStatus = d.getProjectStatusForHistory(d.getSnapshotHistory()); }catch(_){ }
        if(typeof d.setState === 'function') d.setState({ lastQuote:nextQuote, previewSnapshotId:nextQuoteId, shouldScrollToPreview:true, lastKnownProjectStatus:liveStatus });
        try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('statusSynced', { ok:true, liveStatus:liveStatus }); }catch(_){ }
      }
      try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.endGenerateTrace === 'function') FC.wycenaDiagnostics.endGenerateTrace({ ok:true, hasQuote:!!nextQuote, error:nextQuote && nextQuote.error, id:nextQuoteId }); }catch(_){ }
    }catch(err){
      try{ console.error('[wycena] collect failed', err); }catch(_){ }
      try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('error', { message:String(err && err.message || err || 'błąd'), code:String(err && err.code || ''), title:String(err && err.title || ''), quoteValidation:!!(err && err.quoteValidation), details:err && err.details || null }); }catch(_){ }
      if(err && err.quoteValidation){
        showQuoteValidationError(err);
      } else if(typeof d.setState === 'function'){
        d.setState({
          lastQuote:{
            error:String(err && err.message || err || 'Błąd wyceny'),
            totals:{ materials:0, accessories:0, services:0, quoteRates:0, subtotal:0, discount:0, grand:0 },
            roomLabels:[],
          }
        });
      }
      try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.endGenerateTrace === 'function') FC.wycenaDiagnostics.endGenerateTrace({ ok:false, error:String(err && err.message || err || 'Błąd wyceny') }); }catch(_){ }
    }finally{
      releaseGenerateLock();
      if(typeof d.setState === 'function') d.setState({ isBusy:false });
      if(typeof d.render === 'function') d.render(ctx);
    }
  }

  function renderTopbar(card, ctx, currentQuote, deps){
    const d = normalizeDeps(deps);
    const h = d.h;
    const state = d.getState ? d.getState() : {};
    const head = h('div', { class:'quote-topbar' });
    head.appendChild(h('h3', { text:'Wycena', style:'margin:0' }));
    const actions = h('div', { class:'quote-topbar__actions' });
    const runBtn = h('button', { class:'btn-success', type:'button', text: state.isBusy ? 'Liczę…' : 'Wyceń' });
    runBtn.setAttribute('data-action', 'wycena-generate');
    if(state.isBusy) runBtn.disabled = true;
    const requestGenerate = (event, source)=> {
      try{ if(event && typeof event.preventDefault === 'function') event.preventDefault(); }catch(_){ }
      try{ if(event && typeof event.stopPropagation === 'function') event.stopPropagation(); }catch(_){ }
      try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.recordGenerateButtonEvent === 'function') FC.wycenaDiagnostics.recordGenerateButtonEvent(source || 'generate-button'); }catch(_){ }
      void generateQuote(ctx, d, { source:source || 'generate-button' });
    };
    FC.wycenaGenerateAction = {
      run(event, source){
        requestGenerate(event || null, source || (event && event.type ? ('data-action:' + event.type) : 'data-action'));
        return true;
      }
    };
    actions.appendChild(runBtn);

    const pdfBtn = h('button', { class:'btn-primary', type:'button', text:'PDF' });
    if(!currentQuote || currentQuote.error) pdfBtn.disabled = true;
    pdfBtn.addEventListener('click', ()=>{
      try{ FC.quotePdf && typeof FC.quotePdf.openQuotePdf === 'function' && FC.quotePdf.openQuotePdf(currentQuote); }catch(_){ }
    });
    actions.appendChild(pdfBtn);
    try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.renderTopbarButton === 'function') FC.wycenaDiagnostics.renderTopbarButton(actions); }catch(_){ }
    head.appendChild(actions);
    card.appendChild(head);
  }

  function reconcileStatusPreviewState(deps){
    const d = normalizeDeps(deps);
    const state = d.getState ? d.getState() : {};
    const history = typeof d.getSnapshotHistory === 'function' ? d.getSnapshotHistory() : [];
    const liveStatus = d.getProjectStatusForHistory(history);
    if(state.lastKnownProjectStatus && liveStatus !== state.lastKnownProjectStatus){
      let keepCurrentPreview = false;
      try{
        const quoteId = state.lastQuote && typeof d.getSnapshotId === 'function' ? d.getSnapshotId(state.lastQuote) : String(state.lastQuote && (state.lastQuote.id || state.lastQuote.snapshotId) || '');
        const previewId = String(state.previewSnapshotId || quoteId || '');
        keepCurrentPreview = !!previewId && Array.isArray(history) && history.some((row)=> String(typeof d.getSnapshotId === 'function' ? d.getSnapshotId(row) : (row && (row.id || row.snapshotId) || '')) === previewId);
      }catch(_){ keepCurrentPreview = false; }
      if(!keepCurrentPreview && typeof d.setState === 'function') d.setState({ previewSnapshotId:'', lastQuote:null });
    }
    if(typeof d.setState === 'function') d.setState({ lastKnownProjectStatus:liveStatus });
  }

  function applyPostRenderScroll(deps){
    const d = normalizeDeps(deps);
    const state = d.getState ? d.getState() : {};
    if(state.shouldScrollToPreview){
      if(typeof d.setState === 'function') d.setState({ shouldScrollToPreview:false });
      d.clearRememberedQuoteScroll();
      try{
        requestAnimationFrame(()=>{
          try{
            const target = document.getElementById('quotePreviewStart') || document.getElementById('quoteActivePreview');
            if(target){
              const absoluteTop = d.getScrollY() + target.getBoundingClientRect().top;
              const targetTop = Math.max(0, Math.round(absoluteTop - 96));
              window.scrollTo({ top:targetTop, behavior:'smooth' });
            }
          }catch(_){ }
        });
      }catch(_){ }
    } else if(state.shouldRestoreScroll){
      d.restoreRememberedQuoteScroll();
    }
  }

  function render(ctx, deps){
    const d = normalizeDeps(deps);
    const h = getFn(d, 'h');
    const list = ctx && ctx.listEl;
    if(!list || typeof h !== 'function') return;
    list.innerHTML = '';
    const card = h('div', { class:'build-card quote-root', id:'quoteActivePreview' });
    try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.recordRenderEvent === 'function') FC.wycenaDiagnostics.recordRenderEvent('shell:render-start', { hasList:true }); }catch(_){ }

    try{
      if(FC.wycenaContextRepair && typeof FC.wycenaContextRepair.repairActiveQuoteContext === 'function'){
        FC.wycenaContextRepair.repairActiveQuoteContext({ reason:'render' });
      }
    }catch(err){
      try{ console.error('[wycena] context repair before render failed', err); }catch(_){ }
    }
    reconcileStatusPreviewState(d);
    const currentQuote = d.resolveDisplayedQuote();
    try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.recordRenderEvent === 'function') FC.wycenaDiagnostics.recordRenderEvent('shell:resolved-current-quote', { id: currentQuote && (currentQuote.id || currentQuote.snapshotId), versionName: currentQuote && (currentQuote.commercial && currentQuote.commercial.versionName || currentQuote.meta && currentQuote.meta.versionName), grand: currentQuote && currentQuote.totals && currentQuote.totals.grand, error: currentQuote && currentQuote.error }); }catch(_){ }
    renderTopbar(card, ctx, currentQuote, d);

    d.renderPreliminaryToggle(card, ctx);
    d.renderQuoteSelectionSection(card, ctx);
    d.renderOfferEditor(card, ctx);
    d.renderQuotePreview(card, currentQuote, ctx);
    d.renderHistory(card, ctx, currentQuote);
    list.appendChild(card);
    try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.recordRenderEvent === 'function') FC.wycenaDiagnostics.recordRenderEvent('shell:render-end', { historyDomCount: document && document.querySelectorAll ? document.querySelectorAll('[data-quote-history-id]').length : null, previewExists: !!(document && document.getElementById && document.getElementById('quotePreviewStart')) }); }catch(_){ }
    applyPostRenderScroll(d);
  }

  FC.wycenaTabShell = {
    render,
    generateQuote,
    renderTopbar,
    ensureSnapshotVisibleInStore,
    _generateRuntime:generateRuntime,
    _acquireGenerateLock:acquireGenerateLock,
    _releaseGenerateLock:releaseGenerateLock,
    reconcileStatusPreviewState,
    applyPostRenderScroll,
  };
})();
