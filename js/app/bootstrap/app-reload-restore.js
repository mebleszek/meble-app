(function(){
  'use strict';

  const RELOAD_RESTORE_KEY = 'fc_reload_restore_v1';
  let pendingSnapshot = null;
  let listenersInstalled = false;

  function read(){
    try{
      const raw = sessionStorage.getItem(RELOAD_RESTORE_KEY);
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    }catch(_){ return null; }
  }

  function clear(){
    try{ sessionStorage.removeItem(RELOAD_RESTORE_KEY); }catch(_){ }
  }

  function resolveUiState(ctx){
    try{
      if(ctx && typeof ctx.getUiState === 'function'){
        const state = ctx.getUiState();
        if(state && typeof state === 'object') return state;
      }
    }catch(_){ }
    try{
      if(window.FC && window.FC.uiState && typeof window.FC.uiState.get === 'function'){
        const state = window.FC.uiState.get();
        if(state && typeof state === 'object') return state;
      }
    }catch(_){ }
    return null;
  }

  function persist(ctx){
    try{
      const snapshotState = resolveUiState(ctx);
      if(!(snapshotState && typeof snapshotState === 'object')) return;
      const payload = {
        savedAt: Date.now(),
        uiState: snapshotState,
        scrollY: (()=> {
          try{ return typeof window.scrollY === 'number' ? Math.max(0, Math.round(window.scrollY)) : 0; }catch(_){ return 0; }
        })(),
      };
      sessionStorage.setItem(RELOAD_RESTORE_KEY, JSON.stringify(payload));
    }catch(_){ }
  }

  function applySnapshot(){
    const snapshot = read();
    if(!(snapshot && snapshot.uiState && typeof snapshot.uiState === 'object')) return null;
    pendingSnapshot = snapshot;
    clear();
    return snapshot;
  }

  function restoreScroll(){
    const snapshot = pendingSnapshot && typeof pendingSnapshot === 'object' ? pendingSnapshot : null;
    pendingSnapshot = null;
    if(!snapshot) return;
    const targetY = Math.max(0, Math.round(Number(snapshot.scrollY) || 0));
    const apply = ()=> {
      try{ window.scrollTo(0, targetY); }catch(_){ }
    };
    [0, 16, 48, 120, 240, 420].forEach((delay)=> {
      try{
        if(delay === 0) requestAnimationFrame(()=> requestAnimationFrame(apply));
        else setTimeout(apply, delay);
      }catch(_){
        try{ setTimeout(apply, delay); }catch(__){ }
      }
    });
  }

  function installPersistence(ctx){
    if(listenersInstalled) return;
    listenersInstalled = true;
    const handler = function(){ persist(ctx); };
    try{ window.addEventListener('pagehide', handler, { capture:true }); }catch(_){ }
    try{ window.addEventListener('beforeunload', handler, { capture:true }); }catch(_){ }
  }

  try{
    window.FC = window.FC || {};
    const ns = window.FC.reloadRestore = window.FC.reloadRestore || {};
    ns.read = read;
    ns.clear = clear;
    ns.persist = persist;
    ns.applySnapshot = applySnapshot;
    ns.restoreScroll = restoreScroll;
    ns.installPersistence = installPersistence;
  }catch(_){ }
})();
