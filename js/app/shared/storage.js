// js/app/shared/storage.js
// LocalStorage helpers and JSON wrappers. Loaded before js/app.js

(function(){
  'use strict';
  try{
    window.FC = window.FC || {};
    const utils = window.FC.utils;

    if(!window.FC.storage){
      window.FC.storage = {
        getJSON(key, fallback){
          try{
            const raw = localStorage.getItem(key);
            if (!raw) return utils && utils.clone ? utils.clone(fallback) : JSON.parse(JSON.stringify(fallback));
            return JSON.parse(raw);
          }catch(e){
            return utils && utils.clone ? utils.clone(fallback) : JSON.parse(JSON.stringify(fallback));
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
        }
      };
    }
  }catch(_){ }
})();
