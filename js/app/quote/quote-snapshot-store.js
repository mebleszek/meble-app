(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const keys = (FC.constants && FC.constants.STORAGE_KEYS) || {};
  const storage = FC.storage || {
    getJSON(_key, fallback){ return JSON.parse(JSON.stringify(fallback)); },
    setJSON(){}
  };

  const SNAPSHOT_KEY = keys.quoteSnapshots || 'fc_quote_snapshots_v1';
  const FINAL_STATUSES = new Set(['zaakceptowany','umowa','produkcja','montaz','zakonczone']);

  // Odpowiedzialność modułu: historia i exact-scope dane ofertowe.
  // Snapshot store przechowuje oraz filtruje snapshoty ofert, ale nie powinien
  // być miejscem finalnego liczenia biznesowego statusu projektu.

  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }

  function uid(){
    try{ return FC.utils && typeof FC.utils.uid === 'function' ? FC.utils.uid() : ('qs_' + Date.now()); }
    catch(_){ return 'qs_' + Date.now(); }
  }


  function rawSnapshotStorage(){
    try{ return storage && typeof storage.getRaw === 'function' ? storage.getRaw(SNAPSHOT_KEY) : localStorage.getItem(SNAPSHOT_KEY); }
    catch(_){ return null; }
  }
  function bytes(value){ return value == null ? 0 : String(value).length; }
  function safeParseRows(raw){
    try{ const parsed = JSON.parse(String(raw || '[]')); return Array.isArray(parsed) ? parsed : []; }
    catch(err){ return { __error:true, message:String(err && err.message || err || 'parse error') }; }
  }
  function snapshotId(row){ return String(row && (row.id || row.snapshotId) || '').trim(); }
  function summarizeStoreRows(rows, limit){
    const list = Array.isArray(rows) ? rows : [];
    return list.slice(0, Number(limit) > 0 ? Number(limit) : 8).map((row)=> ({
      id:snapshotId(row),
      projectId:String(row && (row.projectId || row.project && row.project.id || row.meta && row.meta.projectId) || ''),
      investorId:String(row && (row.investorId || row.investor && row.investor.id || row.project && row.project.investorId || row.meta && row.meta.investorId) || ''),
      versionName:String(row && (row.commercial && row.commercial.versionName || row.meta && row.meta.versionName) || ''),
      preliminary:!!(row && (row.meta && row.meta.preliminary || row.commercial && row.commercial.preliminary)),
      generatedAt:row && row.generatedAt || null,
    }));
  }
  function recordStoreEvent(label, value){
    try{
      if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.recordSnapshotStoreEvent === 'function') FC.wycenaDiagnostics.recordSnapshotStoreEvent(label, value);
    }catch(_){ }
  }

  function normalizeStatus(value){
    return String(value || '').trim().toLowerCase();
  }

  const quoteSnapshotScope = FC.quoteSnapshotScope || null;

  function requireScopeHelper(name){
    const fn = quoteSnapshotScope && quoteSnapshotScope[name];
    if(typeof fn !== 'function') throw new Error('Brak FC.quoteSnapshotScope.' + name);
    return fn;
  }

  const normalizeMaterialScope = requireScopeHelper('normalizeMaterialScope');
  const materialScopeMode = requireScopeHelper('materialScopeMode');
  const isPreliminarySnapshot = requireScopeHelper('isPreliminarySnapshot');
  const normalizeRoomIds = requireScopeHelper('normalizeRoomIds');
  const getScopeRoomLabels = requireScopeHelper('getScopeRoomLabels');
  const buildScopedVersionName = requireScopeHelper('buildScopedVersionName');
  const buildCanonicalScope = requireScopeHelper('buildCanonicalScope');
  const getCanonicalDefaultVersionName = requireScopeHelper('getCanonicalDefaultVersionName');
  const parseAutoVersionName = requireScopeHelper('parseAutoVersionName');
  const coerceAutoVersionNameForScope = requireScopeHelper('coerceAutoVersionNameForScope');
  const getSnapshotRoomIds = requireScopeHelper('getSnapshotRoomIds');
  const sameRoomScope = requireScopeHelper('sameRoomScope');
  const normalizeComparableVersionName = requireScopeHelper('normalizeComparableVersionName');
  const escapeRegExp = requireScopeHelper('escapeRegExp');
  const matchesOwnAutoVersionName = requireScopeHelper('matchesOwnAutoVersionName');
  const snapshotScopeOverlaps = requireScopeHelper('snapshotScopeOverlaps');
  const resolveSelectionScopeRoomIds = requireScopeHelper('resolveSelectionScopeRoomIds');
  const listSelectionImpactedRows = requireScopeHelper('listSelectionImpactedRows');
  const isRejectedSnapshot = requireScopeHelper('isRejectedSnapshot');
  const shouldRejectPreviousSelection = requireScopeHelper('shouldRejectPreviousSelection');
  const getRejectReason = requireScopeHelper('getRejectReason');
  const filterRowsByRoomScope = requireScopeHelper('filterRowsByRoomScope');
  const filterRowsByQuoteType = requireScopeHelper('filterRowsByQuoteType');

  function defaultVersionName(preliminary, options){
    try{
      if(FC.quoteSnapshot && typeof FC.quoteSnapshot.defaultVersionName === 'function') return FC.quoteSnapshot.defaultVersionName(preliminary, options || {});
    }catch(_){ }
    return preliminary ? 'Wstępna oferta' : 'Oferta';
  }

  function normalizeSnapshot(snapshot, options){
    const src = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const srcMeta = src.meta && typeof src.meta === 'object' ? src.meta : {};
    const preliminary = isPreliminarySnapshot(src);
    const acceptedStage = String(src.meta && src.meta.acceptedStage || (src.meta && src.meta.selectedByClient ? (preliminary ? 'pomiar' : 'zaakceptowany') : '') || '');
    const opts = options && typeof options === 'object' ? options : {};
    const scope = buildCanonicalScope(src.scope || {}, opts);
    const versionName = String(src.meta && src.meta.versionName || src.commercial && src.commercial.versionName || '').trim() || getCanonicalDefaultVersionName({ scope, commercial:{ preliminary }, meta:{ preliminary } }, opts);
    const out = {
      id: String(src.id || uid()),
      generatedAt: Number(src.generatedAt) > 0 ? Number(src.generatedAt) : Date.now(),
      investor: src.investor ? clone(src.investor) : null,
      project: src.project ? clone(src.project) : null,
      scope,
      catalogs: clone(src.catalogs || null),
      lines: clone(src.lines || {}),
      commercial: Object.assign({}, clone(src.commercial || {}), { versionName }),
      totals: clone(src.totals || {}),
      meta: {
        source:String(src.meta && src.meta.source || 'quote-snapshot-store'),
        versionName,
        selectedByClient: !!(src.meta && src.meta.selectedByClient),
        acceptedAt: Number(src.meta && src.meta.acceptedAt) > 0 ? Number(src.meta.acceptedAt) : 0,
        acceptedStage,
        rejectedAt: Number(src.meta && src.meta.rejectedAt) > 0 ? Number(src.meta.rejectedAt) : 0,
        rejectedReason: String(src.meta && src.meta.rejectedReason || '').trim().toLowerCase(),
        preliminary,
      }
    };
    if(src.__test === true || srcMeta.__test === true || srcMeta.testData){
      out.__test = true;
      out.__testRunId = String(src.__testRunId || srcMeta.__testRunId || srcMeta.testRunId || '');
      out.meta.__test = true;
      out.meta.__testRunId = out.__testRunId;
      out.meta.testData = true;
      out.meta.testOwner = String(srcMeta.testOwner || 'dev-tests');
      out.meta.testRunId = out.__testRunId;
    }
    return out;
  }

  function readAll(){
    const rows = storage.getJSON(SNAPSHOT_KEY, []);
    return Array.isArray(rows)
      ? rows.map((row)=> normalizeSnapshot(row, { canonicalizeLabels:true })).sort((a,b)=> Number(b.generatedAt || 0) - Number(a.generatedAt || 0))
      : [];
  }

  function writeAll(list){
    const rows = Array.isArray(list) ? list.map((row)=> normalizeSnapshot(row, { preserveExplicitLabels:true })) : [];
    storage.setJSON(SNAPSHOT_KEY, rows);
    return rows;
  }

  function getById(id){
    const key = String(id || '');
    if(!key) return null;
    return readAll().find((row)=> String(row && row.id || '') === key) || null;
  }

  function save(snapshot){
    const beforeRaw = rawSnapshotStorage();
    const beforeParsed = safeParseRows(beforeRaw);
    const list = readAll();
    const normalized = normalizeSnapshot(snapshot, { preserveExplicitLabels:true });
    const normalizedId = String(normalized && normalized.id || '');
    const normalizedProjectId = String(normalized && normalized.project && normalized.project.id || '');
    const projectRows = list.filter((row)=> String(row && row.project && row.project.id || '') === normalizedProjectId);
    const beforeProjectRows = projectRows.length;
    recordStoreEvent('save:before', {
      id:normalizedId,
      projectId:normalizedProjectId,
      beforeBytes:bytes(beforeRaw),
      beforeRawCount:Array.isArray(beforeParsed) ? beforeParsed.length : null,
      beforeParseError:beforeParsed && beforeParsed.__error ? beforeParsed.message : '',
      beforeReadAllCount:list.length,
      beforeProjectRows,
      beforeHasId:list.some((row)=> String(row && row.id || '') === normalizedId),
      versionName:String(normalized && normalized.commercial && normalized.commercial.versionName || normalized && normalized.meta && normalized.meta.versionName || ''),
    });
    const coercedVersionName = coerceAutoVersionNameForScope(normalized, projectRows);
    if(coercedVersionName){
      normalized.commercial = Object.assign({}, normalized.commercial || {}, { versionName:coercedVersionName });
      normalized.meta = Object.assign({}, normalized.meta || {}, { versionName:coercedVersionName });
    }
    const next = list.filter((row)=> String(row.id || '') !== String(normalized.id || ''));
    next.unshift(normalized);
    const writtenRows = writeAll(next.slice(0, 120));
    const afterRaw = rawSnapshotStorage();
    const afterParsed = safeParseRows(afterRaw);
    const afterRows = readAll();
    const visible = afterRows.some((row)=> String(row && row.id || '') === normalizedId);
    recordStoreEvent('save:after', {
      id:normalizedId,
      projectId:normalizedProjectId,
      coercedVersionName:String(coercedVersionName || ''),
      returnedVersionName:String(normalized && normalized.commercial && normalized.commercial.versionName || normalized && normalized.meta && normalized.meta.versionName || ''),
      requestedWriteCount:Array.isArray(writtenRows) ? writtenRows.length : null,
      afterBytes:bytes(afterRaw),
      afterRawCount:Array.isArray(afterParsed) ? afterParsed.length : null,
      afterParseError:afterParsed && afterParsed.__error ? afterParsed.message : '',
      afterReadAllCount:afterRows.length,
      afterProjectRows:afterRows.filter((row)=> String(row && row.project && row.project.id || '') === normalizedProjectId).length,
      visible,
      rawChanged:String(beforeRaw || '') !== String(afterRaw || ''),
      firstRows:summarizeStoreRows(afterRows, 5),
    });
    return normalized;
  }

  function cleanupRemovedSnapshotReferences(snapshotId){
    const sid = String(snapshotId || '').trim();
    if(!sid) return false;
    let changed = false;
    try{
      if(FC.session && typeof FC.session.cleanupSnapshotReferences === 'function'){
        changed = !!FC.session.cleanupSnapshotReferences(sid) || changed;
      }
    }catch(_){ }
    return changed;
  }

  function remove(id){
    const key = String(id || '');
    if(!key) return false;
    const beforeRaw = rawSnapshotStorage();
    const list = readAll();
    const next = list.filter((row)=> String(row && row.id || '') !== key);
    recordStoreEvent('remove:before', {
      id:key,
      beforeBytes:bytes(beforeRaw),
      beforeCount:list.length,
      beforeHasId:list.some((row)=> String(row && row.id || '') === key),
      beforeRows:summarizeStoreRows(list, 6),
    });
    if(next.length === list.length){
      recordStoreEvent('remove:noop', { id:key, count:list.length });
      return false;
    }
    writeAll(next);
    cleanupRemovedSnapshotReferences(key);
    const afterRaw = rawSnapshotStorage();
    const afterRows = readAll();
    const stillVisible = afterRows.some((row)=> String(row && row.id || '') === key);
    recordStoreEvent('remove:after', {
      id:key,
      afterBytes:bytes(afterRaw),
      afterCount:afterRows.length,
      stillVisible,
      rawChanged:String(beforeRaw || '') !== String(afterRaw || ''),
      afterRows:summarizeStoreRows(afterRows, 6),
    });
    return true;
  }

  function listForProject(projectId){
    const key = String(projectId || '');
    if(!key) return [];
    return readAll().filter((row)=> String(row && row.project && row.project.id || '') === key);
  }

  function listForInvestor(investorId){
    const key = String(investorId || '');
    if(!key) return [];
    return readAll().filter((row)=> String(row && row.investor && row.investor.id || '') === key);
  }

  function getLatestForProject(projectId){
    return listForProject(projectId)[0] || null;
  }

  function getSelectedForProject(projectId, options){
    const pid = String(projectId || '');
    if(!pid) return null;
    const opts = options && typeof options === 'object' ? options : {};
    const rows = listForProject(pid);
    const targetRoomIds = normalizeRoomIds(opts.roomIds);
    if(targetRoomIds.length){
      const exact = filterRowsByRoomScope(rows, targetRoomIds, { matchMode:'exact', allowProjectWideExact: !!opts.allowProjectWideExact });
      return exact.find((row)=> !!(row && row.meta && row.meta.selectedByClient)) || null;
    }
    return rows.find((row)=> !!(row && row.meta && row.meta.selectedByClient)) || null;
  }

  function hasFinalQuote(projectId){
    return listForProject(projectId).some((row)=> !isPreliminarySnapshot(row));
  }

  function getEffectiveVersionName(snapshot){
    const snap = normalizeSnapshot(snapshot);
    const current = String(snap && snap.commercial && snap.commercial.versionName || snap && snap.meta && snap.meta.versionName || '').trim();
    const fallback = getCanonicalDefaultVersionName(snap);
    if(!current) return fallback;
    if(matchesOwnAutoVersionName(snap, current)) return current;
    const projectId = String(snap && snap.project && snap.project.id || '').trim();
    const rows = projectId ? listForProject(projectId) : [];
    return coerceAutoVersionNameForScope(snap, rows) || fallback || current;
  }

  function listExactScopeSnapshots(projectId, roomIds, options){
    const pid = String(projectId || '');
    const ids = normalizeRoomIds(roomIds);
    const opts = options && typeof options === 'object' ? options : {};
    if(!pid || !ids.length) return [];
    const projectRows = listForProject(pid);
    const scopedRows = filterRowsByRoomScope(projectRows, ids, { matchMode:'exact', allowProjectWideExact: !!opts.allowProjectWideExact });
    return filterRowsByQuoteType(scopedRows, opts);
  }

  function findExactScopeSnapshot(projectId, roomIds, options){
    const rows = listExactScopeSnapshots(projectId, roomIds, options);
    return rows.find((row)=> !!(row && row.meta && row.meta.selectedByClient)) || rows[0] || null;
  }

  function listOverlappingScopeSnapshots(projectId, roomIds, options){
    const pid = String(projectId || '');
    const ids = normalizeRoomIds(roomIds);
    const opts = options && typeof options === 'object' ? options : {};
    if(!pid || !ids.length) return [];
    const projectRows = listForProject(pid);
    const overlapped = projectRows.filter((row)=> snapshotScopeOverlaps(row, ids));
    return filterRowsByQuoteType(overlapped, opts);
  }

  function removeSnapshotsForProjectRooms(projectId, roomIds, options){
    const pid = String(projectId || '');
    const ids = normalizeRoomIds(roomIds);
    const opts = options && typeof options === 'object' ? options : {};
    if(!pid || !ids.length) return [];
    const includeRejected = opts.includeRejected !== false;
    const list = readAll();
    const removed = [];
    const next = list.filter((row)=>{
      const sameProject = String(row && row.project && row.project.id || '') === pid;
      if(!sameProject) return true;
      if(!snapshotScopeOverlaps(row, ids)) return true;
      if(!includeRejected && isRejectedSnapshot(row)) return true;
      removed.push(row);
      return false;
    });
    if(removed.length) writeAll(next);
    return removed;
  }

  const quoteSnapshotSelection = FC.quoteSnapshotSelection || null;

  function requireSelectionFactory(){
    const factory = quoteSnapshotSelection && quoteSnapshotSelection.createApi;
    if(typeof factory !== 'function') throw new Error('Brak FC.quoteSnapshotSelection.createApi');
    return factory;
  }

  const selectionApi = requireSelectionFactory()({
    FINAL_STATUSES,
    normalizeStatus,
    readAll,
    writeAll,
    getById,
    listForProject,
    defaultVersionName,
    isPreliminarySnapshot,
    normalizeRoomIds,
    getSnapshotRoomIds,
    filterRowsByRoomScope,
    resolveSelectionScopeRoomIds,
    listSelectionImpactedRows,
    isRejectedSnapshot,
    shouldRejectPreviousSelection,
    getRejectReason,
    getCanonicalDefaultVersionName,
    buildScopedVersionName,
  });

  const markSelectedForProject = selectionApi.markSelectedForProject;
  const syncSelectionForProjectStatus = selectionApi.syncSelectionForProjectStatus;
  const getRecommendedStatusForProject = selectionApi.getRecommendedStatusForProject;
  const getRecommendedStatusMapForProject = selectionApi.getRecommendedStatusMapForProject;
  const convertPreliminaryToFinal = selectionApi.convertPreliminaryToFinal;

  FC.quoteSnapshotStore = {
    SNAPSHOT_KEY,
    FINAL_STATUSES,
    normalizeSnapshot,
    readAll,
    writeAll,
    getById,
    save,
    remove,
    cleanupRemovedSnapshotReferences,
    markSelectedForProject,
    syncSelectionForProjectStatus,
    getRecommendedStatusForProject,
    getRecommendedStatusMapForProject,
    convertPreliminaryToFinal,
    listForProject,
    listForInvestor,
    getLatestForProject,
    getSelectedForProject,
    hasFinalQuote,
    defaultVersionName,
    isPreliminarySnapshot,
    normalizeRoomIds,
    getScopeRoomLabels,
    getSnapshotRoomIds,
    filterRowsByRoomScope,
    listExactScopeSnapshots,
    findExactScopeSnapshot,
    listOverlappingScopeSnapshots,
    removeSnapshotsForProjectRooms,
    sameRoomScope,
    snapshotScopeOverlaps,
    isRejectedSnapshot,
    getEffectiveVersionName,
  };
})();
