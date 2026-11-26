(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  // Odpowiedzialność modułu: adaptery danych zakładki WYCENA bez renderu i bez logiki UI.

  function getCurrentProjectId(){
    try{ return FC.projectStore && typeof FC.projectStore.getCurrentProjectId === 'function' ? FC.projectStore.getCurrentProjectId() : ''; }catch(_){ return ''; }
  }

  function getCurrentInvestorId(){
    try{ return FC.investors && typeof FC.investors.getCurrentId === 'function' ? String(FC.investors.getCurrentId() || '') : ''; }catch(_){ return ''; }
  }

  function getSnapshotHistory(deps){
    const getProjectId = deps && typeof deps.getCurrentProjectId === 'function' ? deps.getCurrentProjectId : getCurrentProjectId;
    const getInvestorId = deps && typeof deps.getCurrentInvestorId === 'function' ? deps.getCurrentInvestorId : getCurrentInvestorId;
    try{
      if(!(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.listForProject === 'function')) return [];
      const projectId = String(getProjectId() || '');
      if(projectId) return FC.quoteSnapshotStore.listForProject(projectId);
      const investorId = String(getInvestorId() || '');
      if(investorId && typeof FC.quoteSnapshotStore.listForInvestor === 'function') return FC.quoteSnapshotStore.listForInvestor(investorId);
    }catch(_){ }
    return [];
  }

  function normalizeSnapshot(source){
    const snap = source && typeof source === 'object' ? source : null;
    if(!snap) return null;
    if(snap.lines && snap.totals) return snap;
    try{
      if(FC.quoteSnapshot && typeof FC.quoteSnapshot.buildSnapshot === 'function') return FC.quoteSnapshot.buildSnapshot(snap);
    }catch(_){ }
    return snap;
  }

  function getOfferDraft(){
    try{
      if(FC.quoteOfferStore && typeof FC.quoteOfferStore.getCurrentDraft === 'function') return FC.quoteOfferStore.getCurrentDraft();
    }catch(_){ }
    return { rateSelections:[], commercial:{} };
  }

  function patchOfferDraft(patch){
    try{
      if(FC.quoteOfferStore && typeof FC.quoteOfferStore.patchCurrentDraft === 'function') return FC.quoteOfferStore.patchCurrentDraft(patch);
    }catch(_){ }
    return null;
  }

  function calculationInputs(d){
    const draft=JSON.parse(JSON.stringify(d.getOfferDraft() || {}));
    delete draft.updatedAt;
    if(draft.commercial)delete draft.commercial.versionName;
    const excluded=new Set([FC.quoteOfferStore && FC.quoteOfferStore.DRAFT_KEY,'fc_ui_v1','fc_reload_restore_v1',
      (FC.constants && FC.constants.STORAGE_KEYS && FC.constants.STORAGE_KEYS.quoteSnapshots) || 'fc_quote_snapshots_v1']);
    const raw=Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter(key=>key && key!=='fc_rozrys_plan_cache_v2' && !(FC.dataStorageKeys && FC.dataStorageKeys.isSnapshotExcludedKey(key))).filter(key=>!excluded.has(key)).sort().map(key=>[key,localStorage.getItem(key)]);
    const controls=['rozUnit','rozW','rozH','rozK','rozTrim','rozMinScrapW','rozMinScrapH','rozHeur','rozDir','rozEdgeSub'].map(id=>{const el=document.getElementById(id);return [id,el?el.value:null];});
    return JSON.stringify([draft,raw,controls,typeof materials==='undefined'?null:materials,
      typeof accessories==='undefined'?null:accessories,typeof services==='undefined'?null:services,
      FC.materialCommon && [FC.materialCommon.FC_BOARD_THICKNESS_CM,FC.materialCommon.FC_TOP_TRAVERSE_DEPTH_CM],
      window.FC_BOARD_THICKNESS_CM,window.FC_TOP_TRAVERSE_DEPTH_CM]);
  }

  FC.wycenaTabData = Object.assign({}, FC.wycenaTabData || {}, {
    getCurrentProjectId,
    getCurrentInvestorId,
    getSnapshotHistory,
    normalizeSnapshot,
    getOfferDraft,
    patchOfferDraft,
    calculationInputs,
  });
})();
