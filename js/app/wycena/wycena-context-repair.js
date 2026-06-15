(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  // Odpowiedzialność modułu: naprawa aktywnego kontekstu WYCENY na starym/localStorage.
  // Nie liczy wyceny, nie usuwa snapshotów i nie zmienia modelu ofert. Ustawia tylko
  // spójny aktywny inwestor -> projekt -> zakres pokojów -> draft oferty.

  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }

  function now(){ return Date.now(); }
  function text(value){ return String(value || '').trim(); }

  function storageGetJSON(key, fallback){
    try{ return FC.storage && typeof FC.storage.getJSON === 'function' ? FC.storage.getJSON(key, fallback) : JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(_){ return clone(fallback); }
  }

  function storageSetJSON(key, value){
    try{ if(FC.storage && typeof FC.storage.setJSON === 'function') FC.storage.setJSON(key, value); else localStorage.setItem(key, JSON.stringify(value)); }catch(_){ }
  }

  function storageGetRaw(key){
    try{ return FC.storage && typeof FC.storage.getRaw === 'function' ? FC.storage.getRaw(key) : localStorage.getItem(key); }
    catch(_){ return null; }
  }

  function storageSetRaw(key, value){
    try{ if(FC.storage && typeof FC.storage.setRaw === 'function') FC.storage.setRaw(key, String(value || '')); else localStorage.setItem(key, String(value || '')); }catch(_){ }
  }

  function getKeys(){
    return (FC.constants && FC.constants.STORAGE_KEYS) || {
      ui:'fc_ui_v1',
      projectData:'fc_project_v1',
      currentProjectId:'fc_current_project_id_v1',
      quoteOfferDrafts:'fc_quote_offer_drafts_v1',
      quoteSnapshots:'fc_quote_snapshots_v1',
    };
  }

  function normalizeProjectData(projectData){
    try{ return FC.projectModel && typeof FC.projectModel.normalizeProjectData === 'function' ? FC.projectModel.normalizeProjectData(projectData) : clone(projectData || {}); }
    catch(_){ return clone(projectData || {}); }
  }

  function normalizeProjectRecord(record){
    try{ return FC.projectStore && typeof FC.projectStore.normalizeRecord === 'function' ? FC.projectStore.normalizeRecord(record) : (FC.projectModel && typeof FC.projectModel.normalizeProjectRecord === 'function' ? FC.projectModel.normalizeProjectRecord(record) : clone(record)); }
    catch(_){ return record && typeof record === 'object' ? clone(record) : null; }
  }

  function invalidateRoomRegistryCache(){
    try{ if(FC.roomRegistryDefinitions && typeof FC.roomRegistryDefinitions.invalidateCache === 'function') FC.roomRegistryDefinitions.invalidateCache(); }catch(_){ }
  }

  function getUiState(){
    try{ if(FC.uiState && typeof FC.uiState.get === 'function') return FC.uiState.get() || {}; }catch(_){ }
    try{ if(typeof uiState !== 'undefined' && uiState) return uiState; }catch(_){ }
    return storageGetJSON((getKeys()).ui || 'fc_ui_v1', {});
  }

  function patchUiState(patch){
    const nextPatch = patch && typeof patch === 'object' ? patch : {};
    try{
      if(FC.uiState && typeof FC.uiState.set === 'function'){
        const next = FC.uiState.set(nextPatch);
        try{ if(typeof uiState !== 'undefined') uiState = next; }catch(_){ }
        return next;
      }
    }catch(_){ }
    try{
      const next = Object.assign({}, getUiState(), nextPatch);
      storageSetJSON((getKeys()).ui || 'fc_ui_v1', next);
      try{ if(typeof uiState !== 'undefined') uiState = next; }catch(_){ }
      return next;
    }catch(_){ }
    return null;
  }

  function getCurrentInvestorId(){
    try{ if(FC.investors && typeof FC.investors.getCurrentId === 'function') return text(FC.investors.getCurrentId()); }catch(_){ }
    try{ return text(storageGetRaw('fc_current_investor_v1')); }catch(_){ return ''; }
  }

  function getUiInvestorId(){
    try{ return text(getUiState().currentInvestorId); }catch(_){ return ''; }
  }

  function findInvestor(id){
    const key = text(id);
    if(!key) return null;
    try{ if(FC.investors && typeof FC.investors.getById === 'function') return FC.investors.getById(key) || null; }catch(_){ }
    try{
      const rows = FC.investors && typeof FC.investors.readAll === 'function' ? FC.investors.readAll() : storageGetJSON('fc_investors_v1', []);
      return (Array.isArray(rows) ? rows : []).find((row)=> text(row && row.id) === key) || null;
    }catch(_){ return null; }
  }

  function resolveInvestorId(){
    const currentId = getCurrentInvestorId();
    if(currentId && findInvestor(currentId)) return currentId;
    const uiId = getUiInvestorId();
    if(uiId && findInvestor(uiId)){
      try{ if(FC.investors && typeof FC.investors.setCurrentId === 'function') FC.investors.setCurrentId(uiId); }catch(_){ }
      return uiId;
    }
    if(currentId && !findInvestor(currentId)){
      try{ if(FC.investors && typeof FC.investors.setCurrentId === 'function') FC.investors.setCurrentId(null); }catch(_){ }
      patchUiState({ currentInvestorId:null });
      try{ if(FC.projectStore && typeof FC.projectStore.setCurrentProjectId === 'function') FC.projectStore.setCurrentProjectId(''); }catch(_){ }
    }
    return '';
  }

  function titleForInvestor(investor){
    const inv = investor && typeof investor === 'object' ? investor : {};
    return text(inv.companyName) || text(inv.name) || 'Projekt meblowy';
  }

  function listProjectRecords(){
    try{ return FC.projectStore && typeof FC.projectStore.readAll === 'function' ? FC.projectStore.readAll() : storageGetJSON('fc_projects_v1', []); }
    catch(_){ return []; }
  }

  function getProjectRecordByInvestor(investorId){
    const key = text(investorId);
    if(!key) return null;
    try{ if(FC.projectStore && typeof FC.projectStore.getByInvestorId === 'function') return FC.projectStore.getByInvestorId(key) || null; }catch(_){ }
    const list = listProjectRecords();
    return (Array.isArray(list) ? list : []).find((row)=> text(row && row.investorId) === key) || null;
  }

  function getProjectRecordById(projectId){
    const key = text(projectId);
    if(!key) return null;
    try{ if(FC.projectStore && typeof FC.projectStore.getById === 'function') return FC.projectStore.getById(key) || null; }catch(_){ }
    const list = listProjectRecords();
    return (Array.isArray(list) ? list : []).find((row)=> text(row && row.id) === key) || null;
  }

  function currentProjectId(){
    try{ if(FC.projectStore && typeof FC.projectStore.getCurrentProjectId === 'function') return text(FC.projectStore.getCurrentProjectId()); }catch(_){ }
    return text(storageGetRaw((getKeys()).currentProjectId || 'fc_current_project_id_v1'));
  }

  function setCurrentProjectId(projectId){
    const key = text(projectId);
    try{ if(FC.projectStore && typeof FC.projectStore.setCurrentProjectId === 'function') return FC.projectStore.setCurrentProjectId(key); }catch(_){ }
    storageSetRaw((getKeys()).currentProjectId || 'fc_current_project_id_v1', key);
    return key;
  }

  function legacySlotKey(investorId){
    const id = text(investorId);
    return id ? `fc_project_inv_${id}_v1` : '';
  }

  function readLegacyProjectSlot(investorId){
    const key = legacySlotKey(investorId);
    if(!key) return null;
    try{
      const raw = storageGetRaw(key);
      return raw ? JSON.parse(raw) : null;
    }catch(_){ return null; }
  }

  function freshProjectData(){
    try{ return normalizeProjectData(FC.project && FC.project.DEFAULT_PROJECT ? clone(FC.project.DEFAULT_PROJECT) : null); }catch(_){ return normalizeProjectData({ schemaVersion:1 }); }
  }

  function isLegacyCreatorRoomKey(roomId){
    return ['kuchnia','szafa','pokoj','lazienka'].includes(text(roomId));
  }

  function hasMeaningfulRoomData(room){
    return !!(room && typeof room === 'object' && (
      (Array.isArray(room.cabinets) && room.cabinets.length)
      || (Array.isArray(room.fronts) && room.fronts.length)
      || (Array.isArray(room.sets) && room.sets.length)
    ));
  }

  function projectDataRoomIds(projectData){
    const data = projectData && typeof projectData === 'object' ? projectData : {};
    const metaIds = [];
    const discovered = [];
    const pushMeta = (id)=> { const key = text(id); if(key && !metaIds.includes(key)) metaIds.push(key); };
    const pushDiscovered = (id)=> { const key = text(id); if(key && !discovered.includes(key)) discovered.push(key); };
    try{
      const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
      const defs = meta.roomDefs && typeof meta.roomDefs === 'object' ? meta.roomDefs : {};
      (Array.isArray(meta.roomOrder) ? meta.roomOrder : []).forEach(pushMeta);
      Object.keys(defs).forEach(pushMeta);
    }catch(_){ }
    if(metaIds.length) return metaIds;
    Object.keys(data).forEach((key)=> {
      if(key === 'schemaVersion' || key === 'meta') return;
      const room = data[key];
      if(!(room && typeof room === 'object' && (Array.isArray(room.cabinets) || Array.isArray(room.fronts) || Array.isArray(room.sets) || room.settings))) return;
      if(!isLegacyCreatorRoomKey(key) || hasMeaningfulRoomData(room)) pushDiscovered(key);
    });
    return discovered;
  }


  function roomContentScore(projectData){
    const data = projectData && typeof projectData === 'object' ? projectData : {};
    let score = 0;
    try{
      projectDataRoomIds(data).forEach((roomId)=> {
        const room = data[roomId];
        if(!(room && typeof room === 'object')) return;
        score += (Array.isArray(room.cabinets) ? room.cabinets.length : 0) * 100;
        score += (Array.isArray(room.sets) ? room.sets.length : 0) * 80;
        score += (Array.isArray(room.fronts) ? room.fronts.length : 0) * 30;
        if(room.settings && typeof room.settings === 'object') score += 1;
        if(room.preferences && typeof room.preferences === 'object') score += 1;
      });
      const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
      const defs = meta.roomDefs && typeof meta.roomDefs === 'object' ? meta.roomDefs : {};
      score += Object.keys(defs).length;
    }catch(_){ }
    return score;
  }

  function chooseBetterProjectData(candidates){
    const rows = (Array.isArray(candidates) ? candidates : [])
      .map((item, index)=> {
        const data = item && item.data ? normalizeProjectData(item.data) : null;
        return data ? Object.assign({}, item, { data, index, score:roomContentScore(data) }) : null;
      })
      .filter(Boolean);
    if(!rows.length) return null;
    rows.sort((a, b)=> {
      if(Number(b.score || 0) !== Number(a.score || 0)) return Number(b.score || 0) - Number(a.score || 0);
      return Number(a.priority || 0) - Number(b.priority || 0);
    });
    return rows[0];
  }

  function projectHasContent(projectData){
    const data = projectData && typeof projectData === 'object' ? projectData : {};
    return projectDataRoomIds(data).some((roomId)=> {
      const room = data[roomId];
      return !!(room && typeof room === 'object' && ((Array.isArray(room.cabinets) && room.cabinets.length) || (Array.isArray(room.fronts) && room.fronts.length) || (Array.isArray(room.sets) && room.sets.length)));
    });
  }

  function readActiveProjectData(){
    try{
      const raw = storageGetRaw((getKeys()).projectData || 'fc_project_v1');
      return raw ? JSON.parse(raw) : null;
    }catch(_){ return null; }
  }

  function chooseProjectDataForInvestor(investorId, record){
    const rid = text(investorId);
    const current = currentProjectId();
    const activeRecord = current ? getProjectRecordById(current) : null;
    const slot = readLegacyProjectSlot(rid);
    const active = readActiveProjectData();
    const candidates = [];

    // Priorytet 1: centralny rekord projektu, ale tylko jeśli nie jest pustym szkieletem.
    // Poprzednia wersja brała go zawsze jako pierwszy, więc pusty rekord mógł wygrać z realnym
    // projektem zapisanym w legacy slocie fc_project_inv_* albo w fc_project_v1.
    if(record && text(record.investorId) === rid && record.projectData){
      candidates.push({ source:'central-record', priority:30, data:record.projectData });
    }
    if(slot){
      candidates.push({ source:'legacy-investor-slot', priority:10, data:slot });
    }
    if(activeRecord && text(activeRecord.investorId) === rid && activeRecord.projectData){
      candidates.push({ source:'active-project-record', priority:20, data:activeRecord.projectData });
    }
    try{
      if(active && active.meta && text(active.meta.assignedInvestorId) === rid){
        candidates.push({ source:'active-fc-project', priority:15, data:active });
      }
    }catch(_){ }

    const best = chooseBetterProjectData(candidates);
    if(best) return best.data;
    return freshProjectData();
  }

  function upsertProjectRecord(investorId, projectData, existingRecord){
    const inv = findInvestor(investorId);
    const base = existingRecord && typeof existingRecord === 'object' ? existingRecord : {};
    const normalizedData = normalizeProjectData(projectData);
    const id = text(base.id) || ('proj_' + now().toString(36) + '_' + Math.random().toString(36).slice(2, 7));
    const record = normalizeProjectRecord({
      id,
      investorId:text(investorId),
      title:text(base.title) || titleForInvestor(inv),
      status:text(base.status) || 'nowy',
      projectData:normalizedData,
      createdAt:Number(base.createdAt) > 0 ? Number(base.createdAt) : now(),
      updatedAt:now(),
      meta:Object.assign({}, base.meta || {}, { source: text(base.meta && base.meta.source) || 'wycena-context-repair' }),
    });
    try{
      if(FC.projectStore && typeof FC.projectStore.upsert === 'function') return FC.projectStore.upsert(record) || record;
    }catch(_){ }
    try{
      const list = listProjectRecords();
      const idx = list.findIndex((row)=> text(row && row.id) === text(record.id));
      if(idx >= 0) list[idx] = record;
      else list.unshift(record);
      storageSetJSON('fc_projects_v1', list);
    }catch(_){ }
    return record;
  }

  function activateProjectData(investorId, projectRecord, sourceProjectData){
    const normalizedData = normalizeProjectData(sourceProjectData || (projectRecord && projectRecord.projectData) || freshProjectData());
    try{ normalizedData.meta = normalizedData.meta || {}; normalizedData.meta.assignedInvestorId = text(investorId); }catch(_){ }
    try{ if(typeof projectData !== 'undefined') projectData = normalizedData; }catch(_){ }
    try{ window.projectData = normalizedData; }catch(_){ }
    try{
      if(FC.rozrys) FC.rozrys.__projectOverride = normalizedData;
    }catch(_){ }
    try{
      if(FC.project && typeof FC.project.save === 'function'){
        const prevSuspend = !!FC.project.__suspendSessionTracking;
        FC.project.__suspendSessionTracking = true;
        try{ FC.project.save(normalizedData); }
        finally{ FC.project.__suspendSessionTracking = prevSuspend; }
      }else{
        storageSetJSON((getKeys()).projectData || 'fc_project_v1', normalizedData);
      }
    }catch(_){ storageSetJSON((getKeys()).projectData || 'fc_project_v1', normalizedData); }
    if(projectRecord && projectRecord.id) setCurrentProjectId(projectRecord.id);
    invalidateRoomRegistryCache();
    return normalizedData;
  }

  function getActiveRoomIdsFromProject(projectData){
    const data = projectData && typeof projectData === 'object' ? projectData : null;
    const ids = projectDataRoomIds(data);
    if(ids.length) return ids;
    try{ return FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomIds === 'function' ? (FC.roomRegistry.getActiveRoomIds() || []).map(text).filter(Boolean) : []; }catch(_){ return []; }
  }

  function normalizeRoomIds(roomIds){
    try{ if(FC.roomScopeResolver && typeof FC.roomScopeResolver.normalizeRoomIds === 'function') return FC.roomScopeResolver.normalizeRoomIds(roomIds); }catch(_){ }
    return Array.isArray(roomIds) ? Array.from(new Set(roomIds.map(text).filter(Boolean))) : [];
  }

  function sanitizeDraftSelection(activeRoomIds, projectId, investorId){
    if(!(FC.quoteOfferStore && typeof FC.quoteOfferStore.getDraft === 'function')) return { changed:false, draft:null, selectedRooms:activeRoomIds.slice() };
    const scope = { projectId:text(projectId), investorId:text(investorId) };
    let draft = null;
    try{ draft = FC.quoteOfferStore.getDraft(scope) || {}; }catch(_){ draft = {}; }
    const selection = draft && draft.selection && typeof draft.selection === 'object' ? draft.selection : {};
    const active = normalizeRoomIds(activeRoomIds);
    const activeSet = new Set(active);
    const selected = normalizeRoomIds(selection.selectedRooms);
    const validSelected = selected.filter((roomId)=> activeSet.has(roomId));
    const nextSelected = validSelected.length ? validSelected : active.slice();
    const changed = selected.join('|') !== nextSelected.join('|') || text(draft.projectId) !== scope.projectId || text(draft.investorId) !== scope.investorId;
    if(changed && typeof FC.quoteOfferStore.saveDraft === 'function'){
      draft = FC.quoteOfferStore.saveDraft(Object.assign({}, draft, {
        projectId:scope.projectId,
        investorId:scope.investorId,
        selection:Object.assign({}, selection, { selectedRooms:nextSelected }),
        updatedAt:now(),
      }), scope);
    }
    return { changed, draft, selectedRooms:nextSelected };
  }

  function cleanupWrongScopedDrafts(projectId, investorId, activeRoomIds){
    if(!(FC.quoteOfferStore && typeof FC.quoteOfferStore.readAll === 'function' && typeof FC.quoteOfferStore.writeAll === 'function')) return false;
    const pid = text(projectId);
    const iid = text(investorId);
    const activeSet = new Set(normalizeRoomIds(activeRoomIds));
    let changed = false;
    let list = [];
    try{ list = FC.quoteOfferStore.readAll() || []; }catch(_){ list = []; }
    const next = (Array.isArray(list) ? list : []).map((draft)=> {
      const row = draft && typeof draft === 'object' ? clone(draft) : {};
      if(text(row.projectId) !== pid && text(row.investorId) !== iid) return row;
      const selection = row.selection && typeof row.selection === 'object' ? row.selection : {};
      const selected = normalizeRoomIds(selection.selectedRooms);
      const valid = selected.filter((roomId)=> activeSet.has(roomId));
      const nextSelected = valid.length ? valid : normalizeRoomIds(activeRoomIds);
      if(selected.join('|') !== nextSelected.join('|') || text(row.projectId) !== pid || text(row.investorId) !== iid){
        changed = true;
        row.projectId = pid;
        row.investorId = iid;
        row.selection = Object.assign({}, selection, { selectedRooms:nextSelected });
        row.updatedAt = now();
      }
      return row;
    });
    if(changed) FC.quoteOfferStore.writeAll(next);
    return changed;
  }

  function repairActiveQuoteContext(options){
    const opts = options && typeof options === 'object' ? options : {};
    const repairs = [];
    const investorId = resolveInvestorId();
    if(!investorId){
      return { ok:false, code:'no_investor', title:'Brak aktywnego inwestora', message:'Wybierz inwestora/projekt przed utworzeniem wyceny.', repairs };
    }
    const investor = findInvestor(investorId);
    if(!investor){
      return { ok:false, code:'missing_investor', title:'Nie znaleziono inwestora', message:'Aktywny inwestor nie istnieje już w danych programu.', repairs, investorId };
    }

    const beforeProjectId = currentProjectId();
    let record = getProjectRecordByInvestor(investorId);
    const currentRecord = beforeProjectId ? getProjectRecordById(beforeProjectId) : null;
    if(currentRecord && text(currentRecord.investorId) !== investorId) repairs.push('current-project-belonged-to-other-investor');

    let chosenProjectData = chooseProjectDataForInvestor(investorId, record);
    if(!record || text(record.investorId) !== investorId){
      record = upsertProjectRecord(investorId, chosenProjectData, null);
      repairs.push('created-missing-project-record');
    }else{
      const chosenScore = roomContentScore(chosenProjectData);
      const recordScore = roomContentScore(record.projectData);
      if(chosenScore > recordScore){
        record = upsertProjectRecord(investorId, chosenProjectData, record);
        repairs.push('hydrated-project-record-from-richer-source');
      }else if(!record.projectData || !projectDataRoomIds(record.projectData).length){
        const slot = readLegacyProjectSlot(investorId);
        if(slot && projectDataRoomIds(slot).length){
          chosenProjectData = normalizeProjectData(slot);
          record = upsertProjectRecord(investorId, chosenProjectData, record);
          repairs.push('hydrated-project-record-from-legacy-slot');
        }
      }
    }

    if(text(currentProjectId()) !== text(record && record.id)) repairs.push('fixed-current-project-id');
    const activeProject = activateProjectData(investorId, record, chosenProjectData || (record && record.projectData));
    const activeRoomIds = getActiveRoomIdsFromProject(activeProject);
    const draftResult = sanitizeDraftSelection(activeRoomIds, record && record.id, investorId);
    if(draftResult.changed) repairs.push('sanitized-offer-draft-selection');
    if(cleanupWrongScopedDrafts(record && record.id, investorId, activeRoomIds)) repairs.push('cleaned-wrong-scoped-drafts');
    const relinkedSnapshots = relinkInvestorSnapshotsToProject(investorId, record && record.id, activeRoomIds);
    if(relinkedSnapshots && relinkedSnapshots.changed) repairs.push('relinked-investor-snapshots:' + relinkedSnapshots.count);
    if(healQuoteSnapshotInvestorSource(investorId, activeProject)) repairs.push('healed-quote-snapshot-investor-source');
    try{ patchUiState({ currentInvestorId:investorId }); }catch(_){ }

    return {
      ok:true,
      investorId,
      investor,
      projectId:text(record && record.id),
      project:record,
      projectData:activeProject,
      activeRoomIds,
      selectedRooms:draftResult.selectedRooms || activeRoomIds.slice(),
      draft:draftResult.draft,
      repairs,
      reason:text(opts.reason),
      hadProjectContent:projectHasContent(activeProject),
    };
  }



  function snapshotInvestorId(snapshot){
    const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
    return text(snap.investor && snap.investor.id) || text(snap.project && snap.project.investorId) || text(snap.meta && snap.meta.investorId);
  }

  function snapshotProjectId(snapshot){
    const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
    return text(snap.project && snap.project.id) || text(snap.meta && snap.meta.projectId) || text(snap.projectId);
  }

  function snapshotRoomIds(snapshot){
    const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getSnapshotRoomIds === 'function') return normalizeRoomIds(FC.quoteSnapshotStore.getSnapshotRoomIds(snap));
    }catch(_){ }
    try{ return normalizeRoomIds(snap.scope && snap.scope.selectedRooms); }catch(_){ return []; }
  }

  function relinkInvestorSnapshotsToProject(investorId, projectId, activeRoomIds){
    const iid = text(investorId);
    const pid = text(projectId);
    const active = normalizeRoomIds(activeRoomIds);
    const activeSet = new Set(active);
    if(!iid || !pid || !active.length) return { changed:false, count:0 };
    if(!(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.readAll === 'function' && typeof FC.quoteSnapshotStore.writeAll === 'function')) return { changed:false, count:0 };
    let rows = [];
    try{ rows = FC.quoteSnapshotStore.readAll() || []; }catch(_){ rows = []; }
    let count = 0;
    const next = (Array.isArray(rows) ? rows : []).map((row)=> {
      const snap = row && typeof row === 'object' ? clone(row) : {};
      if(snapshotInvestorId(snap) !== iid) return snap;
      if(snapshotProjectId(snap) === pid) return snap;
      const rooms = snapshotRoomIds(snap);
      if(!rooms.length || !rooms.every((roomId)=> activeSet.has(roomId))) return snap;
      snap.project = Object.assign({}, snap.project || {}, { id:pid, investorId:iid });
      snap.investor = Object.assign({}, snap.investor || {}, { id:iid });
      snap.meta = Object.assign({}, snap.meta || {}, {
        relinkedProjectId:pid,
        relinkedAt:now(),
        relinkedFromProjectId:snapshotProjectId(row),
      });
      count += 1;
      return snap;
    });
    if(count > 0){
      try{ FC.quoteSnapshotStore.writeAll(next); }catch(_){ return { changed:false, count:0 }; }
      return { changed:true, count };
    }
    return { changed:false, count:0 };
  }

  function healQuoteSnapshotInvestorSource(investorId, projectData){
    const iid = text(investorId);
    if(!iid || !projectHasContent(projectData)) return false;
    const investor = findInvestor(iid);
    if(!investor || text(investor.source).toLowerCase() !== 'quote-snapshot') return false;
    try{
      if(FC.investors && typeof FC.investors.update === 'function'){
        FC.investors.update(iid, {
          source:'',
          meta:Object.assign({}, investor.meta || {}, { recoveredFromQuoteSnapshot:true, recoveredAt:now() })
        });
        return true;
      }
    }catch(_){ }
    try{
      const list = FC.investors && typeof FC.investors.readAll === 'function' ? FC.investors.readAll() : storageGetJSON('fc_investors_v1', []);
      let changed = false;
      const next = (Array.isArray(list) ? list : []).map((row)=> {
        if(text(row && row.id) !== iid) return row;
        changed = true;
        return Object.assign({}, row, { source:'', meta:Object.assign({}, row.meta || {}, { recoveredFromQuoteSnapshot:true, recoveredAt:now() }), updatedAt:now() });
      });
      if(changed){
        if(FC.investors && typeof FC.investors.writeAll === 'function') FC.investors.writeAll(next);
        else storageSetJSON('fc_investors_v1', next);
        return true;
      }
    }catch(_){ }
    return false;
  }

  function buildErrorQuote(result){
    const res = result && typeof result === 'object' ? result : {};
    return {
      error:String(res.message || 'Nie można utworzyć wyceny przez niespójny kontekst projektu.'),
      errorTitle:String(res.title || 'Błąd kontekstu WYCENY'),
      totals:{ materials:0, accessories:0, project:0, services:0, quoteRates:0, transport:0, subtotal:0, discount:0, grand:0 },
      roomLabels:[],
      lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
      meta:{ source:'wycena-context-repair', code:String(res.code || 'quote_context_error') },
    };
  }

  FC.wycenaContextRepair = {
    repairActiveQuoteContext,
    buildErrorQuote,
    projectDataRoomIds,
    roomContentScore,
    getActiveRoomIdsFromProject,
    sanitizeDraftSelection,
    cleanupWrongScopedDrafts,
    relinkInvestorSnapshotsToProject,
    healQuoteSnapshotInvestorSource,
    resolveInvestorId,
  };
})();
