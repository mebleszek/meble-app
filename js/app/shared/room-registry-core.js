(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const foundation = FC.roomRegistryFoundation;
  const definitions = FC.roomRegistryDefinitions;
  const projectSync = FC.roomRegistryProjectSync;
  const impact = FC.roomRegistryImpact;

  if(!(foundation && definitions && projectSync && impact)){
    try{ console.error('[room-registry-core] Missing split registry modules before core facade load'); }catch(_){ }
    FC.roomRegistryCore = FC.roomRegistryCore || {
      BASE_LABELS:{},
      clone:(value)=> value,
      getProject:()=> null,
      saveProject:()=> {},
      getCurrentInvestor:()=> null,
      ensureProjectMeta:()=> null,
      discoverProjectRoomKeys:()=> [],
      roomTemplate:()=> ({ cabinets:[], fronts:[], sets:[], settings:{} }),
      slugify:(text)=> String(text || ''),
      makeRoomId:(baseType, name)=> 'room_' + String(baseType || 'pokoj') + '_' + String(name || 'pomieszczenie'),
      normalizeLabel:(text)=> String(text || '').trim(),
      prettifyTechnicalRoomText:(text)=> String(text || '').trim(),
      normalizeComparableLabel:(text)=> String(text || '').trim().toLowerCase(),
      normalizeRoomDef:(raw)=> Object.assign({ id:'', baseType:'pokoj', name:'', label:'', legacy:false }, raw || {}),
      getProjectRoomDefs:()=> [],
      hasLegacyKitchen:()=> false,
      createLegacyKitchenDef:()=> null,
      hasCurrentInvestor:()=> false,
      getActiveRoomDefs:()=> [],
      getActiveRoomIds:()=> [],
      getRoomLabel:(id)=> String(id || '') || 'Pomieszczenie',
      ensureRoomData:()=> null,
      isRoomNameTaken:()=> false,
      syncRoomSelectionAfterRemoval:()=> {},
      syncQuoteDraftSelectionAfterRoomChange:()=> {},
      reconcileStatusesAfterRoomSetChange:()=> {},
      getCurrentProjectRecord:()=> null,
      getSnapshotVersionName:(snapshot)=> String(snapshot && snapshot.meta && snapshot.meta.versionName || snapshot && snapshot.commercialName || '').trim() || 'Wycena',
      listSnapshotsForRoomRemoval:()=> [],
      countCabinetsForRoomIds:()=> 0,
      buildRoomRemovalWarningMessage:()=> ({ message:'', snapshots:[], cabinetCount:0 }),
      askDeleteRoomWithQuotes: async()=> true,
      removeQuotesForRooms:()=> [],
      removeRoomsData:()=> {},
      updateInvestorRooms:()=> {},
      removeRoomById:()=> null,
      getManageableRooms:()=> [],
      applyManageRoomsDraft:()=> [],
      getEditableRoom:()=> null,
    };
    return;
  }

  FC.roomRegistryCore = {
    BASE_LABELS: foundation.BASE_LABELS,
    clone: foundation.clone,
    getProject: foundation.getProject,
    saveProject: foundation.saveProject,
    getCurrentInvestor: foundation.getCurrentInvestor,
    ensureProjectMeta: foundation.ensureProjectMeta,
    discoverProjectRoomKeys: foundation.discoverProjectRoomKeys,
    roomTemplate: foundation.roomTemplate,
    slugify: definitions.slugify,
    makeRoomId: definitions.makeRoomId,
    normalizeLabel: definitions.normalizeLabel,
    prettifyTechnicalRoomText: definitions.prettifyTechnicalRoomText,
    normalizeComparableLabel: definitions.normalizeComparableLabel,
    normalizeRoomDef: definitions.normalizeRoomDef,
    getProjectRoomDefs: definitions.getProjectRoomDefs,
    hasLegacyKitchen: definitions.hasLegacyKitchen,
    createLegacyKitchenDef: definitions.createLegacyKitchenDef,
    hasCurrentInvestor: foundation.hasCurrentInvestor,
    getActiveRoomDefs: definitions.getActiveRoomDefs,
    getActiveRoomIds: definitions.getActiveRoomIds,
    getRoomLabel: definitions.getRoomLabel,
    ensureRoomData: projectSync.ensureRoomData,
    isRoomNameTaken: definitions.isRoomNameTaken,
    syncRoomSelectionAfterRemoval: impact.syncRoomSelectionAfterRemoval,
    syncQuoteDraftSelectionAfterRoomChange: impact.syncQuoteDraftSelectionAfterRoomChange,
    reconcileStatusesAfterRoomSetChange: impact.reconcileStatusesAfterRoomSetChange,
    getCurrentProjectRecord: impact.getCurrentProjectRecord,
    getSnapshotVersionName: impact.getSnapshotVersionName,
    listSnapshotsForRoomRemoval: impact.listSnapshotsForRoomRemoval,
    countCabinetsForRoomIds: impact.countCabinetsForRoomIds,
    buildRoomRemovalWarningMessage: impact.buildRoomRemovalWarningMessage,
    askDeleteRoomWithQuotes: impact.askDeleteRoomWithQuotes,
    removeQuotesForRooms: impact.removeQuotesForRooms,
    removeRoomsData: projectSync.removeRoomsData,
    updateInvestorRooms: projectSync.updateInvestorRooms,
    removeRoomById: projectSync.removeRoomById,
    getManageableRooms: projectSync.getManageableRooms,
    applyManageRoomsDraft: projectSync.applyManageRoomsDraft,
    getEditableRoom: projectSync.getEditableRoom,
  };
})();
