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
    ]);
  }

  FC.serviceDevTests = { runAll };
})(typeof window !== 'undefined' ? window : globalThis);
