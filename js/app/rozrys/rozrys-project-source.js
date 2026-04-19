(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const LEGACY_CREATOR_ROOM_KEYS = ['kuchnia','szafa','pokoj','lazienka'];

  function createApi(deps){
    deps = deps || {};
    const apiFC = deps.FC || FC;
    const host = deps.host || (typeof window !== 'undefined' ? window : globalThis);

    function discoverProjectRoomKeys(proj){
      if(!proj || typeof proj !== 'object') return [];
      const out = [];
      Object.keys(proj).forEach((key)=>{
        const roomKey = String(key || '').trim();
        if(!roomKey || roomKey in {'schemaVersion':1,'meta':1}) return;
        const room = proj[key];
        if(!room || typeof room !== 'object') return;
        const hasRoomShape = Array.isArray(room.cabinets) || Array.isArray(room.fronts) || Array.isArray(room.sets) || (!!room.settings && typeof room.settings === 'object');
        if(hasRoomShape) out.push(roomKey);
      });
      return out;
    }

    function isLegacyCreatorRoomKey(roomKey){
      return LEGACY_CREATOR_ROOM_KEYS.includes(String(roomKey || '').trim());
    }

    function hasMeaningfulProjectRoomData(room){
      if(!(room && typeof room === 'object')) return false;
      if(Array.isArray(room.cabinets) && room.cabinets.length) return true;
      if(Array.isArray(room.fronts) && room.fronts.length) return true;
      if(Array.isArray(room.sets) && room.sets.length) return true;
      return false;
    }

    function getProjectMetaRoomIds(proj){
      if(!(proj && typeof proj === 'object')) return [];
      const meta = proj.meta && typeof proj.meta === 'object' ? proj.meta : null;
      if(!meta) return [];
      const defs = meta.roomDefs && typeof meta.roomDefs === 'object' ? meta.roomDefs : {};
      const order = Array.isArray(meta.roomOrder) ? meta.roomOrder : [];
      const out = [];
      const push = (id)=>{
        const key = String(id || '').trim();
        if(!key || out.includes(key)) return;
        out.push(key);
      };
      order.forEach(push);
      Object.keys(defs).forEach(push);
      return out;
    }

    function discoverVisibleProjectRoomKeys(proj){
      const metaRoomIds = getProjectMetaRoomIds(proj);
      const discovered = discoverProjectRoomKeys(proj);
      const out = [];
      const push = (roomKey)=>{
        const key = String(roomKey || '').trim();
        if(!key || out.includes(key)) return;
        out.push(key);
      };
      metaRoomIds.forEach(push);
      discovered.forEach((roomKey)=>{
        if(metaRoomIds.includes(roomKey)) return;
        if(!isLegacyCreatorRoomKey(roomKey)) return push(roomKey);
        if(hasMeaningfulProjectRoomData(proj && proj[roomKey])) push(roomKey);
      });
      return out;
    }

    function countProjectCabinets(proj){
      return discoverProjectRoomKeys(proj).reduce((sum, roomKey)=>{
        const room = proj && proj[roomKey];
        const cabinets = Array.isArray(room && room.cabinets) ? room.cabinets.length : 0;
        return sum + cabinets;
      }, 0);
    }

    function collectProjectCandidates(){
      const candidates = [];
      const pushCandidate = (proj, source)=>{
        if(!(proj && typeof proj === 'object')) return;
        if(candidates.some((entry)=> entry.proj === proj)) return;
        candidates.push({ proj, source: String(source || 'unknown') });
      };
      try{
        const override = apiFC.rozrys && apiFC.rozrys.__projectOverride;
        if(override) pushCandidate(override, 'override');
      }catch(_){ }
      try{ if(typeof projectData !== 'undefined' && projectData) pushCandidate(projectData, 'global'); }catch(_){ }
      try{ if(host.projectData) pushCandidate(host.projectData, 'window'); }catch(_){ }
      try{ if(apiFC.project && typeof apiFC.project.load === 'function'){ const loaded = apiFC.project.load(); if(loaded) pushCandidate(loaded, 'load'); } }catch(_){ }
      return candidates;
    }

    function safeGetProject(){
      const candidates = collectProjectCandidates();
      if(!candidates.length) return null;
      const direct = candidates.filter((entry)=> entry.source !== 'load');
      const preferred = direct.some((entry)=> countProjectCabinets(entry.proj) > 0 || discoverProjectRoomKeys(entry.proj).length > 0)
        ? direct
        : candidates;
      let best = null;
      let bestScore = -1;
      preferred.forEach((entry)=>{
        const proj = entry.proj;
        if(!proj || typeof proj !== 'object') return;
        const roomCount = discoverProjectRoomKeys(proj).length;
        const cabinetCount = countProjectCabinets(proj);
        const sourceBias = entry.source === 'load' ? 0 : 1000000;
        const score = sourceBias + (cabinetCount * 1000) + roomCount;
        if(score > bestScore){
          best = proj;
          bestScore = score;
        }
      });
      return best || (preferred[0] && preferred[0].proj) || null;
    }

    function getRoomsForProject(proj){
      const registryRooms = (()=>{
        try{
          if(apiFC.roomRegistry && typeof apiFC.roomRegistry.getActiveRoomIds === 'function'){
            const dynamicRooms = apiFC.roomRegistry.getActiveRoomIds();
            return Array.isArray(dynamicRooms) ? dynamicRooms.filter(Boolean) : [];
          }
        }catch(_){ }
        return [];
      })();
      const hasInvestor = (()=>{
        try{ return !!(apiFC.roomRegistry && typeof apiFC.roomRegistry.hasCurrentInvestor === 'function' && apiFC.roomRegistry.hasCurrentInvestor()); }
        catch(_){ return false; }
      })();
      const fallbackDefaults = (()=>{
        try{
          if(apiFC.schema && Array.isArray(apiFC.schema.ROOMS)) return apiFC.schema.ROOMS.slice();
        }catch(_){ }
        return ['kuchnia','szafa','pokoj','lazienka'];
      })();
      const defaults = hasInvestor ? registryRooms.slice() : (registryRooms.length ? registryRooms.slice() : fallbackDefaults);
      if(!proj || typeof proj !== 'object') return defaults;
      const discovered = discoverVisibleProjectRoomKeys(proj);
      const ordered = [];
      const preferredOrder = defaults.length ? defaults : discovered;
      preferredOrder.forEach((room)=>{
        if(discovered.includes(room) && !ordered.includes(room)) ordered.push(room);
      });
      discovered.forEach((room)=>{
        if(!ordered.includes(room)) ordered.push(room);
      });
      if(ordered.length) return ordered;
      if(hasInvestor) return registryRooms.length ? registryRooms.slice() : [];
      return defaults;
    }

    function getRooms(){
      return getRoomsForProject(safeGetProject());
    }

    return {
      LEGACY_CREATOR_ROOM_KEYS,
      discoverProjectRoomKeys,
      isLegacyCreatorRoomKey,
      hasMeaningfulProjectRoomData,
      getProjectMetaRoomIds,
      discoverVisibleProjectRoomKeys,
      countProjectCabinets,
      collectProjectCandidates,
      safeGetProject,
      getRoomsForProject,
      getRooms,
    };
  }

  FC.rozrysProjectSource = { LEGACY_CREATOR_ROOM_KEYS, createApi };
})();
