(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  if(!(FC.testHarness && typeof FC.registerWycenaTests === 'function')) return;

  FC.registerWycenaTests(({ FC, H, clone, withInvestorProjectFixture })=> [
    H.makeTest('Wycena ↔ Inwestor', 'Bulkowy kontrakt statusów inwestora zwraca ten sam wynik co pojedynczy guard dla pokoju', 'Pilnuje optymalizacji renderu zakładki Inwestor: buildManualStatusChoiceStates ma liczyć bazę pokoju raz, ale dalej zwracać te same blokady/odblokowania co validateManualStatusChange dla każdego statusu.', ()=>{
        H.assert(FC.projectStatusManualGuard && typeof FC.projectStatusManualGuard.buildManualStatusChoiceStates === 'function', 'Brak FC.projectStatusManualGuard.buildManualStatusChoiceStates');
        H.assert(typeof FC.projectStatusManualGuard.validateManualStatusChange === 'function', 'Brak FC.projectStatusManualGuard.validateManualStatusChange');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const soloPre = FC.quoteSnapshotStore.save({ id:'snap_bulk_guard_pre', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt bulk guard' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Salon pre' }, totals:{ grand:118 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820475000 });
          const builtBefore = FC.projectStatusManualGuard.buildManualStatusChoiceStates(investorId, 'room_salon', ['pomiar','wycena','zaakceptowany']);
          ['pomiar','wycena','zaakceptowany'].forEach((status)=>{
            const single = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', status);
            const bulk = builtBefore && builtBefore.states ? builtBefore.states[status] : null;
            H.assert(!!bulk, 'Bulk guard nie zwrócił stanu dla statusu', { status, builtBefore });
            H.assert(String(bulk && bulk.blocked) === String(single && single.blocked) && String(bulk && bulk.requiresGeneration) === String(single && single.requiresGeneration), 'Bulk guard nie zgadza się z pojedynczym validateManualStatusChange', { status, bulk, single, soloPre });
          });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, soloPre.id, { status:'pomiar', roomIds:['room_salon'] });
          const builtAfter = FC.projectStatusManualGuard.buildManualStatusChoiceStates(investorId, 'room_salon', ['pomiar','wycena']);
          ['pomiar','wycena'].forEach((status)=>{
            const single = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', status);
            const bulk = builtAfter && builtAfter.states ? builtAfter.states[status] : null;
            H.assert(!!bulk, 'Bulk guard po akceptacji nie zwrócił stanu dla statusu', { status, builtAfter });
            H.assert(String(bulk && bulk.blocked) === String(single && single.blocked) && String(bulk && bulk.requiresGeneration) === String(single && single.requiresGeneration), 'Bulk guard po akceptacji nie zgadza się z pojedynczym validateManualStatusChange', { status, bulk, single });
          });
        });
      }),

    H.makeTest('Wycena ↔ Inwestor', 'Ręczna zmiana Pomiar → Wycena zachowuje zaakceptowaną wstępną ofertę', 'Pilnuje, czy zmiana statusu projektu po stronie Inwestor oznacza oczekiwanie na wycenę końcową po pomiarze, a nie odrzucenie jedynej zaakceptowanej wyceny wstępnej.', ()=>{
        H.assert(FC.investorPersistence && typeof FC.investorPersistence.setInvestorProjectStatus === 'function', 'Brak FC.investorPersistence.setInvestorProjectStatus');
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.markSelectedForProject === 'function', 'Brak FC.quoteSnapshotStore.markSelectedForProject');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const prelim = FC.quoteSnapshotStore.save({ id:'snap_cross_prelim', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt testowy' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true }, totals:{ grand:100 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820000000 });
          const finalQuote = FC.quoteSnapshotStore.save({ id:'snap_cross_final', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt testowy' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, totals:{ grand:150 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820100000 });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, prelim.id, { status:'pomiar', roomIds:['room_kuchnia_gora'] });
          FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_kuchnia_gora', 'pomiar');
          let selected = FC.quoteSnapshotStore.getSelectedForProject(projectId);
          let record = FC.projectStore.getByInvestorId(investorId);
          H.assert(selected && String(selected.id || '') === String(prelim.id || ''), 'Status pomiar nie utrzymał zaakceptowanej oferty wstępnej', { selected, all:FC.quoteSnapshotStore.listForProject(projectId) });
          H.assert(record && String(record.status || '') === 'pomiar', 'Status pomiar nie zapisał się do projectStore', record);
          FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_kuchnia_gora', 'wycena');
          selected = FC.quoteSnapshotStore.getSelectedForProject(projectId);
          record = FC.projectStore.getByInvestorId(investorId);
          const prelimAfterWycena = FC.quoteSnapshotStore.getById(prelim.id);
          H.assert(selected && String(selected.id || '') === String(prelim.id || ''), 'Status Wycena po Pomiarze nie może odpiąć zaakceptowanej wyceny wstępnej', { selected, all:FC.quoteSnapshotStore.listForProject(projectId) });
          H.assert(prelimAfterWycena && FC.quoteSnapshotStore.isRejectedSnapshot(prelimAfterWycena) === false, 'Status Wycena po Pomiarze nie może oznaczyć wstępnej oferty jako odrzuconej', prelimAfterWycena);
          H.assert(record && String(record.status || '') === 'wycena', 'Status wycena nie zapisał się do projectStore jako etap oczekiwania na wycenę końcową', record);
          FC.quoteSnapshotStore.markSelectedForProject(projectId, finalQuote.id, { status:'zaakceptowany', roomIds:['room_kuchnia_gora'] });
          FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_kuchnia_gora', 'zaakceptowany');
          selected = FC.quoteSnapshotStore.getSelectedForProject(projectId);
          record = FC.projectStore.getByInvestorId(investorId);
          H.assert(selected && String(selected.id || '') === String(finalQuote.id || ''), 'Status zaakceptowany nie wskazał finalnej oferty', { selected, all:FC.quoteSnapshotStore.listForProject(projectId) });
          const prelimAfterFinal = FC.quoteSnapshotStore.getById(prelim.id);
          H.assert(prelimAfterFinal && FC.quoteSnapshotStore.isRejectedSnapshot(prelimAfterFinal) === false, 'Akceptacja finalnej oferty nie powinna historycznie odrzucać wstępnej oferty', prelimAfterFinal);
          H.assert(record && String(record.status || '') === 'zaakceptowany', 'Status zaakceptowany nie zapisał się do projectStore', record);
        });
      }),

    H.makeTest('Wycena ↔ Inwestor', 'Manualna zmiana na pomiar jest blokowana bez zaakceptowanej wyceny wstępnej solo', 'Pilnuje, czy Inwestor nie podniesie pokoju na Pomiar tylko dlatego, że istnieje niezaakceptowana albo wspólna wycena zamiast zaakceptowanej podstawy solo.', ()=>{
        H.assert(FC.projectStatusManualGuard && typeof FC.projectStatusManualGuard.validateManualStatusChange === 'function', 'Brak FC.projectStatusManualGuard.validateManualStatusChange');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          FC.quoteSnapshotStore.save({ id:'snap_shared_pre_guard', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt guard' }, scope:{ selectedRooms:['room_kuchnia_gora','room_salon'], roomLabels:['Kuchnia góra','Salon'] }, commercial:{ preliminary:true, versionName:'Wspólna pre' }, totals:{ grand:220 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820468000 });
          const validationMissing = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'pomiar');
          H.assert(validationMissing && validationMissing.blocked === true && validationMissing.requiresGeneration === true && String(validationMissing.generationKind || '') === 'preliminary', 'Brak wyceny solo nie zablokował wejścia na Pomiar z propozycją wygenerowania wstępnej wyceny', validationMissing);
          const soloPre = FC.quoteSnapshotStore.save({ id:'snap_salon_pre_guard', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt guard' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Salon pre' }, totals:{ grand:118 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820469000 });
          const validationUnaccepted = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'pomiar');
          H.assert(validationUnaccepted && validationUnaccepted.blocked === true && validationUnaccepted.requiresGeneration === false, 'Niezaakceptowana wycena wstępna solo nie zablokowała ręcznego wejścia na Pomiar', { validationUnaccepted, soloPre });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, soloPre.id, { status:'pomiar', roomIds:['room_salon'] });
          const validationAccepted = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'pomiar');
          H.assert(validationAccepted && validationAccepted.ok === true && validationAccepted.blocked === false, 'Zaakceptowana wycena wstępna solo nie odblokowała ręcznego wejścia na Pomiar', validationAccepted);
        });
      }),

    H.makeTest('Wycena ↔ Inwestor', 'Manualna zmiana na zaakceptowany jest blokowana bez zaakceptowanej wyceny końcowej solo', 'Pilnuje, czy Inwestor nie ustawi pokoju jako zaakceptowany bez osobnej zaakceptowanej oferty końcowej dla tego pomieszczenia.', ()=>{
        H.assert(FC.projectStatusManualGuard && typeof FC.projectStatusManualGuard.validateManualStatusChange === 'function', 'Brak FC.projectStatusManualGuard.validateManualStatusChange');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const validationMissing = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'zaakceptowany');
          H.assert(validationMissing && validationMissing.blocked === true && validationMissing.requiresGeneration === true && String(validationMissing.generationKind || '') === 'final', 'Brak wyceny końcowej solo nie zablokował wejścia na Zaakceptowany z propozycją wygenerowania końcowej wyceny', validationMissing);
          const soloFinal = FC.quoteSnapshotStore.save({ id:'snap_salon_final_guard', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt final guard' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:false, versionName:'Salon final' }, totals:{ grand:180 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820470000 });
          const validationUnaccepted = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'zaakceptowany');
          H.assert(validationUnaccepted && validationUnaccepted.blocked === true && validationUnaccepted.requiresGeneration === false, 'Niezaakceptowana wycena końcowa solo nie zablokowała wejścia na Zaakceptowany', { validationUnaccepted, soloFinal });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, soloFinal.id, { status:'zaakceptowany', roomIds:['room_salon'] });
          const validationAccepted = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'zaakceptowany');
          H.assert(validationAccepted && validationAccepted.ok === true && validationAccepted.blocked === false, 'Zaakceptowana wycena końcowa solo nie odblokowała wejścia na Zaakceptowany', validationAccepted);
        });
      }),

    H.makeTest('Wycena ↔ Inwestor', 'Manualna zmiana na wycena jest blokowana bez zaakceptowanej wyceny wstępnej solo', 'Pilnuje, czy Inwestor nie przeskoczy ręcznie do statusu Wycena dla jednego pomieszczenia bez własnej zaakceptowanej wyceny wstępnej.', ()=>{
        H.assert(FC.projectStatusManualGuard && typeof FC.projectStatusManualGuard.validateManualStatusChange === 'function', 'Brak FC.projectStatusManualGuard.validateManualStatusChange');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const validationMissing = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'wycena');
          H.assert(validationMissing && validationMissing.blocked === true && validationMissing.requiresGeneration === true && String(validationMissing.generationKind || '') === 'preliminary', 'Brak wyceny wstępnej solo nie zablokował ręcznego wejścia na Wycena', validationMissing);
          const soloPre = FC.quoteSnapshotStore.save({ id:'snap_salon_pre_wycena_guard', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt wycena guard' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Salon pre wycena' }, totals:{ grand:119 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820471000 });
          const validationUnaccepted = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'wycena');
          H.assert(validationUnaccepted && validationUnaccepted.blocked === true && validationUnaccepted.requiresGeneration === false, 'Niezaakceptowana wycena wstępna solo nie zablokowała ręcznego wejścia na Wycena', { validationUnaccepted, soloPre });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, soloPre.id, { status:'pomiar', roomIds:['room_salon'] });
          const validationAccepted = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'wycena');
          H.assert(validationAccepted && validationAccepted.ok === true && validationAccepted.blocked === false, 'Zaakceptowana wycena wstępna solo nie odblokowała ręcznego wejścia na Wycena', validationAccepted);
        });
      }),

    H.makeTest('Wycena ↔ Inwestor', 'Manualna zmiana na pomiar i wycena pozostaje zablokowana także przy błędnie wyższym statusie pokoju', 'Pilnuje antyregresyjnie, czy pokój z omyłkowo wyższym statusem nie może już ręcznie wskoczyć na Pomiar albo Wycena bez własnej zaakceptowanej wyceny wstępnej solo.', ()=>{
        H.assert(FC.projectStatusManualGuard && typeof FC.projectStatusManualGuard.validateManualStatusChange === 'function', 'Brak FC.projectStatusManualGuard.validateManualStatusChange');
        H.assert(FC.investorPersistence && typeof FC.investorPersistence.updateInvestorRoom === 'function', 'Brak FC.investorPersistence.updateInvestorRoom');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const soloPre = FC.quoteSnapshotStore.save({ id:'snap_salon_pre_guard_high', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt guard high' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Salon pre high' }, totals:{ grand:119 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820471100 });
          FC.investorPersistence.updateInvestorRoom(investorId, 'room_salon', { projectStatus:'wycena' });
          const blockedPomiar = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'pomiar');
          const blockedWycena = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'wycena');
          H.assert(blockedPomiar && blockedPomiar.blocked === true && blockedPomiar.requiresGeneration === false, 'Niezaakceptowana wycena wstępna solo nie zablokowała wejścia na Pomiar przy błędnie wyższym statusie pokoju', { blockedPomiar, soloPre });
          H.assert(blockedWycena && blockedWycena.blocked === true && blockedWycena.requiresGeneration === false, 'Niezaakceptowana wycena wstępna solo nie zablokowała wejścia na Wycena przy błędnie wyższym statusie pokoju', { blockedWycena, soloPre });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, soloPre.id, { status:'pomiar', roomIds:['room_salon'] });
          const unlockedPomiar = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'pomiar');
          const unlockedWycena = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'wycena');
          H.assert(unlockedPomiar && unlockedPomiar.blocked === false, 'Zaakceptowana wycena wstępna solo nie odblokowała wejścia na Pomiar przy wyższym bieżącym statusie', unlockedPomiar);
          H.assert(unlockedWycena && unlockedWycena.blocked === false, 'Zaakceptowana wycena wstępna solo nie odblokowała wejścia na Wycena przy wyższym bieżącym statusie', unlockedWycena);
        });
      }),

    H.makeTest('Wycena ↔ Inwestor', 'Późne etapy procesu utrzymują wybraną końcową ofertę i scoped lustra dla jednego pokoju', 'Pilnuje, czy sekwencja umowa → produkcja → montaż → zakończone dalej działa exact-scope: zachowuje zaakceptowaną ofertę końcową, aktualizuje lustra i nie rusza drugiego pokoju.', ()=>{
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.setInvestorRoomStatus === 'function', 'Brak FC.projectStatusSync.setInvestorRoomStatus');
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.markSelectedForProject === 'function', 'Brak FC.quoteSnapshotStore.markSelectedForProject');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const finalKitchen = FC.quoteSnapshotStore.save({
            id:'snap_late_kitchen_final',
            investor:{ id:investorId, name:'Jan Test' },
            project:{ id:projectId, investorId, status:'wycena' },
            scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] },
            commercial:{ preliminary:false, versionName:'Oferta — Kuchnia góra' },
            meta:{ preliminary:false, versionName:'Oferta — Kuchnia góra' },
            lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            totals:{ grand:150, subtotal:150, discount:0, materials:0, accessories:0, services:0, quoteRates:0 },
            generatedAt:1712817000000,
          });
          const prelimKitchen = FC.quoteSnapshotStore.save({
            id:'snap_late_kitchen_prelim',
            investor:{ id:investorId, name:'Jan Test' },
            project:{ id:projectId, investorId, status:'pomiar' },
            scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] },
            commercial:{ preliminary:true, versionName:'Wstępna oferta — Kuchnia góra' },
            meta:{ preliminary:true, versionName:'Wstępna oferta — Kuchnia góra' },
            lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            totals:{ grand:120, subtotal:120, discount:0, materials:0, accessories:0, services:0, quoteRates:0 },
            generatedAt:1712816900000,
          });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, finalKitchen.id, { status:'zaakceptowany', roomIds:['room_kuchnia_gora'] });
          const statuses = ['umowa','produkcja','montaz','zakonczone'];
          statuses.forEach((status)=>{
            const result = FC.projectStatusSync.setInvestorRoomStatus(investorId, 'room_kuchnia_gora', status, { syncSelection:true, refreshUi:false });
            const investor = FC.investors.getById(investorId);
            const project = FC.projectStore.getById(projectId);
            const selectedKitchen = FC.quoteSnapshotStore.getSelectedForProject(projectId, { roomIds:['room_kuchnia_gora'] });
            const selectedSalon = FC.quoteSnapshotStore.getSelectedForProject(projectId, { roomIds:['room_salon'] });
            const kitchenPrelim = FC.quoteSnapshotStore.getById(prelimKitchen.id);
            const kitchenRoom = investor && investor.rooms && investor.rooms.find((room)=> String(room && room.id || '') === 'room_kuchnia_gora');
            const salonRoom = investor && investor.rooms && investor.rooms.find((room)=> String(room && room.id || '') === 'room_salon');
            H.assert(result && String(result.masterStatus || '') === status, 'masterStatus nie przeszedł na późny etap dla solo pokoju', { status, result });
            H.assert(result && String(result.mirrorStatus || '') === status, 'mirrorStatus nie przeszedł na późny etap dla solo pokoju', { status, result });
            H.assert(kitchenRoom && String(kitchenRoom.projectStatus || '') === status, 'Pokój kuchni nie dostał późnego etapu', { status, rooms:investor && investor.rooms });
            H.assert(salonRoom && String(salonRoom.projectStatus || '') === 'nowy', 'Drugi pokój nie powinien zmienić statusu przy solo późnym etapie', { status, rooms:investor && investor.rooms });
            H.assert(project && String(project.status || '') === status, 'projectStore nie odzwierciedla scoped późnego etapu', { status, project });
            H.assert(result && result.loadedProject && result.loadedProject.meta && String(result.loadedProject.meta.projectStatus || '') === status, 'loadedProject.meta.projectStatus nie jest lustrem późnego etapu', { status, loadedProject: result && result.loadedProject });
            H.assert(selectedKitchen && String(selectedKitchen.id || '') === String(finalKitchen.id || ''), 'Późny etap zgubił wybraną końcową ofertę dla pokoju', { status, selectedKitchen, all:FC.quoteSnapshotStore.listForProject(projectId) });
            H.assert(selectedSalon == null, 'Solo późny etap nie powinien tworzyć aktywnej oferty dla drugiego pokoju', { status, selectedSalon, all:FC.quoteSnapshotStore.listForProject(projectId) });
            H.assert(kitchenPrelim && kitchenPrelim.meta && kitchenPrelim.meta.selectedByClient !== true, 'Późny etap przywrócił martwe zaznaczenie starej oferty wstępnej', { status, kitchenPrelim });
            H.assert(FC.quoteSnapshotStore.getRecommendedStatusForProject(projectId, status, { roomIds:['room_kuchnia_gora'] }) === status, 'Rekomendowany status dla późnego etapu scoped jest błędny', { status, all:FC.quoteSnapshotStore.listForProject(projectId) });
          });
        });
      }),

    H.makeTest('Wycena ↔ Inwestor', 'Ręczne późne etapy są blokowane bez zaakceptowanej końcowej wyceny solo', 'Pilnuje, czy dla umowy, produkcji, montażu i zakończenia nadal trzeba mieć zaakceptowaną końcową ofertę exact-scope dla danego pokoju.', ()=>{
        H.assert(FC.projectStatusManualGuard && typeof FC.projectStatusManualGuard.validateManualStatusChange === 'function', 'Brak FC.projectStatusManualGuard.validateManualStatusChange');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          ['umowa','produkcja','montaz','zakonczone'].forEach((status)=>{
            const missing = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_kuchnia_gora', status);
            H.assert(missing && missing.blocked === true && missing.requiresGeneration === true && String(missing.generationKind || '') === 'final', 'Bez końcowej wyceny guard powinien blokować późny etap', { status, missing });
          });
          const finalKitchen = FC.quoteSnapshotStore.save({
            id:'snap_late_guard_final',
            investor:{ id:investorId, name:'Jan Test' },
            project:{ id:projectId, investorId, status:'wycena' },
            scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] },
            commercial:{ preliminary:false, versionName:'Oferta — Kuchnia góra' },
            meta:{ preliminary:false, versionName:'Oferta — Kuchnia góra' },
            lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            totals:{ grand:150, subtotal:150, discount:0, materials:0, accessories:0, services:0, quoteRates:0 },
            generatedAt:1712817100000,
          });
          ['umowa','produkcja','montaz','zakonczone'].forEach((status)=>{
            const unaccepted = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_kuchnia_gora', status);
            H.assert(unaccepted && unaccepted.blocked === true && unaccepted.requiresGeneration === false, 'Niezaakceptowana końcowa wycena powinna nadal blokować późny etap', { status, unaccepted });
          });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, finalKitchen.id, { status:'zaakceptowany', roomIds:['room_kuchnia_gora'] });
          ['umowa','produkcja','montaz','zakonczone'].forEach((status)=>{
            const accepted = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_kuchnia_gora', status);
            H.assert(accepted && accepted.blocked === false && accepted.ok === true, 'Zaakceptowana końcowa wycena powinna odblokować późny etap', { status, accepted });
          });
        });
      }),

    H.makeTest('Wycena ↔ Inwestor', 'Późny etap jednego pokoju nie rusza zaakceptowanej końcowej oferty drugiego pokoju', 'Pilnuje, czy exact-scope późnych etapów nie zdejmuje akceptacji i nie nadpisuje snapshotów rozłącznego pokoju.', ()=>{
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.setStatusFromSnapshot === 'function', 'Brak FC.projectStatusSync.setStatusFromSnapshot');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const finalKitchen = FC.quoteSnapshotStore.save({
            id:'snap_late_mix_kitchen',
            investor:{ id:investorId, name:'Jan Test' },
            project:{ id:projectId, investorId, status:'wycena' },
            scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] },
            commercial:{ preliminary:false, versionName:'Oferta — Kuchnia góra' },
            meta:{ preliminary:false, versionName:'Oferta — Kuchnia góra' },
            lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            totals:{ grand:150, subtotal:150, discount:0, materials:0, accessories:0, services:0, quoteRates:0 },
            generatedAt:1712817200000,
          });
          const finalSalon = FC.quoteSnapshotStore.save({
            id:'snap_late_mix_salon',
            investor:{ id:investorId, name:'Jan Test' },
            project:{ id:projectId, investorId, status:'wycena' },
            scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] },
            commercial:{ preliminary:false, versionName:'Oferta — Salon' },
            meta:{ preliminary:false, versionName:'Oferta — Salon' },
            lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            totals:{ grand:180, subtotal:180, discount:0, materials:0, accessories:0, services:0, quoteRates:0 },
            generatedAt:1712817210000,
          });
          FC.projectStatusSync.setStatusFromSnapshot(finalKitchen, 'zaakceptowany', { roomIds:['room_kuchnia_gora'], syncSelection:true, refreshUi:false });
          FC.projectStatusSync.setStatusFromSnapshot(finalSalon, 'zaakceptowany', { roomIds:['room_salon'], syncSelection:true, refreshUi:false });
          const beforeSalon = FC.quoteSnapshotStore.getSelectedForProject(projectId, { roomIds:['room_salon'] });
          H.assert(beforeSalon && String(beforeSalon.id || '') === String(finalSalon.id || ''), 'Setup nie ustawił zaakceptowanej oferty salonu', { beforeSalon, all:FC.quoteSnapshotStore.listForProject(projectId) });
          const result = FC.projectStatusSync.setInvestorRoomStatus(investorId, 'room_kuchnia_gora', 'montaz', { syncSelection:true, refreshUi:false });
          const afterKitchen = FC.quoteSnapshotStore.getSelectedForProject(projectId, { roomIds:['room_kuchnia_gora'] });
          const afterSalon = FC.quoteSnapshotStore.getSelectedForProject(projectId, { roomIds:['room_salon'] });
          const salonSnapshot = FC.quoteSnapshotStore.getById(finalSalon.id);
          const investor = FC.investors.getById(investorId);
          const kitchenRoom = investor && investor.rooms && investor.rooms.find((room)=> String(room && room.id || '') === 'room_kuchnia_gora');
          const salonRoom = investor && investor.rooms && investor.rooms.find((room)=> String(room && room.id || '') === 'room_salon');
          H.assert(result && String(result.masterStatus || '') === 'montaz', 'masterStatus późnego etapu kuchni jest błędny', result);
          H.assert(afterKitchen && String(afterKitchen.id || '') === String(finalKitchen.id || ''), 'Późny etap kuchni zgubił jej własną końcową ofertę', { afterKitchen, all:FC.quoteSnapshotStore.listForProject(projectId) });
          H.assert(afterSalon && String(afterSalon.id || '') === String(finalSalon.id || ''), 'Późny etap kuchni ruszył zaakceptowaną ofertę rozłącznego salonu', { afterSalon, all:FC.quoteSnapshotStore.listForProject(projectId) });
          H.assert(salonSnapshot && salonSnapshot.meta && salonSnapshot.meta.selectedByClient === true && String(salonSnapshot.meta.acceptedStage || '') === 'zaakceptowany', 'Snapshot salonu dostał martwy lub obcy stan po późnym etapie kuchni', salonSnapshot);
          H.assert(kitchenRoom && String(kitchenRoom.projectStatus || '') === 'montaz', 'Pokój kuchni nie wszedł w montaż', investor && investor.rooms);
          H.assert(salonRoom && String(salonRoom.projectStatus || '') === 'zaakceptowany', 'Rozłączny salon nie powinien zmienić etapu przy montażu kuchni', investor && investor.rooms);
        });
      })
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
