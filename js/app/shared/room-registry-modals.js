(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const addEdit = FC.roomRegistryModalsAddEdit || {};
  const manageRemove = FC.roomRegistryModalsManageRemove || {};

  const fallbackModalApi = {
    openAddRoomModal: async()=> null,
    openManageRoomsModal: async()=> null,
    openRemoveRoomModal: async()=> null,
    _debug:{
      openEditRoomModal: async()=> null,
    },
  };

  const openAddRoomModal = typeof addEdit.openAddRoomModal === 'function' ? addEdit.openAddRoomModal : fallbackModalApi.openAddRoomModal;
  const openManageRoomsModal = typeof manageRemove.openManageRoomsModal === 'function' ? manageRemove.openManageRoomsModal : fallbackModalApi.openManageRoomsModal;
  const openRemoveRoomModal = typeof manageRemove.openRemoveRoomModal === 'function' ? manageRemove.openRemoveRoomModal : fallbackModalApi.openRemoveRoomModal;
  const openEditRoomModal = addEdit._debug && typeof addEdit._debug.openEditRoomModal === 'function' ? addEdit._debug.openEditRoomModal : fallbackModalApi._debug.openEditRoomModal;

  FC.roomRegistryModals = {
    openAddRoomModal,
    openManageRoomsModal,
    openRemoveRoomModal,
    _debug:{
      openEditRoomModal,
    },
  };
})();
