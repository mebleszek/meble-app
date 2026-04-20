(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function getProjectSourceApi(){
    if(FC.rozrysProjectSource && typeof FC.rozrysProjectSource.createApi === 'function'){
      try{ return FC.rozrysProjectSource.createApi({ FC, host:window }); }catch(_){ }
    }
    return {};
  }

  function safeGetProject(){
    const api = getProjectSourceApi();
    if(typeof api.safeGetProject === 'function') return api.safeGetProject();
    try{ return typeof projectData !== 'undefined' ? projectData : null; }catch(_){ return null; }
  }

  function discoverProjectRoomKeys(project){
    const api = getProjectSourceApi();
    return typeof api.discoverProjectRoomKeys === 'function' ? api.discoverProjectRoomKeys(project) : [];
  }

  function discoverVisibleProjectRoomKeys(project){
    const api = getProjectSourceApi();
    return typeof api.discoverVisibleProjectRoomKeys === 'function' ? api.discoverVisibleProjectRoomKeys(project) : [];
  }

  function getRoomsForProject(project){
    const api = getProjectSourceApi();
    return typeof api.getRoomsForProject === 'function' ? api.getRoomsForProject(project) : [];
  }

  function getCurrentRoomContext(){
    try{
      const state = (FC.uiState && typeof FC.uiState.get === 'function')
        ? FC.uiState.get()
        : ((typeof uiState !== 'undefined' && uiState && typeof uiState === 'object') ? uiState : null);
      return String((state && state.roomType) || '').trim();
    }catch(_){
      return '';
    }
  }

  function aggregatePartsForProject(selectedRooms){
    if(!(FC.rozrysScope && typeof FC.rozrysScope.aggregatePartsForProject === 'function')){
      return { byMaterial:{}, materials:[], groups:{}, selectedRooms:Array.isArray(selectedRooms) ? selectedRooms.slice() : [] };
    }
    const projectApi = getProjectSourceApi();
    const scopeDeps = {
      safeGetProject,
      getRooms: ()=> (typeof projectApi.getRooms === 'function' ? projectApi.getRooms() : []),
    };
    try{
      const result = FC.rozrysScope.aggregatePartsForProject(selectedRooms, scopeDeps);
      if(result) return result;
    }catch(_){ }
    return { byMaterial:{}, materials:[], groups:{}, selectedRooms:Array.isArray(selectedRooms) ? selectedRooms.slice() : [] };
  }

  function renderLoading(root){
    if(!root) return;
    root.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'build-card';
    card.innerHTML = '<h3>ROZRYS</h3><p class="muted">Ładuję moduł rozkroju…</p>';
    root.appendChild(card);
  }

  function renderError(root, error){
    if(!root) return;
    root.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'build-card';
    const message = error && error.message ? error.message : 'Nie udało się załadować modułu ROZRYS.';
    card.innerHTML = '<h3>ROZRYS</h3><p class="muted">' + String(message) + '</p>';
    root.appendChild(card);
  }

  function ensureLoaded(){
    if(FC.rozrysLazy && typeof FC.rozrysLazy.ensureFeatureLoaded === 'function') return FC.rozrysLazy.ensureFeatureLoaded();
    return Promise.resolve(FC.rozrys || null);
  }

  function render(){
    const root = document.getElementById('rozrysRoot');
    renderLoading(root);
    return ensureLoaded()
      .then(()=>{
        if(FC.rozrys && typeof FC.rozrys.render === 'function' && FC.rozrys.render !== render){
          return FC.rozrys.render();
        }
        return null;
      })
      .catch((error)=>{
        try{ console.error('[rozrys-shell] lazy load failed', error); }catch(_){ }
        renderError(root, error);
        return null;
      });
  }

  const existing = (FC.rozrys && typeof FC.rozrys === 'object') ? FC.rozrys : {};
  FC.rozrys = Object.assign(existing, {
    render,
    ensureLoaded,
    aggregatePartsForProject,
    safeGetProject,
    discoverProjectRoomKeys,
    discoverVisibleProjectRoomKeys,
    getRoomsForProject,
    getCurrentRoomContext,
  });
})();
