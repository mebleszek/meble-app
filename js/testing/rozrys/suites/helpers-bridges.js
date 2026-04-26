(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  FC.rozrysDevTestSuites = FC.rozrysDevTestSuites || {};

  FC.rozrysDevTestSuites.helpersBridges = function helpersBridges(ctx){
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
      makeTest('Bootstrap i splity', 'ROZRYS ładuje part helpers przed rozrys.js, a kontrakt helperów części pilnują testy modułu', 'Pilnuje load-order nowego modułu helperów części bez zamrażania konkretnego snippetowego kształtu rozrys.js. Zachowanie API resolve/rotation sprawdza osobny test kontraktu part helpers.', ()=>{
        const indexHtml = readAssetSource('index.html');
        const devHtml = readAssetSource('dev_tests.html');
        const partHelpersSrc = readAssetSource('js/app/rozrys/rozrys-part-helpers.js');
        assert(partHelpersSrc && partHelpersSrc.includes('FC.rozrysPartHelpers'), 'Brak źródła nowego modułu part helpers w assetach smoke');
        assert(FC.rozrysPartHelpers && typeof FC.rozrysPartHelpers.createApi === 'function', 'Brak FC.rozrysPartHelpers.createApi po załadowaniu assetów');
        const api = FC.rozrysPartHelpers.createApi({ FC, host:host, cmToMm:(v)=> Number(v)||0, partSignature:(part)=> `${part && part.material || ''}||${part && part.name || ''}||${part && part.w || 0}x${part && part.h || 0}` });
        assert(api && typeof api.resolveCabinetCutListFn === 'function' && typeof api.isPartRotationAllowed === 'function', 'Part helpers po załadowaniu assetów nie mają oczekiwanego kontraktu API', { keys:Object.keys(api || {}) });
        const startupOrder = getRozrysStartupOrderSource(['js/app/rozrys/rozrys-part-helpers.js', 'js/app/rozrys/rozrys.js']);
        const partIdx = startupOrder.text.indexOf('js/app/rozrys/rozrys-part-helpers.js');
        const rozrysIdx = startupOrder.text.indexOf('js/app/rozrys/rozrys.js');
        assert(startupOrder.name !== 'missing' && partIdx >= 0 && rozrysIdx >= 0 && partIdx < rozrysIdx, `Startup entrypoint ładuje rozrys-part-helpers po rozrys.js (${startupOrder.name})`, { entrypoint:startupOrder.name, partIdx, rozrysIdx });
        const partDevIdx = devHtml.indexOf('js/app/rozrys/rozrys-part-helpers.js');
        const rozrysDevIdx = devHtml.indexOf('js/app/rozrys/rozrys.js');
        assert(partDevIdx >= 0 && rozrysDevIdx >= 0 && partDevIdx < rozrysDevIdx, 'dev_tests.html ładuje rozrys-part-helpers po rozrys.js', { partDevIdx, rozrysDevIdx });
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
    ];
  };
})(typeof window !== 'undefined' ? window : globalThis);
