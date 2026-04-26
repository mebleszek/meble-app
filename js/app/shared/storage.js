// js/app/shared/storage.js
// LocalStorage/sessionStorage helpers and JSON wrappers. Loaded before js/app.js

(function(){
  'use strict';
  try{
    window.FC = window.FC || {};
    const utils = window.FC.utils;

    function cloneFallback(fallback){
      try{ return utils && utils.clone ? utils.clone(fallback) : JSON.parse(JSON.stringify(fallback)); }catch(_){ return fallback; }
    }

    if(!window.FC.storage){
      window.FC.storage = {
        getJSON(key, fallback){
          try{
            const raw = localStorage.getItem(key);
            if (!raw) return cloneFallback(fallback);
            return JSON.parse(raw);
          }catch(e){
            return cloneFallback(fallback);
          }
        },
        setJSON(key, value){
          try{
            localStorage.setItem(key, JSON.stringify(value));
            try{ if(window.FC && window.FC.session && typeof window.FC.session.invalidateDirtyCache === 'function') window.FC.session.invalidateDirtyCache(); }catch(_){ }
          }catch(e){}
        },
        getRaw(key){
          try{ return localStorage.getItem(key); }catch(e){ return null; }
        },
        setRaw(key, raw){
          try{ localStorage.setItem(key, raw); try{ if(window.FC && window.FC.session && typeof window.FC.session.invalidateDirtyCache === 'function') window.FC.session.invalidateDirtyCache(); }catch(_){ } }catch(e){}
        },
        removeRaw(key){
          try{ localStorage.removeItem(key); try{ if(window.FC && window.FC.session && typeof window.FC.session.invalidateDirtyCache === 'function') window.FC.session.invalidateDirtyCache(); }catch(_){ } }catch(e){}
        },
        session: {
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
            try{ sessionStorage.setItem(key, JSON.stringify(value)); }catch(e){}
          },
          getRaw(key){
            try{ return sessionStorage.getItem(key); }catch(e){ return null; }
          },
          setRaw(key, raw){
            try{ sessionStorage.setItem(key, raw); }catch(e){}
          },
          remove(key){
            try{ sessionStorage.removeItem(key); }catch(e){}
          }
        }
      };
    } else {
      if(typeof window.FC.storage.removeRaw !== 'function'){
        window.FC.storage.removeRaw = function removeRaw(key){
          try{ localStorage.removeItem(key); try{ if(window.FC && window.FC.session && typeof window.FC.session.invalidateDirtyCache === 'function') window.FC.session.invalidateDirtyCache(); }catch(_){ } }catch(e){}
        };
      }
      if(!window.FC.storage.session){
        window.FC.storage.session = {
          getJSON(key, fallback){
            try{
              const raw = sessionStorage.getItem(key);
              if(!raw) return cloneFallback(fallback);
              return JSON.parse(raw);
            }catch(e){ return cloneFallback(fallback); }
          },
          setJSON(key, value){ try{ sessionStorage.setItem(key, JSON.stringify(value)); }catch(e){} },
          getRaw(key){ try{ return sessionStorage.getItem(key); }catch(e){ return null; } },
          setRaw(key, raw){ try{ sessionStorage.setItem(key, raw); }catch(e){} },
          remove(key){ try{ sessionStorage.removeItem(key); }catch(e){} }
        };
      }
    }
  }catch(_){ }
})();
