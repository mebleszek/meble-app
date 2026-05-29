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

  async function generateQuote(ctx, deps){
    const d = normalizeDeps(deps);
    const state = typeof d.getState === 'function' ? d.getState() : {};
    if(state.isBusy) return;
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
      if(typeof d.setState === 'function') d.setState({ lastQuote:nextQuote });
      if(nextQuote && !nextQuote.error){ d.syncGeneratedQuoteStatus(nextQuote); try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.markGenerateTrace === 'function') FC.wycenaDiagnostics.markGenerateTrace('statusSynced', { ok:true }); }catch(_){ } }
      try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.endGenerateTrace === 'function') FC.wycenaDiagnostics.endGenerateTrace({ ok:true, hasQuote:!!nextQuote, error:nextQuote && nextQuote.error, id:nextQuote && (nextQuote.id || nextQuote.snapshotId) }); }catch(_){ }
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
    if(state.isBusy) runBtn.disabled = true;
    runBtn.addEventListener('click', ()=> { void generateQuote(ctx, d); });
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
    const liveStatus = d.getProjectStatusForHistory(d.getSnapshotHistory());
    if(state.lastKnownProjectStatus && liveStatus !== state.lastKnownProjectStatus){
      if(typeof d.setState === 'function') d.setState({ previewSnapshotId:'', lastQuote:null });
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

    try{
      if(FC.wycenaContextRepair && typeof FC.wycenaContextRepair.repairActiveQuoteContext === 'function'){
        FC.wycenaContextRepair.repairActiveQuoteContext({ reason:'render' });
      }
    }catch(err){
      try{ console.error('[wycena] context repair before render failed', err); }catch(_){ }
    }
    reconcileStatusPreviewState(d);
    const currentQuote = d.resolveDisplayedQuote();
    renderTopbar(card, ctx, currentQuote, d);

    d.renderPreliminaryToggle(card, ctx);
    d.renderQuoteSelectionSection(card, ctx);
    d.renderOfferEditor(card, ctx);
    d.renderQuotePreview(card, currentQuote, ctx);
    d.renderHistory(card, ctx, currentQuote);
    list.appendChild(card);
    applyPostRenderScroll(d);
  }

  FC.wycenaTabShell = {
    render,
    generateQuote,
    renderTopbar,
    reconcileStatusPreviewState,
    applyPostRenderScroll,
  };
})();
