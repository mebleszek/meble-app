// js/tabs/wycena.js
// Zakładka WYCENA — handlowa wersja oferty, PDF klienta i historia wersji.

(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function money(v){ return `${(Number(v)||0).toFixed(2)} PLN`; }

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

  function num(value, fallback){
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function buildRowMeta(row){
    const parts = [];
    const category = String(row && row.category || '').trim();
    const note = String(row && row.note || '').trim();
    const rooms = String(row && row.rooms || '').trim();
    if(category) parts.push(category);
    if(note && (!category || note !== category)) parts.push(note);
    if(rooms && (!note || rooms !== note)) parts.push(`Pomieszczenia: ${rooms}`);
    return parts.join(' • ');
  }

  function formatDateTime(value){
    const ts = Number(value) > 0 ? Number(value) : Date.parse(String(value || ''));
    if(!Number.isFinite(ts) || ts <= 0) return '—';
    try{
      const d = new Date(ts);
      const pad = (n)=> String(n).padStart(2, '0');
      return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }catch(_){ return '—'; }
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

  function resolveDisplayedQuote(){
    const history = getSnapshotHistory();
    const selected = history.find((row)=> isSelectedSnapshot(row)) || null;
    const firstActive = history.find((row)=> !isArchivedPreliminary(row, history, getProjectStatusForHistory(history))) || history[0] || null;
    const status = getProjectStatusForHistory(history);
    const latestPreliminary = history.find((row)=> isPreliminarySnapshot(row)) || null;
    const latestFinal = history.find((row)=> !isPreliminarySnapshot(row)) || null;
    const preview = snapshotById(previewSnapshotId, history);

    if(preview){
      lastQuote = preview;
      return normalizeSnapshot(preview);
    }
    if(previewSnapshotId) previewSnapshotId = '';

    if(status === 'pomiar'){
      const candidate = (selected && isPreliminarySnapshot(selected) ? selected : null) || latestPreliminary;
      if(candidate){
        lastQuote = candidate;
        return normalizeSnapshot(candidate);
      }
    }
    if(status === 'wstepna_wycena'){
      if(latestPreliminary){
        lastQuote = latestPreliminary;
        return normalizeSnapshot(latestPreliminary);
      }
    }
    if(status === 'wycena'){
      if(latestFinal){
        lastQuote = latestFinal;
        return normalizeSnapshot(latestFinal);
      }
    }
    if(isFinalStatus(status)){
      const candidate = (selected && !isPreliminarySnapshot(selected) ? selected : null) || latestFinal;
      if(candidate){
        lastQuote = candidate;
        return normalizeSnapshot(candidate);
      }
    }
    if(selected && lastQuote && getSnapshotId(lastQuote) === getSnapshotId(selected) && !isFinalStatus(status) && status !== 'pomiar'){
      lastQuote = null;
    }
    if(lastQuote){
      const normalized = normalizeSnapshot(lastQuote);
      if(normalized) return normalized;
    }
    if(firstActive){
      lastQuote = firstActive;
      return normalizeSnapshot(firstActive);
    }
    return null;
  }

  function getSnapshotId(snapshot){
    try{ return String(snapshot && snapshot.id || ''); }catch(_){ return ''; }
  }

  const STATUS_RANK = {
    nowy:0,
    wstepna_wycena:1,
    pomiar:2,
    wycena:3,
    zaakceptowany:4,
    umowa:5,
    produkcja:6,
    montaz:7,
    zakonczone:8,
    odrzucone:-1,
  };

  function normalizeStatusKey(value){
    return String(value || '').trim().toLowerCase();
  }

  function statusRank(value){
    const key = normalizeStatusKey(value);
    return Object.prototype.hasOwnProperty.call(STATUS_RANK, key) ? STATUS_RANK[key] : -99;
  }

  function isFinalStatus(value){
    const key = normalizeStatusKey(value);
    return key === 'zaakceptowany' || key === 'umowa' || key === 'produkcja' || key === 'montaz' || key === 'zakonczone';
  }

  function isSelectedSnapshot(snapshot){
    try{ return !!(snapshot && snapshot.meta && snapshot.meta.selectedByClient); }catch(_){ return false; }
  }

  function isRejectedSnapshot(snapshot){
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.isRejectedSnapshot === 'function') return !!FC.quoteSnapshotStore.isRejectedSnapshot(snapshot);
    }catch(_){ }
    return !!(snapshot && snapshot.meta && (Number(snapshot.meta.rejectedAt) > 0 || String(snapshot.meta.rejectedReason || '').trim()));
  }

  function getRejectedReason(snapshot){
    try{ return String(snapshot && snapshot.meta && snapshot.meta.rejectedReason || '').trim().toLowerCase(); }catch(_){ return ''; }
  }

  function isPreliminarySnapshot(snapshot){
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.isPreliminarySnapshot === 'function') return !!FC.quoteSnapshotStore.isPreliminarySnapshot(snapshot);
    }catch(_){ }
    return !!(snapshot && ((snapshot.meta && snapshot.meta.preliminary) || (snapshot.commercial && snapshot.commercial.preliminary)));
  }

  function normalizeRoomIds(roomIds){
    if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.normalizeRoomIds === 'function'){
      try{ return FC.quoteSnapshotStore.normalizeRoomIds(roomIds); }catch(_){ }
    }
    return Array.isArray(roomIds)
      ? Array.from(new Set(roomIds.map((item)=> String(item || '').trim()).filter(Boolean)))
      : [];
  }

  function getSnapshotRoomIds(snapshot){
    if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getSnapshotRoomIds === 'function'){
      try{ return FC.quoteSnapshotStore.getSnapshotRoomIds(snapshot); }catch(_){ }
    }
    return normalizeRoomIds(snapshot && snapshot.scope && snapshot.scope.selectedRooms);
  }

  function getAllActiveRoomIds(){
    try{ return FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomIds === 'function' ? normalizeRoomIds(FC.roomRegistry.getActiveRoomIds()) : []; }catch(_){ return []; }
  }

  function getTargetRoomIdsFromSnapshot(snapshot){
    const scoped = getSnapshotRoomIds(snapshot);
    return scoped.length ? scoped : getAllActiveRoomIds();
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

  function warnMissingProjectStatusSync(){
    try{
      if(!warnMissingProjectStatusSync._done && typeof console !== 'undefined' && console && typeof console.warn === 'function'){
        warnMissingProjectStatusSync._done = true;
        console.warn('[Wycena] Brak FC.projectStatusSync — używam ograniczonego fallbacku statusów.');
      }
    }catch(_){ }
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
    try{
      if(FC.projectStatusSync && typeof FC.projectStatusSync.resolveCurrentProjectStatus === 'function'){
        return normalizeStatusKey(FC.projectStatusSync.resolveCurrentProjectStatus(snapshot));
      }
    }catch(_){ }
    warnMissingProjectStatusSync();
    const snap = normalizeSnapshot(snapshot) || {};
    const projectId = String(snap && snap.project && snap.project.id || getCurrentProjectId() || '');
    try{
      if(projectId && FC.projectStore && typeof FC.projectStore.getById === 'function'){
        const projectRecord = FC.projectStore.getById(projectId);
        if(projectRecord && projectRecord.status) return normalizeStatusKey(projectRecord.status);
      }
    }catch(_){ }
    return normalizeStatusKey(snap && snap.project && snap.project.status || '');
  }


  async function askConfirm(cfg){
    try{
      if(FC.confirmBox && typeof FC.confirmBox.ask === 'function') return !!(await FC.confirmBox.ask(cfg));
    }catch(_){ }
    return true;
  }

  function canAcceptSnapshot(snapshot, history){
    const snap = normalizeSnapshot(snapshot) || null;
    if(!snap || !getSnapshotId(snap)) return false;
    if(isSelectedSnapshot(snap) || isRejectedSnapshot(snap)) return false;
    const list = Array.isArray(history) ? history : getSnapshotHistory();
    const projectStatus = getProjectStatusForHistory(list);
    return !isArchivedPreliminary(snap, list, projectStatus);
  }

  async function acceptSnapshot(snapshot, ctx, options){
    const snap = normalizeSnapshot(snapshot) || null;
    if(!snap) return false;
    const snapId = getSnapshotId(snap);
    const opts = options && typeof options === 'object' ? options : {};
    const history = Array.isArray(opts.history) ? opts.history : getSnapshotHistory();
    if(!canAcceptSnapshot(snap, history)) return false;
    const targetStatus = isPreliminarySnapshot(snap) ? 'pomiar' : 'zaakceptowany';
    if(opts.rememberScroll) rememberQuoteScroll(String(opts.anchorId || ''), String(opts.fallbackAnchorId || ''));
    const confirmed = await askConfirm({
      title:'OZNACZYĆ OFERTĘ?',
      message:isPreliminarySnapshot(snap)
        ? 'Ta wersja zostanie zaakceptowana, a status projektu zmieni się na „Pomiar”.'
        : 'Ta wersja zostanie zaakceptowana, a status projektu zmieni się na „Zaakceptowany”.',
      confirmText:'Zaakceptuj ofertę',
      cancelText:'Wróć',
      confirmTone:'success',
      cancelTone:'neutral'
    });
    if(!confirmed){
      if(opts.rememberScroll) clearRememberedQuoteScroll();
      return false;
    }
    let selected = null;
    try{
      selected = FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.markSelectedForProject === 'function'
        ? FC.quoteSnapshotStore.markSelectedForProject(String(snap.project && snap.project.id || getCurrentProjectId() || ''), snapId, { status:targetStatus })
        : snap;
    }catch(_){ selected = snap; }
    if(!selected) return false;
    previewSnapshotId = snapId;
    setProjectStatusFromSnapshot(selected, targetStatus);
    lastQuote = selected;
    render(ctx);
    return true;
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
    try{
      if(FC.quoteOfferStore && typeof FC.quoteOfferStore.defaultVersionName === 'function') return FC.quoteOfferStore.defaultVersionName(!!preliminary, options || {});
    }catch(_){ }
    return preliminary ? 'Wstępna oferta' : 'Oferta';
  }

  function getVersionName(snapshot){
    const snap = normalizeSnapshot(snapshot) || {};
    return String(snap && snap.commercial && snap.commercial.versionName || snap && snap.meta && snap.meta.versionName || '').trim()
      || defaultVersionName(isPreliminarySnapshot(snap), snap && snap.scope ? { scope:snap.scope } : {});
  }

  function getMaterialScopeMode(snapshotOrScope){
    const source = snapshotOrScope && snapshotOrScope.scope ? snapshotOrScope.scope : snapshotOrScope;
    const explicit = String(source && source.materialScopeMode || '').trim();
    if(explicit) return explicit;
    try{
      if(FC.quoteSnapshot && typeof FC.quoteSnapshot.materialScopeMode === 'function') return FC.quoteSnapshot.materialScopeMode(source && source.materialScope);
    }catch(_){ }
    try{
      if(FC.rozrysScope && typeof FC.rozrysScope.getRozrysScopeMode === 'function') return FC.rozrysScope.getRozrysScopeMode(source && source.materialScope);
    }catch(_){ }
    return 'both';
  }

  function getMaterialScopeLabel(snapshotOrScope){
    const mode = getMaterialScopeMode(snapshotOrScope);
    if(mode === 'corpus') return 'Same korpusy';
    if(mode === 'fronts') return 'Same fronty';
    return 'Korpusy + fronty';
  }

  function normalizeDraftSelection(draft){
    try{
      if(FC.wycenaCore && typeof FC.wycenaCore.normalizeQuoteSelection === 'function') return FC.wycenaCore.normalizeQuoteSelection(draft && draft.selection);
    }catch(_){ }
    return {
      selectedRooms:[],
      materialScope:{ kind:'all', material:'', includeFronts:true, includeCorpus:true },
    };
  }

  function getRoomLabelsFromSelection(selection){
    const rows = Array.isArray(selection && selection.selectedRooms) ? selection.selectedRooms : [];
    return rows.map((roomId)=>{
      try{ return FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function' ? FC.roomRegistry.getRoomLabel(roomId) : String(roomId || ''); }catch(_){ return String(roomId || ''); }
    }).filter(Boolean);
  }

  function getRoomsPickerMeta(selection){
    try{
      if(FC.rozrysScope && typeof FC.rozrysScope.getRoomsSummary === 'function'){
        return FC.rozrysScope.getRoomsSummary(selection && selection.selectedRooms, {
          getRooms: ()=> {
            try{ return FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomIds === 'function' ? FC.roomRegistry.getActiveRoomIds() : []; }catch(_){ return []; }
          }
        }) || { title:'Brak pomieszczeń', subtitle:'' };
      }
    }catch(_){ }
    const roomLabels = getRoomLabelsFromSelection(selection);
    return {
      title: roomLabels.length ? roomLabels.join(', ') : 'Brak pomieszczeń',
      subtitle: roomLabels.length ? `${roomLabels.length} wybrane` : '',
    };
  }

  function getScopePickerMeta(selection){
    return {
      title:'Zakres wyceny',
      subtitle:getMaterialScopeLabel(selection),
      detail:'Wybór jak w ROZRYS',
    };
  }

  function buildSelectionSummary(selection){
    const roomLabels = getRoomLabelsFromSelection(selection);
    const roomsMeta = getRoomsPickerMeta(selection);
    const scopeMeta = getScopePickerMeta(selection);
    return {
      roomLabels,
      roomsMeta,
      scopeMeta,
      roomsText: roomLabels.length ? roomLabels.join(', ') : 'Brak pomieszczeń',
      scopeText: getMaterialScopeLabel(selection),
    };
  }

  function snapshotById(id, history){
    const key = String(id || '');
    if(!key) return null;
    const list = Array.isArray(history) ? history : getSnapshotHistory();
    return list.find((row)=> getSnapshotId(row) === key) || null;
  }

  function getQuoteHistoryItemDomId(snapshotId){
    const key = String(snapshotId || '').trim();
    return key ? `quoteHistoryItem-${key}` : '';
  }

  function getQuoteHistoryNeighborDomId(snapshotId){
    try{
      const currentId = getQuoteHistoryItemDomId(snapshotId);
      const current = currentId ? document.getElementById(currentId) : null;
      if(!current) return 'quoteHistorySection';
      let next = current.nextElementSibling;
      while(next){
        if(next.matches && next.matches('[data-quote-history-id]') && next.id) return next.id;
        next = next.nextElementSibling;
      }
      let prev = current.previousElementSibling;
      while(prev){
        if(prev.matches && prev.matches('[data-quote-history-id]') && prev.id) return prev.id;
        prev = prev.previousElementSibling;
      }
    }catch(_){ }
    return 'quoteHistorySection';
  }

  function getScrollY(){
    try{
      if(typeof window.scrollY === 'number') return Math.max(0, Math.round(window.scrollY));
      const doc = document.documentElement || document.body;
      return Math.max(0, Math.round(Number(doc && doc.scrollTop) || 0));
    }catch(_){ return 0; }
  }

  function rememberQuoteScroll(anchorId, fallbackAnchorId){
    const scrollY = getScrollY();
    let domId = String(anchorId || '').trim();
    let fallbackDomId = String(fallbackAnchorId || '').trim();
    let anchor = domId ? document.getElementById(domId) : null;
    if(!anchor && fallbackDomId) anchor = document.getElementById(fallbackDomId);
    if(!anchor){
      try{
        const focused = document.activeElement;
        anchor = focused && typeof focused.closest === 'function'
          ? focused.closest('[data-quote-history-id], #quotePreviewStart, #quoteActivePreview, #quoteHistorySection')
          : null;
        if(anchor && !domId) domId = String(anchor.id || '').trim();
      }catch(_){ anchor = null; }
    }
    let offset = 0;
    if(anchor){
      try{
        const rect = anchor.getBoundingClientRect();
        const absoluteTop = scrollY + rect.top;
        offset = scrollY - absoluteTop;
      }catch(_){ offset = 0; }
    }
    try{
      const active = document.activeElement;
      if(active && typeof active.blur === 'function') active.blur();
    }catch(_){ }
    pendingScrollRestore = {
      scrollY: Math.max(0, Math.round(scrollY)),
      domId,
      fallbackDomId,
      offset: Number.isFinite(offset) ? offset : 0,
      ts: Date.now(),
    };
    shouldRestoreScroll = true;
  }

  function clearRememberedQuoteScroll(){
    pendingScrollRestore = null;
    shouldRestoreScroll = false;
  }

  function restoreRememberedQuoteScroll(){
    const snapshot = pendingScrollRestore && typeof pendingScrollRestore === 'object' ? Object.assign({}, pendingScrollRestore) : null;
    clearRememberedQuoteScroll();
    if(!snapshot) return;

    const resolveTargetTop = ()=>{
      try{
        const anchor = (snapshot.domId && document.getElementById(snapshot.domId))
          || (snapshot.fallbackDomId && document.getElementById(snapshot.fallbackDomId));
        const baseTop = anchor
          ? (getScrollY() + anchor.getBoundingClientRect().top)
          : (Number(snapshot.scrollY) || 0);
        return Math.max(0, Math.round(baseTop + (Number(snapshot.offset) || 0)));
      }catch(_){
        return Math.max(0, Math.round(Number(snapshot.scrollY) || 0));
      }
    };

    const applyOnce = ()=>{
      try{
        const targetTop = resolveTargetTop();
        if(Math.abs(getScrollY() - targetTop) > 1) window.scrollTo(0, targetTop);
      }catch(_){ }
    };

    const delayed = [0, 16, 48, 120, 240, 420];
    delayed.forEach((delay)=>{
      try{
        if(delay === 0) requestAnimationFrame(()=> requestAnimationFrame(applyOnce));
        else setTimeout(applyOnce, delay);
      }catch(_){
        try{ setTimeout(applyOnce, delay); }catch(__){ }
      }
    });
  }

  function getProjectStatusForHistory(history){
    const list = Array.isArray(history) ? history : getSnapshotHistory();
    return currentProjectStatus(list.find((row)=> isSelectedSnapshot(row)) || list[0] || lastQuote || null);
  }

  function openQuoteRoomsPicker(ctx){
    const draft = getOfferDraft();
    const selection = normalizeDraftSelection(draft);
    try{
      if(!(FC.rozrysPickers && typeof FC.rozrysPickers.openRoomsPicker === 'function')) return;
      FC.rozrysPickers.openRoomsPicker({
        getSelectedRooms: ()=> selection.selectedRooms,
        setSelectedRooms: (rooms)=>{
          const nextRooms = Array.isArray(rooms) ? rooms.slice() : [];
          const draft = getOfferDraft();
          const commercial = draft && draft.commercial || {};
          const currentVersionName = String(commercial.versionName || '').trim();
          const prevDefault = defaultVersionName(!!commercial.preliminary, { selection });
          const nextSelection = Object.assign({}, selection, { selectedRooms:nextRooms });
          const patch = { selection:{ selectedRooms:nextRooms } };
          if(!currentVersionName || currentVersionName === prevDefault){
            patch.commercial = { versionName:defaultVersionName(!!commercial.preliminary, { selection:nextSelection }) };
          }
          patchOfferDraft(patch);
          render(ctx);
        },
        getRooms: ()=> {
          try{ return FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomIds === 'function' ? FC.roomRegistry.getActiveRoomIds() : []; }catch(_){ return []; }
        },
        normalizeRoomSelection: (rooms)=>{
          try{ return FC.rozrysScope && typeof FC.rozrysScope.normalizeRoomSelection === 'function' ? FC.rozrysScope.normalizeRoomSelection(rooms, { getRooms:()=> FC.roomRegistry.getActiveRoomIds() }) : (Array.isArray(rooms) ? rooms : []); }catch(_){ return Array.isArray(rooms) ? rooms : []; }
        },
        roomLabel: (roomId)=> {
          try{ return FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function' ? FC.roomRegistry.getRoomLabel(roomId) : String(roomId || ''); }catch(_){ return String(roomId || ''); }
        },
        askConfirm,
        refreshSelectionState: ()=> render(ctx),
      });
    }catch(_){ }
  }

  function openQuoteScopePicker(ctx){
    const draft = getOfferDraft();
    const selection = normalizeDraftSelection(draft);
    const currentScope = Object.assign({ kind:'all', material:'', includeFronts:true, includeCorpus:true }, selection && selection.materialScope || {});
    try{
      if(!(FC.panelBox && typeof FC.panelBox.open === 'function')) return;
      const body = h('div', { class:'rozrys-picker-modal' });
      const list = h('div', { class:'rozrys-picker-list' });
      const cardNode = h('div', { class:'rozrys-picker-option rozrys-picker-card is-selected' });
      const titleWrap = h('div', { class:'rozrys-picker-option__title-wrap' });
      titleWrap.appendChild(h('div', { class:'rozrys-picker-option__title', text:'Zakres elementów do wyceny' }));
      titleWrap.appendChild(h('div', { class:'rozrys-picker-option__subtitle', text:'Wybierz dokładnie tak samo jak w ROZRYS, co ma wejść do tej wyceny.' }));
      cardNode.appendChild(titleWrap);
      const chips = h('div', { class:'rozrys-scope-chips quote-scope-picker-chips' });
      const draftScope = Object.assign({}, currentScope);
      const bindChip = (label, key)=>{
        const chip = h('label', { class:`rozrys-scope-chip rozrys-scope-chip--room-match${draftScope[key] ? ' is-checked' : ''}` });
        const cb = h('input', { type:'checkbox' });
        cb.checked = !!draftScope[key];
        cb.addEventListener('change', ()=>{
          draftScope[key] = !!cb.checked;
          if(!draftScope.includeFronts && !draftScope.includeCorpus){
            draftScope[key] = true;
            cb.checked = true;
          }
          chip.classList.toggle('is-checked', !!cb.checked);
          updateFooterState();
        });
        chip.appendChild(cb);
        chip.appendChild(h('span', { text:label }));
        chips.appendChild(chip);
      };
      bindChip('Fronty', 'includeFronts');
      bindChip('Korpusy', 'includeCorpus');
      cardNode.appendChild(chips);
      list.appendChild(cardNode);
      body.appendChild(list);

      const footer = h('div', { class:'rozrys-picker-footer rozrys-picker-footer--material' });
      const actionWrap = h('div', { class:'rozrys-picker-footer-actions' });
      const exitBtn = h('button', { type:'button', class:'btn-primary', text:'Wyjdź' });
      const cancelBtn = h('button', { type:'button', class:'btn-danger', text:'Anuluj' });
      const saveBtn = h('button', { type:'button', class:'btn-success', text:'Zatwierdź' });
      const isDirty = ()=> (!!draftScope.includeFronts !== !!currentScope.includeFronts) || (!!draftScope.includeCorpus !== !!currentScope.includeCorpus);
      const updateFooterState = ()=>{
        actionWrap.innerHTML = '';
        if(isDirty()){
          saveBtn.disabled = !(draftScope.includeFronts || draftScope.includeCorpus);
          actionWrap.appendChild(cancelBtn);
          actionWrap.appendChild(saveBtn);
        }else{
          actionWrap.appendChild(exitBtn);
        }
      };
      exitBtn.addEventListener('click', ()=> FC.panelBox.close());
      cancelBtn.addEventListener('click', async ()=>{
        const ok = await askConfirm({
          title:'ANULOWAĆ ZMIANY?',
          message:'Niezapisane zmiany w wyborze zakresu wyceny zostaną utracone.',
          confirmText:'✕ ANULUJ ZMIANY',
          cancelText:'WRÓĆ',
          confirmTone:'danger',
          cancelTone:'neutral'
        });
        if(!ok) return;
        FC.panelBox.close();
      });
      saveBtn.addEventListener('click', ()=>{
        if(!(draftScope.includeFronts || draftScope.includeCorpus)) return;
        patchOfferDraft({ selection:{ materialScope:Object.assign({}, draftScope) } });
        FC.panelBox.close();
        render(ctx);
      });
      updateFooterState();
      footer.appendChild(actionWrap);
      body.appendChild(footer);
      FC.panelBox.open({
        title:'Wybierz zakres wyceny',
        contentNode: body,
        width:'820px',
        boxClass:'panel-box--rozrys',
        dismissOnOverlay:false,
        beforeClose: ()=> isDirty() ? askConfirm({
          title:'ANULOWAĆ ZMIANY?',
          message:'Niezapisane zmiany w wyborze zakresu wyceny zostaną utracone.',
          confirmText:'✕ ANULUJ ZMIANY',
          cancelText:'WRÓĆ',
          confirmTone:'danger',
          cancelTone:'neutral'
        }) : true
      });
    }catch(_){ }
  }

  function renderQuoteSelectionSection(card, ctx){
    const draft = getOfferDraft();
    const selection = normalizeDraftSelection(draft);
    const summary = buildSelectionSummary(selection);
    const section = h('section', { class:'card quote-selection-card panel-box--rozrys', style:'margin-top:12px;padding:14px;' });
    const grid = h('div', { class:'quote-selection-grid rozrys-selection-grid' });

    const roomsField = h('div', { class:'quote-selection-field rozrys-field rozrys-selection-grid__rooms' });
    roomsField.appendChild(labelWithInfo('Pomieszczenia do wyceny', 'Pomieszczenia do wyceny', 'Wybierz pomieszczenia bez wchodzenia do ROZRYS. Kliknięcie „Wyceń” uruchomi rozkrój w tle dokładnie dla tego zakresu.'));
    const roomsBtn = h('button', { type:'button', class:'btn rozrys-picker-launch rozrys-picker-launch--rooms quote-selection-launch--rooms' });
    const roomsValue = h('div', { class:'rozrys-picker-launch__value' });
    roomsValue.appendChild(h('div', { class:'rozrys-picker-launch__title', text:String(summary.roomsMeta && summary.roomsMeta.title || summary.roomsText) }));
    if(summary.roomsMeta && summary.roomsMeta.subtitle) roomsValue.appendChild(h('div', { class:'rozrys-picker-launch__subtitle', text:String(summary.roomsMeta.subtitle || '') }));
    roomsBtn.appendChild(roomsValue);
    roomsBtn.addEventListener('click', ()=> openQuoteRoomsPicker(ctx));
    roomsField.appendChild(roomsBtn);
    grid.appendChild(roomsField);

    const scopeField = h('div', { class:'quote-selection-field rozrys-field rozrys-selection-grid__material' });
    scopeField.appendChild(labelWithInfo('Zakres elementów do wyceny', 'Zakres elementów do wyceny', 'Zakres działa jak w ROZRYS: możesz liczyć korpusy i fronty razem albo tylko jedną z tych grup.'));
    const scopeBtn = h('button', { type:'button', class:'btn rozrys-picker-launch rozrys-picker-launch--material quote-selection-launch--scope' });
    const scopeValue = h('div', { class:'rozrys-picker-launch__value' });
    scopeValue.appendChild(h('div', { class:'rozrys-picker-launch__title', text:String(summary.scopeMeta && summary.scopeMeta.title || summary.scopeText) }));
    if(summary.scopeMeta && summary.scopeMeta.subtitle) scopeValue.appendChild(h('div', { class:'rozrys-picker-launch__subtitle', text:String(summary.scopeMeta.subtitle || '') }));
    if(summary.scopeMeta && summary.scopeMeta.detail) scopeValue.appendChild(h('div', { class:'rozrys-picker-launch__detail', text:String(summary.scopeMeta.detail || '') }));
    scopeBtn.appendChild(scopeValue);
    scopeBtn.addEventListener('click', ()=> openQuoteScopePicker(ctx));
    scopeField.appendChild(scopeBtn);
    grid.appendChild(scopeField);
    section.appendChild(grid);

    const info = h('div', { class:'quote-scope-info' });
    info.appendChild(h('div', { class:'quote-scope-info__title', text:'Zakres bieżącej wyceny' }));
    info.appendChild(h('div', { class:'quote-scope-info__body', text:`Pomieszczenia: ${summary.roomsText}
Zakres: ${summary.scopeText}
Kliknięcie „Wyceń” użyje logiki ROZRYS w tle dla tego wyboru.` }));
    section.appendChild(info);
    card.appendChild(section);
  }


  function setProjectStatusFromSnapshot(snapshot, status, options){
    const snap = normalizeSnapshot(snapshot) || {};
    const nextStatus = normalizeStatusKey(status);
    if(!nextStatus) return;
    try{
      if(FC.projectStatusSync && typeof FC.projectStatusSync.setStatusFromSnapshot === 'function'){
        FC.projectStatusSync.setStatusFromSnapshot(snap, nextStatus, options || {});
        return;
      }
    }catch(_){ }

    warnMissingProjectStatusSync();
    const syncSelection = !!(options && options.syncSelection);
    const projectId = String(snap && snap.project && snap.project.id || getCurrentProjectId() || '');
    const investorId = String(
      snap && snap.investor && snap.investor.id
      || snap && snap.project && snap.project.investorId
      || getCurrentInvestorId()
      || ''
    );
    const targetRoomIds = getTargetRoomIdsFromSnapshot(snap);

    if(syncSelection){
      try{
        if(projectId && FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.syncSelectionForProjectStatus === 'function'){
          FC.quoteSnapshotStore.syncSelectionForProjectStatus(projectId, nextStatus, targetRoomIds.length ? { roomIds:targetRoomIds } : undefined);
        }
      }catch(_){ }
    }

    try{
      if(investorId && targetRoomIds.length && FC.investorPersistence && typeof FC.investorPersistence.updateInvestorRoom === 'function'){
        targetRoomIds.forEach((roomId)=> {
          const key = String(roomId || '');
          if(key) FC.investorPersistence.updateInvestorRoom(investorId, key, { projectStatus:nextStatus });
        });
      }
    }catch(_){ }

    try{
      if(projectId && FC.projectStore && typeof FC.projectStore.getById === 'function' && typeof FC.projectStore.upsert === 'function'){
        const record = FC.projectStore.getById(projectId) || (typeof FC.projectStore.getCurrentRecord === 'function' ? FC.projectStore.getCurrentRecord() : null);
        if(record) FC.projectStore.upsert(Object.assign({}, record, { status:nextStatus, updatedAt:Date.now() }));
      }
    }catch(_){ }

    try{
      if(FC.project && typeof FC.project.save === 'function'){
        const proj = FC.project.load ? (FC.project.load() || {}) : {};
        const meta = proj && proj.meta && typeof proj.meta === 'object' ? proj.meta : null;
        if(meta){
          meta.projectStatus = nextStatus;
          if(meta.roomDefs && typeof meta.roomDefs === 'object'){
            targetRoomIds.forEach((roomId)=> {
              const key = String(roomId || '');
              const row = meta.roomDefs[key];
              if(row && typeof row === 'object') meta.roomDefs[key] = Object.assign({}, row, { projectStatus:nextStatus });
            });
          }
          FC.project.save(proj);
        }
      }
    }catch(_){ }

    try{ if(FC.views && typeof FC.views.refreshSessionButtons === 'function') FC.views.refreshSessionButtons(); }catch(_){ }
    try{ if(FC.investorUI && typeof FC.investorUI.render === 'function') FC.investorUI.render(); }catch(_){ }
    try{ if(FC.roomRegistry && typeof FC.roomRegistry.renderRoomsView === 'function') FC.roomRegistry.renderRoomsView(); }catch(_){ }
  }

  function syncGeneratedQuoteStatus(snapshot){
    const snap = normalizeSnapshot(snapshot);
    if(!snap || !snap.project) return;
    const preliminary = isPreliminarySnapshot(snap);
    const targetStatus = preliminary ? 'wstepna_wycena' : 'wycena';
    const currentStatus = currentProjectStatus(snap);
    if(statusRank(currentStatus) > statusRank(targetStatus)) return;
    setProjectStatusFromSnapshot(snap, targetStatus, { syncSelection:true });
  }

  function buildOfferSummary(draft){
    const data = draft && typeof draft === 'object' ? draft : {};
    const commercial = data.commercial || {};
    const rates = Array.isArray(data.rateSelections) ? data.rateSelections.filter((row)=> num(row && row.qty, 0) > 0) : [];
    const summary = buildSelectionSummary(normalizeDraftSelection(data));
    const parts = [];
    if(String(commercial.versionName || '').trim()) parts.push(`Wersja: ${String(commercial.versionName).trim()}`);
    if(commercial.preliminary) parts.push('Wstępna wycena');
    parts.push(summary.scopeText);
    if(rates.length) parts.push(`Stawki: ${rates.length}`);
    if(Number(commercial.discountPercent) > 0) parts.push(`Rabat ${Number(commercial.discountPercent).toFixed(2)}%`);
    else if(Number(commercial.discountAmount) > 0) parts.push(`Rabat ${money(commercial.discountAmount)}`);
    if(String(commercial.offerValidity || '').trim()) parts.push(`Ważność: ${String(commercial.offerValidity).trim()}`);
    if(String(commercial.leadTime || '').trim()) parts.push(`Termin: ${String(commercial.leadTime).trim()}`);
    return parts.join(' • ') || 'Brak dodatkowych ustawień oferty';
  }

  function buildSelectionMap(draft){
    const out = Object.create(null);
    const rows = Array.isArray(draft && draft.rateSelections) ? draft.rateSelections : [];
    rows.forEach((row)=>{
      const key = String(row && row.rateId || '');
      if(!key) return;
      out[key] = Math.max(0, num(row && row.qty, 0));
    });
    return out;
  }

  function saveRateSelectionRows(selections){
    patchOfferDraft({ rateSelections: selections.map((row)=> ({ rateId:String(row.rateId || ''), qty:Math.max(0, num(row.qty, 0)) })).filter((row)=> row.rateId) });
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
    const wrap = h('div', { class:'investor-choice-field quote-offer-field' });
    if(full) wrap.style.gridColumn = '1 / -1';
    wrap.appendChild(h('label', { text:labelText }));
    wrap.appendChild(inputNode);
    return wrap;
  }

  function makeRateSelectionRows(catalog, selectionMap){
    return (Array.isArray(catalog) ? catalog : []).map((rate)=> ({
      rateId: String(rate && rate.id || ''),
      qty: Math.max(0, num(selectionMap[String(rate && rate.id || '')], 0)),
    })).filter((row)=> row.rateId);
  }

  function renderPreliminaryToggle(card, ctx){
    const draft = getOfferDraft();
    const commercial = draft && draft.commercial || {};
    const preliminaryWrap = h('div', { class:'quote-offer-preliminary quote-offer-preliminary--topbar' });
    const preliminaryChip = h('label', { class:`rozrys-scope-chip rozrys-scope-chip--room-match quote-preliminary-chip${commercial.preliminary ? ' is-checked' : ''}` });
    const preliminaryInput = h('input', { type:'checkbox' });
    preliminaryInput.checked = !!commercial.preliminary;
    preliminaryInput.addEventListener('change', ()=>{
      const nextPreliminary = !!preliminaryInput.checked;
      const currentVersionName = String(commercial.versionName || '').trim();
      const selection = normalizeDraftSelection(draft);
      const prevDefault = defaultVersionName(!!commercial.preliminary, { selection });
      const nextDefault = defaultVersionName(nextPreliminary, { selection });
      patchOfferDraft({ commercial:{ preliminary:nextPreliminary, versionName:(!currentVersionName || currentVersionName === prevDefault) ? nextDefault : currentVersionName } });
      render(ctx);
    });
    preliminaryChip.appendChild(preliminaryInput);
    preliminaryChip.appendChild(h('span', { text:'Wstępna wycena (bez pomiaru)' }));
    preliminaryWrap.appendChild(preliminaryChip);
    card.appendChild(preliminaryWrap);
  }

  function renderOfferEditor(card, ctx){
    const draft = getOfferDraft();
    const commercial = draft && draft.commercial || {};
    const catalog = FC.catalogSelectors && typeof FC.catalogSelectors.getQuoteRates === 'function' ? FC.catalogSelectors.getQuoteRates() : [];
    const selectionMap = buildSelectionMap(draft);

    const section = h('section', { class:`quote-offer-accordion rozrys-material-accordion${offerEditorOpen ? ' is-open' : ''}`, style:'margin-top:12px;' });
    const head = h('div', { class:'quote-offer-accordion__head' });
    const trigger = h('button', { class:'rozrys-material-accordion__trigger quote-offer-accordion__trigger', type:'button' });
    const titleBox = h('div', { class:'rozrys-material-accordion__title quote-offer-accordion__titlebox' });
    titleBox.appendChild(h('div', { class:'rozrys-material-accordion__title-line1', text:'Ustawienia oferty do nowej wyceny' }));
    titleBox.appendChild(h('div', { class:'rozrys-material-accordion__title-line2 quote-offer-accordion__summary-line', text:buildOfferSummary(draft) }));
    const chevron = h('span', { class:`rozrys-material-accordion__chevron${offerEditorOpen ? ' is-open' : ''}`, html:'&#9662;', 'aria-hidden':'true' });
    trigger.appendChild(titleBox);
    trigger.appendChild(chevron);
    trigger.addEventListener('click', ()=>{
      offerEditorOpen = !offerEditorOpen;
      render(ctx);
    });
    head.appendChild(trigger);
    const headRow = h('div', { class:'quote-offer-accordion__head-row rozrys-material-accordion__grain-row' });
    headRow.appendChild(h('span', { class:'rozrys-pill is-raw quote-selection-info-pill', text:'Wpływa na kolejną wersję oferty' }));
    head.appendChild(headRow);
    section.appendChild(head);

    if(offerEditorOpen){
      const body = h('div', { class:'quote-offer-accordion__body rozrys-material-accordion__body' });
      const selection = normalizeDraftSelection(draft);
      const versionInput = h('input', { class:'investor-form-input', type:'text', value:String(commercial.versionName || defaultVersionName(!!commercial.preliminary, { selection }) || '') });
      const syncVersionName = ()=> patchOfferDraft({ commercial:{ versionName:String(versionInput.value || '').trim() || defaultVersionName(!!commercial.preliminary, { selection:normalizeDraftSelection(getOfferDraft()) }) } });
      versionInput.addEventListener('focus', ()=>{ try{ versionInput.setSelectionRange(0, String(versionInput.value || '').length); }catch(_){ try{ versionInput.select(); }catch(__){} } });
      versionInput.addEventListener('pointerup', (ev)=>{ try{ ev.preventDefault(); }catch(_){ } try{ versionInput.setSelectionRange(0, String(versionInput.value || '').length); }catch(_){ try{ versionInput.select(); }catch(__){} } });
      versionInput.addEventListener('change', syncVersionName);
      versionInput.addEventListener('blur', syncVersionName);
      body.appendChild(buildField('Nazwa wersji oferty', versionInput, true));

      const rateShell = h('div', { class:'quote-rate-editor' });
      if(!catalog.length){
        rateShell.appendChild(h('div', { class:'muted', text:'Brak zdefiniowanych stawek wyceny mebli. Dodaj je w cenniku.' }));
      } else {
        catalog.forEach((rate)=>{
          const item = h('div', { class:'quote-rate-editor__item' });
          const info = h('div', { class:'quote-rate-editor__info' });
          info.appendChild(h('div', { class:'quote-rate-editor__title', text:String(rate && rate.name || 'Stawka wyceny') }));
          const metaParts = [];
          if(String(rate && rate.category || '').trim()) metaParts.push(String(rate.category).trim());
          metaParts.push(`Cena: ${money(rate && rate.price)}`);
          info.appendChild(h('div', { class:'quote-rate-editor__meta', text:metaParts.join(' • ') }));
          item.appendChild(info);
          const qtyWrap = h('div', { class:'quote-rate-editor__qty' });
          qtyWrap.appendChild(h('label', { text:'Ilość' }));
          const qtyInput = h('input', { class:'investor-form-input', type:'number', min:'0', step:'1', value:String(num(selectionMap[String(rate && rate.id || '')], 0) || '') });
          qtyInput.addEventListener('change', ()=>{
            const nextMap = Object.assign({}, selectionMap, { [String(rate && rate.id || '')]: Math.max(0, num(qtyInput.value, 0)) });
            saveRateSelectionRows(makeRateSelectionRows(catalog, nextMap));
          });
          qtyWrap.appendChild(qtyInput);
          item.appendChild(qtyWrap);
          rateShell.appendChild(item);
        });
      }
      body.appendChild(h('div', { class:'quote-subsection-title', text:'Robocizna / stawki wyceny mebli', style:'margin-top:14px' }));
      body.appendChild(rateShell);

      const grid = h('div', { class:'grid-2 quote-offer-grid', style:'margin-top:14px' });
      const discountPercentInput = h('input', { class:'investor-form-input', type:'number', min:'0', step:'0.01', value:String(num(commercial.discountPercent, 0) || '') });
      const discountAmountInput = h('input', { class:'investor-form-input', type:'number', min:'0', step:'0.01', value:String(num(commercial.discountAmount, 0) || '') });
      const validityInput = h('input', { class:'investor-form-input', type:'text', value:String(commercial.offerValidity || '') });
      const leadTimeInput = h('input', { class:'investor-form-input', type:'text', value:String(commercial.leadTime || '') });
      const deliveryInput = h('textarea', { class:'investor-form-input investor-form-textarea quote-offer-textarea' });
      deliveryInput.value = String(commercial.deliveryTerms || '');
      const noteInput = h('textarea', { class:'investor-form-input investor-form-textarea quote-offer-textarea' });
      noteInput.value = String(commercial.customerNote || '');

      function syncCommercial(){
        const nextCommercial = {
          versionName:String(versionInput.value || '').trim(),
          preliminary: !!preliminaryInput.checked,
          discountPercent: Math.max(0, num(discountPercentInput.value, 0)),
          discountAmount: Math.max(0, num(discountAmountInput.value, 0)),
          offerValidity: String(validityInput.value || '').trim(),
          leadTime: String(leadTimeInput.value || '').trim(),
          deliveryTerms: String(deliveryInput.value || '').trim(),
          customerNote: String(noteInput.value || '').trim(),
        };
        if(nextCommercial.discountPercent > 0) nextCommercial.discountAmount = 0;
        if(nextCommercial.discountAmount > 0) nextCommercial.discountPercent = 0;
        if(String(discountPercentInput.value || '').trim() !== String(nextCommercial.discountPercent || '')) discountPercentInput.value = nextCommercial.discountPercent ? String(nextCommercial.discountPercent) : '';
        if(String(discountAmountInput.value || '').trim() !== String(nextCommercial.discountAmount || '')) discountAmountInput.value = nextCommercial.discountAmount ? String(nextCommercial.discountAmount) : '';
        patchOfferDraft({ commercial: nextCommercial });
      }

      [discountPercentInput, discountAmountInput, validityInput, leadTimeInput].forEach((input)=>{
        input.addEventListener('change', syncCommercial);
        input.addEventListener('blur', syncCommercial);
      });
      [deliveryInput, noteInput].forEach((input)=>{
        input.addEventListener('change', syncCommercial);
        input.addEventListener('blur', syncCommercial);
      });

      grid.appendChild(buildField('Rabat %', discountPercentInput));
      grid.appendChild(buildField('Rabat kwotowy', discountAmountInput));
      grid.appendChild(buildField('Ważność oferty', validityInput));
      grid.appendChild(buildField('Termin realizacji', leadTimeInput));
      grid.appendChild(buildField('Warunki montażu / transportu', deliveryInput, true));
      grid.appendChild(buildField('Notatka dla klienta', noteInput, true));
      body.appendChild(grid);
      section.appendChild(body);
    }

    card.appendChild(section);
  }

  function renderHistory(card, ctx, currentQuote){
    const history = getSnapshotHistory();
    const activeId = getSnapshotId(currentQuote);
    const projectStatus = getProjectStatusForHistory(history);
    const section = h('section', { class:'card quote-section', style:'margin-top:12px;padding:14px;' });
    section.appendChild(h('h4', { text:'Historia wycen', style:'margin:0 0 10px' }));
    if(!history.length){
      section.appendChild(h('div', { class:'muted', text:'Brak zapisanych wersji oferty dla tego projektu.' }));
      card.appendChild(section);
      return;
    }
    const wrap = h('div', { class:'quote-history', id:'quoteHistorySection' });
    history.slice(0, 8).forEach((snapshot, index)=>{
      const snap = normalizeSnapshot(snapshot) || {};
      const snapId = getSnapshotId(snap);
      const isActive = !!activeId && snapId === activeId;
      const isSelected = isSelectedSnapshot(snap);
      const isRejected = isRejectedSnapshot(snap);
      const isPreliminary = isPreliminarySnapshot(snap);
      const isArchived = isArchivedPreliminary(snap, history, projectStatus);
      const item = h('article', { id:getQuoteHistoryItemDomId(snapId), 'data-quote-history-id':snapId, class:`quote-history__item${isActive ? ' is-active' : ''}${isArchived ? ' is-archived' : ''}` });
      const top = h('div', { class:'quote-history__top' });
      const titleBox = h('div', { class:'quote-history__content' });
      const roomLabels = Array.isArray(snap.scope && snap.scope.roomLabels) ? snap.scope.roomLabels : [];
      const titleRow = h('div', { class:'quote-history__title-row' });
      const versionName = getVersionName(snap);
      titleRow.appendChild(h('div', { class:'quote-history__title', text:versionName || (index === 0 ? 'Ostatnia wersja oferty' : 'Wersja oferty') }));
      if(isPreliminary) titleRow.appendChild(h('span', { class:'quote-history__badge quote-history__badge--preliminary', text:'Wstępna' }));
      if(isSelected) titleRow.appendChild(h('span', { class:'quote-history__badge quote-history__badge--selected', text:'Zaakceptowana' }));
      if(isRejected) titleRow.appendChild(h('span', { class:'quote-history__badge quote-history__badge--archived', text:'Odrzucona' }));
      if(isArchived) titleRow.appendChild(h('span', { class:'quote-history__badge quote-history__badge--archived', text:'Archiwalna po pomiarze' }));
      titleBox.appendChild(titleRow);
      const meta = [];
      meta.push(`Wersja oferty: ${formatDateTime(snap.generatedAt)}`);
      if(roomLabels.length) meta.push(`Pomieszczenia: ${roomLabels.join(', ')}`);
      meta.push(`Zakres: ${getMaterialScopeLabel(snap)}`);
      meta.push(`Razem: ${money(snap.totals && snap.totals.grand)}`);
      if(isSelected && Number(snap.meta && snap.meta.acceptedAt) > 0) meta.push(`Zaakceptowana: ${formatDateTime(snap.meta.acceptedAt)}`);
      if(isRejected) meta.push(getRejectedReason(snap) === 'scope_changed'
        ? 'Ta oferta została odrzucona po zmianie zakresu zaakceptowanej wyceny.'
        : 'Ta oferta została odrzucona i nie jest już aktywną podstawą statusów.');
      if(isArchived) meta.push('Ta wycena wstępna została wygaszona po stworzeniu wyceny po pomiarze.');
      titleBox.appendChild(h('div', { class:'quote-history__meta', text:meta.join(' • ') }));
      top.appendChild(titleBox);
      item.appendChild(top);
      const actions = h('div', { class:'quote-history__actions' });
      const openBtn = h('button', { class:isActive ? 'btn-success' : 'btn', type:'button', text:isActive ? 'Wyświetlana' : 'Podgląd' });
      if(isActive || isArchived) openBtn.disabled = true;
      openBtn.addEventListener('click', ()=>{
        clearRememberedQuoteScroll();
        previewSnapshotId = snapId;
        lastQuote = snap;
        shouldScrollToPreview = true;
        render(ctx);
      });
      actions.appendChild(openBtn);
      const acceptLabel = isSelected ? 'Zaakceptowana' : (isRejected ? 'Odrzucona' : 'Zaakceptuj');
      const chooseBtn = h('button', { class:'btn-success', type:'button', text:acceptLabel });
      if(!canAcceptSnapshot(snap, history)) chooseBtn.disabled = true;
      chooseBtn.addEventListener('click', ()=> {
        void acceptSnapshot(snap, ctx, { rememberScroll:true, anchorId:getQuoteHistoryItemDomId(snapId), history });
      });
      actions.appendChild(chooseBtn);
      const pdfBtn = h('button', { class:'btn-primary', type:'button', text:'PDF' });
      if(isArchived) pdfBtn.disabled = true;
      pdfBtn.addEventListener('click', ()=>{
        try{ FC.quotePdf && typeof FC.quotePdf.openQuotePdf === 'function' && FC.quotePdf.openQuotePdf(snap); }catch(_){ }
      });
      actions.appendChild(pdfBtn);
      const deleteBtn = h('button', { class:'btn-danger', type:'button', text:'Usuń' });
      deleteBtn.addEventListener('click', async ()=>{
        rememberQuoteScroll(getQuoteHistoryItemDomId(snapId), getQuoteHistoryNeighborDomId(snapId));
        const confirmed = await askConfirm({
          title:'USUNĄĆ OFERTĘ?',
          message:'Ta wersja oferty zostanie trwale usunięta z historii.',
          confirmText:'Usuń ofertę',
          cancelText:'Wróć',
          confirmTone:'danger',
          cancelTone:'neutral'
        });
        if(!confirmed){
          clearRememberedQuoteScroll();
          return;
        }
        const currentStatus = currentProjectStatus(snap);
        const projectId = String(snap && snap.project && snap.project.id || getCurrentProjectId() || '');
        try{
          if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.remove === 'function') FC.quoteSnapshotStore.remove(snapId);
        }catch(_){ }
        try{
          if(FC.projectStatusSync && typeof FC.projectStatusSync.reconcileProjectStatuses === 'function'){
            FC.projectStatusSync.reconcileProjectStatuses({ projectId, fallbackStatus:'nowy', refreshUi:false });
          }else if(projectId && FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getRecommendedStatusForProject === 'function'){
            const recommendedStatus = FC.quoteSnapshotStore.getRecommendedStatusForProject(projectId, currentStatus, { roomIds:getTargetRoomIdsFromSnapshot(snap), fallbackStatus:'nowy' });
            if(recommendedStatus && recommendedStatus !== currentStatus){
              setProjectStatusFromSnapshot(snap, recommendedStatus, { syncSelection:true });
            }
          }
        }catch(_){ }
        const nextHistory = getSnapshotHistory();
        if(previewSnapshotId === snapId) previewSnapshotId = '';
        if(isActive || getSnapshotId(lastQuote) === snapId) lastQuote = nextHistory.find((row)=> !isArchivedPreliminary(row, nextHistory, getProjectStatusForHistory(nextHistory))) || nextHistory[0] || null;
        render(ctx);
      });
      actions.appendChild(deleteBtn);
      if(isPreliminary && isSelected && !isArchived){
        const convertBtn = h('button', { class:'btn quote-history__convert-btn', type:'button', text:'Końcowa' });
        convertBtn.addEventListener('click', ()=>{
          rememberQuoteScroll(getQuoteHistoryItemDomId(snapId));
          let converted = null;
          try{
            converted = FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.convertPreliminaryToFinal === 'function'
              ? FC.quoteSnapshotStore.convertPreliminaryToFinal(String(snap.project && snap.project.id || getCurrentProjectId() || ''), snapId)
              : null;
          }catch(_){ converted = null; }
          if(converted){
            previewSnapshotId = snapId;
            lastQuote = converted;
            setProjectStatusFromSnapshot(converted, 'zaakceptowany');
            render(ctx);
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
        if(FC.wycenaCore && typeof FC.wycenaCore.buildQuoteSnapshot === 'function') lastQuote = await FC.wycenaCore.buildQuoteSnapshot({ selection });
        else if(FC.wycenaCore && typeof FC.wycenaCore.collectQuoteData === 'function') lastQuote = await FC.wycenaCore.collectQuoteData({ selection });
        if(lastQuote && !lastQuote.error) syncGeneratedQuoteStatus(lastQuote);
      }catch(err){
        try{ console.error('[wycena] collect failed', err); }catch(_){ }
        lastQuote = { error: String(err && err.message || err || 'Błąd wyceny'), totals:{ materials:0, accessories:0, services:0, quoteRates:0, subtotal:0, discount:0, grand:0 }, roomLabels:[] };
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
      const roomLabels = Array.isArray(currentQuote.roomLabels) ? currentQuote.roomLabels : (currentQuote.scope && Array.isArray(currentQuote.scope.roomLabels) ? currentQuote.scope.roomLabels : []);
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
    const snap = snapshotById(snapshotId, getSnapshotHistory());
    if(!snap) return false;
    previewSnapshotId = String(snapshotId || '');
    lastQuote = snap;
    shouldScrollToPreview = true;
    return true;
  }

  FC.wycenaTabDebug = Object.assign({}, FC.wycenaTabDebug || {}, {
    currentProjectStatus,
    setProjectStatusFromSnapshot,
    getTargetRoomIdsFromSnapshot,
    isArchivedPreliminary,
    isRejectedSnapshot,
    canAcceptSnapshot,
    showSnapshotPreview,
  });

  (FC.tabsRouter || FC.tabs || {}).register?.('wycena', { mount(){}, render, unmount(){} });
})();
