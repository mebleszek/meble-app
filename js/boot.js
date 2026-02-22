/* boot.js — SAFE START + ERROR/WARN BANNER (always on) */
(() => {
  'use strict';

  const BOOT_VERSION = 'boot-2.0';

  // ---------- Banner UI ----------
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
    el.style.background = (type === 'warn') ? '#b45309' : '#b00020';
    el.querySelector('#app-banner-msg').textContent = text;
    el.style.display = 'block';
  }
  const showError = (t) => showBanner('error', t);
  const showWarn  = (t) => showBanner('warn',  t);

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

  // ---------- DOM contract (non-blocking) ----------
  function validateDomContract() {
    const req = window.APP_REQUIRED_SELECTORS;
    if (!Array.isArray(req) || req.length === 0) return;
    const missing = req.filter(sel => !document.querySelector(sel));
    if (missing.length) {
      showWarn(
        '⚠️ Brakuje elementów HTML wymaganych przez JS (apka może działać źle):\n' +
        missing.map(s => `- ${s}`).join('\n') +
        '\n\nTo jest zabezpieczenie po zmianach w HTML.'
      );
    }
  }

  // ---------- Safe init ----------
  function initOnce() {
    if (window.__APP_STARTED__) return;
    window.__APP_STARTED__ = true;

    try {
      validateDomContract();

      // Prefer App.init / FC.init (provided by app.js patch)
      if (window.App && typeof window.App.init === 'function') {
        window.App.init();
      } else if (window.FC && typeof window.FC.init === 'function') {
        window.FC.init();
      } else {
        // Last resort: do nothing, but warn. We don't want to break apps that self-start.
        showWarn(
          '⚠️ Boot: nie znaleziono funkcji startowej (App.init / FC.init).\n' +
          'Jeśli aplikacja działa mimo tego — OK. Jeśli nie działa — daj mi znać.'
        );
      }
    } catch (err) {
      showError('❌ Błąd podczas startu aplikacji:\n' + (err?.stack || String(err)));
    }

    // Watchdog: if app didn't set init-done flag, retry once (mobile can drop listeners)
    setTimeout(() => {
      try {
        if (!window.__APP_INIT_DONE__) {
          if (window.App && typeof window.App.init === 'function') window.App.init();
          else if (window.FC && typeof window.FC.init === 'function') window.FC.init();
        }
      } catch (e) {}
    }, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOnce, { once: true });
  } else {
    setTimeout(initOnce, 0);
  }
})();
