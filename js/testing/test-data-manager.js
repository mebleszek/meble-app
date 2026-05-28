(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  const TEST_OWNER = 'dev-tests';
  const KEY_INVESTORS = 'fc_investors_v1';
  const KEY_CURRENT_INVESTOR = 'fc_current_investor_v1';
  const KEY_REMOVED_INVESTORS = 'fc_investor_removed_ids_v1';
  const KEY_PROJECTS = 'fc_projects_v1';
  const KEY_CURRENT_PROJECT = 'fc_current_project_id_v1';
  const KEY_CURRENT_PROJECT_DATA = 'fc_project_v1';

  const LEGACY_FIXTURE_IDS = new Set([
    'inv_new_only', 'inv_missing_old', 'inv_snapshot_only', 'inv_snapshot_only_test', 'inv_write_test_only',
    'inv_room_patch', 'inv_room_warning', 'inv_empty_rooms', 'inv_registry_contract', 'inv_late_flow',
    'inv_status_sync', 'inv_status_sync_a', 'inv_status_sync_b', 'inv_cleanup', 'inv_project_cleanup',
    'inv_cross', 'inv_hist', 'inv_pdf', 'inv_pdf_cross', 'inv_wycena_arch_contract', 'inv_wycena_scope_contract',
    'inv_wycena_selection_contract', 'inv_live', 'inv_old'
  ]);
  const LEGACY_FIXTURE_NAMES = new Set([
    'jan test', 'room patch', 'room warning', 'puste pokoje', 'registry contract', 'late flow',
    'sync test', 'test isolation', 'test cleanup', 'projektowy test', 'test', 'snapshot only',
    'stary inwestor', 'projekt starego inwestora', 'backup limit'
  ]);

  let activeRunId = '';

  function uid(){
    try{ return FC.utils && typeof FC.utils.uid === 'function' ? FC.utils.uid() : ('test_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)); }
    catch(_){ return 'test_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); }
  }

  function clone(value){
    try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; }
  }

  function currentRunId(){
    if(!activeRunId) activeRunId = uid();
    return activeRunId;
  }

  function beginRun(info){
    activeRunId = String(info && info.runId || uid());
    return { runId:activeRunId, owner:TEST_OWNER, mode:String(info && info.mode || '') };
  }

  function endRun(){ activeRunId = ''; }

  function normalizeText(text){
    return String(text == null ? '' : text)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  function buildMeta(kind, extra){
    const src = extra && typeof extra === 'object' ? extra : {};
    const runId = String(src.__testRunId || src.testRunId || activeRunId || uid());
    return Object.assign({}, src, {
      __test:true,
      __testRunId:runId,
      testData:true,
      testOwner:TEST_OWNER,
      testRunId:runId,
      createdBy:'test-data-manager',
      source:String(src.source || kind || 'test-data'),
    });
  }

  function markRecord(kind, initial){
    const src = initial && typeof initial === 'object' ? initial : {};
    const meta = buildMeta(kind, src.meta);
    return Object.assign({}, src, {
      __test:true,
      __testRunId:meta.__testRunId,
      meta,
    });
  }

  function isMarked(value, options){
    const opts = options && typeof options === 'object' ? options : {};
    try{
      if(FC.dataStorageClassifier && typeof FC.dataStorageClassifier.isTestMarked === 'function'){
        return FC.dataStorageClassifier.isTestMarked(value, opts);
      }
    }catch(_){ }
    const src = value && typeof value === 'object' ? value : {};
    const meta = src.meta && typeof src.meta === 'object' ? src.meta : {};
    const marked = src.__test === true || meta.__test === true || (!!meta.testData && String(meta.testOwner || '') === TEST_OWNER);
    if(!marked) return false;
    const runId = String(opts.runId || '').trim();
    if(!runId) return true;
    return String(src.__testRunId || meta.__testRunId || meta.testRunId || '') === runId;
  }

  function isKnownFixtureId(id){
    const raw = String(id || '').trim();
    if(!raw) return false;
    if(LEGACY_FIXTURE_IDS.has(raw)) return true;
    const normalized = normalizeText(raw);
    return /^inv_(room|registry|late|sync|status|wycena|hist|pdf|cross|cleanup|empty|snapshot|test)/.test(normalized)
      || /^proj_(recover|cross|hist|pdf|cleanup|test|wycena|status)/.test(normalized)
      || /^snap_(warn|late|recover|hist|pdf|test|scope|selected|final|pre)/.test(normalized)
      || normalized.indexOf('_test') >= 0;
  }

  function hasKnownFixtureName(row){
    const src = row && typeof row === 'object' ? row : {};
    const names = [src.name, src.companyName, src.title, src.label, src.clientName]
      .map(normalizeText)
      .filter(Boolean);
    return names.some((name)=> LEGACY_FIXTURE_NAMES.has(name));
  }

  function hasKnownFixtureSource(row){
    const src = row && typeof row === 'object' ? row : {};
    const meta = src.meta && typeof src.meta === 'object' ? src.meta : {};
    const source = normalizeText(meta.source || src.source || src.createdBy || meta.createdBy || '');
    return source.startsWith('test-') || source.indexOf('fixture') >= 0 || source === 'investor-recovery-fixture' || source === 'test-data-manager';
  }

  function isKnownLeakedInvestorFixture(value){
    const row = value && typeof value === 'object' ? value : {};
    const id = String(row.id || '').trim();
    if(isKnownFixtureId(id)) return true;
    if(hasKnownFixtureSource(row)) return true;
    if(hasKnownFixtureName(row)) return true;
    const name = normalizeText(row.name || row.companyName || '');
    const email = normalizeText(row.email || '');
    const city = normalizeText(row.city || '');
    const phone = String(row.phone || '').trim();
    if(name !== 'jan test') return false;
    return !phone || phone === '111' || email === 'jan@test.pl' || city === 'lodz';
  }

  function isKnownLeakedTestFixture(value){
    const row = value && typeof value === 'object' ? value : {};
    if(isKnownLeakedInvestorFixture(row)) return true;
    if(isKnownFixtureId(row.id) || isKnownFixtureId(row.investorId) || isKnownFixtureId(row.projectId)) return true;
    if(hasKnownFixtureSource(row) || hasKnownFixtureName(row)) return true;
    const investor = row.investor && typeof row.investor === 'object' ? row.investor : null;
    const project = row.project && typeof row.project === 'object' ? row.project : null;
    if(investor && (isKnownLeakedInvestorFixture(investor) || isKnownFixtureId(investor.id))) return true;
    if(project && (isKnownFixtureId(project.id) || isKnownFixtureId(project.investorId) || hasKnownFixtureName(project) || hasKnownFixtureSource(project))) return true;
    return false;
  }

  function parseJson(raw){
    if(typeof raw !== 'string') return null;
    try{ return JSON.parse(raw); }catch(_){ return null; }
  }

  function setJsonKey(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){ }
  }

  function readJsonArray(key){
    const parsed = parseJson((()=>{ try{ return localStorage.getItem(key); }catch(_){ return null; } })());
    return Array.isArray(parsed) ? parsed : [];
  }

  function readInvestorsForWrite(){
    try{
      if(FC.investors && FC.investors._debug && typeof FC.investors._debug.readStoredAll === 'function') return FC.investors._debug.readStoredAll();
      if(FC.investors && typeof FC.investors.readAll === 'function') return FC.investors.readAll();
    }catch(_){ }
    return readJsonArray(KEY_INVESTORS);
  }

  function writeInvestors(list){
    try{
      if(FC.investors && typeof FC.investors.writeAll === 'function'){
        FC.investors.writeAll(Array.isArray(list) ? list : []);
        return;
      }
    }catch(_){ }
    setJsonKey(KEY_INVESTORS, Array.isArray(list) ? list : []);
  }

  function unmarkRemovedInvestorId(id){
    const key = String(id || '').trim();
    if(!key) return;
    const rows = readJsonArray(KEY_REMOVED_INVESTORS).map((item)=> String(item || '').trim()).filter(Boolean);
    const next = rows.filter((item)=> item !== key);
    if(next.length !== rows.length) setJsonKey(KEY_REMOVED_INVESTORS, next);
  }

  function seedInvestor(initial, options){
    const opts = options && typeof options === 'object' ? options : {};
    const src = markRecord('investor', initial || {});
    if(!String(src.id || '').trim()) src.id = 'inv_test_' + uid().replace(/[^a-zA-Z0-9_\-]/g, '_');
    const normalized = FC.investorsModel && typeof FC.investorsModel.normalizeInvestor === 'function'
      ? FC.investorsModel.normalizeInvestor(src)
      : src;
    const id = String(normalized && normalized.id || '').trim();
    if(!id) return null;
    const list = readInvestorsForWrite().filter((row)=> String(row && row.id || '') !== id);
    list.unshift(normalized);
    writeInvestors(list);
    unmarkRemovedInvestorId(id);
    if(opts.current !== false){
      try{ if(FC.investors && typeof FC.investors.setCurrentId === 'function') FC.investors.setCurrentId(id); }
      catch(_){ try{ localStorage.setItem(KEY_CURRENT_INVESTOR, id); }catch(__){ } }
    }
    return normalized;
  }

  function createInvestor(initial){
    return seedInvestor(initial, { current:true });
  }

  function createServiceOrder(initial){
    if(!(FC.serviceOrderStore && typeof FC.serviceOrderStore.upsert === 'function')) return null;
    return FC.serviceOrderStore.upsert(markRecord('serviceOrder', initial));
  }

  function cleanupArrayKey(key, shouldRemove, onRemove){
    const parsed = readJsonArray(key);
    if(!Array.isArray(parsed)) return 0;
    const kept = [];
    let removed = 0;
    parsed.forEach((row)=>{
      if(shouldRemove(row)){
        removed++;
        if(typeof onRemove === 'function') onRemove(row);
      } else kept.push(row);
    });
    if(removed > 0) setJsonKey(key, kept);
    return removed;
  }

  function cleanupObjectMapKey(key, shouldRemove){
    const raw = (()=>{ try{ return localStorage.getItem(key); }catch(_){ return null; } })();
    const parsed = parseJson(raw);
    if(!(parsed && typeof parsed === 'object') || Array.isArray(parsed)) return 0;
    if(shouldRemove(parsed)){
      try{ localStorage.removeItem(key); }catch(_){ }
      return 1;
    }
    const next = clone(parsed) || {};
    let removed = 0;
    Object.keys(next).forEach((childKey)=>{
      if(shouldRemove(next[childKey])){ delete next[childKey]; removed++; }
    });
    if(removed > 0) setJsonKey(key, next);
    return removed;
  }

  function investorIdFromProjectSlotKey(key){
    return String(key || '').replace(/^fc_project_inv_/, '').replace(/_v1$/, '');
  }

  function cleanupProjectSlotKeys(removedInvestorIds, shouldRemove){
    let removed = 0;
    const ids = removedInvestorIds instanceof Set ? removedInvestorIds : new Set();
    try{
      for(let i = localStorage.length - 1; i >= 0; i--){
        const key = localStorage.key(i);
        if(!/^fc_project_inv_.+_v1$/.test(String(key || ''))) continue;
        if(/^fc_project_inv_.+_backup(?:_meta)?_v1$/.test(String(key || ''))) continue;
        const investorId = investorIdFromProjectSlotKey(key);
        const value = parseJson(localStorage.getItem(key));
        if(ids.has(investorId) || shouldRemove(value)){
          localStorage.removeItem(key);
          removed++;
        }
      }
    }catch(_){ }
    return removed;
  }

  function cleanupCurrentPointers(removedInvestorIds, removedProjectIds){
    let removed = 0;
    try{
      const currentInvestor = localStorage.getItem(KEY_CURRENT_INVESTOR);
      if(currentInvestor && removedInvestorIds.has(String(currentInvestor))){ localStorage.removeItem(KEY_CURRENT_INVESTOR); removed++; }
    }catch(_){ }
    try{
      const currentProject = localStorage.getItem(KEY_CURRENT_PROJECT);
      if(currentProject && removedProjectIds.has(String(currentProject))){ localStorage.removeItem(KEY_CURRENT_PROJECT); removed++; }
    }catch(_){ }
    try{
      const project = parseJson(localStorage.getItem(KEY_CURRENT_PROJECT_DATA));
      const assignedInvestorId = String(project && project.meta && project.meta.assignedInvestorId || project && project.investorId || '').trim();
      const projectId = String(project && project.id || project && project.meta && project.meta.projectId || '').trim();
      if((assignedInvestorId && removedInvestorIds.has(assignedInvestorId)) || (projectId && removedProjectIds.has(projectId)) || isKnownLeakedTestFixture(project)){
        localStorage.removeItem(KEY_CURRENT_PROJECT_DATA);
        removed++;
      }
    }catch(_){ }
    return removed;
  }

  function cleanupRemovedIdRegistry(removedInvestorIds){
    const rows = readJsonArray(KEY_REMOVED_INVESTORS).map((item)=> String(item || '').trim()).filter(Boolean);
    const next = rows.filter((id)=> !removedInvestorIds.has(id) && !isKnownFixtureId(id));
    if(next.length !== rows.length) setJsonKey(KEY_REMOVED_INVESTORS, next);
    return rows.length - next.length;
  }

  function cleanup(options){
    const opts = options && typeof options === 'object' ? options : {};
    const runId = String(opts.runId || '').trim();
    const shouldRemove = (row)=> isMarked(row, runId ? { runId } : {}) || (!runId && isKnownLeakedTestFixture(row));
    const summary = { investors:0, projects:0, serviceOrders:0, quoteSnapshots:0, quoteDrafts:0, catalogs:0, projectSlots:0, objectEntries:0, pointers:0, removedIds:0 };
    const removedInvestorIds = new Set();
    const removedProjectIds = new Set();

    try{
      if(FC.investors && typeof FC.investors.readAll === 'function' && typeof FC.investors.writeAll === 'function'){
        const before = FC.investors.readAll();
        const kept = [];
        before.forEach((row)=>{
          if(shouldRemove(row)){
            const id = String(row && row.id || '').trim();
            if(id) removedInvestorIds.add(id);
          } else kept.push(row);
        });
        if(removedInvestorIds.size){
          FC.investors.writeAll(kept);
          summary.investors = removedInvestorIds.size;
        }
      }
    }catch(_){ }

    try{
      if(FC.projectStore && typeof FC.projectStore.readAll === 'function' && typeof FC.projectStore.writeAll === 'function'){
        const beforeProjects = FC.projectStore.readAll();
        const kept = [];
        beforeProjects.forEach((row)=>{
          const investorId = String(row && row.investorId || '').trim();
          const remove = (investorId && removedInvestorIds.has(investorId)) || shouldRemove(row);
          if(remove){
            const projectId = String(row && row.id || '').trim();
            if(projectId) removedProjectIds.add(projectId);
            if(investorId) removedInvestorIds.add(investorId);
          } else kept.push(row);
        });
        summary.projects += beforeProjects.length - kept.length;
        if(kept.length !== beforeProjects.length) FC.projectStore.writeAll(kept);
      }
    }catch(_){ }

    try{
      if(FC.serviceOrderStore && typeof FC.serviceOrderStore.readAll === 'function' && typeof FC.serviceOrderStore.writeAll === 'function'){
        const before = FC.serviceOrderStore.readAll();
        const kept = before.filter((row)=> !shouldRemove(row));
        summary.serviceOrders += before.length - kept.length;
        if(kept.length !== before.length) FC.serviceOrderStore.writeAll(kept);
      }
    }catch(_){ }

    summary.quoteSnapshots += cleanupArrayKey('fc_quote_snapshots_v1', (row)=> {
      const projectId = String(row && row.project && row.project.id || row && row.projectId || '').trim();
      const investorId = String(row && row.investor && row.investor.id || row && row.project && row.project.investorId || row && row.investorId || '').trim();
      return shouldRemove(row) || (investorId && removedInvestorIds.has(investorId)) || (projectId && removedProjectIds.has(projectId));
    });
    summary.quoteDrafts += cleanupArrayKey('fc_quote_offer_drafts_v1', (row)=> {
      const projectId = String(row && row.projectId || row && row.project && row.project.id || '').trim();
      const investorId = String(row && row.investorId || row && row.project && row.project.investorId || '').trim();
      return shouldRemove(row) || (investorId && removedInvestorIds.has(investorId)) || (projectId && removedProjectIds.has(projectId));
    });
    ['fc_sheet_materials_v1','fc_materials_v1','fc_accessories_v1','fc_quote_rates_v1','fc_services_v1','fc_workshop_services_v1'].forEach((key)=>{
      summary.catalogs += cleanupArrayKey(key, shouldRemove);
    });
    summary.objectEntries += cleanupObjectMapKey('fc_edge_v1', shouldRemove);
    summary.objectEntries += cleanupObjectMapKey('fc_material_part_options_v1', shouldRemove);
    summary.projectSlots += cleanupProjectSlotKeys(removedInvestorIds, shouldRemove);
    summary.pointers += cleanupCurrentPointers(removedInvestorIds, removedProjectIds);
    summary.removedIds += cleanupRemovedIdRegistry(removedInvestorIds);
    return summary;
  }

  FC.testDataManager = {
    TEST_OWNER,
    beginRun,
    endRun,
    currentRunId,
    buildMeta,
    markRecord,
    isMarked,
    isKnownLeakedInvestorFixture,
    isKnownLeakedTestFixture,
    seedInvestor,
    createInvestor,
    createServiceOrder,
    cleanup,
  };
})(typeof window !== 'undefined' ? window : globalThis);
