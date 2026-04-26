(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  FC.rozrysDevTestSuites = FC.rozrysDevTestSuites || {};

  FC.rozrysDevTestSuites.scopeRuntimeControllers = function scopeRuntimeControllers(ctx){
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


      makeTest('Controller bridges', 'Wydzielony bridge selection ROZRYS składa scope summary i pickerowe wrappery bez ruszania bootstrapu', 'Pilnuje kolejnego bezpiecznego splitu rozrys.js: moduł bridge ma zbudować renderScopeApi oraz controller selectionUi, a rozrys.js ma tylko delegować wrappery i inicjalizację klików.', ()=>{
        assert(FC.rozrysControllerBridges && typeof FC.rozrysControllerBridges.createApi === 'function', 'Brak FC.rozrysControllerBridges.createApi');
        const prevScope = FC.rozrysScope;
        const prevSelectionUi = FC.rozrysSelectionUi;
        const captured = { calls:[] };
        try{
          FC.rozrysScope = {
            createApi(args){
              captured.scope = args;
              return {
                getScopeSummary: ()=> ({ title:'Zakres test', subtitle:'scope-sub' }),
                getRoomsSummary: ()=> ({ title:'Pokoje test', subtitle:'rooms-sub' }),
              };
            }
          };
          FC.rozrysSelectionUi = {
            createController(ctx, deps){
              captured.selection = { ctx, deps };
              return {
                updateRoomsPickerButton(){ captured.calls.push('rooms'); },
                updateMaterialPickerButton(){ captured.calls.push('material'); },
                syncHiddenSelections(){ captured.calls.push('sync'); },
                persistSelectionPrefs(){ captured.calls.push('persist'); },
                refreshSelectionState(opts){ captured.refresh = opts; return 'refresh-ok'; },
                buildScopeDraftControls(holder, draftScope, hasFronts, hasCorpus, opts){ captured.build = { holder, draftScope, hasFronts, hasCorpus, opts }; return 'draft-ok'; },
                openRoomsPicker(){ captured.calls.push('open-rooms'); return 'rooms-open'; },
                openMaterialPicker(){ captured.calls.push('open-material'); return 'material-open'; },
              };
            }
          };
          const mkBtn = ()=> ({ listeners:{}, addEventListener(type, fn){ (this.listeners[type] = this.listeners[type] || []).push(fn); } });
          const roomsPickerBtn = mkBtn();
          const matPickerBtn = mkBtn();
          const api = FC.rozrysControllerBridges.createApi({ FC });
          const bridge = api.createSelectionBridge({
            ctx: {
              roomsPickerBtn,
              matPickerBtn,
              getSelectedRooms: ()=> ['room_a'],
              getMaterialScope: ()=> ({ kind:'all' }),
              getAggregate: ()=> ({ materials:['MDF'] }),
              setSelectedRooms: ()=> undefined,
              setMaterialScope: ()=> undefined,
              setAggregate: ()=> undefined,
            },
            deps: {
              scopeApiFallback: {},
              getRooms: ()=> ['room_a'],
              aggregatePartsForProject: ()=> ({ materials:['MDF'] }),
              splitMaterialAccordionTitle: (material)=> ({ line1:`MAT:${material}`, line2:'' }),
            },
          });
          bridge.init();
          assert(captured.scope && typeof captured.scope.getRooms === 'function' && typeof captured.scope.getAggregatePartsForProject === 'function', 'Selection bridge nie buduje renderScopeApi z live getRooms/getAggregatePartsForProject', captured);
          assert(captured.selection && captured.selection.deps && typeof captured.selection.deps.getScopeSummary === 'function' && typeof captured.selection.deps.getRoomsSummary === 'function', 'Selection bridge nie przekazał getScopeSummary/getRoomsSummary do selectionUi', captured);
          assert(Array.isArray(roomsPickerBtn.listeners.click) && roomsPickerBtn.listeners.click.length === 1, 'Selection bridge nie podpiął click do launchera Pomieszczenia', roomsPickerBtn.listeners);
          assert(Array.isArray(matPickerBtn.listeners.click) && matPickerBtn.listeners.click.length === 1, 'Selection bridge nie podpiął click do launchera Materiał / grupa', matPickerBtn.listeners);
          assert(captured.calls.slice(0, 3).join(',') === 'rooms,material,sync', 'Selection bridge init nie wykonał bezpiecznej sekwencji init rooms/material/sync', captured.calls);
          roomsPickerBtn.listeners.click[0]();
          matPickerBtn.listeners.click[0]();
          assert(captured.calls.includes('open-rooms') && captured.calls.includes('open-material'), 'Selection bridge nie deleguje clicków do pickerów selectionUi', captured.calls);
          assert(bridge.buildScopeDraftControls('holder', { includeFronts:true }, true, false, { allowEmpty:true }) === 'draft-ok', 'Selection bridge nie deleguje buildScopeDraftControls', captured.build);
          assert(bridge.refreshSelectionState({ rerender:false }) === 'refresh-ok' && captured.refresh && captured.refresh.rerender === false, 'Selection bridge nie deleguje refreshSelectionState 1:1', captured.refresh);
        } finally {
          FC.rozrysScope = prevScope;
          FC.rozrysSelectionUi = prevSelectionUi;
        }
      }),

      makeTest('Controller bridges', 'Wydzielony bridge output ROZRYS deleguje do późno związanego outputCtrl i zachowuje fallback idle', 'Pilnuje splitu hoistowanych wrapperów output/cache: rozrys.js ma dalej mieć lokalne funkcje, ale ich wnętrze może już delegować do wspólnego bridge z późnym getController.', ()=>{
        assert(FC.rozrysControllerBridges && typeof FC.rozrysControllerBridges.createApi === 'function', 'Brak FC.rozrysControllerBridges.createApi');
        const captured = { calls:[], idle:null };
        let outputCtrl = {
          buildEntriesForScope(selection, aggregate){ captured.calls.push(['entries', selection, aggregate]); return ['entry-ok']; },
          splitMaterialAccordionTitle(material){ captured.calls.push(['title', material]); return { line1:`L1:${material}`, line2:'L2' }; },
          createMaterialAccordionSection(material, options){ captured.calls.push(['section', material, options]); return { wrap:{}, body:{}, trigger:{}, setOpenState:()=>{} }; },
          renderOutput(plan, meta, target){ captured.calls.push(['render', plan, meta, target]); return 'render-ok'; },
          renderLoadingInto(target, text, subText){ captured.calls.push(['loading', target, text, subText]); return 'loading-ok'; },
          renderLoading(text){ captured.calls.push(['loading-inline', text]); return 'loading-inline-ok'; },
          renderMaterialAccordionPlans(scopeKey, scopeMode, entries){ captured.calls.push(['accordion', scopeKey, scopeMode, entries]); return 'accordion-ok'; },
          tryAutoRenderFromCache(){ captured.calls.push(['auto']); return true; },
        };
        const out = { innerHTML:'busy' };
        const api = FC.rozrysControllerBridges.createApi({ FC });
        const bridge = api.createOutputBridge({
          ctx: {
            out,
            getController: ()=> outputCtrl,
            getSetGenBtnMode: ()=> (mode)=> { captured.idle = mode; },
          },
        });
        assert(Array.isArray(bridge.buildEntriesForScope('sel', 'agg')) && bridge.buildEntriesForScope('sel', 'agg')[0] === 'entry-ok', 'Output bridge nie deleguje buildEntriesForScope', captured.calls);
        assert(bridge.splitMaterialAccordionTitle('MDF').line1 === 'L1:MDF', 'Output bridge nie deleguje splitMaterialAccordionTitle', captured.calls);
        assert(bridge.renderOutput('plan', 'meta', 'target') === 'render-ok', 'Output bridge nie deleguje renderOutput', captured.calls);
        assert(bridge.renderLoadingInto('target', 'txt', 'sub') === 'loading-ok', 'Output bridge nie deleguje renderLoadingInto', captured.calls);
        assert(bridge.renderMaterialAccordionPlans('scope', 'mode', ['e']) === 'accordion-ok', 'Output bridge nie deleguje renderMaterialAccordionPlans', captured.calls);
        assert(bridge.tryAutoRenderFromCache() === true, 'Output bridge nie deleguje tryAutoRenderFromCache', captured.calls);
        outputCtrl = null;
        out.innerHTML = 'busy';
        const fallback = bridge.tryAutoRenderFromCache();
        assert(fallback === false && out.innerHTML === '' && captured.idle === 'idle', 'Output bridge fallback nie czyści out albo nie ustawia idle bez outputCtrl', { fallback, out, idle:captured.idle });
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
    ];
  };
})(typeof window !== 'undefined' ? window : globalThis);
