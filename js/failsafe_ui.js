/* failsafe_ui.js — v3
   - CLOSE has absolute priority
   - uses stopImmediatePropagation to beat other capture listeners
   - adds short lock to ignore "open services/materials" right after close
   - provides ?reset=1 escape hatch
*/
(() => {
  'use strict';

  const UI_KEY = 'fc_ui_v1';
  let closeLockUntil = 0;

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

  function on(e){
    const now = Date.now();
    try{
      const t = e.target;
      if(!t || !t.closest) return;

      // 1) CLOSE — absolute priority
      const btn = t.closest('button, [role="button"]');
      if (btn && isCloseButton(btn)) {
        hardStop(e);
        closeLockUntil = now + 400; // block accidental opens right after close tap

        // Prefer official API if present
        if (btn.id === 'closePriceModal' && window.FC && typeof window.FC.closePriceModalSafe === 'function') {
          window.FC.closePriceModalSafe();
        } else if (btn.id === 'closeCabinetModal' && window.FC && typeof window.FC.closeCabinetModalSafe === 'function') {
          window.FC.closeCabinetModalSafe();
        } else {
          // fallback: hide visible modals and clear sticky
          hide('priceModal');
          hide('cabinetModal');
          clearStickyUI();
        }
        return;
      }

      // 2) If we just closed something, ignore any "open price list" attempts for a moment
      if (now < closeLockUntil) {
        hardStop(e);
        return;
      }

      // 3) OPEN price lists
      if (t.closest('#openMaterialsBtn')) {
        hardStop(e);
        if (window.FC && typeof window.FC.openPriceListSafe === 'function') window.FC.openPriceListSafe('materials');
        else showFlex('priceModal');
        return;
      }
      if (t.closest('#openServicesBtn')) {
        hardStop(e);
        if (window.FC && typeof window.FC.openPriceListSafe === 'function') window.FC.openPriceListSafe('services');
        else showFlex('priceModal');
        return;
      }

      // 4) Floating add (+)
      if (t.closest('#floatingAdd')) {
        hardStop(e);
        if (window.FC && typeof window.FC.addCabinetSafe === 'function') window.FC.addCabinetSafe();
        else if (window.FC && typeof window.FC.addCabinet === 'function') window.FC.addCabinet();
        return;
      }
    }catch(_){}
  }

  // pointerdown is earlier than click/pointerup -> beats many handlers
  document.addEventListener('pointerdown', on, { capture:true });
  document.addEventListener('pointerup', on, { capture:true });
  document.addEventListener('click', on, { capture:true });
})();