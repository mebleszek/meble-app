(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  // Odpowiedzialność modułu: czyste helpery zakresu/scope ofert.
  // Nie czyta ani nie zapisuje storage; snapshot-store używa tych helperów
  // jako wspólnego kontraktu dla nazw wersji, pokojów, exact-scope i overlap.

  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
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

  function getScopeRoomLabels(snapshotOrScope, options){
    const source = snapshotOrScope && snapshotOrScope.scope ? snapshotOrScope.scope : snapshotOrScope;
    const opts = options && typeof options === 'object' ? options : {};
    const roomIds = normalizeRoomIds(source && source.selectedRooms);
    const explicitLabels = Array.isArray(source && source.roomLabels)
      ? source.roomLabels.map((item)=> String(item || '').trim())
      : [];
    const nonEmptyExplicitLabels = explicitLabels.filter(Boolean);
    const hasCompleteExplicitLabels = roomIds.length > 0
      && explicitLabels.length >= roomIds.length
      && roomIds.every((_roomId, index)=> !!String(explicitLabels[index] || '').trim());
    if(opts.preserveExplicitLabels && hasCompleteExplicitLabels){
      return explicitLabels.slice(0, roomIds.length).map((item)=> String(item || '').trim()).filter(Boolean);
    }
    try{
      if(FC.quoteSnapshot && typeof FC.quoteSnapshot.resolveVersionScopeLabels === 'function'){
        const resolved = FC.quoteSnapshot.resolveVersionScopeLabels({ roomIds, roomLabels:nonEmptyExplicitLabels });
        if(Array.isArray(resolved) && resolved.length) return resolved;
      }
    }catch(_){ }
    if(roomIds.length){
      const labels = roomIds.map((roomId, index)=> {
        const registryLabel = String(getRoomLabel(roomId) || '').trim();
        if(registryLabel && registryLabel !== String(roomId || '').trim()) return registryLabel;
        const explicitLabel = String(explicitLabels[index] || '').trim();
        return explicitLabel || registryLabel || roomId;
      }).filter(Boolean);
      if(labels.length) return labels;
      return roomIds;
    }
    return nonEmptyExplicitLabels;
  }

  function buildScopedVersionName(preliminary, snapshotOrScope, options){
    const base = preliminary ? 'Wstępna oferta' : 'Oferta';
    const labels = getScopeRoomLabels(snapshotOrScope, options);
    return labels.length ? `${base} — ${labels.join(' + ')}` : base;
  }

  function buildCanonicalScope(snapshotOrScope, options){
    const source = snapshotOrScope && snapshotOrScope.scope ? snapshotOrScope.scope : snapshotOrScope;
    const opts = options && typeof options === 'object' ? options : {};
    const materialScope = normalizeMaterialScope(source && source.materialScope);
    const selectedRooms = normalizeRoomIds(source && source.selectedRooms);
    const roomLabels = getScopeRoomLabels({ selectedRooms, roomLabels: Array.isArray(source && source.roomLabels) ? source.roomLabels.slice() : [] }, opts);
    return Object.assign({}, clone(source || {}), {
      selectedRooms,
      roomLabels,
      materialScope,
      materialScopeMode: String(source && source.materialScopeMode || materialScopeMode(materialScope) || ''),
    });
  }

  function getCanonicalDefaultVersionName(snapshot, options){
    const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
    return String(buildScopedVersionName(isPreliminarySnapshot(snap), snap, options) || '').trim();
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

  FC.quoteSnapshotScope = {
    normalizeMaterialScope,
    materialScopeMode,
    isPreliminarySnapshot,
    normalizeRoomIds,
    getScopeRoomLabels,
    buildScopedVersionName,
    buildCanonicalScope,
    getCanonicalDefaultVersionName,
    parseAutoVersionName,
    coerceAutoVersionNameForScope,
    getSnapshotRoomIds,
    sameRoomScope,
    normalizeComparableVersionName,
    escapeRegExp,
    matchesOwnAutoVersionName,
    snapshotScopeOverlaps,
    resolveSelectionScopeRoomIds,
    listSelectionImpactedRows,
    isRejectedSnapshot,
    shouldRejectPreviousSelection,
    getRejectReason,
    filterRowsByRoomScope,
    filterRowsByQuoteType
  };
})();
