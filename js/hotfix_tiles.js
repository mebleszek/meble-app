/* hotfix_tiles.js — emergency tile/tab delegation for mobile
   Activates ONLY if main delegation is missing after 800ms.
*/
(() => {
  'use strict';

  const STORAGE_UI_KEY = 'fc_ui_v1';

  function getJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  function setJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function show(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = on ? 'block' : 'none';
  }

  function showInline(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = on ? 'inline-block' : 'none';
  }

  function activateRoom(roomType) {
    const ui = getJSON(STORAGE_UI_KEY, {}) || {};
    ui.roomType = roomType;
    ui.selectedCabinetId = null;
    ui.activeTab = ui.activeTab || 'wywiad';
    setJSON(STORAGE_UI_KEY, ui);

    // Switch views
    show('roomsView', false);
    show('appView', true);
    showInline('topTabs', true);

    // Try to set tab button highlight if present
    try {
      document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
        const isActive = btn.getAttribute('data-tab') === ui.activeTab;
        btn.style.background = isActive ? '#e6f7ff' : 'var(--card)';
      });
    } catch {}

    // Scroll to top
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { window.scrollTo(0, 0); }
  }

  function setActiveTab(tab) {
    const ui = getJSON(STORAGE_UI_KEY, {}) || {};
    ui.activeTab = tab;
    setJSON(STORAGE_UI_KEY, ui);

    try {
      document.querySelectorAll('.tab-section').forEach(sec => sec.classList.remove('active'));
      const sec = document.getElementById(`tab-${tab}`);
      if (sec) sec.classList.add('active');
      document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
        const isActive = btn.getAttribute('data-tab') === tab;
        btn.style.background = isActive ? '#e6f7ff' : 'var(--card)';
      });
    } catch {}
  }

  function bind() {
    if (window.__FC_DELEGATION__ || window.__HOTFIX_DELEGATION__) return;
    window.__HOTFIX_DELEGATION__ = true;

    const handler = (e) => {
      const t = e.target;
      const roomEl = t.closest('.room-btn[data-room], [data-action="open-room"][data-room]');
      if (roomEl) {
        const room = roomEl.getAttribute('data-room');
        if (room) activateRoom(room);
        return;
      }
      const tabEl = t.closest('.tab-btn[data-tab], [data-action="tab"][data-tab]');
      if (tabEl) {
        const tab = tabEl.getAttribute('data-tab');
        if (tab) setActiveTab(tab);
        return;
      }
    };

    document.addEventListener('pointerup', handler, { capture: true });
    document.addEventListener('click', handler, { capture: true });
  }

  setTimeout(bind, 800);
})();
