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

  function saveConfirmed(data, options){
    const normalized = normalizeProject(data);
    const blocked = { ok:false, project:normalized };
    const session = FC.session;
    if(session && session.active && session.durable !== true
      && !(typeof session.begin === 'function' && session.begin() === true)) return blocked;
    if(session && session.canSaveProject && !session.canSaveProject()){
      return Object.assign(blocked, session.lastError || {});
    }
    const before = currentCentralRecord();
    const conditional = options && Object.prototype.hasOwnProperty.call(options,'expectedRecord');
    if(conditional && (!before || !options.expectedRecord || String(options.expectedRecord.id) !== String(before.id)
      || !projectStore || typeof projectStore.updateRecordConfirmed !== 'function')) return blocked;
    if(before && before.meta && before.meta.pendingDomainOperation) return blocked;
    const investorId = getCurrentInvestorId();
    if(before && investorId && String(before.investorId || '') !== investorId) return blocked;
    const narrow = !!(session && session.active && session.roomId);
    if(narrow && (!before || String(before.id) !== String(session.projectId))) return blocked;
    let projectToWrite = null;
    try{ projectToWrite = narrow ? scopedProjectData(normalized, before, session) : normalized; }catch(_){ return blocked; }
    if(!projectToWrite) return blocked;
    let saved = null;
    let summary = null;

    try{
      // Summarize the final merged scope, never the possibly stale full RAM draft.
      // Counters and projectData are persisted together, under the same guard.
      summary = typeof model.summarizeProjectData === 'function' ? model.summarizeProjectData(projectToWrite) : null;
      if(before && projectStore && typeof projectStore.upsert === 'function'){
        const nextRecord = Object.assign({}, before, summary, {
          projectData:projectToWrite,
          updatedAt:Date.now(),
        });
        // Optional optimistic guard for domain setters; legacy save callers keep their contract.
        saved = conditional ? projectStore.updateRecordConfirmed(nextRecord, options.expectedRecord) : projectStore.upsert(nextRecord);
      }else if(!narrow && investorId && projectStore && typeof projectStore.saveProjectDataForInvestor === 'function'){
        saved = projectStore.saveProjectDataForInvestor(investorId, projectToWrite);
      }
    }catch(_){ saved = null; }

    const centralWriteAcknowledged = !!saved;
    // The store must actually contain the expected project before reporting success.
    try{
      const readBack = saved && projectStore && typeof projectStore.getById === 'function' ? projectStore.getById(saved.id) : null;
      if(!readBack || JSON.stringify(prepareForPersistence(readBack.projectData)) !== JSON.stringify(prepareForPersistence(projectToWrite))) saved = null;
      if(readBack && summary && (readBack.roomCount !== summary.roomCount || readBack.cabinetCount !== summary.cabinetCount
        || JSON.stringify(readBack.roomKeys) !== JSON.stringify(summary.roomKeys))) saved = null;
    }catch(_){ saved = null; }
    if(!saved && centralWriteAcknowledged){
      if(session && session.active && session.markUnconfirmedProjectWrite) session.markUnconfirmedProjectWrite();
      return {ok:false,project:normalized,code:'SAVE_UNCONFIRMED',projectSaved:true};
    }
    if(saved && before && before.projectData) writeSafetyBackup(before.projectData);
    // A confirmed central write is not a confirmed session revision.
    if(saved && session && session.active && session.canSaveProject && !session.canSaveProject()){
      return Object.assign({ok:false, project:normalized, projectSaved:true}, session.lastError || {code:'SESSION_UNCONFIRMED'});
    }
    return { ok:!!saved, project:saved ? normalizeProject(projectToWrite) : normalized };
  }

  function save(data){
    // Existing callers assign this result to projectData, including on write failure.
    return saveConfirmed(data).project;
  }

  // Available before the optional UI policy. Missing policy never authorizes a marked project as legacy.
  function pcvError(code){
    if(FC.projectPcvResolver && typeof FC.projectPcvResolver.error === 'function') return FC.projectPcvResolver.error(code);
    const error = new Error('Nie można potwierdzić ustawień PCV projektu. (' + code + ')');
    error.code = 'PROJECT_PCV_' + code; error.projectPcv = true;
    return error;
  }
  function pcvPolicyState(config){
    const refuse = code => ({ok:false, code, projectModeRequired:true});
    const cfg = config || {};
    try{
      if(FC.projectPcvPolicy && !cfg.legacyWrite){
        const result = FC.projectPcvPolicy.read(config);
        if(!result || typeof result.ok !== 'boolean') return refuse('PCV_POLICY_UNAVAILABLE');
        if(result.ok && (!['legacy','project'].includes(result.mode) || !result.options
          || result.mode === 'project' && (!result.projectId || result.options.pcvMode !== 'project' || result.options.projectId !== result.projectId)))
          return refuse('PCV_POLICY_UNAVAILABLE');
        if(result.ok && result.mode === 'legacy'){
          const verified = pcvPolicyState({legacyWrite:true});
          if(!verified.ok) return verified;
          if(result.options.pcvMode || result.projectId && result.projectId !== verified.projectId) return refuse('PCV_POLICY_MISMATCH');
        }else if(result.ok){
          const id = FC.projectStore.getCurrentProjectId();
          const owners = FC.projectStore.readAll().filter(row => String(row.id) === String(id));
          if(id !== result.projectId || owners.length !== 1 || !window.projectData || !window.projectData.meta
            || window.projectData.meta.productionPcvMode !== 'project' || !owners[0].projectData.meta
            || owners[0].projectData.meta.productionPcvMode !== 'project') return refuse('PCV_POLICY_MISMATCH');
        }
        return result;
      }
      const ram = window.projectData;
      const ramMode = ram && ram.meta && ram.meta.productionPcvMode;
      if(ramMode) return refuse('PCV_POLICY_UNAVAILABLE');
      const store = FC.projectStore;
      if(!store){
        const raw = FC.storage && typeof FC.storage.getRaw === 'function' ? FC.storage.getRaw(keys.projects || 'fc_projects_v1')
          : window.localStorage && window.localStorage.getItem('fc_projects_v1');
        const rows = raw == null ? [] : JSON.parse(raw);
        if(!Array.isArray(rows) || rows.some(row => row.projectData && row.projectData.meta && row.projectData.meta.productionPcvMode))
          return refuse('PCV_POLICY_UNAVAILABLE');
        return {ok:true, mode:'legacy', options:{}};
      }
      const id = store.getCurrentProjectId(), rows = store.readAll();
      if(!Array.isArray(rows)) return refuse('PCV_POLICY_UNAVAILABLE');
      if(!id){
        return rows.some(row => row.projectData && row.projectData.meta && row.projectData.meta.productionPcvMode)
          ? refuse('PROJECT_REQUIRED') : {ok:true, mode:'legacy', options:{}};
      }
      const owners = rows.filter(row => String(row.id) === String(id));
      if(owners.length !== 1) return refuse('PROJECT_OWNER_AMBIGUOUS');
      const record = owners[0], mode = record.projectData && record.projectData.meta && record.projectData.meta.productionPcvMode;
      if(mode) return refuse('PCV_POLICY_UNAVAILABLE');
      // Classification only: the legacy setter still requires confirmed session.begin() before its first mutation.
      if(cfg.legacyWrite) return {ok:true, mode:'legacy', projectId:id, options:{}};
      const investorId = getCurrentInvestorId();
      if(!investorId || String(record.investorId) !== investorId || !ram || !ram.meta
        || String(ram.meta.assignedInvestorId) !== investorId) return refuse('INVESTOR_CONTEXT_MISMATCH');
      const session = FC.session;
      if(session && session.canSaveProject && session.canSaveProject() !== true)
        return Object.assign(refuse('SESSION_UNCONFIRMED'), session.lastError || {});
      if(session && session.active && (session.projectId !== id || !session.durable)) return refuse('EDIT_CONTEXT_MISMATCH');
      if(cfg.roomId && (!record.projectData[cfg.roomId] || !ram[cfg.roomId])) return refuse('ROOM_NOT_FOUND');
      return {ok:true, mode:'legacy', projectId:id, options:{}};
    }catch(_){ return refuse('PCV_POLICY_UNAVAILABLE'); }
  }
  function pcvCalculationOptions(requested){
    const state = pcvPolicyState({allowLegacy:requested && requested.pcvMode === 'project'});
    if(!state.ok) throw pcvError(state.code);
    const opts = requested || {};
    if(state.mode === 'project' && (opts.pcvMode && opts.pcvMode !== 'project' || opts.projectId && opts.projectId !== state.projectId))
      throw pcvError('PCV_POLICY_MISMATCH');
    return Object.assign({}, opts, state.options);
  }
  function notifyPcvFailure(result){
    if(FC.projectPcvPolicy && typeof FC.projectPcvPolicy.notify === 'function') return FC.projectPcvPolicy.notify(result);
    if(FC.infoBox && typeof FC.infoBox.open === 'function') FC.infoBox.open({title:'Nie potwierdzono PCV projektu', okOnly:true,
      message:'Obliczenie lub zapis zostały wstrzymane, aby chronić ustawienia projektu. Spróbuj ponownie po poprawnym załadowaniu aplikacji. (' + String(result && result.code || 'PCV_POLICY_UNAVAILABLE') + ')'});
  }
  FC.projectPcvGuard = {read:pcvPolicyState, calculationOptions:pcvCalculationOptions, error:pcvError, notify:notifyPcvFailure};

  FC.project = Object.assign({}, FC.project || {}, {
    CURRENT_SCHEMA_VERSION: model.CURRENT_SCHEMA_VERSION || (FC.project && FC.project.CURRENT_SCHEMA_VERSION) || 1,
    DEFAULT_PROJECT: model.DEFAULT_PROJECT_DATA || (FC.project && FC.project.DEFAULT_PROJECT) || { schemaVersion:1 },
    load,
    save,
    saveConfirmed,
    normalize: normalizeProject,
  });
})();
