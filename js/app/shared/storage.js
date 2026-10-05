// js/app/shared/storage.js
// LocalStorage/sessionStorage helpers and JSON wrappers. Loaded before js/app.js

(function(){
  'use strict';
  try{
    window.FC = window.FC || {};
    const utils = window.FC.utils;
    let lastWriteError = null;
    let lastNoticeKey = '';
    let lastNoticeAt = 0;

    function cloneFallback(fallback){
      try{ return utils && utils.clone ? utils.clone(fallback) : JSON.parse(JSON.stringify(fallback)); }catch(_){ return fallback; }
    }

    function invalidateDirtyCache(){
      try{ if(window.FC && window.FC.session && typeof window.FC.session.invalidateDirtyCache === 'function') window.FC.session.invalidateDirtyCache(); }catch(_){ }
    }

    function makeWriteResult(ok, key, error){
      const err = error || null;
      const name = String(err && err.name || '');
      const message = String(err && err.message || '');
      const code = Number(err && (err.code || err.number) || 0);
      const isQuotaExceeded = !!err && (
        name === 'QuotaExceededError' ||
        name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        code === 22 ||
        code === 1014 ||
        /quota|storage.*full|full.*storage/i.test(message)
      );
      return { ok:!!ok, key:String(key || ''), error:err, name, message, code, isQuotaExceeded };
    }

    function rememberFailure(result){
      if(result && result.ok === false) lastWriteError = result;
      return result;
    }

    function trySetRaw(key, raw){
      try{
        localStorage.setItem(key, raw);
        invalidateDirtyCache();
        return makeWriteResult(true, key, null);
      }catch(error){
        return rememberFailure(makeWriteResult(false, key, error));
      }
    }

    function trySetJSON(key, value){
      let raw = '';
      try{ raw = JSON.stringify(value); }
      catch(error){ return rememberFailure(makeWriteResult(false, key, error)); }
      return trySetRaw(key, raw);
    }

    function tryRemoveRaw(key){
      try{
        localStorage.removeItem(key);
        invalidateDirtyCache();
        return makeWriteResult(true, key, null);
      }catch(error){
        return rememberFailure(makeWriteResult(false, key, error));
      }
    }

    function getLastWriteError(){
      return lastWriteError;
    }

    function notifyWriteFailure(result, options){
      const failure = result && result.ok === false ? result : lastWriteError;
      if(!(failure && failure.ok === false)) return false;
      const opts = options || {};
      const label = String(opts.label || 'danych').trim() || 'danych';
      const now = Date.now();
      const noticeKey = String(failure.key || '') + '|' + label + '|' + String(failure.name || '');
      if(noticeKey === lastNoticeKey && now - lastNoticeAt < 2500) return false;
      lastNoticeKey = noticeKey;
      lastNoticeAt = now;

      const title = 'Nie udało się zapisać danych';
      const message = failure.isQuotaExceeded
        ? `Pamięć przeglądarki jest pełna. Zapis ${label} NIE został wykonany. Nie zamykaj strony. Zwolnij miejsce w przeglądarce albo wyeksportuj dane do pliku, jeśli ta opcja jest dostępna.`
        : `Zapis ${label} NIE został wykonany. Nie zamykaj strony. Spróbuj ponownie lub wyeksportuj dane do pliku. Szczegóły: ${failure.name || failure.message || 'nieznany błąd zapisu'}.`;

      try{ console.error('[Meble-App storage]', title, failure); }catch(_){ }
      try{
        if(window.FC && window.FC.infoBox && typeof window.FC.infoBox.open === 'function'){
          window.FC.infoBox.open({ title, message, okOnly:true, dismissOnOverlay:false, dismissOnEsc:false });
          return true;
        }
      }catch(_){ }
      try{
        if(typeof alert === 'function'){
          alert(title + '\n\n' + message);
          return true;
        }
      }catch(_){ }
      return false;
    }

    function makeSessionStorageApi(){
      return {
        getJSON(key, fallback){
          try{
            const raw = sessionStorage.getItem(key);
            if(!raw) return cloneFallback(fallback);
            return JSON.parse(raw);
          }catch(e){
            return cloneFallback(fallback);
          }
        },
        setJSON(key, value){
          try{ sessionStorage.setItem(key, JSON.stringify(value)); return true; }catch(e){ return false; }
        },
        getRaw(key){
          try{ return sessionStorage.getItem(key); }catch(e){ return null; }
        },
        setRaw(key, raw){
          try{ sessionStorage.setItem(key, raw); return true; }catch(e){ return false; }
        },
        remove(key){
          try{ sessionStorage.removeItem(key); return true; }catch(e){ return false; }
        }
      };
    }

    if(!window.FC.storage){
      window.FC.storage = {
        getJSON(key, fallback){
          try{
            const raw = localStorage.getItem(key);
            if(!raw) return cloneFallback(fallback);
            return JSON.parse(raw);
          }catch(e){
            return cloneFallback(fallback);
          }
        },
        setJSON(key, value){ return trySetJSON(key, value).ok; },
        trySetJSON,
        getRaw(key){
          try{ return localStorage.getItem(key); }catch(e){ return null; }
        },
        setRaw(key, raw){ return trySetRaw(key, raw).ok; },
        trySetRaw,
        removeRaw(key){ return tryRemoveRaw(key).ok; },
        tryRemoveRaw,
        getLastWriteError,
        notifyWriteFailure,
        session: makeSessionStorageApi(),
      };
    } else {
      if(typeof window.FC.storage.removeRaw !== 'function'){
        window.FC.storage.removeRaw = function removeRaw(key){ return tryRemoveRaw(key).ok; };
      }
      if(typeof window.FC.storage.trySetJSON !== 'function') window.FC.storage.trySetJSON = trySetJSON;
      if(typeof window.FC.storage.trySetRaw !== 'function') window.FC.storage.trySetRaw = trySetRaw;
      if(typeof window.FC.storage.tryRemoveRaw !== 'function') window.FC.storage.tryRemoveRaw = tryRemoveRaw;
      if(typeof window.FC.storage.getLastWriteError !== 'function') window.FC.storage.getLastWriteError = getLastWriteError;
      if(typeof window.FC.storage.notifyWriteFailure !== 'function') window.FC.storage.notifyWriteFailure = notifyWriteFailure;
      if(!window.FC.storage.session) window.FC.storage.session = makeSessionStorageApi();
    }
  }catch(_){ }
})();
