// js/app/project/project-recalculate.js
// Globalne przeliczenie po zmianie logiki/cennika/ustawień bez ręcznej edycji każdej szafki.
(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;

  function text(value){ return String(value == null ? '' : value).trim(); }

  function getProject(){
    try{ if(typeof root.projectData !== 'undefined' && root.projectData) return root.projectData; }catch(_){ }
    try{ if(FC.project && typeof FC.project.load === 'function') return FC.project.load() || {}; }catch(_){ }
    return {};
  }

  function roomIds(project){
    const source = project && typeof project === 'object' ? project : getProject();
    return Object.keys(source || {}).filter((key)=> {
      if(key === 'meta' || key === 'schemaVersion') return false;
      const room = source[key];
      return !!(room && typeof room === 'object' && Array.isArray(room.cabinets));
    });
  }

  function cabinetCount(project, rooms){
    const source = project && typeof project === 'object' ? project : getProject();
    return (Array.isArray(rooms) ? rooms : roomIds(source)).reduce((sum, roomId)=> {
      const list = source && source[roomId] && Array.isArray(source[roomId].cabinets) ? source[roomId].cabinets : [];
      return sum + list.length;
    }, 0);
  }

  function refreshVisibleViews(){
    try{ if(typeof root.renderCabinets === 'function') root.renderCabinets(); }catch(_){ }
    try{
      const tab = root.uiState && text(root.uiState.activeTab);
      const room = root.uiState && text(root.uiState.roomType);
      const list = root.document && root.document.getElementById('cabinetsList');
      if(tab === 'czynnosci' && room && list && FC.tabsCzynnosci && typeof FC.tabsCzynnosci.render === 'function'){
        FC.tabsCzynnosci.render({ listEl:list, room });
      }
    }catch(_){ }
  }

  function persistProject(project){
    try{
      if(FC.project && typeof FC.project.save === 'function'){
        const saved = FC.project.save(project || getProject());
        if(saved){
          root.projectData = saved;
          return true;
        }
      }
    }catch(_){ }
    try{
      if(FC.storage && typeof FC.storage.setJSON === 'function'){
        const keys = root.STORAGE_KEYS || (FC.constants && FC.constants.STORAGE_KEYS) || {};
        FC.storage.setJSON(keys.projectData || 'fc_project_v1', project || getProject());
        return true;
      }
    }catch(_){ }
    return false;
  }

  function recalculateCurrentProject(options){
    const opts = options && typeof options === 'object' ? options : {};
    const project = getProject();
    const rooms = roomIds(project);
    const count = cabinetCount(project, rooms);
    const started = Date.now();
    let summary = { cabinetCount:count, rooms:rooms.length, recalculations:0, cacheHits:0, errors:0, totalMs:0, persisted:false };

    if(FC.cabinetDerivedFacts && typeof FC.cabinetDerivedFacts.ensureForRooms === 'function'){
      try{
        summary = FC.cabinetDerivedFacts.ensureForRooms(rooms, { persist:true, recalculate:true, force:true }) || summary;
      }catch(error){
        summary.errors = Number(summary.errors) || 0;
        summary.errors += 1;
        summary.error = String(error && error.message || error || 'błąd przeliczenia');
      }
    }else{
      summary.error = 'Moduł faktów pochodnych nie jest załadowany.';
      summary.errors = 1;
    }

    if(!(summary && summary.persisted)) summary.persisted = persistProject(project);
    summary.rooms = rooms.length;
    summary.cabinetCount = Number(summary.cabinetCount || count) || count;
    summary.totalMs = Number(summary.totalMs || (Date.now() - started)) || 0;

    if(opts.refresh !== false) refreshVisibleViews();
    return summary;
  }

  function showSummary(summary){
    const s = summary || {};
    const msg = [
      `Szafki: ${Number(s.cabinetCount) || 0}`,
      `Przeliczone: ${Number(s.recalculations) || 0}`,
      `Błędy: ${Number(s.errors) || 0}`,
      s.persisted ? 'Projekt zapisany.' : 'Nie potwierdzono zapisu projektu.'
    ].join('\n');
    try{
      if(FC.infoBox && typeof FC.infoBox.open === 'function'){
        FC.infoBox.open({ title:'Projekt przeliczony', message:msg });
        return;
      }
    }catch(_){ }
    try{ console.info('[projectRecalculator]', msg, s); }catch(_){ }
  }

  function recalculateAndNotify(options){
    const summary = recalculateCurrentProject(options || {});
    showSummary(summary);
    return summary;
  }

  FC.projectRecalculator = {
    roomIds,
    cabinetCount,
    recalculateCurrentProject,
    recalculateAndNotify,
    refreshVisibleViews
  };
})();
