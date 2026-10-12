(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const statusScope = FC.projectStatusScope || {};

  // Odpowiedzialność modułu: workflow snapshotów ofertowych powiązanych ze statusem.
  // Moduł rozszerza publiczne FC.projectStatusSync, ale nie wylicza samodzielnie
  // mapy statusów i nie zapisuje luster — deleguje to do silnika statusów.

  const normalizeStatus = (FC.projectStatusSync && FC.projectStatusSync.normalizeStatus)
    || statusScope.normalizeStatus
    || ((value)=> String(value || '').trim().toLowerCase());
  const statusRank = (FC.projectStatusSync && FC.projectStatusSync.statusRank)
    || statusScope.statusRank
    || ((value)=> ({ nowy:0, wstepna_wycena:1, pomiar:2, wycena:3, zaakceptowany:4, umowa:5, produkcja:6, montaz:7, zakonczone:8 }[normalizeStatus(value)] || -1));
  const normalizeRoomIds = (FC.projectStatusSync && FC.projectStatusSync.normalizeRoomIds)
    || statusScope.normalizeRoomIds
    || ((roomIds)=> Array.isArray(roomIds) ? Array.from(new Set(roomIds.map((item)=> String(item || '').trim()).filter(Boolean))) : []);
  const getCurrentProjectId = statusScope.getCurrentProjectId || (()=> '');
  const getCurrentInvestorId = statusScope.getCurrentInvestorId || (()=> '');
  const getTargetRoomIdsFromSnapshot = (FC.projectStatusSync && FC.projectStatusSync.getTargetRoomIdsFromSnapshot)
    || statusScope.getTargetRoomIdsFromSnapshot
    || (()=> []);
  const normalizeSnapshot = statusScope.normalizeSnapshot || ((snapshot)=> snapshot || null);

  function listSelectedRowsForProject(projectId){
    const pid = String(projectId || '');
    if(!pid) return [];
    try{
      if(!(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.listForProject === 'function')) return [];
      return (FC.quoteSnapshotStore.listForProject(pid) || []).filter((row)=> !!(row && row.meta && row.meta.selectedByClient));
    }catch(_){ return []; }
  }

  function roomScopesOverlap(a, b){
    const left = normalizeRoomIds(a);
    const right = normalizeRoomIds(b);
    if(!left.length || !right.length) return false;
    return left.some((roomId)=> right.includes(roomId));
  }

  function isPreliminarySnapshot(snapshot){
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.isPreliminarySnapshot === 'function') return !!FC.quoteSnapshotStore.isPreliminarySnapshot(snapshot);
    }catch(_){ }
    return !!(snapshot && ((snapshot.meta && snapshot.meta.preliminary) || (snapshot.commercial && snapshot.commercial.preliminary)));
  }

  function collectReleasedRoomIds(beforeSelectedRows, selectedSnapshot, targetRoomIds){
    const selectedId = String(selectedSnapshot && selectedSnapshot.id || '');
    const targetIds = normalizeRoomIds(targetRoomIds);
    const released = new Set();
    (Array.isArray(beforeSelectedRows) ? beforeSelectedRows : []).forEach((row)=> {
      if(selectedId && String(row && row.id || '') === selectedId) return;
      const rowIds = getTargetRoomIdsFromSnapshot(row);
      if(!roomScopesOverlap(rowIds, targetIds)) return;
      rowIds.forEach((roomId)=> {
        if(roomId && !targetIds.includes(roomId)) released.add(roomId);
      });
    });
    return Array.from(released);
  }

  function getInvestorById(investorId){
    const id = String(investorId || '');
    if(!id) return null;
    try{ if(FC.investors && typeof FC.investors.getById === 'function') return FC.investors.getById(id) || null; }catch(_){ }
    try{ if(FC.investorPersistence && typeof FC.investorPersistence.getInvestorById === 'function') return FC.investorPersistence.getInvestorById(id) || null; }catch(_){ }
    return null;
  }

  function getRoom(investor, roomId){
    const key = String(roomId || '');
    const rooms = investor && Array.isArray(investor.rooms) ? investor.rooms : [];
    return rooms.find((room)=> String(room && room.id || '') === key) || null;
  }

  function selectedRowBaseline(row){
    if(!row || !(row.meta && row.meta.selectedByClient)) return '';
    if(isPreliminarySnapshot(row)) return 'pomiar';
    return 'zaakceptowany';
  }

  function findSelectedRowsForRoom(rows, roomId){
    const key = String(roomId || '');
    return (Array.isArray(rows) ? rows : []).filter((row)=> getTargetRoomIdsFromSnapshot(row).includes(key));
  }

  function collectManualBaseStatusMap(beforeSelectedRows, investorId, roomIds){
    const investor = getInvestorById(investorId);
    const out = {};
    normalizeRoomIds(roomIds).forEach((roomId)=> {
      const key = String(roomId || '');
      if(!key) return;
      const room = getRoom(investor, key);
      const storedManual = normalizeStatus(room && room.lastManualProjectStatus || '');
      if(storedManual){
        out[key] = storedManual;
        return;
      }
      const current = normalizeStatus(room && (room.projectStatus || room.status) || '');
      if(!current || current === 'nowy') return;
      const selectedRows = findSelectedRowsForRoom(beforeSelectedRows, key);
      if(!selectedRows.length){
        out[key] = current;
        return;
      }
      const bestBaselineRank = selectedRows.reduce((best, row)=> Math.max(best, statusRank(selectedRowBaseline(row))), -99);
      if(statusRank(current) > bestBaselineRank) out[key] = current;
    });
    return out;
  }

  function collectPreliminaryDowngradeRoomIds(beforeSelectedRows, selectedSnapshot, targetRoomIds, status){
    if(!isPreliminarySnapshot(selectedSnapshot) || normalizeStatus(status) !== 'pomiar') return [];
    const selectedId = String(selectedSnapshot && selectedSnapshot.id || '');
    const targetIds = normalizeRoomIds(targetRoomIds);
    const forced = new Set();
    (Array.isArray(beforeSelectedRows) ? beforeSelectedRows : []).forEach((row)=> {
      if(selectedId && String(row && row.id || '') === selectedId) return;
      if(!row || !(row.meta && row.meta.selectedByClient)) return;
      if(isPreliminarySnapshot(row)) return;
      const rowIds = getTargetRoomIdsFromSnapshot(row);
      if(!roomScopesOverlap(rowIds, targetIds)) return;
      rowIds.forEach((roomId)=> {
        if(roomId && targetIds.includes(roomId)) forced.add(roomId);
      });
    });
    return Array.from(forced);
  }

  function setStatusFromSnapshot(snapshot, status, options){
    if(FC.projectStatusSync && typeof FC.projectStatusSync.setStatusFromSnapshot === 'function'){
      return FC.projectStatusSync.setStatusFromSnapshot(snapshot, status, options);
    }
    return null;
  }

  function reconcileProjectStatuses(options){
    if(FC.projectStatusSync && typeof FC.projectStatusSync.reconcileProjectStatuses === 'function'){
      return FC.projectStatusSync.reconcileProjectStatuses(options);
    }
    return null;
  }

  function getAcceptanceImpact(snapshot){
    const projectId = snapshot && snapshot.project && snapshot.project.id;
    const roomIds = getTargetRoomIdsFromSnapshot(snapshot);
    return {roomIds,releasedRoomIds:collectReleasedRoomIds(listSelectedRowsForProject(projectId),snapshot,roomIds)};
  }
  function commitAcceptedSnapshot(snapshot, status, options){
    return applySnapshotWorkflow(snapshot,status,options,false);
  }
  function applySnapshotWorkflow(snapshot,status,options,promote){
    const opts = options && typeof options === 'object' ? options : {};
    const projectId = String(snapshot && snapshot.project && snapshot.project.id || '');
    const snapshotId = String(snapshot && snapshot.id || '');
    const nextStatus = normalizeStatus(status);
    const requestKey = (promote ? 'promote:' : 'accept:')+snapshotId+':'+nextStatus;
    const record = projectId && FC.projectStore.getById(projectId);
    if(!record || !snapshotId || !nextStatus) return {ok:false,reason:'invalid-offer-owner'};
    if(FC.session && FC.session.active){
      try{ FC.infoBox && FC.infoBox.open({title:'Najpierw zakończ edycję',message:'Zapisz lub anuluj edycję przed zatwierdzeniem oferty.',okOnly:true}); }catch(_){ }
      return {ok:false,reason:'active-session'};
    }
    const pending = record.meta && record.meta.pendingDomainOperation;
    if(pending){
      if(pending.kind !== 'offerStatus' || pending.requestKey !== requestKey) return {ok:false,partial:true,reason:'different-pending-operation'};
      return FC.projectDomainOperations.recoverProject(projectId);
    }
    const snap = FC.quoteSnapshotStore.getById(snapshotId);
    const investorId = record.investorId;
    if(!snap || String(snap.project && snap.project.id) !== projectId
      || String(snap.project && snap.project.investorId || snap.investor && snap.investor.id) !== investorId
      || (snap.investor && String(snap.investor.id) !== investorId)
      || (opts.investorId && String(opts.investorId) !== investorId)) return {ok:false,reason:'offer-context-mismatch'};
    const targetRoomIds = getTargetRoomIdsFromSnapshot(snap);
    if(!targetRoomIds.length || (opts.roomIds && !FC.quoteSnapshotScope.sameRoomScope(normalizeRoomIds(opts.roomIds),targetRoomIds))) return {ok:false,reason:'offer-scope-mismatch'};
    const before = listSelectedRowsForProject(projectId);
    const history = FC.projectDomainOperations.readHistory();
    const planned = FC.quoteSnapshotStore.previewSelection(promote ? 'convertPreliminaryToFinal' : 'markSelectedForProject',
      promote ? [projectId,snapshotId] : [projectId,snapshotId,{status:nextStatus,roomIds:targetRoomIds}],history);
    if(!planned.result) return {ok:false,reason:'selection-not-confirmed'};
    const selected = planned.result;
    const releasedRoomIds = collectReleasedRoomIds(before,selected,targetRoomIds);
    const forceStatusRoomIds = collectPreliminaryDowngradeRoomIds(before,selected,targetRoomIds,nextStatus);
    const manualBaseStatusMap = collectManualBaseStatusMap(before,investorId,targetRoomIds);
    const restoreManualStatusMap = collectManualBaseStatusMap(before,investorId,releasedRoomIds);
    const statusResult = setStatusFromSnapshot(selected,nextStatus,Object.assign({},opts,{
      preview:true,historyRows:planned.rows,investorId,roomIds:targetRoomIds,syncSelection:false,
      preserveCurrentWhenNoQuoteRows:true,preserveForwardProgress:true,forceStatusRoomIds,manualBaseStatusMap,
    }));
    if(!statusResult || statusResult.ok !== true) return {ok:false,reason:'status-plan-invalid'};
    const releaseStatusResult = releasedRoomIds.length ? reconcileProjectStatuses({
      preview:true,historyRows:planned.rows,projectId,investorId,roomIds:releasedRoomIds,restrictToRoomIds:true,
      fallbackStatus:'nowy',restoreManualStatusMap,restoreManualForReleasedRooms:true,refreshUi:false,
    }) : null;
    if(releaseStatusResult && releaseStatusResult.ok !== true) return {ok:false,reason:'released-status-plan-invalid'};
    const roomStatusMap = Object.assign({},statusResult.roomStatusMap);
    for(const id of releasedRoomIds) roomStatusMap[id] = releaseStatusResult.roomStatusMap[id];
    const affectedRoomIds = normalizeRoomIds(targetRoomIds.concat(releasedRoomIds));
    const manualMap = Object.assign({},manualBaseStatusMap,restoreManualStatusMap);
    const operationResult = {snapshot:selected,selectedSnapshot:selected,convertedSnapshot:promote ? selected : undefined,
      statusResult,releaseStatusResult,releasedRoomIds,forceStatusRoomIds,manualBaseStatusMap,restoreManualStatusMap,
      roomIds:targetRoomIds,affectedRoomIds,projectId,investorId,masterStatus:statusResult.masterStatus,mirrorStatus:statusResult.masterStatus};
    const result = FC.projectStatusSync.persistStatusPlan(record,getInvestorById(investorId),roomStatusMap,manualMap,affectedRoomIds,
      statusResult.masterStatus,planned.rows,{requestKey,operationResult});
    if(result.ok && opts.refreshUi !== false && FC.projectStatusMirrors) FC.projectStatusMirrors.refreshStatusViews();
    return result;
  }

  function reconcileStatusAfterSnapshotRemoval(snapshot, options){
    const snap = normalizeSnapshot(snapshot) || null;
    if(!snap) return null;
    const opts = options && typeof options === 'object' ? options : {};
    const roomIds = normalizeRoomIds(opts.roomIds).length ? normalizeRoomIds(opts.roomIds) : getTargetRoomIdsFromSnapshot(snap);
    return reconcileProjectStatuses({
      projectId: String(opts.projectId || snap && snap.project && snap.project.id || getCurrentProjectId() || ''),
      investorId: String(opts.investorId || snap && snap.investor && snap.investor.id || snap && snap.project && snap.project.investorId || getCurrentInvestorId() || ''),
      roomIds,
      restrictToRoomIds: roomIds.length > 0,
      fallbackStatus: opts.fallbackStatus || 'nowy',
      refreshUi: opts.refreshUi,
    });
  }

  function promotePreliminarySnapshotToFinal(snapshot, options){
    return applySnapshotWorkflow(snapshot,'zaakceptowany',options,true);
  }

  const api = {
    commitAcceptedSnapshot,
    getAcceptanceImpact,
    reconcileStatusAfterSnapshotRemoval,
    promotePreliminarySnapshotToFinal,
  };

  FC.projectStatusSnapshotFlow = api;
  FC.projectStatusSync = FC.projectStatusSync || {};
  Object.assign(FC.projectStatusSync, api);
})();
