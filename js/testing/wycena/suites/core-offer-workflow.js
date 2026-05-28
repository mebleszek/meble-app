(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  if(!(FC.testHarness && typeof FC.registerWycenaTests === 'function')) return;

  FC.registerWycenaTests(({ FC, H, clone, withInvestorProjectFixture })=> [
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

    H.makeTest('Wycena', 'Wyceń dla scope z istniejącą historią wymusza nazwę nowego wariantu', 'Pilnuje, czy kliknięcie Wyceń przy już istniejącej wycenie exact-scope uruchamia modal nazwy, żeby nie tworzyć kolejnych identycznie nazwanych wersji.', ()=>{
        H.assert(FC.wycenaTabDebug && typeof FC.wycenaTabDebug.shouldPromptForVersionNameOnGenerate === 'function', 'Brak FC.wycenaTabDebug.shouldPromptForVersionNameOnGenerate');
        withInvestorProjectFixture({}, ({ investorId, projectId })=>{
          FC.quoteSnapshotStore.save({ id:'snap_scope_prompt_1', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt scope prompt' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Wstępna oferta — Salon' }, totals:{ grand:114 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820445200 });
          const shouldPrompt = FC.wycenaTabDebug.shouldPromptForVersionNameOnGenerate({ selectedRooms:['room_salon'] }, { commercial:{ preliminary:true, versionName:'Wstępna oferta — Salon' } });
          H.assert(shouldPrompt === true, 'Wyceń nie wymusił nazwania nowego wariantu mimo istniejącej wyceny dla tego samego scope', shouldPrompt);
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
      })
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
