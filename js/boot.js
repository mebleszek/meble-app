/* boot.js — SAFE BOOT + ERROR BANNER (always on) */
(() => {
  'use strict';

  // === Version marker (change on each update) ===
  const BOOT_VERSION = 'boot-1.1';

  // ---------- Banner UI (error + warning) ----------
  let bannerEl = null;
  function ensureBanner() {
    if (bannerEl) return bannerEl;
    bannerEl = document.createElement('div');
    bannerEl.id = 'app-banner';
    bannerEl.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'right:0',
      'z-index:99999',
      'color:#fff',
      'font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif',
      'padding:10px 12px',
      'box-shadow:0 2px 10px rgba(0,0,0,.25)',
      'display:none'
    ].join(';');

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;align-items:flex-start;';

    const msg = document.createElement('div');
    msg.id = 'app-banner-msg';
    msg.style.cssText = 'flex:1;white-space:pre-wrap;word-break:break-word;';

    const btnCopy = document.createElement('button');
    btnCopy.textContent = 'Kopiuj';
    btnCopy.type = 'button';
    btnCopy.style.cssText = [
      'border:0',
      'background:rgba(255,255,255,.18)',
      'color:#fff',
      'padding:6px 10px',
      'border-radius:8px',
      'cursor:pointer'
    ].join(';');

    const btnClose = document.createElement('button');
    btnClose.textContent = 'X';
    btnClose.type = 'button';
    btnClose.style.cssText = [
      'border:0',
      'background:rgba(255,255,255,.18)',
      'color:#fff',
      'padding:6px 10px',
      'border-radius:8px',
      'cursor:pointer'
    ].join(';');

    btnClose.onclick = () => { bannerEl.style.display = 'none'; };

    btnCopy.onclick = async () => {
      const text = msg.textContent || '';
      try {
        await navigator.clipboard.writeText(text);
        btnCopy.textContent = 'Skopiowano';
        setTimeout(() => (btnCopy.textContent = 'Kopiuj'), 1200);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch {}
        document.body.removeChild(ta);
        btnCopy.textContent = 'Skopiowano';
        setTimeout(() => (btnCopy.textContent = 'Kopiuj'), 1200);
      }
    };

    row.appendChild(msg);
    row.appendChild(btnCopy);
    row.appendChild(btnClose);
    bannerEl.appendChild(row);
    document.documentElement.appendChild(bannerEl);
    return bannerEl;
  }

  function showBanner(type, text) {
    const el = ensureBanner();
    // type: 'error' | 'warn'
    el.style.background = (type === 'warn') ? '#b45309' : '#b00020';
    el.querySelector('#app-banner-msg').textContent = text;
    el.style.display = 'block';
  }

  function showError(text) { showBanner('error', text); }
  function showWarn(text)  { showBanner('warn',  text); }

  // ---------- Global error hooks ----------
  window.addEventListener('error', (e) => {
    const err = e.error;
    const details = [
      `❌ Błąd JavaScript (${BOOT_VERSION})`,
      err && err.stack ? err.stack : (e.message || String(e)),
      e.filename ? `Plik: ${e.filename}:${e.lineno || 0}:${e.colno || 0}` : ''
    ].filter(Boolean).join('\n');
    showError(details);
  });

  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    const details = [
      `❌ Nieobsłużona obietnica (Promise) (${BOOT_VERSION})`,
      r && r.stack ? r.stack : String(r)
    ].join('\n');
    showError(details);
  });

  // ---------- DOM contract validation (non-blocking) ----------
  // Optional: define window.APP_REQUIRED_SELECTORS = ['#roomsView', ...] in app.js or index.html
  function validateRequiredSelectors() {
    const req = window.APP_REQUIRED_SELECTORS;
    if (!Array.isArray(req) || req.length === 0) return;
    const missing = req.filter(sel => !document.querySelector(sel));
    if (missing.length) {
      showWarn(
        '⚠️ Brak wymaganych elementów HTML (apka może działać źle):\n' +
        missing.map(s => `- ${s}`).join('\n') +
        '\n\nTo zabezpieczenie — mówi, że po zmianach w HTML JS może nie trafić w selektory.'
      );
    }
  }

  // ---------- Safe init (runs once) ----------
  function runInitOnce() {
    if (window.__APP_STARTED__) return;
    window.__APP_STARTED__ = true;

    try {
      validateRequiredSelectors();

      // Try common entrypoints without assuming your internal structure.
      if (window.App && typeof window.App.init === 'function') {
        window.App.init();
        return;
      }
      if (typeof window.initApp === 'function') {
        window.initApp();
        return;
      }
      if (window.FC && typeof window.FC.init === 'function') {
        window.FC.init();
        return;
      }

      showError(
        '❌ Nie znaleziono funkcji startowej aplikacji.\n' +
        `Boot.js version: ${BOOT_VERSION}\n` +
        'Boot.js szuka: App.init(), initApp(), FC.init().\n' +
        'Dodaj jedną z nich w js/app.js albo powiedz mi jak nazywa się Twoja funkcja startowa.'
      );
    } catch (err) {
      showError('❌ Błąd podczas startu aplikacji:\n' + (err?.stack || String(err)));
    }
  }

  // Run after DOM is ready (extra-safe on mobile)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInitOnce, { once: true });
  } else {
    runInitOnce();
  }
})();
