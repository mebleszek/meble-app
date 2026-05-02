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
    makeTest('Inwestor', 'Store inwestorów przy pustej liście preferuje testowe snapshoty recovery zamiast mieszać stare zwykłe dane', 'Pilnuje izolacji testów: jeśli w storage leżą jednocześnie zwykłe snapshoty użytkownika i jawny snapshot testowy recovery, pusty store inwestorów ma odbudować tylko rekord testowy zamiast mieszać stare dane użytkownika do wyniku.', ()=>{
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
        FC.quoteSnapshotStore.writeAll([
          {
            id:'snap_regular_snapshot_user',
            generatedAt:100,
            investor:{ id:'inv_regular_snapshot_user', kind:'person', name:'Late flow' },
            project:{ id:'proj_regular_snapshot_user', investorId:'inv_regular_snapshot_user', title:'Late flow', status:'wycena' },
            scope:{ selectedRooms:['room_a'], roomLabels:['Kuchnia A'] },
            commercial:{ preliminary:true, versionName:'Wstępna oferta — Kuchnia A' },
            totals:{ grand:1 },
            lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            meta:{ source:'quote-snapshot-store', preliminary:true, versionName:'Wstępna oferta — Kuchnia A' }
          },
          {
            id:'snap_only_snapshot_recover_test',
            generatedAt:1776633333000,
            investor:{ id:'inv_snapshot_only_test', kind:'person', name:'Snapshot only test' },
            project:{ id:'proj_snapshot_only_test', investorId:'inv_snapshot_only_test', title:'Projekt snapshot only test', status:'wycena' },
            scope:{ selectedRooms:['room_snapshot_only'], roomLabels:['Salon test'] },
            commercial:{ preliminary:false, versionName:'Oferta — Salon test' },
            totals:{ grand:456 },
            lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            meta:{ source:'test-quote-snapshot', preliminary:false, versionName:'Oferta — Salon test' }
          }
        ]);
        const recovered = FC.investors.readAll();
        assert(Array.isArray(recovered) && recovered.length === 1, 'Store zmieszał zwykłe snapshoty użytkownika z testowym recovery przy pustej liście', recovered);
        const restored = recovered[0] || null;
        assert(String(restored && restored.id || '') === 'inv_snapshot_only_test', 'Store nie preferował testowego snapshotu recovery przy pustej liście', recovered);
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


    makeTest('Inwestor', 'Zapis jawnego snapshotu testowego nie odbudowuje inwestorów z dawnych migawek podczas writeAll', 'Pilnuje bocznej regresji: quoteSnapshotStore.writeAll z kompletnymi roomLabels nie może podczas normalizacji odpalić roomRegistry/investors i przywrócić starych inwestorów jeszcze przed właściwym odczytem recovery.', ()=>{
      assert(FC.investors && FC.investors._debug && typeof FC.investors._debug.readStoredAll === 'function', 'Brak investors._debug.readStoredAll');
      assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.writeAll === 'function', 'Brak FC.quoteSnapshotStore.writeAll');
      const prevInvestors = FC.investors._debug.readStoredAll();
      const prevProjects = FC.projectStore.readAll();
      const prevSnapshotsRaw = (()=>{ try{ return root.localStorage.getItem(FC.quoteSnapshotStore.SNAPSHOT_KEY || 'fc_quote_snapshots_v1'); }catch(_){ return null; } })();
      const removedKey = FC.investors.KEY_REMOVED || 'fc_investor_removed_ids_v1';
      const prevRemoved = (()=>{ try{ return root.localStorage.getItem(removedKey); }catch(_){ return null; } })();
      const prevEditSession = readEditSessionRaw();
      try{
        clearEditSession();
        FC.investors.writeAll([]);
        FC.projectStore.writeAll([]);
        try{ root.localStorage.removeItem(removedKey); }catch(_){ }
        try{
          root.localStorage.setItem(FC.quoteSnapshotStore.SNAPSHOT_KEY || 'fc_quote_snapshots_v1', JSON.stringify([{
            id:'snap_old_user_only',
            generatedAt:100,
            investor:{ id:'inv_old_user_only', kind:'person', name:'Late flow' },
            project:{ id:'proj_old_user_only', investorId:'inv_old_user_only', title:'Late flow', status:'wycena' },
            scope:{ selectedRooms:['room_a'], roomLabels:['Kuchnia A'] },
            commercial:{ preliminary:true, versionName:'Wstępna oferta — Kuchnia A' },
            totals:{ grand:1 },
            lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            meta:{ source:'quote-snapshot-store', preliminary:true, versionName:'Wstępna oferta — Kuchnia A' }
          }]));
        }catch(_){ }
        FC.quoteSnapshotStore.writeAll([{
          id:'snap_write_test_only',
          generatedAt:1776633333000,
          investor:{ id:'inv_write_test_only', kind:'person', name:'Snapshot only test' },
          project:{ id:'proj_write_test_only', investorId:'inv_write_test_only', title:'Projekt snapshot only test', status:'wycena' },
          scope:{ selectedRooms:['room_snapshot_only'], roomLabels:['Salon test'] },
          commercial:{ preliminary:false, versionName:'Oferta — Salon test' },
          totals:{ grand:456 },
          lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
          meta:{ source:'test-quote-snapshot', preliminary:false, versionName:'Oferta — Salon test' }
        }]);
        const storedInvestors = FC.investors._debug.readStoredAll();
        assert(Array.isArray(storedInvestors) && storedInvestors.length === 0, 'quoteSnapshotStore.writeAll odbudował inwestorów bocznie jeszcze przed readAll', storedInvestors);
      } finally {
        FC.projectStore.writeAll(prevProjects);
        FC.investors.writeAll(prevInvestors);
        try{
          if(prevSnapshotsRaw == null) root.localStorage.removeItem(FC.quoteSnapshotStore.SNAPSHOT_KEY || 'fc_quote_snapshots_v1');
          else root.localStorage.setItem(FC.quoteSnapshotStore.SNAPSHOT_KEY || 'fc_quote_snapshots_v1', prevSnapshotsRaw);
        }catch(_){ }
        try{
          if(prevRemoved == null) root.localStorage.removeItem(removedKey);
          else root.localStorage.setItem(removedKey, prevRemoved);
        }catch(_){ }
        restoreEditSession(prevEditSession);
      }
    }),

  ];

  FC.investorDevTestSuites = FC.investorDevTestSuites || [];
  FC.investorDevTestSuites.push({ key:'recovery-isolation', tests });
})(typeof window !== 'undefined' ? window : globalThis);
