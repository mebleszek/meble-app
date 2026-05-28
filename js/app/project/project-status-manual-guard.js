(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const roomScopeResolver = FC.roomScopeResolver;

  const FINAL_MANUAL_TARGETS = new Set(['zaakceptowany','umowa','produkcja','montaz','zakonczone']);
  const STATUS_LABELS = {
    nowy:'Nowy',
    wstepna_wycena:'Wstępna wycena',
    pomiar:'Pomiar',
    wycena:'Wycena',
    zaakceptowany:'Zaakceptowany',
    umowa:'Umowa',
    produkcja:'Produkcja',
    montaz:'Montaż',
    zakonczone:'Zakończone',
    odrzucone:'Odrzucone',
  };

  // Odpowiedzialność modułu: walidacja ręcznych przejść statusu.
  // Guard sprawdza, czy dane przejście jest dozwolone dla exact scope pokoju,
  // ale nie zapisuje końcowego stanu projektu i nie synchronizuje luster.

  function normalizeStatus(value){
    try{
      if(FC.projectStatusSync && typeof FC.projectStatusSync.normalizeStatus === 'function') return FC.projectStatusSync.normalizeStatus(value);
    }catch(_){ }
    return String(value || '').trim().toLowerCase();
  }

  function statusRank(value){
    try{
      if(FC.projectStatusSync && typeof FC.projectStatusSync.statusRank === 'function') return FC.projectStatusSync.statusRank(value);
    }catch(_){ }
    return -99;
  }

  function normalizeRoomIds(roomIds){
    try{
      if(roomScopeResolver && typeof roomScopeResolver.normalizeRoomIds === 'function') return roomScopeResolver.normalizeRoomIds(roomIds);
    }catch(_){ }
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.normalizeRoomIds === 'function') return FC.quoteSnapshotStore.normalizeRoomIds(roomIds);
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

  function getProjectByInvestorId(investorId){
    const key = String(investorId || '');
    if(!key) return null;
    try{ return FC.projectStore && typeof FC.projectStore.getByInvestorId === 'function' ? (FC.projectStore.getByInvestorId(key) || null) : null; }
    catch(_){ return null; }
  }

  function getRoom(investor, roomId){
    const key = String(roomId || '');
    const rooms = investor && Array.isArray(investor.rooms) ? investor.rooms : [];
    return rooms.find((room)=> String(room && room.id || '') === key) || null;
  }

  function getRoomLabel(investor, roomId){
    const room = getRoom(investor, roomId);
    return String(room && (room.label || room.name || room.id) || roomId || '').trim() || 'to pomieszczenie';
  }

  function getSnapshotRoomIds(row){
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getSnapshotRoomIds === 'function'){
        return normalizeRoomIds(FC.quoteSnapshotStore.getSnapshotRoomIds(row));
      }
    }catch(_){ }
    return normalizeRoomIds(row && row.scope && row.scope.selectedRooms);
  }

  function getScopedRowsForRoom(projectId, roomIds, options){
    const pid = String(projectId || '');
    const ids = normalizeRoomIds(roomIds);
    const opts = options && typeof options === 'object' ? options : {};
    const matchMode = String(opts.matchMode || 'exact').trim().toLowerCase();
    if(!pid || !ids.length) return [];
    if(matchMode === 'exact'){
      try{
        if(roomScopeResolver && typeof roomScopeResolver.filterExactScopedRows === 'function'){
          return roomScopeResolver.filterExactScopedRows(pid, ids, { allowProjectWideExact: !!opts.allowProjectWideExact });
        }
      }catch(_){ }
      try{
        if(!(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.listForProject === 'function' && typeof FC.quoteSnapshotStore.filterRowsByRoomScope === 'function')) return [];
        const rows = FC.quoteSnapshotStore.listForProject(pid);
        return FC.quoteSnapshotStore.filterRowsByRoomScope(rows, ids, { matchMode:'exact', allowProjectWideExact: !!opts.allowProjectWideExact }) || [];
      }catch(_){ return []; }
    }

    try{
      if(!(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.listForProject === 'function')) return [];
      const rows = FC.quoteSnapshotStore.listForProject(pid) || [];
      return rows.filter((row)=> {
        const snapshotRooms = getSnapshotRoomIds(row);
        if(!snapshotRooms.length) return !!(opts.allowProjectWideExact && ids.length === 1);
        return ids.every((roomId)=> snapshotRooms.includes(roomId));
      });
    }catch(_){ return []; }
  }

  function splitQuoteRows(rows){
    const safeRows = Array.isArray(rows) ? rows : [];
    const preliminaryRows = safeRows.filter((row)=> !!(FC.quoteSnapshotStore && FC.quoteSnapshotStore.isPreliminarySnapshot && FC.quoteSnapshotStore.isPreliminarySnapshot(row)));
    const finalRows = safeRows.filter((row)=> !(FC.quoteSnapshotStore && FC.quoteSnapshotStore.isPreliminarySnapshot && FC.quoteSnapshotStore.isPreliminarySnapshot(row)));
    return {
      rows: safeRows,
      preliminaryRows,
      finalRows,
      acceptedPreliminary: preliminaryRows.find((row)=> !!(row && row.meta && row.meta.selectedByClient)) || null,
      acceptedFinal: finalRows.find((row)=> !!(row && row.meta && row.meta.selectedByClient)) || null,
    };
  }

  function analyzeRoomQuoteState(investorId, roomId){
    const investor = getInvestorById(investorId);
    const project = getProjectByInvestorId(investorId);
    const resolvedRoomId = String(roomId || '');
    const currentStatus = normalizeStatus(getRoom(investor, resolvedRoomId) && getRoom(investor, resolvedRoomId).projectStatus || '');
    const roomLabel = getRoomLabel(investor, resolvedRoomId);
    const investorRoomCount = investor && Array.isArray(investor.rooms) ? investor.rooms.length : 0;
    const quoteRows = splitQuoteRows(getScopedRowsForRoom(project && project.id, [resolvedRoomId], {
      matchMode:'includes',
      allowProjectWideExact: investorRoomCount === 1,
    }));
    return {
      investorId:String(investorId || ''),
      projectId:String(project && project.id || ''),
      roomId:resolvedRoomId,
      roomLabel,
      currentStatus,
      room:getRoom(investor, resolvedRoomId),
      investor,
      project,
      rows: quoteRows.rows,
      preliminaryRows: quoteRows.preliminaryRows,
      finalRows: quoteRows.finalRows,
      hasPreliminary: quoteRows.preliminaryRows.length > 0,
      hasFinal: quoteRows.finalRows.length > 0,
      acceptedPreliminary: quoteRows.acceptedPreliminary,
      acceptedFinal: quoteRows.acceptedFinal,
      hasAcceptedPreliminary: !!quoteRows.acceptedPreliminary,
      hasAcceptedFinal: !!quoteRows.acceptedFinal,
    };
  }

  function buildResult(base, extra){
    return Object.assign({
      ok:true,
      blocked:false,
      requiresGeneration:false,
      generationKind:'',
      title:'',
      message:'',
      targetStatus: normalizeStatus(base && base.targetStatus),
      targetLabel: STATUS_LABELS[normalizeStatus(base && base.targetStatus)] || String(base && base.targetStatus || ''),
    }, base || {}, extra || {});
  }

  function evaluateManualStatusChangeFromBasis(basisInput, targetStatus){
    const basis = basisInput && typeof basisInput === 'object' ? basisInput : analyzeRoomQuoteState('', '');
    const nextStatus = normalizeStatus(targetStatus);
    const currentRank = statusRank(basis.currentStatus || '');
    const nextRank = statusRank(nextStatus);
    const movingUp = nextRank > currentRank;
    const base = {
      investorId:basis.investorId,
      projectId:basis.projectId,
      roomId:basis.roomId,
      roomLabel:basis.roomLabel,
      currentStatus:basis.currentStatus,
      targetStatus:nextStatus,
      basis
    };

    if(nextStatus === 'pomiar'){
      return buildResult(base, {
        ok:true,
        blocked:false,
        note: basis.hasAcceptedPreliminary ? 'accepted_preliminary_scope' : (basis.hasPreliminary ? 'preliminary_exists_not_required' : 'manual_without_preliminary'),
      });
    }

    if(nextStatus === 'wycena'){
      return buildResult(base, {
        ok:true,
        blocked:false,
        note: basis.hasAcceptedPreliminary ? 'accepted_preliminary_scope' : (basis.hasPreliminary ? 'preliminary_exists_not_required' : 'manual_without_preliminary'),
      });
    }

    if(FINAL_MANUAL_TARGETS.has(nextStatus)){
      if(basis.hasAcceptedFinal) return buildResult(base, { ok:true, blocked:false });
      if(basis.hasFinal){
        return buildResult(base, {
          ok:false,
          blocked:true,
          title:'Wycena końcowa nie jest zaakceptowana',
          message:`Dla pomieszczenia „${basis.roomLabel}” istnieje wycena końcowa, ale nie została zaakceptowana. Najpierw zaakceptuj ją w dziale Wycena, a dopiero potem ustaw status „${STATUS_LABELS[nextStatus] || nextStatus}”.`,
        });
      }
      return buildResult(base, {
        ok:false,
        blocked:true,
        requiresGeneration:true,
        generationKind:'final',
        title:'Brak wyceny końcowej',
        message:`Dla pomieszczenia „${basis.roomLabel}” nie ma wyceny końcowej. Nie można ustawić statusu „${STATUS_LABELS[nextStatus] || nextStatus}”. Czy wygenerować teraz wycenę końcową tylko dla tego pomieszczenia?`,
      });
    }

    if(!movingUp) return buildResult(base, { ok:true, blocked:false });
    return buildResult(base, { ok:true, blocked:false });
  }

  function validateManualStatusChange(investorId, roomId, targetStatus){
    return evaluateManualStatusChangeFromBasis(analyzeRoomQuoteState(investorId, roomId), targetStatus);
  }

  function buildManualStatusChoiceStates(investorId, roomId, targetStatuses){
    const basis = analyzeRoomQuoteState(investorId, roomId);
    const values = Array.isArray(targetStatuses)
      ? targetStatuses.map((value)=> normalizeStatus(value)).filter(Boolean)
      : Object.keys(STATUS_LABELS);
    const uniqueValues = Array.from(new Set(values));
    const map = {};
    uniqueValues.forEach((value)=>{
      map[value] = evaluateManualStatusChangeFromBasis(basis, value);
    });
    return {
      investorId:String(investorId || ''),
      roomId:String(roomId || ''),
      basis,
      states: map,
    };
  }


  function getScopeLabel(roomIds){
    const ids = normalizeRoomIds(roomIds);
    try{
      if(FC.quoteScopeEntry && typeof FC.quoteScopeEntry.getScopeSummary === 'function'){
        const summary = FC.quoteScopeEntry.getScopeSummary(ids) || {};
        return String(summary.scopeLabel || '').trim() || ids.join(', ');
      }
    }catch(_){ }
    return ids.map((roomId)=> {
      try{ return FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function' ? FC.roomRegistry.getRoomLabel(roomId) : roomId; }
      catch(_){ return roomId; }
    }).filter(Boolean).join(', ');
  }

  function getSnapshotVersionName(row){
    return String(row && row.meta && row.meta.versionName || row && row.commercial && row.commercial.versionName || '').trim();
  }

  function buildAcceptedPreliminaryScopeChoices(basis){
    const accepted = (Array.isArray(basis && basis.preliminaryRows) ? basis.preliminaryRows : [])
      .filter((row)=> !!(row && row.meta && row.meta.selectedByClient));
    const seen = new Set();
    const choices = [];
    accepted.forEach((row, index)=> {
      const roomIds = getSnapshotRoomIds(row);
      if(!roomIds.length || !roomIds.includes(String(basis.roomId || ''))) return;
      const key = roomIds.slice().sort().join('|');
      if(seen.has(key)) return;
      seen.add(key);
      const scopeLabel = getScopeLabel(roomIds);
      const versionName = getSnapshotVersionName(row);
      const exactSingle = roomIds.length === 1 && String(roomIds[0] || '') === String(basis.roomId || '');
      choices.push({
        id:`accepted-preliminary-${choices.length + 1}`,
        source:'accepted-preliminary',
        snapshotId:String(row && row.id || ''),
        roomIds,
        scopeLabel,
        label: exactSingle ? `Tylko ${scopeLabel}` : scopeLabel,
        description: versionName ? `Zaakceptowana wycena wstępna: ${versionName}` : 'Zaakceptowana wycena wstępna',
        isExactSingle: exactSingle,
        isMultiRoom: roomIds.length > 1,
        order:index,
      });
    });
    choices.sort((a, b)=> {
      if(a.isExactSingle !== b.isExactSingle) return a.isExactSingle ? -1 : 1;
      return (a.roomIds.length - b.roomIds.length) || (a.order - b.order);
    });
    return choices;
  }

  function buildManualStatusScopeChoices(investorId, roomId, targetStatus){
    const basis = analyzeRoomQuoteState(investorId, roomId);
    const nextStatus = normalizeStatus(targetStatus);
    const base = {
      investorId:String(investorId || ''),
      roomId:String(roomId || ''),
      targetStatus:nextStatus,
      targetLabel:STATUS_LABELS[nextStatus] || nextStatus,
      basis,
      choices:[],
      needsDecision:false,
      autoChoice:null,
      defaultChoiceId:'',
    };
    if(nextStatus !== 'pomiar' && nextStatus !== 'wycena'){
      const autoChoice = { id:'single-room', source:'manual-single', roomIds:[String(roomId || '')].filter(Boolean), scopeLabel:basis.roomLabel, label:`Tylko ${basis.roomLabel}`, description:'' };
      return Object.assign(base, { choices:[autoChoice], autoChoice });
    }
    const acceptedChoices = buildAcceptedPreliminaryScopeChoices(basis);
    const singleRoomChoice = {
      id:'single-room',
      source: acceptedChoices.length ? 'manual-single-room-split' : 'manual-without-preliminary',
      roomIds:[String(roomId || '')].filter(Boolean),
      scopeLabel:basis.roomLabel,
      label:`Tylko ${basis.roomLabel}`,
      description: acceptedChoices.length ? 'Ręczna zmiana tylko tego pomieszczenia.' : 'Ręczna zmiana statusu bez wyceny wstępnej.',
    };
    if(!acceptedChoices.length){
      return Object.assign(base, { choices:[singleRoomChoice], autoChoice:singleRoomChoice, defaultChoiceId:singleRoomChoice.id });
    }
    const hasExactSingle = acceptedChoices.some((choice)=> !!choice.isExactSingle);
    const hasMultiRoom = acceptedChoices.some((choice)=> !!choice.isMultiRoom);
    if(acceptedChoices.length === 1 && hasExactSingle && !hasMultiRoom){
      return Object.assign(base, { choices:acceptedChoices, autoChoice:acceptedChoices[0], defaultChoiceId:acceptedChoices[0].id });
    }
    const choices = hasExactSingle ? acceptedChoices.slice() : [singleRoomChoice].concat(acceptedChoices);
    return Object.assign(base, {
      choices,
      needsDecision:true,
      defaultChoiceId:choices[0] && choices[0].id || '',
    });
  }

  async function generateScopedQuoteForRoom(investorId, roomId, kind, options){
    const opts = options && typeof options === 'object' ? options : {};
    const basis = analyzeRoomQuoteState(investorId, roomId);
    if(!basis.projectId) throw new Error('Brak projektu dla inwestora');
    const preliminary = String(kind || '').trim().toLowerCase() !== 'final';
    const roomIds = [String(roomId || '')].filter(Boolean);
    if(FC.quoteScopeEntry && typeof FC.quoteScopeEntry.ensureScopedQuoteEntry === 'function'){
      const result = await FC.quoteScopeEntry.ensureScopedQuoteEntry({
        investorId:String(investorId || ''),
        projectId:basis.projectId,
        roomIds,
        preliminary,
        status: preliminary ? 'wstepna_wycena' : 'wycena',
        openTab: opts.openTab !== false,
      });
      return Object.assign({
        investorId:String(investorId || ''),
        projectId:basis.projectId,
        roomId:String(roomId || ''),
        roomLabel:basis.roomLabel,
        preliminary,
      }, result || {});
    }

    if(FC.investors && typeof FC.investors.setCurrentId === 'function') FC.investors.setCurrentId(String(investorId || ''));
    if(FC.projectStore && typeof FC.projectStore.setCurrentProjectId === 'function') FC.projectStore.setCurrentProjectId(basis.projectId);
    if(!(FC.quoteOfferStore && typeof FC.quoteOfferStore.patchCurrentDraft === 'function')) throw new Error('Brak quoteOfferStore.patchCurrentDraft');
    FC.quoteOfferStore.patchCurrentDraft({
      selection:{ selectedRooms:roomIds },
      commercial:{ preliminary },
    });
    if(!(FC.wycenaCore && typeof FC.wycenaCore.buildQuoteSnapshot === 'function')) throw new Error('Brak wycenaCore.buildQuoteSnapshot');
    const snapshot = await FC.wycenaCore.buildQuoteSnapshot({ selection:{ selectedRooms:roomIds } });
    return { snapshot, investorId:String(investorId || ''), projectId:basis.projectId, roomId:String(roomId || ''), roomLabel:basis.roomLabel, preliminary };
  }

  FC.projectStatusManualGuard = {
    STATUS_LABELS,
    FINAL_MANUAL_TARGETS,
    analyzeRoomQuoteState,
    evaluateManualStatusChangeFromBasis,
    validateManualStatusChange,
    buildManualStatusChoiceStates,
    buildAcceptedPreliminaryScopeChoices,
    buildManualStatusScopeChoices,
    generateScopedQuoteForRoom,
  };
})();
