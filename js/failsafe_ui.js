/* failsafe_ui.js — v5
   Fixes:
   - Back button stopped: caused by global tap_guard cancelling click. (Remove tap_guard from index.html)
   - Cennik opens then instantly closes: prevents "release lands on close" by locking close for a moment
     and stopping propagation on close events during lock.
   Behavior:
   - OPEN cenniki on click (after release)
   - CLOSE buttons handled only inside modals, with lock after open
   - Does NOT touch other buttons (like Back).
   - ?reset=1 closes modals + clears sticky storage.
*/
(() => {
  'use strict';

  const UI_KEY = 'fc_ui_v1';
  const LOCK_MS = 700;
  let lockUntil = 0;

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

  function openPrice(type){
    lockUntil = Date.now() + LOCK_MS;
    if (window.FC && typeof window.FC.openPriceListSafe === 'function') {
      window.FC.openPriceListSafe(type);
      return;
    }
    // fallback
    const ui = getJSON(UI_KEY, {}) || {};
    ui.showPriceList = type;
    setJSON(UI_KEY, ui);
    showFlex('priceModal');
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

  // 1) OPEN buttons on click (after release)
  function onClick(e){
    const t = e.target;
    if(!t || !t.closest) return;

    if (t.closest('#openMaterialsBtn')) { hardStop(e); openPrice('materials'); return; }
    if (t.closest('#openServicesBtn'))  { hardStop(e); openPrice('services');  return; }

    if (t.closest('#floatingAdd')) {
      // do not interfere with back button; only plus
      hardStop(e);
      if (window.FC && typeof window.FC.addCabinetSafe === 'function') window.FC.addCabinetSafe();
      else if (window.FC && typeof window.FC.addCabinet === 'function') window.FC.addCabinet();
      return;
    }
  }

  // 2) CLOSE buttons inside modals — capture pointerup + click (so we can block during lock)
  function onCloseEvent(e){
    const t = e.target;
    if(!t || !t.closest) return;

    const priceModal = el('priceModal');
    const cabinetModal = el('cabinetModal');

    // price modal close
    if (priceModal && getComputedStyle(priceModal).display !== 'none') {
      if (t.closest('#closePriceModal')) { closePrice(e); return; }
      const btn = t.closest('button');
      if (btn) {
        const txt = (btn.textContent || '').trim().toLowerCase();
        if (txt === 'zamknij' || txt === 'close') { closePrice(e); return; }
      }
    }

    // cabinet modal close
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