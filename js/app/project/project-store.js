(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const keys = (FC.constants && FC.constants.STORAGE_KEYS) || {};
  const storage = FC.storage || {
    getJSON(_key, fallback){ return JSON.parse(JSON.stringify(fallback)); },
    setJSON(){},
    getRaw(){ return null; },
    setRaw(){}
  };
  const model = FC.projectModel || {};

  const PROJECTS_KEY = keys.projects || 'fc_projects_v1';
  const CURRENT_PROJECT_ID_KEY = keys.currentProjectId || 'fc_current_project_id_v1';
  const LEGACY_PROJECT_KEY = keys.projectData || 'fc_project_v1';

  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }

  function uid(){
    try{ return FC.utils && typeof FC.utils.uid === 'function' ? FC.utils.uid() : ('proj_' + Date.now()); }
    catch(_){ return 'proj_' + Date.now(); }
  }

  // derivedFacts to odtwarzalny cache roboczy szafki. Nie może być częścią trwałego zapisu projektu.
  // Funkcja zawsze pracuje na kopii, więc cache pozostaje dostępny w bieżącym obiekcie w RAM.
  function prepareProjectDataForPersistence(projectData){
    const out = clone(projectData && typeof projectData === 'object' ? projectData : {});
    Object.keys(out || {}).forEach((key)=> {
      if(key === 'schemaVersion' || key === 'meta') return;
      const room = out[key];
      if(!(room && typeof room === 'object' && Array.isArray(room.cabinets))) return;
      room.cabinets.forEach((cabinet)=> {
        if(!(cabinet && typeof cabinet === 'object')) return;
        try{ delete cabinet.derivedFacts; }catch(_){ }
        try{ delete cabinet._derivedFacts; }catch(_){ }
      });
    });
    return out;
  }

  function prepareRecordForPersistence(record){
    const normalized = normalizeRecord(record);
    if(!normalized) return null;
    const out = clone(normalized);
    out.projectData = prepareProjectDataForPersistence(normalized.projectData);
    return out;
  }

  function readAll(){
    const list = storage.getJSON(PROJECTS_KEY, []);
    return Array.isArray(list) ? list.map((row)=> normalizeRecord(row)).filter(Boolean) : [];
  }

  function writeAll(list, options){
    const normalized = Array.isArray(list) ? list.map((row)=> normalizeRecord(row)).filter(Boolean) : [];
    const persisted = normalized.map((row)=> prepareRecordForPersistence(row)).filter(Boolean);
    try{
      const current = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
      if(!Array.isArray(current)) return null;
      const session = FC.session;
      if(session && session.canSaveProject){
        const before = current.find(row=>row && String(row.id) === session.projectId);
        const after = persisted.find(row=>String(row.id) === session.projectId);
        if((!session.active || JSON.stringify(before) !== JSON.stringify(after)) && !session.canSaveProject()) return null;
      }
      for(const row of current.filter(item=>item && item.meta && item.meta.pendingDomainOperation)){
        const next = persisted.find(item=>item.id === row.id);
        if(!next || JSON.stringify(normalizeRecord(row)) !== JSON.stringify(normalizeRecord(next))) return null;
      }
    }catch(_){ return null; }
    const ok = storage.setJSON(PROJECTS_KEY, persisted);
    if(ok === false){
      try{
        const failure = typeof storage.getLastWriteError === 'function' ? storage.getLastWriteError() : null;
        const opts = options || {};
        let handled = false;
        if(opts.projectRecord && FC.projectFileRecovery && typeof FC.projectFileRecovery.handleProjectWriteFailure === 'function') {
          handled = FC.projectFileRecovery.handleProjectWriteFailure(failure, {
            projectRecord:opts.projectRecord,
            retry:typeof opts.retry === 'function' ? opts.retry : null,
          }) === true;
        }
        if(!handled && typeof storage.notifyWriteFailure === 'function') storage.notifyWriteFailure(failure, { label:'projektu' });
      }catch(_){
        try{
          const failure = typeof storage.getLastWriteError === 'function' ? storage.getLastWriteError() : null;
          if(typeof storage.notifyWriteFailure === 'function') storage.notifyWriteFailure(failure, { label:'projektu' });
        }catch(__){ }
      }
      return null;
    }
    return normalized;
  }

  function normalizeRecord(record){
    try{
      if(model && typeof model.normalizeProjectRecord === 'function') return model.normalizeProjectRecord(record);
    }catch(_){ }
    return record && typeof record === 'object' ? clone(record) : null;
  }

  function getCurrentProjectId(){
    try{ return String(storage.getRaw(CURRENT_PROJECT_ID_KEY) || ''); }catch(_){ return ''; }
  }

  function setCurrentProjectId(id){
    if(FC.session && FC.session.canSwitchProject && !FC.session.canSwitchProject(id)) return false;
    try{
      if(getCurrentProjectId()!==String(id || '') && FC.sessionNavigation && typeof FC.sessionNavigation.invalidateCalculationContext==='function')FC.sessionNavigation.invalidateCalculationContext();
      if(storage.setRaw(CURRENT_PROJECT_ID_KEY, String(id || '')) === false) return false;
      return String(storage.getRaw(CURRENT_PROJECT_ID_KEY) || '') === String(id || '') ? (id || '') : false;
    }catch(_){ return false; }
  }

  function inferTitle(investorId){
    try{
      const inv = FC.investors && typeof FC.investors.getById === 'function' ? FC.investors.getById(investorId) : null;
      if(inv){
        if(String(inv.companyName || '').trim()) return String(inv.companyName || '').trim();
        if(String(inv.name || '').trim()) return String(inv.name || '').trim();
      }
    }catch(_){ }
    return 'Projekt meblowy';
  }

  function getById(id){
    const key = String(id || '');
    if(!key) return null;
    return readAll().find((row)=> String(row.id || '') === key) || null;
  }

  function getByInvestorId(investorId){
    const key = String(investorId || '');
    if(!key) return null;
    return getUnambiguousInvestorProject(key);
  }

  function getCurrentRecord(){
    const id = getCurrentProjectId();
    return id ? getById(id) : null;
  }

  function getUnambiguousInvestorProject(investorId){
    const key = String(investorId || '');
    const current = getCurrentRecord();
    if(current && String(current.investorId || '') === key) return current;
    const matches = readAll().filter(row=>String(row.investorId || '') === key);
    return matches.length === 1 ? matches[0] : null;
  }

  function upsert(record){
    const normalized = normalizeRecord(record);
    if(!normalized) return null;
    const list = readAll();
    const existing = list.find(row=>String(row.id) === String(normalized.id));
    if(existing && existing.meta && existing.meta.pendingDomainOperation) return null;
    const idx = list.findIndex((row)=> String(row.id || '') === String(normalized.id || ''));
    if(idx >= 0) list[idx] = normalized;
    else list.unshift(normalized);
    const written = writeAll(list, {
      projectRecord:normalized,
      retry:()=> upsert(normalized),
    });
    if(!written) return null;
    return normalized;
  }

  // Conditional, verified write of one record. Used only by room/status recovery.
  function updateRecordConfirmed(record, expected){
    try{
      const observed = localStorage.getItem(PROJECTS_KEY);
      const rows = JSON.parse(observed);
      if(!Array.isArray(rows) || new Set(rows.map(row=>row && String(row.id))).size !== rows.length) return null;
      const index = rows.findIndex(row=>row && String(row.id) === String(record.id));
      if(index < 0 || JSON.stringify(normalizeRecord(rows[index])) !== JSON.stringify(expected)) return null;
      const normalized = prepareRecordForPersistence(record);
      if(!normalized || String(normalized.investorId) !== String(rows[index].investorId)) return null;
      if(FC.session && (!FC.session.active || String(record.id) === FC.session.projectId)
        && FC.session.canSaveProject && !FC.session.canSaveProject()) return null;
      rows[index] = Object.assign({}, rows[index], normalized);
      if(localStorage.getItem(PROJECTS_KEY) !== observed) return null;
      if(storage.setJSON(PROJECTS_KEY, rows) === false) return null;
      if(localStorage.getItem(PROJECTS_KEY) !== JSON.stringify(rows)) return null;
      return getById(record.id);
    }catch(_){ return null; }
  }

  function ensureForInvestor(investorId, options){
    const key = String(investorId || '');
    if(!key) return null;
    const existing = getUnambiguousInvestorProject(key);
    if(existing){
      if(setCurrentProjectId(existing.id) === false) return null;
      return existing;
    }
    if(FC.session && FC.session.canSwitchInvestor && !FC.session.canSwitchInvestor(key)) return null;
    if(readAll().some(row=>String(row.investorId || '') === key)) return null; // ambiguous, never create a duplicate
    const projectData = model && typeof model.normalizeProjectData === 'function'
      ? model.normalizeProjectData(options && options.projectData)
      : clone(options && options.projectData || {});
    projectData.meta = Object.assign({}, projectData.meta, {assignedInvestorId:key, productionPcvMode:'project'});
    const record = upsert({
      id: uid(),
      investorId:key,
      title:String(options && options.title || inferTitle(key)),
      status:String(options && options.status || 'nowy'),
      projectData,
      createdAt:Date.now(),
      updatedAt:Date.now(),
      meta:Object.assign({ source:'project-store' }, options && options.meta || {}),
    });
    if(record) setCurrentProjectId(record.id);
    return record;
  }

  function saveProjectDataForInvestor(investorId, projectData, options){
    const key = String(investorId || '');
    if(!key) return null;
    const explicitId = String(options && options.projectId || '').trim();
    const activeId = explicitId || getCurrentProjectId();
    const active = activeId ? getById(activeId) : null;
    if(explicitId && (!active || String(active.investorId || '') !== key)) return null;
    const matches = readAll().filter(row=>String(row.investorId || '') === key);
    const base = active && String(active.investorId || '') === key
      ? active
      : matches.length === 1 ? matches[0] : matches.length === 0 ? ensureForInvestor(key, options) : null;
    if(!base) return null;
    const session = FC.session;
    if(session && session.active && session.roomId){
      if(String(base.id) !== String(session.projectId) || !(FC.project && FC.project.saveConfirmed)) return null;
      const result = FC.project.saveConfirmed(projectData);
      return result && result.ok === true ? getById(base.id) : null;
    }
    const normalizedData = model && typeof model.normalizeProjectData === 'function'
      ? model.normalizeProjectData(projectData)
      : clone(projectData);
    if(matches.length === 0) normalizedData.meta = Object.assign({}, normalizedData.meta, {assignedInvestorId:key, productionPcvMode:'project'});
    const next = normalizeRecord({
      id: base.id,
      investorId: base.investorId,
      title:String(options && options.title || base.title || inferTitle(key)),
      status:String(options && options.status || base.status || 'nowy'),
      projectData:normalizedData,
      createdAt: base.createdAt,
      updatedAt:Date.now(),
      meta:Object.assign({}, base.meta || {}, options && options.meta || {}),
    });
    const saved = upsert(next);
    if(saved) setCurrentProjectId(saved.id);
    return saved;
  }

  function loadProjectDataForInvestor(investorId, fallback){
    const hasFallback = arguments.length > 1;
    const key = String(investorId || '');
    if(!key){
      if(!hasFallback && model && typeof model.normalizeProjectData === 'function') return model.normalizeProjectData(null);
      if(hasFallback && fallback == null) return null;
      return model && typeof model.normalizeProjectData === 'function'
        ? model.normalizeProjectData(fallback)
        : clone(fallback);
    }
    const record = getUnambiguousInvestorProject(key);
    if(record && record.projectData){
      if(setCurrentProjectId(record.id) === false) return null;
      return model && typeof model.normalizeProjectData === 'function'
        ? model.normalizeProjectData(record.projectData)
        : clone(record.projectData);
    }
    if(readAll().some(row=>String(row.investorId || '') === key)) return null; // ambiguous project ownership
    if(hasFallback && fallback == null) return null;
    return model && typeof model.normalizeProjectData === 'function'
      ? model.normalizeProjectData(fallback)
      : clone(fallback);
  }

  function removeByInvestorId(investorId){
    if(FC.session && FC.session.active && !FC.session.canSwitchInvestor('')) return false;
    const key = String(investorId || '');
    if(!key) return;
    if(readAll().some(row=>row.investorId === key && row.meta && row.meta.pendingDomainOperation)) return false;
    const currentId = getCurrentProjectId();
    const next = readAll().filter((row)=> String(row.investorId || '') !== key);
    writeAll(next);
    if(currentId && !next.some((row)=> String(row.id || '') === currentId)) setCurrentProjectId('');
  }

  function syncLegacyActiveProject(projectData){
    try{
      const normalized = model && typeof model.normalizeProjectData === 'function' ? model.normalizeProjectData(projectData) : clone(projectData);
      storage.setJSON(LEGACY_PROJECT_KEY, prepareProjectDataForPersistence(normalized));
    }catch(_){ }
  }

  FC.projectStore = {
    PROJECTS_KEY,
    CURRENT_PROJECT_ID_KEY,
    readAll,
    writeAll,
    normalizeRecord,
    prepareProjectDataForPersistence,
    prepareRecordForPersistence,
    getById,
    getByInvestorId,
    getCurrentRecord,
    ensureForInvestor,
    upsert,
    updateRecordConfirmed,
    saveProjectDataForInvestor,
    loadProjectDataForInvestor,
    removeByInvestorId,
    getCurrentProjectId,
    setCurrentProjectId,
    syncLegacyActiveProject,
  };
})();
