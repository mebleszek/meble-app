(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function fallbackNormalizeRoomIds(roomIds){
    return Array.isArray(roomIds)
      ? Array.from(new Set(roomIds.map((item)=> String(item || '').trim()).filter(Boolean)))
      : [];
  }

  function normalizeRoomIds(roomIds){
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.normalizeRoomIds === 'function'){
        return FC.quoteSnapshotStore.normalizeRoomIds(roomIds);
      }
    }catch(_){ }
    return fallbackNormalizeRoomIds(roomIds);
  }

  function getActiveRoomIds(options){
    const opts = options && typeof options === 'object' ? options : {};
    const getter = typeof opts.getActiveRooms === 'function'
      ? opts.getActiveRooms
      : (typeof opts.getRooms === 'function' ? opts.getRooms : null);
    if(getter){
      try{ return normalizeRoomIds(getter()); }catch(_){ }
    }
    try{
      if(FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomIds === 'function'){
        return normalizeRoomIds(FC.roomRegistry.getActiveRoomIds());
      }
    }catch(_){ }
    return [];
  }

  function normalizeExplicitSelection(roomIds, options){
    const opts = options && typeof options === 'object' ? options : {};
    const explicitRooms = normalizeRoomIds(roomIds);
    if(!explicitRooms.length) return [];
    const activeRooms = Array.isArray(opts.activeRooms) ? normalizeRoomIds(opts.activeRooms) : getActiveRoomIds(opts);
    try{
      if(opts.useRozrysScope !== false && FC.rozrysScope && typeof FC.rozrysScope.normalizeRoomSelection === 'function'){
        const resolved = FC.rozrysScope.normalizeRoomSelection(explicitRooms, { getRooms:()=> activeRooms });
        return normalizeRoomIds(resolved);
      }
    }catch(_){ }
    return explicitRooms;
  }

  function resolveSelection(selection, options){
    const opts = options && typeof options === 'object' ? options : {};
    const src = selection && typeof selection === 'object' ? selection : {};
    const activeRooms = Array.isArray(opts.activeRooms) ? normalizeRoomIds(opts.activeRooms) : getActiveRoomIds(opts);
    const explicitRooms = normalizeRoomIds(src.selectedRooms);
    let selectedRooms = normalizeExplicitSelection(explicitRooms, { activeRooms, useRozrysScope: opts.useRozrysScope !== false });
    let fallbackReason = '';

    if(!selectedRooms.length && explicitRooms.length){
      selectedRooms = explicitRooms.slice();
      fallbackReason = 'preserve-explicit';
    }else if(!selectedRooms.length && activeRooms.length){
      selectedRooms = activeRooms.slice();
      fallbackReason = 'use-active-rooms';
    }else if(!selectedRooms.length){
      fallbackReason = 'no-active-rooms';
    }

    const activeSet = new Set(activeRooms);
    const validSelectedRooms = selectedRooms.filter((roomId)=> activeSet.has(roomId));
    const missingSelectedRooms = selectedRooms.filter((roomId)=> !activeSet.has(roomId));
    if(!fallbackReason && explicitRooms.length && sameRoomIds(selectedRooms, explicitRooms)) fallbackReason = 'preserve-explicit';

    return {
      activeRooms,
      explicitRooms,
      selectedRooms,
      validSelectedRooms,
      missingSelectedRooms,
      hadExplicitSelection: explicitRooms.length > 0,
      usedActiveRoomsFallback: fallbackReason === 'use-active-rooms',
      fallbackReason,
    };
  }

  function decodeSelectionFromPrefs(prefsSelectedRooms, options){
    const opts = options && typeof options === 'object' ? options : {};
    const activeRooms = Array.isArray(opts.activeRooms) ? normalizeRoomIds(opts.activeRooms) : getActiveRoomIds(opts);
    try{
      if(opts.useRozrysScope !== false && FC.rozrysScope && typeof FC.rozrysScope.decodeRoomsSelection === 'function'){
        const decoded = FC.rozrysScope.decodeRoomsSelection(prefsSelectedRooms, { getRooms:()=> activeRooms });
        const normalized = normalizeRoomIds(decoded);
        if(normalized.length) return normalized;
      }
    }catch(_){ }
    const explicit = normalizeExplicitSelection(prefsSelectedRooms, { activeRooms, useRozrysScope: opts.useRozrysScope !== false });
    return explicit.length ? explicit : activeRooms;
  }

  function sameRoomIds(left, right){
    const a = normalizeRoomIds(left);
    const b = normalizeRoomIds(right);
    if(a.length !== b.length) return false;
    for(let i = 0; i < a.length; i++){
      if(a[i] !== b[i]) return false;
    }
    return true;
  }

  function filterExactScopedRows(projectId, roomIds, options){
    const pid = String(projectId || '').trim();
    const ids = normalizeRoomIds(roomIds);
    const opts = options && typeof options === 'object' ? options : {};
    if(!pid || !ids.length) return [];
    let rows = Array.isArray(opts.rows) ? opts.rows : null;
    if(!rows){
      try{
        if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.listForProject === 'function'){
          rows = FC.quoteSnapshotStore.listForProject(pid);
        }
      }catch(_){ rows = null; }
    }
    rows = Array.isArray(rows) ? rows : [];
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.filterRowsByRoomScope === 'function'){
        return FC.quoteSnapshotStore.filterRowsByRoomScope(rows, ids, {
          matchMode:'exact',
          allowProjectWideExact: !!opts.allowProjectWideExact,
        }) || [];
      }
    }catch(_){ }
    return rows.filter((row)=> {
      const rowRooms = normalizeRoomIds(row && row.scope && row.scope.selectedRooms);
      if(!rowRooms.length){
        return !!(opts.allowProjectWideExact && ids.length === 1);
      }
      return sameRoomIds(rowRooms, ids);
    });
  }

  FC.roomScopeResolver = {
    normalizeRoomIds,
    getActiveRoomIds,
    normalizeExplicitSelection,
    resolveSelection,
    decodeSelectionFromPrefs,
    sameRoomIds,
    filterExactScopedRows,
  };
})();
