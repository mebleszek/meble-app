(function(){
  'use strict';

  function installBindings(){
    try{
      if(window.FC && window.FC.bindings && typeof window.FC.bindings.install === 'function'){
        window.FC.bindings.install();
      }
    }catch(_){ }
  }

  function scheduleRozrysWarmup(cfg){
    const opts = Object.assign({
      reason:'post-init-ui',
      delayMs: 900,
      idleTimeoutMs: 3500,
    }, cfg || {});
    try{
      if(window.FC && window.FC.rozrysLazy && typeof window.FC.rozrysLazy.scheduleWarmup === 'function'){
        window.FC.rozrysLazy.scheduleWarmup(opts);
      }
    }catch(_){ }
  }

  try{
    window.FC = window.FC || {};
    const ns = window.FC.appUiRuntimeServices = window.FC.appUiRuntimeServices || {};
    ns.installBindings = installBindings;
    ns.scheduleRozrysWarmup = scheduleRozrysWarmup;
  }catch(_){ }
})();
