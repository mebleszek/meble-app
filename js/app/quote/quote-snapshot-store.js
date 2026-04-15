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

  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }

  function uid(){
    try{ return FC.utils && typeof FC.utils.uid === 'function' ? FC.utils.uid() : ('qs_' + Date.now()); }
    catch(_){ return 'qs_' + Date.now(); }
  }

  function normalizeStatus(value){
    return String(value || '').trim().toLowerCase();
  }

  function normalizeMaterialScope(value){
    try{
      if(FC.quoteSnapshot && typeof FC.quoteSnapshot.normalizeMaterialScope === 'function') return FC.quoteSnapshot.normalizeMaterialScope(value);
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

  function isPreliminarySnapshot(snapshot){
    return !!(snapshot && ((snapshot.meta && snapshot.meta.preliminary) || (snapshot.commercial && snapshot.commercial.preliminary)));
  }

  function defaultVersionName(preliminary, options){
    try{
      if(FC.quoteSnapshot && typeof FC.quoteSnapshot.defaultVersionName === 'function') return FC.quoteSnapshot.defaultVersionName(preliminary, options || {});
    }catch(_){ }
    return preliminary ? 'Wstępna oferta' : 'Oferta';
  }

  function normalizeSnapshot(snapshot){
    const src = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const preliminary = isPreliminarySnapshot(src);
    const acceptedStage = String(src.meta && src.meta.acceptedStage || (src.meta && src.meta.selectedByClient ? (preliminary ? 'pomiar' : 'zaakceptowany') : '') || '');
    const versionName = String(src.meta && src.meta.versionName || src.commercial && src.commercial.versionName || '').trim() || defaultVersionName(preliminary, { scope:src.scope || {} });
    const materialScope = normalizeMaterialScope(src.scope && src.scope.materialScope);
    return {
      id: String(src.id || uid()),
      generatedAt: Number(src.generatedAt) > 0 ? Number(src.generatedAt) : Date.now(),
      investor: src.investor ? clone(src.investor) : null,
      project: src.project ? clone(src.project) : null,
      scope: Object.assign({}, clone(src.scope || {}), {
        selectedRooms: Array.isArray(src.scope && src.scope.selectedRooms) ? src.scope.selectedRooms.slice() : [],
        roomLabels: Array.isArray(src.scope && src.scope.roomLabels) ? src.scope.roomLabels.slice() : [],
        materialScope,
        materialScopeMode: String(src.scope && src.scope.materialScopeMode || materialScopeMode(materialScope) || ''),
      }),
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
  }

  function readAll(){
    const rows = storage.getJSON(SNAPSHOT_KEY, []);
    return Array.isArray(rows)
      ? rows.map((row)=> normalizeSnapshot(row)).sort((a,b)=> Number(b.generatedAt || 0) - Number(a.generatedAt || 0))
      : [];
  }

  function writeAll(list){
    const rows = Array.isArray(list) ? list.map((row)=> normalizeSnapshot(row)) : [];
    storage.setJSON(SNAPSHOT_KEY, rows);
    return rows;
  }

  function getById(id){
    const key = String(id || '');
    if(!key) return null;
    return readAll().find((row)=> String(row && row.id || '') === key) || null;
  }

  function save(snapshot){
    const normalized = normalizeSnapshot(snapshot);
    const list = readAll().filter((row)=> String(row.id || '') !== String(normalized.id || ''));
    list.unshift(normalized);
    writeAll(list.slice(0, 120));
    return normalized;
  }

  function remove(id){
    const key = String(id || '');
    if(!key) return false;
    const list = readAll();
    const next = list.filter((row)=> String(row && row.id || '') !== key);
    if(next.length === list.length) return false;
    writeAll(next);
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

  function getSelectedForProject(projectId){
    const pid = String(projectId || '');
    if(!pid) return null;
    return listForProject(pid).find((row)=> !!(row && row.meta && row.meta.selectedByClient)) || null;
  }

  function hasFinalQuote(projectId){
    return listForProject(projectId).some((row)=> !isPreliminarySnapshot(row));
  }

  function normalizeRoomIds(roomIds){
    return Array.isArray(roomIds)
      ? Array.from(new Set(roomIds.map((item)=> String(item || '').trim()).filter(Boolean)))
      : [];
  }

  function getSnapshotRoomIds(snapshot){
    return normalizeRoomIds(snapshot && snapshot.scope && snapshot.scope.selectedRooms);
  }

  function sameRoomScope(a, b){
    const left = normalizeRoomIds(a);
    const right = normalizeRoomIds(b);
    if(left.length !== right.length) return false;
    return left.every((roomId, idx)=> roomId === right[idx]);
  }

  function snapshotScopeOverlaps(snapshot, roomIds){
    const targets = normalizeRoomIds(roomIds);
    if(!targets.length) return true;
    const snapshotRooms = getSnapshotRoomIds(snapshot);
    if(!snapshotRooms.length) return true;
    return targets.some((roomId)=> snapshotRooms.includes(roomId));
  }

  function isRejectedSnapshot(snapshot){
    return !!(snapshot && snapshot.meta && (Number(snapshot.meta.rejectedAt) > 0 || String(snapshot.meta.rejectedReason || '').trim()));
  }

  function shouldRejectPreviousSelection(previouslySelected, candidate, options){
    const opts = options && typeof options === 'object' ? options : {};
    if(!previouslySelected) return false;
    if(Object.prototype.hasOwnProperty.call(opts, 'rejectPreviousSelection')) return !!opts.rejectPreviousSelection;
    const targetRoomIds = normalizeRoomIds(opts.roomIds);
    if(candidate) return !sameRoomScope(getSnapshotRoomIds(previouslySelected), getSnapshotRoomIds(candidate));
    if(targetRoomIds.length) return snapshotScopeOverlaps(previouslySelected, targetRoomIds);
    return false;
  }

  function getRejectReason(candidate, options){
    const opts = options && typeof options === 'object' ? options : {};
    const explicit = String(opts.rejectReason || '').trim().toLowerCase();
    if(explicit) return explicit;
    return candidate ? 'scope_changed' : 'scope_changed';
  }

  function filterRowsByRoomScope(rows, roomIds, options){
    const targets = normalizeRoomIds(roomIds);
    const list = Array.isArray(rows) ? rows : [];
    const mode = String(options && options.matchMode || 'includes').trim().toLowerCase();
    if(!targets.length) return list.slice();
    return list.filter((row)=> {
      const snapshotRooms = getSnapshotRoomIds(row);
      if(!snapshotRooms.length){
        if(mode !== 'exact') return true;
        return !!(options && options.allowProjectWideExact && targets.length === 1);
      }
      if(mode === 'exact') return sameRoomScope(snapshotRooms, targets);
      return targets.every((roomId)=> snapshotRooms.includes(roomId));
    });
  }

  function filterRowsByQuoteType(rows, options){
    const list = Array.isArray(rows) ? rows : [];
    const opts = options && typeof options === 'object' ? options : {};
    const hasPreliminary = Object.prototype.hasOwnProperty.call(opts, 'preliminary');
    const includeRejected = opts.includeRejected === true;
    return list.filter((row)=> {
      if(!includeRejected && isRejectedSnapshot(row)) return false;
      if(!hasPreliminary) return true;
      return isPreliminarySnapshot(row) === !!opts.preliminary;
    });
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

  function pickCandidate(projectRows, predicate){
    const rows = Array.isArray(projectRows) ? projectRows : [];
    return rows.find((row)=> !!(row && row.meta && row.meta.selectedByClient) && predicate(row))
      || rows.find((row)=> predicate(row))
      || null;
  }

  function updateSelectionForProject(projectId, chooser, projectStatus, acceptedStage, options){
    const pid = String(projectId || '');
    if(!pid) return null;
    const list = readAll();
    const projectRows = list.filter((row)=> String(row && row.project && row.project.id || '') === pid);
    const scopedRows = filterRowsByRoomScope(projectRows, options && options.roomIds);
    const candidate = chooser(scopedRows, projectRows, options || {});
    const normalizedProjectStatus = normalizeStatus(projectStatus || (candidate ? (isPreliminarySnapshot(candidate) ? 'pomiar' : 'zaakceptowany') : ''));
    const normalizedAcceptedStage = normalizeStatus(acceptedStage || (candidate ? (isPreliminarySnapshot(candidate) ? 'pomiar' : 'zaakceptowany') : ''));
    const previouslySelected = projectRows.find((row)=> !!(row && row.meta && row.meta.selectedByClient)) || null;
    const shouldRejectPrevious = shouldRejectPreviousSelection(previouslySelected, candidate, options);
    const rejectReason = shouldRejectPrevious ? getRejectReason(candidate, options) : '';
    const stamp = Date.now();
    list.forEach((row)=> {
      if(String(row && row.project && row.project.id || '') !== pid) return;
      const isTarget = !!(candidate && String(row && row.id || '') === String(candidate.id || ''));
      const isPreviousSelected = !!(previouslySelected && String(previouslySelected.id || '') === String(row && row.id || ''));
      const preservedRejectedAt = Number(row && row.meta && row.meta.rejectedAt) > 0 ? Number(row.meta.rejectedAt) : 0;
      const preservedRejectedReason = String(row && row.meta && row.meta.rejectedReason || '').trim().toLowerCase();
      row.meta = Object.assign({}, row && row.meta || {}, {
        versionName: String(row && row.meta && row.meta.versionName || row && row.commercial && row.commercial.versionName || '').trim(),
        preliminary: isPreliminarySnapshot(row),
        selectedByClient: isTarget,
        acceptedAt: isTarget ? (Number(row && row.meta && row.meta.acceptedAt) > 0 ? Number(row.meta.acceptedAt) : stamp) : 0,
        acceptedStage: isTarget ? normalizedAcceptedStage : '',
        rejectedAt: isTarget ? 0 : (isPreviousSelected && shouldRejectPrevious ? (preservedRejectedAt || stamp) : preservedRejectedAt),
        rejectedReason: isTarget ? '' : (isPreviousSelected && shouldRejectPrevious ? (rejectReason || preservedRejectedReason) : preservedRejectedReason),
      });
      row.project = Object.assign({}, row && row.project || {}, {
        status: normalizedProjectStatus || String(row && row.project && row.project.status || '')
      });
    });
    writeAll(list);
    return candidate ? getById(candidate.id) : null;
  }

  function markSelectedForProject(projectId, snapshotId, options){
    const pid = String(projectId || '');
    const sid = String(snapshotId || '');
    const explicit = normalizeStatus(options && options.status || '');
    return updateSelectionForProject(pid, (rows)=> rows.find((row)=> String(row && row.id || '') === sid) || null, explicit, explicit || 'zaakceptowany', options);
  }

  function syncSelectionForProjectStatus(projectId, status, options){
    const pid = String(projectId || '');
    const normalizedStatus = normalizeStatus(status);
    if(!pid) return null;
    if(normalizedStatus === 'pomiar'){
      return updateSelectionForProject(pid, (rows)=> pickCandidate(rows, (row)=> isPreliminarySnapshot(row)), 'pomiar', 'pomiar', options);
    }
    if(FINAL_STATUSES.has(normalizedStatus)){
      return updateSelectionForProject(pid, (rows)=> pickCandidate(rows, (row)=> !isPreliminarySnapshot(row)), normalizedStatus, 'zaakceptowany', options);
    }
    return updateSelectionForProject(pid, ()=> null, normalizedStatus, '', options);
  }

  function getRecommendedStatusForProject(projectId, currentStatus, options){
    const pid = String(projectId || '');
    const normalizedCurrent = normalizeStatus(currentStatus);
    const normalizedFallback = normalizeStatus(options && options.fallbackStatus);
    if(!pid) return normalizedFallback || normalizedCurrent || 'nowy';
    const rows = filterRowsByRoomScope(listForProject(pid), options && options.roomIds, options);
    const activeRows = rows.filter((row)=> !isRejectedSnapshot(row));
    const selected = activeRows.find((row)=> !!(row && row.meta && row.meta.selectedByClient)) || null;
    if(selected){
      if(isPreliminarySnapshot(selected)) return 'pomiar';
      if(FINAL_STATUSES.has(normalizedCurrent)) return normalizedCurrent;
      return 'zaakceptowany';
    }
    if(activeRows.some((row)=> !isPreliminarySnapshot(row))) return normalizedCurrent === 'odrzucone' ? 'odrzucone' : 'wycena';
    if(activeRows.some((row)=> isPreliminarySnapshot(row))) return 'wstepna_wycena';
    if(normalizedCurrent === 'odrzucone') return 'odrzucone';
    return normalizedFallback || 'nowy';
  }

  function getRecommendedStatusMapForProject(projectId, currentStatusesByRoom, roomIds, options){
    const pid = String(projectId || '');
    const ids = normalizeRoomIds(roomIds);
    const out = {};
    const opts = options && typeof options === 'object' ? options : {};
    if(!pid || !ids.length) return out;
    ids.forEach((roomId)=> {
      const key = String(roomId || '');
      if(!key) return;
      const current = normalizeStatus(currentStatusesByRoom && currentStatusesByRoom[key] || '');
      const fallbackStatus = Object.prototype.hasOwnProperty.call(opts, 'fallbackStatus') ? opts.fallbackStatus : 'nowy';
      out[key] = getRecommendedStatusForProject(pid, current, Object.assign({}, opts, { roomIds:[key], fallbackStatus }));
    });
    return out;
  }

  function convertPreliminaryToFinal(projectId, snapshotId){
    const pid = String(projectId || '');
    const sid = String(snapshotId || '');
    if(!pid || !sid) return null;
    const list = readAll();
    const target = list.find((row)=> String(row && row.project && row.project.id || '') === pid && String(row && row.id || '') === sid) || null;
    if(!target || !isPreliminarySnapshot(target)) return null;
    const acceptedAt = Number(target && target.meta && target.meta.acceptedAt) > 0 ? Number(target.meta.acceptedAt) : Date.now();
    const currentName = String(target && target.commercial && target.commercial.versionName || target && target.meta && target.meta.versionName || '').trim();
    const nextVersionName = (!currentName || currentName === defaultVersionName(true, { scope:target && target.scope }))
      ? defaultVersionName(false, { scope:target && target.scope })
      : currentName;
    list.forEach((row)=> {
      if(String(row && row.project && row.project.id || '') !== pid) return;
      const isTarget = String(row && row.id || '') === sid;
      const project = Object.assign({}, row && row.project || {}, { status:'zaakceptowany' });
      const commercial = Object.assign({}, row && row.commercial || {});
      const meta = Object.assign({}, row && row.meta || {});
      if(isTarget){
        commercial.preliminary = false;
        commercial.versionName = nextVersionName;
        meta.preliminary = false;
        meta.versionName = nextVersionName;
        meta.selectedByClient = true;
        meta.acceptedAt = acceptedAt;
        meta.acceptedStage = 'zaakceptowany';
      } else {
        meta.selectedByClient = false;
        meta.acceptedAt = 0;
        meta.acceptedStage = '';
        meta.preliminary = isPreliminarySnapshot(row);
        meta.versionName = String(meta.versionName || commercial.versionName || defaultVersionName(!!commercial.preliminary, { scope:row && row.scope })).trim();
      }
      row.project = project;
      row.commercial = commercial;
      row.meta = meta;
    });
    writeAll(list);
    return getById(sid);
  }

  FC.quoteSnapshotStore = {
    SNAPSHOT_KEY,
    FINAL_STATUSES,
    normalizeSnapshot,
    readAll,
    writeAll,
    getById,
    save,
    remove,
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
    getSnapshotRoomIds,
    filterRowsByRoomScope,
    listExactScopeSnapshots,
    findExactScopeSnapshot,
    listOverlappingScopeSnapshots,
    removeSnapshotsForProjectRooms,
    sameRoomScope,
    snapshotScopeOverlaps,
    isRejectedSnapshot,
  };
})();
