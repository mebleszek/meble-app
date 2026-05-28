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

  const tests = [
    makeTest('Inwestor', 'Firma ostrzega, gdy właściciel pasuje do istniejącej osoby prywatnej', 'Pilnuje reguły, że firma z właścicielem Jan Kowalski ma ostrzec o istniejącej osobie prywatnej Jan Kowalski.', ()=>{
      assert(FC.investorActions && FC.investorActions._debug && typeof FC.investorActions._debug.findInvestorConflicts === 'function', 'Brak debug.findInvestorConflicts');
      assert(FC.investors && typeof FC.investors.create === 'function', 'Brak investors.create');
      try{ delete root.projectData; }catch(_){ root.projectData = undefined; }
      try{ if(root.window) delete root.window.projectData; }catch(_){ if(root.window) root.window.projectData = undefined; }
      const created = (FC.testDataManager && typeof FC.testDataManager.createInvestor === 'function'
        ? FC.testDataManager.createInvestor({ kind:'person', name:'Jan Kowalski', address:'Test 9' })
        : FC.investors.create({ kind:'person', name:'Jan Kowalski', address:'Test 9' }));
      const conflicts = FC.investorActions._debug.findInvestorConflicts({ id:'draft_cmp' }, { kind:'company', companyName:'Meble Jan', ownerName:'Jan Kowalski', address:'Inna 1' });
      assert(conflicts && conflicts.ownerPerson && String(conflicts.ownerPerson.id || '') === String(created.id || ''), 'Nie wykryto dopasowania ownerName firmy do osoby prywatnej', conflicts);
    }),


    makeTest('Inwestor', 'Karta PDF inwestora buduje się z danych modelu i ma własny przycisk w pasku akcji', 'Pilnuje, czy karta do segregatora nie zależy od DOM-u i czy w widoku inwestora jest osobny przycisk PDF.', ()=>{
      assert(FC.investorPdf && typeof FC.investorPdf.buildPrintHtml === 'function', 'Brak investorPdf.buildPrintHtml');
      const html = FC.investorPdf.buildPrintHtml(sampleInvestor());
      assert(/Karta inwestora/.test(String(html || '')), 'HTML PDF nie zawiera tytułu karty inwestora');
      assert(/Jan Kowalski/.test(String(html || '')), 'HTML PDF nie zawiera danych inwestora');
      assert(/Kuchnia góra/.test(String(html || '')), 'HTML PDF nie zawiera listy pomieszczeń');
      const actionBar = FC.investorActions.buildActionBarHtml({ isEditing:false, dirty:false });
      assert(/data-investor-action="pdf"/.test(String(actionBar || '')), 'Pasek akcji inwestora nie zawiera przycisku PDF', actionBar);
      assert(!/data-investor-action="delete"/.test(String(actionBar || '')), 'Usuń inwestora nie powinno być widoczne poza edycją', actionBar);
      const editIndex = String(actionBar || '').indexOf('data-investor-action="edit"');
      const pdfIndex = String(actionBar || '').indexOf('data-investor-action="pdf"');
      assert(editIndex !== -1 && pdfIndex !== -1 && editIndex < pdfIndex, 'Przycisk PDF nie jest dołożony jako ostatni po prawej stronie', actionBar);
      const editModeBar = FC.investorActions.buildActionBarHtml({ isEditing:true, dirty:false });
      assert(/data-investor-action="delete"/.test(String(editModeBar || '')), 'Usuń inwestora powinno być dostępne po wejściu w edycję', editModeBar);
    }),

        makeTest('Inwestor', 'Dodawanie inwestora otwiera formularz bez pustego wpisu w bazie', 'Pilnuje, czy nowy inwestor startuje jako szkic w UI, a nie jako pusty rekord zapisany od razu do storage.', ()=>{
      assert(FC.investors && typeof FC.investors.readAll === 'function', 'Brak investors.readAll');
      const before = FC.investors.readAll().length;
      const temp = FC.investors.normalizeInvestor({ id:'draft_inv_test', kind:'person' });
      assert(String(temp.id || '').startsWith('draft_'), 'Szkic inwestora powinien mieć techniczne ID draftu', temp);
      const after = FC.investors.readAll().length;
      assert(before === after, 'Samo przygotowanie szkicu nie może dodawać pustego inwestora do bazy', { before, after });
    }),

  ];

  FC.investorDevTestSuites = FC.investorDevTestSuites || [];
  FC.investorDevTestSuites.push({ key:'model-actions', tests });
})(typeof window !== 'undefined' ? window : globalThis);
