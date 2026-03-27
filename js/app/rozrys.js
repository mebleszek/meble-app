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

  const OVERRIDE_KEY = 'fc_rozrys_overrides_v1';
  const EDGE_KEY = 'fc_edge_v1';
  const PANEL_PREFS_KEY = 'fc_rozrys_panel_prefs_v1';
  const ACCORDION_PREFS_KEY = 'fc_rozrys_material_accordion_v1';

  function safeGetProject(){
    try{
      if(typeof projectData !== 'undefined' && projectData) return projectData;
      return (window.projectData || null);
    }catch(_){
      return null;
    }
  }

  function getRooms(){
    try{
      if(FC.schema && Array.isArray(FC.schema.ROOMS)) return FC.schema.ROOMS;
    }catch(_){ }
    return ['kuchnia','szafa','pokoj','lazienka'];
  }

  function parseLocaleNumber(v){
    if(v === null || v === undefined) return NaN;
    if(typeof v === 'number') return Number.isFinite(v) ? v : NaN;
    const s = String(v).trim().replace(',', '.');
    if(!s) return NaN;
    return Number(s);
  }

  function cmToMm(v){
    // obsługa 0.1cm -> 1mm
    const n = parseLocaleNumber(v);
    if(!Number.isFinite(n)) return 0;
    return Math.round(n * 10);
  }

  function mmToStr(mm){
    const n = Math.round(Number(mm)||0);
    return String(n);
  }

  // Display length stored in millimeters in the selected unit.
  // - mm: integer
  // - cm: one decimal when needed, without trailing .0
  function mmToUnitStr(mm, unit){
    const u = (unit === 'cm') ? 'cm' : 'mm';
    const n = Math.round(Number(mm)||0);
    if(u === 'mm') return String(n);
    const cm = n / 10;
    const s = (Math.round(cm * 10) / 10).toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  }

  function loadOverrides(){
    try{
      const raw = localStorage.getItem(OVERRIDE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object') ? obj : {};
    }catch(_){
      return {};
    }
  }

  function saveOverrides(obj){
    try{ localStorage.setItem(OVERRIDE_KEY, JSON.stringify(obj || {})); }catch(_){ }
  }

  function loadPanelPrefs(){
    try{
      const raw = localStorage.getItem(PANEL_PREFS_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object') ? obj : {};
    }catch(_){
      return {};
    }
  }

  function savePanelPrefs(obj){
    try{ localStorage.setItem(PANEL_PREFS_KEY, JSON.stringify(obj || {})); }catch(_){ }
  }


  function loadAccordionPrefs(){
    try{
      const raw = localStorage.getItem(ACCORDION_PREFS_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object') ? obj : {};
    }catch(_){
      return {};
    }
  }

  function saveAccordionPrefs(obj){
    try{ localStorage.setItem(ACCORDION_PREFS_KEY, JSON.stringify(obj || {})); }catch(_){ }
  }

  function getAccordionPref(scopeKey){
    try{
      const prefs = loadAccordionPrefs();
      const entry = prefs && typeof prefs === 'object' ? prefs[String(scopeKey || '')] : null;
      return (entry && typeof entry === 'object') ? entry : { material:'', open:false };
    }catch(_){
      return { material:'', open:false };
    }
  }

  function setAccordionPref(scopeKey, material, open){
    try{
      const prefs = loadAccordionPrefs();
      prefs[String(scopeKey || '')] = { material: String(material || ''), open: !!open };
      saveAccordionPrefs(prefs);
    }catch(_){ }
  }

  function getGrainStore(){
    return (FC && FC.rozrysGrain) || null;
  }

  function getMaterialGrainEnabled(material, hasGrain){
    try{
      const store = getGrainStore();
      if(store && typeof store.getMaterialEnabled === 'function') return !!store.getMaterialEnabled(material, hasGrain);
    }catch(_){ }
    return !!hasGrain;
  }

  function setMaterialGrainEnabled(material, enabled, hasGrain){
    try{
      const store = getGrainStore();
      if(store && typeof store.setMaterialEnabled === 'function') store.setMaterialEnabled(material, enabled, hasGrain);
    }catch(_){ }
  }

  function getMaterialGrainExceptions(material, allowedKeys, hasGrain){
    try{
      const store = getGrainStore();
      if(!store) return {};
      if(typeof store.pruneMaterialExceptions === 'function' && Array.isArray(allowedKeys)) return store.pruneMaterialExceptions(material, allowedKeys, hasGrain);
      if(typeof store.getMaterialExceptions === 'function') return store.getMaterialExceptions(material) || {};
    }catch(_){ }
    return {};
  }

  function setMaterialGrainExceptions(material, exceptions, hasGrain){
    try{
      const store = getGrainStore();
      if(store && typeof store.setMaterialExceptions === 'function') store.setMaterialExceptions(material, exceptions, hasGrain);
    }catch(_){ }
  }

  function getPartOptionsStore(){
    return (FC && FC.materialPartOptions) || null;
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

  function loadEdgeStore(){
    try{
      const raw = localStorage.getItem(EDGE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object') ? obj : {};
    }catch(_){
      return {};
    }
  }

  function partSignature(p){
    if(p && p.sourceSig){
      return `${p.sourceSig}||${String(p.grainMode || p.direction || 'default')}||${p.w}x${p.h}`;
    }
    return `${p.material||''}||${p.name||''}||${p.w}x${p.h}`;
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


  function buildResolvedSnapshotFromParts(parts){
    const rv = FC.rozrysValidation;
    if(!(rv && typeof rv.rowsFromParts === 'function')) return [];
    return rv.rowsFromParts((parts || []).map((p)=>({
      key: partSignature({ material: p.material, name: p.name, w: p.w, h: p.h, sourceSig: p.sourceSig, grainMode: p.grainMode || p.direction }),
      material: p.material,
      name: p.name,
      w: p.w,
      h: p.h,
      qty: p.qty,
    })));
  }

  function buildRawSnapshotForMaterial(targetMaterial, mode, selectedRooms){
    const proj = safeGetProject();
    if(!proj || !targetMaterial) return [];
    const rows = [];
    const rooms = normalizeRoomSelection(Array.isArray(selectedRooms) ? selectedRooms : getRooms());
    const scopeMode = (mode === 'fronts' || mode === 'corpus' || mode === 'both') ? mode : 'both';
    for(const room of rooms){
      const cabinets = (proj[room] && Array.isArray(proj[room].cabinets)) ? proj[room].cabinets : [];
      for(const cab of cabinets){
        if(typeof getCabinetCutList !== 'function') continue;
        const parts = getCabinetCutList(cab, room) || [];
        for(const p of parts){
          const sourceMaterial = String(p.material || '').trim();
          if(!sourceMaterial) continue;
          const isFront = (String(p.name || '').trim() === 'Front') || isFrontMaterialKey(sourceMaterial);
          if(scopeMode === 'fronts' && !isFront) continue;
          if(scopeMode === 'corpus' && isFront) continue;
          const resolved = resolveRozrysPartFromSource(p);
          const materialKey = resolved.materialKey;
          if(materialKey !== targetMaterial) continue;
          const w = resolved.w;
          const h = resolved.h;
          const qty = resolved.qty;
          if(!(w > 0 && h > 0 && qty > 0)) continue;
          rows.push({
            key: partSignature({ material: materialKey, name: resolved.name, w, h, sourceSig: resolved.sourceSig, grainMode: resolved.direction }),
            material: materialKey,
            name: resolved.name,
            sourceSig: resolved.sourceSig,
            grainMode: resolved.direction,
            ignoreGrain: !!resolved.ignoreGrain,
            w,
            h,
            qty,
            room,
            source: String((cab && (cab.name || cab.label || cab.type || cab.kind)) || 'Szafka'),
            sourceRows: 1,
          });
        }
      }
    }
    return rows;
  }

  function buildRozrysDiagnostics(targetMaterial, mode, parts, plan, selectedRooms){
    if(FC.rozrysSummary && typeof FC.rozrysSummary.buildRozrysDiagnostics === 'function'){
      return FC.rozrysSummary.buildRozrysDiagnostics(targetMaterial, mode, parts, plan, selectedRooms, {
        buildRawSnapshotForMaterial,
        buildResolvedSnapshotFromParts,
      });
    }
    return null;
  }

  function validationSummaryLabel(diag){
    if(FC.rozrysSummary && typeof FC.rozrysSummary.validationSummaryLabel === 'function') return FC.rozrysSummary.validationSummaryLabel(diag);
    return { text:'Walidacja: brak danych', tone:'is-warn' };
  }

  function openValidationListModal(material, diag, unit){
    if(FC.rozrysSummary && typeof FC.rozrysSummary.openValidationListModal === 'function'){
      return FC.rozrysSummary.openValidationListModal(material, diag, unit, { mmToUnitStr });
    }
  }

  function openSheetListModal(material, sheetTitle, rows, unit){
    if(FC.rozrysSummary && typeof FC.rozrysSummary.openSheetListModal === 'function'){
      return FC.rozrysSummary.openSheetListModal(material, sheetTitle, rows, unit, { mmToUnitStr });
    }
  }


function aggregatePartsForProject(selectedRooms){
  if(FC.rozrysScope && typeof FC.rozrysScope.aggregatePartsForProject === 'function'){
    return FC.rozrysScope.aggregatePartsForProject(selectedRooms, {
      safeGetProject,
      getRooms,
      getCabinetCutList: (typeof getCabinetCutList === 'function') ? getCabinetCutList : null,
      resolveRozrysPartFromSource,
      isFrontMaterialKey,
    });
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

  function h(tag, attrs, children){
    const el = document.createElement(tag);
    if(attrs){
      for(const k in attrs){
        if(k==='class') el.className = attrs[k];
        else if(k==='html') el.innerHTML = attrs[k];
        else if(k==='text') el.textContent = attrs[k];
        else el.setAttribute(k, attrs[k]);
      }
    }
    (children||[]).forEach(ch=> el.appendChild(ch));
    return el;
  }

  function labelWithInfo(title, infoTitle, infoMessage){
    const row = h('div', { class:'label-help' });
    row.appendChild(h('span', { class:'label-help__text', text:title }));
    if(infoMessage){
      const btn = h('button', { type:'button', class:'info-trigger', 'aria-label':`Pokaż informację: ${title}` });
      btn.addEventListener('click', ()=>{
        try{
          if(window.FC && window.FC.infoBox && typeof window.FC.infoBox.open === 'function'){
            window.FC.infoBox.open({ title: infoTitle || title, message: infoMessage });
          }
        }catch(_){ }
      });
      row.appendChild(btn);
    }
    return row;
  }

  function openRozrysInfo(title, message){
    const boxTitle = String(title || 'Informacja');
    const boxMessage = String(message || '');
    if(FC.infoBox && typeof FC.infoBox.open === 'function'){
      FC.infoBox.open({ title: boxTitle, message: boxMessage });
      return;
    }
    if(FC.panelBox && typeof FC.panelBox.open === 'function'){
      FC.panelBox.open({ title: boxTitle, message: boxMessage, width:'560px' });
      return;
    }
    console.warn('[ROZRYS]', boxTitle, boxMessage);
  }

  function getSelectOptionLabel(selectEl){
    return FC.rozrysChoice && typeof FC.rozrysChoice.getSelectOptionLabel === 'function'
      ? FC.rozrysChoice.getSelectOptionLabel(selectEl)
      : '';
  }

  function setChoiceLaunchValue(btn, label, meta){
    if(FC.rozrysChoice && typeof FC.rozrysChoice.setChoiceLaunchValue === 'function'){
      FC.rozrysChoice.setChoiceLaunchValue(btn, label, meta);
      return;
    }
  }

  function createChoiceLauncher(label, meta){
    if(FC.rozrysChoice && typeof FC.rozrysChoice.createChoiceLauncher === 'function'){
      return FC.rozrysChoice.createChoiceLauncher(label, meta);
    }
    return h('button', { type:'button', class:'rozrys-choice-launch', text:String(label || '') });
  }

  function openRozrysChoiceOverlay(opts){
    if(FC.rozrysChoice && typeof FC.rozrysChoice.openRozrysChoiceOverlay === 'function'){
      return FC.rozrysChoice.openRozrysChoiceOverlay(opts);
    }
    return Promise.resolve(null);
  }

  function askRozrysConfirm(opts){
    const cfg = Object.assign({
      title:'POTWIERDZENIE',
      message:'Czy kontynuować?',
      confirmText:'✓ TAK',
      cancelText:'WRÓĆ',
      confirmTone:'success',
      cancelTone:'neutral'
    }, opts || {});
    if(FC.confirmBox && typeof FC.confirmBox.ask === 'function'){
      return FC.confirmBox.ask(cfg);
    }
    return new Promise((resolve)=>{
      if(!(FC.panelBox && typeof FC.panelBox.open === 'function')){
        resolve(false);
        return;
      }
      const body = h('div');
      body.appendChild(h('div', { class:'muted', style:'white-space:pre-wrap;line-height:1.5', text:String(cfg.message || '') }));
      const actions = h('div', { style:'display:flex;justify-content:flex-end;gap:10px;margin-top:18px;flex-wrap:wrap' });
      const cancelBtn = h('button', { type:'button', class: cfg.cancelTone === 'danger' ? 'btn-danger' : 'btn-primary', text:String(cfg.cancelText || 'WRÓĆ') });
      const confirmBtn = h('button', { type:'button', class: cfg.confirmTone === 'danger' ? 'btn-danger' : 'btn-success', text:String(cfg.confirmText || '✓ TAK') });
      const done = (result)=>{
        try{ FC.panelBox.close(); }catch(_){ }
        resolve(!!result);
      };
      cancelBtn.addEventListener('click', ()=> done(false));
      confirmBtn.addEventListener('click', ()=> done(true));
      actions.appendChild(cancelBtn);
      actions.appendChild(confirmBtn);
      body.appendChild(actions);
      FC.panelBox.open({ title:String(cfg.title || 'POTWIERDZENIE'), contentNode: body, width:'560px', dismissOnOverlay:false, dismissOnEsc:true });
    });
  }

  function scheduleSheetCanvasRefresh(scope){
    if(FC.rozrysSheetDraw && typeof FC.rozrysSheetDraw.scheduleSheetCanvasRefresh === 'function'){
      return FC.rozrysSheetDraw.scheduleSheetCanvasRefresh(scope, { drawSheet });
    }
  }

  // edgeSubMm: 0 => show nominal dimensions, >0 => show "do cięcia" dims (kompensacja okleiny)
  // Zasada kompensacji (zgodnie z ustaleniem):
  // - okleina na krawędziach W (top/bottom) zwiększa wymiar H => odejmujemy od H
  // - okleina na krawędziach H (left/right) zwiększa wymiar W => odejmujemy od W
  function drawSheet(canvas, sheet, displayUnit, edgeSubMm, boardMeta){
    if(FC.rozrysSheetDraw && typeof FC.rozrysSheetDraw.drawSheet === 'function'){
      return FC.rozrysSheetDraw.drawSheet(canvas, sheet, displayUnit, edgeSubMm, boardMeta, { mmToUnitStr });
    }
  }

  function buildCsv(sheets, meta){
    if(FC.rozrysPrint && typeof FC.rozrysPrint.buildCsv === 'function'){
      return FC.rozrysPrint.buildCsv(sheets, meta);
    }
    return '';
  }

  function downloadText(filename, content, mime){
    if(FC.rozrysPrint && typeof FC.rozrysPrint.downloadText === 'function'){
      return FC.rozrysPrint.downloadText(filename, content, mime, { openInfo: openRozrysInfo });
    }
  }

  function openPrintView(html){
    if(FC.rozrysPrint && typeof FC.rozrysPrint.openPrintView === 'function'){
      return FC.rozrysPrint.openPrintView(html, { openInfo: openRozrysInfo });
    }
  }

  function pxToMm(px){
    if(FC.rozrysPrint && typeof FC.rozrysPrint.pxToMm === 'function'){
      return FC.rozrysPrint.pxToMm(px);
    }
    const n = Number(px);
    return Number.isFinite(n) ? n * 25.4 / 96 : 0;
  }

  function measurePrintHeaderMm(titleText, metaText){
    if(FC.rozrysPrint && typeof FC.rozrysPrint.measurePrintHeaderMm === 'function'){
      return FC.rozrysPrint.measurePrintHeaderMm(titleText, metaText);
    }
    return 14;
  }


function computePlan(state, parts){
  if(FC.rozrysEngine && typeof FC.rozrysEngine.computePlan === 'function'){
    return FC.rozrysEngine.computePlan(state, parts, {
      loadEdgeStore,
      partSignature,
      isPartRotationAllowed,
      cutOptimizer: FC.cutOptimizer,
    });
  }
  return { sheets: [], note: 'Brak modułu rozrysEngine.' };
}

function getOptimaxProfilePreset(profile, direction){
  if(FC.rozrysEngine && typeof FC.rozrysEngine.getOptimaxProfilePreset === 'function'){
    return FC.rozrysEngine.getOptimaxProfilePreset(profile, direction);
  }
  return {};
}

function normalizeCutDirection(dir){
  if(FC.rozrysEngine && typeof FC.rozrysEngine.normalizeCutDirection === 'function'){
    return FC.rozrysEngine.normalizeCutDirection(dir);
  }
  return 'start-along';
}

function speedLabel(mode){
  if(FC.rozrysEngine && typeof FC.rozrysEngine.speedLabel === 'function') return FC.rozrysEngine.speedLabel(mode);
  return String(mode || '');
}

function directionLabel(dir){
  if(FC.rozrysEngine && typeof FC.rozrysEngine.directionLabel === 'function') return FC.rozrysEngine.directionLabel(dir);
  return String(dir || '');
}

function formatHeurLabel(st){
  if(FC.rozrysEngine && typeof FC.rozrysEngine.formatHeurLabel === 'function') return FC.rozrysEngine.formatHeurLabel(st);
  return String((st && st.heur) || '');
}

function computePlanPanelProAsync(state, parts, onProgress, control, panelOpts){
  if(FC.rozrysEngine && typeof FC.rozrysEngine.computePlanPanelProAsync === 'function'){
    return FC.rozrysEngine.computePlanPanelProAsync(state, parts, onProgress, control, panelOpts, {
      loadEdgeStore,
      partSignature,
      isPartRotationAllowed,
      cutOptimizer: FC.cutOptimizer,
    });
  }
  return Promise.resolve({ sheets: [], note: 'Brak modułu rozrysEngine.' });
}


  function render(){
    const root = document.getElementById('rozrysRoot');
    if(!root) return;

    root.innerHTML = '';

    const card = h('div', { class:'card' });
    const panelPrefs = loadPanelPrefs();
    let selectedRooms = decodeRoomsSelection(panelPrefs.selectedRooms);
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
      edgeTrim: Number.isFinite(Number(panelPrefs.edgeTrim)) ? Math.max(0, Number(panelPrefs.edgeTrim)) : (initialUnit === 'cm' ? 2 : 20),
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
    const heurBtn = createChoiceLauncher(getSelectOptionLabel(heurSel), 'Kliknij, aby wybrać');
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
      setChoiceLaunchValue(heurBtn, getSelectOptionLabel(heurSel), 'Kliknij, aby zmienić');
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
    const dirBtn = createChoiceLauncher(getSelectOptionLabel(dirSel), 'Kliknij, aby wybrać');
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
      setChoiceLaunchValue(dirBtn, getSelectOptionLabel(dirSel), 'Kliknij, aby zmienić');
      dirSel.dispatchEvent(new Event('change', { bubbles:true }));
    });
    dirWrap.appendChild(dirBtn);
    dirWrap.appendChild(dirSel);
    controls2.appendChild(dirWrap);

    card.appendChild(controls);
    card.appendChild(controls2);
    function persistOptionPrefs(){
      savePanelPrefs(Object.assign({}, loadPanelPrefs(), {
        selectedRooms: encodeRoomsSelection(selectedRooms),
        materialScope: encodeMaterialScope(materialScope),
        unit: unitSel.value,
        boardW: Math.max(1, Number(inW.value) || (unitSel.value === 'mm' ? 2800 : 280)),
        boardH: Math.max(1, Number(inH.value) || (unitSel.value === 'mm' ? 2070 : 207)),
        edgeSubMm: Math.max(0, Number(edgeSel.value)||0),
        kerf: Math.max(0, Number(inK.value)||0),
        edgeTrim: Math.max(0, Number(inTrim.value)||0),
        minScrapW: Math.max(0, Number(inMinW.value)||0),
        minScrapH: Math.max(0, Number(inMinH.value)||0),
      }));
    }

    function applyUnitChange(next){
      const prev = state.unit;
      if(prev === next) return;
      const factor = (prev==='cm' && next==='mm') ? 10 : (prev==='mm' && next==='cm') ? 0.1 : 1;
      const conv = (el)=>{
        const n = Number(el.value);
        if(!Number.isFinite(n)) return;
        const v = n * factor;
        el.value = (next==='cm') ? String(Math.round(v*10)/10) : String(Math.round(v));
      };
      conv(inW); conv(inH); conv(inK); conv(inTrim); conv(inMinW); conv(inMinH);
      state.unit = next;
      unitSel.value = next;
      kerfWrap.querySelector('label').textContent = `Rzaz piły (${next})`;
      trimWrap.querySelector('label').textContent = `Obrównanie krawędzi — arkusz standardowy (${next})`;
      minScrapWrap.querySelector('label').textContent = `Najmniejszy użyteczny odpad (${next})`;
    }

    function openOptionsModal(){
      if(!(FC.panelBox && typeof FC.panelBox.open === 'function')) return;
      const body = h('div');
      const form = h('div', { class:'grid-2', style:'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px' });

      function appendModalInfoLabel(wrap, title, infoTitle, infoMessage){
        const row = labelWithInfo(title, infoTitle || title, infoMessage || '');
        wrap.appendChild(row);
        return row.querySelector('.label-help__text') || row.querySelector('span');
      }

      const modalUnitWrap = h('div');
      appendModalInfoLabel(modalUnitWrap, 'Jednostki', 'Jednostki', 'Określa jednostki wyświetlane w polach opcji rozkroju.');
      const modalUnitSel = h('select', { hidden:'hidden' });
      modalUnitSel.innerHTML = `
        <option value="cm" ${unitSel.value==='cm'?'selected':''}>cm</option>
        <option value="mm" ${unitSel.value==='mm'?'selected':''}>mm</option>
      `;
      const modalUnitBtn = createChoiceLauncher(getSelectOptionLabel(modalUnitSel), 'Kliknij, aby wybrać');
      modalUnitWrap.appendChild(modalUnitBtn);
      modalUnitWrap.appendChild(modalUnitSel);
      form.appendChild(modalUnitWrap);

      const modalEdgeWrap = h('div');
      appendModalInfoLabel(modalEdgeWrap, 'Wymiary do cięcia', 'Wymiary do cięcia', 'Decyduje, czy rozrys liczy wymiar nominalny czy po odjęciu okleiny.');
      const modalEdgeSel = h('select', { hidden:'hidden' });
      modalEdgeSel.innerHTML = edgeSel.innerHTML;
      modalEdgeSel.value = edgeSel.value;
      const modalEdgeBtn = createChoiceLauncher(getSelectOptionLabel(modalEdgeSel), 'Kliknij, aby wybrać');
      modalEdgeWrap.appendChild(modalEdgeBtn);
      modalEdgeWrap.appendChild(modalEdgeSel);
      form.appendChild(modalEdgeWrap);

      const modalBoardWrap = h('div');
      const modalBoardLabel = appendModalInfoLabel(modalBoardWrap, `Format bazowy arkusza (${unitSel.value})`, 'Format bazowy arkusza', 'To pełny format płyty bazowej, z której dobieram brakujące arkusze.');
      const modalBoardRow = h('div', { style:'display:flex;gap:8px' });
      const modalBoardW = h('input', { type:'number', value:String(inW.value) });
      const modalBoardH = h('input', { type:'number', value:String(inH.value) });
      modalBoardRow.appendChild(modalBoardW);
      modalBoardRow.appendChild(modalBoardH);
      modalBoardWrap.appendChild(modalBoardRow);
      form.appendChild(modalBoardWrap);

      const modalKerfWrap = h('div');
      const modalKerfLabel = appendModalInfoLabel(modalKerfWrap, `Rzaz piły (${unitSel.value})`, 'Rzaz piły', 'Szerokość cięcia odejmowana między elementami i odpadami.');
      const modalKerf = h('input', { type:'number', value:String(inK.value) });
      modalKerfWrap.appendChild(modalKerf);
      form.appendChild(modalKerfWrap);

      const modalTrimWrap = h('div');
      const modalTrimLabel = appendModalInfoLabel(modalTrimWrap, `Obrównanie krawędzi — arkusz standardowy (${unitSel.value})`, 'Obrównanie krawędzi', 'Margines odkładany od pełnej płyty przed liczeniem rozkroju.');
      const modalTrim = h('input', { type:'number', value:String(inTrim.value) });
      modalTrimWrap.appendChild(modalTrim);
      form.appendChild(modalTrimWrap);

      const modalMinWrap = h('div');
      const modalMinLabel = appendModalInfoLabel(modalMinWrap, `Najmniejszy użyteczny odpad (${unitSel.value})`, 'Najmniejszy użyteczny odpad', 'Mniejsze odpady traktuję jako nieużyteczne i nie odkładam ich do magazynu odpadów.');
      const modalMinRow = h('div', { style:'display:flex;gap:8px' });
      const modalMinW = h('input', { type:'number', value:String(inMinW.value) });
      const modalMinH = h('input', { type:'number', value:String(inMinH.value) });
      modalMinRow.appendChild(modalMinW);
      modalMinRow.appendChild(modalMinH);
      modalMinWrap.appendChild(modalMinRow);
      form.appendChild(modalMinWrap);

      body.appendChild(form);

      function syncModalLabels(){
        const u = modalUnitSel.value === 'cm' ? 'cm' : 'mm';
        modalBoardLabel.textContent = `Format bazowy arkusza (${u})`;
        modalKerfLabel.textContent = `Rzaz piły (${u})`;
        modalTrimLabel.textContent = `Obrównanie krawędzi — arkusz standardowy (${u})`;
        modalMinLabel.textContent = `Najmniejszy użyteczny odpad (${u})`;
        setChoiceLaunchValue(modalUnitBtn, getSelectOptionLabel(modalUnitSel), 'Kliknij, aby wybrać');
        setChoiceLaunchValue(modalEdgeBtn, getSelectOptionLabel(modalEdgeSel), 'Kliknij, aby wybrać');
      }
      function convertModalNumericFields(prevUnit, nextUnit){
        if(prevUnit === nextUnit) return;
        const factor = (prevUnit === 'cm' && nextUnit === 'mm') ? 10 : (prevUnit === 'mm' && nextUnit === 'cm') ? 0.1 : 1;
        const conv = (el)=>{
          const n = parseLocaleNumber(el.value);
          if(!Number.isFinite(n)) return;
          const v = n * factor;
          el.value = (nextUnit === 'cm') ? String(Math.round(v * 10) / 10) : String(Math.round(v));
        };
        conv(modalBoardW);
        conv(modalBoardH);
        conv(modalKerf);
        conv(modalTrim);
        conv(modalMinW);
        conv(modalMinH);
      }
      modalUnitSel.addEventListener('change', ()=>{
        const prevUnit = modalUnitSel.dataset.prevUnit || unitSel.value || 'mm';
        const nextUnit = modalUnitSel.value === 'cm' ? 'cm' : 'mm';
        convertModalNumericFields(prevUnit, nextUnit);
        modalUnitSel.dataset.prevUnit = nextUnit;
        syncModalLabels();
        updateDirtyState();
      });
      modalUnitSel.dataset.prevUnit = modalUnitSel.value === 'cm' ? 'cm' : 'mm';

      modalUnitBtn.addEventListener('click', async ()=>{
        const picked = await openRozrysChoiceOverlay({
          title:'Jednostki',
          value: modalUnitSel.value,
          options:[
            { value:'cm', label:'cm', description:'Wartości wyświetlane w centymetrach.' },
            { value:'mm', label:'mm', description:'Wartości wyświetlane w milimetrach.' }
          ]
        });
        if(picked == null || picked === modalUnitSel.value) return;
        modalUnitSel.value = picked;
        modalUnitSel.dispatchEvent(new Event('change', { bubbles:true }));
      });

      modalEdgeBtn.addEventListener('click', async ()=>{
        const picked = await openRozrysChoiceOverlay({
          title:'Wymiary do cięcia',
          value: modalEdgeSel.value,
          options:[
            { value:'0', label:'Nominalne', description:'Rozrys liczy wymiary nominalne bez odjęcia okleiny.' },
            { value:'1', label:'Po odjęciu 1 mm okleiny', description:'Rozrys od razu kompensuje 1 mm okleiny na odpowiednich krawędziach.' },
            { value:'2', label:'Po odjęciu 2 mm okleiny', description:'Rozrys od razu kompensuje 2 mm okleiny na odpowiednich krawędziach.' }
          ]
        });
        if(picked == null || picked === modalEdgeSel.value) return;
        modalEdgeSel.value = picked;
        setChoiceLaunchValue(modalEdgeBtn, getSelectOptionLabel(modalEdgeSel), 'Kliknij, aby wybrać');
        modalEdgeSel.dispatchEvent(new Event('change', { bubbles:true }));
      });

      const footer = h('div', { style:'display:flex;justify-content:space-between;gap:10px;margin-top:14px;flex-wrap:wrap;align-items:center' });
      const resetBtn = h('button', { class:'btn', type:'button', text:'Przywróć domyślne' });
      const actionWrap = h('div', { style:'display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;align-items:center' });
      const exitBtn = h('button', { class:'btn-primary', type:'button', text:'Wyjdź' });
      const cancelBtn = h('button', { class:'btn-danger', type:'button', text:'Anuluj' });
      const saveBtn = h('button', { class:'btn-success', type:'button', text:'Zapisz' });
      footer.appendChild(resetBtn);
      footer.appendChild(actionWrap);
      body.appendChild(footer);

      function closeModal(){
        FC.panelBox.close();
      }

      function normalizeLenToMm(value, unit){
        const n = parseLocaleNumber(value);
        if(!Number.isFinite(n)) return 0;
        return unit === 'cm' ? Math.round(n * 10) : Math.round(n);
      }
      function currentModalSignature(){
        const u = modalUnitSel.value === 'cm' ? 'cm' : 'mm';
        return JSON.stringify({
          unit: u,
          edge: String(modalEdgeSel.value || ''),
          boardWMm: normalizeLenToMm(modalBoardW.value, u),
          boardHMm: normalizeLenToMm(modalBoardH.value, u),
          kerfMm: normalizeLenToMm(modalKerf.value, u),
          trimMm: normalizeLenToMm(modalTrim.value, u),
          minWMm: normalizeLenToMm(modalMinW.value, u),
          minHMm: normalizeLenToMm(modalMinH.value, u),
        });
      }
      const initialSignature = currentModalSignature();
      let isDirty = false;

      function applyDefaultValuesToModal(){
        const defaults = getDefaultRozrysOptionValues('cm');
        modalUnitSel.value = defaults.unit;
        modalUnitSel.dataset.prevUnit = defaults.unit;
        modalEdgeSel.value = defaults.edge;
        modalBoardW.value = String(defaults.boardW);
        modalBoardH.value = String(defaults.boardH);
        modalKerf.value = String(defaults.kerf);
        modalTrim.value = String(defaults.trim);
        modalMinW.value = String(defaults.minW);
        modalMinH.value = String(defaults.minH);
        syncModalLabels();
      }

      function renderFooterActions(){
        actionWrap.innerHTML = '';
        if(isDirty){
          actionWrap.appendChild(cancelBtn);
          actionWrap.appendChild(saveBtn);
        }else{
          actionWrap.appendChild(exitBtn);
        }
      }

      function updateDirtyState(){
        isDirty = currentModalSignature() !== initialSignature;
        saveBtn.disabled = !isDirty;
        renderFooterActions();
      }

      function confirmDiscardIfDirty(){
        if(!isDirty) return Promise.resolve(true);
        return askRozrysConfirm({
          title:'ANULOWAĆ ZMIANY?',
          message:'Niezapisane zmiany w opcjach rozkroju zostaną utracone.',
          confirmText:'✕ ANULUJ ZMIANY',
          cancelText:'WRÓĆ',
          confirmTone:'danger',
          cancelTone:'neutral'
        });
      }

      function confirmSaveIfDirty(){
        if(!isDirty) return Promise.resolve(true);
        return askRozrysConfirm({
          title:'ZAPISAĆ ZMIANY?',
          message:'Zmienione opcje rozkroju zostaną zapisane i użyte przy kolejnych wejściach do panelu.',
          confirmText:'✓ ZAPISZ',
          cancelText:'WRÓĆ',
          confirmTone:'success',
          cancelTone:'neutral'
        });
      }

      function wireDirty(el){
        if(!el) return;
        el.addEventListener('input', updateDirtyState);
        el.addEventListener('change', updateDirtyState);
      }
      [modalEdgeSel, modalBoardW, modalBoardH, modalKerf, modalTrim, modalMinW, modalMinH].forEach(wireDirty);
      updateDirtyState();

      exitBtn.addEventListener('click', ()=> closeModal());
      cancelBtn.addEventListener('click', async ()=>{
        if(!(await confirmDiscardIfDirty())) return;
        closeModal();
      });
      resetBtn.addEventListener('click', ()=>{
        applyDefaultValuesToModal();
        updateDirtyState();
      });
      saveBtn.addEventListener('click', async ()=>{
        if(!(await confirmSaveIfDirty())) return;
        if(!isDirty){
          closeModal();
          return;
        }
        applyUnitChange(modalUnitSel.value);
        edgeSel.value = modalEdgeSel.value;
        inW.value = String(Math.max(1, parseLocaleNumber(modalBoardW.value)||0));
        inH.value = String(Math.max(1, parseLocaleNumber(modalBoardH.value)||0));
        inK.value = String(Math.max(0, parseLocaleNumber(modalKerf.value)||0));
        inTrim.value = String(Math.max(0, parseLocaleNumber(modalTrim.value)||0));
        inMinW.value = String(Math.max(0, parseLocaleNumber(modalMinW.value)||0));
        inMinH.value = String(Math.max(0, parseLocaleNumber(modalMinH.value)||0));
        persistOptionPrefs();
        closeModal();
        tryAutoRenderFromCache();
      });

      FC.panelBox.open({
        title:'Opcje rozkroju',
        contentNode: body,
        width:'860px',
        dismissOnOverlay:false,
        beforeClose: ()=> confirmDiscardIfDirty()
      });
    }

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

    function getScopeSummary(scope, aggregate){
      if(FC.rozrysScope && typeof FC.rozrysScope.getScopeSummary === 'function'){
        return FC.rozrysScope.getScopeSummary(scope, aggregate, {
          splitMaterialAccordionTitle,
          aggregatePartsForProject,
        });
      }
      return { title:'Wszystkie materiały', subtitle:'', detail:'' };
    }

    function getRoomsSummary(rooms){
      if(FC.rozrysScope && typeof FC.rozrysScope.getRoomsSummary === 'function'){
        return FC.rozrysScope.getRoomsSummary(rooms, { getRooms });
      }
      return { title:'Pomieszczenia', subtitle:'' };
    }

    function updateRoomsPickerButton(){
      const meta = getRoomsSummary(selectedRooms);
      roomsPickerValue.innerHTML = '';
      roomsPickerValue.appendChild(h('div', { class:'rozrys-picker-launch__title', text:meta.title }));
      if(meta.subtitle) roomsPickerValue.appendChild(h('div', { class:'rozrys-picker-launch__subtitle', text:meta.subtitle }));
    }

    function updateMaterialPickerButton(){
      const meta = getScopeSummary(materialScope, agg);
      matPickerValue.innerHTML = '';
      matPickerValue.appendChild(h('div', { class:'rozrys-picker-launch__title', text:meta.title }));
      if(meta.subtitle) matPickerValue.appendChild(h('div', { class:'rozrys-picker-launch__subtitle', text:meta.subtitle }));
      if(meta.detail) matPickerValue.appendChild(h('div', { class:'rozrys-picker-launch__detail', text:meta.detail }));
    }

    function persistSelectionPrefs(){
      savePanelPrefs(Object.assign({}, loadPanelPrefs(), {
        selectedRooms: encodeRoomsSelection(selectedRooms),
        materialScope: encodeMaterialScope(materialScope),
      }));
    }

    function syncHiddenSelections(){
      roomsSel.value = encodeRoomsSelection(selectedRooms);
      matSel.value = encodeMaterialScope(materialScope);
      state.material = (materialScope.kind === 'material' && materialScope.material) ? materialScope.material : (agg.materials[0] || '');
      try{
        if(rozState){
          rozState.setSelectedRooms(selectedRooms);
          rozState.setAggregate(agg);
          rozState.setMaterialScope(materialScope);
          rozState.patchOptionState({ material: state.material });
        }
      }catch(_){ }
    }

    function refreshSelectionState(opts){
      const cfg = Object.assign({ keepFormatHint:true, rerender:true }, opts || {});
      agg = aggregatePartsForProject(selectedRooms);
      materialScope = normalizeMaterialScopeForAggregate(materialScope, agg);
      syncHiddenSelections();
      updateRoomsPickerButton();
      updateMaterialPickerButton();
      if(cfg.keepFormatHint){
        const hintMaterial = materialScope.kind === 'material' ? materialScope.material : (agg.materials[0] || '');
        void hintMaterial;
      }
      persistSelectionPrefs();
      if(cfg.rerender) tryAutoRenderFromCache();
    }

    function buildScopeDraftControls(holder, draftScope, hasFronts, hasCorpus, opts){
      const cfg = Object.assign({ allowEmpty:false, onChange:null }, opts || {});
      const chips = h('div', { class:'rozrys-scope-chips' });
      const notify = ()=>{ try{ if(typeof cfg.onChange === 'function') cfg.onChange(); }catch(_){ } };
      const bindChip = (label, key, enabled)=>{
        if(!enabled) return null;
        const chip = h('label', { class:'rozrys-scope-chip' });
        const cb = h('input', { type:'checkbox' });
        cb.checked = !!draftScope[key];
        cb.addEventListener('change', ()=>{
          draftScope[key] = !!cb.checked;
          if(!cfg.allowEmpty && !draftScope.includeFronts && !draftScope.includeCorpus){
            draftScope[key] = true;
            cb.checked = true;
          }
          notify();
        });
        chip.appendChild(cb);
        chip.appendChild(h('span', { text:label }));
        chips.appendChild(chip);
        return chip;
      };
      if(hasFronts && hasCorpus){
        bindChip('Fronty', 'includeFronts', true);
        bindChip('Korpusy', 'includeCorpus', true);
      }else if(hasFronts || hasCorpus){
        if(hasFronts){
          draftScope.includeCorpus = false;
          bindChip('Fronty', 'includeFronts', true);
        }
        if(hasCorpus){
          draftScope.includeFronts = false;
          bindChip('Korpusy', 'includeCorpus', true);
        }
      }
      holder.appendChild(chips);
    }

    function openRoomsPicker(){
      if(FC.rozrysPickers && typeof FC.rozrysPickers.openRoomsPicker === 'function'){
        return FC.rozrysPickers.openRoomsPicker({
          getSelectedRooms: ()=> selectedRooms,
          setSelectedRooms: (rooms)=>{
            selectedRooms = Array.isArray(rooms) ? rooms.slice() : [];
            try{ if(rozState) rozState.setSelectedRooms(selectedRooms); }catch(_){ }
          },
          getRooms,
          normalizeRoomSelection,
          roomLabel,
          askConfirm: askRozrysConfirm,
          refreshSelectionState,
        });
      }
    }

    function openMaterialPicker(){
      if(FC.rozrysPickers && typeof FC.rozrysPickers.openMaterialPicker === 'function'){
        return FC.rozrysPickers.openMaterialPicker({
          getMaterialScope: ()=> materialScope,
          setMaterialScope: (nextScope)=>{
            materialScope = nextScope;
            try{ if(rozState) rozState.setMaterialScope(materialScope); }catch(_){ }
          },
          makeMaterialScope,
          aggregate: agg,
          splitMaterialAccordionTitle,
          buildScopeDraftControls,
          normalizeMaterialScopeForAggregate,
          askConfirm: askRozrysConfirm,
          refreshSelectionState,
        });
      }
    }

    updateRoomsPickerButton();
    updateMaterialPickerButton();
    syncHiddenSelections();
    roomsPickerBtn.addEventListener('click', openRoomsPicker);
    matPickerBtn.addEventListener('click', openMaterialPicker);
    // Helper: whether current material (by name) is marked as having grain in the price list.
    function getRealHalfStockForMaterial(material, fullWmm, fullHmm){
      if(FC.rozrysStock && typeof FC.rozrysStock.getRealHalfStockForMaterial === 'function'){
        return FC.rozrysStock.getRealHalfStockForMaterial(material, fullWmm, fullHmm);
      }
      return { qty:0, width:0, height:0 };
    }

    function toMmByUnit(unit, value){
      if(FC.rozrysStock && typeof FC.rozrysStock.toMmByUnit === 'function'){
        return FC.rozrysStock.toMmByUnit(unit, value);
      }
      return 0;
    }

    function fromMmByUnit(unit, valueMm){
      if(FC.rozrysStock && typeof FC.rozrysStock.fromMmByUnit === 'function'){
        return FC.rozrysStock.fromMmByUnit(unit, valueMm);
      }
      return 0;
    }

    function sameSheetFormat(aW, aH, bW, bH){
      if(FC.rozrysStock && typeof FC.rozrysStock.sameSheetFormat === 'function'){
        return FC.rozrysStock.sameSheetFormat(aW, aH, bW, bH);
      }
      return false;
    }

    function getDefaultRozrysOptionValues(unit){
      if(FC.rozrysStock && typeof FC.rozrysStock.getDefaultRozrysOptionValues === 'function'){
        return FC.rozrysStock.getDefaultRozrysOptionValues(unit);
      }
      return { unit:'cm', edge:'0', boardW:280, boardH:207, kerf:0.4, trim:2, minW:0, minH:0 };
    }

    function getSheetRowsForMaterial(material, opts){
      if(FC.rozrysStock && typeof FC.rozrysStock.getSheetRowsForMaterial === 'function'){
        return FC.rozrysStock.getSheetRowsForMaterial(material, opts);
      }
      return [];
    }

    function buildStockSignatureForMaterial(material){
      if(FC.rozrysStock && typeof FC.rozrysStock.buildStockSignatureForMaterial === 'function'){
        return FC.rozrysStock.buildStockSignatureForMaterial(material);
      }
      return '';
    }

    function canPartFitSheet(part, boardWmm, boardHmm, trimMm, allowRotate){
      if(FC.rozrysStock && typeof FC.rozrysStock.canPartFitSheet === 'function'){
        return FC.rozrysStock.canPartFitSheet(part, boardWmm, boardHmm, trimMm, allowRotate);
      }
      return false;
    }

    function filterPartsForSheet(parts, boardWmm, boardHmm, trimMm, grainOn, overrides){
      if(FC.rozrysStock && typeof FC.rozrysStock.filterPartsForSheet === 'function'){
        return FC.rozrysStock.filterPartsForSheet(parts, boardWmm, boardHmm, trimMm, grainOn, overrides, { isPartRotationAllowed });
      }
      return [];
    }

    function getExactSheetStockForMaterial(material, boardWmm, boardHmm){
      if(FC.rozrysStock && typeof FC.rozrysStock.getExactSheetStockForMaterial === 'function'){
        return FC.rozrysStock.getExactSheetStockForMaterial(material, boardWmm, boardHmm);
      }
      return { qty:0, width:Math.round(Number(boardWmm)||0), height:Math.round(Number(boardHmm)||0) };
    }

    function getLargestSheetFormatForMaterial(material, fallbackWmm, fallbackHmm){
      if(FC.rozrysStock && typeof FC.rozrysStock.getLargestSheetFormatForMaterial === 'function'){
        return FC.rozrysStock.getLargestSheetFormatForMaterial(material, fallbackWmm, fallbackHmm);
      }
      return { width:Math.round(Number(fallbackWmm)||0), height:Math.round(Number(fallbackHmm)||0), qty:0 };
    }

    function clonePlanSheetsWithSupply(sheets, opts){
      if(FC.rozrysStock && typeof FC.rozrysStock.clonePlanSheetsWithSupply === 'function'){
        return FC.rozrysStock.clonePlanSheetsWithSupply(sheets, opts);
      }
      return Array.isArray(sheets) ? sheets.slice() : [];
    }

    function countPlacedPartsByKey(sheets){
      if(FC.rozrysStock && typeof FC.rozrysStock.countPlacedPartsByKey === 'function'){
        return FC.rozrysStock.countPlacedPartsByKey(sheets);
      }
      return new Map();
    }

    function subtractPlacedParts(parts, usedMap){
      if(FC.rozrysStock && typeof FC.rozrysStock.subtractPlacedParts === 'function'){
        return FC.rozrysStock.subtractPlacedParts(parts, usedMap, { partSignature });
      }
      return Array.isArray(parts) ? parts.slice() : [];
    }

    function buildPlanMetaFromState(st){
      if(FC.rozrysStock && typeof FC.rozrysStock.buildPlanMetaFromState === 'function'){
        return FC.rozrysStock.buildPlanMetaFromState(st);
      }
      return { trim:20, boardW:2800, boardH:2070, unit:'mm' };
    }

    async function computePlanWithCurrentEngine(st, parts, panelOpts){
      if(FC.rozrysEngine && typeof FC.rozrysEngine.computePlanWithCurrentEngine === 'function'){
        return FC.rozrysEngine.computePlanWithCurrentEngine(st, parts, panelOpts, {
          computePlan,
          computePlanPanelProAsync,
        });
      }
      return computePlan(st, parts);
    }

    async function applySheetStockLimit(material, st, parts, plan, opts){
      if(FC.rozrysStock && typeof FC.rozrysStock.applySheetStockLimit === 'function'){
        return FC.rozrysStock.applySheetStockLimit(material, st, parts, plan, opts, { computePlanWithCurrentEngine, partSignature, isPartRotationAllowed });
      }
      return plan && typeof plan === 'object' ? plan : { sheets:[] };
    }

    function materialHasGrain(name){
      try{
        const list = (typeof materials !== 'undefined' && Array.isArray(materials)) ? materials : [];
        return !!(FC && typeof FC.materialHasGrain === 'function' && FC.materialHasGrain(name, list));
      }catch(_){ return false; }
    }

    function openMaterialGrainExceptions(material, parts){
      const hasGrain = materialHasGrain(material);
      const enabled = getMaterialGrainEnabled(material, hasGrain);
      if(!hasGrain || !enabled){
        openRozrysInfo('Wyjątki słojów', 'Najpierw włącz pilnowanie kierunku słojów dla tego materiału.');
        return;
      }
      if(!(FC.panelBox && typeof FC.panelBox.open === 'function')) return;
      const partList = Array.isArray(parts) ? parts.slice() : [];
      const allowedKeys = partList.map((p)=> partSignature(p));
      const initial = getMaterialGrainExceptions(material, allowedKeys, hasGrain);
      const draft = Object.assign({}, initial);
      const currentSignature = ()=> Object.keys(draft).filter((key)=> draft[key]).sort().join('|');
      const initialSignature = Object.keys(initial).filter((key)=> initial[key]).sort().join('|');
      const isDirty = ()=> currentSignature() !== initialSignature;
      const body = h('div', { class:'panel-box-form' });
      const scroll = h('div', { class:'panel-box-form__scroll' });
      const footerShell = h('div', { class:'panel-box-form__footer' });
      scroll.appendChild(h('div', { class:'muted xs', style:'margin-bottom:10px', text:'Zaznaczone formatki będą traktowane tak, jakby nie miały słojów i będzie można je obracać.' }));
      const list = h('div', { class:'rozrys-grain-exceptions-list' });
      if(!partList.length){
        list.appendChild(h('div', { class:'muted xs', text:'Brak formatek dla tego materiału w aktualnym zakresie.' }));
      }
      partList.forEach((p)=>{
        const sig = partSignature(p);
        const row = h('label', { class:'rozrys-grain-exception-row' });
        const cb = h('input', { type:'checkbox' });
        cb.checked = !!draft[sig];
        const copy = h('div', { class:'rozrys-grain-exception-copy' });
        copy.appendChild(h('div', { class:'rozrys-grain-exception-name', text:String(p.name || 'Element') }));
        copy.appendChild(h('div', { class:'muted xs', text:`${mmToUnitStr(p.w, unitSel.value)} × ${mmToUnitStr(p.h, unitSel.value)} ${unitSel.value} • ilość ${Math.max(0, Number(p.qty) || 0)}` }));
        if(p && p.direction && String(p.direction) !== 'default'){
          copy.appendChild(h('div', { class:'muted xs', text:`Ustawienie formatki: ${materialPartDirectionLabel(p)}` }));
        }
        cb.addEventListener('change', ()=>{
          if(cb.checked) draft[sig] = true;
          else delete draft[sig];
          updateFooter();
        });
        row.appendChild(cb);
        row.appendChild(copy);
        list.appendChild(row);
      });
      scroll.appendChild(list);
      const footer = h('div', { class:'rozrys-grain-exceptions__footer' });
      const footerActions = h('div', { class:'rozrys-grain-exceptions__footer-actions' });
      const exitBtn = h('button', { type:'button', class:'btn-primary', text:'Wyjdź' });
      const cancelBtn = h('button', { type:'button', class:'btn-danger', text:'Anuluj' });
      const saveBtn = h('button', { type:'button', class:'btn-success', text:'Zapisz' });
      function updateFooter(){
        footerActions.innerHTML = '';
        if(isDirty()){
          footerActions.appendChild(cancelBtn);
          footerActions.appendChild(saveBtn);
        }else{
          footerActions.appendChild(exitBtn);
        }
      }
      updateFooter();
      footer.appendChild(footerActions);
      footerShell.appendChild(footer);
      body.appendChild(scroll);
      body.appendChild(footerShell);
      const confirmDiscardIfDirty = ()=> isDirty() ? askRozrysConfirm({
        title:'ANULOWAĆ ZMIANY?',
        message:'Niezapisane zmiany w wyjątkach słojów zostaną utracone.',
        confirmText:'✕ ANULUJ ZMIANY',
        cancelText:'WRÓĆ',
        confirmTone:'danger',
        cancelTone:'neutral'
      }) : Promise.resolve(true);
      exitBtn.addEventListener('click', ()=>{ try{ FC.panelBox.close(); }catch(_){ } });
      cancelBtn.addEventListener('click', async ()=>{
        if(!(await confirmDiscardIfDirty())) return;
        try{ FC.panelBox.close(); }catch(_){ }
      });
      saveBtn.addEventListener('click', ()=>{
        const next = {};
        Object.keys(draft).forEach((key)=>{ if(draft[key]) next[key] = true; });
        setMaterialGrainExceptions(material, next, hasGrain);
        try{ FC.panelBox.close(); }catch(_){ }
        tryAutoRenderFromCache();
      });
      FC.panelBox.open({ title:`Wyjątki słojów — ${material}`, contentNode: body, width:'760px', dismissOnOverlay:false, beforeClose: ()=> confirmDiscardIfDirty() });
    }

    function getBaseState(){
      const base = (FC.rozrysState && typeof FC.rozrysState.buildBaseStateFromControls === 'function')
        ? FC.rozrysState.buildBaseStateFromControls({ unitSel, edgeSel, inW, inH, inK, inTrim, inMinW, inMinH, heurSel, dirSel }, { normalizeCutDirection })
        : {
            unit: unitSel.value,
            edgeSubMm: Math.max(0, Number(edgeSel.value)||0),
            boardW: Number(inW.value)|| (unitSel.value==="mm"?2800:280),
            boardH: Number(inH.value)|| (unitSel.value==="mm"?2070:207),
            kerf: Number(inK.value)|| (unitSel.value==="mm"?4:0.4),
            edgeTrim: Number(inTrim.value)|| (unitSel.value==="mm"?20:2),
            minScrapW: Math.max(0, Number(inMinW.value)||0),
            minScrapH: Math.max(0, Number(inMinH.value)||0),
            heur: 'optimax',
            optimaxProfile: heurSel.value,
            direction: normalizeCutDirection(dirSel.value),
          };
      try{ if(rozState) rozState.setOptionState(Object.assign({}, state, base)); }catch(_){ }
      return base;
    }


    function tryAutoRenderFromCache(){
      if(FC.rozrysRender && typeof FC.rozrysRender.tryAutoRenderFromCache === 'function'){
        return FC.rozrysRender.tryAutoRenderFromCache({
          _rozrysRunning: isRozrysRunning(),
          normalizeMaterialScopeForAggregate,
          decodeMaterialScope,
          matSelValue: matSel.value,
          agg,
          buildEntriesForScope,
          out,
          setGenBtnMode,
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
          renderMaterialAccordionPlans,
          setCacheState: (patch)=>{ try{ if(rozState) rozState.setCacheState(patch); }catch(_){ } },
        });
      }
      out.innerHTML = '';
      setGenBtnMode('idle');
      return false;
    }


    function buildEntriesForScope(selection, aggregate){
      if(FC.rozrysRender && typeof FC.rozrysRender.buildEntriesForScope === 'function'){
        return FC.rozrysRender.buildEntriesForScope(selection, aggregate, {
          normalizeMaterialScopeForAggregate,
          aggregatePartsForProject,
          getOrderedMaterialsForSelection,
          getGroupPartsForScope,
        });
      }
      return [];
    }




  function splitMaterialAccordionTitle(material){
    if(FC.rozrysAccordion && typeof FC.rozrysAccordion.splitMaterialAccordionTitle === 'function'){
      return FC.rozrysAccordion.splitMaterialAccordionTitle(material);
    }
    return { line1:String(material || 'Materiał'), line2:'' };
  }


  function createMaterialAccordionSection(material, options){
    if(FC.rozrysAccordion && typeof FC.rozrysAccordion.createMaterialAccordionSection === 'function'){
      return FC.rozrysAccordion.createMaterialAccordionSection(material, options, { scheduleSheetCanvasRefresh });
    }
    const wrap = h('div');
    const body = h('div');
    wrap.appendChild(body);
    return { wrap, body, trigger:null, setOpenState:()=>{} };
  }

  function renderMaterialAccordionPlans(scopeKey, scopeMode, entries){
    if(FC.rozrysAccordion && typeof FC.rozrysAccordion.renderMaterialAccordionPlans === 'function'){
      return FC.rozrysAccordion.renderMaterialAccordionPlans(scopeKey, scopeMode, entries, {
        out,
        getAccordionPref,
        materialHasGrain,
        getMaterialGrainEnabled,
        setAccordionPref,
        setMaterialGrainEnabled,
        tryAutoRenderFromCache,
        openMaterialGrainExceptions,
        renderOutput,
        formatHeurLabel,
        scheduleSheetCanvasRefresh,
      });
    }
    out.innerHTML = '';
    return false;
  }


    function renderOutput(plan, meta, target){
      if(FC.rozrysRender && typeof FC.rozrysRender.renderOutput === 'function'){
        return FC.rozrysRender.renderOutput(plan, meta, {
          target: target || out,
          out,
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
        });
      }
      (target || out).innerHTML = '';
    }


    function renderLoading(text){
      return renderLoadingInto(null, text);
    }

    function renderLoadingInto(target, text, subText){
      if(FC.rozrysRender && typeof FC.rozrysRender.renderLoadingInto === 'function'){
        return FC.rozrysRender.renderLoadingInto(target, text, subText, { out });
      }
      const tgt = target || out;
      tgt.innerHTML = '';
      return null;
    }

    
    // ===== Cache planów rozkroju

    
    // ===== Cache planów rozkroju (żeby nie liczyć ponownie)
    const PLAN_CACHE_KEY = 'fc_rozrys_plan_cache_v2';

    function hashStr(s){
      // szybki, stabilny hash (djb2)
      let h = 5381;
      for(let i=0;i<s.length;i++){
        h = ((h << 5) + h) + s.charCodeAt(i);
        h = h >>> 0;
      }
      return h.toString(16);
    }

    function loadPlanCache(){
      if(FC.rozrysCache && typeof FC.rozrysCache.loadPlanCache === 'function'){
        return FC.rozrysCache.loadPlanCache();
      }
      return {};
    }

    function savePlanCache(cache){
      if(FC.rozrysCache && typeof FC.rozrysCache.savePlanCache === 'function'){
        FC.rozrysCache.savePlanCache(cache);
      }
    }

    function makePlanCacheKey(st, parts){
      if(FC.rozrysCache && typeof FC.rozrysCache.makePlanCacheKey === 'function'){
        return FC.rozrysCache.makePlanCacheKey(st, parts, { partSignature, isPartRotationAllowed, loadEdgeStore });
      }
      return 'plan_fallback';
    }

    const progressCtrl = (FC.rozrysProgress && typeof FC.rozrysProgress.createController === 'function')
      ? FC.rozrysProgress.createController({ statusBox, statusMain, statusSub, statusMeta, statusProg, statusProgBar, genBtn })
      : null;

    function setGenBtnMode(mode){
      try{ if(rozState) rozState.setUiState({ buttonMode: String(mode || 'idle'), running: mode === 'running' }); }catch(_){ }
      if(progressCtrl && typeof progressCtrl.setGenBtnMode === 'function') return progressCtrl.setGenBtnMode(mode);
    }

    function requestCancel(){
      try{ if(rozState) rozState.setUiState({ running:false }); }catch(_){ }
      if(progressCtrl && typeof progressCtrl.requestCancel === 'function') return progressCtrl.requestCancel();
    }

    function isRozrysRunning(){
      const running = !!(progressCtrl && typeof progressCtrl.isRunning === 'function' && progressCtrl.isRunning());
      try{ if(rozState) rozState.setUiState({ running }); }catch(_){ }
      return running;
    }

    function getRozrysBtnMode(){
      return progressCtrl && typeof progressCtrl.getButtonMode === 'function' ? progressCtrl.getButtonMode() : 'idle';
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
      if(FC.rozrysStockModal && typeof FC.rozrysStockModal.openAddStockModal === 'function'){
        return FC.rozrysStockModal.openAddStockModal({
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
        });
      }
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
  };
})();
