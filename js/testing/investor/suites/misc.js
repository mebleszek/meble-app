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
    makeTest('Inwestor', 'Domyślne obrównanie rozrysu startuje od 1 cm / 10 mm', 'Pilnuje, czy wszystkie fallbacki opcji rozkroju wróciły do uzgodnionego domyślnego obrównania 1 cm zamiast starego 2 cm.', ()=>{
      assert(FC.rozrysStock && typeof FC.rozrysStock.getDefaultRozrysOptionValues === 'function', 'Brak getDefaultRozrysOptionValues');
      const cm = FC.rozrysStock.getDefaultRozrysOptionValues('cm');
      const mm = FC.rozrysStock.getDefaultRozrysOptionValues('mm');
      assert(Number(cm && cm.trim) === 1, 'Domyślne obrównanie dla cm nie wynosi 1', cm);
      assert(Number(mm && mm.trim) === 10, 'Domyślne obrównanie dla mm nie wynosi 10', mm);
      assert(FC.rozrysState && typeof FC.rozrysState.buildBaseStateFromControls === 'function', 'Brak rozrysState.buildBaseStateFromControls');
      const built = FC.rozrysState.buildBaseStateFromControls({ unitSel:{ value:'cm' }, edgeSel:{ value:'0' }, inW:{ value:'' }, inH:{ value:'' }, inK:{ value:'' }, inTrim:{ value:'' }, inMinW:{ value:'' }, inMinH:{ value:'' }, heurSel:{ value:'max' }, dirSel:{ value:'start-optimax' } });
      assert(Number(built.edgeTrim) === 1, 'Fallback edgeTrim z buildBaseStateFromControls nie wynosi 1 cm', built);
    }),
  ];

  FC.investorDevTestSuites = FC.investorDevTestSuites || [];
  FC.investorDevTestSuites.push({ key:'misc', tests });
})(typeof window !== 'undefined' ? window : globalThis);
