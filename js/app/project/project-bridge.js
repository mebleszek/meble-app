(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const keys = (FC.constants && FC.constants.STORAGE_KEYS) || {};
  const storage = FC.storage || {
    getRaw(){ return null; },
    setRaw(){},
    setJSON(){},
    getJSON(_key, fallback){ return JSON.parse(JSON.stringify(fallback)); }
  };
  const model = FC.projectModel || {};
  const projectStore = FC.projectStore || null;

  function normalizeProject(raw){
    try{ return model && typeof model.normalizeProjectData === 'function' ? model.normalizeProjectData(raw) : raw; }
    catch(_){ return raw; }
  }

  function prepareForPersistence(projectData){
    try{
      if(projectStore && typeof projectStore.prepareProjectDataForPersistence === 'function') return projectStore.prepareProjectDataForPersistence(projectData);
    }catch(_){ }
    return normalizeProject(projectData);
  }

  function prepareRawForPersistence(raw){
    if(!raw) return raw;
    try{ return JSON.stringify(prepareForPersistence(JSON.parse(raw))); }catch(_){ return raw; }
  }

  function loadRaw(key){
    try{ return storage.getRaw(key); }catch(_){ return null; }
  }

  function getCurrentInvestorId(){
    try{
      if(FC.investors && typeof FC.investors.getCurrentId === 'function'){
        const id = String(FC.investors.getCurrentId() || '').trim();
        if(id) return id;
      }
    }catch(_){ }
    try{ return String(storage.getRaw('fc_current_investor_v1') || '').trim(); }catch(_){ return ''; }
  }

  function getCentralProjectForActiveContext(){
    const investorId = getCurrentInvestorId();
    if(investorId){
      try{
        if(projectStore && typeof projectStore.getByInvestorId === 'function'){
          const byInvestor = projectStore.getByInvestorId(investorId);
          if(byInvestor && byInvestor.projectData) return byInvestor.projectData;
        }
      }catch(_){ }
      // Jeżeli aktywny inwestor jest znany, nie wolno podmieniać go projektem
      // wskazywanym przez stary/stale currentProjectId należący do innego inwestora.
      return null;
    }
    try{
      if(projectStore && typeof projectStore.getCurrentRecord === 'function'){
        const current = projectStore.getCurrentRecord();
        if(current && current.projectData) return current.projectData;
      }
    }catch(_){ }
    return null;
  }

  function load(){
    // 2B.3a: normalny odczyt projektu ma jedno źródło prawdy — projectStore.
    // fc_project_v1 i fc_project_backup_v1 pozostają jeszcze zapisami pomocniczymi,
    // ale nie mogą już automatycznie decydować o projekcie widocznym w aplikacji.
    const central = getCentralProjectForActiveContext();
    const chosen = central || (model && model.DEFAULT_PROJECT_DATA) || { schemaVersion:1 };
    return normalizeProject(chosen);
  }

  function save(data){
    const normalized = normalizeProject(data);
    const primaryKey = keys.projectData || 'fc_project_v1';
    const backupKey = keys.projectBackup || 'fc_project_backup_v1';
    const backupMetaKey = keys.projectBackupMeta || 'fc_project_backup_meta_v1';
    try{
      const currentRaw = loadRaw(primaryKey);
      if(currentRaw){
        storage.setRaw(backupKey, prepareRawForPersistence(currentRaw));
        storage.setJSON(backupMetaKey, { savedAt: Date.now() });
      }
    }catch(_){ }
    try{ storage.setJSON(primaryKey, prepareForPersistence(normalized)); }catch(_){ }
    try{
      if(projectStore && typeof projectStore.syncLegacyActiveProject === 'function') projectStore.syncLegacyActiveProject(normalized);
    }catch(_){ }
    return normalized;
  }

  FC.project = Object.assign({}, FC.project || {}, {
    CURRENT_SCHEMA_VERSION: model.CURRENT_SCHEMA_VERSION || (FC.project && FC.project.CURRENT_SCHEMA_VERSION) || 1,
    DEFAULT_PROJECT: model.DEFAULT_PROJECT_DATA || (FC.project && FC.project.DEFAULT_PROJECT) || { schemaVersion:1 },
    load,
    save,
    normalize: normalizeProject,
  });
})();
