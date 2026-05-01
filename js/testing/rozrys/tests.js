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

  function getRozrysStartupOrderSource(requiredAssets){
    const assets = Array.isArray(requiredAssets) ? requiredAssets.filter(Boolean) : [];
    const indexHtml = readAssetSource('index.html');
    const lazyManifestSrc = readAssetSource('js/app/rozrys/rozrys-lazy-manifest.js');
    if(assets.every((asset)=> indexHtml.indexOf(asset) >= 0)){
      return { name:'index.html', text:indexHtml };
    }
    if(assets.every((asset)=> lazyManifestSrc.indexOf(asset) >= 0)){
      return { name:'js/app/rozrys/rozrys-lazy-manifest.js', text:lazyManifestSrc };
    }
    const distributed = assets.length && assets.every((asset)=> indexHtml.indexOf(asset) >= 0 || lazyManifestSrc.indexOf(asset) >= 0);
    if(distributed){
      return {
        name:'index.html + js/app/rozrys/rozrys-lazy-manifest.js',
        text:indexHtml + '\n/* deferred-rozrys-startup */\n' + lazyManifestSrc,
        indexHtml,
        lazyManifestSrc,
      };
    }
    return { name:'missing', text:'', indexHtml, lazyManifestSrc };
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

  function collectSuiteTests(name, ctx){
    const suites = FC.rozrysDevTestSuites || {};
    const factory = suites[name];
    assert(typeof factory === 'function', 'Brak pakietu testów ROZRYS: ' + name);
    const out = factory(ctx);
    assert(Array.isArray(out), 'Pakiet testów ROZRYS nie zwrócił tablicy: ' + name, out);
    return out;
  }

  async function runAll(){
    const Fx = FC.rozrysDevFixtures;
    assert(Fx, 'Brak FC.rozrysDevFixtures');
    assert(FC.rozrysState, 'Brak FC.rozrysState');
    assert(FC.rozrysSheetModel, 'Brak FC.rozrysSheetModel');
    assert(FC.rozrysValidation, 'Brak FC.rozrysValidation');
    assert(FC.rozrysCache, 'Brak FC.rozrysCache');
    assert(FC.rozrysEngine, 'Brak FC.rozrysEngine');
    assert(FC.cutOptimizer, 'Brak FC.cutOptimizer');
    assert(FC.rozrysPrintLayout, 'Brak FC.rozrysPrintLayout');

    const ctx = {
      host,
      FC,
      Fx,
      assert,
      makeTest,
      fallbackPartSignature,
      defaultRotationAllowed,
      withIsolatedLocalStorage,
      readAssetSource,
      getRozrysStartupOrderSource,
      createFakeNode,
      installFakeDom,
      collectNodes,
      withPatchedProjectFixture,
      withPatchedRoomRegistry,
      withPatchedUiState,
      buildPrintDeps,
    };

    const tests = []
      .concat(collectSuiteTests('stateUiRuntime', ctx))
      .concat(collectSuiteTests('helpersBridges', ctx))
      .concat(collectSuiteTests('scopeRuntimeControllers', ctx))
      .concat(collectSuiteTests('outputBootstrap', ctx))
      .concat(collectSuiteTests('projectStock', ctx))
      .concat(collectSuiteTests('optimizerContracts', ctx))
      .concat(collectSuiteTests('validationCacheRender', ctx));
    const startedAt = Date.now();
    const emitProgress = FC.testHarness && typeof FC.testHarness.emitProgress === 'function' ? FC.testHarness.emitProgress : null;
    const yieldToBrowser = FC.testHarness && typeof FC.testHarness.yieldToBrowser === 'function' ? FC.testHarness.yieldToBrowser : function(){ return Promise.resolve(); };
    if(emitProgress) emitProgress({ type:'suite-start', label:'ROZRYS smoke testy', total:tests.length });
    await yieldToBrowser();
    const results = [];
    for(let index = 0; index < tests.length; index += 1){
      const test = tests[index];
      if(emitProgress) emitProgress({ type:'test-start', label:'ROZRYS smoke testy', index:index + 1, total:tests.length, test });
      await yieldToBrowser();
      try{
        test.fn();
        const row = { group:test.group, name:test.name, explain:test.explain, ok:true };
        results.push(row);
        if(emitProgress) emitProgress({ type:'test-done', label:'ROZRYS smoke testy', index:index + 1, total:tests.length, row });
        await yieldToBrowser();
      }catch(error){
        const row = {
          group:test.group,
          name:test.name,
          explain:test.explain,
          ok:false,
          message:error && error.message ? error.message : String(error),
          details:error && error.details ? error.details : null,
        };
        results.push(row);
        if(emitProgress) emitProgress({ type:'test-done', label:'ROZRYS smoke testy', index:index + 1, total:tests.length, row });
        await yieldToBrowser();
      }
    }
    if(emitProgress) emitProgress({ type:'suite-done', label:'ROZRYS smoke testy', total:tests.length });
    await yieldToBrowser();
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
