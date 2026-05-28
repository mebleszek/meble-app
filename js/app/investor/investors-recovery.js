// js/app/investor/investors-recovery.js
// Odbudowa brakujących inwestorów ze snapshotów/projektów. Bez CRUD i bez zapisu głównej listy.
(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const model = FC.investorsModel || {};
  const repo = FC.investorsLocalRepository || {};

  const DEFAULT_PROJECT_STATUS = model.DEFAULT_PROJECT_STATUS || 'nowy';
  const normalizeInvestor = typeof model.normalizeInvestor === 'function' ? model.normalizeInvestor : (item)=> item;
  const appendUniqueRoom = typeof model.appendUniqueRoom === 'function' ? model.appendUniqueRoom : (target)=> target;
  const inferRoomBaseType = typeof model.inferRoomBaseType === 'function' ? model.inferRoomBaseType : ()=> '';
  const now = typeof model.now === 'function' ? model.now : ()=> Date.now();

  let _isRecovering = false;

  function isTestRuntime(){
    try{ if(FC.testHarness) return true; }catch(_){ }
    try{
      const path = String(window && window.location && window.location.pathname || '').toLowerCase();
      if(path.includes('dev_tests') || path.includes('dev_app_smoke') || path.includes('dev_rozrys_smoke')) return true;
    }catch(_){ }
    return false;
  }

  function isKnownLeakedTestInvestor(inv){
    const src = inv && typeof inv === 'object' ? inv : {};
    const id = String(src.id || '').trim();
    if(id === 'inv_new_only') return true;
    if(id === 'inv_missing_old') return true;
    if(id === 'inv_snapshot_only' || id === 'inv_snapshot_only_test' || id === 'inv_write_test_only') return true;
    const name = String(src.name || src.companyName || '').trim().toLowerCase();
    const email = String(src.email || '').trim().toLowerCase();
    const city = String(src.city || '').trim().toLowerCase();
    const phone = String(src.phone || '').trim();
    if(!id || name !== 'jan test') return false;
    return phone === '111' || email === 'jan@test.pl' || city === 'łódź' || city === 'lodz';
  }

  function isDevTestInvestorRecord(inv){
    const src = inv && typeof inv === 'object' ? inv : {};
    const meta = src.meta && typeof src.meta === 'object' ? src.meta : {};
    const source = String(meta.source || src.source || '').trim().toLowerCase();
    const owner = String(meta.testOwner || '').trim().toLowerCase();
    if(meta.testData === true && (!owner || owner === 'dev-tests')) return true;
    if(source.startsWith('test-') || source === 'investor' || source === 'investor-recovery-fixture') return true;
    return isKnownLeakedTestInvestor(src);
  }

  function stripDevTestInvestorsForApp(list){
    const rows = Array.isArray(list) ? list : [];
    if(isTestRuntime()) return rows;
    return rows.filter((inv)=> !isDevTestInvestorRecord(inv));
  }

  function roomsFromProjectRecord(record){
    const src = record && typeof record === 'object' ? record : {};
    const status = String(src.status || DEFAULT_PROJECT_STATUS);
    const out = [];
    const projectData = src.projectData && typeof src.projectData === 'object' ? src.projectData : {};
    const meta = projectData.meta && typeof projectData.meta === 'object' ? projectData.meta : {};
    const roomDefs = meta.roomDefs && typeof meta.roomDefs === 'object' ? meta.roomDefs : {};
    const roomOrder = Array.isArray(meta.roomOrder) ? meta.roomOrder.map((item)=> String(item || '').trim()).filter(Boolean) : [];
    roomOrder.forEach((roomId)=> {
      const def = roomDefs[roomId] && typeof roomDefs[roomId] === 'object' ? roomDefs[roomId] : {};
      appendUniqueRoom(out, {
        id: roomId,
        baseType: inferRoomBaseType(roomId, def),
        name: String(def.name || def.label || roomId || ''),
        label: String(def.label || def.name || roomId || ''),
        projectStatus: String(def.projectStatus || status || DEFAULT_PROJECT_STATUS),
      });
    });
    Object.keys(roomDefs).forEach((roomId)=> {
      const def = roomDefs[roomId] && typeof roomDefs[roomId] === 'object' ? roomDefs[roomId] : {};
      appendUniqueRoom(out, {
        id: roomId,
        baseType: inferRoomBaseType(roomId, def),
        name: String(def.name || def.label || roomId || ''),
        label: String(def.label || def.name || roomId || ''),
        projectStatus: String(def.projectStatus || status || DEFAULT_PROJECT_STATUS),
      });
    });
    Object.keys(projectData).forEach((roomId)=> {
      if(roomId === 'schemaVersion' || roomId === 'meta') return;
      const room = projectData[roomId];
      if(!(room && typeof room === 'object' && Array.isArray(room.cabinets))) return;
      const def = roomDefs[roomId] && typeof roomDefs[roomId] === 'object' ? roomDefs[roomId] : {};
      appendUniqueRoom(out, {
        id: roomId,
        baseType: inferRoomBaseType(roomId, def),
        name: String(def.name || def.label || roomId || ''),
        label: String(def.label || def.name || roomId || ''),
        projectStatus: String(def.projectStatus || status || DEFAULT_PROJECT_STATUS),
      });
    });
    return out;
  }

  function roomsFromSnapshot(snapshot){
    const src = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const scope = src.scope && typeof src.scope === 'object' ? src.scope : {};
    const ids = Array.isArray(scope.selectedRooms) ? scope.selectedRooms.map((item)=> String(item || '').trim()).filter(Boolean) : [];
    const labels = Array.isArray(scope.roomLabels) ? scope.roomLabels.map((item)=> String(item || '').trim()) : [];
    const status = String(src.project && src.project.status || src.meta && src.meta.acceptedStage || DEFAULT_PROJECT_STATUS);
    const out = [];
    ids.forEach((roomId, index)=> {
      appendUniqueRoom(out, {
        id: roomId,
        baseType: inferRoomBaseType(roomId, null),
        name: String(labels[index] || roomId || ''),
        label: String(labels[index] || roomId || ''),
        projectStatus: status || DEFAULT_PROJECT_STATUS,
      });
    });
    return out;
  }

  function mergeCandidateInto(map, investorLike, rooms, fallback){
    const src = investorLike && typeof investorLike === 'object' ? investorLike : {};
    const fb = fallback && typeof fallback === 'object' ? fallback : {};
    const id = String(src.id || fb.id || '').trim();
    if(!id) return;
    const existing = map.get(id) || normalizeInvestor({
      id,
      kind: src.kind || fb.kind || 'person',
      name: src.name || fb.name || fb.title || '',
      companyName: src.companyName || fb.companyName || '',
      ownerName: src.ownerName || src.companyOwner || fb.ownerName || fb.companyOwner || '',
      phone: src.phone || fb.phone || '',
      email: src.email || fb.email || '',
      city: src.city || fb.city || '',
      address: src.address || fb.address || '',
      source: src.source || fb.source || '',
      nip: src.nip || fb.nip || '',
      notes: src.notes || fb.notes || '',
      rooms: [],
      addedDate: src.addedDate || src.createdDate || fb.addedDate || fb.createdDate || '',
      createdAt: Number(src.createdAt) > 0 ? Number(src.createdAt) : (Number(fb.createdAt) > 0 ? Number(fb.createdAt) : now()),
      updatedAt: Number(src.updatedAt) > 0 ? Number(src.updatedAt) : (Number(fb.updatedAt) > 0 ? Number(fb.updatedAt) : now()),
      meta: Object.assign({}, fb.meta || {}, src.meta || {}),
    });
    const merged = normalizeInvestor(Object.assign({}, existing, {
      kind: src.kind || existing.kind || fb.kind || 'person',
      name: src.name || existing.name || fb.name || fb.title || '',
      companyName: src.companyName || existing.companyName || fb.companyName || '',
      ownerName: src.ownerName || src.companyOwner || existing.ownerName || fb.ownerName || fb.companyOwner || '',
      phone: src.phone || existing.phone || fb.phone || '',
      email: src.email || existing.email || fb.email || '',
      city: src.city || existing.city || fb.city || '',
      address: src.address || existing.address || fb.address || '',
      source: src.source || existing.source || fb.source || '',
      nip: src.nip || existing.nip || fb.nip || '',
      notes: src.notes || existing.notes || fb.notes || '',
      addedDate: existing.addedDate || src.addedDate || src.createdDate || fb.addedDate || fb.createdDate || '',
      createdAt: Math.min(Number(existing.createdAt) || now(), Number(src.createdAt) > 0 ? Number(src.createdAt) : (Number(fb.createdAt) > 0 ? Number(fb.createdAt) : now())),
      updatedAt: Math.max(Number(existing.updatedAt) || 0, Number(src.updatedAt) || 0, Number(fb.updatedAt) || 0, now()),
      meta: Object.assign({}, existing.meta || {}, fb.meta || {}, src.meta || {}),
    }));
    const nextRooms = Array.isArray(merged.rooms) ? merged.rooms.slice() : [];
    (Array.isArray(rooms) ? rooms : []).forEach((room)=> appendUniqueRoom(nextRooms, room));
    merged.rooms = nextRooms;
    map.set(id, normalizeInvestor(merged));
  }

  function isTestRecoveryRecord(record){
    const src = record && typeof record === 'object' ? record : {};
    const meta = src.meta && typeof src.meta === 'object' ? src.meta : {};
    const source = String(meta.source || src.source || '').trim().toLowerCase();
    if(meta.testData === true) return true;
    return source.startsWith('test-');
  }

  function hasExplicitTestRecoverySources(){
    try{
      const projects = typeof repo.readRawProjectRecords === 'function' ? repo.readRawProjectRecords() : [];
      if((Array.isArray(projects) ? projects : []).some((record)=> isTestRecoveryRecord(record))) return true;
    }catch(_){ }
    try{
      const snapshots = typeof repo.readRawQuoteSnapshots === 'function' ? repo.readRawQuoteSnapshots() : [];
      if((Array.isArray(snapshots) ? snapshots : []).some((snapshot)=> isTestRecoveryRecord(snapshot))) return true;
    }catch(_){ }
    return false;
  }

  function buildRecoveryCandidates(options){
    const cfg = options && typeof options === 'object' ? options : {};
    const testOnly = !!cfg.testOnly;
    const recovered = new Map();
    try{
      const sessionInvestors = typeof repo.readSessionSnapshotInvestors === 'function' ? repo.readSessionSnapshotInvestors() : [];
      (Array.isArray(sessionInvestors) ? sessionInvestors : []).forEach((investor)=> {
        if(testOnly && !isTestRecoveryRecord(investor)) return;
        const investorId = String(investor && investor.id || '').trim();
        if(!investorId) return;
        mergeCandidateInto(recovered, investor, Array.isArray(investor && investor.rooms) ? investor.rooms : [], Object.assign({}, investor || {}, { source:'edit-session-snapshot' }));
      });
    }catch(_){ }
    try{
      const projects = typeof repo.readRawProjectRecords === 'function' ? repo.readRawProjectRecords() : [];
      (Array.isArray(projects) ? projects : []).forEach((record)=> {
        if(testOnly && !isTestRecoveryRecord(record)) return;
        const investorId = String(record && record.investorId || '').trim();
        if(!investorId) return;
        mergeCandidateInto(recovered, { id:investorId, name:String(record && record.title || '') }, roomsFromProjectRecord(record), record);
      });
    }catch(_){ }
    try{
      const snapshots = typeof repo.readRawQuoteSnapshots === 'function' ? repo.readRawQuoteSnapshots() : [];
      (Array.isArray(snapshots) ? snapshots : []).forEach((snapshot)=> {
        if(testOnly && !isTestRecoveryRecord(snapshot)) return;
        const investorId = String(snapshot && snapshot.investor && snapshot.investor.id || snapshot && snapshot.project && snapshot.project.investorId || '').trim();
        if(!investorId) return;
        const investorLike = Object.assign({}, snapshot && snapshot.investor || {}, { id:investorId });
        const fallback = {
          id: investorId,
          title: String(snapshot && snapshot.project && snapshot.project.title || ''),
          createdAt: Number(snapshot && snapshot.generatedAt) || 0,
          updatedAt: Number(snapshot && snapshot.generatedAt) || 0,
          source: String(snapshot && snapshot.meta && snapshot.meta.source || 'quote-snapshot-store'),
          meta: snapshot && snapshot.meta,
        };
        mergeCandidateInto(recovered, investorLike, roomsFromSnapshot(snapshot), fallback);
      });
    }catch(_){ }
    return recovered;
  }

  function recoverMissingInvestors(list){
    const currentRaw = Array.isArray(list) ? list.map(normalizeInvestor) : [];
    if(_isRecovering) return stripDevTestInvestorsForApp(currentRaw);
    _isRecovering = true;
    try{
      const current = stripDevTestInvestorsForApp(currentRaw);
      const removedIds = typeof repo.readRemovedIds === 'function' ? repo.readRemovedIds() : new Set();
      const existingIds = new Set(current.map((inv)=> String(inv && inv.id || '')).filter(Boolean));
      let recovered = buildRecoveryCandidates({ testOnly: false });
      if(current.length === 0 && isTestRuntime()){
        const explicitTestSources = hasExplicitTestRecoverySources();
        if(explicitTestSources){
          const filtered = new Map();
          recovered.forEach((candidate, id)=> {
            if(isTestRecoveryRecord(candidate)) filtered.set(id, candidate);
          });
          recovered = filtered;
        }
      }
      const additions = [];
      recovered.forEach((candidate, id)=> {
        const key = String(id || '').trim();
        if(!key || existingIds.has(key) || removedIds.has(key)) return;
        const normalized = normalizeInvestor(candidate);
        if(!isTestRuntime() && isDevTestInvestorRecord(normalized)) return;
        additions.push(normalized);
      });
      if(!additions.length) return current;
      return current.concat(additions);
    }finally{
      _isRecovering = false;
    }
  }

  FC.investorsRecovery = {
    isTestRuntime,
    isKnownLeakedTestInvestor,
    isDevTestInvestorRecord,
    stripDevTestInvestorsForApp,
    roomsFromProjectRecord,
    roomsFromSnapshot,
    mergeCandidateInto,
    isTestRecoveryRecord,
    hasExplicitTestRecoverySources,
    buildRecoveryCandidates,
    recoverMissingInvestors,
  };
})();
