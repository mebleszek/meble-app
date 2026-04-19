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
  }

  const tests = [
    makeTest('Inwestor', 'Moduły architektury inwestora są podpięte', 'Pilnuje, czy po refaktorze istnieją moduły do blokad, renderu pól, akcji i centralnego zapisu inwestora.', ()=>{
      assert(FC.investorPersistence && typeof FC.investorPersistence.saveInvestorPatch === 'function', 'Brak investorPersistence.saveInvestorPatch');
      assert(FC.investorNavigationGuard && typeof FC.investorNavigationGuard.apply === 'function', 'Brak investorNavigationGuard.apply');
      assert(FC.investorFieldRender && typeof FC.investorFieldRender.buildPairRow === 'function', 'Brak investorFieldRender.buildPairRow');
      assert(FC.investorActions && typeof FC.investorActions.buildActionBarHtml === 'function', 'Brak investorActions.buildActionBarHtml');
    }),
    makeTest('Inwestor', 'Rejestr pomieszczeń ma wspólny modal zarządzania', 'Pilnuje, czy sekcja pomieszczeń inwestora ma jedno wspólne wejście do zarządzania nazwami i usuwaniem zamiast akcji porozrzucanych po kartach.', ()=>{
      assert(FC.roomRegistry && typeof FC.roomRegistry.openManageRoomsModal === 'function', 'Brak roomRegistry.openManageRoomsModal');
      assert(FC.investorRoomActions && typeof FC.investorRoomActions.bindRoomActions === 'function', 'Brak investorRoomActions.bindRoomActions');
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
    makeTest('Inwestor', 'Firma przechowuje właściciela jako osobne pole', 'Pilnuje, czy dane firmy mają osobne pole właściciela, żeby można je było renderować nad NIP-em bez dokładania prowizorek w UI.', ()=>{
      assert(FC.investors && typeof FC.investors.normalizeInvestor === 'function', 'Brak investors.normalizeInvestor');
      const normalized = FC.investors.normalizeInvestor({ id:'inv_company', kind:'company', companyName:'ABC', ownerName:'Jan Nowak', nip:'123' });
      assert(String(normalized.ownerName || '') === 'Jan Nowak', 'Store nie zachował ownerName firmy', normalized);
      assert(FC.investorEditorState && typeof FC.investorEditorState.buildPatchFromDraft === 'function', 'Brak investorEditorState.buildPatchFromDraft');
      const patch = FC.investorEditorState.buildPatchFromDraft({ kind:'company', companyName:'ABC', ownerName:'Jan Nowak', nip:'123' });
      assert(String(patch.ownerName || '') === 'Jan Nowak', 'Patch inwestora nie zachował ownerName firmy', patch);
    }),
    makeTest('Inwestor', 'Rejestr pomieszczeń wykrywa duplikat nazwy niezależnie od wielkości liter i polskich znaków', 'Pilnuje, czy dla jednego inwestora nie da się dodać dwóch pomieszczeń o tej samej nazwie także po normalizacji diakrytyków.', ()=>{
      assert(FC.roomRegistry && typeof FC.roomRegistry.isRoomNameTaken === 'function', 'Brak roomRegistry.isRoomNameTaken');
      const inv = sampleInvestor();
      assert(FC.roomRegistry.isRoomNameTaken('kuchnia GÓRA', inv) === true, 'Duplikat nazwy nie został wykryty');
      inv.rooms.push({ id:'room_kuchnia_dol', baseType:'kuchnia', name:'kuchnia dół', label:'kuchnia dół' });
      assert(FC.roomRegistry.isRoomNameTaken('kuchnia dol', inv) === true, 'Duplikat akcento-niezależny nie został wykryty');
      assert(FC.roomRegistry.isRoomNameTaken('Łazienka', inv) === false, 'Fałszywy duplikat dla innej nazwy');
    }),
    makeTest('Inwestor', 'Rejestr aktywnych pomieszczeń dla inwestora nie wraca do generatorowych typów bazowych', 'Pilnuje, czy aktywne pokoje dla inwestora biorą się z rzeczywiście dodanych pomieszczeń, a nie z domyślnej listy kuchnia/szafa/pokój/łazienka.', ()=>{
      assert(FC.investors && typeof FC.investors.create === 'function', 'Brak investors.create');
      assert(FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomIds === 'function', 'Brak roomRegistry.getActiveRoomIds');
      const created = (FC.testDataManager && typeof FC.testDataManager.createInvestor === 'function'
        ? FC.testDataManager.createInvestor({
          kind:'person',
          name:'Test',
          rooms:[
            { id:'room_kuchnia_gora', baseType:'kuchnia', name:'Kuchnia góra', label:'Kuchnia góra' },
            { id:'room_spizarnia', baseType:'pokoj', name:'Spiżarnia', label:'Spiżarnia' }
          ]
        })
        : FC.investors.create({
          kind:'person',
          name:'Test',
          rooms:[
            { id:'room_kuchnia_gora', baseType:'kuchnia', name:'Kuchnia góra', label:'Kuchnia góra' },
            { id:'room_spizarnia', baseType:'pokoj', name:'Spiżarnia', label:'Spiżarnia' }
          ]
        }));
      FC.investors.setCurrentId(created.id);
      const ids = FC.roomRegistry.getActiveRoomIds();
      assert(Array.isArray(ids) && ids.includes('room_kuchnia_gora') && ids.includes('room_spizarnia'), 'Aktywne pokoje nie pochodzą z inwestora', ids);
      assert(!ids.includes('kuchnia') && !ids.includes('szafa') && !ids.includes('pokoj') && !ids.includes('lazienka'), 'Do listy wróciły typy bazowe zamiast pokoi inwestora', ids);
    }),

    makeTest('Inwestor', 'Firma ostrzega, gdy właściciel pasuje do istniejącej osoby prywatnej', 'Pilnuje reguły, że firma z właścicielem Jan Kowalski ma ostrzec o istniejącej osobie prywatnej Jan Kowalski.', ()=>{
      assert(FC.investorActions && FC.investorActions._debug && typeof FC.investorActions._debug.findInvestorConflicts === 'function', 'Brak debug.findInvestorConflicts');
      assert(FC.investors && typeof FC.investors.create === 'function', 'Brak investors.create');
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

    makeTest('Inwestor', 'Zmiana statusu z inwestora synchronizuje projekt i aktywną ofertę', 'Pilnuje, czy zmiana etapu projektu z poziomu inwestora ustawia status rekordu projektu i wybiera właściwą ofertę bez ręcznego poprawiania Wycena.', ()=>{
      assert(FC.investorPersistence && typeof FC.investorPersistence.setInvestorProjectStatus === 'function', 'Brak investorPersistence.setInvestorProjectStatus');
      assert(FC.projectStore && typeof FC.projectStore.ensureForInvestor === 'function', 'Brak FC.projectStore.ensureForInvestor');
      assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.save === 'function', 'Brak FC.quoteSnapshotStore.save');
      const prevInvestors = FC.investors.readAll();
      const prevCurrentInvestorId = FC.investors.getCurrentId();
      const prevProjects = FC.projectStore.readAll();
      const prevCurrentProjectId = FC.projectStore.getCurrentProjectId ? FC.projectStore.getCurrentProjectId() : '';
      const prevSnapshots = FC.quoteSnapshotStore.readAll();
      try{
        FC.investors.writeAll([]);
        FC.projectStore.writeAll([]);
        FC.quoteSnapshotStore.writeAll([]);
        const investor = FC.investors.create({
          id:'inv_sync_status',
          kind:'person',
          name:'Sync test',
          rooms:[{ id:'room_sync', baseType:'kuchnia', name:'Kuchnia test', label:'Kuchnia test', projectStatus:'nowy' }]
        });
        FC.investors.setCurrentId(investor.id);
        const project = FC.projectStore.ensureForInvestor(investor.id, {
          status:'nowy',
          projectData:{ room_sync:{ cabinets:[{ id:'cab_sync' }], fronts:[], sets:[], settings:{} } }
        });
        FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId(project.id);
        FC.quoteSnapshotStore.save({
          id:'snap_pre',
          investor:{ id:investor.id, name:investor.name },
          project:{ id:project.id, investorId:investor.id, status:'wstepna_wycena' },
          commercial:{ preliminary:true, versionName:'Wstępna oferta' },
          meta:{ preliminary:true, versionName:'Wstępna oferta' },
          generatedAt: 100,
        });
        FC.quoteSnapshotStore.save({
          id:'snap_final',
          investor:{ id:investor.id, name:investor.name },
          project:{ id:project.id, investorId:investor.id, status:'wycena' },
          commercial:{ preliminary:false, versionName:'Oferta' },
          meta:{ preliminary:false, versionName:'Oferta' },
          generatedAt: 200,
        });
        FC.investorPersistence.setInvestorProjectStatus(investor.id, 'room_sync', 'pomiar');
        const afterPomiarInvestor = FC.investors.getById(investor.id);
        const afterPomiarProject = FC.projectStore.getById(project.id);
        const selectedPre = FC.quoteSnapshotStore.getSelectedForProject(project.id);
        assert(String(afterPomiarInvestor.rooms[0].projectStatus || '') === 'pomiar', 'Pokój inwestora nie dostał statusu pomiar', afterPomiarInvestor);
        assert(String(afterPomiarProject.status || '') === 'pomiar', 'Project store nie zsynchronizował statusu pomiar', afterPomiarProject);
        assert(selectedPre && String(selectedPre.id || '') === 'snap_pre', 'Zmiana statusu na pomiar nie wybrała oferty wstępnej', selectedPre || FC.quoteSnapshotStore.listForProject(project.id));
        FC.investorPersistence.setInvestorProjectStatus(investor.id, 'room_sync', 'zaakceptowany');
        const afterFinalProject = FC.projectStore.getById(project.id);
        const selectedFinal = FC.quoteSnapshotStore.getSelectedForProject(project.id);
        assert(String(afterFinalProject.status || '') === 'zaakceptowany', 'Project store nie zsynchronizował statusu zaakceptowany', afterFinalProject);
        assert(selectedFinal && String(selectedFinal.id || '') === 'snap_final', 'Zmiana statusu na zaakceptowany nie wybrała oferty końcowej', selectedFinal || FC.quoteSnapshotStore.listForProject(project.id));
      } finally {
        FC.quoteSnapshotStore.writeAll(prevSnapshots);
        FC.projectStore.writeAll(prevProjects);
        FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId(prevCurrentProjectId);
        FC.investors.writeAll(prevInvestors);
        FC.investors.setCurrentId(prevCurrentInvestorId);
      }
    }),
    makeTest('Inwestor', 'Aktualizacja jednego pomieszczenia nie narusza pozostałych i odświeża etykietę rejestru', 'Pilnuje, czy edycja nazwy jednego pokoju nie nadpisuje innych wpisów inwestora i czy rejestr od razu zwraca nową etykietę.', ()=>{
      assert(FC.investorPersistence && typeof FC.investorPersistence.updateInvestorRoom === 'function', 'Brak investorPersistence.updateInvestorRoom');
      assert(FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function', 'Brak roomRegistry.getRoomLabel');
      const prevInvestors = FC.investors.readAll();
      const prevCurrentInvestorId = FC.investors.getCurrentId();
      try{
        FC.investors.writeAll([]);
        const investor = FC.investors.create({
          id:'inv_room_patch',
          kind:'person',
          name:'Room patch',
          rooms:[
            { id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'nowy' },
            { id:'room_b', baseType:'pokoj', name:'Pokój B', label:'Pokój B', projectStatus:'nowy' },
          ]
        });
        FC.investors.setCurrentId(investor.id);
        const updated = FC.investorPersistence.updateInvestorRoom(investor.id, 'room_b', { name:'Spiżarnia', label:'Spiżarnia' });
        const labels = (updated.rooms || []).map((room)=> String(room && room.label || room && room.name || ''));
        assert(labels.includes('Kuchnia A') && labels.includes('Spiżarnia'), 'Aktualizacja pokoju naruszyła listę pomieszczeń inwestora', updated.rooms);
        assert(String(FC.roomRegistry.getRoomLabel('room_b') || '') === 'Spiżarnia', 'Rejestr pomieszczeń nie zwrócił zaktualizowanej etykiety', { rooms: updated.rooms, active: FC.roomRegistry.getActiveRoomDefs && FC.roomRegistry.getActiveRoomDefs() });
      } finally {
        FC.investors.writeAll(prevInvestors);
        FC.investors.setCurrentId(prevCurrentInvestorId);
      }
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
