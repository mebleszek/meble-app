// js/app/material/price-modal-hardware-bundle.js
// Skład świadomie tworzonych zestawów okuć: wybór składników i suma kosztów.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};

  let bundleItemsDraft = [];

  function num(value){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function round2(value){ const n = Number(value); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; }
  function readString(id){ return String((ctx.byId(id) && ctx.byId(id).value) || '').trim(); }
  function currentEditingId(){ return String((ctx.appUiState && ctx.appUiState().editingId) || ''); }
  function currentAccessoryList(){ try{ return Array.isArray(ctx.currentList && ctx.currentList()) ? ctx.currentList() : []; }catch(_){ return []; } }
  function isBundleUnit(value){
    if(FC.hardwareCatalog && typeof FC.hardwareCatalog.isBundleUnit === 'function') return FC.hardwareCatalog.isBundleUnit(value);
    const raw = String(value || '').trim().toLowerCase();
    return raw === 'zestaw';
  }
  function isVisible(){ return isBundleUnit(readString('hardwareUnit')) || bundleItemsDraft.length > 0; }
  function itemById(id){ const key = String(id || ''); return currentAccessoryList().find((item)=> String(item && item.id || '') === key) || null; }
  function itemLabel(item){ return String((item && item.name) || (item && item.symbol) || 'Pozycja bez nazwy'); }
  function itemMeta(item){ return [item && item.manufacturer, item && item.hardwareCategory, item && item.hardwareUnit, item && item.priceSource].filter(Boolean).join(' • '); }
  function itemCatalogGross(item){ return num(item && (item.catalogPriceGross != null ? item.catalogPriceGross : item.price)); }
  function itemPurchaseGross(item){ return num(item && (item.purchasePriceGross != null ? item.purchasePriceGross : (item.purchasePrice != null ? item.purchasePrice : item.price))); }
  function escapeHtml(value){ return String(value == null ? '' : value).replace(/[&<>'"]/g, (ch)=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch])); }

  function normalizeItems(list){
    const selfId = currentEditingId();
    const seen = new Set();
    const out = [];
    (Array.isArray(list) ? list : []).forEach((row)=>{
      const itemId = String(row && (row.itemId || row.id || row.refId) || '').trim();
      if(!itemId || itemId === selfId || seen.has(itemId)) return;
      const qty = Math.max(0, num(row && (row.qty != null ? row.qty : row.quantity)) || 0);
      if(qty <= 0) return;
      seen.add(itemId);
      out.push({ itemId, qty });
    });
    return out;
  }
  function setItems(list){ bundleItemsDraft = normalizeItems(list); }
  function getItems(){ return normalizeItems(bundleItemsDraft); }
  function getTotals(){
    let catalogGross = 0;
    let purchaseGross = 0;
    bundleItemsDraft.forEach((row)=>{
      const item = itemById(row.itemId);
      const qty = Math.max(0, num(row.qty) || 0);
      if(!item || qty <= 0) return;
      catalogGross += itemCatalogGross(item) * qty;
      purchaseGross += itemPurchaseGross(item) * qty;
    });
    return { catalogGross:round2(catalogGross), purchaseGross:round2(purchaseGross) };
  }

  function updatePreview(){
    const wrap = ctx.byId('hardwareBundleFields');
    const preview = ctx.byId('hardwareBundleTotalPreview');
    const visible = isVisible();
    if(wrap) wrap.style.display = visible ? '' : 'none';
    if(!preview) return;
    if(!visible){ preview.textContent = 'Brak składników'; return; }
    const totals = getTotals();
    preview.textContent = bundleItemsDraft.length
      ? `Osobno: ${totals.catalogGross.toFixed(2)} PLN brutto • zakup: ${totals.purchaseGross.toFixed(2)} PLN brutto`
      : 'Brak składników';
  }

  function render(){
    const list = ctx.byId('hardwareBundleItems');
    const addBtn = ctx.byId('hardwareBundleAddItem');
    updatePreview();
    if(!isVisible()){
      if(list) list.innerHTML = '';
      return;
    }
    if(list){
      list.innerHTML = '';
      if(!bundleItemsDraft.length){
        const empty = document.createElement('div');
        empty.className = 'muted-tag xs';
        empty.textContent = 'Brak składników zestawu. Dodaj element z istniejących pozycji katalogu tylko wtedy, gdy to faktycznie składany zestaw.';
        list.appendChild(empty);
      }
      bundleItemsDraft.forEach((row)=> list.appendChild(buildRow(row)));
    }
    if(addBtn && !addBtn.dataset.wired){
      addBtn.dataset.wired = '1';
      addBtn.addEventListener('click', openPicker);
    }
  }

  function buildRow(row){
    const item = itemById(row.itemId);
    const box = document.createElement('div');
    box.className = 'hardware-bundle-row';
    const main = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'hardware-bundle-row__name';
    name.textContent = item ? itemLabel(item) : 'Brak pozycji w katalogu';
    const meta = document.createElement('div');
    meta.className = 'hardware-bundle-row__meta';
    const purchase = item ? itemPurchaseGross(item) * (num(row.qty) || 0) : 0;
    meta.textContent = item ? `${itemMeta(item)} • zakup: ${round2(purchase).toFixed(2)} PLN` : 'Składnik został usunięty albo nie istnieje.';
    main.appendChild(name); main.appendChild(meta);

    const qtyWrap = document.createElement('div');
    const qtyLabel = document.createElement('label'); qtyLabel.textContent = 'Ilość';
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number'; qtyInput.step = '0.01'; qtyInput.min = '0'; qtyInput.className = 'investor-form-input'; qtyInput.value = String(row.qty || 1);
    qtyInput.addEventListener('input', ()=>{
      row.qty = num(qtyInput.value) || 0;
      syncOwner('hardwareBundleQty');
      updatePreview();
      if(item){ meta.textContent = `${itemMeta(item)} • zakup: ${round2(itemPurchaseGross(item) * (num(row.qty) || 0)).toFixed(2)} PLN`; }
    });
    qtyWrap.appendChild(qtyLabel); qtyWrap.appendChild(qtyInput);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button'; removeBtn.className = 'btn-danger'; removeBtn.textContent = 'Usuń';
    removeBtn.addEventListener('click', ()=>{
      bundleItemsDraft = bundleItemsDraft.filter((entry)=> entry !== row);
      syncOwner('hardwareBundleRemove');
      render();
    });
    box.appendChild(main); box.appendChild(qtyWrap); box.appendChild(removeBtn);
    return box;
  }

  function syncOwner(sourceId){
    try{ if(ctx.priceModalHardwareForm && typeof ctx.priceModalHardwareForm.syncHardwarePricing === 'function') ctx.priceModalHardwareForm.syncHardwarePricing({ sourceId }); }catch(_){ }
    try{ if(ctx.updateItemActionState) ctx.updateItemActionState(); }catch(_){ }
  }

  function openPicker(){
    const selfId = currentEditingId();
    const selected = new Set(bundleItemsDraft.map((row)=> String(row.itemId)));
    const candidates = currentAccessoryList().filter((item)=>{ const id = String(item && item.id || ''); return id && id !== selfId && !selected.has(id); });
    if(!candidates.length){
      try{ if(FC.infoBox && typeof FC.infoBox.open === 'function') FC.infoBox.open({ title:'Brak pozycji', message:'Najpierw dodaj pojedyncze okucia do katalogu. Zestaw może składać się tylko z istniejących pozycji.' }); }catch(_){ }
      return;
    }
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function')) return;
    const body = document.createElement('div'); body.className = 'hardware-bundle-picker-list';
    candidates.forEach((item)=>{
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'btn hardware-bundle-picker-item';
      btn.innerHTML = `<div><div style="font-weight:900">${escapeHtml(itemLabel(item))}</div><div class="muted-tag xs">${escapeHtml(itemMeta(item))} • zakup: ${itemPurchaseGross(item).toFixed(2)} PLN</div></div>`;
      btn.addEventListener('click', ()=>{
        bundleItemsDraft.push({ itemId:String(item.id), qty:1 });
        try{ FC.panelBox.close(); }catch(_){ }
        syncOwner('hardwareBundleAdd');
        render();
      });
      body.appendChild(btn);
    });
    FC.panelBox.open({ title:'Dodaj składnik zestawu', contentNode:body, width:'680px', boxClass:'panel-box--rozrys hardware-bundle-picker-panel', dismissOnOverlay:true, dismissOnEsc:true });
  }

  ctx.priceModalHardwareBundle = { setItems, getItems, getTotals, isVisible, render, updatePreview, normalizeItems };
})();
