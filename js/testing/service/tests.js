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
      H.makeTest('Usługi', 'Lista zleceń ma wejście do szczegółu usługowego cięcia', 'Pilnuje, czy warstwa usług ma osobny moduł wejścia do szczegółu zlecenia, a nie tylko edycję ogólnych danych.', ()=>{
        H.assert(FC.serviceOrderDetail && typeof FC.serviceOrderDetail.open === 'function', 'Brak FC.serviceOrderDetail.open');
      }),
    ]);
  }

  FC.serviceDevTests = { runAll };
})(typeof window !== 'undefined' ? window : globalThis);
