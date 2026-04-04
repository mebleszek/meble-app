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
      addedDate:'2026-04-04',
      rooms:[{ id:'room_kuchnia_a', baseType:'kuchnia', name:'Kuchnia góra', label:'Kuchnia góra', projectStatus:'nowy' }]
    };
  }

  const tests = [
    makeTest('Inwestor', 'Moduły architektury inwestora są podpięte', 'Pilnuje, czy po refaktorze istnieją moduły do blokad, renderu pól, akcji i centralnego zapisu inwestora.', ()=>{
      assert(FC.investorPersistence && typeof FC.investorPersistence.saveInvestorPatch === 'function', 'Brak investorPersistence.saveInvestorPatch');
      assert(FC.investorNavigationGuard && typeof FC.investorNavigationGuard.apply === 'function', 'Brak investorNavigationGuard.apply');
      assert(FC.investorFieldRender && typeof FC.investorFieldRender.buildPairRow === 'function', 'Brak investorFieldRender.buildPairRow');
      assert(FC.investorActions && typeof FC.investorActions.buildActionBarHtml === 'function', 'Brak investorActions.buildActionBarHtml');
    }),
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
    makeTest('Inwestor', 'Store inwestorów normalizuje datę dodania i status projektu', 'Pilnuje, czy inwestor ma stabilną datę dodania, a projekty/pomieszczenia dostają własny status zamiast statusu inwestora.', ()=>{
      assert(FC.investors && typeof FC.investors.normalizeInvestor === 'function', 'Brak investors.normalizeInvestor');
      const normalized = FC.investors.normalizeInvestor({ id:'inv_a', kind:'person', createdAt: 1712275200000, rooms:[{ id:'room_1', label:'Kuchnia dół' }] });
      assert(/^\d{4}-\d{2}-\d{2}$/.test(String(normalized.addedDate || '')), 'Brak poprawnej daty dodania', normalized);
      assert(Array.isArray(normalized.rooms) && normalized.rooms[0] && normalized.rooms[0].projectStatus === 'nowy', 'Pokój/projekt nie dostał domyślnego statusu', normalized);
    }),
    makeTest('Inwestor', 'Rejestr pomieszczeń wykrywa duplikat nazwy niezależnie od wielkości liter i polskich znaków', 'Pilnuje, czy dla jednego inwestora nie da się dodać dwóch pomieszczeń o tej samej nazwie także po normalizacji diakrytyków.', ()=>{
      assert(FC.roomRegistry && typeof FC.roomRegistry.isRoomNameTaken === 'function', 'Brak roomRegistry.isRoomNameTaken');
      const inv = sampleInvestor();
      assert(FC.roomRegistry.isRoomNameTaken('kuchnia GÓRA', inv) === true, 'Duplikat nazwy nie został wykryty');
      inv.rooms.push({ id:'room_kuchnia_dol', baseType:'kuchnia', name:'kuchnia dół', label:'kuchnia dół' });
      assert(FC.roomRegistry.isRoomNameTaken('kuchnia dol', inv) === true, 'Duplikat akcento-niezależny nie został wykryty');
      assert(FC.roomRegistry.isRoomNameTaken('Łazienka', inv) === false, 'Fałszywy duplikat dla innej nazwy');
    }),
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

  FC.investorDevTests = { runAll: ()=> runSuite('INWESTOR smoke testy', tests) };
})(typeof window !== 'undefined' ? window : globalThis);
