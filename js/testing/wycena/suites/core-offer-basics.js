(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  if(!(FC.testHarness && typeof FC.registerWycenaTests === 'function')) return;

  FC.registerWycenaTests(({ FC, H, clone, withInvestorProjectFixture })=> [
    H.makeTest('Wycena', 'Katalog usług AGD uzupełnia brakujące pozycje bez duplikowania istniejących', 'Pilnuje, czy Wycena zawsze ma osobne pozycje montażu AGD i czy kolejne przebiegi nie rozmnażają usług.', ()=>{
        H.assert(FC.wycenaCore && typeof FC.wycenaCore.ensureServiceCatalog === 'function', 'Brak wycenaCore.ensureServiceCatalog');
        const input = [
          { id:'svc_1', category:'AGD', name:'Piekarnik do zabudowy', price:111 },
          { id:'svc_2', category:'Montaż', name:'Montaż blatu', price:80 }
        ];
        const result = FC.wycenaCore.ensureServiceCatalog(input);
        H.assert(result && Array.isArray(result.list), 'ensureServiceCatalog nie zwrócił listy', result);
        const oven = result.list.filter((item)=> String(item && item.name || '') === 'Piekarnik do zabudowy');
        H.assert(oven.length === 1, 'Usługa AGD została zduplikowana', result.list);
        H.assert(result.list.some((item)=> String(item && item.name || '') === 'Zmywarka do zabudowy'), 'Brakuje domyślnej usługi AGD dla zmywarki', result.list);
      }),

    H.makeTest('Wycena', 'Price modal buduje pełniejsze listy wyboru i filtry dla cennika', 'Pilnuje, czy cennik ma własne filtry, zachowuje producentów z registry i nie gubi opcji „wszystkie”.', ()=>{
        H.assert(FC.priceModal && FC.priceModal._debug, 'Brak debug helpers w priceModal');
        const cats = FC.priceModal._debug.buildServiceCategoryOptions('AGD', { includeAll:true });
        H.assert(Array.isArray(cats) && cats.some((item)=> String(item && item.value || '') === 'AGD'), 'Lista kategorii nie zawiera AGD', cats);
        H.assert(cats.some((item)=> String(item && item.value || '') === ''), 'Lista kategorii nie ma opcji wszystkich', cats);
        const manufacturers = FC.priceModal._debug.buildManufacturerOptions('akcesoria', 'Blum', { includeAll:true });
        H.assert(Array.isArray(manufacturers) && manufacturers.some((item)=> /blum/i.test(String(item && item.value || ''))), 'Lista producentów akcesoriów nie zawiera Blum', manufacturers);
        H.assert(manufacturers.some((item)=> String(item && item.value || '') === ''), 'Lista producentów nie ma opcji wszystkich', manufacturers);
        const editManufacturers = FC.priceModal._debug.buildManufacturerOptions('akcesoria', 'Blum');
        H.assert(!editManufacturers.some((item)=> /brak/i.test(String(item && item.label || ''))), 'Do wyboru producenta wróciła pseudo-opcja Brak / własny wpis', editManufacturers);
        const materialTypes = FC.priceModal._debug.buildMaterialTypeOptions('akcesoria', { includeAll:true });
        H.assert(materialTypes.some((item)=> String(item && item.value || '') === 'akcesoria'), 'Lista typów materiału nie zawiera akcesoriów', materialTypes);
      }),

    H.makeTest('Wycena', 'Domyślne nazwy wersji uwzględniają scope pomieszczeń', 'Pilnuje, czy puste nazwy wersji dostają etykietę zgodną z typem oferty i dokładnym zakresem pokoi.', ()=>{
        H.assert(FC.quoteOfferStore && typeof FC.quoteOfferStore.normalizeCommercial === 'function', 'Brak FC.quoteOfferStore.normalizeCommercial');
        H.assert(FC.quoteSnapshot && typeof FC.quoteSnapshot.buildSnapshot === 'function', 'Brak FC.quoteSnapshot.buildSnapshot');
        withInvestorProjectFixture({}, ()=>{
          const prelimDraft = FC.quoteOfferStore.normalizeCommercial({ preliminary:true, versionName:'' }, { selection:{ selectedRooms:['room_kuchnia_gora'] } });
          const finalDraft = FC.quoteOfferStore.normalizeCommercial({ preliminary:false, versionName:'' }, { selection:{ selectedRooms:['room_kuchnia_gora','room_salon'] } });
          H.assert(String(prelimDraft.versionName || '') === 'Wstępna oferta — Kuchnia góra', 'Domyślna nazwa wstępnej oferty nie uwzględnia scope pokoju', prelimDraft);
          H.assert(String(finalDraft.versionName || '') === 'Oferta — Kuchnia góra + Salon', 'Domyślna nazwa zwykłej oferty nie uwzględnia scope wielu pokoi', finalDraft);
          const prelimSnap = FC.quoteSnapshot.buildSnapshot({ scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'' }, totals:{ grand:100 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] } });
          const finalSnap = FC.quoteSnapshot.buildSnapshot({ scope:{ selectedRooms:['room_kuchnia_gora','room_salon'], roomLabels:['Kuchnia góra','Salon'] }, commercial:{ preliminary:false, versionName:'' }, totals:{ grand:100 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] } });
          H.assert(String(prelimSnap.commercial && prelimSnap.commercial.versionName || '') === 'Wstępna oferta — Salon', 'Snapshot nie ustawił scoped nazwy dla wyceny wstępnej', prelimSnap);
          H.assert(String(finalSnap.commercial && finalSnap.commercial.versionName || '') === 'Oferta — Kuchnia góra + Salon', 'Snapshot nie ustawił scoped nazwy dla zwykłej oferty', finalSnap);
        });
      }),

    H.makeTest('Wycena', 'Store oferty zapamiętuje pola handlowe i ilości stawek dla projektu', 'Pilnuje, czy rabat, warunki oferty i ilości stawek wyceny mebli są trzymane per projekt i gotowe do zapisania w snapshotcie.', ()=>{
        H.assert(FC.quoteOfferStore && typeof FC.quoteOfferStore.saveCurrentDraft === 'function', 'Brak FC.quoteOfferStore.saveCurrentDraft');
        const prevProjectStore = FC.projectStore && typeof FC.projectStore.readAll === 'function' ? FC.projectStore.readAll() : [];
        const prevCurrentProjectId = FC.projectStore && typeof FC.projectStore.getCurrentProjectId === 'function' ? FC.projectStore.getCurrentProjectId() : '';
        const prevDrafts = FC.quoteOfferStore.readAll();
        try{
          FC.projectStore.writeAll([{ id:'proj_offer', investorId:'inv_offer', title:'Projekt oferty', projectData:{ kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{} } } }]);
          FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId('proj_offer');
          const saved = FC.quoteOfferStore.saveCurrentDraft({
            rateSelections:[{ rateId:'rate_1', qty:2 }],
            selection:{ selectedRooms:['room_kuchnia_gora'], materialScope:{ includeFronts:false, includeCorpus:true } },
            commercial:{ versionName:'Wersja A', preliminary:true, discountPercent:10, offerValidity:'14 dni', leadTime:'4 tygodnie', deliveryTerms:'Montaż w cenie', customerNote:'Oferta testowa' }
          });
          const current = FC.quoteOfferStore.getCurrentDraft();
          H.assert(saved && String(saved.projectId || '') === 'proj_offer', 'Store oferty nie zapisał draftu dla bieżącego projektu', saved);
          H.assert(Array.isArray(current.rateSelections) && current.rateSelections.length === 1 && Number(current.rateSelections[0].qty) === 2, 'Store oferty nie zachował ilości stawek', current);
          H.assert(String(current.commercial.offerValidity || '') === '14 dni' && Number(current.commercial.discountPercent) === 10 && current.commercial.preliminary === true && String(current.commercial.versionName || '') === 'Wersja A', 'Store oferty nie zachował pól handlowych, nazwy wersji albo flagi wyceny wstępnej', current);
          H.assert(Array.isArray(current.selection && current.selection.selectedRooms) && current.selection.selectedRooms[0] === 'room_kuchnia_gora', 'Store oferty nie zachował wyboru pomieszczeń', current);
          H.assert(current.selection && current.selection.materialScope && current.selection.materialScope.includeCorpus === true && current.selection.materialScope.includeFronts === false, 'Store oferty nie zachował zakresu korpusy/fronty', current);
        } finally {
          FC.quoteOfferStore.writeAll(prevDrafts);
          FC.projectStore.writeAll(prevProjectStore);
          FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId(prevCurrentProjectId);
        }
      }),

    H.makeTest('Wycena', 'Store oferty nie gubi wyboru pomieszczeń, gdy lista aktywnych pomieszczeń chwilowo zwróci pusty stan', 'Pilnuje, czy zapis wyboru pokoi w Wycena nie jest czyszczony tylko dlatego, że roomRegistry na chwilę odda pustą listę podczas normalizacji draftu.', ()=>{
        H.assert(FC.quoteOfferStore && typeof FC.quoteOfferStore.normalizeSelection === 'function', 'Brak FC.quoteOfferStore.normalizeSelection');
        H.assert(FC.wycenaCore && typeof FC.wycenaCore.normalizeQuoteSelection === 'function', 'Brak FC.wycenaCore.normalizeQuoteSelection');
        const prevRoomRegistry = FC.roomRegistry;
        try{
          FC.roomRegistry = Object.assign({}, prevRoomRegistry, {
            getActiveRoomIds(){ return []; }
          });
          const storeSelection = FC.quoteOfferStore.normalizeSelection({
            selectedRooms:['room_kuchnia_gora'],
            materialScope:{ includeFronts:true, includeCorpus:true }
          });
          H.assert(Array.isArray(storeSelection.selectedRooms) && storeSelection.selectedRooms[0] === 'room_kuchnia_gora', 'Store oferty wyczyścił zapis wyboru pomieszczeń przy pustym roomRegistry', storeSelection);
          const runtimeSelection = FC.wycenaCore.normalizeQuoteSelection({
            selectedRooms:['room_kuchnia_gora'],
            materialScope:{ includeFronts:true, includeCorpus:true }
          });
          H.assert(Array.isArray(runtimeSelection.selectedRooms) && runtimeSelection.selectedRooms[0] === 'room_kuchnia_gora', 'Wycena nie odtworzyła jawnie zapisanego wyboru pomieszczeń', runtimeSelection);
        } finally {
          FC.roomRegistry = prevRoomRegistry;
        }
      }),

    H.makeTest('Wycena', 'Draft oferty przechodzi z zakresu inwestora na projekt bez gubienia flagi wstępnej', 'Pilnuje, czy po pojawieniu się projectId draft zapisany wcześniej dla inwestora nadal jest odczytywany i nie gubi ustawień oferty.', ()=>{
        H.assert(FC.quoteOfferStore && typeof FC.quoteOfferStore.saveDraft === 'function', 'Brak FC.quoteOfferStore.saveDraft');
        const prevProjectStore = FC.projectStore && typeof FC.projectStore.readAll === 'function' ? FC.projectStore.readAll() : [];
        const prevCurrentProjectId = FC.projectStore && typeof FC.projectStore.getCurrentProjectId === 'function' ? FC.projectStore.getCurrentProjectId() : '';
        const prevDrafts = FC.quoteOfferStore.readAll();
        try{
          FC.projectStore.writeAll([{ id:'proj_scope', investorId:'inv_scope', title:'Projekt scope', projectData:{ kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{} } } }]);
          FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId('');
          FC.quoteOfferStore.saveDraft({ commercial:{ preliminary:true, offerValidity:'7 dni' } }, { investorId:'inv_scope' });
          FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId('proj_scope');
          const current = FC.quoteOfferStore.getCurrentDraft();
          H.assert(current && current.commercial && current.commercial.preliminary === true && String(current.commercial.offerValidity || '') === '7 dni', 'Draft oferty zniknął po przejściu z zakresu inwestora na projekt', current);
        } finally {
          FC.quoteOfferStore.writeAll(prevDrafts);
          FC.projectStore.writeAll(prevProjectStore);
          FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId(prevCurrentProjectId);
        }
      }),

    H.makeTest('Wycena', 'Snapshot wyceny zapisuje stawki meblowe i pola handlowe wraz z podsumowaniem po rabacie', 'Pilnuje, czy zapisany snapshot oferty jest już dokumentem handlowym: ma robociznę, rabat i końcową sumę z jednej wersji danych.', ()=>{
        H.assert(FC.quoteSnapshot && typeof FC.quoteSnapshot.buildSnapshot === 'function', 'Brak FC.quoteSnapshot.buildSnapshot');
        const snapshot = FC.quoteSnapshot.buildSnapshot({
          selectedRooms:['room_kuchnia_gora'],
          roomLabels:['Kuchnia góra'],
          materialScope:{ includeFronts:false, includeCorpus:true },
          materialLines:[{ name:'Egger W1100 ST9 Biały Alpejski', qty:2, unit:'ark.', unitPrice:35, total:70 }],
          accessoryLines:[{ name:'Zawias Blum', qty:4, unitPrice:18, total:72 }],
          agdLines:[{ name:'Piekarnik do zabudowy', qty:1, unitPrice:120, total:120 }],
          quoteRateLines:[{ name:'Montaż zabudowy', category:'Montaż', qty:1, unit:'x', unitPrice:400, total:400 }],
          commercial:{ versionName:'Wersja B', preliminary:true, discountPercent:10, offerValidity:'14 dni', leadTime:'4 tygodnie', deliveryTerms:'Transport po stronie wykonawcy', customerNote:'Oferta testowa' },
          generatedAt:1712500000000,
        });
        H.assert(snapshot && snapshot.lines && Array.isArray(snapshot.lines.quoteRates) && snapshot.lines.quoteRates.length === 1, 'Snapshot wyceny nie zachował linii robocizny / stawek meblowych', snapshot);
        H.assert(snapshot.commercial && String(snapshot.commercial.offerValidity || '') === '14 dni' && snapshot.commercial.preliminary === true && snapshot.meta.preliminary === true && String(snapshot.commercial.versionName || '') === 'Wersja B', 'Snapshot wyceny nie zachował pól handlowych, nazwy wersji albo flagi wyceny wstępnej', snapshot);
        H.assert(snapshot.scope && snapshot.scope.materialScopeMode === 'corpus', 'Snapshot wyceny nie zapisał trybu zakresu elementów', snapshot.scope);
        H.assert(Math.abs(Number(snapshot.totals.subtotal || 0) - 662) < 0.001, 'Snapshot wyceny nie policzył sumy przed rabatem', snapshot.totals);
        H.assert(Math.abs(Number(snapshot.totals.discount || 0) - 66.2) < 0.001, 'Snapshot wyceny nie policzył rabatu', snapshot.totals);
        H.assert(Math.abs(Number(snapshot.totals.grand || 0) - 595.8) < 0.001, 'Snapshot wyceny nie policzył końcowej wartości oferty', snapshot.totals);
      }),

    H.makeTest('Wycena', 'Store snapshotów wyceny zapisuje historię dla projektu', 'Pilnuje, czy wycena ma już własny magazyn snapshotów powiązanych z projektem, gotowy pod późniejszy PDF i historię wycen.', ()=>{
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.save === 'function', 'Brak FC.quoteSnapshotStore.save');
        const prev = FC.quoteSnapshotStore.readAll();
        try{
          FC.quoteSnapshotStore.writeAll([]);
          const saved = FC.quoteSnapshotStore.save({
            investor:{ id:'inv_hist', name:'Jan Test' },
            project:{ id:'proj_hist', investorId:'inv_hist', title:'Projekt testowy' },
            lines:{ materials:[{ name:'Płyta test', total:100 }], accessories:[], agdServices:[], quoteRates:[{ name:'Montaż test', total:50 }] },
            commercial:{ offerValidity:'14 dni' },
            totals:{ materials:100, accessories:0, services:0, quoteRates:50, subtotal:150, discount:0, grand:150 },
            generatedAt:1712600000000,
          });
          const latest = FC.quoteSnapshotStore.getLatestForProject('proj_hist');
          H.assert(saved && saved.id, 'Store snapshotów nie zwrócił zapisanego rekordu', saved);
          H.assert(latest && String(latest.id || '') === String(saved.id || ''), 'Store snapshotów nie zwrócił najnowszego snapshotu dla projektu', { saved, latest, all:FC.quoteSnapshotStore.readAll() });
          H.assert(Array.isArray(latest.lines.quoteRates) && latest.lines.quoteRates.length === 1, 'Store snapshotów zgubił linie robocizny', latest);
        } finally {
          FC.quoteSnapshotStore.writeAll(prev);
        }
      }),

    H.makeTest('Wycena', 'Historia wycen pozwala oznaczyć zaakceptowaną ofertę i usuwać snapshoty', 'Pilnuje, czy magazyn snapshotów potrafi oznaczyć jedną ofertę jako zaakceptowaną i usuwać konkretne wersje z historii.', ()=>{
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.markSelectedForProject === 'function', 'Brak FC.quoteSnapshotStore.markSelectedForProject');
        H.assert(typeof FC.quoteSnapshotStore.remove === 'function', 'Brak FC.quoteSnapshotStore.remove');
        const prev = FC.quoteSnapshotStore.readAll();
        try{
          FC.quoteSnapshotStore.writeAll([]);
          const a = FC.quoteSnapshotStore.save({ investor:{ id:'inv_sel' }, project:{ id:'proj_sel', investorId:'inv_sel', title:'Projekt A' }, totals:{ materials:100, accessories:0, services:0, quoteRates:0, subtotal:100, discount:0, grand:100 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712800000000 });
          const b = FC.quoteSnapshotStore.save({ investor:{ id:'inv_sel' }, project:{ id:'proj_sel', investorId:'inv_sel', title:'Projekt A' }, totals:{ materials:120, accessories:0, services:0, quoteRates:0, subtotal:120, discount:0, grand:120 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712800100000 });
          const marked = FC.quoteSnapshotStore.markSelectedForProject('proj_sel', a.id);
          const selected = FC.quoteSnapshotStore.getSelectedForProject('proj_sel');
          H.assert(marked && String(marked.id || '') === String(a.id || ''), 'Store nie zwrócił oznaczonego snapshotu', { marked, a, b });
          H.assert(selected && String(selected.id || '') === String(a.id || ''), 'Store nie oznaczył właściwej oferty jako zaakceptowanej', { selected, all:FC.quoteSnapshotStore.listForProject('proj_sel') });
          H.assert(FC.quoteSnapshotStore.remove(b.id) === true, 'Store nie usunął snapshotu z historii', { a, b, all:FC.quoteSnapshotStore.readAll() });
          H.assert(FC.quoteSnapshotStore.getById(b.id) == null, 'Usunięty snapshot nadal istnieje w historii', FC.quoteSnapshotStore.readAll());
        } finally {
          FC.quoteSnapshotStore.writeAll(prev);
        }
      }),

    H.makeTest('Wycena', 'Podgląd oferty pokazuje akcję akceptacji tylko dla wersji, które wolno zaakceptować', 'Pilnuje, czy nowy przycisk pod podsumowaniem korzysta z tej samej kwalifikacji co historia: znika dla zaakceptowanej albo odrzuconej oferty.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.canAcceptSnapshot === 'function', 'Brak helpera FC.wycenaTabDebug.canAcceptSnapshot', FC.wycenaTabDebug);
        const prev = FC.quoteSnapshotStore.readAll();
        try{
          FC.quoteSnapshotStore.writeAll([]);
          const active = FC.quoteSnapshotStore.save({ investor:{ id:'inv_accept' }, project:{ id:'proj_accept', investorId:'inv_accept', title:'Projekt accept' }, commercial:{ preliminary:true }, scope:{ selectedRooms:['room_a'], roomLabels:['Kuchnia A'] }, totals:{ grand:100 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712800200000 });
          H.assert(FC.wycenaTabDebug.canAcceptSnapshot(active) === true, 'Aktywna niezaakceptowana oferta nie kwalifikuje się do przycisku akceptacji', active);
          const selected = FC.quoteSnapshotStore.markSelectedForProject('proj_accept', active.id, { status:'pomiar' });
          H.assert(FC.wycenaTabDebug.canAcceptSnapshot(selected) === false, 'Zaakceptowana oferta nadal kwalifikuje się do przycisku akceptacji', selected);
          const rejected = FC.quoteSnapshotStore.save({ investor:{ id:'inv_accept' }, project:{ id:'proj_accept', investorId:'inv_accept', title:'Projekt accept' }, commercial:{ preliminary:true }, scope:{ selectedRooms:['room_a'], roomLabels:['Kuchnia A'] }, meta:{ rejectedAt:1712800300000, rejectedReason:'scope_changed' }, totals:{ grand:120 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712800300000 });
          H.assert(FC.wycenaTabDebug.canAcceptSnapshot(rejected) === false, 'Odrzucona oferta nadal kwalifikuje się do przycisku akceptacji', rejected);
        } finally {
          FC.quoteSnapshotStore.writeAll(prev);
        }
      })
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
