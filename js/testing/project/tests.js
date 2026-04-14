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
        const prevAll = inv && inv.readAll ? inv.readAll() : [];
        try{
          if(inv && inv.writeAll) inv.writeAll([{ id:'inv_only', kind:'person', name:'Jan Investor', rooms:[] }]);
          FC.serviceOrderStore.writeAll([]);
          const saved = (FC.testDataManager && typeof FC.testDataManager.createServiceOrder === 'function'
            ? FC.testDataManager.createServiceOrder({ title:'Naprawa frontu', clientName:'Adam Klient', phone:'500600700', address:'Łódź' })
            : FC.serviceOrderStore.upsert({ title:'Naprawa frontu', clientName:'Adam Klient', phone:'500600700', address:'Łódź' }));
          H.assert(saved && saved.id && String(saved.clientName || '') === 'Adam Klient', 'Store zleceń usługowych nie zapisał podstawowych danych klienta', saved);
          const orders = FC.serviceOrderStore.readAll();
          H.assert(Array.isArray(orders) && orders.length === 1, 'Store zleceń usługowych nie zwrócił zapisanego zlecenia', orders);
          H.assert(inv && inv.readAll && inv.readAll().length === 1 && inv.readAll()[0].id === 'inv_only', 'Zapis zlecenia usługowego naruszył listę inwestorów', { investors: inv.readAll(), orders });
        } finally {
          FC.serviceOrderStore.writeAll(prevOrders);
          if(inv && inv.writeAll) inv.writeAll(prevAll);
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
        const prevAll = inv && inv.readAll ? inv.readAll() : [];
        try{
          if(inv && inv.writeAll) inv.writeAll([{ id:'inv_only', kind:'person', name:'Jan Investor', rooms:[] }]);
          FC.catalogStore.saveServiceOrders([]);
          FC.catalogStore.upsertServiceOrder({ title:'Naprawa blatu', customerName:'Adam Klient', phone:'500600700' });
          const orders = FC.catalogStore.getServiceOrders();
          H.assert(Array.isArray(orders) && orders.length === 1, 'Nie zapisano zlecenia usługowego', orders);
          H.assert(inv && inv.readAll && inv.readAll().length === 1 && inv.readAll()[0].id === 'inv_only', 'Zlecenie usługowe naruszyło listę inwestorów', { investors: inv.readAll(), orders });
        } finally {
          FC.catalogStore.saveServiceOrders(beforeOrders);
          if(inv && inv.writeAll) inv.writeAll(prevAll);
        }
      }),
    ]);
  }

  FC.projectDevTests = { runAll };
})(typeof window !== 'undefined' ? window : globalThis);
