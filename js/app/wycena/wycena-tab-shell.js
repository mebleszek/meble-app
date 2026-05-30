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

  function getSnapshotIdFromQuote(snapshot){
    return String(snapshot && (snapshot.id || snapshot.snapshotId) || '').trim();
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

  async function generateQuote(ctx, deps){
    const d = normalizeDeps(deps);
    const state = typeof d.getState === 'function' ? d.getState() : {};
    if(state.isBusy){
      try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.recordGenerateButtonEvent === 'function') FC.wycenaDiagnostics.recordGenerateButtonEvent('generate-ignored-busy'); }catch(_){ }
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
      const naming = await d.ensureVersionNameBeforeGenerate(selection);
      try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('naming', naming); }catch(_){ }
      if(naming && naming.cancelled){ try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.endGenerateTrace === 'function') FC.wycenaDiagnostics.endGenerateTrace({ stopped:'version-name-cancelled' }); }catch(_){ } return; }
      let nextQuote = null;
      if(FC.wycenaCore && typeof FC.wycenaCore.buildQuoteSnapshot === 'function') nextQuote = await FC.wycenaCore.buildQuoteSnapshot({ selection });
      else if(FC.wycenaCore && typeof FC.wycenaCore.collectQuoteData === 'function') nextQuote = await FC.wycenaCore.collectQuoteData({ selection });
      try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('quoteBuilt', { hasQuote:!!nextQuote, error:nextQuote && nextQuote.error, id:nextQuote && (nextQuote.id || nextQuote.snapshotId), selectedRooms:nextQuote && nextQuote.selectedRooms, roomLabels:nextQuote && nextQuote.roomLabels, totals:nextQuote && nextQuote.totals, materialLines:Array.isArray(nextQuote && nextQuote.materialLines) ? nextQuote.materialLines.length : undefined, accessoryLines:Array.isArray(nextQuote && nextQuote.accessoryLines) ? nextQuote.accessoryLines.length : undefined }); }catch(_){ }
      nextQuote = ensureSnapshotVisibleInStore(nextQuote);
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
    let generateRequestedAt = 0;
    const requestGenerate = (event, source)=> {
      try{ if(event && typeof event.preventDefault === 'function') event.preventDefault(); }catch(_){ }
      try{ if(event && typeof event.stopPropagation === 'function') event.stopPropagation(); }catch(_){ }
      const ts = Date.now();
      if(generateRequestedAt && ts - generateRequestedAt < 450) return;
      generateRequestedAt = ts;
      try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.recordGenerateButtonEvent === 'function') FC.wycenaDiagnostics.recordGenerateButtonEvent(source || 'generate-button'); }catch(_){ }
      void generateQuote(ctx, d);
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
    reconcileStatusPreviewState,
    applyPostRenderScroll,
  };
})();
