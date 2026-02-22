/* failsafe_ui.js — v4 (fix for "open then instantly close" on fast tap)
   Root cause: opening on pointerdown before finger is lifted -> finger-up lands on modal close button.
   Fix:
   - CLOSE handled on pointerdown (early)
   - OPEN handled ONLY on click (after release)
   - short lock after OPEN to ignore CLOSE for a moment
   - stopImmediatePropagation to beat other listeners
   - ?reset=1 escape hatch
*/
(() => {
  'use strict';

  const UI_KEY = 'fc_ui_v1';
  const OPEN_CLOSE_LOCK_MS = 600;
  let openLockUntil = 0;

  function getJSON(key, fallback){
    try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch{ return fallback; }
  }
  function setJSON(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch{}
  }
  function el(id){ return document.getElementById(id); }
  function hide(id){ const x = el(id); if(x) x.style.display = 'none'; }
  function showFlex(id){ const x = el(id); if(x) x.style.display = 'flex'; }

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

  function hardStop(e){
    try{ e.preventDefault(); }catch{}
    try{ e.stopPropagation(); }catch{}
    try{ e.stopImmediatePropagation(); }catch{}
  }

  function isCloseButton(btn){
    if (!btn) return false;
    if (btn.id === 'closePriceModal' || btn.id === 'closeCabinetModal') return true;
    const txt = (btn.textContent || '').trim().toLowerCase();
    return txt === 'zamknij' || txt === 'close';
  }

  function closePrice(){
    if (Date.now() < openLockUntil) return; // ignore close right after open
    if (window.FC && typeof window.FC.closePriceModalSafe === 'function') window.FC.closePriceModalSafe();
    else { hide('priceModal'); clearStickyUI(); }
  }

  function closeCabinet(){
    if (Date.now() < openLockUntil) return;
    if (window.FC && typeof window.FC.closeCabinetModalSafe === 'function') window.FC.closeCabinetModalSafe();
    else { hide('cabinetModal'); clearStickyUI(); }
  }

  function openPrice(type){
    openLockUntil = Date.now() + OPEN_CLOSE_LOCK_MS;
    if (window.FC && typeof window.FC.openPriceListSafe === 'function') window.FC.openPriceListSafe(type);
    else {
      try{
        const ui = getJSON(UI_KEY, {}) || {};
        ui.showPriceList = type;
        setJSON(UI_KEY, ui);
      }catch(_){}
      showFlex('priceModal');
    }
  }

  // === pointerdown: CLOSE only (prevents accidental open->close on tap) ===
  function onPointerDown(e){
    try{
      const t = e.target;
      if(!t || !t.closest) return;
      const btn = t.closest('button, [role="button"]');
      if(btn && isCloseButton(btn)){
        hardStop(e);
        if (btn.id === 'closePriceModal') closePrice();
        else if (btn.id === 'closeCabinetModal') closeCabinet();
        else {
          // fallback: close visible modals
          const pm = el('priceModal');
          const cm = el('cabinetModal');
          if(pm && getComputedStyle(pm).display !== 'none') closePrice();
          if(cm && getComputedStyle(cm).display !== 'none') closeCabinet();
        }
      }
    }catch(_){}
  }

  // === click: OPEN (after release) + PLUS ===
  function onClick(e){
    try{
      const t = e.target;
      if(!t || !t.closest) return;

      // OPEN price lists
      if (t.closest('#openMaterialsBtn')) { hardStop(e); openPrice('materials'); return; }
      if (t.closest('#openServicesBtn'))  { hardStop(e); openPrice('services');  return; }

      // PLUS
      if (t.closest('#floatingAdd')) {
        hardStop(e);
        if (window.FC && typeof window.FC.addCabinetSafe === 'function') window.FC.addCabinetSafe();
        else if (window.FC && typeof window.FC.addCabinet === 'function') window.FC.addCabinet();
        return;
      }

      // If user clicks explicit close on click, allow it too (but lock will ignore if too fast)
      if (t.closest('#closePriceModal')) { hardStop(e); closePrice(); return; }
      if (t.closest('#closeCabinetModal')) { hardStop(e); closeCabinet(); return; }
    }catch(_){}
  }

  document.addEventListener('pointerdown', onPointerDown, { capture:true, passive:false });
  document.addEventListener('click', onClick, { capture:true, passive:false });
})();