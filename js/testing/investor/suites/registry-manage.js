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
        const investor = seedInvestor({
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
        const investor = seedInvestor({
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
        const investor = seedInvestor({ id:'inv_registry_contract', kind:'person', name:'Registry Contract', rooms:[{ id:'room_base', baseType:'kuchnia', name:'Kuchnia baza', label:'Kuchnia baza', projectStatus:'nowy' }] });
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

  ];

  FC.investorDevTestSuites = FC.investorDevTestSuites || [];
  FC.investorDevTestSuites.push({ key:'registry-manage', tests });
})(typeof window !== 'undefined' ? window : globalThis);
