(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  FC.rozrysDevTestSuites = FC.rozrysDevTestSuites || {};

  FC.rozrysDevTestSuites.outputBootstrap = function outputBootstrap(ctx){
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
      makeTest('Bootstrap i splity', 'ROZRYS ładuje run controller i runtime bundle przed rozrys.js oraz zachowuje kontrakt assemblera runtime', 'Pilnuje load-order action/run i assemblera runtime bez zamrażania konkretnego snippetowego montażu w rozrys.js. To, czy runtime bundle naprawdę tworzy run/output controller przez wspólne API, sprawdzają osobne testy modułów.', ()=>{
        const indexHtml = readAssetSource('index.html');
        const devHtml = readAssetSource('dev_tests.html');
        const runCtrlSrc = readAssetSource('js/app/rozrys/rozrys-run-controller.js');
        const runtimeBundleSrc = readAssetSource('js/app/rozrys/rozrys-runtime-bundle.js');
        const bridgeSrc = readAssetSource('js/app/rozrys/rozrys-controller-bridges.js');
        assert(runCtrlSrc && runCtrlSrc.includes('FC.rozrysRunController'), 'Brak źródła nowego modułu run controller w assetach smoke');
        assert(runtimeBundleSrc && runtimeBundleSrc.includes('FC.rozrysRuntimeBundle'), 'Brak źródła modułu runtime bundle w assetach smoke');
        assert(bridgeSrc && bridgeSrc.includes('FC.rozrysControllerBridges'), 'Brak źródła modułu controller bridges w assetach smoke');
        assert(FC.rozrysRuntimeBundle && typeof FC.rozrysRuntimeBundle.createApi === 'function', 'Brak FC.rozrysRuntimeBundle.createApi po załadowaniu assetów');
        assert(FC.rozrysControllerBridges && typeof FC.rozrysControllerBridges.createApi === 'function', 'Brak FC.rozrysControllerBridges.createApi po załadowaniu assetów');
        const bundleApi = FC.rozrysRuntimeBundle.createApi({ FC });
        const bridgeApi = FC.rozrysControllerBridges.createApi({ FC });
        assert(bundleApi && typeof bundleApi.createRunController === 'function' && typeof bundleApi.createOutputController === 'function', 'Runtime bundle po załadowaniu assetów nie ma oczekiwanego kontraktu assemblera', { keys:Object.keys(bundleApi || {}) });
        assert(bridgeApi && typeof bridgeApi.createSelectionBridge === 'function' && typeof bridgeApi.createOutputBridge === 'function', 'Controller bridges po załadowaniu assetów nie mają oczekiwanego kontraktu bridge API', { keys:Object.keys(bridgeApi || {}) });
        const startupOrder = getRozrysStartupOrderSource([
          'js/app/rozrys/rozrys-run-controller.js',
          'js/app/rozrys/rozrys-runtime-bundle.js',
          'js/app/rozrys/rozrys-controller-bridges.js',
          'js/app/rozrys/rozrys.js'
        ]);
        const runIdx = startupOrder.text.indexOf('js/app/rozrys/rozrys-run-controller.js');
        const runtimeIdx = startupOrder.text.indexOf('js/app/rozrys/rozrys-runtime-bundle.js');
        const bridgeIdx = startupOrder.text.indexOf('js/app/rozrys/rozrys-controller-bridges.js');
        const rozrysIdx = startupOrder.text.indexOf('js/app/rozrys/rozrys.js');
        assert(startupOrder.name !== 'missing' && runIdx >= 0 && rozrysIdx >= 0 && runIdx < rozrysIdx, `Startup entrypoint ładuje rozrys-run-controller po rozrys.js (${startupOrder.name})`, { entrypoint:startupOrder.name, runIdx, rozrysIdx });
        assert(startupOrder.name !== 'missing' && runtimeIdx >= 0 && rozrysIdx >= 0 && runtimeIdx < rozrysIdx, `Startup entrypoint ładuje rozrys-runtime-bundle po rozrys.js (${startupOrder.name})`, { entrypoint:startupOrder.name, runtimeIdx, rozrysIdx });
        assert(startupOrder.name !== 'missing' && bridgeIdx >= 0 && rozrysIdx >= 0 && bridgeIdx < rozrysIdx, `Startup entrypoint ładuje rozrys-controller-bridges po rozrys.js (${startupOrder.name})`, { entrypoint:startupOrder.name, bridgeIdx, rozrysIdx });
        const runDevIdx = devHtml.indexOf('js/app/rozrys/rozrys-run-controller.js');
        const runtimeDevIdx = devHtml.indexOf('js/app/rozrys/rozrys-runtime-bundle.js');
        const bridgeDevIdx = devHtml.indexOf('js/app/rozrys/rozrys-controller-bridges.js');
        const rozrysDevIdx = devHtml.indexOf('js/app/rozrys/rozrys.js');
        assert(runDevIdx >= 0 && rozrysDevIdx >= 0 && runDevIdx < rozrysDevIdx, 'dev_tests.html ładuje rozrys-run-controller po rozrys.js', { runDevIdx, rozrysDevIdx });
        assert(runtimeDevIdx >= 0 && rozrysDevIdx >= 0 && runtimeDevIdx < rozrysDevIdx, 'dev_tests.html ładuje rozrys-runtime-bundle po rozrys.js', { runtimeDevIdx, rozrysDevIdx });
        assert(bridgeDevIdx >= 0 && rozrysDevIdx >= 0 && bridgeDevIdx < rozrysDevIdx, 'dev_tests.html ładuje rozrys-controller-bridges po rozrys.js', { bridgeDevIdx, rozrysDevIdx });
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
      makeTest('Bootstrap i splity', 'ROZRYS ładuje scope, panel workspace, runtime bundle i output controller przed rozrys.js oraz trzyma kontrakty modułów shell/runtime', 'Pilnuje load-order oraz kontraktów modułów po splitach bez przywiązywania testu do konkretnego snippetowego kształtu rozrys.js. Zachowanie workspace, bridge, compose, runtime bundle i output controller jest pilnowane osobnymi testami modułów.', ()=>{
        const indexHtml = readAssetSource('index.html');
        const devHtml = readAssetSource('dev_tests.html');
        const scopeSrc = readAssetSource('js/app/rozrys/rozrys-scope.js');
        const panelSrc = readAssetSource('js/app/rozrys/rozrys-panel-workspace.js');
        const runtimeBundleSrc = readAssetSource('js/app/rozrys/rozrys-runtime-bundle.js');
        const bridgeSrc = readAssetSource('js/app/rozrys/rozrys-controller-bridges.js');
        const renderComposeSrc = readAssetSource('js/app/rozrys/rozrys-render-compose.js');
        const outputSrc = readAssetSource('js/app/rozrys/rozrys-output-controller.js');
        assert(scopeSrc && scopeSrc.includes('FC.rozrysScope') && scopeSrc.includes('createApi'), 'Brak źródła modułu rozrys-scope z createApi w assetach smoke');
        assert(panelSrc && panelSrc.includes('FC.rozrysPanelWorkspace'), 'Brak źródła nowego modułu panel workspace w assetach smoke');
        assert(runtimeBundleSrc && runtimeBundleSrc.includes('FC.rozrysRuntimeBundle') && runtimeBundleSrc.includes('createApi'), 'Brak źródła modułu rozrys-runtime-bundle w assetach smoke');
        assert(bridgeSrc && bridgeSrc.includes('FC.rozrysControllerBridges') && bridgeSrc.includes('createSelectionBridge'), 'Brak źródła modułu rozrys-controller-bridges w assetach smoke');
        assert(renderComposeSrc && renderComposeSrc.includes('FC.rozrysRenderCompose') && renderComposeSrc.includes('buildRunControllerConfig'), 'Brak źródła modułu rozrys-render-compose w assetach smoke');
        assert(outputSrc && outputSrc.includes('FC.rozrysOutputController'), 'Brak źródła nowego modułu output controller w assetach smoke');
        assert(FC.rozrysScope && typeof FC.rozrysScope.createApi === 'function', 'Brak FC.rozrysScope.createApi po załadowaniu assetów');
        assert(FC.rozrysPanelWorkspace && typeof FC.rozrysPanelWorkspace.createApi === 'function', 'Brak FC.rozrysPanelWorkspace.createApi po załadowaniu assetów');
        assert(FC.rozrysRuntimeBundle && typeof FC.rozrysRuntimeBundle.createApi === 'function', 'Brak FC.rozrysRuntimeBundle.createApi po załadowaniu assetów');
        assert(FC.rozrysControllerBridges && typeof FC.rozrysControllerBridges.createApi === 'function', 'Brak FC.rozrysControllerBridges.createApi po załadowaniu assetów');
        assert(FC.rozrysRenderCompose && typeof FC.rozrysRenderCompose.createApi === 'function', 'Brak FC.rozrysRenderCompose.createApi po załadowaniu assetów');
        assert(FC.rozrysOutputController && typeof FC.rozrysOutputController.createApi === 'function', 'Brak FC.rozrysOutputController.createApi po załadowaniu assetów');
        const composeApi = FC.rozrysRenderCompose.createApi({ FC });
        assert(composeApi && typeof composeApi.buildWorkspaceCtx === 'function' && typeof composeApi.buildSelectionBridgeConfig === 'function' && typeof composeApi.buildRunControllerConfig === 'function', 'Render compose po załadowaniu assetów nie ma oczekiwanego kontraktu builderów', { keys:Object.keys(composeApi || {}) });
        const startupOrder = getRozrysStartupOrderSource([
          'js/app/rozrys/rozrys-scope.js',
          'js/app/rozrys/rozrys-panel-workspace.js',
          'js/app/rozrys/rozrys-runtime-bundle.js',
          'js/app/rozrys/rozrys-controller-bridges.js',
          'js/app/rozrys/rozrys-render-compose.js',
          'js/app/rozrys/rozrys-output-controller.js',
          'js/app/rozrys/rozrys.js'
        ]);
        const scopeIdx = startupOrder.text.indexOf('js/app/rozrys/rozrys-scope.js');
        const panelIdx = startupOrder.text.indexOf('js/app/rozrys/rozrys-panel-workspace.js');
        const runtimeIdx = startupOrder.text.indexOf('js/app/rozrys/rozrys-runtime-bundle.js');
        const bridgeIdx = startupOrder.text.indexOf('js/app/rozrys/rozrys-controller-bridges.js');
        const composeIdx = startupOrder.text.indexOf('js/app/rozrys/rozrys-render-compose.js');
        const outIdx = startupOrder.text.indexOf('js/app/rozrys/rozrys-output-controller.js');
        const rozIdx = startupOrder.text.indexOf('js/app/rozrys/rozrys.js');
        assert(startupOrder.name !== 'missing' && scopeIdx >= 0 && rozIdx >= 0 && scopeIdx < rozIdx, `Startup entrypoint ładuje rozrys-scope po rozrys.js (${startupOrder.name})`, { entrypoint:startupOrder.name, scopeIdx, rozIdx });
        assert(startupOrder.name !== 'missing' && panelIdx >= 0 && rozIdx >= 0 && panelIdx < rozIdx, `Startup entrypoint ładuje rozrys-panel-workspace po rozrys.js (${startupOrder.name})`, { entrypoint:startupOrder.name, panelIdx, rozIdx });
        assert(startupOrder.name !== 'missing' && runtimeIdx >= 0 && rozIdx >= 0 && runtimeIdx < rozIdx, `Startup entrypoint ładuje rozrys-runtime-bundle po rozrys.js (${startupOrder.name})`, { entrypoint:startupOrder.name, runtimeIdx, rozIdx });
        assert(startupOrder.name !== 'missing' && bridgeIdx >= 0 && rozIdx >= 0 && bridgeIdx < rozIdx, `Startup entrypoint ładuje rozrys-controller-bridges po rozrys.js (${startupOrder.name})`, { entrypoint:startupOrder.name, bridgeIdx, rozIdx });
        assert(startupOrder.name !== 'missing' && composeIdx >= 0 && rozIdx >= 0 && composeIdx < rozIdx, `Startup entrypoint ładuje rozrys-render-compose po rozrys.js (${startupOrder.name})`, { entrypoint:startupOrder.name, composeIdx, rozIdx });
        assert(startupOrder.name !== 'missing' && outIdx >= 0 && rozIdx >= 0 && outIdx < rozIdx, `Startup entrypoint ładuje rozrys-output-controller po rozrys.js (${startupOrder.name})`, { entrypoint:startupOrder.name, outIdx, rozIdx });
        const scopeDevIdx = devHtml.indexOf('js/app/rozrys/rozrys-scope.js');
        const panelDevIdx = devHtml.indexOf('js/app/rozrys/rozrys-panel-workspace.js');
        const runtimeDevIdx = devHtml.indexOf('js/app/rozrys/rozrys-runtime-bundle.js');
        const bridgeDevIdx = devHtml.indexOf('js/app/rozrys/rozrys-controller-bridges.js');
        const composeDevIdx = devHtml.indexOf('js/app/rozrys/rozrys-render-compose.js');
        const outDevIdx = devHtml.indexOf('js/app/rozrys/rozrys-output-controller.js');
        const rozDevIdx = devHtml.indexOf('js/app/rozrys/rozrys.js');
        assert(scopeDevIdx >= 0 && rozDevIdx >= 0 && scopeDevIdx < rozDevIdx, 'dev_tests.html ładuje rozrys-scope po rozrys.js', { scopeDevIdx, rozDevIdx });
        assert(panelDevIdx >= 0 && rozDevIdx >= 0 && panelDevIdx < rozDevIdx, 'dev_tests.html ładuje rozrys-panel-workspace po rozrys.js', { panelDevIdx, rozDevIdx });
        assert(runtimeDevIdx >= 0 && rozDevIdx >= 0 && runtimeDevIdx < rozDevIdx, 'dev_tests.html ładuje rozrys-runtime-bundle po rozrys.js', { runtimeDevIdx, rozDevIdx });
        assert(bridgeDevIdx >= 0 && rozDevIdx >= 0 && bridgeDevIdx < rozDevIdx, 'dev_tests.html ładuje rozrys-controller-bridges po rozrys.js', { bridgeDevIdx, rozDevIdx });
        assert(composeDevIdx >= 0 && rozDevIdx >= 0 && composeDevIdx < rozDevIdx, 'dev_tests.html ładuje rozrys-render-compose po rozrys.js', { composeDevIdx, rozDevIdx });
        assert(outDevIdx >= 0 && rozDevIdx >= 0 && outDevIdx < rozDevIdx, 'dev_tests.html ładuje rozrys-output-controller po rozrys.js', { outDevIdx, rozDevIdx });
      }),
    ];
  };
})(typeof window !== 'undefined' ? window : globalThis);
