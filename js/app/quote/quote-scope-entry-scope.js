(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const U = FC.quoteScopeEntryUtils || {};

  function normalizeRoomIds(roomIds){
    return typeof U.normalizeRoomIds === 'function' ? U.normalizeRoomIds(roomIds) : [];
  }

  function getCurrentProjectId(){
    return typeof U.getCurrentProjectId === 'function' ? U.getCurrentProjectId() : '';
  }

  function getCurrentInvestorId(){
    return typeof U.getCurrentInvestorId === 'function' ? U.getCurrentInvestorId() : '';
  }

  function getCurrentDraft(){
    return typeof U.getCurrentDraft === 'function' ? U.getCurrentDraft() : {};
  }

  function defaultVersionName(preliminary, options){
    return typeof U.defaultVersionName === 'function' ? U.defaultVersionName(preliminary, options) : (preliminary ? 'Wstępna oferta' : 'Oferta');
  }

  function normalizeType(options){
    return typeof U.normalizeType === 'function' ? U.normalizeType(options) : true;
  }

  function getRoomLabel(roomId){
    const key = String(roomId || '');
    if(!key) return '';
    try{
      if(FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function'){
        const label = String(FC.roomRegistry.getRoomLabel(key) || '').trim();
        if(label) return label;
      }
    }catch(_){ }
    const investorId = getCurrentInvestorId();
    try{
      if(investorId && FC.investors && typeof FC.investors.getById === 'function'){
        const investor = FC.investors.getById(investorId);
        const rooms = investor && Array.isArray(investor.rooms) ? investor.rooms : [];
        const room = rooms.find((item)=> String(item && item.id || '') === key) || null;
        const label = String(room && (room.label || room.name || room.id) || '').trim();
        if(label) return label;
      }
    }catch(_){ }
    return key;
  }

  function getScopeRoomIds(options){
    const opts = options && typeof options === 'object' ? options : {};
    const explicit = normalizeRoomIds(opts.roomIds);
    if(explicit.length) return explicit;
    const fallbackRoomId = String(opts.fallbackRoomId || opts.roomId || '').trim();
    const draft = getCurrentDraft();
    const draftRooms = normalizeRoomIds(draft && draft.selection && draft.selection.selectedRooms);
    if(draftRooms.length){
      if(!fallbackRoomId || draftRooms.includes(fallbackRoomId)) return draftRooms;
    }
    return fallbackRoomId ? [fallbackRoomId] : [];
  }

  function getScopeSummary(roomIds){
    const ids = normalizeRoomIds(roomIds);
    const labels = ids.map((roomId)=> getRoomLabel(roomId)).filter(Boolean);
    return {
      roomIds: ids,
      roomLabels: labels,
      scopeLabel: labels.join(', ') || 'wybrany zakres',
      isMultiRoom: ids.length > 1,
    };
  }

  function listExactScopeSnapshots(projectId, roomIds, options){
    const pid = String(projectId || getCurrentProjectId() || '');
    const ids = normalizeRoomIds(roomIds);
    const opts = options && typeof options === 'object' ? options : {};
    if(!pid || !ids.length) return [];
    try{
      if(!(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.listExactScopeSnapshots === 'function')) return [];
      return FC.quoteSnapshotStore.listExactScopeSnapshots(pid, ids, opts) || [];
    }catch(_){ return []; }
  }

  function findExactScopeSnapshot(projectId, roomIds, options){
    const pid = String(projectId || getCurrentProjectId() || '');
    const ids = normalizeRoomIds(roomIds);
    const opts = options && typeof options === 'object' ? options : {};
    if(!pid || !ids.length) return null;
    try{
      if(!(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.findExactScopeSnapshot === 'function')) return null;
      return FC.quoteSnapshotStore.findExactScopeSnapshot(pid, ids, opts) || null;
    }catch(_){ return null; }
  }

  function normalizeComparableVersionName(value){
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .replace(/[ąćęłńóśźż]/g, (ch)=> ({'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z'}[ch] || ch))
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function isVersionNameTaken(projectId, roomIds, preliminary, name, options){
    const target = normalizeComparableVersionName(name);
    if(!target) return false;
    const rows = listExactScopeSnapshots(projectId, roomIds, Object.assign({}, options || {}, { preliminary, includeRejected:false }));
    return rows.some((row)=> {
      const rowName = normalizeComparableVersionName(row && row.commercial && row.commercial.versionName || row && row.meta && row.meta.versionName || '');
      return rowName === target;
    });
  }

  function getEffectiveVersionName(snapshot){
    const snap = snapshot && typeof snapshot === 'object' ? snapshot : null;
    if(!snap) return '';
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getEffectiveVersionName === 'function') return String(FC.quoteSnapshotStore.getEffectiveVersionName(snap) || '').trim();
    }catch(_){ }
    return String(snap && snap.commercial && snap.commercial.versionName || snap && snap.meta && snap.meta.versionName || '').trim();
  }

  function buildSuggestedVersionName(projectId, roomIds, preliminary){
    const base = String(defaultVersionName(preliminary, { roomIds }) || '').trim() || (preliminary ? 'Wstępna oferta' : 'Oferta');
    if(!isVersionNameTaken(projectId, roomIds, preliminary, base)) return base;
    let index = 2;
    let candidate = `${base} — wariant ${index}`;
    while(isVersionNameTaken(projectId, roomIds, preliminary, candidate)){
      index += 1;
      candidate = `${base} — wariant ${index}`;
    }
    return candidate;
  }

  function describeScopeMatch(projectId, roomIds, options){
    const preliminary = normalizeType(options);
    const scope = getScopeSummary(roomIds);
    const existing = findExactScopeSnapshot(projectId, scope.roomIds, { preliminary, includeRejected:false });
    return {
      projectId:String(projectId || getCurrentProjectId() || ''),
      preliminary,
      scope,
      existingSnapshot: existing,
      existingSnapshotId: String(existing && existing.id || ''),
      suggestedVersionName: buildSuggestedVersionName(projectId, scope.roomIds, preliminary),
      hasExistingExactScope: !!existing,
    };
  }

  FC.quoteScopeEntryScope = {
    normalizeRoomIds,
    normalizeType,
    getRoomLabel,
    getScopeRoomIds,
    getScopeSummary,
    listExactScopeSnapshots,
    findExactScopeSnapshot,
    normalizeComparableVersionName,
    isVersionNameTaken,
    getEffectiveVersionName,
    buildSuggestedVersionName,
    describeScopeMatch,
  };
})();
