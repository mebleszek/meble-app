/* boot.js — boot-clean-1.4 (ERROR BANNER + STARTER)
   - pokazuje czerwony pasek błędów
   - NIE resetuje automatycznie widoku po zwykłym odświeżeniu
   - uruchamia aplikację: FC.init() / App.init() / initApp() / initUI()
   - ręczny tryb awaryjny: ?safe=1 lub ?reset=1
*/
(() => {
  'use strict';
  const BOOT_VERSION = 'boot-clean-1.4';
  const UI_KEY = 'fc_ui_v1';

  // No automatic reset to Home on normal refresh.
  // Keep ordinary reloads inside the current project/view.

  // Optional hard reset: manual safe mode only.
  if (location.search.includes('safe=1') || location.search.includes('reset=1')) {
    try { localStorage.removeItem(UI_KEY); } catch (_) {}
  }

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
    if (window.FC && typeof window.FC.init === 'function') return window.FC.init.bind(window.FC);
    if (window.App && typeof window.App.init === 'function') return window.App.init.bind(window.App);
    if (typeof window.initApp === 'function') return window.initApp;
    if (typeof window.initUI === 'function') return window.initUI;
    return null;
  }

  function startOnce(){
    if (window.__APP_STARTED__) return true;
    const init = findInit();
    if (!init) return false;
    window.__APP_STARTED__ = true;
    try { init(); }
    catch(err){
      window.__APP_STARTED__ = false;
      showError('❌ Błąd podczas startu aplikacji\n' + (err?.stack || String(err)));
      return false;
    }
    return true;
  }

  function findScriptSrc(match){
    try{
      const scripts = Array.from(document.scripts || []);
      const hit = scripts.find((script) => {
        const src = script && script.getAttribute ? (script.getAttribute('src') || '') : '';
        return src && src.includes(match);
      });
      return hit ? (hit.getAttribute('src') || '') : '';
    }catch(_){ return ''; }
  }

  function appendRecoveryScript(src){
    return new Promise((resolve) => {
      if (!src) { resolve(false); return; }
      try{
        const script = document.createElement('script');
        script.defer = true;
        script.async = false;
        script.src = src + (src.includes('?') ? '&' : '?') + 'boot_recover=' + Date.now();
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      }catch(_){ resolve(false); }
    });
  }

  let recoveryPromise = null;
  function attemptRecovery(){
    if (recoveryPromise) return recoveryPromise;
    recoveryPromise = (async () => {
      const appSrc = findScriptSrc('js/app.js');
      const publicApiSrc = findScriptSrc('js/app/shared/public-api.js');
      if (appSrc && typeof window.initApp !== 'function' && !(window.FC && typeof window.FC.init === 'function')) {
        await appendRecoveryScript(appSrc);
      }
      if (publicApiSrc && !(window.FC && typeof window.FC.init === 'function') && !(window.App && typeof window.App.init === 'function')) {
        await appendRecoveryScript(publicApiSrc);
      }
      return true;
    })().catch(() => false);
    return recoveryPromise;
  }

  function boot(){
    let tries = 0;
    let recoveryTriggered = false;
    const timer = setInterval(async () => {
      tries++;
      if (startOnce()) { clearInterval(timer); return; }
      if (!recoveryTriggered && tries >= 12) {
        recoveryTriggered = true;
        await attemptRecovery();
        if (startOnce()) { clearInterval(timer); return; }
      }
      if (tries > 60) {
        clearInterval(timer);
        showError(`❌ Nie znaleziono funkcji startowej aplikacji.
Boot.js version: ${BOOT_VERSION}
Szukam: FC.init(), App.init(), initApp(), initUI().`);
      }
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
