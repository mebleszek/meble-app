(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const AGD_SERVICE_DEFAULTS = [
    { category:'AGD', name:'Piekarnik do zabudowy', price:120 },
    { category:'AGD', name:'Mikrofalówka do zabudowy', price:100 },
    { category:'AGD', name:'Lodówka do zabudowy', price:180 },
    { category:'AGD', name:'Zmywarka do zabudowy', price:170 },
    { category:'AGD', name:'Płyta indukcyjna / ceramiczna', price:120 },
    { category:'AGD', name:'Okap podszafkowy / teleskopowy', price:120 },
    { category:'AGD', name:'Okap kominowy / wyspowy', price:180 },
    { category:'AGD', name:'Pralka do zabudowy', price:140 },
    { category:'AGD', name:'Suszarka do zabudowy', price:140 },
    { category:'AGD', name:'Ekspres do zabudowy', price:120 },
    { category:'AGD', name:'Podgrzewacz szufladowy', price:100 },
  ];

  function normalizeText(value){
    return String(value == null ? '' : value)
      .trim()
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ');
  }

  function slug(value){
    return normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function clone(v){
    try{ return JSON.parse(JSON.stringify(v)); }catch(_){ return v; }
  }

  function uniqByName(items){
    const seen = new Set();
    return (Array.isArray(items) ? items : []).filter((item)=>{
      const key = `${slug(item && item.category)}::${slug(item && item.name)}`;
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function ensureServiceCatalog(list){
    const current = Array.isArray(list) ? list.slice() : [];
    const existingKeys = new Set(current.map((item)=> `${slug(item && item.category)}::${slug(item && item.name)}`));
    let changed = false;
    AGD_SERVICE_DEFAULTS.forEach((item)=>{
      const key = `${slug(item.category)}::${slug(item.name)}`;
      if(existingKeys.has(key)) return;
      existingKeys.add(key);
      changed = true;
      current.push({ id:(FC.utils && FC.utils.uid ? FC.utils.uid() : `svc_${Date.now()}_${Math.random().toString(36).slice(2,8)}`), category:item.category, name:item.name, price:item.price });
    });
    return { list: uniqByName(current), changed };
  }

  function ensureServiceCatalogInRuntime(){
    try{
      const result = ensureServiceCatalog(typeof services !== 'undefined' ? services : []);
      if(result.changed){
        services = result.list;
        try{ FC.storage.setJSON(STORAGE_KEYS.services, services); }catch(_){ }
      }
      return result.list;
    }catch(_){
      return Array.isArray(typeof services !== 'undefined' ? services : []) ? services : [];
    }
  }

  function getActiveRooms(){
    try{ return (FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomIds === 'function') ? FC.roomRegistry.getActiveRoomIds() : []; }catch(_){ return []; }
  }

  function normalizeMaterialScope(value){
    try{
      if(FC.quoteSnapshot && typeof FC.quoteSnapshot.normalizeMaterialScope === 'function') return FC.quoteSnapshot.normalizeMaterialScope(value);
    }catch(_){ }
    const src = value && typeof value === 'object' ? value : {};
    const includeFronts = src.includeFronts !== false;
    const includeCorpus = src.includeCorpus !== false;
    return {
      kind:(src.kind === 'material' && String(src.material || '').trim()) ? 'material' : 'all',
      material:(src.kind === 'material' && String(src.material || '').trim()) ? String(src.material || '').trim() : '',
      includeFronts: includeFronts || (!includeFronts && !includeCorpus),
      includeCorpus: includeCorpus || (!includeFronts && !includeCorpus),
    };
  }

  function normalizeQuoteSelection(selection){
    const src = selection && typeof selection === 'object' ? selection : {};
    const activeRooms = getActiveRooms();
    let selectedRooms = [];
    try{
      if(FC.rozrysScope && typeof FC.rozrysScope.normalizeRoomSelection === 'function'){
        selectedRooms = FC.rozrysScope.normalizeRoomSelection(Array.isArray(src.selectedRooms) ? src.selectedRooms : [], { getRooms:()=> activeRooms });
      }
    }catch(_){ }
    if(!Array.isArray(selectedRooms) || !selectedRooms.length){
      selectedRooms = activeRooms.slice();
    }
    return {
      selectedRooms,
      materialScope: normalizeMaterialScope(src.materialScope),
    };
  }

  function decodeSelectedRooms(selectionOverride){
    const normalizedOverride = normalizeQuoteSelection(selectionOverride);
    if(Array.isArray(normalizedOverride.selectedRooms) && normalizedOverride.selectedRooms.length) return normalizedOverride.selectedRooms;
    try{
      const prefs = FC.rozrysPrefs && typeof FC.rozrysPrefs.loadPanelPrefs === 'function' ? (FC.rozrysPrefs.loadPanelPrefs() || {}) : {};
      const decoded = FC.rozrysScope && typeof FC.rozrysScope.decodeRoomsSelection === 'function'
        ? FC.rozrysScope.decodeRoomsSelection(prefs.selectedRooms, { getRooms:getActiveRooms })
        : [];
      return Array.isArray(decoded) && decoded.length ? decoded : getActiveRooms();
    }catch(_){
      return getActiveRooms();
    }
  }

  function decodeMaterialScope(selectionOverride){
    const normalizedOverride = normalizeQuoteSelection(selectionOverride);
    if(normalizedOverride && normalizedOverride.materialScope) return normalizedOverride.materialScope;
    try{
      const prefs = FC.rozrysPrefs && typeof FC.rozrysPrefs.loadPanelPrefs === 'function' ? (FC.rozrysPrefs.loadPanelPrefs() || {}) : {};
      if(FC.rozrysScope && typeof FC.rozrysScope.decodeMaterialScope === 'function') return FC.rozrysScope.decodeMaterialScope(prefs.materialScope);
    }catch(_){ }
    return { kind:'all', includeFronts:true, includeCorpus:true };
  }

  function getSelectedAggregate(selectionOverride){
    const rooms = decodeSelectedRooms(selectionOverride);
    try{
      return FC.rozrys && typeof FC.rozrys.aggregatePartsForProject === 'function'
        ? FC.rozrys.aggregatePartsForProject(rooms)
        : { byMaterial:{}, materials:[], groups:{}, selectedRooms:rooms };
    }catch(_){
      return { byMaterial:{}, materials:[], groups:{}, selectedRooms:rooms };
    }
  }

  function getScopedMaterials(aggregate, selectionOverride){
    const scope = decodeMaterialScope(selectionOverride);
    try{
      if(FC.rozrysScope && typeof FC.rozrysScope.getOrderedMaterialsForSelection === 'function'){
        return FC.rozrysScope.getOrderedMaterialsForSelection(scope, aggregate, { aggregatePartsForProject:()=> aggregate });
      }
    }catch(_){ }
    return Array.isArray(aggregate && aggregate.materials) ? aggregate.materials.slice() : [];
  }

  function materialPriceLookup(materialName){
    const key = normalizeText(materialName);
    try{
      if(FC.catalogSelectors && typeof FC.catalogSelectors.findSheetMaterial === 'function'){
        const found = FC.catalogSelectors.findSheetMaterial(key);
        if(found) return found;
      }
    }catch(_){ }
    const list = Array.isArray(typeof materials !== 'undefined' ? materials : []) ? materials : [];
    return list.find((item)=> normalizeText(item && item.name) === key || normalizeText(item && item.symbol) === key) || null;
  }

  function accessoryPriceLookup(accessoryName){
    const key = normalizeText(accessoryName);
    try{
      if(FC.catalogSelectors && typeof FC.catalogSelectors.findAccessory === 'function'){
        const found = FC.catalogSelectors.findAccessory(key);
        if(found) return found;
      }
    }catch(_){ }
    return null;
  }

  function quoteRateLookup(rateName){
    const key = normalizeText(rateName);
    try{
      if(FC.catalogSelectors && typeof FC.catalogSelectors.findQuoteRate === 'function'){
        const found = FC.catalogSelectors.findQuoteRate(key);
        if(found) return found;
      }
    }catch(_){ }
    return null;
  }

  function servicePriceLookup(serviceName){
    const key = normalizeText(serviceName);
    try{
      if(FC.catalogSelectors && typeof FC.catalogSelectors.findQuoteRate === 'function'){
        const found = FC.catalogSelectors.findQuoteRate(key);
        if(found) return found;
      }
    }catch(_){ }
    const list = ensureServiceCatalogInRuntime();
    return list.find((item)=> normalizeText(item && item.name) === key) || null;
  }

  function roomLabel(id){
    try{ return FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function' ? FC.roomRegistry.getRoomLabel(id) : String(id || '—'); }catch(_){ return String(id || '—'); }
  }

  function project(){
    try{ return FC.rozrys && typeof FC.rozrys.safeGetProject === 'function' ? FC.rozrys.safeGetProject() : (typeof projectData !== 'undefined' ? projectData : null); }catch(_){ return null; }
  }

  function selectedCabinets(selectedRooms){
    const proj = project() || {};
    const rooms = Array.isArray(selectedRooms) ? selectedRooms : [];
    const out = [];
    rooms.forEach((roomId)=>{
      const room = proj && proj[roomId];
      const cabinets = room && Array.isArray(room.cabinets) ? room.cabinets : [];
      cabinets.forEach((cab)=> out.push({ roomId, roomLabel:roomLabel(roomId), cabinet:cab }));
    });
    return out;
  }

  function collectAccessories(selectedRooms){
    const rows = new Map();
    const cabs = selectedCabinets(selectedRooms);
    cabs.forEach(({ roomId, roomLabel:rl, cabinet })=>{
      const parts = FC.cabinetCutlist && typeof FC.cabinetCutlist.getCabinetCutList === 'function' ? (FC.cabinetCutlist.getCabinetCutList(cabinet, roomId) || []) : [];
      parts.forEach((part)=>{
        const a = Number(part && part.a) || 0;
        const b = Number(part && part.b) || 0;
        const mat = String(part && (part.material || part.name) || '').trim();
        if(a > 0 && b > 0) return;
        if(!mat) return;
        const name = mat.replace(/^Okucia:\s*/i, '').trim() || mat;
        const key = slug(name);
        const qty = Math.max(0, Number(part && part.qty) || 0) || 1;
        const prev = rows.get(key) || { key, type:'accessory', name, qty:0, unitPrice:0, total:0, rooms:new Set() };
        prev.qty += qty;
        prev.rooms.add(rl);
        const priceItem = accessoryPriceLookup(mat) || accessoryPriceLookup(name) || materialPriceLookup(mat) || materialPriceLookup(name);
        prev.unitPrice = Number(priceItem && priceItem.price) || prev.unitPrice || 0;
        prev.total = prev.qty * prev.unitPrice;
        rows.set(key, prev);
      });
    });
    return Array.from(rows.values()).map((row)=> Object.assign({}, row, { rooms:Array.from(row.rooms).join(', ') }));
  }

  function collectBuiltInAppliances(selectedRooms){
    const rows = new Map();
    const add = (name, roomLabel)=>{
      const key = slug(name);
      const prev = rows.get(key) || { key, type:'service', category:'AGD', name, qty:0, unitPrice:0, total:0, rooms:new Set() };
      prev.qty += 1;
      prev.rooms.add(roomLabel);
      const svc = servicePriceLookup(name);
      prev.unitPrice = Number(svc && svc.price) || prev.unitPrice || 0;
      prev.total = prev.qty * prev.unitPrice;
      rows.set(key, prev);
    };
    selectedCabinets(selectedRooms).forEach(({ roomLabel:rl, cabinet })=>{
      const cab = cabinet || {};
      const sub = String(cab.subType || '');
      const details = cab.details || {};
      if(sub === 'zmywarkowa') add('Zmywarka do zabudowy', rl);
      if(sub === 'lodowkowa' && String(details.fridgeOption || 'zabudowa') === 'zabudowa') add('Lodówka do zabudowy', rl);
      if(sub === 'piekarnikowa') add('Piekarnik do zabudowy', rl);
      if(sub === 'okap') add('Okap podszafkowy / teleskopowy', rl);
    });
    return Array.from(rows.values()).map((row)=> Object.assign({}, row, { rooms:Array.from(row.rooms).join(', ') }));
  }

  function isPartRotationAllowed(part, grainOn, overrides){
    if(!grainOn) return true;
    if(part && part.ignoreGrain) return true;
    const sig = FC.rozrysPrefs && typeof FC.rozrysPrefs.partSignature === 'function'
      ? FC.rozrysPrefs.partSignature(part)
      : `${part && part.material || ''}||${part && part.name || ''}||${part && part.w || 0}x${part && part.h || 0}`;
    return !!(overrides && overrides[sig]);
  }

  function readRozrysControl(id, fallback){
    try{
      const el = document.getElementById(id);
      return el ? el.value : fallback;
    }catch(_){
      return fallback;
    }
  }

  async function computePlanForMaterial(material, parts){
    const unit = String(readRozrysControl('rozUnit', 'cm') || 'cm');
    const st = {
      material,
      unit,
      boardW: Number(readRozrysControl('rozW', unit === 'mm' ? 2800 : 280)) || (unit === 'mm' ? 2800 : 280),
      boardH: Number(readRozrysControl('rozH', unit === 'mm' ? 2070 : 207)) || (unit === 'mm' ? 2070 : 207),
      kerf: Number(readRozrysControl('rozK', unit === 'mm' ? 4 : 0.4)) || (unit === 'mm' ? 4 : 0.4),
      edgeTrim: Number(readRozrysControl('rozTrim', unit === 'mm' ? 10 : 1)) || (unit === 'mm' ? 10 : 1),
      minScrapW: Number(readRozrysControl('rozMinScrapW', 0)) || 0,
      minScrapH: Number(readRozrysControl('rozMinScrapH', 0)) || 0,
      heur: String(readRozrysControl('rozHeur', 'max') || 'max'),
      direction: String(readRozrysControl('rozDir', 'start-optimax') || 'start-optimax'),
      edgeSubMm: Math.max(0, Number(readRozrysControl('rozEdgeSub', 0)) || 0),
    };
    const hasGrain = !!(FC.materialHasGrain && typeof FC.materialHasGrain === 'function' ? FC.materialHasGrain(material, typeof materials !== 'undefined' ? materials : []) : false);
    const grainExceptions = FC.rozrysPrefs && typeof FC.rozrysPrefs.getMaterialGrainExceptions === 'function'
      ? FC.rozrysPrefs.getMaterialGrainExceptions(material, (parts || []).map((part)=> FC.rozrysPrefs.partSignature(part)), hasGrain)
      : {};
    st.grain = !!(FC.rozrysPrefs && typeof FC.rozrysPrefs.getMaterialGrainEnabled === 'function' ? FC.rozrysPrefs.getMaterialGrainEnabled(material, hasGrain) : hasGrain);
    st.grainExceptions = grainExceptions || {};
    const mmToUnit = (unitName, mm)=> unitName === 'mm' ? Math.round(Number(mm)||0) : Math.round((Number(mm)||0)/10*10)/10;
    const largest = FC.rozrysStock && typeof FC.rozrysStock.getLargestSheetFormatForMaterial === 'function'
      ? FC.rozrysStock.getLargestSheetFormatForMaterial(material, unit === 'mm' ? 2800 : 2800, unit === 'mm' ? 2070 : 2070)
      : { width:2800, height:2070 };
    if(largest && largest.width && largest.height){
      st.boardW = mmToUnit(unit, largest.width);
      st.boardH = mmToUnit(unit, largest.height);
    }
    if(FC.rozrysStock && typeof FC.rozrysStock.getRealHalfStockForMaterial === 'function'){
      const half = FC.rozrysStock.getRealHalfStockForMaterial(material, largest.width || 2800, largest.height || 2070);
      st.realHalfQty = Math.max(0, Number(half && half.qty) || 0);
      st.realHalfBoardW = Math.max(0, Number(half && half.width) || 0);
      st.realHalfBoardH = Math.max(0, Number(half && half.height) || 0);
    }
    if(FC.rozrysStock && typeof FC.rozrysStock.getExactSheetStockForMaterial === 'function'){
      const exact = FC.rozrysStock.getExactSheetStockForMaterial(material, Math.round(Number(largest.width)||2800), Math.round(Number(largest.height)||2070));
      st.stockExactQty = Math.max(0, Number(exact && exact.qty) || 0);
      st.stockFullBoardW = Math.max(0, Number(exact && exact.width) || 0);
      st.stockFullBoardH = Math.max(0, Number(exact && exact.height) || 0);
    }
    st.stockSignature = FC.rozrysStock && typeof FC.rozrysStock.buildStockSignatureForMaterial === 'function'
      ? FC.rozrysStock.buildStockSignatureForMaterial(material)
      : '';
    const cache = FC.rozrysCache && typeof FC.rozrysCache.loadPlanCache === 'function' ? (FC.rozrysCache.loadPlanCache() || {}) : {};
    const cacheKey = FC.rozrysCache && typeof FC.rozrysCache.makePlanCacheKey === 'function'
      ? FC.rozrysCache.makePlanCacheKey(st, parts, { partSignature:FC.rozrysPrefs && FC.rozrysPrefs.partSignature, isPartRotationAllowed, loadEdgeStore:FC.rozrysPrefs && FC.rozrysPrefs.loadEdgeStore })
      : '';
    if(cacheKey && cache[cacheKey] && cache[cacheKey].plan){
      return { plan:cache[cacheKey].plan, source:'cache' };
    }
    let plan = null;
    if(FC.rozrysEngine && typeof FC.rozrysEngine.computePlanWithCurrentEngine === 'function'){
      plan = await FC.rozrysEngine.computePlanWithCurrentEngine(st, parts, {}, {
        computePlan: FC.rozrysEngine.computePlan,
        computePlanPanelProAsync: FC.rozrysEngine.computePlanPanelProAsync,
      });
    }
    if(FC.rozrysStock && typeof FC.rozrysStock.applySheetStockLimit === 'function'){
      plan = await FC.rozrysStock.applySheetStockLimit(material, st, parts, plan, {}, { computePlanWithCurrentEngine:(nextSt, nextParts)=> FC.rozrysEngine.computePlanWithCurrentEngine(nextSt, nextParts, {}, { computePlan: FC.rozrysEngine.computePlan, computePlanPanelProAsync: FC.rozrysEngine.computePlanPanelProAsync }), partSignature:FC.rozrysPrefs && FC.rozrysPrefs.partSignature, isPartRotationAllowed });
    }
    if(cacheKey && plan && FC.rozrysCache && typeof FC.rozrysCache.savePlanCache === 'function'){
      cache[cacheKey] = { ts:Date.now(), plan:clone(plan) };
      FC.rozrysCache.savePlanCache(cache);
    }
    return { plan, source:'generated' };
  }

  async function collectMaterialLines(aggregate, selectionOverride){
    const scope = decodeMaterialScope(selectionOverride);
    const materialsOrdered = getScopedMaterials(aggregate, selectionOverride);
    const lines = [];
    for(const material of materialsOrdered){
      const group = aggregate && aggregate.groups ? aggregate.groups[material] : null;
      const selectedParts = FC.rozrysScope && typeof FC.rozrysScope.getGroupPartsForScope === 'function'
        ? FC.rozrysScope.getGroupPartsForScope(group, scope)
        : ((group && group.parts) || []);
      if(!selectedParts || !selectedParts.length) continue;
      let planInfo = { plan:null, source:'missing' };
      try{ planInfo = await computePlanForMaterial(material, selectedParts); }catch(_){ }
      const sheets = Array.isArray(planInfo && planInfo.plan && planInfo.plan.sheets) ? planInfo.plan.sheets : [];
      const qty = sheets.length;
      const priceItem = materialPriceLookup(material);
      const unitPrice = Number(priceItem && priceItem.price) || 0;
      lines.push({
        key:slug(material),
        type:'material',
        name:material,
        qty,
        unit:'ark.',
        unitPrice,
        total:qty * unitPrice,
        rooms:(aggregate.selectedRooms || []).map(roomLabel).join(', '),
        source:planInfo.source,
        note: planInfo.source === 'generated' ? 'arkusze z rozkroju wygenerowane do wyceny' : planInfo.source === 'cache' ? 'arkusze z ostatniego rozkroju' : 'brak rozkroju',
      });
    }
    return lines;
  }

  function getOfferDraft(){
    try{
      if(FC.quoteOfferStore && typeof FC.quoteOfferStore.getCurrentDraft === 'function') return FC.quoteOfferStore.getCurrentDraft();
    }catch(_){ }
    return { rateSelections:[], commercial:{} };
  }

  function collectQuoteRateLines(){
    const draft = getOfferDraft();
    const selections = Array.isArray(draft && draft.rateSelections) ? draft.rateSelections : [];
    const catalog = FC.catalogSelectors && typeof FC.catalogSelectors.getQuoteRates === 'function' ? FC.catalogSelectors.getQuoteRates() : [];
    return selections.map((row)=>{
      const rate = (Array.isArray(catalog) ? catalog : []).find((item)=> String(item && item.id || '') === String(row && row.rateId || '')) || null;
      if(!rate) return null;
      const qty = Math.max(0, Number(row && row.qty) || 0);
      if(!(qty > 0)) return null;
      const unitPrice = Math.max(0, Number(rate && rate.price) || 0);
      return {
        key: slug(rate && rate.name || rate && rate.id || ''),
        type:'quote-rate',
        category: String(rate && rate.category || ''),
        name: String(rate && rate.name || 'Stawka wyceny'),
        qty,
        unit:'x',
        unitPrice,
        total: qty * unitPrice,
        note: String(rate && rate.category || '').trim(),
      };
    }).filter(Boolean);
  }

  function collectElementLines(selectionOverride){
    const normalizedSelection = normalizeQuoteSelection(selectionOverride);
    const aggregate = getSelectedAggregate(normalizedSelection);
    const scope = normalizedSelection.materialScope;
    const materialsOrdered = getScopedMaterials(aggregate, normalizedSelection);
    const rows = new Map();
    materialsOrdered.forEach((material)=>{
      const group = aggregate && aggregate.groups ? aggregate.groups[material] : null;
      const selectedParts = FC.rozrysScope && typeof FC.rozrysScope.getGroupPartsForScope === 'function'
        ? FC.rozrysScope.getGroupPartsForScope(group, scope)
        : ((group && group.parts) || []);
      (Array.isArray(selectedParts) ? selectedParts : []).forEach((part)=>{
        const qty = Math.max(0, Number(part && part.qty) || 0);
        if(!(qty > 0)) return;
        const width = Math.max(0, Math.round(Number(part && part.w) || 0));
        const height = Math.max(0, Math.round(Number(part && part.h) || 0));
        const name = String(part && part.name || 'Element').trim() || 'Element';
        const key = `${material}||${name}||${width}||${height}`;
        const prev = rows.get(key) || {
          key: slug(key),
          type:'element',
          category:'Element',
          name,
          qty:0,
          unit:'szt.',
          unitPrice:0,
          total:0,
          materialLabel:String(material || '').trim(),
          width,
          height,
          rooms:(aggregate && Array.isArray(aggregate.selectedRooms) ? aggregate.selectedRooms : []).map(roomLabel).join(', '),
          note:'',
        };
        prev.qty += qty;
        rows.set(key, prev);
      });
    });
    return Array.from(rows.values()).sort((a,b)=>{
      const an = String(a && a.name || '');
      const bn = String(b && b.name || '');
      const cmp = an.localeCompare(bn, 'pl');
      if(cmp !== 0) return cmp;
      if((Number(b && b.width) || 0) !== (Number(a && a.width) || 0)) return (Number(b && b.width) || 0) - (Number(a && a.width) || 0);
      return (Number(b && b.height) || 0) - (Number(a && a.height) || 0);
    });
  }

  function collectClientPdfDetails(selectionOverride){
    const normalizedSelection = normalizeQuoteSelection(selectionOverride);
    return {
      elements: collectElementLines(normalizedSelection),
      materials: (function(){
        const aggregate = getSelectedAggregate(normalizedSelection);
        return getScopedMaterials(aggregate, normalizedSelection).map((material)=> ({
          key: slug(material),
          type:'material-summary',
          name:String(material || '').trim(),
        })).filter((row)=> row.name);
      })(),
      accessories: collectAccessories(decodeSelectedRooms(normalizedSelection)),
      services: collectQuoteRateLines(),
      agd: collectBuiltInAppliances(decodeSelectedRooms(normalizedSelection)),
    };
  }

  async function collectQuoteData(options){
    const draft = getOfferDraft();
    const normalizedSelection = normalizeQuoteSelection((options && options.selection) || (draft && draft.selection));
    const selectedRooms = decodeSelectedRooms(normalizedSelection);
    const aggregate = getSelectedAggregate(normalizedSelection);
    const materialLines = await collectMaterialLines(aggregate, normalizedSelection);
    const elementLines = collectElementLines(normalizedSelection);
    const accessoryLines = collectAccessories(selectedRooms);
    const agdLines = collectBuiltInAppliances(selectedRooms);
    const quoteRateLines = collectQuoteRateLines();
    const commercial = collectCommercialDraft(draft);
    const totals = FC.quoteSnapshot && typeof FC.quoteSnapshot.computeTotals === 'function'
      ? FC.quoteSnapshot.computeTotals({}, {
          materials: materialLines,
          accessories: accessoryLines,
          agdServices: agdLines,
          quoteRates: quoteRateLines,
        }, commercial)
      : {
          materials: materialLines.reduce((sum, row)=> sum + (Number(row.total) || 0), 0),
          accessories: accessoryLines.reduce((sum, row)=> sum + (Number(row.total) || 0), 0),
          services: agdLines.reduce((sum, row)=> sum + (Number(row.total) || 0), 0),
          quoteRates: quoteRateLines.reduce((sum, row)=> sum + (Number(row.total) || 0), 0),
          subtotal: 0,
          discount: 0,
          grand: 0,
        };
    if(!(totals.subtotal > 0)) totals.subtotal = totals.materials + totals.accessories + totals.services + totals.quoteRates;
    if(!(totals.grand >= 0)) totals.grand = Math.max(0, totals.subtotal - (totals.discount || 0));
    return {
      selectedRooms,
      roomLabels: selectedRooms.map(roomLabel),
      materialScope: normalizedSelection.materialScope,
      selection: normalizedSelection,
      materialLines,
      elementLines,
      accessoryLines,
      agdLines,
      quoteRateLines,
      commercial,
      totals,
      generatedAt: Date.now(),
    };
  }

  async function buildQuoteSnapshot(options){
    const data = await collectQuoteData(options);
    try{
      if(FC.quoteSnapshot && typeof FC.quoteSnapshot.saveSnapshot === 'function') return FC.quoteSnapshot.saveSnapshot(data);
      if(FC.quoteSnapshot && typeof FC.quoteSnapshot.buildSnapshot === 'function') return FC.quoteSnapshot.buildSnapshot(data);
    }catch(_){ }
    return data;
  }

  FC.wycenaCore = {
    AGD_SERVICE_DEFAULTS,
    ensureServiceCatalog,
    ensureServiceCatalogInRuntime,
    normalizeQuoteSelection,
    collectQuoteData,
    buildQuoteSnapshot,
    collectQuoteRateLines,
    collectCommercialDraft,
    collectElementLines,
    collectClientPdfDetails,
  };

  try{ ensureServiceCatalogInRuntime(); }catch(_){ }
})();
