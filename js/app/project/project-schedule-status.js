(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  // Odpowiedzialność modułu: read-only przygotowanie statusów pokoi pod przyszły harmonogram.
  // Ten moduł niczego nie zapisuje. Zwraca kolejki: do pomiaru i do wyceny końcowej.

  const TASKS = {
    MEASURE:'measurement',
    FINAL_QUOTE:'final_quote',
  };

  const TASK_LABELS = {
    measurement:'Do pomiaru',
    final_quote:'Do wyceny końcowej',
  };

  function normalizeStatus(value){
    try{
      if(FC.projectStatusSync && typeof FC.projectStatusSync.normalizeStatus === 'function') return FC.projectStatusSync.normalizeStatus(value);
    }catch(_){ }
    return String(value || '').trim().toLowerCase();
  }

  function normalizeRoomIds(roomIds){
    try{
      if(FC.projectStatusSync && typeof FC.projectStatusSync.normalizeRoomIds === 'function') return FC.projectStatusSync.normalizeRoomIds(roomIds);
    }catch(_){ }
    return Array.isArray(roomIds)
      ? Array.from(new Set(roomIds.map((item)=> String(item || '').trim()).filter(Boolean)))
      : [];
  }

  function getInvestorById(investorId){
    const key = String(investorId || '');
    if(!key) return null;
    try{ return FC.investors && typeof FC.investors.getById === 'function' ? (FC.investors.getById(key) || null) : null; }
    catch(_){ return null; }
  }

  function getAllInvestors(){
    try{ return FC.investors && typeof FC.investors.readAll === 'function' ? (FC.investors.readAll() || []) : []; }
    catch(_){ return []; }
  }

  function getProjectForInvestor(investorId){
    const key = String(investorId || '');
    if(!key) return null;
    try{ return FC.projectStore && typeof FC.projectStore.getByInvestorId === 'function' ? (FC.projectStore.getByInvestorId(key) || null) : null; }
    catch(_){ return null; }
  }

  function getSnapshotRoomIds(row){
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getSnapshotRoomIds === 'function') return normalizeRoomIds(FC.quoteSnapshotStore.getSnapshotRoomIds(row));
    }catch(_){ }
    return normalizeRoomIds(row && row.scope && row.scope.selectedRooms);
  }

  function isPreliminary(row){
    try{ return !!(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.isPreliminarySnapshot === 'function' && FC.quoteSnapshotStore.isPreliminarySnapshot(row)); }
    catch(_){ return !!(row && (row.meta && row.meta.preliminary || row.commercial && row.commercial.preliminary)); }
  }

  function isSelected(row){
    return !!(row && row.meta && row.meta.selectedByClient);
  }

  function listProjectSnapshots(projectId){
    const pid = String(projectId || '');
    if(!pid) return [];
    try{ return FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.listForProject === 'function' ? (FC.quoteSnapshotStore.listForProject(pid) || []) : []; }
    catch(_){ return []; }
  }

  function listAcceptedSnapshotsForRoom(projectId, roomId){
    const key = String(roomId || '');
    if(!key) return [];
    return listProjectSnapshots(projectId).filter((row)=> isSelected(row) && getSnapshotRoomIds(row).includes(key));
  }

  function getRoomLabel(room){
    return String(room && (room.label || room.name || room.id) || '').trim();
  }

  function getRoomStatus(room){
    return normalizeStatus(room && (room.projectStatus || room.status) || 'nowy') || 'nowy';
  }

  function getQuoteAvailability(roomId){
    try{
      if(FC.wycenaRoomAvailability && typeof FC.wycenaRoomAvailability.summarizeRoomAvailability === 'function'){
        const row = FC.wycenaRoomAvailability.summarizeRoomAvailability([roomId])[0] || null;
        if(row) return { quoteable: !row.blocked, blocked: !!row.blocked, reason:String(row.reason || '') };
      }
    }catch(_){ }
    return { quoteable:true, blocked:false, reason:'' };
  }

  function resolveTaskType(status){
    const key = normalizeStatus(status);
    if(key === 'pomiar') return TASKS.MEASURE;
    if(key === 'wycena') return TASKS.FINAL_QUOTE;
    return '';
  }

  function getAcceptedQuoteInfo(projectId, roomId){
    const accepted = listAcceptedSnapshotsForRoom(projectId, roomId);
    const acceptedPreliminary = accepted.find((row)=> isPreliminary(row)) || null;
    const acceptedFinal = accepted.find((row)=> !isPreliminary(row)) || null;
    return {
      accepted,
      acceptedPreliminary,
      acceptedFinal,
      hasAcceptedPreliminary: !!acceptedPreliminary,
      hasAcceptedFinal: !!acceptedFinal,
      preliminaryScopeRoomIds: acceptedPreliminary ? getSnapshotRoomIds(acceptedPreliminary) : [],
      finalScopeRoomIds: acceptedFinal ? getSnapshotRoomIds(acceptedFinal) : [],
    };
  }

  function resolveSource(status, quoteInfo){
    const key = normalizeStatus(status);
    if(quoteInfo && quoteInfo.hasAcceptedFinal) return 'accepted_final';
    if(quoteInfo && quoteInfo.hasAcceptedPreliminary){
      return key === 'wycena' ? 'after_measure_with_preliminary' : 'accepted_preliminary';
    }
    if(key === 'pomiar' || key === 'wycena') return 'manual_without_preliminary';
    return 'status_only';
  }

  function buildRoomScheduleEntry(investorId, roomId){
    const investor = getInvestorById(investorId);
    const project = getProjectForInvestor(investorId);
    const key = String(roomId || '');
    const room = investor && Array.isArray(investor.rooms) ? investor.rooms.find((item)=> String(item && item.id || '') === key) : null;
    if(!investor || !room || !key) return null;
    const status = getRoomStatus(room);
    const taskType = resolveTaskType(status);
    const quoteInfo = getAcceptedQuoteInfo(project && project.id, key);
    const availability = getQuoteAvailability(key);
    return {
      investorId:String(investor.id || investorId || ''),
      investorName:String(investor.name || investor.fullName || investor.title || '').trim(),
      projectId:String(project && project.id || ''),
      projectTitle:String(project && project.title || '').trim(),
      roomId:key,
      roomLabel:getRoomLabel(room) || key,
      status,
      taskType,
      taskLabel: TASK_LABELS[taskType] || '',
      source: resolveSource(status, quoteInfo),
      needsMeasurement: taskType === TASKS.MEASURE,
      needsFinalQuote: taskType === TASKS.FINAL_QUOTE,
      hasAcceptedPreliminary: quoteInfo.hasAcceptedPreliminary,
      hasAcceptedFinal: quoteInfo.hasAcceptedFinal,
      preliminaryScopeRoomIds: quoteInfo.preliminaryScopeRoomIds,
      finalScopeRoomIds: quoteInfo.finalScopeRoomIds,
      quoteable: availability.quoteable,
      quoteBlockedReason: availability.reason,
    };
  }

  function listInvestorEntries(investorId, options){
    const investor = getInvestorById(investorId);
    const opts = options && typeof options === 'object' ? options : {};
    const includeInactive = !!opts.includeInactive;
    const rooms = investor && Array.isArray(investor.rooms) ? investor.rooms : [];
    return rooms.map((room)=> buildRoomScheduleEntry(investorId, room && room.id))
      .filter(Boolean)
      .filter((entry)=> includeInactive || !!entry.taskType);
  }

  function buildInvestorBuckets(investorId, options){
    const entries = listInvestorEntries(investorId, options);
    return {
      investorId:String(investorId || ''),
      measurement: entries.filter((entry)=> entry.taskType === TASKS.MEASURE),
      finalQuote: entries.filter((entry)=> entry.taskType === TASKS.FINAL_QUOTE),
      active: entries,
    };
  }

  function listAllEntries(options){
    return getAllInvestors().flatMap((investor)=> listInvestorEntries(investor && investor.id, options));
  }

  function buildAllBuckets(options){
    const entries = listAllEntries(options);
    return {
      measurement: entries.filter((entry)=> entry.taskType === TASKS.MEASURE),
      finalQuote: entries.filter((entry)=> entry.taskType === TASKS.FINAL_QUOTE),
      active: entries,
    };
  }

  FC.projectScheduleStatus = {
    TASKS,
    TASK_LABELS,
    normalizeStatus,
    normalizeRoomIds,
    resolveTaskType,
    buildRoomScheduleEntry,
    listInvestorEntries,
    buildInvestorBuckets,
    listAllEntries,
    buildAllBuckets,
  };
})();
