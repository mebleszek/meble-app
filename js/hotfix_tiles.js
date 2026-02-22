/* hotfix_tiles.js — SAFE emergency delegation (no crashes)
   - does NOT run if main delegation is active (__FC_DELEGATION__ === true)
   - never throws (wraps handler in try/catch)
*/
(() => {
  'use strict';

  function isOn() { return window.__FC_DELEGATION__ === true; }

  function safeCall(fn, ...args) {
    try { return typeof fn === 'function' ? fn(...args) : undefined; } catch { return undefined; }
  }

  function activate() {
    if (isOn() || window.__HOTFIX_DELEGATION__ === true) return;
    window.__HOTFIX_DELEGATION__ = true;

    const handler = (e) => {
      try {
        const t = e.target; // IMPORTANT: define before any closest()
        if (!t || !t.closest) return;

        // Rooms
        const roomEl = t.closest('.room-btn[data-room], [data-action="open-room"][data-room]');
        if (roomEl) {
          const room = roomEl.getAttribute('data-room');
          if (room) {
            // Prefer official API if present
            if (window.FC && typeof window.FC.openRoom === 'function') return window.FC.openRoom(room);
            if (window.FC && typeof window.FC.openRoomSafe === 'function') return window.FC.openRoomSafe(room);
            // Fallback: trigger original click (if any)
            safeCall(roomEl.click?.bind(roomEl));
          }
          return;
        }

        // Tabs
        const tabEl = t.closest('.tab-btn[data-tab], [data-action="tab"][data-tab]');
        if (tabEl) {
          const tab = tabEl.getAttribute('data-tab');
          if (tab) {
            if (window.FC && typeof window.FC.setActiveTabSafe === 'function') return window.FC.setActiveTabSafe(tab);
            // fallback: click
            safeCall(tabEl.click?.bind(tabEl));
          }
          return;
        }

        // Price buttons
        const matBtn = t.closest('#openMaterialsBtn,[data-action="open-materials"]');
        if (matBtn) {
          if (window.FC && typeof window.FC.openPriceListSafe === 'function') return window.FC.openPriceListSafe('materials');
          safeCall(matBtn.click?.bind(matBtn));
          return;
        }
        const srvBtn = t.closest('#openServicesBtn,[data-action="open-services"]');
        if (srvBtn) {
          if (window.FC && typeof window.FC.openPriceListSafe === 'function') return window.FC.openPriceListSafe('services');
          safeCall(srvBtn.click?.bind(srvBtn));
          return;
        }

        // Close buttons
        const closeBtn = t.closest('#closePriceModal,#closeCabinetModal,[data-action="close"],.close-btn');
        if (closeBtn) {
          if (closeBtn.id === 'closePriceModal' && window.FC && typeof window.FC.closePriceModalSafe === 'function') {
            return window.FC.closePriceModalSafe();
          }
          if (closeBtn.id === 'closeCabinetModal' && window.FC && typeof window.FC.closeCabinetModalSafe === 'function') {
            return window.FC.closeCabinetModalSafe();
          }
          safeCall(closeBtn.click?.bind(closeBtn));
          return;
        }

        // Floating add (+)
        const plus = t.closest('#floatingAdd,[data-action="add"]');
        if (plus) {
          if (window.FC && typeof window.FC.addCabinetSafe === 'function') return window.FC.addCabinetSafe();
          safeCall(plus.click?.bind(plus));
          return;
        }
      } catch {
        // Never crash the app
      }
    };

    document.addEventListener('pointerup', handler, { capture: true });
    document.addEventListener('click', handler, { capture: true });
  }

  // activate only if main delegation doesn't come up quickly
  setTimeout(activate, 700);
})();