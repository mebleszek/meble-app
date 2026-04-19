(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  if(!(FC.testHarness && typeof FC.registerWycenaTests === 'function')) return;

  function emptyLines(){
    return { materials:[], accessories:[], agdServices:[], quoteRates:[] };
  }

  function emptyTotals(){
    return { materials:0, accessories:0, services:0, quoteRates:0, subtotal:0, discount:0, grand:0 };
  }

  function saveScopedSnapshot(cfg){
    return FC.quoteSnapshotStore.save({
      id:String(cfg.id || ''),
      investor:{ id:String(cfg.investorId || ''), name:'Jan Test' },
      project:{ id:String(cfg.projectId || ''), investorId:String(cfg.investorId || ''), status:String(cfg.status || 'nowy') },
      scope:{ selectedRooms:[String(cfg.roomId || '')], roomLabels:[String(cfg.roomLabel || '')] },
      commercial:{ preliminary:!!cfg.preliminary, versionName:String(cfg.versionName || (cfg.preliminary ? 'Wstępna oferta' : 'Oferta końcowa')) },
      meta:{ preliminary:!!cfg.preliminary, versionName:String(cfg.versionName || (cfg.preliminary ? 'Wstępna oferta' : 'Oferta końcowa')) },
      lines:emptyLines(),
      totals:emptyTotals(),
      generatedAt:Number(cfg.generatedAt || Date.now()),
    });
  }

  FC.registerWycenaTests(({ FC, H, withInvestorProjectFixture })=> [
    H.makeTest('Wycena', 'Usunięcie zaakceptowanej końcowej oferty exact-scope przywraca tylko lokalny etap i nie rusza rozłącznego pokoju', 'Pilnuje, czy skasowanie wybranej końcowej oferty jednego pokoju nie zeruje rozłącznego pokoju i wraca tylko do aktywnej historii exact-scope tego pokoju.', ()=> withInvestorProjectFixture({
      investorId:'inv_delete_selected_final',
      projectId:'proj_delete_selected_final',
      rooms:[
        { id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'zaakceptowany' },
        { id:'room_b', baseType:'pokoj', name:'Salon B', label:'Salon B', projectStatus:'zaakceptowany' },
      ],
      status:'zaakceptowany',
      projectData:{
        schemaVersion:2,
        meta:{
          projectStatus:'zaakceptowany',
          roomDefs:{
            room_a:{ id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'zaakceptowany' },
            room_b:{ id:'room_b', baseType:'pokoj', name:'Salon B', label:'Salon B', projectStatus:'zaakceptowany' },
          },
          roomOrder:['room_a','room_b'],
        },
        room_a:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} },
        room_b:{ cabinets:[{ id:'cab_b' }], fronts:[], sets:[], settings:{} },
      }
    }, ({ investorId, projectId })=> {
      H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.commitAcceptedSnapshot === 'function', 'Brak FC.projectStatusSync.commitAcceptedSnapshot');
      H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval === 'function', 'Brak FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval');
      const prelimA = saveScopedSnapshot({ id:'snap_prelim_a_restore', investorId, projectId, roomId:'room_a', roomLabel:'Kuchnia A', preliminary:true, generatedAt:1713000000000, status:'wstepna_wycena' });
      const finalA = saveScopedSnapshot({ id:'snap_final_a_selected', investorId, projectId, roomId:'room_a', roomLabel:'Kuchnia A', preliminary:false, generatedAt:1713000100000, status:'wycena' });
      const finalB = saveScopedSnapshot({ id:'snap_final_b_selected', investorId, projectId, roomId:'room_b', roomLabel:'Salon B', preliminary:false, generatedAt:1713000200000, status:'wycena' });
      FC.projectStatusSync.commitAcceptedSnapshot(finalA, 'zaakceptowany', { roomIds:['room_a'], refreshUi:false });
      FC.projectStatusSync.commitAcceptedSnapshot(finalB, 'zaakceptowany', { roomIds:['room_b'], refreshUi:false });

      H.assert(FC.quoteSnapshotStore.remove(finalA.id) === true, 'Nie udało się usunąć zaakceptowanej końcowej oferty pokoju A', { finalA, all:FC.quoteSnapshotStore.listForProject(projectId) });
      const result = FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval(finalA, { roomIds:['room_a'], fallbackStatus:'nowy', refreshUi:false });
      const investor = FC.investors.getById(investorId);
      const roomA = investor && investor.rooms && investor.rooms.find((room)=> String(room && room.id || '') === 'room_a');
      const roomB = investor && investor.rooms && investor.rooms.find((room)=> String(room && room.id || '') === 'room_b');
      const selectedA = FC.quoteSnapshotStore.getSelectedForProject(projectId, { roomIds:['room_a'] });
      const selectedB = FC.quoteSnapshotStore.getSelectedForProject(projectId, { roomIds:['room_b'] });
      const restoredPrelimA = FC.quoteSnapshotStore.getById(prelimA.id);

      H.assert(result && String(result.masterStatus || '') === 'wstepna_wycena', 'Po usunięciu końcowej oferty pokój A nie wrócił do wstępnej wyceny z exact-scope', result);
      H.assert(roomA && String(roomA.projectStatus || '') === 'wstepna_wycena', 'Pokój A nie dostał statusu wstepna_wycena po usunięciu końcowej oferty', investor && investor.rooms);
      H.assert(roomB && String(roomB.projectStatus || '') === 'zaakceptowany', 'Rozłączny pokój B nie powinien zmieniać statusu po usunięciu oferty pokoju A', investor && investor.rooms);
      H.assert(selectedA == null, 'Po usunięciu końcowej oferty pokoju A nie powinno zostać zaznaczenie selectedByClient dla exact-scope A', { selectedA, all:FC.quoteSnapshotStore.listForProject(projectId) });
      H.assert(selectedB && String(selectedB.id || '') === String(finalB.id || ''), 'Rozłączny pokój B zgubił zaakceptowaną końcową ofertę po usunięciu oferty pokoju A', { selectedB, all:FC.quoteSnapshotStore.listForProject(projectId) });
      H.assert(restoredPrelimA && restoredPrelimA.meta && restoredPrelimA.meta.selectedByClient !== true && restoredPrelimA.meta.rejectedAt === 0, 'Aktywna wstępna historia pokoju A nie powinna zostać martwo odrzucona po usunięciu końcowej oferty', restoredPrelimA);
    })),

    H.makeTest('Wycena', 'Promocja zaakceptowanej wstępnej exact-scope do końcowej nie rusza wybranego drugiego pokoju', 'Pilnuje, czy konwersja wstępnej oferty do końcowej działa tylko w exact-scope pokoju i nie zdejmuje selectedByClient z rozłącznego pokoju.', ()=> withInvestorProjectFixture({
      investorId:'inv_promote_scope',
      projectId:'proj_promote_scope',
      rooms:[
        { id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'pomiar' },
        { id:'room_b', baseType:'pokoj', name:'Salon B', label:'Salon B', projectStatus:'zaakceptowany' },
      ],
      status:'pomiar',
      projectData:{
        schemaVersion:2,
        meta:{
          projectStatus:'pomiar',
          roomDefs:{
            room_a:{ id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'pomiar' },
            room_b:{ id:'room_b', baseType:'pokoj', name:'Salon B', label:'Salon B', projectStatus:'zaakceptowany' },
          },
          roomOrder:['room_a','room_b'],
        },
        room_a:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} },
        room_b:{ cabinets:[{ id:'cab_b' }], fronts:[], sets:[], settings:{} },
      }
    }, ({ investorId, projectId })=> {
      H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.commitAcceptedSnapshot === 'function', 'Brak FC.projectStatusSync.commitAcceptedSnapshot');
      H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.promotePreliminarySnapshotToFinal === 'function', 'Brak FC.projectStatusSync.promotePreliminarySnapshotToFinal');
      const prelimA = saveScopedSnapshot({ id:'snap_prelim_a_promote', investorId, projectId, roomId:'room_a', roomLabel:'Kuchnia A', preliminary:true, generatedAt:1713001000000, status:'wstepna_wycena' });
      const finalB = saveScopedSnapshot({ id:'snap_final_b_keep', investorId, projectId, roomId:'room_b', roomLabel:'Salon B', preliminary:false, generatedAt:1713001100000, status:'wycena' });
      FC.projectStatusSync.commitAcceptedSnapshot(prelimA, 'pomiar', { roomIds:['room_a'], refreshUi:false });
      FC.projectStatusSync.commitAcceptedSnapshot(finalB, 'zaakceptowany', { roomIds:['room_b'], refreshUi:false });

      const promoteResult = FC.projectStatusSync.promotePreliminarySnapshotToFinal(prelimA, { roomIds:['room_a'], refreshUi:false });
      const convertedA = FC.quoteSnapshotStore.getById(prelimA.id);
      const selectedA = FC.quoteSnapshotStore.getSelectedForProject(projectId, { roomIds:['room_a'] });
      const selectedB = FC.quoteSnapshotStore.getSelectedForProject(projectId, { roomIds:['room_b'] });
      const investor = FC.investors.getById(investorId);
      const roomA = investor && investor.rooms && investor.rooms.find((room)=> String(room && room.id || '') === 'room_a');
      const roomB = investor && investor.rooms && investor.rooms.find((room)=> String(room && room.id || '') === 'room_b');

      H.assert(promoteResult && promoteResult.snapshot, 'Promocja wstępnej oferty do końcowej nie zwróciła wyniku', promoteResult);
      H.assert(convertedA && convertedA.meta && convertedA.meta.preliminary === false && convertedA.meta.selectedByClient === true && String(convertedA.meta.acceptedStage || '') === 'zaakceptowany', 'Konwersja nie zamieniła wstępnej oferty pokoju A w zaakceptowaną końcową', convertedA);
      H.assert(selectedA && String(selectedA.id || '') === String(prelimA.id || ''), 'Pokój A zgubił własną ofertę przy promocji wstępnej do końcowej', { selectedA, all:FC.quoteSnapshotStore.listForProject(projectId) });
      H.assert(selectedB && String(selectedB.id || '') === String(finalB.id || ''), 'Promocja pokoju A ruszyła wybraną końcową ofertę rozłącznego pokoju B', { selectedB, all:FC.quoteSnapshotStore.listForProject(projectId) });
      H.assert(roomA && String(roomA.projectStatus || '') === 'zaakceptowany', 'Pokój A nie dostał statusu zaakceptowany po promocji do końcowej', investor && investor.rooms);
      H.assert(roomB && String(roomB.projectStatus || '') === 'zaakceptowany', 'Pokój B nie powinien zmieniać statusu przy promocji pokoju A', investor && investor.rooms);
    })),

    H.makeTest('Wycena', 'Guard ręcznych późnych etapów pilnuje exact-scope, gdy drugi pokój ma końcową ofertę', 'Pilnuje, czy ręczne przejścia na umowę/produkcję nie korzystają z obcej końcowej oferty innego pokoju i sprawdzają exact-scope docelowego pokoju.', ()=> withInvestorProjectFixture({
      investorId:'inv_guard_exact_scope',
      projectId:'proj_guard_exact_scope',
      rooms:[
        { id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'pomiar' },
        { id:'room_b', baseType:'pokoj', name:'Salon B', label:'Salon B', projectStatus:'zaakceptowany' },
      ],
      status:'pomiar',
      projectData:{
        schemaVersion:2,
        meta:{
          projectStatus:'pomiar',
          roomDefs:{
            room_a:{ id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'pomiar' },
            room_b:{ id:'room_b', baseType:'pokoj', name:'Salon B', label:'Salon B', projectStatus:'zaakceptowany' },
          },
          roomOrder:['room_a','room_b'],
        },
        room_a:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} },
        room_b:{ cabinets:[{ id:'cab_b' }], fronts:[], sets:[], settings:{} },
      }
    }, ({ investorId, projectId })=> {
      H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.commitAcceptedSnapshot === 'function', 'Brak FC.projectStatusSync.commitAcceptedSnapshot');
      H.assert(FC.projectStatusManualGuard && typeof FC.projectStatusManualGuard.validateManualStatusChange === 'function', 'Brak FC.projectStatusManualGuard.validateManualStatusChange');
      const prelimA = saveScopedSnapshot({ id:'snap_prelim_a_guard', investorId, projectId, roomId:'room_a', roomLabel:'Kuchnia A', preliminary:true, generatedAt:1713002000000, status:'wstepna_wycena' });
      const finalB = saveScopedSnapshot({ id:'snap_final_b_guard', investorId, projectId, roomId:'room_b', roomLabel:'Salon B', preliminary:false, generatedAt:1713002100000, status:'wycena' });
      FC.projectStatusSync.commitAcceptedSnapshot(prelimA, 'pomiar', { roomIds:['room_a'], refreshUi:false });
      FC.projectStatusSync.commitAcceptedSnapshot(finalB, 'zaakceptowany', { roomIds:['room_b'], refreshUi:false });

      const blockedA = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_a', 'umowa');
      const allowedB = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_b', 'umowa');

      H.assert(blockedA && blockedA.ok === false && blockedA.blocked === true && blockedA.requiresGeneration === true && String(blockedA.generationKind || '') === 'final', 'Guard powinien zablokować późny etap pokoju A bez własnej końcowej oferty exact-scope', blockedA);
      H.assert(allowedB && allowedB.ok === true && allowedB.blocked === false, 'Guard nie powinien blokować pokoju B, który ma własną końcową ofertę exact-scope', allowedB);
    })),
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
