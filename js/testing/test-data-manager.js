(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  const TEST_OWNER = 'dev-tests';
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

  function createInvestor(initial){
    if(!(FC.investors && typeof FC.investors.create === 'function')) return null;
    return FC.investors.create(markRecord('investor', initial));
  }

  function createServiceOrder(initial){
    if(!(FC.serviceOrderStore && typeof FC.serviceOrderStore.upsert === 'function')) return null;
    return FC.serviceOrderStore.upsert(markRecord('serviceOrder', initial));
  }

  function isKnownLeakedInvestorFixture(value){
    const row = value && typeof value === 'object' ? value : {};
    const id = String(row.id || '').trim();
    if(id === 'inv_new_only') return true;
    if(id === 'inv_missing_old') return true;
    if(id === 'inv_snapshot_only' || id === 'inv_snapshot_only_test' || id === 'inv_write_test_only') return true;
    const name = String(row.name || row.companyName || '').trim().toLowerCase();
    const email = String(row.email || '').trim().toLowerCase();
    const city = String(row.city || '').trim().toLowerCase();
    const phone = String(row.phone || '').trim();
    if(!id || name !== 'jan test') return false;
    return phone === '111' || email === 'jan@test.pl' || city === 'łódź' || city === 'lodz';
  }

  function parseJson(raw){
    if(typeof raw !== 'string') return null;
    try{ return JSON.parse(raw); }catch(_){ return null; }
  }

  function setJsonKey(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){ }
  }

  function cleanupArrayKey(key, shouldRemove){
    const raw = (()=>{ try{ return localStorage.getItem(key); }catch(_){ return null; } })();
    const parsed = parseJson(raw);
    if(!Array.isArray(parsed)) return 0;
    const kept = parsed.filter((row)=> !shouldRemove(row));
    const removed = parsed.length - kept.length;
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

  function cleanupProjectSlotKeys(removedInvestorIds, shouldRemove){
    let removed = 0;
    const ids = removedInvestorIds instanceof Set ? removedInvestorIds : new Set();
    try{
      for(let i = localStorage.length - 1; i >= 0; i--){
        const key = localStorage.key(i);
        if(!/^fc_project_inv_.+_v1$/.test(String(key || ''))) continue;
        const id = String(key).replace(/^fc_project_inv_/, '').replace(/_v1$/, '');
        const value = parseJson(localStorage.getItem(key));
        if(ids.has(id) || shouldRemove(value)){
          localStorage.removeItem(key);
          removed++;
        }
      }
    }catch(_){ }
    return removed;
  }

  function cleanup(options){
    const opts = options && typeof options === 'object' ? options : {};
    const runId = String(opts.runId || '').trim();
    const shouldRemove = (row)=> isMarked(row, runId ? { runId } : {}) || (!runId && isKnownLeakedInvestorFixture(row));
    const summary = { investors:0, projects:0, serviceOrders:0, quoteSnapshots:0, quoteDrafts:0, catalogs:0, projectSlots:0, objectEntries:0 };
    const removedInvestorIds = new Set();
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
          try{
            if(FC.investors.getCurrentId && removedInvestorIds.has(String(FC.investors.getCurrentId() || ''))) FC.investors.setCurrentId(null);
          }catch(_){ }
        }
      }
    }catch(_){ }

    try{
      if(FC.projectStore && typeof FC.projectStore.readAll === 'function' && typeof FC.projectStore.writeAll === 'function'){
        const beforeProjects = FC.projectStore.readAll();
        const kept = beforeProjects.filter((row)=> !removedInvestorIds.has(String(row && row.investorId || '')) && !shouldRemove(row));
        summary.projects += beforeProjects.length - kept.length;
        if(kept.length !== beforeProjects.length){
          FC.projectStore.writeAll(kept);
          try{
            const current = FC.projectStore.getCurrentProjectId && FC.projectStore.getCurrentProjectId();
            if(current && !kept.some((row)=> String(row && row.id || '') === String(current))) FC.projectStore.setCurrentProjectId('');
          }catch(_){ }
        }
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

    summary.quoteSnapshots += cleanupArrayKey('fc_quote_snapshots_v1', (row)=> shouldRemove(row) || removedInvestorIds.has(String(row && row.investor && row.investor.id || '')) || removedInvestorIds.has(String(row && row.project && row.project.investorId || '')));
    summary.quoteDrafts += cleanupArrayKey('fc_quote_offer_drafts_v1', (row)=> shouldRemove(row) || removedInvestorIds.has(String(row && row.investorId || '')));
    ['fc_sheet_materials_v1','fc_materials_v1','fc_accessories_v1','fc_quote_rates_v1','fc_services_v1','fc_workshop_services_v1'].forEach((key)=>{
      summary.catalogs += cleanupArrayKey(key, shouldRemove);
    });
    summary.objectEntries += cleanupObjectMapKey('fc_edge_v1', shouldRemove);
    summary.objectEntries += cleanupObjectMapKey('fc_material_part_options_v1', shouldRemove);
    summary.projectSlots += cleanupProjectSlotKeys(removedInvestorIds, shouldRemove);
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
    createInvestor,
    createServiceOrder,
    cleanup,
  };
})(typeof window !== 'undefined' ? window : globalThis);
