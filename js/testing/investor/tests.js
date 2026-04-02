(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const harness = FC.testHarness;
  if(!harness) return;
  const { makeTest, runSuite, assert } = harness;

  function sampleInvestor(){
    return {
      id:'inv_test',
      kind:'person',
      name:'Jan Kowalski',
      companyName:'',
      phone:'123',
      email:'jan@example.com',
      city:'Łódź',
      address:'Test 1',
      source:'Polecenie',
      nip:'',
      notes:'abc',
      status:'nowy',
      rooms:[{ id:'room_kuchnia_a', baseType:'kuchnia', name:'Kuchnia góra', label:'Kuchnia góra' }]
    };
  }

  const tests = [
    makeTest('Inwestor', 'Stan edytora inwestora przechodzi z podglądu do edycji i wykrywa zmiany', 'Sprawdza, czy nowy moduł stanu edycji inwestora nie gubi draftu i poprawnie liczy dirty.', ()=>{
      assert(FC.investorEditorState && typeof FC.investorEditorState.enter === 'function', 'Brak investorEditorState');
      const inv = sampleInvestor();
      FC.investorEditorState.enter(inv);
      assert(FC.investorEditorState.state.isEditing === true, 'Tryb edycji nie został włączony');
      assert(FC.investorEditorState.state.dirty === false, 'Dirty nie powinno być ustawione od razu');
      FC.investorEditorState.setField('city', 'Warszawa');
      assert(FC.investorEditorState.state.dirty === true, 'Zmiana pola nie ustawiła dirty');
      const patch = FC.investorEditorState.commit(inv);
      assert(patch.city === 'Warszawa', 'Commit nie zwrócił zmienionej wartości miasta', patch);
      assert(FC.investorEditorState.state.isEditing === false, 'Commit nie wyłączył trybu edycji');
    }),
    makeTest('Inwestor', 'Rejestr pomieszczeń wykrywa duplikat nazwy niezależnie od wielkości liter i polskich znaków', 'Pilnuje, czy dla jednego inwestora nie da się dodać dwóch pomieszczeń o tej samej nazwie także po normalizacji diakrytyków.', ()=>{
      assert(FC.roomRegistry && typeof FC.roomRegistry.isRoomNameTaken === 'function', 'Brak roomRegistry.isRoomNameTaken');
      const inv = sampleInvestor();
      assert(FC.roomRegistry.isRoomNameTaken('kuchnia GÓRA', inv) === true, 'Duplikat nazwy nie został wykryty');
      inv.rooms.push({ id:'room_kuchnia_dol', baseType:'kuchnia', name:'kuchnia dół', label:'kuchnia dół' });
      assert(FC.roomRegistry.isRoomNameTaken('kuchnia dol', inv) === true, 'Duplikat akcento-niezależny nie został wykryty');
      assert(FC.roomRegistry.isRoomNameTaken('Łazienka', inv) === false, 'Fałszywy duplikat dla innej nazwy');
    }),
  ];

  FC.investorDevTests = { runAll: ()=> runSuite('INWESTOR smoke testy', tests) };
})(typeof window !== 'undefined' ? window : globalThis);
