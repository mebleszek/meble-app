(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function requireDep(deps, name){
    const value = deps && deps[name];
    if(typeof value === 'undefined' || value === null) throw new Error('Brak dependency dla quoteSnapshotSelection.' + name);
    return value;
  }

  function requireFn(deps, name){
    const fn = requireDep(deps, name);
    if(typeof fn !== 'function') throw new Error('Brak funkcji dependency dla quoteSnapshotSelection.' + name);
    return fn;
  }

  function pickCandidate(projectRows, predicate){
    const rows = Array.isArray(projectRows) ? projectRows : [];
    return rows.find((row)=> !!(row && row.meta && row.meta.selectedByClient) && predicate(row))
      || rows.find((row)=> predicate(row))
      || null;
  }

  function createApi(deps){
    const FINAL_STATUSES = requireDep(deps, 'FINAL_STATUSES');
    const normalizeStatus = requireFn(deps, 'normalizeStatus');
    const readAll = requireFn(deps, 'readAll');
    const writeAll = requireFn(deps, 'writeAll');
    const getById = requireFn(deps, 'getById');
    const listForProject = requireFn(deps, 'listForProject');
    const defaultVersionName = requireFn(deps, 'defaultVersionName');
    const isPreliminarySnapshot = requireFn(deps, 'isPreliminarySnapshot');
    const normalizeRoomIds = requireFn(deps, 'normalizeRoomIds');
    const getSnapshotRoomIds = requireFn(deps, 'getSnapshotRoomIds');
    const filterRowsByRoomScope = requireFn(deps, 'filterRowsByRoomScope');
    const resolveSelectionScopeRoomIds = requireFn(deps, 'resolveSelectionScopeRoomIds');
    const listSelectionImpactedRows = requireFn(deps, 'listSelectionImpactedRows');
    const isRejectedSnapshot = requireFn(deps, 'isRejectedSnapshot');
    const shouldRejectPreviousSelection = requireFn(deps, 'shouldRejectPreviousSelection');
    const getRejectReason = requireFn(deps, 'getRejectReason');
    const getCanonicalDefaultVersionName = requireFn(deps, 'getCanonicalDefaultVersionName');
    const buildScopedVersionName = requireFn(deps, 'buildScopedVersionName');

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

    function getActiveSelectedRowsForScope(projectId, options){
      const pid = String(projectId || '');
      if(!pid) return [];
      const projectRows = listForProject(pid);
      return filterRowsByRoomScope(projectRows, options && options.roomIds, options)
        .filter((row)=> !!(row && row.meta && row.meta.selectedByClient) && !isRejectedSnapshot(row));
    }

    function shouldPreserveAcceptedPreliminaryForFinalQuoteStage(projectId, options){
      const selectedRows = getActiveSelectedRowsForScope(projectId, options);
      const hasSelectedFinal = selectedRows.some((row)=> !isPreliminarySnapshot(row));
      if(hasSelectedFinal) return false;
      return selectedRows.some((row)=> isPreliminarySnapshot(row));
    }

    function syncSelectionForProjectStatus(projectId, status, options){
      const pid = String(projectId || '');
      const normalizedStatus = normalizeStatus(status);
      if(!pid) return null;
      if(normalizedStatus === 'pomiar'){
        return updateSelectionForProject(pid, (rows)=> pickCandidate(rows, (row)=> isPreliminarySnapshot(row)), 'pomiar', 'pomiar', options);
      }
      if(normalizedStatus === 'wycena'){
        if(shouldPreserveAcceptedPreliminaryForFinalQuoteStage(pid, options)){
          return getActiveSelectedRowsForScope(pid, options).find((row)=> isPreliminarySnapshot(row)) || null;
        }
        return updateSelectionForProject(pid, ()=> null, 'wycena', '', options);
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
        if(isPreliminarySnapshot(selected)){
          if(normalizedCurrent === 'wycena') return 'wycena';
          return 'pomiar';
        }
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

    return {
      updateSelectionForProject,
      markSelectedForProject,
      syncSelectionForProjectStatus,
      getRecommendedStatusForProject,
      getRecommendedStatusMapForProject,
      convertPreliminaryToFinal,
    };
  }

  FC.quoteSnapshotSelection = { createApi };
})();
