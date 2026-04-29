(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const statusScope = FC.projectStatusScope || {};
  const normalizeStatus = statusScope.normalizeStatus || function(value){ return String(value || '').trim(); };

  // Odpowiedzialność modułu: zapis/status mirror dla projektu i pokoi.
  // Ten plik nie decyduje o logice biznesowej statusów; dostaje już policzoną
  // mapę statusów i zapisuje ją w lustrzanych miejscach używanych przez runtime.

  function saveInvestorRooms(investor, roomStatusMap){
    if(!(investor && investor.id)) return investor || null;
    const roomMap = new Map();
    const currentRooms = Array.isArray(investor.rooms) ? investor.rooms : [];
    const explicitStatusMap = roomStatusMap && typeof roomStatusMap === 'object' ? roomStatusMap : {};
    currentRooms.forEach((room)=> {
      const key = String(room && room.id || '');
      if(!key) return;
      const resolvedStatus = normalizeStatus(explicitStatusMap[key] || room && (room.projectStatus || room.status) || '');
      roomMap.set(key, Object.assign({}, room, resolvedStatus ? { projectStatus:resolvedStatus } : {}));
    });
    try{
      if(FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomDefs === 'function'){
        const defs = FC.roomRegistry.getActiveRoomDefs() || [];
        defs.forEach((room)=> {
          const key = String(room && room.id || '');
          if(!key) return;
          const hasExplicitStatus = Object.prototype.hasOwnProperty.call(explicitStatusMap, key);
          const resolvedStatus = normalizeStatus(hasExplicitStatus ? explicitStatusMap[key] : '');
          if(roomMap.has(key) && !hasExplicitStatus) return;
          if(!roomMap.has(key) && !hasExplicitStatus) return;
          const nextRoom = Object.assign({}, room || {}, roomMap.get(key) || {}, { id:key });
          if(resolvedStatus) nextRoom.projectStatus = resolvedStatus;
          roomMap.set(key, nextRoom);
        });
      }
    }catch(_){ }
    const rooms = Array.from(roomMap.values());
    if(!rooms.length) return investor;
    try{
      if(FC.investorPersistence && typeof FC.investorPersistence.saveInvestorPatch === 'function'){
        return FC.investorPersistence.saveInvestorPatch(investor.id, { rooms }) || Object.assign({}, investor, { rooms });
      }
    }catch(_){ }
    try{
      if(FC.investors && typeof FC.investors.update === 'function'){
        return FC.investors.update(investor.id, { rooms }) || Object.assign({}, investor, { rooms });
      }
    }catch(_){ }
    return Object.assign({}, investor, { rooms });
  }

  function updateProjectRecord(projectRecord, mirrorStatus){
    if(!(projectRecord && projectRecord.id)) return null;
    try{
      if(FC.projectStore && typeof FC.projectStore.upsert === 'function'){
        return FC.projectStore.upsert(Object.assign({}, projectRecord, { status:mirrorStatus, updatedAt:Date.now() }));
      }
    }catch(_){ }
    return projectRecord;
  }

  function updateLoadedProject(loadedProject, mirrorStatus, roomStatusMap){
    try{
      if(!(FC.project && typeof FC.project.save === 'function')) return loadedProject || null;
      const proj = loadedProject && typeof loadedProject === 'object' ? loadedProject : {};
      const meta = proj.meta && typeof proj.meta === 'object' ? proj.meta : (proj.meta = {});
      meta.projectStatus = mirrorStatus;
      if(meta.roomDefs && typeof meta.roomDefs === 'object'){
        Object.keys(meta.roomDefs).forEach((roomId)=> {
          const row = meta.roomDefs[roomId];
          if(!row || typeof row !== 'object') return;
          const resolvedStatus = normalizeStatus(roomStatusMap && roomStatusMap[roomId] || row.projectStatus || row.status || '');
          meta.roomDefs[roomId] = Object.assign({}, row, resolvedStatus ? { projectStatus:resolvedStatus } : {});
        });
      }
      return FC.project.save(proj) || proj;
    }catch(_){ return loadedProject || null; }
  }

  function syncStatusMirrors(projectRecord, loadedProject, masterStatus, roomStatusMap){
    const mirrorStatus = normalizeStatus(masterStatus || '') || 'nowy';
    return {
      mirrorStatus,
      projectRecord: projectRecord ? updateProjectRecord(projectRecord, mirrorStatus) : null,
      loadedProject: updateLoadedProject(loadedProject, mirrorStatus, roomStatusMap),
    };
  }

  function refreshStatusViews(){
    try{ if(FC.views && typeof FC.views.refreshSessionButtons === 'function') FC.views.refreshSessionButtons(); }catch(_){ }
    try{ if(FC.investorUI && typeof FC.investorUI.render === 'function') FC.investorUI.render(); }catch(_){ }
    try{ if(FC.roomRegistry && typeof FC.roomRegistry.renderRoomsView === 'function') FC.roomRegistry.renderRoomsView(); }catch(_){ }
  }

  FC.projectStatusMirrors = {
    saveInvestorRooms,
    updateProjectRecord,
    updateLoadedProject,
    syncStatusMirrors,
    refreshStatusViews,
  };
})();
