/* failsafe_ui.js — v6
   Fixes open->close on same tap by:
   - scheduling OPEN to next tick (setTimeout 0), so "outside-click close" handlers
     from the original click can't immediately close a modal that didn't exist yet.
   - lock window after OPEN, and ignores CLOSE during lock.
   - does not interfere with Back button.
   - ?reset=1 closes modals + clears sticky storage.
*/
(() => {
  'use strict';

  const UI_KEY = 'fc_ui_v1';
  const LOCK_MS = 800;
  let lockUntil = 0;
  let openQueued = false;

  function getJSON(key, fallback){
    try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch{ return fallback; }
  }
  function setJSON(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch{}
  }
  function el(id){ return document.getElementById(id); }
  function hide(id){ const x = el(id); if(x) x.style.display = 'none'; }
  function showFlex(id){ const x = el(id); if(x) x.style.display = 'flex'; }

  function hardStop(e){
    try{ e.preventDefault(); }catch{}
    try{ e.stopPropagation(); }catch{}
    try{ e.stopImmediatePropagation(); }catch{}
  }

  function clearStickyUI(){
    const ui = getJSON(UI_KEY, {}) || {};
    ui.showPriceList = null;
    ui.activePriceTab = null;
    ui.priceListType = null;
    ui.editingId = null;
    ui.editingCabinetId = null;
    setJSON(UI_KEY, ui);
  }

  function forceCloseAll(){
    hide('priceModal');
    hide('cabinetModal');
    clearStickyUI();
  }

  if (location.search.includes('reset=1')) {
    forceCloseAll();
  }

  function doOpenPrice(type){
    lockUntil = Date.now() + LOCK_MS;
    openQueued = false;
    if (window.FC && typeof window.FC.openPriceListSafe === 'function') {
      window.FC.openPriceListSafe(type);
      return;
    }
    const ui = getJSON(UI_KEY, {}) || {};
    ui.showPriceList = type;
    setJSON(UI_KEY, ui);
    showFlex('priceModal');
  }

  function queueOpenPrice(type){
    if (openQueued) return;
    openQueued = true;
    lockUntil = Date.now() + LOCK_MS;
    setTimeout(() => doOpenPrice(type), 0);
  }

  function closePrice(e){
    if (Date.now() < lockUntil) { hardStop(e); return; }
    if (window.FC && typeof window.FC.closePriceModalSafe === 'function') {
      hardStop(e);
      window.FC.closePriceModalSafe();
      return;
    }
    hardStop(e);
    hide('priceModal');
    clearStickyUI();
  }

  function closeCabinet(e){
    if (Date.now() < lockUntil) { hardStop(e); return; }
    if (window.FC && typeof window.FC.closeCabinetModalSafe === 'function') {
      hardStop(e);
      window.FC.closeCabinetModalSafe();
      return;
    }
    hardStop(e);
    hide('cabinetModal');
    clearStickyUI();
  }

  // OPEN buttons on click (after release) — queued to next tick
  function onClick(e){
    const t = e.target;
    if(!t || !t.closest) return;

    if (t.closest('#openMaterialsBtn')) { hardStop(e); queueOpenPrice('materials'); return; }
    if (t.closest('#openServicesBtn'))  { hardStop(e); queueOpenPrice('services');  return; }

    if (t.closest('#floatingAdd')) {
      hardStop(e);
      if (window.FC && typeof window.FC.addCabinetSafe === 'function') window.FC.addCabinetSafe();
      else if (window.FC && typeof window.FC.addCabinet === 'function') window.FC.addCabinet();
      return;
    }
  }

  // CLOSE inside modals — capture pointerup + click to block during lock
  function onCloseEvent(e){
    const t = e.target;
    if(!t || !t.closest) return;

    const priceModal = el('priceModal');
    const cabinetModal = el('cabinetModal');

    if (priceModal && getComputedStyle(priceModal).display !== 'none') {
      if (t.closest('#closePriceModal')) { closePrice(e); return; }
      const btn = t.closest('button');
      if (btn) {
        const txt = (btn.textContent || '').trim().toLowerCase();
        if (txt === 'zamknij' || txt === 'close') { closePrice(e); return; }
      }
    }

    if (cabinetModal && getComputedStyle(cabinetModal).display !== 'none') {
      if (t.closest('#closeCabinetModal')) { closeCabinet(e); return; }
      const btn = t.closest('button');
      if (btn) {
        const txt = (btn.textContent || '').trim().toLowerCase();
        if (txt === 'zamknij' || txt === 'close') { closeCabinet(e); return; }
      }
    }
  }

  document.addEventListener('click', onClick, { capture:true, passive:false });
  document.addEventListener('pointerup', onCloseEvent, { capture:true, passive:false });
  document.addEventListener('click', onCloseEvent, { capture:true, passive:false });
})();