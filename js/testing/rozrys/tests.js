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
    const children = node.children;
    const iterableChildren = Array.isArray(children)
      ? children
      : (children && typeof children.length === 'number' ? Array.from(children) : []);
    iterableChildren.forEach((child)=> collectNodes(child, predicate, bucket));
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
            h: (tag, attrs)=> ({ tag, attrs: attrs || {} }),
          });
          const result = api.openMaterialGrainExceptions('Dąb dziki', [{ material:'Dąb dziki', w:600, h:350 }]);
          assert(result === 'opened', 'Plan helpers nie delegują otwarcia modala wyjątków słojów', { result, captured });
          assert(captured.payload && captured.payload.unitValue === 'cm', 'Plan helpers nie przekazały bieżącej jednostki do modala słojów', captured);
          assert(captured.payload && typeof captured.payload.h === 'function', 'Plan helpers nie przekazały helpera DOM h do modala słojów', captured);
          assert(captured.payload && captured.payload.h('div', { class:'x' }).tag === 'div', 'Plan helpers przekazały uszkodzony helper DOM h do modala słojów', captured);
          assert(captured.payload && captured.payload.tryAutoRenderFromCache && captured.payload.tryAutoRenderFromCache() === 'refresh-ok', 'Plan helpers nie przekazały callbacku refresh do modala słojów', captured);
          assert(captured.helpers && captured.helpers.materialHasGrain('Dąb dziki') === true, 'Plan helpers nie przekazały poprawnego helpera materialHasGrain', captured);
          assert(captured.helpers && captured.helpers.mmToUnitStr(120) === '120cm', 'Plan helpers nie przekazały mmToUnitStr do modala słojów', captured);
        } finally {
          FC.rozrysGrainModal = prevGrainModal;
          FC.materialHasGrain = prevMaterialHasGrain;
        }
      }),

      makeTest('Engine bridge', 'Wydzielony bridge silnika ROZRYS deleguje computePlan z tym samym kontraktem zależności', 'Pilnuje kolejnego bezpiecznego splitu technicznego: computePlan po wydzieleniu nadal przekazuje do rozrysEngine loadEdgeStore / partSignature / rotation i aktywny cutOptimizer.', ()=>{
        assert(FC.rozrysEngineBridge && typeof FC.rozrysEngineBridge.createApi === 'function', 'Brak FC.rozrysEngineBridge.createApi');
        const prevEngine = FC.rozrysEngine;
        const prevOptimizer = FC.cutOptimizer;
        const captured = {};
        FC.cutOptimizer = { id:'opt-1' };
        FC.rozrysEngine = {
          computePlan(state, parts, deps){
            captured.state = state;
            captured.parts = parts;
            captured.hasLoadEdgeStore = !!(deps && typeof deps.loadEdgeStore === 'function');
            captured.hasPartSignature = !!(deps && typeof deps.partSignature === 'function');
            captured.hasRotation = !!(deps && typeof deps.isPartRotationAllowed === 'function');
            captured.edgeStore = deps && typeof deps.loadEdgeStore === 'function' ? deps.loadEdgeStore() : null;
            captured.partSig = deps && typeof deps.partSignature === 'function' ? deps.partSignature({ material:'MDF', name:'Bok', w:720, h:560 }) : null;
            captured.rotation = deps && typeof deps.isPartRotationAllowed === 'function' ? deps.isPartRotationAllowed({ material:'MDF' }, true, { a:'free' }) : null;
            captured.cutOptimizer = deps && deps.cutOptimizer;
            return { ok:true, sheets:[{ id:'sheet-1' }] };
          },
        };
        try{
          const api = FC.rozrysEngineBridge.createApi({
            FC,
            loadEdgeStore: ()=> ({ MDF:{ left:1 } }),
            partSignature: (part)=> `${part.material}||${part.name}||${part.w}x${part.h}`,
            isPartRotationAllowed: ()=> 'rotation-ok',
          });
          const plan = api.computePlan({ boardW:2800 }, [{ material:'MDF', name:'Bok' }]);
          assert(plan && plan.ok === true && Array.isArray(plan.sheets) && plan.sheets.length === 1, 'Engine bridge nie zwrócił wyniku computePlan z delegacji', { plan, captured });
          assert(captured.hasLoadEdgeStore && captured.hasPartSignature && captured.hasRotation, 'Engine bridge nie przekazał pełnego kontraktu zależności do computePlan', captured);
          assert(captured.edgeStore && captured.edgeStore.MDF && captured.edgeStore.MDF.left === 1, 'Engine bridge nie przekazał loadEdgeStore 1:1 do computePlan', captured);
          assert(captured.partSig === 'MDF||Bok||720x560', 'Engine bridge nie przekazał partSignature do computePlan', captured);
          assert(captured.rotation === 'rotation-ok', 'Engine bridge nie przekazał isPartRotationAllowed do computePlan', captured);
          assert(captured.cutOptimizer === FC.cutOptimizer, 'Engine bridge nie przekazał aktywnego cutOptimizer do computePlan', captured);
        } finally {
          FC.rozrysEngine = prevEngine;
          FC.cutOptimizer = prevOptimizer;
        }
      }),
      makeTest('Engine bridge', 'Wydzielony bridge rysowania arkusza deleguje scheduleSheetCanvasRefresh z działającym drawSheet', 'Pilnuje ścieżki render/listy po splicie: scheduler canvasów nadal dostaje helper drawSheet, a drawSheet nadal przekazuje mmToUnitStr do rozrysSheetDraw.', ()=>{
        assert(FC.rozrysEngineBridge && typeof FC.rozrysEngineBridge.createApi === 'function', 'Brak FC.rozrysEngineBridge.createApi');
        const prevSheetDraw = FC.rozrysSheetDraw;
        const captured = {};
        FC.rozrysSheetDraw = {
          scheduleSheetCanvasRefresh(scope, deps){
            captured.scope = scope;
            captured.hasDrawSheet = !!(deps && typeof deps.drawSheet === 'function');
            captured.drawResult = deps && typeof deps.drawSheet === 'function'
              ? deps.drawSheet('canvas-x', { id:'sheet-1' }, 'cm', 1, { code:'MDF' })
              : null;
            return 'scheduled-ok';
          },
          drawSheet(canvas, sheet, displayUnit, edgeSubMm, boardMeta, helpers){
            captured.drawCall = { canvas, sheet, displayUnit, edgeSubMm, boardMeta };
            captured.mmText = helpers && typeof helpers.mmToUnitStr === 'function' ? helpers.mmToUnitStr(125, 'cm') : null;
            return 'drawn-ok';
          },
        };
        try{
          const api = FC.rozrysEngineBridge.createApi({
            FC,
            mmToUnitStr: (mm)=> `${mm}cm`,
          });
          const result = api.scheduleSheetCanvasRefresh({ material:'MDF A' });
          assert(result === 'scheduled-ok', 'Engine bridge nie zwrócił wyniku scheduleSheetCanvasRefresh z delegacji', { result, captured });
          assert(captured.hasDrawSheet === true, 'Engine bridge nie przekazał drawSheet do scheduleru canvasów', captured);
          assert(captured.drawResult === 'drawn-ok', 'Engine bridge przekazał niedziałający helper drawSheet do scheduleru', captured);
          assert(captured.drawCall && captured.drawCall.displayUnit === 'cm' && captured.drawCall.boardMeta && captured.drawCall.boardMeta.code === 'MDF', 'Engine bridge nie przekazał argumentów drawSheet 1:1', captured);
          assert(captured.mmText === '125cm', 'Engine bridge nie przekazał mmToUnitStr do drawSheet', captured);
        } finally {
          FC.rozrysSheetDraw = prevSheetDraw;
        }
      }),


      makeTest('Part helpers', 'Wydzielone part helpers ROZRYS delegują resolveCabinetCutListFn, resolveRozrysPartFromSource i rotation bez zmiany kontraktu', 'Pilnuje bezpiecznego splitu helperów części: agregacja i plan helpers nadal muszą dostać te same resolve/fallback helpery bez wchodzenia w UI launchery.', ()=>{
        assert(FC.rozrysPartHelpers && typeof FC.rozrysPartHelpers.createApi === 'function', 'Brak FC.rozrysPartHelpers.createApi');
        const prevStore = FC.materialPartOptions;
        const prevCutlist = FC.cabinetCutlist;
        const captured = { calls:[] };
        FC.materialPartOptions = {
          resolvePartForRozrys(part){ captured.calls.push({ type:'resolve', part }); return { materialKey:'STORE_KEY', name:'Front', sourceSig:'store-sig', direction:'vertical', ignoreGrain:true, w:701, h:502, qty:3 }; },
          labelForDirection(direction){ captured.calls.push({ type:'label', direction }); return direction === 'vertical' ? 'Pion' : 'Inny'; },
        };
        FC.cabinetCutlist = {
          getCabinetCutList(cab, room){ captured.cutArgs = { cab, room, ctx:this }; return ['ok']; }
        };
        try{
          const api = FC.rozrysPartHelpers.createApi({
            FC,
            host: host,
            cmToMm: (v)=> Math.round((Number(v) || 0) * 10),
            partSignature: (part)=> `${part.material}||${part.name}||${part.w}x${part.h}`,
          });
          const cutListFn = api.resolveCabinetCutListFn();
          assert(typeof cutListFn === 'function', 'Part helpers nie zwróciły getCabinetCutList z cabinetCutlist', captured);
          const cutResult = cutListFn({ id:'cab-1' }, 'room-a');
          assert(Array.isArray(cutResult) && cutResult[0] === 'ok', 'Part helpers nie delegują resolveCabinetCutListFn do cabinetCutlist', captured);
          const resolved = api.resolveRozrysPartFromSource({ material:'Front: laminat • Dąb', name:'Front', a:70.1, b:50.2, qty:3 });
          assert(resolved && resolved.materialKey === 'STORE_KEY' && resolved.sourceSig === 'store-sig', 'Part helpers nie delegują resolveRozrysPartFromSource do materialPartOptions', resolved);
          const directionLabel = api.materialPartDirectionLabel({ direction:'vertical' });
          assert(directionLabel === 'Pion', 'Part helpers nie delegują materialPartDirectionLabel do materialPartOptions.labelForDirection', { directionLabel, captured });
          const rotationAllowed = api.isPartRotationAllowed({ material:'MDF', name:'Bok', w:720, h:560 }, true, { 'MDF||Bok||720x560':true });
          assert(rotationAllowed === true, 'Part helpers zmieniły kontrakt isPartRotationAllowed', { rotationAllowed });
          assert(api.isFrontMaterialKey('Front: laminat • Dąb') === true, 'Part helpers nie rozpoznają klucza frontu po splicie');
          assert(api.normalizeFrontLaminatMaterialKey('Front: laminat • Dąb') === 'Dąb', 'Part helpers nie prostują klucza laminatowego frontu po splicie');
        } finally {
          FC.materialPartOptions = prevStore;
          FC.cabinetCutlist = prevCutlist;
        }
      }),
      makeTest('Bootstrap i splity', 'ROZRYS ładuje part helpers przed rozrys.js i zachowuje kontrakt helperów części po splicie', 'Pilnuje regresji, w której nowy moduł helperów części byłby ładowany po rozrys.js albo rozrys.js straciłby przekazywanie helperów resolve/rotation do engine/plan helpers.', ()=>{
        const indexHtml = readAssetSource('index.html');
        const devHtml = readAssetSource('dev_tests.html');
        const rozrysSrc = readAssetSource('js/app/rozrys/rozrys.js');
        const partHelpersSrc = readAssetSource('js/app/rozrys/rozrys-part-helpers.js');
        assert(partHelpersSrc && partHelpersSrc.includes('FC.rozrysPartHelpers'), 'Brak źródła nowego modułu part helpers w assetach smoke');
        const partIdx = indexHtml.indexOf('js/app/rozrys/rozrys-part-helpers.js');
        const rozrysIdx = indexHtml.indexOf('js/app/rozrys/rozrys.js');
        assert(partIdx >= 0 && rozrysIdx >= 0 && partIdx < rozrysIdx, 'index.html ładuje rozrys-part-helpers po rozrys.js', { partIdx, rozrysIdx });
        const partDevIdx = devHtml.indexOf('js/app/rozrys/rozrys-part-helpers.js');
        const rozrysDevIdx = devHtml.indexOf('js/app/rozrys/rozrys.js');
        assert(partDevIdx >= 0 && rozrysDevIdx >= 0 && partDevIdx < rozrysDevIdx, 'dev_tests.html ładuje rozrys-part-helpers po rozrys.js', { partDevIdx, rozrysDevIdx });
        assert(/const\s+resolveCabinetCutListFn\s*=\s*partHelpers\.resolveCabinetCutListFn/.test(rozrysSrc), 'rozrys.js po splicie nie czyta resolveCabinetCutListFn z partHelpers', { snippet: rozrysSrc.slice(0, 2600) });
        assert(/const\s+isPartRotationAllowed\s*=\s*partHelpers\.isPartRotationAllowed/.test(rozrysSrc), 'rozrys.js po splicie nie czyta isPartRotationAllowed z partHelpers', { snippet: rozrysSrc.slice(0, 2600) });
      }),


      makeTest('UI bridge', 'Wydzielone UI tools ROZRYS budują label z info i delegują confirm przez confirmBox', 'Pilnuje splitu helperów UI: labelWithInfo ma dalej renderować info-trigger, a askRozrysConfirm ma przejść przez confirmBox z pełnym payloadem.', ()=>{
        assert(FC.rozrysUiTools && typeof FC.rozrysUiTools.createApi === 'function', 'Brak FC.rozrysUiTools.createApi');
        const prevInfoBox = FC.infoBox;
        const prevConfirmBox = FC.confirmBox;
        const captured = { info:null, confirm:null };
        FC.infoBox = { open(payload){ captured.info = payload; } };
        FC.confirmBox = { ask(payload){ captured.confirm = payload; return true; } };
        try{
          const api = FC.rozrysUiTools.createApi({ FC });
          const row = api.labelWithInfo('Pomieszczenia', 'Pomieszczenia', 'Info test');
          const infoBtn = (row && typeof row.querySelector === 'function' ? row.querySelector('.info-trigger') : null)
            || (row && row.children && typeof row.children.length === 'number' ? Array.from(row.children).find((node)=> String(node && node.className || '').includes('info-trigger')) : null)
            || collectNodes(row, (node)=> String(node.className || '').includes('info-trigger'))[0];
          assert(infoBtn, 'labelWithInfo nie zbudował info-trigger po splicie helperów UI', { className: row && row.className, childCount: row && row.children && row.children.length, html: row && row.innerHTML });
          if(typeof infoBtn.dispatch === 'function') infoBtn.dispatch('click');
          else if(typeof infoBtn.click === 'function') infoBtn.click();
          else if(infoBtn && infoBtn.__listeners && Array.isArray(infoBtn.__listeners.click) && typeof infoBtn.__listeners.click[0] === 'function') infoBtn.__listeners.click[0]({ type:'click', target:infoBtn, preventDefault(){} });
          assert(captured.info && captured.info.title === 'Pomieszczenia' && captured.info.message === 'Info test', 'labelWithInfo nie deleguje już poprawnie do infoBox.open', captured);
          const ok = api.askRozrysConfirm({ title:'TEST', message:'Czy?', confirmText:'TAK', cancelText:'NIE' });
          assert(ok === true, 'askRozrysConfirm po splicie helperów UI nie zwrócił wyniku confirmBox.ask', captured);
          assert(captured.confirm && captured.confirm.title === 'TEST' && captured.confirm.confirmText === 'TAK' && captured.confirm.cancelText === 'NIE', 'askRozrysConfirm nie przekazał payloadu 1:1 do confirmBox.ask', captured);
        } finally {
          FC.infoBox = prevInfoBox;
          FC.confirmBox = prevConfirmBox;
        }
      }),
      makeTest('UI bridge', 'Wydzielony UI bridge ROZRYS deleguje opcje, magazyn i progress bez zmiany kontraktu', 'Pilnuje splitu technicznego: modal opcji i dodawania płyty nadal dostają te same ctx/deps, a progress bridge nadal aktualizuje uiState i deleguje do rozrysProgress.', ()=>{
        assert(FC.rozrysUiBridge && typeof FC.rozrysUiBridge.createApi === 'function', 'Brak FC.rozrysUiBridge.createApi');
        const prevOptionsModal = FC.rozrysOptionsModal;
        const prevStockModal = FC.rozrysStockModal;
        const prevProgress = FC.rozrysProgress;
        const captured = { options:null, stock:null, uiPatches:[], progress:{ modes:[], cancelled:false, running:true, buttonMode:'done' } };
        FC.rozrysOptionsModal = { openOptionsModal(ctx, deps){ captured.options = { ctx, deps }; return 'options-ok'; } };
        FC.rozrysStockModal = { openAddStockModal(ctx, deps){ captured.stock = { ctx, deps }; return 'stock-ok'; } };
        FC.rozrysProgress = {
          createController(args){
            captured.progress.args = args;
            return {
              setGenBtnMode(mode){ captured.progress.modes.push(mode); return `mode:${mode}`; },
              requestCancel(){ captured.progress.cancelled = true; return 'cancelled'; },
              isRunning(){ return captured.progress.running; },
              getButtonMode(){ return captured.progress.buttonMode; },
            };
          }
        };
        try{
          const api = FC.rozrysUiBridge.createApi({ FC });
          const optionsCtx = { unitSel:{ value:'cm' }, edgeSel:{ value:'0' } };
          const optionsDeps = { tryAutoRenderFromCache: ()=> 'cache-ok' };
          const stockCtx = { agg:{ materials:['MDF'] }, matSelValue:'{}' };
          const stockDeps = { normalizeMaterialScopeForAggregate: ()=> ({ kind:'all' }) };
          const optionsResult = api.openOptionsModal(optionsCtx, optionsDeps);
          const stockResult = api.openAddStockModal(stockCtx, stockDeps);
          assert(optionsResult === 'options-ok' && captured.options && captured.options.ctx === optionsCtx && captured.options.deps === optionsDeps, 'UI bridge nie deleguje openOptionsModal 1:1 do rozrys-options-modal', captured);
          assert(stockResult === 'stock-ok' && captured.stock && captured.stock.ctx === stockCtx && captured.stock.deps === stockDeps, 'UI bridge nie deleguje openAddStockModal 1:1 do rozrys-stock-modal', captured);
          const progressApi = api.createProgressApi({
            statusBox:{ id:'box' }, statusMain:{ id:'main' }, statusSub:{ id:'sub' }, statusMeta:{ id:'meta' }, statusProg:{ id:'prog' }, statusProgBar:{ id:'bar' }, genBtn:{ id:'btn' },
            setUiState:(patch)=> captured.uiPatches.push(patch),
          });
          const modeResult = progressApi.setGenBtnMode('running');
          const running = progressApi.isRozrysRunning();
          const btnMode = progressApi.getRozrysBtnMode();
          const cancelResult = progressApi.requestCancel();
          assert(modeResult === 'mode:running', 'UI bridge nie deleguje setGenBtnMode do kontrolera progress', captured);
          assert(running === true && btnMode === 'done' && cancelResult === 'cancelled', 'UI bridge nie deleguje odczytu/stoppu progress do kontrolera', captured);
          assert(captured.progress.args && captured.progress.args.genBtn && captured.progress.args.statusBox, 'UI bridge nie przekazał elementów statusu do createController', captured);
          assert(captured.uiPatches.some((patch)=> patch && patch.buttonMode === 'running' && patch.running === true), 'UI bridge nie zapisuje uiState przy setGenBtnMode', captured.uiPatches);
          assert(captured.uiPatches.some((patch)=> patch && patch.running === true), 'UI bridge nie zapisuje uiState przy isRozrysRunning', captured.uiPatches);
          assert(captured.uiPatches.some((patch)=> patch && patch.running === false), 'UI bridge nie zapisuje uiState przy requestCancel', captured.uiPatches);
        } finally {
          FC.rozrysOptionsModal = prevOptionsModal;
          FC.rozrysStockModal = prevStockModal;
          FC.rozrysProgress = prevProgress;
        }
      }),



      makeTest('Panel workspace', 'Wydzielony panel/workspace ROZRYS zachowuje live refsy i helpery opcji', 'Pilnuje dużego splitu panelu opcji: refsy kontrolek pozostają wspólne dla run/output, persist czyta aktualny selection scope, a getBaseState dalej opiera się o rozrysState.buildBaseStateFromControls.', ()=>{
        assert(FC.rozrysPanelWorkspace && typeof FC.rozrysPanelWorkspace.createApi === 'function', 'Brak FC.rozrysPanelWorkspace.createApi');
        const restoreDom = installFakeDom();
        const prevRozrysState = FC.rozrysState;
        const captured = { saved:null, baseCalls:[], optionWrites:[] };
        try{
          FC.rozrysState = Object.assign({}, prevRozrysState || {}, {
            buildBaseStateFromControls(controls, deps){
              captured.baseCalls.push({ controls, deps });
              return {
                unit: controls.unitSel.value,
                edgeSubMm: Number(controls.edgeSel.value || 0),
                boardW: Number(controls.inW.value || 0),
                boardH: Number(controls.inH.value || 0),
                kerf: Number(controls.inK.value || 0),
                edgeTrim: Number(controls.inTrim.value || 0),
                minScrapW: Number(controls.inMinW.value || 0),
                minScrapH: Number(controls.inMinH.value || 0),
                heur: 'optimax',
                optimaxProfile: controls.heurSel.value,
                direction: deps.normalizeCutDirection(controls.dirSel.value),
              };
            }
          });
          const api = FC.rozrysPanelWorkspace.createApi({ FC });
          const card = document.createElement('div');
          let selectedRooms = ['kuchnia'];
          let materialScope = { kind:'all', material:'', includeFronts:true, includeCorpus:true };
          const state = { unit:'cm', boardW:280, boardH:207, kerf:0.4, edgeTrim:1, minScrapW:0, minScrapH:0 };
          const workspace = api.createWorkspace({
            h: (tag, attrs)=> createFakeNode(tag, attrs),
            labelWithInfo: (title)=> {
              const row = createFakeNode('div', { class:'label-help' });
              row.appendChild(createFakeNode('span', { class:'label-help__text', text:title }));
              return row;
            },
            createChoiceLauncher: (label)=> createFakeNode('button', { text:label }),
            getSelectOptionLabel: (select)=> String(select && select.value || ''),
            setChoiceLaunchValue: (btn, label)=> { if(btn) btn.textContent = String(label || ''); },
            openRozrysChoiceOverlay: async ()=> null,
            card,
            state,
            panelPrefs: { edgeSubMm:1 },
            getSelectedRooms: ()=> selectedRooms.slice(),
            getMaterialScope: ()=> Object.assign({}, materialScope),
            encodeRoomsSelection: (rooms)=> `rooms:${rooms.join('|')}`,
            encodeMaterialScope: (scope)=> JSON.stringify(scope || {}),
            loadPanelPrefs: ()=> ({ keep:'ok' }),
            savePanelPrefs: (payload)=> { captured.saved = payload; },
            rozState: { setOptionState: (next)=> captured.optionWrites.push(next) },
          }, {
            normalizeCutDirection: (value)=> `norm:${value}`,
          });
          assert(workspace && workspace.unitSel && workspace.edgeSel && workspace.genBtn && workspace.out, 'Panel workspace nie zwrócił oczekiwanych refsów UI', workspace);
          selectedRooms = ['salon'];
          materialScope = { kind:'material', material:'MDF test', includeFronts:true, includeCorpus:false };
          workspace.persistOptionPrefs();
          assert(captured.saved && captured.saved.keep === 'ok' && captured.saved.selectedRooms === 'rooms:salon', 'persistOptionPrefs nie czyta live selectedRooms z getterów', captured.saved);
          assert(captured.saved.materialScope === JSON.stringify(materialScope) && Number(captured.saved.edgeSubMm) === 1, 'persistOptionPrefs nie zapisał aktualnego material scope / edgeSubMm', captured.saved);
          workspace.applyUnitChange('mm');
          assert(workspace.unitSel.value === 'mm' && state.unit === 'mm', 'applyUnitChange nie zsynchronizował jednostki na wspólnym stanie/refie', { unit:workspace.unitSel.value, state });
          assert(String(workspace.inW.value) === '2800' && String(workspace.inH.value) === '2070', 'applyUnitChange nie przeliczył bazowego formatu arkusza', { w:workspace.inW.value, h:workspace.inH.value });
          workspace.heurSel.value = 'max';
          workspace.dirSel.value = 'start-optimax';
          const base = workspace.getBaseState();
          assert(captured.baseCalls.length === 1 && captured.baseCalls[0].controls.unitSel === workspace.unitSel, 'getBaseState nie deleguje do rozrysState.buildBaseStateFromControls na tych samych refach', captured.baseCalls);
          assert(base.direction === 'norm:start-optimax' && captured.optionWrites.length === 1, 'getBaseState nie zwrócił / nie zapisał znormalizowanego stanu opcji', { base, optionWrites:captured.optionWrites });
        } finally {
          FC.rozrysState = prevRozrysState;
          restoreDom();
        }
      }),

      makeTest('Scope helpers', 'ROZRYS scope createApi wiąże live deps pokojów i agregacji bez lokalnych wrapperów w rozrys.js', 'Pilnuje następnego większego splitu: rozrys.js ma używać związanego API z rozrys-scope.js, a helpery scope/material dalej muszą czytać aktualne getRooms i aggregatePartsForProject przy wywołaniu.', ()=>{
        assert(FC.rozrysScope && typeof FC.rozrysScope.createApi === 'function', 'Brak FC.rozrysScope.createApi');
        let rooms = ['kuchnia', 'salon'];
        let aggregateCalls = 0;
        let aggregateFn = ()=>{
          aggregateCalls += 1;
          return {
            materials:['MDF test'],
            groups:{
              'MDF test': { hasFronts:true, hasCorpus:false }
            },
            selectedRooms:['salon']
          };
        };
        const api = FC.rozrysScope.createApi({
          getRooms: ()=> rooms.slice(),
          getAggregatePartsForProject: ()=> aggregateFn,
          splitMaterialAccordionTitle: (material)=> ({ line1:`MAT:${material}`, line2:'Fronty' }),
        });
        assert(api.encodeRoomsSelection(['salon', 'ghost']) === 'salon', 'Scope createApi nie filtruje encodeRoomsSelection po live getRooms', { encoded: api.encodeRoomsSelection(['salon', 'ghost']) });
        rooms = ['salon'];
        const decoded = api.decodeRoomsSelection('kuchnia|salon|ghost');
        assert(Array.isArray(decoded) && decoded.length === 1 && decoded[0] === 'salon', 'Scope createApi nie czyta aktualnych pokojów przy decodeRoomsSelection', decoded);
        const normalizedScope = api.normalizeMaterialScopeForAggregate({ kind:'material', material:'MDF test', includeFronts:true, includeCorpus:true });
        assert(normalizedScope && normalizedScope.includeFronts === true && normalizedScope.includeCorpus === false, 'Scope createApi nie użył live aggregatePartsForProject przy normalizeMaterialScopeForAggregate', normalizedScope);
        const summary = api.getScopeSummary({ kind:'material', material:'MDF test', includeFronts:true, includeCorpus:false }, {
          materials:['MDF test'],
          groups:{ 'MDF test': { hasFronts:true, hasCorpus:false } },
          selectedRooms:['salon']
        });
        assert(summary && summary.title === 'MAT:MDF test' && summary.detail === 'Same fronty', 'Scope createApi nie deleguje getScopeSummary z lokalnym splitMaterialAccordionTitle', summary);
        const key = api.getAccordionScopeKey({ kind:'material', material:'MDF test', includeFronts:true, includeCorpus:false }, { selectedRooms:['salon'] });
        assert(String(key || '').includes('salon') && String(key || '').includes('fronts'), 'Scope createApi nie buduje scope key na związanych helperach', { key });
        assert(aggregateCalls >= 1, 'Scope createApi nie wywołał live aggregatePartsForProject podczas normalizacji scope', { aggregateCalls });
      }),




      makeTest('Runtime bundle', 'Wydzielony runtime bundle ROZRYS składa plan/output/run bez zmiany kontraktów modułów', 'Pilnuje bezpiecznego splitu assemblera runtime: rozrys.js ma dalej przekazywać te same payloady do plan helpers, output controllera i run controllera, tylko przez jeden moduł spinający.', ()=>{
        assert(FC.rozrysRuntimeBundle && typeof FC.rozrysRuntimeBundle.createApi === 'function', 'Brak FC.rozrysRuntimeBundle.createApi');
        const prevPlanHelpers = FC.rozrysPlanHelpers;
        const prevOutputController = FC.rozrysOutputController;
        const prevRunController = FC.rozrysRunController;
        const captured = {};
        try{
          FC.rozrysPlanHelpers = {
            createApi(args){
              captured.plan = args;
              return { marker:'plan-ok' };
            }
          };
          FC.rozrysOutputController = {
            createApi(args){
              captured.outputApi = args;
              return {
                createController(ctx, deps){
                  captured.output = { ctx, deps };
                  return { marker:'output-ok' };
                }
              };
            }
          };
          FC.rozrysRunController = {
            createApi(args){
              captured.runApi = args;
              return {
                createController(ctx, deps){
                  captured.run = { ctx, deps };
                  return { marker:'run-ok' };
                }
              };
            }
          };
          const api = FC.rozrysRuntimeBundle.createApi({ FC });
          const plan = api.createPlanHelpers({ id:'plan-deps' });
          const output = api.createOutputController({
            ctx:{ out:{ id:'out' }, getSetGenBtnMode: ()=> ()=> undefined },
            deps:{ id:'output-deps' },
          });
          const run = api.createRunController({
            ctx:{ genBtn:{ id:'btn' } },
            deps:{ id:'run-deps' },
          });
          assert(plan && plan.marker === 'plan-ok' && captured.plan && captured.plan.id === 'plan-deps', 'Runtime bundle nie deleguje createPlanHelpers 1:1 do rozrysPlanHelpers', captured);
          assert(output && output.marker === 'output-ok' && captured.outputApi && captured.outputApi.FC === FC, 'Runtime bundle nie buduje output controllera przez FC.rozrysOutputController.createApi', captured);
          assert(captured.output && captured.output.ctx && captured.output.ctx.out && captured.output.deps && captured.output.deps.id === 'output-deps', 'Runtime bundle nie przekazał ctx/deps output controllera 1:1', captured);
          assert(run && run.marker === 'run-ok' && captured.runApi && captured.runApi.FC === FC, 'Runtime bundle nie buduje run controllera przez FC.rozrysRunController.createApi', captured);
          assert(captured.run && captured.run.ctx && captured.run.ctx.genBtn && captured.run.deps && captured.run.deps.id === 'run-deps', 'Runtime bundle nie przekazał ctx/deps run controllera 1:1', captured);
        } finally {
          FC.rozrysPlanHelpers = prevPlanHelpers;
          FC.rozrysOutputController = prevOutputController;
          FC.rozrysRunController = prevRunController;
        }
      }),

      makeTest('Run controller', 'Wydzielony run controller ROZRYS deleguje progress, generowanie i magazyn bez zmiany kontraktu', 'Pilnuje dużego splitu action/run: progress bridge nadal steruje stanem przycisku, generate przekazuje pełny payload do rozrysRunner, a Dodaj płytę dalej dostaje ten sam ctx/deps.', async ()=>{
        assert(FC.rozrysRunController && typeof FC.rozrysRunController.createApi === 'function', 'Brak FC.rozrysRunController.createApi');
        const prevRunner = FC.rozrysRunner;
        const captured = { progress:null, stock:null, generate:null, uiPatches:[] };
        FC.rozrysRunner = {
          async generate(force, deps){
            captured.generate = { force, deps };
            return 'runner-ok';
          }
        };
        try{
          const api = FC.rozrysRunController.createApi({ FC });
          const progressCtrl = { id:'progress-1' };
          const createProgressApi = (args)=>{
            captured.progress = args;
            return {
              controller: progressCtrl,
              setGenBtnMode: (mode)=> `mode:${mode}`,
              requestCancel: ()=> 'cancelled',
              isRozrysRunning: ()=> true,
              getRozrysBtnMode: ()=> 'done',
            };
          };
          const openAddStockModalBridge = (ctx, deps)=>{
            captured.stock = { ctx, deps };
            return 'stock-ok';
          };
          const openOptionsModalBridge = (ctx, deps)=>{
            captured.options = { ctx, deps };
            return 'options-ok';
          };
          const mkEl = (value)=> ({ value:value || '', listeners:{}, addEventListener(type, fn){ (this.listeners[type] = this.listeners[type] || []).push(fn); } });
          const agg = { materials:['MDF'], selectedRooms:['room_a'] };
          const controller = api.createController({
            FC,
            statusBox:{ id:'status-box' },
            statusMain:{ id:'status-main' },
            statusSub:{ id:'status-sub' },
            statusMeta:{ id:'status-meta' },
            statusProg:{ id:'status-prog' },
            statusProgBar:{ id:'status-prog-bar' },
            genBtn: mkEl(''),
            addStockBtn: mkEl(''),
            openOptionsBtnInline: mkEl(''),
            matSel: mkEl('{"kind":"all"}'),
            unitSel: mkEl('cm'),
            edgeSel: mkEl('1'),
            inW: mkEl('280'),
            inH: mkEl('207'),
            inK: mkEl('0.4'),
            inTrim: mkEl('1'),
            inMinW: mkEl('0'),
            inMinH: mkEl('0'),
            heurSel: mkEl('max'),
            dirSel: mkEl('start-optimax'),
            out:{ id:'out' },
            getAggregate: ()=> agg,
            setUiState: (patch)=> captured.uiPatches.push(patch),
          }, {
            createProgressApi,
            openAddStockModalBridge,
            openOptionsModalBridge,
            applyUnitChange: (next)=>{ captured.unitApplied = next; },
            persistOptionPrefs: ()=>{ captured.persistCount = (captured.persistCount || 0) + 1; },
            tryAutoRenderFromCache: ()=>{ captured.autoCount = (captured.autoCount || 0) + 1; return false; },
            h: ()=> null,
            labelWithInfo: ()=> null,
            getDefaultRozrysOptionValues: ()=> ({ unit:'cm' }),
            normalizeMaterialScopeForAggregate: (selection)=> selection,
            decodeMaterialScope: ()=> ({ kind:'all' }),
            normalizeCutDirection: (value)=> value,
            loadPlanCache: ()=> ({}),
            savePlanCache: ()=> undefined,
            materialHasGrain: ()=> false,
            getMaterialGrainEnabled: ()=> false,
            getMaterialGrainExceptions: ()=> ({}),
            partSignature: ()=> 'sig',
            getRealHalfStockForMaterial: ()=> ({ qty:0 }),
            getExactSheetStockForMaterial: ()=> ({ qty:0 }),
            getLargestSheetFormatForMaterial: ()=> ({ width:2800, height:2070 }),
            buildStockSignatureForMaterial: ()=> 'stock-sig',
            makePlanCacheKey: ()=> 'cache-key',
            renderOutput: ()=> undefined,
            formatHeurLabel: ()=> 'heur',
            getRozrysScopeMode: ()=> 'both',
            getOptimaxProfilePreset: ()=> ({}),
            speedLabel: ()=> 'MAX',
            directionLabel: ()=> 'Opti-max',
            renderLoadingInto: ()=> undefined,
            computePlanPanelProAsync: async ()=> ({ sheets:[] }),
            loadEdgeStore: ()=> ({}),
            isPartRotationAllowed: ()=> true,
            applySheetStockLimit: (plan)=> plan,
            computePlan: ()=> ({ sheets:[] }),
            buildEntriesForScope: ()=> [],
            getAccordionScopeKey: ()=> 'scope-key',
            getAccordionPref: ()=> ({ open:false }),
            createMaterialAccordionSection: ()=> ({ wrap:null }),
            setAccordionPref: ()=> undefined,
            setMaterialGrainEnabled: ()=> undefined,
            tryAutoRenderFromCache: ()=> false,
            openMaterialGrainExceptions: ()=> undefined,
            splitMaterialAccordionTitle: ()=> ({ line1:'MDF', line2:'' }),
            parseLocaleNumber: ()=> 1,
            openRozrysInfo: ()=> undefined,
            askRozrysConfirm: ()=> true,
            createChoiceLauncher: ()=> null,
            getSelectOptionLabel: ()=> '',
            setChoiceLaunchValue: ()=> undefined,
            openRozrysChoiceOverlay: async ()=> null,
          });
          assert(controller.progressCtrl === progressCtrl, 'Run controller nie zwrócił kontrolera progress z bridgea', { controller, captured });
          assert(controller.setGenBtnMode('running') === 'mode:running', 'Run controller nie deleguje setGenBtnMode do progressApi', captured);
          assert(controller.requestCancel() === 'cancelled' && controller.isRozrysRunning() === true && controller.getRozrysBtnMode() === 'done', 'Run controller nie deleguje requestCancel/isRozrysRunning/getRozrysBtnMode do progressApi', captured);
          const optionsResult = controller.openOptionsModal();
          assert(optionsResult === 'options-ok', 'Run controller nie deleguje Opcji do ui bridge', captured);
          assert(captured.options && captured.options.ctx && captured.options.ctx.unitSel && captured.options.deps && typeof captured.options.deps.applyUnitChange === 'function', 'Run controller nie przekazał ctx/deps Opcji 1:1', captured);
          const stockResult = controller.openAddStockModal();
          assert(stockResult === 'stock-ok', 'Run controller nie deleguje Dodaj płytę do ui bridge', captured);
          assert(captured.stock && captured.stock.ctx && captured.stock.ctx.agg === agg && captured.stock.ctx.unitValue === 'cm', 'Run controller nie przekazał ctx Dodaj płytę 1:1', captured);
          controller.bindInteractions();
          assert(Array.isArray(captured.progress.genBtn.listeners.click) && captured.progress.genBtn.listeners.click.length === 1, 'Run controller nie podpiął click do Generuj rozkrój', captured.progress.genBtn.listeners);
          assert(Array.isArray(captured.progress.genBtn.listeners.click) && captured.progress.genBtn.listeners.click.length === 1, 'Run controller nie podpiął click do Generuj rozkrój', captured.progress.genBtn.listeners);
          assert(Array.isArray(captured.options.ctx.unitSel.listeners.change) && captured.options.ctx.unitSel.listeners.change.length === 1, 'Run controller nie podpiął change do Jednostek', captured.options.ctx.unitSel.listeners);
          assert(Array.isArray(captured.options.ctx.unitSel.listeners.change) && captured.options.ctx.unitSel.listeners.change.length === 1, 'Run controller nie podpiął change do Jednostek', captured.options.ctx.unitSel.listeners);
          assert(Array.isArray(captured.options.ctx.inK.listeners.input) && captured.options.ctx.inK.listeners.input.length === 1, 'Run controller nie podpiął preview/persist do Rzazu', captured.options.ctx.inK.listeners);
          const generateResult = await controller.generate(true);
          assert(generateResult === 'runner-ok', 'Run controller nie deleguje generate do rozrysRunner', captured);
          assert(captured.generate && captured.generate.force === true, 'Run controller nie przekazał force do rozrysRunner.generate', captured);
          assert(captured.generate && captured.generate.deps && captured.generate.deps.progressCtrl === progressCtrl, 'Run controller nie przekazał progressCtrl do rozrysRunner.generate', captured);
          assert(captured.generate && captured.generate.deps && captured.generate.deps.agg === agg, 'Run controller nie przekazał aktualnego aggregate do rozrysRunner.generate', captured);
          assert(captured.progress && captured.progress.genBtn && captured.progress.statusBox, 'Run controller nie przekazał elementów statusu do createProgressApi', captured);
        } finally {
          FC.rozrysRunner = prevRunner;
        }
      }),
      makeTest('Bootstrap i splity', 'ROZRYS ładuje run controller i runtime bundle przed rozrys.js oraz zachowuje bezpieczne spięcie createRunController', 'Pilnuje regresji, w której moduł action/run albo assembler runtime byłby ładowany po rozrys.js lub rozrys.js wróciłby do bezpośredniego createController zamiast createRunController z runtime bundle.', ()=>{
        const indexHtml = readAssetSource('index.html');
        const devHtml = readAssetSource('dev_tests.html');
        const rozrysSrc = readAssetSource('js/app/rozrys/rozrys.js');
        const runCtrlSrc = readAssetSource('js/app/rozrys/rozrys-run-controller.js');
        const runtimeBundleSrc = readAssetSource('js/app/rozrys/rozrys-runtime-bundle.js');
        assert(runCtrlSrc && runCtrlSrc.includes('FC.rozrysRunController'), 'Brak źródła nowego modułu run controller w assetach smoke');
        assert(runtimeBundleSrc && runtimeBundleSrc.includes('FC.rozrysRuntimeBundle'), 'Brak źródła modułu runtime bundle w assetach smoke');
        const runIdx = indexHtml.indexOf('js/app/rozrys/rozrys-run-controller.js');
        const runtimeIdx = indexHtml.indexOf('js/app/rozrys/rozrys-runtime-bundle.js');
        const rozrysIdx = indexHtml.indexOf('js/app/rozrys/rozrys.js');
        assert(runIdx >= 0 && rozrysIdx >= 0 && runIdx < rozrysIdx, 'index.html ładuje rozrys-run-controller po rozrys.js', { runIdx, rozrysIdx });
        assert(runtimeIdx >= 0 && rozrysIdx >= 0 && runtimeIdx < rozrysIdx, 'index.html ładuje rozrys-runtime-bundle po rozrys.js', { runtimeIdx, rozrysIdx });
        const runDevIdx = devHtml.indexOf('js/app/rozrys/rozrys-run-controller.js');
        const runtimeDevIdx = devHtml.indexOf('js/app/rozrys/rozrys-runtime-bundle.js');
        const rozrysDevIdx = devHtml.indexOf('js/app/rozrys/rozrys.js');
        assert(runDevIdx >= 0 && rozrysDevIdx >= 0 && runDevIdx < rozrysDevIdx, 'dev_tests.html ładuje rozrys-run-controller po rozrys.js', { runDevIdx, rozrysDevIdx });
        assert(runtimeDevIdx >= 0 && rozrysDevIdx >= 0 && runtimeDevIdx < rozrysDevIdx, 'dev_tests.html ładuje rozrys-runtime-bundle po rozrys.js', { runtimeDevIdx, rozrysDevIdx });
        assert(/const\s+runCtrl\s*=\s*runtimeBundleApi\.createRunController\(/.test(rozrysSrc), 'rozrys.js po splicie nie tworzy run controllera przez runtime bundle', { snippet: rozrysSrc.slice(22000, 31500) });
        assert(/const runtimeBundleApi\s*=\s*\(FC\.rozrysRuntimeBundle && typeof FC\.rozrysRuntimeBundle\.createApi === 'function'\)/.test(rozrysSrc), 'rozrys.js nie ma bezpiecznego fallbacku createApi dla runtime bundle', { snippet: rozrysSrc.slice(9000, 16500) });
      }),
      makeTest('Output controller', 'Wydzielony output controller ROZRYS deleguje cache, render i accordiony bez zmiany kontraktu', 'Pilnuje większego splitu ścieżki output/render/cache: tryAutoRenderFromCache, renderOutput i wrappery accordionów nadal dostają ten sam payload oraz nie gubią callbacków współbieżnych z renderem wyników.', ()=>{
        assert(FC.rozrysOutputController && typeof FC.rozrysOutputController.createApi === 'function', 'Brak FC.rozrysOutputController.createApi');
        const prevRender = FC.rozrysRender;
        const prevAccordion = FC.rozrysAccordion;
        const captured = { buildEntries:null, auto:null, output:null, section:null, accordion:null, title:null, setModeCalls:[] };
        FC.rozrysRender = Object.assign({}, prevRender, {
          buildEntriesForScope(selection, aggregate, deps){
            captured.buildEntries = { selection, aggregate, deps };
            return [{ material:'MDF', parts:[{ id:1 }] }];
          },
          tryAutoRenderFromCache(deps){
            captured.auto = deps;
            return true;
          },
          renderOutput(plan, meta, deps){
            captured.output = { plan, meta, deps };
            return 'render-ok';
          },
          renderLoadingInto(target, text, subText, deps){
            captured.loading = { target, text, subText, deps };
            return 'loading-ok';
          }
        });
        FC.rozrysAccordion = Object.assign({}, prevAccordion, {
          splitMaterialAccordionTitle(material){
            captured.title = material;
            return { line1:String(material || ''), line2:'group' };
          },
          createMaterialAccordionSection(material, options, deps){
            captured.section = { material, options, deps };
            return { wrap:{}, body:{}, trigger:{}, setOpenState:()=>{} };
          },
          renderMaterialAccordionPlans(scopeKey, scopeMode, entries, deps){
            captured.accordion = { scopeKey, scopeMode, entries, deps };
            return true;
          }
        });
        try{
          const api = FC.rozrysOutputController.createApi({ FC });
          const agg = { materials:['MDF'], groups:{ MDF:{ all:[{ id:'p1' }] } }, selectedRooms:['a'] };
          const ctrl = api.createController({
            out:{ id:'out' },
            getAggregate: ()=> agg,
            getMatSelValue: ()=> '{"kind":"all"}',
            getBaseState: ()=> ({ unit:'cm' }),
            setCacheState: (patch)=>{ captured.cachePatch = patch; },
            isRozrysRunning: ()=> false,
            getSetGenBtnMode: ()=> (mode)=> captured.setModeCalls.push(mode),
          }, {
            normalizeMaterialScopeForAggregate: (selection)=> selection,
            decodeMaterialScope: ()=> ({ kind:'all' }),
            aggregatePartsForProject: ()=> agg,
            getOrderedMaterialsForSelection: ()=> ['MDF'],
            getGroupPartsForScope: ()=> [{ id:'p1' }],
            getAccordionPref: ()=> ({ open:true }),
            setAccordionPref: ()=> undefined,
            materialHasGrain: ()=> false,
            getMaterialGrainEnabled: ()=> false,
            getMaterialGrainExceptions: ()=> ({}),
            setMaterialGrainEnabled: ()=> undefined,
            openMaterialGrainExceptions: ()=> undefined,
            formatHeurLabel: ()=> 'MAX',
            scheduleSheetCanvasRefresh: ()=> undefined,
            buildRozrysDiagnostics: ()=> ({ ok:true }),
            validationSummaryLabel: ()=> ({ tone:'ok', text:'OK' }),
            openValidationListModal: ()=> undefined,
            openSheetListModal: ()=> undefined,
            buildCsv: ()=> 'csv',
            downloadText: ()=> undefined,
            openPrintView: ()=> undefined,
            measurePrintHeaderMm: ()=> 0,
            mmToUnitStr: ()=> '10',
            drawSheet: ()=> undefined,
            cutOptimizer: { placedArea: ()=> 0 },
            loadPlanCache: ()=> ({}),
            toMmByUnit: ()=> 0,
            getRealHalfStockForMaterial: ()=> ({ qty:0 }),
            getExactSheetStockForMaterial: ()=> ({ qty:0 }),
            getLargestSheetFormatForMaterial: ()=> ({ width:2800, height:2070 }),
            partSignature: ()=> 'sig',
            buildStockSignatureForMaterial: ()=> 'stock',
            makePlanCacheKey: ()=> 'cache-key',
            getAccordionScopeKey: ()=> 'scope-key',
            getRozrysScopeMode: ()=> 'both',
          });
          const entries = ctrl.buildEntriesForScope({ kind:'all' }, agg);
          assert(Array.isArray(entries) && entries.length === 1, 'Output controller nie deleguje buildEntriesForScope do rozrysRender', captured);
          assert(captured.buildEntries && captured.buildEntries.aggregate === agg && typeof captured.buildEntries.deps.getOrderedMaterialsForSelection === 'function', 'Output controller nie przekazał deps buildEntries 1:1', captured);
          const title = ctrl.splitMaterialAccordionTitle('MDF');
          assert(title && title.line1 === 'MDF' && captured.title === 'MDF', 'Output controller nie deleguje splitMaterialAccordionTitle do rozrysAccordion', captured);
          ctrl.createMaterialAccordionSection('MDF', { grain:true });
          assert(captured.section && captured.section.material === 'MDF' && typeof captured.section.deps.scheduleSheetCanvasRefresh === 'function', 'Output controller nie przekazał deps do createMaterialAccordionSection', captured);
          const rendered = ctrl.renderMaterialAccordionPlans('scope-key', 'both', [{ material:'MDF', plan:{ sheets:[] }, parts:[{ id:1 }] }]);
          assert(rendered === true, 'Output controller nie deleguje renderMaterialAccordionPlans do rozrysAccordion', captured);
          assert(captured.accordion && captured.accordion.deps && typeof captured.accordion.deps.tryAutoRenderFromCache === 'function' && typeof captured.accordion.deps.renderOutput === 'function', 'Output controller nie przekazał callbacków render/cache do accordion bridge', captured);
          const outRes = ctrl.renderOutput({ sheets:[] }, { material:'MDF' }, { id:'target' });
          assert(outRes === 'render-ok', 'Output controller nie deleguje renderOutput do rozrysRender', captured);
          assert(captured.output && captured.output.deps && captured.output.deps.target && captured.output.deps.out && typeof captured.output.deps.buildRozrysDiagnostics === 'function', 'Output controller nie przekazał deps renderOutput 1:1', captured);
          const loadRes = ctrl.renderLoadingInto({ id:'target' }, 'Liczę', 'sub');
          assert(loadRes === 'loading-ok', 'Output controller nie deleguje renderLoadingInto do rozrysRender', captured);
          const autoRes = ctrl.tryAutoRenderFromCache();
          assert(autoRes === true, 'Output controller nie deleguje tryAutoRenderFromCache do rozrysRender', captured);
          assert(captured.auto && captured.auto.agg === agg && typeof captured.auto.buildEntriesForScope === 'function' && typeof captured.auto.renderMaterialAccordionPlans === 'function', 'Output controller nie przekazał deps cache/output 1:1', captured);
        } finally {
          FC.rozrysRender = prevRender;
          FC.rozrysAccordion = prevAccordion;
        }
      }),
      makeTest('Bootstrap i splity', 'ROZRYS ładuje scope, panel workspace, runtime bundle i output controller przed rozrys.js oraz zachowuje bezpieczne spięcia', 'Pilnuje regresji, w której assembler runtime byłby ładowany po rozrys.js lub rozrys.js wróciłby do ręcznego sklejania plan/output/run zamiast jednego modułu spinającego z zachowaniem hoistowanych fasad.', ()=>{
        const indexHtml = readAssetSource('index.html');
        const devHtml = readAssetSource('dev_tests.html');
        const rozrysSrc = readAssetSource('js/app/rozrys/rozrys.js');
        const scopeSrc = readAssetSource('js/app/rozrys/rozrys-scope.js');
        const panelSrc = readAssetSource('js/app/rozrys/rozrys-panel-workspace.js');
        const runtimeBundleSrc = readAssetSource('js/app/rozrys/rozrys-runtime-bundle.js');
        const outputSrc = readAssetSource('js/app/rozrys/rozrys-output-controller.js');
        assert(scopeSrc && scopeSrc.includes('FC.rozrysScope') && scopeSrc.includes('createApi'), 'Brak źródła modułu rozrys-scope z createApi w assetach smoke');
        assert(panelSrc && panelSrc.includes('FC.rozrysPanelWorkspace'), 'Brak źródła nowego modułu panel workspace w assetach smoke');
        assert(runtimeBundleSrc && runtimeBundleSrc.includes('FC.rozrysRuntimeBundle') && runtimeBundleSrc.includes('createApi'), 'Brak źródła modułu rozrys-runtime-bundle w assetach smoke');
        assert(outputSrc && outputSrc.includes('FC.rozrysOutputController'), 'Brak źródła nowego modułu output controller w assetach smoke');
        const scopeIdx = indexHtml.indexOf('js/app/rozrys/rozrys-scope.js');
        const panelIdx = indexHtml.indexOf('js/app/rozrys/rozrys-panel-workspace.js');
        const runtimeIdx = indexHtml.indexOf('js/app/rozrys/rozrys-runtime-bundle.js');
        const outIdx = indexHtml.indexOf('js/app/rozrys/rozrys-output-controller.js');
        const rozIdx = indexHtml.indexOf('js/app/rozrys/rozrys.js');
        assert(scopeIdx >= 0 && rozIdx >= 0 && scopeIdx < rozIdx, 'index.html ładuje rozrys-scope po rozrys.js', { scopeIdx, rozIdx });
        assert(panelIdx >= 0 && rozIdx >= 0 && panelIdx < rozIdx, 'index.html ładuje rozrys-panel-workspace po rozrys.js', { panelIdx, rozIdx });
        assert(runtimeIdx >= 0 && rozIdx >= 0 && runtimeIdx < rozIdx, 'index.html ładuje rozrys-runtime-bundle po rozrys.js', { runtimeIdx, rozIdx });
        assert(outIdx >= 0 && rozIdx >= 0 && outIdx < rozIdx, 'index.html ładuje rozrys-output-controller po rozrys.js', { outIdx, rozIdx });
        const scopeDevIdx = devHtml.indexOf('js/app/rozrys/rozrys-scope.js');
        const panelDevIdx = devHtml.indexOf('js/app/rozrys/rozrys-panel-workspace.js');
        const runtimeDevIdx = devHtml.indexOf('js/app/rozrys/rozrys-runtime-bundle.js');
        const outDevIdx = devHtml.indexOf('js/app/rozrys/rozrys-output-controller.js');
        const rozDevIdx = devHtml.indexOf('js/app/rozrys/rozrys.js');
        assert(scopeDevIdx >= 0 && rozDevIdx >= 0 && scopeDevIdx < rozDevIdx, 'dev_tests.html ładuje rozrys-scope po rozrys.js', { scopeDevIdx, rozDevIdx });
        assert(panelDevIdx >= 0 && rozDevIdx >= 0 && panelDevIdx < rozDevIdx, 'dev_tests.html ładuje rozrys-panel-workspace po rozrys.js', { panelDevIdx, rozDevIdx });
        assert(runtimeDevIdx >= 0 && rozDevIdx >= 0 && runtimeDevIdx < rozDevIdx, 'dev_tests.html ładuje rozrys-runtime-bundle po rozrys.js', { runtimeDevIdx, rozDevIdx });
        assert(outDevIdx >= 0 && rozDevIdx >= 0 && outDevIdx < rozDevIdx, 'dev_tests.html ładuje rozrys-output-controller po rozrys.js', { outDevIdx, rozDevIdx });
        assert(/const scopeApi\s*=\s*\(FC\.rozrysScope && typeof FC\.rozrysScope\.createApi === 'function'\)/.test(rozrysSrc), 'rozrys.js nie spina związanego scopeApi przez FC.rozrysScope.createApi', { snippet: rozrysSrc.slice(8500, 14500) });
        assert(/const panelWorkspaceApi[\s\S]*createWorkspace:\s*\(\)\s*=>\s*null/.test(rozrysSrc), 'rozrys.js nie ma bezpiecznego spięcia panelWorkspaceApi', { snippet: rozrysSrc.slice(9000, 14500) });
        assert(/const runtimeBundleApi\s*=\s*\(FC\.rozrysRuntimeBundle && typeof FC\.rozrysRuntimeBundle\.createApi === 'function'\)/.test(rozrysSrc), 'rozrys.js nie spina assemblera runtime przez FC.rozrysRuntimeBundle.createApi', { snippet: rozrysSrc.slice(9000, 16500) });
        assert(/const workspace\s*=\s*panelWorkspaceApi\.createWorkspace\([\s\S]*const persistOptionPrefs\s*=\s*workspace\.persistOptionPrefs;/.test(rozrysSrc), 'rozrys.js po splicie panelu nie składa workspace z bridgea i nie pobiera z niego live helperów/refów', { snippet: rozrysSrc.slice(16500, 24500) });
        assert(!/function\s+persistOptionPrefs\s*\(/.test(rozrysSrc) && !/function\s+applyUnitChange\s*\(/.test(rozrysSrc), 'rozrys.js nadal trzyma lokalne helpery opcji zamiast czytać je z panel workspace', { snippet: rozrysSrc.slice(16500, 24500) });
        assert(!/function\s+roomLabel\s*\(/.test(rozrysSrc) && !/function\s+normalizeRoomSelection\s*\(/.test(rozrysSrc) && !/function\s+encodeRoomsSelection\s*\(/.test(rozrysSrc) && !/function\s+decodeMaterialScope\s*\(/.test(rozrysSrc), 'rozrys.js nadal trzyma lokalne wrappery scope/material zamiast scopeApi', { snippet: rozrysSrc.slice(8500, 16000) });
        assert(/const renderScopeApi\s*=\s*\(FC\.rozrysScope && typeof FC\.rozrysScope\.createApi === 'function'\)/.test(rozrysSrc), 'rozrys.js nie buduje związanego renderScopeApi dla getScopeSummary/getRoomsSummary', { snippet: rozrysSrc.slice(16500, 22000) });
        assert(/const planHelpers\s*=\s*runtimeBundleApi\.createPlanHelpers\(/.test(rozrysSrc), 'rozrys.js po splicie nie składa plan helpers przez runtime bundle', { snippet: rozrysSrc.slice(20500, 24500) });
        assert(/(?:let|const)\s+outputCtrl\s*=\s*null[\s\S]*outputCtrl\s*=\s*runtimeBundleApi\.createOutputController\(/.test(rozrysSrc), 'rozrys.js po splicie nie tworzy output controllera przez runtime bundle albo nie inicjalizuje go jawnie po bootstrapie helperów', { snippet: rozrysSrc.slice(18000, 28500) });
        assert(/const\s+runCtrl\s*=\s*runtimeBundleApi\.createRunController\(/.test(rozrysSrc), 'rozrys.js po splicie nie tworzy run controllera przez runtime bundle', { snippet: rozrysSrc.slice(23000, 31500) });
        assert(!/const outputControllerApi\s*=/.test(rozrysSrc) && !/const runControllerApi\s*=/.test(rozrysSrc), 'rozrys.js nadal ręcznie trzyma lokalne bridge API output/run zamiast runtime bundle', { snippet: rozrysSrc.slice(9000, 18000) });
        assert(/function\s+tryAutoRenderFromCache\s*\(/.test(rozrysSrc) && /function\s+splitMaterialAccordionTitle\s*\(/.test(rozrysSrc) && /function\s+buildEntriesForScope\s*\(/.test(rozrysSrc), 'rozrys.js po splicie runtime bundle nie zachowuje hoistowanych fasad helperów cache/output wymaganych podczas bootstrapu', { snippet: rozrysSrc.slice(15000, 30000) });
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

      makeTest('Bootstrap i splity', 'ROZRYS source zachowuje bootstrap launcherów po init i po splitach', 'Pilnuje regresji, w której po splicie puste launchery Pomieszczenia / Materiał-grupa zostawały bez labeli i bez klikalności, bo init tracił obowiązkowe kroki bootstrapu.', ()=>{
        const src = readAssetSource('js/app/rozrys/rozrys.js');
        assert(src && src.includes('updateRoomsPickerButton();'), 'Brak bootstrapu updateRoomsPickerButton po init ROZRYS');
        assert(src && src.includes('updateMaterialPickerButton();'), 'Brak bootstrapu updateMaterialPickerButton po init ROZRYS');
        assert(src && src.includes('syncHiddenSelections();'), 'Brak syncHiddenSelections po init ROZRYS');
        assert(/roomsPickerBtn\.addEventListener\('click',\s*openRoomsPicker\)/.test(src), 'Launcher Pomieszczenia stracił klik do openRoomsPicker po splicie', { src });
        assert(/matPickerBtn\.addEventListener\('click',\s*openMaterialPicker\)/.test(src), 'Launcher Materiał / grupa stracił klik do openMaterialPicker po splicie', { src });
      }),

      makeTest('Bootstrap i splity', 'Nowe bridge moduły ROZRYS muszą być załadowane przed rozrys.js i mieć bezpieczny kontrakt fallbacku', 'Pilnuje regresji po splitach bridge: jeśli rozrys.js wywołuje createController/createApi nowego modułu, to index i dev_tests muszą ładować plik przed rozrys.js, a fallback w rozrys.js nie może kończyć się TypeError-em przy braku modułu.', ()=>{
        const indexHtml = readAssetSource('index.html');
        const devHtml = readAssetSource('dev_tests.html');
        const rozrysSrc = readAssetSource('js/app/rozrys/rozrys.js');
        const outputBridgeIdx = indexHtml.indexOf('js/app/rozrys/rozrys-output-bridge.js');
        const rozrysIdx = indexHtml.indexOf('js/app/rozrys/rozrys.js');
        if(outputBridgeIdx >= 0 && rozrysIdx >= 0){
          assert(outputBridgeIdx < rozrysIdx, 'index.html ładuje rozrys-output-bridge po rozrys.js', { outputBridgeIdx, rozrysIdx });
        }
        const outputBridgeDevIdx = devHtml.indexOf('js/app/rozrys/rozrys-output-bridge.js');
        const rozrysDevIdx = devHtml.indexOf('js/app/rozrys/rozrys.js');
        if(outputBridgeDevIdx >= 0 && rozrysDevIdx >= 0){
          assert(outputBridgeDevIdx < rozrysDevIdx, 'dev_tests.html ładuje rozrys-output-bridge po rozrys.js', { outputBridgeDevIdx, rozrysDevIdx });
        }
        if(/outputCtrl\s*=\s*outputBridge\.createController\(/.test(rozrysSrc)){
          assert(/const outputBridge[\s\S]*createController\s*:\s*\(/.test(rozrysSrc), 'Fallback outputBridge w rozrys.js nie zapewnia createController mimo że kod go woła', { snippet: rozrysSrc.slice(0, 2200) });
        }
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
