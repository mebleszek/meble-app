/* boot.js — SAFE START + ERROR BANNER + FORCE HOME ON LOAD
   - forces app to start on the Rooms (home) screen every reload (UI only)
   - then starts the app via FC.init() (or App.init / initApp) exactly once
*/

(() => {
  'use strict';

  const BOOT_VERSION = 'boot-home-1.1';
  const UI_KEY = 'fc_ui_v1';

  // ===== Force home screen on each load (do NOT delete project data) =====
  try {
    const ui = JSON.parse(localStorage.getItem(UI_KEY) || '{}');
    ui.roomType = null;
    ui.selectedCabinetId = null;
    ui.activeTab = 'wywiad';
    ui.showPriceList = null;
    ui.editingId = null;
    ui.editingCabinetId = null;
    localStorage.setItem(UI_KEY, JSON.stringify(ui));
  } catch (_) {}

  // ===== Error banner =====
  let bannerEl = null;
  function ensureBanner() {
    if (bannerEl) return bannerEl;
    bannerEl = document.createElement('div');
    bannerEl.id = 'app-error-banner';
    bannerEl.style.cssText = [
      'position:fixed','top:0','left:0','right:0','z-index:99999',
      'background:#b00020','color:#fff',
      'font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif',
      'padding:10px 12px','box-shadow:0 2px 10px rgba(0,0,0,.25)','display:none'
    ].join(';');

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;align-items:flex-start;';
    const msg = document.createElement('div');
    msg.id = 'app-error-msg';
    msg.style.cssText = 'flex:1;white-space:pre-wrap;word-break:break-word;';

    const btnCopy = document.createElement('button');
    btnCopy.textContent = 'Kopiuj błąd';
    btnCopy.type = 'button';
    btnCopy.style.cssText = 'border:0;background:rgba(255,255,255,.18);color:#fff;padding:6px 10px;border-radius:8px;cursor:pointer';

    const btnClose = document.createElement('button');
    btnClose.textContent = 'X';
    btnClose.type = 'button';
    btnClose.style.cssText = 'border:0;background:rgba(255,255,255,.18);color:#fff;padding:6px 10px;border-radius:8px;cursor:pointer';
    btnClose.onclick = () => { bannerEl.style.display = 'none'; };

    btnCopy.onclick = async () => {
      const text = msg.textContent || '';
      try {
        await navigator.clipboard.writeText(text);
        btnCopy.textContent = 'Skopiowano';
        setTimeout(() => (btnCopy.textContent = 'Kopiuj błąd'), 1200);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch {}
        document.body.removeChild(ta);
        btnCopy.textContent = 'Skopiowano';
        setTimeout(() => (btnCopy.textContent = 'Kopiuj błąd'), 1200);
      }
    };

    row.appendChild(msg);
    row.appendChild(btnCopy);
    row.appendChild(btnClose);
    bannerEl.appendChild(row);
    document.documentElement.appendChild(bannerEl);
    return bannerEl;
  }

  function showErrorBanner(text) {
    const el = ensureBanner();
    el.querySelector('#app-error-msg').textContent = text;
    el.style.display = 'block';
  }

  window.addEventListener('error', (e) => {
    const err = e.error;
    const details = [
      `❌ Błąd JavaScript (${BOOT_VERSION})`,
      err && err.stack ? err.stack : (e.message || String(e)),
      e.filename ? `Plik: ${e.filename}:${e.lineno || 0}:${e.colno || 0}` : ''
    ].filter(Boolean).join('\n');
    showErrorBanner(details);
  });

  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    const details = [
      `❌ Nieobsłużona obietnica (Promise) (${BOOT_VERSION})`,
      r && r.stack ? r.stack : String(r)
    ].join('\n');
    showErrorBanner(details);
  });

  // ===== Start app once =====
  function startOnce() {
    if (window.__APP_STARTED__) return;
    window.__APP_STARTED__ = true;

    try {
      if (window.FC && typeof window.FC.init === 'function') { window.FC.init(); return; }
      if (window.App && typeof window.App.init === 'function') { window.App.init(); return; }
      if (typeof window.initApp === 'function') { window.initApp(); return; }

      showErrorBanner(
        '❌ Nie znaleziono funkcji startowej aplikacji.\n' +
        `Boot.js version: ${BOOT_VERSION}\n` +
        'Szukam: FC.init(), App.init(), initApp().'
      );
    } catch (err) {
      showErrorBanner('❌ Błąd podczas startu aplikacji:\n' + (err?.stack || String(err)));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startOnce, { once: true });
  } else {
    setTimeout(startOnce, 0);
  }
})();