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
          const created = inv.create({ name:'Jan Test', email:'jan@test.pl', city:'Łódź' });
          H.assert(created && created.id, 'Nie utworzono inwestora', created);
          H.assert(inv.getCurrentId() === created.id, 'Nie ustawiono current investor', { current:inv.getCurrentId(), created });
          const found = inv.search('jan@test.pl');
          H.assert(Array.isArray(found) && found.length === 1, 'Wyszukiwanie inwestora nie zwróciło wpisu', found);
          const updated = inv.update(created.id, { city:'Pabianice' });
          H.assert(updated && updated.city === 'Pabianice', 'Update inwestora nie zapisał zmian', updated);
          H.assert(inv.getById(created.id).city === 'Pabianice', 'getById nie widzi zmian inwestora', inv.getById(created.id));
        });
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
