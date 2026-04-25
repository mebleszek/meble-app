(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  if(!(FC.testHarness && typeof FC.registerWycenaTests === 'function')) return;

  function withMutedExpectedWarnings(expectedFragments, fn){
    const fragments = (Array.isArray(expectedFragments) ? expectedFragments : [expectedFragments])
      .map((item)=> String(item || '').trim())
      .filter(Boolean);
    if(!fragments.length || typeof console === 'undefined' || !console || typeof console.warn !== 'function') return fn();
    const originalWarn = console.warn;
    console.warn = function(){
      const text = Array.prototype.slice.call(arguments).map((item)=> {
        try{ return typeof item === 'string' ? item : JSON.stringify(item); }catch(_){ return String(item); }
      }).join(' ');
      if(fragments.some((fragment)=> text.indexOf(fragment) >= 0)) return;
      return originalWarn.apply(this, arguments);
    };
    try{
      const result = fn();
      if(result && typeof result.then === 'function'){
        return result.finally(()=> { console.warn = originalWarn; });
      }
      console.warn = originalWarn;
      return result;
    }catch(error){
      console.warn = originalWarn;
      throw error;
    }
  }

  FC.registerWycenaTests(({ FC, H, clone, withInvestorProjectFixture })=> [
    H.makeTest('Wycena ↔ Centralny status', 'Rekonsyliacja bez jawnego scope nie skleja wszystkich pokoi inwestora w jeden projekt', 'Pilnuje regułę mini-paczki 1: przy wielu pokojach brak jawnego scope nie może zmusić projectStore.status do agregacji po całym inwestorze.', ()=> withInvestorProjectFixture({
        investorId:'inv_scope_guard',
        projectId:'proj_scope_guard',
        rooms:[
          { id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'wstepna_wycena' },
          { id:'room_b', baseType:'pokoj', name:'Pokój B', label:'Pokój B', projectStatus:'nowy' },
        ],
        status:'nowy',
        projectData:{
          schemaVersion:2,
          meta:{
            projectStatus:'nowy',
            roomDefs:{
              room_a:{ id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'wstepna_wycena' },
              room_b:{ id:'room_b', baseType:'pokoj', name:'Pokój B', label:'Pokój B', projectStatus:'nowy' },
            },
            roomOrder:['room_a','room_b'],
          },
          room_a:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} },
          room_b:{ cabinets:[{ id:'cab_b' }], fronts:[], sets:[], settings:{} },
        }
      }, ({ investorId, projectId })=>{
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.reconcileProjectStatuses === 'function', 'Brak FC.projectStatusSync.reconcileProjectStatuses');
        FC.quoteSnapshotStore.writeAll([]);
        FC.quoteSnapshotStore.save({
          id:'snap_scope_guard_a',
          investor:{ id:investorId, name:'Jan Test' },
          project:{ id:projectId, investorId, status:'wstepna_wycena' },
          scope:{ selectedRooms:['room_a'], roomLabels:['Kuchnia A'] },
          commercial:{ preliminary:true, versionName:'Wstępna oferta A' },
          meta:{ preliminary:true, versionName:'Wstępna oferta A' },
          lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
          totals:{ materials:0, accessories:0, services:0, quoteRates:0, subtotal:0, discount:0, grand:0 },
          generatedAt:1712816200000,
        });
        const result = FC.projectStatusSync.reconcileProjectStatuses({ projectId, investorId, fallbackStatus:'nowy', refreshUi:false });
        const investor = FC.investors.getById(investorId);
        const project = FC.projectStore.getById(projectId);
        const roomA = investor && investor.rooms && investor.rooms.find((room)=> String(room && room.id || '') === 'room_a');
        const roomB = investor && investor.rooms && investor.rooms.find((room)=> String(room && room.id || '') === 'room_b');
        H.assert(result && String(result.roomStatusMap && result.roomStatusMap.room_a || '') === 'wstepna_wycena', 'Rekonsyliacja zgubiła scoped status pokoju A', result);
        H.assert(result && String(result.roomStatusMap && result.roomStatusMap.room_b || '') === 'nowy', 'Rekonsyliacja zgubiła scoped status pokoju B', result);
        H.assert(result && String(result.aggregateStatus || '') === 'nowy', 'Brak jawnego scope nadal zlepił status projektu z całego inwestora', result);
        H.assert(result && String(result.masterStatus || '') === 'nowy', 'Centralny sync nie zwrócił masterStatus zgodnego z wynikiem scoped', result);
        H.assert(result && String(result.mirrorStatus || '') === 'nowy', 'Centralny sync nie zwrócił mirrorStatus zgodnego z masterem', result);
        H.assert(roomA && String(roomA.projectStatus || '') === 'wstepna_wycena', 'Pokój A nie zachował własnego statusu scoped', investor);
        H.assert(roomB && String(roomB.projectStatus || '') === 'nowy', 'Pokój B nie zachował własnego statusu scoped', investor);
        H.assert(project && String(project.status || '') === 'nowy', 'projectStore.status nie powinien agregować wszystkich pokoi bez jawnego scope', project);
        const loaded = result && result.loadedProject;
        H.assert(loaded && loaded.meta && String(loaded.meta.projectStatus || '') === 'nowy', 'loadedProject.meta.projectStatus powinien być lustrem masterStatus po rekonsyliacji', loaded);
      })),

    H.makeTest('Wycena ↔ Centralny status', 'Scoped zmiana statusu wielu pokoi ignoruje obcy pokój inwestora', 'Pilnuje regułę mini-paczki 1: wspólny projekt A+B liczy status tylko z własnego scope i nie może zostać podbity przez niezależny pokój C.', ()=> withInvestorProjectFixture({
        investorId:'inv_scope_exact',
        projectId:'proj_scope_exact',
        rooms:[
          { id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'wstepna_wycena' },
          { id:'room_b', baseType:'pokoj', name:'Pokój B', label:'Pokój B', projectStatus:'wstepna_wycena' },
          { id:'room_c', baseType:'pokoj', name:'Pokój C', label:'Pokój C', projectStatus:'wycena' },
        ],
        status:'wycena',
        projectData:{
          schemaVersion:2,
          meta:{
            projectStatus:'wycena',
            roomDefs:{
              room_a:{ id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'wstepna_wycena' },
              room_b:{ id:'room_b', baseType:'pokoj', name:'Pokój B', label:'Pokój B', projectStatus:'wstepna_wycena' },
              room_c:{ id:'room_c', baseType:'pokoj', name:'Pokój C', label:'Pokój C', projectStatus:'wycena' },
            },
            roomOrder:['room_a','room_b','room_c'],
          },
          room_a:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} },
          room_b:{ cabinets:[{ id:'cab_b' }], fronts:[], sets:[], settings:{} },
          room_c:{ cabinets:[{ id:'cab_c' }], fronts:[], sets:[], settings:{} },
        }
      }, ({ investorId, projectId })=>{
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.reconcileProjectStatuses === 'function', 'Brak FC.projectStatusSync.reconcileProjectStatuses');
        FC.quoteSnapshotStore.writeAll([]);
        FC.quoteSnapshotStore.save({
          id:'snap_scope_exact_ab',
          investor:{ id:investorId, name:'Jan Test' },
          project:{ id:projectId, investorId, status:'wstepna_wycena' },
          scope:{ selectedRooms:['room_a','room_b'], roomLabels:['Kuchnia A','Pokój B'] },
          commercial:{ preliminary:true, versionName:'Wstępna oferta A+B' },
          meta:{ preliminary:true, versionName:'Wstępna oferta A+B' },
          lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
          totals:{ materials:0, accessories:0, services:0, quoteRates:0, subtotal:0, discount:0, grand:0 },
          generatedAt:1712816300000,
        });
        FC.quoteSnapshotStore.save({
          id:'snap_scope_exact_c',
          investor:{ id:investorId, name:'Jan Test' },
          project:{ id:projectId, investorId, status:'wycena' },
          scope:{ selectedRooms:['room_c'], roomLabels:['Pokój C'] },
          commercial:{ preliminary:false, versionName:'Oferta C' },
          meta:{ preliminary:false, versionName:'Oferta C' },
          lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
          totals:{ materials:0, accessories:0, services:0, quoteRates:0, subtotal:0, discount:0, grand:0 },
          generatedAt:1712816310000,
        });
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.setStatusFromSnapshot === 'function', 'Brak FC.projectStatusSync.setStatusFromSnapshot');
        const snapshot = FC.quoteSnapshotStore.getById('snap_scope_exact_ab');
        const result = FC.projectStatusSync.setStatusFromSnapshot(snapshot, 'wstepna_wycena', { refreshUi:false });
        const investor = FC.investors.getById(investorId);
        const project = FC.projectStore.getById(projectId);
        const roomA = investor && investor.rooms && investor.rooms.find((room)=> String(room && room.id || '') === 'room_a');
        const roomB = investor && investor.rooms && investor.rooms.find((room)=> String(room && room.id || '') === 'room_b');
        const roomC = investor && investor.rooms && investor.rooms.find((room)=> String(room && room.id || '') === 'room_c');
        H.assert(result && String(result.aggregateStatus || '') === 'wstepna_wycena', 'Scoped projekt A+B został błędnie podbity przez obcy pokój C', result);
        H.assert(result && String(result.masterStatus || '') === 'wstepna_wycena', 'masterStatus scoped projektu A+B jest błędny', result);
        H.assert(result && String(result.mirrorStatus || '') === 'wstepna_wycena', 'mirrorStatus scoped projektu A+B nie zgadza się z masterem', result);
        H.assert(roomA && String(roomA.projectStatus || '') === 'wstepna_wycena', 'Pokój A nie dostał scoped statusu A+B', investor);
        H.assert(roomB && String(roomB.projectStatus || '') === 'wstepna_wycena', 'Pokój B nie dostał scoped statusu A+B', investor);
        H.assert(roomC && String(roomC.projectStatus || '') === 'wycena', 'Obcy pokój C nie powinien zmienić statusu przy scoped A+B', investor);
        H.assert(project && String(project.status || '') === 'wstepna_wycena', 'projectStore.status powinien odzwierciedlać tylko exact scope A+B', project);
        const loaded = result && result.loadedProject;
        H.assert(loaded && loaded.meta && String(loaded.meta.projectStatus || '') === 'wstepna_wycena', 'loadedProject.meta.projectStatus powinien być lustrem scoped masterStatus A+B', loaded);
      })),

    H.makeTest('Wycena ↔ Centralny status', 'Inwestor i Wycena wołają jeden wspólny mechanizm statusów', 'Pilnuje ETAP 2: oba wejścia do zmiany statusu mają przechodzić przez centralny serwis zamiast przez dwie niezależne ścieżki.', ()=>{
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.setInvestorRoomStatus === 'function', 'Brak FC.projectStatusSync.setInvestorRoomStatus');
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.setStatusFromSnapshot === 'function', 'Brak FC.projectStatusSync.setStatusFromSnapshot');
        const prevSetInvestorRoomStatus = FC.projectStatusSync.setInvestorRoomStatus;
        const prevSetStatusFromSnapshot = FC.projectStatusSync.setStatusFromSnapshot;
        let investorCalls = 0;
        let snapshotCalls = 0;
        FC.projectStatusSync.setInvestorRoomStatus = function(){
          investorCalls += 1;
          return prevSetInvestorRoomStatus.apply(this, arguments);
        };
        FC.projectStatusSync.setStatusFromSnapshot = function(){
          snapshotCalls += 1;
          return prevSetStatusFromSnapshot.apply(this, arguments);
        };
        try{
          withInvestorProjectFixture({}, ({ investorId, projectId })=>{
            const prelim = FC.quoteSnapshotStore.save({ id:'snap_central_pre', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt centralny' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Central pre' }, totals:{ grand:100 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820255000 });
            FC.quoteSnapshotStore.markSelectedForProject(projectId, prelim.id, { status:'pomiar', roomIds:['room_kuchnia_gora'] });
            FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_kuchnia_gora', 'pomiar');
            FC.wycenaTabDebug.setProjectStatusFromSnapshot(prelim, 'pomiar', { syncSelection:true });
          });
          H.assert(investorCalls === 1, 'Wejście z Inwestor nie przeszło przez centralny serwis statusów', { investorCalls, snapshotCalls });
          H.assert(snapshotCalls === 1, 'Wejście z Wycena nie przeszło przez centralny serwis statusów', { investorCalls, snapshotCalls });
        } finally {
          FC.projectStatusSync.setInvestorRoomStatus = prevSetInvestorRoomStatus;
          FC.projectStatusSync.setStatusFromSnapshot = prevSetStatusFromSnapshot;
        }
      }),

    H.makeTest('Wycena ↔ Centralny status', 'Centralny serwis statusów synchronizuje inwestora, projekt i wybór oferty', 'Pilnuje ETAP 2: jedna centralna ścieżka ma ustawić statusy pokoi, store projektu i zaakceptowaną ofertę bez potrzeby wywoływania osobnych mostków.', ()=>{
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.setStatusFromSnapshot === 'function', 'Brak FC.projectStatusSync.setStatusFromSnapshot');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const prelim = FC.quoteSnapshotStore.save({ id:'snap_central_sync_pre', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt central sync' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Central sync pre' }, totals:{ grand:101 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820260000 });
          const finalQuote = FC.quoteSnapshotStore.save({ id:'snap_central_sync_final', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt central sync' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:false, versionName:'Central sync final' }, totals:{ grand:151 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820270000 });
          FC.projectStatusSync.setStatusFromSnapshot(prelim, 'pomiar', { syncSelection:true, refreshUi:false });
          let investor = FC.investors.getById(investorId);
          let project = FC.projectStore.getById(projectId);
          let selected = FC.quoteSnapshotStore.getSelectedForProject(projectId);
          const kitchenAfterPomiar = (investor.rooms || []).find((room)=> String(room && room.id || '') === 'room_kuchnia_gora');
          H.assert(String(kitchenAfterPomiar && kitchenAfterPomiar.projectStatus || '') === 'pomiar', 'Centralny serwis nie ustawił statusu pokoju na pomiar', investor && investor.rooms);
          H.assert(project && String(project.status || '') === 'pomiar', 'Centralny serwis nie zsynchronizował projectStore na pomiar', project);
          H.assert(selected && String(selected.id || '') === String(prelim.id || ''), 'Centralny serwis nie wskazał zaakceptowanej oferty wstępnej', { selected, all:FC.quoteSnapshotStore.listForProject(projectId) });
          FC.projectStatusSync.setStatusFromSnapshot(finalQuote, 'zaakceptowany', { syncSelection:true, refreshUi:false });
          investor = FC.investors.getById(investorId);
          project = FC.projectStore.getById(projectId);
          selected = FC.quoteSnapshotStore.getSelectedForProject(projectId);
          const kitchenAfterFinal = (investor.rooms || []).find((room)=> String(room && room.id || '') === 'room_kuchnia_gora');
          H.assert(String(kitchenAfterFinal && kitchenAfterFinal.projectStatus || '') === 'zaakceptowany', 'Centralny serwis nie ustawił statusu pokoju na zaakceptowany', investor && investor.rooms);
          H.assert(project && String(project.status || '') === 'zaakceptowany', 'Centralny serwis nie zsynchronizował projectStore na zaakceptowany', project);
          H.assert(selected && String(selected.id || '') === String(finalQuote.id || ''), 'Centralny serwis nie przełączył zaakceptowanej oferty na końcową', { selected, all:FC.quoteSnapshotStore.listForProject(projectId) });
        });
      }),

    H.makeTest('Wycena ↔ Centralny status', 'Centralny status ignoruje stare statusy z roomRegistry przy zapisie projektu', 'Pilnuje regresję z ETAPU 3: obce albo stare statusy wiszące w roomRegistry nie mogą nadpisywać projectStore.status ani statusów pokoi przy zmianie scoped.', ()=>{
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.setStatusFromSnapshot === 'function', 'Brak FC.projectStatusSync.setStatusFromSnapshot');
        H.assert(FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomDefs === 'function', 'Brak FC.roomRegistry.getActiveRoomDefs');
        H.assert(typeof FC.roomRegistry.getActiveRoomIds === 'function', 'Brak FC.roomRegistry.getActiveRoomIds');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const prelim = FC.quoteSnapshotStore.save({ id:'snap_registry_pre', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt registry' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Registry pre' }, totals:{ grand:111 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820280000 });
          const prevGetActiveRoomDefs = FC.roomRegistry.getActiveRoomDefs;
          const prevGetActiveRoomIds = FC.roomRegistry.getActiveRoomIds;
          const staleDefs = [
            { id:'room_kuchnia_gora', baseType:'kuchnia', name:'Kuchnia góra', label:'Kuchnia góra', projectStatus:'wycena' },
            { id:'room_salon', baseType:'pokoj', name:'Salon', label:'Salon', projectStatus:'wycena' },
            { id:'room_stale', baseType:'pokoj', name:'Stary pokój', label:'Stary pokój', projectStatus:'wycena' },
          ];
          FC.roomRegistry.getActiveRoomDefs = ()=> clone(staleDefs);
          FC.roomRegistry.getActiveRoomIds = ()=> staleDefs.map((room)=> String(room && room.id || '')).filter(Boolean);
          try{
            FC.projectStatusSync.setStatusFromSnapshot(prelim, 'pomiar', { syncSelection:true, refreshUi:false });
            const investor = FC.investors.getById(investorId);
            const project = FC.projectStore.getById(projectId);
            const kitchen = (investor && investor.rooms || []).find((room)=> String(room && room.id || '') === 'room_kuchnia_gora');
            const salon = (investor && investor.rooms || []).find((room)=> String(room && room.id || '') === 'room_salon');
            H.assert(String(kitchen && kitchen.projectStatus || '') === 'pomiar', 'Brudny roomRegistry nadpisał status aktywnego pokoju', investor && investor.rooms);
            H.assert(String(salon && salon.projectStatus || '') === 'nowy', 'Brudny roomRegistry nadpisał status innego pokoju projektu', investor && investor.rooms);
            H.assert(project && String(project.status || '') === 'pomiar', 'Brudny roomRegistry nadpisał zagregowany status projectStore', project);
          } finally {
            FC.roomRegistry.getActiveRoomDefs = prevGetActiveRoomDefs;
            FC.roomRegistry.getActiveRoomIds = prevGetActiveRoomIds;
          }
        });
      }),

    H.makeTest('Wycena ↔ Centralny status', 'Sprzątanie ETAPU 3 nie wraca do starego lokalnego patchowania statusów', 'Pilnuje ETAP 3: wejścia statusów nie mają już po centralizacji dopalać starej ścieżki updateInvestorRoom jako drugiego mechanizmu zapisu.', ()=>{
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.setInvestorRoomStatus === 'function', 'Brak FC.projectStatusSync.setInvestorRoomStatus');
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.setStatusFromSnapshot === 'function', 'Brak FC.projectStatusSync.setStatusFromSnapshot');
        H.assert(FC.investorPersistence && typeof FC.investorPersistence.updateInvestorRoom === 'function', 'Brak FC.investorPersistence.updateInvestorRoom');
        const prevUpdateInvestorRoom = FC.investorPersistence.updateInvestorRoom;
        let fallbackCalls = 0;
        FC.investorPersistence.updateInvestorRoom = function(){
          fallbackCalls += 1;
          return prevUpdateInvestorRoom.apply(this, arguments);
        };
        try{
          withInvestorProjectFixture({}, ({ investorId, projectId })=>{
            const prelim = FC.quoteSnapshotStore.save({ id:'snap_cleanup_pre', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt cleanup' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Cleanup pre' }, totals:{ grand:101 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820285000 });
            FC.quoteSnapshotStore.markSelectedForProject(projectId, prelim.id, { status:'pomiar', roomIds:['room_kuchnia_gora'] });
            FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_kuchnia_gora', 'pomiar');
            FC.wycenaTabDebug.setProjectStatusFromSnapshot(prelim, 'pomiar', { syncSelection:true });
          });
          H.assert(fallbackCalls === 0, 'Po sprzątaniu statusów wróciło stare lokalne patchowanie updateInvestorRoom', { fallbackCalls });
        } finally {
          FC.investorPersistence.updateInvestorRoom = prevUpdateInvestorRoom;
        }
      }),

    H.makeTest('Wycena ↔ Centralny status', 'Sprzątanie ETAPU 4 nie wraca do lokalnej akceptacji oferty', 'Pilnuje ETAP 4: gdy zabraknie dedykowanego helpera akceptacji, Wycena nie może wrócić do starego lokalnego zaznaczania snapshotu i zapisu statusów bokiem.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.commitAcceptedSnapshotWithSync === 'function', 'Brak FC.wycenaTabDebug.commitAcceptedSnapshotWithSync');
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.setStatusFromSnapshot === 'function', 'Brak FC.projectStatusSync.setStatusFromSnapshot');
        const prevCommit = FC.projectStatusSync.commitAcceptedSnapshot;
        const prevMarkSelected = FC.quoteSnapshotStore && FC.quoteSnapshotStore.markSelectedForProject;
        const prevUpsert = FC.projectStore && FC.projectStore.upsert;
        const prevSave = FC.project && FC.project.save;
        let markSelectedCalls = 0;
        let upsertCalls = 0;
        let saveCalls = 0;
        FC.projectStatusSync.commitAcceptedSnapshot = null;
        if(prevMarkSelected) FC.quoteSnapshotStore.markSelectedForProject = function(){ markSelectedCalls += 1; return prevMarkSelected.apply(this, arguments); };
        if(prevUpsert) FC.projectStore.upsert = function(){ upsertCalls += 1; return prevUpsert.apply(this, arguments); };
        if(prevSave) FC.project.save = function(){ saveCalls += 1; return prevSave.apply(this, arguments); };
        try{
          withInvestorProjectFixture({}, ({ investorId, projectId })=>{
            const snapshot = FC.quoteSnapshotStore.save({ id:'snap_cleanup_accept_fallback', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt cleanup accept fallback' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Cleanup accept fallback' }, totals:{ grand:141 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820292500 });
            const result = withMutedExpectedWarnings('Brak FC.projectStatusSync.commitAcceptedSnapshot', ()=> FC.wycenaTabDebug.commitAcceptedSnapshotWithSync(snapshot, 'pomiar'));
            H.assert(result === null, 'Po sprzątaniu ETAPU 4 akceptacja bez helpera powinna się zatrzymać zamiast uruchomić stary fallback', result);
          });
          H.assert(markSelectedCalls === 0, 'Wróciło stare lokalne markSelectedForProject w Wycena', { markSelectedCalls, upsertCalls, saveCalls });
          H.assert(upsertCalls === 0, 'Wrócił stary lokalny zapis projectStore przy akceptacji', { markSelectedCalls, upsertCalls, saveCalls });
          H.assert(saveCalls === 0, 'Wrócił stary lokalny zapis session projektu przy akceptacji', { markSelectedCalls, upsertCalls, saveCalls });
        } finally {
          FC.projectStatusSync.commitAcceptedSnapshot = prevCommit;
          if(prevMarkSelected) FC.quoteSnapshotStore.markSelectedForProject = prevMarkSelected;
          if(prevUpsert) FC.projectStore.upsert = prevUpsert;
          if(prevSave) FC.project.save = prevSave;
        }
      }),

    H.makeTest('Wycena ↔ Centralny status', 'Sprzątanie ETAPU 4 nie wraca do ogólnej rekonsyliacji po usunięciu snapshotu', 'Pilnuje ETAP 4: brak dedykowanego helpera usuwania nie może odpalić starej bocznej ścieżki reconcileProjectStatuses z Wycena.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.reconcileAfterSnapshotRemoval === 'function', 'Brak FC.wycenaTabDebug.reconcileAfterSnapshotRemoval');
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.reconcileProjectStatuses === 'function', 'Brak FC.projectStatusSync.reconcileProjectStatuses');
        const prevDedicated = FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval;
        const prevGeneric = FC.projectStatusSync.reconcileProjectStatuses;
        let genericCalls = 0;
        FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval = null;
        FC.projectStatusSync.reconcileProjectStatuses = function(){ genericCalls += 1; return prevGeneric.apply(this, arguments); };
        try{
          withInvestorProjectFixture({}, ({ investorId, projectId })=>{
            const snapshot = FC.quoteSnapshotStore.save({ id:'snap_cleanup_remove_fallback', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt cleanup remove fallback' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:false, versionName:'Cleanup remove fallback' }, totals:{ grand:151 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820292600 });
            const result = withMutedExpectedWarnings('Brak FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval', ()=> FC.wycenaTabDebug.reconcileAfterSnapshotRemoval(snapshot, { refreshUi:false }));
            H.assert(result === null, 'Po sprzątaniu ETAPU 4 brak helpera usuwania powinien zatrzymać flow zamiast wejść w stary generic reconcile', result);
          });
          H.assert(genericCalls === 0, 'Wróciło stare wywołanie reconcileProjectStatuses z Wycena', { genericCalls });
        } finally {
          FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval = prevDedicated;
          FC.projectStatusSync.reconcileProjectStatuses = prevGeneric;
        }
      }),

    H.makeTest('Wycena ↔ Centralny status', 'Sprzątanie ETAPU 4 nie wraca do lokalnej konwersji wstępnej oferty', 'Pilnuje ETAP 4: brak helpera konwersji nie może uruchamiać starego convertPreliminaryToFinal i ręcznego zapisu statusów z Wycena.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.promotePreliminarySnapshotToFinal === 'function', 'Brak FC.wycenaTabDebug.promotePreliminarySnapshotToFinal');
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.setStatusFromSnapshot === 'function', 'Brak FC.projectStatusSync.setStatusFromSnapshot');
        const prevPromote = FC.projectStatusSync.promotePreliminarySnapshotToFinal;
        const prevConvert = FC.quoteSnapshotStore && FC.quoteSnapshotStore.convertPreliminaryToFinal;
        const prevUpsert = FC.projectStore && FC.projectStore.upsert;
        const prevSave = FC.project && FC.project.save;
        let convertCalls = 0;
        let upsertCalls = 0;
        let saveCalls = 0;
        FC.projectStatusSync.promotePreliminarySnapshotToFinal = null;
        if(prevConvert) FC.quoteSnapshotStore.convertPreliminaryToFinal = function(){ convertCalls += 1; return prevConvert.apply(this, arguments); };
        if(prevUpsert) FC.projectStore.upsert = function(){ upsertCalls += 1; return prevUpsert.apply(this, arguments); };
        if(prevSave) FC.project.save = function(){ saveCalls += 1; return prevSave.apply(this, arguments); };
        try{
          withInvestorProjectFixture({}, ({ investorId, projectId })=>{
            const snapshot = FC.quoteSnapshotStore.save({ id:'snap_cleanup_convert_fallback', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt cleanup convert fallback' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Cleanup convert fallback' }, totals:{ grand:161 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820292700, meta:{ selectedByClient:true, acceptedAt:1712820292700, acceptedStage:'pomiar', preliminary:true } });
            const result = withMutedExpectedWarnings('Brak FC.projectStatusSync.promotePreliminarySnapshotToFinal', ()=> FC.wycenaTabDebug.promotePreliminarySnapshotToFinal(snapshot));
            H.assert(result === null, 'Po sprzątaniu ETAPU 4 brak helpera konwersji powinien zatrzymać flow zamiast uruchomić stary fallback', result);
          });
          H.assert(convertCalls === 0, 'Wróciło stare lokalne convertPreliminaryToFinal w Wycena', { convertCalls, upsertCalls, saveCalls });
          H.assert(upsertCalls === 0, 'Wrócił stary lokalny zapis projectStore przy konwersji', { convertCalls, upsertCalls, saveCalls });
          H.assert(saveCalls === 0, 'Wrócił stary lokalny zapis session projektu przy konwersji', { convertCalls, upsertCalls, saveCalls });
        } finally {
          FC.projectStatusSync.promotePreliminarySnapshotToFinal = prevPromote;
          if(prevConvert) FC.quoteSnapshotStore.convertPreliminaryToFinal = prevConvert;
          if(prevUpsert) FC.projectStore.upsert = prevUpsert;
          if(prevSave) FC.project.save = prevSave;
        }
      }),

    H.makeTest('Wycena ↔ Silnik statusów', 'Wycena deleguje akceptację oferty do centralnego sync', 'Pilnuje mini-paczkę 3: moduł Wycena nie powinien sam sklejać akceptacji snapshotu, tylko przekazać ją do project-status-sync.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.commitAcceptedSnapshotWithSync === 'function', 'Brak FC.wycenaTabDebug.commitAcceptedSnapshotWithSync');
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.commitAcceptedSnapshot === 'function', 'Brak FC.projectStatusSync.commitAcceptedSnapshot');
        const prev = FC.projectStatusSync.commitAcceptedSnapshot;
        let calls = 0;
        FC.projectStatusSync.commitAcceptedSnapshot = function(){
          calls += 1;
          return prev.apply(this, arguments);
        };
        try{
          withInvestorProjectFixture({}, ({ investorId, projectId })=>{
            const snapshot = FC.quoteSnapshotStore.save({ id:'snap_delegate_accept', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt delegate accept' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Delegate accept' }, totals:{ grand:111 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820290000 });
            FC.wycenaTabDebug.commitAcceptedSnapshotWithSync(snapshot, 'pomiar');
          });
          H.assert(calls === 1, 'Wycena nie przekazała akceptacji snapshotu do centralnego sync', { calls });
        } finally {
          FC.projectStatusSync.commitAcceptedSnapshot = prev;
        }
      }),

    H.makeTest('Wycena ↔ Silnik statusów', 'Wycena deleguje rekonsyliację po usunięciu oferty do centralnego sync', 'Pilnuje mini-paczkę 3: po usunięciu snapshotu to centralny sync ma policzyć wynik statusu scope, a nie lokalny kod w Wycena.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.reconcileAfterSnapshotRemoval === 'function', 'Brak FC.wycenaTabDebug.reconcileAfterSnapshotRemoval');
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval === 'function', 'Brak FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval');
        const prev = FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval;
        let calls = 0;
        FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval = function(){
          calls += 1;
          return prev.apply(this, arguments);
        };
        try{
          withInvestorProjectFixture({}, ({ investorId, projectId })=>{
            const snapshot = FC.quoteSnapshotStore.save({ id:'snap_delegate_remove', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt delegate remove' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:false, versionName:'Delegate remove' }, totals:{ grand:119 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820291000 });
            FC.wycenaTabDebug.reconcileAfterSnapshotRemoval(snapshot, { refreshUi:false });
          });
          H.assert(calls === 1, 'Wycena nie przekazała rekonsyliacji po usunięciu do centralnego sync', { calls });
        } finally {
          FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval = prev;
        }
      }),

    H.makeTest('Wycena ↔ Silnik statusów', 'Wycena deleguje konwersję wstępnej oferty do centralnego sync', 'Pilnuje mini-paczkę 3: przejście z zaakceptowanej wstępnej oferty na końcową nie powinno być klejone lokalnie w Wycena.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.promotePreliminarySnapshotToFinal === 'function', 'Brak FC.wycenaTabDebug.promotePreliminarySnapshotToFinal');
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.promotePreliminarySnapshotToFinal === 'function', 'Brak FC.projectStatusSync.promotePreliminarySnapshotToFinal');
        const prev = FC.projectStatusSync.promotePreliminarySnapshotToFinal;
        let calls = 0;
        FC.projectStatusSync.promotePreliminarySnapshotToFinal = function(){
          calls += 1;
          return prev.apply(this, arguments);
        };
        try{
          withInvestorProjectFixture({}, ({ investorId, projectId })=>{
            const snapshot = FC.quoteSnapshotStore.save({ id:'snap_delegate_convert', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt delegate convert' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Delegate convert' }, totals:{ grand:129 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820292000, meta:{ selectedByClient:true, acceptedAt:1712820292000, acceptedStage:'pomiar', preliminary:true } });
            FC.wycenaTabDebug.promotePreliminarySnapshotToFinal(snapshot);
          });
          H.assert(calls === 1, 'Wycena nie przekazała konwersji wstępnej oferty do centralnego sync', { calls });
        } finally {
          FC.projectStatusSync.promotePreliminarySnapshotToFinal = prev;
        }
      }),

    H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Akceptacja oferty jednego pomieszczenia zmienia status tylko tego pokoju', 'Pilnuje, czy zaakceptowanie wyceny scoped do jednego pomieszczenia nie nadpisuje statusów pozostałych pokoi inwestora.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.setProjectStatusFromSnapshot === 'function', 'Brak FC.wycenaTabDebug.setProjectStatusFromSnapshot');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const snapshot = FC.quoteSnapshotStore.save({
            id:'snap_room_only_pre',
            investor:{ id:investorId },
            project:{ id:projectId, investorId, title:'Projekt scoped' },
            scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'], materialScopeMode:'both', materialScope:{ includeFronts:true, includeCorpus:true } },
            commercial:{ preliminary:true, versionName:'Wstępna kuchnia' },
            totals:{ grand:100 },
            lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            generatedAt:1712820300000,
          });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, snapshot.id, { status:'pomiar' });
          FC.wycenaTabDebug.setProjectStatusFromSnapshot(snapshot, 'pomiar');
          const investor = FC.investors.getById(investorId);
          const kitchen = (investor.rooms || []).find((room)=> String(room && room.id || '') === 'room_kuchnia_gora');
          const salon = (investor.rooms || []).find((room)=> String(room && room.id || '') === 'room_salon');
          const project = FC.projectStore.getById(projectId);
          H.assert(String(kitchen && kitchen.projectStatus || '') === 'pomiar', 'Pokój objęty wyceną nie dostał statusu pomiar', investor.rooms);
          H.assert(String(salon && salon.projectStatus || '') === 'nowy', 'Status drugiego pokoju został nadpisany mimo że wycena go nie obejmowała', investor.rooms);
          H.assert(project && String(project.status || '') === 'pomiar', 'Zagregowany status projektu nie przeszedł na pomiar po akceptacji scoped wyceny', project);
        });
      }),

    H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Wspólna wycena aktualizuje tylko pokoje ze swojego zakresu', 'Pilnuje, czy wycena obejmująca kilka wybranych pomieszczeń aktualizuje tylko te pokoje, a nie cały projekt w ciemno.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.setProjectStatusFromSnapshot === 'function', 'Brak FC.wycenaTabDebug.setProjectStatusFromSnapshot');
        withInvestorProjectFixture({
          rooms:[
            { id:'room_kuchnia_gora', baseType:'kuchnia', name:'Kuchnia góra', label:'Kuchnia góra', projectStatus:'nowy' },
            { id:'room_salon', baseType:'pokoj', name:'Salon', label:'Salon', projectStatus:'nowy' },
            { id:'room_lazienka', baseType:'lazienka', name:'Łazienka', label:'Łazienka', projectStatus:'nowy' },
          ],
          projectData:{
            schemaVersion:2,
            meta:{
              roomDefs:{
                room_kuchnia_gora:{ id:'room_kuchnia_gora', baseType:'kuchnia', name:'Kuchnia góra', label:'Kuchnia góra' },
                room_salon:{ id:'room_salon', baseType:'pokoj', name:'Salon', label:'Salon' },
                room_lazienka:{ id:'room_lazienka', baseType:'lazienka', name:'Łazienka', label:'Łazienka' },
              },
              roomOrder:['room_kuchnia_gora','room_salon','room_lazienka'],
            },
            room_kuchnia_gora:{ cabinets:[{ id:'cab_k' }], fronts:[], sets:[], settings:{} },
            room_salon:{ cabinets:[{ id:'cab_s' }], fronts:[], sets:[], settings:{} },
            room_lazienka:{ cabinets:[{ id:'cab_l' }], fronts:[], sets:[], settings:{} },
          }
        }, ({ investorId, projectId })=>{
          const snapshot = FC.quoteSnapshotStore.save({
            id:'snap_shared_final',
            investor:{ id:investorId },
            project:{ id:projectId, investorId, title:'Projekt shared' },
            scope:{ selectedRooms:['room_kuchnia_gora','room_salon'], roomLabels:['Kuchnia góra','Salon'], materialScopeMode:'both', materialScope:{ includeFronts:true, includeCorpus:true } },
            commercial:{ preliminary:false, versionName:'Oferta wspólna' },
            totals:{ grand:250 },
            lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            generatedAt:1712820400000,
          });
          FC.wycenaTabDebug.setProjectStatusFromSnapshot(snapshot, 'wycena');
          const investor = FC.investors.getById(investorId);
          const byId = Object.fromEntries((investor.rooms || []).map((room)=> [String(room && room.id || ''), room]));
          H.assert(String(byId.room_kuchnia_gora && byId.room_kuchnia_gora.projectStatus || '') === 'wycena', 'Pierwszy pokój ze wspólnej wyceny nie dostał statusu wycena', investor.rooms);
          H.assert(String(byId.room_salon && byId.room_salon.projectStatus || '') === 'wycena', 'Drugi pokój ze wspólnej wyceny nie dostał statusu wycena', investor.rooms);
          H.assert(String(byId.room_lazienka && byId.room_lazienka.projectStatus || '') === 'nowy', 'Pokój spoza wspólnej wyceny dostał status mimo braku w zakresie', investor.rooms);
        });
      }),

    H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Zmiana zaakceptowanej wyceny wspólnej na jednopomieszczeniową cofa pozostałe pokoje', 'Pilnuje regresję, w której po przełączeniu akceptacji z wyceny wspólnej na wycenę jednego pokoju inne pomieszczenia błędnie zostawały na statusie pomiar.', ()=>{
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.markSelectedForProject === 'function', 'Brak FC.quoteSnapshotStore.markSelectedForProject');
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.setProjectStatusFromSnapshot === 'function', 'Brak FC.wycenaTabDebug.setProjectStatusFromSnapshot');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const sharedPre = FC.quoteSnapshotStore.save({ id:'snap_shared_pre', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt przełączenie' }, scope:{ selectedRooms:['room_kuchnia_gora','room_salon'], roomLabels:['Kuchnia góra','Salon'] }, commercial:{ preliminary:true, versionName:'Wspólna pre' }, totals:{ grand:210 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820450000 });
          const kitchenPre = FC.quoteSnapshotStore.save({ id:'snap_kitchen_pre_only', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt przełączenie' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Kuchnia pre' }, totals:{ grand:105 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820460000 });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, sharedPre.id, { status:'pomiar' });
          FC.wycenaTabDebug.setProjectStatusFromSnapshot(sharedPre, 'pomiar');
          FC.quoteSnapshotStore.markSelectedForProject(projectId, kitchenPre.id, { status:'pomiar' });
          FC.wycenaTabDebug.setProjectStatusFromSnapshot(kitchenPre, 'pomiar');
          const investor = FC.investors.getById(investorId);
          const byId = Object.fromEntries((investor.rooms || []).map((room)=> [String(room && room.id || ''), room]));
          H.assert(String(byId.room_kuchnia_gora && byId.room_kuchnia_gora.projectStatus || '') === 'pomiar', 'Pokój z nowo zaakceptowaną wyceną jednopomieszczeniową stracił status pomiar', investor.rooms);
          H.assert(String(byId.room_salon && byId.room_salon.projectStatus || '') === 'nowy', 'Pokój zdjęty z akceptacji nie wrócił do wcześniejszego stanu, gdy nie ma własnej wyceny solo', { rooms:investor.rooms, all:FC.quoteSnapshotStore.listForProject(projectId) });
        });
      }),

    H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Po rozpięciu wspólnej akceptacji pokój z własną wyceną solo wraca do wstępnej wyceny', 'Pilnuje, czy po odpięciu wspólnej oferty system wraca dla pokoju do jego własnej historii solo, zamiast trzymać status po starej wycenie wspólnej albo cofać go za daleko.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.setProjectStatusFromSnapshot === 'function', 'Brak FC.wycenaTabDebug.setProjectStatusFromSnapshot');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const sharedPre = FC.quoteSnapshotStore.save({ id:'snap_shared_pre_restore', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt przywrócenie' }, scope:{ selectedRooms:['room_kuchnia_gora','room_salon'], roomLabels:['Kuchnia góra','Salon'] }, commercial:{ preliminary:true, versionName:'Wspólna pre' }, totals:{ grand:210 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820465000 });
          const kitchenPre = FC.quoteSnapshotStore.save({ id:'snap_kitchen_pre_restore', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt przywrócenie' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Kuchnia pre' }, totals:{ grand:105 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820466000 });
          const salonPre = FC.quoteSnapshotStore.save({ id:'snap_salon_pre_restore', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt przywrócenie' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Salon pre' }, totals:{ grand:115 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820467000 });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, sharedPre.id, { status:'pomiar' });
          FC.wycenaTabDebug.setProjectStatusFromSnapshot(sharedPre, 'pomiar');
          FC.quoteSnapshotStore.markSelectedForProject(projectId, kitchenPre.id, { status:'pomiar' });
          FC.wycenaTabDebug.setProjectStatusFromSnapshot(kitchenPre, 'pomiar');
          const investor = FC.investors.getById(investorId);
          const byId = Object.fromEntries((investor.rooms || []).map((room)=> [String(room && room.id || ''), room]));
          H.assert(String(byId.room_kuchnia_gora && byId.room_kuchnia_gora.projectStatus || '') === 'pomiar', 'Pokój z nowo zaakceptowaną wyceną solo stracił status pomiar', investor.rooms);
          H.assert(String(byId.room_salon && byId.room_salon.projectStatus || '') === 'wstepna_wycena', 'Pokój z własną wyceną solo nie wrócił do wstępnej wyceny po odpięciu wspólnej akceptacji', { rooms:investor.rooms, all:FC.quoteSnapshotStore.listForProject(projectId), salonPre });
        });
      }),

    H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Rozbicie wspólnej akceptacji odrzuca ofertę wspólną i odblokowuje solo wstępne', 'Pilnuje, czy po cofnięciu jednego pokoju z zaakceptowanej oferty wspólnej stara oferta wspólna traci akceptację jako odrzucona po zmianie zakresu, a solo wstępna wraca jako aktywny kandydat.', ()=>{
        H.assert(FC.investorPersistence && typeof FC.investorPersistence.setInvestorProjectStatus === 'function', 'Brak FC.investorPersistence.setInvestorProjectStatus');
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.isRejectedSnapshot === 'function', 'Brak FC.quoteSnapshotStore.isRejectedSnapshot');
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.isArchivedPreliminary === 'function', 'Brak FC.wycenaTabDebug.isArchivedPreliminary');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const sharedPre = FC.quoteSnapshotStore.save({ id:'snap_shared_pre_reject', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt reject' }, scope:{ selectedRooms:['room_kuchnia_gora','room_salon'], roomLabels:['Kuchnia góra','Salon'] }, commercial:{ preliminary:true, versionName:'Wspólna pre' }, totals:{ grand:230 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820472000 });
          const salonPre = FC.quoteSnapshotStore.save({ id:'snap_salon_pre_reject', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt reject' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Salon pre' }, totals:{ grand:117 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820473000 });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, sharedPre.id, { status:'pomiar' });
          FC.wycenaTabDebug.setProjectStatusFromSnapshot(sharedPre, 'pomiar');
          FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_kuchnia_gora', 'wstepna_wycena');
          const all = FC.quoteSnapshotStore.listForProject(projectId);
          const sharedAfter = all.find((row)=> String(row && row.id || '') === 'snap_shared_pre_reject');
          const salonAfter = all.find((row)=> String(row && row.id || '') === 'snap_salon_pre_reject');
          const investor = FC.investors.getById(investorId);
          const byId = Object.fromEntries((investor.rooms || []).map((room)=> [String(room && room.id || ''), room]));
          H.assert(sharedAfter && sharedAfter.meta && sharedAfter.meta.selectedByClient === false, 'Wspólna oferta nadal wisi jako zaakceptowana po rozbiciu zakresu', sharedAfter || all);
          H.assert(sharedAfter && FC.quoteSnapshotStore.isRejectedSnapshot(sharedAfter) === true && String(sharedAfter.meta && sharedAfter.meta.rejectedReason || '') === 'scope_changed', 'Wspólna oferta nie została oznaczona jako odrzucona po zmianie zakresu', sharedAfter || all);
          H.assert(salonAfter && FC.wycenaTabDebug.isArchivedPreliminary(salonAfter, all) === false && FC.quoteSnapshotStore.isRejectedSnapshot(salonAfter) === false, 'Solo wycena wstępna nadal jest zablokowana mimo odrzucenia wspólnej oferty', { salonAfter, all });
          H.assert(String(byId.room_kuchnia_gora && byId.room_kuchnia_gora.projectStatus || '') === 'wstepna_wycena', 'Pokój cofnięty z oferty wspólnej nie wrócił do statusu wstępnej wyceny', investor.rooms);
          H.assert(String(byId.room_salon && byId.room_salon.projectStatus || '') === 'wstepna_wycena', 'Drugi pokój nie wrócił do własnej historii solo po odrzuceniu wspólnej oferty', investor.rooms);
        });
      }),

    H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Status wyceny scoped nie zależy od pierwszego pokoju inwestora', 'Pilnuje, czy odczyt statusu oferty bierze pokoje z zakresu snapshotu zamiast przypadkowego pierwszego pomieszczenia inwestora.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.currentProjectStatus === 'function', 'Brak FC.wycenaTabDebug.currentProjectStatus');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const salonPre = FC.quoteSnapshotStore.save({
            id:'snap_scope_status_pre',
            investor:{ id:investorId },
            project:{ id:projectId, investorId, title:'Projekt fallback' },
            scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'], materialScopeMode:'both', materialScope:{ includeFronts:true, includeCorpus:true } },
            commercial:{ preliminary:true, versionName:'Salon pomiar' },
            totals:{ grand:90 },
            lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            generatedAt:1712820495000,
          });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, salonPre.id, { status:'pomiar', roomIds:['room_salon'] });
          FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_salon', 'pomiar');
          const snapshot = FC.quoteSnapshotStore.save({
            id:'snap_scope_status',
            investor:{ id:investorId },
            project:{ id:projectId, investorId, title:'Projekt fallback' },
            scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'], materialScopeMode:'both', materialScope:{ includeFronts:true, includeCorpus:true } },
            commercial:{ preliminary:true, versionName:'Salon pomiar' },
            totals:{ grand:90 },
            lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            generatedAt:1712820500000,
          });
          const status = FC.wycenaTabDebug.currentProjectStatus(snapshot);
          H.assert(String(status || '') === 'pomiar', 'Status scoped oferty wrócił do pierwszego pokoju albo złego fallbacku zamiast do właściwego pomieszczenia', { status, investor:FC.investors.getById(investorId), snapshot });
        });
      }),

    H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Akceptacja solo pokoju nie odrzuca zaakceptowanej oferty innego solo pokoju', 'Pilnuje, czy akceptacja wyceny dla jednego pokoju nie odrzuca ani nie zdejmuje akceptacji z innego, rozłącznego scope projektu.', ()=>{
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.markSelectedForProject === 'function', 'Brak FC.quoteSnapshotStore.markSelectedForProject');
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getSelectedForProject === 'function', 'Brak FC.quoteSnapshotStore.getSelectedForProject');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const kitchenPre = FC.quoteSnapshotStore.save({ id:'snap_multi_accept_kitchen', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt multi accept' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Kuchnia pre multi' }, totals:{ grand:111 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820800000 });
          const salonPre = FC.quoteSnapshotStore.save({ id:'snap_multi_accept_salon', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt multi accept' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Salon pre multi' }, totals:{ grand:129 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820801000 });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, kitchenPre.id, { status:'pomiar', roomIds:['room_kuchnia_gora'] });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, salonPre.id, { status:'pomiar', roomIds:['room_salon'] });
          const all = FC.quoteSnapshotStore.listForProject(projectId);
          const kitchenAfter = all.find((row)=> String(row && row.id || '') === 'snap_multi_accept_kitchen');
          const salonAfter = all.find((row)=> String(row && row.id || '') === 'snap_multi_accept_salon');
          const selectedKitchen = FC.quoteSnapshotStore.getSelectedForProject(projectId, { roomIds:['room_kuchnia_gora'] });
          const selectedSalon = FC.quoteSnapshotStore.getSelectedForProject(projectId, { roomIds:['room_salon'] });
          H.assert(kitchenAfter && kitchenAfter.meta && kitchenAfter.meta.selectedByClient === true, 'Akceptacja salonu zdjęła akceptację z rozłącznej oferty kuchni', kitchenAfter || all);
          H.assert(salonAfter && salonAfter.meta && salonAfter.meta.selectedByClient === true, 'Oferta salonu nie została zaznaczona jako zaakceptowana', salonAfter || all);
          H.assert(kitchenAfter && FC.quoteSnapshotStore.isRejectedSnapshot(kitchenAfter) === false, 'Akceptacja salonu odrzuciła rozłączną ofertę kuchni', kitchenAfter || all);
          H.assert(selectedKitchen && String(selectedKitchen.id || '') === String(kitchenPre.id || ''), 'Scoped getSelectedForProject nie zwrócił zaakceptowanej oferty kuchni', { selectedKitchen, all });
          H.assert(selectedSalon && String(selectedSalon.id || '') === String(salonPre.id || ''), 'Scoped getSelectedForProject nie zwrócił zaakceptowanej oferty salonu', { selectedSalon, all });
        });
      }),

    H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Akceptacja solo pokoju nie nadpisuje statusu snapshotów rozłącznego scope', 'Pilnuje regresję po hotfixie multi-scope: zaznaczenie oferty dla pokoju A nie może zmieniać project.status wpisanego we snapshot pokoju B tylko dlatego, że oba siedzą pod jednym projectId.', ()=>{
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.markSelectedForProject === 'function', 'Brak FC.quoteSnapshotStore.markSelectedForProject');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const kitchenPre = FC.quoteSnapshotStore.save({ id:'snap_multi_status_kitchen', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt multi status' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Kuchnia status multi' }, totals:{ grand:111 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820802000 });
          const salonPre = FC.quoteSnapshotStore.save({ id:'snap_multi_status_salon', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt multi status' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Salon status multi' }, totals:{ grand:129 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820803000 });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, kitchenPre.id, { status:'pomiar', roomIds:['room_kuchnia_gora'] });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, salonPre.id, { status:'pomiar', roomIds:['room_salon'] });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, kitchenPre.id, { status:'pomiar', roomIds:['room_kuchnia_gora'] });
          const all = FC.quoteSnapshotStore.listForProject(projectId);
          const salonAfter = all.find((row)=> String(row && row.id || '') === 'snap_multi_status_salon');
          H.assert(String(salonAfter && salonAfter.project && salonAfter.project.status || '') === 'pomiar', 'Akceptacja kuchni nadpisała status snapshotu rozłącznego salonu', salonAfter || all);
          H.assert(salonAfter && salonAfter.meta && salonAfter.meta.selectedByClient === true, 'Akceptacja kuchni zdjęła zaznaczenie z rozłącznego salonu', salonAfter || all);
        });
      }),

    H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Konwersja wstępnej oferty do końcowej nie zdejmuje akceptacji z innego solo pokoju', 'Pilnuje regresję z filmu: przejście pokoju A z pomiaru do oferty końcowej nie może wyczyścić zaakceptowanej oferty pokoju B, jeśli scope są rozłączne.', ()=>{
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.convertPreliminaryToFinal === 'function', 'Brak FC.quoteSnapshotStore.convertPreliminaryToFinal');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const kitchenPre = FC.quoteSnapshotStore.save({ id:'snap_convert_multi_kitchen', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt convert multi' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Kuchnia convert multi' }, totals:{ grand:111 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820804000, meta:{ selectedByClient:true, acceptedAt:1712820804500, acceptedStage:'pomiar', preliminary:true } });
          const salonPre = FC.quoteSnapshotStore.save({ id:'snap_convert_multi_salon', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt convert multi' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Salon convert multi' }, totals:{ grand:129 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820805000, meta:{ selectedByClient:true, acceptedAt:1712820805500, acceptedStage:'pomiar', preliminary:true } });
          const converted = FC.quoteSnapshotStore.convertPreliminaryToFinal(projectId, kitchenPre.id);
          const all = FC.quoteSnapshotStore.listForProject(projectId);
          const kitchenAfter = all.find((row)=> String(row && row.id || '') === 'snap_convert_multi_kitchen');
          const salonAfter = all.find((row)=> String(row && row.id || '') === 'snap_convert_multi_salon');
          H.assert(converted && String(converted.id || '') === String(kitchenPre.id || ''), 'Konwersja kuchni nie zwróciła targetu', { converted, all });
          H.assert(kitchenAfter && kitchenAfter.meta && kitchenAfter.meta.selectedByClient === true && kitchenAfter.meta.preliminary === false, 'Konwersja kuchni nie ustawiła końcowej zaakceptowanej oferty', kitchenAfter || all);
          H.assert(salonAfter && salonAfter.meta && salonAfter.meta.selectedByClient === true, 'Konwersja kuchni zdjęła akceptację z rozłącznego salonu', salonAfter || all);
          H.assert(salonAfter && salonAfter.meta && salonAfter.meta.preliminary === true, 'Konwersja kuchni zmieniła typ rozłącznej oferty salonu', salonAfter || all);
          H.assert(String(salonAfter && salonAfter.project && salonAfter.project.status || '') !== 'zaakceptowany', 'Konwersja kuchni nadpisała status snapshotu rozłącznego salonu końcowym etapem kuchni', salonAfter || all);
        });
      }),

    H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Ręczna zmiana statusu pokoju wybiera tylko pasującą ofertę i nie rusza innych pokoi', 'Pilnuje, czy ręczne ustawienie statusu w Inwestor synchronizuje Wycena po zakresie pomieszczenia zamiast po dowolnej pierwszej ofercie projektu.', ()=>{
        H.assert(FC.investorPersistence && typeof FC.investorPersistence.setInvestorProjectStatus === 'function', 'Brak FC.investorPersistence.setInvestorProjectStatus');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const kitchenPre = FC.quoteSnapshotStore.save({ id:'snap_room_kitchen_pre', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt ręczny' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Kuchnia pre' }, totals:{ grand:100 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820600000 });
          const salonPre = FC.quoteSnapshotStore.save({ id:'snap_room_salon_pre', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt ręczny' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Salon pre' }, totals:{ grand:120 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820700000 });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, salonPre.id, { status:'pomiar', roomIds:['room_salon'] });
          FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_salon', 'pomiar');
          const investor = FC.investors.getById(investorId);
          const byId = Object.fromEntries((investor.rooms || []).map((room)=> [String(room && room.id || ''), room]));
          const selected = FC.quoteSnapshotStore.getSelectedForProject(projectId);
          H.assert(String(byId.room_kuchnia_gora && byId.room_kuchnia_gora.projectStatus || '') === 'wstepna_wycena', 'Ręczna zmiana statusu salonu zignorowała scoped historię kuchni albo nadpisała ją błędnym statusem', investor.rooms);
          H.assert(String(byId.room_salon && byId.room_salon.projectStatus || '') === 'pomiar', 'Ręczna zmiana statusu salonu nie zapisała się w docelowym pokoju', investor.rooms);
          H.assert(selected && String(selected.id || '') === String(salonPre.id || ''), 'Synchronizacja Wycena po ręcznej zmianie pokoju wybrała złą ofertę scoped', { selected, kitchenPre, salonPre, all:FC.quoteSnapshotStore.listForProject(projectId) });
        });
      }),

    H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Scoped rekomendacja statusu po usunięciu oferty nie opiera się na innych pokojach', 'Pilnuje, czy cofanie statusu po usunięciu oferty bierze tylko snapshoty z tego samego zakresu pomieszczeń, a nie oferty innych pokoi.', ()=>{
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getRecommendedStatusForProject === 'function', 'Brak FC.quoteSnapshotStore.getRecommendedStatusForProject');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          FC.quoteSnapshotStore.save({ id:'snap_scope_pre_k', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt scoped rec' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'K pre' }, totals:{ grand:100 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820800000 });
          FC.quoteSnapshotStore.save({ id:'snap_scope_final_s', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt scoped rec' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:false, versionName:'S final' }, totals:{ grand:200 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820900000 });
          const recommendedKitchen = FC.quoteSnapshotStore.getRecommendedStatusForProject(projectId, 'zaakceptowany', { roomIds:['room_kuchnia_gora'] });
          const recommendedSalon = FC.quoteSnapshotStore.getRecommendedStatusForProject(projectId, 'zaakceptowany', { roomIds:['room_salon'] });
          H.assert(String(recommendedKitchen || '') === 'wstepna_wycena', 'Scoped rekomendacja dla kuchni została zanieczyszczona ofertą z innego pokoju', { recommendedKitchen, all:FC.quoteSnapshotStore.listForProject(projectId) });
          H.assert(String(recommendedSalon || '') === 'wycena', 'Scoped rekomendacja dla salonu nie zachowała jego własnej oferty końcowej', { recommendedSalon, all:FC.quoteSnapshotStore.listForProject(projectId) });
        });
      })
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
