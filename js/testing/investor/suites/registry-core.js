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


    makeTest('Inwestor', 'Mutacje registry odświeżają cache aktywnych pomieszczeń bez ręcznego resetu widoku', 'Pilnuje nowego twardego odświeżania cache: po dodaniu pokoju przez project-sync lista aktywnych pomieszczeń ma się odświeżyć od razu, bez ręcznego czyszczenia cache.', ()=>{
      assert(FC.roomRegistryProjectSync && typeof FC.roomRegistryProjectSync.createRoomRecord === 'function', 'Brak FC.roomRegistryProjectSync.createRoomRecord');
      assert(FC.roomRegistryDefinitions && typeof FC.roomRegistryDefinitions.getActiveRoomDefs === 'function', 'Brak FC.roomRegistryDefinitions.getActiveRoomDefs');
      const prevProject = Object.prototype.hasOwnProperty.call(root, 'projectData') ? root.projectData : undefined;
      const prevWindowProject = root.window && Object.prototype.hasOwnProperty.call(root.window, 'projectData') ? root.window.projectData : undefined;
      const prevCurrentId = FC.investors && FC.investors.getCurrentId ? FC.investors.getCurrentId() : '';
      const prevGetById = FC.investors && FC.investors.getById;
      const prevUpdate = FC.investors && FC.investors.update;
      const investor = {
        id:'inv_cache_refresh',
        rooms:[
          { id:'room_start', baseType:'kuchnia', name:'Kuchnia start', label:'Kuchnia start', projectStatus:'nowy' }
        ]
      };
      const project = {
        schemaVersion:9,
        meta:{ roomDefs:{ room_start:{ id:'room_start', baseType:'kuchnia', name:'Kuchnia start', label:'Kuchnia start' } }, roomOrder:['room_start'] },
        room_start:{ cabinets:[], fronts:[], sets:[], settings:{} },
      };
      try{
        root.projectData = project;
        if(root.window) root.window.projectData = project;
        if(FC.investors && FC.investors.setCurrentId) FC.investors.setCurrentId(investor.id);
        if(FC.investors){
          FC.investors.getById = (id)=> String(id || '') === investor.id ? investor : null;
          FC.investors.update = (_id, patch)=> { investor.rooms = Array.isArray(patch && patch.rooms) ? patch.rooms : investor.rooms; return investor; };
        }
        const before = FC.roomRegistryDefinitions.getActiveRoomDefs().map((room)=> String(room && room.id || ''));
        assert(before.length === 1 && before[0] === 'room_start', 'Stan początkowy cache aktywnych pokoi jest zły', before);
        const created = FC.roomRegistryProjectSync.createRoomRecord(investor, { baseType:'pokoj', name:'Gabinet' });
        assert(created && created.ok === true, 'createRoomRecord nie utworzył nowego pokoju', created);
        const after = FC.roomRegistryDefinitions.getActiveRoomDefs().map((room)=> String(room && room.id || ''));
        assert(after.length === 2 && after.some((id)=> id === 'room_start') && after.some((id)=> id === created.room.id), 'Cache aktywnych pokoi nie odświeżył się po createRoomRecord', { before, after, created });
      } finally {
        if(prevProject === undefined){ try{ delete root.projectData; }catch(_){ root.projectData = undefined; } }
        else root.projectData = prevProject;
        if(root.window){
          if(prevWindowProject === undefined){ try{ delete root.window.projectData; }catch(_){ root.window.projectData = undefined; } }
          else root.window.projectData = prevWindowProject;
        }
        if(FC.investors && FC.investors.setCurrentId) FC.investors.setCurrentId(prevCurrentId || null);
        if(FC.investors) FC.investors.getById = prevGetById;
        if(FC.investors) FC.investors.update = prevUpdate;
        try{ FC.roomRegistryDefinitions && FC.roomRegistryDefinitions.invalidateCache && FC.roomRegistryDefinitions.invalidateCache(); }catch(_){ }
      }
    }),

  ];

  FC.investorDevTestSuites = FC.investorDevTestSuites || [];
  FC.investorDevTestSuites.push({ key:'registry-core', tests });
})(typeof window !== 'undefined' ? window : globalThis);
