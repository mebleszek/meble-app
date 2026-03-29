(function(root){
  'use strict';

  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  function assert(condition, message, details){
    if(!condition){
      const err = new Error(message || 'Assertion failed');
      if(details) err.details = details;
      throw err;
    }
  }

  function fallbackPartSignature(part){
    return `${part && part.material || ''}||${part && part.name || ''}||${part && part.w || 0}x${part && part.h || 0}`;
  }

  function defaultRotationAllowed(part, grainOn, overrides){
    const sig = fallbackPartSignature(part);
    if(overrides && overrides[sig] === 'free') return true;
    return !grainOn;
  }

  function withIsolatedLocalStorage(run){
    const storage = host.localStorage;
    const previous = storage && typeof storage.getItem === 'function' ? storage.getItem('fc_rozrys_plan_cache_v2') : null;
    try{
      if(storage && typeof storage.removeItem === 'function') storage.removeItem('fc_rozrys_plan_cache_v2');
      return run();
    }finally{
      if(!storage || typeof storage.removeItem !== 'function' || typeof storage.setItem !== 'function') return;
      if(previous == null) storage.removeItem('fc_rozrys_plan_cache_v2');
      else storage.setItem('fc_rozrys_plan_cache_v2', previous);
    }
  }

  function makeTest(group, name, explain, fn){
    return { group, name, explain, fn };
  }

  function detailsToText(details){
    if(details == null) return '';
    if(typeof details === 'string') return details;
    try{
      return JSON.stringify(details, null, 2);
    }catch(_error){
      return String(details);
    }
  }


  function readAssetSource(relPath){
    try{
      if(host.__DEV_ASSETS__ && typeof host.__DEV_ASSETS__[relPath] === 'string') return host.__DEV_ASSETS__[relPath];
    }catch(_error){}
    try{
      if(typeof XMLHttpRequest !== 'undefined'){
        const xhr = new XMLHttpRequest();
        xhr.open('GET', relPath, false);
        xhr.send(null);
        if((xhr.status >= 200 && xhr.status < 400) || xhr.status === 0) return String(xhr.responseText || '');
      }
    }catch(_error){}
    return '';
  }

  function createFakeNode(tag, attrs){
    const classes = String((attrs && attrs.class) || '').split(/\s+/).filter(Boolean);
    const listeners = {};
    const node = {
      tagName: String(tag || '').toUpperCase(),
      attributes: Object.assign({}, attrs || {}),
      children: [],
      checked: !!(attrs && attrs.checked),
      disabled: !!(attrs && attrs.disabled),
      value: attrs && Object.prototype.hasOwnProperty.call(attrs, 'value') ? attrs.value : '',
      textContent: attrs && attrs.text ? attrs.text : '',
      innerHTML: attrs && attrs.html ? attrs.html : '',
      parentNode: null,
      __listeners: listeners,
      appendChild(child){
        if(child) child.parentNode = node;
        node.children.push(child);
        return child;
      },
      addEventListener(type, handler){
        listeners[type] = listeners[type] || [];
        listeners[type].push(handler);
      },
      dispatch(type){
        (listeners[type] || []).forEach((handler)=> handler({ type, target:node }));
      },
      setAttribute(name, value){
        node.attributes[name] = value;
        if(name === 'class') node.className = value;
      },
      getAttribute(name){
        return node.attributes[name];
      },
    };
    Object.defineProperty(node, 'className', {
      get(){ return classes.join(' '); },
      set(value){
        classes.splice(0, classes.length, ...String(value || '').split(/\s+/).filter(Boolean));
      },
      enumerable:true,
      configurable:true,
    });
    node.classList = {
      add(name){
        if(!classes.includes(name)) classes.push(name);
        node.className = classes.join(' ');
      },
      remove(name){
        const idx = classes.indexOf(name);
        if(idx >= 0) classes.splice(idx, 1);
        node.className = classes.join(' ');
      },
      contains(name){
        return classes.includes(name);
      },
      toggle(name, force){
        const next = force === undefined ? !classes.includes(name) : !!force;
        if(next){
          if(!classes.includes(name)) classes.push(name);
        }else{
          const idx = classes.indexOf(name);
          if(idx >= 0) classes.splice(idx, 1);
        }
        node.className = classes.join(' ');
        return next;
      }
    };
    return node;
  }

  function collectNodes(node, predicate, out){
    const bucket = out || [];
    if(!node) return bucket;
    if(typeof predicate === 'function' && predicate(node)) bucket.push(node);
    (Array.isArray(node.children) ? node.children : []).forEach((child)=> collectNodes(child, predicate, bucket));
    return bucket;
  }

  function makeClipboardReport(report){
    const lines = [];
    lines.push(`ROZRYS smoke testy: ${report.passed}/${report.total} OK`);
    lines.push(`Błędy: ${report.failed}`);
    lines.push(`Czas: ${report.durationMs} ms`);
    report.groups.forEach((group)=>{
      lines.push('');
      lines.push(`[${group.name}] ${group.passed}/${group.total} OK`);
      group.results.forEach((row)=>{
        lines.push(`- ${row.ok ? 'OK' : 'BŁĄD'}: ${row.name}`);
        if(row.explain) lines.push(`  Po co: ${row.explain}`);
        if(!row.ok && row.message) lines.push(`  Powód: ${row.message}`);
        const detailsText = !row.ok ? detailsToText(row.details) : '';
        if(detailsText) lines.push(`  Szczegóły: ${detailsText}`);
      });
    });
    return lines.join('\n');
  }



  function withPatchedProjectFixture(project, cutListFn, run){
    const prevProject = host.projectData;
    host.projectData = project;
    host.FC = host.FC || {};
    const fc = host.FC;
    const prevNs = fc.cabinetCutlist;
    fc.cabinetCutlist = fc.cabinetCutlist || {};
    const prevFn = fc.cabinetCutlist.getCabinetCutList;
    fc.cabinetCutlist.getCabinetCutList = cutListFn;
    try{
      return run();
    }finally{
      host.projectData = prevProject;
      if(prevNs && typeof prevNs === 'object'){
        fc.cabinetCutlist.getCabinetCutList = prevFn;
      } else if(prevFn){
        fc.cabinetCutlist.getCabinetCutList = prevFn;
      } else {
        delete fc.cabinetCutlist;
      }
    }
  }
  function buildPrintDeps(){
    return {
      measurePrintHeaderMm: ()=> 14,
      mmToUnitStr: (mm)=> String(mm),
      getBoardMeta: (sheet)=> ({ boardW:sheet.boardW, boardH:sheet.boardH, referenceBoardW:sheet.boardW, referenceBoardH:sheet.boardH }),
      calcDisplayWaste: ()=> ({ total:100, waste:20, realHalf:false, virtualHalf:false }),
    };
  }

  function runAll(){
    const Fx = FC.rozrysDevFixtures;
    assert(Fx, 'Brak FC.rozrysDevFixtures');
    assert(FC.rozrysState, 'Brak FC.rozrysState');
    assert(FC.rozrysSheetModel, 'Brak FC.rozrysSheetModel');
    assert(FC.rozrysValidation, 'Brak FC.rozrysValidation');
    assert(FC.rozrysCache, 'Brak FC.rozrysCache');
    assert(FC.rozrysEngine, 'Brak FC.rozrysEngine');
    assert(FC.cutOptimizer, 'Brak FC.cutOptimizer');
    assert(FC.rozrysPrintLayout, 'Brak FC.rozrysPrintLayout');

    const tests = [
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


      makeTest('UI i styl', 'Karta materiału ma dokładnie ten sam wzorzec ramki, cienia i odstępów co wybór trybu', 'Sprawdza, czy karty w Wybierz materiał / grupę kopiują realne parametry z modala Szybkość liczenia: ten sam zielony border/shadow zaznaczenia, ten sam rytm odstępów oraz ten sam zapas pod dolną kartą na cień.', ()=>{
        const css = readAssetSource('css/rozrys-reference-sync.css');
        assert(/\.rozrys-picker-list\{[\s\S]*gap:\s*12px[\s\S]*padding:\s*0 10px 20px 0[\s\S]*scrollbar-gutter:\s*stable/i.test(css), 'Lista kart materiału nie ma jeszcze rytmu 12px, dolnego zapasu 20px i prawego guttera na scrollbar, więc ramka dalej może wchodzić pod scroll', { css });
        assert(/\.rozrys-picker-footer\{[\s\S]*margin-top:\s*0/i.test(css), 'Stopka wyboru materiału nadal dodaje własny odstęp zamiast opierać się na dolnym zapasie listy jak wzorzec wyboru trybu', { css });
        assert(/\.rozrys-picker-option\{[\s\S]*padding:\s*18px 18px[\s\S]*border-width:\s*1\.5px[\s\S]*border-radius:\s*20px/i.test(css), 'Desktopowa karta materiału nie używa jeszcze tych samych parametrów co karta wyboru trybu', { css });
        assert(/@media \(max-width: 640px\)\{[\s\S]*\.rozrys-picker-option\{[\s\S]*padding:\s*16px 16px[\s\S]*border-radius:\s*18px/i.test(css), 'Mobilna karta materiału nie używa jeszcze tych samych parametrów co karta wyboru trybu', { css });
        assert(/\.rozrys-choice-option\.is-selected,[\s\S]*\.rozrys-picker-option\.has-selection,[\s\S]*border-color:\s*#16a34a[\s\S]*0 0 0 1px rgba\(34,197,94,.34\), 2px 3px 0 rgba\(20,83,45,.14\), 5px 10px 18px rgba\(74,222,128,.18\)/i.test(css), 'Karty materiałów nie współdzielą już dokładnie tego samego zielonego border/shadow co wybór trybu', { css });
        assert(/\.rozrys-picker-card:has\(.rozrys-scope-chip input\[type='checkbox'\]:checked\)::before\{[\s\S]*opacity:\s*0[\s\S]*box-shadow:\s*none/i.test(css), 'Zaznaczona karta materiału nadal dokłada dodatkową zieloną poświatę zamiast czystej ramki jak w wyborze trybu', { css });
      }),

      makeTest('Projekt i agregacja', 'ROZRYS buduje materiały z projektu i resolvera cutlist', 'Sprawdza, czy przy realnym projekcie z szafką ROZRYS nie pokaże pustego stanu tylko dlatego, że nie podpiął źródła formatek.', ()=>{
        const fixtureProject = {
          schemaVersion: 9,
          kuchnia:{ cabinets:[{ id:'cab-1', width:60, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
          szafa:{ cabinets:[], fronts:[], sets:[], settings:{} },
          pokoj:{ cabinets:[], fronts:[], sets:[], settings:{} },
          lazienka:{ cabinets:[], fronts:[], sets:[], settings:{} },
        };
        const fixtureCutList = ()=> ([
          { name:'Bok', qty:2, a:72, b:56, material:'MDF test biały' },
          { name:'Półka', qty:1, a:56, b:30, material:'MDF test biały' },
        ]);
        assert(FC.rozrys && typeof FC.rozrys.aggregatePartsForProject === 'function', 'Brak FC.rozrys.aggregatePartsForProject');
        const agg = withPatchedProjectFixture(fixtureProject, fixtureCutList, ()=> FC.rozrys.aggregatePartsForProject(['kuchnia']));
        assert(Array.isArray(agg.materials) && agg.materials.includes('MDF test biały'), 'Agregacja projektu nie zbudowała materiału z prostego projektu', agg);
        assert(agg.byMaterial && Array.isArray(agg.byMaterial['MDF test biały']) && agg.byMaterial['MDF test biały'].length >= 1, 'Agregacja projektu nie zwróciła formatek materiału', agg);
      }),
      makeTest('Projekt i agregacja', 'ROZRYS wykrywa także niestandardowe klucze pomieszczeń z projektu', 'Sprawdza, czy projekt z własnym kluczem pomieszczenia nadal dostarczy formatki do ROZRYS zamiast pustego stanu.', ()=>{
        const fixtureProject = {
          schemaVersion: 9,
          salon:{ cabinets:[{ id:'cab-2', width:80, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
        };
        const fixtureCutList = ()=> ([
          { name:'Bok', qty:2, a:72, b:56, material:'Dąb test' },
        ]);
        assert(FC.rozrys && typeof FC.rozrys.aggregatePartsForProject === 'function', 'Brak FC.rozrys.aggregatePartsForProject');
        const agg = withPatchedProjectFixture(fixtureProject, fixtureCutList, ()=> FC.rozrys.aggregatePartsForProject(['salon']));
        assert(Array.isArray(agg.selectedRooms) && agg.selectedRooms.includes('salon'), 'ROZRYS nie rozpoznał własnego klucza pomieszczenia z projektu', agg);
        assert(Array.isArray(agg.materials) && agg.materials.includes('Dąb test'), 'ROZRYS nie zbudował materiału dla własnego klucza pomieszczenia', agg);
      }),
      makeTest('Projekt i agregacja', 'ROZRYS wybiera bogatszy projekt z dostępnych źródeł danych', 'Sprawdza, czy gdy jeden projekt jest pusty, a drugi ma szafki, ROZRYS bierze ten bogatszy zamiast pokazać pusty stan.', ()=>{
        const prevProject = host.projectData;
        const prevWindowProject = host.window && host.window.projectData;
        const prevLoad = FC.project && FC.project.load;
        const leanProject = { schemaVersion:9, kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{} } };
        const richProject = { schemaVersion:9, kuchnia:{ cabinets:[{ id:'cab-rich', width:60, height:72, depth:56 }], fronts:[], sets:[], settings:{} } };
        host.projectData = leanProject;
        if(host.window) host.window.projectData = richProject;
        if(FC.project) FC.project.load = ()=> richProject;
        const fixtureCutList = ()=> ([{ name:'Bok', qty:2, a:72, b:56, material:'MDF rich' }]);
        const prevNs = FC.cabinetCutlist;
        FC.cabinetCutlist = FC.cabinetCutlist || {};
        const prevFn = FC.cabinetCutlist.getCabinetCutList;
        FC.cabinetCutlist.getCabinetCutList = fixtureCutList;
        try{
          assert(FC.rozrys && typeof FC.rozrys.safeGetProject === 'function', 'Brak FC.rozrys.safeGetProject');
          const resolved = FC.rozrys.safeGetProject();
          const agg = FC.rozrys.aggregatePartsForProject(['kuchnia']);
          assert(Array.isArray(resolved.kuchnia && resolved.kuchnia.cabinets) && resolved.kuchnia.cabinets.length === 1, 'ROZRYS nie wybrał bogatszego projektu', resolved);
          assert(Array.isArray(agg.materials) && agg.materials.includes('MDF rich'), 'Agregacja nie skorzystała z bogatszego projektu', agg);
        } finally {
          host.projectData = prevProject;
          if(host.window) host.window.projectData = prevWindowProject;
          if(FC.project) FC.project.load = prevLoad;
          if(prevNs && typeof prevNs === 'object') FC.cabinetCutlist.getCabinetCutList = prevFn;
          else if(prevFn) FC.cabinetCutlist.getCabinetCutList = prevFn;
          else delete FC.cabinetCutlist;
        }
      }),
      makeTest('Projekt i agregacja', 'ROZRYS retryuje pełną listę pomieszczeń, gdy zapisany wybór jest pusty', 'Sprawdza, czy pusty albo stary wybór pomieszczeń nie blokuje materiałów, jeśli projekt realnie ma szafki w innym pokoju.', ()=>{
        const fixtureProject = {
          schemaVersion: 9,
          inne:{ cabinets:[{ id:'cab-3', width:90, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
        };
        const fixtureCutList = ()=> ([
          { name:'Bok', qty:2, a:72, b:56, material:'Jesion test' },
        ]);
        const agg = withPatchedProjectFixture(fixtureProject, fixtureCutList, ()=> FC.rozrys.aggregatePartsForProject(['kuchnia']));
        assert(Array.isArray(agg.selectedRooms) && agg.selectedRooms.includes('inne'), 'ROZRYS nie zrobił retry po realnych pokojach projektu', agg);
        assert(Array.isArray(agg.materials) && agg.materials.includes('Jesion test'), 'ROZRYS po retry nadal nie zbudował materiału', agg);
      }),
      makeTest('Magazyn i arkusze', 'Model arkusza respektuje blokadę obrotu przy słojach', 'Sprawdza, czy formatka nie przejdzie tylko dlatego, że zmieściłaby się po niedozwolonym obrocie.', ()=>{
        const parts = [
          { key:'grain||front||600x350', name:'Front', material:'Dąb dziki', w:600, h:350, qty:2 },
          { key:'grain||wstega||350x600', name:'Wstęga', material:'Dąb dziki', w:350, h:600, qty:1 },
        ];
        const result = FC.rozrysSheetModel.filterPartsForSheet(parts, 2100, 400, 20, true, {}, {
          isPartRotationAllowed: defaultRotationAllowed,
        });
        assert(result.length === 1, 'Przy słojach weszła formatka tylko po obrocie albo odpadła zła liczba elementów', { result });
        assert(result[0].name === 'Front', 'Zły element przeszedł filtr słojów', { result });
      }),
      makeTest('Magazyn i arkusze', 'Wyjątek słojów free dopuszcza obrót tylko dla wskazanej formatki', 'Sprawdza, czy materiał ze słojami może obrócić wyłącznie formatkę oznaczoną wyjątkiem, bez odblokowania reszty.', ()=>{
        const part = Fx.rotationOnlyPart();
        const withoutOverride = FC.rozrysSheetModel.filterPartsForSheet([part], 400, 800, 20, true, {}, {
          isPartRotationAllowed: defaultRotationAllowed,
        });
        const withOverride = FC.rozrysSheetModel.filterPartsForSheet([part], 400, 800, 20, true, {
          [fallbackPartSignature(part)]: 'free',
        }, {
          isPartRotationAllowed: defaultRotationAllowed,
        });
        assert(withoutOverride.length === 0, 'Formatka przeszła mimo blokady obrotu przy słojach', { withoutOverride });
        assert(withOverride.length === 1, 'Wyjątek free nie dopuścił obrotu wskazanej formatki', { withOverride });
      }),
      makeTest('Magazyn i arkusze', 'Podpis magazynu jest stabilny niezależnie od kolejności wierszy', 'Sprawdza, czy te same stany magazynu nie zmieniają podpisu tylko dlatego, że wiersze są w innej kolejności.', ()=>{
        const rowsA = Fx.stockRows();
        const rowsB = [rowsA[2], rowsA[0], rowsA[1]];
        const sigA = FC.rozrysSheetModel.buildStockSignatureForRows(rowsA);
        const sigB = FC.rozrysSheetModel.buildStockSignatureForRows(rowsB);
        assert(sigA === sigB, 'Przestawienie wierszy magazynu zmienia podpis', { sigA, sigB });
      }),
      makeTest('Magazyn i arkusze', 'Format magazynowy działa także po zamianie szerokości z wysokością', 'Sprawdza, czy arkusz 2800×2070 i 2070×2800 jest traktowany jako ten sam format.', ()=>{
        const stock = FC.rozrysSheetModel.getExactSheetStockForRows([
          { width:2070, height:2800, qty:3 },
        ], 2800, 2070);
        assert(stock.qty === 3, 'Obrócony format magazynowy nie został rozpoznany jako ten sam arkusz', stock);
      }),
      makeTest('Magazyn i arkusze', 'Model arkusza odejmuje wykorzystane formatki z magazynu', 'Sprawdza, czy element wycięty z płyty magazynowej nie wraca drugi raz do planu zamówienia.', ()=>{
        const parts = Fx.basicParts();
        const used = FC.rozrysSheetModel.countPlacedPartsByKey(Fx.mixedPlanSheets().filter((sheet)=> sheet.supplySource === 'stock'), {
          parts,
          partSignature: fallbackPartSignature,
        });
        const left = FC.rozrysSheetModel.subtractPlacedParts(parts, used, { partSignature: fallbackPartSignature });
        const bok = left.find((row)=> row.name === 'Bok');
        assert(!bok, 'Boki z magazynu nie zostały odjęte z dalszego planu', { left });
        const polka = left.find((row)=> row.name === 'Półka');
        assert(polka && polka.qty === 4, 'Odjęcie z magazynu naruszyło inne elementy', { left });
      }),
      makeTest('Walidacja', 'Walidacja przechodzi dla planu mieszanego: magazyn + zamówić', 'Sprawdza, czy plan łączący magazyn i nowe płyty nie pokazuje fałszywego nadmiaru.', ()=>{
        const parts = Fx.basicParts();
        const expected = FC.rozrysValidation.rowsFromParts(parts);
        const actual = FC.rozrysValidation.summarizePlan({ sheets: Fx.mixedPlanSheets() }, 'MDF 18 biały').rows;
        const validation = FC.rozrysValidation.validate(expected, actual);
        assert(validation.ok === true, 'Walidacja nie przechodzi dla poprawnego planu mieszanego', validation);
      }),
      makeTest('Walidacja', 'Walidacja łapie sztuczny nadmiar w przeprodukowanym planie', 'Sprawdza, czy przy dodatkowej formatce ponad zapotrzebowanie walidacja zgłosi nadmiar zamiast puścić błąd dalej.', ()=>{
        const parts = Fx.basicParts();
        const expected = FC.rozrysValidation.rowsFromParts(parts);
        const actual = FC.rozrysValidation.summarizePlan({ sheets: Fx.overproducedPlanSheets() }, 'MDF 18 biały').rows;
        const validation = FC.rozrysValidation.validate(expected, actual);
        assert(validation.ok === false, 'Walidacja nie wykryła nadmiaru w przeprodukowanym planie', validation);
        assert(Array.isArray(validation.extra) && validation.extra.length >= 1, 'Walidacja nie zwróciła listy nadmiarowych pozycji', validation);
      }),
      makeTest('Cache', 'Klucz cache jest stabilny dla tych samych danych', 'Sprawdza, czy identyczne dane dają dokładnie ten sam klucz cache.', ()=> withIsolatedLocalStorage(()=>{
        const state = Fx.cacheState('sig-a');
        const parts = Fx.basicParts();
        const keyA = FC.rozrysCache.makePlanCacheKey(state, parts, {
          partSignature: fallbackPartSignature,
          isPartRotationAllowed: defaultRotationAllowed,
          loadEdgeStore: ()=>({}),
        });
        const keyB = FC.rozrysCache.makePlanCacheKey(Fx.clone(state), Fx.clone(parts), {
          partSignature: fallbackPartSignature,
          isPartRotationAllowed: defaultRotationAllowed,
          loadEdgeStore: ()=>({}),
        });
        assert(keyA === keyB, 'Ten sam stan daje różne klucze cache', { keyA, keyB });
      })),
      makeTest('Cache', 'Klucz cache zmienia się po zmianie stockSignature', 'Sprawdza, czy zmiana stanów magazynu wymusza nowy klucz cache, a więc nowe liczenie.', ()=> withIsolatedLocalStorage(()=>{
        const parts = Fx.basicParts();
        const keyA = FC.rozrysCache.makePlanCacheKey(Fx.cacheState('sig-a'), parts, {
          partSignature: fallbackPartSignature,
          isPartRotationAllowed: defaultRotationAllowed,
          loadEdgeStore: ()=>({}),
        });
        const keyB = FC.rozrysCache.makePlanCacheKey(Fx.cacheState('sig-b'), parts, {
          partSignature: fallbackPartSignature,
          isPartRotationAllowed: defaultRotationAllowed,
          loadEdgeStore: ()=>({}),
        });
        assert(keyA !== keyB, 'Zmiana podpisu stanów magazynu nie zmienia klucza cache', { keyA, keyB });
      })),
      makeTest('Cache', 'Klucz cache zmienia się po zmianie wyjątków słojów', 'Sprawdza, czy zmiana wyjątku free/blocked dla formatek wymusza nowy klucz cache.', ()=> withIsolatedLocalStorage(()=>{
        const part = Fx.rotationOnlyPart();
        const parts = [part];
        const sig = fallbackPartSignature(part);
        const keyA = FC.rozrysCache.makePlanCacheKey(Fx.cacheState('sig-a', { grain:true, grainExceptions:{} }), parts, {
          partSignature: fallbackPartSignature,
          isPartRotationAllowed: defaultRotationAllowed,
          loadEdgeStore: ()=>({}),
        });
        const keyB = FC.rozrysCache.makePlanCacheKey(Fx.cacheState('sig-a', { grain:true, grainExceptions:{ [sig]:'free' } }), parts, {
          partSignature: fallbackPartSignature,
          isPartRotationAllowed: defaultRotationAllowed,
          loadEdgeStore: ()=>({}),
        });
        assert(keyA !== keyB, 'Zmiana wyjątków słojów nie zmienia klucza cache', { keyA, keyB });
      })),
      makeTest('Cache', 'Klucz cache zmienia się po zmianie oklein formatek', 'Sprawdza, czy zmiana ustawień oklein daje nowy klucz cache i nie podmienia starego wyniku.', ()=> withIsolatedLocalStorage(()=>{
        const state = Fx.cacheState('sig-a');
        const parts = Fx.basicParts();
        const sig = fallbackPartSignature(parts[0]);
        const keyA = FC.rozrysCache.makePlanCacheKey(state, parts, {
          partSignature: fallbackPartSignature,
          isPartRotationAllowed: defaultRotationAllowed,
          loadEdgeStore: ()=>({}),
        });
        const keyB = FC.rozrysCache.makePlanCacheKey(state, parts, {
          partSignature: fallbackPartSignature,
          isPartRotationAllowed: defaultRotationAllowed,
          loadEdgeStore: ()=>({ [sig]: { w1:true } }),
        });
        assert(keyA !== keyB, 'Zmiana oklein nie zmienia klucza cache', { keyA, keyB });
      })),
      makeTest('Cache', 'Save/load cache zachowuje ostatni wpis', 'Sprawdza, czy zapisany cache daje się odczytać bez utraty ostatniego wpisu.', ()=> withIsolatedLocalStorage(()=>{
        const cache = {
          a:{ ts:1, value:'x' },
          b:{ ts:2, value:'y' },
        };
        FC.rozrysCache.savePlanCache(cache);
        const loaded = FC.rozrysCache.loadPlanCache();
        assert(loaded && loaded.b && loaded.b.value === 'y', 'Cache nie zapisał/odczytał wpisu', loaded);
      })),
      makeTest('Silnik planowania', 'Engine liczy prosty plan shelf bez pustego wyniku', 'Sprawdza, czy dla prostego zestawu solver zwraca realny plan zamiast pustego wyniku.', ()=>{
        const plan = FC.rozrysEngine.computePlan(Fx.baseState({ heur:'simple', direction:'auto' }), Fx.basicParts(), {
          cutOptimizer: FC.cutOptimizer,
          partSignature: fallbackPartSignature,
          isPartRotationAllowed: defaultRotationAllowed,
          loadEdgeStore: ()=>({}),
        });
        assert(Array.isArray(plan.sheets) && plan.sheets.length >= 1, 'Engine zwrócił pusty plan', plan);
        const placements = plan.sheets.reduce((sum, sheet)=> sum + ((sheet && sheet.placements) || []).filter((pl)=> pl && !pl.unplaced).length, 0);
        assert(placements >= 1, 'Engine nie rozmieścił żadnej formatki', plan);
      }),
      makeTest('Silnik planowania', 'Engine opisuje heurystykę zgodnie z trybem i kierunkiem', 'Sprawdza, czy etykieta heurystyki nie myli trybu optimax z kierunkiem pierwszych pasów.', ()=>{
        const label = FC.rozrysEngine.formatHeurLabel({ heur:'optimax', optimaxProfile:'dokladnie', direction:'across' });
        assert(/Dokładnie/.test(label), 'Etykieta heurystyki nie pokazuje profilu', { label });
        assert(/w poprzek/.test(label), 'Etykieta heurystyki nie pokazuje kierunku', { label });
      }),
      makeTest('Eksport i druk', 'Layout druku buduje HTML z tytułem i arkuszami', 'Sprawdza, czy wydruk składa poprawny HTML z tytułem i kartami arkuszy.', ()=>{
        const html = FC.rozrysPrintLayout.buildPrintHtml(Fx.printPayload(), buildPrintDeps());
        assert(/Test rozrysu/.test(html), 'HTML wydruku nie zawiera tytułu', { html });
        assert((html.match(/class="sheet-card"/g) || []).length === 2, 'HTML wydruku nie zawiera dwóch arkuszy', { html });
      }),
      makeTest('Eksport i druk', 'Dwa małe arkusze mieszczą się na jednej stronie wydruku', 'Sprawdza, czy dwa małe arkusze nie są sztucznie rozdzielane na dwie strony, jeśli mieszczą się przy tej samej skali.', ()=>{
        const html = FC.rozrysPrintLayout.buildPrintHtml(Fx.pairPrintPayload(), buildPrintDeps());
        const pageCount = (html.match(/class="print-page"/g) || []).length;
        const sheetCount = (html.match(/class="sheet-card"/g) || []).length;
        assert(sheetCount === 2, 'Testowy wydruk nie zawiera dwóch kart arkuszy', { pageCount, sheetCount, html });
        assert(pageCount === 1, 'Dwa małe arkusze nie zostały złożone na jednej stronie', { pageCount, html });
      }),
    ];

    const startedAt = Date.now();
    const results = tests.map((test)=>{
      try{
        test.fn();
        return { group:test.group, name:test.name, explain:test.explain, ok:true };
      }catch(error){
        return {
          group:test.group,
          name:test.name,
          explain:test.explain,
          ok:false,
          message:error && error.message ? error.message : String(error),
          details:error && error.details ? error.details : null,
        };
      }
    });
    const passed = results.filter((row)=> row.ok).length;
    const groupsMap = new Map();
    results.forEach((row)=>{
      if(!groupsMap.has(row.group)) groupsMap.set(row.group, []);
      groupsMap.get(row.group).push(row);
    });
    const groups = Array.from(groupsMap.entries()).map(([name, rows])=>({
      name,
      total: rows.length,
      passed: rows.filter((row)=> row.ok).length,
      failed: rows.filter((row)=> !row.ok).length,
      results: rows,
    }));
    const report = {
      ok: passed === results.length,
      total: results.length,
      passed,
      failed: results.length - passed,
      durationMs: Date.now() - startedAt,
      results,
      groups,
    };
    report.summaryText = `${report.passed}/${report.total} OK`;
    report.clipboardText = makeClipboardReport(report);
    return report;
  }

  FC.rozrysDevTests = { runAll };
})(typeof window !== 'undefined' ? window : globalThis);
