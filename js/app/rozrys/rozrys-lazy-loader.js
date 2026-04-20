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

  function shouldSkipWarmup(){
    try{
      const conn = navigator && navigator.connection;
      if(!conn) return false;
      if(conn.saveData) return true;
      const type = String(conn.effectiveType || '').toLowerCase();
      return type === 'slow-2g' || type === '2g';
    }catch(_){
      return false;
    }
  }

  function runWhenWindowLoaded(fn){
    if(typeof fn !== 'function') return;
    if(document.readyState === 'complete'){
      fn();
      return;
    }
    window.addEventListener('load', fn, { once:true });
  }

  function runWhenIdle(fn, timeoutMs){
    if(typeof fn !== 'function') return;
    if(typeof window.requestIdleCallback === 'function'){
      window.requestIdleCallback(()=> fn(), { timeout: Number.isFinite(timeoutMs) ? timeoutMs : 2500 });
      return;
    }
    window.setTimeout(fn, Number.isFinite(timeoutMs) ? Math.min(timeoutMs, 1200) : 700);
  }

  let loaded = false;
  let loadingPromise = null;
  let warmupScheduled = false;
  let warmupStarted = false;

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

  function warmupFeature(reason){
    if(warmupStarted) return loadingPromise || Promise.resolve(FC.rozrys || null);
    if(loaded) return Promise.resolve(FC.rozrys || null);
    warmupStarted = true;
    try{ console.info('[rozrys-lazy] warmup start', reason || 'background'); }catch(_){ }
    return ensureFeatureLoaded().catch((error)=>{
      try{ console.warn('[rozrys-lazy] warmup failed', error); }catch(_){ }
      return null;
    });
  }

  function scheduleWarmup(options){
    const cfg = options && typeof options === 'object' ? options : {};
    if(warmupScheduled || warmupStarted || loaded) return false;
    if(cfg.force !== true && shouldSkipWarmup()) return false;
    warmupScheduled = true;
    const delayMs = Number.isFinite(cfg.delayMs) ? Math.max(0, cfg.delayMs) : 500;
    const idleTimeoutMs = Number.isFinite(cfg.idleTimeoutMs) ? Math.max(0, cfg.idleTimeoutMs) : 2500;
    runWhenWindowLoaded(()=>{
      window.setTimeout(()=>{
        runWhenIdle(()=> warmupFeature(cfg.reason || 'scheduled'), idleTimeoutMs);
      }, delayMs);
    });
    return true;
  }

  FC.rozrysLazy = {
    ensureFeatureLoaded,
    isLoaded: ()=> loaded,
    isWarmupScheduled: ()=> warmupScheduled,
    isWarmupStarted: ()=> warmupStarted,
    scheduleWarmup,
    warmupFeature,
    shouldSkipWarmup,
    getScripts: ()=> {
      const manifest = getManifest();
      return Array.isArray(manifest.scripts) ? manifest.scripts.slice() : [];
    },
  };
})();
