(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }

  function num(value, fallback){
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
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

  function normalizeLine(line){
    const row = line && typeof line === 'object' ? line : {};
    return {
      key: String(row.key || row.id || ''),
      type: String(row.type || ''),
      category: String(row.category || ''),
      name: String(row.name || ''),
      qty: Math.max(0, num(row.qty, 0)),
      unit: String(row.unit || ''),
      unitPrice: Math.max(0, num(row.unitPrice, 0)),
      total: Math.max(0, num(row.total, 0)),
      rooms: String(row.rooms || '').trim(),
      note: String(row.note || '').trim(),
      source: String(row.source || '').trim(),
    };
  }

  function normalizeLines(rows){
    return Array.isArray(rows) ? rows.map(normalizeLine) : [];
  }

  function normalizeCommercial(src){
    const value = src && typeof src === 'object' ? src : {};
    let discountPercent = Math.max(0, num(value.discountPercent, 0));
    let discountAmount = Math.max(0, num(value.discountAmount, 0));
    if(discountPercent > 0) discountAmount = 0;
    if(discountAmount > 0) discountPercent = 0;
    return {
      versionName: String(value.versionName || '').trim(),
      preliminary: !!value.preliminary,
      discountPercent,
      discountAmount,
      offerValidity: String(value.offerValidity || '').trim(),
      leadTime: String(value.leadTime || '').trim(),
      deliveryTerms: String(value.deliveryTerms || '').trim(),
      customerNote: String(value.customerNote || '').trim(),
    };
  }

  function normalizeMaterialScope(value){
    try{
      if(FC.rozrysScope && typeof FC.rozrysScope.encodeMaterialScope === 'function' && typeof FC.rozrysScope.decodeMaterialScope === 'function'){
        return FC.rozrysScope.decodeMaterialScope(FC.rozrysScope.encodeMaterialScope(value || {}));
      }
    }catch(_){ }
    const src = value && typeof value === 'object' ? value : {};
    const includeFronts = src.includeFronts !== false;
    const includeCorpus = src.includeCorpus !== false;
    return {
      kind:(src.kind === 'material' && String(src.material || '').trim()) ? 'material' : 'all',
      material:(src.kind === 'material' && String(src.material || '').trim()) ? String(src.material || '').trim() : '',
      includeFronts: includeFronts || (!includeFronts && !includeCorpus),
      includeCorpus: includeCorpus || (!includeFronts && !includeCorpus),
    };
  }

  function materialScopeMode(scope){
    const src = normalizeMaterialScope(scope);
    if(src.includeFronts && src.includeCorpus) return 'both';
    return src.includeFronts ? 'fronts' : 'corpus';
  }

  function computeTotals(raw, lines, commercial){
    const base = raw && typeof raw === 'object' ? raw : {};
    const materials = Math.max(0, num(base.materials, lines.materials.reduce((sum, row)=> sum + row.total, 0)));
    const accessories = Math.max(0, num(base.accessories, lines.accessories.reduce((sum, row)=> sum + row.total, 0)));
    const services = Math.max(0, num(base.services, lines.agdServices.reduce((sum, row)=> sum + row.total, 0)));
    const quoteRates = Math.max(0, num(base.quoteRates, lines.quoteRates.reduce((sum, row)=> sum + row.total, 0)));
    const subtotal = Math.max(0, num(base.subtotal, materials + accessories + services + quoteRates));
    let discount = Math.max(0, num(base.discount, 0));
    if(!(discount > 0)){
      if(commercial.discountPercent > 0) discount = subtotal * (commercial.discountPercent / 100);
      else if(commercial.discountAmount > 0) discount = commercial.discountAmount;
    }
    discount = Math.min(subtotal, Math.max(0, discount));
    const grand = Math.max(0, num(base.grand, subtotal - discount));
    return {
      materials,
      accessories,
      services,
      quoteRates,
      subtotal,
      discount,
      grand,
    };
  }

  function buildSnapshot(payload){
    const src = payload && typeof payload === 'object' ? payload : {};
    const investor = src.investor || currentInvestor() || null;
    const projectRecord = src.projectRecord || currentProjectRecord() || null;
    const roomIds = Array.isArray(src.selectedRooms) ? src.selectedRooms.slice() : (src.scope && Array.isArray(src.scope.selectedRooms) ? src.scope.selectedRooms.slice() : []);
    const roomLabels = Array.isArray(src.roomLabels) ? src.roomLabels.slice() : (src.scope && Array.isArray(src.scope.roomLabels) ? src.scope.roomLabels.slice() : []);
    const generatedAt = Number(src.generatedAt) > 0 ? Number(src.generatedAt) : Date.now();
    const lines = {
      materials: normalizeLines(src.materialLines || (src.lines && src.lines.materials)),
      accessories: normalizeLines(src.accessoryLines || (src.lines && src.lines.accessories)),
      agdServices: normalizeLines(src.agdLines || (src.lines && src.lines.agdServices)),
      quoteRates: normalizeLines(src.quoteRateLines || (src.lines && src.lines.quoteRates)),
    };
    const commercial = normalizeCommercial(src.commercial || {});
    const totals = computeTotals(src.totals || {}, lines, commercial);
    const materialScope = normalizeMaterialScope(src.materialScope || (src.selection && src.selection.materialScope) || (src.scope && src.scope.materialScope));
    const scopeMode = materialScopeMode(materialScope);
    return {
      version: 4,
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
        materialScope: clone(materialScope),
        materialScopeMode: scopeMode,
      },
      catalogs: FC.catalogSelectors && typeof FC.catalogSelectors.getFurnitureCatalogSnapshot === 'function'
        ? FC.catalogSelectors.getFurnitureCatalogSnapshot()
        : null,
      lines,
      commercial,
      totals,
      meta: {
        source:'quote-snapshot',
        preliminary: !!commercial.preliminary,
        versionName: commercial.versionName,
        selectedByClient: !!(src.meta && src.meta.selectedByClient),
        acceptedAt: Number(src.meta && src.meta.acceptedAt) > 0 ? Number(src.meta.acceptedAt) : 0,
        acceptedStage: String(src.meta && src.meta.acceptedStage || ''),
      },
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
    normalizeCommercial,
    computeTotals,
    normalizeMaterialScope,
    materialScopeMode,
  };
})();
