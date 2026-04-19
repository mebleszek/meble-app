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

  const selectionBridge = (FC.rozrysSelectionBridge && typeof FC.rozrysSelectionBridge.createApi === 'function')
    ? FC.rozrysSelectionBridge.createApi({ FC })
    : { createController: ()=> ({
        updateRoomsPickerButton(){},
        updateMaterialPickerButton(){},
        persistSelectionPrefs(){},
        syncHiddenSelections(){},
        refreshSelectionState(){},
        buildScopeDraftControls(){},
        openRoomsPicker(){},
        openMaterialPicker(){},
      }) };

  const optionsStateBridge = (FC.rozrysOptionsState && typeof FC.rozrysOptionsState.createApi === 'function')
    ? FC.rozrysOptionsState.createApi({ FC })
    : { createController: ()=> ({
        persistOptionPrefs(){},
        applyUnitChange(){},
        getBaseState(){ return {}; },
      }) };

  const outputBridge = (FC.rozrysOutputBridge && typeof FC.rozrysOutputBridge.createApi === 'function')
    ? FC.rozrysOutputBridge.createApi({ FC })
    : {
      tryAutoRenderFromCache: ()=> false,
      buildEntriesForScope: ()=> [],
      splitMaterialAccordionTitle: (material)=> ({ line1:String(material || 'Materiał'), line2:'' }),
      createMaterialAccordionSection: (_material, _options, deps)=> {
        const h = deps && typeof deps.h === 'function' ? deps.h : ((tag)=> document.createElement(tag));
        const wrap = h('div');
        const body = h('div');
        wrap.appendChild(body);
        return { wrap, body, trigger:null, setOpenState:()=>{} };
      },
      renderMaterialAccordionPlans: ()=> false,
      renderOutput: ()=> undefined,
      renderLoadingInto: ()=> null,
    };

  function getPartOptionsStore(){
    return (FC && FC.materialPartOptions) || null;
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
      sourceSig: `${materialKey}||${String((p && p.name) || 'Element')}||${cmToMm(p && p.a)}x${cmToMm(p && p.b)}`,
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

function roomLabel(room){
  if(FC.rozrysScope && typeof FC.rozrysScope.roomLabel === 'function'){
    return FC.rozrysScope.roomLabel(room);
  }
  const key = String(room || '').trim();
  return key || 'Pomieszczenie';
}

function normalizeRoomSelection(rooms){
  if(FC.rozrysScope && typeof FC.rozrysScope.normalizeRoomSelection === 'function'){
    return FC.rozrysScope.normalizeRoomSelection(rooms, { getRooms });
  }
  return Array.isArray(rooms) ? rooms.slice() : [];
}

function encodeRoomsSelection(rooms){
  if(FC.rozrysScope && typeof FC.rozrysScope.encodeRoomsSelection === 'function'){
    return FC.rozrysScope.encodeRoomsSelection(rooms, { getRooms });
  }
  return '';
}

function decodeRoomsSelection(raw){
  if(FC.rozrysScope && typeof FC.rozrysScope.decodeRoomsSelection === 'function'){
    return FC.rozrysScope.decodeRoomsSelection(raw, { getRooms });
  }
  return getRooms().slice();
}

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

function makeMaterialScope(selection, opts){
  if(FC.rozrysScope && typeof FC.rozrysScope.makeMaterialScope === 'function') return FC.rozrysScope.makeMaterialScope(selection, opts);
  return Object.assign({ kind:'all', material:'', includeFronts:true, includeCorpus:true }, selection || {});
}

function encodeMaterialScope(selection){
  if(FC.rozrysScope && typeof FC.rozrysScope.encodeMaterialScope === 'function') return FC.rozrysScope.encodeMaterialScope(selection);
  try{ return JSON.stringify(selection || {}); }catch(_){ return '{}'; }
}

function decodeMaterialScope(raw){
  if(FC.rozrysScope && typeof FC.rozrysScope.decodeMaterialScope === 'function') return FC.rozrysScope.decodeMaterialScope(raw);
  try{ return JSON.parse(String(raw || '')); }catch(_){ return { kind:'all', material:'', includeFronts:true, includeCorpus:true }; }
}

function sortRozrysParts(list){
  if(FC.rozrysScope && typeof FC.rozrysScope.sortRozrysParts === 'function') return FC.rozrysScope.sortRozrysParts(list);
  return Array.isArray(list) ? list.slice() : [];
}

function getGroupPartsForScope(group, selection){
  if(FC.rozrysScope && typeof FC.rozrysScope.getGroupPartsForScope === 'function') return FC.rozrysScope.getGroupPartsForScope(group, selection);
  return [];
}

function normalizeMaterialScopeForAggregate(selection, aggregate){
  if(FC.rozrysScope && typeof FC.rozrysScope.normalizeMaterialScopeForAggregate === 'function'){
    return FC.rozrysScope.normalizeMaterialScopeForAggregate(selection, aggregate, { aggregatePartsForProject });
  }
  return makeMaterialScope(selection);
}

function getRozrysScopeMode(selection){
  if(FC.rozrysScope && typeof FC.rozrysScope.getRozrysScopeMode === 'function') return FC.rozrysScope.getRozrysScopeMode(selection);
  const scope = makeMaterialScope(selection);
  return scope.includeFronts && scope.includeCorpus ? 'both' : (scope.includeFronts ? 'fronts' : 'corpus');
}

function getOrderedMaterialsForSelection(selection, aggregate){
  if(FC.rozrysScope && typeof FC.rozrysScope.getOrderedMaterialsForSelection === 'function'){
    return FC.rozrysScope.getOrderedMaterialsForSelection(selection, aggregate, { aggregatePartsForProject });
  }
  return [];
}

function getAccordionScopeKey(selection, aggregate){
  if(FC.rozrysScope && typeof FC.rozrysScope.getAccordionScopeKey === 'function'){
    return FC.rozrysScope.getAccordionScopeKey(selection, aggregate, { getRooms });
  }
  return 'scope:fallback';
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



  function isFrontMaterialKey(materialKey){
    return /^\s*Front\s*:/i.test(String(materialKey||''));
  }

  function normalizeFrontLaminatMaterialKey(materialKey){
    // Jeśli front jest z laminatu i ma kolor jak korpus, łączymy pod ten sam klucz materiału.
    // Fronty w Materiałach mają postać: "Front: laminat • <KOLOR>".
    const m = String(materialKey||'').match(/^\s*Front\s*:\s*laminat\s*•\s*(.+)$/i);
    return m ? String(m[1]||'').trim() : String(materialKey||'').trim();
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

    // hidden option controls controlled through modal
    const unitWrap = h('div', { class:'rozrys-field' });
    unitWrap.appendChild(h('label', { class:'rozrys-field__label', text:'Jednostki' }));
    const unitSel = h('select', { id:'rozUnit' });
    unitSel.innerHTML = `
      <option value="cm" ${state.unit==='cm'?'selected':''}>cm</option>
      <option value="mm" ${state.unit==='mm'?'selected':''}>mm</option>
    `;
    unitWrap.appendChild(unitSel);

    const edgeWrap = h('div', { class:'rozrys-field' });
    edgeWrap.appendChild(h('label', { class:'rozrys-field__label', text:'Wymiary do cięcia' }));
    const edgeSel = h('select', { id:'rozEdgeSub' });
    edgeSel.innerHTML = `
      <option value="0">Nominalne</option>
      <option value="1">Po odjęciu 1 mm okleiny</option>
      <option value="2">Po odjęciu 2 mm okleiny</option>
    `;
    edgeSel.value = ['0','1','2'].includes(String(panelPrefs.edgeSubMm)) ? String(panelPrefs.edgeSubMm) : '0';
    edgeWrap.appendChild(edgeSel);

    // base board size (kept in settings modal, not in main panel)
    const inW = h('input', { id:'rozW', type:'number', value:String(state.boardW) });
    const inH = h('input', { id:'rozH', type:'number', value:String(state.boardH) });
    inW.classList.add('rozrys-format-input');
    inH.classList.add('rozrys-format-input');
    const addStockBtn = h('button', { class:'btn-success rozrys-action-btn', type:'button', text:'Dodaj płytę' });
    const openOptionsBtnInline = h('button', { class:'btn rozrys-action-btn rozrys-action-btn--light', type:'button', text:'Opcje' });

    // hidden option inputs
    const kerfWrap = h('div', { class:'rozrys-field' });
    kerfWrap.appendChild(h('label', { class:'rozrys-field__label', text:`Rzaz piły (${state.unit})` }));
    const inK = h('input', { id:'rozK', type:'number', value:String(state.kerf) });
    kerfWrap.appendChild(inK);

    const trimWrap = h('div', { class:'rozrys-field' });
    trimWrap.appendChild(h('label', { class:'rozrys-field__label', text:`Obrównanie krawędzi — arkusz standardowy (${state.unit})` }));
    const inTrim = h('input', { id:'rozTrim', type:'number', value:String(state.edgeTrim) });
    trimWrap.appendChild(inTrim);

    const minScrapWrap = h('div', { class:'rozrys-field' });
    minScrapWrap.appendChild(h('label', { class:'rozrys-field__label', text:`Najmniejszy użyteczny odpad (${state.unit})` }));
    const minScrapRow = h('div', { class:'rozrys-inline-row', style:'display:flex;gap:8px' });
    const inMinW = h('input', { id:'rozMinScrapW', type:'number', value:String(state.minScrapW) });
    const inMinH = h('input', { id:'rozMinScrapH', type:'number', value:String(state.minScrapH) });
    minScrapRow.appendChild(inMinW);
    minScrapRow.appendChild(inMinH);
    minScrapWrap.appendChild(minScrapRow);

    const controls2 = h('div', { class:'rozrys-secondary-grid', style:'margin-top:12px' });

    const heurWrap = h('div', { class:'rozrys-field' });
    heurWrap.appendChild(labelWithInfo('Szybkość liczenia', 'Szybkość liczenia', 'Turbo = najprostszy shelf. Dokładnie = lżejsze myślenie pasowe. MAX = Twój algorytm 1–7 bez otwierania nowej płyty przed domknięciem poprzedniej.'));
    const heurSel = h('select', { id:'rozHeur', hidden:'hidden' });
    heurSel.innerHTML = `
      <option value="turbo">Turbo</option>
      <option value="dokladnie">Dokładnie</option>
      <option value="max" selected>MAX</option>
    `;
    const heurBtn = createChoiceLauncher(getSelectOptionLabel(heurSel), '');
    heurBtn.classList.add('rozrys-choice-launch--compact');
    heurBtn.addEventListener('click', async ()=>{
      const picked = await openRozrysChoiceOverlay({
        title:'Szybkość liczenia',
        value: heurSel.value,
        options:[
          { value:'turbo', label:'Turbo', description:'Najszybszy wariant. Najprostsze liczenie pasowe.' },
          { value:'dokladnie', label:'Dokładnie', description:'Lżejsze myślenie pasowe z lepszym dopasowaniem niż Turbo.' },
          { value:'max', label:'MAX', description:'Najmocniejsze liczenie Twoim algorytmem 1–7 bez otwierania nowej płyty przed domknięciem poprzedniej.' }
        ]
      });
      if(picked == null || picked === heurSel.value) return;
      heurSel.value = picked;
      setChoiceLaunchValue(heurBtn, getSelectOptionLabel(heurSel), '');
      heurSel.dispatchEvent(new Event('change', { bubbles:true }));
    });
    heurWrap.appendChild(heurBtn);
    heurWrap.appendChild(heurSel);
    controls2.appendChild(heurWrap);

    const dirWrap = h('div', { class:'rozrys-field' });
    dirWrap.appendChild(labelWithInfo('Kierunek cięcia', 'Kierunek startu', 'Pierwsze pasy wzdłuż / w poprzek wymuszają start. Opti-max wybiera lepszy start dla każdej płyty osobno.'));
    const dirSel = h('select', { id:'rozDir', hidden:'hidden' });
    dirSel.innerHTML = `
      <option value="start-along">Pierwsze pasy wzdłuż</option>
      <option value="start-across">Pierwsze pasy w poprzek</option>
      <option value="start-optimax" selected>Opti-max</option>
    `;
    const dirBtn = createChoiceLauncher(getSelectOptionLabel(dirSel), '');
    dirBtn.classList.add('rozrys-choice-launch--compact');
    dirBtn.addEventListener('click', async ()=>{
      const picked = await openRozrysChoiceOverlay({
        title:'Kierunek cięcia',
        value: dirSel.value,
        options:[
          { value:'start-along', label:'Pierwsze pasy wzdłuż', description:'Wymusza start od pasów wzdłuż struktury / długości arkusza.' },
          { value:'start-across', label:'Pierwsze pasy w poprzek', description:'Wymusza start od pasów w poprzek struktury / szerokości arkusza.' },
          { value:'start-optimax', label:'Opti-max', description:'Dla każdej płyty wybiera korzystniejszy kierunek startu.' }
        ]
      });
      if(picked == null || picked === dirSel.value) return;
      dirSel.value = picked;
      setChoiceLaunchValue(dirBtn, getSelectOptionLabel(dirSel), '');
      dirSel.dispatchEvent(new Event('change', { bubbles:true }));
    });
    dirWrap.appendChild(dirBtn);
    dirWrap.appendChild(dirSel);
    controls2.appendChild(dirWrap);

    card.appendChild(controls);
    card.appendChild(controls2);

    // action buttons
    const actionRow = h('div', { class:'rozrys-actions-row' });
    const genBtn = h('button', { class:'btn-generate-green rozrys-action-btn rozrys-action-btn--generate', type:'button' });
    genBtn.textContent = 'Generuj rozkrój';
    actionRow.appendChild(openOptionsBtnInline);
    actionRow.appendChild(addStockBtn);
    actionRow.appendChild(genBtn);
    card.appendChild(actionRow);

    const statusBox = h('div', { class:'rozrys-status', style:'display:none;margin-top:12px' });
    const statusTop = h('div', { class:'rozrys-status-top' });
    const statusSpinner = h('div', { class:'rozrys-spinner' });
    const statusCopy = h('div', { class:'rozrys-status-copy' });
    const statusMain = h('div', { class:'rozrys-status-main', text:'Liczę…' });
    const statusSub = h('div', { class:'muted xs rozrys-status-sub', text:'' });
    const statusProg = h('div', { class:'rozrys-progress is-indeterminate' });
    const statusProgBar = h('div', { class:'rozrys-progress-bar' });
    const statusMeta = h('div', { class:'muted xs rozrys-progress-meta', text:'' });
    statusProg.appendChild(statusProgBar);
    statusCopy.appendChild(statusMain);
    statusCopy.appendChild(statusSub);
    statusCopy.appendChild(statusProg);
    statusCopy.appendChild(statusMeta);
    statusTop.appendChild(statusSpinner);
    statusTop.appendChild(statusCopy);
    statusBox.appendChild(statusTop);
    card.appendChild(statusBox);


    // output
    const out = h('div', { style:'margin-top:12px' });
    card.appendChild(out);

    root.appendChild(card);


    function applyHintFromMagazyn(material, opts){
      // Format bazowy pozostaje pod kontrolą użytkownika w ustawieniach.
      // Stan magazynu nie może już nadpisywać głównego formatu rozrysu.
      void material;
      void opts;
    }

    const planHelpers = (FC.rozrysPlanHelpers && typeof FC.rozrysPlanHelpers.createApi === 'function')
      ? FC.rozrysPlanHelpers.createApi({
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
      })
      : {
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
      };
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

    const selectionCtrl = selectionBridge.createController({
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
      getRooms,
      savePanelPrefs,
      loadPanelPrefs,
      encodeRoomsSelection,
      encodeMaterialScope,
      normalizeMaterialScopeForAggregate,
      aggregatePartsForProject,
      askRozrysConfirm,
      normalizeRoomSelection,
      roomLabel,
      splitMaterialAccordionTitle: (...args)=> splitMaterialAccordionTitle(...args),
      makeMaterialScope,
    });

    const updateRoomsPickerButton = ()=> selectionCtrl.updateRoomsPickerButton();
    const updateMaterialPickerButton = ()=> selectionCtrl.updateMaterialPickerButton();
    const persistSelectionPrefs = ()=> selectionCtrl.persistSelectionPrefs();
    const syncHiddenSelections = ()=> selectionCtrl.syncHiddenSelections();
    const refreshSelectionState = (opts)=> selectionCtrl.refreshSelectionState(opts);
    const buildScopeDraftControls = (holder, draftScope, hasFronts, hasCorpus, opts)=> selectionCtrl.buildScopeDraftControls(holder, draftScope, hasFronts, hasCorpus, opts);
    const openRoomsPicker = ()=> selectionCtrl.openRoomsPicker();
    const openMaterialPicker = ()=> selectionCtrl.openMaterialPicker();

    updateRoomsPickerButton();
    updateMaterialPickerButton();
    syncHiddenSelections();
    roomsPickerBtn.addEventListener('click', openRoomsPicker);
    matPickerBtn.addEventListener('click', openMaterialPicker);

    const optionsStateCtrl = optionsStateBridge.createController({
      controls:{ unitSel, edgeSel, inW, inH, inK, inTrim, inMinW, inMinH, heurSel, dirSel, kerfWrap, trimWrap, minScrapWrap },
      state,
      selectedRooms: ()=> selectedRooms,
      materialScope: ()=> materialScope,
      rozState,
    }, {
      savePanelPrefs,
      loadPanelPrefs,
      encodeRoomsSelection,
      encodeMaterialScope,
      normalizeCutDirection,
    });

    const persistOptionPrefs = ()=> optionsStateCtrl.persistOptionPrefs();
    const applyUnitChange = (next)=> optionsStateCtrl.applyUnitChange(next);
    const getBaseState = ()=> optionsStateCtrl.getBaseState();

    function openOptionsModal(){
      return uiBridge.openOptionsModal({
        unitSel,
        edgeSel,
        inW,
        inH,
        inK,
        inTrim,
        inMinW,
        inMinH,
      }, {
        h,
        labelWithInfo,
        createChoiceLauncher,
        getSelectOptionLabel,
        setChoiceLaunchValue,
        openRozrysChoiceOverlay,
        askRozrysConfirm,
        parseLocaleNumber,
        getDefaultRozrysOptionValues,
        applyUnitChange,
        persistOptionPrefs,
        tryAutoRenderFromCache,
      });
    }

    let tryAutoRenderFromCache = ()=> false;
    let buildEntriesForScope = ()=> [];
    let splitMaterialAccordionTitle = (material)=> ({ line1:String(material || 'Materiał'), line2:'' });
    let createMaterialAccordionSection = ()=> ({ wrap:h('div'), body:h('div'), trigger:null, setOpenState:()=>{} });
    let renderMaterialAccordionPlans = ()=> false;
    let renderOutput = ()=> undefined;
    let renderLoadingInto = ()=> null;
    let renderLoading = (text)=> renderLoadingInto(null, text);

    const outputCtrl = outputBridge.createController({
      out,
      h,
      isRozrysRunning: ()=> isRozrysRunning(),
      normalizeMaterialScopeForAggregate,
      decodeMaterialScope,
      matSelValue: matSel.value,
      agg,
      setGenBtnMode: (mode)=> setGenBtnMode(mode),
      loadPlanCache,
      getBaseState,
      toMmByUnit,
      getRealHalfStockForMaterial,
      getExactSheetStockForMaterial,
      getLargestSheetFormatForMaterial,
      materialHasGrain,
      getMaterialGrainEnabled,
      getMaterialGrainExceptions,
      partSignature,
      buildStockSignatureForMaterial,
      makePlanCacheKey,
      getAccordionScopeKey,
      getRozrysScopeMode,
      setCacheState: (patch)=>{ try{ if(rozState) rozState.setCacheState(patch); }catch(_){ } },
      aggregatePartsForProject,
      getOrderedMaterialsForSelection,
      getGroupPartsForScope,
      scheduleSheetCanvasRefresh,
      getAccordionPref,
      setAccordionPref,
      setMaterialGrainEnabled,
      openMaterialGrainExceptions,
      formatHeurLabel,
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
      tryAutoRenderFromCache: (...args)=> tryAutoRenderFromCache(...args),
      renderOutput: (...args)=> renderOutput(...args),
    });

    tryAutoRenderFromCache = outputCtrl.tryAutoRenderFromCache;
    buildEntriesForScope = outputCtrl.buildEntriesForScope;
    splitMaterialAccordionTitle = outputCtrl.splitMaterialAccordionTitle;
    createMaterialAccordionSection = outputCtrl.createMaterialAccordionSection;
    renderMaterialAccordionPlans = outputCtrl.renderMaterialAccordionPlans;
    renderOutput = outputCtrl.renderOutput;
    renderLoadingInto = outputCtrl.renderLoadingInto;
    renderLoading = outputCtrl.renderLoading;


    const progressApi = uiBridge.createProgressApi({
      statusBox,
      statusMain,
      statusSub,
      statusMeta,
      statusProg,
      statusProgBar,
      genBtn,
      setUiState: (patch)=>{ try{ if(rozState) rozState.setUiState(patch); }catch(_){ } },
    });
    const progressCtrl = progressApi.controller;

    function setGenBtnMode(mode){
      return progressApi.setGenBtnMode(mode);
    }

    function requestCancel(){
      return progressApi.requestCancel();
    }

    function isRozrysRunning(){
      return progressApi.isRozrysRunning();
    }

    function getRozrysBtnMode(){
      return progressApi.getRozrysBtnMode();
    }

    async function generate(force){
      if(!(FC.rozrysRunner && typeof FC.rozrysRunner.generate === 'function')) return;
      return FC.rozrysRunner.generate(force, {
        progressCtrl,
        normalizeMaterialScopeForAggregate,
        decodeMaterialScope,
        matSelValue: matSel.value,
        agg,
        unitValue: unitSel.value,
        edgeValue: edgeSel.value,
        boardWValue: inW.value,
        boardHValue: inH.value,
        kerfValue: inK.value,
        trimValue: inTrim.value,
        minScrapWValue: inMinW.value,
        minScrapHValue: inMinH.value,
        heurValue: heurSel.value,
        directionValue: dirSel.value,
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
        out,
        buildEntriesForScope,
        getAccordionScopeKey,
        getAccordionPref,
        createMaterialAccordionSection,
        setAccordionPref,
        setMaterialGrainEnabled,
        tryAutoRenderFromCache,
        openMaterialGrainExceptions,
      });
    }

// events
    unitSel.addEventListener('change', ()=>{
      applyUnitChange(unitSel.value);
      persistOptionPrefs();
      tryAutoRenderFromCache();
    });

    matSel.addEventListener('change', ()=>{
      materialScope = normalizeMaterialScopeForAggregate(decodeMaterialScope(matSel.value), agg);
      try{ if(rozState) rozState.setMaterialScope(materialScope); }catch(_){ }
      syncHiddenSelections();
      updateMaterialPickerButton();
      persistSelectionPrefs();
      tryAutoRenderFromCache();
    });
    heurSel.addEventListener('change', ()=>{
      tryAutoRenderFromCache();
    });
    dirSel.addEventListener('change', ()=>{
      tryAutoRenderFromCache();
    });
    openOptionsBtnInline.addEventListener('click', openOptionsModal);
    inMinW.addEventListener('change', ()=>{ persistOptionPrefs(); tryAutoRenderFromCache(); });
    inMinH.addEventListener('change', ()=>{ persistOptionPrefs(); tryAutoRenderFromCache(); });

    edgeSel.addEventListener('change', ()=>{
      persistOptionPrefs();
      tryAutoRenderFromCache();
    });

    function openAddStockModal(){
      return uiBridge.openAddStockModal({
        agg,
        matSelValue: matSel.value,
        unitValue: unitSel.value,
        boardWValue: inW.value,
        boardHValue: inH.value,
      }, {
        normalizeMaterialScopeForAggregate,
        decodeMaterialScope,
        splitMaterialAccordionTitle,
        parseLocaleNumber,
        openRozrysInfo,
        askRozrysConfirm,
        createChoiceLauncher,
        getSelectOptionLabel,
        setChoiceLaunchValue,
        openRozrysChoiceOverlay,
      });
    }

    addStockBtn.addEventListener('click', openAddStockModal);

    genBtn.addEventListener('click', ()=>{
      if(isRozrysRunning()){
        requestCancel();
        return;
      }
      // "Generuj ponownie" must bypass cache and recompute.
      const force = (getRozrysBtnMode() === 'done');
      generate(force);
    });

    // auto preview from cache when user tweaks parameters
    [inW, inH].forEach(el=>{
      el.addEventListener('input', ()=>{
        tryAutoRenderFromCache();
      });
      el.addEventListener('change', ()=>{
        tryAutoRenderFromCache();
      });
    });
    [inK, inTrim].forEach(el=>{
      el.addEventListener('input', ()=>{
        persistOptionPrefs();
        tryAutoRenderFromCache();
      });
      el.addEventListener('change', ()=>{
        persistOptionPrefs();
        tryAutoRenderFromCache();
      });
    });

    // initial
    persistOptionPrefs();
    tryAutoRenderFromCache();
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