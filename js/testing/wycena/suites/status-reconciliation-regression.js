(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  if(!(FC.testHarness && typeof FC.registerWycenaTests === 'function')) return;

  const ROOMS_ASP = [
    { id:'room_a', baseType:'kuchnia', name:'A', label:'A', projectStatus:'nowy' },
    { id:'room_s', baseType:'pokoj', name:'S', label:'S', projectStatus:'nowy' },
    { id:'room_p', baseType:'pokoj', name:'P', label:'P', projectStatus:'nowy' },
  ];

  function projectDataForRooms(rooms){
    const roomDefs = {};
    const data = {
      schemaVersion:2,
      meta:{ roomDefs, roomOrder:rooms.map((room)=> room.id) },
    };
    rooms.forEach((room)=> {
      roomDefs[room.id] = { id:room.id, baseType:room.baseType, name:room.name, label:room.label };
      data[room.id] = { cabinets:[{ id:'cab_' + room.id }], fronts:[], sets:[], settings:{} };
    });
    return data;
  }

  function statusMap(investorId){
    const investor = FC.investors && typeof FC.investors.getById === 'function' ? FC.investors.getById(investorId) : null;
    const out = {};
    const rooms = investor && Array.isArray(investor.rooms) ? investor.rooms : [];
    rooms.forEach((room)=> { out[String(room.id || '')] = String(room.projectStatus || room.status || ''); });
    return out;
  }

  function savePreliminarySnapshot(projectId, investorId, id, roomIds, versionName){
    return FC.quoteSnapshotStore.save({
      id,
      investor:{ id:investorId },
      project:{ id:projectId, investorId, title:'Projekt statusów' },
      scope:{ selectedRooms:roomIds.slice(), roomLabels:roomIds.map((roomId)=> roomId.replace('room_', '').toUpperCase()) },
      commercial:{ preliminary:true, versionName },
      meta:{ preliminary:true, versionName },
      totals:{ grand:100 + roomIds.length },
      lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
      generatedAt:1712820600000 + String(id || '').length,
    });
  }

  function saveFinalSnapshot(projectId, investorId, id, roomIds, versionName){
    return FC.quoteSnapshotStore.save({
      id,
      investor:{ id:investorId },
      project:{ id:projectId, investorId, title:'Projekt statusów' },
      scope:{ selectedRooms:roomIds.slice(), roomLabels:roomIds.map((roomId)=> roomId.replace('room_', '').toUpperCase()) },
      commercial:{ preliminary:false, versionName },
      meta:{ preliminary:false, versionName },
      totals:{ grand:200 + roomIds.length },
      lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
      generatedAt:1712820610000 + String(id || '').length,
    });
  }

  FC.registerWycenaTests(({ FC, H, withInvestorProjectFixture })=> [
    H.makeTest('Wycena ↔ Statusy zakresowe', 'Akceptacja wstępnej solo nie resetuje ręcznych statusów Pomiar poza zakresem', 'Przypadek 1: A ma zaakceptowaną wycenę wstępną, a S/P były ręcznie na Pomiar bez wstępnej. Akcja na ofercie A nie może cofnąć S/P do Nowy.', ()=>{
      withInvestorProjectFixture({ investorId:'inv_status_scope_1', projectId:'proj_status_scope_1', rooms:ROOMS_ASP, projectData:projectDataForRooms(ROOMS_ASP) }, ({ investorId, projectId })=>{
        FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_s', 'pomiar');
        FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_p', 'pomiar');
        const prelimA = savePreliminarySnapshot(projectId, investorId, 'snap_status_scope_1_a', ['room_a'], 'Wstępna A');
        FC.projectStatusSync.commitAcceptedSnapshot(prelimA, 'pomiar', { roomIds:['room_a'], refreshUi:false });
        const statuses = statusMap(investorId);
        H.assert(statuses.room_a === 'pomiar', 'A po akceptacji wstępnej powinno mieć Pomiar', statuses);
        H.assert(statuses.room_s === 'pomiar' && statuses.room_p === 'pomiar', 'S/P ręcznie ustawione na Pomiar nie mogą wrócić na Nowy po akceptacji A', statuses);
      });
    }),

    H.makeTest('Wycena ↔ Statusy zakresowe', 'Akceptacja wstępnej solo nie resetuje ręcznych statusów Wycena poza zakresem', 'Przypadek 2: S/P mogą już czekać na wycenę końcową bez wstępnej. Akceptacja wstępnej A nie może cofnąć ich do Nowy.', ()=>{
      withInvestorProjectFixture({ investorId:'inv_status_scope_2', projectId:'proj_status_scope_2', rooms:ROOMS_ASP, projectData:projectDataForRooms(ROOMS_ASP) }, ({ investorId, projectId })=>{
        FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_s', 'wycena');
        FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_p', 'wycena');
        const prelimA = savePreliminarySnapshot(projectId, investorId, 'snap_status_scope_2_a', ['room_a'], 'Wstępna A');
        FC.projectStatusSync.commitAcceptedSnapshot(prelimA, 'pomiar', { roomIds:['room_a'], refreshUi:false });
        const statuses = statusMap(investorId);
        H.assert(statuses.room_a === 'pomiar', 'A po akceptacji wstępnej powinno mieć Pomiar', statuses);
        H.assert(statuses.room_s === 'wycena' && statuses.room_p === 'wycena', 'S/P ręcznie ustawione na Wycena nie mogą wrócić na Nowy po akceptacji A', statuses);
      });
    }),

    H.makeTest('Wycena ↔ Statusy zakresowe', 'Akceptacja wspólnej wstępnej zmienia tylko jej zakres i zachowuje obce ręczne statusy', 'Przypadki 3–4: oferta A+S ustawia A/S na Pomiar, ale P spoza oferty zachowuje ręczny Pomiar/Wycena.', ()=>{
      withInvestorProjectFixture({ investorId:'inv_status_scope_4', projectId:'proj_status_scope_4', rooms:ROOMS_ASP, projectData:projectDataForRooms(ROOMS_ASP) }, ({ investorId, projectId })=>{
        FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_p', 'wycena');
        const sharedAS = savePreliminarySnapshot(projectId, investorId, 'snap_status_scope_4_as', ['room_a','room_s'], 'Wstępna A+S');
        FC.projectStatusSync.commitAcceptedSnapshot(sharedAS, 'pomiar', { roomIds:['room_a','room_s'], refreshUi:false });
        const statuses = statusMap(investorId);
        H.assert(statuses.room_a === 'pomiar' && statuses.room_s === 'pomiar', 'A/S z zaakceptowanej wspólnej wstępnej powinny przejść na Pomiar', statuses);
        H.assert(statuses.room_p === 'wycena', 'P spoza zakresu oferty A+S nie może zostać cofnięte z ręcznej Wyceny do Nowy', statuses);
      });
    }),

    H.makeTest('Wycena ↔ Statusy zakresowe', 'Wstępna A+S zastępująca zaakceptowaną końcową A cofa tylko źródłowe Zaakceptowany do Pomiar', 'Regresja ze screena: wcześniejsza końcowa oferta A może zostać odrzucona przez nową wstępną A+S, ale A nie może zostać wizualnie na Zaakceptowany. P spoza zakresu zachowuje ręczne Wycena.', ()=>{
      withInvestorProjectFixture({ investorId:'inv_status_scope_4b', projectId:'proj_status_scope_4b', rooms:ROOMS_ASP, projectData:projectDataForRooms(ROOMS_ASP) }, ({ investorId, projectId })=>{
        FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_p', 'wycena');
        const finalA = saveFinalSnapshot(projectId, investorId, 'snap_status_scope_4b_final_a', ['room_a'], 'Oferta A');
        FC.projectStatusSync.commitAcceptedSnapshot(finalA, 'zaakceptowany', { roomIds:['room_a'], refreshUi:false });
        let statuses = statusMap(investorId);
        H.assert(statuses.room_a === 'zaakceptowany', 'Setup nie ustawił A na Zaakceptowany po końcowej ofercie A', statuses);

        const sharedPrelimAS = savePreliminarySnapshot(projectId, investorId, 'snap_status_scope_4b_pre_as', ['room_a','room_s'], 'Wstępna A+S');
        const result = FC.projectStatusSync.commitAcceptedSnapshot(sharedPrelimAS, 'pomiar', { roomIds:['room_a','room_s'], refreshUi:false });
        statuses = statusMap(investorId);
        H.assert(statuses.room_a === 'pomiar', 'A nie może zostać na Zaakceptowany po zastąpieniu końcowej A przez wstępną A+S', { statuses, result });
        H.assert(statuses.room_s === 'pomiar', 'S z zakresu zaakceptowanej wstępnej A+S powinno przejść na Pomiar', { statuses, result });
        H.assert(statuses.room_p === 'wycena', 'P spoza zakresu A+S powinno zachować ręczne Wycena', { statuses, result });
      });
    }),

    H.makeTest('Wycena ↔ Statusy zakresowe', 'Wstępna A+S nie cofa ręcznego Wycena pokoju z zakresu bez poprzedniej zaakceptowanej końcowej', 'Doprecyzowanie przypadku 10: jeżeli S było ręcznie na Wycena i nie wynikało z odrzuconej końcowej oferty, akceptacja wstępnej A+S nie powinna cofać S do Pomiar.', ()=>{
      withInvestorProjectFixture({ investorId:'inv_status_scope_4c', projectId:'proj_status_scope_4c', rooms:ROOMS_ASP, projectData:projectDataForRooms(ROOMS_ASP) }, ({ investorId, projectId })=>{
        FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_s', 'wycena');
        FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_p', 'wycena');
        const finalA = saveFinalSnapshot(projectId, investorId, 'snap_status_scope_4c_final_a', ['room_a'], 'Oferta A');
        FC.projectStatusSync.commitAcceptedSnapshot(finalA, 'zaakceptowany', { roomIds:['room_a'], refreshUi:false });
        const sharedPrelimAS = savePreliminarySnapshot(projectId, investorId, 'snap_status_scope_4c_pre_as', ['room_a','room_s'], 'Wstępna A+S');
        FC.projectStatusSync.commitAcceptedSnapshot(sharedPrelimAS, 'pomiar', { roomIds:['room_a','room_s'], refreshUi:false });
        const statuses = statusMap(investorId);
        H.assert(statuses.room_a === 'pomiar', 'A ma zejść z Zaakceptowany do Pomiar, bo poprzednia końcowa A została zastąpiona', statuses);
        H.assert(statuses.room_s === 'wycena', 'S ręcznie ustawione na Wycena nie powinno być cofnięte do Pomiar, jeśli nie miało odrzuconej końcowej oferty', statuses);
        H.assert(statuses.room_p === 'wycena', 'P spoza zakresu nadal ma zachować Wycena', statuses);
      });
    }),

    H.makeTest('Wycena ↔ Statusy zakresowe', 'Jedna wspólna zaakceptowana oferta daje modal: tylko pokój albo cały zakres', 'Przypadek 5: po zaakceptowanej wspólnej ofercie A+S zmiana A na Wycena nie może iść w ciemno; guard musi zwrócić decyzję Tylko A albo A+S.', ()=>{
      withInvestorProjectFixture({ investorId:'inv_status_scope_5', projectId:'proj_status_scope_5', rooms:ROOMS_ASP, projectData:projectDataForRooms(ROOMS_ASP) }, ({ investorId, projectId })=>{
        const sharedAS = savePreliminarySnapshot(projectId, investorId, 'snap_status_scope_5_as', ['room_a','room_s'], 'Wstępna A+S');
        FC.quoteSnapshotStore.markSelectedForProject(projectId, sharedAS.id, { status:'pomiar', roomIds:['room_a','room_s'] });
        const decision = FC.projectStatusManualGuard.buildManualStatusScopeChoices(investorId, 'room_a', 'wycena');
        H.assert(decision && decision.needsDecision === true, 'Jedna wspólna zaakceptowana oferta powinna wymagać modala decyzyjnego przy zmianie jednego pokoju', decision);
        const sizes = (decision.choices || []).map((choice)=> choice.roomIds.length).sort((a,b)=> a-b).join(',');
        H.assert(sizes === '1,2', 'Modal decyzyjny powinien zawierać Tylko A oraz wspólny zakres A+S', decision);
      });
    }),

    H.makeTest('Wycena ↔ Statusy zakresowe', 'Oferta solo i wspólna dla tego samego pokoju dają modal decyzyjny dwóch zakresów', 'Przypadek 6: gdy istnieje zaakceptowana oferta solo A i wspólna A+S+P, program nie może zgadywać zakresu statusu.', ()=>{
      withInvestorProjectFixture({ investorId:'inv_status_scope_6', projectId:'proj_status_scope_6', rooms:ROOMS_ASP, projectData:projectDataForRooms(ROOMS_ASP) }, ({ investorId, projectId })=>{
        const soloA = savePreliminarySnapshot(projectId, investorId, 'snap_status_scope_6_a', ['room_a'], 'Wstępna A');
        const sharedASP = savePreliminarySnapshot(projectId, investorId, 'snap_status_scope_6_asp', ['room_a','room_s','room_p'], 'Wstępna A+S+P');
        FC.quoteSnapshotStore.markSelectedForProject(projectId, soloA.id, { status:'pomiar', roomIds:['room_a'] });
        FC.quoteSnapshotStore.markSelectedForProject(projectId, sharedASP.id, { status:'pomiar', roomIds:['room_a','room_s','room_p'] });
        const decision = FC.projectStatusManualGuard.buildManualStatusScopeChoices(investorId, 'room_a', 'wycena');
        H.assert(decision && decision.needsDecision === true, 'Solo + wspólna zaakceptowana oferta powinny wymagać modala decyzyjnego', decision);
        const sizes = (decision.choices || []).map((choice)=> choice.roomIds.length).sort((a,b)=> a-b).join(',');
        H.assert(sizes === '1,3', 'Decyzja powinna rozróżnić ofertę solo A i wspólną A+S+P', decision);
      });
    }),

    H.makeTest('Wycena ↔ Statusy zakresowe', 'Akceptacja oferty nie cofa pokoju, który jest już dalej w procesie', 'Przypadek 10: późna akceptacja wstępnej nie może cofnąć pokoju z Wycena do Pomiar, a akceptacja końcowej nie może cofnąć z Umowa do Zaakceptowany.', ()=>{
      withInvestorProjectFixture({ investorId:'inv_status_scope_10', projectId:'proj_status_scope_10', rooms:ROOMS_ASP, projectData:projectDataForRooms(ROOMS_ASP) }, ({ investorId, projectId })=>{
        FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_a', 'wycena');
        const prelimA = savePreliminarySnapshot(projectId, investorId, 'snap_status_scope_10_pre_a', ['room_a'], 'Wstępna A');
        FC.projectStatusSync.commitAcceptedSnapshot(prelimA, 'pomiar', { roomIds:['room_a'], refreshUi:false });
        let statuses = statusMap(investorId);
        H.assert(statuses.room_a === 'wycena', 'Akceptacja wstępnej nie powinna cofnąć A z Wycena do Pomiar', statuses);

        const finalA = saveFinalSnapshot(projectId, investorId, 'snap_status_scope_10_final_a', ['room_a'], 'Końcowa A');
        FC.projectStatusSync.commitAcceptedSnapshot(finalA, 'zaakceptowany', { roomIds:['room_a'], refreshUi:false });
        FC.projectStatusSync.applyProjectStatusChange({ investorId, roomIds:['room_a'], status:'umowa', syncSelection:false, refreshUi:false });
        FC.projectStatusSync.commitAcceptedSnapshot(finalA, 'zaakceptowany', { roomIds:['room_a'], refreshUi:false });
        statuses = statusMap(investorId);
        H.assert(statuses.room_a === 'umowa', 'Akceptacja końcowej nie powinna cofnąć A z Umowa do Zaakceptowany', statuses);
      });
    }),
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
