(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function getManifest(){
    const manifest = FC.rozrysLazyManifest;
    if(manifest && Array.isArray(manifest.scripts)) return manifest;
    return { groupId:'rozrys-lazy-tab', scripts:[] };
  }

  function normalizeSrc(src){
    try{ return new URL(String(src || ''), document.baseURI).href; }catch(_){ return String(src || ''); }
  }

  function isAlreadyLoaded(src){
    const normalized = normalizeSrc(src);
    return Array.from(document.scripts || []).some((script)=> normalizeSrc(script.getAttribute('src') || script.src || '') === normalized);
  }

  function loadScriptSequentially(src){
    return new Promise((resolve, reject)=>{
      if(!src) return resolve();
      if(isAlreadyLoaded(src)) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.defer = false;
      script.setAttribute('data-load-group', getManifest().groupId || 'rozrys-lazy-tab');
      script.setAttribute('data-load-mode', 'lazy');
      script.onload = ()=> resolve();
      script.onerror = ()=> reject(new Error('Nie udało się załadować ' + src));
      document.head.appendChild(script);
    });
  }

  let loaded = false;
  let loadingPromise = null;

  function ensureFeatureLoaded(){
    if(loaded) return Promise.resolve(FC.rozrys || null);
    if(loadingPromise) return loadingPromise;
    const manifest = getManifest();
    const scripts = Array.isArray(manifest.scripts) ? manifest.scripts.slice() : [];
    loadingPromise = scripts.reduce((chain, src)=> chain.then(()=> loadScriptSequentially(src)), Promise.resolve())
      .then(()=>{
        loaded = true;
        loadingPromise = null;
        return FC.rozrys || null;
      })
      .catch((error)=>{
        loadingPromise = null;
        throw error;
      });
    return loadingPromise;
  }

  FC.rozrysLazy = {
    ensureFeatureLoaded,
    isLoaded: ()=> loaded,
    getScripts: ()=> {
      const manifest = getManifest();
      return Array.isArray(manifest.scripts) ? manifest.scripts.slice() : [];
    },
  };
})();
