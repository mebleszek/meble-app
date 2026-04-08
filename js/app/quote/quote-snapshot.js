(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }

  function currentInvestor(){
    try{ return FC.investors && typeof FC.investors.getById === 'function' && typeof FC.investors.getCurrentId === 'function' ? FC.investors.getById(FC.investors.getCurrentId()) : null; }
    catch(_){ return null; }
  }

  function currentProjectRecord(){
    try{
      if(FC.projectStore && typeof FC.projectStore.getCurrentRecord === 'function'){
        const current = FC.projectStore.getCurrentRecord();
        if(current) return current;
      }
      const inv = currentInvestor();
      return inv && FC.projectStore && typeof FC.projectStore.getByInvestorId === 'function' ? FC.projectStore.getByInvestorId(inv.id) : null;
    }catch(_){ return null; }
  }

  function buildSnapshot(payload){
    const src = payload && typeof payload === 'object' ? payload : {};
    const investor = src.investor || currentInvestor() || null;
    const projectRecord = src.projectRecord || currentProjectRecord() || null;
    const roomIds = Array.isArray(src.selectedRooms) ? src.selectedRooms.slice() : [];
    const roomLabels = Array.isArray(src.roomLabels) ? src.roomLabels.slice() : [];
    const generatedAt = Number(src.generatedAt) > 0 ? Number(src.generatedAt) : Date.now();
    const materialLines = Array.isArray(src.materialLines) ? clone(src.materialLines) : [];
    const accessoryLines = Array.isArray(src.accessoryLines) ? clone(src.accessoryLines) : [];
    const agdLines = Array.isArray(src.agdLines) ? clone(src.agdLines) : [];
    const totals = clone(src.totals || {});
    return {
      version: 1,
      generatedAt,
      generatedDate: (()=>{ try{ return new Date(generatedAt).toISOString(); }catch(_){ return ''; } })(),
      investor: investor ? {
        id: String(investor.id || ''),
        kind: String(investor.kind || ''),
        name: String(investor.name || investor.companyName || ''),
        companyName: String(investor.companyName || ''),
      } : null,
      project: projectRecord ? {
        id: String(projectRecord.id || ''),
        investorId: String(projectRecord.investorId || ''),
        title: String(projectRecord.title || ''),
        status: String(projectRecord.status || ''),
      } : null,
      scope: {
        selectedRooms: roomIds,
        roomLabels,
      },
      catalogs: FC.catalogSelectors && typeof FC.catalogSelectors.getFurnitureCatalogSnapshot === 'function'
        ? FC.catalogSelectors.getFurnitureCatalogSnapshot()
        : null,
      lines: {
        materials: materialLines,
        accessories: accessoryLines,
        agdServices: agdLines,
      },
      totals,
    };
  }

  async function buildFromCore(){
    if(!(FC.wycenaCore && typeof FC.wycenaCore.collectQuoteData === 'function')) return buildSnapshot({});
    const data = await FC.wycenaCore.collectQuoteData();
    return buildSnapshot(data);
  }

  function saveSnapshot(snapshot){
    const normalized = buildSnapshot(snapshot);
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.save === 'function') return FC.quoteSnapshotStore.save(normalized);
    }catch(_){ }
    return normalized;
  }

  FC.quoteSnapshot = {
    buildSnapshot,
    buildFromCore,
    saveSnapshot,
  };
})();
