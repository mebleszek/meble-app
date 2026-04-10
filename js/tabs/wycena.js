// js/tabs/wycena.js
// Zakładka WYCENA — handlowy snapshot oferty, PDF klienta i historia wersji.

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
    const firstActive = history.find((row)=> !isArchivedPreliminary(row, history)) || history[0] || null;
    if(lastQuote){
      const normalized = normalizeSnapshot(lastQuote);
      if(normalized && !isArchivedPreliminary(normalized, history)) return normalized;
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
    po_pomiarze:3,
    wycena:4,
    zaakceptowany:5,
    umowa:6,
    produkcja:7,
    montaz:8,
    zakonczone:9,
    odrzucone:-1,
  };

  function normalizeStatusKey(value){
    return String(value || '').trim().toLowerCase();
  }

  function statusRank(value){
    const key = normalizeStatusKey(value);
    return Object.prototype.hasOwnProperty.call(STATUS_RANK, key) ? STATUS_RANK[key] : -99;
  }

  function isSelectedSnapshot(snapshot){
    try{ return !!(snapshot && snapshot.meta && snapshot.meta.selectedByClient); }catch(_){ return false; }
  }

  function isPreliminarySnapshot(snapshot){
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.isPreliminarySnapshot === 'function') return !!FC.quoteSnapshotStore.isPreliminarySnapshot(snapshot);
    }catch(_){ }
    return !!(snapshot && ((snapshot.meta && snapshot.meta.preliminary) || (snapshot.commercial && snapshot.commercial.preliminary)));
  }

  function isArchivedPreliminary(snapshot, history){
    const list = Array.isArray(history) ? history : getSnapshotHistory();
    return !!(isPreliminarySnapshot(snapshot) && list.some((row)=> !isPreliminarySnapshot(row)));
  }

  function currentProjectStatus(snapshot){
    const snap = normalizeSnapshot(snapshot) || {};
    const projectId = String(snap && snap.project && snap.project.id || getCurrentProjectId() || '');
    const investorId = String(snap && snap.project && snap.project.investorId || snap && snap.investor && snap.investor.id || getCurrentInvestorId() || '');
    try{
      if(projectId && FC.projectStore && typeof FC.projectStore.getById === 'function'){
        const record = FC.projectStore.getById(projectId);
        if(record && record.status) return normalizeStatusKey(record.status);
      }
    }catch(_){ }
    try{
      if(investorId && FC.investorPersistence && typeof FC.investorPersistence.getInvestorById === 'function'){
        const investor = FC.investorPersistence.getInvestorById(investorId);
        const room = investor && Array.isArray(investor.rooms) && investor.rooms[0];
        if(room && (room.projectStatus || room.status)) return normalizeStatusKey(room.projectStatus || room.status);
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

  function setProjectStatusFromSnapshot(snapshot, status, options){
    const snap = normalizeSnapshot(snapshot) || {};
    const nextStatus = normalizeStatusKey(status);
    if(!nextStatus) return;
    const syncSelection = !!(options && options.syncSelection);
    const projectId = String(snap && snap.project && snap.project.id || getCurrentProjectId() || '');
    const investorId = String(
      snap && snap.investor && snap.investor.id
      || snap && snap.project && snap.project.investorId
      || getCurrentInvestorId()
      || ''
    );
    try{
      if(projectId && FC.projectStore && typeof FC.projectStore.getById === 'function' && typeof FC.projectStore.upsert === 'function'){
        const record = FC.projectStore.getById(projectId) || (typeof FC.projectStore.getCurrentRecord === 'function' ? FC.projectStore.getCurrentRecord() : null);
        if(record){
          FC.projectStore.upsert(Object.assign({}, record, { status:nextStatus, updatedAt:Date.now() }));
        }
      }
    }catch(_){ }

    let investor = null;
    try{
      if(investorId && FC.investorPersistence && typeof FC.investorPersistence.getInvestorById === 'function'){
        investor = FC.investorPersistence.getInvestorById(investorId);
      }
      if(!investor && FC.investorPersistence && typeof FC.investorPersistence.getSelectedInvestor === 'function'){
        investor = FC.investorPersistence.getSelectedInvestor(investorId || null);
      }
    }catch(_){ investor = null; }

    try{
      if(investor && FC.investorPersistence && typeof FC.investorPersistence.saveInvestorPatch === 'function'){
        const roomMap = new Map();
        const currentRooms = Array.isArray(investor.rooms) ? investor.rooms : [];
        currentRooms.forEach((room)=>{
          const key = String(room && room.id || '');
          if(!key) return;
          roomMap.set(key, Object.assign({}, room, { projectStatus:nextStatus }));
        });
        try{
          if(FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomDefs === 'function'){
            const defs = FC.roomRegistry.getActiveRoomDefs() || [];
            defs.forEach((room)=>{
              const key = String(room && room.id || '');
              if(!key) return;
              roomMap.set(key, Object.assign({}, roomMap.get(key) || {}, room || {}, { id:key, projectStatus:nextStatus }));
            });
          }
        }catch(_){ }
        const rooms = Array.from(roomMap.values());
        if(rooms.length) FC.investorPersistence.saveInvestorPatch(investor.id, { rooms });
      }
    }catch(_){ }

    try{
      if(FC.project && typeof FC.project.load === 'function' && typeof FC.project.save === 'function'){
        const proj = FC.project.load() || {};
        const meta = proj && proj.meta && typeof proj.meta === 'object' ? proj.meta : null;
        if(meta){
          meta.projectStatus = nextStatus;
          if(meta.roomDefs && typeof meta.roomDefs === 'object'){
            Object.keys(meta.roomDefs).forEach((roomId)=>{
              const row = meta.roomDefs[roomId];
              if(!row || typeof row !== 'object') return;
              meta.roomDefs[roomId] = Object.assign({}, row, { projectStatus:nextStatus });
            });
          }
          FC.project.save(proj);
        }
      }
    }catch(_){ }

    try{
      if(syncSelection && projectId && FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.syncSelectionForProjectStatus === 'function'){
        FC.quoteSnapshotStore.syncSelectionForProjectStatus(projectId, nextStatus);
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
    const parts = [];
    if(commercial.preliminary) parts.push('Wstępna wycena');
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
    card.appendChild(h('p', { class:'muted', text:'Wycena pobiera materiały z działu Materiał, liczbę arkuszy z aktualnego ROZRYS dla wybranych pomieszczeń oraz pozycje AGD z dodanych szafek. Dodaj także stawki wyceny i pola handlowe, aby wygenerować ofertę dla klienta.' }));
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

  function renderCommercialSection(card, snapshot){
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
    addRow('Typ oferty', commercial.preliminary ? 'Wstępna wycena (bez pomiaru)' : 'Wycena po pomiarze');
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

  function renderOfferEditor(card, ctx){
    const draft = getOfferDraft();
    const commercial = draft && draft.commercial || {};
    const catalog = FC.catalogSelectors && typeof FC.catalogSelectors.getQuoteRates === 'function' ? FC.catalogSelectors.getQuoteRates() : [];
    const selectionMap = buildSelectionMap(draft);
    const section = h('section', { class:`card quote-offer-accordion${offerEditorOpen ? ' is-open' : ''}`, style:'margin-top:12px;' });
    const trigger = h('button', { class:'quote-offer-accordion__trigger', type:'button' });
    const head = h('div', { class:'quote-offer-accordion__head' });
    const titleBox = h('div', { class:'quote-offer-accordion__titlebox' });
    titleBox.appendChild(h('div', { class:'quote-offer-accordion__title', text:'Ustawienia oferty do nowej wyceny' }));
    titleBox.appendChild(h('div', { class:'quote-offer-accordion__summary', text:buildOfferSummary(draft) }));
    head.appendChild(titleBox);
    const headMeta = h('div', { class:'quote-offer-accordion__meta' });
    headMeta.appendChild(h('span', { class:'quote-preview-badge', text:'Wpływa na kolejny snapshot' }));
    headMeta.appendChild(h('span', { class:'quote-offer-accordion__chevron', text: offerEditorOpen ? '▴' : '▾', 'aria-hidden':'true' }));
    head.appendChild(headMeta);
    trigger.appendChild(head);
    trigger.addEventListener('click', ()=>{
      offerEditorOpen = !offerEditorOpen;
      render(ctx);
    });
    section.appendChild(trigger);

    if(offerEditorOpen){
      const body = h('div', { class:'quote-offer-accordion__body' });
      body.appendChild(h('p', { class:'muted', text:'Tutaj ustawiasz robociznę, rabat i warunki handlowe. Zostaną zapisane w nowym snapshotcie po kliknięciu „Wyceń”.', style:'margin:0 0 8px' }));

      const preliminaryWrap = h('div', { class:'quote-offer-preliminary' });
      const preliminaryChip = h('label', { class:`rozrys-scope-chip rozrys-scope-chip--room-match quote-preliminary-chip${commercial.preliminary ? ' is-checked' : ''}` });
      const preliminaryInput = h('input', { type:'checkbox' });
      preliminaryInput.checked = !!commercial.preliminary;
      const preliminaryText = h('span', { text:'Wstępna wycena (bez pomiaru)' });
      preliminaryInput.addEventListener('change', ()=>{
        if(preliminaryInput.checked) preliminaryChip.classList.add('is-checked');
        else preliminaryChip.classList.remove('is-checked');
        syncCommercial();
      });
      preliminaryChip.appendChild(preliminaryInput);
      preliminaryChip.appendChild(preliminaryText);
      preliminaryWrap.appendChild(preliminaryChip);
      preliminaryWrap.appendChild(h('div', { class:'muted quote-preliminary-help', text:'Oznacz tę opcję dla rozmowy z klientem przed pomiarem. Akceptacja takiej oferty ustawi status projektu na „Pomiar”.' }));
      body.appendChild(preliminaryWrap);

      const rateShell = h('div', { class:'quote-rate-editor' });
      if(!catalog.length){
        rateShell.appendChild(h('div', { class:'muted', text:'Brak zdefiniowanych stawek wyceny mebli. Dodaj je w katalogu „Stawki wyceny mebli”.' }));
      } else {
        catalog.forEach((rate)=>{
          const item = h('article', { class:'quote-rate-editor__item' });
          const info = h('div', { class:'quote-rate-editor__info' });
          info.appendChild(h('div', { class:'quote-rate-editor__title', text:String(rate && rate.name || 'Stawka') }));
          info.appendChild(h('div', { class:'quote-rate-editor__meta', text:[String(rate && rate.category || '').trim(), money(rate && rate.price)].filter(Boolean).join(' • ') }));
          item.appendChild(info);
          const qtyWrap = h('div', { class:'quote-rate-editor__qty' });
          qtyWrap.appendChild(h('label', { text:'Ilość' }));
          const qtyInput = h('input', { class:'investor-form-input', type:'number', min:'0', step:'1', value:String(Math.max(0, num(selectionMap[String(rate && rate.id || '')], 0))) });
          qtyInput.addEventListener('input', ()=>{
            const nextMap = buildSelectionMap(getOfferDraft());
            const qty = Math.max(0, num(qtyInput.value, 0));
            nextMap[String(rate && rate.id || '')] = qty;
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

      const syncCommercial = ()=>{
        const next = {
          preliminary: !!preliminaryInput.checked,
          discountPercent: Math.max(0, num(discountPercentInput.value, 0)),
          discountAmount: Math.max(0, num(discountAmountInput.value, 0)),
          offerValidity: validityInput.value,
          leadTime: leadTimeInput.value,
          deliveryTerms: deliveryInput.value,
          customerNote: noteInput.value,
        };
        patchOfferDraft({ commercial: next });
      };
      discountPercentInput.addEventListener('input', ()=>{
        if(num(discountPercentInput.value, 0) > 0 && num(discountAmountInput.value, 0) > 0) discountAmountInput.value = '';
        syncCommercial();
      });
      discountAmountInput.addEventListener('input', ()=>{
        if(num(discountAmountInput.value, 0) > 0 && num(discountPercentInput.value, 0) > 0) discountPercentInput.value = '';
        syncCommercial();
      });
      [validityInput, leadTimeInput, deliveryInput, noteInput].forEach((field)=>{
        field.addEventListener('input', syncCommercial);
        field.addEventListener('change', syncCommercial);
      });

      grid.appendChild(buildField('Rabat %', discountPercentInput));
      grid.appendChild(buildField('Rabat kwotowy (PLN)', discountAmountInput));
      grid.appendChild(buildField('Ważność oferty', validityInput));
      grid.appendChild(buildField('Termin realizacji', leadTimeInput));
      grid.appendChild(buildField('Warunki montażu / transportu', deliveryInput, true));
      grid.appendChild(buildField('Notatka dla klienta', noteInput, true));
      body.appendChild(h('div', { class:'quote-subsection-title', text:'Pola handlowe', style:'margin-top:14px' }));
      body.appendChild(grid);
      section.appendChild(body);
    }

    card.appendChild(section);
  }

  function renderHistory(card, ctx, currentQuote){
    const history = getSnapshotHistory();
    const activeId = getSnapshotId(currentQuote);
    const section = h('section', { class:'card quote-section', style:'margin-top:12px;padding:14px;' });
    section.appendChild(h('h4', { text:'Historia wycen', style:'margin:0 0 10px' }));
    if(!history.length){
      section.appendChild(h('div', { class:'muted', text:'Brak zapisanych snapshotów wyceny dla tego projektu.' }));
      card.appendChild(section);
      return;
    }
    const wrap = h('div', { class:'quote-history' });
    history.slice(0, 8).forEach((snapshot, index)=>{
      const snap = normalizeSnapshot(snapshot) || {};
      const snapId = getSnapshotId(snap);
      const isActive = !!activeId && snapId === activeId;
      const isSelected = isSelectedSnapshot(snap);
      const isPreliminary = isPreliminarySnapshot(snap);
      const isArchived = isArchivedPreliminary(snap, history);
      const item = h('article', { class:`quote-history__item${isActive ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}${isArchived ? ' is-archived' : ''}` });
      const top = h('div', { class:'quote-history__top' });
      const titleBox = h('div', { class:'quote-history__content' });
      const roomLabels = Array.isArray(snap.scope && snap.scope.roomLabels) ? snap.scope.roomLabels : [];
      const titleRow = h('div', { class:'quote-history__title-row' });
      titleRow.appendChild(h('div', { class:'quote-history__title', text:index === 0 ? `Ostatni snapshot — ${formatDateTime(snap.generatedAt)}` : formatDateTime(snap.generatedAt) }));
      if(isActive) titleRow.appendChild(h('span', { class:'quote-history__badge', text:'Oglądany' }));
      if(isPreliminary) titleRow.appendChild(h('span', { class:'quote-history__badge quote-history__badge--preliminary', text:'Wstępna' }));
      if(isSelected) titleRow.appendChild(h('span', { class:'quote-history__badge quote-history__badge--selected', text:'Zaakceptowana' }));
      if(isArchived) titleRow.appendChild(h('span', { class:'quote-history__badge quote-history__badge--archived', text:'Archiwalna po pomiarze' }));
      titleBox.appendChild(titleRow);
      const meta = [];
      if(roomLabels.length) meta.push(`Zakres: ${roomLabels.join(', ')}`);
      meta.push(`Razem: ${money(snap.totals && snap.totals.grand)}`);
      if(isSelected && Number(snap.meta && snap.meta.acceptedAt) > 0) meta.push(`Zaakceptowana: ${formatDateTime(snap.meta.acceptedAt)}`);
      if(isArchived) meta.push('Ta wycena wstępna została wygaszona po stworzeniu wyceny po pomiarze.');
      titleBox.appendChild(h('div', { class:'quote-history__meta', text:meta.join(' • ') }));
      top.appendChild(titleBox);
      item.appendChild(top);
      const actions = h('div', { class:'quote-history__actions' });
      const openBtn = h('button', { class:isActive ? 'btn-primary' : 'btn', type:'button', text:isActive ? 'Wyświetlany' : 'Podgląd' });
      if(isActive || isArchived) openBtn.disabled = true;
      openBtn.addEventListener('click', ()=>{
        lastQuote = snap;
        shouldScrollToPreview = true;
        render(ctx);
      });
      actions.appendChild(openBtn);
      const acceptLabel = isSelected ? 'Zaakceptowana' : (isPreliminary ? 'Zaakceptuj wstępną' : 'Zaakceptuj');
      const chooseBtn = h('button', { class:'btn-success', type:'button', text:acceptLabel });
      if(isSelected || isArchived) chooseBtn.disabled = true;
      chooseBtn.addEventListener('click', async ()=>{
        const targetStatus = isPreliminary ? 'pomiar' : 'zaakceptowany';
        const confirmed = await askConfirm({
          title:'OZNACZYĆ OFERTĘ?',
          message:isPreliminary
            ? 'Ta wersja zostanie oznaczona jako zaakceptowana wycena wstępna, a status projektu zmieni się na „Pomiar”.'
            : 'Ta wersja zostanie oznaczona jako zaakceptowana, a status projektu zmieni się na „Zaakceptowany”.',
          confirmText:isPreliminary ? 'Oznacz jako wstępną zaakceptowaną' : 'Oznacz jako zaakceptowaną',
          cancelText:'Wróć',
          confirmTone:'success',
          cancelTone:'neutral'
        });
        if(!confirmed) return;
        let selected = null;
        try{
          selected = FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.markSelectedForProject === 'function'
            ? FC.quoteSnapshotStore.markSelectedForProject(String(snap.project && snap.project.id || getCurrentProjectId() || ''), snapId, { status:targetStatus })
            : snap;
        }catch(_){ selected = snap; }
        if(selected){
          setProjectStatusFromSnapshot(selected, targetStatus);
          lastQuote = selected;
          shouldScrollToPreview = true;
          render(ctx);
        }
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
        const confirmed = await askConfirm({
          title:'USUNĄĆ OFERTĘ?',
          message:'Ta wersja oferty zostanie trwale usunięta z historii.',
          confirmText:'Usuń ofertę',
          cancelText:'Wróć',
          confirmTone:'danger',
          cancelTone:'neutral'
        });
        if(!confirmed) return;
        try{
          if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.remove === 'function') FC.quoteSnapshotStore.remove(snapId);
        }catch(_){ }
        const nextHistory = getSnapshotHistory();
        if(isActive || getSnapshotId(lastQuote) === snapId) lastQuote = nextHistory.find((row)=> !isArchivedPreliminary(row, nextHistory)) || nextHistory[0] || null;
        render(ctx);
      });
      actions.appendChild(deleteBtn);
      item.appendChild(actions);
      wrap.appendChild(item);
    });
    section.appendChild(wrap);
    card.appendChild(section);
  }

  let lastQuote = null;
  let isBusy = false;
  let shouldScrollToPreview = false;
  let offerEditorOpen = false;

  function render(ctx){
    const list = ctx && ctx.listEl;
    if(!list) return;
    list.innerHTML = '';
    const card = h('div', { class:'build-card quote-root', id:'quoteActivePreview' });
    const head = h('div', { class:'quote-topbar' });
    head.appendChild(h('h3', { text:'Wycena', style:'margin:0' }));
    const actions = h('div', { class:'quote-topbar__actions' });
    const runBtn = h('button', { class:'btn-primary', type:'button', text: isBusy ? 'Liczę…' : 'Wyceń' });
    if(isBusy) runBtn.disabled = true;
    runBtn.addEventListener('click', async ()=>{
      if(isBusy) return;
      isBusy = true;
      render(ctx);
      try{
        if(FC.wycenaCore && typeof FC.wycenaCore.buildQuoteSnapshot === 'function') lastQuote = await FC.wycenaCore.buildQuoteSnapshot();
        else if(FC.wycenaCore && typeof FC.wycenaCore.collectQuoteData === 'function') lastQuote = await FC.wycenaCore.collectQuoteData();
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

    const currentQuote = resolveDisplayedQuote();
    const pdfBtn = h('button', { class:'btn-primary', type:'button', text:'PDF' });
    if(!currentQuote || currentQuote.error) pdfBtn.disabled = true;
    pdfBtn.addEventListener('click', ()=>{
      try{ FC.quotePdf && typeof FC.quotePdf.openQuotePdf === 'function' && FC.quotePdf.openQuotePdf(currentQuote); }catch(_){ }
    });
    actions.appendChild(pdfBtn);
    head.appendChild(actions);
    card.appendChild(head);

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
        const isLatest = getSnapshotId(currentQuote) === getSnapshotId(getSnapshotHistory()[0]);
        const previewMeta = h('div', { class:'quote-preview-meta' });
        previewMeta.appendChild(h('span', { class:`quote-preview-badge${isLatest ? ' is-latest' : ''}`, text:isLatest ? 'Aktualny snapshot' : 'Oglądany snapshot z historii' }));
        if(isPreliminarySnapshot(currentQuote)) previewMeta.appendChild(h('span', { class:'quote-preview-badge quote-preview-badge--preliminary', text:'Wstępna wycena' }));
        if(isSelectedSnapshot(currentQuote)) previewMeta.appendChild(h('span', { class:'quote-preview-badge quote-preview-badge--selected', text:'Zaakceptowana' }));
        previewMeta.appendChild(h('p', { class:'muted quote-scope', text:`Snapshot: ${formatDateTime(generatedAt)}` }));
        card.appendChild(previewMeta);
      }
      if(Array.isArray(roomLabels) && roomLabels.length){
        card.appendChild(h('p', { class:'muted quote-scope', text:`Zakres: ${roomLabels.join(', ')}`, style:'margin-top:6px' }));
      }
      renderSection(card, 'Materiały z ROZRYS', materialLines, 'Brak pozycji materiałowych.');
      renderSection(card, 'Akcesoria', accessoryLines, 'Brak pozycji akcesoriów.');
      renderSection(card, 'Robocizna / stawki wyceny mebli', quoteRateLines, 'Brak pozycji robocizny.');
      renderSection(card, 'Sprzęty do zabudowy / montaż AGD', agdLines, 'Brak wykrytych sprzętów do zabudowy.');
      renderCommercialSection(card, currentQuote);
    }
    renderHistory(card, ctx, currentQuote);
    list.appendChild(card);
    if(shouldScrollToPreview){
      shouldScrollToPreview = false;
      try{
        requestAnimationFrame(()=>{
          try{
            const target = document.getElementById('quoteActivePreview');
            target && target.scrollIntoView && target.scrollIntoView({ behavior:'smooth', block:'start' });
          }catch(_){ }
        });
      }catch(_){ }
    }
  }

  (FC.tabsRouter || FC.tabs || {}).register?.('wycena', { mount(){}, render, unmount(){} });
})();
