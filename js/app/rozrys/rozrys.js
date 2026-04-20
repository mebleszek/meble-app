/* rozrys.js — ROZRYS (MVP) podobny do e-rozrys: wejście z zakładki ROZRYS
   Wymagania:
   - Źródło formatek: zakładka "Materiały" (getCabinetCutList)
   - osobne rozkroje per materiał
   - magazyn płyt (opcjonalnie) do podpowiadania formatów
   - kerf 4mm
   - obsługa słoi: globalnie + per-element override "pozwól obrót"
   - wybór heurystyki + kierunku cięcia
   - eksport: CSV + "PDF" przez okno drukowania
*/

(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const projectSource = (FC.rozrysProjectSource && typeof FC.rozrysProjectSource.createApi === 'function')
    ? FC.rozrysProjectSource.createApi({ FC, host:window })
    : {};
  const discoverProjectRoomKeys = projectSource.discoverProjectRoomKeys || function(){ return []; };
  const discoverVisibleProjectRoomKeys = projectSource.discoverVisibleProjectRoomKeys || function(){ return []; };
  const collectProjectCandidates = projectSource.collectProjectCandidates || function(){ return []; };
  const safeGetProject = projectSource.safeGetProject || function(){ return null; };
  const getRoomsForProject = projectSource.getRoomsForProject || function(){ return []; };
  const getRooms = projectSource.getRooms || function(){ return []; };

  const rozrysPrefsApi = FC.rozrysPrefs || {};
  const parseLocaleNumber = typeof rozrysPrefsApi.parseLocaleNumber === 'function'
    ? rozrysPrefsApi.parseLocaleNumber.bind(rozrysPrefsApi)
    : ((v)=>{ if(v === null || v === undefined) return NaN; if(typeof v === 'number') return Number.isFinite(v) ? v : NaN; const s = String(v).trim().replace(',', '.'); return s ? Number(s) : NaN; });
  const cmToMm = typeof rozrysPrefsApi.cmToMm === 'function'
    ? rozrysPrefsApi.cmToMm.bind(rozrysPrefsApi)
    : ((v)=>{ const n = parseLocaleNumber(v); return Number.isFinite(n) ? Math.round(n * 10) : 0; });
  const mmToStr = typeof rozrysPrefsApi.mmToStr === 'function'
    ? rozrysPrefsApi.mmToStr.bind(rozrysPrefsApi)
    : ((mm)=> String(Math.round(Number(mm) || 0)));
  const mmToUnitStr = typeof rozrysPrefsApi.mmToUnitStr === 'function'
    ? rozrysPrefsApi.mmToUnitStr.bind(rozrysPrefsApi)
    : ((mm, unit)=>{ const u = unit === 'cm' ? 'cm' : 'mm'; const n = Math.round(Number(mm) || 0); if(u === 'mm') return String(n); const cm = n / 10; const s = (Math.round(cm * 10) / 10).toFixed(1); return s.endsWith('.0') ? s.slice(0, -2) : s; });
  const loadPanelPrefs = typeof rozrysPrefsApi.loadPanelPrefs === 'function' ? rozrysPrefsApi.loadPanelPrefs.bind(rozrysPrefsApi) : (()=> ({}));
  const savePanelPrefs = typeof rozrysPrefsApi.savePanelPrefs === 'function' ? rozrysPrefsApi.savePanelPrefs.bind(rozrysPrefsApi) : (()=>{});
  const getAccordionPref = typeof rozrysPrefsApi.getAccordionPref === 'function' ? rozrysPrefsApi.getAccordionPref.bind(rozrysPrefsApi) : (()=> ({ material:'', open:false }));
  const setAccordionPref = typeof rozrysPrefsApi.setAccordionPref === 'function' ? rozrysPrefsApi.setAccordionPref.bind(rozrysPrefsApi) : (()=>{});
  const getMaterialGrainEnabled = typeof rozrysPrefsApi.getMaterialGrainEnabled === 'function' ? rozrysPrefsApi.getMaterialGrainEnabled.bind(rozrysPrefsApi) : ((material, hasGrain)=> !!hasGrain);
  const setMaterialGrainEnabled = typeof rozrysPrefsApi.setMaterialGrainEnabled === 'function' ? rozrysPrefsApi.setMaterialGrainEnabled.bind(rozrysPrefsApi) : (()=>{});
  const getMaterialGrainExceptions = typeof rozrysPrefsApi.getMaterialGrainExceptions === 'function' ? rozrysPrefsApi.getMaterialGrainExceptions.bind(rozrysPrefsApi) : (()=> ({}));
  const setMaterialGrainExceptions = typeof rozrysPrefsApi.setMaterialGrainExceptions === 'function' ? rozrysPrefsApi.setMaterialGrainExceptions.bind(rozrysPrefsApi) : (()=>{});
  const loadEdgeStore = typeof rozrysPrefsApi.loadEdgeStore === 'function' ? rozrysPrefsApi.loadEdgeStore.bind(rozrysPrefsApi) : (()=> ({}));
  const partSignature = typeof rozrysPrefsApi.partSignature === 'function'
    ? rozrysPrefsApi.partSignature.bind(rozrysPrefsApi)
    : ((p)=> `${p && p.material || ''}||${p && p.name || ''}||${p && p.w || 0}x${p && p.h || 0}`);

  const uiTools = (FC.rozrysUiTools && typeof FC.rozrysUiTools.createApi === 'function')
    ? FC.rozrysUiTools.createApi({ FC })
    : {
      h: (tag, attrs, children)=> {
        const el = document.createElement(tag);
        if(attrs){
          for(const k in attrs){
            if(k==='class') el.className = attrs[k];
            else if(k==='html') el.innerHTML = attrs[k];
            else if(k==='text') el.textContent = attrs[k];
            else el.setAttribute(k, attrs[k]);
          }
        }
        (children||[]).forEach((ch)=> el.appendChild(ch));
        return el;
      },
      labelWithInfo: ()=> document.createElement('div'),
      openRozrysInfo: ()=> undefined,
      getSelectOptionLabel: ()=> '',
      setChoiceLaunchValue: ()=> undefined,
      createChoiceLauncher: (label)=> {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rozrys-choice-launch';
        btn.textContent = String(label || '');
        return btn;
      },
      openRozrysChoiceOverlay: ()=> Promise.resolve(null),
      askRozrysConfirm: ()=> Promise.resolve(false),
    };

  const h = uiTools.h;
  const labelWithInfo = uiTools.labelWithInfo;
  const openRozrysInfo = uiTools.openRozrysInfo;
  const getSelectOptionLabel = uiTools.getSelectOptionLabel;
  const setChoiceLaunchValue = uiTools.setChoiceLaunchValue;
  const createChoiceLauncher = uiTools.createChoiceLauncher;
  const openRozrysChoiceOverlay = uiTools.openRozrysChoiceOverlay;
  const askRozrysConfirm = uiTools.askRozrysConfirm;

  const partHelpers = (FC.rozrysPartHelpers && typeof FC.rozrysPartHelpers.createApi === 'function')
    ? FC.rozrysPartHelpers.createApi({ FC, host:window, cmToMm, partSignature })
    : (()=> {
      function getPartOptionsStore(){
        return (FC && FC.materialPartOptions) || null;
      }
      function normalizeFrontLaminatMaterialKey(materialKey){
        const m = String(materialKey || '').match(/^\s*Front\s*:\s*laminat\s*•\s*(.+)$/i);
        return m ? String(m[1] || '').trim() : String(materialKey || '').trim();
      }
      function resolveCabinetCutListFn(){
        try{
          if(FC.cabinetCutlist && typeof FC.cabinetCutlist.getCabinetCutList === 'function') return FC.cabinetCutlist.getCabinetCutList.bind(FC.cabinetCutlist);
        }catch(_){ }
        try{
          if(typeof getCabinetCutList === 'function') return getCabinetCutList;
        }catch(_){ }
        try{
          if(typeof window.getCabinetCutList === 'function') return window.getCabinetCutList;
        }catch(_){ }
        return null;
      }
      function resolveRozrysPartFromSource(p){
        try{
          const store = getPartOptionsStore();
          if(store && typeof store.resolvePartForRozrys === 'function') return store.resolvePartForRozrys(p);
        }catch(_){ }
        const materialKey = normalizeFrontLaminatMaterialKey(String((p && p.material) || '').trim());
        return {
          materialKey,
          name: String((p && p.name) || 'Element'),
          sourceSig: `${materialKey}||${String((p && p.name) || 'Element')}||${cmToMm(p && p.a)}x${cmToMm(p && p.b)}` ,
          direction: 'default',
          ignoreGrain: false,
          w: cmToMm(p && p.a),
          h: cmToMm(p && p.b),
          qty: Math.max(1, Math.round(Number(p && p.qty) || 0)),
        };
      }
      function materialPartDirectionLabel(part){
        try{
          const store = getPartOptionsStore();
          if(store && typeof store.labelForDirection === 'function') return store.labelForDirection(part && part.direction);
        }catch(_){ }
        return 'Domyślny z materiału';
      }
      function isPartRotationAllowed(part, grainOn, overrides){
        if(!grainOn) return true;
        if(part && part.ignoreGrain) return true;
        const sig = partSignature(part);
        return !!(overrides && overrides[sig]);
      }
      function isFrontMaterialKey(materialKey){
        return /^\s*Front\s*:/i.test(String(materialKey||''));
      }
      return { getPartOptionsStore, resolveCabinetCutListFn, resolveRozrysPartFromSource, materialPartDirectionLabel, isPartRotationAllowed, isFrontMaterialKey, normalizeFrontLaminatMaterialKey };
    })();

  const getPartOptionsStore = partHelpers.getPartOptionsStore;
  const resolveCabinetCutListFn = partHelpers.resolveCabinetCutListFn;
  const resolveRozrysPartFromSource = partHelpers.resolveRozrysPartFromSource;
  const materialPartDirectionLabel = partHelpers.materialPartDirectionLabel;
  const isPartRotationAllowed = partHelpers.isPartRotationAllowed;
  const isFrontMaterialKey = partHelpers.isFrontMaterialKey;
  const normalizeFrontLaminatMaterialKey = partHelpers.normalizeFrontLaminatMaterialKey;

  const engineBridge = (FC.rozrysEngineBridge && typeof FC.rozrysEngineBridge.createApi === 'function')
    ? FC.rozrysEngineBridge.createApi({ FC, loadEdgeStore, partSignature, isPartRotationAllowed, mmToUnitStr })
    : {};

  const uiBridge = (FC.rozrysUiBridge && typeof FC.rozrysUiBridge.createApi === 'function')
    ? FC.rozrysUiBridge.createApi({ FC })
    : {
      createProgressApi: ()=> ({
        controller:null,
        setGenBtnMode: ()=> undefined,
        requestCancel: ()=> undefined,
        isRozrysRunning: ()=> false,
        getRozrysBtnMode: ()=> 'idle',
      }),
      openOptionsModal: ()=> undefined,
      openAddStockModal: ()=> undefined,
    };

  const panelWorkspaceApi = (FC.rozrysPanelWorkspace && typeof FC.rozrysPanelWorkspace.createApi === 'function')
    ? FC.rozrysPanelWorkspace.createApi({ FC })
    : {
      createWorkspace: ()=> null,
    };

  const runtimeBundleApi = (FC.rozrysRuntimeBundle && typeof FC.rozrysRuntimeBundle.createApi === 'function')
    ? FC.rozrysRuntimeBundle.createApi({ FC })
    : {
      createPlanHelpers: ()=> ({
        getRealHalfStockForMaterial: ()=> ({ qty:0, width:0, height:0 }),
        toMmByUnit: ()=> 0,
        fromMmByUnit: ()=> 0,
        sameSheetFormat: ()=> false,
        getDefaultRozrysOptionValues: ()=> ({ unit:'cm', edge:'0', boardW:280, boardH:207, kerf:0.4, trim:1, minW:0, minH:0 }),
        getSheetRowsForMaterial: ()=> [],
        buildStockSignatureForMaterial: ()=> '',
        canPartFitSheet: ()=> false,
        filterPartsForSheet: ()=> [],
        getExactSheetStockForMaterial: (material, boardWmm, boardHmm)=> ({ qty:0, width:Math.round(Number(boardWmm)||0), height:Math.round(Number(boardHmm)||0) }),
        getLargestSheetFormatForMaterial: (material, fallbackWmm, fallbackHmm)=> ({ width:Math.round(Number(fallbackWmm)||0), height:Math.round(Number(fallbackHmm)||0), qty:0 }),
        clonePlanSheetsWithSupply: (sheets)=> Array.isArray(sheets) ? sheets.slice() : [],
        countPlacedPartsByKey: ()=> new Map(),
        subtractPlacedParts: (parts)=> Array.isArray(parts) ? parts.slice() : [],
        buildPlanMetaFromState: ()=> ({ trim:10, boardW:2800, boardH:2070, unit:'mm' }),
        computePlanWithCurrentEngine: async (st, parts)=> computePlan(st, parts),
        applySheetStockLimit: async (material, st, parts, plan)=> (plan && typeof plan === 'object') ? plan : { sheets:[] },
        materialHasGrain: ()=> false,
        openMaterialGrainExceptions: ()=> undefined,
        loadPlanCache: ()=> ({}),
        savePlanCache: ()=> undefined,
        makePlanCacheKey: ()=> 'plan_fallback',
      }),
      createOutputController: (config)=> {
        const ctx = (config && config.ctx) || {};
        return {
          buildEntriesForScope:()=> [],
          splitMaterialAccordionTitle:(material)=> ({ line1:String(material || 'Materiał'), line2:'' }),
          createMaterialAccordionSection:()=> { const wrap = document.createElement('div'); const body = document.createElement('div'); wrap.appendChild(body); return { wrap, body, trigger:null, setOpenState:()=>{} }; },
          renderOutput:(plan, meta, target)=> { const tgt = target || ctx.out; if(tgt) tgt.innerHTML = ''; return undefined; },
          renderLoadingInto:(target)=> { const tgt = target || ctx.out; if(tgt) tgt.innerHTML = ''; return null; },
          renderLoading:(text)=> { const tgt = ctx.out; if(tgt) tgt.innerHTML = ''; return null; },
          renderMaterialAccordionPlans:()=> false,
          tryAutoRenderFromCache:()=> { const tgt = ctx.out; if(tgt) tgt.innerHTML = ''; const fn = typeof ctx.getSetGenBtnMode === 'function' ? ctx.getSetGenBtnMode() : null; if(typeof fn === 'function') fn('idle'); return false; },
        };
      },
      createRunController: ()=> ({
        progressCtrl:null,
        setGenBtnMode: ()=> undefined,
        requestCancel: ()=> undefined,
        isRozrysRunning: ()=> false,
        getRozrysBtnMode: ()=> 'idle',
        generate: ()=> undefined,
        openAddStockModal: ()=> undefined,
        bindInteractions: ()=> undefined,
        init: ()=> undefined,
      }),
    };

  const scopeApi = (FC.rozrysScope && typeof FC.rozrysScope.createApi === 'function')
    ? FC.rozrysScope.createApi({
      getRooms,
      getAggregatePartsForProject: ()=> aggregatePartsForProject,
    })
    : {
      roomLabel: (room)=> String(room || '').trim() || 'Pomieszczenie',
      normalizeRoomSelection: (rooms)=> Array.isArray(rooms) ? rooms.slice() : [],
      encodeRoomsSelection: ()=> '',
      decodeRoomsSelection: ()=> getRooms().slice(),
      makeMaterialScope: (selection)=> Object.assign({ kind:'all', material:'', includeFronts:true, includeCorpus:true }, selection || {}),
      encodeMaterialScope: (selection)=> { try{ return JSON.stringify(selection || {}); }catch(_){ return '{}'; } },
      decodeMaterialScope: (raw)=> { try{ return JSON.parse(String(raw || '')); }catch(_){ return { kind:'all', material:'', includeFronts:true, includeCorpus:true }; } },
      sortRozrysParts: (list)=> Array.isArray(list) ? list.slice() : [],
      getGroupPartsForScope: ()=> [],
      normalizeMaterialScopeForAggregate: (selection)=> Object.assign({ kind:'all', material:'', includeFronts:true, includeCorpus:true }, selection || {}),
      getRozrysScopeMode: (selection)=> {
        const scope = Object.assign({ kind:'all', material:'', includeFronts:true, includeCorpus:true }, selection || {});
        return scope.includeFronts && scope.includeCorpus ? 'both' : (scope.includeFronts ? 'fronts' : 'corpus');
      },
      getOrderedMaterialsForSelection: ()=> [],
      getAccordionScopeKey: ()=> 'scope:fallback',
      getScopeSummary: ()=> ({ title:'Wszystkie materiały', subtitle:'', detail:'' }),
      getRoomsSummary: ()=> ({ title:'Pomieszczenia', subtitle:'' }),
    };

  const roomLabel = scopeApi.roomLabel;
  const normalizeRoomSelection = scopeApi.normalizeRoomSelection;
  const encodeRoomsSelection = scopeApi.encodeRoomsSelection;
  const decodeRoomsSelection = scopeApi.decodeRoomsSelection;
  const makeMaterialScope = scopeApi.makeMaterialScope;
  const encodeMaterialScope = scopeApi.encodeMaterialScope;
  const decodeMaterialScope = scopeApi.decodeMaterialScope;
  const sortRozrysParts = scopeApi.sortRozrysParts;
  const getGroupPartsForScope = scopeApi.getGroupPartsForScope;
  const normalizeMaterialScopeForAggregate = scopeApi.normalizeMaterialScopeForAggregate;
  const getRozrysScopeMode = scopeApi.getRozrysScopeMode;
  const getOrderedMaterialsForSelection = scopeApi.getOrderedMaterialsForSelection;
  const getAccordionScopeKey = scopeApi.getAccordionScopeKey;

function getCurrentRoomContext(){
  try{
    const state = (FC.uiState && typeof FC.uiState.get === 'function')
      ? FC.uiState.get()
      : ((typeof uiState !== 'undefined' && uiState && typeof uiState === 'object') ? uiState : null);
    return String((state && state.roomType) || '').trim();
  }catch(_){
    return '';
  }
}

function resolveInitialSelectedRooms(raw){
  const activeRooms = getRooms().map((room)=> String(room || '').trim()).filter(Boolean);
  const currentRoom = getCurrentRoomContext();
  if(currentRoom && activeRooms.includes(currentRoom)) return [currentRoom];
  const decoded = decodeRoomsSelection(raw).map((room)=> String(room || '').trim()).filter(Boolean);
  if(decoded.length) return decoded;
  return activeRooms.slice();
}


  const runtimeUtils = (FC.rozrysRuntimeUtils && typeof FC.rozrysRuntimeUtils.createApi === 'function')
    ? FC.rozrysRuntimeUtils.createApi({
      FC,
      safeGetProject,
      getRooms,
      normalizeRoomSelection,
      resolveCabinetCutListFn,
      resolveRozrysPartFromSource,
      isFrontMaterialKey,
      partSignature,
      mmToUnitStr,
      openRozrysInfo,
    })
    : {
      buildResolvedSnapshotFromParts: ()=> [],
      buildRawSnapshotForMaterial: ()=> [],
      buildRozrysDiagnostics: ()=> null,
      validationSummaryLabel: ()=> ({ text:'Walidacja: brak danych', tone:'is-warn' }),
      openValidationListModal: ()=> undefined,
      openSheetListModal: ()=> undefined,
      buildCsv: ()=> '',
      downloadText: ()=> undefined,
      openPrintView: ()=> undefined,
      pxToMm: (px)=>{ const n = Number(px); return Number.isFinite(n) ? n * 25.4 / 96 : 0; },
      measurePrintHeaderMm: ()=> 14,
    };
  const buildResolvedSnapshotFromParts = runtimeUtils.buildResolvedSnapshotFromParts;
  const buildRawSnapshotForMaterial = runtimeUtils.buildRawSnapshotForMaterial;
  const buildRozrysDiagnostics = runtimeUtils.buildRozrysDiagnostics;
  const validationSummaryLabel = runtimeUtils.validationSummaryLabel;
  const openValidationListModal = runtimeUtils.openValidationListModal;
  const openSheetListModal = runtimeUtils.openSheetListModal;


function aggregatePartsForProject(selectedRooms){
  if(FC.rozrysScope && typeof FC.rozrysScope.aggregatePartsForProject === 'function'){
    const baseDeps = {
      getRooms,
      getCabinetCutList: resolveCabinetCutListFn(),
      resolveRozrysPartFromSource,
      isFrontMaterialKey,
    };
    const requestedRooms = Array.isArray(selectedRooms)
      ? selectedRooms.map((room)=> String(room || '').trim()).filter(Boolean)
      : [];
    let bestExplicitEmpty = null;
    const candidates = collectProjectCandidates();
    for(const entry of candidates){
      const scopedGetRooms = ()=> getRoomsForProject(entry.proj);
      const scopedDeps = Object.assign({}, baseDeps, {
        safeGetProject: ()=> entry.proj,
        getRooms: scopedGetRooms,
      });
      const first = FC.rozrysScope.aggregatePartsForProject(selectedRooms, scopedDeps)
        || { byMaterial:{}, materials:[], groups:{}, selectedRooms:[] };
      const firstRooms = Array.isArray(first.selectedRooms)
        ? first.selectedRooms.map((room)=> String(room || '').trim()).filter(Boolean)
        : [];
      if(Array.isArray(first.materials) && first.materials.length) return first;
      if(firstRooms.length){
        if(!bestExplicitEmpty) bestExplicitEmpty = first;
        continue;
      }
      const allowRetryToDiscoveredRooms = firstRooms.length === 0;
      if(allowRetryToDiscoveredRooms){
        const discoveredRooms = scopedGetRooms();
        if(discoveredRooms.length){
          const retry = FC.rozrysScope.aggregatePartsForProject(discoveredRooms, scopedDeps);
          if(retry && Array.isArray(retry.materials) && retry.materials.length) return retry;
        }
      }
    }
    if(bestExplicitEmpty) return bestExplicitEmpty;
    const deps = Object.assign({}, baseDeps, { safeGetProject });
    const fallback = FC.rozrysScope.aggregatePartsForProject(selectedRooms, deps);
    return fallback || { byMaterial:{}, materials:[], groups:{}, selectedRooms:Array.isArray(selectedRooms) ? selectedRooms.slice() : [] };
  }
  return { byMaterial: {}, materials: [], groups: {}, selectedRooms: Array.isArray(selectedRooms) ? selectedRooms.slice() : [] };
}


  // edgeSubMm: 0 => show nominal dimensions, >0 => show "do cięcia" dims (kompensacja okleiny)
  // Zasada kompensacji (zgodnie z ustaleniem):
  // - okleina na krawędziach W (top/bottom) zwiększa wymiar H => odejmujemy od H
  // - okleina na krawędziach H (left/right) zwiększa wymiar W => odejmujemy od W
  const drawSheet = typeof engineBridge.drawSheet === 'function' ? engineBridge.drawSheet : (()=> undefined);
  const scheduleSheetCanvasRefresh = typeof engineBridge.scheduleSheetCanvasRefresh === 'function' ? engineBridge.scheduleSheetCanvasRefresh : (()=> undefined);

  const buildCsv = runtimeUtils.buildCsv;
  const downloadText = runtimeUtils.downloadText;
  const openPrintView = runtimeUtils.openPrintView;
  const pxToMm = runtimeUtils.pxToMm;
  const measurePrintHeaderMm = runtimeUtils.measurePrintHeaderMm;

  const computePlan = typeof engineBridge.computePlan === 'function' ? engineBridge.computePlan : (()=> ({ sheets: [], note: 'Brak modułu rozrysEngine.' }));
  const getOptimaxProfilePreset = typeof engineBridge.getOptimaxProfilePreset === 'function' ? engineBridge.getOptimaxProfilePreset : (()=> ({}));
  const normalizeCutDirection = typeof engineBridge.normalizeCutDirection === 'function' ? engineBridge.normalizeCutDirection : (()=> 'start-along');
  const speedLabel = typeof engineBridge.speedLabel === 'function' ? engineBridge.speedLabel : ((mode)=> String(mode || ''));
  const directionLabel = typeof engineBridge.directionLabel === 'function' ? engineBridge.directionLabel : ((dir)=> String(dir || ''));
  const formatHeurLabel = typeof engineBridge.formatHeurLabel === 'function' ? engineBridge.formatHeurLabel : ((st)=> String((st && st.heur) || ''));
  const computePlanPanelProAsync = typeof engineBridge.computePlanPanelProAsync === 'function' ? engineBridge.computePlanPanelProAsync : (()=> Promise.resolve({ sheets: [], note: 'Brak modułu rozrysEngine.' }));

  function render(){
    const root = document.getElementById('rozrysRoot');
    if(!root) return;

    root.innerHTML = '';

    const card = h('div', { class:'card' });
    const panelPrefs = loadPanelPrefs();
    let selectedRooms = resolveInitialSelectedRooms(panelPrefs.selectedRooms);
    let agg = aggregatePartsForProject(selectedRooms);
    let materialScope = normalizeMaterialScopeForAggregate(decodeMaterialScope(panelPrefs.materialScope), agg);
    const headerRow = h('div', { style:'display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap' });
    headerRow.appendChild(h('h3', { style:'margin:0', text:'Optimax — optymalizacja rozkroju' }));
    card.appendChild(headerRow);

    if(!agg.materials.length){
      card.appendChild(h('div', { class:'muted', style:'margin-top:10px', html:'Brak rozpiski materiałów. Dodaj szafki, żeby ROZRYS miał co ciąć.' }));
      root.appendChild(card);
      return;
    }

    // state (ui) — keep local per render
    const initialUnit = (panelPrefs.unit === 'cm' ? 'cm' : 'mm');
    const state = {
      material: materialScope.kind === 'material' && materialScope.material ? materialScope.material : (agg.materials[0] || ''),
      unit: initialUnit,
      boardW: Number.isFinite(Number(panelPrefs.boardW)) ? Math.max(1, Number(panelPrefs.boardW)) : (initialUnit === 'cm' ? 280 : 2800),
      boardH: Number.isFinite(Number(panelPrefs.boardH)) ? Math.max(1, Number(panelPrefs.boardH)) : (initialUnit === 'cm' ? 207 : 2070),
      kerf: Number.isFinite(Number(panelPrefs.kerf)) ? Math.max(0, Number(panelPrefs.kerf)) : (initialUnit === 'cm' ? 0.4 : 4),
      edgeTrim: Number.isFinite(Number(panelPrefs.edgeTrim)) ? Math.max(0, Number(panelPrefs.edgeTrim)) : (initialUnit === 'cm' ? 1 : 10),
      heur: 'optimax',
      optimaxProfile: 'max',
      minScrapW: Number.isFinite(Number(panelPrefs.minScrapW)) ? Math.max(0, Number(panelPrefs.minScrapW)) : 0,
      minScrapH: Number.isFinite(Number(panelPrefs.minScrapH)) ? Math.max(0, Number(panelPrefs.minScrapH)) : 0,
      direction: 'start-optimax',
    };
    const rozState = (FC.rozrysState && typeof FC.rozrysState.createStore === 'function')
      ? FC.rozrysState.createStore({
          selectedRooms,
          aggregate: agg,
          materialScope,
          options: state,
          ui: { buttonMode:'idle', running:false },
          cache: { lastAutoRenderHit:false, lastScopeKey:'' },
        })
      : null;

    // if magazyn has hint for first material
    function toDisp(mm){ return state.unit === 'mm' ? mm : (mm/10); }
    function fromDisp(v){ return state.unit === 'mm' ? Number(v) : (Number(v) * 10); }

    // Format pełnej płyty ma pozostać pod kontrolą użytkownika.
    // Nie nadpisujemy go automatycznie mniejszym formatem z magazynu.

    // top row: material + format arkusza + opcje
    const controls = h('div', { class:'rozrys-selection-grid', style:'margin-top:12px' });
    // room + material picker
    const roomsWrap = h('div', { class:'rozrys-field rozrys-selection-grid__rooms' });
    roomsWrap.appendChild(labelWithInfo('Pomieszczenia', 'Pomieszczenia', 'Wybierz, z których pomieszczeń mam zebrać formatki do rozrysu. Ten sam materiał z kilku pomieszczeń zostanie zsumowany.'));
    const roomsSel = h('input', { id:'rozRooms', type:'hidden', value:encodeRoomsSelection(selectedRooms) });
    const roomsPickerBtn = h('button', { type:'button', class:'btn rozrys-picker-launch rozrys-picker-launch--rooms' });
    const roomsPickerValue = h('div', { class:'rozrys-picker-launch__value' });
    roomsPickerBtn.appendChild(roomsPickerValue);
    roomsWrap.appendChild(roomsPickerBtn);
    roomsWrap.appendChild(roomsSel);
    controls.appendChild(roomsWrap);

    const matWrap = h('div', { class:'rozrys-field rozrys-selection-grid__material' });
    matWrap.appendChild(labelWithInfo('Materiał / grupa', 'Materiał / grupa', 'Wybierz wszystkie materiały albo jeden kolor. Dla koloru, który ma i fronty, i korpusy, możesz zaznaczyć sam front, sam korpus albo oba.'));
    const matSel = h('input', { id:'rozMat', type:'hidden', value:encodeMaterialScope(materialScope) });
    const matPickerBtn = h('button', { type:'button', class:'btn rozrys-picker-launch rozrys-picker-launch--material' });
    const matPickerValue = h('div', { class:'rozrys-picker-launch__value' });
    matPickerBtn.appendChild(matPickerValue);
    matWrap.appendChild(matPickerBtn);
    matWrap.appendChild(matSel);
    controls.appendChild(matWrap);
    card.appendChild(controls);

    const workspace = panelWorkspaceApi.createWorkspace({
      h,
      labelWithInfo,
      createChoiceLauncher,
      getSelectOptionLabel,
      setChoiceLaunchValue,
      openRozrysChoiceOverlay,
      card,
      state,
      panelPrefs,
      getSelectedRooms: ()=> selectedRooms,
      getMaterialScope: ()=> materialScope,
      encodeRoomsSelection,
      encodeMaterialScope,
      loadPanelPrefs,
      savePanelPrefs,
      rozState,
    }, {
      normalizeCutDirection,
    });
    if(!workspace){
      card.appendChild(h('div', { class:'muted', style:'margin-top:12px', text:'Brak modułu panelu ROZRYS.' }));
      root.appendChild(card);
      return;
    }

    const unitSel = workspace.unitSel;
    const edgeSel = workspace.edgeSel;
    const inW = workspace.inW;
    const inH = workspace.inH;
    const inK = workspace.inK;
    const inTrim = workspace.inTrim;
    const inMinW = workspace.inMinW;
    const inMinH = workspace.inMinH;
    const heurSel = workspace.heurSel;
    const dirSel = workspace.dirSel;
    const addStockBtn = workspace.addStockBtn;
    const openOptionsBtnInline = workspace.openOptionsBtnInline;
    const genBtn = workspace.genBtn;
    const statusBox = workspace.statusBox;
    const statusMain = workspace.statusMain;
    const statusSub = workspace.statusSub;
    const statusMeta = workspace.statusMeta;
    const statusProg = workspace.statusProg;
    const statusProgBar = workspace.statusProgBar;
    const out = workspace.out;
    const persistOptionPrefs = workspace.persistOptionPrefs;
    const applyUnitChange = workspace.applyUnitChange;
    const getBaseState = workspace.getBaseState;

    root.appendChild(card);


    function applyHintFromMagazyn(material, opts){
      // Format bazowy pozostaje pod kontrolą użytkownika w ustawieniach.
      // Stan magazynu nie może już nadpisywać głównego formatu rozrysu.
      void material;
      void opts;
    }

    const renderScopeApi = (FC.rozrysScope && typeof FC.rozrysScope.createApi === 'function')
      ? FC.rozrysScope.createApi({
        getRooms,
        getAggregatePartsForProject: ()=> aggregatePartsForProject,
        splitMaterialAccordionTitle,
      })
      : scopeApi;
    const getScopeSummary = renderScopeApi.getScopeSummary;
    const getRoomsSummary = renderScopeApi.getRoomsSummary;

    const selectionUi = (FC.rozrysSelectionUi && typeof FC.rozrysSelectionUi.createController === 'function')
      ? FC.rozrysSelectionUi.createController({
          h,
          state,
          roomsPickerValue,
          matPickerValue,
          roomsSel,
          matSel,
          rozState,
          getRooms,
          getSelectedRooms: ()=> selectedRooms,
          setSelectedRooms: (rooms)=>{ selectedRooms = Array.isArray(rooms) ? rooms.slice() : []; },
          getMaterialScope: ()=> materialScope,
          setMaterialScope: (nextScope)=>{ materialScope = nextScope; },
          getAggregate: ()=> agg,
          setAggregate: (nextAgg)=>{ agg = nextAgg; },
          tryAutoRenderFromCache: ()=> tryAutoRenderFromCache(),
        }, {
          getScopeSummary,
          getRoomsSummary,
          savePanelPrefs,
          loadPanelPrefs,
          encodeRoomsSelection,
          encodeMaterialScope,
          normalizeMaterialScopeForAggregate,
          aggregatePartsForProject,
          askRozrysConfirm,
          normalizeRoomSelection,
          roomLabel,
          splitMaterialAccordionTitle,
          makeMaterialScope,
        })
      : null;

    function updateRoomsPickerButton(){
      if(selectionUi && typeof selectionUi.updateRoomsPickerButton === 'function') selectionUi.updateRoomsPickerButton();
    }

    function updateMaterialPickerButton(){
      if(selectionUi && typeof selectionUi.updateMaterialPickerButton === 'function') selectionUi.updateMaterialPickerButton();
    }

    function persistSelectionPrefs(){
      if(selectionUi && typeof selectionUi.persistSelectionPrefs === 'function') selectionUi.persistSelectionPrefs();
    }

    function syncHiddenSelections(){
      if(selectionUi && typeof selectionUi.syncHiddenSelections === 'function') selectionUi.syncHiddenSelections();
    }

    function refreshSelectionState(opts){
      if(selectionUi && typeof selectionUi.refreshSelectionState === 'function') selectionUi.refreshSelectionState(opts);
    }

    function buildScopeDraftControls(holder, draftScope, hasFronts, hasCorpus, opts){
      if(selectionUi && typeof selectionUi.buildScopeDraftControls === 'function') return selectionUi.buildScopeDraftControls(holder, draftScope, hasFronts, hasCorpus, opts);
    }

    function openRoomsPicker(){
      if(selectionUi && typeof selectionUi.openRoomsPicker === 'function') return selectionUi.openRoomsPicker();
    }

    function openMaterialPicker(){
      if(selectionUi && typeof selectionUi.openMaterialPicker === 'function') return selectionUi.openMaterialPicker();
    }

    updateRoomsPickerButton();
    updateMaterialPickerButton();
    syncHiddenSelections();
    roomsPickerBtn.addEventListener('click', openRoomsPicker);
    matPickerBtn.addEventListener('click', openMaterialPicker);

    const planHelpers = runtimeBundleApi.createPlanHelpers({
      FC,
      materials,
      controls:{ unitSel },
      computePlan,
      computePlanPanelProAsync,
      isPartRotationAllowed,
      partSignature,
      loadEdgeStore,
      tryAutoRenderFromCache,
      askRozrysConfirm,
      openRozrysInfo,
      setMaterialGrainExceptions,
      getMaterialGrainEnabled,
      getMaterialGrainExceptions,
      materialPartDirectionLabel,
      mmToUnitStr,
      h,
    });
    const getRealHalfStockForMaterial = planHelpers.getRealHalfStockForMaterial;
    const toMmByUnit = planHelpers.toMmByUnit;
    const fromMmByUnit = planHelpers.fromMmByUnit;
    const sameSheetFormat = planHelpers.sameSheetFormat;
    const getDefaultRozrysOptionValues = planHelpers.getDefaultRozrysOptionValues;
    const getSheetRowsForMaterial = planHelpers.getSheetRowsForMaterial;
    const buildStockSignatureForMaterial = planHelpers.buildStockSignatureForMaterial;
    const canPartFitSheet = planHelpers.canPartFitSheet;
    const filterPartsForSheet = planHelpers.filterPartsForSheet;
    const getExactSheetStockForMaterial = planHelpers.getExactSheetStockForMaterial;
    const getLargestSheetFormatForMaterial = planHelpers.getLargestSheetFormatForMaterial;
    const clonePlanSheetsWithSupply = planHelpers.clonePlanSheetsWithSupply;
    const countPlacedPartsByKey = planHelpers.countPlacedPartsByKey;
    const subtractPlacedParts = planHelpers.subtractPlacedParts;
    const buildPlanMetaFromState = planHelpers.buildPlanMetaFromState;
    const computePlanWithCurrentEngine = planHelpers.computePlanWithCurrentEngine;
    const applySheetStockLimit = planHelpers.applySheetStockLimit;
    const materialHasGrain = planHelpers.materialHasGrain;
    const openMaterialGrainExceptions = planHelpers.openMaterialGrainExceptions;
    const loadPlanCache = planHelpers.loadPlanCache;
    const savePlanCache = planHelpers.savePlanCache;
    const makePlanCacheKey = planHelpers.makePlanCacheKey;

    let outputCtrl = null;
    function buildEntriesForScope(selection, aggregate){
      if(outputCtrl && typeof outputCtrl.buildEntriesForScope === 'function') return outputCtrl.buildEntriesForScope(selection, aggregate);
      return [];
    }
    function splitMaterialAccordionTitle(material){
      if(outputCtrl && typeof outputCtrl.splitMaterialAccordionTitle === 'function') return outputCtrl.splitMaterialAccordionTitle(material);
      return { line1:String(material || 'Materiał'), line2:'' };
    }
    function createMaterialAccordionSection(material, options){
      if(outputCtrl && typeof outputCtrl.createMaterialAccordionSection === 'function') return outputCtrl.createMaterialAccordionSection(material, options);
      const wrap = document.createElement('div');
      const body = document.createElement('div');
      wrap.appendChild(body);
      return { wrap, body, trigger:null, setOpenState:()=>{} };
    }
    function renderOutput(plan, meta, target){
      if(outputCtrl && typeof outputCtrl.renderOutput === 'function') return outputCtrl.renderOutput(plan, meta, target);
      const tgt = target || out;
      if(tgt) tgt.innerHTML = '';
      return undefined;
    }
    function renderLoadingInto(target, text, subText){
      if(outputCtrl && typeof outputCtrl.renderLoadingInto === 'function') return outputCtrl.renderLoadingInto(target, text, subText);
      const tgt = target || out;
      if(tgt) tgt.innerHTML = '';
      return null;
    }
    function renderLoading(text){
      if(outputCtrl && typeof outputCtrl.renderLoading === 'function') return outputCtrl.renderLoading(text);
      return renderLoadingInto(null, text);
    }
    function renderMaterialAccordionPlans(scopeKey, scopeMode, entries){
      if(outputCtrl && typeof outputCtrl.renderMaterialAccordionPlans === 'function') return outputCtrl.renderMaterialAccordionPlans(scopeKey, scopeMode, entries);
      if(out) out.innerHTML = '';
      return false;
    }
    function tryAutoRenderFromCache(){
      if(outputCtrl && typeof outputCtrl.tryAutoRenderFromCache === 'function') return outputCtrl.tryAutoRenderFromCache();
      if(out) out.innerHTML = '';
      setGenBtnMode('idle');
      return false;
    }

    outputCtrl = runtimeBundleApi.createOutputController({
      ctx: {
        out,
        getAggregate: ()=> agg,
        getMatSelValue: ()=> matSel.value,
        getBaseState,
        setCacheState: (patch)=>{ try{ if(rozState) rozState.setCacheState(patch); }catch(_){ } },
        isRozrysRunning: ()=> isRozrysRunning(),
        getSetGenBtnMode: ()=> setGenBtnMode,
      },
      deps: {
        normalizeMaterialScopeForAggregate,
        decodeMaterialScope,
        aggregatePartsForProject,
        getOrderedMaterialsForSelection,
        getGroupPartsForScope,
        getAccordionPref,
        setAccordionPref,
        materialHasGrain,
        getMaterialGrainEnabled,
        getMaterialGrainExceptions,
        setMaterialGrainEnabled,
        openMaterialGrainExceptions,
        formatHeurLabel,
        scheduleSheetCanvasRefresh,
        buildRozrysDiagnostics,
        validationSummaryLabel,
        openValidationListModal,
        openSheetListModal,
        buildCsv,
        downloadText,
        openPrintView,
        measurePrintHeaderMm,
        mmToUnitStr,
        drawSheet,
        cutOptimizer: FC.cutOptimizer,
        loadPlanCache,
        toMmByUnit,
        getRealHalfStockForMaterial,
        getExactSheetStockForMaterial,
        getLargestSheetFormatForMaterial,
        partSignature,
        buildStockSignatureForMaterial,
        makePlanCacheKey,
        getAccordionScopeKey,
        getRozrysScopeMode,
      },
    });

    const runCtrl = runtimeBundleApi.createRunController({
      ctx: {
        FC,
        statusBox,
        statusMain,
        statusSub,
        statusMeta,
        statusProg,
        statusProgBar,
        genBtn,
        addStockBtn,
        openOptionsBtnInline,
        matSel,
        unitSel,
        edgeSel,
        inW,
        inH,
        inK,
        inTrim,
        inMinW,
        inMinH,
        heurSel,
        dirSel,
        out,
        getAggregate: ()=> agg,
        setUiState: (patch)=>{ try{ if(rozState) rozState.setUiState(patch); }catch(_){ } },
      },
      deps: {
        createProgressApi: uiBridge.createProgressApi,
        openAddStockModalBridge: uiBridge.openAddStockModal,
        openOptionsModalBridge: uiBridge.openOptionsModal,
        applyUnitChange,
        persistOptionPrefs,
        tryAutoRenderFromCache,
        h,
        labelWithInfo,
        getDefaultRozrysOptionValues,
        normalizeMaterialScopeForAggregate,
        decodeMaterialScope,
        normalizeCutDirection,
        loadPlanCache,
        savePlanCache,
        materialHasGrain,
        getMaterialGrainEnabled,
        getMaterialGrainExceptions,
        partSignature,
        getRealHalfStockForMaterial,
        getExactSheetStockForMaterial,
        getLargestSheetFormatForMaterial,
        buildStockSignatureForMaterial,
        makePlanCacheKey,
        renderOutput,
        formatHeurLabel,
        getRozrysScopeMode,
        getOptimaxProfilePreset,
        speedLabel,
        directionLabel,
        renderLoadingInto,
        computePlanPanelProAsync,
        loadEdgeStore,
        isPartRotationAllowed,
        applySheetStockLimit,
        computePlan,
        buildEntriesForScope,
        getAccordionScopeKey,
        getAccordionPref,
        createMaterialAccordionSection,
        setAccordionPref,
        setMaterialGrainEnabled,
        openMaterialGrainExceptions,
        splitMaterialAccordionTitle,
        parseLocaleNumber,
        openRozrysInfo,
        askRozrysConfirm,
        createChoiceLauncher,
        getSelectOptionLabel,
        setChoiceLaunchValue,
        openRozrysChoiceOverlay,
      },
    });
    const progressCtrl = runCtrl.progressCtrl;
    const setGenBtnMode = runCtrl.setGenBtnMode;
    const requestCancel = runCtrl.requestCancel;
    const isRozrysRunning = runCtrl.isRozrysRunning;
    const getRozrysBtnMode = runCtrl.getRozrysBtnMode;
    const generate = runCtrl.generate;

// events
    matSel.addEventListener('change', ()=>{
      materialScope = normalizeMaterialScopeForAggregate(decodeMaterialScope(matSel.value), agg);
      try{ if(rozState) rozState.setMaterialScope(materialScope); }catch(_){ }
      syncHiddenSelections();
      updateMaterialPickerButton();
      persistSelectionPrefs();
      tryAutoRenderFromCache();
    });

    runCtrl.bindInteractions();
    runCtrl.init();
  }

  FC.rozrys = {
    render,
    aggregatePartsForProject,
    safeGetProject,
    discoverProjectRoomKeys,
    discoverVisibleProjectRoomKeys,
    getRoomsForProject,
    resolveInitialSelectedRooms,
    getCurrentRoomContext,
  };
})();