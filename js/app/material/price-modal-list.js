// js/app/material/price-modal-list.js
// Render listy pozycji aktualnego katalogu/cennika.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const ctx = window.FC.priceModalContext || {};

  function itemMeta(kind, item){
    if(kind === 'materials') return ((item.materialType || '—') + ' • ' + (item.manufacturer || '—') + (item.symbol ? ' • SYM: ' + item.symbol : '') + (item.hasGrain ? ' • 🌾 słoje' : ''));
    if(kind === 'accessories') return ((item.manufacturer || '—') + (item.symbol ? ' • SYM: ' + item.symbol : ''));
    return item.category || '—';
  }

  function renderPriceList(){
    const container = ctx.byId('priceListItems');
    if(!container) return;
    const kind = ctx.currentListKind();
    const filtered = ctx.filteredPriceList();
    container.innerHTML = '';
    if(!filtered.length){
      container.innerHTML = '<div class="muted" style="padding:10px">Brak pozycji dla aktualnych filtrów.</div>';
      return;
    }
    filtered.forEach((item)=>{
      const row = document.createElement('div'); row.className = 'list-item price-modal-list-row';
      const left = document.createElement('div'); left.className = 'price-modal-list-main'; left.style.minWidth = '0';
      left.innerHTML = `<div style="font-weight:900">${item && item.name ? item.name : '—'}</div><div class="muted-tag xs">${itemMeta(kind, item || {})}</div>`;
      const right = document.createElement('div'); right.className = 'price-modal-list-actions';
      const price = document.createElement('div'); price.className = 'price-modal-list-price'; price.textContent = (Number(item && item.price) || 0).toFixed(2) + ' PLN';
      const editBtn = document.createElement('button'); editBtn.className = 'btn'; editBtn.type = 'button'; editBtn.textContent = 'Edytuj';
      right.appendChild(price); right.appendChild(editBtn);
      row.appendChild(left); row.appendChild(right); container.appendChild(row);
      editBtn.addEventListener('click', ()=> ctx.openPriceItemModal(item.id));
    });
  }

  Object.assign(ctx, { renderPriceList });
})();
