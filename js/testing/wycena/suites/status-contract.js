(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  if(!(FC.testHarness && typeof FC.registerWycenaTests === 'function')) return;

  function makeProjectData(statusA, statusB){
    return {
      schemaVersion:2,
      meta:{
        projectStatus:'nowy',
        roomDefs:{
          room_a:{ id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:statusA || 'nowy' },
          room_b:{ id:'room_b', baseType:'pokoj', name:'Salon B', label:'Salon B', projectStatus:statusB || 'nowy' },
        },
        roomOrder:['room_a','room_b'],
      },
      room_a:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} },
      room_b:{ cabinets:[{ id:'cab_b' }], fronts:[], sets:[], settings:{} },
    };
  }

  function makeRooms(statusA, statusB){
    return [
      { id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:statusA || 'nowy' },
      { id:'room_b', baseType:'pokoj', name:'Salon B', label:'Salon B', projectStatus:statusB || 'nowy' },
    ];
  }

  function saveScopedSnapshot(args){
    const cfg = args && typeof args === 'object' ? args : {};
    const roomIds = Array.isArray(cfg.roomIds) ? cfg.roomIds.slice() : [cfg.roomId].filter(Boolean);
    const roomLabels = Array.isArray(cfg.roomLabels) ? cfg.roomLabels.slice() : [cfg.roomLabel || roomIds[0] || 'Pomieszczenie'];
    const preliminary = cfg.preliminary !== false;
    return FC.quoteSnapshotStore.save({
      id:String(cfg.id || `snap_${roomIds.join('_')}_${preliminary ? 'pre' : 'final'}`),
      investor:{ id:cfg.investorId, name:'Jan Test' },
      project:{ id:cfg.projectId, investorId:cfg.investorId, title:'Projekt kontraktu statusów', status:String(cfg.status || (preliminary ? 'wstepna_wycena' : 'wycena')) },
      scope:{ selectedRooms:roomIds, roomLabels },
      commercial:{ preliminary, versionName:String(cfg.versionName || (preliminary ? 'Wstępna oferta' : 'Oferta')) },
      meta:Object.assign({ preliminary }, cfg.meta || {}),
      totals:{ grand:Number(cfg.grand || 0) },
      lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
      generatedAt:Number(cfg.generatedAt || Date.now()),
    });
  }

  function byRoomId(investor){
    return Object.fromEntries((investor && Array.isArray(investor.rooms) ? investor.rooms : []).map((room)=> [String(room && room.id || ''), room]));
  }

  FC.registerWycenaTests(({ FC, H, withInvestorProjectFixture })=> [
    H.makeTest('Wycena ↔ Kontrakt statusów', 'Akceptacja wstępnej oferty solo zapisuje master/mirror tylko dla exact-scope', 'Pilnuje kontraktu: status lustrzany projektu ma iść za akceptowanym exact-scope, ale rozłączny zaakceptowany pokój i jego oferta nie mogą zostać ruszone.', ()=> withInvestorProjectFixture({
      investorId:'inv_status_contract_prelim',
      projectId:'proj_status_contract_prelim',
      rooms:makeRooms('nowy', 'zaakceptowany'),
      status:'nowy',
      projectData:makeProjectData('nowy', 'zaakceptowany'),
    }, ({ investorId, projectId })=> {
      H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.commitAcceptedSnapshot === 'function', 'Brak FC.projectStatusSync.commitAcceptedSnapshot');
      const prelimA = saveScopedSnapshot({ id:'snap_contract_prelim_a', investorId, projectId, roomId:'room_a', roomLabel:'Kuchnia A', preliminary:true, generatedAt:1713100000000 });
      const finalB = saveScopedSnapshot({ id:'snap_contract_final_b', investorId, projectId, roomId:'room_b', roomLabel:'Salon B', preliminary:false, generatedAt:1713100010000 });

      FC.projectStatusSync.commitAcceptedSnapshot(finalB, 'zaakceptowany', { roomIds:['room_b'], refreshUi:false });
      const result = FC.projectStatusSync.commitAcceptedSnapshot(prelimA, 'pomiar', { roomIds:['room_a'], refreshUi:false });
      const investor = FC.investors.getById(investorId);
      const rooms = byRoomId(investor);
      const project = FC.projectStore.getById(projectId);
      const selectedA = FC.quoteSnapshotStore.getSelectedForProject(projectId, { roomIds:['room_a'] });
      const selectedB = FC.quoteSnapshotStore.getSelectedForProject(projectId, { roomIds:['room_b'] });
      const finalBAfter = FC.quoteSnapshotStore.getById(finalB.id);

      H.assert(result && String(result.masterStatus || '') === 'pomiar', 'masterStatus nie jest wynikiem exact-scope pokoju A', result);
      H.assert(result && String(result.mirrorStatus || '') === 'pomiar', 'mirrorStatus nie jest lustrem masterStatus dla pokoju A', result);
      H.assert(result && result.statusResult && result.statusResult.loadedProject && result.statusResult.loadedProject.meta && String(result.statusResult.loadedProject.meta.projectStatus || '') === 'pomiar', 'loadedProject.meta.projectStatus nie jest lustrem masterStatus po akceptacji exact-scope', result);
      H.assert(project && String(project.status || '') === 'pomiar', 'projectStore.status nie został zsynchronizowany z masterStatus exact-scope', project);
      H.assert(rooms.room_a && String(rooms.room_a.projectStatus || '') === 'pomiar', 'Pokój A nie dostał statusu pomiar', investor && investor.rooms);
      H.assert(rooms.room_b && String(rooms.room_b.projectStatus || '') === 'zaakceptowany', 'Rozłączny pokój B stracił status zaakceptowany', investor && investor.rooms);
      H.assert(selectedA && String(selectedA.id || '') === String(prelimA.id || ''), 'Pokój A nie ma zaakceptowanej własnej wstępnej oferty', { selectedA, all:FC.quoteSnapshotStore.listForProject(projectId) });
      H.assert(selectedB && String(selectedB.id || '') === String(finalB.id || ''), 'Rozłączny pokój B stracił własną zaakceptowaną ofertę', { selectedB, all:FC.quoteSnapshotStore.listForProject(projectId) });
      H.assert(finalBAfter && finalBAfter.meta && finalBAfter.meta.selectedByClient === true && Number(finalBAfter.meta.rejectedAt || 0) === 0, 'Oferta pokoju B została odrzucona lub odpięta przez akceptację pokoju A', finalBAfter);
    })),

    H.makeTest('Wycena ↔ Kontrakt statusów', 'Ręczne cofnięcie solo pokoju czyści tylko jego zaakceptowaną ofertę', 'Pilnuje kontraktu: cofnięcie statusu jednego pokoju usuwa selection/reject tylko z jego exact-scope i nie dotyka zaakceptowanej oferty drugiego pokoju.', ()=> withInvestorProjectFixture({
      investorId:'inv_status_contract_downgrade',
      projectId:'proj_status_contract_downgrade',
      rooms:makeRooms('zaakceptowany', 'zaakceptowany'),
      status:'zaakceptowany',
      projectData:makeProjectData('zaakceptowany', 'zaakceptowany'),
    }, ({ investorId, projectId })=> {
      H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.commitAcceptedSnapshot === 'function', 'Brak FC.projectStatusSync.commitAcceptedSnapshot');
      H.assert(FC.investorPersistence && typeof FC.investorPersistence.setInvestorProjectStatus === 'function', 'Brak FC.investorPersistence.setInvestorProjectStatus');
      const prelimA = saveScopedSnapshot({ id:'snap_contract_downgrade_prelim_a', investorId, projectId, roomId:'room_a', roomLabel:'Kuchnia A', preliminary:true, generatedAt:1713100100000 });
      const finalA = saveScopedSnapshot({ id:'snap_contract_downgrade_final_a', investorId, projectId, roomId:'room_a', roomLabel:'Kuchnia A', preliminary:false, generatedAt:1713100110000 });
      const finalB = saveScopedSnapshot({ id:'snap_contract_downgrade_final_b', investorId, projectId, roomId:'room_b', roomLabel:'Salon B', preliminary:false, generatedAt:1713100120000 });

      FC.projectStatusSync.commitAcceptedSnapshot(finalA, 'zaakceptowany', { roomIds:['room_a'], refreshUi:false });
      FC.projectStatusSync.commitAcceptedSnapshot(finalB, 'zaakceptowany', { roomIds:['room_b'], refreshUi:false });
      const details = FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_a', 'wstepna_wycena', { skipGuard:true, returnDetails:true });
      const investor = FC.investors.getById(investorId);
      const rooms = byRoomId(investor);
      const finalAAfter = FC.quoteSnapshotStore.getById(finalA.id);
      const prelimAAfter = FC.quoteSnapshotStore.getById(prelimA.id);
      const finalBAfter = FC.quoteSnapshotStore.getById(finalB.id);
      const selectedA = FC.quoteSnapshotStore.getSelectedForProject(projectId, { roomIds:['room_a'] });
      const selectedB = FC.quoteSnapshotStore.getSelectedForProject(projectId, { roomIds:['room_b'] });

      H.assert(details && details.applied === true && details.result && String(details.result.masterStatus || '') === 'wstepna_wycena', 'Ręczne cofnięcie pokoju A nie przeszło przez centralny kontrakt statusu', details);
      H.assert(rooms.room_a && String(rooms.room_a.projectStatus || '') === 'wstepna_wycena', 'Pokój A nie wrócił do wstępnej wyceny', investor && investor.rooms);
      H.assert(rooms.room_b && String(rooms.room_b.projectStatus || '') === 'zaakceptowany', 'Rozłączny pokój B został zmieniony przy cofnięciu pokoju A', investor && investor.rooms);
      H.assert(selectedA == null, 'Po cofnięciu pokoju A nie powinno zostać selectedByClient dla jego exact-scope', { selectedA, all:FC.quoteSnapshotStore.listForProject(projectId) });
      H.assert(finalAAfter && finalAAfter.meta && finalAAfter.meta.selectedByClient === false && Number(finalAAfter.meta.rejectedAt || 0) > 0, 'Końcowa oferta pokoju A nie została odpięta/odrzucona po cofnięciu statusu', finalAAfter);
      H.assert(prelimAAfter && FC.quoteSnapshotStore.isRejectedSnapshot(prelimAAfter) === false, 'Aktywna wstępna historia pokoju A została błędnie odrzucona', prelimAAfter);
      H.assert(selectedB && String(selectedB.id || '') === String(finalB.id || ''), 'Rozłączny pokój B zgubił zaakceptowaną ofertę', { selectedB, all:FC.quoteSnapshotStore.listForProject(projectId) });
      H.assert(finalBAfter && finalBAfter.meta && finalBAfter.meta.selectedByClient === true && Number(finalBAfter.meta.rejectedAt || 0) === 0, 'Oferta pokoju B została naruszona przy cofnięciu pokoju A', finalBAfter);
    })),

    H.makeTest('Wycena ↔ Kontrakt statusów', 'Usunięcie zaakceptowanej końcowej oferty solo przywraca własną historię bez agregacji obcych pokoi', 'Pilnuje kontraktu: po usunięciu oferty końcowej jednego pokoju rekonsyliacja bierze exact-scope tego pokoju, a mirror/loadedProject nie podbijają się statusem drugiego pokoju.', ()=> withInvestorProjectFixture({
      investorId:'inv_status_contract_remove',
      projectId:'proj_status_contract_remove',
      rooms:makeRooms('zaakceptowany', 'zaakceptowany'),
      status:'zaakceptowany',
      projectData:makeProjectData('zaakceptowany', 'zaakceptowany'),
    }, ({ investorId, projectId })=> {
      H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval === 'function', 'Brak FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval');
      const prelimA = saveScopedSnapshot({ id:'snap_contract_remove_prelim_a', investorId, projectId, roomId:'room_a', roomLabel:'Kuchnia A', preliminary:true, generatedAt:1713100200000 });
      const finalA = saveScopedSnapshot({ id:'snap_contract_remove_final_a', investorId, projectId, roomId:'room_a', roomLabel:'Kuchnia A', preliminary:false, generatedAt:1713100210000 });
      const finalB = saveScopedSnapshot({ id:'snap_contract_remove_final_b', investorId, projectId, roomId:'room_b', roomLabel:'Salon B', preliminary:false, generatedAt:1713100220000 });

      FC.projectStatusSync.commitAcceptedSnapshot(finalA, 'zaakceptowany', { roomIds:['room_a'], refreshUi:false });
      FC.projectStatusSync.commitAcceptedSnapshot(finalB, 'zaakceptowany', { roomIds:['room_b'], refreshUi:false });
      H.assert(FC.quoteSnapshotStore.remove(finalA.id) === true, 'Nie udało się usunąć końcowej oferty pokoju A', { finalA, all:FC.quoteSnapshotStore.listForProject(projectId) });
      const result = FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval(finalA, { roomIds:['room_a'], fallbackStatus:'nowy', refreshUi:false });
      const investor = FC.investors.getById(investorId);
      const rooms = byRoomId(investor);
      const project = FC.projectStore.getById(projectId);
      const selectedA = FC.quoteSnapshotStore.getSelectedForProject(projectId, { roomIds:['room_a'] });
      const selectedB = FC.quoteSnapshotStore.getSelectedForProject(projectId, { roomIds:['room_b'] });
      const prelimAAfter = FC.quoteSnapshotStore.getById(prelimA.id);

      H.assert(result && String(result.masterStatus || '') === 'wstepna_wycena', 'Rekonsyliacja po usunięciu oferty A nie wróciła do historii exact-scope A', result);
      H.assert(result && String(result.mirrorStatus || '') === 'wstepna_wycena', 'mirrorStatus po usunięciu oferty A podbił się obcym statusem zamiast exact-scope A', result);
      H.assert(result && result.loadedProject && result.loadedProject.meta && String(result.loadedProject.meta.projectStatus || '') === 'wstepna_wycena', 'loadedProject.meta.projectStatus po usunięciu nie jest lustrem exact-scope A', result && result.loadedProject);
      H.assert(project && String(project.status || '') === 'wstepna_wycena', 'projectStore.status po usunięciu nie jest lustrem exact-scope A', project);
      H.assert(rooms.room_a && String(rooms.room_a.projectStatus || '') === 'wstepna_wycena', 'Pokój A nie wrócił do własnej wstępnej historii', investor && investor.rooms);
      H.assert(rooms.room_b && String(rooms.room_b.projectStatus || '') === 'zaakceptowany', 'Rozłączny pokój B został zmieniony przy usunięciu oferty A', investor && investor.rooms);
      H.assert(selectedA == null, 'Pokój A nie powinien mieć selected po usunięciu końcowej oferty', { selectedA, all:FC.quoteSnapshotStore.listForProject(projectId) });
      H.assert(selectedB && String(selectedB.id || '') === String(finalB.id || ''), 'Rozłączny pokój B zgubił zaakceptowaną ofertę po usunięciu oferty A', { selectedB, all:FC.quoteSnapshotStore.listForProject(projectId) });
      H.assert(prelimAAfter && FC.quoteSnapshotStore.isRejectedSnapshot(prelimAAfter) === false, 'Aktywna wstępna historia pokoju A została błędnie odrzucona po usunięciu finalnej', prelimAAfter);
    })),
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
