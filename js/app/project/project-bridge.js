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

  function centralRecordForContext(){
    const investorId = getCurrentInvestorId();
    try{
      if(projectStore && typeof projectStore.getCurrentProjectId === 'function' && typeof projectStore.getById === 'function'){
        const id = String(projectStore.getCurrentProjectId() || '');
        const current = id && projectStore.getById(id);
        if(current && (!investorId || String(current.investorId || '') === investorId)) return current;
      }
    }catch(_){ }
    if(!investorId || !projectStore || typeof projectStore.readAll !== 'function') return null;
    try{
      const matches = projectStore.readAll().filter(row=>String(row.investorId || '') === investorId);
      // Never choose an arbitrary first record when several records share an investor.
      return matches.length === 1 ? matches[0] : null;
    }catch(_){ return null; }
  }

  function getCentralProjectForActiveContext(){
    const record = centralRecordForContext();
    return record && record.projectData || null;
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
    return centralRecordForContext();
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

  function scopedProjectData(draft, currentRecord, session){
    const roomId = String(session && session.roomId || '');
    if(!roomId || !session.snapshot || !session.snapshot.fc_projects_v1) return null;
    const saved = JSON.parse(session.snapshot.fc_projects_v1);
    if(!Array.isArray(saved)) return null;
    const originalRecord = saved.find(row=>String(row && row.id || '') === String(session.projectId || ''));
    if(!originalRecord || !originalRecord.projectData || !currentRecord || String(currentRecord.id || '') !== String(session.projectId || '')) return null;
    const baseline = prepareForPersistence(normalizeProject(originalRecord.projectData));
    const input = prepareForPersistence(draft);
    const current = prepareForPersistence(currentRecord.projectData);
    if(!Object.prototype.hasOwnProperty.call(baseline,roomId)
      || !Object.prototype.hasOwnProperty.call(input,roomId)
      || !Object.prototype.hasOwnProperty.call(current,roomId)) return null;

    const withoutOwnedRoom = (value)=>{
      const cloned = JSON.parse(JSON.stringify(value));
      delete cloned[roomId];
      if(cloned.meta && cloned.meta.roomDefs && typeof cloned.meta.roomDefs === 'object'){
        delete cloned.meta.roomDefs[roomId];
      }
      return cloned;
    };
    // Refuse edits of global metadata, room order or other rooms in this narrow session.
    const inputRest = withoutOwnedRoom(input), baselineRest = withoutOwnedRoom(baseline), currentRest = withoutOwnedRoom(current);
    // A successful merge returns current data from other rooms. Accept those fresh
    // values as well as the original stale values, but never write them back.
    for(const key of new Set([...Object.keys(inputRest), ...Object.keys(baselineRest), ...Object.keys(currentRest)])){
      const raw = JSON.stringify(inputRest[key]);
      if(raw !== JSON.stringify(baselineRest[key]) && raw !== JSON.stringify(currentRest[key])) return null;
    }
    const merged = JSON.parse(JSON.stringify(current));
    merged[roomId] = input[roomId];
    const sourceDefs = input.meta && input.meta.roomDefs || {};
    const baselineDefs = baseline.meta && baseline.meta.roomDefs || {};
    const originalDef = Object.prototype.hasOwnProperty.call(baselineDefs,roomId);
    const draftDef = Object.prototype.hasOwnProperty.call(sourceDefs,roomId);
    const definitionChanged = originalDef !== draftDef
      || (originalDef && JSON.stringify(baselineDefs[roomId]) !== JSON.stringify(sourceDefs[roomId]));
    if(definitionChanged){
      if(draftDef){
        const meta = merged.meta && typeof merged.meta === 'object' ? merged.meta : (merged.meta = {});
        const defs = meta.roomDefs && typeof meta.roomDefs === 'object' ? meta.roomDefs : (meta.roomDefs = {});
        defs[roomId] = sourceDefs[roomId];
      }else if(merged.meta && merged.meta.roomDefs) delete merged.meta.roomDefs[roomId];
    }
    return merged;
  }

  function saveConfirmed(data){
    const normalized = normalizeProject(data);
    const blocked = { ok:false, project:normalized };
    if(FC.session && FC.session.canSaveProject && !FC.session.canSaveProject()) return blocked;
    const before = currentCentralRecord();
    if(before && before.meta && before.meta.pendingDomainOperation) return blocked;
    const investorId = getCurrentInvestorId();
    if(before && investorId && String(before.investorId || '') !== investorId) return blocked;
    const session = FC.session;
    if(session && session.active && session.durable !== true
      && !(typeof session.begin === 'function' && session.begin() === true)) return blocked;
    const narrow = !!(session && session.active && session.roomId);
    if(narrow && (!before || String(before.id) !== String(session.projectId))) return blocked;
    let projectToWrite = null;
    try{ projectToWrite = narrow ? scopedProjectData(normalized, before, session) : normalized; }catch(_){ return blocked; }
    if(!projectToWrite) return blocked;
    let saved = null;

    try{
      if(before && projectStore && typeof projectStore.upsert === 'function'){
        saved = projectStore.upsert(Object.assign({}, before, {
          projectData:projectToWrite,
          updatedAt:Date.now(),
        }));
      }else if(!narrow && investorId && projectStore && typeof projectStore.saveProjectDataForInvestor === 'function'){
        saved = projectStore.saveProjectDataForInvestor(investorId, projectToWrite);
      }
    }catch(_){ saved = null; }

    // The store must actually contain the expected project before reporting success.
    try{
      const readBack = saved && projectStore && typeof projectStore.getById === 'function' ? projectStore.getById(saved.id) : null;
      if(!readBack || JSON.stringify(prepareForPersistence(readBack.projectData)) !== JSON.stringify(prepareForPersistence(projectToWrite))) saved = null;
    }catch(_){ saved = null; }
    if(saved && before && before.projectData) writeSafetyBackup(before.projectData);
    return { ok:!!saved, project:saved ? normalizeProject(projectToWrite) : normalized };
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
