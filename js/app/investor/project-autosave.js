(function(){
  const ns = (window.FC = window.FC || {});
  ns.projectAutosave = ns.projectAutosave || {};

  let autosaveTimer = null;

  function scheduleProjectAutosave(){
    try{ clearTimeout(autosaveTimer); }catch(_){ }
    autosaveTimer = setTimeout(function(){
      try{
        if(window.FC && FC.project && typeof FC.project.save === 'function'){
          projectData = FC.project.save(projectData);
        }
      }catch(_){ }
    }, 180);
  }

  function shouldIgnoreTarget(t){
    try{
      if(!t || !t.closest) return true;
      if(t.closest('#priceModal')) return true;
      if(t.closest('#investorRoot')) return true;
      if(t.closest('.panel-box')) return true;
      if(t.closest('.panel-box-backdrop')) return true;
      if(t.closest('.confirm-box')) return true;
      if(t.closest('.info-box')) return true;
    }catch(_){ }
    return false;
  }

  function installProjectAutosave(){
    if(window.__fcProjectAutosaveInstalled) return;
    window.__fcProjectAutosaveInstalled = true;
    const root = document.getElementById('appView') || document;
    const handler = function(ev){
      try{
        const t = ev && ev.target;
        if(shouldIgnoreTarget(t)) return;
        scheduleProjectAutosave();
      }catch(_){ }
    };
    root.addEventListener('change', handler, true);
    root.addEventListener('input', handler, true);
    root.addEventListener('click', function(ev){
      try{
        const t = ev && ev.target;
        if(shouldIgnoreTarget(t)) return;
        if(t.closest('[data-action]') || t.closest('[data-act]') || t.closest('.tab-btn') || t.closest('.room-card') || t.closest('button')){
          scheduleProjectAutosave();
        }
      }catch(_){ }
    }, true);
  }

  ns.projectAutosave.scheduleProjectAutosave = scheduleProjectAutosave;
  ns.projectAutosave.installProjectAutosave = installProjectAutosave;
})();
