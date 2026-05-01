(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  const H = FC.testHarness;
  if(!H) throw new Error('Brak FC.testHarness');


  function withStorageSnapshotByPredicate(predicate, setup, run){
    const saved = {};
    const keys = [];
    for(let i=0;i<localStorage.length;i += 1){
      const key = localStorage.key(i);
      if(key && predicate(key)) keys.push(key);
    }
    keys.forEach((key)=>{ saved[key] = localStorage.getItem(key); });
    Object.keys(setup || {}).forEach((key)=>{ if(!Object.prototype.hasOwnProperty.call(saved, key)) saved[key] = localStorage.getItem(key); });
    try{
      Object.keys(saved).forEach((key)=> localStorage.removeItem(key));
      Object.keys(setup || {}).forEach((key)=> localStorage.setItem(key, setup[key]));
      return run();
    } finally {
      Object.keys(saved).forEach((key)=>{
        if(saved[key] == null) localStorage.removeItem(key);
        else localStorage.setItem(key, saved[key]);
      });
    }
  }

  function withStorage(keys, run){
    const saved = {};
    Object.keys(keys || {}).forEach((key)=>{ saved[key] = localStorage.getItem(key); });
    try{
      Object.keys(keys || {}).forEach((key)=> localStorage.setItem(key, keys[key]));
      return run();
    } finally {
      Object.keys(saved).forEach((key)=>{
        if(saved[key] == null) localStorage.removeItem(key);
        else localStorage.setItem(key, saved[key]);
      });
    }
  }

  function runAll(){
    return H.runSuite('APP smoke testy', [
      H.makeTest('Data safety', 'Snapshot backupu pomija techniczne kopie i cache', 'Pilnuje, żeby backup nie puchł od roboczych backupów projektu, backupów inwestorów ani cache ROZRYS.', ()=>{
        H.assert(FC.dataBackupSnapshot && typeof FC.dataBackupSnapshot.collectSnapshot === 'function', 'Brak collectSnapshot');
        const rows = {
          fc_investors_v1:JSON.stringify([{ id:'inv_keep', name:'Zostaje' }]),
          fc_projects_v1:JSON.stringify([{ id:'project_keep', investorId:'inv_keep' }]),
          fc_project_v1:JSON.stringify({ meta:{ assignedInvestorId:'inv_keep' } }),
          fc_project_backup_v1:JSON.stringify({ huge:'project-backup' }),
          fc_project_backup_meta_v1:JSON.stringify({ at:1 }),
          fc_investors_backup_v1:JSON.stringify([{ id:'old' }]),
          fc_investors_backup_meta_v1:JSON.stringify({ at:1 }),
          fc_project_inv_inv_keep_backup_v1:JSON.stringify({ old:true }),
          fc_project_inv_inv_keep_backup_meta_v1:JSON.stringify({ at:1 }),
          fc_rozrys_plan_cache_v1:JSON.stringify({ huge:'x'.repeat(512) }),
          fc_rozrys_plan_cache_v2:JSON.stringify({ huge:'x'.repeat(512) }),
          fc_data_backups_v1:JSON.stringify([{ id:'backup', snapshot:{ keys:{} } }]),
        };
        withStorage(rows, ()=>{
          const snap = FC.dataBackupSnapshot.collectSnapshot({ reason:'test' });
          const keys = Object.keys(snap.keys || {});
          ['fc_investors_v1', 'fc_projects_v1', 'fc_project_v1'].forEach((key)=> H.assert(keys.includes(key), 'Snapshot zgubił klucz użytkownika ' + key, keys));
          Object.keys(rows).filter((key)=> key !== 'fc_investors_v1' && key !== 'fc_projects_v1' && key !== 'fc_project_v1').forEach((key)=>{
            H.assert(!keys.includes(key), 'Snapshot nie powinien zawierać technicznego klucza ' + key, keys);
          });
        });
      }),

      H.makeTest('Data safety', 'Audyt wykrywa osierocone sloty projektów inwestorów', 'Pilnuje narzędzia diagnostycznego: slot projektu bez inwestora i bez projektu centralnego ma być jawnie pokazany jako osierocony.', ()=>{
        H.assert(FC.dataStorageAudit && typeof FC.dataStorageAudit.buildAuditFromKeys === 'function', 'Brak FC.dataStorageAudit.buildAuditFromKeys');
        const audit = FC.dataStorageAudit.buildAuditFromKeys({
          fc_investors_v1:JSON.stringify([{ id:'inv_live' }]),
          fc_projects_v1:JSON.stringify([{ id:'p1', investorId:'inv_live' }]),
          fc_project_inv_inv_live_v1:JSON.stringify({ ok:true }),
          fc_project_inv_inv_old_v1:JSON.stringify({ old:true }),
        });
        H.assert(audit.projectSlots.keys === 2, 'Audyt powinien wykryć dwa sloty projektów', audit.projectSlots);
        H.assert(audit.orphanProjectSlots.keys === 1, 'Audyt powinien wykryć jeden osierocony slot', audit.orphanProjectSlots);
        H.assert(audit.orphanProjectSlots.rows[0].key === 'fc_project_inv_inv_old_v1', 'Audyt wskazał zły osierocony slot', audit.orphanProjectSlots);
      }),

      H.makeTest('Data safety', 'Raport danych pokazuje rozmiar backup store i wykluczenia snapshotu', 'Pilnuje, żeby w diagnostyce było widać realny ciężar magazynu backupów oraz klucze, które nie wchodzą już do snapshotu backupu.', ()=>{
        H.assert(FC.dataStorageAudit && typeof FC.dataStorageAudit.buildReport === 'function', 'Brak FC.dataStorageAudit.buildReport');
        const audit = FC.dataStorageAudit.buildAuditFromKeys({
          fc_data_backups_v1:JSON.stringify([{ id:'b1', snapshot:{ keys:{} } }]),
          fc_project_backup_v1:JSON.stringify({ a:1 }),
          fc_rozrys_plan_cache_v1:JSON.stringify({ cache:true }),
          fc_investors_v1:JSON.stringify([{ id:'inv_live' }]),
        });
        const report = FC.dataStorageAudit.buildReport(audit);
        H.assert(report.indexOf('Magazyn backupów') >= 0, 'Raport nie pokazuje magazynu backupów', report);
        H.assert(report.indexOf('Wykluczone ze snapshotu') >= 0, 'Raport nie pokazuje wykluczeń snapshotu', report);
        H.assert(report.indexOf('Techniczne kopie awaryjne') >= 0, 'Raport nie pokazuje technicznych kopii awaryjnych', report);
      }),

      H.makeTest('Data safety', 'Plan czyszczenia osieroconych projektów nie obejmuje aktywnego inwestora', 'Pilnuje półautomatu sprzątania bez dotykania realnego localStorage: plan usuwa tylko sloty bez aktualnego inwestora/projektu.', ()=>{
        H.assert(FC.dataStorageOrphanCleanup && typeof FC.dataStorageOrphanCleanup.planFromKeys === 'function', 'Brak FC.dataStorageOrphanCleanup.planFromKeys');
        const plan = FC.dataStorageOrphanCleanup.planFromKeys({
          fc_investors_v1:JSON.stringify([{ id:'inv_live' }]),
          fc_projects_v1:JSON.stringify([{ id:'p1', investorId:'inv_live' }]),
          fc_project_inv_inv_live_v1:JSON.stringify({ live:true }),
          fc_project_inv_inv_old_v1:JSON.stringify({ old:true }),
        });
        H.assert(plan.count === 1, 'Plan powinien wykryć jedną sierotę', plan);
        H.assert(plan.rows[0].key === 'fc_project_inv_inv_old_v1', 'Plan wskazał zły slot do czyszczenia', plan);
      }),

      H.makeTest('Data safety', 'Czyszczenie osieroconych projektów usuwa tylko osierocone sloty', 'Pilnuje przycisku przed testami: wyczyszczenie sierot ma fizycznie usunąć fc_project_inv_* bez inwestora i zostawić slot aktywnego inwestora.', ()=>{
        H.assert(FC.dataStorageOrphanCleanup && typeof FC.dataStorageOrphanCleanup.cleanupCurrent === 'function', 'Brak FC.dataStorageOrphanCleanup.cleanupCurrent');
        const rows = {
          fc_investors_v1:JSON.stringify([{ id:'inv_live' }]),
          fc_projects_v1:JSON.stringify([{ id:'p1', investorId:'inv_live' }]),
          fc_project_inv_inv_live_v1:JSON.stringify({ live:true }),
          fc_project_inv_inv_old_v1:JSON.stringify({ old:true }),
        };
        withStorageSnapshotByPredicate((key)=> key === 'fc_investors_v1' || key === 'fc_projects_v1' || /^fc_project_inv_.+_v1$/.test(key), rows, ()=>{
          const before = FC.dataStorageOrphanCleanup.analyzeCurrent();
          const summary = FC.dataStorageOrphanCleanup.cleanupCurrent();
          H.assert(before.count >= 1, 'Fixture powinien mieć co najmniej jedną sierotę przed czyszczeniem', before);
          H.assert(summary.removed >= 1, 'Czyszczenie powinno usunąć istniejące sieroty, nie wymagać dokładnie jednej', summary);
          H.assert(localStorage.getItem('fc_project_inv_inv_old_v1') == null, 'Osierocony slot nie został fizycznie usunięty');
          H.assert(localStorage.getItem('fc_project_inv_inv_live_v1') != null, 'Czyszczenie naruszyło slot aktywnego inwestora');
          const after = FC.dataStorageOrphanCleanup.analyzeCurrent();
          H.assert(after.count === 0, 'Po czyszczeniu nie powinno być sierot w fixture', after);
        });
      }),

      H.makeTest('Data safety', 'Awaryjny backup testów potrafi pobrać snapshot do pliku', 'Pilnuje bezpiecznika testów: gdy localStorage nie przyjmie backupu before-tests, program ma dostępny eksport plikowy zamiast startu bez zabezpieczenia.', ()=>{
        H.assert(FC.testDataSafety && typeof FC.testDataSafety.buildManualBackup === 'function', 'Brak FC.testDataSafety.buildManualBackup');
        H.assert(FC.dataBackupSnapshot && typeof FC.dataBackupSnapshot.downloadJson === 'function', 'Brak downloadJson');
        const oldDownload = FC.dataBackupSnapshot.downloadJson;
        let downloaded = null;
        try{
          FC.dataBackupSnapshot.downloadJson = (filename, payload)=>{ downloaded = { filename, payload }; };
          const info = FC.testDataSafety.buildManualBackup('data-test');
          H.assert(downloaded && downloaded.filename.indexOf('meble-app-before-tests-') === 0, 'Nie wywołano pobrania pliku backupu', downloaded);
          H.assert(downloaded.payload && downloaded.payload.kind === 'meble-app-data-export', 'Eksport testów ma zły payload', downloaded);
          H.assert(info && info.snapshotKeys >= 0, 'Helper nie zwrócił metadanych pliku', info);
        } finally {
          FC.dataBackupSnapshot.downloadJson = oldDownload;
        }
      }),

      H.makeTest('Data safety', 'Backupy testowe mają twardy limit 10 najnowszych sztuk', 'Pilnuje decyzji: automatyczne backupy before-tests mogą mieć maksymalnie 10 kopii, a ręczne backupy zachowują dotychczasową retencję.', ()=>{
        H.assert(FC.dataBackupStore && typeof FC.dataBackupStore.createBackup === 'function', 'Brak FC.dataBackupStore.createBackup');
        const backupKey = FC.dataBackupStore.STORE_KEY || 'fc_data_backups_v1';
        const saved = { store:localStorage.getItem(backupKey), investors:localStorage.getItem('fc_investors_v1') };
        try{
          localStorage.setItem(backupKey, '[]');
          localStorage.setItem('fc_investors_v1', JSON.stringify([{ id:'inv_backup_limit', name:'Backup limit' }]));
          for(let i=0;i<12;i += 1){
            FC.dataBackupStore.createBackup({ reason:'before-tests', label:'Przed testami limit ' + i, dedupe:false });
          }
          const groups = FC.dataBackupStore.listBackupGroups();
          H.assert(groups.test.length === 10, 'Backupy testowe powinny zostać przycięte do 10 najnowszych sztuk', groups);
        } finally {
          if(saved.store == null) localStorage.removeItem(backupKey); else localStorage.setItem(backupKey, saved.store);
          if(saved.investors == null) localStorage.removeItem('fc_investors_v1'); else localStorage.setItem('fc_investors_v1', saved.investors);
        }
      }),

      H.makeTest('Data safety', 'Zapis backup store odchudza stare backupy bez zmiany retencji', 'Pilnuje naprawy quota: stare zapisane backupy są przepisywane bez technicznych kluczy, ale bez zmiany liczby backupów i zasad ochrony.', ()=>{
        H.assert(FC.dataBackupStore && typeof FC.dataBackupStore.createBackup === 'function', 'Brak FC.dataBackupStore.createBackup');
        const backupKey = FC.dataBackupStore.STORE_KEY || 'fc_data_backups_v1';
        const saved = {
          store:localStorage.getItem(backupKey),
          investors:localStorage.getItem('fc_investors_v1'),
          projectBackup:localStorage.getItem('fc_project_backup_v1'),
        };
        try{
          const oldBackup = {
            id:'old_fat_backup',
            group:'app',
            createdAt:'2026-04-20T00:00:00.000Z',
            createdAtMs:1,
            snapshot:{ kind:'meble-app-storage-snapshot', version:1, createdAt:'2026-04-20T00:00:00.000Z', meta:{}, keys:{
              fc_investors_v1:JSON.stringify([{ id:'inv_old' }]),
              fc_project_backup_v1:JSON.stringify({ huge:'x'.repeat(256) }),
              fc_rozrys_plan_cache_v1:JSON.stringify({ cache:true }),
            } },
            stats:{},
          };
          localStorage.setItem(backupKey, JSON.stringify([oldBackup]));
          localStorage.setItem('fc_investors_v1', JSON.stringify([{ id:'inv_now' }]));
          localStorage.setItem('fc_project_backup_v1', JSON.stringify({ stale:true }));
          FC.dataBackupStore.createBackup({ reason:'manual', label:'Quota compaction test', dedupe:false });
          const rows = JSON.parse(localStorage.getItem(backupKey) || '[]');
          H.assert(Array.isArray(rows) && rows.length === 2, 'Kompakcja nie może zmienić liczby backupów poza dodaniem nowego', rows);
          const compacted = rows.find((row)=> String(row && row.id || '') === 'old_fat_backup');
          H.assert(compacted && compacted.snapshot && compacted.snapshot.keys, 'Stary backup nie został zachowany', rows);
          H.assert(!Object.prototype.hasOwnProperty.call(compacted.snapshot.keys, 'fc_project_backup_v1'), 'Stary backup nadal zawiera fc_project_backup_v1', compacted);
          H.assert(!Object.prototype.hasOwnProperty.call(compacted.snapshot.keys, 'fc_rozrys_plan_cache_v1'), 'Stary backup nadal zawiera cache ROZRYS', compacted);
          H.assert(Object.prototype.hasOwnProperty.call(compacted.snapshot.keys, 'fc_investors_v1'), 'Kompakcja nie może usuwać danych użytkownika', compacted);
        } finally {
          if(saved.store == null) localStorage.removeItem(backupKey); else localStorage.setItem(backupKey, saved.store);
          if(saved.investors == null) localStorage.removeItem('fc_investors_v1'); else localStorage.setItem('fc_investors_v1', saved.investors);
          if(saved.projectBackup == null) localStorage.removeItem('fc_project_backup_v1'); else localStorage.setItem('fc_project_backup_v1', saved.projectBackup);
        }
      }),
    ]);
  }

  FC.dataSafetyDevTests = { runAll };
})(typeof window !== 'undefined' ? window : globalThis);
