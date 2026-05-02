// js/tabs/wycena.js
// Zakładka WYCENA — cienki rejestr zakładki, spinający moduły danych, statusów, selection i renderu.

(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const helpers = FC.wycenaTabHelpers || {};
  const scroll = FC.wycenaTabScroll || {};
  const history = FC.wycenaTabHistory || {};
  const dom = FC.wycenaTabDom || {};
  const data = FC.wycenaTabData || {};
  const selectionBridge = FC.wycenaTabSelectionBridge || {};
  const editorBridge = FC.wycenaTabEditorBridge || {};
  const renderBridge = FC.wycenaTabRenderBridge || {};
  const state = FC.wycenaTabState && typeof FC.wycenaTabState.createState === 'function'
    ? FC.wycenaTabState.createState()
    : null;
  const statusController = FC.wycenaTabStatusController && typeof FC.wycenaTabStatusController.createController === 'function'
    ? FC.wycenaTabStatusController.createController(getStatusActionDeps)
    : null;

  const money = helpers.money;
  const num = helpers.num;
  const buildRowMeta = helpers.buildRowMeta;
  const formatDateTime = helpers.formatDateTime;
  const getSnapshotId = helpers.getSnapshotId;
  const normalizeStatusKey = helpers.normalizeStatusKey;
  const statusRank = helpers.statusRank;
  const isFinalStatus = helpers.isFinalStatus;
  const isSelectedSnapshot = helpers.isSelectedSnapshot;
  const isRejectedSnapshot = helpers.isRejectedSnapshot;
  const getRejectedReason = helpers.getRejectedReason;
  const isPreliminarySnapshot = helpers.isPreliminarySnapshot;
  const normalizeRoomIds = helpers.normalizeRoomIds;
  const getSnapshotRoomIds = helpers.getSnapshotRoomIds;
  const getMaterialScopeLabel = helpers.getMaterialScopeLabel;
  const snapshotById = helpers.snapshotById;
  const h = dom.h;

  function getCurrentProjectId(){
    return typeof data.getCurrentProjectId === 'function' ? data.getCurrentProjectId() : '';
  }

  function getCurrentInvestorId(){
    return typeof data.getCurrentInvestorId === 'function' ? data.getCurrentInvestorId() : '';
  }

  function getSnapshotHistory(){
    return typeof data.getSnapshotHistory === 'function' ? data.getSnapshotHistory({ getCurrentProjectId, getCurrentInvestorId }) : [];
  }

  function normalizeSnapshot(source){
    return typeof data.normalizeSnapshot === 'function' ? data.normalizeSnapshot(source) : (source || null);
  }

  function getOfferDraft(){
    return typeof data.getOfferDraft === 'function' ? data.getOfferDraft() : { rateSelections:[], commercial:{} };
  }

  function patchOfferDraft(patch){
    return typeof data.patchOfferDraft === 'function' ? data.patchOfferDraft(patch) : null;
  }

  function getHistoryPreviewState(){ return state.getHistoryPreviewState(); }
  function patchHistoryPreviewState(patch){ return state.patchHistoryPreviewState(patch); }
  function getQuoteScrollState(){ return state.getQuoteScrollState(); }
  function patchQuoteScrollState(patch){ return state.patchQuoteScrollState(patch); }
  function getTabShellState(){ return state.getTabShellState(); }
  function patchTabShellState(patch){ return state.patchTabShellState(patch); }
  function getOfferEditorOpen(){ return state.getOfferEditorOpen(); }
  function setOfferEditorOpen(next){ return state.setOfferEditorOpen(next); }

  function resolveDisplayedQuote(){
    if(history && typeof history.resolveDisplayedQuote === 'function'){
      try{
        return history.resolveDisplayedQuote({
          getSnapshotHistory,
          getState:getHistoryPreviewState,
          setState:patchHistoryPreviewState,
          isSelectedSnapshot,
          isArchivedPreliminary,
          isPreliminarySnapshot,
          isFinalStatus,
          snapshotById,
          normalizeSnapshot,
          getSnapshotId,
          currentProjectStatus,
        });
      }catch(_){ }
    }
    return null;
  }

  function getStatusActionDeps(){
    return {
      normalizeSnapshot,
      normalizeStatusKey,
      getCurrentProjectId,
      getCurrentInvestorId,
      getTargetRoomIdsFromSnapshot,
      normalizeRoomIds,
      getSnapshotRoomIds,
      getSnapshotId,
      isSelectedSnapshot,
      isRejectedSnapshot,
      isPreliminarySnapshot,
      getSnapshotHistory,
      getProjectStatusForHistory,
      isArchivedPreliminary,
      rememberQuoteScroll,
      clearRememberedQuoteScroll,
      render,
      setHistoryPreviewState:patchHistoryPreviewState,
      canAcceptSnapshot,
      commitAcceptedSnapshotWithSync,
      statusRank,
      currentProjectStatus,
      setProjectStatusFromSnapshot,
    };
  }

  function getAllActiveRoomIds(){ return statusController ? statusController.getAllActiveRoomIds() : []; }
  function getTargetRoomIdsFromSnapshot(snapshot){ return statusController ? statusController.getTargetRoomIdsFromSnapshot(snapshot) : []; }
  function getComparableHistoryForSnapshot(snapshot, list){ return statusController ? statusController.getComparableHistoryForSnapshot(snapshot, list) : []; }
  function isArchivedPreliminary(snapshot, list, projectStatus){ return statusController ? statusController.isArchivedPreliminary(snapshot, list, projectStatus) : false; }
  function currentProjectStatus(snapshot){ return statusController ? statusController.currentProjectStatus(snapshot) : normalizeStatusKey(''); }
  async function askConfirm(cfg){ return statusController ? !!(await statusController.askConfirm(cfg)) : true; }
  function canAcceptSnapshot(snapshot, list){ return statusController ? statusController.canAcceptSnapshot(snapshot, list) : false; }
  function commitAcceptedSnapshotWithSync(snapshot, status, options){ return statusController ? statusController.commitAcceptedSnapshotWithSync(snapshot, status, options) : null; }
  function reconcileAfterSnapshotRemoval(snapshot, options){ return statusController ? statusController.reconcileAfterSnapshotRemoval(snapshot, options) : null; }
  function promotePreliminarySnapshotToFinal(snapshot, options){ return statusController ? statusController.promotePreliminarySnapshotToFinal(snapshot, options) : null; }
  async function acceptSnapshot(snapshot, ctx, options){ return statusController ? !!(await statusController.acceptSnapshot(snapshot, ctx, options)) : false; }
  function setProjectStatusFromSnapshot(snapshot, status, options){ return statusController ? statusController.setProjectStatusFromSnapshot(snapshot, status, options) : undefined; }
  function syncGeneratedQuoteStatus(snapshot){ return statusController ? statusController.syncGeneratedQuoteStatus(snapshot) : undefined; }

  function labelWithInfo(title, infoTitle, infoMessage){ return dom.labelWithInfo(title, infoTitle, infoMessage); }

  function getSelectionDeps(extra){
    return Object.assign({
      h,
      labelWithInfo,
      getOfferDraft,
      patchOfferDraft,
      render,
      askConfirm,
      getCurrentProjectId,
      normalizeSnapshot,
      isPreliminarySnapshot,
      normalizeRoomIds,
      getMaterialScopeLabel,
    }, extra || {});
  }

  function defaultVersionName(preliminary, options){ return selectionBridge.defaultVersionName(preliminary, options); }
  function buildSelectionScopeSummary(selection){ return selectionBridge.buildSelectionScopeSummary(selection, getSelectionDeps()); }
  function shouldPromptForVersionNameOnGenerate(selection, draft){ return selectionBridge.shouldPromptForVersionNameOnGenerate(selection, draft, getSelectionDeps()); }
  async function ensureVersionNameBeforeGenerate(selection){ return selectionBridge.ensureVersionNameBeforeGenerate(selection, getSelectionDeps()); }
  function getVersionName(snapshot){ return selectionBridge.getVersionName(snapshot, getSelectionDeps()); }
  function normalizeDraftSelection(draft){ return selectionBridge.normalizeDraftSelection(draft); }
  function getRoomLabelsFromSelection(selection){ return selectionBridge.getRoomLabelsFromSelection(selection); }
  function getRoomsPickerMeta(selection){ return selectionBridge.getRoomsPickerMeta(selection); }
  function getScopePickerMeta(selection){ return selectionBridge.getScopePickerMeta(selection, getSelectionDeps()); }
  function buildSelectionSummary(selection){ return selectionBridge.buildSelectionSummary(selection, getSelectionDeps()); }
  function openQuoteRoomsPicker(ctx){ return selectionBridge.openQuoteRoomsPicker(ctx, getSelectionDeps()); }
  function openQuoteScopePicker(ctx){ return selectionBridge.openQuoteScopePicker(ctx, getSelectionDeps()); }
  function renderQuoteSelectionSection(card, ctx){
    return selectionBridge.renderQuoteSelectionSection(card, ctx, getSelectionDeps({ openQuoteRoomsPicker, openQuoteScopePicker }));
  }

  function getQuoteHistoryItemDomId(snapshotId){
    if(scroll && typeof scroll.getQuoteHistoryItemDomId === 'function'){
      try{ return scroll.getQuoteHistoryItemDomId(snapshotId); }catch(_){ }
    }
    const key = String(snapshotId || '').trim();
    return key ? `quoteHistoryItem-${key}` : '';
  }

  function getQuoteHistoryNeighborDomId(snapshotId){
    if(scroll && typeof scroll.getQuoteHistoryNeighborDomId === 'function'){
      try{ return scroll.getQuoteHistoryNeighborDomId(snapshotId); }catch(_){ }
    }
    return 'quoteHistorySection';
  }

  function getScrollY(){
    if(scroll && typeof scroll.getScrollY === 'function'){
      try{ return scroll.getScrollY(); }catch(_){ }
    }
    return 0;
  }

  function rememberQuoteScroll(anchorId, fallbackAnchorId){
    if(scroll && typeof scroll.rememberQuoteScroll === 'function'){
      try{ return scroll.rememberQuoteScroll(anchorId, fallbackAnchorId, { getState:getQuoteScrollState, setState:patchQuoteScrollState }); }catch(_){ }
    }
  }

  function clearRememberedQuoteScroll(){
    if(scroll && typeof scroll.clearRememberedQuoteScroll === 'function'){
      try{ return scroll.clearRememberedQuoteScroll({ setState:patchQuoteScrollState }); }catch(_){ }
    }
    patchQuoteScrollState({ pendingScrollRestore:null, shouldRestoreScroll:false });
  }

  function restoreRememberedQuoteScroll(){
    if(scroll && typeof scroll.restoreRememberedQuoteScroll === 'function'){
      try{ return scroll.restoreRememberedQuoteScroll({ getState:getQuoteScrollState, setState:patchQuoteScrollState }); }catch(_){ }
    }
  }

  function getProjectStatusForHistory(list){
    if(history && typeof history.getProjectStatusForHistory === 'function'){
      try{
        return history.getProjectStatusForHistory(list, {
          getSnapshotHistory,
          currentProjectStatus,
          isSelectedSnapshot,
          getState:getHistoryPreviewState,
        });
      }catch(_){ }
    }
    const historyList = Array.isArray(list) ? list : getSnapshotHistory();
    const previewState = getHistoryPreviewState();
    return currentProjectStatus(historyList.find((row)=> isSelectedSnapshot(row)) || historyList[0] || previewState.lastQuote || null);
  }

  function getEditorDeps(extra){
    return Object.assign({
      h,
      money,
      num,
      getOfferDraft,
      patchOfferDraft,
      normalizeDraftSelection,
      defaultVersionName,
      buildSelectionSummary,
      render,
      getIsOpen:getOfferEditorOpen,
      setIsOpen:setOfferEditorOpen,
    }, extra || {});
  }

  function buildOfferSummary(draft){ return editorBridge.buildOfferSummary(draft, getEditorDeps()); }
  function buildSelectionMap(draft){ return editorBridge.buildSelectionMap(draft, getEditorDeps()); }
  function saveRateSelectionRows(selections){ return editorBridge.saveRateSelectionRows(selections, getEditorDeps()); }
  function buildField(labelText, inputNode, full){ return editorBridge.buildField(labelText, inputNode, full, getEditorDeps()); }
  function makeRateSelectionRows(catalog, selectionMap){ return editorBridge.makeRateSelectionRows(catalog, selectionMap, getEditorDeps()); }
  function renderPreliminaryToggle(card, ctx){ return editorBridge.renderPreliminaryToggle(card, ctx, getEditorDeps()); }
  function renderOfferEditor(card, ctx){
    return editorBridge.renderOfferEditor(card, ctx, getEditorDeps({
      buildOfferSummary,
      buildSelectionMap,
      saveRateSelectionRows,
      buildField,
      makeRateSelectionRows,
    }));
  }

  function getRenderDeps(extra){
    return Object.assign({
      h,
      money,
      buildRowMeta,
      formatDateTime,
      getSnapshotId,
      getSnapshotHistory,
      getMaterialScopeLabel,
      isPreliminarySnapshot,
      isSelectedSnapshot,
      isRejectedSnapshot,
      getRejectedReason,
      normalizeSnapshot,
      canAcceptSnapshot,
      acceptSnapshot,
      getVersionName,
      isArchivedPreliminary,
      getProjectStatusForHistory,
      currentProjectStatus,
      askConfirm,
      rememberQuoteScroll,
      clearRememberedQuoteScroll,
      getQuoteHistoryItemDomId,
      getQuoteHistoryNeighborDomId,
      reconcileAfterSnapshotRemoval,
      promotePreliminarySnapshotToFinal,
      render,
      getHistoryPreviewState,
      patchHistoryPreviewState,
      getTabShellState,
      patchTabShellState,
      getOfferDraft,
      normalizeDraftSelection,
      ensureVersionNameBeforeGenerate,
      syncGeneratedQuoteStatus,
      resolveDisplayedQuote,
      renderPreliminaryToggle,
      renderQuoteSelectionSection,
      renderOfferEditor,
      renderQuotePreview,
      renderHistory,
      restoreRememberedQuoteScroll,
      getScrollY,
      snapshotById,
    }, extra || {});
  }

  function renderQuotePreview(card, currentQuote, ctx){
    return renderBridge.renderQuotePreview(card, currentQuote, ctx, getRenderDeps());
  }

  function renderHistory(card, ctx, currentQuote){
    return renderBridge.renderHistory(card, ctx, currentQuote, getRenderDeps());
  }

  function render(ctx){
    return renderBridge.renderShell(ctx, getRenderDeps());
  }

  function showSnapshotPreview(snapshotId){
    return renderBridge.showSnapshotPreview(snapshotId, getRenderDeps());
  }

  FC.wycenaTabDebug = Object.assign({}, FC.wycenaTabDebug || {}, {
    currentProjectStatus,
    setProjectStatusFromSnapshot,
    commitAcceptedSnapshotWithSync,
    reconcileAfterSnapshotRemoval,
    promotePreliminarySnapshotToFinal,
    acceptSnapshot,
    getTargetRoomIdsFromSnapshot,
    getAllActiveRoomIds,
    getComparableHistoryForSnapshot,
    isArchivedPreliminary,
    isRejectedSnapshot,
    canAcceptSnapshot,
    showSnapshotPreview,
    shouldPromptForVersionNameOnGenerate,
    buildSelectionScopeSummary,
    getRoomLabelsFromSelection,
    getRoomsPickerMeta,
    getScopePickerMeta,
  });

  (FC.tabsRouter || FC.tabs || {}).register?.('wycena', { mount(){}, render, unmount(){} });
})();
