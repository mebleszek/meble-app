(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  // Odpowiedzialność modułu: runtime state zakładki WYCENA; bez dostępu do danych i bez renderu DOM.

  function createState(initial){
    const state = Object.assign({
      lastQuote:null,
      previewSnapshotId:'',
      lastKnownProjectStatus:'',
      isBusy:false,
      shouldScrollToPreview:false,
      shouldRestoreScroll:false,
      pendingScrollRestore:null,
      offerEditorOpen:false,
      manualLaborOpen:true,
    }, initial && typeof initial === 'object' ? initial : {});

    function getHistoryPreviewState(){
      return {
        lastQuote: state.lastQuote || null,
        previewSnapshotId: String(state.previewSnapshotId || ''),
        shouldScrollToPreview: !!state.shouldScrollToPreview,
        lastKnownProjectStatus: String(state.lastKnownProjectStatus || ''),
      };
    }

    function patchHistoryPreviewState(patch){
      const next = patch && typeof patch === 'object' ? patch : {};
      if(Object.prototype.hasOwnProperty.call(next, 'lastQuote')) state.lastQuote = next.lastQuote || null;
      if(Object.prototype.hasOwnProperty.call(next, 'previewSnapshotId')) state.previewSnapshotId = String(next.previewSnapshotId || '');
      if(Object.prototype.hasOwnProperty.call(next, 'shouldScrollToPreview')) state.shouldScrollToPreview = !!next.shouldScrollToPreview;
      if(Object.prototype.hasOwnProperty.call(next, 'lastKnownProjectStatus')) state.lastKnownProjectStatus = String(next.lastKnownProjectStatus || '');
    }

    function getQuoteScrollState(){
      return {
        shouldRestoreScroll: !!state.shouldRestoreScroll,
        pendingScrollRestore: state.pendingScrollRestore || null,
      };
    }

    function patchQuoteScrollState(patch){
      const next = patch && typeof patch === 'object' ? patch : {};
      if(Object.prototype.hasOwnProperty.call(next, 'shouldRestoreScroll')) state.shouldRestoreScroll = !!next.shouldRestoreScroll;
      if(Object.prototype.hasOwnProperty.call(next, 'pendingScrollRestore')) state.pendingScrollRestore = next.pendingScrollRestore || null;
    }

    function getTabShellState(){
      return Object.assign({}, getHistoryPreviewState(), getQuoteScrollState(), {
        isBusy: !!state.isBusy,
        offerEditorOpen: !!state.offerEditorOpen,
        manualLaborOpen: !!state.manualLaborOpen,
      });
    }

    function patchTabShellState(patch){
      const next = patch && typeof patch === 'object' ? patch : {};
      patchHistoryPreviewState(next);
      patchQuoteScrollState(next);
      if(Object.prototype.hasOwnProperty.call(next, 'isBusy')) state.isBusy = !!next.isBusy;
      if(Object.prototype.hasOwnProperty.call(next, 'offerEditorOpen')) state.offerEditorOpen = !!next.offerEditorOpen;
      if(Object.prototype.hasOwnProperty.call(next, 'manualLaborOpen')) state.manualLaborOpen = !!next.manualLaborOpen;
    }

    function getOfferEditorOpen(){ return !!state.offerEditorOpen; }
    function setOfferEditorOpen(next){ state.offerEditorOpen = !!next; }
    function getManualLaborOpen(){ return !!state.manualLaborOpen; }
    function setManualLaborOpen(next){ state.manualLaborOpen = !!next; }

    return {
      getHistoryPreviewState,
      patchHistoryPreviewState,
      getQuoteScrollState,
      patchQuoteScrollState,
      getTabShellState,
      patchTabShellState,
      getOfferEditorOpen,
      setOfferEditorOpen,
      getManualLaborOpen,
      setManualLaborOpen,
    };
  }

  FC.wycenaTabState = Object.assign({}, FC.wycenaTabState || {}, { createState });
})();
