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
    const map = { kuchnia:'Kuchnia', szafa:'Szafa', pokoj:'Pokój', lazienka:'Łazienka' };
    const key = String(room || '').trim();
    return map[key] || key || 'Pomieszczenie';
  }

  function normalizeRoomSelection(rooms){
    const allowed = getRooms();
    const set = new Set((Array.isArray(rooms) ? rooms : []).map((room)=> String(room || '').trim()).filter((room)=> allowed.includes(room)));
    return allowed.filter((room)=> set.has(room));
  }

  function encodeRoomsSelection(rooms){
    return normalizeRoomSelection(rooms).join('|');
  }

  function decodeRoomsSelection(raw){
    const parts = Array.isArray(raw) ? raw : String(raw || '').split('|');
    const normalized = normalizeRoomSelection(parts);
    return normalized.length ? normalized : getRooms().slice();
  }

  function makeMaterialScope(selection, opts){
    const cfg = Object.assign({ allowEmpty:false }, opts || {});
    const base = Object.assign({ kind:'all', material:'', includeFronts:true, includeCorpus:true }, selection || {});
    const kind = (base.kind === 'material' && String(base.material || '').trim()) ? 'material' : 'all';
    const scope = {
      kind,
      material: kind === 'material' ? String(base.material || '').trim() : '',
      includeFronts: base.includeFronts !== false,
      includeCorpus: base.includeCorpus !== false,
    };
    if(!cfg.allowEmpty && !scope.includeFronts && !scope.includeCorpus){
      scope.includeFronts = true;
      scope.includeCorpus = true;
    }
    return scope;
  }

  function encodeMaterialScope(selection){
    try{ return JSON.stringify(makeMaterialScope(selection)); }catch(_){ return '{"kind":"all","material":"","includeFronts":true,"includeCorpus":true}'; }
  }

  function decodeMaterialScope(raw){
    try{ return makeMaterialScope(raw ? JSON.parse(String(raw)) : null); }
    catch(_){ return makeMaterialScope(); }
  }

  function sortRozrysParts(list){
    return (Array.isArray(list) ? list.slice() : []).sort((a,b)=>{
      const aa = Math.max(Number(a && a.w) || 0, Number(a && a.h) || 0);
      const bb = Math.max(Number(b && b.w) || 0, Number(b && b.h) || 0);
      if(bb !== aa) return bb - aa;
      const aw = Math.min(Number(a && a.w) || 0, Number(a && a.h) || 0);
      const bw = Math.min(Number(b && b.w) || 0, Number(b && b.h) || 0);
      if(bw !== aw) return bw - aw;
      return String(a && a.name || '').localeCompare(String(b && b.name || ''), 'pl');
    });
  }

  function getGroupPartsForScope(group, selection){
    const scope = makeMaterialScope(selection);
    if(!group) return [];
    if(scope.includeFronts && scope.includeCorpus) return Array.isArray(group.allParts) ? group.allParts.slice() : [];
    if(scope.includeFronts) return Array.isArray(group.frontParts) ? group.frontParts.slice() : [];
    if(scope.includeCorpus) return Array.isArray(group.corpusParts) ? group.corpusParts.slice() : [];
    return [];
  }

  function normalizeMaterialScopeForAggregate(selection, aggregate){
    const scope = makeMaterialScope(selection);
    const aggRef = aggregate && typeof aggregate === 'object' ? aggregate : aggregatePartsForProject();
    const mats = Array.isArray(aggRef && aggRef.materials) ? aggRef.materials : [];
    if(!mats.length) return makeMaterialScope({ kind:'all', includeFronts:true, includeCorpus:true });
    if(scope.kind === 'material'){
      const group = aggRef && aggRef.groups ? aggRef.groups[scope.material] : null;
      if(!group) return makeMaterialScope({ kind:'all', includeFronts:true, includeCorpus:true });
      if(scope.includeFronts && !group.hasFronts) scope.includeFronts = false;
      if(scope.includeCorpus && !group.hasCorpus) scope.includeCorpus = false;
      if(!scope.includeFronts && !scope.includeCorpus){
        scope.includeFronts = !!group.hasFronts;
        scope.includeCorpus = !scope.includeFronts && !!group.hasCorpus;
      }
      return makeMaterialScope(scope);
    }
    const hasAnyFronts = mats.some((mat)=> !!(aggRef.groups && aggRef.groups[mat] && aggRef.groups[mat].hasFronts));
    const hasAnyCorpus = mats.some((mat)=> !!(aggRef.groups && aggRef.groups[mat] && aggRef.groups[mat].hasCorpus));
    if(scope.includeFronts && !hasAnyFronts) scope.includeFronts = false;
    if(scope.includeCorpus && !hasAnyCorpus) scope.includeCorpus = false;
    if(!scope.includeFronts && !scope.includeCorpus){
      scope.includeFronts = hasAnyFronts;
      scope.includeCorpus = !scope.includeFronts && hasAnyCorpus;
    }
    return makeMaterialScope(scope);
  }

  function getRozrysScopeMode(selection){
    const scope = makeMaterialScope(typeof selection === 'string' ? decodeMaterialScope(selection) : selection);
    if(scope.includeFronts && scope.includeCorpus) return 'both';
    return scope.includeFronts ? 'fronts' : 'corpus';
  }

  function getOrderedMaterialsForSelection(selection, aggregate){
    const scope = makeMaterialScope(typeof selection === 'string' ? decodeMaterialScope(selection) : selection);
    const aggRef = aggregate && typeof aggregate === 'object' ? aggregate : aggregatePartsForProject();
    const allMaterials = Array.isArray(aggRef && aggRef.materials) ? aggRef.materials.slice() : [];
    if(scope.kind === 'material' && scope.material) return allMaterials.includes(scope.material) ? [scope.material] : [];
    return allMaterials;
  }

  function getAccordionScopeKey(selection, aggregate){
    const scope = makeMaterialScope(typeof selection === 'string' ? decodeMaterialScope(selection) : selection);
    const aggRef = aggregate && typeof aggregate === 'object' ? aggregate : aggregatePartsForProject();
    const roomSig = encodeRoomsSelection(aggRef && aggRef.selectedRooms ? aggRef.selectedRooms : getRooms());
    const materialSig = scope.kind === 'material' ? scope.material : '__ALL__';
    return `scope:${roomSig}:${materialSig}:${getRozrysScopeMode(scope)}`;
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
    const rv = FC.rozrysValidation;
    if(!(rv && typeof rv.aggregateRows === 'function' && typeof rv.summarizePlan === 'function' && typeof rv.validate === 'function')) return null;
    const rawRows = buildRawSnapshotForMaterial(targetMaterial, mode, selectedRooms);
    const resolvedRows = rawRows.length ? rv.aggregateRows(rawRows) : buildResolvedSnapshotFromParts(parts);
    const actual = rv.summarizePlan(plan, targetMaterial);
    const validation = rv.validate(resolvedRows, actual.rows);
    return {
      rawRows,
      rawCount: rawRows.length,
      resolvedRows,
      actualRows: actual.rows,
      sheets: actual.sheets,
      validation,
    };
  }

  function validationSummaryLabel(diag){
    const validation = diag && diag.validation;
    if(!validation) return { text:'Walidacja: brak danych', tone:'is-warn' };
    if(validation.ok) return { text:'Walidacja: OK — wszystkie formatki rozpisane', tone:'is-ok' };
    const parts = [];
    if(validation.missingQty > 0) parts.push(`braki ${validation.missingQty} szt.`);
    if(validation.extraQty > 0) parts.push(`nadmiary ${validation.extraQty} szt.`);
    return { text:`Walidacja: ${parts.join(' • ')}`, tone:'is-warn' };
  }

  function makeStatusChip(status){
    const map = {
      ok: { cls:'is-ok', text:'OK' },
      missing: { cls:'is-missing', text:'BRAK' },
      extra: { cls:'is-extra', text:'NADMIAR' },
    };
    const cfg = map[status] || map.ok;
    return h('span', { class:`rozrys-status-chip ${cfg.cls}`, text:cfg.text });
  }


  function buildDimNode(wMm, hMm, unit){
    return h('span', { class:'table-dim' }, [
      h('span', { class:'table-dim__left', text:mmToUnitStr(wMm, unit) }),
      h('span', { class:'table-dim__x', text:'x' }),
      h('span', { class:'table-dim__right', text:mmToUnitStr(hMm, unit) }),
    ]);
  }

  function buildListTable(rows, unit, mode){
    const wrap = h('div', { class:'rozrys-list-table-wrap' });
    const table = h('table', { class:`table-list ${mode === 'sheet' ? 'table-list--parts' : ''}`.trim() });
    if(mode === 'sheet'){
      const colgroup = h('colgroup');
      colgroup.appendChild(h('col', { class:'col-name' }));
      colgroup.appendChild(h('col', { class:'col-dim' }));
      colgroup.appendChild(h('col', { class:'col-qty' }));
      table.appendChild(colgroup);
    }
    const thead = h('thead');
    const headRow = h('tr');
    if(mode === 'sheet'){
      headRow.appendChild(h('th', { class:'col-name', text:'Nazwa' }));
      headRow.appendChild(h('th', { class:'col-dim', text:`Wymiar (${unit})` }));
      headRow.appendChild(h('th', { class:'col-qty', text:'Ilość' }));
    } else {
      ['Formatka', `Wymiar (${unit})`, 'Potrzebne', 'Rozrysowane', 'Różnica', 'Status'].forEach((label)=> headRow.appendChild(h('th', { text:label })));
    }
    thead.appendChild(headRow);
    const tbody = h('tbody');
    (rows || []).forEach((row)=>{
      const tr = h('tr');
      if(mode === 'sheet'){
        tr.appendChild(h('td', { class:'col-name', text: row.name || 'Element' }));
        const dimTd = h('td', { class:'col-dim' });
        dimTd.appendChild(buildDimNode(row.w, row.h, unit));
        tr.appendChild(dimTd);
        tr.appendChild(h('td', { class:'col-qty', text:String(Math.max(0, Number(row.qty) || 0)) }));
      } else {
        tr.appendChild(h('td', { text: row.name || 'Element' }));
        const dimTd = h('td');
        dimTd.appendChild(buildDimNode(row.w, row.h, unit));
        tr.appendChild(dimTd);
        tr.appendChild(h('td', { text:String(Math.max(0, Number(row.expectedQty) || 0)) }));
        tr.appendChild(h('td', { text:String(Math.max(0, Number(row.actualQty) || 0)) }));
        tr.appendChild(h('td', { text:String(Number(row.diff) > 0 ? `+${row.diff}` : row.diff || 0) }));
        const td = h('td');
        td.appendChild(makeStatusChip(row.status));
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function buildRawTable(rows, unit){
    const wrap = h('div', { class:'rozrys-list-table-wrap' });
    const table = h('table', { class:'table-list' });
    const thead = h('thead');
    const headRow = h('tr');
    ['Formatka', `Wymiar (${unit})`, 'Ilość', 'Pomieszczenie', 'Źródło'].forEach((label)=> headRow.appendChild(h('th', { text:label })));
    thead.appendChild(headRow);
    const tbody = h('tbody');
    (rows || []).forEach((row)=>{
      const tr = h('tr');
      tr.appendChild(h('td', { text: row.name || 'Element' }));
      tr.appendChild(h('td', { text: `${mmToUnitStr(row.w, unit)} × ${mmToUnitStr(row.h, unit)}` }));
      tr.appendChild(h('td', { text:String(Math.max(0, Number(row.qty) || 0)) }));
      tr.appendChild(h('td', { text:String(row.room || '—') }));
      tr.appendChild(h('td', { text:String(row.source || '—') }));
      tbody.appendChild(tr);
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function openValidationListModal(material, diag, unit){
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function') || !diag) return;
    const body = h('div');
    const summary = validationSummaryLabel(diag);
    const metaRow = h('div', { class:'rozrys-validation-summary' });
    metaRow.appendChild(h('span', { class:`rozrys-pill ${summary.tone}`, text:summary.text }));
    metaRow.appendChild(h('span', { class:'rozrys-pill is-raw', text:`Raw 1:1: ${diag.rawCount} pozycji` }));
    metaRow.appendChild(h('span', { class:'rozrys-pill is-raw', text:`Lista do rozkroju: ${diag.resolvedRows.length} pozycji` }));
    body.appendChild(metaRow);
    body.appendChild(h('div', { class:'muted xs', style:'margin:10px 0 0', text:'RAW SNAPSHOT 1:1 z Materiałów dla tego rozkroju.' }));
    body.appendChild(buildRawTable(diag.rawRows, unit));
    body.appendChild(h('div', { class:'rozrys-subsection-title', text:'Lista do rozkroju (po scaleniu)' }));
    body.appendChild(buildListTable((diag.resolvedRows || []).map((row)=>({
      name: row.name, w: row.w, h: row.h, expectedQty: row.qty, actualQty: row.qty, diff: 0, status: 'ok'
    })), unit, 'validation'));
    body.appendChild(h('div', { class:'rozrys-subsection-title', text:'Walidacja rozrysu' }));
    body.appendChild(buildListTable(diag.validation.rows, unit, 'validation'));
    FC.panelBox.open({ title:`Lista formatek — ${material}`, contentNode: body, width:'960px' });
  }

  function openSheetListModal(material, sheetTitle, rows, unit){
    if(!(FC.panelBox && typeof FC.panelBox.open === 'function')) return;
    const body = h('div');
    body.appendChild(h('div', { class:'muted xs', style:'margin-bottom:12px', text:'Formatki pogrupowane dla tego arkusza.' }));
    body.appendChild(buildListTable(rows || [], unit, 'sheet'));
    FC.panelBox.open({ title:`${sheetTitle} — ${material}`, contentNode: body, width:'820px' });
  }

  function aggregatePartsForProject(selectedRooms){
    const proj = safeGetProject();
    const rooms = normalizeRoomSelection(Array.isArray(selectedRooms) ? selectedRooms : getRooms());
    if(!proj) return { byMaterial: {}, materials: [], groups: {}, selectedRooms: rooms };

    const groups = {};
    const ensureGroup = (key)=>{
      if(!groups[key]){
        groups[key] = {
          key,
          frontMap: new Map(),
          corpusMap: new Map(),
          sourceMaterials: new Set(),
          rooms: new Set(),
        };
      }
      return groups[key];
    };

    for(const room of rooms){
      const cabinets = (proj[room] && Array.isArray(proj[room].cabinets)) ? proj[room].cabinets : [];
      for(const cab of cabinets){
        if(typeof getCabinetCutList !== 'function') continue;
        const parts = getCabinetCutList(cab, room) || [];
        for(const p of parts){
          const sourceMaterial = String(p.material || '').trim();
          if(!sourceMaterial) continue;
          const resolved = resolveRozrysPartFromSource(p);
          const w = resolved.w;
          const h = resolved.h;
          if(!(w > 0 && h > 0)) continue;
          const qty = resolved.qty;
          if(!(qty > 0)) continue;
          const isFront = (String(resolved.name || '').trim() === 'Front') || isFrontMaterialKey(sourceMaterial);
          const materialKey = resolved.materialKey;
          const name = resolved.name;
          const key = `${resolved.sourceSig}||${resolved.direction}||${w}||${h}`;
          const group = ensureGroup(materialKey);
          group.sourceMaterials.add(sourceMaterial);
          group.rooms.add(room);
          const map = isFront ? group.frontMap : group.corpusMap;
          if(map.has(key)){
            map.get(key).qty += qty;
          } else {
            map.set(key, {
              name,
              w,
              h,
              qty,
              material: materialKey,
              sourceSig: resolved.sourceSig,
              grainMode: resolved.direction,
              ignoreGrain: !!resolved.ignoreGrain,
            });
          }
        }
      }
    }

    const materials = Object.keys(groups).sort((a,b)=>a.localeCompare(b,'pl'));
    const outByMat = {};
    const outGroups = {};
    for(const material of materials){
      const group = groups[material];
      const frontParts = sortRozrysParts(Array.from(group.frontMap.values()));
      const corpusParts = sortRozrysParts(Array.from(group.corpusMap.values()));
      const allParts = sortRozrysParts(frontParts.concat(corpusParts));
      outByMat[material] = allParts;
      outGroups[material] = {
        key: material,
        frontParts,
        corpusParts,
        allParts,
        hasFronts: frontParts.length > 0,
        hasCorpus: corpusParts.length > 0,
        sourceMaterials: Array.from(group.sourceMaterials),
        rooms: Array.from(group.rooms),
      };
    }
    return { byMaterial: outByMat, materials, groups: outGroups, selectedRooms: rooms };
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
    const opt = FC.cutOptimizer;
    if(!opt) return { sheets: [], note: 'Brak modułu cutOptimizer.' };

    const grainOn = !!state.grain;
    const overrides = Object.assign({}, state.grainExceptions || {});
    const edgeStore = loadEdgeStore();

    const partsMm = (parts||[]).map(p=>{
      const sig = partSignature(p);
      const allow = isPartRotationAllowed(p, grainOn, overrides);
      const e = edgeStore[sig] || {};
      return {
        key: sig,
        name: p.name,
        w: p.w,
        h: p.h,
        qty: p.qty,
        material: p.material,
        rotationAllowed: allow,
        edgeW1: !!e.w1,
        edgeW2: !!e.w2,
        edgeH1: !!e.h1,
        edgeH2: !!e.h2,
      };
    });
    const items = opt.makeItems(partsMm);

    const unit = (state.unit === 'mm') ? 'mm' : 'cm';
    const toMm = (v)=> {
      const n = Number(v);
      if(!Number.isFinite(n)) return 0;
      return unit === 'mm' ? Math.round(n) : Math.round(n * 10);
    };

    const W0 = toMm(state.boardW) || 2800;
    const H0 = toMm(state.boardH) || 2070;
    const K  = toMm(state.kerf)   || 4;
    const trim = toMm(state.edgeTrim) || 20; // default 2 cm

    // usable area after edge trimming (equalizing)
    const W = Math.max(10, W0 - 2*trim);
    const H = Math.max(10, H0 - 2*trim);

    let sheets = [];

    if(state.heur === 'super'){
      if(typeof opt.packSuper !== 'function'){
        return { sheets: [], note: 'Brak modułu SUPER (packSuper).' };
      }
      // Multi-start search (few seconds). Best result by (#sheets, waste).
      sheets = opt.packSuper(items, W, H, K, { timeMs: 2600, beamWidth: 140 });
    }
    else if(state.heur === 'panel30'){
      // Panel saw friendly: guillotine-only plan with longer thinking time.
      // Uses the existing Guillotine Beam Search (non-overlapping by construction).
      if(typeof opt.packGuillotineBeam !== 'function'){
        return { sheets: [], note: 'Brak modułu Gilotyna PRO (packGuillotineBeam).' };
      }
      sheets = opt.packGuillotineBeam(items, W, H, K, {
        beamWidth: 260,
        timeMs: 30000,
        cutPref: normalizeCutDirection(state.direction),
        scrapFirst: true,
      });
    }
    else if(state.heur === 'gpro'){
      if(typeof opt.packGuillotineBeam !== 'function'){
        return { sheets: [], note: 'Brak modułu Gilotyna PRO (packGuillotineBeam).' };
      }
      // Dokładne upakowanie (szybciej niż Panel PRO, ale lepiej niż Shelf)
      sheets = opt.packGuillotineBeam(items, W, H, K, {
        beamWidth: 80,
        timeMs: 700,
      });
    } else {
      const dir = normalizeCutDirection(state.direction);
      const toShelfDir = (d)=> (d==='across') ? 'wpoprz' : 'wzdłuż';
      sheets = opt.packShelf(items, W, H, K, toShelfDir(dir));
    }
    // store meta for drawing offset
    return { sheets, meta: { trim, boardW: W0, boardH: H0, unit } };
  }

  function getOptimaxProfilePreset(){
    return {};
  }

  function normalizeCutDirection(dir){
    if(dir === 'start-across' || dir === 'across') return 'start-across';
    if(dir === 'start-optimax' || dir === 'optimax' || dir === 'optima') return 'start-optimax';
    return 'start-along';
  }

  function speedLabel(mode){
    const m = String(mode || 'max').toLowerCase();
    if(m === 'turbo') return 'Turbo';
    if(m === 'dokladnie' || m === 'dokładnie') return 'Dokładnie';
    return 'MAX';
  }

  function directionLabel(dir){
    const norm = normalizeCutDirection(dir);
    if(norm === 'start-across') return 'Pierwsze pasy w poprzek';
    if(norm === 'start-optimax') return 'Opti-max';
    return 'Pierwsze pasy wzdłuż';
  }

  function formatHeurLabel(st){
    if(st && st.heur === 'optimax'){
      return `${speedLabel(st.optimaxProfile || 'max')} • ${directionLabel(st.direction)}`;
    }
    return String((st && st.heur) || '');
  }

  // ===== Panel-saw PRO / Optimax in Web Worker (non-blocking) =====
  // Uwaga: na mobile WebWorker potrafi "zawisnąć" sporadycznie (brak done/error).
  // Dlatego uruchamiamy worker per-run (bez re-używania singletona) + watchdog + hard reset.
  function computePlanPanelProAsync(state, parts, onProgress, control, panelOpts){
    return new Promise((resolve)=>{
      const opt = FC.cutOptimizer;
      if(!opt) return resolve({ sheets: [], note: 'Brak modułu cutOptimizer.' });
      const requestedSpeedMode = opt && typeof opt.normalizeSpeedMode === 'function'
        ? opt.normalizeSpeedMode((panelOpts && (panelOpts.speedMode || panelOpts.optimaxProfile)) || state.optimaxProfile)
        : String(((panelOpts && (panelOpts.speedMode || panelOpts.optimaxProfile)) || state.optimaxProfile || 'max')).toLowerCase();
      const blockMainThreadFallback = requestedSpeedMode === 'max';

      const grainOn = !!state.grain;
      const overrides = Object.assign({}, state.grainExceptions || {});
      const edgeStore = loadEdgeStore();

      const partsMm = (parts||[]).map(p=>{
        const sig = partSignature(p);
        const allow = isPartRotationAllowed(p, grainOn, overrides);
        const e = edgeStore[sig] || {};
        return {
          key: sig,
          name: p.name,
          w: p.w,
          h: p.h,
          qty: p.qty,
          material: p.material,
          rotationAllowed: allow,
          edgeW1: !!e.w1,
          edgeW2: !!e.w2,
          edgeH1: !!e.h1,
          edgeH2: !!e.h2,
        };
      });
      const items = opt.makeItems(partsMm);

      const unit = (state.unit === 'mm') ? 'mm' : 'cm';
      const toMm = (v)=> {
        const n = Number(v);
        if(!Number.isFinite(n)) return 0;
        return unit === 'mm' ? Math.round(n) : Math.round(n * 10);
      };

      const W0 = toMm(state.boardW) || 2800;
      const H0 = toMm(state.boardH) || 2070;
      const K  = toMm(state.kerf)   || 4;
      const trim = toMm(state.edgeTrim) || 20;
      const W = Math.max(10, W0 - 2*trim);
      const H = Math.max(10, H0 - 2*trim);

      // worker per-run (bardziej niezawodne na telefonach)
      let worker = null;
      try{
        // bump query to avoid stale cached worker on GH Pages / mobile browsers
        worker = new Worker('js/app/panel-pro-worker.js?v=20260322_rozrys_baseformat_modal_v1');
      }catch(e){
        if(blockMainThreadFallback){
          return resolve({ sheets: [], note: 'Nie udało się uruchomić Web Workera dla trybu MAX.', workerFailed: true, noSyncFallback: true, meta: { trim, boardW: W0, boardH: H0, unit } });
        }
        // fallback (sync, limited)
        try{
          const startMode = normalizeCutDirection(state.direction);
          const speedMode = FC.cutOptimizer && FC.cutOptimizer.normalizeSpeedMode ? FC.cutOptimizer.normalizeSpeedMode(state.optimaxProfile) : 'max';
          const startStrategy = FC.rozkrojStarts && FC.rozkrojStarts[startMode];
          const speed = FC.rozkrojSpeeds && FC.rozkrojSpeeds[speedMode];
          const packed = speed && typeof speed.pack === 'function'
            ? speed.pack(items, W, H, K, { startStrategy, startMode, speedMode })
            : { sheets: opt.packShelf(items, W, H, K, 'along') };
          return resolve({ sheets: packed.sheets || [], meta: { trim, boardW: W0, boardH: H0, unit } });
        }catch(_){
          return resolve({ sheets: [], note: 'Nie udało się uruchomić Web Worker.', workerFailed: true, meta: { trim, boardW: W0, boardH: H0, unit } });
        }
      }

      let settled = false;
      let tmr = null;

      // allow caller to cancel this run
      const runId = (control && Number(control.runId)) ? Number(control.runId) : 0;
      if(control){
        // If UI requested cancel before we managed to attach a working cancel() (race), honor it.
        const postCancel = ()=>{ try{ worker && worker.postMessage({ cmd:'cancel', runId }); }catch(_){ } };
        control.cancel = ()=>{ control._cancelRequested = true; postCancel(); };
        // If cancel was requested earlier, send it immediately.
        if(control._cancelRequested) postCancel();
      }

      const cleanup = ()=>{
        try{ worker.removeEventListener('message', handle); }catch(_){ }
        try{ worker.removeEventListener('error', onErr); }catch(_){ }
        try{ worker.removeEventListener('messageerror', onMsgErr); }catch(_){ }
        if(tmr){ try{ clearTimeout(tmr); }catch(_){ } tmr = null; }
        try{ worker.terminate(); }catch(_){ }
        worker = null;
      };

      const finish = (payload)=>{
        if(settled) return;
        settled = true;
        cleanup();
        resolve(payload);
      };
      // hard-terminate fallback (used by UI when cancel seems stuck)
      if(control){
        control._terminate = ()=>{
          try{ worker && worker.terminate && worker.terminate(); }catch(_){ }
          // unblock UI even if worker does not respond
          try{ finish({ sheets: [], cancelled: true, note: "Generowanie przerwane.", meta: { trim, boardW: W0, boardH: H0, unit } }); }catch(_){ }
        };
      }


      const handle = (ev)=>{
        const msg = ev && ev.data ? ev.data : {};
        if(msg.type === 'progress'){
          try{ onProgress && onProgress(msg); }catch(_){ }
          return;
        }
        if(msg.type === 'done'){
          const result = msg.result || {};
          finish({ sheets: result.sheets || [], cancelled: !!result.cancelled, meta: { trim, boardW: W0, boardH: H0, unit } });
          return;
        }
        if(msg.type === 'error'){
          finish({ sheets: [], note: msg.error || 'Błąd worker', workerFailed: true, noSyncFallback: !!blockMainThreadFallback, meta: { trim, boardW: W0, boardH: H0, unit } });
        }
      };

      const onErr = ()=>{
        // Worker script failed to load or runtime error
        finish({ sheets: [], note: 'Błąd Web Workera (nie udało się wykonać obliczeń).', workerFailed: true, noSyncFallback: !!blockMainThreadFallback, meta: { trim, boardW: W0, boardH: H0, unit } });
      };

      const onMsgErr = ()=>{
        finish({ sheets: [], note: 'Błąd komunikacji z Web Workerem.', workerFailed: true, noSyncFallback: !!blockMainThreadFallback, meta: { trim, boardW: W0, boardH: H0, unit } });
      };

      worker.addEventListener('message', handle);
      worker.addEventListener('error', onErr);
      worker.addEventListener('messageerror', onMsgErr);

      const o = Object.assign({ startMode: normalizeCutDirection(state.direction), speedMode: String(state.optimaxProfile || 'max').toLowerCase(), sheetEstimate: Number(panelOpts && panelOpts.sheetEstimate) || 1 }, (panelOpts||{}));

      try{
        worker.postMessage({
          cmd: 'panel_pro',
          runId,
          items,
          W, H, K,
          options: o
        });
      }catch(e){
        // Posting failed: cleanup and return
        finish({ sheets: [], note: 'Nie udało się wystartować liczenia.', workerFailed: true, noSyncFallback: !!blockMainThreadFallback, meta: { trim, boardW: W0, boardH: H0, unit } });
      }
    });
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
      const normalized = normalizeMaterialScopeForAggregate(scope, aggregate);
      const modeLabel = normalized.includeFronts && normalized.includeCorpus ? 'Fronty + korpusy' : (normalized.includeFronts ? 'Same fronty' : 'Same korpusy');
      if(normalized.kind !== 'material'){
        return { title:'Wszystkie materiały', subtitle:'', detail:modeLabel };
      }
      const split = splitMaterialAccordionTitle(normalized.material);
      return {
        title: split.line1 || normalized.material || 'Materiał',
        subtitle: split.line2 || '',
        detail: modeLabel
      };
    }

    function getRoomsSummary(rooms){
      const normalized = decodeRoomsSelection(rooms);
      if(!normalized.length) return { title:'Brak pomieszczeń', subtitle:'' };
      if(normalized.length === getRooms().length) return { title:'Wszystkie pomieszczenia', subtitle:normalized.map(roomLabel).join(' • ') };
      if(normalized.length === 1) return { title:roomLabel(normalized[0]), subtitle:'Jedno pomieszczenie' };
      return { title:`${normalized.length} pomieszczenia`, subtitle:normalized.map(roomLabel).join(' • ') };
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
          setSelectedRooms: (rooms)=>{ selectedRooms = rooms; },
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
          setMaterialScope: (nextScope)=>{ materialScope = nextScope; },
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
      if((st && st.heur) !== 'optimax') return computePlan(st, parts);
      const preset = getOptimaxProfilePreset(st.optimaxProfile, st.direction);
      const cutMode = normalizeCutDirection(st.direction);
      const unit2 = (st.unit === 'mm') ? 'mm' : 'cm';
      const toMm2 = (v)=>{
        const n = Number(v);
        if(!Number.isFinite(n)) return 0;
        return unit2 === 'mm' ? Math.round(n) : Math.round(n * 10);
      };
      const W02 = toMm2(st.boardW) || 2800;
      const H02 = toMm2(st.boardH) || 2070;
      const trim2 = toMm2(st.edgeTrim) || 20;
      const minScrapW2 = toMm2(st.minScrapW) || 0;
      const minScrapH2 = toMm2(st.minScrapH) || 0;
      const W2 = Math.max(10, W02 - 2*trim2);
      const H2 = Math.max(10, H02 - 2*trim2);
      const roughArea = (parts||[]).reduce((sum, p)=> sum + ((Number(p.w)||0) * (Number(p.h)||0) * Math.max(1, Number(p.qty)||1)), 0);
      const roughSheetsEstimate = Math.max(1, Math.ceil(roughArea / Math.max(1, W2 * H2)));
      let plan = null;
      const control = { runId:_rozrysRunId };
      try{
        plan = await computePlanPanelProAsync(st, parts, null, control, {
          beamWidth: preset.beamWidth,
          endgameAttempts: preset.endgameAttempts,
          cutPref: cutMode,
          cutMode,
          minScrapW: minScrapW2,
          minScrapH: minScrapH2,
          speedMode: String(st.optimaxProfile || 'max').toLowerCase(),
          optimaxProfile: String(st.optimaxProfile || 'max').toLowerCase(),
          sheetEstimate: roughSheetsEstimate,
          optimax: true,
          realHalfQty: Math.max(0, Number(st.realHalfQty) || 0),
          realHalfBoardW: Math.round(Number(st.realHalfBoardW) || 0),
          realHalfBoardH: Math.round(Number(st.realHalfBoardH) || 0),
        });
      }catch(_){
        plan = null;
      }
      if(plan && Array.isArray(plan.sheets) && plan.sheets.length) return plan;
      const fallback = computePlan(st, parts);
      if(!fallback.meta) fallback.meta = buildPlanMetaFromState(st);
      if(plan && plan.note && !fallback.note) fallback.note = plan.note;
      return fallback;
    }

    async function applySheetStockLimit(material, st, parts, plan, opts){
      if(FC.rozrysStock && typeof FC.rozrysStock.applySheetStockLimit === 'function'){
        return FC.rozrysStock.applySheetStockLimit(material, st, parts, plan, opts, { computePlanWithCurrentEngine });
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
      return {
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
    }


    function tryAutoRenderFromCache(){
      try{
        if(_rozrysRunning) return false;
        const scope = normalizeMaterialScopeForAggregate(decodeMaterialScope(matSel.value), agg);
        const entries = buildEntriesForScope(scope, agg);
        if(!entries.length){
          out.innerHTML = '';
          setGenBtnMode('idle');
          return false;
        }

        const cache = loadPlanCache();
        const stBase = getBaseState();
        const hits = [];
        let allHit = true;
        for(const entry of entries){
          const material = entry.material;
          const parts = entry.parts || [];
          const fullWmm = toMmByUnit(stBase.unit, stBase.boardW) || 2800;
          const fullHmm = toMmByUnit(stBase.unit, stBase.boardH) || 2070;
          const halfStock = getRealHalfStockForMaterial(material, fullWmm, fullHmm);
          const exactStock = getExactSheetStockForMaterial(material, fullWmm, fullHmm);
          const fullStock = getLargestSheetFormatForMaterial(material, fullWmm, fullHmm);
          const hasGrain = materialHasGrain(material);
          const st = Object.assign({}, stBase, {
            material,
            grain: !!(hasGrain && getMaterialGrainEnabled(material, hasGrain)),
            grainExceptions: getMaterialGrainExceptions(material, parts.map((p)=> partSignature(p)), hasGrain),
            selectedRooms: (agg.selectedRooms || []).slice(),
            realHalfQty: Math.max(0, Number(halfStock.qty) || 0),
            realHalfBoardW: Math.round(Number(halfStock.width) || 0),
            realHalfBoardH: Math.round(Number(halfStock.height) || 0),
            stockExactQty: Math.max(0, Number(exactStock.qty) || 0),
            stockFullBoardW: Math.round(Number(fullStock.width) || 0),
            stockFullBoardH: Math.round(Number(fullStock.height) || 0),
            stockPolicy: 'stock_limit_v2',
            stockSignature: buildStockSignatureForMaterial(material),
          });
          const cacheKey = makePlanCacheKey(st, parts);
          if(cache[cacheKey] && cache[cacheKey].plan){
            hits.push({ material, parts, st, plan: cache[cacheKey].plan });
          } else {
            allHit = false;
          }
        }
        const anyHit = renderMaterialAccordionPlans(getAccordionScopeKey(scope, agg), getRozrysScopeMode(scope), hits);
        setGenBtnMode(allHit && anyHit ? 'done' : 'idle');
        return anyHit;
      }catch(_){
        out.innerHTML = '';
        setGenBtnMode('idle');
        return false;
      }
    }

    function buildEntriesForScope(selection, aggregate){
      const scope = normalizeMaterialScopeForAggregate(selection, aggregate);
      const aggRef = aggregate && typeof aggregate === 'object' ? aggregate : aggregatePartsForProject();
      const orderedMaterials = getOrderedMaterialsForSelection(scope, aggRef);
      return orderedMaterials.map((material)=>{
        const group = aggRef.groups && aggRef.groups[material] ? aggRef.groups[material] : null;
        return { material, parts: getGroupPartsForScope(group, scope) };
      }).filter((entry)=> Array.isArray(entry.parts) && entry.parts.length);
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
      const tgt = target || out;
      // Always clear target; otherwise spinners can remain in WSZYSTKIE mode
      // or when re-rendering into an existing box.
      tgt.innerHTML = '';
      const opt = FC.cutOptimizer;
      const sheets = plan.sheets || [];
      const u = (meta && (meta.unit === 'cm' || meta.unit === 'mm'))
        ? meta.unit
        : (meta && meta.meta && (meta.meta.unit === 'cm' || meta.meta.unit === 'mm'))
          ? meta.meta.unit
          : 'mm';
      const diagnostics = buildRozrysDiagnostics(meta && meta.material, meta && meta.scopeMode, meta && meta.parts, plan, meta && meta.selectedRooms);
      const validationLabel = validationSummaryLabel(diagnostics);

      const getSupplyMeta = (sheet)=>{
        const source = String((sheet && sheet.supplySource) || '');
        if(source === 'stock') return { text:'z magazynu', cls:'is-stock' };
        if(source === 'order') return { text:'zamówić', cls:'is-order' };
        return null;
      };

      const getBoardMeta = (sheet)=>{
        const boardW = Math.max(1,
          Number((sheet && sheet.fullBoardW) || (sheet && sheet.boardW) || (meta && meta.meta && meta.meta.boardW) || (meta && meta.boardW) || 0)
        );
        const boardH = Math.max(1,
          Number((sheet && sheet.fullBoardH) || (sheet && sheet.boardH) || (meta && meta.meta && meta.meta.boardH) || (meta && meta.boardH) || 0)
        );
        const trim = Math.max(0,
          Number((sheet && sheet.trimMm) || (meta && meta.meta && meta.meta.trim) || (meta && meta.trim) || 0)
        );
        const referenceBoardW = Math.max(boardW,
          Number((meta && meta.meta && meta.meta.boardW) || (meta && meta.boardW) || 0)
        );
        const referenceBoardH = Math.max(boardH,
          Number((meta && meta.meta && meta.meta.boardH) || (meta && meta.boardH) || 0)
        );
        return { boardW, boardH, trim, referenceBoardW, referenceBoardH };
      };
      const calcDisplayWaste = (sheet)=>{
        const bm = getBoardMeta(sheet);
        const halfBoardW = Math.max(1, Number((sheet && sheet.realHalfBoardW) || (sheet && sheet.virtualBoardW) || bm.boardW) || bm.boardW);
        const halfBoardH = Math.max(1, Number((sheet && sheet.realHalfBoardH) || (sheet && sheet.virtualBoardH) || bm.boardH) || bm.boardH);
        const total = Math.max(0, halfBoardW * halfBoardH);
        const used = opt.placedArea(sheet);
        const waste = Math.max(0, total - used);
        return { total, used, waste, trim: bm.trim, boardW: bm.boardW, boardH: bm.boardH, wasteBoardW: halfBoardW, wasteBoardH: halfBoardH, virtualHalf: !!(sheet && sheet.virtualHalf), realHalf: !!(sheet && (sheet.realHalf || sheet.realHalfFromStock)) };
      };
      if(!sheets.length){
        const msg = (plan && plan.note) ? String(plan.note) : 'Brak wyniku.';
        tgt.appendChild(h('div', { class:'muted', text: msg }));
        return;
      }

      const sheetFraction = (sheet)=>{
        const f = Number(sheet && sheet.virtualFraction);
        return (Number.isFinite(f) && f > 0) ? f : 1;
      };
      const formatSheetCount = (n)=> Number.isInteger(n) ? String(n) : String(n.toFixed(1)).replace('.', ',');
      const sum = sheets.reduce((acc,s)=>{
        const w = calcDisplayWaste(s);
        acc.area += w.total;
        acc.used += w.used;
        acc.waste += w.waste;
        acc.count += sheetFraction(s);
        if(s && s.virtualHalf) acc.hasVirtualHalf = true;
        if(s && (s.realHalf || s.realHalfFromStock)) acc.hasRealHalf = true;
        return acc;
      }, { area:0, used:0, waste:0, count:0, hasVirtualHalf:false, hasRealHalf:false });

      const pct = sum.area>0 ? (sum.waste/sum.area)*100 : 0;

      const cancelledNote = (meta && meta.cancelled) ? '<div class="muted xs" style="margin-top:6px;font-weight:700">Generowanie przerwane — pokazuję najlepszy wynik do tej pory.</div>' : '';
      const realHalfNote = sum.hasRealHalf ? '<div class="muted xs" style="margin-top:6px">Końcówka policzona na realnej połówce z magazynu, ale rysowana na pełnym arkuszu.</div>' : '';
      const virtualNote = sum.hasVirtualHalf ? '<div class="muted xs" style="margin-top:6px">Ostatnia końcówka liczona wirtualnie jako 0,5 płyty, ale rysowana na pełnym arkuszu.</div>' : '';
      const summaryCard = h('div', { class:'card', style:'margin:0' });
      summaryCard.appendChild(h('div', { html:`
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div><strong>Materiał:</strong> ${meta.material}</div>
          <div><strong>Płyty:</strong> ${formatSheetCount(sum.count)} szt.</div>
          <div><strong>Odpad:</strong> ${pct.toFixed(1)}%</div>
        </div>
        ${cancelledNote}
        ${realHalfNote}
        ${virtualNote}
      ` }));
      const validationRow = h('div', { class:'rozrys-validation-summary' });
      validationRow.appendChild(h('span', { class:`rozrys-pill ${validationLabel.tone}`, text:validationLabel.text }));
      if(diagnostics){
        validationRow.appendChild(h('span', { class:'rozrys-pill is-raw', text:`Snapshot: ${diagnostics.resolvedRows.length} pozycji` }));
      }
      summaryCard.appendChild(validationRow);
      tgt.appendChild(summaryCard);

      const expRow = h('div', { class:'rozrys-list-actions', style:'justify-content:flex-end' });
      if(diagnostics){
        const listBtn = h('button', { class:'btn-primary', type:'button', text:'Lista formatek' });
        listBtn.addEventListener('click', ()=> openValidationListModal(meta.material, diagnostics, u));
        expRow.appendChild(listBtn);
      }
      const csvBtn = h('button', { class:'btn-primary', type:'button' });
      csvBtn.textContent = 'Eksport CSV';
      csvBtn.addEventListener('click', ()=>{
        const csv = buildCsv(sheets, meta);
        downloadText('rozrys.csv', csv, 'text/csv;charset=utf-8');
      });
      const pdfBtn = h('button', { class:'btn-primary', type:'button' });
      pdfBtn.textContent = 'Eksport PDF (drukuj)';
      pdfBtn.addEventListener('click', ()=>{
        // HTML do wydruku/PDF: wspólna skala dla wszystkich arkuszy, bez sztucznego powiększania.
        // Duże arkusze idą po 1 na stronę, mniejsze mogą iść po 2 na stronę tylko wtedy,
        // gdy mieszczą się przy tej samej proporcji względem pełnej płyty bazowej.
        const edgeSubMm = Math.max(0, Number(meta.edgeSubMm)||0);
        const escapeHtml = (value)=> String(value == null ? '' : value).replace(/[&<>"]/g, (ch)=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch] || ch));
        const imgs = [];
        const rotatePdfSheets = true;
        try{
          sheets.forEach((s)=>{
            const c = document.createElement('canvas');
            const tmp = document.createElement('div');
            tmp.style.width = '1100px';
            tmp.style.position = 'absolute';
            tmp.style.left = '-99999px';
            tmp.style.top = '0';
            tmp.style.pointerEvents = 'none';
            tmp.appendChild(c);
            document.body.appendChild(tmp);
            drawSheet(c, s, u, edgeSubMm, getBoardMeta(s));
            let exportCanvas = c;
            if(rotatePdfSheets){
              const rotated = document.createElement('canvas');
              rotated.width = c.height || 0;
              rotated.height = c.width || 0;
              const rctx = rotated.getContext('2d');
              if(rctx){
                rctx.translate(rotated.width / 2, rotated.height / 2);
                rctx.rotate(Math.PI / 2);
                rctx.drawImage(c, -(c.width || 0) / 2, -(c.height || 0) / 2);
                exportCanvas = rotated;
              }
            }
            imgs.push({ src:exportCanvas.toDataURL('image/png'), width:exportCanvas.width || 0, height:exportCanvas.height || 0 });
            tmp.remove();
          });
        }catch(_){ }

        const edgeNote = (edgeSubMm>0) ? ` • Wymiary do cięcia: TAK (${edgeSubMm}mm)` : '';
        const printTitle = `Rozrys — ${meta.material}`;
        const printMetaLine = `Płyty: ${formatSheetCount(sum.count)} • Kerf: ${meta.kerf}${u} • Heurystyka: ${meta.heur}${edgeNote}`;
        const PRINT = {
          pageW: 194,
          pageH: 281,
          headerH: measurePrintHeaderMm(printTitle, printMetaLine),
          headerGap: 4,
          bodyPadX: 4,
          bodyPadBottom: 3,
          pageGap: 5,
          itemGap: 5,
          metaH: 6,
          imgPad: 2,
        };
        const refBoard = sheets.reduce((acc, s)=>{
          const bm = getBoardMeta(s);
          const refW = Number((bm && bm.referenceBoardW) || (bm && bm.boardW) || 0);
          const refH = Number((bm && bm.referenceBoardH) || (bm && bm.boardH) || 0);
          return {
            w: Math.max(acc.w, rotatePdfSheets ? refH : refW),
            h: Math.max(acc.h, rotatePdfSheets ? refW : refH),
          };
        }, {
          w: Math.max(1, rotatePdfSheets
            ? Number((meta && meta.boardH) || (meta && meta.meta && meta.meta.boardH) || 0)
            : Number((meta && meta.boardW) || (meta && meta.meta && meta.meta.boardW) || 0)),
          h: Math.max(1, rotatePdfSheets
            ? Number((meta && meta.boardW) || (meta && meta.meta && meta.meta.boardW) || 0)
            : Number((meta && meta.boardH) || (meta && meta.meta && meta.meta.boardH) || 0))
        });
        const bodyW = Math.max(10, PRINT.pageW - PRINT.bodyPadX * 2);
        const bodyH = Math.max(10, PRINT.pageH - PRINT.headerH - PRINT.headerGap - PRINT.bodyPadBottom);
        const globalScaleMm = Math.max(0.01, Math.min(
          (bodyW - 2 * PRINT.imgPad) / Math.max(1, refBoard.w),
          (bodyH - PRINT.metaH - 2 * PRINT.imgPad) / Math.max(1, refBoard.h)
        ));

        const sheetItems = sheets.map((s, i)=>{
          const bm = getBoardMeta(s);
          const ws = calcDisplayWaste(s);
          const sheetWastePct = ws.total > 0 ? ((ws.waste / ws.total) * 100) : 0;
          const virtualTxt = ws.realHalf ? ' • real 0,5 z magazynu' : (ws.virtualHalf ? ' • virtual 0,5 płyty' : '');
          const supply = getSupplyMeta(s);
          const supplyTxt = supply ? ` • ${supply.text}` : '';
          const img = imgs[i] || { src:'', width:0, height:0 };
          const effectiveBoardW = rotatePdfSheets ? Number(bm.boardH || 0) : Number(bm.boardW || 0);
          const effectiveBoardH = rotatePdfSheets ? Number(bm.boardW || 0) : Number(bm.boardH || 0);
          const renderW = Math.max(6, effectiveBoardW * globalScaleMm);
          const renderH = Math.max(6, effectiveBoardH * globalScaleMm);
          return {
            index: i,
            src: img.src || '',
            renderW,
            renderH,
            totalBlockH: PRINT.metaH + PRINT.imgPad + renderH,
            metaHtml: `<strong>Arkusz ${i+1}</strong> — ${mmToUnitStr(bm.boardW, u)}×${mmToUnitStr(bm.boardH, u)} ${u} • Odpad: ${sheetWastePct.toFixed(1)}%${virtualTxt}${supplyTxt}`,
          };
        });

        const canPairOnSamePage = (a, b)=>{
          if(!a || !b) return false;
          const combinedH = a.totalBlockH + b.totalBlockH + PRINT.itemGap;
          const maxW = Math.max(a.renderW, b.renderW) + PRINT.imgPad * 2;
          return combinedH <= bodyH && maxW <= bodyW;
        };

        const pages = [];
        for(let i=0; i<sheetItems.length;){
          const current = sheetItems[i];
          const next = sheetItems[i + 1];
          if(canPairOnSamePage(current, next)){
            pages.push([current, next]);
            i += 2;
            continue;
          }
          pages.push([current]);
          i += 1;
        }

        let html = `<!doctype html><html><head><meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Rozrys</title>
          <style>
            @page{ size:210mm 297mm; margin:8mm; }
            html, body{ margin:0; padding:0; }
            body{ font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color:#111827; }
            .print-page{
              box-sizing:border-box;
              width:194mm;
              height:281mm;
              margin:0;
              page-break-after:always;
              break-after:page;
              page-break-inside:avoid;
              break-inside:avoid-page;
              overflow:hidden;
              display:flex;
              flex-direction:column;
              justify-content:flex-start;
            }
            .print-page:last-child{ page-break-after:auto; break-after:auto; }
            .page-head{ margin:0 0 4mm; min-height:${PRINT.headerH.toFixed(2)}mm; flex:0 0 auto; overflow-wrap:anywhere; word-break:break-word; }
            .title{ font-size:18px; font-weight:800; line-height:1.2; margin:0 0 2mm; overflow-wrap:anywhere; word-break:break-word; }
            .meta{ font-size:12px; line-height:1.35; color:#374151; margin:0; overflow-wrap:anywhere; word-break:break-word; }
            .page-body{
              flex:1 1 auto;
              min-height:0;
              width:100%;
              box-sizing:border-box;
              padding:0 ${PRINT.bodyPadX.toFixed(2)}mm ${PRINT.bodyPadBottom.toFixed(2)}mm;
              display:flex;
              flex-direction:column;
              align-items:flex-start;
              justify-content:flex-start;
              gap:${PRINT.itemGap.toFixed(2)}mm;
              overflow:hidden;
            }
            .sheet-card{
              width:100%;
              flex:0 0 auto;
              display:flex;
              flex-direction:column;
              align-items:flex-start;
              page-break-inside:avoid;
              break-inside:avoid-page;
            }
            .sheet-meta{ font-size:12px; color:#111827; margin:0 0 2mm; }
            .img-wrap{
              width:100%;
              display:flex;
              align-items:flex-start;
              justify-content:flex-start;
              overflow:hidden;
            }
            img.sheet-img{
              display:block;
              width:auto;
              height:auto;
              max-width:none;
              max-height:none;
              border:1px solid #333;
              border-radius:10px;
              background:#fff;
            }
          </style>
        </head><body>`;
        pages.forEach((group)=>{
          html += `<section class="print-page">`;
          html += `<div class="page-head">`;
          html += `<div class="title">${escapeHtml(printTitle)}</div>`;
          html += `<p class="meta">${escapeHtml(printMetaLine)}</p>`;
          html += `</div>`;
          html += `<div class="page-body">`;
          group.forEach((item)=>{
            html += `<article class="sheet-card">`;
            html += `<p class="sheet-meta">${item.metaHtml}</p>`;
            html += `<div class="img-wrap"><img class="sheet-img" src="${item.src}" alt="Arkusz ${item.index + 1}" style="width:${item.renderW.toFixed(2)}mm;height:${item.renderH.toFixed(2)}mm" /></div>`;
            html += `</article>`;
          });
          html += `</div>`;
          html += `</section>`;
        });
        html += `</body></html>`;
        openPrintView(html);
      });
      expRow.appendChild(csvBtn);
      expRow.appendChild(pdfBtn);
      tgt.appendChild(expRow);

      const edgeSubMm = Math.max(0, Number(meta.edgeSubMm)||0);
      sheets.forEach((s,i)=>{
        const box = h('div', { class:'card', style:'margin-top:12px' });
        const bm = getBoardMeta(s);
        const ws = calcDisplayWaste(s);
        const sheetWastePct = ws.total > 0 ? ((ws.waste / ws.total) * 100) : 0;
        const head = h('div', { style:'display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start' });
        head.appendChild(h('div', { style:'font-weight:900', text:`Arkusz ${i+1} • odpad ${sheetWastePct.toFixed(1)}%${ws.realHalf ? ' • real 0,5 z magazynu' : (ws.virtualHalf ? ' • virtual 0,5 płyty' : '')}` }));
        const tools = h('div', { class:'rozrys-sheet-tools' });
        const supplyMeta = getSupplyMeta(s);
        if(supplyMeta){
          tools.appendChild(h('span', { class:`rozrys-stock-chip ${supplyMeta.cls}`, text:supplyMeta.text }));
        }
        if(diagnostics && diagnostics.sheets && diagnostics.sheets[i]){
          const sheetBtn = h('button', { class:'btn', type:'button', text:'Formatki arkusza' });
          sheetBtn.addEventListener('click', ()=> openSheetListModal(meta.material, `Arkusz ${i+1}`, diagnostics.sheets[i].rows, u));
          tools.appendChild(sheetBtn);
        }
        tools.appendChild(h('div', { class:'muted xs', text:`${mmToUnitStr(bm.boardW, u)}×${mmToUnitStr(bm.boardH, u)} ${u}` }));
        head.appendChild(tools);
        box.appendChild(head);
        const canvas = document.createElement('canvas');
        canvas.style.marginTop = '10px';
        canvas.style.display = 'block';
        canvas.style.maxWidth = '100%';
        box.appendChild(canvas);
        tgt.appendChild(box);
        canvas.dataset.rozrysSheet = '1';
        canvas.__rozrysDrawPayload = { sheet: s, displayUnit: u, edgeSubMm, boardMeta: getBoardMeta(s) };
        drawSheet(canvas, s, u, edgeSubMm, getBoardMeta(s));
      });
    }

    function renderLoading(text){
      return renderLoadingInto(null, text);
    }

    function renderLoadingInto(target, text, subText){
      const tgt = target || out;
      tgt.innerHTML = '';
      const box = h('div', { class:'rozrys-loading' });
      const top = h('div', { class:'rozrys-loading-top' });
      const spinner = h('div', { class:'rozrys-spinner' });
      const copy = h('div', { class:'rozrys-status-copy' });
      const textEl = h('div', { class:'rozrys-loading-text', text: text || 'Liczę…' });
      const subEl = h('div', { class:'muted xs rozrys-loading-sub', text: subText || '' });
      const progWrap = h('div', { class:'rozrys-progress is-indeterminate' });
      const progBar = h('div', { class:'rozrys-progress-bar' });
      const metaEl = h('div', { class:'muted xs rozrys-progress-meta', text:'Startuję liczenie…' });
      progWrap.appendChild(progBar);
      copy.appendChild(textEl);
      copy.appendChild(subEl);
      copy.appendChild(progWrap);
      copy.appendChild(metaEl);
      top.appendChild(spinner);
      top.appendChild(copy);
      box.appendChild(top);
      tgt.appendChild(box);
      return {
        box, textEl, subEl, progWrap, progBar, metaEl, target: tgt,
        setProgress(percent, metaText){
          const n = Number(percent);
          if(Number.isFinite(n)) {
            progWrap.classList.remove('is-indeterminate');
            progBar.style.width = `${Math.max(0, Math.min(100, n))}%`;
          } else {
            progWrap.classList.add('is-indeterminate');
            progBar.style.width = '';
          }
          if(typeof metaText === 'string') metaEl.textContent = metaText;
        }
      };
    }

    
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

function deriveAggForMode(mode, aggregate){
  // mode: 'all' | 'fronts' | 'nofronts'
  const accByMat = {};
  const pushPart = (matKey, p)=>{
    const key = `${p.name}||${p.w}||${p.h}`;
    accByMat[matKey] = accByMat[matKey] || new Map();
    const map = accByMat[matKey];
    if(map.has(key)) map.get(key).qty += Number(p.qty)||0;
    else map.set(key, { name:p.name, w:p.w, h:p.h, qty:Number(p.qty)||1, material: matKey });
  };
  const aggRef = aggregate && typeof aggregate === 'object' ? aggregate : aggregatePartsForProject();
  for(const mat of aggRef.materials){
    const parts = aggRef.byMaterial[mat] || [];
    for(const p of parts){
      const isFront = (p.name === "Front") || isFrontMaterialKey(p.material);
      if(mode === "fronts" && !isFront) continue;
      if(mode === "nofronts" && isFront) continue;
      const matKey = (mode === "all") ? normalizeFrontLaminatMaterialKey(p.material) : p.material;
      pushPart(matKey, Object.assign({}, p, { material: matKey }));
    }
  }
  const materials = Object.keys(accByMat).sort((a,b)=>a.localeCompare(b,"pl"));
  const byMaterial = {};
  for(const m of materials){
    byMaterial[m] = Array.from(accByMat[m].values()).sort((a,b)=>{
      const aa = Math.max(a.w,a.h);
      const bb = Math.max(b.w,b.h);
      return bb-aa;
    });
  }
  return { byMaterial, materials };
}

let _rozrysRunId = 0;
let _rozrysRunning = false;
function setGlobalStatus(active, title, subtitle, percent, metaText){
  try{
    statusBox.style.display = 'none';
    statusMain.textContent = 'Liczę…';
    statusSub.textContent = '';
    statusMeta.textContent = '';
    statusProg.classList.add('is-indeterminate');
    statusProgBar.style.width = '';
  }catch(_){ }
}
try{ setGlobalStatus(false); }catch(_){ }
let _rozrysBtnMode = 'idle'; // idle | running | done
let _rozrysCancelRequested = false;
let _rozrysActiveCancel = null;
let _rozrysCancelTmr = null;
let _rozrysActiveTerminate = null;

function setGenBtnMode(mode){
  _rozrysBtnMode = mode;
  genBtn.classList.remove('btn-generate-green', 'btn-generate-blue', 'btn-generate-red');
  if(mode === 'running'){
    genBtn.textContent = 'Anuluj';
    genBtn.classList.add('btn-generate-red');
    genBtn.disabled = false;
    return;
  }
  if(mode === 'done'){
    genBtn.textContent = 'Generuj ponownie';
    genBtn.classList.add('btn-generate-blue');
    genBtn.disabled = false;
    return;
  }
  // idle = brak zapamiętanego rozkroju dla aktualnych ustawień
  genBtn.textContent = 'Generuj rozkrój';
  genBtn.classList.add('btn-generate-green');
  genBtn.disabled = false;
}

function requestCancel(){
  if(!_rozrysRunning) return;
  _rozrysCancelRequested = true;
  try{ setGlobalStatus(true, 'Anulowanie…', 'Wysyłam przerwanie do workera.', NaN, 'Jeśli worker nie odpowie, za chwilę wymuszę zatrzymanie.'); }catch(_){ }
  try{ _rozrysActiveCancel && _rozrysActiveCancel(); }catch(_){ }
  // twardy fallback: jeśli worker nie odpowie, terminate żeby UI nie wisiało
  if(_rozrysCancelTmr){ try{ clearTimeout(_rozrysCancelTmr); }catch(_){ } _rozrysCancelTmr = null; }
  _rozrysCancelTmr = setTimeout(()=>{
    if(!_rozrysRunning) return;
    try{ _rozrysActiveTerminate && _rozrysActiveTerminate(); }catch(_){ }
  }, 700);
}

async function generate(force){
  if(_rozrysRunning) return;
  _rozrysRunning = true;
  _rozrysCancelRequested = false;
  const runId = (++_rozrysRunId);
  setGenBtnMode('running');
  try{ await new Promise((resolve)=>{
    try{ requestAnimationFrame(()=> resolve()); }
    catch(_){ setTimeout(resolve, 0); }
  }); }catch(_){ }
  try{
  const scope = normalizeMaterialScopeForAggregate(decodeMaterialScope(matSel.value), agg);
  const baseSt = {
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

  const cache = loadPlanCache();

  const overallStartedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  let _overallTick = null;
  let _globalProgressInfo = { material:'', profile:'MAX', phase:'main', bestSheets:null, currentSheet:0, nextSheet:1, remaining:null, sheetEstimate:1, axis:null, seedIndex:null, seedTotal:null };
  function fmtElapsed(ms){ return `${(Math.max(0, Number(ms)||0)/1000).toFixed(1)} s`; }
  function axisProgressLabel(axis){ return axis === 'along' ? 'wzdłuż' : (axis === 'across' ? 'w poprzek' : '—'); }
  function buildProgressMeta(info, estimate){
    const phase = String(info && info.phase || 'main');
    const currentSheet = Math.max(0, Number(info && info.currentSheet) || 0);
    const nextSheet = Math.max(1, Number(info && info.nextSheet) || (currentSheet > 0 ? currentSheet + 1 : 1));
    const seedIndex = Number(info && info.seedIndex) || 0;
    const seedTotal = Number(info && info.seedTotal) || 0;
    const axisTxt = axisProgressLabel((info && info.axis) || (info && info.to) || null);
    const suffix = (seedIndex > 0 && seedTotal > 0) ? ` • wariant ${seedIndex}/${seedTotal}` : '';
    if(phase === 'sheet-closed'){
      return (Number(info && info.remaining) || 0) > 0
        ? `Postęp: zamknięta płyta ${currentSheet} z ~${estimate} • liczę płytę ${nextSheet}`
        : `Postęp: zamknięta płyta ${currentSheet} z ~${estimate}`;
    }
    if(phase === 'sheet-start') return `Start płyty ${nextSheet} z ~${estimate}`;
    if(phase === 'mandatory-axis-switch') return `Zmiana kierunku pasów: teraz ${axisTxt}`;
    if(phase === 'axis-switch-check') return `Brak idealnego pasa ${axisTxt} — sprawdzam drugi kierunek`;
    if(phase === 'axis-switched') return `Przełączono kierunek pasów na ${axisTxt}`;
    if(phase === 'fallback-band-used') return `Brak idealnego pasa — używam najlepszego dostępnego ${axisTxt}`;
    if(phase.indexOf('start') === 0) return `Analiza pasów startowych ${axisTxt}${suffix}`;
    if(phase.indexOf('residual') === 0) return `Domykanie arkusza pasami ${axisTxt}${suffix}`;
    if(currentSheet > 0) return `Postęp: zamknięta płyta ${currentSheet} z ~${estimate} • liczę płytę ${nextSheet}`;
    return 'Trwa liczenie — worker odpowiada w tle.';
  }
  function progressPercent(info, estimate){
    const currentSheet = Math.max(0, Number(info && info.currentSheet) || 0);
    return currentSheet > 0 ? Math.min(98, (currentSheet / Math.max(estimate, currentSheet)) * 100) : NaN;
  }
  function refreshGlobalTicker(){
    try{
      if(!_rozrysRunning) return;
      const prof = String(_globalProgressInfo.profile || 'MAX');
      const elapsed = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - overallStartedAt;
      const bestTxt = _globalProgressInfo.bestSheets ? `${_globalProgressInfo.bestSheets} płyt` : '—';
      const estimate = Math.max(1, Number(_globalProgressInfo.sheetEstimate) || 1);
      const pct = progressPercent(_globalProgressInfo, estimate);
      const subtitle = `Liczę kolor: ${_globalProgressInfo.material || '—'} • Szacunek: ~${estimate} płyt • Najlepsze: ${bestTxt}`;
      const meta = buildProgressMeta(_globalProgressInfo, estimate);
      setGlobalStatus(true, `${prof} • ${fmtElapsed(elapsed)}`, subtitle, pct, meta);
    }catch(_){ }
  }
  function startGlobalTicker(material, profile, sheetEstimate){
    _globalProgressInfo.material = material || '';
    _globalProgressInfo.profile = profile || 'D';
    _globalProgressInfo.phase = 'main';
    _globalProgressInfo.bestSheets = null;
    _globalProgressInfo.currentSheet = 0;
    _globalProgressInfo.nextSheet = 1;
    _globalProgressInfo.remaining = null;
    _globalProgressInfo.sheetEstimate = Math.max(1, Number(sheetEstimate) || 1);
    _globalProgressInfo.axis = null;
    _globalProgressInfo.seedIndex = null;
    _globalProgressInfo.seedTotal = null;
    refreshGlobalTicker();
    if(_overallTick) return;
    _overallTick = setInterval(refreshGlobalTicker, 250);
  }
  function stopGlobalTicker(){
    try{ if(_overallTick) clearInterval(_overallTick); }catch(_){ }
    _overallTick = null;
  }

  const runOne = async (material, parts, target)=>{
    if(runId !== _rozrysRunId) return;
    const hasGrain = materialHasGrain(material);
    const st = Object.assign({}, baseSt, { material, grain: !!(hasGrain && getMaterialGrainEnabled(material, hasGrain)), grainExceptions: getMaterialGrainExceptions(material, parts.map((p)=> partSignature(p)), hasGrain) });
    const unit3 = (st.unit === 'mm') ? 'mm' : 'cm';
    const toMm3 = (v)=>{
      const n = Number(v);
      if(!Number.isFinite(n)) return 0;
      return unit3 === 'mm' ? Math.round(n) : Math.round(n * 10);
    };
    const fullWmmForStock = toMm3(st.boardW) || 2800;
    const fullHmmForStock = toMm3(st.boardH) || 2070;
    const halfStock = getRealHalfStockForMaterial(material, fullWmmForStock, fullHmmForStock);
    st.realHalfQty = Math.max(0, Number(halfStock.qty) || 0);
    st.realHalfBoardW = Math.round(Number(halfStock.width) || 0);
    st.realHalfBoardH = Math.round(Number(halfStock.height) || 0);
    const exactStock = getExactSheetStockForMaterial(material, fullWmmForStock, fullHmmForStock);
    const fullStock = getLargestSheetFormatForMaterial(material, fullWmmForStock, fullHmmForStock);
    st.stockExactQty = Math.max(0, Number(exactStock.qty) || 0);
    st.stockFullBoardW = Math.round(Number(fullStock.width) || 0);
    st.stockFullBoardH = Math.round(Number(fullStock.height) || 0);
    st.stockPolicy = 'stock_limit_v2';
    st.stockSignature = buildStockSignatureForMaterial(material);
    const cacheKey = makePlanCacheKey(st, parts);
    if(!force && cache[cacheKey] && cache[cacheKey].plan){
      const cached = cache[cacheKey].plan;
      if(runId !== _rozrysRunId) return;
      renderOutput(cached, { material, kerf: st.kerf, heur: formatHeurLabel(st), unit: st.unit, edgeSubMm: st.edgeSubMm, meta: cached.meta, parts, scopeMode: getRozrysScopeMode(scope), selectedRooms: agg.selectedRooms }, target);
      setGenBtnMode('done');
      return;
    }

    // Optimax mode: profile-driven worker for strip-oriented cut styles.
    if(st.heur === "optimax"){
      const preset = getOptimaxProfilePreset(st.optimaxProfile, st.direction);
      const cutMode = normalizeCutDirection(st.direction);
      const unit2 = (st.unit === 'mm') ? 'mm' : 'cm';
      const toMm2 = (v)=>{
        const n = Number(v);
        if(!Number.isFinite(n)) return 0;
        return unit2 === 'mm' ? Math.round(n) : Math.round(n * 10);
      };
      const W02 = toMm2(st.boardW) || 2800;
      const H02 = toMm2(st.boardH) || 2070;
      const K2  = toMm2(st.kerf)   || 4;
      const trim2 = toMm2(st.edgeTrim) || 20;
      const minScrapW2 = toMm2(st.minScrapW) || 0;
      const minScrapH2 = toMm2(st.minScrapH) || 0;
      const W2 = Math.max(10, W02 - 2*trim2);
      const H2 = Math.max(10, H02 - 2*trim2);
      const roughArea = (parts||[]).reduce((sum, p)=> sum + ((Number(p.w)||0) * (Number(p.h)||0) * Math.max(1, Number(p.qty)||1)), 0);
      const roughSheetsEstimate = Math.max(1, Math.ceil(roughArea / Math.max(1, W2 * H2)));

      const profileLabel = speedLabel(st.optimaxProfile || 'max');
      const loading = renderLoadingInto(target || null, `${profileLabel} • ${directionLabel(st.direction)} • 0.0 s`, `Liczę kolor: ${material} • Szacunek: ~${roughSheetsEstimate} płyt • Najlepsze: —`);
      startGlobalTicker(material, profileLabel, roughSheetsEstimate);
      const materialStartedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const materialProgress = { phase:'main', bestSheets:null, currentSheet:0, nextSheet:1, remaining:null, sheetEstimate:roughSheetsEstimate, axis:null, seedIndex:null, seedTotal:null };
      function refreshMaterialTicker(){
        try{
          const elapsed = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - materialStartedAt;
          const bestTxt = materialProgress.bestSheets ? `${materialProgress.bestSheets} płyt` : '—';
          const currentSheet = Math.max(0, Number(materialProgress.currentSheet) || 0);
          const est = Math.max(1, Number(materialProgress.sheetEstimate) || roughSheetsEstimate || 1);
          const pct = progressPercent(materialProgress, est);
          const metaText = buildProgressMeta(materialProgress, est);
          if(loading && loading.textEl) loading.textEl.textContent = `${profileLabel} • ${directionLabel(st.direction)} • ${fmtElapsed(elapsed)}`;
          if(loading && loading.subEl) loading.subEl.textContent = `Liczę kolor: ${material} • Szacunek: ~${est} płyt • Najlepsze: ${bestTxt}`;
          if(loading && typeof loading.setProgress === 'function') loading.setProgress(pct, metaText);
          _globalProgressInfo.material = material;
          _globalProgressInfo.profile = profileLabel;
          _globalProgressInfo.phase = materialProgress.phase;
          _globalProgressInfo.bestSheets = materialProgress.bestSheets;
          _globalProgressInfo.currentSheet = currentSheet;
          _globalProgressInfo.nextSheet = Math.max(1, Number(materialProgress.nextSheet) || (currentSheet > 0 ? currentSheet + 1 : 1));
          _globalProgressInfo.remaining = materialProgress.remaining;
          _globalProgressInfo.sheetEstimate = est;
          _globalProgressInfo.axis = materialProgress.axis;
          _globalProgressInfo.seedIndex = materialProgress.seedIndex;
          _globalProgressInfo.seedTotal = materialProgress.seedTotal;
          refreshGlobalTicker();
        }catch(_){ }
      }
      const materialTicker = setInterval(refreshMaterialTicker, 250);
      refreshMaterialTicker();
      try{
        if(loading && typeof loading.setProgress === 'function') loading.setProgress(NaN, 'Inicjalizacja workera…');
        if(loading && loading.subEl) loading.subEl.textContent = `Liczę kolor: ${material} • Szacunek: ~${roughSheetsEstimate} płyt • Start workera…`;
        setGlobalStatus(true, `${profileLabel} • ${directionLabel(st.direction)} • 0.0 s`, `Liczę kolor: ${material} • Szacunek: ~${roughSheetsEstimate} płyt • Start workera…`, NaN, 'Inicjalizacja workera…');
      }catch(_){ }
      let plan = null;
      const control = { runId };
      _rozrysActiveCancel = ()=>{
        try{ control._cancelRequested = true; }catch(_){ }
        try{ control.cancel && control.cancel(); }catch(_){ }
      };
      _rozrysActiveTerminate = ()=>{
        try{ control._terminate && control._terminate(); }catch(_){ }
      };
      try{
        plan = await computePlanPanelProAsync(st, parts, (p)=>{
          try{
            materialProgress.phase = (p && p.phase) ? String(p.phase) : 'main';
            materialProgress.bestSheets = (p && Number(p.bestSheets)) ? Number(p.bestSheets) : null;
            materialProgress.currentSheet = (p && typeof p.currentSheet === 'number') ? Number(p.currentSheet) : materialProgress.currentSheet;
            materialProgress.nextSheet = (p && typeof p.nextSheet === 'number') ? Number(p.nextSheet) : materialProgress.nextSheet;
            materialProgress.remaining = (p && typeof p.remaining === 'number') ? Number(p.remaining) : materialProgress.remaining;
            materialProgress.sheetEstimate = (p && Number(p.sheetEstimate)) ? Number(p.sheetEstimate) : materialProgress.sheetEstimate;
            materialProgress.axis = (p && p.axis) ? String(p.axis) : materialProgress.axis;
            materialProgress.seedIndex = (p && typeof p.seedIndex === 'number') ? Number(p.seedIndex) : materialProgress.seedIndex;
            materialProgress.seedTotal = (p && typeof p.seedTotal === 'number') ? Number(p.seedTotal) : materialProgress.seedTotal;
            refreshMaterialTicker();
          }catch(_){ }
        }, control, {
          beamWidth: preset.beamWidth,
          endgameAttempts: preset.endgameAttempts,
          cutPref: cutMode,
          cutMode,
          minScrapW: minScrapW2,
          minScrapH: minScrapH2,
          speedMode: String(st.optimaxProfile || 'max').toLowerCase(),
          optimaxProfile: String(st.optimaxProfile || 'max').toLowerCase(),
          sheetEstimate: roughSheetsEstimate,
          optimax: true,
          realHalfQty: Math.max(0, Number(st.realHalfQty) || 0),
          realHalfBoardW: Math.round(Number(st.realHalfBoardW) || 0),
          realHalfBoardH: Math.round(Number(st.realHalfBoardH) || 0),
        });
      }catch(e){
        plan = { sheets: [], note: 'Błąd podczas liczenia (Optimax).' };
      } finally {
        try{ clearInterval(materialTicker); }catch(_){ }
        _rozrysActiveCancel = null;
        _rozrysActiveTerminate = null;
        if(_rozrysCancelTmr){ try{ clearTimeout(_rozrysCancelTmr); }catch(_){ } _rozrysCancelTmr = null; }
      }

      // Jeśli worker timeout/wywalił się — daj szybki fallback zamiast "Brak wyniku".
      // Dla MAX nie schodzimy już na synchroniczny fallback na głównym wątku,
      // bo to zamraża UI i sprawia wrażenie zawieszenia jeszcze przed startem.
      if((!plan || !Array.isArray(plan.sheets) || plan.sheets.length === 0) && !(plan && plan.noSyncFallback)){
        try{
          const opt2 = FC.cutOptimizer;
          const grainOn2 = !!st.grain;
          const overrides2 = Object.assign({}, st.grainExceptions || {});
          const edgeStore2 = loadEdgeStore();
          const partsMm2 = (parts||[]).map(p=>{
            const sig = partSignature(p);
            const allow = isPartRotationAllowed(p, grainOn2, overrides2);
            const e = edgeStore2[sig] || {};
            return {
              key: sig,
              name: p.name,
              w: p.w,
              h: p.h,
              qty: p.qty,
              material: p.material,
              rotationAllowed: allow,
              edgeW1: !!e.w1,
              edgeW2: !!e.w2,
              edgeH1: !!e.h1,
              edgeH2: !!e.h2,
            };
          });
          const items2 = opt2.makeItems(partsMm2);
          const unit2 = (st.unit === 'mm') ? 'mm' : 'cm';
          const toMm2 = (v)=>{
            const n = Number(v);
            if(!Number.isFinite(n)) return 0;
            return unit2 === 'mm' ? Math.round(n) : Math.round(n * 10);
          };
          const W02 = toMm2(st.boardW) || 2800;
          const H02 = toMm2(st.boardH) || 2070;
          const K2  = toMm2(st.kerf)   || 4;
          const trim2 = toMm2(st.edgeTrim) || 20;
          const minScrapW2 = toMm2(st.minScrapW) || 0;
          const minScrapH2 = toMm2(st.minScrapH) || 0;
          const W2 = Math.max(10, W02 - 2*trim2);
          const H2 = Math.max(10, H02 - 2*trim2);
          const startMode2 = normalizeCutDirection(st.direction);
          const speedMode2 = FC.cutOptimizer && FC.cutOptimizer.normalizeSpeedMode ? FC.cutOptimizer.normalizeSpeedMode(st.optimaxProfile) : 'max';
          const startStrategy2 = FC.rozkrojStarts && FC.rozkrojStarts[startMode2];
          const speed2 = FC.rozkrojSpeeds && FC.rozkrojSpeeds[speedMode2];
          const packed2 = speed2 && typeof speed2.pack === 'function'
            ? speed2.pack(items2, W2, H2, K2, {
                startStrategy: startStrategy2,
                startMode: startMode2,
                speedMode: speedMode2,
                realHalfQty: Math.max(0, Number(st.realHalfQty) || 0),
                realHalfBoardW: Math.round(Number(st.realHalfBoardW) || 0),
                realHalfBoardH: Math.round(Number(st.realHalfBoardH) || 0),
              })
            : { sheets: opt2.packShelf(items2, W2, H2, K2, 'along') };
          plan = { sheets: packed2.sheets || [], cancelled: !!(plan && plan.cancelled), meta: { trim: trim2, boardW: W02, boardH: H02, unit: unit2 }, note: plan && plan.note ? plan.note : undefined };
        }catch(_){ }
      }
      plan = await applySheetStockLimit(material, st, parts, plan, {
        onStatus: (message)=>{
          try{
            if(loading && loading.subEl) loading.subEl.textContent = `Liczę kolor: ${material} • ${message}`;
            setGlobalStatus(true, `${profileLabel} • ${directionLabel(st.direction)} • ${fmtElapsed(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - materialStartedAt)}`, `Liczę kolor: ${material} • ${message}`, NaN, message);
          }catch(_){ }
        }
      });
      try{ cache[cacheKey] = { ts: Date.now(), plan }; savePlanCache(cache); }catch(_){}
      renderOutput(plan, { material, kerf: st.kerf, heur: formatHeurLabel(st), unit: st.unit, edgeSubMm: st.edgeSubMm, meta: plan.meta, cancelled: !!plan.cancelled, parts, scopeMode: getRozrysScopeMode(scope), selectedRooms: agg.selectedRooms }, target);
      try{ setGlobalStatus(false, '', ''); }catch(_){ }
      setGenBtnMode('done');
      return;
    }

    let plan = computePlan(st, parts);
    plan = await applySheetStockLimit(material, st, parts, plan);
    try{ cache[cacheKey] = { ts: Date.now(), plan }; savePlanCache(cache); }catch(_){}
    renderOutput(plan, { material, kerf: st.kerf, heur: formatHeurLabel(st), unit: st.unit, edgeSubMm: st.edgeSubMm, meta: plan.meta, parts, scopeMode: getRozrysScopeMode(scope), selectedRooms: agg.selectedRooms }, target);
    setGenBtnMode('done');
  };

  out.innerHTML = "";
  const entries = buildEntriesForScope(scope, agg);
  if(!entries.length){
    out.appendChild(h('div', { class:'muted', text:'Brak elementów do wygenerowania dla wybranego zakresu.' }));
    return;
  }
  const accordionScopeKey = getAccordionScopeKey(scope, agg);
  const accordionPref = getAccordionPref(accordionScopeKey);
  for(const entry of entries){
    const material = entry.material;
    const parts = entry.parts || [];
    if(!parts.length) continue;
    const hasGrain = materialHasGrain(material);
    const grainEnabled = hasGrain ? getMaterialGrainEnabled(material, hasGrain) : false;
    const section = createMaterialAccordionSection(material, {
      open: !!(accordionPref && accordionPref.open && accordionPref.material === material),
      grain: hasGrain,
      grainEnabled,
      grainDisabled: !hasGrain,
      onToggle: (isOpen, materialName)=> setAccordionPref(accordionScopeKey, materialName, isOpen),
      onGrainToggle: (checked)=>{
        setMaterialGrainEnabled(material, checked, hasGrain);
        tryAutoRenderFromCache();
      },
      onExceptionsClick: ()=> openMaterialGrainExceptions(material, parts || [])
    });
    out.appendChild(section.wrap);
    await runOne(material, parts, section.body);
    if(_rozrysCancelRequested) break;
  }
  } finally {
    _rozrysRunning = false;
    try{ stopGlobalTicker(); }catch(_){ }
    try{ setGlobalStatus(false); }catch(_){ }
    if(_rozrysBtnMode === 'running') setGenBtnMode('idle');
  }
}

// events
    unitSel.addEventListener('change', ()=>{
      applyUnitChange(unitSel.value);
      persistOptionPrefs();
      tryAutoRenderFromCache();
    });

    matSel.addEventListener('change', ()=>{
      materialScope = normalizeMaterialScopeForAggregate(decodeMaterialScope(matSel.value), agg);
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
      if(!(FC.magazyn && (FC.magazyn.addSheetStock || FC.magazyn.upsertSheet))){
        openRozrysInfo('Brak modułu magazynu', 'Nie udało się zapisać formatu, bo moduł Magazynu nie jest dostępny.');
        return;
      }
      if(!(FC.panelBox && typeof FC.panelBox.open === 'function')){
        openRozrysInfo('Brak panelu', 'Nie udało się otworzyć okna dodawania płyty.');
        return;
      }
      const scope = normalizeMaterialScopeForAggregate(decodeMaterialScope(matSel.value), agg);
      const currentMaterial = scope.kind === 'material' && scope.material ? scope.material : '';
      const body = h('div');
      const form = h('div', { class:'grid-2', style:'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px' });

      const materialWrap = h('div', { style:'grid-column:1 / -1' });
      materialWrap.appendChild(h('label', { text:'Materiał' }));
      let materialControl = null;
      if(currentMaterial){
        materialControl = h('input', { type:'text', value: currentMaterial, readonly:'readonly' });
      }else{
        const select = h('select');
        select.appendChild(h('option', { value:'', text:'Wybierz materiał' }));
        (agg.materials || []).forEach((material)=>{
          const split = splitMaterialAccordionTitle(material);
          const option = h('option', { value:material, text:[split.line1 || material, split.line2 || ''].filter(Boolean).join(' • ') });
          select.appendChild(option);
        });
        materialControl = select;
      }
      materialWrap.appendChild(materialControl);
      form.appendChild(materialWrap);

      const widthWrap = h('div');
      widthWrap.appendChild(h('label', { text:`Szerokość płyty (${unitSel.value})` }));
      const widthInput = h('input', { type:'number', value:String(inW.value || '') });
      widthWrap.appendChild(widthInput);
      form.appendChild(widthWrap);

      const heightWrap = h('div');
      heightWrap.appendChild(h('label', { text:`Wysokość płyty (${unitSel.value})` }));
      const heightInput = h('input', { type:'number', value:String(inH.value || '') });
      heightWrap.appendChild(heightInput);
      form.appendChild(heightWrap);

      const qtyWrap = h('div', { style:'grid-column:1 / -1' });
      qtyWrap.appendChild(h('label', { text:'Ilość (szt.)' }));
      const qtyInput = h('input', { type:'number', value:'1', min:'1' });
      qtyWrap.appendChild(qtyInput);
      form.appendChild(qtyWrap);

      body.appendChild(form);

      const footer = h('div', { style:'display:flex;justify-content:flex-end;gap:10px;margin-top:14px;flex-wrap:wrap;align-items:center' });
      const actionWrap = h('div', { style:'display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;align-items:center' });
      const exitBtn = h('button', { class:'btn-primary', type:'button', text:'Wyjdź' });
      const cancelBtn = h('button', { class:'btn-danger', type:'button', text:'Anuluj' });
      const saveBtn = h('button', { class:'btn-success', type:'button', text:'Zapisz' });
      footer.appendChild(actionWrap);
      body.appendChild(footer);

      const normalizeFieldText = (value)=> String(value == null ? '' : value).trim();
      const currentSignature = ()=> JSON.stringify({
        material: normalizeFieldText(currentMaterial || (materialControl && materialControl.value) || ''),
        width: normalizeFieldText(widthInput.value),
        height: normalizeFieldText(heightInput.value),
        qty: normalizeFieldText(qtyInput.value)
      });
      const initialSignature = currentSignature();
      const isDirty = ()=> currentSignature() !== initialSignature;
      const updateFooterState = ()=>{
        actionWrap.innerHTML = '';
        saveBtn.disabled = !isDirty();
        if(isDirty()){
          actionWrap.appendChild(cancelBtn);
          actionWrap.appendChild(saveBtn);
        }else{
          actionWrap.appendChild(exitBtn);
        }
      };
      const confirmDiscard = ()=> askRozrysConfirm({
        title:'ANULOWAĆ ZMIANY?',
        message:'Niezapisane zmiany w formularzu dodawania płyty zostaną utracone.',
        confirmText:'✕ ANULUJ ZMIANY',
        cancelText:'WRÓĆ',
        confirmTone:'danger',
        cancelTone:'neutral'
      });
      const wireDirty = (el)=>{
        if(!el) return;
        el.addEventListener('input', updateFooterState);
        el.addEventListener('change', updateFooterState);
      };
      [materialControl, widthInput, heightInput, qtyInput].forEach(wireDirty);

      exitBtn.addEventListener('click', ()=> FC.panelBox.close());
      cancelBtn.addEventListener('click', async ()=>{
        const ok = await confirmDiscard();
        if(!ok) return;
        FC.panelBox.close();
      });
      saveBtn.addEventListener('click', async ()=>{
        const material = currentMaterial || String(materialControl && materialControl.value || '').trim();
        const u = unitSel.value === 'cm' ? 'cm' : 'mm';
        const w = u==='mm' ? Math.round(parseLocaleNumber(widthInput.value) || 0) : Math.round((parseLocaleNumber(widthInput.value) || 0) * 10);
        const hh = u==='mm' ? Math.round(parseLocaleNumber(heightInput.value) || 0) : Math.round((parseLocaleNumber(heightInput.value) || 0) * 10);
        const qty = Math.max(1, Math.round(parseLocaleNumber(qtyInput.value) || 1));
        if(!material){
          openRozrysInfo('Brak materiału', 'Najpierw wybierz konkretny materiał dla płyty magazynowej.');
          return;
        }
        if(!(w > 0 && hh > 0)){
          openRozrysInfo('Brak formatu płyty', 'Podaj poprawny format płyty, zanim dodasz ją do Magazynu.');
          return;
        }
        if(!isDirty()) return;
        const ok = await askRozrysConfirm({
          title:'DODAĆ PŁYTĘ DO MAGAZYNU?',
          message:`Materiał: ${material}
Format: ${w}×${hh} mm
Dodam ${qty} szt. do magazynu.`,
          confirmText:'Zapisz',
          cancelText:'Anuluj',
          confirmTone:'success',
          cancelTone:'danger'
        });
        if(!ok) return;
        let saved = false;
        try{
          if(FC.magazyn && typeof FC.magazyn.addSheetStock === 'function'){
            saved = !!FC.magazyn.addSheetStock(material, w, hh, qty);
          } else {
            const rows = (FC.magazyn && typeof FC.magazyn.findForMaterial === 'function') ? FC.magazyn.findForMaterial(material) : [];
            const exact = (rows || []).find((row)=> Math.round(Number(row && row.width) || 0) === Math.round(w) && Math.round(Number(row && row.height) || 0) === Math.round(hh));
            if(exact){
              saved = !!FC.magazyn.upsertSheet({ id: exact.id, material, width:w, height:hh, qty: Math.max(0, Math.round(Number(exact.qty) || 0)) + qty });
            } else {
              saved = !!FC.magazyn.upsertSheet({ material, width:w, height:hh, qty });
            }
          }
        }catch(_){ saved = false; }
        if(!saved){
          openRozrysInfo('Nie udało się dodać płyty', 'Spróbuj ponownie.');
          return;
        }
        FC.panelBox.close();
        openRozrysInfo('Dodano płytę', `Płyta została dodana do Magazynu (+${qty} szt.).`);
      });
      updateFooterState();
      FC.panelBox.open({
        title:'Dodaj płytę do magazynu',
        contentNode: body,
        width:'640px',
        dismissOnOverlay:false,
        beforeClose: ()=> isDirty() ? confirmDiscard() : true
      });
    }

    addStockBtn.addEventListener('click', openAddStockModal);

    genBtn.addEventListener('click', ()=>{
      if(_rozrysRunning){
        requestCancel();
        return;
      }
      // "Generuj ponownie" must bypass cache and recompute.
      const force = (_rozrysBtnMode === 'done');
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
