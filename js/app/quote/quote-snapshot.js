(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const SNAPSHOT_STORAGE_VERSION = 7;
  const SNAPSHOT_STORAGE_SCHEMA = 'quote-snapshot-slim-v1';

  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }

  function num(value, fallback){
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function currentInvestor(){
    try{ return FC.investors && typeof FC.investors.getById === 'function' && typeof FC.investors.getCurrentId === 'function' ? FC.investors.getById(FC.investors.getCurrentId()) : null; }
    catch(_){ return null; }
  }

  function currentProjectRecord(){
    try{
      if(FC.projectStore && typeof FC.projectStore.getCurrentRecord === 'function'){
        const current = FC.projectStore.getCurrentRecord();
        if(current) return current;
      }
      const inv = currentInvestor();
      return inv && FC.projectStore && typeof FC.projectStore.getByInvestorId === 'function' ? FC.projectStore.getByInvestorId(inv.id) : null;
    }catch(_){ return null; }
  }

  function normalizeWarnings(rows){
    return Array.isArray(rows) ? rows.map((row)=> String(row && row.message || row || '').trim()).filter(Boolean).slice(0, 12) : [];
  }

  function normalizeLine(line){
    const row = line && typeof line === 'object' ? line : {};
    const editedAt = String(row.priceUserEditedAt || row.userEditedAt || '').trim();
    return {
      key: String(row.key || row.id || ''),
      type: String(row.type || ''),
      category: String(row.category || ''),
      subsection: String(row.subsection || '').trim(),
      name: String(row.name || ''),
      qty: Math.max(0, num(row.qty, 0)),
      unit: String(row.unit || ''),
      unitPrice: Math.max(0, num(row.unitPrice, 0)),
      total: Math.max(0, num(row.total, 0)),
      priceUnit: String(row.priceUnit || '').trim(),
      pricingMode: String(row.pricingMode || '').trim(),
      starterPrice: row.starterPrice === true && !editedAt,
      priceUserEditedAt: editedAt,
      rooms: String(row.rooms || '').trim(),
      note: String(row.note || '').trim(),
      source: String(row.source || '').trim(),
      sourceType: String(row.sourceType || '').trim(),
      sourceLabel: String(row.sourceLabel || '').trim(),
      sourceId: String(row.sourceId || '').trim(),
      sourceRole: String(row.sourceRole || '').trim(),
      sourceKind: String(row.sourceKind || '').trim(),
      quantitySource: String(row.quantitySource || '').trim(),
      quantitySourceValue: Math.max(0, num(row.quantitySourceValue, 0)),
      quantitySourceDisplay: String(row.quantitySourceDisplay || '').trim(),
      calculation: String(row.calculation || row.calculationNote || '').trim(),
      warnings: normalizeWarnings(row.warnings),
      width: Math.max(0, num(row.width, 0)),
      height: Math.max(0, num(row.height, 0)),
      materialLabel: String(row.materialLabel || '').trim(),
    };
  }


  function normalizeLaborComponent(component){
    const row = component && typeof component === 'object' ? component : {};
    return {
      key:String(row.key || row.id || ''),
      name:String(row.name || ''),
      category:String(row.category || ''),
      quantity:Math.max(0, num(row.quantity, 0)),
      unit:String(row.unit || ''),
      rateType:String(row.rateType || ''),
      hourlyRate:Math.max(0, num(row.hourlyRate, 0)),
      hours:Math.max(0, num(row.hours, 0)),
      baseHours:Math.max(0, num(row.baseHours, 0)),
      volumeHours:Math.max(0, num(row.volumeHours, 0)),
      multiplier:Math.max(0, num(row.multiplier, 1)),
      volumeM3:Math.max(0, num(row.volumeM3, 0)),
      volumePrice:Math.max(0, num(row.volumePrice, 0)),
      fixedPrice:Math.max(0, num(row.fixedPrice, 0)),
      unitPrice:Math.max(0, num(row.unitPrice, 0)),
      total:Math.max(0, num(row.total, 0)),
      sourceType:String(row.sourceType || '').trim(),
      sourceLabel:String(row.sourceLabel || '').trim(),
      sourceId:String(row.sourceId || '').trim(),
      sourceRole:String(row.sourceRole || '').trim(),
      sourceKind:String(row.sourceKind || '').trim(),
      note:String(row.note || '').trim(),
      calculation:String(row.calculation || row.calculationNote || '').trim(),
      warnings:normalizeWarnings(row.warnings),
      starterPrice:row.starterPrice === true && !String(row.priceUserEditedAt || row.userEditedAt || '').trim(),
      priceUserEditedAt:String(row.priceUserEditedAt || row.userEditedAt || '').trim(),
    };
  }

  function normalizeLaborLine(line){
    const base = normalizeLine(line);
    const row = line && typeof line === 'object' ? line : {};
    return Object.assign(base, {
      type:String(row.type || base.type || 'labor-cabinet'),
      cabinetNumber:Math.max(0, num(row.cabinetNumber, 0)),
      cabinetId:String(row.cabinetId || '').trim(),
      roomId:String(row.roomId || '').trim(),
      dimensions:String(row.dimensions || '').trim(),
      volumeM3:Math.max(0, num(row.volumeM3, 0)),
      hours:Math.max(0, num(row.hours, 0)),
      details:Array.isArray(row.details) ? row.details.map(normalizeLaborComponent) : [],
    });
  }

  function normalizeLines(rows){
    return Array.isArray(rows) ? rows.map(normalizeLine) : [];
  }
  function normalizeLaborLines(rows){
    return Array.isArray(rows) ? rows.map(normalizeLaborLine) : [];
  }

  function normalizeRoomIds(rows){
    return Array.isArray(rows)
      ? Array.from(new Set(rows.map((item)=> String(item || '').trim()).filter(Boolean)))
      : [];
  }

  function normalizeRoomLabels(rows){
    return Array.isArray(rows)
      ? rows.map((item)=> String(item || '').trim()).filter(Boolean)
      : [];
  }

  function resolveVersionScopeLabels(options){
    const opts = options && typeof options === 'object' ? options : {};
    const roomIds = normalizeRoomIds(opts.roomIds
      || opts.selectedRooms
      || (opts.scope && opts.scope.selectedRooms)
      || (opts.selection && opts.selection.selectedRooms));
    const explicitLabels = normalizeRoomLabels(opts.roomLabels
      || (opts.scope && opts.scope.roomLabels)
      || (opts.selection && opts.selection.roomLabels));
    if(roomIds.length){
      const labels = roomIds.map((roomId, index)=>{
        const explicitLabel = String(explicitLabels[index] || '').trim();
        try{
          if(FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function'){
            const label = String(FC.roomRegistry.getRoomLabel(roomId) || '').trim();
            if(label && (label !== String(roomId || '').trim() || !explicitLabel)) return label;
          }
        }catch(_){ }
        return explicitLabel || String(roomId || '').trim();
      }).filter(Boolean);
      if(labels.length) return labels;
      return roomIds;
    }
    return explicitLabels;
  }

  function buildVersionScopeSuffix(options){
    const labels = resolveVersionScopeLabels(options);
    return labels.length ? labels.join(' + ') : '';
  }

  function defaultVersionName(preliminary, options){
    const base = preliminary ? 'Wstępna oferta' : 'Oferta';
    const scopeSuffix = buildVersionScopeSuffix(options);
    return scopeSuffix ? `${base} — ${scopeSuffix}` : base;
  }

  function normalizeCommercial(src, options){
    const value = src && typeof src === 'object' ? src : {};
    let discountPercent = Math.max(0, num(value.discountPercent, 0));
    let discountAmount = Math.max(0, num(value.discountAmount, 0));
    if(discountPercent > 0) discountAmount = 0;
    if(discountAmount > 0) discountPercent = 0;
    const preliminary = !!value.preliminary;
    const versionName = String(value.versionName || '').trim() || defaultVersionName(preliminary, options);
    return {
      versionName,
      preliminary,
      discountPercent,
      discountAmount,
      offerValidity: String(value.offerValidity || '').trim(),
      leadTime: String(value.leadTime || '').trim(),
      deliveryTerms: String(value.deliveryTerms || '').trim(),
      customerNote: String(value.customerNote || '').trim(),
    };
  }

  function normalizeMaterialScope(value){
    try{
      if(FC.rozrysScope && typeof FC.rozrysScope.encodeMaterialScope === 'function' && typeof FC.rozrysScope.decodeMaterialScope === 'function'){
        return FC.rozrysScope.decodeMaterialScope(FC.rozrysScope.encodeMaterialScope(value || {}));
      }
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

  function materialScopeMode(scope){
    const src = normalizeMaterialScope(scope);
    if(src.includeFronts && src.includeCorpus) return 'both';
    return src.includeFronts ? 'fronts' : 'corpus';
  }

  function isTransportQuoteLine(row){
    const src = row && typeof row === 'object' ? row : {};
    return String(src.sourceRole || '').trim() === 'transport-distance'
      || String(src.sourceType || '').trim() === 'transport'
      || String(src.quantitySource || '').trim() === 'transport.distance_km'
      || String(src.sourceId || '').trim() === 'transport_distance_km';
  }

  function computeTotals(raw, lines, commercial){
    const base = raw && typeof raw === 'object' ? raw : {};
    const quoteLines = Array.isArray(lines.quoteRates) ? lines.quoteRates : [];
    const quoteTransportTotal = quoteLines.filter(isTransportQuoteLine).reduce((sum, row)=> sum + row.total, 0);
    const quoteOtherTotal = quoteLines.filter((row)=> !isTransportQuoteLine(row)).reduce((sum, row)=> sum + row.total, 0);
    const hasBaseTransport = Object.prototype.hasOwnProperty.call(base, 'transport');
    const materials = Math.max(0, num(base.materials, lines.materials.reduce((sum, row)=> sum + row.total, 0)));
    const accessories = Math.max(0, num(base.accessories, lines.accessories.reduce((sum, row)=> sum + row.total, 0)));
    const services = Math.max(0, num(base.services, lines.agdServices.reduce((sum, row)=> sum + row.total, 0)));
    const transport = Math.max(0, hasBaseTransport ? num(base.transport, quoteTransportTotal) : quoteTransportTotal);
    const quoteRates = Math.max(0, hasBaseTransport ? num(base.quoteRates, quoteOtherTotal) : (quoteLines.length ? quoteOtherTotal : num(base.quoteRates, 0)));
    const labor = Math.max(0, num(base.labor, (Array.isArray(lines.labor) ? lines.labor : []).reduce((sum, row)=> sum + row.total, 0)));
    const subtotal = Math.max(0, num(base.subtotal, materials + accessories + services + quoteRates + transport + labor));
    let discount = Math.max(0, num(base.discount, 0));
    if(!(discount > 0)){
      if(commercial.discountPercent > 0) discount = subtotal * (commercial.discountPercent / 100);
      else if(commercial.discountAmount > 0) discount = commercial.discountAmount;
    }
    discount = Math.min(subtotal, Math.max(0, discount));
    const grand = Math.max(0, num(base.grand, subtotal - discount));
    return {
      materials,
      accessories,
      services,
      quoteRates,
      transport,
      labor,
      subtotal,
      discount,
      grand,
    };
  }

  function normalizeCalculationRegister(input, lines, commercial){
    try{
      if(FC.quoteCalculationRegister && typeof FC.quoteCalculationRegister.normalizeRegister === 'function' && input && input.lines){
        return FC.quoteCalculationRegister.normalizeRegister(input);
      }
      if(FC.quoteCalculationRegister && typeof FC.quoteCalculationRegister.buildRegister === 'function'){
        return FC.quoteCalculationRegister.buildRegister(lines || {}, commercial || {});
      }
    }catch(_){ }
    return null;
  }

  function buildSnapshot(payload){
    const src = payload && typeof payload === 'object' ? payload : {};
    const investor = src.investor || currentInvestor() || null;
    const projectRecord = src.projectRecord || currentProjectRecord() || null;
    const roomIds = Array.isArray(src.selectedRooms) ? src.selectedRooms.slice() : (src.scope && Array.isArray(src.scope.selectedRooms) ? src.scope.selectedRooms.slice() : []);
    const roomLabels = resolveVersionScopeLabels({ roomIds, roomLabels:Array.isArray(src.roomLabels) ? src.roomLabels.slice() : (src.scope && Array.isArray(src.scope.roomLabels) ? src.scope.roomLabels.slice() : []) });
    const generatedAt = Number(src.generatedAt) > 0 ? Number(src.generatedAt) : Date.now();
    const lines = {
      materials: normalizeLines(src.materialLines || (src.lines && src.lines.materials)),
      elements: normalizeLines(src.elementLines || (src.lines && src.lines.elements)),
      accessories: normalizeLines(src.accessoryLines || (src.lines && src.lines.accessories)),
      agdServices: normalizeLines(src.agdLines || (src.lines && src.lines.agdServices)),
      quoteRates: normalizeLines(src.quoteRateLines || (src.lines && src.lines.quoteRates)),
      labor: normalizeLaborLines(src.laborLines || (src.lines && src.lines.labor)),
    };
    const commercial = normalizeCommercial(src.commercial || {}, { roomIds, roomLabels, scope:{ selectedRooms:roomIds, roomLabels } });
    const calculationRegister = normalizeCalculationRegister(src.calculationRegister || (src.lines && src.lines.calculationRegister), lines, commercial);
    const totals = computeTotals((calculationRegister && calculationRegister.totals) || src.totals || {}, lines, commercial);
    const materialScope = normalizeMaterialScope(src.materialScope || (src.selection && src.selection.materialScope) || (src.scope && src.scope.materialScope));
    const scopeMode = materialScopeMode(materialScope);
    return {
      version: SNAPSHOT_STORAGE_VERSION,
      generatedAt,
      generatedDate: (()=>{ try{ return new Date(generatedAt).toISOString(); }catch(_){ return ''; } })(),
      investor: investor ? {
        id: String(investor.id || ''),
        kind: String(investor.kind || ''),
        name: String(investor.name || investor.companyName || ''),
        companyName: String(investor.companyName || ''),
      } : null,
      project: projectRecord ? {
        id: String(projectRecord.id || ''),
        investorId: String(projectRecord.investorId || ''),
        title: String(projectRecord.title || ''),
        status: String(projectRecord.status || ''),
      } : null,
      scope: {
        selectedRooms: roomIds,
        roomLabels,
        materialScope: clone(materialScope),
        materialScopeMode: scopeMode,
      },
      lines,
      calculationRegister,
      commercial,
      totals,
      meta: {
        source:'quote-snapshot-slim',
        storageSchema: SNAPSHOT_STORAGE_SCHEMA,
        preliminary: !!commercial.preliminary,
        versionName: commercial.versionName,
        lineCounts: {
          materials: lines.materials.length,
          elements: lines.elements.length,
          accessories: lines.accessories.length,
          agdServices: lines.agdServices.length,
          quoteRates: lines.quoteRates.length,
          labor: lines.labor.length,
          calculationRegister: calculationRegister && Array.isArray(calculationRegister.lines) ? calculationRegister.lines.length : 0,
        },
        selectedByClient: !!(src.meta && src.meta.selectedByClient),
        acceptedAt: Number(src.meta && src.meta.acceptedAt) > 0 ? Number(src.meta.acceptedAt) : 0,
        acceptedStage: String(src.meta && src.meta.acceptedStage || ''),
      },
    };
  }

  async function buildFromCore(){
    if(!(FC.wycenaCore && typeof FC.wycenaCore.collectQuoteData === 'function')) return buildSnapshot({});
    const data = await FC.wycenaCore.collectQuoteData();
    return buildSnapshot(data);
  }

  function saveSnapshot(snapshot){
    const normalized = buildSnapshot(snapshot);
    if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.save === 'function') return FC.quoteSnapshotStore.save(normalized);
    return normalized;
  }

  FC.quoteSnapshot = {
    buildSnapshot,
    buildFromCore,
    saveSnapshot,
    normalizeCommercial,
    computeTotals,
    normalizeMaterialScope,
    defaultVersionName,
    resolveVersionScopeLabels,
    buildVersionScopeSuffix,
    materialScopeMode,
    SNAPSHOT_STORAGE_VERSION,
    SNAPSHOT_STORAGE_SCHEMA,
  };
})();
