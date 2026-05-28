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

  FC.wycenaTabData = Object.assign({}, FC.wycenaTabData || {}, {
    getCurrentProjectId,
    getCurrentInvestorId,
    getSnapshotHistory,
    normalizeSnapshot,
    getOfferDraft,
    patchOfferDraft,
  });
})();
