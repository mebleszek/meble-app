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
    const scope = buildCanonicalScope(src.scope || {});
    const versionName = String(src.meta && src.meta.versionName || src.commercial && src.commercial.versionName || '').trim() || getCanonicalDefaultVersionName({ scope, commercial:{ preliminary }, meta:{ preliminary } });
    return {
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
    const list = readAll();
    const normalized = normalizeSnapshot(snapshot);
    const projectRows = list.filter((row)=> String(row && row.project && row.project.id || '') === String(normalized && normalized.project && normalized.project.id || ''));
    const coercedVersionName = coerceAutoVersionNameForScope(normalized, projectRows);
    if(coercedVersionName){
      normalized.commercial = Object.assign({}, normalized.commercial || {}, { versionName:coercedVersionName });
      normalized.meta = Object.assign({}, normalized.meta || {}, { versionName:coercedVersionName });
    }
    const next = list.filter((row)=> String(row.id || '') !== String(normalized.id || ''));
    next.unshift(normalized);
    writeAll(next.slice(0, 120));
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

  function normalizeRoomIds(roomIds){
    return Array.isArray(roomIds)
      ? Array.from(new Set(roomIds.map((item)=> String(item || '').trim()).filter(Boolean)))
      : [];
  }

  function getRoomLabel(roomId){
    const key = String(roomId || '').trim();
    if(!key) return '';
    try{
      if(FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function'){
        const label = String(FC.roomRegistry.getRoomLabel(key) || '').trim();
        if(label) return label;
      }
    }catch(_){ }
    return key;
  }

  function getScopeRoomLabels(snapshotOrScope){
    const source = snapshotOrScope && snapshotOrScope.scope ? snapshotOrScope.scope : snapshotOrScope;
    const roomIds = normalizeRoomIds(source && source.selectedRooms);
    const explicitLabels = Array.isArray(source && source.roomLabels)
      ? source.roomLabels.map((item)=> String(item || '').trim()).filter(Boolean)
      : [];
    if(roomIds.length){
      const labels = roomIds.map((roomId, index)=> {
        const explicitLabel = String(explicitLabels[index] || '').trim();
        const registryLabel = String(getRoomLabel(roomId) || '').trim();
        if(registryLabel && (registryLabel !== String(roomId || '').trim() || !explicitLabel)) return registryLabel;
        return explicitLabel || registryLabel || roomId;
      }).filter(Boolean);
      if(labels.length) return labels;
      return roomIds;
    }
    return explicitLabels;
  }

  function buildScopedVersionName(preliminary, snapshotOrScope){
    const base = preliminary ? 'Wstępna oferta' : 'Oferta';
    const labels = getScopeRoomLabels(snapshotOrScope);
    return labels.length ? `${base} — ${labels.join(' + ')}` : base;
  }

  function buildCanonicalScope(snapshotOrScope){
    const source = snapshotOrScope && snapshotOrScope.scope ? snapshotOrScope.scope : snapshotOrScope;
    const materialScope = normalizeMaterialScope(source && source.materialScope);
    const selectedRooms = normalizeRoomIds(source && source.selectedRooms);
    const roomLabels = getScopeRoomLabels({ selectedRooms, roomLabels: Array.isArray(source && source.roomLabels) ? source.roomLabels.slice() : [] });
    return Object.assign({}, clone(source || {}), {
      selectedRooms,
      roomLabels,
      materialScope,
      materialScopeMode: String(source && source.materialScopeMode || materialScopeMode(materialScope) || ''),
    });
  }

  function getCanonicalDefaultVersionName(snapshot){
    const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
    return String(buildScopedVersionName(isPreliminarySnapshot(snap), snap) || '').trim();
  }

  function parseAutoVersionName(preliminary, value){
    const base = preliminary ? 'Wstępna oferta' : 'Oferta';
    const text = String(value || '').trim();
    if(!text) return { autoLike:false, base, scopeSuffix:'', variant:0, text:'' };
    const escapedBase = escapeRegExp(base);
    const re = new RegExp('^' + escapedBase + '(?: — (.+?))?(?: — wariant (\\d+))?$');
    const match = text.match(re);
    if(!match) return { autoLike:false, base, scopeSuffix:'', variant:0, text };
    return {
      autoLike:true,
      base,
      scopeSuffix:String(match[1] || '').trim(),
      variant:Number(match[2] || 0) || 0,
      text,
    };
  }

  function coerceAutoVersionNameForScope(snapshot, projectRows){
    const snap = snapshot && typeof snapshot === 'object' ? snapshot : null;
    if(!snap) return '';
    const current = String(snap && snap.commercial && snap.commercial.versionName || snap && snap.meta && snap.meta.versionName || '').trim();
    const fallback = getCanonicalDefaultVersionName(snap);
    if(!current) return fallback;
    const parsed = parseAutoVersionName(isPreliminarySnapshot(snap), current);
    if(!parsed.autoLike) return current;
    const canonicalScope = buildCanonicalScope(snap);
    const targetSuffix = normalizeComparableVersionName((canonicalScope.roomLabels || []).join(' + '));
    const currentSuffix = normalizeComparableVersionName(parsed.scopeSuffix || '');
    if(matchesOwnAutoVersionName(Object.assign({}, snap, { scope:canonicalScope }), current)) return current;
    if((currentSuffix || targetSuffix) && currentSuffix !== targetSuffix) return fallback;
    const rows = Array.isArray(projectRows) ? projectRows : [];
    const targetRooms = normalizeRoomIds(canonicalScope.selectedRooms);
    const targetName = normalizeComparableVersionName(current);
    const duplicatedAcrossDifferentScope = rows.some((row)=> {
      if(!row || String(row && row.id || '') === String(snap && snap.id || '')) return false;
      if(isRejectedSnapshot(row)) return false;
      if(isPreliminarySnapshot(row) !== isPreliminarySnapshot(snap)) return false;
      const rowName = normalizeComparableVersionName(row && row.commercial && row.commercial.versionName || row && row.meta && row.meta.versionName || '');
      if(!rowName || rowName !== targetName) return false;
      return !sameRoomScope(getSnapshotRoomIds(row), targetRooms);
    });
    return duplicatedAcrossDifferentScope ? fallback : current;
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


  function normalizeComparableVersionName(value){
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .replace(/[ąćęłńóśźż]/g, (ch)=> ({'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z'}[ch] || ch))
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function escapeRegExp(value){
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function matchesOwnAutoVersionName(snapshot, versionName){
    const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const preliminary = isPreliminarySnapshot(snap);
    const ownBase = getCanonicalDefaultVersionName(snap);
    const current = String(versionName || '').trim();
    if(!ownBase || !current) return false;
    const pattern = new RegExp(`^${escapeRegExp(ownBase)}(?: — wariant \\d+)?$`);
    return pattern.test(current);
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

  function snapshotScopeOverlaps(snapshot, roomIds){
    const targets = normalizeRoomIds(roomIds);
    if(!targets.length) return true;
    const snapshotRooms = getSnapshotRoomIds(snapshot);
    if(!snapshotRooms.length) return true;
    return targets.some((roomId)=> snapshotRooms.includes(roomId));
  }


  function resolveSelectionScopeRoomIds(candidate, options){
    const opts = options && typeof options === 'object' ? options : {};
    const explicit = normalizeRoomIds(opts.roomIds);
    const candidateRooms = getSnapshotRoomIds(candidate);
    return candidateRooms.length ? candidateRooms : explicit;
  }

  function listSelectionImpactedRows(projectRows, roomIds){
    const rows = Array.isArray(projectRows) ? projectRows : [];
    const targets = normalizeRoomIds(roomIds);
    if(!targets.length) return rows.slice();
    return rows.filter((row)=> snapshotScopeOverlaps(row, targets));
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
    const selectionScopeRoomIds = resolveSelectionScopeRoomIds(candidate, options);
    const impactedRows = listSelectionImpactedRows(projectRows, selectionScopeRoomIds);
    const impactedSelectedIds = new Set(impactedRows
      .filter((row)=> !!(row && row.meta && row.meta.selectedByClient))
      .map((row)=> String(row && row.id || ''))
      .filter(Boolean));
    const stamp = Date.now();
    list.forEach((row)=> {
      if(String(row && row.project && row.project.id || '') !== pid) return;
      const rowId = String(row && row.id || '');
      const isTarget = !!(candidate && rowId === String(candidate.id || ''));
      const isImpacted = !selectionScopeRoomIds.length || impactedRows.some((item)=> String(item && item.id || '') === rowId);
      if(!isImpacted) return;
      const isPreviousSelected = impactedSelectedIds.has(rowId);
      const shouldRejectPrevious = isPreviousSelected && shouldRejectPreviousSelection(row, candidate, Object.assign({}, options || {}, { roomIds:selectionScopeRoomIds }));
      const rejectReason = shouldRejectPrevious ? getRejectReason(candidate, options) : '';
      const preservedRejectedAt = Number(row && row.meta && row.meta.rejectedAt) > 0 ? Number(row.meta.rejectedAt) : 0;
      const preservedRejectedReason = String(row && row.meta && row.meta.rejectedReason || '').trim().toLowerCase();
      row.meta = Object.assign({}, row && row.meta || {}, {
        versionName: String(row && row.meta && row.meta.versionName || row && row.commercial && row.commercial.versionName || '').trim(),
        preliminary: isPreliminarySnapshot(row),
        selectedByClient: isTarget ? true : (!!(row && row.meta && row.meta.selectedByClient) && !isPreviousSelected),
        acceptedAt: isTarget ? (Number(row && row.meta && row.meta.acceptedAt) > 0 ? Number(row.meta.acceptedAt) : stamp) : (isPreviousSelected ? 0 : Number(row && row.meta && row.meta.acceptedAt) || 0),
        acceptedStage: isTarget ? normalizedAcceptedStage : (isPreviousSelected ? '' : String(row && row.meta && row.meta.acceptedStage || '')),
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
    const targetPreliminaryName = getCanonicalDefaultVersionName(target);
    const targetFinalName = buildScopedVersionName(false, target);
    const nextVersionName = (!currentName || currentName === targetPreliminaryName)
      ? targetFinalName
      : currentName;
    const selectionScopeRoomIds = getSnapshotRoomIds(target);
    const impactedRows = listSelectionImpactedRows(
      list.filter((row)=> String(row && row.project && row.project.id || '') === pid),
      selectionScopeRoomIds
    );
    const impactedIds = new Set(impactedRows.map((row)=> String(row && row.id || '')).filter(Boolean));
    list.forEach((row)=> {
      if(String(row && row.project && row.project.id || '') !== pid) return;
      const rowId = String(row && row.id || '');
      if(!impactedIds.has(rowId)) return;
      const isTarget = rowId === sid;
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
        meta.rejectedAt = 0;
        meta.rejectedReason = '';
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
