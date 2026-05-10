// js/app/material/price-modal-hardware-supplier-prices.js
// UI wielu cen dostawców dla jednej pozycji okucia. Jedna cena może być oznaczona jako Do wyceny.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};

  let draftPrices = [];
  let lastSourceId = '';
  let previewSupplierId = '';
  let renderSeq = 0;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function num(value){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function round2(value){ const n = Number(value); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; }
  function fmt(value){ const n = Number(value); return Number.isFinite(n) && n !== 0 ? String(Math.round(n * 100) / 100) : ''; }
  function todayIso(){ try{ const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }catch(_){ return ''; } }
  function byId(id){ return ctx.byId ? ctx.byId(id) : document.getElementById(id); }
  function store(){ return ctx.catalogStore && ctx.catalogStore(); }
  function getSuppliers(){ const s = store(); return s && s.getHardwareSuppliers ? s.getHardwareSuppliers() : []; }
  function getSettings(){ const s = store(); return s && s.getHardwareSettings ? s.getHardwareSettings() : ((FC.hardwareCatalog && FC.hardwareCatalog.DEFAULT_SETTINGS) || {}); }
  function supplierById(id){ const key = text(id); return getSuppliers().find((row)=> text(row && row.id) === key) || null; }
  function vatFor(id){ const supplier = supplierById(id); return num(supplier && supplier.defaultVatRate) || num(getSettings().defaultVatRate) || 23; }
  function discountFor(id){ const supplier = supplierById(id); return num(supplier && supplier.defaultDiscountPercent); }
  function netToGross(value, vat){ return FC.hardwareCatalog && FC.hardwareCatalog.netToGross ? FC.hardwareCatalog.netToGross(value, vat) : round2(num(value) * (1 + num(vat) / 100)); }
  function grossToNet(value, vat){ return FC.hardwareCatalog && FC.hardwareCatalog.grossToNet ? FC.hardwareCatalog.grossToNet(value, vat) : round2(num(value) / (1 + num(vat) / 100)); }
  function hasPrice(row){ return num(row && row.catalogPriceNet) > 0 || num(row && row.catalogPriceGross) > 0; }
  function statusOptions(){ const hw = FC.hardwareCatalog || {}; return hw.priceStatusOptions ? hw.priceStatusOptions() : [{ value:'current', label:'Aktualna' }, { value:'review', label:'Do sprawdzenia' }, { value:'old', label:'Stara' }, { value:'archived', label:'Archiwalna' }]; }
  function statusLabel(value){ const found = statusOptions().find((row)=> text(row.value) === text(value)); return found ? found.label : 'Aktualna'; }
  function h(tag, attrs, children){
    const el = document.createElement(tag);
    Object.keys(attrs || {}).forEach((key)=>{
      const value = attrs[key];
      if(key === 'class') el.className = value;
      else if(key === 'text') el.textContent = value;
      else if(key === 'html') el.innerHTML = value;
      else if(key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else if(value !== false && value != null) el.setAttribute(key, value === true ? '' : String(value));
    });
    (Array.isArray(children) ? children : (children ? [children] : [])).forEach((child)=> el.appendChild(child));
    return el;
  }
  function fillSelect(select, options, value){
    if(!select) return;
    select.innerHTML = '';
    (options || []).forEach((opt)=>{
      const o = document.createElement('option');
      const item = opt && typeof opt === 'object' ? opt : { value:opt, label:opt };
      o.value = text(item.value); o.textContent = text(item.label || item.value);
      select.appendChild(o);
    });
    select.value = text(value);
  }
  function mountChoice(select, mountId, title, placeholder, onChange){
    try{
      if(ctx.mountChoice) ctx.mountChoice({ selectEl:select, mountId, title, placeholder, buttonClass:'investor-choice-launch price-labor-choice-launch', onChange });
    }catch(_){ }
  }
  function normalizePrices(list, legacy){
    const hw = FC.hardwareCatalog || {};
    const settings = Object.assign({}, getSettings(), { hardwareSuppliers:getSuppliers() });
    if(hw && typeof hw.normalizeSupplierPrices === 'function') return hw.normalizeSupplierPrices(list, legacy || {}, settings.hardwareSuppliers, settings);
    return Array.isArray(list) ? list.slice() : [];
  }
  function ensureRowsForSuppliers(){
    const bySupplier = new Map(draftPrices.map((row)=> [text(row && row.supplierId), Object.assign({ priceStatus:'current' }, row)]));
    getSuppliers().filter((row)=> row && row.active !== false).forEach((supplier)=>{
      const id = text(supplier && supplier.id);
      if(!id || bySupplier.has(id)) return;
      bySupplier.set(id, { supplierId:id, catalogPriceNet:0, catalogPriceGross:0, enteredPriceType:'', priceDate:'', priceStatus:'current', useForQuote:false });
    });
    draftPrices = Array.from(bySupplier.values());
    normalizeQuoteFlag();
  }
  function normalizeQuoteFlag(){
    let selectedIndex = -1;
    draftPrices.forEach((row, index)=>{ if(row && row.useForQuote) selectedIndex = index; });
    if(selectedIndex < 0){
      const priced = draftPrices.filter(hasPrice);
      if(priced.length === 1) selectedIndex = draftPrices.indexOf(priced[0]);
    }
    draftPrices.forEach((row, index)=>{ if(row) row.useForQuote = index === selectedIndex && selectedIndex >= 0; });
  }
  function visiblePrices(){
    ensureRowsForSuppliers();
    return draftPrices.slice().sort((a, b)=>{
      const sa = supplierById(a.supplierId); const sb = supplierById(b.supplierId);
      return text(sa && sa.name || a.supplierId).localeCompare(text(sb && sb.name || b.supplierId), 'pl');
    });
  }
  function getSelectedPrice(){
    normalizeQuoteFlag();
    return draftPrices.find((row)=> row && row.useForQuote && hasPrice(row)) || draftPrices.find((row)=> row && row.useForQuote) || null;
  }
  function getPreviewPrice(){
    const selected = getSelectedPrice();
    const preferred = previewSupplierId ? draftPrices.find((row)=> text(row && row.supplierId) === text(previewSupplierId)) : null;
    return preferred || selected || draftPrices.find(hasPrice) || null;
  }
  function setLegacyValue(id, value){ const el = byId(id); if(el) el.value = value == null ? '' : String(value); }
  function setLegacyText(id, value){ const el = byId(id); if(el) el.textContent = value == null ? '' : String(value); }
  function applySelectedToLegacyFields(){
    const selected = getSelectedPrice();
    const supplier = selected ? supplierById(selected.supplierId) : null;
    const vat = selected ? vatFor(selected.supplierId) : (num(getSettings().defaultVatRate) || 23);
    const discount = selected ? discountFor(selected.supplierId) : 0;
    const gross = selected ? num(selected.catalogPriceGross) : 0;
    const net = selected ? num(selected.catalogPriceNet) : 0;
    setLegacyValue('hardwareSupplierId', selected ? selected.supplierId : '');
    setLegacyValue('hardwarePriceSource', supplier ? supplier.name : '');
    setLegacyValue('hardwareVatRate', vat || '');
    setLegacyValue('hardwareSupplierDiscountPercent', discount || 0);
    setLegacyValue('hardwareCatalogPriceNet', fmt(net));
    setLegacyValue('hardwareCatalogPriceGross', fmt(gross));
    setLegacyValue('hardwarePriceUpdatedAt', selected ? (selected.priceDate || '') : '');
  }
  function renderQuotePreview(){
    const mount = byId('hardwareQuoteSupplierPreview');
    if(!mount) return;
    const selected = getSelectedPrice();
    const row = getPreviewPrice();
    const selectedSupplier = selected ? supplierById(selected.supplierId) : null;
    const supplier = row ? supplierById(row.supplierId) : null;
    mount.innerHTML = '';
    if(!row || !supplier){ mount.textContent = 'Brak ceny zaznaczonej do wyceny'; return; }
    if(!previewSupplierId) previewSupplierId = text(row.supplierId);
    const selectId = 'hardwareQuoteSupplierPreviewSelect_' + (++renderSeq);
    const select = h('select', { id:selectId, hidden:true });
    fillSelect(select, visiblePrices().filter(hasPrice).map((price)=>{
      const sup = supplierById(price.supplierId) || { name:price.supplierId };
      return { value:price.supplierId, label:(sup.name || price.supplierId) + (price.useForQuote ? ' — DO WYCENY' : '') };
    }), row.supplierId);
    const launch = h('div', { id:selectId + 'Launch' });
    const summary = h('div', { class:'hardware-price-selected-summary' });
    const vat = vatFor(row.supplierId);
    const discount = discountFor(row.supplierId);
    const purchaseGross = round2(num(row.catalogPriceGross) * (1 - discount / 100));
    const purchaseNet = round2(num(row.catalogPriceNet) * (1 - discount / 100));
    summary.appendChild(h('div', { text:`Podgląd: ${supplier.name || supplier.id}${selected && text(selected.supplierId) === text(row.supplierId) ? ' — DO WYCENY' : ''}` }));
    summary.appendChild(h('div', { text:`Katalogowo: ${fmt(row.catalogPriceNet) || '—'} netto / ${fmt(row.catalogPriceGross) || '—'} brutto` }));
    summary.appendChild(h('div', { text:`VAT ${vat}% • rabat ${discount}% • zakup: ${purchaseNet ? purchaseNet.toFixed(2) : '—'} netto / ${purchaseGross ? purchaseGross.toFixed(2) : '—'} brutto` }));
    summary.appendChild(h('div', { text:`Status ceny: ${statusLabel(row.priceStatus)} • Data: ${row.priceDate || '—'}` }));
    if(selectedSupplier && text(selectedSupplier.id) !== text(row.supplierId)) summary.appendChild(h('div', { class:'muted xs', text:`Do wyceny nadal: ${selectedSupplier.name || selectedSupplier.id}` }));
    const setBtn = h('button', { type:'button', class:'btn', text:'Ustaw jako Do wyceny' });
    setBtn.style.display = selected && text(selected.supplierId) === text(row.supplierId) ? 'none' : '';
    setBtn.addEventListener('click', ()=> updateRowValue(row.supplierId, { useForQuote:true }));
    mount.appendChild(h('label', { text:'Podgląd kalkulacji dla' }));
    mount.appendChild(select); mount.appendChild(launch); mount.appendChild(summary); mount.appendChild(setBtn);
    mountChoice(select, selectId + 'Launch', 'Wybierz cenę do podglądu', 'Podgląd ceny', ()=>{ previewSupplierId = select.value; renderQuotePreview(); });
  }
  function updateRowValue(supplierId, patch, shouldRender){
    const key = text(supplierId);
    let row = draftPrices.find((item)=> text(item && item.supplierId) === key);
    if(!row){ row = { supplierId:key, catalogPriceNet:0, catalogPriceGross:0, enteredPriceType:'', priceDate:'', priceStatus:'current', useForQuote:false }; draftPrices.push(row); }
    Object.assign(row, patch || {});
    if(hasPrice(row) && !text(row.priceDate)) row.priceDate = todayIso();
    if(hasPrice(row) && !text(row.priceStatus)) row.priceStatus = 'current';
    if((patch && patch.useForQuote) === true){ draftPrices.forEach((item)=>{ if(item) item.useForQuote = text(item.supplierId) === key; }); previewSupplierId = key; }
    normalizeQuoteFlag();
    applySelectedToLegacyFields();
    try{ if(ctx.priceModalHardwareForm && typeof ctx.priceModalHardwareForm.syncHardwarePricing === 'function') ctx.priceModalHardwareForm.syncHardwarePricing({ sourceId:lastSourceId }); }catch(_){ }
    try{ if(ctx.updateItemActionState) ctx.updateItemActionState(); }catch(_){ }
    if(shouldRender !== false) render(); else renderQuotePreview();
  }
  function makePriceInput(row, field, label){
    const supplierId = text(row && row.supplierId);
    const input = h('input', { class:'investor-form-input hardware-supplier-price-input', type:'number', step:'0.01', inputmode:'decimal', value:fmt(row && row[field]), 'aria-label':label });
    input.addEventListener('input', ()=>{
      const raw = text(input.value);
      const vat = vatFor(supplierId);
      const value = num(raw);
      const patch = {};
      if(raw === ''){ patch.catalogPriceNet = 0; patch.catalogPriceGross = 0; patch.enteredPriceType = ''; }
      else if(field === 'catalogPriceNet'){
        patch.catalogPriceNet = value;
        patch.catalogPriceGross = netToGross(value, vat);
        patch.enteredPriceType = 'net';
      }else{
        patch.catalogPriceGross = value;
        patch.catalogPriceNet = grossToNet(value, vat);
        patch.enteredPriceType = 'gross';
      }
      lastSourceId = field === 'catalogPriceNet' ? 'hardwareCatalogPriceNet' : 'hardwareCatalogPriceGross';
      updateRowValue(supplierId, patch, false);
    });
    input.addEventListener('change', ()=> render());
    return input;
  }
  function makeStatusChoice(row, supplier){
    const id = 'hardwareSupplierPriceStatus_' + (++renderSeq) + '_' + text(row.supplierId).replace(/[^a-z0-9_-]/ig, '_');
    const select = h('select', { id, hidden:true });
    fillSelect(select, statusOptions(), row.priceStatus || 'current');
    const mount = h('div', { id:id + 'Launch' });
    const box = h('div');
    box.appendChild(h('label', { text:'Status ceny' }));
    box.appendChild(select); box.appendChild(mount);
    setTimeout(()=> mountChoice(select, id + 'Launch', 'Wybierz status ceny ' + (supplier.name || ''), 'Status ceny', ()=> updateRowValue(row.supplierId, { priceStatus:select.value }, false)), 0);
    return box;
  }
  function render(){
    const mount = byId('hardwareSupplierPrices');
    if(!mount) return;
    ensureRowsForSuppliers();
    applySelectedToLegacyFields();
    mount.innerHTML = '';
    visiblePrices().forEach((row)=>{
      const supplier = supplierById(row.supplierId) || { id:row.supplierId, name:row.supplierId, defaultDiscountPercent:0, defaultVatRate:getSettings().defaultVatRate || 23 };
      const card = h('div', { class:'hardware-supplier-price-card' });
      const top = h('div', { class:'hardware-supplier-price-card__top' });
      top.appendChild(h('div', { class:'hardware-supplier-price-card__name', text:supplier.name || supplier.id }));
      const quoteBtn = h('button', { type:'button', class:'rozrys-scope-chip hardware-supplier-price-quote' + (row.useForQuote ? ' is-checked' : ''), 'aria-pressed':row.useForQuote ? 'true' : 'false' });
      quoteBtn.appendChild(h('span', { text:row.useForQuote ? '✓' : '□' }));
      quoteBtn.appendChild(h('span', { text:'Do wyceny' }));
      quoteBtn.addEventListener('click', ()=> updateRowValue(row.supplierId, { useForQuote:true }));
      top.appendChild(quoteBtn);
      card.appendChild(top);
      const grid = h('div', { class:'hardware-supplier-price-grid' });
      const netBox = h('div'); netBox.appendChild(h('label', { text:'Cena netto' })); netBox.appendChild(makePriceInput(row, 'catalogPriceNet', 'Cena netto ' + supplier.name));
      const grossBox = h('div'); grossBox.appendChild(h('label', { text:'Cena brutto' })); grossBox.appendChild(makePriceInput(row, 'catalogPriceGross', 'Cena brutto ' + supplier.name));
      const dateBox = h('div'); dateBox.appendChild(h('label', { text:'Data ceny' }));
      const dateInput = h('input', { class:'investor-form-input', type:'text', placeholder:'RRRR-MM-DD', value:row.priceDate || '' });
      dateInput.addEventListener('input', ()=> updateRowValue(row.supplierId, { priceDate:text(dateInput.value) }, false));
      dateInput.addEventListener('change', ()=> render());
      dateBox.appendChild(dateInput);
      grid.appendChild(netBox); grid.appendChild(grossBox); grid.appendChild(makeStatusChoice(row, supplier)); grid.appendChild(dateBox);
      card.appendChild(grid);
      const purchaseGross = round2(num(row.catalogPriceGross) * (1 - discountFor(row.supplierId) / 100));
      card.appendChild(h('div', { class:'hardware-supplier-price-note', text:`VAT ${vatFor(row.supplierId)}% • rabat ${discountFor(row.supplierId)}% • zakup po rabacie: ${purchaseGross ? purchaseGross.toFixed(2) + ' PLN brutto' : '—'}` }));
      mount.appendChild(card);
    });
    renderQuotePreview();
  }
  function setItems(item){
    draftPrices = normalizePrices(item && item.supplierPrices, item || {});
    previewSupplierId = '';
    ensureRowsForSuppliers();
    const selected = getSelectedPrice();
    previewSupplierId = selected ? text(selected.supplierId) : '';
    render();
  }
  function getItems(){
    normalizeQuoteFlag();
    return draftPrices
      .filter((row)=> row && (hasPrice(row) || row.useForQuote))
      .map((row)=>({
        supplierId:text(row.supplierId),
        catalogPriceNet:num(row.catalogPriceNet),
        catalogPriceGross:num(row.catalogPriceGross),
        enteredPriceType:text(row.enteredPriceType),
        priceDate:text(row.priceDate),
        priceStatus:text(row.priceStatus || 'current'),
        useForQuote:!!row.useForQuote,
      }))
      .filter((row)=> row.supplierId && hasPrice(row));
  }

  ctx.priceModalHardwareSupplierPrices = { setItems, getItems, render, applySelectedToLegacyFields, getSelectedPrice };
})();
