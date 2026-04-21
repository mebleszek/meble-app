(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const BASE_LABELS = {
    kuchnia:'Kuchnia',
    szafa:'Szafa',
    pokoj:'Pokój',
    lazienka:'Łazienka'
  };

  function clone(obj){
    try{ return (FC.utils && FC.utils.clone) ? FC.utils.clone(obj) : JSON.parse(JSON.stringify(obj)); }
    catch(_){ return JSON.parse(JSON.stringify(obj || {})); }
  }

  function getProject(){
    try{ if(typeof projectData !== 'undefined' && projectData) return projectData; }catch(_){ }
    try{ if(window.projectData) return window.projectData; }catch(_){ }
    return null;
  }

  function saveProject(proj, opts){
    const cfg = Object.assign({ suspendSessionTracking:true }, opts || {});
    try{
      if(typeof projectData !== 'undefined') projectData = proj;
      window.projectData = proj;
    }catch(_){ }
    try{
      if(FC.project && typeof FC.project.save === 'function'){
        const shouldSuspend = !!cfg.suspendSessionTracking;
        const previous = !!FC.project.__suspendSessionTracking;
        if(shouldSuspend) FC.project.__suspendSessionTracking = true;
        try{ FC.project.save(proj); }
        finally{ FC.project.__suspendSessionTracking = previous; }
      }
    }catch(_){ }
  }

  function getCurrentInvestor(){
    try{
      if(FC.investors && typeof FC.investors.getCurrentId === 'function' && typeof FC.investors.getById === 'function'){
        const id = FC.investors.getCurrentId();
        return id ? FC.investors.getById(id) : null;
      }
    }catch(_){ }
    return null;
  }

  function ensureProjectMeta(proj){
    if(!proj || typeof proj !== 'object') return null;
    proj.meta = proj.meta || {};
    proj.meta.roomDefs = proj.meta.roomDefs || {};
    proj.meta.roomOrder = Array.isArray(proj.meta.roomOrder) ? proj.meta.roomOrder : [];
    return proj.meta;
  }

  function discoverProjectRoomKeys(proj){
    if(!proj || typeof proj !== 'object') return [];
    return Object.keys(proj).filter((key)=>{
      if(!key || key === 'schemaVersion' || key === 'meta') return false;
      const room = proj[key];
      return !!(room && typeof room === 'object' && (Array.isArray(room.cabinets) || Array.isArray(room.fronts) || Array.isArray(room.sets) || room.settings));
    });
  }

  function roomTemplate(baseType){
    const defs = (FC.project && FC.project.DEFAULT_PROJECT) || (FC.schema && FC.schema.DEFAULT_PROJECT) || {};
    return clone(defs[baseType] || defs.kuchnia || { cabinets:[], fronts:[], sets:[], settings:{} });
  }

  function slugify(text){
    return String(text || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'pomieszczenie';
  }

  function makeRoomId(baseType, name){
    return 'room_' + String(baseType || 'pokoj') + '_' + slugify(name || BASE_LABELS[baseType] || 'pomieszczenie') + '_' + Date.now().toString(36).slice(-6);
  }

  function normalizeLabel(text){
    return String(text || '').trim().replace(/\s+/g, ' ');
  }

  function prettifyTechnicalRoomText(text, fallbackBaseType){
    const raw = String(text || '').trim();
    if(!raw) return '';
    const match = raw.match(/^room_([^_]+)_(.+)_([a-z0-9]{4,})$/i);
    if(!match) return raw;
    const baseType = String(match[1] || fallbackBaseType || '').trim();
    let middle = String(match[2] || '').trim();
    if(baseType && middle.toLowerCase().startsWith(baseType.toLowerCase() + '_')) middle = middle.slice(baseType.length + 1);
    middle = middle.replace(/_/g, ' ').trim();
    if(!middle) middle = BASE_LABELS[baseType] || baseType || raw;
    return middle;
  }

  function normalizeComparableLabel(text){
    return normalizeLabel(text)
      .toLowerCase()
      .replace(/[ąćęłńóśźż]/g, (ch)=> ({'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z'}[ch] || ch))
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function normalizeRoomDef(raw, fallback){
    const src = Object.assign({}, fallback || {}, raw || {});
    const baseType = String(src.baseType || src.kind || src.type || fallback && fallback.baseType || 'pokoj');
    const id = String(src.id || fallback && fallback.id || '');
    const rawName = src.name || src.label || fallback && fallback.name || BASE_LABELS[baseType] || id;
    const safeName = prettifyTechnicalRoomText(rawName, baseType);
    const safeLabel = prettifyTechnicalRoomText(src.label || safeName, baseType);
    const finalName = normalizeLabel(safeName || BASE_LABELS[baseType] || id);
    const finalLabel = normalizeLabel(safeLabel || finalName);
    return {
      id,
      baseType,
      name: finalName,
      label: finalLabel,
      legacy: !!src.legacy,
    };
  }

  function getProjectRoomDefs(proj){
    const meta = ensureProjectMeta(proj);
    const defs = [];
    if(meta){
      meta.roomOrder.forEach((id)=>{
        const raw = meta.roomDefs[id];
        if(raw && !defs.find((x)=> x.id === id)) defs.push(normalizeRoomDef(raw, { id, baseType: raw.baseType || id }));
      });
      Object.keys(meta.roomDefs).forEach((id)=>{
        const raw = meta.roomDefs[id];
        if(raw && !defs.find((x)=> x.id === id)) defs.push(normalizeRoomDef(raw, { id, baseType: raw.baseType || id }));
      });
    }
    if(defs.length) return defs;
    return discoverProjectRoomKeys(proj).map((id)=> normalizeRoomDef({ id, baseType:id, name:BASE_LABELS[id] || id, label:BASE_LABELS[id] || id }));
  }

  function hasLegacyKitchen(proj){
    if(!proj || typeof proj !== 'object') return false;
    const room = proj.kuchnia;
    return !!(room && typeof room === 'object' && (Array.isArray(room.cabinets) && room.cabinets.length || Array.isArray(room.fronts) && room.fronts.length || Array.isArray(room.sets) && room.sets.length));
  }

  function createLegacyKitchenDef(){
    return normalizeRoomDef({ id:'kuchnia', baseType:'kuchnia', name:'kuchnia stary program', label:'kuchnia stary program', legacy:true });
  }

  function hasCurrentInvestor(){ return !!getCurrentInvestor(); }

  function getActiveRoomDefs(){
    const proj = getProject();
    const inv = getCurrentInvestor();
    const defs = [];
    const seen = new Set();
    const push = (room)=>{
      const normalized = normalizeRoomDef(room);
      if(!normalized.id || seen.has(normalized.id)) return;
      seen.add(normalized.id);
      defs.push(normalized);
    };

    const projectMetaRooms = getProjectRoomDefs(proj);
    const projectMap = new Map(projectMetaRooms.map((room)=> [room.id, room]));

    if(inv && Array.isArray(inv.rooms) && inv.rooms.length){
      inv.rooms.forEach((room)=>{
        const id = String(room && room.id || '');
        push(Object.assign({}, projectMap.get(id) || {}, room || {}, { id }));
      });
    }else{
      projectMetaRooms.filter((room)=> String(room.id || '').startsWith('room_')).forEach(push);
    }

    if(hasLegacyKitchen(proj) && !seen.has('kuchnia')){
      push(createLegacyKitchenDef());
    }

    return defs;
  }

  function getActiveRoomIds(){
    return getActiveRoomDefs().map((r)=> r.id).filter(Boolean);
  }

  function getRoomLabel(id){
    const key = String(id || '');
    const found = getActiveRoomDefs().find((room)=> room.id === key);
    if(found) return found.label || found.name || prettifyTechnicalRoomText(key, found.baseType) || key;
    return prettifyTechnicalRoomText(key, '') || key || 'Pomieszczenie';
  }

  function ensureRoomData(id, baseType){
    const proj = getProject();
    if(!proj || !id) return null;
    const meta = ensureProjectMeta(proj);
    if(!proj[id]) proj[id] = roomTemplate(baseType);
    if(!meta.roomDefs[id]) meta.roomDefs[id] = { id, baseType, name: BASE_LABELS[baseType] || id, label: BASE_LABELS[baseType] || id };
    if(!meta.roomOrder.includes(id)) meta.roomOrder.push(id);
    saveProject(proj);
    return proj[id];
  }

  function isRoomNameTaken(name, investor, exceptId){
    const normalized = normalizeComparableLabel(name);
    if(!normalized || !investor || !Array.isArray(investor.rooms)) return false;
    return investor.rooms.some((room)=>{
      if(!room) return false;
      if(exceptId && String(room.id || '') === String(exceptId)) return false;
      const label = normalizeComparableLabel(room.label || room.name || '');
      return label === normalized;
    });
  }

  function syncRoomSelectionAfterRemoval(selectedId){
    try{
      if(window.FC && window.FC.uiState && typeof window.FC.uiState.get === 'function' && typeof window.FC.uiState.set === 'function'){
        const st = window.FC.uiState.get();
        if(String(st.roomType || '') === String(selectedId)) window.FC.uiState.set({ roomType:null, lastRoomType:null });
      }else if(typeof uiState !== 'undefined' && uiState){
        if(String(uiState.roomType || '') === String(selectedId)){
          uiState.roomType = null;
          uiState.lastRoomType = null;
          try{ FC.storage && FC.storage.setJSON && typeof STORAGE_KEYS !== 'undefined' && FC.storage.setJSON(STORAGE_KEYS.ui, uiState); }catch(_){ }
        }
      }
    }catch(_){ }
  }

  function syncQuoteDraftSelectionAfterRoomChange(keepIds){
    const allowed = new Set(Array.isArray(keepIds) ? keepIds.map((id)=> String(id || '').trim()).filter(Boolean) : []);
    try{
      if(!(FC.quoteOfferStore && typeof FC.quoteOfferStore.getCurrentDraft === 'function' && typeof FC.quoteOfferStore.patchCurrentDraft === 'function')) return;
      const draft = FC.quoteOfferStore.getCurrentDraft();
      const current = Array.isArray(draft && draft.selection && draft.selection.selectedRooms) ? draft.selection.selectedRooms.map((id)=> String(id || '').trim()).filter(Boolean) : [];
      const next = current.filter((id)=> allowed.has(id));
      if(current.length !== next.length) FC.quoteOfferStore.patchCurrentDraft({ selection:{ selectedRooms:next } });
    }catch(_){ }
  }

  function reconcileStatusesAfterRoomSetChange(inv, keepIds){
    const ids = Array.isArray(keepIds) ? keepIds.map((id)=> String(id || '').trim()).filter(Boolean) : [];
    syncQuoteDraftSelectionAfterRoomChange(ids);
    try{
      if(FC.projectStatusSync && typeof FC.projectStatusSync.reconcileProjectStatuses === 'function'){
        FC.projectStatusSync.reconcileProjectStatuses({
          investorId: inv && inv.id,
          roomIds: ids,
          restrictToRoomIds:true,
          fallbackStatus:'nowy',
          refreshUi:false,
        });
        return;
      }
    }catch(_){ }

    try{
      if(!(FC.investors && typeof FC.investors.getById === 'function' && typeof FC.investors.update === 'function')) return;
      const investorId = inv && inv.id;
      if(!investorId) return;
      const latest = FC.investors.getById(investorId);
      if(!latest || !Array.isArray(latest.rooms)) return;
      const normalizedRooms = latest.rooms.map((room)=> {
        const id = String(room && room.id || '').trim();
        const allowed = !ids.length || ids.includes(id);
        return Object.assign({}, room, {
          projectStatus: allowed ? (room && room.projectStatus) || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy' : room && room.projectStatus
        });
      });
      FC.investors.update(investorId, { rooms:normalizedRooms });
    }catch(_){ }
  }

  function getCurrentProjectRecord(inv){
    const investorId = String(inv && inv.id || '');
    if(!investorId) return null;
    try{
      if(FC.projectStore && typeof FC.projectStore.getByInvestorId === 'function') return FC.projectStore.getByInvestorId(investorId) || null;
    }catch(_){ }
    return null;
  }

  function getSnapshotVersionName(snapshot){
    const metaName = String(snapshot && snapshot.meta && snapshot.meta.versionName || '').trim();
    const commercialName = String(snapshot && snapshot.commercialName || '').trim();
    return metaName || commercialName || 'Wycena';
  }

  function listSnapshotsForRoomRemoval(inv, roomIds){
    const ids = Array.isArray(roomIds) ? roomIds.map((id)=> String(id || '').trim()).filter(Boolean) : [];
    if(!ids.length) return [];
    const record = getCurrentProjectRecord(inv);
    const projectId = String(record && record.id || '');
    if(!projectId) return [];
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.listOverlappingScopeSnapshots === 'function'){
        return FC.quoteSnapshotStore.listOverlappingScopeSnapshots(projectId, ids, { includeRejected:true });
      }
    }catch(_){ }
    return [];
  }

  function countCabinetsForRoomIds(roomIds){
    const ids = Array.isArray(roomIds) ? roomIds.map((id)=> String(id || '').trim()).filter(Boolean) : [];
    if(!ids.length) return 0;
    const proj = getProject() || {};
    return ids.reduce((sum, roomId)=>{
      const room = proj && proj[roomId];
      const cabinets = Array.isArray(room && room.cabinets) ? room.cabinets.length : 0;
      return sum + cabinets;
    }, 0);
  }

  function buildRoomRemovalWarningMessage(inv, roomIds, options){
    const ids = Array.isArray(roomIds) ? roomIds.map((id)=> String(id || '').trim()).filter(Boolean) : [];
    const opts = options && typeof options === 'object' ? options : {};
    const snapshots = listSnapshotsForRoomRemoval(inv, ids);
    const deferred = !!opts.deferred;
    const roomNames = ids.map((id)=> getRoomLabel(id)).filter(Boolean);
    const roomLabel = roomNames.length === 1 ? roomNames[0] : (roomNames.length ? roomNames.join(', ') : 'wybrane pomieszczenia');
    const cabinetCount = countCabinetsForRoomIds(ids);
    const cabinetLabel = cabinetCount === 1 ? 'szafkę' : (cabinetCount >= 2 && cabinetCount <= 4 ? 'szafki' : 'szafek');
    const lines = [];

    lines.push(deferred
      ? `Usuwając pomieszczenie „${roomLabel}”, po kliknięciu Zapisz usuniesz powiązane dane.`
      : `Usuwając pomieszczenie „${roomLabel}”, usuniesz powiązane dane.`);

    if(cabinetCount > 0){
      lines.push(`Usuniesz też ${cabinetCount} ${cabinetLabel} z tego pomieszczenia.`);
    }

    if(snapshots.length){
      if(snapshots.length <= 3){
        const names = snapshots.map((snapshot)=> `• ${getSnapshotVersionName(snapshot)}`).join('\n');
        lines.push(`Zostaną też usunięte powiązane wyceny:\n${names}`);
      } else {
        lines.push(`Zostanie też usuniętych ${snapshots.length} wycen powiązanych z tym pomieszczeniem.`);
      }
    }

    if(!cabinetCount && !snapshots.length){
      lines.push('Tej operacji nie cofnisz.');
    }

    return { message: lines.join('\n\n'), snapshots, cabinetCount };
  }

  async function askDeleteRoomWithQuotes(inv, roomIds, options){
    const ids = Array.isArray(roomIds) ? roomIds.map((id)=> String(id || '').trim()).filter(Boolean) : [];
    if(!ids.length) return false;
    const warning = buildRoomRemovalWarningMessage(inv, ids, options);
    try{
      if(FC.confirmBox && typeof FC.confirmBox.ask === 'function'){
        return await FC.confirmBox.ask({
          title:'Usunąć pomieszczenie?',
          message: warning.message || 'Tej operacji nie cofnisz.',
          confirmText:'Usuń',
          cancelText:'Wróć',
          confirmTone:'danger',
          cancelTone:'neutral'
        });
      }
    }catch(_){ }
    return true;
  }

  function removeQuotesForRooms(inv, roomIds){
    const ids = Array.isArray(roomIds) ? roomIds.map((id)=> String(id || '').trim()).filter(Boolean) : [];
    if(!ids.length) return [];
    const record = getCurrentProjectRecord(inv);
    const projectId = String(record && record.id || '');
    if(!projectId) return [];
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.removeSnapshotsForProjectRooms === 'function'){
        return FC.quoteSnapshotStore.removeSnapshotsForProjectRooms(projectId, ids, { includeRejected:true });
      }
    }catch(_){ }
    return [];
  }

  function removeRoomsData(proj, meta, roomIds){
    const ids = Array.isArray(roomIds) ? roomIds.map((id)=> String(id || '').trim()).filter(Boolean) : [];
    ids.forEach((selectedId)=>{
      try{ delete proj[selectedId]; }catch(_){ }
      try{ if(meta && meta.roomDefs) delete meta.roomDefs[selectedId]; }catch(_){ }
      try{ if(meta && Array.isArray(meta.roomOrder)) meta.roomOrder = meta.roomOrder.filter((id)=> String(id || '') !== selectedId); }catch(_){ }
      syncRoomSelectionAfterRemoval(selectedId);
    });
  }

  function updateInvestorRooms(inv, rooms){
    try{ FC.investors && FC.investors.update && FC.investors.update(inv.id, { rooms }); }catch(_){ }
  }

  function removeRoomById(roomId){
    const inv = getCurrentInvestor();
    const selectedId = String(roomId || '').trim();
    if(!(inv && selectedId)) return null;
    const proj = getProject() || {};
    const meta = ensureProjectMeta(proj);
    removeRoomsData(proj, meta, [selectedId]);
    saveProject(proj);
    removeQuotesForRooms(inv, [selectedId]);
    const currentRooms = Array.isArray(inv.rooms) ? inv.rooms : [];
    const nextRooms = currentRooms.filter((room)=> String(room && room.id || '') !== selectedId).map((room)=> ({
      id: room.id,
      baseType: room.baseType,
      name: room.name,
      label: room.label,
      projectStatus: room.projectStatus || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy'
    }));
    updateInvestorRooms(inv, nextRooms);
    reconcileStatusesAfterRoomSetChange(inv, nextRooms.map((room)=> room.id));
    return selectedId;
  }

  function getManageableRooms(inv){
    const roomMap = new Map();
    const activeRooms = getActiveRoomDefs();
    activeRooms.forEach((room)=> {
      const normalized = normalizeRoomDef(room, room);
      if(normalized && normalized.id) roomMap.set(String(normalized.id), normalized);
    });
    const investorRooms = Array.isArray(inv && inv.rooms) ? inv.rooms : [];
    investorRooms.forEach((room)=> {
      const normalized = normalizeRoomDef(room, room);
      if(!(normalized && normalized.id)) return;
      const key = String(normalized.id);
      roomMap.set(key, normalizeRoomDef(Object.assign({}, roomMap.get(key) || {}, normalized), roomMap.get(key) || normalized));
    });
    if(hasLegacyKitchen(getProject()) && !roomMap.has('kuchnia')){
      const legacy = createLegacyKitchenDef();
      roomMap.set('kuchnia', legacy);
    }
    return Array.from(roomMap.values()).filter((room)=> room && room.id);
  }

  function applyManageRoomsDraft(inv, drafts){
    const currentDrafts = Array.isArray(drafts) ? drafts.map((room)=> normalizeRoomDef(room, room)).filter((room)=> room && room.id) : [];
    const keepIds = new Set(currentDrafts.map((room)=> String(room.id || '')));
    const proj = getProject() || {};
    const meta = ensureProjectMeta(proj);
    const previousRooms = Array.isArray(inv && inv.rooms) ? inv.rooms : [];

    const removedRoomIds = [];
    discoverProjectRoomKeys(proj).forEach((roomId)=>{
      const key = String(roomId || '');
      if(key === 'kuchnia' && hasLegacyKitchen(proj)) return;
      if(keepIds.has(key)) return;
      removedRoomIds.push(key);
    });
    removeRoomsData(proj, meta, removedRoomIds);

    currentDrafts.forEach((room)=>{
      if(!proj[room.id]) proj[room.id] = roomTemplate(room.baseType);
      if(meta && meta.roomDefs) meta.roomDefs[room.id] = { id:room.id, baseType:room.baseType, name:room.name, label:room.label, legacy:!!room.legacy };
      if(meta && Array.isArray(meta.roomOrder) && !meta.roomOrder.includes(room.id)) meta.roomOrder.push(room.id);
    });
    try{ if(meta && Array.isArray(meta.roomOrder)) meta.roomOrder = meta.roomOrder.filter((id)=> keepIds.has(String(id || '')) || String(id || '') === 'kuchnia'); }catch(_){ }
    saveProject(proj);
    if(removedRoomIds.length) removeQuotesForRooms(inv, removedRoomIds);

    const nextRooms = currentDrafts.map((room)=> {
      const prev = previousRooms.find((item)=> String(item && item.id || '') === String(room.id || '')) || {};
      return {
        id: room.id,
        baseType: room.baseType,
        name: room.name,
        label: room.label,
        projectStatus: prev.projectStatus || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy'
      };
    });
    updateInvestorRooms(inv, nextRooms);
    reconcileStatusesAfterRoomSetChange(inv, nextRooms.map((room)=> room.id));
    return nextRooms;
  }

  function getEditableRoom(inv, roomId){
    const activeRooms = getActiveRoomDefs();
    const roomMap = new Map();
    activeRooms.forEach((room)=> {
      const normalized = normalizeRoomDef(room, room);
      if(normalized && normalized.id) roomMap.set(String(normalized.id), normalized);
    });
    const investorRooms = Array.isArray(inv && inv.rooms) ? inv.rooms : [];
    investorRooms.forEach((room)=> {
      const normalized = normalizeRoomDef(room, room);
      if(!(normalized && normalized.id)) return;
      const key = String(normalized.id);
      roomMap.set(key, normalizeRoomDef(Object.assign({}, roomMap.get(key) || {}, normalized), roomMap.get(key) || normalized));
    });
    if(hasLegacyKitchen(getProject()) && !roomMap.has('kuchnia')){
      const legacy = createLegacyKitchenDef();
      roomMap.set('kuchnia', legacy);
    }
    return roomMap.get(String(roomId || '')) || null;
  }

  FC.roomRegistryCore = {
    BASE_LABELS,
    clone,
    getProject,
    saveProject,
    getCurrentInvestor,
    ensureProjectMeta,
    discoverProjectRoomKeys,
    roomTemplate,
    slugify,
    makeRoomId,
    normalizeLabel,
    prettifyTechnicalRoomText,
    normalizeComparableLabel,
    normalizeRoomDef,
    getProjectRoomDefs,
    hasLegacyKitchen,
    createLegacyKitchenDef,
    hasCurrentInvestor,
    getActiveRoomDefs,
    getActiveRoomIds,
    getRoomLabel,
    ensureRoomData,
    isRoomNameTaken,
    syncRoomSelectionAfterRemoval,
    syncQuoteDraftSelectionAfterRoomChange,
    reconcileStatusesAfterRoomSetChange,
    getCurrentProjectRecord,
    getSnapshotVersionName,
    listSnapshotsForRoomRemoval,
    countCabinetsForRoomIds,
    buildRoomRemovalWarningMessage,
    askDeleteRoomWithQuotes,
    removeQuotesForRooms,
    removeRoomsData,
    updateInvestorRooms,
    removeRoomById,
    getManageableRooms,
    applyManageRoomsDraft,
    getEditableRoom,
  };
})();
