(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  const H = FC.testHarness;
  if(!H) throw new Error('Brak FC.testHarness');

  function runAll(){
    return H.runSuite('WYCENA smoke testy', [
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

      H.makeTest('Wycena', 'Domyślne nazwy wersji ustawiają się jako Oferta i Wstępna oferta', 'Pilnuje, czy puste nazwy wersji nie zapisują się jako pusty string i dostają domyślne etykiety zgodne z typem oferty.', ()=>{
        H.assert(FC.quoteOfferStore && typeof FC.quoteOfferStore.normalizeCommercial === 'function', 'Brak FC.quoteOfferStore.normalizeCommercial');
        H.assert(FC.quoteSnapshot && typeof FC.quoteSnapshot.buildSnapshot === 'function', 'Brak FC.quoteSnapshot.buildSnapshot');
        const prelimDraft = FC.quoteOfferStore.normalizeCommercial({ preliminary:true, versionName:'' });
        const finalDraft = FC.quoteOfferStore.normalizeCommercial({ preliminary:false, versionName:'' });
        H.assert(String(prelimDraft.versionName || '') === 'Wstępna oferta', 'Domyślna nazwa wstępnej oferty jest błędna', prelimDraft);
        H.assert(String(finalDraft.versionName || '') === 'Oferta', 'Domyślna nazwa zwykłej oferty jest błędna', finalDraft);
        const prelimSnap = FC.quoteSnapshot.buildSnapshot({ commercial:{ preliminary:true, versionName:'' }, totals:{ grand:100 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] } });
        const finalSnap = FC.quoteSnapshot.buildSnapshot({ commercial:{ preliminary:false, versionName:'' }, totals:{ grand:100 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] } });
        H.assert(String(prelimSnap.commercial && prelimSnap.commercial.versionName || '') === 'Wstępna oferta', 'Snapshot nie ustawił domyślnej nazwy dla wyceny wstępnej', prelimSnap);
        H.assert(String(finalSnap.commercial && finalSnap.commercial.versionName || '') === 'Oferta', 'Snapshot nie ustawił domyślnej nazwy dla zwykłej oferty', finalSnap);
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

      H.makeTest('Wycena', 'Status projektu synchronizuje zaakceptowaną ofertę w obie strony', 'Pilnuje, czy zaakceptowanie wyceny wstępnej daje etap pomiaru, a ręczna zmiana statusu projektu czyści lub przywraca właściwy stan ofert.', ()=>{
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.markSelectedForProject === 'function', 'Brak FC.quoteSnapshotStore.markSelectedForProject');
        H.assert(typeof FC.quoteSnapshotStore.syncSelectionForProjectStatus === 'function', 'Brak FC.quoteSnapshotStore.syncSelectionForProjectStatus');
        const prev = FC.quoteSnapshotStore.readAll();
        try{
          FC.quoteSnapshotStore.writeAll([]);
          const prelim = FC.quoteSnapshotStore.save({ investor:{ id:'inv_flow' }, project:{ id:'proj_flow', investorId:'inv_flow', title:'Projekt flow' }, commercial:{ preliminary:true }, totals:{ materials:100, accessories:0, services:0, quoteRates:0, subtotal:100, discount:0, grand:100 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712810000000 });
          const finalQuote = FC.quoteSnapshotStore.save({ investor:{ id:'inv_flow' }, project:{ id:'proj_flow', investorId:'inv_flow', title:'Projekt flow' }, totals:{ materials:150, accessories:0, services:0, quoteRates:0, subtotal:150, discount:0, grand:150 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712810100000 });
          const acceptedPrelim = FC.quoteSnapshotStore.markSelectedForProject('proj_flow', prelim.id, { status:'pomiar' });
          H.assert(acceptedPrelim && acceptedPrelim.meta && acceptedPrelim.meta.selectedByClient === true && acceptedPrelim.meta.acceptedStage === 'pomiar', 'Akceptacja wyceny wstępnej nie ustawiła etapu pomiaru', acceptedPrelim);
          FC.quoteSnapshotStore.syncSelectionForProjectStatus('proj_flow', 'wycena');
          H.assert(FC.quoteSnapshotStore.getSelectedForProject('proj_flow') == null, 'Przejście projektu na etap wyceny nie wyczyściło zaakceptowanej wyceny wstępnej', FC.quoteSnapshotStore.listForProject('proj_flow'));
          const syncedFinal = FC.quoteSnapshotStore.syncSelectionForProjectStatus('proj_flow', 'zaakceptowany');
          H.assert(syncedFinal && String(syncedFinal.id || '') === String(finalQuote.id || '') , 'Status zaakceptowany nie wskazał właściwej wyceny po pomiarze', { syncedFinal, all:FC.quoteSnapshotStore.listForProject('proj_flow') });
          H.assert(FC.quoteSnapshotStore.getRecommendedStatusForProject('proj_flow', 'zaakceptowany') === 'zaakceptowany', 'Rekomendowany status po zaakceptowanej finalnej ofercie jest błędny', FC.quoteSnapshotStore.listForProject('proj_flow'));
          FC.quoteSnapshotStore.remove(finalQuote.id);
          H.assert(FC.quoteSnapshotStore.getRecommendedStatusForProject('proj_flow', 'zaakceptowany') === 'wstepna_wycena', 'Po usunięciu zwykłej oferty status nie wrócił do wstępnej wyceny', FC.quoteSnapshotStore.listForProject('proj_flow'));
        } finally {
          FC.quoteSnapshotStore.writeAll(prev);
        }
      }),

      H.makeTest('Wycena', 'Akceptacja końcowa potrafi przekonwertować zaakceptowaną wycenę wstępną na zwykłą ofertę', 'Pilnuje, czy przycisk konwersji nie tworzy obcej wersji, tylko zamienia tę samą wstępną ofertę w zwykłą końcową z etapem zaakceptowanym.', ()=>{
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.convertPreliminaryToFinal === 'function', 'Brak FC.quoteSnapshotStore.convertPreliminaryToFinal');
        const prev = FC.quoteSnapshotStore.readAll();
        try{
          FC.quoteSnapshotStore.writeAll([]);
          const prelim = FC.quoteSnapshotStore.save({ id:'snap_convert_prelim', investor:{ id:'inv_convert' }, project:{ id:'proj_convert', investorId:'inv_convert', title:'Projekt convert' }, commercial:{ preliminary:true, versionName:'Wstępna oferta' }, meta:{ selectedByClient:true, acceptedAt:1712810300000, acceptedStage:'pomiar' }, totals:{ materials:210, accessories:0, services:0, quoteRates:0, subtotal:210, discount:0, grand:210 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712810300000 });
          const converted = FC.quoteSnapshotStore.convertPreliminaryToFinal('proj_convert', prelim.id);
          H.assert(converted && String(converted.id || '') === String(prelim.id || ''), 'Konwersja nie zwróciła tej samej oferty', { prelim, converted });
          H.assert(converted && converted.commercial && converted.commercial.preliminary === false, 'Konwersja nie zdjęła flagi wstępnej z oferty handlowej', converted);
          H.assert(converted && converted.meta && converted.meta.preliminary === false && converted.meta.selectedByClient === true && String(converted.meta.acceptedStage || '') === 'zaakceptowany', 'Konwersja nie ustawiła końcowego stanu zaakceptowania', converted);
          H.assert(String(converted.commercial && converted.commercial.versionName || '') === 'Oferta', 'Konwersja nie podmieniła domyślnej nazwy na zwykłą ofertę', converted);
        } finally {
          FC.quoteSnapshotStore.writeAll(prev);
        }
      }),

      H.makeTest('Wycena', 'Zaakceptowana zwykła oferta wygasza wszystkie wyceny wstępne niezależnie od kolejności', 'Pilnuje, czy po akceptacji końcowej wyceny wstępne nie zostają aktywne tylko dlatego, że są wyżej na liście niż zaakceptowana zwykła oferta.', ()=>{
        const preliminary = (snap)=> !!(snap && snap.meta && snap.meta.preliminary);
        const archive = (snap, list)=> !!(preliminary(snap) && list.some((row)=> !preliminary(row) && row && row.meta && row.meta.selectedByClient));
        const prev = FC.quoteSnapshotStore.readAll();
        try{
          FC.quoteSnapshotStore.writeAll([]);
          const olderFinal = FC.quoteSnapshotStore.save({ id:'snap_arch_sel_final', investor:{ id:'inv_arch_sel' }, project:{ id:'proj_arch_sel', investorId:'inv_arch_sel', title:'Projekt arch sel' }, totals:{ materials:150, accessories:0, services:0, quoteRates:0, subtotal:150, discount:0, grand:150 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712810000000 });
          const newerPrelim = FC.quoteSnapshotStore.save({ id:'snap_arch_sel_prelim', investor:{ id:'inv_arch_sel' }, project:{ id:'proj_arch_sel', investorId:'inv_arch_sel', title:'Projekt arch sel' }, commercial:{ preliminary:true }, totals:{ materials:100, accessories:0, services:0, quoteRates:0, subtotal:100, discount:0, grand:100 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712810100000 });
          FC.quoteSnapshotStore.markSelectedForProject('proj_arch_sel', olderFinal.id, { status:'zaakceptowany' });
          const list = FC.quoteSnapshotStore.listForProject('proj_arch_sel');
          H.assert(archive(newerPrelim, list) === true, 'Po zaakceptowaniu zwykłej oferty nowsza wycena wstępna nie została wygaszona', list);
        } finally {
          FC.quoteSnapshotStore.writeAll(prev);
        }
      }),

      H.makeTest('Wycena', 'Wycena po pomiarze nie wygasza nowszej wyceny wstępnej i oznacza starszą po pojawieniu się nowej zwykłej wyceny', 'Pilnuje, czy historia ofert nie chowa świeżo zapisanej wyceny wstępnej przez starszą zwykłą wycenę, a wygasza tylko starsze wersje wstępne po pojawieniu się nowej normalnej wyceny.', ()=>{
        const preliminary = (snap)=> !!(snap && snap.meta && snap.meta.preliminary);
        const archive = (snap, list)=> !!(preliminary(snap) && list.some((row)=> !preliminary(row) && Number(row && row.generatedAt || 0) > Number(snap && snap.generatedAt || 0)));
        const prev = FC.quoteSnapshotStore.readAll();
        try{
          FC.quoteSnapshotStore.writeAll([]);
          const olderFinal = FC.quoteSnapshotStore.save({ investor:{ id:'inv_arch' }, project:{ id:'proj_arch', investorId:'inv_arch', title:'Projekt arch' }, totals:{ materials:150, accessories:0, services:0, quoteRates:0, subtotal:150, discount:0, grand:150 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712810000000 });
          const newerPrelim = FC.quoteSnapshotStore.save({ investor:{ id:'inv_arch' }, project:{ id:'proj_arch', investorId:'inv_arch', title:'Projekt arch' }, commercial:{ preliminary:true }, totals:{ materials:100, accessories:0, services:0, quoteRates:0, subtotal:100, discount:0, grand:100 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712810100000 });
          let list = FC.quoteSnapshotStore.listForProject('proj_arch');
          H.assert(archive(newerPrelim, list) === false, 'Nowsza wycena wstępna została błędnie wygaszona przez starszą zwykłą wycenę', list);
          const newestFinal = FC.quoteSnapshotStore.save({ investor:{ id:'inv_arch' }, project:{ id:'proj_arch', investorId:'inv_arch', title:'Projekt arch' }, totals:{ materials:170, accessories:0, services:0, quoteRates:0, subtotal:170, discount:0, grand:170 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712810200000 });
          list = FC.quoteSnapshotStore.listForProject('proj_arch');
          H.assert(archive(newerPrelim, list) === true, 'Starsza wycena wstępna nie została wygaszona po pojawieniu się nowszej zwykłej wyceny', list);
          H.assert(archive(newestFinal, list) === false && archive(olderFinal, list) === false, 'Zwykłe wyceny nie powinny być wygaszane przez ten mechanizm', list);
        } finally {
          FC.quoteSnapshotStore.writeAll(prev);
        }
      }),
      H.makeTest('Wycena', 'PDF wyceny buduje ofertę handlową z zapisanym snapshotem', 'Pilnuje, czy dokument dla klienta korzysta z quoteSnapshot, zawiera robociznę, warunki oferty i końcową sumę z rabatem.', ()=>{
        H.assert(FC.quotePdf && typeof FC.quotePdf.buildPrintHtml === 'function', 'Brak FC.quotePdf.buildPrintHtml');
        const html = FC.quotePdf.buildPrintHtml({
          investor:{ id:'inv_pdf', name:'Jan Test' },
          project:{ id:'proj_pdf', investorId:'inv_pdf', title:'Kuchnia testowa', status:'wycena ostateczna' },
          scope:{ roomLabels:['Kuchnia dół'], materialScopeMode:'corpus', materialScope:{ includeFronts:false, includeCorpus:true } },
          lines:{
            materials:[{ name:'Egger W1100 ST9 Biały Alpejski', qty:2, unit:'ark.', unitPrice:35, total:70 }],
            accessories:[{ name:'Zawias Blum', qty:4, unitPrice:18, total:72 }],
            agdServices:[{ name:'Piekarnik do zabudowy', qty:1, unitPrice:120, total:120 }],
            quoteRates:[{ name:'Montaż zabudowy', qty:1, unit:'x', unitPrice:400, total:400, category:'Montaż' }],
          },
          commercial:{ versionName:'Wersja PDF A', discountPercent:10, offerValidity:'14 dni', leadTime:'4 tygodnie', deliveryTerms:'Montaż w cenie', customerNote:'Oferta testowa' },
          totals:{ materials:70, accessories:72, services:120, quoteRates:400, subtotal:662, discount:66.2, grand:595.8 },
          generatedAt:1712700000000,
        });
        H.assert(/Oferta dla klienta/.test(String(html || '')), 'PDF wyceny nie zawiera nagłówka dokumentu handlowego', html);
        H.assert(/Montaż zabudowy/.test(String(html || '')), 'PDF wyceny nie zawiera pozycji robocizny', html);
        H.assert(/Warunki oferty/.test(String(html || '')) && /14 dni/.test(String(html || '')) && /4 tygodnie/.test(String(html || '')), 'PDF wyceny nie zawiera pól handlowych', html);
        H.assert(/Wersja PDF A/.test(String(html || '')) && /Same korpusy/.test(String(html || '')), 'PDF wyceny nie zawiera nazwy wersji albo zakresu elementów', html);
        H.assert(/595\.80 PLN/.test(String(html || '')), 'PDF wyceny nie zawiera końcowej sumy po rabacie', html);
      }),
    ]);
  }

  FC.wycenaDevTests = { runAll };
})(typeof window !== 'undefined' ? window : globalThis);
