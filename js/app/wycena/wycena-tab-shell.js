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
    if(typeof d.render === 'function') d.render(ctx);
    try{
      const selection = d.normalizeDraftSelection(d.getOfferDraft());
      const naming = await d.ensureVersionNameBeforeGenerate(selection);
      if(naming && naming.cancelled) return;
      let nextQuote = null;
      if(FC.wycenaCore && typeof FC.wycenaCore.buildQuoteSnapshot === 'function') nextQuote = await FC.wycenaCore.buildQuoteSnapshot({ selection });
      else if(FC.wycenaCore && typeof FC.wycenaCore.collectQuoteData === 'function') nextQuote = await FC.wycenaCore.collectQuoteData({ selection });
      if(typeof d.setState === 'function') d.setState({ lastQuote:nextQuote });
      if(nextQuote && !nextQuote.error) d.syncGeneratedQuoteStatus(nextQuote);
    }catch(err){
      try{ console.error('[wycena] collect failed', err); }catch(_){ }
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
