(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  // Odpowiedzialność modułu: adapter renderu zakładki WYCENA; nie przechowuje stanu i nie dotyka storage.

  function getFn(deps, name, fallback){
    return deps && typeof deps[name] === 'function' ? deps[name] : fallback;
  }

  function reportRenderError(place, err){
    try{ console.error(`[wycena] ${place} render failed`, err); }catch(_){ }
  }

  function appendRenderError(card, h, place, err){
    try{
      if(!card || typeof h !== 'function') return;
      const message = String(err && err.message || err || 'Nieznany błąd renderowania.');
      const box = h('section', { class:'card quote-section', style:'margin-top:12px;padding:14px;border-color:#dc2626;' });
      box.appendChild(h('h4', { text:'Błąd podglądu WYCENY', style:'margin:0 0 8px;color:#b42318' }));
      box.appendChild(h('div', { class:'muted', text:`${place}: ${message}`, style:'color:#b42318' }));
      card.appendChild(box);
    }catch(_){ }
  }

  function renderQuotePreview(card, currentQuote, ctx, deps){
    const preview = FC.wycenaTabPreview || {};
    if(preview && typeof preview.renderPreview === 'function'){
      try{
        return preview.renderPreview(card, currentQuote, ctx, {
          h:getFn(deps, 'h'),
          money:getFn(deps, 'money'),
          buildRowMeta:getFn(deps, 'buildRowMeta'),
          formatDateTime:getFn(deps, 'formatDateTime'),
          getSnapshotId:getFn(deps, 'getSnapshotId'),
          getSnapshotHistory:getFn(deps, 'getSnapshotHistory'),
          getMaterialScopeLabel:getFn(deps, 'getMaterialScopeLabel'),
          isPreliminarySnapshot:getFn(deps, 'isPreliminarySnapshot'),
          isSelectedSnapshot:getFn(deps, 'isSelectedSnapshot'),
          canAcceptSnapshot:getFn(deps, 'canAcceptSnapshot'),
          acceptSnapshot:getFn(deps, 'acceptSnapshot'),
          getVersionName:getFn(deps, 'getVersionName'),
        });
      }catch(err){
        reportRenderError('preview', err);
        appendRenderError(card, getFn(deps, 'h'), 'Podgląd wyceny', err);
      }
    }
  }

  function renderHistory(card, ctx, currentQuote, deps){
    const history = FC.wycenaTabHistory || {};
    if(history && typeof history.renderHistory === 'function'){
      try{
        return history.renderHistory(card, ctx, currentQuote, {
          h:getFn(deps, 'h'),
          money:getFn(deps, 'money'),
          formatDateTime:getFn(deps, 'formatDateTime'),
          getVersionName:getFn(deps, 'getVersionName'),
          getMaterialScopeLabel:getFn(deps, 'getMaterialScopeLabel'),
          getSnapshotHistory:getFn(deps, 'getSnapshotHistory'),
          normalizeSnapshot:getFn(deps, 'normalizeSnapshot'),
          getSnapshotId:getFn(deps, 'getSnapshotId'),
          isSelectedSnapshot:getFn(deps, 'isSelectedSnapshot'),
          isRejectedSnapshot:getFn(deps, 'isRejectedSnapshot'),
          isPreliminarySnapshot:getFn(deps, 'isPreliminarySnapshot'),
          isArchivedPreliminary:getFn(deps, 'isArchivedPreliminary'),
          getRejectedReason:getFn(deps, 'getRejectedReason'),
          getProjectStatusForHistory:getFn(deps, 'getProjectStatusForHistory'),
          canAcceptSnapshot:getFn(deps, 'canAcceptSnapshot'),
          acceptSnapshot:getFn(deps, 'acceptSnapshot'),
          currentProjectStatus:getFn(deps, 'currentProjectStatus'),
          askConfirm:getFn(deps, 'askConfirm'),
          rememberQuoteScroll:getFn(deps, 'rememberQuoteScroll'),
          clearRememberedQuoteScroll:getFn(deps, 'clearRememberedQuoteScroll'),
          getQuoteHistoryItemDomId:getFn(deps, 'getQuoteHistoryItemDomId'),
          getQuoteHistoryNeighborDomId:getFn(deps, 'getQuoteHistoryNeighborDomId'),
          reconcileAfterSnapshotRemoval:getFn(deps, 'reconcileAfterSnapshotRemoval'),
          promotePreliminarySnapshotToFinal:getFn(deps, 'promotePreliminarySnapshotToFinal'),
          render:getFn(deps, 'render'),
          getState:getFn(deps, 'getHistoryPreviewState'),
          setState:getFn(deps, 'patchHistoryPreviewState'),
        });
      }catch(err){
        reportRenderError('history', err);
        appendRenderError(card, getFn(deps, 'h'), 'Historia wycen', err);
      }
    }
  }

  function renderShell(ctx, deps){
    const shell = FC.wycenaTabShell || {};
    if(shell && typeof shell.render === 'function'){
      try{
        return shell.render(ctx, {
          h:getFn(deps, 'h'),
          getState:getFn(deps, 'getTabShellState'),
          setState:getFn(deps, 'patchTabShellState'),
          render:getFn(deps, 'render'),
          getOfferDraft:getFn(deps, 'getOfferDraft'),
          normalizeDraftSelection:getFn(deps, 'normalizeDraftSelection'),
          ensureVersionNameBeforeGenerate:getFn(deps, 'ensureVersionNameBeforeGenerate'),
          syncGeneratedQuoteStatus:getFn(deps, 'syncGeneratedQuoteStatus'),
          getProjectStatusForHistory:getFn(deps, 'getProjectStatusForHistory'),
          getSnapshotHistory:getFn(deps, 'getSnapshotHistory'),
          resolveDisplayedQuote:getFn(deps, 'resolveDisplayedQuote'),
          renderPreliminaryToggle:getFn(deps, 'renderPreliminaryToggle'),
          renderQuoteSelectionSection:getFn(deps, 'renderQuoteSelectionSection'),
          renderManualLaborEditor:getFn(deps, 'renderManualLaborEditor'),
          renderOfferEditor:getFn(deps, 'renderOfferEditor'),
          renderQuotePreview:getFn(deps, 'renderQuotePreview'),
          renderHistory:getFn(deps, 'renderHistory'),
          clearRememberedQuoteScroll:getFn(deps, 'clearRememberedQuoteScroll'),
          restoreRememberedQuoteScroll:getFn(deps, 'restoreRememberedQuoteScroll'),
          getScrollY:getFn(deps, 'getScrollY'),
          getSnapshotId:getFn(deps, 'getSnapshotId'),
        });
      }catch(err){
        reportRenderError('shell', err);
        try{
          const h = getFn(deps, 'h');
          const list = ctx && ctx.listEl;
          if(list && typeof h === 'function'){
            list.innerHTML = '';
            const card = h('div', { class:'build-card quote-root', id:'quoteActivePreview' });
            appendRenderError(card, h, 'Zakładka WYCENA', err);
            list.appendChild(card);
          }
        }catch(_){ }
      }
    }
  }

  function showSnapshotPreview(snapshotId, deps){
    const history = FC.wycenaTabHistory || {};
    if(history && typeof history.showSnapshotPreview === 'function'){
      try{
        return !!history.showSnapshotPreview(snapshotId, {
          snapshotById:getFn(deps, 'snapshotById'),
          getSnapshotHistory:getFn(deps, 'getSnapshotHistory'),
          setState:getFn(deps, 'patchHistoryPreviewState'),
        });
      }catch(err){ reportRenderError('history-preview', err); }
    }
    return false;
  }

  FC.wycenaTabRenderBridge = Object.assign({}, FC.wycenaTabRenderBridge || {}, {
    renderQuotePreview,
    renderHistory,
    renderShell,
    showSnapshotPreview,
  });
})();
