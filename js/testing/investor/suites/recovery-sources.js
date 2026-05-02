(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const harness = FC.testHarness;
  if(!harness) return;
  const { makeTest, assert } = harness;
  const helpers = FC.investorDevTestHelpers || {};
  const seedInvestor = helpers.seedInvestor || function(initial, options){
    if(FC.testDataManager && typeof FC.testDataManager.seedInvestor === 'function') return FC.testDataManager.seedInvestor(initial, options);
    return FC.investors && typeof FC.investors.create === 'function' ? FC.investors.create(initial) : null;
  };
  const sampleInvestor = helpers.sampleInvestor || function(){
    return {
      id:'inv_test',
      kind:'person',
      name:'Jan Kowalski',
      companyName:'',
      ownerName:'',
      phone:'123',
      email:'jan@example.com',
      city:'Łódź',
      address:'Test 1',
      source:'Polecenie',
      nip:'',
      notes:'abc',
      addedDate:'2026-04-04',
      rooms:[{ id:'room_kuchnia_a', baseType:'kuchnia', name:'Kuchnia góra', label:'Kuchnia góra', projectStatus:'nowy' }]
    };
  };

  const EDIT_SESSION_KEY = 'fc_edit_session_v1';
  function readEditSessionRaw(){
    try{ return root.localStorage.getItem(EDIT_SESSION_KEY); }catch(_){ return null; }
  }
  function clearEditSession(){
    try{ root.localStorage.removeItem(EDIT_SESSION_KEY); }catch(_){ }
  }
  function restoreEditSession(raw){
    try{
      if(raw == null) root.localStorage.removeItem(EDIT_SESSION_KEY);
      else root.localStorage.setItem(EDIT_SESSION_KEY, raw);
    }catch(_){ }
  }

  const tests = [
    makeTest('Inwestor', 'Store inwestorów odzyskuje brakujące rekordy z projectStore i snapshotów bez kasowania istniejących', 'Pilnuje pakietu ratunkowego: gdy główna lista inwestorów zgubi stare rekordy, store ma je odbudować z projektów/snapshotów i zachować już widoczne nowe wpisy.', ()=>{
      assert(FC.investors && typeof FC.investors.readAll === 'function', 'Brak investors.readAll');
      assert(FC.projectStore && typeof FC.projectStore.writeAll === 'function', 'Brak FC.projectStore.writeAll');
      assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.writeAll === 'function', 'Brak FC.quoteSnapshotStore.writeAll');
      const prevInvestors = FC.investors._debug && typeof FC.investors._debug.readStoredAll === 'function' ? FC.investors._debug.readStoredAll() : FC.investors.readAll();
      const prevProjects = FC.projectStore.readAll();
      const prevSnapshots = FC.quoteSnapshotStore.readAll();
      const removedKey = FC.investors.KEY_REMOVED || 'fc_investor_removed_ids_v1';
      const prevRemoved = (()=>{ try{ return root.localStorage.getItem(removedKey); }catch(_){ return null; } })();
      const prevEditSession = readEditSessionRaw();
      try{
        clearEditSession();
        FC.investors.writeAll([{
          id:'inv_new_only',
          kind:'person',
          name:'Jan Test',
          phone:'111',
          addedDate:'2026-04-19',
          createdAt:1776635559701,
          updatedAt:1776635559701,
          rooms:[],
          meta:{ testData:true, testOwner:'dev-tests', source:'investor-recovery-fixture' }
        }]);
        try{ root.localStorage.removeItem(removedKey); }catch(_){ }
        FC.projectStore.writeAll([{
          id:'proj_recover_missing',
          investorId:'inv_missing_old',
          title:'Stary inwestor',
          status:'pomiar',
          createdAt:1776631111000,
          updatedAt:1776631111000,
          projectData:{
            schemaVersion:2,
            meta:{
              roomDefs:{
                room_old:{ id:'room_old', baseType:'kuchnia', name:'Kuchnia stara', label:'Kuchnia stara', projectStatus:'pomiar' }
              },
              roomOrder:['room_old']
            },
            room_old:{ cabinets:[{ id:'cab_old' }], fronts:[], sets:[], settings:{} }
          },
          meta:{ source:'test-project-store' }
        }]);
        FC.quoteSnapshotStore.writeAll([{
          id:'snap_recover_missing',
          generatedAt:1776632222000,
          investor:{ id:'inv_missing_old', kind:'person', name:'Stary inwestor' },
          project:{ id:'proj_recover_missing', investorId:'inv_missing_old', title:'Projekt starego inwestora', status:'pomiar' },
          scope:{ selectedRooms:['room_old'], roomLabels:['Kuchnia stara'] },
          commercial:{ preliminary:true, versionName:'Wstępna oferta — Kuchnia stara' },
          totals:{ grand:123 },
          lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
          meta:{ source:'test-quote-snapshot', preliminary:true, versionName:'Wstępna oferta — Kuchnia stara' }
        }]);
        const recovered = FC.investors.readAll();
        const ids = recovered.map((row)=> String(row && row.id || ''));
        assert(ids.includes('inv_new_only'), 'Store zgubił istniejący nowy wpis podczas odzysku', recovered);
        assert(ids.includes('inv_missing_old'), 'Store nie odzyskał brakującego inwestora obok istniejącego wpisu', recovered);
        const restored = recovered.find((row)=> String(row && row.id || '') === 'inv_missing_old') || null;
        assert(String(restored && restored.name || '') === 'Stary inwestor', 'Odzyskany inwestor nie zaciągnął danych ze snapshotu', restored);
        assert(Array.isArray(restored && restored.rooms) && restored.rooms.some((room)=> String(room && room.id || '') === 'room_old'), 'Odzyskany inwestor nie zaciągnął pokojów z projektu/snapshotu', restored);
      } finally {
        FC.quoteSnapshotStore.writeAll(prevSnapshots);
        FC.projectStore.writeAll(prevProjects);
        FC.investors.writeAll(prevInvestors);
        try{
          if(prevRemoved == null) root.localStorage.removeItem(removedKey);
          else root.localStorage.setItem(removedKey, prevRemoved);
        }catch(_){ }
        restoreEditSession(prevEditSession);
      }
    }),

    makeTest('Inwestor', 'Store inwestorów umie odbudować pustą listę z samych snapshotów ofert', 'Pilnuje awaryjnego odzysku: gdy główna lista inwestorów jest pusta, ale zostały snapshoty ofert, inwestor ma wrócić na listę zamiast znikać całkowicie.', ()=>{
      assert(FC.investors && typeof FC.investors.readAll === 'function', 'Brak investors.readAll');
      assert(FC.projectStore && typeof FC.projectStore.writeAll === 'function', 'Brak FC.projectStore.writeAll');
      assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.writeAll === 'function', 'Brak FC.quoteSnapshotStore.writeAll');
      const prevInvestors = FC.investors._debug && typeof FC.investors._debug.readStoredAll === 'function' ? FC.investors._debug.readStoredAll() : FC.investors.readAll();
      const prevProjects = FC.projectStore.readAll();
      const prevSnapshots = FC.quoteSnapshotStore.readAll();
      const removedKey = FC.investors.KEY_REMOVED || 'fc_investor_removed_ids_v1';
      const prevRemoved = (()=>{ try{ return root.localStorage.getItem(removedKey); }catch(_){ return null; } })();
      const prevEditSession = readEditSessionRaw();
      try{
        clearEditSession();
        FC.investors.writeAll([]);
        FC.projectStore.writeAll([]);
        try{ root.localStorage.removeItem(removedKey); }catch(_){ }
        FC.quoteSnapshotStore.writeAll([{
          id:'snap_only_snapshot_recover',
          generatedAt:1776633333000,
          investor:{ id:'inv_snapshot_only', kind:'person', name:'Snapshot only' },
          project:{ id:'proj_snapshot_only', investorId:'inv_snapshot_only', title:'Projekt snapshot only', status:'wycena' },
          scope:{ selectedRooms:['room_snapshot_only'], roomLabels:['Salon test'] },
          commercial:{ preliminary:false, versionName:'Oferta — Salon test' },
          totals:{ grand:456 },
          lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
          meta:{ source:'test-quote-snapshot', preliminary:false, versionName:'Oferta — Salon test' }
        }]);
        const recovered = FC.investors.readAll();
        assert(Array.isArray(recovered) && recovered.length === 1, 'Store nie odbudował inwestora z pustej listy na podstawie snapshotu', recovered);
        const restored = recovered[0] || null;
        assert(String(restored && restored.id || '') === 'inv_snapshot_only', 'Store odbudował zły rekord inwestora ze snapshotu', recovered);
        assert(String(restored && restored.name || '') === 'Snapshot only', 'Store nie przepisał nazwy inwestora ze snapshotu', restored);
        assert(Array.isArray(restored && restored.rooms) && restored.rooms.some((room)=> String(room && room.label || room && room.name || '') === 'Salon test'), 'Store nie odbudował scope pokoi ze snapshotu', restored);
      } finally {
        FC.quoteSnapshotStore.writeAll(prevSnapshots);
        FC.projectStore.writeAll(prevProjects);
        FC.investors.writeAll(prevInvestors);
        try{
          if(prevRemoved == null) root.localStorage.removeItem(removedKey);
          else root.localStorage.setItem(removedKey, prevRemoved);
        }catch(_){ }
        restoreEditSession(prevEditSession);
      }
    }),

  ];

  FC.investorDevTestSuites = FC.investorDevTestSuites || [];
  FC.investorDevTestSuites.push({ key:'recovery-sources', tests });
})(typeof window !== 'undefined' ? window : globalThis);
