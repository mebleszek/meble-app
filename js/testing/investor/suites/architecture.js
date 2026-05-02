(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const harness = FC.testHarness;
  if(!harness) return;
  const { makeTest, assert } = harness;
  const helpers = FC.investorDevTestHelpers || {};
  const seedInvestor = helpers.seedInvestor || function(initial, options){
    if(FC.testDataManager && typeof FC.testDataManager.seedInvestor === 'function') return FC.testDataManager.seedInvestor(initial, options);
    return FC.investors && typeof FC.investors.create === 'function' ? FC.investors.create(initial) : null;
  };
  const sampleInvestor = helpers.sampleInvestor || function(){
    return {
      id:'inv_test',
      kind:'person',
      name:'Jan Kowalski',
      companyName:'',
      ownerName:'',
      phone:'123',
      email:'jan@example.com',
      city:'Łódź',
      address:'Test 1',
      source:'Polecenie',
      nip:'',
      notes:'abc',
      addedDate:'2026-04-04',
      rooms:[{ id:'room_kuchnia_a', baseType:'kuchnia', name:'Kuchnia góra', label:'Kuchnia góra', projectStatus:'nowy' }]
    };
  };

  const tests = [
    makeTest('Inwestor', 'Moduły architektury inwestora są podpięte', 'Pilnuje, czy po refaktorze istnieją moduły do blokad, renderu pól, akcji i centralnego zapisu inwestora.', ()=>{
      assert(FC.investorPersistence && typeof FC.investorPersistence.saveInvestorPatch === 'function', 'Brak investorPersistence.saveInvestorPatch');
      assert(FC.investorNavigationGuard && typeof FC.investorNavigationGuard.apply === 'function', 'Brak investorNavigationGuard.apply');
      assert(FC.investorFieldRender && typeof FC.investorFieldRender.buildPairRow === 'function', 'Brak investorFieldRender.buildPairRow');
      assert(FC.investorActions && typeof FC.investorActions.buildActionBarHtml === 'function', 'Brak investorActions.buildActionBarHtml');
      assert(FC.investorsModel && typeof FC.investorsModel.normalizeInvestor === 'function', 'Brak investorsModel.normalizeInvestor');
      assert(FC.investorsLocalRepository && typeof FC.investorsLocalRepository.readStoredAll === 'function', 'Brak investorsLocalRepository.readStoredAll');
      assert(FC.investorsRecovery && typeof FC.investorsRecovery.recoverMissingInvestors === 'function', 'Brak investorsRecovery.recoverMissingInvestors');
      assert(FC.investors && FC.investors.normalizeInvestor === FC.investorsModel.normalizeInvestor, 'FC.investors nie deleguje normalizacji do investorsModel');
    }),
    makeTest('Inwestor', 'Rejestr pomieszczeń ma wspólny modal zarządzania', 'Pilnuje, czy sekcja pomieszczeń inwestora ma jedno wspólne wejście do zarządzania nazwami i usuwaniem zamiast akcji porozrzucanych po kartach.', ()=>{
      assert(FC.roomRegistry && typeof FC.roomRegistry.openManageRoomsModal === 'function', 'Brak roomRegistry.openManageRoomsModal');
      assert(FC.investorRoomActions && typeof FC.investorRoomActions.bindRoomActions === 'function', 'Brak investorRoomActions.bindRoomActions');
    }),
    makeTest('Inwestor', 'Rejestr pomieszczeń ma wydzielone warstwy, spójne API i cienkie shelle UI', 'Pilnuje utwardzenia roomRegistry: wspólne helpery są wydzielone, impact ma własny kontrakt, project-sync ma spójne mutacje create/update/remove, a shelle UI tylko delegują do core/modułów.', ()=>{
      assert(FC.roomRegistryFoundation && typeof FC.roomRegistryFoundation.getProject === 'function', 'Brak roomRegistryFoundation.getProject');
      assert(FC.roomRegistryUtils && typeof FC.roomRegistryUtils.mergeRoomCollections === 'function', 'Brak roomRegistryUtils.mergeRoomCollections');
      assert(typeof FC.roomRegistryUtils.cloneRoomDrafts === 'function', 'Brak roomRegistryUtils.cloneRoomDrafts');
      assert(FC.roomRegistryDefinitions && typeof FC.roomRegistryDefinitions.getActiveRoomDefs === 'function', 'Brak roomRegistryDefinitions.getActiveRoomDefs');
      assert(typeof FC.roomRegistryDefinitions.normalizeRoomDef === 'function', 'Brak roomRegistryDefinitions.normalizeRoomDef');
      assert(FC.roomRegistryImpact && typeof FC.roomRegistryImpact.buildRoomRemovalImpact === 'function', 'Brak roomRegistryImpact.buildRoomRemovalImpact');
      assert(typeof FC.roomRegistryImpact.buildRoomRemovalWarningMessage === 'function', 'Brak roomRegistryImpact.buildRoomRemovalWarningMessage');
      assert(typeof FC.roomRegistryImpact.listRoomRemovalSnapshots === 'function', 'Brak roomRegistryImpact.listRoomRemovalSnapshots');
      assert(typeof FC.roomRegistryImpact.reconcileStatusesAfterRoomSetChange === 'function', 'Brak roomRegistryImpact.reconcileStatusesAfterRoomSetChange');
      assert(FC.roomRegistryProjectSync && typeof FC.roomRegistryProjectSync.createRoomRecord === 'function', 'Brak roomRegistryProjectSync.createRoomRecord');
      assert(typeof FC.roomRegistryProjectSync.updateRoomRecord === 'function', 'Brak roomRegistryProjectSync.updateRoomRecord');
      assert(typeof FC.roomRegistryProjectSync.applyManageRoomsDraftDetailed === 'function', 'Brak roomRegistryProjectSync.applyManageRoomsDraftDetailed');
      assert(typeof FC.roomRegistryProjectSync.removeRoomByIdDetailed === 'function', 'Brak roomRegistryProjectSync.removeRoomByIdDetailed');
      assert(typeof FC.roomRegistryProjectSync.getEditableRoom === 'function', 'Brak roomRegistryProjectSync.getEditableRoom');
      assert(FC.roomRegistryCore && typeof FC.roomRegistryCore.getActiveRoomDefs === 'function', 'Brak roomRegistryCore.getActiveRoomDefs');
      assert(typeof FC.roomRegistryCore.createRoomRecord === 'function', 'Brak roomRegistryCore.createRoomRecord');
      assert(typeof FC.roomRegistryCore.updateRoomRecord === 'function', 'Brak roomRegistryCore.updateRoomRecord');
      assert(typeof FC.roomRegistryCore.buildRoomRemovalImpact === 'function', 'Brak roomRegistryCore.buildRoomRemovalImpact');
      assert(FC.roomRegistryCore.getActiveRoomDefs === FC.roomRegistryDefinitions.getActiveRoomDefs, 'Core nie deleguje getActiveRoomDefs do roomRegistryDefinitions');
      assert(FC.roomRegistryCore.createRoomRecord === FC.roomRegistryProjectSync.createRoomRecord, 'Core nie deleguje createRoomRecord do roomRegistryProjectSync');
      assert(FC.roomRegistryCore.updateRoomRecord === FC.roomRegistryProjectSync.updateRoomRecord, 'Core nie deleguje updateRoomRecord do roomRegistryProjectSync');
      assert(FC.roomRegistryCore.applyManageRoomsDraftDetailed === FC.roomRegistryProjectSync.applyManageRoomsDraftDetailed, 'Core nie deleguje applyManageRoomsDraftDetailed do roomRegistryProjectSync');
      assert(FC.roomRegistryCore.removeRoomByIdDetailed === FC.roomRegistryProjectSync.removeRoomByIdDetailed, 'Core nie deleguje removeRoomByIdDetailed do roomRegistryProjectSync');
      assert(FC.roomRegistryCore.buildRoomRemovalImpact === FC.roomRegistryImpact.buildRoomRemovalImpact, 'Core nie deleguje buildRoomRemovalImpact do roomRegistryImpact');
      assert(FC.roomRegistryCore.listRoomRemovalSnapshots === FC.roomRegistryImpact.listRoomRemovalSnapshots, 'Core nie deleguje listRoomRemovalSnapshots do roomRegistryImpact');
      assert(FC.roomRegistryModalsAddEdit && typeof FC.roomRegistryModalsAddEdit.openAddRoomModal === 'function', 'Brak roomRegistryModalsAddEdit.openAddRoomModal');
      assert(FC.roomRegistryModalsAddEdit._debug && typeof FC.roomRegistryModalsAddEdit._debug.openEditRoomModal === 'function', 'Brak roomRegistryModalsAddEdit._debug.openEditRoomModal');
      assert(FC.roomRegistryModalsManageRemove && typeof FC.roomRegistryModalsManageRemove.openManageRoomsModal === 'function', 'Brak roomRegistryModalsManageRemove.openManageRoomsModal');
      assert(typeof FC.roomRegistryModalsManageRemove.openRemoveRoomModal === 'function', 'Brak roomRegistryModalsManageRemove.openRemoveRoomModal');
      assert(FC.roomRegistryModals && typeof FC.roomRegistryModals.openManageRoomsModal === 'function', 'Brak roomRegistryModals.openManageRoomsModal');
      assert(FC.roomRegistryRender && typeof FC.roomRegistryRender.renderRoomsView === 'function', 'Brak roomRegistryRender.renderRoomsView');
      assert(FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomDefs === 'function', 'Brak roomRegistry.getActiveRoomDefs');
      assert(typeof FC.roomRegistry.openAddRoomModal === 'function', 'Brak roomRegistry.openAddRoomModal');
      assert(FC.roomRegistry.openAddRoomModal === FC.roomRegistryModalsAddEdit.openAddRoomModal, 'Shell roomRegistry nie deleguje add modal do roomRegistryModalsAddEdit');
      assert(FC.roomRegistry.openManageRoomsModal === FC.roomRegistryModalsManageRemove.openManageRoomsModal, 'Shell roomRegistry nie deleguje manage modal do roomRegistryModalsManageRemove');
      assert(FC.roomRegistry.openRemoveRoomModal === FC.roomRegistryModalsManageRemove.openRemoveRoomModal, 'Shell roomRegistry nie deleguje remove modal do roomRegistryModalsManageRemove');
      assert(FC.roomRegistryModals.openAddRoomModal === FC.roomRegistryModalsAddEdit.openAddRoomModal, 'Shell roomRegistryModals nie deleguje add modal do roomRegistryModalsAddEdit');
      assert(FC.roomRegistryModals.openManageRoomsModal === FC.roomRegistryModalsManageRemove.openManageRoomsModal, 'Shell roomRegistryModals nie deleguje manage modal do roomRegistryModalsManageRemove');
      assert(FC.roomRegistry.renderRoomsView === FC.roomRegistryRender.renderRoomsView, 'Shell roomRegistry nie deleguje spójnie renderu do roomRegistryRender');
      const shellDefs = FC.roomRegistry.getActiveRoomDefs();
      const coreDefs = FC.roomRegistryCore.getActiveRoomDefs();
      assert(JSON.stringify(shellDefs) === JSON.stringify(coreDefs), 'Shell roomRegistry nie deleguje spójnie do core getActiveRoomDefs', { shellDefs, coreDefs });
    }),
  ];

  FC.investorDevTestSuites = FC.investorDevTestSuites || [];
  FC.investorDevTestSuites.push({ key:'architecture', tests });
})(typeof window !== 'undefined' ? window : globalThis);
