(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  FC.rozrysDevTestSuites = FC.rozrysDevTestSuites || {};

  FC.rozrysDevTestSuites.stateUiRuntime = function stateUiRuntime(ctx){
    ctx = ctx || {};
    const localHost = ctx.host || root || (typeof window !== 'undefined' ? window : globalThis);
    const FC = ctx.FC || localHost.FC || {};
    const host = localHost;
    const Fx = ctx.Fx;
    const assert = ctx.assert;
    const makeTest = ctx.makeTest;
    const fallbackPartSignature = ctx.fallbackPartSignature;
    const defaultRotationAllowed = ctx.defaultRotationAllowed;
    const withIsolatedLocalStorage = ctx.withIsolatedLocalStorage;
    const readAssetSource = ctx.readAssetSource;
    const getRozrysStartupOrderSource = ctx.getRozrysStartupOrderSource;
    const createFakeNode = ctx.createFakeNode;
    const installFakeDom = ctx.installFakeDom;
    const collectNodes = ctx.collectNodes;
    const withPatchedProjectFixture = ctx.withPatchedProjectFixture;
    const withPatchedRoomRegistry = ctx.withPatchedRoomRegistry;
    const withPatchedUiState = ctx.withPatchedUiState;
    const buildPrintDeps = ctx.buildPrintDeps;

    return [
      makeTest('Stan i wybór', 'Domyślne obrównanie rozrysu startuje od 1 cm / 10 mm', 'Pilnuje, czy fallback opcji rozkroju jest chroniony także w bezpośrednim smoke ROZRYS, a nie tylko pośrednio w APP smoke.', ()=>{
        assert(FC.rozrysStock && typeof FC.rozrysStock.getDefaultRozrysOptionValues === 'function', 'Brak getDefaultRozrysOptionValues');
        const cm = FC.rozrysStock.getDefaultRozrysOptionValues('cm');
        const mm = FC.rozrysStock.getDefaultRozrysOptionValues('mm');
        assert(Number(cm && cm.trim) === 1, 'Domyślne obrównanie dla cm nie wynosi 1', cm);
        assert(Number(mm && mm.trim) === 10, 'Domyślne obrównanie dla mm nie wynosi 10', mm);
        assert(FC.rozrysState && typeof FC.rozrysState.buildBaseStateFromControls === 'function', 'Brak rozrysState.buildBaseStateFromControls');
        const built = FC.rozrysState.buildBaseStateFromControls({ unitSel:{ value:'cm' }, edgeSel:{ value:'0' }, inW:{ value:'' }, inH:{ value:'' }, inK:{ value:'' }, inTrim:{ value:'' }, inMinW:{ value:'' }, inMinH:{ value:'' }, heurSel:{ value:'max' }, dirSel:{ value:'start-optimax' } });
        assert(Number(built.edgeTrim) === 1, 'Fallback edgeTrim z buildBaseStateFromControls nie wynosi 1 cm', built);
      }),
      makeTest('Stan i wybór', 'Store ROZRYS zapamiętuje selection/options/ui/cache', 'Sprawdza, czy wspólny stan ROZRYS nie gubi wyboru pomieszczeń, zakresu materiału, opcji, UI i cache.', ()=>{
        const store = FC.rozrysState.createStore({
          selectedRooms:['Salon'],
          options:{ unit:'cm', heur:'optimax' },
          ui:{ buttonMode:'running', running:true },
          cache:{ lastAutoRenderHit:true, lastScopeKey:'abc' },
        });
        store.setSelectedRooms(['Salon', 'Kuchnia']);
        store.setAggregate({ byMaterial:{}, materials:['MDF'], groups:{}, selectedRooms:['Salon', 'Kuchnia'] });
        store.setMaterialScope({ kind:'material', material:'MDF', includeFronts:false, includeCorpus:true });
        const selection = store.getSelection();
        assert(selection.selectedRooms.length === 2, 'Store nie trzyma selectedRooms');
        assert(selection.materialScope.kind === 'material', 'Store zgubił materialScope');
        assert(store.getOptionState().heur === 'optimax', 'Store zgubił options');
        assert(store.getUiState().running === true, 'Store zgubił ui.running');
        assert(store.getCacheState().lastAutoRenderHit === true, 'Store zgubił cache flag');
      }),
      makeTest('Stan i wybór', 'Store scala częściowe zmiany bez gubienia reszty stanu', 'Sprawdza, czy częściowa zmiana UI albo opcji nie zeruje wcześniej zapisanego selection albo cache.', ()=>{
        const store = FC.rozrysState.createStore({
          selectedRooms:['Kuchnia'],
          options:{ unit:'mm', heur:'simple', kerf:4 },
          ui:{ buttonMode:'idle', running:false },
          cache:{ lastAutoRenderHit:false, lastScopeKey:'scope-a' },
        });
        store.setUiState({ running:true });
        store.patchOptionState({ heur:'optimax' });
        assert(store.getSelection().selectedRooms[0] === 'Kuchnia', 'Częściowy update zgubił selection', store.getSelection());
        assert(store.getCacheState().lastScopeKey === 'scope-a', 'Częściowy update zgubił cache', store.getCacheState());
        assert(store.getUiState().running === true, 'UI nie przyjęło częściowego update', store.getUiState());
        assert(store.getOptionState().heur === 'optimax', 'Options nie przyjęły częściowego update', store.getOptionState());
        assert(store.getOptionState().kerf === 4, 'Options zgubiły poprzedni kerf', store.getOptionState());
      }),


      makeTest('UI i styl', 'Mały kafelek zakresu materiału dostaje modifier zgodny z wyborem pomieszczeń', 'Sprawdza, czy mały kafelek Fronty/Korpusy w wyborze materiału nadal używa wspólnego wzorca checkbox-chip, który będzie referencją także dla dużych chipów pomieszczeń.', ()=>{
        assert(FC.rozrysSelectionUi && typeof FC.rozrysSelectionUi.createController === 'function', 'Brak FC.rozrysSelectionUi.createController');
        const created = [];
        const ctx = {
          h(tag, attrs){
            const node = createFakeNode(tag, attrs);
            created.push(node);
            return node;
          },
        };
        const controller = FC.rozrysSelectionUi.createController(ctx, {});
        const holder = createFakeNode('div', {});
        const draftScope = { includeFronts:false, includeCorpus:true };
        controller.buildScopeDraftControls(holder, draftScope, true, true, { allowEmpty:true, onChange:()=>{} });
        const chips = created.filter((node)=> node.classList && node.classList.contains('rozrys-scope-chip'));
        assert(chips.length === 2, 'Builder nie utworzył dwóch małych kafelków zakresu materiału', { created: created.map((node)=> node.className || node.tagName) });
        chips.forEach((chip)=>{
          assert(chip.classList.contains('rozrys-scope-chip--room-match'), 'Mały kafelek nie dostał modifiera zgodnego z wyborem pomieszczeń', { className: chip.className });
        });
        const checkedChip = chips.find((chip)=> chip.classList.contains('is-checked'));
        assert(checkedChip, 'Zaznaczony draft nie ustawił stanu is-checked na żadnym małym kafelku', { chips: chips.map((chip)=> chip.className), draftScope });
      }),
      makeTest('UI i styl', 'CSS małego kafelka materiału nadpisuje zieloną ramkę na neutralny styl kafelka pomieszczeń', 'Sprawdza, czy mały kafelek materiału ma tylko dwa stany: bazowy/odznaczony oraz zaznaczony, bez zielonej ramki i bez zmiany koloru tekstu.', ()=>{
        const css = readAssetSource('css/rozrys-scope-chip-room-sync.css');
        assert(css && css.includes('.rozrys-scope-chip--room-match.is-checked'), 'Brak pliku albo selektora sync dla małego kafelka materiału');
        assert(/border-color:\s*#cfd8e3/i.test(css), 'Sync CSS nie przywraca neutralnej ramki kafelka', { css });
        assert(!/16a34a/i.test(css), 'Sync CSS zawiera zielony kolor aktywnego kafelka, więc regresja może wrócić', { css });
        assert(/color:\s*(inherit|#0f172a)/i.test(css), 'Sync CSS nie przywraca neutralnego koloru tekstu', { css });
      }),

      makeTest('UI i styl', 'Picker pomieszczeń używa dokładnie bazowego markupu scope-chip bez legacy picker-check', 'Sprawdza, czy opcje Kuchnia/Szafa/Pokój/Łazienka renderują się na tym samym bazowym markupie co Fronty/Korpusy, bez legacy klasy picker-check i bez mutowania window.document.', ()=>{
        assert(FC.rozrysPickers && typeof FC.rozrysPickers.openRoomsPicker === 'function', 'Brak FC.rozrysPickers.openRoomsPicker');
        const prevPanelBox = FC.panelBox;
        const opened = [];
        const fakeDoc = { createElement:(tag)=> createFakeNode(tag, {}) };
        FC.panelBox = {
          open(config){ opened.push(config); },
          close(){}
        };
        try{
          FC.rozrysPickers.openRoomsPicker({
            getSelectedRooms: ()=> ['kuchnia'],
            setSelectedRooms: ()=> {},
            getRooms: ()=> ['kuchnia', 'szafa'],
            normalizeRoomSelection: (rooms)=> Array.isArray(rooms) ? rooms.slice() : [],
            roomLabel: (room)=> room === 'kuchnia' ? 'Kuchnia' : 'Szafa',
            refreshSelectionState: ()=> {},
            askConfirm: ()=> true,
            doc: fakeDoc,
          });
        }finally{
          FC.panelBox = prevPanelBox;
        }
        assert(opened.length === 1, 'Picker pomieszczeń nie otworzył panel-boxa');
        const chips = collectNodes(opened[0].contentNode, (node)=> node.classList && node.classList.contains('rozrys-scope-chip--room-option'));
        assert(chips.length === 2, 'Picker pomieszczeń nie wyrenderował dwóch dużych chipów pomieszczeń', { count: chips.length });
        chips.forEach((chip)=>{
          assert(chip.classList.contains('rozrys-scope-chip'), 'Chip pomieszczenia nie używa bazowego stylu scope-chip', { className: chip.className });
          assert(chip.classList.contains('rozrys-scope-chip--room-match'), 'Chip pomieszczenia nie używa neutralnego stanu room-match', { className: chip.className });
          assert(!chip.classList.contains('rozrys-picker-check'), 'Chip pomieszczenia nadal używa legacy klasy rozrys-picker-check zamiast bazowego markupu scope-chip', { className: chip.className });
        });
        assert(chips[0].classList.contains('is-checked'), 'Zaznaczone pomieszczenie nie dostaje klasy is-checked', { className: chips[0].className });
      }),
      makeTest('UI i styl', 'CSS dużego chipa pomieszczeń utrzymuje stan jak w materiale i nie zostawia grubszego obrysu po kliknięciu', 'Sprawdza, czy duży wariant stylu scope-chip dla pomieszczeń ma dokładnie dwa stany jak w materiale: bazowy/odznaczony i zaznaczony, a sticky hover na mobile nie zostawia trzeciego stanu obrysu po tapnięciu.', ()=>{
        const css = readAssetSource('css/rozrys-checkbox-chip-pattern.css');
        assert(css && css.includes('.rozrys-scope-chip--room-option'), 'Brak pliku albo wariantu room-option dla dużego chipa pomieszczeń');
        assert(/\.rozrys-scope-chip--room-option\{[\s\S]*border-color:\s*#dbe7f3/i.test(css), 'Pattern CSS nie ustawia jaśniejszej domyślnej ramki dużego chipa pomieszczeń', { css });
        assert(/\.rozrys-scope-chip--room-option\.is-checked[\s\S]*border-color:\s*#cfd8e3/i.test(css), 'Pattern CSS nie ustawia ciemniejszej ramki po zaznaczeniu dużego chipa pomieszczeń', { css });
        assert(/@media \(hover:hover\) and \(pointer:fine\)[\s\S]*\.rozrys-scope-chip--room-option:hover/i.test(css), 'Pattern CSS nie ogranicza hover do urządzeń z prawdziwym hover, więc na mobile może zostawać trzeci stan obrysu po tapnięciu', { css });
        assert(/\.rozrys-scope-chip--room-option:focus-within::before[\s\S]*opacity:\s*0/i.test(css), 'Pattern CSS nie zeruje nakładki focus/active dla dużego chipa pomieszczeń, więc może wracać grubszy obrys po kliknięciu', { css });
        assert(!/16a34a/i.test(css), 'Pattern CSS dla dużego chipa pomieszczeń zawiera zielony aktywny kolor, więc regresja może wrócić', { css });
      }),

      makeTest('UI i styl', 'Checkbox-chip ma ciaśniejszy mały wariant bez ruszania checkboxa', 'Sprawdza, czy mały checkbox-chip dostał delikatnie ciaśniejsze odstępy góra/dół i z lewej, aby lepiej mieścił się na telefonie, bez zmiany większego wariantu pomieszczeń i bez przesuwania checkboxa w prawo.', ()=>{
        const baseCss = readAssetSource('css/rozrys-reference-sync.css');
        const roomCss = readAssetSource('css/rozrys-checkbox-chip-pattern.css');
        assert(/\.rozrys-scope-chip\{[\s\S]*min-height:\s*44px[\s\S]*padding:\s*10px 12px 10px 10px/i.test(baseCss), 'Bazowy checkbox-chip nie ma jeszcze ciaśniejszego układu 44px i paddingu 10/12/10/10 dla małych przycisków', { baseCss });
        assert(/\.rozrys-scope-chip--room-option\{[\s\S]*min-height:\s*56px[\s\S]*padding:\s*16px 16px[\s\S]*border-radius:\s*14px/i.test(roomCss), 'Duży checkbox-chip pomieszczeń nie zachował większego wariantu 16/16 albo nadal ma zbyt okrągłe narożniki zamiast takich jak małe pola', { roomCss });
        assert(/\.rozrys-room-chip__top\{[\s\S]*min-height:\s*24px/i.test(roomCss), 'Wewnętrzny rząd dużego checkbox-chipa pomieszczeń nadal wymusza zbyt wysokie minimum i psuje proporcje pionowe', { roomCss });
      }),

      makeTest('UI i styl', 'Zaznaczony checkbox-chip dostaje delikatny lift i gradient bez trzeciego stanu', 'Sprawdza, czy nowy moduł akcentu wzmacnia tylko stan zaznaczony całego przycisku i samego checkboxa, bez zmiany bazowego stanu odznaczonego.', ()=>{
        const css = readAssetSource('css/rozrys-checkbox-chip-selected-accent.css');
        assert(css && css.includes('.rozrys-scope-chip.is-checked'), 'Brak pliku albo selektora akcentu zaznaczonego checkbox-chipa');
        assert(/\.rozrys-scope-chip\.is-checked[\s\S]*linear-gradient/i.test(css), 'Accent CSS nie dodaje delikatnego gradientu całego zaznaczonego chipa', { css });
        assert(/\.rozrys-scope-chip\.is-checked[\s\S]*0 0 0 1px/i.test(css), 'Accent CSS nie wzmacnia obrysu zaznaczonego chipa', { css });
        assert(/input\[type='checkbox'\]:checked[\s\S]*linear-gradient/i.test(css), 'Accent CSS nie wzmacnia zaznaczonego checkboxa', { css });
      }),



      makeTest('UI i styl', 'Opcje rozkroju zachowują układ, ale mają tylko dopasowany wygląd pól', 'Sprawdza, czy modal Opcje rozkroju nadal używa wspólnego shellu ROZRYS i wklęsłych pól, ale bez pomocniczych napisów „Kliknij, aby wybrać” i bez strzałek w launcherach wyboru.', ()=>{
        const css = readAssetSource('css/rozrys-panel-modal-sync.css');
        assert(css && css.includes('.rozrys-panel-form--options'), 'Brak modułu stylu dla opcji rozkroju', { css });
        assert(/\.rozrys-panel-form--options[\s\S]*input:not\(\[type='checkbox'\]\):not\(\[type='radio'\]\)[\s\S]*linear-gradient/i.test(css), 'Inputy w Opcjach rozkroju nie mają wklęsłego tła', { css });
        assert(/\.rozrys-panel-form--options[\s\S]*input:not\(\[type='checkbox'\]\):not\(\[type='radio'\]\)[\s\S]*box-shadow:\s*inset/i.test(css), 'Inputy w Opcjach rozkroju nie mają wklęsłego cienia inset', { css });
        assert(/\.rozrys-panel-form--options[\s\S]*\.rozrys-choice-launch--options-clean/.test(css), 'Launcher wyboru w Opcjach rozkroju nie ma jeszcze czystego wariantu bez dodatków', { css });
        assert(/\.rozrys-choice-launch--options-clean \.rozrys-choice-launch__meta[\s\S]*display:none/i.test(css), 'W launcherze opcji nadal nie jest ukrywany pomocniczy napis', { css });
        assert(/\.rozrys-choice-launch--options-clean \.rozrys-choice-launch__arrow[\s\S]*display:none/i.test(css), 'W launcherze opcji nadal nie jest ukrywana strzałka', { css });
        const optionsJs = readAssetSource('js/app/rozrys/rozrys-options-modal.js');
        assert(/class:'rozrys-panel-form rozrys-panel-form--options rozrys-panel-form--inset'/.test(optionsJs), 'Modal Opcje rozkroju nie używa wydzielonego shellu formularza', { optionsJs });
        assert(/class:'grid-2 rozrys-panel-grid rozrys-panel-grid--options'/.test(optionsJs), 'Modal Opcje rozkroju nie używa wspólnej klasy siatki opcji', { optionsJs });
        assert(/\.rozrys-panel-grid--options\{[\s\S]*grid-template-columns:136px minmax\(0, 1fr\)/.test(css), 'Siatka opcji rozkroju nie ma węższej lewej kolumny i elastycznej prawej', { css });
        assert(/rozrys-choice-launch--options-clean/.test(optionsJs), 'Modal Opcje rozkroju nie nadaje launcherom czystej klasy bez strzałek i helpera', { optionsJs });
        assert(!/Kliknij, aby wybrać/.test(optionsJs), 'Modal Opcje rozkroju nadal wstrzykuje helper „Kliknij, aby wybrać”', { optionsJs });
        assert(/rozrys-panel-input--options-left/.test(optionsJs), 'Modal Opcje rozkroju nie oznacza jeszcze lewego pola jako węższego wariantu', { optionsJs });
        assert(/rozrys-panel-input--options-right/.test(optionsJs), 'Modal Opcje rozkroju nie oznacza jeszcze prawego pola jako pełnej szerokości kolumny', { optionsJs });
        assert(/rozrys-panel-inline--options-pair/.test(optionsJs), 'Modal Opcje rozkroju nie ma równego układu par dolnych pól', { optionsJs });
        assert(/const modalBoardWrap = h\('div', \{ class:'rozrys-panel-field rozrys-panel-field--full rozrys-panel-field--pair rozrys-panel-field--options-row-c' \}\);/.test(optionsJs), 'Format bazowy arkusza nie jest już pełnym wierszem z parą pól', { optionsJs });
        assert(/form\.appendChild\(modalUnitWrap\);[\s\S]*form\.appendChild\(modalEdgeWrap\);[\s\S]*form\.appendChild\(modalKerfWrap\);[\s\S]*form\.appendChild\(modalTrimWrap\);[\s\S]*form\.appendChild\(modalBoardWrap\);[\s\S]*form\.appendChild\(modalMinWrap\);/.test(optionsJs), 'Kolejność wierszy w Opcjach rozkroju nie jest jeszcze: jednostki+wymiary, rzaz+obrównanie, format bazowy, najmniejszy odpad', { optionsJs });
        assert(!/\.rozrys-panel-field--options-row-b \.label-help\{[\s\S]*min-height:/i.test(css), 'Shell opcji nadal nadpisuje drugi rząd etykiet innym min-height zamiast trzymać go jak pozostałe pola', { css });
        assert(/\.rozrys-panel-inline--options-pair\{[\s\S]*grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)/.test(css), 'Shell opcji nie trzyma jeszcze równych dolnych par pól', { css });
      }),


      makeTest('UI i styl', 'Dodaj płytę do magazynu używa shellu formularza zgodnego z ROZRYS', 'Sprawdza, czy modal Dodaj płytę do magazynu dostał wydzielony shell formularza, wklęsłe pola i własny rytm siatki, bez zmiany logiki pracy formularza.', ()=>{
        const css = readAssetSource('css/rozrys-stock-modal-sync.css');
        assert(css && css.includes('.rozrys-panel-form--stock'), 'Brak modułu stylu dla modala Dodaj płytę do magazynu', { css });
        assert(/\.rozrys-panel-form--stock[\s\S]*input:not\(\[type='checkbox'\]\):not\(\[type='radio'\]\)[\s\S]*linear-gradient/i.test(css), 'Pola wpisywane w modalu Dodaj płytę do magazynu nie mają wklęsłego tła', { css });
        assert(/\.rozrys-panel-form--stock[\s\S]*input:not\(\[type='checkbox'\]\):not\(\[type='radio'\]\)[\s\S]*box-shadow:\s*inset/i.test(css), 'Pola wpisywane w modalu Dodaj płytę do magazynu nie mają wklęsłego cienia inset', { css });
        assert(/\.rozrys-panel-grid--stock\{[\s\S]*grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)/.test(css), 'Modal Dodaj płytę do magazynu nie ma jeszcze własnej dwu-kolumnowej siatki stock', { css });
        assert(/\.rozrys-panel-form--stock \.rozrys-panel-input--compact\{[\s\S]*width:min\(100%, 168px\)/.test(css), 'Modal Dodaj płytę do magazynu nie ogranicza jeszcze sensownie szerokości pola ilości', { css });
        const stockJs = readAssetSource('js/app/rozrys/rozrys-stock-modal.js');
        assert(/class:'panel-box-form rozrys-panel-form rozrys-panel-form--stock'/.test(stockJs), 'Modal Dodaj płytę do magazynu nie używa wspólnego shellu panel-box-form', { stockJs });
        assert(/class:'panel-box-form__scroll'/.test(stockJs), 'Modal Dodaj płytę do magazynu nie ma jeszcze własnej przewijalnej sekcji formularza', { stockJs });
        assert(/class:'grid-2 rozrys-panel-grid rozrys-panel-grid--stock'/.test(stockJs), 'Modal Dodaj płytę do magazynu nie używa klasy siatki stock', { stockJs });
        assert(/class:'rozrys-panel-field rozrys-panel-field--full rozrys-panel-field--qty'/.test(stockJs), 'Pole ilości w modalu Dodaj płytę do magazynu nie ma jeszcze własnego pola qty', { stockJs });
        assert(/class:'rozrys-panel-input--compact'/.test(stockJs), 'Pole ilości w modalu Dodaj płytę do magazynu nie dostało kompaktowej szerokości', { stockJs });
        assert(/rozrys-choice-launch--stock-clean/.test(stockJs), 'Modal Dodaj płytę do magazynu nadal nie używa aplikacyjnego launchera wyboru materiału', { stockJs });
        assert(/openRozrysChoiceOverlay/.test(stockJs), 'Modal Dodaj płytę do magazynu nadal nie otwiera aplikacyjnego overlayu wyboru materiału', { stockJs });
        assert(/\.rozrys-choice-launch--stock-clean \.rozrys-choice-launch__arrow[\s\S]*display:none/i.test(css), 'Launcher materiału w modalu magazynu nadal pokazuje strzałkę zamiast czystego stylu aplikacji', { css });
        assert(/class:'panel-box-form__footer rozrys-panel-footer'/.test(stockJs), 'Modal Dodaj płytę do magazynu nie używa stopki zgodnej z shellami ROZRYS', { stockJs });
      }),

      makeTest('UI i styl', 'Karta materiału ma dokładnie ten sam wzorzec ramki, cienia i rytmu pola co wybór trybu', 'Sprawdza, czy karty w Wybierz materiał / grupę kopiują realne parametry z modala Szybkość liczenia: ten sam zielony border/shadow zaznaczenia, ten sam rytm pola kart oraz wyśrodkowaną stopkę akcji pod listą.', ()=>{
        const css = readAssetSource('css/rozrys-reference-sync.css');
        const syncCss = readAssetSource('css/rozrys-picker-exact-sync.css');
        assert(/\.rozrys-picker-option\{[\s\S]*padding:\s*18px 18px[\s\S]*border-width:\s*1\.5px[\s\S]*border-radius:\s*20px/i.test(css), 'Desktopowa karta materiału nie używa jeszcze tych samych parametrów co karta wyboru trybu', { css });
        assert(/@media \(max-width: 640px\)\{[\s\S]*\.rozrys-picker-option\{[\s\S]*padding:\s*16px 16px[\s\S]*border-radius:\s*18px/i.test(css), 'Mobilna karta materiału nie używa jeszcze tych samych parametrów co karta wyboru trybu', { css });
        assert(/\.rozrys-choice-option\.is-selected,[\s\S]*\.rozrys-picker-option\.has-selection,[\s\S]*border-color:\s*#16a34a[\s\S]*0 0 0 1px rgba\(34,197,94,.34\), 2px 3px 0 rgba\(20,83,45,.14\), 5px 10px 18px rgba\(74,222,128,.18\)/i.test(css), 'Karty materiałów nie współdzielą już dokładnie tego samego zielonego border/shadow co wybór trybu', { css });
        assert(/\.rozrys-picker-card:has\(.rozrys-scope-chip input\[type='checkbox'\]:checked\)::before\{[\s\S]*opacity:\s*0[\s\S]*box-shadow:\s*none/i.test(css), 'Zaznaczona karta materiału nadal dokłada dodatkową zieloną poświatę zamiast czystej ramki jak w wyborze trybu', { css });
        assert(/\.rozrys-picker-modal\{[\s\S]*gap:\s*0/i.test(syncCss), 'Kontener pickerów nadal dokłada dodatkowy gap między listą a stopką i zostawia zbyt dużą dziurę pod kartami', { syncCss });
        assert(/\.rozrys-picker-list\{[\s\S]*gap:\s*12px[\s\S]*padding:\s*0 12px 20px 0[\s\S]*scrollbar-gutter:\s*stable/i.test(syncCss), 'Pole kart materiału nie ma jeszcze dokładnego rytmu 12px, dolnego zapasu 20px i prawego guttera na scrollbar', { syncCss });
        assert(/\.rozrys-picker-footer\{[\s\S]*display:\s*flex[\s\S]*align-items:\s*center[\s\S]*padding:\s*0/i.test(syncCss), 'Wspólna stopka pickerów straciła bazowe wyśrodkowanie albo zerowy pionowy padding', { syncCss });
        assert(/\.rozrys-picker-footer--material\{[\s\S]*padding:\s*20px\s+0\s+0/i.test(syncCss), 'Stopka wyboru materiału nie dostała osobnego górnego paddingu 20px, który ma opuścić samotny przycisk Wyjdź', { syncCss });
        assert(/@media \(max-width:\s*640px\)\{[\s\S]*\.rozrys-picker-footer--material\{[\s\S]*padding:\s*18px\s+0\s+0/i.test(syncCss), 'Mobilna stopka wyboru materiału nie ma górnego paddingu 18px dla przycisku Wyjdź', { syncCss });
        assert(/\.rozrys-picker-footer-actions\{[\s\S]*display:\s*flex[\s\S]*align-items:\s*center[\s\S]*gap:\s*10px/i.test(syncCss), 'Wewnętrzny rząd przycisków akcji nie zachował jeszcze wyśrodkowania i wspólnego rytmu 10px', { syncCss });
        const pickersJs = readAssetSource('js/app/rozrys/rozrys-pickers.js');
        assert(/openMaterialPicker[\s\S]*class:'rozrys-picker-footer rozrys-picker-footer--material'/.test(pickersJs), 'Modal wyboru materiału nie używa jeszcze osobnej stopki z modifierem dla scrollowanego układu materiałów', { pickersJs });
      }),

      makeTest('Runtime utils', 'Wydzielone utils ROZRYS budują RAW snapshot tylko dla wybranego pokoju i zakresu materiału', 'Pilnuje pierwszego bezpiecznego splitu technicznego: buildRawSnapshotForMaterial po wydzieleniu nadal filtruje exact pokój i fronty/korpusy bez mieszania danych z innych pokoi.', ()=>{
        assert(FC.rozrysRuntimeUtils && typeof FC.rozrysRuntimeUtils.createApi === 'function', 'Brak FC.rozrysRuntimeUtils.createApi');
        const project = {
          room_a:{ cabinets:[{ id:'cab-a', name:'Szafka A' }], fronts:[], sets:[], settings:{} },
          room_h:{ cabinets:[{ id:'cab-h', name:'Szafka H' }], fronts:[], sets:[], settings:{} },
        };
        const api = FC.rozrysRuntimeUtils.createApi({
          FC,
          safeGetProject: ()=> project,
          getRooms: ()=> ['room_a', 'room_h'],
          normalizeRoomSelection: (rooms)=> Array.isArray(rooms) ? rooms.slice() : [],
          resolveCabinetCutListFn: ()=> (cabinet, room)=> room === 'room_a'
            ? [
                { name:'Bok', qty:1, material:'MDF A', a:72, b:56 },
                { name:'Front', qty:1, material:'Front: laminat • Biały', a:71.6, b:29.7 },
              ]
            : [
                { name:'Bok', qty:1, material:'MDF H', a:72, b:56 },
              ],
          resolveRozrysPartFromSource: (part)=> ({
            materialKey: String(part.material || ''),
            name: String(part.name || 'Element'),
            sourceSig: `${part.material}||${part.name}`,
            direction: 'default',
            ignoreGrain: false,
            w: Math.round(Number(part.a || 0) * 10),
            h: Math.round(Number(part.b || 0) * 10),
            qty: Math.max(1, Math.round(Number(part.qty) || 0)),
          }),
          isFrontMaterialKey: (material)=> /^\s*Front\s*:/i.test(String(material || '')),
          partSignature: (part)=> `${part.material}||${part.name}||${part.w}x${part.h}`,
        });
        const corpusRows = api.buildRawSnapshotForMaterial('MDF A', 'corpus', ['room_a']);
        const frontRows = api.buildRawSnapshotForMaterial('Front: laminat • Biały', 'fronts', ['room_a']);
        const emptyRows = api.buildRawSnapshotForMaterial('MDF H', 'corpus', ['room_x']);
        assert(corpusRows.length === 1 && corpusRows[0].room === 'room_a', 'RAW snapshot korpusu nie trzyma exact pokoju room_a', corpusRows);
        assert(frontRows.length === 1 && frontRows[0].material === 'Front: laminat • Biały', 'RAW snapshot frontów nie odfiltrował frontów dla room_a', frontRows);
        assert(emptyRows.length === 0, 'RAW snapshot nie może pobierać danych z nieistniejącego scope', emptyRows);
      }),
      makeTest('Runtime utils', 'Wydzielone utils ROZRYS delegują diagnostykę przez summary z helperami snapshotów', 'Pilnuje ścieżki renderOutput → buildRozrysDiagnostics po splicie: summary ma dostać helpery RAW/resolved i policzyć diagnostykę bez utraty danych.', ()=>{
        assert(FC.rozrysRuntimeUtils && typeof FC.rozrysRuntimeUtils.createApi === 'function', 'Brak FC.rozrysRuntimeUtils.createApi');
        const prevSummary = FC.rozrysSummary;
        const prevValidation = FC.rozrysValidation;
        const captured = { rawRows:null, resolvedRows:null };
        FC.rozrysValidation = {
          rowsFromParts(parts){ return (parts || []).map((part)=> Object.assign({}, part)); },
        };
        FC.rozrysSummary = {
          buildRozrysDiagnostics(material, mode, parts, plan, selectedRooms, helpers){
            captured.rawRows = helpers.buildRawSnapshotForMaterial(material, mode, selectedRooms);
            captured.resolvedRows = helpers.buildResolvedSnapshotFromParts(parts);
            return { rawCount: captured.rawRows.length, mergedCount: captured.resolvedRows.length, validation:{ ok:true, rows:[] }, sheets:[] };
          },
        };
        try{
          const project = { room_a:{ cabinets:[{ id:'cab-a', name:'Szafka A' }], fronts:[], sets:[], settings:{} } };
          const api = FC.rozrysRuntimeUtils.createApi({
            FC,
            safeGetProject: ()=> project,
            getRooms: ()=> ['room_a'],
            normalizeRoomSelection: (rooms)=> Array.isArray(rooms) ? rooms.slice() : [],
            resolveCabinetCutListFn: ()=> ()=> ([{ name:'Bok', qty:2, material:'MDF A', a:72, b:56 }]),
            resolveRozrysPartFromSource: (part)=> ({ materialKey:'MDF A', name:String(part.name || 'Element'), sourceSig:'sig', direction:'default', ignoreGrain:false, w:720, h:560, qty:Math.max(1, Number(part.qty) || 0) }),
            isFrontMaterialKey: ()=> false,
            partSignature: (part)=> `${part.material}||${part.name}||${part.w}x${part.h}`,
            mmToUnitStr: (mm)=> String(mm),
          });
          const parts = [{ material:'MDF A', name:'Bok', w:720, h:560, qty:2, sourceSig:'sig', direction:'default' }];
          const diag = api.buildRozrysDiagnostics('MDF A', 'both', parts, { sheets:[] }, ['room_a']);
          assert(diag && diag.rawCount === 1 && diag.mergedCount === 1, 'Diagnostyka po splicie nie przeszła przez summary z helperami snapshotów', { diag, captured });
          assert(Array.isArray(captured.rawRows) && captured.rawRows.length === 1, 'Summary nie dostało RAW snapshot helpera', captured);
          assert(Array.isArray(captured.resolvedRows) && captured.resolvedRows.length === 1, 'Summary nie dostało resolved snapshot helpera', captured);
        } finally {
          FC.rozrysSummary = prevSummary;
          FC.rozrysValidation = prevValidation;
        }
      }),
    ];
  };
})(typeof window !== 'undefined' ? window : globalThis);
