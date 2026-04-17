(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function getProjectStatusForHistory(history, deps){
    const list = Array.isArray(history) ? history : (deps.getSnapshotHistory ? deps.getSnapshotHistory() : []);
    const fallbackQuote = deps.getState ? (deps.getState().lastQuote || null) : null;
    return deps.currentProjectStatus(list.find((row)=> deps.isSelectedSnapshot(row)) || list[0] || fallbackQuote || null);
  }

  function resolveDisplayedQuote(deps){
    const history = deps.getSnapshotHistory();
    const state = deps.getState();
    const selected = history.find((row)=> deps.isSelectedSnapshot(row)) || null;
    const firstActive = history.find((row)=> !deps.isArchivedPreliminary(row, history, getProjectStatusForHistory(history, deps))) || history[0] || null;
    const status = getProjectStatusForHistory(history, deps);
    const latestPreliminary = history.find((row)=> deps.isPreliminarySnapshot(row)) || null;
    const latestFinal = history.find((row)=> !deps.isPreliminarySnapshot(row)) || null;
    const preview = deps.snapshotById(state.previewSnapshotId, history);

    if(preview){
      deps.setState({ lastQuote:preview });
      return deps.normalizeSnapshot(preview);
    }
    if(state.previewSnapshotId) deps.setState({ previewSnapshotId:'' });

    if(status === 'pomiar'){
      const candidate = (selected && deps.isPreliminarySnapshot(selected) ? selected : null) || latestPreliminary;
      if(candidate){
        deps.setState({ lastQuote:candidate });
        return deps.normalizeSnapshot(candidate);
      }
    }
    if(status === 'wstepna_wycena'){
      if(latestPreliminary){
        deps.setState({ lastQuote:latestPreliminary });
        return deps.normalizeSnapshot(latestPreliminary);
      }
    }
    if(status === 'wycena'){
      if(latestFinal){
        deps.setState({ lastQuote:latestFinal });
        return deps.normalizeSnapshot(latestFinal);
      }
    }
    if(deps.isFinalStatus(status)){
      const candidate = (selected && !deps.isPreliminarySnapshot(selected) ? selected : null) || latestFinal;
      if(candidate){
        deps.setState({ lastQuote:candidate });
        return deps.normalizeSnapshot(candidate);
      }
    }
    if(selected && state.lastQuote && deps.getSnapshotId(state.lastQuote) === deps.getSnapshotId(selected) && !deps.isFinalStatus(status) && status !== 'pomiar'){
      deps.setState({ lastQuote:null });
    }
    if(state.lastQuote){
      const normalized = deps.normalizeSnapshot(state.lastQuote);
      if(normalized) return normalized;
    }
    if(firstActive){
      deps.setState({ lastQuote:firstActive });
      return deps.normalizeSnapshot(firstActive);
    }
    return null;
  }

  function showSnapshotPreview(snapshotId, deps){
    const snap = deps.snapshotById(snapshotId, deps.getSnapshotHistory());
    if(!snap) return false;
    deps.setState({
      previewSnapshotId: String(snapshotId || ''),
      lastQuote: snap,
      shouldScrollToPreview: true,
    });
    return true;
  }

  function renderHistory(card, ctx, currentQuote, deps){
    const history = deps.getSnapshotHistory();
    const activeId = deps.getSnapshotId(currentQuote);
    const projectStatus = getProjectStatusForHistory(history, deps);
    const section = deps.h('section', { class:'card quote-section', style:'margin-top:12px;padding:14px;' });
    section.appendChild(deps.h('h4', { text:'Historia wycen', style:'margin:0 0 10px' }));
    if(!history.length){
      section.appendChild(deps.h('div', { class:'muted', text:'Brak zapisanych wersji oferty dla tego projektu.' }));
      card.appendChild(section);
      return;
    }
    const wrap = deps.h('div', { class:'quote-history', id:'quoteHistorySection' });
    history.slice(0, 8).forEach((snapshot, index)=>{
      const snap = deps.normalizeSnapshot(snapshot) || {};
      const snapId = deps.getSnapshotId(snap);
      const state = deps.getState();
      const isActive = !!activeId && snapId === activeId;
      const isSelected = deps.isSelectedSnapshot(snap);
      const isRejected = deps.isRejectedSnapshot(snap);
      const isPreliminary = deps.isPreliminarySnapshot(snap);
      const isArchived = deps.isArchivedPreliminary(snap, history, projectStatus);
      const item = deps.h('article', { id:deps.getQuoteHistoryItemDomId(snapId), 'data-quote-history-id':snapId, class:`quote-history__item${isActive ? ' is-active' : ''}${isArchived ? ' is-archived' : ''}` });
      const top = deps.h('div', { class:'quote-history__top' });
      const titleBox = deps.h('div', { class:'quote-history__content' });
      const roomLabels = (function(){ try{ return FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getScopeRoomLabels === 'function' ? FC.quoteSnapshotStore.getScopeRoomLabels(snap) : (Array.isArray(snap.scope && snap.scope.roomLabels) ? snap.scope.roomLabels : []); }catch(_){ return Array.isArray(snap.scope && snap.scope.roomLabels) ? snap.scope.roomLabels : []; } })();
      const titleRow = deps.h('div', { class:'quote-history__title-row' });
      const versionName = deps.getVersionName(snap);
      titleRow.appendChild(deps.h('div', { class:'quote-history__title', text:versionName || (index === 0 ? 'Ostatnia wersja oferty' : 'Wersja oferty') }));
      if(isPreliminary) titleRow.appendChild(deps.h('span', { class:'quote-history__badge quote-history__badge--preliminary', text:'Wstępna' }));
      if(isSelected) titleRow.appendChild(deps.h('span', { class:'quote-history__badge quote-history__badge--selected', text:'Zaakceptowana' }));
      if(isRejected) titleRow.appendChild(deps.h('span', { class:'quote-history__badge quote-history__badge--archived', text:'Odrzucona' }));
      if(isArchived) titleRow.appendChild(deps.h('span', { class:'quote-history__badge quote-history__badge--archived', text:'Archiwalna po pomiarze' }));
      titleBox.appendChild(titleRow);
      const meta = [];
      meta.push(`Wersja oferty: ${deps.formatDateTime(snap.generatedAt)}`);
      if(roomLabels.length) meta.push(`Pomieszczenia: ${roomLabels.join(', ')}`);
      meta.push(`Zakres: ${deps.getMaterialScopeLabel(snap)}`);
      meta.push(`Razem: ${deps.money(snap.totals && snap.totals.grand)}`);
      if(isSelected && Number(snap.meta && snap.meta.acceptedAt) > 0) meta.push(`Zaakceptowana: ${deps.formatDateTime(snap.meta.acceptedAt)}`);
      if(isRejected) meta.push(deps.getRejectedReason(snap) === 'scope_changed'
        ? 'Ta oferta została odrzucona po zmianie zakresu zaakceptowanej wyceny.'
        : 'Ta oferta została odrzucona i nie jest już aktywną podstawą statusów.');
      if(isArchived) meta.push('Ta wycena wstępna została wygaszona po stworzeniu wyceny po pomiarze.');
      titleBox.appendChild(deps.h('div', { class:'quote-history__meta', text:meta.join(' • ') }));
      top.appendChild(titleBox);
      item.appendChild(top);
      const actions = deps.h('div', { class:'quote-history__actions' });
      const openBtn = deps.h('button', { class:isActive ? 'btn-success' : 'btn', type:'button', text:isActive ? 'Wyświetlana' : 'Podgląd' });
      if(isActive || isArchived) openBtn.disabled = true;
      openBtn.addEventListener('click', ()=>{
        deps.clearRememberedQuoteScroll();
        deps.setState({ previewSnapshotId:snapId, lastQuote:snap, shouldScrollToPreview:true });
        deps.render(ctx);
      });
      actions.appendChild(openBtn);
      const acceptLabel = isSelected ? 'Zaakceptowana' : (isRejected ? 'Odrzucona' : 'Zaakceptuj');
      const chooseBtn = deps.h('button', { class:'btn-success', type:'button', text:acceptLabel });
      if(!deps.canAcceptSnapshot(snap, history)) chooseBtn.disabled = true;
      chooseBtn.addEventListener('click', ()=> {
        void deps.acceptSnapshot(snap, ctx, { rememberScroll:true, anchorId:deps.getQuoteHistoryItemDomId(snapId), history });
      });
      actions.appendChild(chooseBtn);
      const pdfBtn = deps.h('button', { class:'btn-primary', type:'button', text:'PDF' });
      if(isArchived) pdfBtn.disabled = true;
      pdfBtn.addEventListener('click', ()=>{
        try{ FC.quotePdf && typeof FC.quotePdf.openQuotePdf === 'function' && FC.quotePdf.openQuotePdf(snap); }catch(_){ }
      });
      actions.appendChild(pdfBtn);
      const deleteBtn = deps.h('button', { class:'btn-danger', type:'button', text:'Usuń' });
      deleteBtn.addEventListener('click', async ()=>{
        deps.rememberQuoteScroll(deps.getQuoteHistoryItemDomId(snapId), deps.getQuoteHistoryNeighborDomId(snapId));
        const confirmed = await deps.askConfirm({
          title:'USUNĄĆ OFERTĘ?',
          message:'Ta wersja oferty zostanie trwale usunięta z historii.',
          confirmText:'Usuń ofertę',
          cancelText:'Wróć',
          confirmTone:'danger',
          cancelTone:'neutral'
        });
        if(!confirmed){
          deps.clearRememberedQuoteScroll();
          return;
        }
        try{
          if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.remove === 'function') FC.quoteSnapshotStore.remove(snapId);
        }catch(_){ }
        try{
          deps.reconcileAfterSnapshotRemoval(snap, { refreshUi:false, fallbackStatus:'nowy' });
        }catch(_){ }
        const nextHistory = deps.getSnapshotHistory();
        if(state.previewSnapshotId === snapId) deps.setState({ previewSnapshotId:'' });
        if(isActive || deps.getSnapshotId(state.lastQuote) === snapId){
          deps.setState({ lastQuote: nextHistory.find((row)=> !deps.isArchivedPreliminary(row, nextHistory, getProjectStatusForHistory(nextHistory, deps))) || nextHistory[0] || null });
        }
        deps.render(ctx);
      });
      actions.appendChild(deleteBtn);
      if(isPreliminary && isSelected && !isArchived){
        const convertBtn = deps.h('button', { class:'btn quote-history__convert-btn', type:'button', text:'Końcowa' });
        convertBtn.addEventListener('click', ()=>{
          deps.rememberQuoteScroll(deps.getQuoteHistoryItemDomId(snapId));
          const promoteResult = deps.promotePreliminarySnapshotToFinal(snap);
          const converted = promoteResult && (promoteResult.convertedSnapshot || promoteResult.snapshot) || null;
          if(converted){
            deps.setState({ previewSnapshotId:snapId, lastQuote:converted });
            deps.render(ctx);
          }
        });
        actions.appendChild(convertBtn);
      }
      item.appendChild(actions);
      wrap.appendChild(item);
    });
    section.appendChild(wrap);
    card.appendChild(section);
  }

  FC.wycenaTabHistory = Object.assign({}, FC.wycenaTabHistory || {}, {
    getProjectStatusForHistory,
    resolveDisplayedQuote,
    renderHistory,
    showSnapshotPreview,
  });
})();
