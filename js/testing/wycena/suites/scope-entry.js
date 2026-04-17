(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  if(!(FC.testHarness && typeof FC.registerWycenaTests === 'function')) return;

  FC.registerWycenaTests(({ FC, H, clone, withInvestorProjectFixture })=> [
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

    H.makeTest('Wycena ↔ Scope wejścia', 'Zmiana scope resetuje auto-nazwę poprzedniego exact-scope przed zapisaniem nowej wyceny', 'Pilnuje regresję z historią a / J / a+J: po przełączeniu wyboru pokoi draft nie może nieść starej nazwy wariantu z innego exact-scope i zapisać jej pod nowym zakresem.', async ()=>{
        H.assert(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.resolveVersionNameAfterRoomChange === 'function', 'Brak FC.wycenaTabSelection.resolveVersionNameAfterRoomChange');
        H.assert(FC.wycenaCore && typeof FC.wycenaCore.buildQuoteSnapshot === 'function', 'Brak FC.wycenaCore.buildQuoteSnapshot');
        await withInvestorProjectFixture({}, async ({ investorId, projectId })=>{
          FC.quoteSnapshotStore.save({ id:'snap_scope_prev_variant', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt scope switch' }, scope:{ selectedRooms:['room_salon'], roomLabels:['Salon'] }, commercial:{ preliminary:true, versionName:'Wstępna oferta — Salon — wariant 2' }, totals:{ grand:114 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820445150 });
          FC.quoteOfferStore.saveCurrentDraft({ selection:{ selectedRooms:['room_salon'] }, commercial:{ preliminary:true, versionName:'Wstępna oferta — Salon — wariant 2' } });
          const draft = FC.quoteOfferStore.getCurrentDraft();
          const nextVersionName = FC.wycenaTabSelection.resolveVersionNameAfterRoomChange({ selectedRooms:['room_salon'] }, ['room_kuchnia_gora'], draft, { getCurrentProjectId:()=> projectId });
          H.assert(String(nextVersionName || '') === 'Wstępna oferta — Kuchnia góra', 'Po zmianie scope draft nie wrócił do domyślnej nazwy nowego zakresu', nextVersionName);
          FC.quoteOfferStore.patchCurrentDraft({ selection:{ selectedRooms:['room_kuchnia_gora'] }, commercial:{ versionName:nextVersionName } });
          const snapshot = await FC.wycenaCore.buildQuoteSnapshot({ selection:{ selectedRooms:['room_kuchnia_gora'] } });
          H.assert(snapshot && snapshot.commercial && String(snapshot.commercial.versionName || '') === 'Wstępna oferta — Kuchnia góra', 'Nowa wycena przejęła starą nazwę wariantu z innego scope zamiast nazwy nowego pokoju', snapshot);
        });
      }),


    H.makeTest('Wycena ↔ Scope wejścia', 'Generate i historia prostują auto-nazwę z obcego scope dla a / J / a+J', 'Pilnuje dokładnie regresję z ekranu a / J / a+J: jeśli draft albo stary snapshot niesie auto-nazwę z pokoju J, to scope a oraz a+J dostają własną nazwę zamiast dalej udawać wariant J.', async ()=>{
        H.assert(FC.wycenaTabSelection && typeof FC.wycenaTabSelection.coerceVersionNameForSelection === 'function', 'Brak FC.wycenaTabSelection.coerceVersionNameForSelection');
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getEffectiveVersionName === 'function', 'Brak FC.quoteSnapshotStore.getEffectiveVersionName');
        await withInvestorProjectFixture({
          rooms:[
            { id:'room_a', baseType:'pokoj', name:'a', label:'a', projectStatus:'nowy' },
            { id:'room_j', baseType:'pokoj', name:'J', label:'J', projectStatus:'nowy' },
          ],
          projectData:{
            schemaVersion:2,
            meta:{
              roomDefs:{
                room_a:{ id:'room_a', baseType:'pokoj', name:'a', label:'a' },
                room_j:{ id:'room_j', baseType:'pokoj', name:'J', label:'J' },
              },
              roomOrder:['room_a','room_j'],
            },
            room_a:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} },
            room_j:{ cabinets:[{ id:'cab_j' }], fronts:[], sets:[], settings:{} },
          },
        }, async ({ investorId, projectId })=>{
          FC.quoteSnapshotStore.save({ id:'snap_scope_j_variant', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt a/J mix' }, scope:{ selectedRooms:['room_j'], roomLabels:['J'] }, commercial:{ preliminary:true, versionName:'Wstępna oferta — J — wariant 2' }, totals:{ grand:35 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820445201 });
          FC.quoteSnapshotStore.save({ id:'snap_scope_a_wrong', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt a/J mix' }, scope:{ selectedRooms:['room_a'], roomLabels:['a'] }, commercial:{ preliminary:true, versionName:'Wstępna oferta — J — wariant 2' }, totals:{ grand:35 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820445202 });
          FC.quoteSnapshotStore.save({ id:'snap_scope_shared_wrong', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt a/J mix' }, scope:{ selectedRooms:['room_a','room_j'], roomLabels:['a','J'] }, commercial:{ preliminary:true, versionName:'Wstępna oferta — J — wariant 2' }, totals:{ grand:70 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820445203 });

          const draft = { commercial:{ preliminary:true, versionName:'Wstępna oferta — J — wariant 2' } };
          const coercedA = FC.wycenaTabSelection.coerceVersionNameForSelection({ selectedRooms:['room_a'] }, draft, { getCurrentProjectId:()=> projectId });
          const coercedShared = FC.wycenaTabSelection.coerceVersionNameForSelection({ selectedRooms:['room_a','room_j'] }, draft, { getCurrentProjectId:()=> projectId });
          H.assert(String(coercedA || '') === 'Wstępna oferta — a', 'Generate nie wyprostował auto-nazwy dla scope a', coercedA);
          H.assert(String(coercedShared || '') === 'Wstępna oferta — a + J', 'Generate nie wyprostował auto-nazwy dla scope a + J', coercedShared);

          const snapA = FC.quoteSnapshotStore.getById('snap_scope_a_wrong');
          const snapShared = FC.quoteSnapshotStore.getById('snap_scope_shared_wrong');
          H.assert(String(FC.quoteSnapshotStore.getEffectiveVersionName(snapA) || '') === 'Wstępna oferta — a', 'Historia nadal pokazuje nazwę J dla scope a mimo exact-scope a', snapA);
          H.assert(String(FC.quoteSnapshotStore.getEffectiveVersionName(snapShared) || '') === 'Wstępna oferta — a + J', 'Historia nadal pokazuje nazwę J dla scope a + J mimo exact-scope shared', snapShared);
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

    H.makeTest('Wycena ↔ Scope wejścia', 'Modal nazwy nowej wyceny używa krótkiej treści i układu pół na pół', 'Pilnuje uzgodnionego UI modala: bez osobnego bloku Pomieszczenia, z inputem w stylu formularzy inwestora i z przyciskami Anuluj/OK w jednym rzędzie pół na pół.', async ()=>{
        H.assert(FC.quoteScopeEntry && typeof FC.quoteScopeEntry.promptNewVersionName === 'function', 'Brak FC.quoteScopeEntry.promptNewVersionName');
        await withInvestorProjectFixture({}, async ({ projectId })=>{
          if(typeof document === 'undefined' || !document || !document.body) return;
          const modalPromise = FC.quoteScopeEntry.promptNewVersionName({
            projectId,
            roomIds:['room_salon'],
            preliminary:true,
            title:'NAZWA NOWEJ WYCENY WSTĘPNEJ',
            message:'Dla zakresu „Salon” istnieje już wycena wstępna. Nadaj unikatową nazwę kolejnemu wariantowi.',
            hint:false,
            submitLabel:'OK',
            cancelLabel:'Anuluj',
          });
          await new Promise((resolve)=> setTimeout(resolve, 0));
          const dialog = document.querySelector('.quote-scope-entry-modal--name');
          H.assert(dialog, 'Nie otworzył się modal nazwy nowej wyceny');
          H.assert(dialog.classList.contains('panel-box'), 'Modal nazwy nie używa shellu panel-box z referencyjnych okien');
          H.assert(dialog.classList.contains('investor-card-sync'), 'Modal nazwy nie używa wzorca formularzy inwestora');
          H.assert(!!dialog.querySelector('.panel-box__head'), 'Modal nazwy nie renderuje nagłówka w shellu panel-box');
          H.assert(!!dialog.querySelector('.panel-box-form__footer'), 'Modal nazwy nie renderuje stopki jak referencyjne okna formularzowe');
          H.assert(!dialog.querySelector('.quote-scope-entry-modal__scope'), 'Modal nadal renderuje osobny blok Pomieszczenia');
          const input = dialog.querySelector('.quote-scope-entry-modal__input.investor-form-input');
          H.assert(input, 'Modal nazwy nie renderuje inputu w stylu inwestora');
          const actions = dialog.querySelector('.quote-scope-entry-modal__actions--split');
          H.assert(actions, 'Modal nazwy nie renderuje przycisków w układzie pół na pół');
          const buttons = Array.from(actions.querySelectorAll('button'));
          H.assert(buttons.length === 2, 'Modal nazwy nie ma dokładnie dwóch przycisków akcji', buttons.length);
          H.assert(buttons[0] && /Anuluj/i.test(String(buttons[0].textContent || '')), 'Pierwszy przycisk nie jest Anuluj', buttons.map((btn)=> btn.textContent));
          H.assert(buttons[1] && /OK/i.test(String(buttons[1].textContent || '')), 'Drugi przycisk nie jest OK', buttons.map((btn)=> btn.textContent));
          buttons[0].click();
          const result = await modalPromise;
          H.assert(result && result.cancelled === true, 'Modal nie zamknął się poprawnie po kliknięciu Anuluj', result);
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

    H.makeTest('Wycena ↔ Scope wejścia', 'Zapis wyceny prostuje auto-nazwę i etykiety zakresu dla obcego scope', 'Pilnuje główną regresję z a/J/a+J: jeśli draft albo payload niosą auto-nazwę J, zapis scope a lub a+J ma wyprostować nazwę i roomLabels do kanonicznego zakresu zamiast zachować stare J.', async ()=>{
        H.assert(FC.wycenaCore && typeof FC.wycenaCore.buildQuoteSnapshot === 'function', 'Brak FC.wycenaCore.buildQuoteSnapshot');
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getScopeRoomLabels === 'function', 'Brak FC.quoteSnapshotStore.getScopeRoomLabels');
        await withInvestorProjectFixture({
          rooms:[
            { id:'room_a', baseType:'pokoj', name:'a', label:'a', projectStatus:'nowy' },
            { id:'room_j', baseType:'pokoj', name:'J', label:'J', projectStatus:'nowy' },
          ],
          projectData:{
            schemaVersion:2,
            meta:{
              roomDefs:{
                room_a:{ id:'room_a', baseType:'pokoj', name:'a', label:'a' },
                room_j:{ id:'room_j', baseType:'pokoj', name:'J', label:'J' },
              },
              roomOrder:['room_a','room_j'],
            },
            room_a:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} },
            room_j:{ cabinets:[{ id:'cab_j' }], fronts:[], sets:[], settings:{} },
          },
        }, async ({ investorId, projectId })=>{
          FC.quoteSnapshotStore.save({ id:'snap_scope_seed_j', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt seed J' }, scope:{ selectedRooms:['room_j'], roomLabels:['J'] }, commercial:{ preliminary:true, versionName:'Wstępna oferta — J — wariant 2' }, totals:{ grand:35 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820446201 });

          FC.quoteOfferStore.saveCurrentDraft({ selection:{ selectedRooms:['room_a'] }, commercial:{ preliminary:true, versionName:'Wstępna oferta — J — wariant 2' } });
          const snapA = await FC.wycenaCore.buildQuoteSnapshot({ selection:{ selectedRooms:['room_a'] } });
          H.assert(String(snapA && snapA.commercial && snapA.commercial.versionName || '') === 'Wstępna oferta — a', 'Zapis scope a nie wyprostował auto-nazwy do własnego zakresu', snapA);
          H.assert(JSON.stringify(FC.quoteSnapshotStore.getScopeRoomLabels(snapA)) === JSON.stringify(['a']), 'Zapis scope a nie wyprostował roomLabels do kanonicznego zakresu', snapA && snapA.scope);

          FC.quoteOfferStore.saveCurrentDraft({ selection:{ selectedRooms:['room_a','room_j'] }, commercial:{ preliminary:true, versionName:'Wstępna oferta — J — wariant 2' } });
          const snapShared = await FC.wycenaCore.buildQuoteSnapshot({ selection:{ selectedRooms:['room_a','room_j'] } });
          H.assert(String(snapShared && snapShared.commercial && snapShared.commercial.versionName || '') === 'Wstępna oferta — a + J', 'Zapis scope a + J nie wyprostował auto-nazwy do wspólnego zakresu', snapShared);
          H.assert(JSON.stringify(FC.quoteSnapshotStore.getScopeRoomLabels(snapShared)) === JSON.stringify(['a','J']), 'Zapis scope a + J nie wyprostował roomLabels do wspólnego zakresu', snapShared && snapShared.scope);
        });
      }),

    H.makeTest('Wycena ↔ Scope wejścia', 'Historia i odczyt snapshotu ignorują stare roomLabels i auto-nazwę z innego scope', 'Pilnuje, żeby błędnie zapisane stare snapshoty z roomLabels/nazwą J były prostowane przy odczycie historii dla scope a oraz a+J.', ()=>{
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getEffectiveVersionName === 'function', 'Brak FC.quoteSnapshotStore.getEffectiveVersionName');
        H.assert(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getScopeRoomLabels === 'function', 'Brak FC.quoteSnapshotStore.getScopeRoomLabels');
        withInvestorProjectFixture({
          rooms:[
            { id:'room_a', baseType:'pokoj', name:'a', label:'a', projectStatus:'nowy' },
            { id:'room_j', baseType:'pokoj', name:'J', label:'J', projectStatus:'nowy' },
          ],
          projectData:{
            schemaVersion:2,
            meta:{
              roomDefs:{
                room_a:{ id:'room_a', baseType:'pokoj', name:'a', label:'a' },
                room_j:{ id:'room_j', baseType:'pokoj', name:'J', label:'J' },
              },
              roomOrder:['room_a','room_j'],
            },
            room_a:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} },
            room_j:{ cabinets:[{ id:'cab_j' }], fronts:[], sets:[], settings:{} },
          },
        }, ({ investorId, projectId })=>{
          FC.quoteSnapshotStore.save({ id:'snap_scope_hist_j', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt scope hist' }, scope:{ selectedRooms:['room_j'], roomLabels:['J'] }, commercial:{ preliminary:true, versionName:'Wstępna oferta — J — wariant 2' }, totals:{ grand:35 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820446301 });
          FC.quoteSnapshotStore.save({ id:'snap_scope_hist_a_bad', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt scope hist' }, scope:{ selectedRooms:['room_a'], roomLabels:['J'] }, commercial:{ preliminary:true, versionName:'Wstępna oferta — J — wariant 2' }, totals:{ grand:35 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820446302 });
          FC.quoteSnapshotStore.save({ id:'snap_scope_hist_shared_bad', investor:{ id:investorId }, project:{ id:projectId, investorId, title:'Projekt scope hist' }, scope:{ selectedRooms:['room_a','room_j'], roomLabels:['J'] }, commercial:{ preliminary:true, versionName:'Wstępna oferta — J — wariant 2' }, totals:{ grand:70 }, lines:{ materials:[], accessories:[], agdServices:[], quoteRates:[] }, generatedAt:1712820446303 });
          const snapA = FC.quoteSnapshotStore.getById('snap_scope_hist_a_bad');
          const snapShared = FC.quoteSnapshotStore.getById('snap_scope_hist_shared_bad');
          H.assert(JSON.stringify(FC.quoteSnapshotStore.getScopeRoomLabels(snapA)) === JSON.stringify(['a']), 'Odczyt snapshotu a nie wyprostował roomLabels z błędnego J', snapA && snapA.scope);
          H.assert(JSON.stringify(FC.quoteSnapshotStore.getScopeRoomLabels(snapShared)) === JSON.stringify(['a','J']), 'Odczyt snapshotu a + J nie wyprostował roomLabels z błędnego J', snapShared && snapShared.scope);
          H.assert(String(FC.quoteSnapshotStore.getEffectiveVersionName(snapA) || '') === 'Wstępna oferta — a', 'Historia nadal pokazuje nazwę J dla scope a', snapA);
          H.assert(String(FC.quoteSnapshotStore.getEffectiveVersionName(snapShared) || '') === 'Wstępna oferta — a + J', 'Historia nadal pokazuje nazwę J dla scope a + J', snapShared);
        });
      })

  ]);
})(typeof window !== 'undefined' ? window : globalThis);
