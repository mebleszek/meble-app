// js/tabs/wycena.js
// Zakładka WYCENA — handlowa wersja oferty, PDF klienta i historia wersji.

(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const wycenaTabHelpers = FC.wycenaTabHelpers || {};
  const wycenaTabScroll = FC.wycenaTabScroll || {};
  const wycenaTabHistory = FC.wycenaTabHistory || {};
  const wycenaTabStatusBridge = FC.wycenaTabStatusBridge || {};
  const wycenaTabPreview = FC.wycenaTabPreview || {};
  const money = wycenaTabHelpers.money;
  const num = wycenaTabHelpers.num;
  const buildRowMeta = wycenaTabHelpers.buildRowMeta;
  const formatDateTime = wycenaTabHelpers.formatDateTime;
  const getSnapshotId = wycenaTabHelpers.getSnapshotId;
  const normalizeStatusKey = wycenaTabHelpers.normalizeStatusKey;
  const statusRank = wycenaTabHelpers.statusRank;
  const isFinalStatus = wycenaTabHelpers.isFinalStatus;
  const isSelectedSnapshot = wycenaTabHelpers.isSelectedSnapshot;
  const isRejectedSnapshot = wycenaTabHelpers.isRejectedSnapshot;
  const getRejectedReason = wycenaTabHelpers.getRejectedReason;
  const isPreliminarySnapshot = wycenaTabHelpers.isPreliminarySnapshot;
  const normalizeRoomIds = wycenaTabHelpers.normalizeRoomIds;
  const getSnapshotRoomIds = wycenaTabHelpers.getSnapshotRoomIds;
  const getMaterialScopeMode = wycenaTabHelpers.getMaterialScopeMode;
  const getMaterialScopeLabel = wycenaTabHelpers.getMaterialScopeLabel;
  const snapshotById = wycenaTabHelpers.snapshotById;

  function h(tag, attrs, children){
    const el = document.createElement(tag);
    if(attrs){
      Object.keys(attrs).forEach((k)=>{
        if(k === 'class') el.className = attrs[k];
        else if(k === 'text') el.textContent = attrs[k];
        else if(k === 'html') el.innerHTML = attrs[k];
        else el.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach((ch)=> el.appendChild(ch));
    return el;
  }

  function getCurrentProjectId(){
    try{ return FC.projectStore && typeof FC.projectStore.getCurrentProjectId === 'function' ? FC.projectStore.getCurrentProjectId() : ''; }catch(_){ return ''; }
  }

  function getCurrentInvestorId(){
    try{ return FC.investors && typeof FC.investors.getCurrentId === 'function' ? String(FC.investors.getCurrentId() || '') : ''; }catch(_){ return ''; }
  }

  function getSnapshotHistory(){
    try{
      if(!(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.listForProject === 'function')) return [];
      const projectId = String(getCurrentProjectId() || '');
      if(projectId) return FC.quoteSnapshotStore.listForProject(projectId);
      const investorId = String(getCurrentInvestorId() || '');
      if(investorId && typeof FC.quoteSnapshotStore.listForInvestor === 'function') return FC.quoteSnapshotStore.listForInvestor(investorId);
    }catch(_){ }
    return [];
  }

  function normalizeSnapshot(source){
    const snap = source && typeof source === 'object' ? source : null;
    if(!snap) return null;
    if(snap.lines && snap.totals) return snap;
    try{
      if(FC.quoteSnapshot && typeof FC.quoteSnapshot.buildSnapshot === 'function') return FC.quoteSnapshot.buildSnapshot(snap);
    }catch(_){ }
    return snap;
  }

  function getOfferDraft(){
    try{
      if(FC.quoteOfferStore && typeof FC.quoteOfferStore.getCurrentDraft === 'function') return FC.quoteOfferStore.getCurrentDraft();
    }catch(_){ }
    return { rateSelections:[], commercial:{} };
  }

  function patchOfferDraft(patch){
    try{
      if(FC.quoteOfferStore && typeof FC.quoteOfferStore.patchCurrentDraft === 'function') return FC.quoteOfferStore.patchCurrentDraft(patch);
    }catch(_){ }
    return null;
  }

  function getHistoryPreviewState(){
    return { lastQuote, previewSnapshotId, shouldScrollToPreview, lastKnownProjectStatus };
  }

  function patchHistoryPreviewState(patch){
    const next = patch && typeof patch === 'object' ? patch : {};
    if(Object.prototype.hasOwnProperty.call(next, 'lastQuote')) lastQuote = next.lastQuote || null;
    if(Object.prototype.hasOwnProperty.call(next, 'previewSnapshotId')) previewSnapshotId = String(next.previewSnapshotId || '');
    if(Object.prototype.hasOwnProperty.call(next, 'shouldScrollToPreview')) shouldScrollToPreview = !!next.shouldScrollToPreview;
    if(Object.prototype.hasOwnProperty.call(next, 'lastKnownProjectStatus')) lastKnownProjectStatus = String(next.lastKnownProjectStatus || '');
  }

  function getQuoteScrollState(){
    return { shouldRestoreScroll, pendingScrollRestore };
  }

  function patchQuoteScrollState(patch){
    const next = patch && typeof patch === 'object' ? patch : {};
    if(Object.prototype.hasOwnProperty.call(next, 'shouldRestoreScroll')) shouldRestoreScroll = !!next.shouldRestoreScroll;
    if(Object.prototype.hasOwnProperty.call(next, 'pendingScrollRestore')) pendingScrollRestore = next.pendingScrollRestore || null;
  }

  function resolveDisplayedQuote(){
    if(wycenaTabHistory && typeof wycenaTabHistory.resolveDisplayedQuote === 'function'){
      try{
        return wycenaTabHistory.resolveDisplayedQuote({
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

  function getAllActiveRoomIds(){
    try{ return FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomIds === 'function' ? normalizeRoomIds(FC.roomRegistry.getActiveRoomIds()) : []; }catch(_){ return []; }
  }

  function getTargetRoomIdsFromSnapshot(snapshot){
    const scoped = getSnapshotRoomIds(snapshot);
    if(scoped.length) return scoped;
    const active = getAllActiveRoomIds();
    return active.length === 1 ? active : [];
  }

  function getComparableHistoryForSnapshot(snapshot, history){
    const list = Array.isArray(history) ? history : getSnapshotHistory();
    const targetRooms = getSnapshotRoomIds(snapshot);
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.sameRoomScope === 'function'){
        return list.filter((row)=> FC.quoteSnapshotStore.sameRoomScope(getSnapshotRoomIds(row), targetRooms));
      }
    }catch(_){ }
    return list.filter((row)=> {
      const rowRooms = getSnapshotRoomIds(row);
      if(rowRooms.length !== targetRooms.length) return false;
      return rowRooms.every((roomId, idx)=> roomId === targetRooms[idx]);
    });
  }

  function isArchivedPreliminary(snapshot, history, projectStatus){
    if(!isPreliminarySnapshot(snapshot) || isRejectedSnapshot(snapshot)) return false;
    const list = getComparableHistoryForSnapshot(snapshot, history);
    const currentStatus = normalizeStatusKey(currentProjectStatus(snapshot));
    if(statusRank(currentStatus) < statusRank('wycena')) return false;
    if(list.some((row)=> !isPreliminarySnapshot(row) && !isRejectedSnapshot(row) && isSelectedSnapshot(row))) return true;
    const generatedAt = Number(snapshot && snapshot.generatedAt || 0);
    return list.some((row)=> !isPreliminarySnapshot(row) && !isRejectedSnapshot(row) && Number(row && row.generatedAt || 0) > generatedAt);
  }

  function currentProjectStatus(snapshot){
    if(wycenaTabStatusBridge && typeof wycenaTabStatusBridge.currentProjectStatus === 'function'){
      try{
        return wycenaTabStatusBridge.currentProjectStatus(snapshot, {
          normalizeSnapshot,
          normalizeStatusKey,
          getCurrentProjectId,
        });
      }catch(_){ }
    }
    return normalizeStatusKey('');
  }

  async function askConfirm(cfg){
    if(wycenaTabStatusBridge && typeof wycenaTabStatusBridge.askConfirm === 'function'){
      try{ return !!(await wycenaTabStatusBridge.askConfirm(cfg)); }catch(_){ }
    }
    return true;
  }

  function canAcceptSnapshot(snapshot, history){
    if(wycenaTabStatusBridge && typeof wycenaTabStatusBridge.canAcceptSnapshot === 'function'){
      try{
        return !!wycenaTabStatusBridge.canAcceptSnapshot(snapshot, history, {
          normalizeSnapshot,
          getSnapshotId,
          isSelectedSnapshot,
          isRejectedSnapshot,
          getSnapshotHistory,
          getProjectStatusForHistory,
          isArchivedPreliminary,
        });
      }catch(_){ }
    }
    return false;
  }

  function commitAcceptedSnapshotWithSync(snapshot, status, options){
    if(wycenaTabStatusBridge && typeof wycenaTabStatusBridge.commitAcceptedSnapshotWithSync === 'function'){
      try{
        return wycenaTabStatusBridge.commitAcceptedSnapshotWithSync(snapshot, status, options, {
          normalizeSnapshot,
          normalizeStatusKey,
        });
      }catch(_){ }
    }
    return null;
  }

  function reconcileAfterSnapshotRemoval(snapshot, options){
    if(wycenaTabStatusBridge && typeof wycenaTabStatusBridge.reconcileAfterSnapshotRemoval === 'function'){
      try{
        return wycenaTabStatusBridge.reconcileAfterSnapshotRemoval(snapshot, options, {
          normalizeSnapshot,
        });
      }catch(_){ }
    }
    return null;
  }

  function promotePreliminarySnapshotToFinal(snapshot, options){
    if(wycenaTabStatusBridge && typeof wycenaTabStatusBridge.promotePreliminarySnapshotToFinal === 'function'){
      try{
        return wycenaTabStatusBridge.promotePreliminarySnapshotToFinal(snapshot, options, {
          normalizeSnapshot,
        });
      }catch(_){ }
    }
    return null;
  }

  async function acceptSnapshot(snapshot, ctx, options){
    if(wycenaTabStatusBridge && typeof wycenaTabStatusBridge.acceptSnapshot === 'function'){
      try{
        return !!(await wycenaTabStatusBridge.acceptSnapshot(snapshot, ctx, options, {
          normalizeSnapshot,
          normalizeStatusKey,
          getSnapshotId,
          getSnapshotHistory,
          isSelectedSnapshot,
          isRejectedSnapshot,
          isPreliminarySnapshot,
          rememberQuoteScroll,
          clearRememberedQuoteScroll,
          render,
          setHistoryPreviewState:patchHistoryPreviewState,
          getProjectStatusForHistory,
          isArchivedPreliminary,
          canAcceptSnapshot,
          commitAcceptedSnapshotWithSync,
        }));
      }catch(_){ }
    }
    return false;
  }

  function labelWithInfo(title, infoTitle, infoMessage){
    const row = h('div', { class:'label-help' });
    row.appendChild(h('span', { class:'label-help__text', text:title }));
    if(infoMessage){
      const btn = h('button', { type:'button', class:'info-trigger', 'aria-label':`Pokaż informację: ${title}` });
      btn.addEventListener('click', ()=>{
        try{
          if(FC.infoBox && typeof FC.infoBox.open === 'function') FC.infoBox.open({ title:infoTitle || title, message:infoMessage });
        }catch(_){ }
      });
      row.appendChild(btn);
    }
    return row;
  }

  function defaultVersionName(preliminary, options){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.defaultVersionName === 'function'){
      try{ return FC.wycenaTabSelection.defaultVersionName(preliminary, options); }catch(_){ }
    }
    return preliminary ? 'Wstępna oferta' : 'Oferta';
  }

  function buildSelectionScopeSummary(selection){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.buildSelectionScopeSummary === 'function'){
      try{ return FC.wycenaTabSelection.buildSelectionScopeSummary(selection); }catch(_){ }
    }
    const selectedRooms = normalizeRoomIds(selection && selection.selectedRooms);
    return { roomIds:selectedRooms, roomLabels:selectedRooms.slice(), scopeLabel:selectedRooms.join(', ') || 'wybrany zakres', isMultiRoom:selectedRooms.length > 1 };
  }

  function shouldPromptForVersionNameOnGenerate(selection, draft){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.shouldPromptForVersionNameOnGenerate === 'function'){
      try{ return !!FC.wycenaTabSelection.shouldPromptForVersionNameOnGenerate(selection, draft, { getCurrentProjectId }); }catch(_){ }
    }
    return false;
  }

  async function ensureVersionNameBeforeGenerate(selection){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.ensureVersionNameBeforeGenerate === 'function'){
      try{ return await FC.wycenaTabSelection.ensureVersionNameBeforeGenerate(selection, { getOfferDraft, patchOfferDraft, getCurrentProjectId }); }catch(_){ }
    }
    return { cancelled:false, versionName:defaultVersionName(false, { selection }) };
  }

  function getVersionName(snapshot){
    const snap = normalizeSnapshot(snapshot) || {};
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getEffectiveVersionName === 'function'){
        const effective = String(FC.quoteSnapshotStore.getEffectiveVersionName(snap) || '').trim();
        if(effective) return effective;
      }
    }catch(_){ }
    return String(snap && snap.commercial && snap.commercial.versionName || snap && snap.meta && snap.meta.versionName || '').trim()
      || defaultVersionName(isPreliminarySnapshot(snap), snap && snap.scope ? { scope:snap.scope } : {});
  }

  function normalizeDraftSelection(draft){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.normalizeDraftSelection === 'function'){
      try{ return FC.wycenaTabSelection.normalizeDraftSelection(draft); }catch(_){ }
    }
    return { selectedRooms:[], materialScope:{ kind:'all', material:'', includeFronts:true, includeCorpus:true } };
  }

  function getRoomLabelsFromSelection(selection){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.getRoomLabelsFromSelection === 'function'){
      try{ return FC.wycenaTabSelection.getRoomLabelsFromSelection(selection); }catch(_){ }
    }
    return [];
  }

  function getRoomsPickerMeta(selection){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.getRoomsPickerMeta === 'function'){
      try{ return FC.wycenaTabSelection.getRoomsPickerMeta(selection); }catch(_){ }
    }
    return { title:'Brak pomieszczeń', subtitle:'' };
  }

  function getScopePickerMeta(selection){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.getScopePickerMeta === 'function'){
      try{ return FC.wycenaTabSelection.getScopePickerMeta(selection, { getMaterialScopeLabel }); }catch(_){ }
    }
    return { title:'Zakres wyceny', subtitle:getMaterialScopeLabel(selection), detail:'Wybór jak w ROZRYS' };
  }

  function buildSelectionSummary(selection){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.buildSelectionSummary === 'function'){
      try{ return FC.wycenaTabSelection.buildSelectionSummary(selection, { getMaterialScopeLabel }); }catch(_){ }
    }
    return { roomLabels:[], roomsMeta:{ title:'Brak pomieszczeń', subtitle:'' }, scopeMeta:getScopePickerMeta(selection), roomsText:'Brak pomieszczeń', scopeText:getMaterialScopeLabel(selection) };
  }

  function getQuoteHistoryItemDomId(snapshotId){
    if(wycenaTabScroll && typeof wycenaTabScroll.getQuoteHistoryItemDomId === 'function'){
      try{ return wycenaTabScroll.getQuoteHistoryItemDomId(snapshotId); }catch(_){ }
    }
    const key = String(snapshotId || '').trim();
    return key ? `quoteHistoryItem-${key}` : '';
  }

  function getQuoteHistoryNeighborDomId(snapshotId){
    if(wycenaTabScroll && typeof wycenaTabScroll.getQuoteHistoryNeighborDomId === 'function'){
      try{ return wycenaTabScroll.getQuoteHistoryNeighborDomId(snapshotId); }catch(_){ }
    }
    return 'quoteHistorySection';
  }

  function getScrollY(){
    if(wycenaTabScroll && typeof wycenaTabScroll.getScrollY === 'function'){
      try{ return wycenaTabScroll.getScrollY(); }catch(_){ }
    }
    return 0;
  }

  function rememberQuoteScroll(anchorId, fallbackAnchorId){
    if(wycenaTabScroll && typeof wycenaTabScroll.rememberQuoteScroll === 'function'){
      try{ return wycenaTabScroll.rememberQuoteScroll(anchorId, fallbackAnchorId, { getState:getQuoteScrollState, setState:patchQuoteScrollState }); }catch(_){ }
    }
  }

  function clearRememberedQuoteScroll(){
    if(wycenaTabScroll && typeof wycenaTabScroll.clearRememberedQuoteScroll === 'function'){
      try{ return wycenaTabScroll.clearRememberedQuoteScroll({ setState:patchQuoteScrollState }); }catch(_){ }
    }
    patchQuoteScrollState({ pendingScrollRestore:null, shouldRestoreScroll:false });
  }

  function restoreRememberedQuoteScroll(){
    if(wycenaTabScroll && typeof wycenaTabScroll.restoreRememberedQuoteScroll === 'function'){
      try{ return wycenaTabScroll.restoreRememberedQuoteScroll({ getState:getQuoteScrollState, setState:patchQuoteScrollState }); }catch(_){ }
    }
  }

  function getProjectStatusForHistory(history){
    if(wycenaTabHistory && typeof wycenaTabHistory.getProjectStatusForHistory === 'function'){
      try{
        return wycenaTabHistory.getProjectStatusForHistory(history, {
          getSnapshotHistory,
          currentProjectStatus,
          isSelectedSnapshot,
          getState:getHistoryPreviewState,
        });
      }catch(_){ }
    }
    const list = Array.isArray(history) ? history : getSnapshotHistory();
    return currentProjectStatus(list.find((row)=> isSelectedSnapshot(row)) || list[0] || lastQuote || null);
  }

  function openQuoteRoomsPicker(ctx){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.openQuoteRoomsPicker === 'function'){
      try{ return FC.wycenaTabSelection.openQuoteRoomsPicker(ctx, { getOfferDraft, patchOfferDraft, render, askConfirm }); }catch(_){ }
    }
  }

  function openQuoteScopePicker(ctx){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.openQuoteScopePicker === 'function'){
      try{ return FC.wycenaTabSelection.openQuoteScopePicker(ctx, { getOfferDraft, patchOfferDraft, render, askConfirm, h }); }catch(_){ }
    }
  }

  function renderQuoteSelectionSection(card, ctx){
    if(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.renderQuoteSelectionSection === 'function'){
      try{ return FC.wycenaTabSelection.renderQuoteSelectionSection(card, ctx, { h, labelWithInfo, openQuoteRoomsPicker, openQuoteScopePicker, getOfferDraft, getMaterialScopeLabel }); }catch(_){ }
    }
  }


  // Jedyny niski fallback kompatybilności, który jeszcze zostaje w Wycena.
  // Wyższe flow akceptacji/usuwania/konwersji nie mogą już wracać do własnych bocznych zapisów.
  function setProjectStatusFromSnapshot(snapshot, status, options){
    if(wycenaTabStatusBridge && typeof wycenaTabStatusBridge.setProjectStatusFromSnapshot === 'function'){
      try{
        return wycenaTabStatusBridge.setProjectStatusFromSnapshot(snapshot, status, options, {
          normalizeSnapshot,
          normalizeStatusKey,
          getCurrentProjectId,
          getCurrentInvestorId,
          getTargetRoomIdsFromSnapshot,
        });
      }catch(_){ }
    }
  }

  function syncGeneratedQuoteStatus(snapshot){
    if(wycenaTabStatusBridge && typeof wycenaTabStatusBridge.syncGeneratedQuoteStatus === 'function'){
      try{
        return wycenaTabStatusBridge.syncGeneratedQuoteStatus(snapshot, {
          normalizeSnapshot,
          isPreliminarySnapshot,
          statusRank,
          currentProjectStatus,
          setProjectStatusFromSnapshot,
        });
      }catch(_){ }
    }
  }

  function buildOfferSummary(draft){
    if(FC.wycenaTabEditor && typeof FC.wycenaTabEditor.buildOfferSummary === 'function'){
      try{ return FC.wycenaTabEditor.buildOfferSummary(draft, { money, num, normalizeDraftSelection, buildSelectionSummary }); }catch(_){ }
    }
    return 'Brak dodatkowych ustawień oferty';
  }

  function buildSelectionMap(draft){
    if(FC.wycenaTabEditor && typeof FC.wycenaTabEditor.buildSelectionMap === 'function'){
      try{ return FC.wycenaTabEditor.buildSelectionMap(draft, { num }); }catch(_){ }
    }
    return Object.create(null);
  }

  function saveRateSelectionRows(selections){
    if(FC.wycenaTabEditor && typeof FC.wycenaTabEditor.saveRateSelectionRows === 'function'){
      try{ return FC.wycenaTabEditor.saveRateSelectionRows(selections, { patchOfferDraft, num }); }catch(_){ }
    }
    return null;
  }

  function renderQuotePreview(card, currentQuote, ctx){
    if(wycenaTabPreview && typeof wycenaTabPreview.renderPreview === 'function'){
      try{
        return wycenaTabPreview.renderPreview(card, currentQuote, ctx, {
          h,
          money,
          buildRowMeta,
          formatDateTime,
          getSnapshotId,
          getSnapshotHistory,
          getMaterialScopeLabel,
          isPreliminarySnapshot,
          isSelectedSnapshot,
          canAcceptSnapshot,
          acceptSnapshot,
          getVersionName,
        });
      }catch(_){ }
    }
  }

  function buildField(labelText, inputNode, full){
    if(FC.wycenaTabEditor && typeof FC.wycenaTabEditor.buildField === 'function'){
      try{ return FC.wycenaTabEditor.buildField(labelText, inputNode, full, { h }); }catch(_){ }
    }
    return null;
  }

  function makeRateSelectionRows(catalog, selectionMap){
    if(FC.wycenaTabEditor && typeof FC.wycenaTabEditor.makeRateSelectionRows === 'function'){
      try{ return FC.wycenaTabEditor.makeRateSelectionRows(catalog, selectionMap, { num }); }catch(_){ }
    }
    return [];
  }

  function renderPreliminaryToggle(card, ctx){
    if(FC.wycenaTabEditor && typeof FC.wycenaTabEditor.renderPreliminaryToggle === 'function'){
      try{ return FC.wycenaTabEditor.renderPreliminaryToggle(card, ctx, { h, getOfferDraft, patchOfferDraft, normalizeDraftSelection, defaultVersionName, render }); }catch(_){ }
    }
  }

  function renderOfferEditor(card, ctx){
    if(FC.wycenaTabEditor && typeof FC.wycenaTabEditor.renderOfferEditor === 'function'){
      try{
        return FC.wycenaTabEditor.renderOfferEditor(card, ctx, {
          h,
          getOfferDraft,
          patchOfferDraft,
          normalizeDraftSelection,
          defaultVersionName,
          buildOfferSummary,
          buildSelectionMap,
          saveRateSelectionRows,
          buildField,
          makeRateSelectionRows,
          money,
          num,
          render,
          getIsOpen: ()=> offerEditorOpen,
          setIsOpen: (next)=>{ offerEditorOpen = !!next; },
        });
      }catch(_){ }
    }
  }

  function renderHistory(card, ctx, currentQuote){
    if(wycenaTabHistory && typeof wycenaTabHistory.renderHistory === 'function'){
      try{
        return wycenaTabHistory.renderHistory(card, ctx, currentQuote, {
          h,
          money,
          formatDateTime,
          getVersionName,
          getMaterialScopeLabel,
          getSnapshotHistory,
          normalizeSnapshot,
          getSnapshotId,
          isSelectedSnapshot,
          isRejectedSnapshot,
          isPreliminarySnapshot,
          isArchivedPreliminary,
          getRejectedReason,
          getProjectStatusForHistory,
          canAcceptSnapshot,
          acceptSnapshot,
          currentProjectStatus,
          askConfirm,
          rememberQuoteScroll,
          clearRememberedQuoteScroll,
          getQuoteHistoryItemDomId,
          getQuoteHistoryNeighborDomId,
          reconcileAfterSnapshotRemoval,
          promotePreliminarySnapshotToFinal,
          render,
          getState:getHistoryPreviewState,
          setState:patchHistoryPreviewState,
        });
      }catch(_){ }
    }
  }

  let lastQuote = null;
  let previewSnapshotId = '';
  let lastKnownProjectStatus = '';
  let isBusy = false;
  let shouldScrollToPreview = false;
  let shouldRestoreScroll = false;
  let pendingScrollRestore = null;
  let offerEditorOpen = false;

  function render(ctx){
    const list = ctx && ctx.listEl;
    if(!list) return;
    list.innerHTML = '';
    const card = h('div', { class:'build-card quote-root', id:'quoteActivePreview' });
    const head = h('div', { class:'quote-topbar' });
    head.appendChild(h('h3', { text:'Wycena', style:'margin:0' }));
    const actions = h('div', { class:'quote-topbar__actions' });
    const runBtn = h('button', { class:'btn-success', type:'button', text: isBusy ? 'Liczę…' : 'Wyceń' });
    if(isBusy) runBtn.disabled = true;
    runBtn.addEventListener('click', async ()=>{
      if(isBusy) return;
      isBusy = true;
      render(ctx);
      try{
        const selection = normalizeDraftSelection(getOfferDraft());
        const naming = await ensureVersionNameBeforeGenerate(selection);
        if(naming && naming.cancelled) return;
        if(FC.wycenaCore && typeof FC.wycenaCore.buildQuoteSnapshot === 'function') lastQuote = await FC.wycenaCore.buildQuoteSnapshot({ selection });
        else if(FC.wycenaCore && typeof FC.wycenaCore.collectQuoteData === 'function') lastQuote = await FC.wycenaCore.collectQuoteData({ selection });
        if(lastQuote && !lastQuote.error) syncGeneratedQuoteStatus(lastQuote);
      }catch(err){
        try{ console.error('[wycena] collect failed', err); }catch(_){ }
        if(err && err.quoteValidation){
          try{
            if(FC.infoBox && typeof FC.infoBox.open === 'function'){
              FC.infoBox.open({
                title:String(err.title || 'Nie można utworzyć wyceny'),
                message:String(err.message || 'Nie udało się utworzyć wyceny.'),
                okOnly:true,
                dismissOnOverlay:false,
                dismissOnEsc:false,
              });
            }
          }catch(_){ }
        } else {
          lastQuote = { error: String(err && err.message || err || 'Błąd wyceny'), totals:{ materials:0, accessories:0, services:0, quoteRates:0, subtotal:0, discount:0, grand:0 }, roomLabels:[] };
        }
      }finally{
        isBusy = false;
        render(ctx);
      }
    });
    actions.appendChild(runBtn);

    const liveStatus = getProjectStatusForHistory(getSnapshotHistory());
    if(lastKnownProjectStatus && liveStatus !== lastKnownProjectStatus){
      previewSnapshotId = '';
      lastQuote = null;
    }
    lastKnownProjectStatus = liveStatus;

    const currentQuote = resolveDisplayedQuote();
    const pdfBtn = h('button', { class:'btn-primary', type:'button', text:'PDF' });
    if(!currentQuote || currentQuote.error) pdfBtn.disabled = true;
    pdfBtn.addEventListener('click', ()=>{
      try{ FC.quotePdf && typeof FC.quotePdf.openQuotePdf === 'function' && FC.quotePdf.openQuotePdf(currentQuote); }catch(_){ }
    });
    actions.appendChild(pdfBtn);
    head.appendChild(actions);
    card.appendChild(head);

    renderPreliminaryToggle(card, ctx);
    renderQuoteSelectionSection(card, ctx);
    renderOfferEditor(card, ctx);

    renderQuotePreview(card, currentQuote, ctx);
    renderHistory(card, ctx, currentQuote);
    list.appendChild(card);
    if(shouldScrollToPreview){
      shouldScrollToPreview = false;
      clearRememberedQuoteScroll();
      try{
        requestAnimationFrame(()=>{
          try{
            const target = document.getElementById('quotePreviewStart') || document.getElementById('quoteActivePreview');
            if(target){
              const absoluteTop = getScrollY() + target.getBoundingClientRect().top;
              const targetTop = Math.max(0, Math.round(absoluteTop - 96));
              window.scrollTo({ top:targetTop, behavior:'smooth' });
            }
          }catch(_){ }
        });
      }catch(_){ }
    } else if(shouldRestoreScroll){
      restoreRememberedQuoteScroll();
    }
  }

  function showSnapshotPreview(snapshotId){
    if(wycenaTabHistory && typeof wycenaTabHistory.showSnapshotPreview === 'function'){
      try{
        return !!wycenaTabHistory.showSnapshotPreview(snapshotId, {
          snapshotById,
          getSnapshotHistory,
          setState:patchHistoryPreviewState,
        });
      }catch(_){ }
    }
    return false;
  }

  FC.wycenaTabDebug = Object.assign({}, FC.wycenaTabDebug || {}, {
    currentProjectStatus,
    setProjectStatusFromSnapshot,
    commitAcceptedSnapshotWithSync,
    reconcileAfterSnapshotRemoval,
    promotePreliminarySnapshotToFinal,
    acceptSnapshot,
    getTargetRoomIdsFromSnapshot,
    isArchivedPreliminary,
    isRejectedSnapshot,
    canAcceptSnapshot,
    showSnapshotPreview,
    shouldPromptForVersionNameOnGenerate,
  });

  (FC.tabsRouter || FC.tabs || {}).register?.('wycena', { mount(){}, render, unmount(){} });
})();
