(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  // Odpowiedzialność modułu: adapter renderu zakładki WYCENA; nie przechowuje stanu i nie dotyka storage.

  function getFn(deps, name, fallback){
    return deps && typeof deps[name] === 'function' ? deps[name] : fallback;
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
      }catch(_){ }
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
      }catch(_){ }
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
          renderOfferEditor:getFn(deps, 'renderOfferEditor'),
          renderQuotePreview:getFn(deps, 'renderQuotePreview'),
          renderHistory:getFn(deps, 'renderHistory'),
          clearRememberedQuoteScroll:getFn(deps, 'clearRememberedQuoteScroll'),
          restoreRememberedQuoteScroll:getFn(deps, 'restoreRememberedQuoteScroll'),
          getScrollY:getFn(deps, 'getScrollY'),
        });
      }catch(_){ }
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
      }catch(_){ }
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
