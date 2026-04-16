(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  const H = FC.testHarness;
  if(!H) throw new Error('Brak FC.testHarness');

  function clone(value){
    try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; }
  }

  function withInvestorProjectFixture(options, run){
    const cfg = options && typeof options === 'object' ? options : {};
    const prevInvestors = FC.investors && typeof FC.investors.readAll === 'function' ? FC.investors.readAll() : [];
    const prevCurrentInvestorId = FC.investors && typeof FC.investors.getCurrentId === 'function' ? FC.investors.getCurrentId() : '';
    const prevProjects = FC.projectStore && typeof FC.projectStore.readAll === 'function' ? FC.projectStore.readAll() : [];
    const prevCurrentProjectId = FC.projectStore && typeof FC.projectStore.getCurrentProjectId === 'function' ? FC.projectStore.getCurrentProjectId() : '';
    const prevSnapshots = FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.readAll === 'function' ? FC.quoteSnapshotStore.readAll() : [];
    const prevDrafts = FC.quoteOfferStore && typeof FC.quoteOfferStore.readAll === 'function' ? FC.quoteOfferStore.readAll() : [];
    const prevOverride = FC.rozrys && FC.rozrys.__projectOverride;
    const prevProjectData = Object.prototype.hasOwnProperty.call(host, 'projectData') ? host.projectData : undefined;
    const prevCutList = FC.cabinetCutlist && FC.cabinetCutlist.getCabinetCutList;
    const investorId = String(cfg.investorId || 'inv_cross');
    const projectId = String(cfg.projectId || 'proj_cross');
    const rooms = Array.isArray(cfg.rooms) ? clone(cfg.rooms) : [
      { id:'room_kuchnia_gora', baseType:'kuchnia', name:'Kuchnia góra', label:'Kuchnia góra', projectStatus:'nowy' },
      { id:'room_salon', baseType:'pokoj', name:'Salon', label:'Salon', projectStatus:'nowy' },
    ];
    const projectData = clone(cfg.projectData || {
      schemaVersion: 2,
      meta: {
        roomDefs: rooms.reduce((acc, room)=>{
          acc[room.id] = { id:room.id, baseType:room.baseType, name:room.name, label:room.label };
          return acc;
        }, {}),
        roomOrder: rooms.map((room)=> room.id),
      },
      room_kuchnia_gora: { cabinets:[{ id:'cab_k' }], fronts:[], sets:[], settings:{} },
      room_salon: { cabinets:[{ id:'cab_s' }], fronts:[], sets:[], settings:{} },
    });
    const investor = Object.assign({ id:investorId, kind:'person', name:'Jan Test', rooms:clone(rooms), meta:{} }, clone(cfg.investor || {}), { id:investorId, rooms:clone(rooms) });
    const projectRecord = Object.assign({ id:projectId, investorId, title:'Projekt testowy', status:String(cfg.status || 'nowy'), projectData:clone(projectData), meta:{} }, clone(cfg.projectRecord || {}), { id:projectId, investorId, projectData:clone(projectData) });
    const cleanup = ()=>{
      if(FC.cabinetCutlist && prevCutList) FC.cabinetCutlist.getCabinetCutList = prevCutList;
      if(FC.rozrys) FC.rozrys.__projectOverride = prevOverride;
      if(prevProjectData === undefined) { try{ delete host.projectData; }catch(_){ host.projectData = undefined; } }
      else host.projectData = prevProjectData;
      FC.quoteOfferStore && FC.quoteOfferStore.writeAll && FC.quoteOfferStore.writeAll(prevDrafts);
      FC.quoteSnapshotStore && FC.quoteSnapshotStore.writeAll && FC.quoteSnapshotStore.writeAll(prevSnapshots);
      FC.projectStore && FC.projectStore.writeAll && FC.projectStore.writeAll(prevProjects);
      FC.projectStore && FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId(prevCurrentProjectId);
      FC.investors && FC.investors.writeAll && FC.investors.writeAll(prevInvestors);
      FC.investors && FC.investors.setCurrentId && FC.investors.setCurrentId(prevCurrentInvestorId);
    };
    try{
      FC.investors && FC.investors.writeAll && FC.investors.writeAll([investor]);
      FC.investors && FC.investors.setCurrentId && FC.investors.setCurrentId(investorId);
      FC.projectStore && FC.projectStore.writeAll && FC.projectStore.writeAll([projectRecord]);
      FC.projectStore && FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId(projectId);
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.writeAll === 'function') FC.quoteSnapshotStore.writeAll([]);
      if(FC.quoteOfferStore && typeof FC.quoteOfferStore.writeAll === 'function') FC.quoteOfferStore.writeAll([]);
      host.projectData = clone(projectData);
      if(FC.rozrys) FC.rozrys.__projectOverride = host.projectData;
      if(typeof cfg.cutListFn === 'function' && FC.cabinetCutlist){
        FC.cabinetCutlist.getCabinetCutList = cfg.cutListFn;
      }
      const result = run({ investorId, projectId, rooms:clone(rooms), projectData:host.projectData });
      if(result && typeof result.then === 'function') return result.finally(cleanup);
      cleanup();
      return result;
    } catch(err) {
      cleanup();
      throw err;
    }
  }

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
      }),


      H.makeTest('Wycena', 'Usunięcie ostatniej wyceny wstępnej przywraca status nowy', 'Pilnuje, czy po skasowaniu ostatniej wstępnej oferty pokój nie zostaje sztucznie na etapie wstępnej wyceny.', ()=> withInvestorProjectFixture({
        investorId:'inv_delete_prelim',
        projectId:'proj_delete_prelim',
        rooms:[{ id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'wstepna_wycena' }],
        status:'wstepna_wycena',
        projectData:{
          schemaVersion:2,
          meta:{
            projectStatus:'wstepna_wycena',
            roomDefs:{ room_a:{ id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'wstepna_wycena' } },
            roomOrder:['room_a'],
          },
          room_a:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} },
        }
      }, ({ investorId, projectId })=>{
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.reconcileProjectStatuses === 'function', 'Brak FC.projectStatusSync.reconcileProjectStatuses');
        FC.quoteSnapshotStore.writeAll([]);
        const prelim = FC.quoteSnapshotStore.save({
          investor:{ id:investorId, name:'Jan Test' },
          project:{ id:projectId, investorId, status:'wstepna_wycena' },
          scope:{ selectedRooms:['room_a'], roomLabels:['Kuchnia A'] },
          commercial:{ preliminary:true, versionName:'Wstępna oferta' },
          meta:{ preliminary:true, versionName:'Wstępna oferta' },
          lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
          totals:{ materials:0, accessories:0, services:0, quoteRates:0, subtotal:0, discount:0, grand:0 },
          generatedAt:1712815000000,
        });
        H.assert(FC.quoteSnapshotStore.remove(prelim.id) === true, 'Nie udało się usunąć ostatniej wyceny wstępnej', prelim);
        const result = FC.projectStatusSync.reconcileProjectStatuses({ projectId, investorId, fallbackStatus:'nowy', refreshUi:false });
        const investor = FC.investors.getById(investorId);
        const project = FC.projectStore.getById(projectId);
        H.assert(result && String(result.aggregateStatus || '') === 'nowy', 'Rekonsyliacja po usunięciu ostatniej wyceny nie zwróciła statusu nowy', result);
        H.assert(investor && investor.rooms && String(investor.rooms[0].projectStatus || '') === 'nowy', 'Pokój nadal wisi na wstępnej wycenie po usunięciu wszystkich ofert wstępnych', investor);
        H.assert(project && String(project.status || '') === 'nowy', 'Projekt nadal wisi na wstępnej wycenie po usunięciu wszystkich ofert wstępnych', project);
      })),

      H.makeTest('Wycena', 'Rekonsyliacja po usunięciu scope A+B nie zeruje solo A', 'Pilnuje, czy po skasowaniu wspólnej wyceny dla A+B system nadal zachowuje solo A zamiast zrzucać oba pokoje do nowego.', ()=> withInvestorProjectFixture({
        investorId:'inv_scope_delete',
        projectId:'proj_scope_delete',
        rooms:[
          { id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'wstepna_wycena' },
          { id:'room_b', baseType:'pokoj', name:'Pokój B', label:'Pokój B', projectStatus:'wstepna_wycena' },
        ],
        status:'wstepna_wycena',
        projectData:{
          schemaVersion:2,
          meta:{
            projectStatus:'wstepna_wycena',
            roomDefs:{
              room_a:{ id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'wstepna_wycena' },
              room_b:{ id:'room_b', baseType:'pokoj', name:'Pokój B', label:'Pokój B', projectStatus:'wstepna_wycena' },
            },
            roomOrder:['room_a','room_b'],
          },
          room_a:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} },
          room_b:{ cabinets:[{ id:'cab_b' }], fronts:[], sets:[], settings:{} },
        }
      }, ({ investorId, projectId })=>{
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.reconcileProjectStatuses === 'function', 'Brak FC.projectStatusSync.reconcileProjectStatuses');
        FC.quoteSnapshotStore.writeAll([]);
        FC.quoteSnapshotStore.save({
          id:'snap_scope_solo_a',
          investor:{ id:investorId, name:'Jan Test' },
          project:{ id:projectId, investorId, status:'wstepna_wycena' },
          scope:{ selectedRooms:['room_a'], roomLabels:['Kuchnia A'] },
          commercial:{ preliminary:true, versionName:'Wstępna oferta' },
          meta:{ preliminary:true, versionName:'Wstępna oferta' },
          lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
          totals:{ materials:0, accessories:0, services:0, quoteRates:0, subtotal:0, discount:0, grand:0 },
          generatedAt:1712816000000,
        });
        FC.quoteSnapshotStore.save({
          id:'snap_scope_ab',
          investor:{ id:investorId, name:'Jan Test' },
          project:{ id:projectId, investorId, status:'wstepna_wycena' },
          scope:{ selectedRooms:['room_a','room_b'], roomLabels:['Kuchnia A','Pokój B'] },
          commercial:{ preliminary:true, versionName:'Wstępna oferta wariant 2' },
          meta:{ preliminary:true, versionName:'Wstępna oferta wariant 2' },
          lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
          totals:{ materials:0, accessories:0, services:0, quoteRates:0, subtotal:0, discount:0, grand:0 },
          generatedAt:1712816100000,
        });
        H.assert(FC.quoteSnapshotStore.remove('snap_scope_ab') === true, 'Nie udało się usunąć scope A+B', FC.quoteSnapshotStore.readAll());
        const result = FC.projectStatusSync.reconcileProjectStatuses({ projectId, investorId, fallbackStatus:'nowy', refreshUi:false });
        const investor = FC.investors.getById(investorId);
        const roomA = investor && investor.rooms && investor.rooms.find((room)=> String(room && room.id || '') === 'room_a');
        const roomB = investor && investor.rooms && investor.rooms.find((room)=> String(room && room.id || '') === 'room_b');
        H.assert(result && String(result.roomStatusMap && result.roomStatusMap.room_a || '') === 'wstepna_wycena', 'Solo A zniknęło po usunięciu wspólnej wyceny A+B', result);
        H.assert(result && String(result.roomStatusMap && result.roomStatusMap.room_b || '') === 'nowy', 'Pokój B nie wrócił do nowego po usunięciu wspólnej wyceny A+B', result);
        H.assert(roomA && String(roomA.projectStatus || '') === 'wstepna_wycena', 'Status pokoju A nie zachował solo wyceny wstępnej', investor);
        H.assert(roomB && String(roomB.projectStatus || '') === 'nowy', 'Status pokoju B nie wrócił do nowego po skasowaniu scope A+B', investor);
      })),


      H.makeTest('Wycena ↔ Centralny status', 'Rekonsyliacja bez jawnego scope nie skleja wszystkich pokoi inwestora w jeden projekt', 'Pilnuje regułę mini-paczki 1: przy wielu pokojach brak jawnego scope nie może zmusić projectStore.status do agregacji po całym inwestorze.', ()=> withInvestorProjectFixture({
        investorId:'inv_scope_guard',
        projectId:'proj_scope_guard',
        rooms:[
          { id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'wstepna_wycena' },
          { id:'room_b', baseType:'pokoj', name:'Pokój B', label:'Pokój B', projectStatus:'nowy' },
        ],
        status:'nowy',
        projectData:{
          schemaVersion:2,
          meta:{
            projectStatus:'nowy',
            roomDefs:{
              room_a:{ id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'wstepna_wycena' },
              room_b:{ id:'room_b', baseType:'pokoj', name:'Pokój B', label:'Pokój B', projectStatus:'nowy' },
            },
            roomOrder:['room_a','room_b'],
          },
          room_a:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} },
          room_b:{ cabinets:[{ id:'cab_b' }], fronts:[], sets:[], settings:{} },
        }
      }, ({ investorId, projectId })=>{
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.reconcileProjectStatuses === 'function', 'Brak FC.projectStatusSync.reconcileProjectStatuses');
        FC.quoteSnapshotStore.writeAll([]);
        FC.quoteSnapshotStore.save({
          id:'snap_scope_guard_a',
          investor:{ id:investorId, name:'Jan Test' },
          project:{ id:projectId, investorId, status:'wstepna_wycena' },
          scope:{ selectedRooms:['room_a'], roomLabels:['Kuchnia A'] },
          commercial:{ preliminary:true, versionName:'Wstępna oferta A' },
          meta:{ preliminary:true, versionName:'Wstępna oferta A' },
          lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
          totals:{ materials:0, accessories:0, services:0, quoteRates:0, subtotal:0, discount:0, grand:0 },
          generatedAt:1712816200000,
        });
        const result = FC.projectStatusSync.reconcileProjectStatuses({ projectId, investorId, fallbackStatus:'nowy', refreshUi:false });
        const investor = FC.investors.getById(investorId);
        const project = FC.projectStore.getById(projectId);
        const roomA = investor && investor.rooms && investor.rooms.find((room)=> String(room && room.id || '') === 'room_a');
        const roomB = investor && investor.rooms && investor.rooms.find((room)=> String(room && room.id || '') === 'room_b');
        H.assert(result && String(result.roomStatusMap && result.roomStatusMap.room_a || '') === 'wstepna_wycena', 'Rekonsyliacja zgubiła scoped status pokoju A', result);
        H.assert(result && String(result.roomStatusMap && result.roomStatusMap.room_b || '') === 'nowy', 'Rekonsyliacja zgubiła scoped status pokoju B', result);
        H.assert(result && String(result.aggregateStatus || '') === 'nowy', 'Brak jawnego scope nadal zlepił status projektu z całego inwestora', result);
        H.assert(result && String(result.masterStatus || '') === 'nowy', 'Centralny sync nie zwrócił masterStatus zgodnego z wynikiem scoped', result);
        H.assert(result && String(result.mirrorStatus || '') === 'nowy', 'Centralny sync nie zwrócił mirrorStatus zgodnego z masterem', result);
        H.assert(roomA && String(roomA.projectStatus || '') === 'wstepna_wycena', 'Pokój A nie zachował własnego statusu scoped', investor);
        H.assert(roomB && String(roomB.projectStatus || '') === 'nowy', 'Pokój B nie zachował własnego statusu scoped', investor);
        H.assert(project && String(project.status || '') === 'nowy', 'projectStore.status nie powinien agregować wszystkich pokoi bez jawnego scope', project);
        const loaded = result && result.loadedProject;
        H.assert(loaded && loaded.meta && String(loaded.meta.projectStatus || '') === 'nowy', 'loadedProject.meta.projectStatus powinien być lustrem masterStatus po rekonsyliacji', loaded);
      })),

      H.makeTest('Wycena ↔ Centralny status', 'Scoped zmiana statusu wielu pokoi ignoruje obcy pokój inwestora', 'Pilnuje regułę mini-paczki 1: wspólny projekt A+B liczy status tylko z własnego scope i nie może zostać podbity przez niezależny pokój C.', ()=> withInvestorProjectFixture({
        investorId:'inv_scope_exact',
        projectId:'proj_scope_exact',
        rooms:[
          { id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'wstepna_wycena' },
          { id:'room_b', baseType:'pokoj', name:'Pokój B', label:'Pokój B', projectStatus:'wstepna_wycena' },
          { id:'room_c', baseType:'pokoj', name:'Pokój C', label:'Pokój C', projectStatus:'wycena' },
        ],
        status:'wycena',
        projectData:{
          schemaVersion:2,
          meta:{
            projectStatus:'wycena',
            roomDefs:{
              room_a:{ id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:'wstepna_wycena' },
              room_b:{ id:'room_b', baseType:'pokoj', name:'Pokój B', label:'Pokój B', projectStatus:'wstepna_wycena' },
              room_c:{ id:'room_c', baseType:'pokoj', name:'Pokój C', label:'Pokój C', projectStatus:'wycena' },
            },
            roomOrder:['room_a','room_b','room_c'],
          },
          room_a:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} },
          room_b:{ cabinets:[{ id:'cab_b' }], fronts:[], sets:[], settings:{} },
          room_c:{ cabinets:[{ id:'cab_c' }], fronts:[], sets:[], settings:{} },
        }
      }, ({ investorId, projectId })=>{
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.reconcileProjectStatuses === 'function', 'Brak FC.projectStatusSync.reconcileProjectStatuses');
        FC.quoteSnapshotStore.writeAll([]);
        FC.quoteSnapshotStore.save({
          id:'snap_scope_exact_ab',
          investor:{ id:investorId, name:'Jan Test' },
          project:{ id:projectId, investorId, status:'wstepna_wycena' },
          scope:{ selectedRooms:['room_a','room_b'], roomLabels:['Kuchnia A','Pokój B'] },
          commercial:{ preliminary:true, versionName:'Wstępna oferta A+B' },
          meta:{ preliminary:true, versionName:'Wstępna oferta A+B' },
          lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
          totals:{ materials:0, accessories:0, services:0, quoteRates:0, subtotal:0, discount:0, grand:0 },
          generatedAt:1712816300000,
        });
        FC.quoteSnapshotStore.save({
          id:'snap_scope_exact_c',
          investor:{ id:investorId, name:'Jan Test' },
          project:{ id:projectId, investorId, status:'wycena' },
          scope:{ selectedRooms:['room_c'], roomLabels:['Pokój C'] },
          commercial:{ preliminary:false, versionName:'Oferta C' },
          meta:{ preliminary:false, versionName:'Oferta C' },
          lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
          totals:{ materials:0, accessories:0, services:0, quoteRates:0, subtotal:0, discount:0, grand:0 },
          generatedAt:1712816310000,
        });
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.setStatusFromSnapshot === 'function', 'Brak FC.projectStatusSync.setStatusFromSnapshot');
        const snapshot = FC.quoteSnapshotStore.getById('snap_scope_exact_ab');
        const result = FC.projectStatusSync.setStatusFromSnapshot(snapshot, 'wstepna_wycena', { refreshUi:false });
        const investor = FC.investors.getById(investorId);
        const project = FC.projectStore.getById(projectId);
        const roomA = investor && investor.rooms && investor.rooms.find((room)=> String(room && room.id || '') === 'room_a');
        const roomB = investor && investor.rooms && investor.rooms.find((room)=> String(room && room.id || '') === 'room_b');
        const roomC = investor && investor.rooms && investor.rooms.find((room)=> String(room && room.id || '') === 'room_c');
        H.assert(result && String(result.aggregateStatus || '') === 'wstepna_wycena', 'Scoped projekt A+B został błędnie podbity przez obcy pokój C', result);
        H.assert(result && String(result.masterStatus || '') === 'wstepna_wycena', 'masterStatus scoped projektu A+B jest błędny', result);
        H.assert(result && String(result.mirrorStatus || '') === 'wstepna_wycena', 'mirrorStatus scoped projektu A+B nie zgadza się z masterem', result);
        H.assert(roomA && String(roomA.projectStatus || '') === 'wstepna_wycena', 'Pokój A nie dostał scoped statusu A+B', investor);
        H.assert(roomB && String(roomB.projectStatus || '') === 'wstepna_wycena', 'Pokój B nie dostał scoped statusu A+B', investor);
        H.assert(roomC && String(roomC.projectStatus || '') === 'wycena', 'Obcy pokój C nie powinien zmienić statusu przy scoped A+B', investor);
        H.assert(project && String(project.status || '') === 'wstepna_wycena', 'projectStore.status powinien odzwierciedlać tylko exact scope A+B', project);
        const loaded = result && result.loadedProject;
        H.assert(loaded && loaded.meta && String(loaded.meta.projectStatus || '') === 'wstepna_wycena', 'loadedProject.meta.projectStatus powinien być lustrem scoped masterStatus A+B', loaded);
      })),

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


      H.makeTest('Wycena ↔ Inwestor', 'Ręczna zmiana statusu inwestora przełącza wskazaną ofertę i status projektu', 'Pilnuje, czy zmiana statusu projektu po stronie Inwestor korzysta z tej samej logiki co Wycena i nie rozjeżdża store projektu oraz historii ofert.', ()=>{
        H.assert(FC.investorPersistence && typeof FC.investorPersistence.setInvestorProjectStatus === 'function', 'Brak FC.investorPersistence.setInvestorProjectStatus');
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.markSelectedForProject === 'function', 'Brak FC.quoteSnapshotStore.markSelectedForProject');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const prelim = FC.quoteSnapshotStore.save({ id:'snap_cross_prelim', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt testowy' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true }, totals:{ grand:100 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820000000 });
          const finalQuote = FC.quoteSnapshotStore.save({ id:'snap_cross_final', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt testowy' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, totals:{ grand:150 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820100000 });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, prelim.id, { status:'pomiar', roomIds:['room_kuchnia_gora'] });
          FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_kuchnia_gora', 'pomiar');
          let selected = FC.quoteSnapshotStore.getSelectedForProject(projectId);
          let record = FC.projectStore.getByInvestorId(investorId);
          H.assert(selected && String(selected.id || '') === String(prelim.id || ''), 'Status pomiar nie utrzymał zaakceptowanej oferty wstępnej', { selected, all:FC.quoteSnapshotStore.listForProject(projectId) });
          H.assert(record && String(record.status || '') === 'pomiar', 'Status pomiar nie zapisał się do projectStore', record);
          FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_kuchnia_gora', 'wycena');
          selected = FC.quoteSnapshotStore.getSelectedForProject(projectId);
          record = FC.projectStore.getByInvestorId(investorId);
          H.assert(selected == null, 'Status wycena nie wyczyścił wskazanej oferty', { selected, all:FC.quoteSnapshotStore.listForProject(projectId) });
          H.assert(record && String(record.status || '') === 'wycena', 'Status wycena nie zapisał się do projectStore', record);
          FC.quoteSnapshotStore.markSelectedForProject(projectId, finalQuote.id, { status:'zaakceptowany', roomIds:['room_kuchnia_gora'] });
          FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_kuchnia_gora', 'zaakceptowany');
          selected = FC.quoteSnapshotStore.getSelectedForProject(projectId);
          record = FC.projectStore.getByInvestorId(investorId);
          H.assert(selected && String(selected.id || '') === String(finalQuote.id || ''), 'Status zaakceptowany nie wskazał finalnej oferty', { selected, all:FC.quoteSnapshotStore.listForProject(projectId) });
          H.assert(record && String(record.status || '') === 'zaakceptowany', 'Status zaakceptowany nie zapisał się do projectStore', record);
        });
      }),



      H.makeTest('Wycena ↔ Centralny status', 'Inwestor i Wycena wołają jeden wspólny mechanizm statusów', 'Pilnuje ETAP 2: oba wejścia do zmiany statusu mają przechodzić przez centralny serwis zamiast przez dwie niezależne ścieżki.', ()=>{
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.setInvestorRoomStatus === 'function', 'Brak FC.projectStatusSync.setInvestorRoomStatus');
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.setStatusFromSnapshot === 'function', 'Brak FC.projectStatusSync.setStatusFromSnapshot');
        const prevSetInvestorRoomStatus = FC.projectStatusSync.setInvestorRoomStatus;
        const prevSetStatusFromSnapshot = FC.projectStatusSync.setStatusFromSnapshot;
        let investorCalls = 0;
        let snapshotCalls = 0;
        FC.projectStatusSync.setInvestorRoomStatus = function(){
          investorCalls += 1;
          return prevSetInvestorRoomStatus.apply(this, arguments);
        };
        FC.projectStatusSync.setStatusFromSnapshot = function(){
          snapshotCalls += 1;
          return prevSetStatusFromSnapshot.apply(this, arguments);
        };
        try{
          withInvestorProjectFixture({}, ({ investorId, projectId })=>{
            const prelim = FC.quoteSnapshotStore.save({ id:'snap_central_pre', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt centralny' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Central pre' }, totals:{ grand:100 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820255000 });
            FC.quoteSnapshotStore.markSelectedForProject(projectId, prelim.id, { status:'pomiar', roomIds:['room_kuchnia_gora'] });
            FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_kuchnia_gora', 'pomiar');
            FC.wycenaTabDebug.setProjectStatusFromSnapshot(prelim, 'pomiar', { syncSelection:true });
          });
          H.assert(investorCalls === 1, 'Wejście z Inwestor nie przeszło przez centralny serwis statusów', { investorCalls, snapshotCalls });
          H.assert(snapshotCalls === 1, 'Wejście z Wycena nie przeszło przez centralny serwis statusów', { investorCalls, snapshotCalls });
        } finally {
          FC.projectStatusSync.setInvestorRoomStatus = prevSetInvestorRoomStatus;
          FC.projectStatusSync.setStatusFromSnapshot = prevSetStatusFromSnapshot;
        }
      }),

      H.makeTest('Wycena ↔ Centralny status', 'Centralny serwis statusów synchronizuje inwestora, projekt i wybór oferty', 'Pilnuje ETAP 2: jedna centralna ścieżka ma ustawić statusy pokoi, store projektu i zaakceptowaną ofertę bez potrzeby wywoływania osobnych mostków.', ()=>{
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.setStatusFromSnapshot === 'function', 'Brak FC.projectStatusSync.setStatusFromSnapshot');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const prelim = FC.quoteSnapshotStore.save({ id:'snap_central_sync_pre', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt central sync' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Central sync pre' }, totals:{ grand:101 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820260000 });
          const finalQuote = FC.quoteSnapshotStore.save({ id:'snap_central_sync_final', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt central sync' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:false, versionName:'Central sync final' }, totals:{ grand:151 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820270000 });
          FC.projectStatusSync.setStatusFromSnapshot(prelim, 'pomiar', { syncSelection:true, refreshUi:false });
          let investor = FC.investors.getById(investorId);
          let project = FC.projectStore.getById(projectId);
          let selected = FC.quoteSnapshotStore.getSelectedForProject(projectId);
          const kitchenAfterPomiar = (investor.rooms || []).find((room)=> String(room && room.id || '') === 'room_kuchnia_gora');
          H.assert(String(kitchenAfterPomiar && kitchenAfterPomiar.projectStatus || '') === 'pomiar', 'Centralny serwis nie ustawił statusu pokoju na pomiar', investor && investor.rooms);
          H.assert(project && String(project.status || '') === 'pomiar', 'Centralny serwis nie zsynchronizował projectStore na pomiar', project);
          H.assert(selected && String(selected.id || '') === String(prelim.id || ''), 'Centralny serwis nie wskazał zaakceptowanej oferty wstępnej', { selected, all:FC.quoteSnapshotStore.listForProject(projectId) });
          FC.projectStatusSync.setStatusFromSnapshot(finalQuote, 'zaakceptowany', { syncSelection:true, refreshUi:false });
          investor = FC.investors.getById(investorId);
          project = FC.projectStore.getById(projectId);
          selected = FC.quoteSnapshotStore.getSelectedForProject(projectId);
          const kitchenAfterFinal = (investor.rooms || []).find((room)=> String(room && room.id || '') === 'room_kuchnia_gora');
          H.assert(String(kitchenAfterFinal && kitchenAfterFinal.projectStatus || '') === 'zaakceptowany', 'Centralny serwis nie ustawił statusu pokoju na zaakceptowany', investor && investor.rooms);
          H.assert(project && String(project.status || '') === 'zaakceptowany', 'Centralny serwis nie zsynchronizował projectStore na zaakceptowany', project);
          H.assert(selected && String(selected.id || '') === String(finalQuote.id || ''), 'Centralny serwis nie przełączył zaakceptowanej oferty na końcową', { selected, all:FC.quoteSnapshotStore.listForProject(projectId) });
        });
      }),


      H.makeTest('Wycena ↔ Centralny status', 'Centralny status ignoruje stare statusy z roomRegistry przy zapisie projektu', 'Pilnuje regresję z ETAPU 3: obce albo stare statusy wiszące w roomRegistry nie mogą nadpisywać projectStore.status ani statusów pokoi przy zmianie scoped.', ()=>{
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.setStatusFromSnapshot === 'function', 'Brak FC.projectStatusSync.setStatusFromSnapshot');
        H.assert(FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomDefs === 'function', 'Brak FC.roomRegistry.getActiveRoomDefs');
        H.assert(typeof FC.roomRegistry.getActiveRoomIds === 'function', 'Brak FC.roomRegistry.getActiveRoomIds');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const prelim = FC.quoteSnapshotStore.save({ id:'snap_registry_pre', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt registry' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Registry pre' }, totals:{ grand:111 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820280000 });
          const prevGetActiveRoomDefs = FC.roomRegistry.getActiveRoomDefs;
          const prevGetActiveRoomIds = FC.roomRegistry.getActiveRoomIds;
          const staleDefs = [
            { id:'room_kuchnia_gora', baseType:'kuchnia', name:'Kuchnia góra', label:'Kuchnia góra', projectStatus:'wycena' },
            { id:'room_salon', baseType:'pokoj', name:'Salon', label:'Salon', projectStatus:'wycena' },
            { id:'room_stale', baseType:'pokoj', name:'Stary pokój', label:'Stary pokój', projectStatus:'wycena' },
          ];
          FC.roomRegistry.getActiveRoomDefs = ()=> clone(staleDefs);
          FC.roomRegistry.getActiveRoomIds = ()=> staleDefs.map((room)=> String(room && room.id || '')).filter(Boolean);
          try{
            FC.projectStatusSync.setStatusFromSnapshot(prelim, 'pomiar', { syncSelection:true, refreshUi:false });
            const investor = FC.investors.getById(investorId);
            const project = FC.projectStore.getById(projectId);
            const kitchen = (investor && investor.rooms || []).find((room)=> String(room && room.id || '') === 'room_kuchnia_gora');
            const salon = (investor && investor.rooms || []).find((room)=> String(room && room.id || '') === 'room_salon');
            H.assert(String(kitchen && kitchen.projectStatus || '') === 'pomiar', 'Brudny roomRegistry nadpisał status aktywnego pokoju', investor && investor.rooms);
            H.assert(String(salon && salon.projectStatus || '') === 'nowy', 'Brudny roomRegistry nadpisał status innego pokoju projektu', investor && investor.rooms);
            H.assert(project && String(project.status || '') === 'pomiar', 'Brudny roomRegistry nadpisał zagregowany status projectStore', project);
          } finally {
            FC.roomRegistry.getActiveRoomDefs = prevGetActiveRoomDefs;
            FC.roomRegistry.getActiveRoomIds = prevGetActiveRoomIds;
          }
        });
      }),

      H.makeTest('Wycena ↔ Centralny status', 'Sprzątanie ETAPU 3 nie wraca do starego lokalnego patchowania statusów', 'Pilnuje ETAP 3: wejścia statusów nie mają już po centralizacji dopalać starej ścieżki updateInvestorRoom jako drugiego mechanizmu zapisu.', ()=>{
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.setInvestorRoomStatus === 'function', 'Brak FC.projectStatusSync.setInvestorRoomStatus');
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.setStatusFromSnapshot === 'function', 'Brak FC.projectStatusSync.setStatusFromSnapshot');
        H.assert(FC.investorPersistence && typeof FC.investorPersistence.updateInvestorRoom === 'function', 'Brak FC.investorPersistence.updateInvestorRoom');
        const prevUpdateInvestorRoom = FC.investorPersistence.updateInvestorRoom;
        let fallbackCalls = 0;
        FC.investorPersistence.updateInvestorRoom = function(){
          fallbackCalls += 1;
          return prevUpdateInvestorRoom.apply(this, arguments);
        };
        try{
          withInvestorProjectFixture({}, ({ investorId, projectId })=>{
            const prelim = FC.quoteSnapshotStore.save({ id:'snap_cleanup_pre', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt cleanup' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Cleanup pre' }, totals:{ grand:101 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820285000 });
            FC.quoteSnapshotStore.markSelectedForProject(projectId, prelim.id, { status:'pomiar', roomIds:['room_kuchnia_gora'] });
            FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_kuchnia_gora', 'pomiar');
            FC.wycenaTabDebug.setProjectStatusFromSnapshot(prelim, 'pomiar', { syncSelection:true });
          });
          H.assert(fallbackCalls === 0, 'Po sprzątaniu statusów wróciło stare lokalne patchowanie updateInvestorRoom', { fallbackCalls });
        } finally {
          FC.investorPersistence.updateInvestorRoom = prevUpdateInvestorRoom;
        }
      }),


      H.makeTest('Wycena ↔ Centralny status', 'Sprzątanie ETAPU 4 nie wraca do lokalnej akceptacji oferty', 'Pilnuje ETAP 4: gdy zabraknie dedykowanego helpera akceptacji, Wycena nie może wrócić do starego lokalnego zaznaczania snapshotu i zapisu statusów bokiem.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.commitAcceptedSnapshotWithSync === 'function', 'Brak FC.wycenaTabDebug.commitAcceptedSnapshotWithSync');
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.setStatusFromSnapshot === 'function', 'Brak FC.projectStatusSync.setStatusFromSnapshot');
        const prevCommit = FC.projectStatusSync.commitAcceptedSnapshot;
        const prevMarkSelected = FC.quoteSnapshotStore && FC.quoteSnapshotStore.markSelectedForProject;
        const prevUpsert = FC.projectStore && FC.projectStore.upsert;
        const prevSave = FC.project && FC.project.save;
        let markSelectedCalls = 0;
        let upsertCalls = 0;
        let saveCalls = 0;
        FC.projectStatusSync.commitAcceptedSnapshot = null;
        if(prevMarkSelected) FC.quoteSnapshotStore.markSelectedForProject = function(){ markSelectedCalls += 1; return prevMarkSelected.apply(this, arguments); };
        if(prevUpsert) FC.projectStore.upsert = function(){ upsertCalls += 1; return prevUpsert.apply(this, arguments); };
        if(prevSave) FC.project.save = function(){ saveCalls += 1; return prevSave.apply(this, arguments); };
        try{
          withInvestorProjectFixture({}, ({ investorId, projectId })=>{
            const snapshot = FC.quoteSnapshotStore.save({ id:'snap_cleanup_accept_fallback', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt cleanup accept fallback' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Cleanup accept fallback' }, totals:{ grand:141 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820292500 });
            const result = FC.wycenaTabDebug.commitAcceptedSnapshotWithSync(snapshot, 'pomiar');
            H.assert(result === null, 'Po sprzątaniu ETAPU 4 akceptacja bez helpera powinna się zatrzymać zamiast uruchomić stary fallback', result);
          });
          H.assert(markSelectedCalls === 0, 'Wróciło stare lokalne markSelectedForProject w Wycena', { markSelectedCalls, upsertCalls, saveCalls });
          H.assert(upsertCalls === 0, 'Wrócił stary lokalny zapis projectStore przy akceptacji', { markSelectedCalls, upsertCalls, saveCalls });
          H.assert(saveCalls === 0, 'Wrócił stary lokalny zapis session projektu przy akceptacji', { markSelectedCalls, upsertCalls, saveCalls });
        } finally {
          FC.projectStatusSync.commitAcceptedSnapshot = prevCommit;
          if(prevMarkSelected) FC.quoteSnapshotStore.markSelectedForProject = prevMarkSelected;
          if(prevUpsert) FC.projectStore.upsert = prevUpsert;
          if(prevSave) FC.project.save = prevSave;
        }
      }),

      H.makeTest('Wycena ↔ Centralny status', 'Sprzątanie ETAPU 4 nie wraca do ogólnej rekonsyliacji po usunięciu snapshotu', 'Pilnuje ETAP 4: brak dedykowanego helpera usuwania nie może odpalić starej bocznej ścieżki reconcileProjectStatuses z Wycena.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.reconcileAfterSnapshotRemoval === 'function', 'Brak FC.wycenaTabDebug.reconcileAfterSnapshotRemoval');
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.reconcileProjectStatuses === 'function', 'Brak FC.projectStatusSync.reconcileProjectStatuses');
        const prevDedicated = FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval;
        const prevGeneric = FC.projectStatusSync.reconcileProjectStatuses;
        let genericCalls = 0;
        FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval = null;
        FC.projectStatusSync.reconcileProjectStatuses = function(){ genericCalls += 1; return prevGeneric.apply(this, arguments); };
        try{
          withInvestorProjectFixture({}, ({ investorId, projectId })=>{
            const snapshot = FC.quoteSnapshotStore.save({ id:'snap_cleanup_remove_fallback', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt cleanup remove fallback' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:false, versionName:'Cleanup remove fallback' }, totals:{ grand:151 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820292600 });
            const result = FC.wycenaTabDebug.reconcileAfterSnapshotRemoval(snapshot, { refreshUi:false });
            H.assert(result === null, 'Po sprzątaniu ETAPU 4 brak helpera usuwania powinien zatrzymać flow zamiast wejść w stary generic reconcile', result);
          });
          H.assert(genericCalls === 0, 'Wróciło stare wywołanie reconcileProjectStatuses z Wycena', { genericCalls });
        } finally {
          FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval = prevDedicated;
          FC.projectStatusSync.reconcileProjectStatuses = prevGeneric;
        }
      }),

      H.makeTest('Wycena ↔ Centralny status', 'Sprzątanie ETAPU 4 nie wraca do lokalnej konwersji wstępnej oferty', 'Pilnuje ETAP 4: brak helpera konwersji nie może uruchamiać starego convertPreliminaryToFinal i ręcznego zapisu statusów z Wycena.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.promotePreliminarySnapshotToFinal === 'function', 'Brak FC.wycenaTabDebug.promotePreliminarySnapshotToFinal');
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.setStatusFromSnapshot === 'function', 'Brak FC.projectStatusSync.setStatusFromSnapshot');
        const prevPromote = FC.projectStatusSync.promotePreliminarySnapshotToFinal;
        const prevConvert = FC.quoteSnapshotStore && FC.quoteSnapshotStore.convertPreliminaryToFinal;
        const prevUpsert = FC.projectStore && FC.projectStore.upsert;
        const prevSave = FC.project && FC.project.save;
        let convertCalls = 0;
        let upsertCalls = 0;
        let saveCalls = 0;
        FC.projectStatusSync.promotePreliminarySnapshotToFinal = null;
        if(prevConvert) FC.quoteSnapshotStore.convertPreliminaryToFinal = function(){ convertCalls += 1; return prevConvert.apply(this, arguments); };
        if(prevUpsert) FC.projectStore.upsert = function(){ upsertCalls += 1; return prevUpsert.apply(this, arguments); };
        if(prevSave) FC.project.save = function(){ saveCalls += 1; return prevSave.apply(this, arguments); };
        try{
          withInvestorProjectFixture({}, ({ investorId, projectId })=>{
            const snapshot = FC.quoteSnapshotStore.save({ id:'snap_cleanup_convert_fallback', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt cleanup convert fallback' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Cleanup convert fallback' }, totals:{ grand:161 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820292700, meta:{ selectedByClient:true, acceptedAt:1712820292700, acceptedStage:'pomiar', preliminary:true } });
            const result = FC.wycenaTabDebug.promotePreliminarySnapshotToFinal(snapshot);
            H.assert(result === null, 'Po sprzątaniu ETAPU 4 brak helpera konwersji powinien zatrzymać flow zamiast uruchomić stary fallback', result);
          });
          H.assert(convertCalls === 0, 'Wróciło stare lokalne convertPreliminaryToFinal w Wycena', { convertCalls, upsertCalls, saveCalls });
          H.assert(upsertCalls === 0, 'Wrócił stary lokalny zapis projectStore przy konwersji', { convertCalls, upsertCalls, saveCalls });
          H.assert(saveCalls === 0, 'Wrócił stary lokalny zapis session projektu przy konwersji', { convertCalls, upsertCalls, saveCalls });
        } finally {
          FC.projectStatusSync.promotePreliminarySnapshotToFinal = prevPromote;
          if(prevConvert) FC.quoteSnapshotStore.convertPreliminaryToFinal = prevConvert;
          if(prevUpsert) FC.projectStore.upsert = prevUpsert;
          if(prevSave) FC.project.save = prevSave;
        }
      }),

      H.makeTest('Wycena ↔ Silnik statusów', 'Wycena deleguje akceptację oferty do centralnego sync', 'Pilnuje mini-paczkę 3: moduł Wycena nie powinien sam sklejać akceptacji snapshotu, tylko przekazać ją do project-status-sync.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.commitAcceptedSnapshotWithSync === 'function', 'Brak FC.wycenaTabDebug.commitAcceptedSnapshotWithSync');
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.commitAcceptedSnapshot === 'function', 'Brak FC.projectStatusSync.commitAcceptedSnapshot');
        const prev = FC.projectStatusSync.commitAcceptedSnapshot;
        let calls = 0;
        FC.projectStatusSync.commitAcceptedSnapshot = function(){
          calls += 1;
          return prev.apply(this, arguments);
        };
        try{
          withInvestorProjectFixture({}, ({ investorId, projectId })=>{
            const snapshot = FC.quoteSnapshotStore.save({ id:'snap_delegate_accept', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt delegate accept' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Delegate accept' }, totals:{ grand:111 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820290000 });
            FC.wycenaTabDebug.commitAcceptedSnapshotWithSync(snapshot, 'pomiar');
          });
          H.assert(calls === 1, 'Wycena nie przekazała akceptacji snapshotu do centralnego sync', { calls });
        } finally {
          FC.projectStatusSync.commitAcceptedSnapshot = prev;
        }
      }),

      H.makeTest('Wycena ↔ Silnik statusów', 'Wycena deleguje rekonsyliację po usunięciu oferty do centralnego sync', 'Pilnuje mini-paczkę 3: po usunięciu snapshotu to centralny sync ma policzyć wynik statusu scope, a nie lokalny kod w Wycena.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.reconcileAfterSnapshotRemoval === 'function', 'Brak FC.wycenaTabDebug.reconcileAfterSnapshotRemoval');
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval === 'function', 'Brak FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval');
        const prev = FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval;
        let calls = 0;
        FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval = function(){
          calls += 1;
          return prev.apply(this, arguments);
        };
        try{
          withInvestorProjectFixture({}, ({ investorId, projectId })=>{
            const snapshot = FC.quoteSnapshotStore.save({ id:'snap_delegate_remove', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt delegate remove' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:false, versionName:'Delegate remove' }, totals:{ grand:119 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820291000 });
            FC.wycenaTabDebug.reconcileAfterSnapshotRemoval(snapshot, { refreshUi:false });
          });
          H.assert(calls === 1, 'Wycena nie przekazała rekonsyliacji po usunięciu do centralnego sync', { calls });
        } finally {
          FC.projectStatusSync.reconcileStatusAfterSnapshotRemoval = prev;
        }
      }),

      H.makeTest('Wycena ↔ Silnik statusów', 'Wycena deleguje konwersję wstępnej oferty do centralnego sync', 'Pilnuje mini-paczkę 3: przejście z zaakceptowanej wstępnej oferty na końcową nie powinno być klejone lokalnie w Wycena.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.promotePreliminarySnapshotToFinal === 'function', 'Brak FC.wycenaTabDebug.promotePreliminarySnapshotToFinal');
        H.assert(FC.projectStatusSync && typeof FC.projectStatusSync.promotePreliminarySnapshotToFinal === 'function', 'Brak FC.projectStatusSync.promotePreliminarySnapshotToFinal');
        const prev = FC.projectStatusSync.promotePreliminarySnapshotToFinal;
        let calls = 0;
        FC.projectStatusSync.promotePreliminarySnapshotToFinal = function(){
          calls += 1;
          return prev.apply(this, arguments);
        };
        try{
          withInvestorProjectFixture({}, ({ investorId, projectId })=>{
            const snapshot = FC.quoteSnapshotStore.save({ id:'snap_delegate_convert', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt delegate convert' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Delegate convert' }, totals:{ grand:129 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820292000, meta:{ selectedByClient:true, acceptedAt:1712820292000, acceptedStage:'pomiar', preliminary:true } });
            FC.wycenaTabDebug.promotePreliminarySnapshotToFinal(snapshot);
          });
          H.assert(calls === 1, 'Wycena nie przekazała konwersji wstępnej oferty do centralnego sync', { calls });
        } finally {
          FC.projectStatusSync.promotePreliminarySnapshotToFinal = prev;
        }
      }),

      H.makeTest('Wycena ↔ Guard', 'Guard ręcznej zmiany statusu pozostaje tylko walidatorem', 'Pilnuje mini-paczkę 3: validateManualStatusChange nie może sam zapisywać statusów projektu ani synchronizować luster.', ()=>{
        H.assert(FC.projectStatusManualGuard && typeof FC.projectStatusManualGuard.validateManualStatusChange === 'function', 'Brak FC.projectStatusManualGuard.validateManualStatusChange');
        H.assert(FC.projectStore && typeof FC.projectStore.upsert === 'function', 'Brak FC.projectStore.upsert');
        H.assert(FC.project && typeof FC.project.save === 'function', 'Brak FC.project.save');
        const prevUpsert = FC.projectStore.upsert;
        const prevSave = FC.project.save;
        let upsertCalls = 0;
        let saveCalls = 0;
        FC.projectStore.upsert = function(){ upsertCalls += 1; return prevUpsert.apply(this, arguments); };
        FC.project.save = function(){ saveCalls += 1; return prevSave.apply(this, arguments); };
        try{
          withInvestorProjectFixture({}, ({ investorId })=>{
            FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_kuchnia_gora', 'pomiar');
          });
          H.assert(upsertCalls === 0, 'Guard nie powinien sam zapisywać projectStore', { upsertCalls, saveCalls });
          H.assert(saveCalls === 0, 'Guard nie powinien sam zapisywać projektu do session store', { upsertCalls, saveCalls });
        } finally {
          FC.projectStore.upsert = prevUpsert;
          FC.project.save = prevSave;
        }
      }),

      H.makeTest('Wycena ↔ Snapshot store', 'Snapshot store nie ustala sam finalnego statusu projektu', 'Pilnuje mini-paczkę 3: wybór snapshotu w quote-snapshot-store zmienia tylko historię ofert i nie może sam zsynchronizować statusów projektu bez centralnego sync.', ()=>{
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.markSelectedForProject === 'function', 'Brak FC.quoteSnapshotStore.markSelectedForProject');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const snapshot = FC.quoteSnapshotStore.save({ id:'snap_store_only_select', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt store only' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Store only' }, totals:{ grand:111 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820293000 });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, snapshot.id, { status:'pomiar', roomIds:['room_kuchnia_gora'] });
          const investor = FC.investors.getById(investorId);
          const project = FC.projectStore.getById(projectId);
          const kitchen = (investor.rooms || []).find((room)=> String(room && room.id || '') === 'room_kuchnia_gora');
          H.assert(String(kitchen && kitchen.projectStatus || '') === 'nowy', 'Sam snapshot store nie powinien podnosić statusu pokoju bez centralnego sync', investor && investor.rooms);
          H.assert(project && String(project.status || '') === 'nowy', 'Sam snapshot store nie powinien podnosić projectStore.status bez centralnego sync', project);
        });
      }),

      H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Akceptacja oferty jednego pomieszczenia zmienia status tylko tego pokoju', 'Pilnuje, czy zaakceptowanie wyceny scoped do jednego pomieszczenia nie nadpisuje statusów pozostałych pokoi inwestora.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.setProjectStatusFromSnapshot === 'function', 'Brak FC.wycenaTabDebug.setProjectStatusFromSnapshot');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const snapshot = FC.quoteSnapshotStore.save({
            id:'snap_room_only_pre',
            investor:{ id:investorId },
            project:{ id:projectId, investorId, title:'Projekt scoped' },
            scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'], materialScopeMode:'both', materialScope:{ includeFronts:true, includeCorpus:true } },
            commercial:{ preliminary:true, versionName:'Wstępna kuchnia' },
            totals:{ grand:100 },
            lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            generatedAt:1712820300000,
          });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, snapshot.id, { status:'pomiar' });
          FC.wycenaTabDebug.setProjectStatusFromSnapshot(snapshot, 'pomiar');
          const investor = FC.investors.getById(investorId);
          const kitchen = (investor.rooms || []).find((room)=> String(room && room.id || '') === 'room_kuchnia_gora');
          const salon = (investor.rooms || []).find((room)=> String(room && room.id || '') === 'room_salon');
          const project = FC.projectStore.getById(projectId);
          H.assert(String(kitchen && kitchen.projectStatus || '') === 'pomiar', 'Pokój objęty wyceną nie dostał statusu pomiar', investor.rooms);
          H.assert(String(salon && salon.projectStatus || '') === 'nowy', 'Status drugiego pokoju został nadpisany mimo że wycena go nie obejmowała', investor.rooms);
          H.assert(project && String(project.status || '') === 'pomiar', 'Zagregowany status projektu nie przeszedł na pomiar po akceptacji scoped wyceny', project);
        });
      }),

      H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Wspólna wycena aktualizuje tylko pokoje ze swojego zakresu', 'Pilnuje, czy wycena obejmująca kilka wybranych pomieszczeń aktualizuje tylko te pokoje, a nie cały projekt w ciemno.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.setProjectStatusFromSnapshot === 'function', 'Brak FC.wycenaTabDebug.setProjectStatusFromSnapshot');
        withInvestorProjectFixture({
          rooms:[
            { id:'room_kuchnia_gora', baseType:'kuchnia', name:'Kuchnia góra', label:'Kuchnia góra', projectStatus:'nowy' },
            { id:'room_salon', baseType:'pokoj', name:'Salon', label:'Salon', projectStatus:'nowy' },
            { id:'room_lazienka', baseType:'lazienka', name:'Łazienka', label:'Łazienka', projectStatus:'nowy' },
          ],
          projectData:{
            schemaVersion:2,
            meta:{
              roomDefs:{
                room_kuchnia_gora:{ id:'room_kuchnia_gora', baseType:'kuchnia', name:'Kuchnia góra', label:'Kuchnia góra' },
                room_salon:{ id:'room_salon', baseType:'pokoj', name:'Salon', label:'Salon' },
                room_lazienka:{ id:'room_lazienka', baseType:'lazienka', name:'Łazienka', label:'Łazienka' },
              },
              roomOrder:['room_kuchnia_gora','room_salon','room_lazienka'],
            },
            room_kuchnia_gora:{ cabinets:[{ id:'cab_k' }], fronts:[], sets:[], settings:{} },
            room_salon:{ cabinets:[{ id:'cab_s' }], fronts:[], sets:[], settings:{} },
            room_lazienka:{ cabinets:[{ id:'cab_l' }], fronts:[], sets:[], settings:{} },
          }
        }, ({ investorId, projectId })=>{
          const snapshot = FC.quoteSnapshotStore.save({
            id:'snap_shared_final',
            investor:{ id:investorId },
            project:{ id:projectId, investorId, title:'Projekt shared' },
            scope:{ selectedRooms:['room_kuchnia_gora','room_salon'], roomLabels:['Kuchnia góra','Salon'], materialScopeMode:'both', materialScope:{ includeFronts:true, includeCorpus:true } },
            commercial:{ preliminary:false, versionName:'Oferta wspólna' },
            totals:{ grand:250 },
            lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            generatedAt:1712820400000,
          });
          FC.wycenaTabDebug.setProjectStatusFromSnapshot(snapshot, 'wycena');
          const investor = FC.investors.getById(investorId);
          const byId = Object.fromEntries((investor.rooms || []).map((room)=> [String(room && room.id || ''), room]));
          H.assert(String(byId.room_kuchnia_gora && byId.room_kuchnia_gora.projectStatus || '') === 'wycena', 'Pierwszy pokój ze wspólnej wyceny nie dostał statusu wycena', investor.rooms);
          H.assert(String(byId.room_salon && byId.room_salon.projectStatus || '') === 'wycena', 'Drugi pokój ze wspólnej wyceny nie dostał statusu wycena', investor.rooms);
          H.assert(String(byId.room_lazienka && byId.room_lazienka.projectStatus || '') === 'nowy', 'Pokój spoza wspólnej wyceny dostał status mimo braku w zakresie', investor.rooms);
        });
      }),


      H.makeTest('Wycena ↔ Scope wejścia', 'Exact scope znajduje istniejącą wstępną wycenę solo bez mylenia z innymi pokojami', 'Pilnuje, czy wyszukiwanie istniejącej wyceny wstępnej trafia dokładnie w scope jednego pokoju i nie podbiera wersji z innego zakresu.', ()=>{
        H.assert(FC.quoteScopeEntry && typeof FC.quoteScopeEntry.describeScopeMatch === 'function', 'Brak FC.quoteScopeEntry.describeScopeMatch');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          FC.quoteSnapshotStore.save({ id:'snap_scope_solo_pre', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt scope solo' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Salon pre' }, totals:{ grand:118 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820441000 });
          FC.quoteSnapshotStore.save({ id:'snap_scope_other_pre', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt scope solo' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Kuchnia pre' }, totals:{ grand:125 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820442000 });
          const match = FC.quoteScopeEntry.describeScopeMatch(projectId, ['room_salon'], { preliminary:true });
          H.assert(match && match.hasExistingExactScope === true, 'Exact scope solo nie wykrył istniejącej wyceny wstępnej', match);
          H.assert(String(match.existingSnapshotId || '') === 'snap_scope_solo_pre', 'Exact scope solo otworzył nie tę wycenę co trzeba', match);
        });
      }),

      H.makeTest('Wycena ↔ Scope wejścia', 'Exact scope odróżnia zakres wspólny A+B od zakresu solo A', 'Pilnuje, czy wspólna wycena dla kombinacji pokoi nie jest traktowana jak wycena solo tylko dlatego, że zawiera ten sam pokój.', ()=>{
        H.assert(FC.quoteScopeEntry && typeof FC.quoteScopeEntry.describeScopeMatch === 'function', 'Brak FC.quoteScopeEntry.describeScopeMatch');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          FC.quoteSnapshotStore.save({ id:'snap_scope_shared_pre', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt scope shared' }, scope:{ selectedRooms:['room_kuchnia_gora','room_salon'], roomLabels:['Kuchnia góra','Salon'] }, commercial:{ preliminary:true, versionName:'Wspólna pre' }, totals:{ grand:221 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820443000 });
          const soloMatch = FC.quoteScopeEntry.describeScopeMatch(projectId, ['room_salon'], { preliminary:true });
          const sharedMatch = FC.quoteScopeEntry.describeScopeMatch(projectId, ['room_kuchnia_gora','room_salon'], { preliminary:true });
          H.assert(soloMatch && soloMatch.hasExistingExactScope === false, 'Scope solo błędnie uznał wycenę wspólną A+B za własną', soloMatch);
          H.assert(sharedMatch && sharedMatch.hasExistingExactScope === true && String(sharedMatch.existingSnapshotId || '') === 'snap_scope_shared_pre', 'Scope A+B nie odnalazł dokładnie swojej istniejącej wyceny wspólnej', sharedMatch);
        });
      }),

      H.makeTest('Wycena ↔ Scope wejścia', 'Brak istniejącej wyceny dla danego scope zgłasza pusty exact match', 'Pilnuje, czy nowy zakres bez historii nie jest mylony z innymi snapshotami projektu i pozostaje kandydatem do utworzenia nowej wyceny.', ()=>{
        H.assert(FC.quoteScopeEntry && typeof FC.quoteScopeEntry.describeScopeMatch === 'function', 'Brak FC.quoteScopeEntry.describeScopeMatch');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          FC.quoteSnapshotStore.save({ id:'snap_scope_only_kitchen', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt scope none' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Kuchnia pre' }, totals:{ grand:111 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820444000 });
          const none = FC.quoteScopeEntry.describeScopeMatch(projectId, ['room_salon'], { preliminary:true });
          H.assert(none && none.hasExistingExactScope === false, 'Brak historii dla scope salon został błędnie uznany za istniejącą wycenę', none);
        });
      }),

      H.makeTest('Wycena ↔ Scope wejścia', 'Podpowiedź nazwy nowego wariantu nie dubluje domyślnej nazwy dla tego samego scope', 'Pilnuje, czy przy kolejnym wariancie dla identycznego scope podpowiedź idzie w numerowany wariant zamiast znowu zostawiać samą domyślną nazwę.', ()=>{
        H.assert(FC.quoteScopeEntry && typeof FC.quoteScopeEntry.buildSuggestedVersionName === 'function', 'Brak FC.quoteScopeEntry.buildSuggestedVersionName');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          FC.quoteSnapshotStore.save({ id:'snap_scope_name_1', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt scope name' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Wstępna oferta — Salon' }, totals:{ grand:112 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820445000 });
          const suggested = FC.quoteScopeEntry.buildSuggestedVersionName(projectId, ['room_salon'], true);
          H.assert(String(suggested || '') === 'Wstępna oferta — Salon — wariant 2', 'Podpowiedź nazwy nie przeszła na kolejny wariant dla identycznego scope', suggested);
        });
      }),

      H.makeTest('Wycena ↔ Scope wejścia', 'Walidacja nazwy nowego wariantu blokuje duplikat także po normalizacji', 'Pilnuje, czy druga wycena dla tego samego zakresu nie przejdzie z nazwą różniącą się tylko wielkością liter, spacjami albo polskimi znakami.', ()=>{
        H.assert(FC.quoteScopeEntry && typeof FC.quoteScopeEntry.isVersionNameTaken === 'function', 'Brak FC.quoteScopeEntry.isVersionNameTaken');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          FC.quoteSnapshotStore.save({ id:'snap_scope_name_norm_1', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt scope name normalized' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Wstępna oferta — Salon' }, totals:{ grand:113 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820445100 });
          const taken = FC.quoteScopeEntry.isVersionNameTaken(projectId, ['room_salon'], true, '  wstepna   oferta — salon  ');
          H.assert(taken === true, 'Walidacja nazwy nie wykryła duplikatu po normalizacji wpisu', taken);
        });
      }),

      H.makeTest('Wycena', 'Wyceń dla scope z istniejącą historią wymusza nazwę nowego wariantu', 'Pilnuje, czy kliknięcie Wyceń przy już istniejącej wycenie exact-scope uruchamia modal nazwy, żeby nie tworzyć kolejnych identycznie nazwanych wersji.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.shouldPromptForVersionNameOnGenerate === 'function', 'Brak FC.wycenaTabDebug.shouldPromptForVersionNameOnGenerate');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          FC.quoteSnapshotStore.save({ id:'snap_scope_prompt_1', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt scope prompt' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Wstępna oferta — Salon' }, totals:{ grand:114 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820445200 });
          const shouldPrompt = FC.wycenaTabDebug.shouldPromptForVersionNameOnGenerate({ selectedRooms:['room_salon'] }, { commercial:{ preliminary:true, versionName:'Wstępna oferta — Salon' } });
          H.assert(shouldPrompt === true, 'Wyceń nie wymusił nazwania nowego wariantu mimo istniejącej wyceny dla tego samego scope', shouldPrompt);
        });
      }),

      H.makeTest('Wycena ↔ Scope wejścia', 'Otwarcie istniejącej wyceny scoped nie tworzy duplikatu i ustawia draft oraz podgląd właściwej wersji', 'Pilnuje, czy wybór „Otwórz istniejącą” ładuje dokładnie tę wersję do Wyceny zamiast generować nowy snapshot albo podmieniać scope.', ()=>{
        H.assert(FC.quoteScopeEntry && typeof FC.quoteScopeEntry.openExistingSnapshot === 'function', 'Brak FC.quoteScopeEntry.openExistingSnapshot');
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.showSnapshotPreview === 'function', 'Brak FC.wycenaTabDebug.showSnapshotPreview');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const saved = FC.quoteSnapshotStore.save({ id:'snap_scope_open_existing', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt scope open' }, scope:{ selectedRooms:['room_kuchnia_gora','room_salon'], roomLabels:['Kuchnia góra','Salon'] }, commercial:{ preliminary:true, versionName:'Wspólna pre 2' }, totals:{ grand:240 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820446000 });
          const beforeCount = FC.quoteSnapshotStore.listForProject(projectId).length;
          const result = FC.quoteScopeEntry.openExistingSnapshot(saved, 'wstepna_wycena');
          const draft = FC.quoteOfferStore.getCurrentDraft();
          const afterCount = FC.quoteSnapshotStore.listForProject(projectId).length;
          H.assert(result && String(result.action || '') === 'opened-existing', 'Otwarcie istniejącej wyceny nie zwróciło poprawnej akcji', result);
          H.assert(afterCount == beforeCount, 'Otwarcie istniejącej wyceny stworzyło dodatkowy snapshot zamiast tylko otworzyć istniejący', { beforeCount, afterCount, list:FC.quoteSnapshotStore.listForProject(projectId) });
          H.assert(Array.isArray(draft && draft.selection && draft.selection.selectedRooms) && draft.selection.selectedRooms.join('|') === 'room_kuchnia_gora|room_salon', 'Otwarcie istniejącej wyceny nie ustawiło draftu na dokładny scope A+B', draft);
          H.assert(String(draft && draft.commercial && draft.commercial.versionName || '') === 'Wspólna pre 2', 'Otwarcie istniejącej wyceny nie załadowało właściwej nazwy wersji do draftu', draft);
        });
      }),

      H.makeTest('Wycena ↔ Scope wejścia', 'Wejście statusowe może przejąć aktualnie zaznaczoną kombinację pokoi z draftu zamiast tylko solo', 'Pilnuje, czy logika wejścia do wstępnej wyceny potrafi użyć aktualnej zaznaczonej kombinacji A+B, gdy użytkownik działa z jednego z tych pokoi.', ()=>{
        H.assert(FC.quoteScopeEntry && typeof FC.quoteScopeEntry.getScopeRoomIds === 'function', 'Brak FC.quoteScopeEntry.getScopeRoomIds');
        withInvestorProjectFixture({}, ()=>{
          FC.quoteOfferStore.saveCurrentDraft({ selection:{ selectedRooms:['room_kuchnia_gora','room_salon'] }, commercial:{ preliminary:true, versionName:'Roboczy draft' } });
          const ids = FC.quoteScopeEntry.getScopeRoomIds({ fallbackRoomId:'room_salon' });
          H.assert(Array.isArray(ids) && ids.join('|') === 'room_kuchnia_gora|room_salon', 'Wejście statusowe nie przejęło zaznaczonej kombinacji pokoi z draftu', ids);
        });
      }),

      H.makeTest('Wycena ↔ Scope wejścia', 'Nowa wycena wstępna pokazuje prostą informację tylko przy faktycznym utworzeniu', 'Pilnuje, czy po utworzeniu nowej wstępnej wyceny system daje prosty sygnał sukcesu, a przy zwykłej wycenie końcowej nie odpala tego komunikatu.', async ()=>{
        H.assert(FC.quoteScopeEntry && typeof FC.quoteScopeEntry.ensureScopedQuoteEntry === 'function', 'Brak FC.quoteScopeEntry.ensureScopedQuoteEntry');
        await withInvestorProjectFixture({}, async ({ investorId, projectId })=>{
          const prevBuild = FC.wycenaCore && FC.wycenaCore.buildQuoteSnapshot;
          let prelimNotice = null;
          let finalNotice = null;
          try{
            H.assert(FC.wycenaCore && typeof FC.wycenaCore.buildQuoteSnapshot === 'function', 'Brak FC.wycenaCore.buildQuoteSnapshot');
            FC.wycenaCore.buildQuoteSnapshot = async ({ selection })=> ({
              id:`snap_pre_${Array.isArray(selection && selection.selectedRooms) ? selection.selectedRooms.join('_') : 'scope'}`,
              investor:{ id:investorId },
              project:{ id:projectId, investorId, title:'Projekt notice pre' },
              scope:{ selectedRooms:Array.isArray(selection && selection.selectedRooms) ? selection.selectedRooms.slice() : ['room_salon'], roomLabels:['Salon'] },
              commercial:{ preliminary:true, versionName:'Wstępna oferta — Salon' },
              totals:{ grand:0 },
              lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            });
            await FC.quoteScopeEntry.ensureScopedQuoteEntry({
              investorId,
              projectId,
              roomIds:['room_salon'],
              preliminary:true,
              openTab:false,
              notifyCreated:(scope)=> { prelimNotice = scope; }
            });
            H.assert(prelimNotice && Array.isArray(prelimNotice.roomIds) && prelimNotice.roomIds.join('|') === 'room_salon', 'Nowa wycena wstępna nie wywołała prostego potwierdzenia utworzenia', prelimNotice);
            FC.wycenaCore.buildQuoteSnapshot = async ({ selection })=> ({
              id:`snap_final_${Array.isArray(selection && selection.selectedRooms) ? selection.selectedRooms.join('_') : 'scope'}`,
              investor:{ id:investorId },
              project:{ id:projectId, investorId, title:'Projekt notice final' },
              scope:{ selectedRooms:Array.isArray(selection && selection.selectedRooms) ? selection.selectedRooms.slice() : ['room_salon'], roomLabels:['Salon'] },
              commercial:{ preliminary:false, versionName:'Oferta — Salon' },
              totals:{ grand:0 },
              lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            });
            await FC.quoteScopeEntry.ensureScopedQuoteEntry({
              investorId,
              projectId,
              roomIds:['room_salon'],
              preliminary:false,
              openTab:false,
              notifyCreated:(scope)=> { finalNotice = scope; }
            });
            H.assert(finalNotice == null, 'Komunikat utworzenia odpalił się także dla zwykłej wyceny zamiast tylko dla wstępnej', finalNotice);
          } finally {
            if(FC.wycenaCore) FC.wycenaCore.buildQuoteSnapshot = prevBuild;
          }
        });
      }),


      H.makeTest('Wycena ↔ Scope wejścia', 'Nowa wycena wstępna domyślnie pokazuje modal OK po faktycznym utworzeniu', 'Pilnuje, czy bez specjalnego callbacka system używa prostego komunikatu OK po stworzeniu nowej wyceny wstępnej.', async ()=>{
        H.assert(FC.quoteScopeEntry && typeof FC.quoteScopeEntry.ensureScopedQuoteEntry === 'function', 'Brak FC.quoteScopeEntry.ensureScopedQuoteEntry');
        await withInvestorProjectFixture({}, async ({ investorId, projectId })=>{
          const prevBuild = FC.wycenaCore && FC.wycenaCore.buildQuoteSnapshot;
          const prevInfoOpen = FC.infoBox && FC.infoBox.open;
          let opened = null;
          try{
            H.assert(FC.wycenaCore && typeof FC.wycenaCore.buildQuoteSnapshot === 'function', 'Brak FC.wycenaCore.buildQuoteSnapshot');
            H.assert(FC.infoBox && typeof FC.infoBox.open === 'function', 'Brak FC.infoBox.open');
            FC.wycenaCore.buildQuoteSnapshot = async ({ selection })=> ({
              id:`snap_notice_${Array.isArray(selection && selection.selectedRooms) ? selection.selectedRooms.join('_') : 'scope'}`,
              investor:{ id:investorId },
              project:{ id:projectId, investorId, title:'Projekt notice info' },
              scope:{ selectedRooms:Array.isArray(selection && selection.selectedRooms) ? selection.selectedRooms.slice() : ['room_salon'], roomLabels:['Salon'] },
              commercial:{ preliminary:true, versionName:'Wstępna oferta — Salon' },
              totals:{ grand:120 },
              lines:{ materials:[{ key:'m1' }], accessories:[], agdServices:[], quoteRates:[] },
            });
            FC.infoBox.open = (opts)=> { opened = Object.assign({}, opts || {}); };
            await FC.quoteScopeEntry.ensureScopedQuoteEntry({
              investorId,
              projectId,
              roomIds:['room_salon'],
              preliminary:true,
              openTab:false,
            });
            H.assert(opened && opened.okOnly === true && /NOWA WYCENA WSTĘPNA/i.test(String(opened.title || '')), 'Domyślna informacja o nowej wycenie wstępnej nie otworzyła prostego modala OK', opened);
          } finally {
            if(FC.wycenaCore) FC.wycenaCore.buildQuoteSnapshot = prevBuild;
            if(FC.infoBox) FC.infoBox.open = prevInfoOpen;
          }
        });
      }),

      H.makeTest('Wycena', 'Brak pomieszczeń blokuje tworzenie pustej wyceny', 'Pilnuje, czy Wyceń nie tworzy zerowej oferty, gdy projekt nie ma żadnych pomieszczeń.', async ()=>{
        await withInvestorProjectFixture({
          rooms:[],
          projectData:{ schemaVersion:2, meta:{ roomDefs:{}, roomOrder:[] } },
        }, async ()=>{
          H.assert(FC.wycenaCore && typeof FC.wycenaCore.buildQuoteSnapshot === 'function', 'Brak FC.wycenaCore.buildQuoteSnapshot');
          let thrown = null;
          try{
            await FC.wycenaCore.buildQuoteSnapshot({ selection:{ selectedRooms:[] } });
          } catch(err){
            thrown = err;
          }
          H.assert(thrown && thrown.quoteValidation === true && String(thrown.code || '') === 'no_rooms', 'Brak pomieszczeń nie zablokował tworzenia wyceny odpowiednim błędem', thrown);
          H.assert(Array.isArray(FC.quoteSnapshotStore.listForProject('proj_cross')) && FC.quoteSnapshotStore.listForProject('proj_cross').length === 0, 'Przy braku pomieszczeń powstał snapshot wyceny', FC.quoteSnapshotStore.readAll && FC.quoteSnapshotStore.readAll());
        });
      }),

      H.makeTest('Wycena', 'Nieistniejące wybrane pomieszczenie blokuje zapis wyceny', 'Pilnuje, czy Wyceń nie tworzy oferty dla scope, którego już nie ma w projekcie.', async ()=>{
        await withInvestorProjectFixture({}, async ()=>{
          H.assert(FC.wycenaCore && typeof FC.wycenaCore.buildQuoteSnapshot === 'function', 'Brak FC.wycenaCore.buildQuoteSnapshot');
          let thrown = null;
          try{
            await FC.wycenaCore.buildQuoteSnapshot({ selection:{ selectedRooms:['room_missing'] } });
          } catch(err){
            thrown = err;
          }
          H.assert(thrown && thrown.quoteValidation === true && String(thrown.code || '') === 'selected_room_missing', 'Nieistniejące pomieszczenie nie zablokowało tworzenia wyceny', thrown);
          H.assert(Array.isArray(FC.quoteSnapshotStore.listForProject('proj_cross')) && FC.quoteSnapshotStore.listForProject('proj_cross').length === 0, 'Dla nieistniejącego pokoju powstał snapshot wyceny', FC.quoteSnapshotStore.readAll && FC.quoteSnapshotStore.readAll());
        });
      }),

      H.makeTest('Wycena', 'Puste pomieszczenie bez danych nie tworzy zerowej wyceny', 'Pilnuje, czy Wyceń zatrzymuje zapis, gdy wybrane pomieszczenie nie ma żadnych elementów, materiałów ani usług do policzenia.', async ()=>{
        await withInvestorProjectFixture({
          projectData:{
            schemaVersion: 2,
            meta: {
              roomDefs: {
                room_kuchnia_gora:{ id:'room_kuchnia_gora', baseType:'kuchnia', name:'Kuchnia góra', label:'Kuchnia góra' },
                room_salon:{ id:'room_salon', baseType:'pokoj', name:'Salon', label:'Salon' },
              },
              roomOrder:['room_kuchnia_gora','room_salon'],
            },
            room_kuchnia_gora:{ cabinets:[], fronts:[], sets:[], settings:{} },
            room_salon:{ cabinets:[], fronts:[], sets:[], settings:{} },
          },
          cutListFn: ()=> [],
        }, async ()=>{
          H.assert(FC.wycenaCore && typeof FC.wycenaCore.buildQuoteSnapshot === 'function', 'Brak FC.wycenaCore.buildQuoteSnapshot');
          let thrown = null;
          try{
            await FC.wycenaCore.buildQuoteSnapshot({ selection:{ selectedRooms:['room_salon'] } });
          } catch(err){
            thrown = err;
          }
          H.assert(thrown && thrown.quoteValidation === true && String(thrown.code || '') === 'empty_quote_scope', 'Puste pomieszczenie nie zablokowało zerowej wyceny', thrown);
          H.assert(Array.isArray(FC.quoteSnapshotStore.listForProject('proj_cross')) && FC.quoteSnapshotStore.listForProject('proj_cross').length === 0, 'Dla pustego pomieszczenia powstał snapshot wyceny', FC.quoteSnapshotStore.readAll && FC.quoteSnapshotStore.readAll());
        });
      }),

      H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Zmiana zaakceptowanej wyceny wspólnej na jednopomieszczeniową cofa pozostałe pokoje', 'Pilnuje regresję, w której po przełączeniu akceptacji z wyceny wspólnej na wycenę jednego pokoju inne pomieszczenia błędnie zostawały na statusie pomiar.', ()=>{
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.markSelectedForProject === 'function', 'Brak FC.quoteSnapshotStore.markSelectedForProject');
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.setProjectStatusFromSnapshot === 'function', 'Brak FC.wycenaTabDebug.setProjectStatusFromSnapshot');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const sharedPre = FC.quoteSnapshotStore.save({ id:'snap_shared_pre', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt przełączenie' }, scope:{ selectedRooms:['room_kuchnia_gora','room_salon'], roomLabels:['Kuchnia góra','Salon'] }, commercial:{ preliminary:true, versionName:'Wspólna pre' }, totals:{ grand:210 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820450000 });
          const kitchenPre = FC.quoteSnapshotStore.save({ id:'snap_kitchen_pre_only', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt przełączenie' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Kuchnia pre' }, totals:{ grand:105 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820460000 });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, sharedPre.id, { status:'pomiar' });
          FC.wycenaTabDebug.setProjectStatusFromSnapshot(sharedPre, 'pomiar');
          FC.quoteSnapshotStore.markSelectedForProject(projectId, kitchenPre.id, { status:'pomiar' });
          FC.wycenaTabDebug.setProjectStatusFromSnapshot(kitchenPre, 'pomiar');
          const investor = FC.investors.getById(investorId);
          const byId = Object.fromEntries((investor.rooms || []).map((room)=> [String(room && room.id || ''), room]));
          H.assert(String(byId.room_kuchnia_gora && byId.room_kuchnia_gora.projectStatus || '') === 'pomiar', 'Pokój z nowo zaakceptowaną wyceną jednopomieszczeniową stracił status pomiar', investor.rooms);
          H.assert(String(byId.room_salon && byId.room_salon.projectStatus || '') === 'nowy', 'Pokój zdjęty z akceptacji nie wrócił do wcześniejszego stanu, gdy nie ma własnej wyceny solo', { rooms:investor.rooms, all:FC.quoteSnapshotStore.listForProject(projectId) });
        });
      }),


      H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Po rozpięciu wspólnej akceptacji pokój z własną wyceną solo wraca do wstępnej wyceny', 'Pilnuje, czy po odpięciu wspólnej oferty system wraca dla pokoju do jego własnej historii solo, zamiast trzymać status po starej wycenie wspólnej albo cofać go za daleko.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.setProjectStatusFromSnapshot === 'function', 'Brak FC.wycenaTabDebug.setProjectStatusFromSnapshot');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const sharedPre = FC.quoteSnapshotStore.save({ id:'snap_shared_pre_restore', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt przywrócenie' }, scope:{ selectedRooms:['room_kuchnia_gora','room_salon'], roomLabels:['Kuchnia góra','Salon'] }, commercial:{ preliminary:true, versionName:'Wspólna pre' }, totals:{ grand:210 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820465000 });
          const kitchenPre = FC.quoteSnapshotStore.save({ id:'snap_kitchen_pre_restore', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt przywrócenie' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Kuchnia pre' }, totals:{ grand:105 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820466000 });
          const salonPre = FC.quoteSnapshotStore.save({ id:'snap_salon_pre_restore', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt przywrócenie' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Salon pre' }, totals:{ grand:115 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820467000 });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, sharedPre.id, { status:'pomiar' });
          FC.wycenaTabDebug.setProjectStatusFromSnapshot(sharedPre, 'pomiar');
          FC.quoteSnapshotStore.markSelectedForProject(projectId, kitchenPre.id, { status:'pomiar' });
          FC.wycenaTabDebug.setProjectStatusFromSnapshot(kitchenPre, 'pomiar');
          const investor = FC.investors.getById(investorId);
          const byId = Object.fromEntries((investor.rooms || []).map((room)=> [String(room && room.id || ''), room]));
          H.assert(String(byId.room_kuchnia_gora && byId.room_kuchnia_gora.projectStatus || '') === 'pomiar', 'Pokój z nowo zaakceptowaną wyceną solo stracił status pomiar', investor.rooms);
          H.assert(String(byId.room_salon && byId.room_salon.projectStatus || '') === 'wstepna_wycena', 'Pokój z własną wyceną solo nie wrócił do wstępnej wyceny po odpięciu wspólnej akceptacji', { rooms:investor.rooms, all:FC.quoteSnapshotStore.listForProject(projectId), salonPre });
        });
      }),

      H.makeTest('Wycena ↔ Inwestor', 'Manualna zmiana na pomiar jest blokowana bez zaakceptowanej wyceny wstępnej solo', 'Pilnuje, czy Inwestor nie podniesie pokoju na Pomiar tylko dlatego, że istnieje niezaakceptowana albo wspólna wycena zamiast zaakceptowanej podstawy solo.', ()=>{
        H.assert(FC.projectStatusManualGuard && typeof FC.projectStatusManualGuard.validateManualStatusChange === 'function', 'Brak FC.projectStatusManualGuard.validateManualStatusChange');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          FC.quoteSnapshotStore.save({ id:'snap_shared_pre_guard', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt guard' }, scope:{ selectedRooms:['room_kuchnia_gora','room_salon'], roomLabels:['Kuchnia góra','Salon'] }, commercial:{ preliminary:true, versionName:'Wspólna pre' }, totals:{ grand:220 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820468000 });
          const validationMissing = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'pomiar');
          H.assert(validationMissing && validationMissing.blocked === true && validationMissing.requiresGeneration === true && String(validationMissing.generationKind || '') === 'preliminary', 'Brak wyceny solo nie zablokował wejścia na Pomiar z propozycją wygenerowania wstępnej wyceny', validationMissing);
          const soloPre = FC.quoteSnapshotStore.save({ id:'snap_salon_pre_guard', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt guard' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Salon pre' }, totals:{ grand:118 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820469000 });
          const validationUnaccepted = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'pomiar');
          H.assert(validationUnaccepted && validationUnaccepted.blocked === true && validationUnaccepted.requiresGeneration === false, 'Niezaakceptowana wycena wstępna solo nie zablokowała ręcznego wejścia na Pomiar', { validationUnaccepted, soloPre });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, soloPre.id, { status:'pomiar', roomIds:['room_salon'] });
          const validationAccepted = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'pomiar');
          H.assert(validationAccepted && validationAccepted.ok === true && validationAccepted.blocked === false, 'Zaakceptowana wycena wstępna solo nie odblokowała ręcznego wejścia na Pomiar', validationAccepted);
        });
      }),

      H.makeTest('Wycena ↔ Inwestor', 'Manualna zmiana na zaakceptowany jest blokowana bez zaakceptowanej wyceny końcowej solo', 'Pilnuje, czy Inwestor nie ustawi pokoju jako zaakceptowany bez osobnej zaakceptowanej oferty końcowej dla tego pomieszczenia.', ()=>{
        H.assert(FC.projectStatusManualGuard && typeof FC.projectStatusManualGuard.validateManualStatusChange === 'function', 'Brak FC.projectStatusManualGuard.validateManualStatusChange');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const validationMissing = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'zaakceptowany');
          H.assert(validationMissing && validationMissing.blocked === true && validationMissing.requiresGeneration === true && String(validationMissing.generationKind || '') === 'final', 'Brak wyceny końcowej solo nie zablokował wejścia na Zaakceptowany z propozycją wygenerowania końcowej wyceny', validationMissing);
          const soloFinal = FC.quoteSnapshotStore.save({ id:'snap_salon_final_guard', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt final guard' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:false, versionName:'Salon final' }, totals:{ grand:180 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820470000 });
          const validationUnaccepted = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'zaakceptowany');
          H.assert(validationUnaccepted && validationUnaccepted.blocked === true && validationUnaccepted.requiresGeneration === false, 'Niezaakceptowana wycena końcowa solo nie zablokowała wejścia na Zaakceptowany', { validationUnaccepted, soloFinal });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, soloFinal.id, { status:'zaakceptowany', roomIds:['room_salon'] });
          const validationAccepted = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'zaakceptowany');
          H.assert(validationAccepted && validationAccepted.ok === true && validationAccepted.blocked === false, 'Zaakceptowana wycena końcowa solo nie odblokowała wejścia na Zaakceptowany', validationAccepted);
        });
      }),


      H.makeTest('Wycena ↔ Inwestor', 'Manualna zmiana na wycena jest blokowana bez zaakceptowanej wyceny wstępnej solo', 'Pilnuje, czy Inwestor nie przeskoczy ręcznie do statusu Wycena dla jednego pomieszczenia bez własnej zaakceptowanej wyceny wstępnej.', ()=>{
        H.assert(FC.projectStatusManualGuard && typeof FC.projectStatusManualGuard.validateManualStatusChange === 'function', 'Brak FC.projectStatusManualGuard.validateManualStatusChange');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const validationMissing = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'wycena');
          H.assert(validationMissing && validationMissing.blocked === true && validationMissing.requiresGeneration === true && String(validationMissing.generationKind || '') === 'preliminary', 'Brak wyceny wstępnej solo nie zablokował ręcznego wejścia na Wycena', validationMissing);
          const soloPre = FC.quoteSnapshotStore.save({ id:'snap_salon_pre_wycena_guard', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt wycena guard' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Salon pre wycena' }, totals:{ grand:119 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820471000 });
          const validationUnaccepted = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'wycena');
          H.assert(validationUnaccepted && validationUnaccepted.blocked === true && validationUnaccepted.requiresGeneration === false, 'Niezaakceptowana wycena wstępna solo nie zablokowała ręcznego wejścia na Wycena', { validationUnaccepted, soloPre });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, soloPre.id, { status:'pomiar', roomIds:['room_salon'] });
          const validationAccepted = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'wycena');
          H.assert(validationAccepted && validationAccepted.ok === true && validationAccepted.blocked === false, 'Zaakceptowana wycena wstępna solo nie odblokowała ręcznego wejścia na Wycena', validationAccepted);
        });
      }),

      H.makeTest('Wycena ↔ Inwestor', 'Manualna zmiana na pomiar i wycena pozostaje zablokowana także przy błędnie wyższym statusie pokoju', 'Pilnuje antyregresyjnie, czy pokój z omyłkowo wyższym statusem nie może już ręcznie wskoczyć na Pomiar albo Wycena bez własnej zaakceptowanej wyceny wstępnej solo.', ()=>{
        H.assert(FC.projectStatusManualGuard && typeof FC.projectStatusManualGuard.validateManualStatusChange === 'function', 'Brak FC.projectStatusManualGuard.validateManualStatusChange');
        H.assert(FC.investorPersistence && typeof FC.investorPersistence.updateInvestorRoom === 'function', 'Brak FC.investorPersistence.updateInvestorRoom');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const soloPre = FC.quoteSnapshotStore.save({ id:'snap_salon_pre_guard_high', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt guard high' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Salon pre high' }, totals:{ grand:119 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820471100 });
          FC.investorPersistence.updateInvestorRoom(investorId, 'room_salon', { projectStatus:'wycena' });
          const blockedPomiar = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'pomiar');
          const blockedWycena = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'wycena');
          H.assert(blockedPomiar && blockedPomiar.blocked === true && blockedPomiar.requiresGeneration === false, 'Niezaakceptowana wycena wstępna solo nie zablokowała wejścia na Pomiar przy błędnie wyższym statusie pokoju', { blockedPomiar, soloPre });
          H.assert(blockedWycena && blockedWycena.blocked === true && blockedWycena.requiresGeneration === false, 'Niezaakceptowana wycena wstępna solo nie zablokowała wejścia na Wycena przy błędnie wyższym statusie pokoju', { blockedWycena, soloPre });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, soloPre.id, { status:'pomiar', roomIds:['room_salon'] });
          const unlockedPomiar = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'pomiar');
          const unlockedWycena = FC.projectStatusManualGuard.validateManualStatusChange(investorId, 'room_salon', 'wycena');
          H.assert(unlockedPomiar && unlockedPomiar.blocked === false, 'Zaakceptowana wycena wstępna solo nie odblokowała wejścia na Pomiar przy wyższym bieżącym statusie', unlockedPomiar);
          H.assert(unlockedWycena && unlockedWycena.blocked === false, 'Zaakceptowana wycena wstępna solo nie odblokowała wejścia na Wycena przy wyższym bieżącym statusie', unlockedWycena);
        });
      }),

      H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Rozbicie wspólnej akceptacji odrzuca ofertę wspólną i odblokowuje solo wstępne', 'Pilnuje, czy po cofnięciu jednego pokoju z zaakceptowanej oferty wspólnej stara oferta wspólna traci akceptację jako odrzucona po zmianie zakresu, a solo wstępna wraca jako aktywny kandydat.', ()=>{
        H.assert(FC.investorPersistence && typeof FC.investorPersistence.setInvestorProjectStatus === 'function', 'Brak FC.investorPersistence.setInvestorProjectStatus');
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.isRejectedSnapshot === 'function', 'Brak FC.quoteSnapshotStore.isRejectedSnapshot');
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.isArchivedPreliminary === 'function', 'Brak FC.wycenaTabDebug.isArchivedPreliminary');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const sharedPre = FC.quoteSnapshotStore.save({ id:'snap_shared_pre_reject', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt reject' }, scope:{ selectedRooms:['room_kuchnia_gora','room_salon'], roomLabels:['Kuchnia góra','Salon'] }, commercial:{ preliminary:true, versionName:'Wspólna pre' }, totals:{ grand:230 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820472000 });
          const salonPre = FC.quoteSnapshotStore.save({ id:'snap_salon_pre_reject', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt reject' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Salon pre' }, totals:{ grand:117 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820473000 });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, sharedPre.id, { status:'pomiar' });
          FC.wycenaTabDebug.setProjectStatusFromSnapshot(sharedPre, 'pomiar');
          FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_kuchnia_gora', 'wstepna_wycena');
          const all = FC.quoteSnapshotStore.listForProject(projectId);
          const sharedAfter = all.find((row)=> String(row && row.id || '') === 'snap_shared_pre_reject');
          const salonAfter = all.find((row)=> String(row && row.id || '') === 'snap_salon_pre_reject');
          const investor = FC.investors.getById(investorId);
          const byId = Object.fromEntries((investor.rooms || []).map((room)=> [String(room && room.id || ''), room]));
          H.assert(sharedAfter && sharedAfter.meta && sharedAfter.meta.selectedByClient === false, 'Wspólna oferta nadal wisi jako zaakceptowana po rozbiciu zakresu', sharedAfter || all);
          H.assert(sharedAfter && FC.quoteSnapshotStore.isRejectedSnapshot(sharedAfter) === true && String(sharedAfter.meta && sharedAfter.meta.rejectedReason || '') === 'scope_changed', 'Wspólna oferta nie została oznaczona jako odrzucona po zmianie zakresu', sharedAfter || all);
          H.assert(salonAfter && FC.wycenaTabDebug.isArchivedPreliminary(salonAfter, all) === false && FC.quoteSnapshotStore.isRejectedSnapshot(salonAfter) === false, 'Solo wycena wstępna nadal jest zablokowana mimo odrzucenia wspólnej oferty', { salonAfter, all });
          H.assert(String(byId.room_kuchnia_gora && byId.room_kuchnia_gora.projectStatus || '') === 'wstepna_wycena', 'Pokój cofnięty z oferty wspólnej nie wrócił do statusu wstępnej wyceny', investor.rooms);
          H.assert(String(byId.room_salon && byId.room_salon.projectStatus || '') === 'wstepna_wycena', 'Drugi pokój nie wrócił do własnej historii solo po odrzuceniu wspólnej oferty', investor.rooms);
        });
      }),

      H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Status wyceny scoped nie zależy od pierwszego pokoju inwestora', 'Pilnuje, czy odczyt statusu oferty bierze pokoje z zakresu snapshotu zamiast przypadkowego pierwszego pomieszczenia inwestora.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.currentProjectStatus === 'function', 'Brak FC.wycenaTabDebug.currentProjectStatus');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const salonPre = FC.quoteSnapshotStore.save({
            id:'snap_scope_status_pre',
            investor:{ id:investorId },
            project:{ id:projectId, investorId, title:'Projekt fallback' },
            scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'], materialScopeMode:'both', materialScope:{ includeFronts:true, includeCorpus:true } },
            commercial:{ preliminary:true, versionName:'Salon pomiar' },
            totals:{ grand:90 },
            lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            generatedAt:1712820495000,
          });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, salonPre.id, { status:'pomiar', roomIds:['room_salon'] });
          FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_salon', 'pomiar');
          const snapshot = FC.quoteSnapshotStore.save({
            id:'snap_scope_status',
            investor:{ id:investorId },
            project:{ id:projectId, investorId, title:'Projekt fallback' },
            scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'], materialScopeMode:'both', materialScope:{ includeFronts:true, includeCorpus:true } },
            commercial:{ preliminary:true, versionName:'Salon pomiar' },
            totals:{ grand:90 },
            lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] },
            generatedAt:1712820500000,
          });
          const status = FC.wycenaTabDebug.currentProjectStatus(snapshot);
          H.assert(String(status || '') === 'pomiar', 'Status scoped oferty wrócił do pierwszego pokoju albo złego fallbacku zamiast do właściwego pomieszczenia', { status, investor:FC.investors.getById(investorId), snapshot });
        });
      }),


      H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Akceptacja solo pokoju nie odrzuca zaakceptowanej oferty innego solo pokoju', 'Pilnuje, czy akceptacja wyceny dla jednego pokoju nie odrzuca ani nie zdejmuje akceptacji z innego, rozłącznego scope projektu.', ()=>{
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.markSelectedForProject === 'function', 'Brak FC.quoteSnapshotStore.markSelectedForProject');
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getSelectedForProject === 'function', 'Brak FC.quoteSnapshotStore.getSelectedForProject');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const kitchenPre = FC.quoteSnapshotStore.save({ id:'snap_multi_accept_kitchen', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt multi accept' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Kuchnia pre multi' }, totals:{ grand:111 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820800000 });
          const salonPre = FC.quoteSnapshotStore.save({ id:'snap_multi_accept_salon', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt multi accept' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Salon pre multi' }, totals:{ grand:129 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820801000 });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, kitchenPre.id, { status:'pomiar', roomIds:['room_kuchnia_gora'] });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, salonPre.id, { status:'pomiar', roomIds:['room_salon'] });
          const all = FC.quoteSnapshotStore.listForProject(projectId);
          const kitchenAfter = all.find((row)=> String(row && row.id || '') === 'snap_multi_accept_kitchen');
          const salonAfter = all.find((row)=> String(row && row.id || '') === 'snap_multi_accept_salon');
          const selectedKitchen = FC.quoteSnapshotStore.getSelectedForProject(projectId, { roomIds:['room_kuchnia_gora'] });
          const selectedSalon = FC.quoteSnapshotStore.getSelectedForProject(projectId, { roomIds:['room_salon'] });
          H.assert(kitchenAfter && kitchenAfter.meta && kitchenAfter.meta.selectedByClient === true, 'Akceptacja salonu zdjęła akceptację z rozłącznej oferty kuchni', kitchenAfter || all);
          H.assert(salonAfter && salonAfter.meta && salonAfter.meta.selectedByClient === true, 'Oferta salonu nie została zaznaczona jako zaakceptowana', salonAfter || all);
          H.assert(kitchenAfter && FC.quoteSnapshotStore.isRejectedSnapshot(kitchenAfter) === false, 'Akceptacja salonu odrzuciła rozłączną ofertę kuchni', kitchenAfter || all);
          H.assert(selectedKitchen && String(selectedKitchen.id || '') === String(kitchenPre.id || ''), 'Scoped getSelectedForProject nie zwrócił zaakceptowanej oferty kuchni', { selectedKitchen, all });
          H.assert(selectedSalon && String(selectedSalon.id || '') === String(salonPre.id || ''), 'Scoped getSelectedForProject nie zwrócił zaakceptowanej oferty salonu', { selectedSalon, all });
        });
      }),


      H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Akceptacja solo pokoju nie nadpisuje statusu snapshotów rozłącznego scope', 'Pilnuje regresję po hotfixie multi-scope: zaznaczenie oferty dla pokoju A nie może zmieniać project.status wpisanego we snapshot pokoju B tylko dlatego, że oba siedzą pod jednym projectId.', ()=>{
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.markSelectedForProject === 'function', 'Brak FC.quoteSnapshotStore.markSelectedForProject');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const kitchenPre = FC.quoteSnapshotStore.save({ id:'snap_multi_status_kitchen', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt multi status' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Kuchnia status multi' }, totals:{ grand:111 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820802000 });
          const salonPre = FC.quoteSnapshotStore.save({ id:'snap_multi_status_salon', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt multi status' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Salon status multi' }, totals:{ grand:129 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820803000 });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, kitchenPre.id, { status:'pomiar', roomIds:['room_kuchnia_gora'] });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, salonPre.id, { status:'pomiar', roomIds:['room_salon'] });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, kitchenPre.id, { status:'pomiar', roomIds:['room_kuchnia_gora'] });
          const all = FC.quoteSnapshotStore.listForProject(projectId);
          const salonAfter = all.find((row)=> String(row && row.id || '') === 'snap_multi_status_salon');
          H.assert(String(salonAfter && salonAfter.project && salonAfter.project.status || '') === 'pomiar', 'Akceptacja kuchni nadpisała status snapshotu rozłącznego salonu', salonAfter || all);
          H.assert(salonAfter && salonAfter.meta && salonAfter.meta.selectedByClient === true, 'Akceptacja kuchni zdjęła zaznaczenie z rozłącznego salonu', salonAfter || all);
        });
      }),

      H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Konwersja wstępnej oferty do końcowej nie zdejmuje akceptacji z innego solo pokoju', 'Pilnuje regresję z filmu: przejście pokoju A z pomiaru do oferty końcowej nie może wyczyścić zaakceptowanej oferty pokoju B, jeśli scope są rozłączne.', ()=>{
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.convertPreliminaryToFinal === 'function', 'Brak FC.quoteSnapshotStore.convertPreliminaryToFinal');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const kitchenPre = FC.quoteSnapshotStore.save({ id:'snap_convert_multi_kitchen', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt convert multi' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Kuchnia convert multi' }, totals:{ grand:111 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820804000, meta:{ selectedByClient:true, acceptedAt:1712820804500, acceptedStage:'pomiar', preliminary:true } });
          const salonPre = FC.quoteSnapshotStore.save({ id:'snap_convert_multi_salon', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt convert multi' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Salon convert multi' }, totals:{ grand:129 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820805000, meta:{ selectedByClient:true, acceptedAt:1712820805500, acceptedStage:'pomiar', preliminary:true } });
          const converted = FC.quoteSnapshotStore.convertPreliminaryToFinal(projectId, kitchenPre.id);
          const all = FC.quoteSnapshotStore.listForProject(projectId);
          const kitchenAfter = all.find((row)=> String(row && row.id || '') === 'snap_convert_multi_kitchen');
          const salonAfter = all.find((row)=> String(row && row.id || '') === 'snap_convert_multi_salon');
          H.assert(converted && String(converted.id || '') === String(kitchenPre.id || ''), 'Konwersja kuchni nie zwróciła targetu', { converted, all });
          H.assert(kitchenAfter && kitchenAfter.meta && kitchenAfter.meta.selectedByClient === true && kitchenAfter.meta.preliminary === false, 'Konwersja kuchni nie ustawiła końcowej zaakceptowanej oferty', kitchenAfter || all);
          H.assert(salonAfter && salonAfter.meta && salonAfter.meta.selectedByClient === true, 'Konwersja kuchni zdjęła akceptację z rozłącznego salonu', salonAfter || all);
          H.assert(salonAfter && salonAfter.meta && salonAfter.meta.preliminary === true, 'Konwersja kuchni zmieniła typ rozłącznej oferty salonu', salonAfter || all);
          H.assert(String(salonAfter && salonAfter.project && salonAfter.project.status || '') !== 'zaakceptowany', 'Konwersja kuchni nadpisała status snapshotu rozłącznego salonu końcowym etapem kuchni', salonAfter || all);
        });
      }),

      H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Ręczna zmiana statusu pokoju wybiera tylko pasującą ofertę i nie rusza innych pokoi', 'Pilnuje, czy ręczne ustawienie statusu w Inwestor synchronizuje Wycena po zakresie pomieszczenia zamiast po dowolnej pierwszej ofercie projektu.', ()=>{
        H.assert(FC.investorPersistence && typeof FC.investorPersistence.setInvestorProjectStatus === 'function', 'Brak FC.investorPersistence.setInvestorProjectStatus');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          const kitchenPre = FC.quoteSnapshotStore.save({ id:'snap_room_kitchen_pre', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt ręczny' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'Kuchnia pre' }, totals:{ grand:100 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820600000 });
          const salonPre = FC.quoteSnapshotStore.save({ id:'snap_room_salon_pre', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt ręczny' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Salon pre' }, totals:{ grand:120 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820700000 });
          FC.quoteSnapshotStore.markSelectedForProject(projectId, salonPre.id, { status:'pomiar', roomIds:['room_salon'] });
          FC.investorPersistence.setInvestorProjectStatus(investorId, 'room_salon', 'pomiar');
          const investor = FC.investors.getById(investorId);
          const byId = Object.fromEntries((investor.rooms || []).map((room)=> [String(room && room.id || ''), room]));
          const selected = FC.quoteSnapshotStore.getSelectedForProject(projectId);
          H.assert(String(byId.room_kuchnia_gora && byId.room_kuchnia_gora.projectStatus || '') === 'wstepna_wycena', 'Ręczna zmiana statusu salonu zignorowała scoped historię kuchni albo nadpisała ją błędnym statusem', investor.rooms);
          H.assert(String(byId.room_salon && byId.room_salon.projectStatus || '') === 'pomiar', 'Ręczna zmiana statusu salonu nie zapisała się w docelowym pokoju', investor.rooms);
          H.assert(selected && String(selected.id || '') === String(salonPre.id || ''), 'Synchronizacja Wycena po ręcznej zmianie pokoju wybrała złą ofertę scoped', { selected, kitchenPre, salonPre, all:FC.quoteSnapshotStore.listForProject(projectId) });
        });
      }),

      H.makeTest('Wycena ↔ Statusy pomieszczeń', 'Scoped rekomendacja statusu po usunięciu oferty nie opiera się na innych pokojach', 'Pilnuje, czy cofanie statusu po usunięciu oferty bierze tylko snapshoty z tego samego zakresu pomieszczeń, a nie oferty innych pokoi.', ()=>{
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getRecommendedStatusForProject === 'function', 'Brak FC.quoteSnapshotStore.getRecommendedStatusForProject');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          FC.quoteSnapshotStore.save({ id:'snap_scope_pre_k', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt scoped rec' }, scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'] }, commercial:{ preliminary:true, versionName:'K pre' }, totals:{ grand:100 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820800000 });
          FC.quoteSnapshotStore.save({ id:'snap_scope_final_s', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt scoped rec' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:false, versionName:'S final' }, totals:{ grand:200 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820900000 });
          const recommendedKitchen = FC.quoteSnapshotStore.getRecommendedStatusForProject(projectId, 'zaakceptowany', { roomIds:['room_kuchnia_gora'] });
          const recommendedSalon = FC.quoteSnapshotStore.getRecommendedStatusForProject(projectId, 'zaakceptowany', { roomIds:['room_salon'] });
          H.assert(String(recommendedKitchen || '') === 'wstepna_wycena', 'Scoped rekomendacja dla kuchni została zanieczyszczona ofertą z innego pokoju', { recommendedKitchen, all:FC.quoteSnapshotStore.listForProject(projectId) });
          H.assert(String(recommendedSalon || '') === 'wycena', 'Scoped rekomendacja dla salonu nie zachowała jego własnej oferty końcowej', { recommendedSalon, all:FC.quoteSnapshotStore.listForProject(projectId) });
        });
      }),

      H.makeTest('Wycena ↔ Pomieszczenia ↔ ROZRYS', 'Wycena filtruje elementy dokładnie po zapisanym wyborze pomieszczeń', 'Pilnuje, czy po wyborze pokoi w Wycena agregacja bierze tylko te pokoje, a nie dorzuca formatek z innych pomieszczeń aktywnego projektu.', ()=>{
        H.assert(FC.wycenaCore && typeof FC.wycenaCore.collectElementLines === 'function', 'Brak FC.wycenaCore.collectElementLines');
        H.assert(FC.rozrys && typeof FC.rozrys.aggregatePartsForProject === 'function', 'Brak FC.rozrys.aggregatePartsForProject');
        withInvestorProjectFixture({
          cutListFn(cabinet, roomId){
            if(String(roomId || '') === 'room_kuchnia_gora') return [{ name:'Bok kuchnia', material:'Dąb kuchnia', a:72, b:56, qty:2 }];
            if(String(roomId || '') === 'room_salon') return [{ name:'Bok salon', material:'Jesion salon', a:60, b:40, qty:3 }];
            return [];
          }
        }, ()=>{
          const agg = FC.rozrys.aggregatePartsForProject(['room_salon']);
          const lines = FC.wycenaCore.collectElementLines({ selectedRooms:['room_salon'], materialScope:{ includeFronts:false, includeCorpus:true } });
          H.assert(Array.isArray(agg.materials) && agg.materials.length === 1 && String(agg.materials[0] || '') === 'Jesion salon', 'ROZRYS nie ograniczył agregacji do wybranego pokoju', agg);
          H.assert(Array.isArray(lines) && lines.length === 1, 'Wycena nie ograniczyła listy elementów do wybranego pokoju', lines);
          H.assert(String(lines[0].name || '') === 'Bok salon' && String(lines[0].materialLabel || '') === 'Jesion salon' && Number(lines[0].qty) === 3, 'Wycena zwróciła elementy z niewłaściwego pokoju albo złą ilość', lines[0]);
        });
      }),

      H.makeTest('Wycena ↔ Pomieszczenia ↔ ROZRYS', 'Pusty wybór pokoi w Wycena wraca do wszystkich aktywnych pomieszczeń bieżącego projektu', 'Pilnuje, czy gdy zapisany wybór jest pusty, Wycena bierze komplet realnych pokoi aktywnego inwestora, a nie pusty stan albo domyślne typy bazowe.', ()=>{
        H.assert(FC.wycenaCore && typeof FC.wycenaCore.collectElementLines === 'function', 'Brak FC.wycenaCore.collectElementLines');
        withInvestorProjectFixture({
          cutListFn(cabinet, roomId){
            if(String(roomId || '') === 'room_kuchnia_gora') return [{ name:'Kuchnia bok', material:'Biały mat', a:72, b:56, qty:1 }];
            if(String(roomId || '') === 'room_salon') return [{ name:'Salon bok', material:'Dąb artisan', a:65, b:45, qty:2 }];
            return [];
          }
        }, ()=>{
          const normalized = FC.wycenaCore.normalizeQuoteSelection({ selectedRooms:[], materialScope:{ includeFronts:false, includeCorpus:true } });
          const lines = FC.wycenaCore.collectElementLines({ selectedRooms:[], materialScope:{ includeFronts:false, includeCorpus:true } });
          H.assert(Array.isArray(normalized.selectedRooms) && normalized.selectedRooms.includes('room_kuchnia_gora') && normalized.selectedRooms.includes('room_salon'), 'Wycena nie wróciła do wszystkich aktywnych pokoi projektu', normalized);
          H.assert(Array.isArray(lines) && lines.length === 2, 'Wycena nie zebrała elementów ze wszystkich aktywnych pokoi po pustym wyborze', lines);
          H.assert(lines.some((row)=> String(row.name || '') === 'Kuchnia bok') && lines.some((row)=> String(row.name || '') === 'Salon bok'), 'Po pustym wyborze brakuje elementów z któregoś pokoju', lines);
        });
      }),

      H.makeTest('Wycena ↔ PDF', 'PDF budowany z zapisanej końcowej oferty zachowuje handlowy charakter po konwersji z wstępnej', 'Pilnuje, czy po konwersji zaakceptowanej wyceny wstępnej na końcową PDF nadal bierze tę samą wersję oferty, pokazuje pomieszczenia i nie wraca do technicznych formatek.', ()=>{
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.convertPreliminaryToFinal === 'function', 'Brak FC.quoteSnapshotStore.convertPreliminaryToFinal');
        H.assert(FC.quotePdf && typeof FC.quotePdf.buildPrintHtml === 'function', 'Brak FC.quotePdf.buildPrintHtml');
        const prev = FC.quoteSnapshotStore.readAll();
        try{
          FC.quoteSnapshotStore.writeAll([]);
          const prelim = FC.quoteSnapshotStore.save({
            id:'snap_pdf_cross_prelim',
            investor:{ id:'inv_pdf_cross', name:'Jan Test' },
            project:{ id:'proj_pdf_cross', investorId:'inv_pdf_cross', title:'Projekt PDF cross', status:'pomiar' },
            scope:{ selectedRooms:['room_kuchnia_gora'], roomLabels:['Kuchnia góra'], materialScopeMode:'corpus', materialScope:{ includeFronts:false, includeCorpus:true } },
            commercial:{ preliminary:true, versionName:'Wstępna oferta' },
            meta:{ selectedByClient:true, acceptedAt:1712820200000, acceptedStage:'pomiar' },
            lines:{
              elements:[{ name:'Bok', qty:2, width:720, height:560, materialLabel:'Biały mat' }],
              materials:[{ name:'Biały mat', qty:1, unit:'ark.' }],
              accessories:[{ name:'Zawias Blum', qty:4 }],
              agdServices:[{ name:'Piekarnik do zabudowy', qty:1 }],
              quoteRates:[{ name:'Montaż zabudowy', qty:1, unit:'x' }],
            },
            totals:{ grand:999, subtotal:999, discount:0, materials:0, accessories:0, services:0, quoteRates:0 },
            generatedAt:1712820200000,
          });
          FC.quoteSnapshotStore.convertPreliminaryToFinal('proj_pdf_cross', prelim.id);
          const selected = FC.quoteSnapshotStore.getSelectedForProject('proj_pdf_cross');
          const html = FC.quotePdf.buildPrintHtml(selected);
          H.assert(selected && selected.commercial && selected.commercial.preliminary === false, 'Konwersja nie zostawiła finalnej zapisanej oferty do PDF', selected);
          H.assert(/Wycena końcowa/.test(String(html || '')) && /Kuchnia góra/.test(String(html || '')), 'PDF po konwersji nie pokazuje końcowego typu oferty albo pomieszczeń', html);
          H.assert(/Biały mat/.test(String(html || '')) && /Zawias Blum/.test(String(html || '')) && /Montaż zabudowy/.test(String(html || '')) && /Piekarnik do zabudowy/.test(String(html || '')), 'PDF po konwersji zgubił handlowe sekcje materiałów / akcesoriów / usług / AGD', html);
          H.assert(!/Elementy w ofercie/.test(String(html || '')) && !/720 × 560 mm/.test(String(html || '')), 'PDF po konwersji wrócił do technicznej listy formatek', html);
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
      H.makeTest('Wycena', 'PDF wyceny buduje handlową ofertę bez technicznej listy formatek', 'Pilnuje, czy PDF dla klienta pokazuje tylko handlowe sekcje: materiały, akcesoria, usługi, AGD i cenę końcową, bez technicznej listy elementów / formatek.', ()=>{
        H.assert(FC.quotePdf && typeof FC.quotePdf.buildPrintHtml === 'function', 'Brak FC.quotePdf.buildPrintHtml');
        const html = FC.quotePdf.buildPrintHtml({
          investor:{ id:'inv_pdf', name:'Jan Test' },
          project:{ id:'proj_pdf', investorId:'inv_pdf', title:'Kuchnia testowa', status:'wycena ostateczna' },
          scope:{ roomLabels:['Kuchnia dół'], materialScopeMode:'corpus', materialScope:{ includeFronts:false, includeCorpus:true } },
          lines:{
            elements:[{ name:'Bok', qty:2, width:720, height:560, materialLabel:'Egger W1100 ST9 Biały Alpejski' }],
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
        H.assert(/Materiały \/ kolory/.test(String(html || '')) && /Egger W1100 ST9 Biały Alpejski/.test(String(html || '')), 'PDF wyceny nie zawiera listy materiałów / kolorów', html);
        H.assert(/Zawias Blum/.test(String(html || '')) && /4 szt\./.test(String(html || '')), 'PDF wyceny nie zawiera akcesoriów z ilościami', html);
        H.assert(/Piekarnik do zabudowy/.test(String(html || '')), 'PDF wyceny nie zawiera listy montowanych sprzętów AGD', html);
        H.assert(!/Elementy w ofercie/.test(String(html || '')) && !/720 × 560 mm/.test(String(html || '')) && !/Bok/.test(String(html || '')), 'PDF wyceny nadal pokazuje techniczną listę formatek / elementów', html);
      }),
    ]);
  }

  FC.wycenaDevTests = { runAll };
})(typeof window !== 'undefined' ? window : globalThis);
