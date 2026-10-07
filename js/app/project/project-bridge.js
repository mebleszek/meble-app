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

  function currentCentralRecord(){
    const investorId = getCurrentInvestorId();
    if(investorId){
      try{
        if(projectStore && typeof projectStore.getByInvestorId === 'function'){
          const record = projectStore.getByInvestorId(investorId);
          if(record) return record;
        }
      }catch(_){ }
    }
    try{
      if(projectStore && typeof projectStore.getCurrentRecord === 'function') return projectStore.getCurrentRecord();
    }catch(_){ }
    return null;
  }

  function writeSafetyBackup(projectData){
    if(!projectData) return false;
    const backupKey = keys.projectBackup || 'fc_project_backup_v1';
    const backupMetaKey = keys.projectBackupMeta || 'fc_project_backup_meta_v1';
    try{
      const ok = storage.setJSON(backupKey, prepareForPersistence(projectData));
      if(ok === false) return false;
      storage.setJSON(backupMetaKey, { savedAt: Date.now() });
      return true;
    }catch(_){ return false; }
  }

  function saveConfirmed(data){
    const normalized = normalizeProject(data);
    const before = currentCentralRecord();
    const investorId = getCurrentInvestorId();
    let saved = null;

    // 2B.3b: pełny projekt zapisujemy wyłącznie do centralnego projectStore.
    // fc_project_v1 i fc_project_inv_* nie są już normalnymi mirrorami zapisu.
    try{
      if(investorId && projectStore && typeof projectStore.saveProjectDataForInvestor === 'function'){
        saved = projectStore.saveProjectDataForInvestor(investorId, normalized);
      }else if(before && projectStore && typeof projectStore.upsert === 'function'){
        saved = projectStore.upsert(Object.assign({}, before, {
          projectData:normalized,
          updatedAt:Date.now(),
        }));
      }
    }catch(_){ saved = null; }

    // Backup jest tylko zabezpieczeniem. Powstaje dopiero po potwierdzonym zapisie
    // centralnym i zawiera poprzedni stan projektu, nigdy nowszy od źródła prawdy.
    if(saved && before && before.projectData) writeSafetyBackup(before.projectData);
    return { ok:!!saved, project:normalized };
  }

  function save(data){
    // Existing callers assign this result to projectData, including on write failure.
    return saveConfirmed(data).project;
  }

  FC.project = Object.assign({}, FC.project || {}, {
    CURRENT_SCHEMA_VERSION: model.CURRENT_SCHEMA_VERSION || (FC.project && FC.project.CURRENT_SCHEMA_VERSION) || 1,
    DEFAULT_PROJECT: model.DEFAULT_PROJECT_DATA || (FC.project && FC.project.DEFAULT_PROJECT) || { schemaVersion:1 },
    load,
    save,
    saveConfirmed,
    normalize: normalizeProject,
  });
})();
