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

  function readAll(){
    const list = storage.getJSON(PROJECTS_KEY, []);
    return Array.isArray(list) ? list.map((row)=> normalizeRecord(row)).filter(Boolean) : [];
  }

  function writeAll(list){
    const normalized = Array.isArray(list) ? list.map((row)=> normalizeRecord(row)).filter(Boolean) : [];
    storage.setJSON(PROJECTS_KEY, normalized);
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
    try{ storage.setRaw(CURRENT_PROJECT_ID_KEY, String(id || '')); }catch(_){ }
    return id || '';
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
    return readAll().find((row)=> String(row.investorId || '') === key) || null;
  }

  function getCurrentRecord(){
    const id = getCurrentProjectId();
    return id ? getById(id) : null;
  }

  function upsert(record){
    const normalized = normalizeRecord(record);
    if(!normalized) return null;
    const list = readAll();
    const idx = list.findIndex((row)=> String(row.id || '') === String(normalized.id || ''));
    if(idx >= 0) list[idx] = normalized;
    else list.unshift(normalized);
    writeAll(list);
    return normalized;
  }

  function ensureForInvestor(investorId, options){
    const key = String(investorId || '');
    if(!key) return null;
    const existing = getByInvestorId(key);
    if(existing){
      setCurrentProjectId(existing.id);
      return existing;
    }
    const projectData = model && typeof model.normalizeProjectData === 'function'
      ? model.normalizeProjectData(options && options.projectData)
      : clone(options && options.projectData || {});
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
    const base = getByInvestorId(key) || ensureForInvestor(key, options);
    if(!base) return null;
    const normalizedData = model && typeof model.normalizeProjectData === 'function'
      ? model.normalizeProjectData(projectData)
      : clone(projectData);
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
    const record = getByInvestorId(key);
    if(record && record.projectData){
      setCurrentProjectId(record.id);
      return model && typeof model.normalizeProjectData === 'function'
        ? model.normalizeProjectData(record.projectData)
        : clone(record.projectData);
    }
    if(hasFallback && fallback == null) return null;
    return model && typeof model.normalizeProjectData === 'function'
      ? model.normalizeProjectData(fallback)
      : clone(fallback);
  }

  function removeByInvestorId(investorId){
    const key = String(investorId || '');
    if(!key) return;
    const currentId = getCurrentProjectId();
    const next = readAll().filter((row)=> String(row.investorId || '') !== key);
    writeAll(next);
    if(currentId && !next.some((row)=> String(row.id || '') === currentId)) setCurrentProjectId('');
  }

  function syncLegacyActiveProject(projectData){
    try{ storage.setJSON(LEGACY_PROJECT_KEY, model && typeof model.normalizeProjectData === 'function' ? model.normalizeProjectData(projectData) : clone(projectData)); }catch(_){ }
  }

  FC.projectStore = {
    PROJECTS_KEY,
    CURRENT_PROJECT_ID_KEY,
    readAll,
    writeAll,
    normalizeRecord,
    getById,
    getByInvestorId,
    getCurrentRecord,
    ensureForInvestor,
    upsert,
    saveProjectDataForInvestor,
    loadProjectDataForInvestor,
    removeByInvestorId,
    getCurrentProjectId,
    setCurrentProjectId,
    syncLegacyActiveProject,
  };
})();
