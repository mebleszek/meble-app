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
        const investor = seedInvestor({
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
        const investor = seedInvestor({
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
        const investor = seedInvestor({
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

  ];

  FC.investorDevTestSuites = FC.investorDevTestSuites || [];
  FC.investorDevTestSuites.push({ key:'status-flow', tests });
})(typeof window !== 'undefined' ? window : globalThis);
