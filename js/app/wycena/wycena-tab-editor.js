(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function getFn(deps, key, fallback){
    return deps && typeof deps[key] === 'function' ? deps[key] : fallback;
  }

  function buildOfferSummary(draft, deps){
    const money = getFn(deps, 'money', (value)=> `${(Number(value)||0).toFixed(2)} PLN`);
    const num = getFn(deps, 'num', (value, fallback)=> {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    });
    const normalizeDraftSelection = getFn(deps, 'normalizeDraftSelection', ()=> ({ selectedRooms:[], materialScope:{ kind:'all', material:'', includeFronts:true, includeCorpus:true } }));
    const buildSelectionSummary = getFn(deps, 'buildSelectionSummary', ()=> ({ scopeText:'Korpusy + fronty' }));
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

  function buildSelectionMap(draft, deps){
    const num = getFn(deps, 'num', (value, fallback)=> {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    });
    const out = Object.create(null);
    const rows = Array.isArray(draft && draft.rateSelections) ? draft.rateSelections : [];
    rows.forEach((row)=>{
      const key = String(row && row.rateId || '');
      if(!key) return;
      out[key] = Math.max(0, num(row && row.qty, 0));
    });
    return out;
  }

  function saveRateSelectionRows(selections, deps){
    const patchOfferDraft = getFn(deps, 'patchOfferDraft', ()=> null);
    const num = getFn(deps, 'num', (value, fallback)=> {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    });
    return patchOfferDraft({
      rateSelections: (Array.isArray(selections) ? selections : [])
        .map((row)=> ({ rateId:String(row && row.rateId || ''), qty:Math.max(0, num(row && row.qty, 0)) }))
        .filter((row)=> row.rateId)
    });
  }

  function buildField(labelText, inputNode, full, deps){
    const h = getFn(deps, 'h');
    if(typeof h !== 'function') return null;
    const wrap = h('div', { class:'investor-choice-field quote-offer-field' });
    if(full) wrap.style.gridColumn = '1 / -1';
    wrap.appendChild(h('label', { text:labelText }));
    wrap.appendChild(inputNode);
    return wrap;
  }

  function makeRateSelectionRows(catalog, selectionMap, deps){
    const num = getFn(deps, 'num', (value, fallback)=> {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    });
    return (Array.isArray(catalog) ? catalog : []).map((rate)=> ({
      rateId: String(rate && rate.id || ''),
      qty: Math.max(0, num(selectionMap[String(rate && rate.id || '')], 0)),
    })).filter((row)=> row.rateId);
  }

  function renderPreliminaryToggle(card, ctx, deps){
    const h = getFn(deps, 'h');
    const getOfferDraft = getFn(deps, 'getOfferDraft', ()=> ({}));
    const patchOfferDraft = getFn(deps, 'patchOfferDraft', ()=> null);
    const normalizeDraftSelection = getFn(deps, 'normalizeDraftSelection', ()=> ({ selectedRooms:[], materialScope:{ kind:'all', material:'', includeFronts:true, includeCorpus:true } }));
    const defaultVersionName = getFn(deps, 'defaultVersionName', (preliminary)=> preliminary ? 'Wstępna oferta' : 'Oferta');
    const render = getFn(deps, 'render', ()=> {});
    if(typeof h !== 'function') return;
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

  function renderOfferEditor(card, ctx, deps){
    const h = getFn(deps, 'h');
    const getOfferDraft = getFn(deps, 'getOfferDraft', ()=> ({}));
    const patchOfferDraft = getFn(deps, 'patchOfferDraft', ()=> null);
    const normalizeDraftSelection = getFn(deps, 'normalizeDraftSelection', ()=> ({ selectedRooms:[], materialScope:{ kind:'all', material:'', includeFronts:true, includeCorpus:true } }));
    const defaultVersionName = getFn(deps, 'defaultVersionName', (preliminary)=> preliminary ? 'Wstępna oferta' : 'Oferta');
    const buildOfferSummaryFn = getFn(deps, 'buildOfferSummary', (draftArg)=> buildOfferSummary(draftArg, deps));
    const buildSelectionMapFn = getFn(deps, 'buildSelectionMap', (draftArg)=> buildSelectionMap(draftArg, deps));
    const saveRateSelectionRowsFn = getFn(deps, 'saveRateSelectionRows', (rows)=> saveRateSelectionRows(rows, deps));
    const buildFieldFn = getFn(deps, 'buildField', (label, inputNode, full)=> buildField(label, inputNode, full, deps));
    const makeRateSelectionRowsFn = getFn(deps, 'makeRateSelectionRows', (catalog, selectionMap)=> makeRateSelectionRows(catalog, selectionMap, deps));
    const money = getFn(deps, 'money', (value)=> `${(Number(value)||0).toFixed(2)} PLN`);
    const num = getFn(deps, 'num', (value, fallback)=> {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    });
    const render = getFn(deps, 'render', ()=> {});
    const getIsOpen = getFn(deps, 'getIsOpen', ()=> false);
    const setIsOpen = getFn(deps, 'setIsOpen', ()=> {});
    if(typeof h !== 'function') return;

    const draft = getOfferDraft();
    const commercial = draft && draft.commercial || {};
    const rawCatalog = FC.catalogSelectors && typeof FC.catalogSelectors.getQuoteRates === 'function' ? FC.catalogSelectors.getQuoteRates() : [];
    const catalog = (Array.isArray(rawCatalog) ? rawCatalog : []).filter((rate)=>{
      const autoRole = String(rate && rate.autoRole || 'none');
      const usage = String(rate && rate.usage || 'manual');
      return autoRole === 'none' && usage === 'manual' && rate && rate.internalOnly !== true;
    });
    const selectionMap = buildSelectionMapFn(draft);
    const isOpen = !!getIsOpen();

    const section = h('section', { class:`quote-offer-accordion rozrys-material-accordion${isOpen ? ' is-open' : ''}`, style:'margin-top:12px;' });
    const head = h('div', { class:'quote-offer-accordion__head' });
    const trigger = h('button', { class:'rozrys-material-accordion__trigger quote-offer-accordion__trigger', type:'button' });
    const titleBox = h('div', { class:'rozrys-material-accordion__title quote-offer-accordion__titlebox' });
    titleBox.appendChild(h('div', { class:'rozrys-material-accordion__title-line1', text:'Ustawienia oferty do nowej wyceny' }));
    titleBox.appendChild(h('div', { class:'rozrys-material-accordion__title-line2 quote-offer-accordion__summary-line', text:buildOfferSummaryFn(draft) }));
    const chevron = h('span', { class:`rozrys-material-accordion__chevron${isOpen ? ' is-open' : ''}`, html:'&#9662;', 'aria-hidden':'true' });
    trigger.appendChild(titleBox);
    trigger.appendChild(chevron);
    trigger.addEventListener('click', ()=>{
      setIsOpen(!isOpen);
      render(ctx);
    });
    head.appendChild(trigger);
    const headRow = h('div', { class:'quote-offer-accordion__head-row rozrys-material-accordion__grain-row' });
    headRow.appendChild(h('span', { class:'rozrys-pill is-raw quote-selection-info-pill', text:'Wpływa na kolejną wersję oferty' }));
    head.appendChild(headRow);
    section.appendChild(head);

    if(isOpen){
      const body = h('div', { class:'quote-offer-accordion__body rozrys-material-accordion__body' });
      const selection = normalizeDraftSelection(draft);
      const versionInput = h('input', { class:'investor-form-input', type:'text', value:String(commercial.versionName || defaultVersionName(!!commercial.preliminary, { selection }) || '') });
      const syncVersionName = ()=> patchOfferDraft({ commercial:{ versionName:String(versionInput.value || '').trim() || defaultVersionName(!!commercial.preliminary, { selection:normalizeDraftSelection(getOfferDraft()) }) } });
      versionInput.addEventListener('focus', ()=>{ try{ versionInput.setSelectionRange(0, String(versionInput.value || '').length); }catch(_){ try{ versionInput.select(); }catch(__){} } });
      versionInput.addEventListener('pointerup', (ev)=>{ try{ ev.preventDefault(); }catch(_){ } try{ versionInput.setSelectionRange(0, String(versionInput.value || '').length); }catch(_){ try{ versionInput.select(); }catch(__){} } });
      versionInput.addEventListener('change', syncVersionName);
      versionInput.addEventListener('blur', syncVersionName);
      const versionField = buildFieldFn('Nazwa wersji oferty', versionInput, true);
      if(versionField) body.appendChild(versionField);

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
            saveRateSelectionRowsFn(makeRateSelectionRowsFn(catalog, nextMap));
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
        const latestDraft = getOfferDraft();
        const latestCommercial = latestDraft && latestDraft.commercial && typeof latestDraft.commercial === 'object' ? latestDraft.commercial : {};
        const nextCommercial = {
          versionName:String(versionInput.value || '').trim(),
          preliminary: !!latestCommercial.preliminary,
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

      [
        buildFieldFn('Rabat %', discountPercentInput),
        buildFieldFn('Rabat kwotowy', discountAmountInput),
        buildFieldFn('Ważność oferty', validityInput),
        buildFieldFn('Termin realizacji', leadTimeInput),
        buildFieldFn('Warunki montażu / transportu', deliveryInput, true),
        buildFieldFn('Notatka dla klienta', noteInput, true),
      ].filter(Boolean).forEach((field)=> grid.appendChild(field));
      body.appendChild(grid);
      section.appendChild(body);
    }

    card.appendChild(section);
  }

  FC.wycenaTabEditor = Object.assign({}, FC.wycenaTabEditor || {}, {
    buildOfferSummary,
    buildSelectionMap,
    saveRateSelectionRows,
    buildField,
    makeRateSelectionRows,
    renderPreliminaryToggle,
    renderOfferEditor,
  });
})();
