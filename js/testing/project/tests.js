(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  const H = FC.testHarness;
  if(!H) throw new Error('Brak FC.testHarness');

  function withInvestorStorage(run){
    const inv = FC.investors;
    if(!inv) throw new Error('Brak FC.investors');
    const prevAll = inv.readAll();
    const prevCurrent = inv.getCurrentId();
    try{
      inv.writeAll([]);
      inv.setCurrentId(null);
      return run(inv);
    } finally {
      inv.writeAll(prevAll);
      inv.setCurrentId(prevCurrent);
    }
  }

  function buildDefaultProject(){
    return {
      kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{ roomHeight:260 } },
      szafa:{ cabinets:[], fronts:[], sets:[], settings:{} },
      pokoj:{ cabinets:[], fronts:[], sets:[], settings:{} },
      lazienka:{ cabinets:[], fronts:[], sets:[], settings:{} },
    };
  }

  function runAll(){
    return H.runSuite('APP smoke testy', [
      H.makeTest('Projekt', 'Normalizer projektu uzupełnia brakujące pokoje i tablice', 'Sprawdza, czy bootstrap projektu nie zostawia brakujących pokoi albo pustych struktur po starych danych.', ()=>{
        if(!FC.projectBootstrap || typeof FC.projectBootstrap.normalizeProjectData !== 'function') throw new Error('Brak normalizeProjectData');
        FC.project = FC.project || {};
        FC.project.DEFAULT_PROJECT = buildDefaultProject();
        FC.project.save = (pd)=> pd;
        const project = { kuchnia:{ cabinets:[{ id:'cab1' }], settings:{} } };
        const out = FC.projectBootstrap.normalizeProjectData(project, buildDefaultProject());
        H.assert(Array.isArray(out.kuchnia.cabinets), 'Kuchnia nie ma cabinets', out);
        H.assert(Array.isArray(out.szafa.cabinets), 'Brak domyślnej szafy po normalizacji', out);
        H.assert(Array.isArray(out.pokoj.fronts), 'Brak domyślnych fronts w pokoju', out);
      }),

      H.makeTest('Projekt', 'Resolver zakresu pokoi zachowuje zły exact scope zamiast po cichu przełączać na inne pomieszczenie', 'Pilnuje rdzenia pokojów: jeśli użytkownik ma zapisany konkretny pokój, którego już nie ma w aktywnej liście, resolver ma go zachować do walidacji zamiast zamieniać po cichu na inne pomieszczenie.', ()=>{
        H.assert(FC.roomScopeResolver && typeof FC.roomScopeResolver.resolveSelection === 'function', 'Brak FC.roomScopeResolver.resolveSelection');
        const resolved = FC.roomScopeResolver.resolveSelection({ selectedRooms:['room_missing'] }, { getActiveRooms:()=> ['room_kuchnia','room_salon'], useRozrysScope:false });
        H.assert(Array.isArray(resolved.selectedRooms) && resolved.selectedRooms.length === 1 && resolved.selectedRooms[0] === 'room_missing', 'Resolver nie zachował wyraźnie wybranego, ale brakującego pokoju', resolved);
        H.assert(Array.isArray(resolved.validSelectedRooms) && resolved.validSelectedRooms.length === 0, 'Resolver błędnie uznał brakujący pokój za poprawny', resolved);
        H.assert(String(resolved.fallbackReason || '') === 'preserve-explicit', 'Resolver nie oznaczył zachowanego exact scope jako preserve-explicit', resolved);
      }),

      H.makeTest('Projekt', 'Backup danych obejmuje pełny storage aplikacji i potrafi przywrócić stan', 'Pilnuje fundamentu bezpieczeństwa danych: backup ma obejmować wszystkie klucze aplikacji, nie tylko inwestorów, i ma umieć wrócić do poprzedniego stanu.', ()=>{
        H.assert(FC.dataBackupStore && typeof FC.dataBackupStore.createBackup === 'function', 'Brak FC.dataBackupStore.createBackup');
        H.assert(FC.dataBackupSnapshot && typeof FC.dataBackupSnapshot.applySnapshot === 'function', 'Brak FC.dataBackupSnapshot.applySnapshot');
        const backupKey = FC.dataBackupStore.STORE_KEY || 'fc_data_backups_v1';
        const prevBackupsRaw = localStorage.getItem(backupKey);
        const prevInvRaw = localStorage.getItem('fc_investors_v1');
        const prevProjectsRaw = localStorage.getItem('fc_projects_v1');
        try{
          localStorage.setItem(backupKey, '[]');
          localStorage.setItem('fc_investors_v1', JSON.stringify([{ id:'backup_test_inv', name:'Backup Test' }]));
          localStorage.setItem('fc_projects_v1', JSON.stringify([{ id:'backup_test_project', investorId:'backup_test_inv' }]));
          const made = FC.dataBackupStore.createBackup({ reason:'manual', label:'Test backup', dedupe:false });
          H.assert(made && made.created && made.backup && made.backup.snapshot, 'Backup nie został utworzony', made);
          H.assert(made.backup.snapshot.keys.fc_investors_v1 && made.backup.snapshot.keys.fc_projects_v1, 'Backup nie objął inwestorów i projektów', made.backup.snapshot.keys);
          localStorage.setItem('fc_investors_v1', JSON.stringify([]));
          FC.dataBackupStore.restoreBackup(made.backup.id);
          const restored = JSON.parse(localStorage.getItem('fc_investors_v1') || '[]');
          H.assert(Array.isArray(restored) && restored.some((row)=> row && row.id === 'backup_test_inv'), 'Przywrócenie backupu nie odtworzyło inwestora', restored);
        } finally {
          if(prevBackupsRaw == null) localStorage.removeItem(backupKey); else localStorage.setItem(backupKey, prevBackupsRaw);
          if(prevInvRaw == null) localStorage.removeItem('fc_investors_v1'); else localStorage.setItem('fc_investors_v1', prevInvRaw);
          if(prevProjectsRaw == null) localStorage.removeItem('fc_projects_v1'); else localStorage.setItem('fc_projects_v1', prevProjectsRaw);
        }
      }),

      H.makeTest('Projekt', 'Backup danych pomija techniczne stany sesji i cache przy restore', 'Pilnuje, czy backup nie puchnie od tymczasowych danych pracy oraz czy restore nie przywraca starej aktywnej sesji edycji ani cache ROZRYS.', ()=>{
        H.assert(FC.dataBackupStore && typeof FC.dataBackupStore.createBackup === 'function', 'Brak FC.dataBackupStore.createBackup');
        H.assert(FC.dataBackupSnapshot && typeof FC.dataBackupSnapshot.applySnapshot === 'function', 'Brak FC.dataBackupSnapshot.applySnapshot');
        const backupKey = FC.dataBackupStore.STORE_KEY || 'fc_data_backups_v1';
        const volatileKeys = ['fc_edit_session_v1', 'fc_reload_restore_v1', 'fc_rozrys_plan_cache_v2'];
        const saved = {};
        [backupKey, 'fc_investors_v1'].concat(volatileKeys).forEach((key)=>{ saved[key] = localStorage.getItem(key); });
        try{
          localStorage.setItem(backupKey, '[]');
          localStorage.setItem('fc_investors_v1', JSON.stringify([{ id:'volatile_backup_inv', name:'Volatile Backup' }]));
          localStorage.setItem('fc_edit_session_v1', JSON.stringify({ active:true, snapshot:{ fc_investors_v1:'[]' } }));
          localStorage.setItem('fc_reload_restore_v1', JSON.stringify({ activeTab:'wycena' }));
          localStorage.setItem('fc_rozrys_plan_cache_v2', JSON.stringify({ huge:'x'.repeat(4096) }));
          const made = FC.dataBackupStore.createBackup({ reason:'manual', label:'Volatile test backup', dedupe:false });
          const keys = made && made.backup && made.backup.snapshot && made.backup.snapshot.keys || {};
          volatileKeys.forEach((key)=> H.assert(!Object.prototype.hasOwnProperty.call(keys, key), 'Backup nie powinien zawierać technicznego klucza ' + key, keys));
          volatileKeys.forEach((key)=> localStorage.setItem(key, 'stary-stan-techniczny'));
          FC.dataBackupStore.restoreBackup(made.backup.id);
          volatileKeys.forEach((key)=> H.assert(localStorage.getItem(key) === null, 'Restore powinien wyczyścić techniczny klucz ' + key));
        } finally {
          Object.keys(saved).forEach((key)=>{
            if(saved[key] == null) localStorage.removeItem(key);
            else localStorage.setItem(key, saved[key]);
          });
        }
      }),

      H.makeTest('Projekt', 'Przywracanie nie tworzy zbędnego backupu, gdy obecny stan już jest zapisany', 'Pilnuje naprawy restore: jeśli aktualne dane są już w istniejącym backupie, przywracanie nie dokłada drugiego identycznego before-restore i nie ryzykuje błędu zapisu.', ()=>{
        H.assert(FC.dataBackupStore && typeof FC.dataBackupStore.createBackup === 'function', 'Brak FC.dataBackupStore.createBackup');
        const backupKey = FC.dataBackupStore.STORE_KEY || 'fc_data_backups_v1';
        const prevBackupsRaw = localStorage.getItem(backupKey);
        const prevInvRaw = localStorage.getItem('fc_investors_v1');
        try{
          localStorage.setItem(backupKey, '[]');
          localStorage.setItem('fc_investors_v1', JSON.stringify([{ id:'restore_same_state_inv', name:'Same State' }]));
          const made = FC.dataBackupStore.createBackup({ reason:'manual', label:'Same state backup', dedupe:false });
          H.assert(FC.dataBackupStore.listBackups().length === 1, 'Test powinien startować z jednym backupem');
          FC.dataBackupStore.restoreBackup(made.backup.id);
          const rows = FC.dataBackupStore.listBackups();
          H.assert(rows.length === 1, 'Restore identycznego obecnego stanu nie powinien dopisać duplikatu before-restore', rows);
        } finally {
          if(prevBackupsRaw == null) localStorage.removeItem(backupKey); else localStorage.setItem(backupKey, prevBackupsRaw);
          if(prevInvRaw == null) localStorage.removeItem('fc_investors_v1'); else localStorage.setItem('fc_investors_v1', prevInvRaw);
        }
      }),


      H.makeTest('Projekt', 'Retencja backupów działa osobno dla programu i testów', 'Pilnuje, czy automatyczne sprzątanie zostawia 10 najnowszych backupów w każdej grupie, usuwa tylko starszy nadmiar i nie miesza backupów testowych z programowymi.', ()=>{
        H.assert(FC.dataBackupStore && typeof FC.dataBackupStore.pruneNow === 'function', 'Brak FC.dataBackupStore.pruneNow');
        const backupKey = FC.dataBackupStore.STORE_KEY || 'fc_data_backups_v1';
        const prevBackupsRaw = localStorage.getItem(backupKey);
        const day = 24 * 60 * 60 * 1000;
        const base = Date.now();
        function fakeBackup(id, reason, index, pinned){
          return {
            id,
            reason,
            label:id,
            createdAt:new Date(base - index * day).toISOString(),
            createdAtMs:base - index * day,
            pinned:!!pinned,
            snapshot:{ keys:{ fc_backup_policy_test:JSON.stringify({ id }) } },
          };
        }
        try{
          const seed = [];
          for(let i=0;i<13;i += 1) seed.push(fakeBackup('app_' + i, 'manual', i, i === 12));
          for(let i=0;i<13;i += 1) seed.push(fakeBackup('test_' + i, 'before-tests', i, i === 12));
          localStorage.setItem(backupKey, JSON.stringify(seed));
          const pruned = FC.dataBackupStore.pruneNow();
          const ids = new Set(pruned.map((item)=> item.id));
          for(let i=0;i<10;i += 1){
            H.assert(ids.has('app_' + i), 'Sprzątanie usunęło jeden z 10 najnowszych backupów programu', pruned);
            H.assert(ids.has('test_' + i), 'Sprzątanie usunęło jeden z 10 najnowszych backupów testowych', pruned);
          }
          H.assert(!ids.has('app_10') && !ids.has('app_11'), 'Sprzątanie nie usunęło starego nadmiaru programu poza ostatnią dziesiątką', pruned);
          H.assert(!ids.has('test_10') && !ids.has('test_11'), 'Sprzątanie nie usunęło starego nadmiaru testów poza ostatnią dziesiątką', pruned);
          H.assert(ids.has('app_12') && ids.has('test_12'), 'Sprzątanie usunęło przypięty stary backup', pruned);
          const groups = FC.dataBackupStore.listBackupGroups();
          H.assert(groups.app.length === 11 && groups.test.length === 11, 'Grupy backupów nie są liczone osobno po retencji', groups);
        } finally {
          if(prevBackupsRaw == null) localStorage.removeItem(backupKey); else localStorage.setItem(backupKey, prevBackupsRaw);
        }
      }),

      H.makeTest('Projekt', 'Trzy najnowsze backupy w każdej grupie są chronione przed ręcznym usunięciem', 'Pilnuje, czy blokada usuwania działa osobno dla backupów programu i testowych: 3 najnowsze są chronione, a 4. backup można usunąć ręcznie.', ()=>{
        H.assert(FC.dataBackupStore && typeof FC.dataBackupStore.getBackupProtection === 'function', 'Brak FC.dataBackupStore.getBackupProtection');
        const backupKey = FC.dataBackupStore.STORE_KEY || 'fc_data_backups_v1';
        const prevBackupsRaw = localStorage.getItem(backupKey);
        const day = 24 * 60 * 60 * 1000;
        const base = Date.now();
        function fakeBackup(id, reason, index){
          return {
            id,
            reason,
            label:id,
            createdAt:new Date(base - index * day).toISOString(),
            createdAtMs:base - index * day,
            snapshot:{ keys:{ fc_backup_delete_test:JSON.stringify({ id }) } },
          };
        }
        try{
          const seed = [];
          for(let i=0;i<5;i += 1) seed.push(fakeBackup('app_del_' + i, 'manual', i));
          for(let i=0;i<5;i += 1) seed.push(fakeBackup('test_del_' + i, 'before-tests', i));
          localStorage.setItem(backupKey, JSON.stringify(seed));
          const all = FC.dataBackupStore.listBackups();
          H.assert(FC.dataBackupStore.getBackupProtection(all.find((item)=> item.id === 'app_del_2'), all).latestProtected === true, 'Trzeci backup programu powinien być automatycznie chroniony', all);
          H.assert(FC.dataBackupStore.getBackupProtection(all.find((item)=> item.id === 'test_del_2'), all).latestProtected === true, 'Trzeci backup testowy powinien być automatycznie chroniony', all);
          let appBlocked = false;
          let testBlocked = false;
          try{ FC.dataBackupStore.deleteBackup('app_del_2'); }catch(_){ appBlocked = true; }
          try{ FC.dataBackupStore.deleteBackup('test_del_2'); }catch(_){ testBlocked = true; }
          H.assert(appBlocked && testBlocked, 'Trzy najnowsze backupy nie zostały zablokowane przed usunięciem');
          FC.dataBackupStore.deleteBackup('app_del_3');
          FC.dataBackupStore.deleteBackup('test_del_3');
          const ids = new Set(FC.dataBackupStore.listBackups().map((item)=> item.id));
          H.assert(!ids.has('app_del_3') && !ids.has('test_del_3'), 'Czwarty backup w grupie powinien dać się usunąć ręcznie', Array.from(ids));
        } finally {
          if(prevBackupsRaw == null) localStorage.removeItem(backupKey); else localStorage.setItem(backupKey, prevBackupsRaw);
        }
      }),

      H.makeTest('Projekt', 'Raport danych dzieli storage na użytkownika, techniczne i testowe', 'Pilnuje etapu data safety 2: raport ma pokazywać osobno realne dane, stan techniczny i oznaczone rekordy testowe oraz listę kluczy danych.', ()=>{
        H.assert(FC.dataBackupSnapshot && typeof FC.dataBackupSnapshot.readDataSummaryFromSnapshot === 'function', 'Brak readDataSummaryFromSnapshot');
        const saved = {};
        ['fc_investors_v1','fc_ui_v1','fc_quote_snapshots_v1'].forEach((key)=>{ saved[key] = localStorage.getItem(key); });
        try{
          localStorage.setItem('fc_investors_v1', JSON.stringify([
            { id:'real_data_safety_inv', name:'Realny', meta:{} },
            { id:'test_data_safety_inv', name:'Testowy', __test:true, __testRunId:'report_run', meta:{ __test:true, __testRunId:'report_run', testData:true, testOwner:'dev-tests', testRunId:'report_run' } }
          ]));
          localStorage.setItem('fc_ui_v1', JSON.stringify({ activeTab:'wywiad' }));
          localStorage.setItem('fc_quote_snapshots_v1', JSON.stringify([
            { id:'qs_test_report', __test:true, __testRunId:'report_run', meta:{ __test:true, __testRunId:'report_run', testData:true, testOwner:'dev-tests', testRunId:'report_run' } }
          ]));
          const snapshot = FC.dataBackupSnapshot.collectSnapshot({ reason:'report-test' });
          const summary = FC.dataBackupSnapshot.readDataSummaryFromSnapshot(snapshot);
          H.assert(summary.user.keys >= 1, 'Raport nie wykrył danych użytkownika', summary);
          H.assert(summary.technical.keys >= 1, 'Raport nie wykrył danych technicznych', summary);
          H.assert(summary.test.records >= 2, 'Raport nie policzył oznaczonych rekordów testowych', summary);
          H.assert((summary.byCategory.user || []).some((entry)=> entry.key === 'fc_investors_v1'), 'Lista kluczy nie zawiera inwestorów', summary.byCategory.user);
          const report = FC.dataBackupSnapshot.buildDiagnosticsReport();
          H.assert(report.includes('Dane użytkownika:') && report.includes('Dane techniczne:') && report.includes('Dane testowe:') && report.includes('Lista kluczy danych:'), 'Raport tekstowy nie ma wymaganych sekcji', report);
        } finally {
          Object.keys(saved).forEach((key)=>{ if(saved[key] == null) localStorage.removeItem(key); else localStorage.setItem(key, saved[key]); });
        }
      }),

      H.makeTest('Projekt', 'Eksport pojedynczego backupu zwraca payload konkretnego backupu', 'Pilnuje, czy przycisk Eksportuj przy backupie ma testowalny kontrakt i eksportuje wskazany backup, a nie cały bieżący stan.', ()=>{
        H.assert(FC.dataBackupStore && typeof FC.dataBackupStore.exportBackupPayload === 'function', 'Brak exportBackupPayload');
        const backupKey = FC.dataBackupStore.STORE_KEY || 'fc_data_backups_v1';
        const prevBackupsRaw = localStorage.getItem(backupKey);
        const prevInvRaw = localStorage.getItem('fc_investors_v1');
        try{
          localStorage.setItem(backupKey, '[]');
          localStorage.setItem('fc_investors_v1', JSON.stringify([{ id:'export_one_inv', name:'Eksport jeden' }]));
          const made = FC.dataBackupStore.createBackup({ reason:'manual', label:'Eksport jednostkowy', dedupe:false });
          const pack = FC.dataBackupStore.exportBackupPayload(made.backup.id);
          H.assert(pack && /meble-app-backup-/.test(pack.filename || ''), 'Eksport nie zwrócił nazwy pliku', pack);
          H.assert(pack.payload && pack.payload.kind === FC.dataBackupSnapshot.BACKUP_KIND, 'Eksport nie zwrócił payloadu backupu', pack.payload);
          H.assert(pack.payload.backup && pack.payload.backup.id === made.backup.id, 'Eksport zwrócił inny backup niż wskazany', pack.payload);
          H.assert(pack.payload.backup.snapshot && pack.payload.backup.snapshot.keys && pack.payload.backup.snapshot.keys.fc_investors_v1, 'Eksport backupu nie zawiera snapshotu danych', pack.payload.backup);
        } finally {
          if(prevBackupsRaw == null) localStorage.removeItem(backupKey); else localStorage.setItem(backupKey, prevBackupsRaw);
          if(prevInvRaw == null) localStorage.removeItem('fc_investors_v1'); else localStorage.setItem('fc_investors_v1', prevInvRaw);
        }
      }),

      H.makeTest('Projekt', 'Test isolation używa __test i __testRunId oraz sprząta tylko oznaczone dane', 'Pilnuje etapu test isolation: fixtures dostają jeden runId, a cleanup usuwa testowych inwestorów, projekty, zlecenia, snapshoty, drafty i katalogi bez ruszania realnych rekordów.', ()=>{
        H.assert(FC.testDataManager && typeof FC.testDataManager.beginRun === 'function', 'Brak FC.testDataManager.beginRun');
        const keys = ['fc_investors_v1','fc_projects_v1','fc_service_orders_v1','fc_quote_snapshots_v1','fc_quote_offer_drafts_v1','fc_sheet_materials_v1','fc_edge_v1'];
        const saved = {};
        keys.forEach((key)=>{ saved[key] = localStorage.getItem(key); });
        try{
          FC.testDataManager.beginRun({ runId:'stage2_run', mode:'unit' });
          FC.investors.writeAll([{ id:'real_iso_inv', name:'Realny inwestor', rooms:[], meta:{} }]);
          FC.projectStore.writeAll([{ id:'real_iso_project', investorId:'real_iso_inv', title:'Realny projekt', projectData:{ kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{} } }, meta:{} }]);
          FC.serviceOrderStore.writeAll([{ id:'real_iso_order', title:'Realne zlecenie', clientName:'Realny', meta:{} }]);
          const testInvestor = FC.testDataManager.createInvestor({ name:'Test isolation' });
          const testOrder = FC.testDataManager.createServiceOrder({ title:'Testowe zlecenie isolation' });
          FC.projectStore.saveProjectDataForInvestor(testInvestor.id, { kuchnia:{ cabinets:[{ id:'cab_iso_test' }], fronts:[], sets:[], settings:{} } }, { meta: FC.testDataManager.buildMeta('project') });
          localStorage.setItem('fc_quote_snapshots_v1', JSON.stringify([
            { id:'real_iso_quote', meta:{} },
            { id:'test_iso_quote', __test:true, __testRunId:'stage2_run', meta:{ __test:true, __testRunId:'stage2_run', testData:true, testOwner:'dev-tests', testRunId:'stage2_run' } }
          ]));
          localStorage.setItem('fc_quote_offer_drafts_v1', JSON.stringify([
            { projectId:'real_iso_project', investorId:'real_iso_inv' },
            { projectId:'test_iso_project', investorId:testInvestor.id, __test:true, __testRunId:'stage2_run', meta:{ __test:true, __testRunId:'stage2_run', testData:true, testOwner:'dev-tests', testRunId:'stage2_run' } }
          ]));
          localStorage.setItem('fc_sheet_materials_v1', JSON.stringify([
            { id:'real_iso_mat', name:'Realny materiał' },
            { id:'test_iso_mat', name:'Test materiał', __test:true, __testRunId:'stage2_run', meta:{ __test:true, __testRunId:'stage2_run', testData:true, testOwner:'dev-tests', testRunId:'stage2_run' } }
          ]));
          localStorage.setItem('fc_edge_v1', JSON.stringify({ real_edge:{ value:'real' }, test_edge:{ __test:true, __testRunId:'stage2_run', meta:{ __test:true, __testRunId:'stage2_run', testData:true, testOwner:'dev-tests', testRunId:'stage2_run' } } }));
          H.assert(testInvestor && testInvestor.__test === true && testInvestor.__testRunId === 'stage2_run', 'Inwestor testowy nie dostał markerów top-level', testInvestor);
          H.assert(testOrder && testOrder.__test === true && testOrder.__testRunId === 'stage2_run', 'Zlecenie testowe nie dostało markerów top-level', testOrder);
          const result = FC.testDataManager.cleanup({ runId:'stage2_run' });
          const investors = FC.investors.readAll();
          const projects = FC.projectStore.readAll();
          const orders = FC.serviceOrderStore.readAll();
          const quotes = JSON.parse(localStorage.getItem('fc_quote_snapshots_v1') || '[]');
          const drafts = JSON.parse(localStorage.getItem('fc_quote_offer_drafts_v1') || '[]');
          const mats = JSON.parse(localStorage.getItem('fc_sheet_materials_v1') || '[]');
          const edge = JSON.parse(localStorage.getItem('fc_edge_v1') || '{}');
          H.assert(result.investors >= 1 && result.projects >= 1 && result.serviceOrders >= 1, 'Cleanup nie zgłosił usunięcia podstawowych danych testowych', result);
          H.assert(investors.length === 1 && investors[0].id === 'real_iso_inv', 'Cleanup naruszył inwestorów realnych albo zostawił testowych', investors);
          H.assert(projects.length === 1 && projects[0].id === 'real_iso_project', 'Cleanup naruszył projekty realne albo zostawił testowe', projects);
          H.assert(orders.length === 1 && orders[0].id === 'real_iso_order', 'Cleanup naruszył zlecenia realne albo zostawił testowe', orders);
          H.assert(quotes.length === 1 && quotes[0].id === 'real_iso_quote', 'Cleanup snapshotów wycen nie działa per marker', quotes);
          H.assert(drafts.length === 1 && drafts[0].projectId === 'real_iso_project', 'Cleanup draftów ofert nie działa per marker/inwestor', drafts);
          H.assert(mats.length === 1 && mats[0].id === 'real_iso_mat', 'Cleanup katalogów nie działa per marker', mats);
          H.assert(edge.real_edge && !edge.test_edge, 'Cleanup map obiektowych nie usunął testowego wpisu oklein', edge);
        } finally {
          try{ FC.testDataManager.endRun(); }catch(_){ }
          Object.keys(saved).forEach((key)=>{ if(saved[key] == null) localStorage.removeItem(key); else localStorage.setItem(key, saved[key]); });
        }
      }),
      H.makeTest('Projekt', 'Sesja wykrywa zmianę od razu po zapisie do localStorage i czyści ją po commit', 'Pilnuje nowego lżejszego wykrywania zmian: po edycji nie trzeba czekać na pełne skanowanie storage, a po Zapisz stan dirty ma zniknąć.', ()=>{
        H.assert(FC.session && typeof FC.session.begin === 'function', 'Brak FC.session.begin');
        const key = (FC.constants && FC.constants.STORAGE_KEYS && FC.constants.STORAGE_KEYS.ui) || 'fc_ui_v1';
        const prevRaw = localStorage.getItem(key);
        const prevSessionRaw = localStorage.getItem('fc_edit_session_v1');
        try{
          localStorage.setItem(key, JSON.stringify({ activeTab:'wywiad' }));
          FC.session.commit();
          FC.session.begin();
          H.assert(FC.session.isDirty() === false, 'Nowa sesja nie powinna startować jako dirty');
          localStorage.setItem(key, JSON.stringify({ activeTab:'wycena' }));
          H.assert(FC.session.isDirty() === true, 'Sesja nie wykryła zmiany od razu po zapisie do localStorage');
          FC.session.commit();
          H.assert(FC.session.isDirty() === false, 'Commit nie wyczyścił stanu dirty');
        } finally {
          if(prevRaw === null) localStorage.removeItem(key);
          else localStorage.setItem(key, prevRaw);
          if(prevSessionRaw === null) localStorage.removeItem('fc_edit_session_v1');
          else localStorage.setItem('fc_edit_session_v1', prevSessionRaw);
          try{ FC.session.commit(); }catch(_){ }
        }
      }),

      H.makeTest('Projekt', 'Bootstrap stanu aplikacji zwraca kompletny pakiet startowy', 'Pilnuje, czy wydzielony bootstrap stanu z app.js potrafi złożyć materiały, stawki, projekt i uiState bez zależności od pełnego app.js.', ()=>{
        H.assert(FC.appStateBootstrap && typeof FC.appStateBootstrap.createInitialState === 'function', 'Brak FC.appStateBootstrap.createInitialState');
        const fakeFC = {
          storage: {
            getJSON(key, fallback){ return Array.isArray(fallback) ? fallback.slice() : Object.assign({}, fallback || {}); },
            setJSON(){},
          },
          project: { load(){ return { kuchnia:{ cabinets:[{ id:'cab' }], fronts:[], sets:[], settings:{} } }; } },
          uiState: {
            defaults(){ return { activeTab:'wywiad', expanded:{}, roomType:null, selectedCabinetId:null }; },
            get(){ return { activeTab:'material', roomType:'kuchnia' }; },
          },
          validate: {
            validateMaterials(items){ return items.concat([{ id:'m_extra' }]); },
            validateServices(items){ return items; },
            validateProject(project){ project.validated = true; return project; },
            validateUIState(state){ state.validated = true; return state; },
            persistIfPossible(){},
          },
        };
        const out = FC.appStateBootstrap.createInitialState({
          FC: fakeFC,
          storageKeys: { materials:'m', services:'s', projectData:'p', ui:'u' },
          defaultProject: buildDefaultProject(),
        });
        H.assert(Array.isArray(out.materials) && out.materials.length >= 3, 'Bootstrap stanu nie zwrócił materiałów po walidacji', out);
        H.assert(out.projectData && out.projectData.validated === true, 'Bootstrap stanu nie przepuścił projektu przez walidację', out);
        H.assert(out.uiState && out.uiState.validated === true, 'Bootstrap stanu nie przepuścił uiState przez walidację', out);
        H.assert(out.uiDefaults && Object.prototype.hasOwnProperty.call(out.uiDefaults, 'lastAddedCabinetId'), 'Bootstrap stanu nie dodał pól pomocniczych do uiDefaults', out.uiDefaults);
      }),
      H.makeTest('Projekt', 'Bootstrap UI przywraca widok aplikacji i planuje warmup', 'Pilnuje, czy wydzielony init UI dalej spina przywrócenie entrypointu, podstawowy render i background warmup bez pełnego app.js.', ()=>{
        H.assert(FC.appUiBootstrap && typeof FC.appUiBootstrap.initUI === 'function', 'Brak FC.appUiBootstrap.initUI');
        const fixture = document.createElement('div');
        fixture.innerHTML = '<button class="tab-btn" data-tab="wywiad"></button><div id="roomsView"></div><div id="appView"></div><div id="topTabs"></div>';
        document.body.appendChild(fixture);
        let savedState = null;
        let viewsApplied = null;
        let bindingsInstalled = false;
        let autosaveInstalled = false;
        let topRendered = false;
        let cabinetsRendered = false;
        let warmupScheduled = false;
        let scrollRestored = false;
        try{
          const uiState = { activeTab:'wywiad', roomType:'kuchnia', entry:'home' };
          const out = FC.appUiBootstrap.initUI({
            FC: {
              storage: { setJSON(_key, value){ savedState = value; } },
              views: { applyFromState(state){ viewsApplied = Object.assign({}, state); } },
            },
            document: fixture,
            storageKeys: { ui:'ui' },
            uiDefaults: { activeTab:'wywiad' },
            getUiState(){ return uiState; },
            setUiState(next){ savedState = Object.assign({}, next); return next; },
            applyReloadRestoreSnapshot(){ return null; },
            installBindings(){ bindingsInstalled = true; },
            installProjectAutosave(){ autosaveInstalled = true; },
            renderTopHeight(){ topRendered = true; },
            renderCabinets(){ cabinetsRendered = true; },
            restoreReloadScroll(){ scrollRestored = true; },
            scheduleRozrysWarmup(){ warmupScheduled = true; },
          });
          H.assert(bindingsInstalled, 'Bootstrap UI nie zainstalował bindingów');
          H.assert(autosaveInstalled, 'Bootstrap UI nie zainstalował autosave');
          H.assert(topRendered && cabinetsRendered, 'Bootstrap UI nie wykonał bazowego renderu', { topRendered, cabinetsRendered });
          H.assert(warmupScheduled, 'Bootstrap UI nie zaplanował warmupu ROZRYS');
          H.assert(scrollRestored, 'Bootstrap UI nie przywrócił scrolla po reload restore');
          H.assert(out && out.entry === 'app', 'Bootstrap UI nie przestawił entry na app dla wybranego pokoju', out);
          H.assert(viewsApplied && viewsApplied.entry === 'app', 'Bootstrap UI nie przekazał poprawnego stanu do views.applyFromState', viewsApplied);
        } finally {
          fixture.remove();
        }
      }),
      H.makeTest('Projekt', 'Project autosave jest jawnie ładowany jako runtime boundary', 'Pilnuje naprawy po audycie zależności: wydzielony project-autosave.js nie może być martwym plikiem, bo app.js deleguje do FC.projectAutosave.', ()=>{
        const loadedApi = FC.projectAutosave && typeof FC.projectAutosave === 'object';
        const assets = host.__DEV_ASSETS__ || {};
        const indexHtml = String(assets['index.html'] || '');
        const devTestsHtml = String(assets['dev_tests.html'] || '');
        const indexHasScript = indexHtml.indexOf('js/app/investor/project-autosave.js') >= 0;
        const devHasScript = devTestsHtml.indexOf('js/app/investor/project-autosave.js') >= 0;
        H.assert(loadedApi || (indexHasScript && devHasScript), 'Brak project-autosave.js w runtime/developer entrypoints', { loadedApi, indexHasScript, devHasScript });
        if(loadedApi){
          H.assert(typeof FC.projectAutosave.scheduleProjectAutosave === 'function', 'Brak FC.projectAutosave.scheduleProjectAutosave');
          H.assert(typeof FC.projectAutosave.installProjectAutosave === 'function', 'Brak FC.projectAutosave.installProjectAutosave');
        }
      }),

      H.makeTest('Projekt', 'Bootstrap UI fallback nie dokleja widoku pomieszczeń do ekranu startowego', 'Pilnuje regresji po splitach startu: jeśli router widoków nie jest dostępny albo rzuci wyjątek, awaryjny fallback nie może pokazać starego roomsView pod ekranem Start.', ()=>{
        H.assert(FC.appUiBootstrap && typeof FC.appUiBootstrap.initUI === 'function', 'Brak FC.appUiBootstrap.initUI');
        const fixture = document.createElement('div');
        fixture.innerHTML = '<div id="homeView" style="display:block"></div><div id="modeHubView" style="display:none"></div><div id="investorsListView" style="display:none"></div><div id="serviceOrdersListView" style="display:none"></div><div id="roomsView" style="display:none"></div><div id="appView" style="display:none"></div><div id="investorView" style="display:none"></div><div id="rozrysView" style="display:none"></div><div id="magazynView" style="display:none"></div><div id="topBar" style="display:none"></div><div id="topTabs" style="display:none"></div><div id="sessionButtons" style="display:none"></div><div id="floatingAdd" style="display:none"></div>';
        document.body.appendChild(fixture);
        try{
          const out = FC.appUiBootstrap.initUI({
            FC: {
              storage: { setJSON(){} },
              views: { applyFromState(){ throw new Error('boom'); } },
            },
            document: fixture,
            storageKeys: { ui:'ui' },
            uiDefaults: { activeTab:'pokoje', entry:'home' },
            getUiState(){ return { activeTab:'pokoje', entry:'home', roomType:null, currentInvestorId:null }; },
            setUiState(next){ return next; },
            applyReloadRestoreSnapshot(){ return null; },
            installBindings(){},
            installProjectAutosave(){},
            renderTopHeight(){},
            renderCabinets(){},
            restoreReloadScroll(){},
            scheduleRozrysWarmup(){},
          });
          const homeView = fixture.querySelector('#homeView');
          const roomsView = fixture.querySelector('#roomsView');
          const topTabs = fixture.querySelector('#topTabs');
          H.assert(out && out.entry === 'home', 'Fallback bootstrap UI zmienił entry mimo braku pokoju', out);
          H.assert(homeView && homeView.style.display === 'block', 'Fallback bootstrap UI nie zostawił ekranu Start jako jedynego widoku', { home:homeView && homeView.style.display, rooms:roomsView && roomsView.style.display });
          H.assert(roomsView && roomsView.style.display === 'none', 'Fallback bootstrap UI dokleił roomsView pod ekran startowy', { home:homeView && homeView.style.display, rooms:roomsView && roomsView.style.display });
          H.assert(topTabs && topTabs.style.display === 'none', 'Fallback bootstrap UI pokazał top tabs na ekranie Start', { topTabs:topTabs && topTabs.style.display });
        } finally {
          fixture.remove();
        }
      }),

      H.makeTest('Projekt', 'Bootstrap UI odzyskuje Start, gdy startup pokazuje pusty shell view', 'Pilnuje regresji pustego ekranu po restore: jeśli startup schowa homeView i pokaże pusty modeHub/service orders shell bez wyrenderowanej zawartości, bootstrap ma wrócić do Startu zamiast zostawić pustą stronę.', ()=>{
        H.assert(FC.appUiBootstrap && typeof FC.appUiBootstrap.initUI === 'function', 'Brak FC.appUiBootstrap.initUI');
        const fixture = document.createElement('div');
        fixture.innerHTML = '<div id="homeView" style="display:block">HOME</div><div id="modeHubView" style="display:none"><div id="modeHubRoot"></div></div><div id="investorsListView" style="display:none"><div id="investorsListRoot"></div></div><div id="serviceOrdersListView" style="display:none"><div id="serviceOrdersListRoot"></div></div><div id="roomsView" style="display:none"></div><div id="appView" style="display:none"></div><div id="investorView" style="display:none"></div><div id="rozrysView" style="display:none"></div><div id="magazynView" style="display:none"></div><div id="topBar" style="display:none"></div><div id="topTabs" style="display:none"></div><div id="sessionButtons" style="display:none"></div><div id="floatingAdd" style="display:none"></div>';
        document.body.appendChild(fixture);
        let savedState = null;
        try{
          const out = FC.appUiBootstrap.initUI({
            FC: {
              storage: { setJSON(_key, value){ savedState = Object.assign({}, value); } },
              views: {
                applyFromState(){
                  fixture.querySelector('#homeView').style.display = 'none';
                  fixture.querySelector('#modeHubView').style.display = 'block';
                },
              },
              workModeHub: {
                renderModeHub(){ /* zostaw pusty shell, ma zadziałać recovery */ },
              },
            },
            document: fixture,
            storageKeys: { ui:'ui' },
            uiDefaults: { activeTab:'pokoje', entry:'home' },
            getUiState(){ return { activeTab:null, entry:'modeHub', workMode:'furnitureProjects', roomType:null, currentInvestorId:null }; },
            setUiState(next){ savedState = Object.assign({}, next); return next; },
            applyReloadRestoreSnapshot(){ return null; },
            installBindings(){},
            installProjectAutosave(){},
            renderTopHeight(){},
            renderCabinets(){},
            restoreReloadScroll(){},
            scheduleRozrysWarmup(){},
          });
          const homeView = fixture.querySelector('#homeView');
          const modeHubView = fixture.querySelector('#modeHubView');
          H.assert(out && out.entry === 'home', 'Bootstrap UI nie odzyskał entry=home po pustym shell view', out);
          H.assert(homeView && homeView.style.display === 'block', 'Bootstrap UI nie wrócił do Startu po pustym shell view', { home:homeView && homeView.style.display, modeHub:modeHubView && modeHubView.style.display, state:savedState });
          H.assert(modeHubView && modeHubView.style.display === 'none', 'Bootstrap UI zostawił pusty modeHubView zamiast wrócić do Startu', { home:homeView && homeView.style.display, modeHub:modeHubView && modeHubView.style.display, state:savedState });
          H.assert(savedState && savedState.entry === 'home', 'Bootstrap UI nie zapisał odzyskanego entry=home po pustym shell view', savedState);
        } finally {
          fixture.remove();
        }
      }),

      H.makeTest('Projekt', 'Store inwestorów tworzy, wyszukuje i aktualizuje wpis bez gubienia bieżącego ID', 'Sprawdza, czy lokalna baza inwestorów działa stabilnie przy tworzeniu i edycji.', ()=>{
        withInvestorStorage((inv)=>{
          const created = (FC.testDataManager && typeof FC.testDataManager.createInvestor === 'function'
            ? FC.testDataManager.createInvestor({ name:'Jan Test', email:'jan@test.pl', city:'Łódź' })
            : inv.create({ name:'Jan Test', email:'jan@test.pl', city:'Łódź' }));
          H.assert(created && created.id, 'Nie utworzono inwestora', created);
          H.assert(inv.getCurrentId() === created.id, 'Nie ustawiono current investor', { current:inv.getCurrentId(), created });
          const found = inv.search('jan@test.pl');
          H.assert(Array.isArray(found) && found.length === 1, 'Wyszukiwanie inwestora nie zwróciło wpisu', found);
          const updated = inv.update(created.id, { city:'Pabianice' });
          H.assert(updated && updated.city === 'Pabianice', 'Update inwestora nie zapisał zmian', updated);
          H.assert(inv.getById(created.id).city === 'Pabianice', 'getById nie widzi zmian inwestora', inv.getById(created.id));
        });
      }),


      H.makeTest('Projekt', 'Project store trzyma osobny rekord projektu powiązany z inwestorem', 'Sprawdza, czy dane projektu meblowego są już utrzymywane jako osobny byt powiązany z inwestorem, gotowy pod dalszą migrację do chmury.', ()=>{
        H.assert(FC.projectStore && typeof FC.projectStore.ensureForInvestor === 'function', 'Brak FC.projectStore.ensureForInvestor');
        const prevProjects = FC.projectStore.readAll ? FC.projectStore.readAll() : [];
        const prevCurrentProjectId = FC.projectStore.getCurrentProjectId ? FC.projectStore.getCurrentProjectId() : '';
        try{
          if(FC.projectStore.writeAll) FC.projectStore.writeAll([]);
          withInvestorStorage((inv)=>{
            const created = (FC.testDataManager && typeof FC.testDataManager.createInvestor === 'function'
              ? FC.testDataManager.createInvestor({ name:'Projektowy test' })
              : inv.create({ name:'Projektowy test' }));
            const record = FC.projectStore.ensureForInvestor(created.id, { projectData:{ kuchnia:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} } } });
            H.assert(record && record.id && String(record.investorId || '') === String(created.id || ''), 'Project store nie utworzył rekordu powiązanego z inwestorem', record);
            const saved = FC.projectStore.saveProjectDataForInvestor(created.id, { kuchnia:{ cabinets:[{ id:'cab_b' }, { id:'cab_c' }], fronts:[], sets:[], settings:{} } });
            H.assert(saved && Number(saved.cabinetCount) === 2, 'Project store nie przeliczył liczby szafek po zapisie projektu', saved);
            const loaded = FC.projectStore.loadProjectDataForInvestor(created.id);
            H.assert(Array.isArray(loaded.kuchnia && loaded.kuchnia.cabinets) && loaded.kuchnia.cabinets.length === 2, 'Project store nie zwrócił zapisanych danych projektu', loaded);
          });
        } finally {
          if(FC.projectStore.writeAll) FC.projectStore.writeAll(prevProjects);
          if(FC.projectStore.setCurrentProjectId) FC.projectStore.setCurrentProjectId(prevCurrentProjectId);
        }
      }),
      H.makeTest('Projekt', 'Store zleceń usługowych działa poza katalogami i inwestorami', 'Sprawdza, czy serviceOrders mają własny store danych zamiast być tylko dodatkiem do katalogów albo inwestorów.', ()=>{
        H.assert(FC.serviceOrderStore && typeof FC.serviceOrderStore.upsert === 'function', 'Brak FC.serviceOrderStore.upsert');
        const prevOrders = FC.serviceOrderStore.readAll();
        const inv = FC.investors;
        const investorKey = (inv && inv.KEY_INVESTORS) || 'fc_investors_v1';
        const prevInvestorsRaw = localStorage.getItem(investorKey);
        try{
          if(inv && inv.writeAll) inv.writeAll([{ id:'inv_only', kind:'person', name:'Jan Investor', rooms:[] }]);
          const baselineInvestorsRaw = localStorage.getItem(investorKey);
          FC.serviceOrderStore.writeAll([]);
          const saved = (FC.testDataManager && typeof FC.testDataManager.createServiceOrder === 'function'
            ? FC.testDataManager.createServiceOrder({ title:'Naprawa frontu', clientName:'Adam Klient', phone:'500600700', address:'Łódź' })
            : FC.serviceOrderStore.upsert({ title:'Naprawa frontu', clientName:'Adam Klient', phone:'500600700', address:'Łódź' }));
          H.assert(saved && saved.id && String(saved.clientName || '') === 'Adam Klient', 'Store zleceń usługowych nie zapisał podstawowych danych klienta', saved);
          const orders = FC.serviceOrderStore.readAll();
          H.assert(Array.isArray(orders) && orders.length === 1, 'Store zleceń usługowych nie zwrócił zapisanego zlecenia', orders);
          H.assert(localStorage.getItem(investorKey) === baselineInvestorsRaw, 'Zapis zlecenia usługowego naruszył zapisany storage inwestorów', { before: baselineInvestorsRaw, after: localStorage.getItem(investorKey), recoveredView: inv && inv.readAll ? inv.readAll() : [], orders });
        } finally {
          FC.serviceOrderStore.writeAll(prevOrders);
          if(prevInvestorsRaw == null) localStorage.removeItem(investorKey); else localStorage.setItem(investorKey, prevInvestorsRaw);
        }
      }),
      H.makeTest('Projekt', 'Katalogi rozdzielają legacy materiały, akcesoria i stawki meblowe', 'Sprawdza, czy architektura danych nie trzyma już akcesoriów jako typu materiału i czy stare usługi trafiają do stawek wyceny mebli.', ()=>{
        H.assert(FC.catalogStore && typeof FC.catalogStore.migrateLegacy === 'function', 'Brak FC.catalogStore.migrateLegacy');
        const keys = (FC.constants && FC.constants.STORAGE_KEYS) || {};
        const prevMaterials = localStorage.getItem(keys.materials);
        const prevServices = localStorage.getItem(keys.services);
        const prevSheet = localStorage.getItem(keys.sheetMaterials);
        const prevAccessories = localStorage.getItem(keys.accessories);
        const prevQuoteRates = localStorage.getItem(keys.quoteRates);
        try{
          localStorage.setItem(keys.materials, JSON.stringify([
            { id:'m_lam', materialType:'laminat', manufacturer:'Egger', symbol:'W1', name:'Laminat test', price:10, hasGrain:false },
            { id:'m_acc', materialType:'akcesoria', manufacturer:'blum', symbol:'B1', name:'Zawias test', price:5, hasGrain:false },
          ]));
          localStorage.setItem(keys.services, JSON.stringify([{ id:'s_rate', category:'Montaż', name:'Stawka montażowa', price:100 }]));
          const migrated = FC.catalogStore.migrateLegacy();
          H.assert(Array.isArray(migrated.sheetMaterials) && migrated.sheetMaterials.length === 1, 'Migracja nie wydzieliła materiałów arkuszowych', migrated);
          H.assert(Array.isArray(migrated.accessories) && migrated.accessories.length === 1, 'Migracja nie wydzieliła akcesoriów', migrated);
          H.assert(Array.isArray(migrated.quoteRates) && migrated.quoteRates[0] && migrated.quoteRates[0].name === 'Stawka montażowa', 'Migracja nie przeniosła usług do stawek wyceny mebli', migrated);
          H.assert(String(migrated.sheetMaterials[0].materialType || '') !== 'akcesoria', 'Akcesorium nadal siedzi w materiałach arkuszowych', migrated.sheetMaterials);
        } finally {
          const restore = (key, value)=> value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value);
          restore(keys.materials, prevMaterials);
          restore(keys.services, prevServices);
          restore(keys.sheetMaterials, prevSheet);
          restore(keys.accessories, prevAccessories);
          restore(keys.quoteRates, prevQuoteRates);
          try{ FC.catalogStore.migrateLegacy(); }catch(_){ }
        }
      }),
      H.makeTest('Projekt', 'Domena katalogów rozdziela materiały arkuszowe od akcesoriów', 'Sprawdza, czy helper domenowy potrafi wydzielić akcesoria ze starych materiałów zanim dane trafią do store pod dalszą migrację do chmury.', ()=>{
        H.assert(FC.catalogDomain && typeof FC.catalogDomain.splitLegacyMaterials === 'function', 'Brak FC.catalogDomain.splitLegacyMaterials');
        const split = FC.catalogDomain.splitLegacyMaterials([
          { id:'m_lam', materialType:'laminat', name:'Płyta test' },
          { id:'m_acc', materialType:'akcesoria', name:'Zawias test' },
        ]);
        H.assert(Array.isArray(split.sheetMaterials) && split.sheetMaterials.length === 1, 'Domena katalogów nie wydzieliła materiałów arkuszowych', split);
        H.assert(Array.isArray(split.accessories) && split.accessories.length === 1, 'Domena katalogów nie wydzieliła akcesoriów', split);
      }),
      H.makeTest('Projekt', 'Wywiad renderuje lekkie podsumowanie parametrów pokoju', 'Sprawdza, czy góra Wywiadu nie oczekuje już stałej siatki inputów i potrafi odświeżyć kompaktowe summary parametrów pokoju.', ()=>{
        H.assert(FC.wywiadRoomSettings && typeof FC.wywiadRoomSettings.renderSummary === 'function', 'Brak FC.wywiadRoomSettings.renderSummary');
        const prevProjectData = Object.prototype.hasOwnProperty.call(host, 'projectData') ? host.projectData : undefined;
        const prevUiState = Object.prototype.hasOwnProperty.call(host, 'uiState') ? host.uiState : undefined;
        const fixture = document.createElement('div');
        fixture.innerHTML = '<div id="roomSettingsSummary"></div>';
        document.body.appendChild(fixture);
        try{
          host.projectData = { kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{ roomHeight:260, bottomHeight:86, legHeight:10, counterThickness:3.8, gapHeight:58, ceilingBlende:12 } } };
          host.uiState = { roomType:'kuchnia' };
          FC.wywiadRoomSettings.renderSummary('kuchnia');
          const stats = fixture.querySelectorAll('.wywiad-room-shell__stat');
          const line = fixture.querySelector('.wywiad-room-shell__stats-line');
          H.assert(!!line, 'Summary parametrów pokoju nie wyrenderowało kompaktowej linii', fixture.innerHTML);
          H.assert(/260\s*cm/.test(fixture.textContent || ''), 'Summary nie pokazuje wysokości pomieszczenia', fixture.textContent);
          H.assert(/3,8\s*cm|3.8\s*cm/.test(fixture.textContent || ''), 'Summary nie pokazuje grubości blatu', fixture.textContent);
        } finally {
          fixture.remove();
          if(prevProjectData === undefined) { try{ delete host.projectData; }catch(_){ host.projectData = undefined; } }
          else host.projectData = prevProjectData;
          if(prevUiState === undefined) { try{ delete host.uiState; }catch(_){ host.uiState = undefined; } }
          else host.uiState = prevUiState;
        }
      }),
      H.makeTest('Projekt', 'Tryby pracy mają rozłączne, kontekstowe wejścia', 'Sprawdza, czy ekran startowy prowadzi do dwóch osobnych trybów z różnymi akcjami zamiast jednego wspólnego centrum cenników.', ()=>{
        H.assert(FC.workModeHub && typeof FC.workModeHub.getModeConfig === 'function', 'Brak FC.workModeHub.getModeConfig');
        const furniture = FC.workModeHub.getModeConfig('furnitureProjects');
        const workshop = FC.workModeHub.getModeConfig('workshopServices');
        H.assert(Array.isArray(furniture.actions) && furniture.actions.some((item)=> item.action === 'open-sheet-materials') && furniture.actions.some((item)=> item.action === 'open-investors-list'), 'Tryb projektów meblowych nie ma oczekiwanych wejść', furniture);
        H.assert(Array.isArray(workshop.actions) && workshop.actions.some((item)=> item.action === 'open-workshop-services') && workshop.actions.some((item)=> item.action === 'open-service-orders-list'), 'Tryb usług stolarskich nie ma oczekiwanych wejść', workshop);
        H.assert(!furniture.actions.some((item)=> item.action === 'open-service-orders-list'), 'Tryb projektów meblowych miesza się ze zleceniami usługowymi', furniture);
      }),
      H.makeTest('Projekt', 'Cleanup danych testowych usuwa tylko oznaczone rekordy', 'Sprawdza, czy po testach da się bezpiecznie usunąć wyłącznie testowych inwestorów, projekty i zlecenia usługowe bez naruszania prawdziwych danych.', ()=>{
        H.assert(FC.testDataManager && typeof FC.testDataManager.cleanup === 'function', 'Brak FC.testDataManager.cleanup');
        const prevInvestors = FC.investors.readAll();
        const prevProjects = FC.projectStore.readAll();
        const prevOrders = FC.serviceOrderStore.readAll();
        try{
          FC.investors.writeAll([{ id:'inv_real', kind:'person', name:'Prawdziwy', rooms:[], meta:{} }]);
          FC.projectStore.writeAll([{ id:'proj_real', investorId:'inv_real', title:'Projekt realny', projectData:{ kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{} } }, meta:{} }]);
          FC.serviceOrderStore.writeAll([{ id:'so_real', title:'Prawdziwe zlecenie', clientName:'Realny klient', meta:{} }]);
          const testInvestor = FC.testDataManager.createInvestor({ name:'Test cleanup' });
          FC.projectStore.saveProjectDataForInvestor(testInvestor.id, { kuchnia:{ cabinets:[{ id:'cab_cleanup' }], fronts:[], sets:[], settings:{} } }, { meta: FC.testDataManager.buildMeta('project') });
          FC.testDataManager.createServiceOrder({ title:'Testowe zlecenie cleanup' });
          const result = FC.testDataManager.cleanup();
          const investors = FC.investors.readAll();
          const projects = FC.projectStore.readAll();
          const orders = FC.serviceOrderStore.readAll();
          H.assert(result && result.investors >= 1, 'Cleanup nie zgłosił usunięcia testowego inwestora', result);
          H.assert(investors.length === 1 && investors[0].id === 'inv_real', 'Cleanup naruszył prawdziwych inwestorów albo nie usunął testowych', investors);
          H.assert(projects.length === 1 && projects[0].id === 'proj_real', 'Cleanup nie usunął projektów testowych albo naruszył realne', projects);
          H.assert(orders.length === 1 && orders[0].id === 'so_real', 'Cleanup nie usunął testowych zleceń albo naruszył realne', orders);
        } finally {
          FC.investors.writeAll(prevInvestors);
          FC.projectStore.writeAll(prevProjects);
          FC.serviceOrderStore.writeAll(prevOrders);
        }
      }),
      H.makeTest('Projekt', 'WYCENA ukrywa kartę parametrów pomieszczenia', 'Sprawdza, czy karta z parametrami pomieszczenia nie pokazuje się już w zakładce WYCENA, ale nadal może działać w innych zakładkach.', ()=>{
        H.assert(FC.appView && typeof FC.appView.shouldHideRoomSettingsForTab === 'function', 'Brak helpera widoczności karty parametrów pokoju', FC.appView);
        H.assert(FC.appView.shouldHideRoomSettingsForTab('wycena') === true, 'Karta parametrów pokoju nie jest ukrywana dla WYCENA');
        H.assert(FC.appView.shouldHideRoomSettingsForTab('wywiad') === false, 'Karta parametrów pokoju została ukryta także dla WYWIAD');
      }),
      H.makeTest('Projekt', 'Wejście zakładką WYCENA bez wybranego pomieszczenia omija ekran wyboru pokoju', 'Sprawdza, czy kliknięcie zakładki WYCENA przy aktywnym inwestorze może otworzyć appView bez wymuszania ekranu „Wybierz pomieszczenie”.', ()=>{
        if(!(FC.views && typeof FC.views.shouldOpenRoomlessWycena === 'function')){
          H.assert(typeof document === 'undefined', 'Brak helpera roomless WYCENA', FC.views);
          return;
        }
        H.assert(FC.views.shouldOpenRoomlessWycena({ entry:'rooms', activeTab:'wycena', roomType:null, currentInvestorId:'inv_test' }) === true, 'Helper roomless WYCENA nie rozpoznaje wejścia z inwestora');
        if(typeof document === 'undefined' || !(typeof FC.views.applyFromState === 'function')) return;
        const roomsView = document.getElementById('roomsView');
        const appView = document.getElementById('appView');
        H.assert(roomsView && appView, 'Brak wymaganych widoków DOM dla testu wejścia do WYCENA', { roomsView, appView });
        const prevRooms = roomsView ? roomsView.style.display : '';
        const prevApp = appView ? appView.style.display : '';
        try{
          FC.views.applyFromState({ entry:'rooms', activeTab:'wycena', roomType:null, currentInvestorId:'inv_test' });
          H.assert(appView.style.display === 'block', 'appView nie otworzył się dla roomless WYCENA', { app:appView.style.display, rooms:roomsView.style.display });
          H.assert(roomsView.style.display === 'none', 'roomsView nadal został pokazany zamiast WYCENA', { app:appView.style.display, rooms:roomsView.style.display });
        } finally {
          if(roomsView) roomsView.style.display = prevRooms;
          if(appView) appView.style.display = prevApp;
        }
      }),
      H.makeTest('Projekt', 'Strona główna po odświeżeniu nie wskakuje z powrotem do WYCENA', 'Pilnuje, czy zapisany kontekst inwestora nie nadpisuje wejścia home po odświeżeniu i nie otwiera roomless WYCENA.', ()=>{
        H.assert(FC.views && typeof FC.views.shouldOpenRoomlessWycena === 'function', 'Brak helpera roomless WYCENA', FC.views);
        H.assert(FC.views.shouldOpenRoomlessWycena({ entry:'home', activeTab:'wycena', roomType:null, currentInvestorId:'inv_test' }) === false, 'Helper roomless WYCENA błędnie otwiera wycenę z ekranu głównego');
        if(typeof document === 'undefined' || !(typeof FC.views.applyFromState === 'function')) return;
        const homeView = document.getElementById('homeView');
        const appView = document.getElementById('appView');
        H.assert(homeView && appView, 'Brak wymaganych widoków DOM dla testu strony głównej', { homeView, appView });
        const prevHome = homeView ? homeView.style.display : '';
        const prevApp = appView ? appView.style.display : '';
        try{
          FC.views.applyFromState({ entry:'home', activeTab:'wycena', roomType:null, currentInvestorId:'inv_test' });
          H.assert(homeView.style.display === 'block', 'homeView nie pozostał otwarty po odświeżeniu strony głównej', { home:homeView.style.display, app:appView.style.display });
          H.assert(appView.style.display === 'none', 'appView otworzył się mimo wejścia na stronę główną', { home:homeView.style.display, app:appView.style.display });
        } finally {
          if(homeView) homeView.style.display = prevHome;
          if(appView) appView.style.display = prevApp;
        }
      }),

      H.makeTest('Projekt', 'Fallback bootstrapu nie pokazuje wyboru pomieszczeń dla roomless WYCENA', 'Pilnuje, czy awaryjne przywracanie widoków po reloadzie rozpoznaje wejście do WYCENA bez wybranego pokoju i nie zostawia ekranu pomieszczeń pod aktywną zakładką.', ()=>{
        const bootstrap = FC.appUiBootstrap;
        H.assert(bootstrap && typeof bootstrap.initUI === 'function', 'Brak bootstrapu UI do testu fallbacku roomless WYCENA', bootstrap);
        if(typeof document === 'undefined') return;
        const roomsView = document.getElementById('roomsView');
        const appView = document.getElementById('appView');
        H.assert(roomsView && appView, 'Brak wymaganych widoków DOM dla testu fallbacku roomless WYCENA', { roomsView, appView });
        const prevRooms = roomsView.style.display;
        const prevApp = appView.style.display;
        const prevViews = FC.views;
        const prevWarmup = FC.rozrysLazy;
        try{
          FC.views = Object.assign({}, prevViews || {});
          delete FC.views.applyFromState;
          FC.views.shouldOpenRoomlessWycena = prevViews && prevViews.shouldOpenRoomlessWycena;
          FC.rozrysLazy = { scheduleWarmup(){} };
          bootstrap.initUI({
            FC,
            document,
            storageKeys: { ui:'fc_ui_v1' },
            uiDefaults: { activeTab:'pokoje', entry:'home' },
            getUiState(){ return { activeTab:'wycena', entry:'rooms', roomType:null, currentInvestorId:'inv_test' }; },
            setUiState(){},
            applyReloadRestoreSnapshot(){ return null; },
            installBindings(){},
            installProjectAutosave(){},
            renderTopHeight(){},
            renderCabinets(){},
            restoreReloadScroll(){},
            scheduleRozrysWarmup(){},
          });
          H.assert(appView.style.display === 'block', 'Fallback bootstrapu nie otworzył appView dla roomless WYCENA', { app:appView.style.display, rooms:roomsView.style.display });
          H.assert(roomsView.style.display === 'none', 'Fallback bootstrapu zostawił roomsView dla roomless WYCENA', { app:appView.style.display, rooms:roomsView.style.display });
        } finally {
          FC.views = prevViews;
          FC.rozrysLazy = prevWarmup;
          roomsView.style.display = prevRooms;
          appView.style.display = prevApp;
        }
      }),

      H.makeTest('Projekt', 'Wyjście do Start czyści kontekst projektu do reload restore', 'Pilnuje, czy wejście na Start nie zostawia aktywnego inwestora ani zakładki WYCENA w stanie, który po odświeżeniu mógłby z powrotem otworzyć projekt.', ()=>{
        H.assert(FC.views && typeof FC.views.openHome === 'function', 'Brak FC.views.openHome do testu czyszczenia Startu', FC.views);
        const prevGet = FC.uiState && FC.uiState.get;
        const prevSet = FC.uiState && FC.uiState.set;
        const prevReloadRestore = FC.reloadRestore;
        const prevInvestorPersistence = FC.investorPersistence;
        const prevUiState = (typeof uiState !== 'undefined') ? uiState : undefined;
        let saved = null;
        let cleared = 0;
        try{
          if(!FC.uiState) FC.uiState = {};
          FC.uiState.get = () => ({ entry:'app', activeTab:'wycena', roomType:null, currentInvestorId:'inv_test', workMode:'furnitureProjects' });
          FC.uiState.set = (patch) => {
            saved = Object.assign({}, FC.uiState.get(), patch || {});
            return saved;
          };
          FC.reloadRestore = { clear(){ cleared += 1; } };
          FC.investorPersistence = { setCurrentInvestorId(){} };
          if(typeof uiState !== 'undefined') uiState = { entry:'app', activeTab:'wycena', roomType:null, currentInvestorId:'inv_test', workMode:'furnitureProjects' };
          FC.views.openHome();
          H.assert(saved && saved.entry === 'home', 'openHome nie przełączył entry na home', saved);
          H.assert(saved && saved.currentInvestorId == null, 'openHome nie wyczyścił currentInvestorId', saved);
          H.assert(saved && saved.roomType == null, 'openHome nie wyczyścił roomType', saved);
          H.assert(saved && saved.activeTab === 'pokoje', 'openHome nie zresetował aktywnej zakładki do bezpiecznego pokoje', saved);
          H.assert(cleared === 1, 'openHome nie wyczyścił reload restore przy wyjściu do Start', { cleared, saved });
        } finally {
          if(FC.uiState){
            FC.uiState.get = prevGet;
            FC.uiState.set = prevSet;
          }
          FC.reloadRestore = prevReloadRestore;
          FC.investorPersistence = prevInvestorPersistence;
          try{ if(typeof uiState !== 'undefined') uiState = prevUiState; }catch(_){ }
        }
      }),
      H.makeTest('Projekt', 'Reload restore jest osobnym modułem sesji i czyści snapshot po użyciu', 'Pilnuje, czy reload/restore nie wraca do app.js i działa przez FC.reloadRestore oraz session helper.', ()=>{
        H.assert(FC.reloadRestore && typeof FC.reloadRestore.applySnapshot === 'function', 'Brak FC.reloadRestore.applySnapshot', FC.reloadRestore);
        H.assert(typeof FC.reloadRestore.restoreScroll === 'function', 'Brak FC.reloadRestore.restoreScroll', FC.reloadRestore);
        H.assert(FC.storage && FC.storage.session && typeof FC.storage.session.setJSON === 'function', 'Brak FC.storage.session.setJSON', FC.storage);
        const key = FC.reloadRestore.key || 'fc_reload_restore_v1';
        const prevRaw = sessionStorage.getItem(key);
        const prevUiState = FC.uiState;
        try{
          FC.uiState = { get(){ return { entry:'app', activeTab:'wywiad', roomType:'kuchnia' }; } };
          if(typeof window !== 'undefined') window.scrollY = 123;
          FC.reloadRestore.persist();
          const persisted = JSON.parse(sessionStorage.getItem(key) || 'null');
          H.assert(persisted && persisted.uiState && persisted.uiState.activeTab === 'wywiad', 'Reload restore nie zapisał snapshotu UI', persisted);
          const applied = FC.reloadRestore.applySnapshot();
          H.assert(applied && applied.uiState && applied.uiState.roomType === 'kuchnia', 'Reload restore nie zwrócił snapshotu po apply', applied);
          H.assert(sessionStorage.getItem(key) == null, 'Reload restore nie wyczyścił snapshotu po apply', sessionStorage.getItem(key));
          FC.reloadRestore.restoreScroll();
        } finally {
          FC.uiState = prevUiState;
          if(prevRaw == null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, prevRaw);
        }
      }),

      H.makeTest('Projekt', 'Kolejność przycisków zakładek zgadza się z nowym układem', 'Pilnuje, czy paski zakładek mają zamienione MATERIAŁ z RYSUNEK oraz dolny rząd zaczyna się od INWESTOR.', ()=>{
        if(typeof document === 'undefined') return;
        const order = Array.from(document.querySelectorAll('#topTabs .tab-btn')).map((btn)=> String(btn && btn.dataset && btn.dataset.tab || ''));
        H.assert(order.length >= 8, 'Brak pełnego zestawu zakładek do testu kolejności', order);
        H.assert(order.slice(0, 4).join(',') === 'wywiad,material,rysunek,czynnosci', 'Górny rząd zakładek ma złą kolejność', order);
        H.assert(order.slice(4, 8).join(',') === 'inwestor,wycena,rozrys,magazyn', 'Dolny rząd zakładek ma złą kolejność', order);
      }),
      H.makeTest('Projekt', 'Zablokowane opcje statusu niosą stan disabled do overlayu', 'Sprawdza, czy overlay wyboru statusu dostaje klasę disabled także dla aktualnie zaznaczonej opcji, żeby UI mogło ją wyszarzyć zamiast pokazywać na zielono.', ()=>{
        H.assert(FC.rozrysChoice && typeof FC.rozrysChoice.buildChoiceOptionClass === 'function', 'Brak helpera klas opcji overlayu', FC.rozrysChoice);
        const cls = FC.rozrysChoice.buildChoiceOptionClass('zaakceptowany', 'zaakceptowany', true);
        H.assert(/is-selected/.test(String(cls || '')), 'Zablokowana bieżąca opcja utraciła klasę selected potrzebną do identyfikacji stanu', { cls });
        H.assert(/is-disabled/.test(String(cls || '')), 'Zablokowana opcja nie niesie klasy disabled do overlayu', { cls });
      }),

      H.makeTest('Projekt', 'Lista zleceń usługowych działa niezależnie od inwestorów', 'Sprawdza, czy drobne zlecenia usługowe mają własny byt danych i nie używają listy inwestorów.', ()=>{
        H.assert(FC.catalogStore && typeof FC.catalogStore.upsertServiceOrder === 'function', 'Brak FC.catalogStore.upsertServiceOrder');
        const beforeOrders = FC.catalogStore.getServiceOrders();
        const inv = FC.investors;
        const investorKey = (inv && inv.KEY_INVESTORS) || 'fc_investors_v1';
        const prevInvestorsRaw = localStorage.getItem(investorKey);
        try{
          if(inv && inv.writeAll) inv.writeAll([{ id:'inv_only', kind:'person', name:'Jan Investor', rooms:[] }]);
          const baselineInvestorsRaw = localStorage.getItem(investorKey);
          FC.catalogStore.saveServiceOrders([]);
          FC.catalogStore.upsertServiceOrder({ title:'Naprawa blatu', customerName:'Adam Klient', phone:'500600700' });
          const orders = FC.catalogStore.getServiceOrders();
          H.assert(Array.isArray(orders) && orders.length === 1, 'Nie zapisano zlecenia usługowego', orders);
          H.assert(localStorage.getItem(investorKey) === baselineInvestorsRaw, 'Zlecenie usługowe naruszyło zapisany storage inwestorów', { before: baselineInvestorsRaw, after: localStorage.getItem(investorKey), recoveredView: inv && inv.readAll ? inv.readAll() : [], orders });
        } finally {
          FC.catalogStore.saveServiceOrders(beforeOrders);
          if(prevInvestorsRaw == null) localStorage.removeItem(investorKey); else localStorage.setItem(investorKey, prevInvestorsRaw);
        }
      }),
    ]);
  }

  FC.projectDevTests = { runAll };
})(typeof window !== 'undefined' ? window : globalThis);
