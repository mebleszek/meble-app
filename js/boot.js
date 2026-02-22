/* ===== robustness layer: keep home usable even if app init fails ===== */
(function(){
  // Create a small error banner (doesn't change layout unless an error happens)
  function ensureBanner(){
    if(document.getElementById('errorBanner')) return;
    const b=document.createElement('div');
    b.id='errorBanner';
    b.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:99999;padding:10px 12px;background:#fff3cd;border-top:1px solid #ffeeba;color:#856404;font:14px/1.3 system-ui, -apple-system, Segoe UI, Roboto, Arial;display:none';
    b.innerHTML='<span id="errorBannerMsg"></span><button id="errorBannerClose" style="float:right;border:0;background:transparent;font-size:18px;line-height:1;cursor:pointer">×</button>';
    document.body.appendChild(b);
    b.querySelector('#errorBannerClose').addEventListener('click', ()=>{ b.style.display='none'; });
  }
  function showBanner(msg, err){
    try{
      ensureBanner();
      const b=document.getElementById('errorBanner');
      const m=document.getElementById('errorBannerMsg');
      const details = err ? (' — '+ (err.message||String(err))) : '';
      if(m) m.textContent = msg + details;
      if(b) b.style.display='block';
      console.error(err||msg);
    }catch(e){ /* noop */ }
  }

  // Global runtime error capture (SyntaxError at parse-time can't be caught)
  window.addEventListener('error', (e)=>{ showBanner('Błąd w aplikacji', e.error||e.message); });
  window.addEventListener('unhandledrejection', (e)=>{ showBanner('Nieobsłużony błąd (Promise)', e.reason); });

  // initUI sometimes doesn't fire reliably in content://. Ensure it runs once.
  function initOnce(){
    if(window.__robustInitDone) return;
    window.__robustInitDone = true;
    try{
      if(typeof initUI === 'function') initUI();
    }catch(err){
      showBanner('Błąd inicjalizacji — strona główna powinna działać', err);
    }
  }

  // Delegated click handler for tiles as a fallback (does NOT change layout)
  function bindHomeFallback(){
    if(window.__homeFallbackBound) return;
    const grid=document.querySelector('.rooms');
    if(!grid) return;
    window.__homeFallbackBound = true;

    grid.addEventListener('click', (ev)=>{
      const tile = ev.target && ev.target.closest ? ev.target.closest('.room-btn') : null;
      if(!tile) return;
      // If normal handlers are attached, let them handle (avoid double navigation)
      if(tile.__hasNativeHandler) return;
      ev.preventDefault();
      const room = tile.getAttribute('data-room');
      if(!room) return;
      try{
        // Mirror original behavior as closely as possible
        if(typeof uiState === 'object'){
          uiState.roomType = room;
          if(typeof FC !== 'undefined' && FC.storage && FC.storage.setJSON && typeof STORAGE_KEYS !== 'undefined'){
            FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
          }
        }
        const rv=document.getElementById('roomsView');
        const av=document.getElementById('appView');
        const tabs=document.getElementById('topTabs');
        if(rv) rv.style.display='none';
        if(av) av.style.display='block';
        if(tabs) tabs.style.display='inline-block';
        if(typeof setActiveTab === 'function') setActiveTab('wywiad');
        if(typeof renderCabinets === 'function') renderCabinets();
        initOnce(); // try to wire the rest (buttons, add, etc.)
      }catch(err){
        showBanner('Nie udało się otworzyć pokoju', err);
      }
    }, {passive:false});
  }

  // Fallback delegated handler for top tabs (WYWIAD/MATERIAŁ/CZYNNOŚCI/WYCENA)
  function bindTopTabsFallback(){
    if(window.__topTabsFallbackBound) return;
    const tabs = document.getElementById('topTabs');
    if(!tabs) return;
    window.__topTabsFallbackBound = true;

    tabs.addEventListener('click', (ev)=>{
      const btn = ev.target && ev.target.closest ? ev.target.closest('button.tab-btn') : null;
      if(!btn) return;
      // If initUI attached handlers, we still allow this; it should be idempotent.
      ev.preventDefault();
      const tab = btn.getAttribute('data-tab');
      if(!tab) return;
      try{
        const rv=document.getElementById('roomsView');
        const av=document.getElementById('appView');
        const tabsEl=document.getElementById('topTabs');
        if(rv) rv.style.display='none';
        if(av) av.style.display='block';
        if(tabsEl) tabsEl.style.display='inline-block';
        if(typeof setActiveTab === 'function') setActiveTab(tab);
        // Some tabs rely on render calls; call safely when available
        if(tab==='wywiad' && typeof renderCabinets === 'function') renderCabinets();
        if(tab==='material' && typeof renderMaterials === 'function') renderMaterials();
        if(tab==='czynnosci' && typeof renderServices === 'function') renderServices();
        if(tab==='wycena' && typeof renderPriceList === 'function') renderPriceList();
        initOnce();
      }catch(err){
        showBanner('Błąd przełączania zakładki', err);
      }
    }, {passive:false});
  }

  // Guard: if an overlay/modal-back is left visible while on the home screen, hide it (prevents "dead tiles")
  function ensureNoStuckOverlay(){
    try{
      const rv = document.getElementById('roomsView');
      if(!rv) return;
      const onHome = (rv.style.display !== 'none') && (rv.offsetParent !== null);
      if(!onHome) return;

      let anyHidden = false;
      document.querySelectorAll('.modal-back').forEach(mb=>{
        const disp = getComputedStyle(mb).display;
        if(disp !== 'none'){
          mb.style.display = 'none';
          anyHidden = true;
        }
      });

      if(anyHidden){
        document.documentElement.classList.remove('modal-lock');
        document.body.classList.remove('modal-lock');
      }
    }catch(e){ /* noop */ }
  }


  // Mark tiles that already have native handlers (after initUI binds them)
  function markTilesWithNativeHandlers(){
    try{
      document.querySelectorAll('.room-btn').forEach(btn=>{
        // Heuristic: if click listeners exist we can't detect; mark after initUI by setting flag in wrapper
        // We simply set a flag when user clicks and we detect UI switched; not needed.
      });
    }catch(e){}
  }

  // Run
  const start=()=>{
    bindHomeFallback();
    bindTopTabsFallback();
    ensureNoStuckOverlay();
    initOnce();
    // Watchdog: re-bind fallbacks and clear stuck overlays (Android/WebView can drop handlers/leave overlays)
    setTimeout(()=>{
      bindHomeFallback();
      bindTopTabsFallback();
      ensureNoStuckOverlay();
      if(!window.__robustInitDone) initOnce();
    }, 1200);
  };
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start, {once:true});
  }else{
    setTimeout(start, 0);
  }
})();
