// js/app/wycena/wycena-tab-manual-labor.js
// Akordeon ręcznie dodawanych czynności robocizny używany w zakładce CZYNNOŚCI.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function getFn(deps, key, fallback){
    return deps && typeof deps[key] === 'function' ? deps[key] : fallback;
  }

  function num(value, fallback){
    const parsed = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function getCatalog(){
    const raw = FC.catalogSelectors && typeof FC.catalogSelectors.getQuoteRates === 'function'
      ? FC.catalogSelectors.getQuoteRates()
      : [];
    if(FC.wycenaLaborPicker && typeof FC.wycenaLaborPicker.normalizeCatalog === 'function'){
      try{ return FC.wycenaLaborPicker.normalizeCatalog(raw); }catch(_){ }
    }
    return (Array.isArray(raw) ? raw : []).filter((rate)=> rate && rate.active !== false && String(rate.autoRole || 'none') === 'none');
  }

  function buildSelectionMap(draft, deps){
    const parse = getFn(deps, 'num', num);
    const out = Object.create(null);
    const rows = Array.isArray(draft && draft.rateSelections) ? draft.rateSelections : [];
    rows.forEach((row)=>{
      const key = String(row && row.rateId || '');
      if(!key) return;
      out[key] = Math.max(0, parse(row && row.qty, 0));
    });
    return out;
  }

  function makeRateSelectionRows(catalog, selectionMap, deps){
    const parse = getFn(deps, 'num', num);
    return (Array.isArray(catalog) ? catalog : []).map((rate)=> ({
      rateId: String(rate && rate.id || ''),
      qty: Math.max(0, parse(selectionMap[String(rate && rate.id || '')], 0)),
    })).filter((row)=> row.rateId);
  }

  function saveRateSelectionRows(selections, deps){
    const patchOfferDraft = getFn(deps, 'patchOfferDraft', ()=> null);
    const parse = getFn(deps, 'num', num);
    return patchOfferDraft({
      rateSelections: (Array.isArray(selections) ? selections : [])
        .map((row)=> ({ rateId:String(row && row.rateId || ''), qty:Math.max(0, parse(row && row.qty, 0)) }))
        .filter((row)=> row.rateId)
    });
  }

  function buildManualLaborSummary(draft, catalog, deps){
    const parse = getFn(deps, 'num', num);
    const money = getFn(deps, 'money', (value)=> `${(Number(value)||0).toFixed(2)} PLN`);
    const map = buildSelectionMap(draft, deps);
    const rows = (Array.isArray(catalog) ? catalog : []).filter((rate)=> parse(map[String(rate && rate.id || '')], 0) > 0);
    const qtyTotal = rows.reduce((sum, rate)=> sum + parse(map[String(rate && rate.id || '')], 0), 0);
    if(!rows.length) return 'Brak ręcznie dodanych czynności. Automatyczne czynności szafek są poniżej.';
    let total = 0;
    rows.forEach((rate)=>{
      const qty = parse(map[String(rate && rate.id || '')], 0);
      if(FC.laborCatalog && typeof FC.laborCatalog.calculateDefinition === 'function'){
        try{ total += Number((FC.laborCatalog.calculateDefinition(rate, { quantity:qty }) || {}).total || 0); }catch(_){ }
      }
    });
    return `Wybrane czynności: ${rows.length} • ilość razem: ${qtyTotal}${total > 0 ? ` • ${money(total)}` : ''}`;
  }

  function openPicker(catalog, selectionMap, onSave){
    if(!(FC.wycenaLaborPicker && typeof FC.wycenaLaborPicker.open === 'function')) return false;
    FC.wycenaLaborPicker.open({ catalog, selectionMap, onSave });
    return true;
  }

  function renderSelectedRows(wrap, catalog, selectionMap, ctx, deps){
    const h = getFn(deps, 'h');
    const parse = getFn(deps, 'num', num);
    const render = getFn(deps, 'render', ()=> {});
    if(typeof h !== 'function') return;
    const selectedRows = (Array.isArray(catalog) ? catalog : []).filter((rate)=> parse(selectionMap[String(rate && rate.id || '')], 0) > 0);
    if(!selectedRows.length){
      wrap.appendChild(h('div', { class:'muted', text:'Brak ręcznie dodanych czynności. Automatyczne czynności szafek są poniżej.' }));
      return;
    }
    selectedRows.forEach((rate)=>{
      const id = String(rate && rate.id || '');
      const row = h('article', { class:'quote-rate-editor__selected-row' });
      const info = h('div');
      info.appendChild(h('div', { class:'quote-rate-editor__selected-title', text:String(rate && rate.name || 'Czynność') }));
      const desc = FC.laborCatalog && typeof FC.laborCatalog.describeDefinition === 'function' ? FC.laborCatalog.describeDefinition(rate) : '';
      info.appendChild(h('div', { class:'quote-rate-editor__selected-meta', text:[rate && rate.category, desc].filter(Boolean).join(' • ') || '—' }));
      row.appendChild(info);
      row.appendChild(h('div', { class:'quote-rate-editor__selected-qty', text:`×${parse(selectionMap[id], 0)}` }));
      const remove = h('button', { class:'btn btn-danger', type:'button', text:'Usuń' });
      remove.addEventListener('click', (event)=>{
        try{ event.preventDefault(); event.stopPropagation(); }catch(_){ }
        const nextMap = Object.assign({}, selectionMap);
        delete nextMap[id];
        saveRateSelectionRows(makeRateSelectionRows(catalog, nextMap, deps), deps);
        render(ctx);
      });
      row.appendChild(remove);
      wrap.appendChild(row);
    });
  }

  function renderManualLaborEditor(card, ctx, deps){
    const h = getFn(deps, 'h');
    const getOfferDraft = getFn(deps, 'getOfferDraft', ()=> ({}));
    const render = getFn(deps, 'render', ()=> {});
    const getIsOpen = getFn(deps, 'getIsOpen', ()=> true);
    const setIsOpen = getFn(deps, 'setIsOpen', ()=> {});
    if(typeof h !== 'function' || !card) return;

    const draft = getOfferDraft();
    const catalog = getCatalog();
    const selectionMap = buildSelectionMap(draft, deps);
    const isOpen = !!getIsOpen();
    const section = h('section', { class:`quote-offer-accordion quote-manual-labor-accordion rozrys-material-accordion${isOpen ? ' is-open' : ''}`, style:'margin-top:12px;' });
    const head = h('div', { class:'quote-offer-accordion__head' });
    const trigger = h('button', { class:'rozrys-material-accordion__trigger quote-offer-accordion__trigger', type:'button' });
    const titleBox = h('div', { class:'rozrys-material-accordion__title quote-offer-accordion__titlebox' });
    titleBox.appendChild(h('div', { class:'rozrys-material-accordion__title-line1', text:'Czynności dodane ręcznie' }));
    titleBox.appendChild(h('div', { class:'rozrys-material-accordion__title-line2 quote-offer-accordion__summary-line', text:buildManualLaborSummary(draft, catalog, deps) }));
    const chevron = h('span', { class:`rozrys-material-accordion__chevron${isOpen ? ' is-open' : ''}`, html:'&#9662;', 'aria-hidden':'true' });
    trigger.appendChild(titleBox);
    trigger.appendChild(chevron);
    trigger.addEventListener('click', (event)=>{
      try{ event.preventDefault(); }catch(_){ }
      setIsOpen(!isOpen);
      render(ctx);
    });
    head.appendChild(trigger);
    section.appendChild(head);

    if(isOpen){
      const body = h('div', { class:'quote-offer-accordion__body rozrys-material-accordion__body' });
      const rateShell = h('div', { class:'quote-rate-editor' });
      if(!catalog.length){
        rateShell.appendChild(h('div', { class:'muted', text:'Brak zdefiniowanych czynności robocizny. Dodaj je w cenniku.' }));
      } else {
        const selectedWrap = h('div', { class:'quote-rate-editor__selected' });
        renderSelectedRows(selectedWrap, catalog, selectionMap, ctx, deps);
        rateShell.appendChild(selectedWrap);
        const actions = h('div', { class:'quote-rate-editor__actions' });
        const addBtn = h('button', { class:'btn-primary', type:'button', text:'Dodaj czynność' });
        let lastOpen = 0;
        const handleOpen = (event)=>{
          try{ event.preventDefault(); event.stopPropagation(); }catch(_){ }
          const now = Date.now();
          if(now - lastOpen < 250) return;
          lastOpen = now;
          openPicker(catalog, selectionMap, (rows)=>{
            saveRateSelectionRows(rows, deps);
            render(ctx);
          });
        };
        addBtn.addEventListener('pointerup', handleOpen);
        addBtn.addEventListener('click', handleOpen);
        actions.appendChild(addBtn);
        rateShell.appendChild(actions);
      }
      body.appendChild(rateShell);
      section.appendChild(body);
    }

    card.appendChild(section);
  }

  FC.wycenaTabManualLabor = Object.assign({}, FC.wycenaTabManualLabor || {}, {
    buildSelectionMap,
    makeRateSelectionRows,
    saveRateSelectionRows,
    buildManualLaborSummary,
    renderManualLaborEditor,
  });
})();
