(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const harness = FC.testHarness;
  if(!harness) return;
  const { makeTest, runSuite, assert } = harness;

  function sampleInvestor(){
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
  }

  const tests = [
    makeTest('Inwestor', 'Moduły architektury inwestora są podpięte', 'Pilnuje, czy po refaktorze istnieją moduły do blokad, renderu pól, akcji i centralnego zapisu inwestora.', ()=>{
      assert(FC.investorPersistence && typeof FC.investorPersistence.saveInvestorPatch === 'function', 'Brak investorPersistence.saveInvestorPatch');
      assert(FC.investorNavigationGuard && typeof FC.investorNavigationGuard.apply === 'function', 'Brak investorNavigationGuard.apply');
      assert(FC.investorFieldRender && typeof FC.investorFieldRender.buildPairRow === 'function', 'Brak investorFieldRender.buildPairRow');
      assert(FC.investorActions && typeof FC.investorActions.buildActionBarHtml === 'function', 'Brak investorActions.buildActionBarHtml');
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
    makeTest('Inwestor', 'Registry utils scala pokoje i serializuje drafty bez dublowania helperów w modalach', 'Pilnuje jakościowego porządku: wspólny helper registry musi deduplikować pokoje z meta/inwestora i stabilnie serializować drafty do dirty-checków.', ()=>{
      assert(FC.roomRegistryUtils && typeof FC.roomRegistryUtils.mergeRoomCollections === 'function', 'Brak roomRegistryUtils.mergeRoomCollections');
      const merged = FC.roomRegistryUtils.mergeRoomCollections({
        activeRooms:[{ id:'room_1', baseType:'kuchnia', name:'Kuchnia meta', label:'Kuchnia meta' }],
        investorRooms:[{ id:'room_1', baseType:'kuchnia', name:'Kuchnia inwestor', label:'Kuchnia inwestor' }, { id:'room_2', baseType:'pokoj', name:'Gabinet', label:'Gabinet' }],
        includeLegacyKitchen:true,
        legacyRoom:{ id:'kuchnia', baseType:'kuchnia', name:'kuchnia stary program', label:'kuchnia stary program', legacy:true },
        normalizeRoomDef: FC.roomRegistryDefinitions.normalizeRoomDef,
      });
      const mergedIds = merged.map((room)=> String(room && room.id || ''));
      assert(mergedIds.length === 3, 'mergeRoomCollections nie zwrócił oczekiwanej liczby unikalnych pokoi', { merged });
      assert(merged.find((room)=> String(room.id || '') === 'room_1' && String(room.label || '') === 'Kuchnia inwestor'), 'mergeRoomCollections nie nadał priorytetu etykiecie inwestora dla duplikatu room_1', { merged });
      const drafts = FC.roomRegistryUtils.cloneRoomDrafts(merged);
      const serialized = FC.roomRegistryUtils.serializeRoomDrafts(drafts, FC.roomRegistryDefinitions.normalizeLabel);
      assert(Array.isArray(drafts) && drafts.length === merged.length, 'cloneRoomDrafts nie zachował wszystkich draftów', { drafts, merged });
      assert(/room_1/.test(String(serialized || '')) && /kuchnia/.test(String(serialized || '')), 'serializeRoomDrafts nie zwraca stabilnego snapshotu draftów', { serialized });
    }),

    makeTest('Inwestor', 'Stan edytora inwestora przechodzi z podglądu do edycji i wykrywa zmiany', 'Sprawdza, czy nowy moduł stanu edycji inwestora nie gubi draftu i poprawnie liczy dirty.', ()=>{
      assert(FC.investorEditorState && typeof FC.investorEditorState.enter === 'function', 'Brak investorEditorState');
      const inv = sampleInvestor();
      FC.investorEditorState.enter(inv);
      assert(FC.investorEditorState.state.isEditing === true, 'Tryb edycji nie został włączony');
      assert(FC.investorEditorState.state.dirty === false, 'Dirty nie powinno być ustawione od razu');
      FC.investorEditorState.setField('city', 'Warszawa');
      assert(FC.investorEditorState.state.dirty === true, 'Zmiana pola nie ustawiła dirty');
      const patch = FC.investorEditorState.commit(inv);
      assert(patch.city === 'Warszawa', 'Commit nie zwrócił zmienionej wartości miasta', patch);
      assert(FC.investorEditorState.state.isEditing === false, 'Commit nie wyłączył trybu edycji');
    }),
    makeTest('Inwestor', 'Store inwestorów normalizuje datę dodania i status projektu', 'Pilnuje, czy inwestor ma stabilną datę dodania, a projekty/pomieszczenia dostają własny status zamiast statusu inwestora.', ()=>{
      assert(FC.investors && typeof FC.investors.normalizeInvestor === 'function', 'Brak investors.normalizeInvestor');
      const normalized = FC.investors.normalizeInvestor({ id:'inv_a', kind:'person', createdAt: 1712275200000, rooms:[{ id:'room_1', label:'Kuchnia dół' }] });
      assert(/^\d{4}-\d{2}-\d{2}$/.test(String(normalized.addedDate || '')), 'Brak poprawnej daty dodania', normalized);
      assert(Array.isArray(normalized.rooms) && normalized.rooms[0] && normalized.rooms[0].projectStatus === 'nowy', 'Pokój/projekt nie dostał domyślnego statusu', normalized);
    }),
    makeTest('Inwestor', 'Firma przechowuje właściciela jako osobne pole', 'Pilnuje, czy dane firmy mają osobne pole właściciela, żeby można je było renderować nad NIP-em bez dokładania prowizorek w UI.', ()=>{
      assert(FC.investors && typeof FC.investors.normalizeInvestor === 'function', 'Brak investors.normalizeInvestor');
      const normalized = FC.investors.normalizeInvestor({ id:'inv_company', kind:'company', companyName:'ABC', ownerName:'Jan Nowak', nip:'123' });
      assert(String(normalized.ownerName || '') === 'Jan Nowak', 'Store nie zachował ownerName firmy', normalized);
      assert(FC.investorEditorState && typeof FC.investorEditorState.buildPatchFromDraft === 'function', 'Brak investorEditorState.buildPatchFromDraft');
      const patch = FC.investorEditorState.buildPatchFromDraft({ kind:'company', companyName:'ABC', ownerName:'Jan Nowak', nip:'123' });
      assert(String(patch.ownerName || '') === 'Jan Nowak', 'Patch inwestora nie zachował ownerName firmy', patch);
    }),
    makeTest('Inwestor', 'Rejestr pomieszczeń wykrywa duplikat nazwy niezależnie od wielkości liter i polskich znaków', 'Pilnuje, czy dla jednego inwestora nie da się dodać dwóch pomieszczeń o tej samej nazwie także po normalizacji diakrytyków.', ()=>{
      assert(FC.roomRegistry && typeof FC.roomRegistry.isRoomNameTaken === 'function', 'Brak roomRegistry.isRoomNameTaken');
      const inv = sampleInvestor();
      assert(FC.roomRegistry.isRoomNameTaken('kuchnia GÓRA', inv) === true, 'Duplikat nazwy nie został wykryty');
      inv.rooms.push({ id:'room_kuchnia_dol', baseType:'kuchnia', name:'kuchnia dół', label:'kuchnia dół' });
      assert(FC.roomRegistry.isRoomNameTaken('kuchnia dol', inv) === true, 'Duplikat akcento-niezależny nie został wykryty');
      assert(FC.roomRegistry.isRoomNameTaken('Łazienka', inv) === false, 'Fałszywy duplikat dla innej nazwy');
    }),

    makeTest('Inwestor', 'Rejestr pomieszczeń scala meta projektu z kolejnością inwestora bez gubienia etykiet', 'Pilnuje splitu roomRegistry: aktywne pomieszczenia mają zachować kolejność z projektu/meta i końcowe etykiety inwestora po scaleniach.', ()=>{
      assert(FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomDefs === 'function', 'Brak FC.roomRegistry.getActiveRoomDefs');
      const prevProject = Object.prototype.hasOwnProperty.call(root, 'projectData') ? root.projectData : undefined;
      const prevWindowProject = root.window && Object.prototype.hasOwnProperty.call(root.window, 'projectData') ? root.window.projectData : undefined;
      const prevCurrentId = FC.investors && FC.investors.getCurrentId ? FC.investors.getCurrentId() : '';
      const prevGetById = FC.investors && FC.investors.getById;
      const investor = {
        id:'inv_room_merge',
        rooms:[
          { id:'room_b', baseType:'pokoj', name:'Salon klienta', label:'Salon klienta', projectStatus:'nowy' },
          { id:'room_a', baseType:'kuchnia', name:'Kuchnia dół', label:'Kuchnia dół', projectStatus:'nowy' },
        ]
      };
      const project = {
        schemaVersion:9,
        meta:{
          roomDefs:{
            room_a:{ id:'room_a', baseType:'kuchnia', name:'Kuchnia', label:'Kuchnia' },
            room_b:{ id:'room_b', baseType:'pokoj', name:'Salon', label:'Salon' },
          },
          roomOrder:['room_b','room_a']
        },
        room_a:{ cabinets:[], fronts:[], sets:[], settings:{} },
        room_b:{ cabinets:[], fronts:[], sets:[], settings:{} },
      };
      try{
        root.projectData = project;
        if(root.window) root.window.projectData = project;
        if(FC.investors && FC.investors.setCurrentId) FC.investors.setCurrentId(investor.id);
        if(FC.investors) FC.investors.getById = (id)=> String(id || '') === investor.id ? investor : null;
        const rooms = FC.roomRegistry.getActiveRoomDefs();
        assert(Array.isArray(rooms) && rooms.length === 2, 'Rejestr nie zwrócił dwóch aktywnych pomieszczeń po scaleniu meta i inwestora', rooms);
        assert(String(rooms[0] && rooms[0].id || '') === 'room_b' && String(rooms[1] && rooms[1].id || '') === 'room_a', 'Rejestr nie zachował kolejności pomieszczeń inwestora/meta', rooms);
        assert(String(rooms[0] && rooms[0].label || '') === 'Salon klienta', 'Scalanie nie zachowało etykiety inwestora dla room_b', rooms);
      } finally {
        if(prevProject === undefined){ try{ delete root.projectData; }catch(_){ root.projectData = undefined; } }
        else root.projectData = prevProject;
        if(root.window){
          if(prevWindowProject === undefined){ try{ delete root.window.projectData; }catch(_){ root.window.projectData = undefined; } }
          else root.window.projectData = prevWindowProject;
        }
        if(FC.investors && FC.investors.setCurrentId) FC.investors.setCurrentId(prevCurrentId || null);
        if(FC.investors) FC.investors.getById = prevGetById;
      }
    }),



    makeTest('Inwestor', 'Rejestr pomieszczeń preferuje czytelną nazwę z meta projektu zamiast technicznego room_* inwestora', 'Pilnuje regresji etykiet dynamicznych pokoi: jeśli investor.rooms przechowuje techniczną nazwę room_*, a meta projektu ma już ładną nazwę, WYWIAD i nagłówek pokoju mają pokazywać czytelną etykietę.', ()=>{
      assert(FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function', 'Brak FC.roomRegistry.getRoomLabel');
      const prevProject = Object.prototype.hasOwnProperty.call(root, 'projectData') ? root.projectData : undefined;
      const prevWindowProject = root.window && Object.prototype.hasOwnProperty.call(root.window, 'projectData') ? root.window.projectData : undefined;
      const prevCurrentId = FC.investors && FC.investors.getCurrentId ? FC.investors.getCurrentId() : '';
      const prevGetById = FC.investors && FC.investors.getById;
      const investor = {
        id:'inv_room_label_pref',
        rooms:[
          { id:'room_szafa_szafa_z_lustrem_aat61d', baseType:'szafa', name:'room_szafa_szafa_z_lustrem_aat61d', label:'room_szafa_szafa_z_lustrem_aat61d', projectStatus:'nowy' }
        ]
      };
      const project = {
        schemaVersion:9,
        meta:{
          roomDefs:{
            room_szafa_szafa_z_lustrem_aat61d:{ id:'room_szafa_szafa_z_lustrem_aat61d', baseType:'szafa', name:'Szafa z lustrem', label:'Szafa z lustrem' }
          },
          roomOrder:['room_szafa_szafa_z_lustrem_aat61d']
        },
        room_szafa_szafa_z_lustrem_aat61d:{ cabinets:[], fronts:[], sets:[], settings:{} },
      };
      try{
        root.projectData = project;
        if(root.window) root.window.projectData = project;
        if(FC.investors && FC.investors.setCurrentId) FC.investors.setCurrentId(investor.id);
        if(FC.investors) FC.investors.getById = (id)=> String(id || '') === investor.id ? investor : null;
        const rooms = FC.roomRegistry.getActiveRoomDefs();
        const room = Array.isArray(rooms) ? rooms.find((item)=> String(item && item.id || '') === 'room_szafa_szafa_z_lustrem_aat61d') : null;
        assert(room && String(room.label || '') === 'Szafa z lustrem', 'Registry nie wybrał czytelnej etykiety pokoju z meta projektu', room);
        assert(String(FC.roomRegistry.getRoomLabel('room_szafa_szafa_z_lustrem_aat61d') || '') === 'Szafa z lustrem', 'getRoomLabel nie zwrócił czytelnej nazwy zamiast technicznego room_*', FC.roomRegistry.getRoomLabel('room_szafa_szafa_z_lustrem_aat61d'));
      } finally {
        if(prevProject === undefined){ try{ delete root.projectData; }catch(_){ root.projectData = undefined; } }
        else root.projectData = prevProject;
        if(root.window){
          if(prevWindowProject === undefined){ try{ delete root.window.projectData; }catch(_){ root.window.projectData = undefined; } }
          else root.window.projectData = prevWindowProject;
        }
        if(FC.investors && FC.investors.setCurrentId) FC.investors.setCurrentId(prevCurrentId || null);
        if(FC.investors) FC.investors.getById = prevGetById;
      }
    }),

    makeTest('Inwestor', 'Rejestr pomieszczeń nie gubi pokoi istniejących tylko w meta projektu, gdy inwestor ma już inną listę', 'Pilnuje regresji widocznej po dodawaniu pokoi dynamicznych: jeśli currentInvestor.rooms jest niepełne, registry i Wycena nadal muszą widzieć pokoje istniejące w projectData.meta.roomDefs zamiast pokazywać techniczne room_* lub gubić pokój z zakresu.', ()=>{
      assert(FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomDefs === 'function', 'Brak FC.roomRegistry.getActiveRoomDefs');
      assert(typeof FC.roomRegistry.getRoomLabel === 'function', 'Brak FC.roomRegistry.getRoomLabel');
      const prevProject = Object.prototype.hasOwnProperty.call(root, 'projectData') ? root.projectData : undefined;
      const prevWindowProject = root.window && Object.prototype.hasOwnProperty.call(root.window, 'projectData') ? root.window.projectData : undefined;
      const prevCurrentId = FC.investors && FC.investors.getCurrentId ? FC.investors.getCurrentId() : '';
      const prevGetById = FC.investors && FC.investors.getById;
      const investor = {
        id:'inv_room_partial',
        rooms:[
          { id:'room_existing', baseType:'kuchnia', name:'Kuchnia dół', label:'Kuchnia dół', projectStatus:'nowy' }
        ]
      };
      const project = {
        schemaVersion:9,
        meta:{
          roomDefs:{
            room_existing:{ id:'room_existing', baseType:'kuchnia', name:'Kuchnia dół', label:'Kuchnia dół' },
            room_kuchnia_a_test01:{ id:'room_kuchnia_a_test01', baseType:'kuchnia', name:'A', label:'A' }
          },
          roomOrder:['room_existing','room_kuchnia_a_test01']
        },
        room_existing:{ cabinets:[], fronts:[], sets:[], settings:{} },
        room_kuchnia_a_test01:{ cabinets:[{ id:'cab1' }], fronts:[], sets:[], settings:{} },
      };
      try{
        root.projectData = project;
        if(root.window) root.window.projectData = project;
        if(FC.investors && FC.investors.setCurrentId) FC.investors.setCurrentId(investor.id);
        if(FC.investors) FC.investors.getById = (id)=> String(id || '') === investor.id ? investor : null;
        const rooms = FC.roomRegistry.getActiveRoomDefs();
        const ids = Array.isArray(rooms) ? rooms.map((room)=> String(room && room.id || '')) : [];
        assert(ids.includes('room_kuchnia_a_test01'), 'Registry zgubił pokój istniejący tylko w meta projektu, gdy investor.rooms był niepełny', rooms);
        assert(String(FC.roomRegistry.getRoomLabel('room_kuchnia_a_test01') || '') === 'A', 'Registry nie zwrócił czytelnej etykiety dla dynamicznego pokoju z meta projektu', { rooms, label:FC.roomRegistry.getRoomLabel('room_kuchnia_a_test01') });
      } finally {
        if(prevProject === undefined){ try{ delete root.projectData; }catch(_){ root.projectData = undefined; } }
        else root.projectData = prevProject;
        if(root.window){
          if(prevWindowProject === undefined){ try{ delete root.window.projectData; }catch(_){ root.window.projectData = undefined; } }
          else root.window.projectData = prevWindowProject;
        }
        if(FC.investors && FC.investors.setCurrentId) FC.investors.setCurrentId(prevCurrentId || null);
        if(FC.investors) FC.investors.getById = prevGetById;
      }
    }),
    makeTest('Inwestor', 'Rejestr pomieszczeń czyta aktywny projekt także z globalnego projectData bez window.projectData', 'Pilnuje regresji po splicie roomRegistry: realna aplikacja trzyma bieżący projekt w app.js jako globalny projectData, więc rejestr nie może polegać wyłącznie na window.projectData.', ()=>{
      assert(FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomDefs === 'function', 'Brak FC.roomRegistry.getActiveRoomDefs');
      const prevProject = Object.prototype.hasOwnProperty.call(root, 'projectData') ? root.projectData : undefined;
      const prevWindowProject = root.window && Object.prototype.hasOwnProperty.call(root.window, 'projectData') ? root.window.projectData : undefined;
      const prevCurrentId = FC.investors && FC.investors.getCurrentId ? FC.investors.getCurrentId() : '';
      const prevGetById = FC.investors && FC.investors.getById;
      const investor = {
        id:'inv_room_global_pd',
        rooms:[
          { id:'room_only_global', baseType:'kuchnia', name:'Kuchnia global', label:'Kuchnia global', projectStatus:'nowy' }
        ]
      };
      const project = {
        schemaVersion:9,
        meta:{ roomDefs:{ room_only_global:{ id:'room_only_global', baseType:'kuchnia', name:'Kuchnia global', label:'Kuchnia global' } }, roomOrder:['room_only_global'] },
        room_only_global:{ cabinets:[{ id:'cab_global_1' }], fronts:[], sets:[], settings:{} },
      };
      try{
        root.projectData = project;
        if(root.window){ try{ delete root.window.projectData; }catch(_){ root.window.projectData = undefined; } }
        if(FC.investors && FC.investors.setCurrentId) FC.investors.setCurrentId(investor.id);
        if(FC.investors) FC.investors.getById = (id)=> String(id || '') === investor.id ? investor : null;
        const rooms = FC.roomRegistry.getActiveRoomDefs();
        assert(Array.isArray(rooms) && rooms.length === 1, 'Rejestr nie odczytał aktywnego projektu z globalnego projectData', rooms);
        assert(String(rooms[0] && rooms[0].id || '') === 'room_only_global', 'Rejestr zwrócił zły pokój dla globalnego projectData', rooms);
      } finally {
        if(prevProject === undefined){ try{ delete root.projectData; }catch(_){ root.projectData = undefined; } }
        else root.projectData = prevProject;
        if(root.window){
          if(prevWindowProject === undefined){ try{ delete root.window.projectData; }catch(_){ root.window.projectData = undefined; } }
          else root.window.projectData = prevWindowProject;
        }
        if(FC.investors && FC.investors.setCurrentId) FC.investors.setCurrentId(prevCurrentId || null);
        if(FC.investors) FC.investors.getById = prevGetById;
      }
    }),

    makeTest('Inwestor', 'Rejestr aktywnych pomieszczeń dla inwestora nie wraca do generatorowych typów bazowych', 'Pilnuje, czy aktywne pokoje dla inwestora biorą się z rzeczywiście dodanych pomieszczeń, a nie z domyślnej listy kuchnia/szafa/pokój/łazienka.', ()=>{
      assert(FC.investors && typeof FC.investors.create === 'function', 'Brak investors.create');
      assert(FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomIds === 'function', 'Brak roomRegistry.getActiveRoomIds');
      try{ delete root.projectData; }catch(_){ root.projectData = undefined; }
      try{ if(root.window) delete root.window.projectData; }catch(_){ if(root.window) root.window.projectData = undefined; }
      const created = (FC.testDataManager && typeof FC.testDataManager.createInvestor === 'function'
        ? FC.testDataManager.createInvestor({
          kind:'person',
          name:'Test',
          rooms:[
            { id:'room_kuchnia_gora', baseType:'kuchnia', name:'Kuchnia góra', label:'Kuchnia góra' },
            { id:'room_spizarnia', baseType:'pokoj', name:'Spiżarnia', label:'Spiżarnia' }
          ]
        })
        : FC.investors.create({
          kind:'person',
          name:'Test',
          rooms:[
            { id:'room_kuchnia_gora', baseType:'kuchnia', name:'Kuchnia góra', label:'Kuchnia góra' },
            { id:'room_spizarnia', baseType:'pokoj', name:'Spiżarnia', label:'Spiżarnia' }
          ]
        }));
      FC.investors.setCurrentId(created.id);
      const ids = FC.roomRegistry.getActiveRoomIds();
      assert(Array.isArray(ids) && ids.includes('room_kuchnia_gora') && ids.includes('room_spizarnia'), 'Aktywne pokoje nie pochodzą z inwestora', ids);
      assert(!ids.includes('kuchnia') && !ids.includes('szafa') && !ids.includes('pokoj') && !ids.includes('lazienka'), 'Do listy wróciły typy bazowe zamiast pokoi inwestora', ids);
    }),

    makeTest('Inwestor', 'Ostrzeżenie przy usuwaniu pomieszczenia pokazuje szafki i powiązane wyceny', 'Pilnuje, czy komunikat kasowania pokoju informuje nie tylko o szafkach, ale też o wycenach powiązanych z tym pomieszczeniem.', ()=>{
      assert(FC.roomRegistry && FC.roomRegistry._debug && typeof FC.roomRegistry._debug.buildRoomRemovalWarningMessage === 'function', 'Brak roomRegistry._debug.buildRoomRemovalWarningMessage');
      assert(FC.projectStore && typeof FC.projectStore.ensureForInvestor === 'function', 'Brak FC.projectStore.ensureForInvestor');
      assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.save === 'function', 'Brak FC.quoteSnapshotStore.save');
      const prevInvestors = FC.investors.readAll();
      const prevCurrentInvestorId = FC.investors.getCurrentId();
      const prevProjects = FC.projectStore.readAll();
      const prevCurrentProjectId = FC.projectStore.getCurrentProjectId ? FC.projectStore.getCurrentProjectId() : '';
      const prevSnapshots = FC.quoteSnapshotStore.readAll();
      const prevProjectData = Object.prototype.hasOwnProperty.call(root, 'projectData') ? root.projectData : undefined;
      try{
        FC.investors.writeAll([]);
        FC.projectStore.writeAll([]);
        FC.quoteSnapshotStore.writeAll([]);
        const investor = FC.investors.create({
          id:'inv_room_warning',
          kind:'person',
          name:'Room warning',
          rooms:[{ id:'room_warn', baseType:'kuchnia', name:'Kuchnia test', label:'Kuchnia test', projectStatus:'nowy' }]
        });
        FC.investors.setCurrentId(investor.id);
        const projectData = {
          schemaVersion:2,
          meta:{ roomDefs:{ room_warn:{ id:'room_warn', baseType:'kuchnia', name:'Kuchnia test', label:'Kuchnia test' } }, roomOrder:['room_warn'] },
          room_warn:{ cabinets:[{ id:'cab1' }, { id:'cab2' }], fronts:[], sets:[], settings:{} },
        };
        const project = FC.projectStore.ensureForInvestor(investor.id, { status:'nowy', projectData });
        FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId(project.id);
        root.projectData = JSON.parse(JSON.stringify(projectData));
        FC.quoteSnapshotStore.save({
          id:'snap_warn_pre',
          investor:{ id:investor.id, name:investor.name },
          project:{ id:project.id, investorId:investor.id, status:'wstepna_wycena' },
          commercial:{ preliminary:true, versionName:'Wstępna oferta — Kuchnia test' },
          meta:{ preliminary:true, versionName:'Wstępna oferta — Kuchnia test', roomIds:['room_warn'] },
          generatedAt: 100,
        });
        const warning = FC.roomRegistry._debug.buildRoomRemovalWarningMessage(investor, ['room_warn'], { deferred:false });
        assert(/2 szafki/.test(String(warning && warning.message || '')), 'Komunikat nie pokazuje liczby szafek usuwanego pomieszczenia', warning);
        assert(/Wstępna oferta/.test(String(warning && warning.message || '')), 'Komunikat nie pokazuje powiązanej wyceny pokoju', warning);
      } finally {
        if(prevProjectData === undefined) { try{ delete root.projectData; }catch(_){ root.projectData = undefined; } }
        else root.projectData = prevProjectData;
        FC.quoteSnapshotStore.writeAll(prevSnapshots);
        FC.projectStore.writeAll(prevProjects);
        FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId(prevCurrentProjectId);
        FC.investors.writeAll(prevInvestors);
        FC.investors.setCurrentId(prevCurrentInvestorId);
      }
    }),

    makeTest('Inwestor', 'Zarządzanie pomieszczeniami pozwala zapisać pustą listę i czyści zakres wyceny', 'Pilnuje, czy usunięcie wszystkich pokoi naprawdę zapisuje pustego inwestora, czyści scope draftu Wycena i nie zostawia projektu na starym statusie.', ()=>{
      assert(FC.roomRegistry && FC.roomRegistry._debug && typeof FC.roomRegistry._debug.applyManageRoomsDraft === 'function', 'Brak roomRegistry._debug.applyManageRoomsDraft');
      assert(FC.quoteOfferStore && typeof FC.quoteOfferStore.patchCurrentDraft === 'function', 'Brak FC.quoteOfferStore.patchCurrentDraft');
      assert(FC.projectStore && typeof FC.projectStore.ensureForInvestor === 'function', 'Brak FC.projectStore.ensureForInvestor');
      const prevInvestors = FC.investors.readAll();
      const prevCurrentInvestorId = FC.investors.getCurrentId();
      const prevProjects = FC.projectStore.readAll();
      const prevCurrentProjectId = FC.projectStore.getCurrentProjectId ? FC.projectStore.getCurrentProjectId() : '';
      const prevProjectData = Object.prototype.hasOwnProperty.call(root, 'projectData') ? root.projectData : undefined;
      const prevDrafts = FC.quoteOfferStore.readAll();
      try{
        FC.investors.writeAll([]);
        FC.projectStore.writeAll([]);
        FC.quoteOfferStore.writeAll([]);
        const investor = FC.investors.create({
          id:'inv_empty_rooms',
          kind:'person',
          name:'Puste pokoje',
          rooms:[
            { id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'wstepna_wycena' },
            { id:'room_b', baseType:'pokoj', name:'Pokój B', label:'Pokój B', projectStatus:'nowy' },
          ]
        });
        FC.investors.setCurrentId(investor.id);
        const projectData = {
          schemaVersion:2,
          meta:{
            projectStatus:'wstepna_wycena',
            roomDefs:{
              room_a:{ id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'wstepna_wycena' },
              room_b:{ id:'room_b', baseType:'pokoj', name:'Pokój B', label:'Pokój B', projectStatus:'nowy' },
            },
            roomOrder:['room_a','room_b'],
          },
          room_a:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} },
          room_b:{ cabinets:[{ id:'cab_b' }], fronts:[], sets:[], settings:{} },
        };
        const project = FC.projectStore.ensureForInvestor(investor.id, { status:'wstepna_wycena', projectData });
        FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId(project.id);
        root.projectData = JSON.parse(JSON.stringify(projectData));
        FC.quoteOfferStore.patchCurrentDraft({ selection:{ selectedRooms:['room_a','room_b'] } });
        FC.roomRegistry._debug.applyManageRoomsDraft(investor, []);
        const updatedInvestor = FC.investors.getById(investor.id);
        const updatedProject = FC.projectStore.getById(project.id);
        const draft = FC.quoteOfferStore.getCurrentDraft();
        const activeRoomIds = FC.roomRegistry.getActiveRoomIds();
        assert(updatedInvestor && Array.isArray(updatedInvestor.rooms) && updatedInvestor.rooms.length === 0, 'Usunięcie wszystkich pokoi nie zapisało pustej listy inwestora', updatedInvestor);
        assert(updatedProject && String(updatedProject.status || '') === 'nowy', 'Projekt nie wrócił do statusu nowy po usunięciu wszystkich pokoi', updatedProject);
        assert(Array.isArray(draft && draft.selection && draft.selection.selectedRooms) && draft.selection.selectedRooms.length === 0, 'Draft Wycena nie wyczyścił zaznaczonych pokoi po usunięciu całej listy', draft);
        assert(Array.isArray(activeRoomIds) && activeRoomIds.length === 0, 'Rejestr aktywnych pokoi nadal zwraca usunięte pomieszczenia', activeRoomIds);
      } finally {
        FC.quoteOfferStore.writeAll(prevDrafts);
        if(prevProjectData === undefined) { try{ delete root.projectData; }catch(_){ root.projectData = undefined; } }
        else root.projectData = prevProjectData;
        FC.projectStore.writeAll(prevProjects);
        FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId(prevCurrentProjectId);
        FC.investors.writeAll(prevInvestors);
        FC.investors.setCurrentId(prevCurrentInvestorId);
      }
    }),


    makeTest('Inwestor', 'Registry create/update/remove i impact mają spójny kontrakt zachowania', 'Pilnuje jednego porządnego pakietu jakościowego: create/update/remove mają zwracać spójne obiekty wyniku, impact ma pokazać skutki usunięcia, a cleanup nie może zostawić pokoju w projekcie ani inwestorze.', ()=>{
      assert(FC.roomRegistry && FC.roomRegistry._debug && typeof FC.roomRegistry._debug.createRoomRecord === 'function', 'Brak roomRegistry._debug.createRoomRecord');
      assert(typeof FC.roomRegistry._debug.updateRoomRecord === 'function', 'Brak roomRegistry._debug.updateRoomRecord');
      assert(typeof FC.roomRegistry._debug.removeRoomByIdDetailed === 'function', 'Brak roomRegistry._debug.removeRoomByIdDetailed');
      assert(typeof FC.roomRegistry._debug.buildRoomRemovalImpact === 'function', 'Brak roomRegistry._debug.buildRoomRemovalImpact');
      const prevInvestors = FC.investors.readAll();
      const prevCurrentInvestorId = FC.investors.getCurrentId();
      const prevProjects = FC.projectStore.readAll();
      const prevCurrentProjectId = FC.projectStore.getCurrentProjectId ? FC.projectStore.getCurrentProjectId() : '';
      const prevProjectData = Object.prototype.hasOwnProperty.call(root, 'projectData') ? root.projectData : undefined;
      const prevSnapshots = FC.quoteSnapshotStore.readAll();
      try{
        FC.investors.writeAll([]);
        FC.projectStore.writeAll([]);
        FC.quoteSnapshotStore.writeAll([]);
        const investor = FC.investors.create({ id:'inv_registry_contract', kind:'person', name:'Registry Contract', rooms:[{ id:'room_base', baseType:'kuchnia', name:'Kuchnia baza', label:'Kuchnia baza', projectStatus:'nowy' }] });
        FC.investors.setCurrentId(investor.id);
        const projectData = {
          schemaVersion:2,
          meta:{
            roomDefs:{ room_base:{ id:'room_base', baseType:'kuchnia', name:'Kuchnia baza', label:'Kuchnia baza' } },
            roomOrder:['room_base'],
          },
          room_base:{ cabinets:[{ id:'cab_base' }], fronts:[], sets:[], settings:{} },
        };
        const project = FC.projectStore.ensureForInvestor(investor.id, { status:'nowy', projectData: JSON.parse(JSON.stringify(projectData)) });
        FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId(project.id);
        root.projectData = JSON.parse(JSON.stringify(projectData));
        const created = FC.roomRegistry._debug.createRoomRecord(investor, { baseType:'pokoj', name:'Gabinet testowy' });
        assert(created && created.ok === true && created.room && created.room.id, 'createRoomRecord nie zwrócił poprawnego kontraktu wyniku', created);
        const createdId = String(created.room.id || '');
        const afterCreateInvestor = FC.investors.getById(investor.id);
        assert(afterCreateInvestor && Array.isArray(afterCreateInvestor.rooms) && afterCreateInvestor.rooms.some((room)=> String(room && room.id || '') === createdId), 'createRoomRecord nie dopisał pokoju do inwestora', afterCreateInvestor);
        assert(root.projectData && root.projectData.meta && root.projectData.meta.roomDefs && root.projectData.meta.roomDefs[createdId], 'createRoomRecord nie dopisał roomDef do projektu', root.projectData);
        const updated = FC.roomRegistry._debug.updateRoomRecord(afterCreateInvestor, createdId, { baseType:'pokoj', name:'Gabinet premium' });
        assert(updated && updated.ok === true && String(updated.room && updated.room.label || '') === 'Gabinet premium', 'updateRoomRecord nie zwrócił zaktualizowanej etykiety', updated);
        root.projectData[createdId] = { cabinets:[{ id:'cab_1' }, { id:'cab_2' }], fronts:[], sets:[], settings:{} };
        FC.projectStore.ensureForInvestor(investor.id, { status:'wstepna_wycena', projectData: JSON.parse(JSON.stringify(root.projectData)) });
        FC.quoteSnapshotStore.save({
          id:'snap_registry_contract',
          investor:{ id:investor.id, name:investor.name },
          project:{ id:project.id, investorId:investor.id, status:'wstepna_wycena' },
          commercial:{ preliminary:true, versionName:'Oferta Gabinet premium' },
          meta:{ preliminary:true, versionName:'Oferta Gabinet premium', roomIds:[createdId] },
          generatedAt: 123,
        });
        const impact = FC.roomRegistry._debug.buildRoomRemovalImpact(FC.investors.getById(investor.id), [createdId], { deferred:true });
        assert(impact && /Gabinet premium/.test(String(impact.roomLabel || '')), 'buildRoomRemovalImpact nie zwrócił etykiety pokoju po rename', impact);
        assert(Number(impact && impact.cabinetCount || 0) === 2, 'buildRoomRemovalImpact nie policzył szafek pokoju', impact);
        assert(Array.isArray(impact && impact.snapshots) && impact.snapshots.length === 1, 'buildRoomRemovalImpact nie wykrył snapshotu powiązanego z pokojem', impact);
        const removed = FC.roomRegistry._debug.removeRoomByIdDetailed(createdId);
        assert(removed && removed.ok === true && String(removed.roomId || '') === createdId, 'removeRoomByIdDetailed nie zwrócił poprawnego kontraktu wyniku', removed);
        const afterRemoveInvestor = FC.investors.getById(investor.id);
        assert(afterRemoveInvestor && Array.isArray(afterRemoveInvestor.rooms) && !afterRemoveInvestor.rooms.some((room)=> String(room && room.id || '') === createdId), 'removeRoomByIdDetailed nie usunął pokoju z inwestora', afterRemoveInvestor);
        assert(!(root.projectData && root.projectData.meta && root.projectData.meta.roomDefs && root.projectData.meta.roomDefs[createdId]), 'removeRoomByIdDetailed nie usunął roomDef z projektu', root.projectData);
      } finally {
        FC.quoteSnapshotStore.writeAll(prevSnapshots);
        if(prevProjectData === undefined) { try{ delete root.projectData; }catch(_){ root.projectData = undefined; } }
        else root.projectData = prevProjectData;
        FC.projectStore.writeAll(prevProjects);
        FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId(prevCurrentProjectId);
        FC.investors.writeAll(prevInvestors);
        FC.investors.setCurrentId(prevCurrentInvestorId);
      }
    }),

    makeTest('Inwestor', 'Firma ostrzega, gdy właściciel pasuje do istniejącej osoby prywatnej', 'Pilnuje reguły, że firma z właścicielem Jan Kowalski ma ostrzec o istniejącej osobie prywatnej Jan Kowalski.', ()=>{
      assert(FC.investorActions && FC.investorActions._debug && typeof FC.investorActions._debug.findInvestorConflicts === 'function', 'Brak debug.findInvestorConflicts');
      assert(FC.investors && typeof FC.investors.create === 'function', 'Brak investors.create');
      try{ delete root.projectData; }catch(_){ root.projectData = undefined; }
      try{ if(root.window) delete root.window.projectData; }catch(_){ if(root.window) root.window.projectData = undefined; }
      const created = (FC.testDataManager && typeof FC.testDataManager.createInvestor === 'function'
        ? FC.testDataManager.createInvestor({ kind:'person', name:'Jan Kowalski', address:'Test 9' })
        : FC.investors.create({ kind:'person', name:'Jan Kowalski', address:'Test 9' }));
      const conflicts = FC.investorActions._debug.findInvestorConflicts({ id:'draft_cmp' }, { kind:'company', companyName:'Meble Jan', ownerName:'Jan Kowalski', address:'Inna 1' });
      assert(conflicts && conflicts.ownerPerson && String(conflicts.ownerPerson.id || '') === String(created.id || ''), 'Nie wykryto dopasowania ownerName firmy do osoby prywatnej', conflicts);
    }),


    makeTest('Inwestor', 'Karta PDF inwestora buduje się z danych modelu i ma własny przycisk w pasku akcji', 'Pilnuje, czy karta do segregatora nie zależy od DOM-u i czy w widoku inwestora jest osobny przycisk PDF.', ()=>{
      assert(FC.investorPdf && typeof FC.investorPdf.buildPrintHtml === 'function', 'Brak investorPdf.buildPrintHtml');
      const html = FC.investorPdf.buildPrintHtml(sampleInvestor());
      assert(/Karta inwestora/.test(String(html || '')), 'HTML PDF nie zawiera tytułu karty inwestora');
      assert(/Jan Kowalski/.test(String(html || '')), 'HTML PDF nie zawiera danych inwestora');
      assert(/Kuchnia góra/.test(String(html || '')), 'HTML PDF nie zawiera listy pomieszczeń');
      const actionBar = FC.investorActions.buildActionBarHtml({ isEditing:false, dirty:false });
      assert(/data-investor-action="pdf"/.test(String(actionBar || '')), 'Pasek akcji inwestora nie zawiera przycisku PDF', actionBar);
      assert(!/data-investor-action="delete"/.test(String(actionBar || '')), 'Usuń inwestora nie powinno być widoczne poza edycją', actionBar);
      const editIndex = String(actionBar || '').indexOf('data-investor-action="edit"');
      const pdfIndex = String(actionBar || '').indexOf('data-investor-action="pdf"');
      assert(editIndex !== -1 && pdfIndex !== -1 && editIndex < pdfIndex, 'Przycisk PDF nie jest dołożony jako ostatni po prawej stronie', actionBar);
      const editModeBar = FC.investorActions.buildActionBarHtml({ isEditing:true, dirty:false });
      assert(/data-investor-action="delete"/.test(String(editModeBar || '')), 'Usuń inwestora powinno być dostępne po wejściu w edycję', editModeBar);
    }),

        makeTest('Inwestor', 'Dodawanie inwestora otwiera formularz bez pustego wpisu w bazie', 'Pilnuje, czy nowy inwestor startuje jako szkic w UI, a nie jako pusty rekord zapisany od razu do storage.', ()=>{
      assert(FC.investors && typeof FC.investors.readAll === 'function', 'Brak investors.readAll');
      const before = FC.investors.readAll().length;
      const temp = FC.investors.normalizeInvestor({ id:'draft_inv_test', kind:'person' });
      assert(String(temp.id || '').startsWith('draft_'), 'Szkic inwestora powinien mieć techniczne ID draftu', temp);
      const after = FC.investors.readAll().length;
      assert(before === after, 'Samo przygotowanie szkicu nie może dodawać pustego inwestora do bazy', { before, after });
    }),

    makeTest('Inwestor', 'Zmiana statusu z inwestora synchronizuje projekt i aktywną ofertę', 'Pilnuje, czy zmiana etapu projektu z poziomu inwestora ustawia status rekordu projektu i wybiera właściwą ofertę bez ręcznego poprawiania Wycena.', ()=>{
      assert(FC.investorPersistence && typeof FC.investorPersistence.setInvestorProjectStatus === 'function', 'Brak investorPersistence.setInvestorProjectStatus');
      assert(FC.projectStore && typeof FC.projectStore.ensureForInvestor === 'function', 'Brak FC.projectStore.ensureForInvestor');
      assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.save === 'function', 'Brak FC.quoteSnapshotStore.save');
      const prevInvestors = FC.investors.readAll();
      const prevCurrentInvestorId = FC.investors.getCurrentId();
      const prevProjects = FC.projectStore.readAll();
      const prevCurrentProjectId = FC.projectStore.getCurrentProjectId ? FC.projectStore.getCurrentProjectId() : '';
      const prevSnapshots = FC.quoteSnapshotStore.readAll();
      try{
        FC.investors.writeAll([]);
        FC.projectStore.writeAll([]);
        FC.quoteSnapshotStore.writeAll([]);
        const investor = FC.investors.create({
          id:'inv_sync_status',
          kind:'person',
          name:'Sync test',
          rooms:[{ id:'room_sync', baseType:'kuchnia', name:'Kuchnia test', label:'Kuchnia test', projectStatus:'nowy' }]
        });
        FC.investors.setCurrentId(investor.id);
        const project = FC.projectStore.ensureForInvestor(investor.id, {
          status:'nowy',
          projectData:{ room_sync:{ cabinets:[{ id:'cab_sync' }], fronts:[], sets:[], settings:{} } }
        });
        FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId(project.id);
        FC.quoteSnapshotStore.save({
          id:'snap_pre',
          investor:{ id:investor.id, name:investor.name },
          project:{ id:project.id, investorId:investor.id, status:'wstepna_wycena' },
          commercial:{ preliminary:true, versionName:'Wstępna oferta' },
          meta:{ preliminary:true, versionName:'Wstępna oferta' },
          generatedAt: 100,
        });
        FC.quoteSnapshotStore.save({
          id:'snap_final',
          investor:{ id:investor.id, name:investor.name },
          project:{ id:project.id, investorId:investor.id, status:'wycena' },
          commercial:{ preliminary:false, versionName:'Oferta' },
          meta:{ preliminary:false, versionName:'Oferta' },
          generatedAt: 200,
        });
        FC.quoteSnapshotStore.markSelectedForProject(project.id, 'snap_pre', { status:'pomiar', roomIds:['room_sync'] });
        const pomiarDetails = FC.investorPersistence.setInvestorProjectStatus(investor.id, 'room_sync', 'pomiar', { returnDetails:true });
        const afterPomiarInvestor = FC.investors.getById(investor.id);
        const afterPomiarProject = FC.projectStore.getById(project.id);
        const loadedAfterPomiar = pomiarDetails && pomiarDetails.result && pomiarDetails.result.loadedProject;
        const selectedPre = FC.quoteSnapshotStore.getSelectedForProject(project.id);
        assert(String(afterPomiarInvestor.rooms[0].projectStatus || '') === 'pomiar', 'Pokój inwestora nie dostał statusu pomiar', afterPomiarInvestor);
        assert(pomiarDetails && pomiarDetails.result && String(pomiarDetails.result.masterStatus || '') === 'pomiar', 'Zmiana statusu z inwestora nie zwróciła centralnego masterStatus', pomiarDetails);
        assert(pomiarDetails && pomiarDetails.result && String(pomiarDetails.result.mirrorStatus || '') === 'pomiar', 'Zmiana statusu z inwestora nie zwróciła mirrorStatus zgodnego z masterem', pomiarDetails);
        assert(String(afterPomiarProject.status || '') === 'pomiar', 'Project store nie zsynchronizował statusu pomiar', afterPomiarProject);
        assert(loadedAfterPomiar && loadedAfterPomiar.meta && String(loadedAfterPomiar.meta.projectStatus || '') === 'pomiar', 'loadedProject.meta.projectStatus nie jest lustrem centralnego statusu po zmianie z inwestora', loadedAfterPomiar);
        assert(selectedPre && String(selectedPre.id || '') === 'snap_pre', 'Zmiana statusu na pomiar nie wybrała oferty wstępnej', selectedPre || FC.quoteSnapshotStore.listForProject(project.id));
        FC.quoteSnapshotStore.markSelectedForProject(project.id, 'snap_final', { status:'zaakceptowany', roomIds:['room_sync'] });
        const finalDetails = FC.investorPersistence.setInvestorProjectStatus(investor.id, 'room_sync', 'zaakceptowany', { returnDetails:true });
        const afterFinalProject = FC.projectStore.getById(project.id);
        const loadedAfterFinal = finalDetails && finalDetails.result && finalDetails.result.loadedProject;
        const selectedFinal = FC.quoteSnapshotStore.getSelectedForProject(project.id);
        assert(finalDetails && finalDetails.result && String(finalDetails.result.masterStatus || '') === 'zaakceptowany', 'Zmiana statusu na zaakceptowany nie zwróciła masterStatus', finalDetails);
        assert(finalDetails && finalDetails.result && String(finalDetails.result.mirrorStatus || '') === 'zaakceptowany', 'Zmiana statusu na zaakceptowany nie zwróciła mirrorStatus', finalDetails);
        assert(String(afterFinalProject.status || '') === 'zaakceptowany', 'Project store nie zsynchronizował statusu zaakceptowany', afterFinalProject);
        assert(loadedAfterFinal && loadedAfterFinal.meta && String(loadedAfterFinal.meta.projectStatus || '') === 'zaakceptowany', 'loadedProject.meta.projectStatus nie jest lustrem statusu zaakceptowany', loadedAfterFinal);
        assert(selectedFinal && String(selectedFinal.id || '') === 'snap_final', 'Zmiana statusu na zaakceptowany nie wybrała oferty końcowej', selectedFinal || FC.quoteSnapshotStore.listForProject(project.id));
      } finally {
        FC.quoteSnapshotStore.writeAll(prevSnapshots);
        FC.projectStore.writeAll(prevProjects);
        FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId(prevCurrentProjectId);
        FC.investors.writeAll(prevInvestors);
        FC.investors.setCurrentId(prevCurrentInvestorId);
      }
    }),
    makeTest('Inwestor', 'Późne etapy z Inwestora utrzymują master, lustra i exact-scope drugiego pokoju', 'Pilnuje, czy ręczne przejścia na umowę, produkcję, montaż i zakończenie nie gubią centralnego wyniku statusu i nie ruszają zaakceptowanej oferty rozłącznego pokoju.', ()=>{
      assert(FC.investorPersistence && typeof FC.investorPersistence.setInvestorProjectStatus === 'function', 'Brak investorPersistence.setInvestorProjectStatus');
      assert(FC.projectStatusSync && typeof FC.projectStatusSync.setStatusFromSnapshot === 'function', 'Brak FC.projectStatusSync.setStatusFromSnapshot');
      assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.save === 'function', 'Brak FC.quoteSnapshotStore.save');
      const prevInvestors = FC.investors.readAll();
      const prevCurrentInvestorId = FC.investors.getCurrentId();
      const prevProjects = FC.projectStore.readAll();
      const prevCurrentProjectId = FC.projectStore.getCurrentProjectId ? FC.projectStore.getCurrentProjectId() : '';
      const prevSnapshots = FC.quoteSnapshotStore.readAll();
      try{
        FC.investors.writeAll([]);
        FC.projectStore.writeAll([]);
        FC.quoteSnapshotStore.writeAll([]);
        const investor = FC.investors.create({
          id:'inv_late_flow',
          kind:'person',
          name:'Late flow',
          rooms:[
            { id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'nowy' },
            { id:'room_b', baseType:'pokoj', name:'Pokój B', label:'Pokój B', projectStatus:'nowy' },
          ]
        });
        FC.investors.setCurrentId(investor.id);
        const project = FC.projectStore.ensureForInvestor(investor.id, {
          status:'nowy',
          projectData:{
            schemaVersion:2,
            meta:{ roomDefs:{ room_a:{ id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'nowy' }, room_b:{ id:'room_b', baseType:'pokoj', name:'Pokój B', label:'Pokój B', projectStatus:'nowy' } }, roomOrder:['room_a','room_b'] },
            room_a:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} },
            room_b:{ cabinets:[{ id:'cab_b' }], fronts:[], sets:[], settings:{} },
          }
        });
        FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId(project.id);
        const finalA = FC.quoteSnapshotStore.save({ id:'snap_late_a', investor:{ id:investor.id, name:investor.name }, project:{ id:project.id, investorId:investor.id, status:'wycena' }, scope:{ selectedRooms:['room_a'], roomLabels:['Kuchnia A'] }, commercial:{ preliminary:false, versionName:'Oferta A' }, meta:{ preliminary:false, versionName:'Oferta A' }, generatedAt:100 });
        const finalB = FC.quoteSnapshotStore.save({ id:'snap_late_b', investor:{ id:investor.id, name:investor.name }, project:{ id:project.id, investorId:investor.id, status:'wycena' }, scope:{ selectedRooms:['room_b'], roomLabels:['Pokój B'] }, commercial:{ preliminary:false, versionName:'Oferta B' }, meta:{ preliminary:false, versionName:'Oferta B' }, generatedAt:200 });
        FC.projectStatusSync.setStatusFromSnapshot(finalA, 'zaakceptowany', { roomIds:['room_a'], syncSelection:true, refreshUi:false });
        FC.projectStatusSync.setStatusFromSnapshot(finalB, 'zaakceptowany', { roomIds:['room_b'], syncSelection:true, refreshUi:false });
        ['umowa','produkcja','montaz','zakonczone'].forEach((status)=>{
          const details = FC.investorPersistence.setInvestorProjectStatus(investor.id, 'room_a', status, { returnDetails:true });
          const freshInvestor = FC.investors.getById(investor.id);
          const freshProject = FC.projectStore.getById(project.id);
          const selectedA = FC.quoteSnapshotStore.getSelectedForProject(project.id, { roomIds:['room_a'] });
          const selectedB = FC.quoteSnapshotStore.getSelectedForProject(project.id, { roomIds:['room_b'] });
          const roomA = freshInvestor && freshInvestor.rooms && freshInvestor.rooms.find((room)=> String(room && room.id || '') === 'room_a');
          const roomB = freshInvestor && freshInvestor.rooms && freshInvestor.rooms.find((room)=> String(room && room.id || '') === 'room_b');
          assert(details && details.result && String(details.result.masterStatus || '') === status, 'masterStatus nie zgadza się dla późnego etapu z Inwestora', { status, details });
          assert(details && details.result && String(details.result.mirrorStatus || '') === status, 'mirrorStatus nie zgadza się dla późnego etapu z Inwestora', { status, details });
          assert(String(freshProject && freshProject.status || '') === status, 'projectStore nie odzwierciedla późnego etapu z Inwestora', { status, freshProject });
          assert(details && details.result && details.result.loadedProject && details.result.loadedProject.meta && String(details.result.loadedProject.meta.projectStatus || '') === status, 'loadedProject.meta.projectStatus nie jest lustrem późnego etapu z Inwestora', { status, loadedProject: details && details.result && details.result.loadedProject });
          assert(roomA && String(roomA.projectStatus || '') === status, 'Pokój A nie dostał późnego etapu', { status, rooms:freshInvestor && freshInvestor.rooms });
          assert(roomB && String(roomB.projectStatus || '') === 'zaakceptowany', 'Pokój B nie powinien zmienić etapu przy późnym flow pokoju A', { status, rooms:freshInvestor && freshInvestor.rooms });
          assert(selectedA && String(selectedA.id || '') === 'snap_late_a', 'Późny etap z Inwestora zgubił ofertę pokoju A', { status, selectedA, all:FC.quoteSnapshotStore.listForProject(project.id) });
          assert(selectedB && String(selectedB.id || '') === 'snap_late_b', 'Późny etap z Inwestora ruszył ofertę pokoju B', { status, selectedB, all:FC.quoteSnapshotStore.listForProject(project.id) });
        });
      } finally {
        FC.quoteSnapshotStore.writeAll(prevSnapshots);
        FC.projectStore.writeAll(prevProjects);
        FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId(prevCurrentProjectId);
        FC.investors.writeAll(prevInvestors);
        FC.investors.setCurrentId(prevCurrentInvestorId);
      }
    }),


    makeTest('Inwestor', 'Aktualizacja jednego pomieszczenia nie narusza pozostałych i odświeża etykietę rejestru', 'Pilnuje, czy edycja nazwy jednego pokoju nie nadpisuje innych wpisów inwestora i czy rejestr od razu zwraca nową etykietę.', ()=>{
      assert(FC.investorPersistence && typeof FC.investorPersistence.updateInvestorRoom === 'function', 'Brak investorPersistence.updateInvestorRoom');
      assert(FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function', 'Brak roomRegistry.getRoomLabel');
      const prevInvestors = FC.investors.readAll();
      const prevCurrentInvestorId = FC.investors.getCurrentId();
      try{
        FC.investors.writeAll([]);
        const investor = FC.investors.create({
          id:'inv_room_patch',
          kind:'person',
          name:'Room patch',
          rooms:[
            { id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'nowy' },
            { id:'room_b', baseType:'pokoj', name:'Pokój B', label:'Pokój B', projectStatus:'nowy' },
          ]
        });
        FC.investors.setCurrentId(investor.id);
        const updated = FC.investorPersistence.updateInvestorRoom(investor.id, 'room_b', { name:'Spiżarnia', label:'Spiżarnia' });
        const labels = (updated.rooms || []).map((room)=> String(room && room.label || room && room.name || ''));
        assert(labels.includes('Kuchnia A') && labels.includes('Spiżarnia'), 'Aktualizacja pokoju naruszyła listę pomieszczeń inwestora', updated.rooms);
        assert(String(FC.roomRegistry.getRoomLabel('room_b') || '') === 'Spiżarnia', 'Rejestr pomieszczeń nie zwrócił zaktualizowanej etykiety', { rooms: updated.rooms, active: FC.roomRegistry.getActiveRoomDefs && FC.roomRegistry.getActiveRoomDefs() });
      } finally {
        FC.investors.writeAll(prevInvestors);
        FC.investors.setCurrentId(prevCurrentInvestorId);
      }
    }),

    makeTest('Inwestor', 'Store inwestorów odzyskuje brakujące rekordy z projectStore i snapshotów bez kasowania istniejących', 'Pilnuje pakietu ratunkowego: gdy główna lista inwestorów zgubi stare rekordy, store ma je odbudować z projektów/snapshotów i zachować już widoczne nowe wpisy.', ()=>{
      assert(FC.investors && typeof FC.investors.readAll === 'function', 'Brak investors.readAll');
      assert(FC.projectStore && typeof FC.projectStore.writeAll === 'function', 'Brak FC.projectStore.writeAll');
      assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.writeAll === 'function', 'Brak FC.quoteSnapshotStore.writeAll');
      const prevInvestors = FC.investors._debug && typeof FC.investors._debug.readStoredAll === 'function' ? FC.investors._debug.readStoredAll() : FC.investors.readAll();
      const prevProjects = FC.projectStore.readAll();
      const prevSnapshots = FC.quoteSnapshotStore.readAll();
      const removedKey = FC.investors.KEY_REMOVED || 'fc_investor_removed_ids_v1';
      const prevRemoved = (()=>{ try{ return root.localStorage.getItem(removedKey); }catch(_){ return null; } })();
      try{
        FC.investors.writeAll([{
          id:'inv_new_only',
          kind:'person',
          name:'Jan Test',
          phone:'111',
          addedDate:'2026-04-19',
          createdAt:1776635559701,
          updatedAt:1776635559701,
          rooms:[],
          meta:{ testData:false }
        }]);
        try{ root.localStorage.removeItem(removedKey); }catch(_){ }
        FC.projectStore.writeAll([{
          id:'proj_recover_missing',
          investorId:'inv_missing_old',
          title:'Stary inwestor',
          status:'pomiar',
          createdAt:1776631111000,
          updatedAt:1776631111000,
          projectData:{
            schemaVersion:2,
            meta:{
              roomDefs:{
                room_old:{ id:'room_old', baseType:'kuchnia', name:'Kuchnia stara', label:'Kuchnia stara', projectStatus:'pomiar' }
              },
              roomOrder:['room_old']
            },
            room_old:{ cabinets:[{ id:'cab_old' }], fronts:[], sets:[], settings:{} }
          },
          meta:{ source:'test-project-store' }
        }]);
        FC.quoteSnapshotStore.writeAll([{
          id:'snap_recover_missing',
          generatedAt:1776632222000,
          investor:{ id:'inv_missing_old', kind:'person', name:'Stary inwestor' },
          project:{ id:'proj_recover_missing', investorId:'inv_missing_old', title:'Projekt starego inwestora', status:'pomiar' },
          scope:{ selectedRooms:['room_old'], roomLabels:['Kuchnia stara'] },
          commercial:{ preliminary:true, versionName:'Wstępna oferta — Kuchnia stara' },
          totals:{ grand:123 },
          lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
          meta:{ source:'test-quote-snapshot', preliminary:true, versionName:'Wstępna oferta — Kuchnia stara' }
        }]);
        const recovered = FC.investors.readAll();
        const ids = recovered.map((row)=> String(row && row.id || ''));
        assert(ids.includes('inv_new_only'), 'Store zgubił istniejący nowy wpis podczas odzysku', recovered);
        assert(ids.includes('inv_missing_old'), 'Store nie odzyskał brakującego inwestora obok istniejącego wpisu', recovered);
        const restored = recovered.find((row)=> String(row && row.id || '') === 'inv_missing_old') || null;
        assert(String(restored && restored.name || '') === 'Stary inwestor', 'Odzyskany inwestor nie zaciągnął danych ze snapshotu', restored);
        assert(Array.isArray(restored && restored.rooms) && restored.rooms.some((room)=> String(room && room.id || '') === 'room_old'), 'Odzyskany inwestor nie zaciągnął pokojów z projektu/snapshotu', restored);
      } finally {
        FC.quoteSnapshotStore.writeAll(prevSnapshots);
        FC.projectStore.writeAll(prevProjects);
        FC.investors.writeAll(prevInvestors);
        try{
          if(prevRemoved == null) root.localStorage.removeItem(removedKey);
          else root.localStorage.setItem(removedKey, prevRemoved);
        }catch(_){ }
      }
    }),

    makeTest('Inwestor', 'Store inwestorów umie odbudować pustą listę z samych snapshotów ofert', 'Pilnuje awaryjnego odzysku: gdy główna lista inwestorów jest pusta, ale zostały snapshoty ofert, inwestor ma wrócić na listę zamiast znikać całkowicie.', ()=>{
      assert(FC.investors && typeof FC.investors.readAll === 'function', 'Brak investors.readAll');
      assert(FC.projectStore && typeof FC.projectStore.writeAll === 'function', 'Brak FC.projectStore.writeAll');
      assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.writeAll === 'function', 'Brak FC.quoteSnapshotStore.writeAll');
      const prevInvestors = FC.investors._debug && typeof FC.investors._debug.readStoredAll === 'function' ? FC.investors._debug.readStoredAll() : FC.investors.readAll();
      const prevProjects = FC.projectStore.readAll();
      const prevSnapshots = FC.quoteSnapshotStore.readAll();
      const removedKey = FC.investors.KEY_REMOVED || 'fc_investor_removed_ids_v1';
      const prevRemoved = (()=>{ try{ return root.localStorage.getItem(removedKey); }catch(_){ return null; } })();
      try{
        FC.investors.writeAll([]);
        FC.projectStore.writeAll([]);
        try{ root.localStorage.removeItem(removedKey); }catch(_){ }
        FC.quoteSnapshotStore.writeAll([{
          id:'snap_only_snapshot_recover',
          generatedAt:1776633333000,
          investor:{ id:'inv_snapshot_only', kind:'person', name:'Snapshot only' },
          project:{ id:'proj_snapshot_only', investorId:'inv_snapshot_only', title:'Projekt snapshot only', status:'wycena' },
          scope:{ selectedRooms:['room_snapshot_only'], roomLabels:['Salon test'] },
          commercial:{ preliminary:false, versionName:'Oferta — Salon test' },
          totals:{ grand:456 },
          lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
          meta:{ source:'test-quote-snapshot', preliminary:false, versionName:'Oferta — Salon test' }
        }]);
        const recovered = FC.investors.readAll();
        assert(Array.isArray(recovered) && recovered.length === 1, 'Store nie odbudował inwestora z pustej listy na podstawie snapshotu', recovered);
        const restored = recovered[0] || null;
        assert(String(restored && restored.id || '') === 'inv_snapshot_only', 'Store odbudował zły rekord inwestora ze snapshotu', recovered);
        assert(String(restored && restored.name || '') === 'Snapshot only', 'Store nie przepisał nazwy inwestora ze snapshotu', restored);
        assert(Array.isArray(restored && restored.rooms) && restored.rooms.some((room)=> String(room && room.label || room && room.name || '') === 'Salon test'), 'Store nie odbudował scope pokoi ze snapshotu', restored);
      } finally {
        FC.quoteSnapshotStore.writeAll(prevSnapshots);
        FC.projectStore.writeAll(prevProjects);
        FC.investors.writeAll(prevInvestors);
        try{
          if(prevRemoved == null) root.localStorage.removeItem(removedKey);
          else root.localStorage.setItem(removedKey, prevRemoved);
        }catch(_){ }
      }
    }),

    makeTest('Inwestor', 'Store inwestorów przy pustej liście preferuje testowe snapshoty recovery zamiast mieszać stare zwykłe dane', 'Pilnuje izolacji testów: jeśli w storage leżą jednocześnie zwykłe snapshoty użytkownika i jawny snapshot testowy recovery, pusty store inwestorów ma odbudować tylko rekord testowy zamiast mieszać stare dane użytkownika do wyniku.', ()=>{
      assert(FC.investors && typeof FC.investors.readAll === 'function', 'Brak investors.readAll');
      assert(FC.projectStore && typeof FC.projectStore.writeAll === 'function', 'Brak FC.projectStore.writeAll');
      assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.writeAll === 'function', 'Brak FC.quoteSnapshotStore.writeAll');
      const prevInvestors = FC.investors._debug && typeof FC.investors._debug.readStoredAll === 'function' ? FC.investors._debug.readStoredAll() : FC.investors.readAll();
      const prevProjects = FC.projectStore.readAll();
      const prevSnapshots = FC.quoteSnapshotStore.readAll();
      const removedKey = FC.investors.KEY_REMOVED || 'fc_investor_removed_ids_v1';
      const prevRemoved = (()=>{ try{ return root.localStorage.getItem(removedKey); }catch(_){ return null; } })();
      try{
        FC.investors.writeAll([]);
        FC.projectStore.writeAll([]);
        try{ root.localStorage.removeItem(removedKey); }catch(_){ }
        FC.quoteSnapshotStore.writeAll([
          {
            id:'snap_regular_snapshot_user',
            generatedAt:100,
            investor:{ id:'inv_regular_snapshot_user', kind:'person', name:'Late flow' },
            project:{ id:'proj_regular_snapshot_user', investorId:'inv_regular_snapshot_user', title:'Late flow', status:'wycena' },
            scope:{ selectedRooms:['room_a'], roomLabels:['Kuchnia A'] },
            commercial:{ preliminary:true, versionName:'Wstępna oferta — Kuchnia A' },
            totals:{ grand:1 },
            lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            meta:{ source:'quote-snapshot-store', preliminary:true, versionName:'Wstępna oferta — Kuchnia A' }
          },
          {
            id:'snap_only_snapshot_recover_test',
            generatedAt:1776633333000,
            investor:{ id:'inv_snapshot_only_test', kind:'person', name:'Snapshot only test' },
            project:{ id:'proj_snapshot_only_test', investorId:'inv_snapshot_only_test', title:'Projekt snapshot only test', status:'wycena' },
            scope:{ selectedRooms:['room_snapshot_only'], roomLabels:['Salon test'] },
            commercial:{ preliminary:false, versionName:'Oferta — Salon test' },
            totals:{ grand:456 },
            lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            meta:{ source:'test-quote-snapshot', preliminary:false, versionName:'Oferta — Salon test' }
          }
        ]);
        const recovered = FC.investors.readAll();
        assert(Array.isArray(recovered) && recovered.length === 1, 'Store zmieszał zwykłe snapshoty użytkownika z testowym recovery przy pustej liście', recovered);
        const restored = recovered[0] || null;
        assert(String(restored && restored.id || '') === 'inv_snapshot_only_test', 'Store nie preferował testowego snapshotu recovery przy pustej liście', recovered);
      } finally {
        FC.quoteSnapshotStore.writeAll(prevSnapshots);
        FC.projectStore.writeAll(prevProjects);
        FC.investors.writeAll(prevInvestors);
        try{
          if(prevRemoved == null) root.localStorage.removeItem(removedKey);
          else root.localStorage.setItem(removedKey, prevRemoved);
        }catch(_){ }
      }
    }),


    makeTest('Inwestor', 'Zapis jawnego snapshotu testowego nie odbudowuje inwestorów z dawnych migawek podczas writeAll', 'Pilnuje bocznej regresji: quoteSnapshotStore.writeAll z kompletnymi roomLabels nie może podczas normalizacji odpalić roomRegistry/investors i przywrócić starych inwestorów jeszcze przed właściwym odczytem recovery.', ()=>{
      assert(FC.investors && FC.investors._debug && typeof FC.investors._debug.readStoredAll === 'function', 'Brak investors._debug.readStoredAll');
      assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.writeAll === 'function', 'Brak FC.quoteSnapshotStore.writeAll');
      const prevInvestors = FC.investors._debug.readStoredAll();
      const prevProjects = FC.projectStore.readAll();
      const prevSnapshotsRaw = (()=>{ try{ return root.localStorage.getItem(FC.quoteSnapshotStore.SNAPSHOT_KEY || 'fc_quote_snapshots_v1'); }catch(_){ return null; } })();
      const removedKey = FC.investors.KEY_REMOVED || 'fc_investor_removed_ids_v1';
      const prevRemoved = (()=>{ try{ return root.localStorage.getItem(removedKey); }catch(_){ return null; } })();
      try{
        FC.investors.writeAll([]);
        FC.projectStore.writeAll([]);
        try{ root.localStorage.removeItem(removedKey); }catch(_){ }
        try{
          root.localStorage.setItem(FC.quoteSnapshotStore.SNAPSHOT_KEY || 'fc_quote_snapshots_v1', JSON.stringify([{
            id:'snap_old_user_only',
            generatedAt:100,
            investor:{ id:'inv_old_user_only', kind:'person', name:'Late flow' },
            project:{ id:'proj_old_user_only', investorId:'inv_old_user_only', title:'Late flow', status:'wycena' },
            scope:{ selectedRooms:['room_a'], roomLabels:['Kuchnia A'] },
            commercial:{ preliminary:true, versionName:'Wstępna oferta — Kuchnia A' },
            totals:{ grand:1 },
            lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            meta:{ source:'quote-snapshot-store', preliminary:true, versionName:'Wstępna oferta — Kuchnia A' }
          }]));
        }catch(_){ }
        FC.quoteSnapshotStore.writeAll([{
          id:'snap_write_test_only',
          generatedAt:1776633333000,
          investor:{ id:'inv_write_test_only', kind:'person', name:'Snapshot only test' },
          project:{ id:'proj_write_test_only', investorId:'inv_write_test_only', title:'Projekt snapshot only test', status:'wycena' },
          scope:{ selectedRooms:['room_snapshot_only'], roomLabels:['Salon test'] },
          commercial:{ preliminary:false, versionName:'Oferta — Salon test' },
          totals:{ grand:456 },
          lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
          meta:{ source:'test-quote-snapshot', preliminary:false, versionName:'Oferta — Salon test' }
        }]);
        const storedInvestors = FC.investors._debug.readStoredAll();
        assert(Array.isArray(storedInvestors) && storedInvestors.length === 0, 'quoteSnapshotStore.writeAll odbudował inwestorów bocznie jeszcze przed readAll', storedInvestors);
      } finally {
        FC.projectStore.writeAll(prevProjects);
        FC.investors.writeAll(prevInvestors);
        try{
          if(prevSnapshotsRaw == null) root.localStorage.removeItem(FC.quoteSnapshotStore.SNAPSHOT_KEY || 'fc_quote_snapshots_v1');
          else root.localStorage.setItem(FC.quoteSnapshotStore.SNAPSHOT_KEY || 'fc_quote_snapshots_v1', prevSnapshotsRaw);
        }catch(_){ }
        try{
          if(prevRemoved == null) root.localStorage.removeItem(removedKey);
          else root.localStorage.setItem(removedKey, prevRemoved);
        }catch(_){ }
      }
    }),

    makeTest('Inwestor', 'Domyślne obrównanie rozrysu startuje od 1 cm / 10 mm', 'Pilnuje, czy wszystkie fallbacki opcji rozkroju wróciły do uzgodnionego domyślnego obrównania 1 cm zamiast starego 2 cm.', ()=>{
      assert(FC.rozrysStock && typeof FC.rozrysStock.getDefaultRozrysOptionValues === 'function', 'Brak getDefaultRozrysOptionValues');
      const cm = FC.rozrysStock.getDefaultRozrysOptionValues('cm');
      const mm = FC.rozrysStock.getDefaultRozrysOptionValues('mm');
      assert(Number(cm && cm.trim) === 1, 'Domyślne obrównanie dla cm nie wynosi 1', cm);
      assert(Number(mm && mm.trim) === 10, 'Domyślne obrównanie dla mm nie wynosi 10', mm);
      assert(FC.rozrysState && typeof FC.rozrysState.buildBaseStateFromControls === 'function', 'Brak rozrysState.buildBaseStateFromControls');
      const built = FC.rozrysState.buildBaseStateFromControls({ unitSel:{ value:'cm' }, edgeSel:{ value:'0' }, inW:{ value:'' }, inH:{ value:'' }, inK:{ value:'' }, inTrim:{ value:'' }, inMinW:{ value:'' }, inMinH:{ value:'' }, heurSel:{ value:'max' }, dirSel:{ value:'start-optimax' } });
      assert(Number(built.edgeTrim) === 1, 'Fallback edgeTrim z buildBaseStateFromControls nie wynosi 1 cm', built);
    }),
  ];

  FC.investorDevTests = { runAll: ()=> runSuite('INWESTOR smoke testy', tests) };
})(typeof window !== 'undefined' ? window : globalThis);
