// js/app/material/price-modal-hardware-ux.js
// Czytelniejszy UX listy okuć: status ceny, szybkie filtry i podgląd zestawów.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};
  const PRICE_STALE_DAYS = 90;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function num(value){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function money(value){ return num(value).toFixed(2) + ' PLN'; }
  function h(tag, attrs, children){
    const el = document.createElement(tag);
    Object.keys(attrs || {}).forEach((key)=>{
      const value = attrs[key];
      if(key === 'class') el.className = value;
      else if(key === 'text') el.textContent = value;
      else if(key === 'style') el.setAttribute('style', value);
      else if(key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else if(value !== false && value != null) el.setAttribute(key, value === true ? '' : String(value));
    });
    (Array.isArray(children) ? children : (children ? [children] : [])).forEach((child)=> el.appendChild(child));
    return el;
  }
  function dateAgeDays(value){
    const raw = text(value);
    if(!raw) return null;
    const parsed = new Date(raw + (raw.length <= 10 ? 'T00:00:00' : ''));
    if(Number.isNaN(parsed.getTime())) return null;
    return Math.floor((Date.now() - parsed.getTime()) / 86400000);
  }
  function hasAnyPrice(item){
    return num(item && item.price) > 0 || num(item && item.catalogPriceGross) > 0 || num(item && item.catalogPriceNet) > 0 || num(item && item.purchasePriceGross) > 0;
  }
  function hardwarePriceStatus(item){
    if(!hasAnyPrice(item)) return { code:'noPrice', label:'Brak ceny', tone:'danger' };
    const priceStatus = text(item && item.priceStatus);
    if(priceStatus === 'review') return { code:'check', label:'Do sprawdzenia', tone:'warning' };
    if(priceStatus === 'old') return { code:'stale', label:'Stara cena', tone:'warning' };
    if(priceStatus === 'archived') return { code:'stale', label:'Archiwalna cena', tone:'warning' };
    if(priceStatus === 'current') return { code:'current', label:'Aktualna cena', tone:'ok' };
    const source = text(item && item.priceSource).toLowerCase();
    const age = dateAgeDays(item && item.priceUpdatedAt);
    if(age != null && age > PRICE_STALE_DAYS) return { code:'stale', label:'Stara cena', tone:'warning' };
    if(!text(item && item.priceUpdatedAt) || source.includes('import excel')) return { code:'check', label:'Do sprawdzenia', tone:'warning' };
    return { code:'current', label:'Aktualna cena', tone:'ok' };
  }
  function hardwareItemNeedsPriceCheck(item){
    return hardwarePriceStatus(item).code !== 'current';
  }
  function isBundle(item){
    return !!(item && ((Array.isArray(item.bundleItems) && item.bundleItems.length) || String(item.hardwareUnit || '') === 'zestaw'));
  }
  function accessoryList(){
    try{ return ctx.catalogStore && ctx.catalogStore() && ctx.catalogStore().getAccessories ? ctx.catalogStore().getAccessories() : ctx.currentList(); }
    catch(_){ return ctx.currentList ? ctx.currentList() : []; }
  }
  function supplierName(item){
    const sid = text(item && item.supplierId);
    const store = ctx.catalogStore && ctx.catalogStore();
    const suppliers = store && store.getHardwareSuppliers ? store.getHardwareSuppliers() : [];
    const found = suppliers.find((row)=> text(row && row.id) === sid);
    return text(found && found.name) || text(item && item.priceSource) || sid || '—';
  }
  function componentSummary(item){
    const parts = Array.isArray(item && item.bundleItems) ? item.bundleItems : [];
    if(!parts.length) return null;
    const byId = new Map(accessoryList().map((row)=> [text(row && row.id), row]));
    let quote = 0;
    let purchase = 0;
    let missing = 0;
    parts.forEach((entry)=>{
      const child = byId.get(text(entry && entry.itemId));
      const qty = num(entry && entry.qty) || 1;
      if(!child){ missing += 1; return; }
      quote += num(child.price) * qty;
      purchase += num(child.purchasePriceGross) * qty;
      if(!hasAnyPrice(child)) missing += 1;
    });
    return { count:parts.length, quote, purchase, missing };
  }
  function chip(label, tone){
    return h('span', { class:'hardware-price-chip hardware-price-chip--' + (tone || 'neutral'), text:label });
  }
  function renderMetaLine(parts){
    return h('div', { class:'hardware-price-row__meta', text:(parts || []).filter(Boolean).join(' • ') });
  }
  function renderBundleSummary(item){
    const summary = componentSummary(item);
    if(!summary) return null;
    const box = h('div', { class:'hardware-price-row__bundle' });
    const own = num(item && item.price);
    const bits = ['Składniki: ' + money(summary.quote), 'koszt zakupu składników: ' + money(summary.purchase)];
    if(own > 0){
      const diff = own - summary.quote;
      bits.push(diff < 0 ? ('zestaw taniej o ' + money(Math.abs(diff))) : (diff > 0 ? ('zestaw drożej o ' + money(diff)) : 'cena równa składnikom'));
    }
    if(summary.missing) bits.push('braki cen/składników: ' + summary.missing);
    box.textContent = bits.join(' • ');
    return box;
  }
  function ensureQuickFiltersMount(container){
    if(!container) return null;
    let mount = document.getElementById('hardwareQuickFilters');
    if(!mount){
      mount = h('div', { id:'hardwareQuickFilters', class:'hardware-quick-filters' });
      container.parentElement.insertBefore(mount, container);
    }
    return mount;
  }
  function quickCounts(){
    const list = ctx.currentList ? ctx.currentList() : [];
    return {
      all:list.length,
      needs:list.filter(hardwareItemNeedsPriceCheck).length,
      noPrice:list.filter((row)=> hardwarePriceStatus(row).code === 'noPrice').length,
      stale:list.filter((row)=> hardwarePriceStatus(row).code === 'stale').length,
      bundles:list.filter(isBundle).length,
    };
  }
  function renderHardwareQuickFilters(){
    const list = document.getElementById('priceListItems');
    const mount = ensureQuickFiltersMount(list);
    if(!mount) return;
    const f = ctx.runtimeState.filters = Object.assign({}, ctx.runtimeState.filters || {});
    const active = text(f.hardwareQuickFilter || '');
    const counts = quickCounts();
    const options = [
      { value:'', label:'Wszystkie', count:counts.all },
      { value:'needs', label:'Do sprawdzenia cen', count:counts.needs },
      { value:'noPrice', label:'Brak ceny', count:counts.noPrice },
      { value:'stale', label:'Stara cena', count:counts.stale },
      { value:'bundles', label:'Zestawy', count:counts.bundles },
    ];
    mount.innerHTML = '';
    options.forEach((opt)=>{
      const selected = active === opt.value;
      const btn = h('button', { type:'button', class:'rozrys-scope-chip hardware-quick-filter' + (selected ? ' is-checked' : ''), 'aria-pressed':selected ? 'true' : 'false' });
      btn.appendChild(h('span', { text:selected ? '✓' : '□' }));
      btn.appendChild(h('span', { text:opt.label + ' (' + opt.count + ')' }));
      btn.addEventListener('click', ()=>{ f.hardwareQuickFilter = opt.value; ctx.runtimeState.filters = f; ctx.renderPriceList && ctx.renderPriceList(); });
      mount.appendChild(btn);
    });
  }
  function matchesHardwareQuickFilter(item){
    const f = ctx.runtimeState.filters || {};
    const value = text(f.hardwareQuickFilter || '');
    if(!value) return true;
    const status = hardwarePriceStatus(item).code;
    if(value === 'needs') return hardwareItemNeedsPriceCheck(item);
    if(value === 'noPrice') return status === 'noPrice';
    if(value === 'stale') return status === 'stale';
    if(value === 'bundles') return isBundle(item);
    return true;
  }
  function renderHardwareAccessoryRow(item, onEdit){
    const row = h('div', { class:'list-item price-modal-list-row hardware-price-row' });
    const left = h('div', { class:'price-modal-list-main hardware-price-row__main' });
    const title = h('div', { class:'hardware-price-row__title', text:text(item && item.name) || '—' });
    const chips = h('div', { class:'hardware-price-row__chips' }, [chip(hardwarePriceStatus(item).label, hardwarePriceStatus(item).tone)]);
    if(isBundle(item)) chips.appendChild(chip((Array.isArray(item && item.bundleItems) && item.bundleItems.length ? 'Zestaw: ' + item.bundleItems.length + ' składn.' : 'Zestaw'), 'neutral'));
    const hw = FC.hardwareCatalog || {};
    const statusLabel = hw.statusLabel ? hw.statusLabel(item && item.status) : text(item && item.status);
    if(text(item && item.status) && text(item && item.status) !== 'active') chips.appendChild(chip(statusLabel, 'neutral'));
    const editBtn = h('button', { class:'btn hardware-price-row__edit-btn', type:'button', text:'Edytuj', onclick:()=>{ if(typeof onEdit === 'function') onEdit(); } });
    const statusActions = h('div', { class:'hardware-price-row__status-actions' }, [chips, editBtn]);
    left.appendChild(title);
    left.appendChild(statusActions);
    left.appendChild(renderMetaLine([text(item && item.manufacturer) || '—', text(item && item.hardwareCategory) || 'Inne', text(item && item.hardwareType), text(item && item.hardwareUnit) || 'szt.', text(item && item.series), text(item && item.symbol) ? 'SYM: ' + text(item.symbol) : '']));
    left.appendChild(renderMetaLine(['Dostawca: ' + supplierName(item), num(item && item.purchasePriceGross) > 0 ? 'zakup: ' + money(item.purchasePriceGross) : '', num(item && item.price) > 0 ? 'do wyceny: ' + money(item.price) : '', text(item && item.priceUpdatedAt) ? 'cena: ' + text(item.priceUpdatedAt) : 'brak daty ceny']));
    const bundleBox = renderBundleSummary(item);
    if(bundleBox) left.appendChild(bundleBox);
    const right = h('div', { class:'price-modal-list-actions hardware-price-row__actions' });
    right.appendChild(h('div', { class:'price-modal-list-price', text:(num(item && item.price)).toFixed(2) + ' PLN/' + (text(item && item.hardwareUnit) || 'szt.') }));
    row.appendChild(left);
    row.appendChild(right);
    return row;
  }

  Object.assign(ctx, {
    PRICE_STALE_DAYS,
    hardwarePriceStatus,
    hardwareItemNeedsPriceCheck,
    renderHardwareQuickFilters,
    matchesHardwareQuickFilter,
    renderHardwareAccessoryRow,
  });
})();
