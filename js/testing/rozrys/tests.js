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


  function installFakeDom(){
    function FakeNode(tag){
      this.tagName = String(tag || '').toUpperCase();
      this.attributes = {};
      this.children = [];
      this.checked = false;
      this.disabled = false;
      this.value = '';
      this.textContent = '';
      this.innerHTML = '';
      this.parentNode = null;
      this.dataset = {};
      this.style = {};
      this.hidden = false;
      this.__listeners = {};
      this._className = '';
      this.classList = {
        add: (...names)=>{
          const cur = new Set(String(this._className || '').split(/\s+/).filter(Boolean));
          names.forEach((name)=> cur.add(String(name)));
          this._className = Array.from(cur).join(' ');
        },
        remove: (...names)=>{
          const cur = new Set(String(this._className || '').split(/\s+/).filter(Boolean));
          names.forEach((name)=> cur.delete(String(name)));
          this._className = Array.from(cur).join(' ');
        },
        contains: (name)=> String(this._className || '').split(/\s+/).filter(Boolean).includes(String(name)),
        toggle: (name, force)=>{
          const exists = String(this._className || '').split(/\s+/).filter(Boolean).includes(String(name));
          const next = force === undefined ? !exists : !!force;
          if(next) this.classList.add(name); else this.classList.remove(name);
          return next;
        }
      };
    }
    FakeNode.prototype.appendChild = function(child){ if(child) child.parentNode = this; this.children.push(child); return child; };
    FakeNode.prototype.addEventListener = function(type, handler){ (this.__listeners[type] = this.__listeners[type] || []).push(handler); };
    FakeNode.prototype.dispatch = function(type){ (this.__listeners[type] || []).forEach((handler)=> handler({ type, target:this })); };
    FakeNode.prototype.setAttribute = function(name, value){
      this.attributes[name] = String(value);
      if(name === 'class') this._className = String(value || '');
      if(/^data-/.test(name)){
        const key = String(name).replace(/^data-/, '').replace(/-([a-z])/g, (_m, ch)=> String(ch || '').toUpperCase());
        this.dataset[key] = String(value);
      }
    };
    FakeNode.prototype.getAttribute = function(name){ return name === 'class' ? this._className : this.attributes[name]; };
    FakeNode.prototype.querySelectorAll = function(selector){
      const out = [];
      const walk = (node)=>{
        if(!node) return;
        const ds = node.dataset || {};
        if(selector === '[data-rozrys-sheet-card="1"]' && String(ds.rozrysSheetCard || '') === '1') out.push(node);
        if(selector === '[data-rozrys-sheet="1"]' && String(ds.rozrysSheet || '') === '1') out.push(node);
        if(selector === 'canvas[data-rozrys-sheet="1"]' && node.tagName === 'CANVAS' && String(ds.rozrysSheet || '') === '1') out.push(node);
        (node.children || []).forEach(walk);
      };
      walk(this);
      return out;
    };
    Object.defineProperty(FakeNode.prototype, 'className', {
      get(){ return this._className; },
      set(value){ this._className = String(value || ''); },
      enumerable:true,
      configurable:true,
    });

    const prevDocument = host.document;
    const prevNode = host.Node;
    const fakeDocument = { createElement:(tag)=> new FakeNode(tag) };
    let nodePatched = false;
    let documentReplaced = false;
    let createElementPatched = false;
    const prevCreateElement = prevDocument && typeof prevDocument.createElement === 'function' ? prevDocument.createElement : null;

    try{
      host.Node = FakeNode;
      nodePatched = true;
    }catch(_error){ }

    try{
      host.document = fakeDocument;
      documentReplaced = true;
    }catch(_error){
      if(prevDocument && prevCreateElement){
        try{
          prevDocument.createElement = fakeDocument.createElement;
          createElementPatched = true;
        }catch(__error){ }
      }
    }

    return function restore(){
      try{ if(documentReplaced) host.document = prevDocument; }catch(_error){}
      try{ if(createElementPatched && prevDocument && prevCreateElement) prevDocument.createElement = prevCreateElement; }catch(_error){}
      try{ if(nodePatched) host.Node = prevNode; }catch(_error){}
    };
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
    const prevRozrysOverride = fc.rozrys && fc.rozrys.__projectOverride;
    if(fc.rozrys && typeof fc.rozrys === 'object') fc.rozrys.__projectOverride = project;
    const prevLoad = fc.project && fc.project.load;
    if(fc.project && typeof fc.project.load === 'function') fc.project.load = ()=> project;
    const prevNs = fc.cabinetCutlist;
    fc.cabinetCutlist = fc.cabinetCutlist || {};
    const prevFn = fc.cabinetCutlist.getCabinetCutList;
    fc.cabinetCutlist.getCabinetCutList = cutListFn;
    try{
      return run();
    }finally{
      host.projectData = prevProject;
      if(fc.rozrys && typeof fc.rozrys === 'object'){
        if(prevRozrysOverride) fc.rozrys.__projectOverride = prevRozrysOverride;
        else delete fc.rozrys.__projectOverride;
      }
      if(fc.project && typeof fc.project === 'object') fc.project.load = prevLoad;
      if(prevNs && typeof prevNs === 'object'){
        fc.cabinetCutlist.getCabinetCutList = prevFn;
      } else if(prevFn){
        fc.cabinetCutlist.getCabinetCutList = prevFn;
      } else {
        delete fc.cabinetCutlist;
      }
    }
  }


  function withPatchedRoomRegistry(registryPatch, run){
    const prevRoomRegistry = FC.roomRegistry;
    FC.roomRegistry = Object.assign({}, prevRoomRegistry || {}, registryPatch || {});
    try{
      return run();
    }finally{
      FC.roomRegistry = prevRoomRegistry;
    }
  }

  function withPatchedUiState(statePatch, run){
    const prevHostUiState = host.uiState;
    const prevFcUiState = FC.uiState;
    const baseState = (()=>{
      try{
        if(prevFcUiState && typeof prevFcUiState.get === 'function') return prevFcUiState.get() || {};
      }catch(_error){}
      return (prevHostUiState && typeof prevHostUiState === 'object') ? prevHostUiState : {};
    })();
    const nextState = Object.assign({}, baseState, statePatch || {});
    host.uiState = nextState;
    FC.uiState = Object.assign({}, prevFcUiState || {}, { get: ()=> nextState });
    try{
      return run();
    }finally{
      host.uiState = prevHostUiState;
      FC.uiState = prevFcUiState;
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


      makeTest('Plan helpers', 'Wydzielone helpery planu ROZRYS delegują cache key z tym samym kontraktem zależności', 'Pilnuje kolejnego bezpiecznego splitu technicznego: makePlanCacheKey po wydzieleniu nadal przekazuje do cache te same helpery partSignature / rotation / edgeStore.', ()=>{
        assert(FC.rozrysPlanHelpers && typeof FC.rozrysPlanHelpers.createApi === 'function', 'Brak FC.rozrysPlanHelpers.createApi');
        const captured = {};
        const prevCache = FC.rozrysCache;
        FC.rozrysCache = {
          makePlanCacheKey(state, parts, deps){
            captured.state = state;
            captured.parts = parts;
            captured.hasPartSignature = !!(deps && typeof deps.partSignature === 'function');
            captured.hasRotation = !!(deps && typeof deps.isPartRotationAllowed === 'function');
            captured.edgeStore = deps && typeof deps.loadEdgeStore === 'function' ? deps.loadEdgeStore() : null;
            return 'plan_test_key';
          },
          loadPlanCache(){ return { ok:true }; },
          savePlanCache(cache){ captured.saved = cache; },
        };
        try{
          const api = FC.rozrysPlanHelpers.createApi({
            FC,
            partSignature: (part)=> `${part.material}||${part.name}`,
            isPartRotationAllowed: ()=> true,
            loadEdgeStore: ()=> ({ MDF:{ left:1 } }),
          });
          const key = api.makePlanCacheKey({ boardW:2800 }, [{ material:'MDF', name:'Bok' }]);
          const cache = api.loadPlanCache();
          api.savePlanCache({ abc:123 });
          assert(key === 'plan_test_key', 'Plan helpers nie zwróciły klucza z delegacji cache', { key, captured });
          assert(captured.hasPartSignature && captured.hasRotation, 'Plan helpers nie przekazały helperów cache 1:1', captured);
          assert(captured.edgeStore && captured.edgeStore.MDF && captured.edgeStore.MDF.left === 1, 'Plan helpers nie przekazały loadEdgeStore do cache key', captured);
          assert(cache && cache.ok === true, 'Plan helpers nie delegują loadPlanCache', cache);
          assert(captured.saved && captured.saved.abc === 123, 'Plan helpers nie delegują savePlanCache', captured);
        } finally {
          FC.rozrysCache = prevCache;
        }
      }),
      makeTest('Plan helpers', 'Wydzielone helpery planu ROZRYS otwierają wyjątki słojów z bieżącą jednostką i refresh callbackiem', 'Pilnuje ścieżki materialHasGrain/openMaterialGrainExceptions po splicie: modal słojów ma dostać ten sam unitValue, callback refresh i helpery materiałowe.', ()=>{
        assert(FC.rozrysPlanHelpers && typeof FC.rozrysPlanHelpers.createApi === 'function', 'Brak FC.rozrysPlanHelpers.createApi');
        const prevGrainModal = FC.rozrysGrainModal;
        const prevMaterialHasGrain = FC.materialHasGrain;
        const captured = {};
        FC.materialHasGrain = (name, list)=> String(name || '').includes('Dąb') && Array.isArray(list) && list.length === 2;
        FC.rozrysGrainModal = {
          openMaterialGrainExceptions(payload, helpers){
            captured.payload = payload;
            captured.helpers = helpers;
            return 'opened';
          },
        };
        try{
          const api = FC.rozrysPlanHelpers.createApi({
            FC,
            materials:[{ name:'Dąb dziki' }, { name:'Biel alpejska' }],
            controls:{ unitSel:{ value:'cm' } },
            tryAutoRenderFromCache: ()=> 'refresh-ok',
            askRozrysConfirm: ()=> Promise.resolve(true),
            openRozrysInfo: ()=> undefined,
            setMaterialGrainExceptions: ()=> undefined,
            getMaterialGrainEnabled: ()=> true,
            getMaterialGrainExceptions: ()=> ({ a:'free' }),
            materialPartDirectionLabel: ()=> 'Wzdłuż',
            partSignature: ()=> 'sig-a',
            mmToUnitStr: (mm)=> `${mm}cm`,
          });
          const result = api.openMaterialGrainExceptions('Dąb dziki', [{ material:'Dąb dziki', w:600, h:350 }]);
          assert(result === 'opened', 'Plan helpers nie delegują otwarcia modala wyjątków słojów', { result, captured });
          assert(captured.payload && captured.payload.unitValue === 'cm', 'Plan helpers nie przekazały bieżącej jednostki do modala słojów', captured);
          assert(captured.payload && captured.payload.tryAutoRenderFromCache && captured.payload.tryAutoRenderFromCache() === 'refresh-ok', 'Plan helpers nie przekazały callbacku refresh do modala słojów', captured);
          assert(captured.helpers && captured.helpers.materialHasGrain('Dąb dziki') === true, 'Plan helpers nie przekazały poprawnego helpera materialHasGrain', captured);
          assert(captured.helpers && captured.helpers.mmToUnitStr(120) === '120cm', 'Plan helpers nie przekazały mmToUnitStr do modala słojów', captured);
        } finally {
          FC.rozrysGrainModal = prevGrainModal;
          FC.materialHasGrain = prevMaterialHasGrain;
        }
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
        const agg = withPatchedRoomRegistry({
          hasCurrentInvestor: ()=> true,
          getActiveRoomIds: ()=> ['kuchnia'],
        }, ()=> withPatchedProjectFixture(fixtureProject, fixtureCutList, ()=> FC.rozrys.aggregatePartsForProject(['salon'])));
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
        const agg = withPatchedRoomRegistry({
          hasCurrentInvestor: ()=> true,
          getActiveRoomIds: ()=> ['kuchnia'],
        }, ()=> withPatchedProjectFixture(fixtureProject, fixtureCutList, ()=> FC.rozrys.aggregatePartsForProject(['kuchnia'])));
        assert(Array.isArray(agg.selectedRooms) && agg.selectedRooms.includes('inne'), 'ROZRYS nie zrobił retry po realnych pokojach projektu', agg);
        assert(Array.isArray(agg.materials) && agg.materials.includes('Jesion test'), 'ROZRYS po retry nadal nie zbudował materiału', agg);
      }),

      makeTest('Projekt i agregacja', 'ROZRYS nie poszerza scope pustego, ale istniejącego pokoju do innych pokoi projektu', 'Pilnuje dokładnego zakresu: jeśli wybrany pokój istnieje, ale nie ma żadnych szafek, agregacja ma zostać pusta zamiast po cichu pobierać materiał z innego pokoju.', ()=>{
        const fixtureProject = {
          schemaVersion: 9,
          room_a:{ cabinets:[{ id:'cab-a', width:80, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
          room_h:{ cabinets:[], fronts:[], sets:[], settings:{} },
          meta:{
            roomDefs:{
              room_a:{ id:'room_a', baseType:'kuchnia', name:'A', label:'A' },
              room_h:{ id:'room_h', baseType:'pokoj', name:'H', label:'H' },
            },
            roomOrder:['room_a','room_h']
          }
        };
        const fixtureCutList = (cabinet, roomId)=>{
          if(String(roomId || '') !== 'room_a') return [];
          return [
            { name:'Bok A', qty:2, a:72, b:56, material:'Materiał A' },
          ];
        };
        const agg = withPatchedProjectFixture(fixtureProject, fixtureCutList, ()=> FC.rozrys.aggregatePartsForProject(['room_h']));
        assert(Array.isArray(agg.selectedRooms) && agg.selectedRooms.length === 1 && String(agg.selectedRooms[0] || '') === 'room_h', 'ROZRYS zgubił exact selectedRooms dla pustego pokoju', agg);
        assert(Array.isArray(agg.materials) && agg.materials.length === 0, 'ROZRYS nie może po cichu pobierać materiału z innego pokoju, gdy exact scope jest pusty', agg);
      }),

      makeTest('Projekt i agregacja', 'ROZRYS startując z pokoju bierze exact current room zamiast starego globalnego scope z innego pokoju', 'Pilnuje regresji po fixie exact-scope: gdy zapisany globalny wybór pokoi wskazuje inny pokój niż aktualnie otwarty, ROZRYS ma wystartować od bieżącego roomType zamiast odziedziczyć obcy scope i pokazać pusty stan.', ()=>{
        const fixtureProject = {
          schemaVersion: 9,
          room_a:{ cabinets:[{ id:'cab-a', width:80, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
          room_h:{ cabinets:[], fronts:[], sets:[], settings:{} },
          meta:{
            roomDefs:{
              room_a:{ id:'room_a', baseType:'kuchnia', name:'A', label:'A' },
              room_h:{ id:'room_h', baseType:'pokoj', name:'H', label:'H' },
            },
            roomOrder:['room_a','room_h']
          }
        };
        const fixtureCutList = (cabinet, roomId)=>{
          if(String(roomId || '') !== 'room_a') return [];
          return [
            { name:'Bok A', qty:2, a:72, b:56, material:'Materiał A' },
          ];
        };
        assert(FC.rozrys && typeof FC.rozrys.resolveInitialSelectedRooms === 'function', 'Brak FC.rozrys.resolveInitialSelectedRooms');
        const resolved = withPatchedRoomRegistry({
          hasCurrentInvestor: ()=> true,
          getActiveRoomIds: ()=> ['room_a', 'room_h'],
        }, ()=> withPatchedUiState({ roomType:'room_a' }, ()=> withPatchedProjectFixture(fixtureProject, fixtureCutList, ()=>{
          const rooms = FC.rozrys.resolveInitialSelectedRooms('room_h');
          const agg = FC.rozrys.aggregatePartsForProject(rooms);
          return { rooms, agg };
        })));
        assert(Array.isArray(resolved.rooms) && resolved.rooms.length === 1 && resolved.rooms[0] === 'room_a', 'ROZRYS nie nadpisał starego scope bieżącym pokojem', resolved);
        assert(Array.isArray(resolved.agg && resolved.agg.materials) && resolved.agg.materials.includes('Materiał A'), 'ROZRYS po starcie z pokoju nadal nie zbudował materiałów bieżącego pokoju', resolved);
      }),



      makeTest('Projekt i agregacja', 'ROZRYS discoverVisibleProjectRoomKeys trzyma meta kolejność i odrzuca puste legacy pokoje', 'Pilnuje splitu helpera źródeł projektu: widoczne pokoje mają brać kolejność z meta projektu, ale nie mogą doklejać pustych legacy kreatorów bez danych.', ()=>{
        const fixtureProject = {
          schemaVersion: 9,
          meta:{
            roomDefs:{
              room_b:{ id:'room_b', baseType:'pokoj', name:'Salon', label:'Salon' },
              room_a:{ id:'room_a', baseType:'kuchnia', name:'Kuchnia', label:'Kuchnia' },
            },
            roomOrder:['room_b','room_a']
          },
          room_a:{ cabinets:[{ id:'cab-a', width:80, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
          room_b:{ cabinets:[{ id:'cab-b', width:70, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
          kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{} },
          pokoj:{ cabinets:[], fronts:[], sets:[], settings:{} },
        };
        assert(FC.rozrys && typeof FC.rozrys.discoverVisibleProjectRoomKeys === 'function', 'Brak FC.rozrys.discoverVisibleProjectRoomKeys');
        const rooms = FC.rozrys.discoverVisibleProjectRoomKeys(fixtureProject);
        assert(Array.isArray(rooms) && rooms.length === 2, 'Helper widocznych pokoi nadal dokleił puste legacy pokoje albo zgubił meta pokoje', rooms);
        assert(rooms[0] === 'room_b' && rooms[1] === 'room_a', 'Helper widocznych pokoi nie zachował kolejności roomOrder z meta projektu', rooms);
        assert(!rooms.includes('kuchnia') && !rooms.includes('pokoj'), 'Helper widocznych pokoi nadal przepuszcza puste legacy kreatory', rooms);
      }),

      makeTest('Projekt i agregacja', 'ROZRYS picker pomieszczeń nie pokazuje legacy kreatorów, gdy inwestor ma własne pokoje', 'Pilnuje regresję, w której do wyboru pomieszczeń w ROZRYS wpadały bazowe kreatory kuchnia/szafa/pokój/łazienka mimo że aktywny inwestor miał już własne realne pokoje.', ()=>{
        const fixtureProject = {
          schemaVersion: 9,
          meta:{
            roomDefs:{
              room_a:{ id:'room_a', baseType:'pokoj', name:'a', label:'a' },
              room_j:{ id:'room_j', baseType:'pokoj', name:'J', label:'J' },
            },
            roomOrder:['room_a','room_j']
          },
          room_a:{ cabinets:[{ id:'cab-a', width:80, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
          room_j:{ cabinets:[{ id:'cab-j', width:70, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
          kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{} },
          szafa:{ cabinets:[], fronts:[], sets:[], settings:{} },
          pokoj:{ cabinets:[], fronts:[], sets:[], settings:{} },
          lazienka:{ cabinets:[], fronts:[], sets:[], settings:{} },
        };
        const rooms = withPatchedRoomRegistry({
          hasCurrentInvestor: ()=> true,
          getActiveRoomIds: ()=> ['room_a','room_j'],
          getRoomLabel: (room)=> room === 'room_a' ? 'a' : (room === 'room_j' ? 'J' : String(room || '')),
        }, ()=> withPatchedProjectFixture(fixtureProject, ()=> ([]), ()=> FC.rozrys.getRoomsForProject(fixtureProject)));
        assert(Array.isArray(rooms) && rooms.length === 2, 'ROZRYS nadal miesza realne pokoje inwestora z legacy kreatorami', rooms);
        assert(rooms.includes('room_a') && rooms.includes('room_j'), 'ROZRYS zgubił realne pokoje inwestora po odfiltrowaniu legacy kreatorów', rooms);
        assert(!rooms.includes('kuchnia') && !rooms.includes('szafa') && !rooms.includes('pokoj') && !rooms.includes('lazienka'), 'ROZRYS nadal pokazuje legacy kreatory jako pokoje wyboru', rooms);
      }),
      makeTest('Projekt i agregacja', 'ROZRYS przy aktywnym roomRegistry nie gubi pokojów odkrytych w projekcie', 'Pilnuje first-click regresji, w której aktywny inwestor zwracał stare pokoje z registry i blokował materiały z faktycznego projektu.', ()=>{
        const fixtureProject = {
          schemaVersion: 9,
          salon:{ cabinets:[{ id:'cab-5', width:80, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
        };
        const fixtureCutList = ()=> ([
          { name:'Półka', qty:3, a:56, b:30, material:'First click test' },
        ]);
        const agg = withPatchedRoomRegistry({
          hasCurrentInvestor: ()=> true,
          getActiveRoomIds: ()=> ['kuchnia'],
        }, ()=> withPatchedProjectFixture(fixtureProject, fixtureCutList, ()=> FC.rozrys.aggregatePartsForProject(['salon'])));
        assert(Array.isArray(agg.selectedRooms) && agg.selectedRooms.includes('salon'), 'ROZRYS nie dopuścił pokoju odkrytego w projekcie przy aktywnym roomRegistry', agg);
        assert(Array.isArray(agg.materials) && agg.materials.includes('First click test'), 'ROZRYS nadal zgubił materiały przy pierwszym przebiegu z aktywnym roomRegistry', agg);
      }),
      makeTest('Projekt i agregacja', 'ROZRYS filtruje pokoje z tego samego projektu także przy pierwszym przebiegu', 'Pilnuje, czy agregacja i lista dopuszczalnych pokoi korzystają z tego samego kandydata projektu zamiast mieszać fixture z globalnymi domyślnymi pokojami.', ()=>{
        const fixtureProject = {
          schemaVersion: 9,
          salon:{ cabinets:[{ id:'cab-4', width:80, height:72, depth:56 }], fronts:[], sets:[], settings:{} },
        };
        const fixtureCutList = ()=> ([
          { name:'Bok', qty:2, a:72, b:56, material:'Scoped salon test' },
        ]);
        const prevSchemaRooms = FC.schema && Array.isArray(FC.schema.ROOMS) ? FC.schema.ROOMS.slice() : null;
        const prevWindowProject = host.window && host.window.projectData;
        const prevRoomRegistry = FC.roomRegistry;
        FC.roomRegistry = {
          hasCurrentInvestor: ()=> false,
          getActiveRoomIds: ()=> [],
        };
        if(FC.schema) FC.schema.ROOMS = ['kuchnia','szafa','pokoj','lazienka'];
        if(host.window) host.window.projectData = { schemaVersion:9, kuchnia:{ cabinets:[{ id:'stale-cab', width:60, height:72, depth:56 }], fronts:[], sets:[], settings:{} } };
        try{
          const agg = withPatchedProjectFixture(fixtureProject, fixtureCutList, ()=> FC.rozrys.aggregatePartsForProject(['salon']));
          assert(Array.isArray(agg.selectedRooms) && agg.selectedRooms.includes('salon'), 'ROZRYS odfiltrował pokój fixture po globalnych pokojach zamiast po scoped projekcie', agg);
          assert(Array.isArray(agg.materials) && agg.materials.includes('Scoped salon test'), 'ROZRYS nie zbudował materiału po scoped wyborze pokoju', agg);
        } finally {
          if(FC.schema){
            if(prevSchemaRooms) FC.schema.ROOMS = prevSchemaRooms;
            else delete FC.schema.ROOMS;
          }
          if(host.window) host.window.projectData = prevWindowProject;
          FC.roomRegistry = prevRoomRegistry;
        }
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
      makeTest('Render ROZRYS', 'Walidacja scalania liczy różnice RAW → skomasowana niezależnie od tabeli produkcyjnej', 'Sprawdza, czy techniczna walidacja scalania nadal poprawnie liczy różnice RAW → skomasowana, mimo że sama tabela Skomasowana wróciła do roli listy produkcyjnej.', ()=>{
        const mergeValidation = FC.rozrysValidation.validateResolution([
          { key:'m||A||100x100', material:'M', name:'A', w:100, h:100, qty:2, cabinet:'#1', room:'Kuchnia' },
          { key:'m||A||100x100', material:'M', name:'A', w:100, h:100, qty:1, cabinet:'#2', room:'Salon' },
        ], [
          { key:'m||A||100x100', material:'M', name:'A', w:100, h:100, qty:2, cabinet:'#1', room:'Kuchnia' },
        ]);
        assert(mergeValidation.ok === false, 'Walidacja scalania nie wykryła różnicy RAW → scalanie', mergeValidation);
        assert(mergeValidation.rows[0] && mergeValidation.rows[0].rawQty === 3, 'Walidacja scalania nie policzyła ilości RAW', mergeValidation.rows[0]);
        assert(mergeValidation.rows[0] && mergeValidation.rows[0].mergedQty === 2, 'Walidacja scalania nie policzyła ilości po scaleniu', mergeValidation.rows[0]);
      }),
      makeTest('Render ROZRYS', 'Renderer buduje osobne sekcje summary/actions/sheets i pilnuje kart arkuszy', 'Sprawdza, czy render rozrysu dzieli widok na sekcje oraz czy po renderze istnieje tyle kart i canvasów, ile arkuszy.', ()=>{
        const restoreDom = installFakeDom();
        try{
          const out = host.document.createElement('div');
          const plan = { sheets: Fx.mixedPlanSheets(), meta:{ boardW:2800, boardH:2070 } };
          const meta = { material:'MDF 18 biały', kerf:4, unit:'mm', edgeSubMm:0, parts:Fx.basicParts(), scopeMode:'both', selectedRooms:['Kuchnia'] };
          FC.rozrysRender.renderOutput(plan, meta, {
            out,
            buildRozrysDiagnostics: ()=> ({ validation:{ ok:true, rows:[] }, sheets:[{ rows:[] }, { rows:[] }], rawRows:[], rawCount:0, rawQtyTotal:0, mergedRows:[], mergedCount:0, mergedQtyTotal:0, mergedQtyMatch:true }),
            validationSummaryLabel: ()=> ({ tone:'is-ok', text:'Walidacja OK' }),
            openValidationListModal: ()=>{},
            openSheetListModal: ()=>{},
            buildCsv: ()=> 'x',
            downloadText: ()=>{},
            openPrintView: ()=>{},
            measurePrintHeaderMm: ()=> 10,
            mmToUnitStr: (mm)=> String(mm),
            drawSheet: (canvas)=> { canvas.__drawn = true; },
            cutOptimizer: { placedArea: ()=> 100 },
          });
          const sections = collectNodes(out, (node)=> (node.dataset && node.dataset.rozrysSection));
          assert(sections.length >= 3, 'Renderer nie zbudował osobnych sekcji summary/actions/sheets', sections.map((node)=> node.dataset && node.dataset.rozrysSection));
          const cards = collectNodes(out, (node)=> node.dataset && node.dataset.rozrysSheetCard === '1');
          const canvases = collectNodes(out, (node)=> node.tagName === 'CANVAS' && node.dataset && node.dataset.rozrysSheet === '1');
          assert(cards.length === 2, 'Renderer nie zbudował tylu kart arkuszy, ile plan ma sheetów', { cards:cards.length, expected:2 });
          assert(canvases.length === 2, 'Renderer nie zbudował tylu canvasów, ile plan ma sheetów', { canvases:canvases.length, expected:2 });
        } finally {
          restoreDom();
        }
      }),
      makeTest('Render ROZRYS', 'Guard renderu wykrywa brak kart/canvasów', 'Sprawdza, czy mechanizm anty-regresyjny wykrywa rozjazd między liczbą arkuszy a zbudowanym DOM.', ()=>{
        const restoreDom = installFakeDom();
        try{
          const hostNode = host.document.createElement('div');
          const result = FC.rozrysRender.validateRenderedSheets(hostNode, 1);
          assert(result.ok === false, 'Guard renderu nie wykrył braku kart/canvasów', result);
        } finally {
          restoreDom();
        }
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
