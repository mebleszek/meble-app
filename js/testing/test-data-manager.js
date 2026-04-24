(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  const TEST_OWNER = 'dev-tests';

  function uid(){
    try{ return FC.utils && typeof FC.utils.uid === 'function' ? FC.utils.uid() : ('test_' + Date.now()); }
    catch(_){ return 'test_' + Date.now(); }
  }

  function buildMeta(kind, extra){
    return Object.assign({}, extra || {}, {
      testData:true,
      testOwner:TEST_OWNER,
      testRunId:String(extra && extra.testRunId || uid()),
      createdBy:'test-data-manager',
      source:String(extra && extra.source || kind || 'test-data'),
    });
  }

  function isMarked(value){
    return !!(value && value.meta && value.meta.testData && String(value.meta.testOwner || '') === TEST_OWNER);
  }

  function createInvestor(initial){
    if(!(FC.investors && typeof FC.investors.create === 'function')) return null;
    return FC.investors.create(Object.assign({}, initial || {}, { meta:buildMeta('investor', initial && initial.meta) }));
  }

  function createServiceOrder(initial){
    if(!(FC.serviceOrderStore && typeof FC.serviceOrderStore.upsert === 'function')) return null;
    return FC.serviceOrderStore.upsert(Object.assign({}, initial || {}, { meta:buildMeta('serviceOrder', initial && initial.meta) }));
  }

  function isKnownLeakedInvestorFixture(value){
    const row = value && typeof value === 'object' ? value : {};
    const id = String(row.id || '').trim();
    if(id === 'inv_new_only') return true;
    if(id === 'inv_missing_old') return true;
    if(id === 'inv_snapshot_only' || id === 'inv_snapshot_only_test' || id === 'inv_write_test_only') return true;
    const name = String(row.name || row.companyName || '').trim().toLowerCase();
    return id && name === 'jan test' && String(row.phone || '') === '111';
  }

  function cleanup(){
    const summary = { investors:0, projects:0, serviceOrders:0 };
    try{
      if(FC.investors && typeof FC.investors.readAll === 'function' && typeof FC.investors.writeAll === 'function'){
        const before = FC.investors.readAll();
        const removedIds = before.filter((row)=> isMarked(row) || isKnownLeakedInvestorFixture(row)).map((row)=> String(row.id || '')).filter(Boolean);
        if(removedIds.length){
          FC.investors.writeAll(before.filter((row)=> !removedIds.includes(String(row && row.id || ''))));
          summary.investors = removedIds.length;
          try{
            if(FC.investors.getCurrentId && removedIds.includes(String(FC.investors.getCurrentId() || ''))) FC.investors.setCurrentId(null);
          }catch(_){ }
          try{
            removedIds.forEach((id)=>{
              try{ localStorage.removeItem(`fc_project_inv_${String(id)}_v1`); }catch(_){ }
            });
          }catch(_){ }
          try{
            if(FC.projectStore && typeof FC.projectStore.readAll === 'function' && typeof FC.projectStore.writeAll === 'function'){
              const beforeProjects = FC.projectStore.readAll();
              const kept = beforeProjects.filter((row)=> !removedIds.includes(String(row && row.investorId || '')) && !isMarked(row));
              summary.projects = beforeProjects.length - kept.length;
              FC.projectStore.writeAll(kept);
              try{
                const current = FC.projectStore.getCurrentProjectId && FC.projectStore.getCurrentProjectId();
                if(current && !kept.some((row)=> String(row && row.id || '') === String(current))) FC.projectStore.setCurrentProjectId('');
              }catch(_){ }
            }
          }catch(_){ }
        }
      }
    }catch(_){ }
    try{
      if(FC.serviceOrderStore && typeof FC.serviceOrderStore.readAll === 'function' && typeof FC.serviceOrderStore.writeAll === 'function'){
        const before = FC.serviceOrderStore.readAll();
        const kept = before.filter((row)=> !isMarked(row));
        summary.serviceOrders = before.length - kept.length;
        FC.serviceOrderStore.writeAll(kept);
      }
    }catch(_){ }
    return summary;
  }

  FC.testDataManager = {
    TEST_OWNER,
    buildMeta,
    isMarked,
    createInvestor,
    createServiceOrder,
    cleanup,
  };
})(typeof window !== 'undefined' ? window : globalThis);
