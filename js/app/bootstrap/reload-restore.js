// js/app/bootstrap/reload-restore.js
// Session-scoped reload/scroll restore helper. Loaded before js/app.js.
(function(){
  'use strict';
  try{
    const root = window;
    root.FC = root.FC || {};
    const KEY = 'fc_reload_restore_v1';
    let pendingSnapshot = null;

    function sessionGetRaw(key){
      try{
        const sessionApi = root.FC && root.FC.storage && root.FC.storage.session;
        if(sessionApi && typeof sessionApi.getRaw === 'function') return sessionApi.getRaw(key);
      }catch(_){ }
      try{ return sessionStorage.getItem(key); }catch(_){ return null; }
    }

    function sessionSetJSON(key, value){
      try{
        const sessionApi = root.FC && root.FC.storage && root.FC.storage.session;
        if(sessionApi && typeof sessionApi.setJSON === 'function'){
          sessionApi.setJSON(key, value);
          return;
        }
      }catch(_){ }
      try{ sessionStorage.setItem(key, JSON.stringify(value)); }catch(_){ }
    }

    function sessionRemove(key){
      try{
        const sessionApi = root.FC && root.FC.storage && root.FC.storage.session;
        if(sessionApi && typeof sessionApi.remove === 'function'){
          sessionApi.remove(key);
          return;
        }
      }catch(_){ }
      try{ sessionStorage.removeItem(key); }catch(_){ }
    }

    function read(){
      try{
        const raw = sessionGetRaw(KEY);
        if(!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      }catch(_){ return null; }
    }

    function clear(){
      sessionRemove(KEY);
    }

    function getCurrentUiState(){
      try{
        if(root.FC && root.FC.uiState && typeof root.FC.uiState.get === 'function'){
          return root.FC.uiState.get();
        }
      }catch(_){ }
      try{
        if(typeof root.uiState !== 'undefined') return root.uiState;
      }catch(_){ }
      return null;
    }

    function persist(){
      try{
        const snapshotState = getCurrentUiState();
        if(!(snapshotState && typeof snapshotState === 'object')) return;
        const payload = {
          savedAt: Date.now(),
          uiState: snapshotState,
          scrollY: (()=> {
            try{ return typeof root.scrollY === 'number' ? Math.max(0, Math.round(root.scrollY)) : 0; }catch(_){ return 0; }
          })(),
        };
        sessionSetJSON(KEY, payload);
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
        try{ root.scrollTo(0, targetY); }catch(_){ }
      };
      [0, 16, 48, 120, 240, 420].forEach((delay)=> {
        try{
          if(delay === 0 && typeof root.requestAnimationFrame === 'function') root.requestAnimationFrame(()=> root.requestAnimationFrame(apply));
          else root.setTimeout(apply, delay);
        }catch(_){
          try{ setTimeout(apply, delay); }catch(__){ }
        }
      });
    }

    root.FC.reloadRestore = Object.assign(root.FC.reloadRestore || {}, {
      key: KEY,
      read,
      clear,
      persist,
      applySnapshot,
      restoreScroll,
    });

    try{
      if(typeof root.addEventListener === 'function'){
        root.addEventListener('pagehide', persist, { capture:true });
        root.addEventListener('beforeunload', persist, { capture:true });
      }
    }catch(_){ }
  }catch(_){ }
})();
