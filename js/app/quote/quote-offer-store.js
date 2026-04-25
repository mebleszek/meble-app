(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const keys = (FC.constants && FC.constants.STORAGE_KEYS) || {};
  const storage = FC.storage || {
    getJSON(_key, fallback){ return JSON.parse(JSON.stringify(fallback)); },
    setJSON(){}
  };

  const DRAFT_KEY = keys.quoteOfferDrafts || 'fc_quote_offer_drafts_v1';

  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }

  function num(value, fallback){
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function getCurrentProjectId(){
    try{ return FC.projectStore && typeof FC.projectStore.getCurrentProjectId === 'function' ? String(FC.projectStore.getCurrentProjectId() || '') : ''; }
    catch(_){ return ''; }
  }

  function getCurrentInvestorId(){
    try{ return FC.investors && typeof FC.investors.getCurrentId === 'function' ? String(FC.investors.getCurrentId() || '') : ''; }
    catch(_){ return ''; }
  }

  function makeScope(projectId, investorId){
    return {
      projectId: String(projectId || getCurrentProjectId() || ''),
      investorId: String(investorId || getCurrentInvestorId() || ''),
    };
  }

  function normalizeRateSelections(rows){
    if(Array.isArray(rows)){
      return rows.map((row)=> ({
        rateId: String(row && row.rateId || row && row.id || ''),
        qty: Math.max(0, num(row && row.qty, 0)),
      })).filter((row)=> row.rateId);
    }
    if(rows && typeof rows === 'object'){
      return Object.keys(rows).map((key)=> ({ rateId:String(key), qty:Math.max(0, num(rows[key], 0)) })).filter((row)=> row.rateId);
    }
    return [];
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

  function normalizeRoomSelection(rows){
    const raw = Array.isArray(rows) ? rows : [];
    const cleaned = Array.from(new Set(raw.map((room)=> String(room || '').trim()).filter(Boolean)));
    if(!cleaned.length) return [];
    try{
      if(FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomIds === 'function'){
        const allowed = FC.roomRegistry.getActiveRoomIds() || [];
        if(Array.isArray(allowed) && allowed.length){
          if(FC.rozrysScope && typeof FC.rozrysScope.normalizeRoomSelection === 'function'){
            const normalized = FC.rozrysScope.normalizeRoomSelection(cleaned, { getRooms:()=> allowed });
            if(Array.isArray(normalized) && normalized.length) return normalized;
          }
          const set = new Set(cleaned);
          const filtered = allowed.filter((room)=> set.has(room));
          return filtered.length ? filtered : cleaned;
        }
      }
    }catch(_){ }
    return cleaned;
  }

  function normalizeSelection(src){
    const value = src && typeof src === 'object' ? src : {};
    return {
      selectedRooms: normalizeRoomSelection(value.selectedRooms),
      materialScope: normalizeMaterialScope(value.materialScope),
    };
  }

  function defaultVersionName(preliminary, options){
    try{
      if(FC.quoteSnapshot && typeof FC.quoteSnapshot.defaultVersionName === 'function') return FC.quoteSnapshot.defaultVersionName(!!preliminary, options || {});
    }catch(_){ }
    return preliminary ? 'Wstępna oferta' : 'Oferta';
  }

  function normalizeCommercial(src, options){
    const value = src && typeof src === 'object' ? src : {};
    let discountPercent = Math.max(0, num(value.discountPercent, 0));
    let discountAmount = Math.max(0, num(value.discountAmount, 0));
    if(discountPercent > 0) discountAmount = 0;
    if(discountAmount > 0) discountPercent = 0;
    const preliminary = !!value.preliminary;
    const versionName = String(value.versionName || '').trim() || defaultVersionName(preliminary, options);
    return {
      versionName,
      preliminary,
      discountPercent,
      discountAmount,
      offerValidity: String(value.offerValidity || '').trim(),
      leadTime: String(value.leadTime || '').trim(),
      deliveryTerms: String(value.deliveryTerms || '').trim(),
      customerNote: String(value.customerNote || '').trim(),
    };
  }

  function normalizeDraft(draft, scope){
    const src = draft && typeof draft === 'object' ? draft : {};
    const srcMeta = src.meta && typeof src.meta === 'object' ? src.meta : {};
    const resolved = makeScope(scope && scope.projectId || src.projectId, scope && scope.investorId || src.investorId);
    const selection = normalizeSelection(src.selection);
    const out = {
      projectId: resolved.projectId,
      investorId: resolved.investorId,
      rateSelections: normalizeRateSelections(src.rateSelections),
      selection,
      commercial: normalizeCommercial(src.commercial, { selection }),
      updatedAt: Math.max(0, num(src.updatedAt, Date.now())),
    };
    if(src.__test === true || srcMeta.__test === true || srcMeta.testData){
      out.__test = true;
      out.__testRunId = String(src.__testRunId || srcMeta.__testRunId || srcMeta.testRunId || '');
      out.meta = Object.assign({}, srcMeta, { __test:true, __testRunId:out.__testRunId, testData:true, testOwner:String(srcMeta.testOwner || 'dev-tests'), testRunId:out.__testRunId });
    }
    return out;
  }

  function readAll(){
    const rows = storage.getJSON(DRAFT_KEY, []);
    return Array.isArray(rows) ? rows.map((row)=> normalizeDraft(row)) : [];
  }

  function writeAll(list){
    const rows = Array.isArray(list) ? list.map((row)=> normalizeDraft(row)) : [];
    storage.setJSON(DRAFT_KEY, rows);
    return rows;
  }

  function findIndexByProject(list, projectId){
    const key = String(projectId || '');
    if(!key) return -1;
    return (Array.isArray(list) ? list : []).findIndex((row)=> String(row && row.projectId || '') === key);
  }

  function findIndexByInvestor(list, investorId){
    const key = String(investorId || '');
    if(!key) return -1;
    return (Array.isArray(list) ? list : []).findIndex((row)=> String(row && row.investorId || '') === key);
  }

  function findIndex(list, scope){
    const projectId = String(scope && scope.projectId || '');
    const investorId = String(scope && scope.investorId || '');
    const byProject = findIndexByProject(list, projectId);
    if(byProject >= 0) return byProject;
    return findIndexByInvestor(list, investorId);
  }

  function getDraft(scope){
    const resolved = makeScope(scope && scope.projectId, scope && scope.investorId);
    const list = readAll();
    const idx = findIndex(list, resolved);
    if(idx >= 0) return normalizeDraft(list[idx], resolved);
    return normalizeDraft({}, resolved);
  }

  function saveDraft(draft, scope){
    const resolved = makeScope(scope && scope.projectId, scope && scope.investorId);
    const normalized = normalizeDraft(draft, resolved);
    const list = readAll();
    const idx = findIndex(list, normalized);
    if(idx >= 0) list[idx] = normalized;
    else list.unshift(normalized);
    writeAll(list.slice(0, 50));
    return normalized;
  }

  function patchDraft(patch, scope){
    const current = getDraft(scope);
    const next = normalizeDraft({
      projectId: current.projectId,
      investorId: current.investorId,
      rateSelections: Array.isArray(patch && patch.rateSelections) ? patch.rateSelections : current.rateSelections,
      selection: patch && patch.selection ? Object.assign({}, current.selection || {}, clone(patch.selection)) : current.selection,
      commercial: patch && patch.commercial ? Object.assign({}, current.commercial, patch.commercial) : current.commercial,
      updatedAt: Date.now(),
    }, scope || current);
    return saveDraft(next, next);
  }

  function clearDraft(scope){
    const resolved = makeScope(scope && scope.projectId, scope && scope.investorId);
    const list = readAll();
    const idx = findIndex(list, resolved);
    if(idx < 0) return false;
    list.splice(idx, 1);
    writeAll(list);
    return true;
  }

  FC.quoteOfferStore = {
    DRAFT_KEY,
    normalizeDraft,
    normalizeSelection,
    defaultVersionName,
    normalizeCommercial,
    readAll,
    writeAll,
    getDraft,
    getCurrentDraft(){ return getDraft(); },
    saveDraft,
    saveCurrentDraft(draft){ return saveDraft(draft); },
    patchDraft,
    patchCurrentDraft(patch){ return patchDraft(patch); },
    clearDraft,
    clearCurrentDraft(){ return clearDraft(); },
  };
})();
