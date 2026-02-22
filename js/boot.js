/* boot.js — ERROR BANNER ONLY (no forced init) */
(() => {
  'use strict';

  const BOOT_VERSION = 'boot-lite-1.0';

  // ---------- Banner UI (error only) ----------
  let bannerEl = null;
  function ensureBanner() {
    if (bannerEl) return bannerEl;
    bannerEl = document.createElement('div');
    bannerEl.id = 'app-error-banner';
    bannerEl.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'right:0',
      'z-index:99999',
      'background:#b00020',
      'color:#fff',
      'font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif',
      'padding:10px 12px',
      'box-shadow:0 2px 10px rgba(0,0,0,.25)',
      'display:none'
    ].join(';');

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;align-items:flex-start;';

    const msg = document.createElement('div');
    msg.id = 'app-error-msg';
    msg.style.cssText = 'flex:1;white-space:pre-wrap;word-break:break-word;';

    const btnCopy = document.createElement('button');
    btnCopy.textContent = 'Kopiuj błąd';
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

  // NOTE: We do NOT call any init function here.
  // Your app.js can auto-start as it did before; this file only reports errors.
})();
