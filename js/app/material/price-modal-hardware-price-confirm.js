// js/app/material/price-modal-hardware-price-confirm.js
// Świadome potwierdzanie nowych i aktualizowanych cen dostawców podczas importu XLSX.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function h(tag, props, children){
    const el = document.createElement(tag);
    Object.keys(props || {}).forEach((key)=>{
      const value = props[key];
      if(key === 'class') el.className = value;
      else if(key === 'text') el.textContent = value;
      else if(key === 'html') el.innerHTML = value;
      else if(key === 'style') el.setAttribute('style', value);
      else if(key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else if(value !== false && value != null) el.setAttribute(key, value === true ? '' : String(value));
    });
    (Array.isArray(children) ? children : (children ? [children] : [])).forEach((child)=> el.appendChild(child));
    return el;
  }
  function text(value){ return String(value == null ? '' : value).trim(); }
  function number(value){ const n = Number(String(value == null ? '' : value).replace(',', '.').replace(/\s+/g, '')); return Number.isFinite(n) ? n : 0; }
  function money(value){ return `${number(value).toFixed(2)} PLN`; }
  function priceLine(price){
    if(!price) return '—';
    const parts = [`${money(price.catalogPriceNet)} netto`, `${money(price.catalogPriceGross)} brutto`];
    if(text(price.priceDate)) parts.push(`data: ${text(price.priceDate)}`);
    if(text(price.priceStatus)) parts.push(`status: ${text(price.priceStatus)}`);
    parts.push(`Do wyceny: ${price.useForQuote ? 'TAK' : 'NIE'}`);
    return parts.join(' • ');
  }
  function changesOf(plan){
    const list = plan && plan.summary && Array.isArray(plan.summary.supplierPriceChanges) ? plan.summary.supplierPriceChanges : [];
    return list.filter((row)=> row && (row.action === 'added' || row.action === 'updated'));
  }
  function actionTitle(action){
    if(action.action === 'updated') return `Zaktualizować cenę dostawcy ${action.supplierName || action.supplierId}?`;
    return `Dodać nową cenę dla dostawcy ${action.supplierName || action.supplierId}?`;
  }
  function confirmText(action){ return action.action === 'updated' ? 'Zaktualizuj' : 'Dodaj cenę'; }
  function confirmAllText(action){ return action.action === 'updated' ? 'Zaktualizuj wszystkie aktualizacje' : 'Dodaj wszystkie nowe ceny'; }
  function skipText(action){ return action.action === 'updated' ? 'Zostaw starą' : 'Ignoruj'; }
  function skipAllText(action){ return action.action === 'updated' ? 'Zostaw wszystkie stare' : 'Ignoruj wszystkie nowe'; }
  function doneText(action){ return action.action === 'updated' ? 'Zaktualizowano' : 'Dodano'; }
  function skippedText(action){ return action.action === 'updated' ? 'Zostawiono starą' : 'Pominięto'; }
  function countByAction(changes, actionName){ return (changes || []).filter((row)=> row && row.action === actionName).length; }
  function markSkipped(action){ if(action && action.rawRow) action.rawRow.__skipImport = true; }
  function animateButton(btn, label, fn){
    if(!btn) { fn(); return; }
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = label;
    setTimeout(()=>{ try{ btn.textContent = old; btn.disabled = false; }catch(_){ } fn(); }, 180);
  }
  function detailTile(label, value, extraClass){
    const tile = h('div', { class:'list-item' + (extraClass ? ' ' + extraClass : ''), style:'display:block;padding:10px' });
    tile.appendChild(h('div', { class:'muted-tag xs', text:label }));
    tile.appendChild(h('div', { style:'font-weight:900;white-space:pre-wrap', text:text(value) || '—' }));
    return tile;
  }
  function renderActionDetails(action){
    const box = h('div', { class:'card', style:'padding:10px;margin:10px 0;display:grid;gap:8px' });
    const grid = h('div', { class:'grid-2', style:'gap:8px' });
    grid.appendChild(detailTile('Okucie', action.itemName));
    grid.appendChild(detailTile('Producent / symbol', `${action.itemManufacturer || '—'} • ${action.itemSymbol || '—'}`));
    grid.appendChild(detailTile('Dostawca', action.supplierName || action.supplierId));
    grid.appendChild(detailTile('Wiersz Excela', action.rowIndex || '—'));
    box.appendChild(grid);
    if(action.action === 'updated') box.appendChild(detailTile('Stara cena', priceLine(action.oldPrice)));
    box.appendChild(detailTile(action.action === 'updated' ? 'Nowa cena' : 'Cena do dodania', priceLine(action.newPrice)));
    if(action.affectsQuote){
      box.appendChild(h('div', { style:'color:#a40000;font-weight:900;white-space:pre-wrap', text:'Ta cena jest oznaczona jako Do wyceny albo zastępuje cenę używaną do wyceny. Zmiana wpłynie na przyszłe wyceny.' }));
    }
    return box;
  }
  function rebuildPlan(api, data, mode){ return api.buildImportPlan(data, { mode:mode === 'replace' ? 'replace' : 'merge' }); }

  function confirmSupplierPriceChanges(plan, data, cfg){
    cfg = cfg || {};
    const api = cfg.api || FC.hardwareCatalogImportExport;
    const mount = cfg.mount;
    const mode = cfg.mode || 'merge';
    if(!(api && typeof api.buildImportPlan === 'function') || !mount) return Promise.resolve(plan);
    let currentPlan = plan;
    let pending = changesOf(currentPlan);
    if(!pending.length) return Promise.resolve(plan);
    return new Promise((resolve)=>{
      let index = 0;
      const finishIfDone = ()=>{
        if(pending.length) return false;
        try{ currentPlan = rebuildPlan(api, data, mode); }catch(_){ }
        resolve(currentPlan);
        return true;
      };
      const rerenderAfterSkip = ()=>{
        try{ currentPlan = rebuildPlan(api, data, mode); }
        catch(error){ resolve(null); return; }
        pending = changesOf(currentPlan);
        index = 0;
        if(!finishIfDone()) render();
      };
      const acceptOne = ()=>{
        pending.splice(index, 1);
        if(index >= pending.length) index = 0;
        if(!finishIfDone()) render();
      };
      const acceptAllSame = (actionName)=>{
        pending = pending.filter((row)=> row.action !== actionName);
        index = 0;
        if(!finishIfDone()) render();
      };
      const skipOne = (action)=>{ markSkipped(action); rerenderAfterSkip(); };
      const skipAllSame = (actionName)=>{ pending.filter((row)=> row.action === actionName).forEach(markSkipped); rerenderAfterSkip(); };
      const render = ()=>{
        if(!pending.length){ finishIfDone(); return; }
        const action = pending[Math.min(index, pending.length - 1)];
        mount.innerHTML = '';
        const box = h('div', { class:'card', style:'padding:12px;margin-bottom:10px' });
        box.appendChild(h('div', { style:'font-weight:900;font-size:18px;margin-bottom:4px', text:actionTitle(action) }));
        box.appendChild(h('div', { class:'muted-tag xs', text:`Zmiana ${Math.min(index + 1, pending.length)} z ${pending.length}. Nowe ceny: ${countByAction(pending, 'added')}, aktualizacje: ${countByAction(pending, 'updated')}.` }));
        box.appendChild(renderActionDetails(action));
        const actions = h('div', { style:'display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:12px' });
        const backBtn = h('button', { type:'button', class:'btn', text:'Wróć do podglądu' });
        const skipBtn = h('button', { type:'button', class:'btn btn-danger', text:skipText(action) });
        const skipAllBtn = h('button', { type:'button', class:'btn btn-danger', text:skipAllText(action) });
        const allBtn = h('button', { type:'button', class:'btn btn-success', text:confirmAllText(action) });
        const confirmBtn = h('button', { type:'button', class:'btn btn-success', text:confirmText(action) });
        backBtn.addEventListener('click', ()=>{ if(typeof cfg.onBack === 'function') cfg.onBack(); resolve(null); });
        skipBtn.addEventListener('click', ()=> animateButton(skipBtn, skippedText(action), ()=> skipOne(action)));
        skipAllBtn.addEventListener('click', ()=> animateButton(skipAllBtn, skippedText(action), ()=> skipAllSame(action.action)));
        allBtn.addEventListener('click', ()=> animateButton(allBtn, doneText(action), ()=> acceptAllSame(action.action)));
        confirmBtn.addEventListener('click', ()=> animateButton(confirmBtn, doneText(action), acceptOne));
        actions.appendChild(backBtn);
        actions.appendChild(skipBtn);
        actions.appendChild(skipAllBtn);
        actions.appendChild(allBtn);
        actions.appendChild(confirmBtn);
        box.appendChild(actions);
        mount.appendChild(box);
      };
      render();
    });
  }

  FC.priceModalHardwarePriceConfirm = { confirmSupplierPriceChanges, _debug:{ changesOf, priceLine } };
})();
