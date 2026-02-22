/* failsafe_ui.js — critical buttons always work (capture)
   Purpose: prevent "podświetla się ale nic" when init/binds break.
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

  function hide(id){ const el = document.getElementById(id); if(el) el.style.display = 'none'; }
  function showFlex(id){ const el = document.getElementById(id); if(el) el.style.display = 'flex'; }

  function forceClosePrice(){
    hide('priceModal');
    const ui = getJSON(UI_KEY, {}) || {};
    ui.showPriceList = null;
    ui.editingId = null;
    setJSON(UI_KEY, ui);
  }
  function forceCloseCabinet(){
    hide('cabinetModal');
    const ui = getJSON(UI_KEY, {}) || {};
    ui.editingCabinetId = null;
    setJSON(UI_KEY, ui);
  }

  // Escape hatch: add ?reset=1 to URL to exit stuck modals
  if (location.search.includes('reset=1')) {
    forceClosePrice();
    forceCloseCabinet();
  }

  function on(e){
    try{
      const t = e.target;
      if(!t || !t.closest) return;

      // Open price lists
      if (t.closest('#openMaterialsBtn')) {
        if (window.FC && typeof window.FC.openPriceListSafe === 'function') window.FC.openPriceListSafe('materials');
        else showFlex('priceModal');
        return;
      }
      if (t.closest('#openServicesBtn')) {
        if (window.FC && typeof window.FC.openPriceListSafe === 'function') window.FC.openPriceListSafe('services');
        else showFlex('priceModal');
        return;
      }

      // Close price modal
      if (t.closest('#closePriceModal')) {
        if (window.FC && typeof window.FC.closePriceModalSafe === 'function') window.FC.closePriceModalSafe();
        else forceClosePrice();
        return;
      }

      // Floating add (+)
      if (t.closest('#floatingAdd')) {
        if (window.FC && typeof window.FC.addCabinetSafe === 'function') window.FC.addCabinetSafe();
        else if (window.FC && typeof window.FC.addCabinet === 'function') window.FC.addCabinet();
        return;
      }

      // Close cabinet modal
      if (t.closest('#closeCabinetModal')) {
        if (window.FC && typeof window.FC.closeCabinetModalSafe === 'function') window.FC.closeCabinetModalSafe();
        else forceCloseCabinet();
        return;
      }
    }catch(_){}
  }

  document.addEventListener('pointerup', on, { capture:true });
  document.addEventListener('click', on, { capture:true });
})();