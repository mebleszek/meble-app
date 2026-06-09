// js/app/material/price-modal-list.js
// Render listy pozycji aktualnego katalogu/cennika.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const ctx = window.FC.priceModalContext || {};

  function isStarterPrice(item){ return !!(item && item.starterPrice === true && !String(item.priceUserEditedAt || item.userEditedAt || '').trim()); }
  function unitLabel(value){
    const raw = String(value || '').trim();
    if(raw === 'sheet') return 'arkusz';
    if(raw === 'm2') return 'm²';
    if(raw === 'mb') return 'mb';
    if(raw === 'piece') return 'szt.';
    return raw || '';
  }
  function starterBadge(item){
    if(!isStarterPrice(item)) return '';
    return '<span class="price-starter-badge">Cena startowa</span>';
  }

  function itemMeta(kind, item){
    if(kind === 'materials') return ((item.materialType || '—') + ' • ' + (item.manufacturer || '—') + (item.symbol ? ' • SYM: ' + item.symbol : '') + (item.priceUnit ? ' • cena za: ' + unitLabel(item.priceUnit) : '') + (item.hasGrain ? ' • 🌾 słoje' : ''));
    if(kind === 'accessories') {
      const hw = window.FC && window.FC.hardwareCatalog || {};
      const status = hw && typeof hw.statusLabel === 'function' ? hw.statusLabel(item && item.status) : (item.status || 'Aktywne');
      return [item.manufacturer || '—', item.hardwareCategory || 'Inne', item.hardwareUnit || 'szt.', item.hardwareSystem || item.series || '', item.symbol ? 'SYM: ' + item.symbol : '', item.bundleItems && item.bundleItems.length ? ('składników: ' + item.bundleItems.length) : '', item.priceSource ? 'Dostawca: ' + item.priceSource : '', item.purchasePriceGross ? 'zakup: ' + Number(item.purchasePriceGross).toFixed(2) + ' PLN' : '', item.priceUpdatedAt ? 'Cena: ' + item.priceUpdatedAt : '', status].filter(Boolean).join(' • ');
    }
    if(kind === 'quoteRates' && window.FC && window.FC.laborCatalog && typeof window.FC.laborCatalog.describeDefinition === 'function'){
      return (item.category || '—') + ' • ' + window.FC.laborCatalog.describeDefinition(item || {});
    }
    return item.category || '—';
  }

  function renderPriceList(){
    const container = ctx.byId('priceListItems');
    if(!container) return;
    const kind = ctx.currentListKind();
    const oldQuickFilters = document.getElementById('hardwareQuickFilters');
    if(kind !== 'accessories' && oldQuickFilters) oldQuickFilters.remove();
    const filtered = ctx.filteredPriceList();
    container.innerHTML = '';
    if(kind === 'accessories' && ctx.renderHardwareQuickFilters) ctx.renderHardwareQuickFilters();
    if(!filtered.length){
      container.innerHTML = '<div class="muted" style="padding:10px">Brak pozycji dla aktualnych filtrów.</div>';
      return;
    }
    filtered.forEach((item)=>{
      if(kind === 'accessories' && ctx.renderHardwareAccessoryRow){
        container.appendChild(ctx.renderHardwareAccessoryRow(item || {}, ()=> ctx.openPriceItemModal(item.id)));
        return;
      }
      const row = document.createElement('div'); row.className = 'list-item price-modal-list-row';
      const left = document.createElement('div'); left.className = 'price-modal-list-main'; left.style.minWidth = '0';
      left.innerHTML = `<div style="font-weight:900">${item && item.name ? item.name : '—'} ${starterBadge(item || {})}</div><div class="muted-tag xs">${itemMeta(kind, item || {})}</div>`;
      const right = document.createElement('div'); right.className = 'price-modal-list-actions';
      const price = document.createElement('div'); price.className = 'price-modal-list-price';
      if(kind === 'quoteRates' && window.FC && window.FC.laborCatalog && window.FC.laborCatalog.isHourlyRateDefinition && window.FC.laborCatalog.isHourlyRateDefinition(item || {})) price.textContent = (Number(item && item.price) || 0).toFixed(2) + ' PLN/h';
      else if(kind === 'quoteRates' && (Number(item && item.price) || 0) <= 0) price.textContent = 'reguła';
      else if(kind === 'accessories') price.textContent = (Number(item && item.price) || 0).toFixed(2) + ' PLN/' + String(item && item.hardwareUnit || 'szt.');
      else if(kind === 'materials') price.textContent = (Number(item && item.price) || 0).toFixed(2) + ' PLN/' + unitLabel(item && item.priceUnit);
      else price.textContent = (Number(item && item.price) || 0).toFixed(2) + ' PLN';
      const editBtn = document.createElement('button'); editBtn.className = 'btn'; editBtn.type = 'button'; editBtn.textContent = 'Edytuj';
      right.appendChild(price); right.appendChild(editBtn);
      row.appendChild(left); row.appendChild(right); container.appendChild(row);
      editBtn.addEventListener('click', ()=> ctx.openPriceItemModal(item.id));
    });
  }

  Object.assign(ctx, { renderPriceList });
})();
