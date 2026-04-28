(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  if(!(FC.testHarness && typeof FC.registerWycenaTests === 'function')) return;

  function makeRooms(statusA, statusB){
    return [
      { id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:statusA || 'nowy' },
      { id:'room_b', baseType:'pokoj', name:'Salon B', label:'Salon B', projectStatus:statusB || 'nowy' },
    ];
  }

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

  FC.registerWycenaTests(({ FC, H, withInvestorProjectFixture })=> [
    H.makeTest('Wycena ↔ Project status scope split', 'Moduł projectStatusScope istnieje, a projectStatusSync zachowuje publiczny kontrakt', 'Pilnuje, żeby split helperów status/scope nie zgubił funkcji używanych przez WYCENĘ, Inwestora i historię ofert.', ()=> {
      H.assert(FC.projectStatusScope && typeof FC.projectStatusScope === 'object', 'Brak FC.projectStatusScope');
      [
        'normalizeStatus',
        'statusRank',
        'isFinalStatus',
        'normalizeRoomIds',
        'getSnapshotRoomIds',
        'getTargetRoomIdsFromSnapshot',
        'resolveAggregateScopeRoomIds',
        'resolveAggregateFallbackStatus',
        'collectRoomStatuses',
        'getAggregateStatus',
        'getRoomStatusMap',
        'getKnownProjectRoomIds',
        'computeRecommendedRoomStatusMap',
        'buildRecommendedRoomStatusMap',
        'resolveScopedMasterStatus',
      ].forEach((name)=> {
        H.assert(typeof FC.projectStatusScope[name] === 'function', `projectStatusScope.${name} musi pozostać funkcją`, { name, keys:Object.keys(FC.projectStatusScope || {}) });
      });
      [
        'normalizeStatus',
        'statusRank',
        'isFinalStatus',
        'normalizeRoomIds',
        'getSnapshotRoomIds',
        'getTargetRoomIdsFromSnapshot',
        'collectRoomStatuses',
        'getAggregateStatus',
        'getRoomStatusMap',
        'getKnownProjectRoomIds',
        'resolveAggregateScopeRoomIds',
        'resolveAggregateFallbackStatus',
        'resolveScopedMasterStatus',
        'buildRecommendedRoomStatusMap',
        'computeRecommendedRoomStatusMap',
      ].forEach((name)=> {
        H.assert(FC.projectStatusSync[name] === FC.projectStatusScope[name], `projectStatusSync.${name} ma delegować do projectStatusScope.${name}`, { name });
      });
    }),

    H.makeTest('Wycena ↔ Project status scope split', 'Helpery scope liczą statusy pokojów tak samo po splicie', 'Pilnuje collect/status-map/agregacji po wyjęciu helperów z project-status-sync.js.', ()=> withInvestorProjectFixture({
      investorId:'inv_status_scope_split',
      projectId:'proj_status_scope_split',
      rooms:makeRooms('wstepna_wycena', 'zaakceptowany'),
      status:'nowy',
      projectData:makeProjectData('wstepna_wycena', 'zaakceptowany'),
    }, ({ projectId, rooms })=> {
      const sources = {
        investorRooms:rooms,
        roomDefs:{
          room_a:{ id:'room_a', projectStatus:'wstepna_wycena' },
          room_b:{ id:'room_b', projectStatus:'zaakceptowany' },
        },
      };
      const statuses = FC.projectStatusScope.collectRoomStatuses(['room_a','room_b'], sources);
      const map = FC.projectStatusScope.getRoomStatusMap(['room_a','room_b'], sources);
      const aggregate = FC.projectStatusScope.getAggregateStatus(statuses, 'nowy');
      const master = FC.projectStatusScope.resolveScopedMasterStatus(['room_a','room_b'], map, { fallbackStatus:'nowy' });
      H.assert(JSON.stringify(statuses) === JSON.stringify(['wstepna_wycena','zaakceptowany']), 'collectRoomStatuses zwróciło inny wynik po splicie', { statuses });
      H.assert(map.room_a === 'wstepna_wycena' && map.room_b === 'zaakceptowany', 'getRoomStatusMap zwróciło błędną mapę', { map });
      H.assert(aggregate === 'zaakceptowany', 'Agregacja statusów ma wybrać najwyższą rangę', { aggregate });
      H.assert(master === 'zaakceptowany', 'resolveScopedMasterStatus ma zachować wynik agregacji exact-scope', { master });
      const recommended = FC.projectStatusScope.computeRecommendedRoomStatusMap(projectId, ['room_a','room_b'], map, { fallbackStatus:'nowy' });
      const recommendedViaSync = FC.projectStatusSync.computeRecommendedRoomStatusMap(projectId, ['room_a','room_b'], map, { fallbackStatus:'nowy' });
      H.assert(JSON.stringify(recommended) === JSON.stringify(recommendedViaSync), 'Status scope i status sync muszą zwracać ten sam wynik rekomendowanej mapy', { recommended, recommendedViaSync });
    })),

    H.makeTest('Wycena ↔ Project status scope split', 'Rekonsyliacja nadal korzysta z wydzielonych helperów bez zmiany wyniku biznesowego', 'Pilnuje, żeby project-status-sync po splicie zachował master/mirror/statusMap dla wielu pokoi.', ()=> withInvestorProjectFixture({
      investorId:'inv_status_scope_reconcile',
      projectId:'proj_status_scope_reconcile',
      rooms:makeRooms('wstepna_wycena', 'nowy'),
      status:'nowy',
      projectData:makeProjectData('wstepna_wycena', 'nowy'),
    }, ({ investorId, projectId })=> {
      FC.quoteSnapshotStore.save({
        id:'snap_status_scope_reconcile_a',
        investor:{ id:investorId, name:'Jan Test' },
        project:{ id:projectId, investorId, status:'wstepna_wycena' },
        scope:{ selectedRooms:['room_a'], roomLabels:['Kuchnia A'] },
        commercial:{ preliminary:true, versionName:'Wstępna oferta A' },
        meta:{ preliminary:true, versionName:'Wstępna oferta A' },
        lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
        totals:{ grand:0 },
        generatedAt:1713200000000,
      });
      const result = FC.projectStatusSync.reconcileProjectStatuses({ projectId, investorId, fallbackStatus:'nowy', refreshUi:false });
      H.assert(result && result.roomStatusMap && result.roomStatusMap.room_a === 'wstepna_wycena', 'Rekonsyliacja zgubiła status pokoju A', result);
      H.assert(result && result.roomStatusMap && result.roomStatusMap.room_b === 'nowy', 'Rekonsyliacja zgubiła status pokoju B', result);
      H.assert(result && result.masterStatus === 'nowy', 'Brak jawnego scope ma nadal dawać mirror/master fallback projektu, nie agregację całego inwestora', result);
      H.assert(result && result.mirrorStatus === 'nowy', 'Mirror status po rekonsyliacji bez scope ma pozostać nowy', result);
    })),
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
