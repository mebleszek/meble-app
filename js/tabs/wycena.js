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
          getSnapshotId,
          getSnapshotHistory,
          isPreliminarySnapshot,
          rememberQuoteScroll,
          clearRememberedQuoteScroll,
          render,
          setHistoryPreviewState:patchHistoryPreviewState,
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

  function renderEmpty(card){
    card.appendChild(h('p', { class:'muted', text:'Wycena pobiera materiały z działu Materiał, uruchamia rozkrój w tle na logice ROZRYS dla pomieszczeń i zakresu wybranych bezpośrednio tutaj oraz dolicza pozycje AGD z dodanych szafek. Dodaj także stawki wyceny i pola handlowe, aby wygenerować ofertę dla klienta.' }));
  }

  function renderSection(card, title, rows, emptyText){
    const wrap = h('section', { class:'card quote-section', style:'margin-top:12px;padding:14px;' });
    wrap.appendChild(h('h4', { text:title, style:'margin:0 0 10px' }));
    if(!rows || !rows.length){
      wrap.appendChild(h('div', { class:'muted', text:emptyText || 'Brak pozycji.' }));
      card.appendChild(wrap);
      return;
    }

    const list = h('div', { class:'quote-list' });
    const head = h('div', { class:'quote-list__head' });
    ['Pozycja','Ilość','Cena','Wartość'].forEach((label)=> head.appendChild(h('div', { class:'quote-list__cell quote-list__cell--head', text:label })));
    list.appendChild(head);

    rows.forEach((row)=>{
      const item = h('article', { class:'quote-list__item' });
      const main = h('div', { class:'quote-list__row' });
      main.appendChild(h('div', { class:'quote-list__cell quote-list__cell--name', text:row.name || 'Pozycja' }));
      main.appendChild(h('div', { class:'quote-list__cell quote-list__cell--qty', text:String(row.qty || 0) + (row.unit ? ` ${row.unit}` : '') }));
      main.appendChild(h('div', { class:'quote-list__cell quote-list__cell--price', text:money(row.unitPrice) }));
      main.appendChild(h('div', { class:'quote-list__cell quote-list__cell--total', text:money(row.total) }));
      item.appendChild(main);
      const metaText = buildRowMeta(row);
      if(metaText) item.appendChild(h('div', { class:'quote-list__meta', text:metaText }));
      list.appendChild(item);
    });

    wrap.appendChild(list);
    card.appendChild(wrap);
  }

  function renderCommercialSection(card, snapshot, ctx){
    const commercial = snapshot && snapshot.commercial || {};
    const totals = snapshot && snapshot.totals || {};
    const section = h('section', { class:'card quote-section', style:'margin-top:12px;padding:14px;' });
    section.appendChild(h('h4', { text:'Warunki oferty', style:'margin:0 0 10px' }));
    const list = h('div', { class:'quote-commercial-list' });
    const addRow = (label, value, strong)=>{
      const text = String(value || '').trim();
      if(!text) return;
      const row = h('div', { class:'quote-commercial-list__row' });
      row.appendChild(h('div', { class:'quote-commercial-list__label', text:label }));
      row.appendChild(h('div', { class:`quote-commercial-list__value${strong ? ' is-strong' : ''}`, text }));
      list.appendChild(row);
    };
    addRow('Wersja oferty', commercial.versionName);
    addRow('Typ oferty', commercial.preliminary ? 'Wstępna wycena (bez pomiaru)' : 'Wycena');
    addRow('Zakres elementów', getMaterialScopeLabel(snapshot));
    if(Number(commercial.discountPercent) > 0) addRow('Rabat', `${Number(commercial.discountPercent).toFixed(2)}%`, true);
    else if(Number(commercial.discountAmount) > 0) addRow('Rabat', money(commercial.discountAmount), true);
    addRow('Ważność oferty', commercial.offerValidity);
    addRow('Termin realizacji', commercial.leadTime);
    addRow('Warunki montażu / transportu', commercial.deliveryTerms);
    addRow('Notatka dla klienta', commercial.customerNote);
    if(!list.childNodes.length) list.appendChild(h('div', { class:'muted', text:'Brak dodatkowych pól handlowych dla tej wersji oferty.' }));
    section.appendChild(list);
    const totalsCard = h('div', { class:'card quote-totals', style:'margin-top:12px;padding:14px;' });
    totalsCard.appendChild(h('h4', { text:'Podsumowanie', style:'margin:0 0 8px' }));
    [
      ['Materiały', totals.materials],
      ['Akcesoria', totals.accessories],
      ['Robocizna / stawki wyceny', totals.quoteRates],
      ['Montaż AGD', totals.services],
      ['Suma przed rabatem', totals.subtotal],
      ['Rabat', totals.discount],
      ['Razem', totals.grand],
    ].forEach(([label, value], index, arr)=>{
      const row = h('div', { class:`quote-totals__row${index === arr.length - 1 ? ' quote-totals__row--grand' : ''}` });
      row.appendChild(h('span', { text:label }));
      row.appendChild(h('span', { text:money(value) }));
      totalsCard.appendChild(row);
    });
    if(canAcceptSnapshot(snapshot)){
      const previewActions = h('div', { class:'quote-preview-actions' });
      const acceptBtn = h('button', { class:'btn-success', type:'button', text:'Zaakceptuj ofertę' });
      acceptBtn.addEventListener('click', ()=> {
        void acceptSnapshot(snapshot, ctx, { rememberScroll:true, anchorId:'quotePreviewStart', fallbackAnchorId:'quoteActivePreview' });
      });
      previewActions.appendChild(acceptBtn);
      totalsCard.appendChild(previewActions);
    }
    card.appendChild(section);
    card.appendChild(totalsCard);
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

    if(!currentQuote){
      renderEmpty(card);
    } else if(currentQuote.error){
      card.appendChild(h('div', { class:'muted', text:currentQuote.error, style:'margin-top:10px;color:#b42318' }));
    } else {
      const roomLabels = (function(){
        try{
          if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getScopeRoomLabels === 'function') return FC.quoteSnapshotStore.getScopeRoomLabels(currentQuote);
        }catch(_){ }
        return Array.isArray(currentQuote.roomLabels) ? currentQuote.roomLabels : (currentQuote.scope && Array.isArray(currentQuote.scope.roomLabels) ? currentQuote.scope.roomLabels : []);
      })();
      const lines = currentQuote.lines || {};
      const materialLines = Array.isArray(currentQuote.materialLines) ? currentQuote.materialLines : (Array.isArray(lines.materials) ? lines.materials : []);
      const accessoryLines = Array.isArray(currentQuote.accessoryLines) ? currentQuote.accessoryLines : (Array.isArray(lines.accessories) ? lines.accessories : []);
      const agdLines = Array.isArray(currentQuote.agdLines) ? currentQuote.agdLines : (Array.isArray(lines.agdServices) ? lines.agdServices : []);
      const quoteRateLines = Array.isArray(currentQuote.quoteRateLines) ? currentQuote.quoteRateLines : (Array.isArray(lines.quoteRates) ? lines.quoteRates : []);
      const generatedAt = currentQuote.generatedAt || currentQuote.generatedDate || null;
      if(generatedAt){
        card.appendChild(h('div', { id:'quotePreviewStart' }));
        const isLatest = getSnapshotId(currentQuote) === getSnapshotId(getSnapshotHistory()[0]);
        const previewMeta = h('div', { class:'quote-preview-meta' });
        previewMeta.appendChild(h('span', { class:`quote-preview-badge${isLatest ? ' is-latest' : ''}`, text:isLatest ? 'Aktualna wersja oferty' : 'Wersja oferty z historii' }));
        if(isPreliminarySnapshot(currentQuote)) previewMeta.appendChild(h('span', { class:'quote-preview-badge quote-preview-badge--preliminary', text:'Wstępna wycena' }));
        if(isSelectedSnapshot(currentQuote)) previewMeta.appendChild(h('span', { class:'quote-preview-badge quote-preview-badge--selected', text:'Zaakceptowana' }));
        if(getVersionName(currentQuote)) previewMeta.appendChild(h('span', { class:'quote-preview-badge quote-preview-badge--version', text:getVersionName(currentQuote) }));
        previewMeta.appendChild(h('p', { class:'muted quote-scope', text:`Wersja oferty: ${formatDateTime(generatedAt)}` }));
        card.appendChild(previewMeta);
      }
      if(Array.isArray(roomLabels) && roomLabels.length){
        card.appendChild(h('p', { class:'muted quote-scope', text:`Pomieszczenia: ${roomLabels.join(', ')}`, style:'margin-top:6px' }));
      }
      card.appendChild(h('p', { class:'muted quote-scope', text:`Zakres elementów: ${getMaterialScopeLabel(currentQuote)}`, style:'margin-top:6px' }));
      renderSection(card, 'Materiały z ROZRYS', materialLines, 'Brak pozycji materiałowych.');
      renderSection(card, 'Akcesoria', accessoryLines, 'Brak pozycji akcesoriów.');
      renderSection(card, 'Robocizna / stawki wyceny mebli', quoteRateLines, 'Brak pozycji robocizny.');
      renderSection(card, 'Sprzęty do zabudowy / montaż AGD', agdLines, 'Brak wykrytych sprzętów do zabudowy.');
      renderCommercialSection(card, currentQuote, ctx);
    }
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
