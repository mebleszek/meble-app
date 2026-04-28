(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  if(!(FC.testHarness && typeof FC.registerWycenaTests === 'function')) return;

  function makeSnapshot(args){
    const cfg = args && typeof args === 'object' ? args : {};
    const roomIds = Array.isArray(cfg.roomIds) ? cfg.roomIds.slice() : [];
    const preliminary = cfg.preliminary !== false;
    return {
      id:String(cfg.id || ''),
      investor:{ id:String(cfg.investorId || 'inv_wycena_selection_contract'), name:'Jan Test' },
      project:{ id:String(cfg.projectId || ''), investorId:String(cfg.investorId || 'inv_wycena_selection_contract'), status:String(cfg.status || (preliminary ? 'wstepna_wycena' : 'wycena')) },
      scope:{ selectedRooms:roomIds, roomLabels:roomIds.map((roomId)=> roomId === 'room_a' ? 'Kuchnia A' : (roomId === 'room_b' ? 'Salon B' : roomId)) },
      commercial:{ preliminary, versionName:String(cfg.versionName || (preliminary ? 'Wstępna oferta' : 'Oferta')) },
      meta:Object.assign({ preliminary, versionName:String(cfg.versionName || (preliminary ? 'Wstępna oferta' : 'Oferta')) }, cfg.meta || {}),
      lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
      totals:{ grand:Number(cfg.grand || 0) },
      generatedAt:Number(cfg.generatedAt || 1713200000000),
    };
  }

  function fixture(run){
    return FC.wycenaTestFixtures.withInvestorProjectFixture({
      investorId:'inv_wycena_selection_contract',
      projectId:'proj_wycena_selection_contract',
      rooms:[
        { id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'nowy' },
        { id:'room_b', baseType:'pokoj', name:'Salon B', label:'Salon B', projectStatus:'nowy' },
      ],
      status:'nowy',
      projectData:{
        schemaVersion:2,
        meta:{
          projectStatus:'nowy',
          roomDefs:{
            room_a:{ id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'nowy' },
            room_b:{ id:'room_b', baseType:'pokoj', name:'Salon B', label:'Salon B', projectStatus:'nowy' },
          },
          roomOrder:['room_a','room_b'],
        },
        room_a:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} },
        room_b:{ cabinets:[{ id:'cab_b' }], fronts:[], sets:[], settings:{} },
      },
    }, run);
  }

  FC.registerWycenaTests(({ FC, H })=> [
    H.makeTest('Wycena ↔ Snapshot selection split', 'Moduł selection istnieje, a store zachowuje publiczne API wyboru', 'Pilnuje, żeby split selected/rejected/status w quote-snapshot-store nie zgubił wejść używanych przez WYCENĘ i status sync.', ()=> {
      H.assert(FC.quoteSnapshotSelection && typeof FC.quoteSnapshotSelection.createApi === 'function', 'Brak FC.quoteSnapshotSelection.createApi');
      ['markSelectedForProject','syncSelectionForProjectStatus','getRecommendedStatusForProject','getRecommendedStatusMapForProject','convertPreliminaryToFinal'].forEach((name)=> {
        H.assert(typeof FC.quoteSnapshotStore[name] === 'function', `quoteSnapshotStore.${name} musi pozostać funkcją po splicie selection`, { name, keys:Object.keys(FC.quoteSnapshotStore || {}) });
      });
    }),

    H.makeTest('Wycena ↔ Snapshot selection split', 'Wybór finalnej oferty odznacza tylko kolidującą selekcję bez archiwizowania tego samego zakresu', 'Pilnuje exact/overlap selected po wyjęciu logiki selection ze store bez zmiany dotychczasowej semantyki rejected.', ()=> fixture(({ projectId, investorId })=> {
      const store = FC.quoteSnapshotStore;
      store.writeAll([]);
      const preliminaryA = store.save(makeSnapshot({ id:'snap_sel_pre_a', investorId, projectId, roomIds:['room_a'], preliminary:true, meta:{ selectedByClient:true, acceptedAt:1713200000001, acceptedStage:'pomiar' }, generatedAt:1713200000001 }));
      const finalA = store.save(makeSnapshot({ id:'snap_sel_final_a', investorId, projectId, roomIds:['room_a'], preliminary:false, generatedAt:1713200000002 }));
      const finalB = store.save(makeSnapshot({ id:'snap_sel_final_b', investorId, projectId, roomIds:['room_b'], preliminary:false, meta:{ selectedByClient:true, acceptedAt:1713200000003, acceptedStage:'zaakceptowany' }, generatedAt:1713200000003 }));
      const selected = store.markSelectedForProject(projectId, finalA.id, { roomIds:['room_a'], status:'zaakceptowany' });
      const rows = store.listForProject(projectId);
      const rowPreA = rows.find((row)=> String(row.id || '') === String(preliminaryA.id || ''));
      const rowFinalA = rows.find((row)=> String(row.id || '') === String(finalA.id || ''));
      const rowFinalB = rows.find((row)=> String(row.id || '') === String(finalB.id || ''));
      H.assert(selected && String(selected.id || '') === String(finalA.id || ''), 'markSelectedForProject nie zwrócił wybranej oferty finalnej A', { selected });
      H.assert(rowFinalA && rowFinalA.meta && rowFinalA.meta.selectedByClient === true, 'Oferta finalna A nie została zaznaczona', rowFinalA);
      H.assert(rowPreA && rowPreA.meta && rowPreA.meta.selectedByClient === false, 'Poprzednia oferta wstępna A nie została odznaczona', rowPreA);
      H.assert(FC.quoteSnapshotStore.isRejectedSnapshot(rowPreA) === false, 'Oferta z tym samym zakresem A nie powinna zostać automatycznie oznaczona jako odrzucona', rowPreA);
      H.assert(rowFinalB && rowFinalB.meta && rowFinalB.meta.selectedByClient === true, 'Rozłączna oferta B nie powinna zostać odznaczona przy wyborze A', rowFinalB);
    })),

    H.makeTest('Wycena ↔ Snapshot selection split', 'Promocja wstępnej oferty do finalnej zachowuje zakres i czyści kolidujące selected', 'Pilnuje convertPreliminaryToFinal po przeniesieniu logiki selection do osobnego modułu.', ()=> fixture(({ projectId, investorId })=> {
      const store = FC.quoteSnapshotStore;
      store.writeAll([]);
      const preliminaryA = store.save(makeSnapshot({ id:'snap_conv_pre_a', investorId, projectId, roomIds:['room_a'], preliminary:true, meta:{ selectedByClient:true, acceptedAt:1713200000001, acceptedStage:'pomiar' }, generatedAt:1713200000001 }));
      const finalA = store.save(makeSnapshot({ id:'snap_conv_final_a', investorId, projectId, roomIds:['room_a'], preliminary:false, meta:{ selectedByClient:true, acceptedAt:1713200000002, acceptedStage:'zaakceptowany' }, generatedAt:1713200000002 }));
      const converted = store.convertPreliminaryToFinal(projectId, preliminaryA.id);
      const rows = store.listForProject(projectId);
      const rowPreA = rows.find((row)=> String(row.id || '') === String(preliminaryA.id || ''));
      const rowFinalA = rows.find((row)=> String(row.id || '') === String(finalA.id || ''));
      H.assert(converted && String(converted.id || '') === String(preliminaryA.id || ''), 'convertPreliminaryToFinal nie zwrócił konwertowanej oferty', { converted });
      H.assert(rowPreA && rowPreA.meta && rowPreA.meta.preliminary === false && rowPreA.commercial && rowPreA.commercial.preliminary === false, 'Oferta wstępna nie została przekonwertowana na finalną', rowPreA);
      H.assert(rowPreA && rowPreA.meta && rowPreA.meta.selectedByClient === true && rowPreA.meta.acceptedStage === 'zaakceptowany', 'Konwertowana oferta nie jest zaakceptowaną finalną ofertą', rowPreA);
      H.assert(rowFinalA && rowFinalA.meta && rowFinalA.meta.selectedByClient === false, 'Poprzednia finalna oferta A powinna zostać odznaczona po konwersji', rowFinalA);
      H.assert(rowPreA && rowPreA.project && rowPreA.project.status === 'zaakceptowany', 'Konwertowana oferta musi mieć status projektu zaakceptowany', rowPreA);
    })),
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
