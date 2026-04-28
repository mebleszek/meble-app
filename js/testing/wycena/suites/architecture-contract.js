(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  if(!(FC.testHarness && typeof FC.registerWycenaTests === 'function')) return;

  function assertFunctions(H, owner, ownerName, names){
    H.assert(owner && typeof owner === 'object', `Brak ${ownerName}`);
    (Array.isArray(names) ? names : []).forEach((name)=> {
      H.assert(typeof owner[name] === 'function', `${ownerName}.${name} musi pozostać funkcją przed splitem Wyceny`, { ownerName, name, keys:Object.keys(owner || {}) });
    });
  }

  function makeSnapshot(id, projectId, roomIds, preliminary, generatedAt){
    const rooms = (Array.isArray(roomIds) ? roomIds : []).map((roomId)=> String(roomId || '').trim()).filter(Boolean);
    return {
      id:String(id || ''),
      investor:{ id:'inv_wycena_arch_contract', name:'Jan Test' },
      project:{ id:String(projectId || ''), investorId:'inv_wycena_arch_contract', status:preliminary ? 'wstepna_wycena' : 'wycena' },
      scope:{ selectedRooms:rooms, roomLabels:rooms.map((roomId)=> roomId === 'room_a' ? 'Kuchnia A' : (roomId === 'room_b' ? 'Salon B' : roomId)) },
      commercial:{ preliminary:!!preliminary, versionName:preliminary ? 'Wstępna' : 'Oferta' },
      meta:{ preliminary:!!preliminary, versionName:preliminary ? 'Wstępna' : 'Oferta' },
      lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
      totals:{ materials:0, accessories:0, services:0, quoteRates:0, subtotal:0, discount:0, grand:0 },
      generatedAt:Number(generatedAt || 1713200000000),
    };
  }

  FC.registerWycenaTests(({ FC, H, withInvestorProjectFixture })=> [
    H.makeTest('Wycena ↔ Kontrakt architektury', 'Publiczne API Wyceny/statusów/ofert jest kompletne przed splitem', 'Pilnuje, żeby techniczny split Wyceny nie zgubił fasad używanych przez zakładkę, PDF, statusy, scope i testy.', ()=> {
      assertFunctions(H, FC.wycenaCore, 'FC.wycenaCore', [
        'normalizeQuoteSelection',
        'validateQuoteSelection',
        'validateQuoteContent',
        'collectQuoteData',
        'buildQuoteSnapshot',
        'collectCommercialDraft',
        'collectQuoteRateLines',
        'collectElementLines',
        'collectClientPdfDetails',
        'createQuoteValidationError',
      ]);
      assertFunctions(H, FC.quoteSnapshotScope, 'FC.quoteSnapshotScope', [
        'normalizeMaterialScope',
        'buildCanonicalScope',
        'getCanonicalDefaultVersionName',
        'normalizeRoomIds',
        'getScopeRoomLabels',
        'getSnapshotRoomIds',
        'filterRowsByRoomScope',
        'sameRoomScope',
        'snapshotScopeOverlaps',
        'isRejectedSnapshot',
      ]);
      assertFunctions(H, FC.quoteSnapshotStore, 'FC.quoteSnapshotStore', [
        'readAll',
        'writeAll',
        'save',
        'remove',
        'listForProject',
        'listForInvestor',
        'getById',
        'getSelectedForProject',
        'markSelectedForProject',
        'syncSelectionForProjectStatus',
        'normalizeRoomIds',
        'getSnapshotRoomIds',
        'filterRowsByRoomScope',
        'listExactScopeSnapshots',
        'findExactScopeSnapshot',
        'listOverlappingScopeSnapshots',
        'sameRoomScope',
        'snapshotScopeOverlaps',
        'getRecommendedStatusMapForProject',
      ]);
      assertFunctions(H, FC.projectStatusSync, 'FC.projectStatusSync', [
        'normalizeStatus',
        'statusRank',
        'resolveCurrentProjectStatus',
        'applyProjectStatusChange',
        'reconcileProjectStatuses',
        'setInvestorRoomStatus',
        'setStatusFromSnapshot',
        'commitAcceptedSnapshot',
        'reconcileStatusAfterSnapshotRemoval',
        'promotePreliminarySnapshotToFinal',
        'syncStatusMirrors',
      ]);
      assertFunctions(H, FC.wycenaTabDebug, 'FC.wycenaTabDebug', [
        'currentProjectStatus',
        'setProjectStatusFromSnapshot',
        'commitAcceptedSnapshotWithSync',
        'reconcileAfterSnapshotRemoval',
        'promotePreliminarySnapshotToFinal',
        'acceptSnapshot',
        'getTargetRoomIdsFromSnapshot',
        'canAcceptSnapshot',
        'showSnapshotPreview',
      ]);
      assertFunctions(H, FC.wycenaTabDom, 'FC.wycenaTabDom', [
        'h',
        'labelWithInfo',
      ]);
      assertFunctions(H, FC.wycenaTabStatusActions, 'FC.wycenaTabStatusActions', [
        'currentProjectStatus',
        'askConfirm',
        'getTargetRoomIdsFromSnapshot',
        'isArchivedPreliminary',
        'canAcceptSnapshot',
        'commitAcceptedSnapshotWithSync',
        'acceptSnapshot',
        'setProjectStatusFromSnapshot',
        'syncGeneratedQuoteStatus',
      ]);
      assertFunctions(H, FC.wycenaTabShell, 'FC.wycenaTabShell', [
        'render',
        'generateQuote',
        'renderTopbar',
      ]);
    }),

    H.makeTest('Wycena ↔ Kontrakt architektury', 'Snapshot store rozróżnia exact-scope i overlap zakresów pokojów', 'Pilnuje, żeby przyszły split snapshot-store nie skleił niezależnych pokoi ani nie pomylił oferty wspólnej A+B z ofertą tylko dla A.', ()=> withInvestorProjectFixture({
      investorId:'inv_wycena_arch_scope',
      projectId:'proj_wycena_arch_scope',
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
    }, ({ projectId })=> {
      const store = FC.quoteSnapshotStore;
      store.writeAll([]);
      const soloA = store.save(makeSnapshot('snap_arch_solo_a', projectId, ['room_a'], true, 1713200000000));
      const jointAB = store.save(makeSnapshot('snap_arch_joint_ab', projectId, ['room_a','room_b'], false, 1713200100000));
      const soloB = store.save(makeSnapshot('snap_arch_solo_b', projectId, ['room_b'], false, 1713200200000));
      const exactA = store.listExactScopeSnapshots(projectId, ['room_a']);
      const exactAB = store.listExactScopeSnapshots(projectId, ['room_a','room_b']);
      const overlapA = store.listOverlappingScopeSnapshots(projectId, ['room_a']);
      H.assert(exactA.length === 1 && String(exactA[0].id || '') === String(soloA.id || ''), 'Exact-scope pokoju A zwrócił coś poza ofertą solo A', { exactA });
      H.assert(exactAB.length === 1 && String(exactAB[0].id || '') === String(jointAB.id || ''), 'Exact-scope A+B nie rozpoznał wspólnej oferty w kanonicznej kolejności pokojów', { exactAB });
      H.assert(overlapA.some((row)=> String(row.id || '') === String(soloA.id || '')), 'Overlap A nie zawiera oferty solo A', { overlapA });
      H.assert(overlapA.some((row)=> String(row.id || '') === String(jointAB.id || '')), 'Overlap A nie zawiera wspólnej oferty A+B', { overlapA });
      H.assert(!overlapA.some((row)=> String(row.id || '') === String(soloB.id || '')), 'Overlap A błędnie zawiera rozłączną ofertę B', { overlapA });
      H.assert(store.sameRoomScope(['room_a'], ['room_a','room_b']) === false, 'sameRoomScope nie może traktować solo A jak wspólnej oferty A+B');
    })),

    H.makeTest('Wycena ↔ Kontrakt architektury', 'WycenaCore waliduje wybór pomieszczenia bez cichego fallbacku na nieistniejący pokój', 'Pilnuje, żeby przyszły split collect/selection nie pozwalał zbudować oferty dla roomId, którego nie ma w aktywnym projekcie.', ()=> withInvestorProjectFixture({
      investorId:'inv_wycena_arch_validate',
      projectId:'proj_wycena_arch_validate',
      rooms:[{ id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'nowy' }],
      status:'nowy',
      projectData:{
        schemaVersion:2,
        meta:{
          projectStatus:'nowy',
          roomDefs:{ room_a:{ id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'nowy' } },
          roomOrder:['room_a'],
        },
        room_a:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} },
      },
    }, ()=> {
      const normalized = FC.wycenaCore.normalizeQuoteSelection({ selectedRooms:['room_missing'], materialScope:{ kind:'all' } });
      let error = null;
      try{ FC.wycenaCore.validateQuoteSelection(normalized); }catch(err){ error = err; }
      H.assert(error && error.quoteValidation === true, 'Brak walidacyjnego błędu quoteValidation dla nieistniejącego pokoju', error);
      H.assert(String(error && error.code || '') === 'selected_room_missing', 'Nieprawidłowy kod błędu dla nieistniejącego pokoju', error);
    })),
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
