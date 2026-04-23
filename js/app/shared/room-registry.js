(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const core = FC.roomRegistryCore;
  const modals = FC.roomRegistryModals || {};
  const renderLayer = FC.roomRegistryRender || {};

  const fallbackRegistry = {
    BASE_LABELS:{},
    normalizeLabel: (text)=> String(text || ''),
    normalizeComparableLabel: (text)=> String(text || '').trim().toLowerCase(),
    getActiveRoomDefs: ()=> [],
    getActiveRoomIds: ()=> [],
    getRoomLabel: (id)=> String(id || '') || 'Pomieszczenie',
    ensureRoomData: ()=> null,
    openAddRoomModal: async()=> null,
    openManageRoomsModal: async()=> null,
    openRemoveRoomModal: async()=> null,
    renderRoomsView: ()=> {},
    discoverProjectRoomKeys: ()=> [],
    hasCurrentInvestor: ()=> false,
    isRoomNameTaken: ()=> false,
    hasLegacyKitchen: ()=> false,
    createLegacyKitchenDef: ()=> null,
    _debug:{}
  };

  if(!core){
    try{ console.error('[room-registry] Missing FC.roomRegistryCore before shell load'); }catch(_){ }
    FC.roomRegistry = FC.roomRegistry || fallbackRegistry;
    return;
  }

  const {
    BASE_LABELS,
    normalizeLabel,
    normalizeComparableLabel,
    getActiveRoomDefs,
    getActiveRoomIds,
    getRoomLabel,
    ensureRoomData,
    discoverProjectRoomKeys,
    hasCurrentInvestor,
    isRoomNameTaken,
    hasLegacyKitchen,
    createLegacyKitchenDef,
    applyManageRoomsDraft,
    applyManageRoomsDraftDetailed,
    createRoomRecord,
    updateRoomRecord,
    removeRoomById,
    removeRoomByIdDetailed,
    syncQuoteDraftSelectionAfterRoomChange,
    reconcileStatusesAfterRoomSetChange,
    buildRoomRemovalImpact,
    buildRoomRemovalWarningMessage,
    listRoomRemovalSnapshots,
    listSnapshotsForRoomRemoval,
    countCabinetsForRoomIds,
  } = core;

  const openAddRoomModal = typeof modals.openAddRoomModal === 'function' ? modals.openAddRoomModal : fallbackRegistry.openAddRoomModal;
  const openManageRoomsModal = typeof modals.openManageRoomsModal === 'function' ? modals.openManageRoomsModal : fallbackRegistry.openManageRoomsModal;
  const openRemoveRoomModal = typeof modals.openRemoveRoomModal === 'function' ? modals.openRemoveRoomModal : fallbackRegistry.openRemoveRoomModal;
  const renderRoomsView = typeof renderLayer.renderRoomsView === 'function' ? renderLayer.renderRoomsView : fallbackRegistry.renderRoomsView;

  FC.roomRegistry = {
    BASE_LABELS,
    normalizeLabel,
    normalizeComparableLabel,
    getActiveRoomDefs,
    getActiveRoomIds,
    getRoomLabel,
    ensureRoomData,
    openAddRoomModal,
    openManageRoomsModal,
    openRemoveRoomModal,
    renderRoomsView,
    discoverProjectRoomKeys,
    hasCurrentInvestor,
    isRoomNameTaken,
    hasLegacyKitchen,
    createLegacyKitchenDef,
    _debug:{
      applyManageRoomsDraft,
      applyManageRoomsDraftDetailed,
      createRoomRecord,
      updateRoomRecord,
      removeRoomById,
      removeRoomByIdDetailed,
      syncQuoteDraftSelectionAfterRoomChange,
      reconcileStatusesAfterRoomSetChange,
      buildRoomRemovalImpact,
      buildRoomRemovalWarningMessage,
      listRoomRemovalSnapshots,
      listSnapshotsForRoomRemoval,
      countCabinetsForRoomIds,
      openEditRoomModal: modals._debug && typeof modals._debug.openEditRoomModal === 'function' ? modals._debug.openEditRoomModal : (async()=> null),
    },
  };
})();
