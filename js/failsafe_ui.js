/* failsafe_ui.js — critical close/open always works (capture)
   Fixes "any Zamknij opens services" by:
   - forcing close BEFORE any other action
   - preventing default + stopping propagation
   - clearing sticky UI state in localStorage
   - providing ?reset=1 escape hatch
*/
(() => {
  'use strict';

  const UI_KEY = 'fc_ui_v1';

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
    // clear known sticky flags
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

  // Escape hatch: add ?reset=1 to URL
  if (location.search.includes('reset=1')) {
    forceCloseAll();
  }

  function isVisible(x){
    if(!x) return False;
    const s = getComputedStyle(x);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  }

  function on(e){
    try{
      const t = e.target;
      if(!t || !t.closest) return;

      const priceModal = el('priceModal');
      const cabinetModal = el('cabinetModal');

      // 1) CLOSE buttons — highest priority
      const closeBtn = t.closest('#closePriceModal,#closeCabinetModal,[data-action="close"],.close-btn,button');
      if (closeBtn) {
        const txt = (closeBtn.textContent || '').trim().toLowerCase();
        const isClose = closeBtn.id === 'closePriceModal' || closeBtn.id === 'closeCabinetModal' || txt === 'zamknij' || txt === 'close';
        if (isClose) {
          e.preventDefault(); e.stopPropagation();
          // Prefer official API
          if (closeBtn.id === 'closePriceModal' && window.FC && typeof window.FC.closePriceModalSafe === 'function') {
            window.FC.closePriceModalSafe();
          } else if (closeBtn.id === 'closeCabinetModal' && window.FC && typeof window.FC.closeCabinetModalSafe === 'function') {
            window.FC.closeCabinetModalSafe();
          } else {
            // fallback: hide whichever modal is visible; clear sticky
            if (priceModal && getComputedStyle(priceModal).display !== 'none') hide('priceModal');
            if (cabinetModal && getComputedStyle(cabinetModal).display !== 'none') hide('cabinetModal');
            clearStickyUI();
          }
          return;
        }
      }

      // 2) OPEN price lists (only if not currently trying to close)
      if (t.closest('#openMaterialsBtn')) {
        e.preventDefault(); e.stopPropagation();
        if (window.FC && typeof window.FC.openPriceListSafe === 'function') window.FC.openPriceListSafe('materials');
        else showFlex('priceModal');
        return;
      }
      if (t.closest('#openServicesBtn')) {
        e.preventDefault(); e.stopPropagation();
        if (window.FC && typeof window.FC.openPriceListSafe === 'function') window.FC.openPriceListSafe('services');
        else showFlex('priceModal');
        return;
      }

      // 3) Floating add (+)
      if (t.closest('#floatingAdd')) {
        // don't prevent default; keep normal behavior if exists
        if (window.FC && typeof window.FC.addCabinetSafe === 'function') { e.preventDefault(); e.stopPropagation(); window.FC.addCabinetSafe(); }
        return;
      }
    }catch(_){}
  }

  document.addEventListener('pointerup', on, { capture:true });
  document.addEventListener('click', on, { capture:true });
})();