(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  const H = FC.testHarness;
  if(!H) throw new Error('Brak FC.testHarness');

  function withOrdersStorage(run){
    if(!(FC.serviceOrderStore && typeof FC.serviceOrderStore.readAll === 'function' && typeof FC.serviceOrderStore.writeAll === 'function')){
      throw new Error('Brak FC.serviceOrderStore');
    }
    const prevOrders = FC.serviceOrderStore.readAll();
    try{
      FC.serviceOrderStore.writeAll([]);
      return run();
    } finally {
      FC.serviceOrderStore.writeAll(prevOrders);
    }
  }

  function runAll(){
    return H.runSuite('USŁUGI smoke testy', [
      H.makeTest('Usługi', 'Store zleceń usługowych normalizuje pozycje, status i metadane', 'Pilnuje, czy zapis zlecenia usługowego zawsze dostaje bezpieczne pola, policzoną sumę pozycji i oznaczenia testowe bez prowizorek w UI.', ()=>{
        H.assert(FC.serviceOrderStore && typeof FC.serviceOrderStore.normalizeOrder === 'function', 'Brak FC.serviceOrderStore.normalizeOrder');
        const row = FC.serviceOrderStore.normalizeOrder({
          title:' Naprawa frontu ',
          clientName:' Adam ',
          status:'W_TRAKCIE',
          items:[{ name:'Regulacja', qty:'2', unitPrice:'35' }],
          meta:{ testData:true, testOwner:'dev-tests', source:'service-test' }
        });
        H.assert(String(row.title || '') === 'Naprawa frontu', 'Normalize nie przyciął tytułu zlecenia', row);
        H.assert(String(row.clientName || '') === 'Adam', 'Normalize nie przyciął nazwy klienta', row);
        H.assert(String(row.status || '') === 'w_trakcie', 'Normalize nie znormalizował statusu', row);
        H.assert(Array.isArray(row.items) && row.items.length === 1, 'Normalize nie zachował pozycji zlecenia', row);
        H.assert(Number(row.items[0].total) === 70, 'Normalize nie policzył sumy pozycji', row.items[0]);
        H.assert(Number(row.total) === 70, 'Normalize nie policzył łącznej sumy zlecenia', row);
        H.assert(row.meta && row.meta.testData === true && String(row.meta.testOwner || '') === 'dev-tests', 'Normalize nie zachował metadanych testowych', row.meta);
      }),
      H.makeTest('Usługi', 'Upsert zlecenia aktualizuje istniejący wpis bez duplikowania listy', 'Pilnuje, czy kolejne zapisy tego samego zlecenia nie tworzą duplikatów, tylko aktualizują jeden rekord.', ()=>{
        withOrdersStorage(()=>{
          H.assert(FC.serviceOrderStore && typeof FC.serviceOrderStore.upsert === 'function', 'Brak FC.serviceOrderStore.upsert');
          const first = FC.serviceOrderStore.upsert({ id:'so_test', title:'Montaż listwy', clientName:'Jan' });
          const second = FC.serviceOrderStore.upsert({ id:'so_test', title:'Montaż listwy po korekcie', clientName:'Jan', status:'zakonczone' });
          const rows = FC.serviceOrderStore.readAll();
          H.assert(Array.isArray(rows) && rows.length === 1, 'Upsert zduplikował zlecenie usługowe', rows);
          H.assert(String(rows[0].title || '') === 'Montaż listwy po korekcie', 'Upsert nie nadpisał tytułu istniejącego zlecenia', rows[0]);
          H.assert(String(rows[0].status || '') === 'zakonczone', 'Upsert nie nadpisał statusu istniejącego zlecenia', rows[0]);
          H.assert(String(first.id || '') === String(second.id || ''), 'Upsert nie zachował tego samego ID zlecenia', { first, second, rows });
        });
      }),
      H.makeTest('Usługi', 'API listy zleceń czyta dane ze store i ma komplet stanów statusu', 'Pilnuje, czy widok zleceń usługowych ma własne źródło danych i pełny zestaw statusów zamiast polegać na przypadkowych stałych w UI.', ()=>{
        withOrdersStorage(()=>{
          H.assert(FC.serviceOrders && typeof FC.serviceOrders.getOrders === 'function', 'Brak FC.serviceOrders.getOrders');
          H.assert(Array.isArray(FC.serviceOrders.STATUS_OPTIONS), 'Brak STATUS_OPTIONS dla zleceń usługowych');
          const statuses = FC.serviceOrders.STATUS_OPTIONS.map((row)=> String(row && row.value || ''));
          H.assert(statuses.includes('nowe') && statuses.includes('w_trakcie') && statuses.includes('zakonczone'), 'Brak pełnej listy statusów zleceń usługowych', statuses);
          FC.serviceOrderStore.writeAll([{ id:'so_live', title:'Naprawa blatu', clientName:'Ala', status:'nowe' }]);
          const rows = FC.serviceOrders.getOrders();
          H.assert(Array.isArray(rows) && rows.length === 1, 'Widok zleceń nie czyta danych ze store', rows);
          H.assert(String(rows[0].title || '') === 'Naprawa blatu', 'Widok zleceń zwrócił nieprawidłowy rekord', rows[0]);
        });
      }),
      H.makeTest('Usługi', 'Cleanup testowych zleceń usługowych usuwa tylko oznaczone rekordy', 'Pilnuje, czy po smoke testach można bezpiecznie posprzątać tylko testowe zlecenia usługowe bez ruszania realnych danych.', ()=>{
        H.assert(FC.testDataManager && typeof FC.testDataManager.createServiceOrder === 'function', 'Brak FC.testDataManager.createServiceOrder');
        H.assert(FC.testDataManager && typeof FC.testDataManager.cleanup === 'function', 'Brak FC.testDataManager.cleanup');
        const prevOrders = FC.serviceOrderStore.readAll();
        try{
          FC.serviceOrderStore.writeAll([{ id:'so_real', title:'Prawdziwe zlecenie', clientName:'Klient', meta:{} }]);
          const created = FC.testDataManager.createServiceOrder({ title:'Testowe zlecenie' });
          H.assert(created && created.meta && created.meta.testData === true, 'TestDataManager nie oznaczył zlecenia jako testowego', created);
          const summary = FC.testDataManager.cleanup();
          const rows = FC.serviceOrderStore.readAll();
          H.assert(summary && Number(summary.serviceOrders) >= 1, 'Cleanup nie zgłosił usunięcia testowego zlecenia', summary);
          H.assert(Array.isArray(rows) && rows.length === 1 && String(rows[0].id || '') === 'so_real', 'Cleanup naruszył realne zlecenia albo nie usunął testowych', rows);
        } finally {
          FC.serviceOrderStore.writeAll(prevOrders);
        }
      }),

      H.makeTest('Usługi', 'Katalog usługowych zleceń z catalogStore pozostaje zsynchronizowany ze store zleceń', 'Pilnuje, czy warstwa katalogowa czyta i zapisuje te same zlecenia usługowe co właściwy store, bez rozjechania źródeł danych.', ()=>{
        H.assert(FC.catalogStore && typeof FC.catalogStore.getServiceOrders === 'function', 'Brak FC.catalogStore.getServiceOrders');
        H.assert(FC.catalogStore && typeof FC.catalogStore.upsertServiceOrder === 'function', 'Brak FC.catalogStore.upsertServiceOrder');
        withOrdersStorage(()=>{
          FC.catalogStore.upsertServiceOrder({ id:'so_catalog', title:'Montaż AGD', clientName:'Ala', status:'nowe' });
          const fromCatalog = FC.catalogStore.getServiceOrders();
          const fromStore = FC.serviceOrderStore.readAll();
          H.assert(Array.isArray(fromCatalog) && fromCatalog.length === 1, 'catalogStore nie zwrócił zlecenia usługowego', fromCatalog);
          H.assert(Array.isArray(fromStore) && fromStore.length === 1 && String(fromStore[0].id || '') === 'so_catalog', 'catalogStore nie zapisał zlecenia do właściwego store', fromStore);
          FC.serviceOrderStore.writeAll([{ id:'so_external', title:'Zewnętrzny zapis', clientName:'Ela', status:'nowe' }]);
          const synced = FC.catalogStore.getServiceOrders();
          H.assert(Array.isArray(synced) && synced.length === 1 && String(synced[0].id || '') === 'so_external', 'catalogStore nie zsynchronizował odczytu po bezpośrednim zapisie do store', synced);
          FC.catalogStore.removeServiceOrder('so_external');
          H.assert(Array.isArray(FC.serviceOrderStore.readAll()) && FC.serviceOrderStore.readAll().length === 0, 'Usunięcie z catalogStore nie wyczyściło store zleceń', FC.serviceOrderStore.readAll());
        });
      }),
      H.makeTest('Usługi', 'Szkic zlecenia usługowego nie zapisuje pustego rekordu przy pierwszym wejściu', 'Pilnuje, czy samo otwarcie formularza usług nie tworzy pustego wpisu w storage przed pierwszym zapisem użytkownika.', ()=>{
        H.assert(FC.serviceOrderStore && typeof FC.serviceOrderStore.createDraft === 'function', 'Brak FC.serviceOrderStore.createDraft');
        withOrdersStorage(()=>{
          const before = FC.serviceOrderStore.readAll().length;
          const draft = FC.serviceOrderStore.createDraft({ clientName:'Test' });
          const after = FC.serviceOrderStore.readAll().length;
          H.assert(String(draft.id || '') !== '', 'Szkic zlecenia nie dostał technicznego ID', draft);
          H.assert(before === 0 && after === 0, 'Samo przygotowanie szkicu zapisało pusty rekord do store', { before, after, draft });
          H.assert(String(draft.status || '') === 'nowe', 'Szkic zlecenia nie dostał domyślnego statusu nowe', draft);
        });
      }),

      H.makeTest('Usługi', 'Szkic cięcia usługowego normalizuje materiał, płytę i krawędzie', 'Pilnuje, czy uproszczony draft cięcia dla małych zleceń ma bezpieczne domyślne pola i nie gubi liczby krawędzi do oklejania.', ()=>{
        H.assert(FC.serviceCuttingCommon && typeof FC.serviceCuttingCommon.normalizeDraft === 'function', 'Brak FC.serviceCuttingCommon.normalizeDraft');
        const draft = FC.serviceCuttingCommon.normalizeDraft({
          materialMode:'client',
          materialName:'Płyta klienta',
          boardW:'3050',
          boardH:'2070',
          parts:[{ name:'Bok', qty:'2', along:'720', across:'560', edgesAlong:'2', edgesAcross:'1' }]
        });
        H.assert(String(draft.materialMode || '') === 'client', 'Draft cięcia nie zachował trybu materiału klienta', draft);
        H.assert(Number(draft.boardW) === 3050 && Number(draft.boardH) === 2070, 'Draft cięcia nie zachował wymiarów płyty', draft);
        H.assert(Array.isArray(draft.parts) && draft.parts.length === 1, 'Draft cięcia nie zachował listy formatek', draft);
        H.assert(Number(draft.parts[0].edgesAlong) === 2 && Number(draft.parts[0].edgesAcross) === 1, 'Draft cięcia nie zachował krawędzi do oklejania', draft.parts[0]);
      }),
      H.makeTest('Usługi', 'Usługowy rozrys generuje plan z formatek bez ingerencji w stary ROZRYS', 'Pilnuje, czy uproszczone zlecenie usługowe potrafi wygenerować plan z istniejącego silnika rozrysu bez pomieszczeń i meblowych danych projektu.', ()=>{
        H.assert(FC.serviceCuttingRozrys && typeof FC.serviceCuttingRozrys.generatePlan === 'function', 'Brak FC.serviceCuttingRozrys.generatePlan');
        const payload = FC.serviceCuttingRozrys.generatePlan({
          materialMode:'client',
          materialName:'Materiał klienta',
          boardW:2800,
          boardH:2070,
          kerf:4,
          edgeTrim:10,
          parts:[
            { id:'p1', name:'Formatka A', qty:2, along:720, across:560, edgesAlong:2, edgesAcross:1 },
            { id:'p2', name:'Formatka B', qty:1, along:400, across:300, edgesAlong:0, edgesAcross:2 }
          ]
        });
        H.assert(payload && typeof payload.then === 'undefined', 'Usługowy rozrys nie powinien wymagać async workera w smoke testach', payload);
        H.assert(payload && payload.ok === true, 'Usługowy rozrys nie wygenerował planu', payload);
        H.assert(payload.plan && Array.isArray(payload.plan.sheets) && payload.plan.sheets.length >= 1, 'Usługowy rozrys nie zwrócił arkuszy', payload && payload.plan);
      }),

      H.makeTest('Usługi', 'Parser PRO100 rozpoznaje stałe kolumny, ilość, kolor i oklejanie', 'Pilnuje, czy wklejka z PRO100 jest czytana bez ręcznego przepisywania formatek: = oznacza dwie krawędzie, - jedną, puste pole brak oklejania.', ()=>{
        H.assert(FC.servicePro100Parser && typeof FC.servicePro100Parser.parse === 'function', 'Brak FC.servicePro100Parser.parse');
        const parsed = FC.servicePro100Parser.parse('blenda NUT FREZ ROZCIĄĆ\t1433\t=\t150\t=\t18\t1\tU222_ST15\nwisząca wieniec\t415\t-\t258\t\t18\t6\tU222_ST15');
        H.assert(parsed && parsed.ok === true, 'Parser PRO100 nie zaakceptował poprawnej wklejki', parsed);
        H.assert(Array.isArray(parsed.rows) && parsed.rows.length === 2, 'Parser PRO100 nie zwrócił dwóch formatek', parsed);
        H.assert(Number(parsed.rows[0].edgesAlong) === 2 && Number(parsed.rows[0].edgesAcross) === 2, 'Parser nie rozpoznał = jako dwóch krawędzi', parsed.rows[0]);
        H.assert(Number(parsed.rows[1].edgesAlong) === 1 && Number(parsed.rows[1].edgesAcross) === 0, 'Parser nie rozpoznał -/puste jako jedna/brak krawędzi', parsed.rows[1]);
        H.assert(Number(parsed.rows[1].qty) === 6 && String(parsed.rows[1].materialSymbol || '') === 'U222_ST15', 'Parser nie rozpoznał ilości albo koloru', parsed.rows[1]);
      }),
      H.makeTest('Usługi', 'Parser PRO100 liczy podsumowanie oklejania i grup po kolorze/grubości', 'Pilnuje, czy import PRO100 od razu daje podgląd metrażu i nie miesza kolorów/grubości w jednym koszyku.', ()=>{
        const parsed = FC.servicePro100Parser.parse('A\t1000\t=\t500\t-\t18\t2\tU222_ST15\nB\t700\t\t300\t=\t18\t1\tU222_ST15');
        H.assert(parsed.summary && Number(parsed.summary.totalQty) === 3, 'Podsumowanie PRO100 nie policzyło ilości sztuk', parsed.summary);
        H.assert(Number(parsed.summary.edgeMeters) === 5.6, 'Podsumowanie PRO100 nie policzyło metrażu oklejania', parsed.summary);
        H.assert(Array.isArray(parsed.summary.materials) && parsed.summary.materials.length === 1, 'Podsumowanie PRO100 nie pogrupowało po kolorze/grubości', parsed.summary);
      }),
      H.makeTest('Usługi', 'Import PRO100 wykrywa brakujące kolory i zapisuje ptaszek Ma słoje w materiale', 'Pilnuje, czy nowy kolor z PRO100 nie jest zgadywany po cichu i czy przy dodaniu materiału zachowuje decyzję o słojach.', ()=>{
        H.assert(FC.servicePro100Import && typeof FC.servicePro100Import.uniqueMissingMaterials === 'function', 'Brak helperów importu PRO100');
        const prevMaterials = FC.catalogStore.getSheetMaterials();
        try{
          FC.catalogStore.savePriceList('materials', []);
          const parsed = FC.servicePro100Parser.parse('Front\t720\t=\t396\t-\t18\t2\tU999_ST9');
          const missing = FC.servicePro100Import.uniqueMissingMaterials(parsed.rows, FC.catalogStore.getSheetMaterials());
          H.assert(Array.isArray(missing) && missing.length === 1, 'Import PRO100 nie wykrył brakującego koloru', missing);
          missing[0].hasGrain = true;
          const map = FC.servicePro100Import.buildResolvedMaterialMap(parsed.rows, missing);
          const saved = FC.catalogStore.getSheetMaterials();
          H.assert(Array.isArray(saved) && saved.length === 1, 'Import PRO100 nie dodał materiału do katalogu', saved);
          H.assert(saved[0].hasGrain === true, 'Dodany materiał nie zachował ptaszka Ma słoje', saved[0]);
          H.assert(map && map.size === 1, 'Import PRO100 nie zwrócił mapy materiałów dla formatek', map);
        } finally {
          FC.catalogStore.savePriceList('materials', prevMaterials);
        }
      }),
      H.makeTest('Usługi', 'Import PRO100 tworzy formatki zgodne ze szkicem usługowego rozrysu', 'Pilnuje, czy wklejone formatki trafiają do tego samego modelu części, którego używa istniejący rozrys usługowy.', ()=>{
        const parsed = FC.servicePro100Parser.parse('Front\t720\t=\t396\t-\t18\t2\tU222_ST15');
        const material = { id:'mat_u222', name:'U222_ST15', symbol:'U222_ST15', hasGrain:true };
        const map = new Map([[parsed.rows[0].materialKey, material]]);
        const parts = FC.servicePro100Import.rowsToParts(parsed.rows, map);
        const draft = FC.serviceCuttingCommon.normalizeDraft({ materialMode:'catalog', materialId:'mat_u222', materialName:'U222_ST15', parts });
        H.assert(Array.isArray(draft.parts) && draft.parts.length === 1, 'Import PRO100 nie utworzył formatki w draft', draft);
        H.assert(Number(draft.parts[0].along) === 720 && Number(draft.parts[0].across) === 396, 'Draft po imporcie PRO100 ma złe wymiary', draft.parts[0]);
        H.assert(Number(draft.parts[0].edgesAlong) === 2 && Number(draft.parts[0].edgesAcross) === 1, 'Draft po imporcie PRO100 ma złe oklejanie', draft.parts[0]);
        H.assert(draft.parts[0].hasGrain === true && String(draft.parts[0].materialSymbol || '') === 'U222_ST15', 'Draft po imporcie PRO100 zgubił materiał/słoje', draft.parts[0]);
      }),
      H.makeTest('Usługi', 'Store zleceń zachowuje formatki PRO100 przy zapisie i odczycie', 'Pilnuje, czy zapis zlecenia usługowego nie kasuje materiału, grubości i informacji o słojach z importu PRO100.', ()=>{
        withOrdersStorage(()=>{
          const saved = FC.serviceOrderStore.upsert({ id:'so_pro100', title:'Import PRO100', cutting:{ parts:[{ name:'Front', qty:2, along:720, across:396, edgesAlong:2, edgesAcross:1, thickness:18, materialId:'mat_u222', materialName:'U222_ST15', materialSymbol:'U222_ST15', hasGrain:true, source:'pro100' }] } });
          const row = FC.serviceOrderStore.getById(saved.id);
          H.assert(row && row.cutting && Array.isArray(row.cutting.parts) && row.cutting.parts.length === 1, 'Store nie zachował części cięcia', row);
          H.assert(Number(row.cutting.parts[0].thickness) === 18, 'Store zgubił grubość formatki PRO100', row.cutting.parts[0]);
          H.assert(String(row.cutting.parts[0].materialSymbol || '') === 'U222_ST15' && row.cutting.parts[0].hasGrain === true, 'Store zgubił materiał albo słoje formatki PRO100', row.cutting.parts[0]);
        });
      }),
      H.makeTest('Usługi', 'Usługowy rozrys pozwala obracać formatki bez słojów i pilnuje kierunku przy słojach', 'Pilnuje, czy ptaszek Ma słoje z materiału wpływa na ROZRYS zamiast zawsze blokować obrót.', ()=>{
        H.assert(FC.serviceCuttingRozrys && typeof FC.serviceCuttingRozrys.generatePlan === 'function', 'Brak serviceCuttingRozrys.generatePlan');
        const prevMaterials = FC.catalogStore.getSheetMaterials();
        try{
          FC.catalogStore.savePriceList('materials', [
            { id:'mat_plain', materialType:'laminat', manufacturer:'PRO100', symbol:'PLAIN', name:'PLAIN', price:0, hasGrain:false },
            { id:'mat_grain', materialType:'laminat', manufacturer:'PRO100', symbol:'GRAIN', name:'GRAIN', price:0, hasGrain:true }
          ]);
          const plain = FC.serviceCuttingRozrys.generatePlan({ materialMode:'catalog', materialId:'mat_plain', materialName:'PLAIN', parts:[{ name:'A', qty:1, along:700, across:300, edgesAlong:0, edgesAcross:0, materialId:'mat_plain', materialName:'PLAIN' }] });
          const grain = FC.serviceCuttingRozrys.generatePlan({ materialMode:'catalog', materialId:'mat_grain', materialName:'GRAIN', parts:[{ name:'A', qty:1, along:700, across:300, edgesAlong:0, edgesAcross:0, materialId:'mat_grain', materialName:'GRAIN', hasGrain:true }] });
          H.assert(plain && plain.ok === true && plain.state && plain.state.grain === false, 'Rozrys usługowy nie wyłączył słojów dla materiału bez słojów', plain);
          H.assert(grain && grain.ok === true && grain.state && grain.state.grain === true, 'Rozrys usługowy nie włączył słojów dla materiału ze słojami', grain);
        } finally {
          FC.catalogStore.savePriceList('materials', prevMaterials);
        }
      }),
      H.makeTest('Usługi', 'Lista zleceń ma wejście do szczegółu usługowego cięcia', 'Pilnuje, czy warstwa usług ma osobny moduł wejścia do szczegółu zlecenia, a nie tylko edycję ogólnych danych.', ()=>{
        H.assert(FC.serviceOrderDetail && typeof FC.serviceOrderDetail.open === 'function', 'Brak FC.serviceOrderDetail.open');
      }),
    ]);
  }

  FC.serviceDevTests = { runAll };
})(typeof window !== 'undefined' ? window : globalThis);
