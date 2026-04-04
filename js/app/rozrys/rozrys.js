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

  const rozrysPrefs = FC.rozrysPrefs || null;

  function discoverProjectRoomKeys(proj){
    if(!proj || typeof proj !== 'object') return [];
    const out = [];
    Object.keys(proj).forEach((key)=>{
      const roomKey = String(key || '').trim();
      if(!roomKey || roomKey in {'schemaVersion':1,'meta':1}) return;
      const room = proj[key];
      if(!room || typeof room !== 'object') return;
      const hasRoomShape = Array.isArray(room.cabinets) || Array.isArray(room.fronts) || Array.isArray(room.sets) || (!!room.settings && typeof room.settings === 'object');
      if(hasRoomShape) out.push(roomKey);
    });
    return out;
  }

  function countProjectCabinets(proj){
    return discoverProjectRoomKeys(proj).reduce((sum, roomKey)=>{
      const room = proj && proj[roomKey];
      const cabinets = Array.isArray(room && room.cabinets) ? room.cabinets.length : 0;
      return sum + cabinets;
    }, 0);
  }

  function safeGetProject(){
    const candidates = [];
    try{
      if(typeof projectData !== 'undefined' && projectData) candidates.push(projectData);
    }catch(_){ }
    try{
      if(window.projectData) candidates.push(window.projectData);
    }catch(_){ }
    try{
      if(FC.project && typeof FC.project.load === 'function'){
        const loaded = FC.project.load();
        if(loaded) candidates.push(loaded);
      }
    }catch(_){ }
    if(!candidates.length) return null;
    let best = null;
    let bestScore = -1;
    candidates.forEach((proj)=>{
      if(!proj || typeof proj !== 'object') return;
      const roomCount = discoverProjectRoomKeys(proj).length;
      const cabinetCount = countProjectCabinets(proj);
      const score = (cabinetCount * 1000) + roomCount;
      if(score > bestScore){
        best = proj;
        bestScore = score;
      }
    });
    return best || candidates[0] || null;
  }

  function getRooms(){
    const registryRooms = (()=>{
      try{
        if(FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomIds === 'function'){
          const dynamicRooms = FC.roomRegistry.getActiveRoomIds();
          return Array.isArray(dynamicRooms) ? dynamicRooms.filter(Boolean) : [];
        }
      }catch(_){ }
      return [];
    })();
    const hasInvestor = (()=>{
      try{ return !!(FC.roomRegistry && typeof FC.roomRegistry.hasCurrentInvestor === 'function' && FC.roomRegistry.hasCurrentInvestor()); }
      catch(_){ return false; }
    })();
    const fallbackDefaults = (()=>{
      try{
        if(FC.schema && Array.isArray(FC.schema.ROOMS)) return FC.schema.ROOMS.slice();
      }catch(_){ }
      return ['kuchnia','szafa','pokoj','lazienka'];
    })();
    const defaults = hasInvestor ? registryRooms.slice() : (registryRooms.length ? registryRooms.slice() : fallbackDefaults);
    const proj = safeGetProject();
    if(!proj || typeof proj !== 'object') return defaults;
    const discovered = discoverProjectRoomKeys(proj);
    if(hasInvestor){
      if(registryRooms.length) return registryRooms.slice();
      return discovered.filter((room)=> String(room || '').startsWith('room_'));
    }
    const ordered = [];
    defaults.forEach((room)=>{ if(discovered.includes(room)) ordered.push(room); });
    discovered.forEach((room)=>{ if(!ordered.includes(room)) ordered.push(room); });
    return ordered.length ? ordered : defaults;
  }

  function parseLocaleNumber(v){
    if(rozrysPrefs && typeof rozrysPrefs.parseLocaleNumber === 'function') return rozrysPrefs.parseLocaleNumber(v);
    if(v === null || v === undefined) return NaN;
    if(typeof v === 'number') return Number.isFinite(v) ? v : NaN;
    const s = String(v).trim().replace(',', '.');
    if(!s) return NaN;
    return Number(s);
  }

  function cmToMm(v){
    if(rozrysPrefs && typeof rozrysPrefs.cmToMm === 'function') return rozrysPrefs.cmToMm(v);
    const n = parseLocaleNumber(v);
    if(!Number.isFinite(n)) return 0;
    return Math.round(n * 10);
  }

  function mmToStr(mm){
    if(rozrysPrefs && typeof rozrysPrefs.mmToStr === 'function') return rozrysPrefs.mmToStr(mm);
    return String(Math.round(Number(mm) || 0));
  }

  function mmToUnitStr(mm, unit){
    if(rozrysPrefs && typeof rozrysPrefs.mmToUnitStr === 'function') return rozrysPrefs.mmToUnitStr(mm, unit);
    const u = (unit === 'cm') ? 'cm' : 'mm';
    const n = Math.round(Number(mm) || 0);
    if(u === 'mm') return String(n);
    const cm = n / 10;
    const s = (Math.round(cm * 10) / 10).toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  }

  function loadPanelPrefs(){
    return rozrysPrefs && typeof rozrysPrefs.loadPanelPrefs === 'function' ? rozrysPrefs.loadPanelPrefs() : {};
  }

  function savePanelPrefs(obj){
    if(rozrysPrefs && typeof rozrysPrefs.savePanelPrefs === 'function') rozrysPrefs.savePanelPrefs(obj || {});
  }

  function getAccordionPref(scopeKey){
    return rozrysPrefs && typeof rozrysPrefs.getAccordionPref === 'function'
      ? rozrysPrefs.getAccordionPref(scopeKey)
      : { material:'', open:false };
  }

  function setAccordionPref(scopeKey, material, open){
    if(rozrysPrefs && typeof rozrysPrefs.setAccordionPref === 'function') rozrysPrefs.setAccordionPref(scopeKey, material, open);
  }

  function getMaterialGrainEnabled(material, hasGrain){
    return rozrysPrefs && typeof rozrysPrefs.getMaterialGrainEnabled === 'function'
      ? !!rozrysPrefs.getMaterialGrainEnabled(material, hasGrain)
      : !!hasGrain;
  }

  function setMaterialGrainEnabled(material, enabled, hasGrain){
    if(rozrysPrefs && typeof rozrysPrefs.setMaterialGrainEnabled === 'function') rozrysPrefs.setMaterialGrainEnabled(material, enabled, hasGrain);
  }

  function getMaterialGrainExceptions(material, allowedKeys, hasGrain){
    return rozrysPrefs && typeof rozrysPrefs.getMaterialGrainExceptions === 'function'
      ? (rozrysPrefs.getMaterialGrainExceptions(material, allowedKeys, hasGrain) || {})
      : {};
  }

  function setMaterialGrainExceptions(material, exceptions, hasGrain){
    if(rozrysPrefs && typeof rozrysPrefs.setMaterialGrainExceptions === 'function') rozrysPrefs.setMaterialGrainExceptions(material, exceptions, hasGrain);
  }

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

  function loadEdgeStore(){
    return rozrysPrefs && typeof rozrysPrefs.loadEdgeStore === 'function' ? rozrysPrefs.loadEdgeStore() : {};
  }

  function partSignature(p){
    return rozrysPrefs && typeof rozrysPrefs.partSignature === 'function'
      ? rozrysPrefs.partSignature(p)
      : `${p && p.material || ''}||${p && p.name || ''}||${p && p.w || 0}x${p && p.h || 0}`;
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
      for(let cabIndex = 0; cabIndex < cabinets.length; cabIndex += 1){
        const cab = cabinets[cabIndex];
        const cutListFn = resolveCabinetCutListFn();
        if(typeof cutListFn !== 'function') continue;
        const parts = cutListFn(cab, room) || [];
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
            cabinet: `#${cabIndex + 1}`,
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
      return FC.rozrysSummary.openValidationListModal(material, diag, unit, { mmToUnitStr, openPrintView });
    }
  }

  function openSheetListModal(material, sheetTitle, rows, unit){
    if(FC.rozrysSummary && typeof FC.rozrysSummary.openSheetListModal === 'function'){
      return FC.rozrysSummary.openSheetListModal(material, sheetTitle, rows, unit, { mmToUnitStr, openPrintView });
    }
  }


function aggregatePartsForProject(selectedRooms){
  if(FC.rozrysScope && typeof FC.rozrysScope.aggregatePartsForProject === 'function'){
    const deps = {
      safeGetProject,
      getRooms,
      getCabinetCutList: resolveCabinetCutListFn(),
      resolveRozrysPartFromSource,
      isFrontMaterialKey,
    };
    const first = FC.rozrysScope.aggregatePartsForProject(selectedRooms, deps);
    if(first && Array.isArray(first.materials) && first.materials.length) return first;
    const proj = safeGetProject();
    const discoveredRooms = discoverProjectRoomKeys(proj);
    if(discoveredRooms.length){
      const retry = FC.rozrysScope.aggregatePartsForProject(discoveredRooms, deps);
      if(retry && Array.isArray(retry.materials) && retry.materials.length) return retry;
    }
    return first;
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
      FC.panelBox.open({ title: boxTitle, message: boxMessage, width:'560px', boxClass:'panel-box--rozrys' });
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
      FC.panelBox.open({ title:String(cfg.title || 'POTWIERDZENIE'), contentNode: body, width:'560px', boxClass:'panel-box--rozrys', dismissOnOverlay:false, dismissOnEsc:true });
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
      if(FC.rozrysOptionsModal && typeof FC.rozrysOptionsModal.openOptionsModal === 'function'){
        return FC.rozrysOptionsModal.openOptionsModal({
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
      return { unit:'cm', edge:'0', boardW:280, boardH:207, kerf:0.4, trim:1, minW:0, minH:0 };
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
      return { trim:10, boardW:2800, boardH:2070, unit:'mm' };
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
      if(FC.rozrysGrainModal && typeof FC.rozrysGrainModal.openMaterialGrainExceptions === 'function'){
        return FC.rozrysGrainModal.openMaterialGrainExceptions({
          material,
          parts,
          unitValue: unitSel.value,
          h,
          tryAutoRenderFromCache,
        }, {
          askRozrysConfirm,
          openRozrysInfo,
          setMaterialGrainExceptions,
          getMaterialGrainEnabled,
          getMaterialGrainExceptions,
          materialHasGrain,
          partSignature,
          materialPartDirectionLabel,
          mmToUnitStr,
        });
      }
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
            edgeTrim: Number(inTrim.value)|| (unitSel.value==="mm"?10:1),
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
          createChoiceLauncher,
          getSelectOptionLabel,
          setChoiceLaunchValue,
          openRozrysChoiceOverlay,
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
    safeGetProject,
    discoverProjectRoomKeys,
  };
})();