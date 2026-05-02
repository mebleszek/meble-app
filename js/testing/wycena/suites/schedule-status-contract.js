(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  if(!(FC.testHarness && typeof FC.registerWycenaTests === 'function')) return;

  FC.registerWycenaTests(({ FC, H, withInvestorProjectFixture })=> [
    H.makeTest('Wycena ↔ Harmonogram', 'Statusy Pomiar/Wycena budują kolejki przyszłego harmonogramu bez wyceny wstępnej', 'Pilnuje przyszłego harmonogramu: Pomiar oznacza zadanie pomiaru, Wycena oznacza wycenę końcową po pomiarze, także dla pokoju bez wyceny wstępnej i bez szafek.', ()=>{
      H.assert(FC.projectScheduleStatus && typeof FC.projectScheduleStatus.buildInvestorBuckets === 'function', 'Brak FC.projectScheduleStatus.buildInvestorBuckets');
      H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.commitAcceptedSnapshot === 'function', 'Brak FC.projectStatusSync.commitAcceptedSnapshot');
      const rooms = [
        { id:'room_a', baseType:'kuchnia', name:'A', label:'A', projectStatus:'nowy' },
        { id:'room_s', baseType:'pokoj', name:'S', label:'S', projectStatus:'nowy' },
        { id:'room_p', baseType:'pokoj', name:'P', label:'P', projectStatus:'nowy' },
      ];
      withInvestorProjectFixture({
        investorId:'inv_schedule_status',
        projectId:'proj_schedule_status',
        rooms,
        projectData:{
          schemaVersion:2,
          meta:{
            roomDefs:{
              room_a:{ id:'room_a', baseType:'kuchnia', name:'A', label:'A' },
              room_s:{ id:'room_s', baseType:'pokoj', name:'S', label:'S' },
              room_p:{ id:'room_p', baseType:'pokoj', name:'P', label:'P' },
            },
            roomOrder:['room_a','room_s','room_p'],
          },
          room_a:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} },
          room_s:{ cabinets:[{ id:'cab_s' }], fronts:[], sets:[], settings:{} },
          room_p:{ cabinets:[], fronts:[], sets:[], settings:{} },
        }
      }, ({ investorId, projectId })=>{
        const prelimA = FC.quoteSnapshotStore.save({
          id:'snap_schedule_prelim_a',
          investor:{ id:investorId },
          project:{ id:projectId, investorId, title:'Projekt harmonogramu' },
          scope:{ selectedRooms:['room_a'], roomLabels:['A'] },
          commercial:{ preliminary:true, versionName:'Wstępna A' },
          meta:{ preliminary:true, versionName:'Wstępna A' },
          totals:{ grand:120 },
          lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
          generatedAt:1712820472000,
        });
        FC.projectStatusSync.commitAcceptedSnapshot(prelimA, 'pomiar', { roomIds:['room_a'], refreshUi:false });
        FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_s', 'pomiar');
        FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_p', 'wycena');

        const buckets = FC.projectScheduleStatus.buildInvestorBuckets(investorId);
        const measureIds = buckets.measurement.map((row)=> row.roomId).sort();
        const quoteIds = buckets.finalQuote.map((row)=> row.roomId).sort();
        const entryA = buckets.measurement.find((row)=> row.roomId === 'room_a');
        const entryS = buckets.measurement.find((row)=> row.roomId === 'room_s');
        const entryP = buckets.finalQuote.find((row)=> row.roomId === 'room_p');

        H.assert(measureIds.join('|') === 'room_a|room_s', 'Kolejka pomiaru powinna zawierać pokój z zaakceptowaną wstępną i pokój manualny bez wstępnej', { buckets, measureIds });
        H.assert(quoteIds.join('|') === 'room_p', 'Kolejka wyceny końcowej powinna zawierać pokój bez wstępnej ustawiony ręcznie na Wycena', { buckets, quoteIds });
        H.assert(entryA && entryA.hasAcceptedPreliminary === true && String(entryA.source || '') === 'accepted_preliminary', 'Pokój A powinien mieć źródło zaakceptowanej wyceny wstępnej', entryA);
        H.assert(entryS && entryS.hasAcceptedPreliminary === false && String(entryS.source || '') === 'manual_without_preliminary', 'Pokój S powinien być ręcznym pomiarem bez wyceny wstępnej', entryS);
        H.assert(entryP && entryP.hasAcceptedPreliminary === false && entryP.needsFinalQuote === true && String(entryP.source || '') === 'manual_without_preliminary', 'Pokój P powinien czekać na wycenę końcową bez wyceny wstępnej', entryP);
        H.assert(entryP && entryP.quoteable === false && String(entryP.quoteBlockedReason || '') === 'Brak szafek', 'Harmonogram powinien widzieć, że pokój P czeka na wycenę, ale nie ma jeszcze szafek do kalkulacji', entryP);
      });
    }),

    H.makeTest('Wycena ↔ Harmonogram', 'Wspólna zaakceptowana wycena wstępna zachowuje jeden zakres źródłowy dla pomiaru', 'Pilnuje, czy pokoje objęte jedną zaakceptowaną ofertą A+S są widoczne jako zadania pomiaru z tym samym zakresem źródłowym, bez duplikowania oferty per pokój.', ()=>{
      H.assert(FC.projectScheduleStatus && typeof FC.projectScheduleStatus.buildInvestorBuckets === 'function', 'Brak FC.projectScheduleStatus.buildInvestorBuckets');
      withInvestorProjectFixture({}, ({ investorId, projectId })=>{
        const shared = FC.quoteSnapshotStore.save({
          id:'snap_schedule_shared_prelim',
          investor:{ id:investorId },
          project:{ id:projectId, investorId, title:'Projekt harmonogramu wspólny' },
          scope:{ selectedRooms:['room_kuchnia_gora','room_salon'], roomLabels:['Kuchnia góra','Salon'] },
          commercial:{ preliminary:true, versionName:'Wspólna A+S' },
          meta:{ preliminary:true, versionName:'Wspólna A+S' },
          totals:{ grand:250 },
          lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
          generatedAt:1712820473000,
        });
        FC.projectStatusSync.commitAcceptedSnapshot(shared, 'pomiar', { roomIds:['room_kuchnia_gora','room_salon'], refreshUi:false });
        const buckets = FC.projectScheduleStatus.buildInvestorBuckets(investorId);
        H.assert(buckets.measurement.length === 2, 'Wspólna zaakceptowana wstępna powinna dać dwa pokoje do pomiaru', buckets);
        buckets.measurement.forEach((entry)=>{
          H.assert(entry.hasAcceptedPreliminary === true, 'Każdy pokój ze wspólnej wstępnej powinien znać zaakceptowaną wycenę', entry);
          H.assert(entry.preliminaryScopeRoomIds.slice().sort().join('|') === 'room_kuchnia_gora|room_salon', 'Zakres źródłowej oferty wstępnej nie może zostać zgubiony', entry);
        });
      });
    }),
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
