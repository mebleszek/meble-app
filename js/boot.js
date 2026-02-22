/* boot.js — SAFE START + ERROR BANNER (always on) */
(() => {
  'use strict';
  const BOOT_VERSION = 'boot-2.3';

  let bannerEl=null;
  function ensure(){
    if(bannerEl) return bannerEl;
    bannerEl=document.createElement('div');
    bannerEl.id='app-error-banner';
    bannerEl.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:#b00020;color:#fff;font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:10px 12px;box-shadow:0 2px 10px rgba(0,0,0,.25);display:none';
    const row=document.createElement('div'); row.style.cssText='display:flex;gap:10px;align-items:flex-start;';
    const msg=document.createElement('div'); msg.id='app-error-msg'; msg.style.cssText='flex:1;white-space:pre-wrap;word-break:break-word;';
    const copy=document.createElement('button'); copy.textContent='Kopiuj błąd'; copy.type='button';
    copy.style.cssText='border:0;background:rgba(255,255,255,.18);color:#fff;padding:6px 10px;border-radius:8px;cursor:pointer';
    const close=document.createElement('button'); close.textContent='X'; close.type='button';
    close.style.cssText='border:0;background:rgba(255,255,255,.18);color:#fff;padding:6px 10px;border-radius:8px;cursor:pointer';
    close.onclick=()=>bannerEl.style.display='none';
    copy.onclick=async()=>{
      const text=msg.textContent||'';
      try{ await navigator.clipboard.writeText(text); copy.textContent='Skopiowano'; setTimeout(()=>copy.textContent='Kopiuj błąd',1200); }
      catch{ const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy');}catch{} document.body.removeChild(ta); copy.textContent='Skopiowano'; setTimeout(()=>copy.textContent='Kopiuj błąd',1200); }
    };
    row.appendChild(msg); row.appendChild(copy); row.appendChild(close);
    bannerEl.appendChild(row); document.documentElement.appendChild(bannerEl);
    return bannerEl;
  }
  function show(text){ const el=ensure(); el.querySelector('#app-error-msg').textContent=text; el.style.display='block'; }

  window.addEventListener('error',(e)=>{
    const err=e.error;
    const details=[`❌ Błąd JavaScript (${BOOT_VERSION})`, err&&err.stack?err.stack:(e.message||String(e)), e.filename?`Plik: ${e.filename}:${e.lineno||0}:${e.colno||0}`:''].filter(Boolean).join('\n');
    show(details);
  });
  window.addEventListener('unhandledrejection',(e)=>{
    const r=e.reason;
    const details=[`❌ Nieobsłużona obietnica (Promise) (${BOOT_VERSION})`, r&&r.stack?r.stack:String(r)].join('\n');
    show(details);
  });

  function initOnce(){
    if(window.__APP_STARTED__) return;
    window.__APP_STARTED__=true;
    try{
      if(window.App && typeof window.App.init==='function') { window.App.init(); return; }
      if(window.FC && typeof window.FC.init==='function') { window.FC.init(); return; }
      if(typeof window.initApp==='function') { window.initApp(); return; }
      // No init found — warn (non-fatal)
      show('❌ Nie znaleziono funkcji startowej aplikacji. Boot.js szuka: App.init(), FC.init(), initApp().');
    }catch(err){ show('❌ Błąd podczas startu aplikacji:\n'+(err&&err.stack?err.stack:String(err))); }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', initOnce, {once:true});
  else setTimeout(initOnce,0);
})();
