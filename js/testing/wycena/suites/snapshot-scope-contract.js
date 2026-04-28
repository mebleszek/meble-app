(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  if(!(FC.testHarness && typeof FC.registerWycenaTests === 'function')) return;

  function assertFunctions(H, owner, ownerName, names){
    H.assert(owner && typeof owner === 'object', `Brak ${ownerName}`);
    (Array.isArray(names) ? names : []).forEach((name)=> {
      H.assert(typeof owner[name] === 'function', `${ownerName}.${name} musi pozostać funkcją po splicie scope snapshotów`, { ownerName, name, keys:Object.keys(owner || {}) });
    });
  }

  function makeSnapshot(id, projectId, roomIds, preliminary, generatedAt){
    const rooms = (Array.isArray(roomIds) ? roomIds : []).map((roomId)=> String(roomId || '').trim()).filter(Boolean);
    return {
      id:String(id || ''),
      investor:{ id:'inv_wycena_scope_contract', name:'Jan Test' },
      project:{ id:String(projectId || ''), investorId:'inv_wycena_scope_contract', status:preliminary ? 'wstepna_wycena' : 'wycena' },
      scope:{ selectedRooms:rooms, roomLabels:rooms.map((roomId)=> roomId === 'room_a' ? 'Kuchnia A' : (roomId === 'room_b' ? 'Salon B' : roomId)) },
      commercial:{ preliminary:!!preliminary, versionName:preliminary ? 'Wstępna oferta' : 'Oferta' },
      meta:{ preliminary:!!preliminary, versionName:preliminary ? 'Wstępna oferta' : 'Oferta' },
      lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
      totals:{ materials:0, accessories:0, services:0, quoteRates:0, subtotal:0, discount:0, grand:0 },
      generatedAt:Number(generatedAt || 1713200000000),
    };
  }

  const scopeFunctionNames = [
    'normalizeMaterialScope',
    'materialScopeMode',
    'isPreliminarySnapshot',
    'normalizeRoomIds',
    'getScopeRoomLabels',
    'buildScopedVersionName',
    'buildCanonicalScope',
    'getCanonicalDefaultVersionName',
    'coerceAutoVersionNameForScope',
    'getSnapshotRoomIds',
    'sameRoomScope',
    'matchesOwnAutoVersionName',
    'snapshotScopeOverlaps',
    'isRejectedSnapshot',
    'filterRowsByRoomScope',
  ];

  FC.registerWycenaTests(({ FC, H, withInvestorProjectFixture })=> [
    H.makeTest('Wycena ↔ Snapshot scope split', 'Snapshot scope ma publiczny kontrakt i store deleguje helpery zakresu', 'Pilnuje, żeby split quote-snapshot-store nie rozjechał nazw, zakresów i overlapów ofert.', ()=> {
      assertFunctions(H, FC.quoteSnapshotScope, 'FC.quoteSnapshotScope', scopeFunctionNames);
      assertFunctions(H, FC.quoteSnapshotStore, 'FC.quoteSnapshotStore', [
        'normalizeRoomIds',
        'getScopeRoomLabels',
        'getSnapshotRoomIds',
        'filterRowsByRoomScope',
        'sameRoomScope',
        'snapshotScopeOverlaps',
        'isRejectedSnapshot',
        'getEffectiveVersionName',
      ]);
      ['normalizeRoomIds','getScopeRoomLabels','getSnapshotRoomIds','filterRowsByRoomScope','sameRoomScope','snapshotScopeOverlaps','isRejectedSnapshot'].forEach((name)=> {
        H.assert(FC.quoteSnapshotStore[name] === FC.quoteSnapshotScope[name], `quoteSnapshotStore.${name} ma delegować do quoteSnapshotScope.${name}`, { name });
      });
    }),

    H.makeTest('Wycena ↔ Snapshot scope split', 'Scope helper buduje kanoniczny zakres i nazwę wersji bez storage', 'Pilnuje czystej części wyciągniętej ze store: kolejność pokoi, etykiety, materialScope i nazwa oferty.', ()=> {
      const scope = FC.quoteSnapshotScope;
      const canonical = scope.buildCanonicalScope({
        selectedRooms:['room_b','room_a','room_b',''],
        roomLabels:['Salon B','Kuchnia A'],
        materialScope:{ kind:'material', material:'Dąb dziki', includeFronts:false, includeCorpus:false },
      }, { preserveExplicitLabels:true });
      H.assert(JSON.stringify(canonical.selectedRooms) === JSON.stringify(['room_b','room_a']), 'normalizeRoomIds musi deduplikować pokoje bez zmiany kolejności', canonical);
      H.assert(JSON.stringify(canonical.roomLabels) === JSON.stringify(['Salon B','Kuchnia A']), 'buildCanonicalScope musi zachować kompletne jawne etykiety', canonical);
      H.assert(canonical.materialScope.kind === 'material' && canonical.materialScope.material === 'Dąb dziki', 'materialScope musi zachować wybrany materiał', canonical.materialScope);
      H.assert(canonical.materialScope.includeFronts === true && canonical.materialScope.includeCorpus === true, 'materialScope z oboma false ma wrócić do both, żeby nie tworzyć pustej oferty', canonical.materialScope);
      const version = scope.buildScopedVersionName(true, canonical, { preserveExplicitLabels:true });
      H.assert(version === 'Wstępna oferta — Salon B + Kuchnia A', 'buildScopedVersionName zmienił nazwę wersji dla zakresu pokojów', { version });
      H.assert(scope.sameRoomScope(['room_b','room_a'], ['room_a','room_b']) === false, 'sameRoomScope ma pilnować kanonicznej kolejności, nie sortować po cichu');
    }),

    H.makeTest('Wycena ↔ Snapshot scope split', 'Store po splicie nadal rozróżnia exact-scope i overlap', 'Pilnuje starego zachowania na granicy store + nowy moduł scope.', ()=> withInvestorProjectFixture({
      investorId:'inv_wycena_scope_split',
      projectId:'proj_wycena_scope_split',
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
      const soloA = store.save(makeSnapshot('snap_scope_solo_a', projectId, ['room_a'], true, 1713200000000));
      const jointAB = store.save(makeSnapshot('snap_scope_joint_ab', projectId, ['room_a','room_b'], false, 1713200100000));
      const soloB = store.save(makeSnapshot('snap_scope_solo_b', projectId, ['room_b'], false, 1713200200000));
      const exactA = store.listExactScopeSnapshots(projectId, ['room_a']);
      const exactAB = store.listExactScopeSnapshots(projectId, ['room_a','room_b']);
      const overlapA = store.listOverlappingScopeSnapshots(projectId, ['room_a']);
      H.assert(exactA.length === 1 && String(exactA[0].id || '') === String(soloA.id || ''), 'Exact-scope A po splicie nie wskazuje oferty solo A', { exactA });
      H.assert(exactAB.length === 1 && String(exactAB[0].id || '') === String(jointAB.id || ''), 'Exact-scope A+B po splicie nie wskazuje oferty wspólnej', { exactAB });
      H.assert(overlapA.some((row)=> String(row.id || '') === String(soloA.id || '')), 'Overlap A nie zawiera solo A', { overlapA });
      H.assert(overlapA.some((row)=> String(row.id || '') === String(jointAB.id || '')), 'Overlap A nie zawiera wspólnej A+B', { overlapA });
      H.assert(!overlapA.some((row)=> String(row.id || '') === String(soloB.id || '')), 'Overlap A błędnie zawiera rozłączną ofertę B', { overlapA });
    })),
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
