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

  function loadRaw(key){
    try{ return storage.getRaw(key); }catch(_){ return null; }
  }

  function load(){
    const primaryKey = keys.projectData || 'fc_project_v1';
    const backupKey = keys.projectBackup || 'fc_project_backup_v1';
    const rawPrimary = loadRaw(primaryKey);
    const rawBackup = loadRaw(backupKey);
    function parseOrNull(raw){ if(!raw) return null; try{ return JSON.parse(raw); }catch(_){ return null; } }
    const chosen = parseOrNull(rawPrimary) || parseOrNull(rawBackup) || (model && model.DEFAULT_PROJECT_DATA) || { schemaVersion:1 };
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
        storage.setRaw(backupKey, currentRaw);
        storage.setJSON(backupMetaKey, { savedAt: Date.now() });
      }
    }catch(_){ }
    try{ storage.setJSON(primaryKey, normalized); }catch(_){ }
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
