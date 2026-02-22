/* boot.js — SAFE START + ERROR BANNER + INIT (boot-clean-1.0)
   - shows a red banner on JS errors
   - starts the app by calling FC.init() / App.init() / initApp()
   - runs once, waits for app.js to define the entrypoint
*/
(() => {
  'use strict';
  const BOOT_VERSION = 'boot-clean-1.0';

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
      'padding:10px 12px','box-shadow:0 2px 10px rgba(0,0,0,.25)',
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
    btnCopy.style.cssText = 'border:0;background:rgba(255,255,255,.18);color:#fff;padding:6px 10px;border-radius:8px;cursor:pointer;';
    const btnClose = document.createElement('button');
    btnClose.textContent = 'X';
    btnClose.type = 'button';
    btnClose.style.cssText = 'border:0;background:rgba(255,255,255,.18);color:#fff;padding:6px 10px;border-radius:8px;cursor:pointer;';
    btnClose.onclick = () => (bannerEl.style.display = 'none');
    btnCopy.onclick = async () => {
      const text = msg.textContent || '';
      try { await navigator.clipboard.writeText(text); btnCopy.textContent='Skopiowano'; }
      catch {
        const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select();
        try{ document.execCommand('copy'); }catch(_){}
        document.body.removeChild(ta); btnCopy.textContent='Skopiowano';
      }
      setTimeout(()=>btnCopy.textContent='Kopiuj błąd', 1200);
    };
    row.appendChild(msg); row.appendChild(btnCopy); row.appendChild(btnClose);
    bannerEl.appendChild(row);
    document.documentElement.appendChild(bannerEl);
    return bannerEl;
  }
  function showError(text){
    const el = ensureBanner();
    el.querySelector('#app-error-msg').textContent = text;
    el.style.display = 'block';
  }

  window.addEventListener('error', (e) => {
    const err = e.error;
    const details = [
      `❌ Błąd JavaScript (${BOOT_VERSION})`,
      err && err.stack ? err.stack : (e.message || String(e)),
      e.filename ? `Plik: ${e.filename}:${e.lineno||0}:${e.colno||0}` : ''
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

  function findInit(){
    if (window.App && typeof window.App.init === 'function') return window.App.init.bind(window.App);
    if (window.FC && typeof window.FC.init === 'function') return window.FC.init.bind(window.FC);
    if (typeof window.initApp === 'function') return window.initApp;
    return null;
  }

  function startOnce(){
    if (window.__APP_STARTED__) return;
    const init = findInit();
    if (!init) return false;
    window.__APP_STARTED__ = true;
    try { init(); }
    catch(err){ showError('❌ Błąd podczas startu aplikacji:\n' + (err?.stack || String(err))); }
    return true;
  }

  function boot(){
    // wait for app.js to define entrypoint (defer order should do it, but be safe)
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if (startOnce() || tries > 60) { clearInterval(timer); }
      if (tries > 60 && !window.__APP_STARTED__) {
        showError(`❌ Nie znaleziono funkcji startowej aplikacji. (${BOOT_VERSION})\nSzuka: App.init() / FC.init() / initApp().`);
      }
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();