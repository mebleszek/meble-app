/* hotfix_tiles.js — emergency tile/tab delegation for mobile
   If main delegation fails, this ensures room tiles and tabs still work.
   Prefers using FC.openRoom / FC.setActiveTabSafe when available.
*/
(() => {
  'use strict';

  function bind() {
    if (window.__HOTFIX_DELEGATION__) return;
    // If main delegation is already active, we do nothing.
    if (window.__FC_DELEGATION__) return;

    window.__HOTFIX_DELEGATION__ = true;

    const handler = (e) => {
      const t = e.target;

      const roomEl = t.closest('.room-btn[data-room], [data-action="open-room"][data-room]');
      if (roomEl) {
        const room = roomEl.getAttribute('data-room');
        if (room) {
          if (window.FC && typeof window.FC.openRoom === 'function') {
            window.FC.openRoom(room);
          } else {
            // fallback: minimal view switch
            try {
              const rv = document.getElementById('roomsView');
              const av = document.getElementById('appView');
              const tabs = document.getElementById('topTabs');
              if (rv) rv.style.display='none';
              if (av) av.style.display='block';
              if (tabs) tabs.style.display='inline-block';
            } catch {}
          }
        }
        return;
      }

      const tabEl = t.closest('.tab-btn[data-tab], [data-action="tab"][data-tab]');
      if (tabEl) {
        const tab = tabEl.getAttribute('data-tab');
        if (tab) {
          if (window.FC && typeof window.FC.setActiveTabSafe === 'function') {
            window.FC.setActiveTabSafe(tab);
          }
        }
        return;
      }
    };

    // capture to avoid overlays swallowing bubbling click
    document.addEventListener('pointerup', handler, { capture: true });
    document.addEventListener('click', handler, { capture: true });
  }

  setTimeout(bind, 800);
})();
