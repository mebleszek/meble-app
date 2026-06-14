// js/app/wycena/wycena-core-labor.js
// Wewnętrzne rozbicie robocizny po szafkach: numery z WYWIADU, normoczas, gabaryt i szczegóły kosztów.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const utils = FC.wycenaCoreUtils;
  const source = FC.wycenaCoreSource;

  if(!(utils && source)){
    throw new Error('Brak zależności FC.wycenaCoreLabor — sprawdź kolejność ładowania Wyceny.');
  }

  function num(value, fallback){
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function text(value){ return String(value == null ? '' : value).trim(); }
  function slug(value){ return utils && typeof utils.slug === 'function' ? utils.slug(value) : text(value).toLowerCase().replace(/\s+/g, '-'); }
  function cm(value){
    const n = Math.max(0, num(value, 0));
    // Aktualny WYWIAD zapisuje wymiary w cm; zabezpieczenie dla ewentualnych mm w przyszłości.
    return n > 1000 ? n / 10 : n;
  }
  function mmFromCmLike(value){ return Math.round(cm(value) * 10); }
  function cabinetVolumeM3(cabinet){
    const w = cm(cabinet && cabinet.width);
    const h = cm(cabinet && cabinet.height);
    const d = cm(cabinet && cabinet.depth);
    return Math.max(0, (w / 100) * (h / 100) * (d / 100));
  }
  function cabinetDimensionsLabel(cabinet){
    return [cabinet && cabinet.width, cabinet && cabinet.height, cabinet && cabinet.depth].map((v)=> Number(v) || 0).join(' × ');
  }
  function getRoomCabinets(roomId){
    const project = source.project() || {};
    const room = project && project[roomId];
    return room && Array.isArray(room.cabinets) ? room.cabinets : [];
  }
  function enumerateSelectedCabinets(selectedRooms){
    const rooms = Array.isArray(selectedRooms) ? selectedRooms : [];
    const out = [];
    rooms.forEach((roomId)=>{
      const roomLabel = source.roomLabel(roomId);
      getRoomCabinets(roomId).forEach((cabinet, index)=>{
        out.push({ roomId, roomLabel, cabinet, cabinetNumber:index + 1 });
      });
    });
    return out;
  }
  function catalogRows(){
    try{ return FC.catalogSelectors && typeof FC.catalogSelectors.getQuoteRates === 'function' ? FC.catalogSelectors.getQuoteRates() : []; }
    catch(_){ return []; }
  }
  function laborDefs(){
    const labor = FC.laborCatalog || null;
    const rows = catalogRows();
    return (Array.isArray(rows) ? rows : []).map((row)=> {
      try{ return labor && typeof labor.normalizeDefinition === 'function' ? labor.normalizeDefinition(row) : row; }
      catch(_){ return row; }
    }).filter((row)=> row && row.active !== false);
  }
  function hourlyRates(defs){
    try{ return FC.laborCatalog && typeof FC.laborCatalog.buildHourlyRates === 'function' ? FC.laborCatalog.buildHourlyRates(defs || catalogRows()) : {}; }
    catch(_){ return {}; }
  }
  function calculate(def, ctx){
    try{ return FC.laborCatalog && typeof FC.laborCatalog.calculateDefinition === 'function' ? FC.laborCatalog.calculateDefinition(def, ctx) : null; }
    catch(_){ return null; }
  }
  function factFor(entry, code){
    const key = text(code);
    if(!key) return null;
    try{
      const api = FC.workQuantityFacts || {};
      if(api && typeof api.getCabinetFact === 'function') return api.getCabinetFact(entry && entry.roomId, entry && entry.cabinet, key) || null;
    }catch(_){ }
    return null;
  }
  function quantityFromSource(def, entry, fallbackQuantity){
    const code = text(def && def.quantitySource);
    const fallback = Math.max(0, num(fallbackQuantity, 0));
    if(!code) return { quantity:fallback, sourceCode:'', usedSource:false, fact:null, warning:'' };
    const fact = factFor(entry, code);
    if(fact && fact.available !== false){
      const n = Number(fact.value);
      if(Number.isFinite(n)) return { quantity:Math.max(0, n), sourceCode:code, usedSource:true, fact, warning:'' };
    }
    return { quantity:fallback, sourceCode:code, usedSource:false, fact, warning:`Nie udało się odczytać źródła ilości ${code}; użyto dotychczasowej ilości.` };
  }
  function normalizedConditions(def){
    if(!def || !Array.isArray(def.conditions)) return [];
    const labor = FC.laborCatalog || {};
    try{
      if(typeof labor.normalizeConditions === 'function') return labor.normalizeConditions(def.conditions);
    }catch(_){ }
    return def.conditions.map((row)=> {
      const sourceCode = text(row && row.source);
      const minRaw = row && row.min;
      const maxRaw = row && row.max;
      const min = minRaw === '' || minRaw == null ? null : Number(minRaw);
      const max = maxRaw === '' || maxRaw == null ? null : Number(maxRaw);
      if(!sourceCode) return null;
      if((min == null || !Number.isFinite(min)) && (max == null || !Number.isFinite(max))) return null;
      return { source:sourceCode, operator:'range', min:Number.isFinite(min) ? min : null, max:Number.isFinite(max) ? max : null };
    }).filter(Boolean);
  }
  function conditionDisplayValue(fact, value){
    return text(fact && fact.displayValue) || String(value);
  }
  function evaluateConditions(def, entry){
    const conditions = normalizedConditions(def);
    if(!conditions.length) return { matched:true, conditions:[], matchedConditions:[], skippedReason:'' };
    const matched = [];
    for(const condition of conditions){
      const sourceCode = text(condition && condition.source);
      const fact = factFor(entry, sourceCode);
      if(!fact || fact.available === false){
        return { matched:false, conditions, matchedConditions:matched, skippedReason:`pominięto — brak danych warunku ${sourceCode}` };
      }
      const value = Number(fact.value);
      if(!Number.isFinite(value)){
        return { matched:false, conditions, matchedConditions:matched, skippedReason:`pominięto — brak liczbowej wartości warunku ${sourceCode}` };
      }
      const min = condition.min == null ? null : Number(condition.min);
      const max = condition.max == null ? null : Number(condition.max);
      const row = {
        source:sourceCode,
        operator:'range',
        min:Number.isFinite(min) ? min : null,
        max:Number.isFinite(max) ? max : null,
        value,
        displayValue:conditionDisplayValue(fact, value),
        label:text(fact.label) || sourceCode
      };
      if(Number.isFinite(min) && value < min){
        return { matched:false, conditions, matchedConditions:matched.concat([row]), skippedReason:`pominięto — warunek ${sourceCode} poza zakresem` };
      }
      if(Number.isFinite(max) && value > max){
        return { matched:false, conditions, matchedConditions:matched.concat([row]), skippedReason:`pominięto — warunek ${sourceCode} poza zakresem` };
      }
      matched.push(row);
    }
    return { matched:true, conditions, matchedConditions:matched, skippedReason:'' };
  }
  function conditionNote(meta){
    const rows = meta && Array.isArray(meta.matchedConditions) ? meta.matchedConditions : [];
    if(!rows.length) return '';
    return 'Warunki zastosowania: ' + rows.map((row)=> {
      const min = row.min == null ? '' : String(row.min);
      const max = row.max == null ? '' : String(row.max);
      const range = min || max ? ` [${min || '…'}–${max || '…'}]` : '';
      return `${text(row.label) || text(row.source)} (${text(row.source)}) = ${text(row.displayValue) || row.value}${range}`;
    }).join('; ');
  }
  function conditionWarnings(meta){
    const msg = text(meta && meta.skippedReason);
    return msg ? [msg] : [];
  }
  function conditionOpts(meta){
    return {
      conditions:Array.isArray(meta && meta.conditions) ? meta.conditions : [],
      matchedConditions:Array.isArray(meta && meta.matchedConditions) ? meta.matchedConditions : [],
      skippedReason:text(meta && meta.skippedReason)
    };
  }
  function semanticRole(def){
    const src = text(def && def.quantitySource);
    const conditions = normalizedConditions(def);
    if(src === 'cabinet.count' && conditions.some((row)=> text(row && row.source) === 'cabinet.height_mm')) return { sourceType:'cabinet', sourceRole:'cabinet-body-labor' };
    if(src === 'cabinet.count') return { sourceType:'cabinet', sourceRole:'cabinet-body-labor' };
    if(src === 'shelf.count') return { sourceType:'cabinet', sourceRole:'shelf-labor' };
    return { sourceType:'quantity-source', sourceRole:'quantity-source-labor' };
  }
  function sourceNote(meta){
    if(!meta || !text(meta.sourceCode)) return '';
    const fact = meta.fact || {};
    const label = text(fact.label) || text(meta.sourceCode);
    const value = text(fact.displayValue) || String(Number(meta.quantity) || 0);
    const suffix = meta.usedSource ? '' : ' (fallback)';
    return `Źródło ilości: ${label} (${meta.sourceCode}) = ${value}${suffix}`;
  }
  function sourceOpts(meta){
    const fact = meta && meta.fact || {};
    return {
      quantitySource:text(meta && meta.sourceCode),
      quantitySourceLabel:text(fact.label),
      quantitySourceValue:meta ? meta.quantity : 0,
      quantitySourceDisplay:text(fact.displayValue),
      quantitySourceUsed:!!(meta && meta.usedSource),
      quantitySourceWarning:text(meta && meta.warning),
    };
  }
  function componentFromCalc(calc, options){
    const opts = options && typeof options === 'object' ? options : {};
    if(!calc || (!opts.allowZero && !(Number(calc.total) > 0 || Number(calc.pricedHours) > 0 || Number(calc.volumePrice) > 0))) return null;
    const def = calc.definition || {};
    return {
      key:opts.key || slug(`${def.id || def.name || 'labor'}_${opts.suffix || ''}`),
      name:text(opts.name || def.name || 'Robocizna'),
      category:text(def.category || ''),
      quantity:Number(calc.quantity) || 1,
      unit:text(opts.unit || (def.quantityMode && def.quantityMode !== 'none' ? 'szt.' : 'x')),
      rateType:text(def.rateType || ''),
      hourlyRate:Number(calc.hourlyRate) || 0,
      hours:Number(calc.pricedHours) || 0,
      baseHours:Number(calc.quantityHours) || 0,
      timeBlockHours:Number(opts.timeBlockHours != null ? opts.timeBlockHours : def.timeBlockHours) || 0,
      startHours:Number(def.startHours) || 0,
      stepHours:Number(def.stepHours) || 0,
      stepEveryQty:Number(def.stepEveryQty) || 0,
      startQty:Number(def.startQty) || 0,
      pricingMode:text(def.pricingMode || ''),
      quantityMode:text(def.quantityMode || 'none'),
      quantityTiers:Array.isArray(def.quantityTiers) ? def.quantityTiers.map((row)=> ({ min:Number(row && row.min) || 0, max:Number(row && row.max) || 0, hours:Number(row && row.hours) || 0, price:Number(row && row.price) || 0 })) : [],
      startPrice:Number(calc.startPrice != null ? calc.startPrice : def.startPrice) || 0,
      includedQty:Number(calc.includedQty != null ? calc.includedQty : def.includedQty) || 0,
      billableQty:Number(calc.billableQty != null ? calc.billableQty : calc.quantity) || 0,
      volumeHours:Number(calc.volumeHours) || 0,
      multiplier:Number(calc.multiplier) || 1,
      volumeM3:Number(calc.volumeM3) || 0,
      volumePrice:Number(calc.volumePrice) || 0,
      volumePricePerM3:Number(def.volumePricePerM3) || 0,
      volumeTimeMode:text(def.volumeTimeMode || 'none'),
      volumeTimePerM3:Number(def.volumeTimePerM3) || 0,
      volumeTimeTiers:Array.isArray(def.volumeTimeTiers) ? def.volumeTimeTiers.map((row)=> ({ min:Number(row && row.min) || 0, max:Number(row && row.max) || 0, hours:Number(row && row.hours) || 0, price:Number(row && row.price) || 0 })) : [],
      laborPrice:Number(calc.laborPrice) || 0,
      fixedPrice:Number(calc.fixedPrice) || 0,
      total:Number(calc.total) || 0,
      unitPrice:Number(opts.unitPrice != null ? opts.unitPrice : ((Number(calc.quantity) || 0) > 0 ? (Number(calc.total) || 0) / (Number(calc.quantity) || 1) : (Number(calc.total) || 0))) || 0,
      sourceType:text(opts.sourceType || ''),
      sourceLabel:text(opts.sourceLabel || ''),
      sourceId:text(opts.sourceId || ''),
      sourceRole:text(opts.sourceRole || ''),
      sourceKind:text(opts.sourceKind || ''),
      quantitySource:text(opts.quantitySource || def.quantitySource),
      quantitySourceLabel:text(opts.quantitySourceLabel),
      quantitySourceValue:Number(opts.quantitySourceValue) || 0,
      quantitySourceDisplay:text(opts.quantitySourceDisplay),
      quantitySourceUsed:opts.quantitySourceUsed === true,
      quantitySourceWarning:text(opts.quantitySourceWarning),
      conditions:Array.isArray(opts.conditions) ? opts.conditions : [],
      matchedConditions:Array.isArray(opts.matchedConditions) ? opts.matchedConditions : [],
      skippedReason:text(opts.skippedReason),
      starterPrice:def.starterPrice === true && !text(def.priceUserEditedAt),
      priceUserEditedAt:text(def.priceUserEditedAt),
      note:text(opts.note || ''),
      warnings:Array.isArray(opts.warnings) ? opts.warnings.map(text).filter(Boolean) : [],
    };
  }

  function manualFallbackComponent(item, entry, idx, opts){
    const cab = entry && entry.cabinet || {};
    const qty = Math.max(0, num(item && item.qty, 1)) || 1;
    const rateId = text(item && (item.rateId || item.id));
    const options = opts && typeof opts === 'object' ? opts : {};
    const warnings = Array.isArray(options.warnings) ? options.warnings.map(text).filter(Boolean) : [];
    return {
      key:slug(`${text(cab && cab.id) || entry.cabinetNumber || 'cab'}_manual_${idx}_${rateId || 'labor'}`),
      name:text(options.name || rateId || 'Czynność ręczna'),
      category:text(options.category || 'Czynności przy szafce'),
      quantity:qty,
      unit:'szt.',
      rateType:text(options.rateType || ''),
      hourlyRate:0,
      hours:0,
      baseHours:0,
      timeBlockHours:0,
      pricingMode:text(options.pricingMode || ''),
      quantityMode:text(options.quantityMode || 'linear'),
      startPrice:0,
      includedQty:0,
      billableQty:qty,
      volumeHours:0,
      multiplier:1,
      volumeM3:Math.max(0, Number(options.volumeM3) || 0),
      volumePrice:0,
      volumePricePerM3:0,
      volumeTimeMode:'none',
      volumeTimePerM3:0,
      laborPrice:0,
      fixedPrice:0,
      total:0,
      unitPrice:0,
      sourceType:'manual-cabinet',
      sourceLabel:cabinetSourceLabel(entry),
      sourceId:text(cab && cab.id),
      sourceRole:'manual-cabinet-labor',
      sourceKind:'manual',
      note:text(options.note || 'Ręczna pozycja przypięta do szafki.'),
      warnings,
    };
  }

  function findDefById(defs, id){
    const needle = text(id);
    if(!needle) return null;
    return (Array.isArray(defs) ? defs : []).find((def)=> def && text(def.id) === needle && def.active !== false) || null;
  }
  function cabinetSourceLabel(entry){
    const number = Number(entry && entry.cabinetNumber) || 0;
    const cab = entry && entry.cabinet || {};
    const typeBits = [text(cab.type), text(cab.subType)].filter(Boolean).join(' / ');
    return [`Szafka #${number || '?'}`, text(entry && entry.roomLabel), typeBits].filter(Boolean).join(' — ');
  }
  function frontPartsForCabinet(roomId, cab){
    try{
      const factsApi = FC.cabinetDerivedFacts || null;
      if(factsApi && typeof factsApi.getCutlist === 'function'){
        const parts = factsApi.getCutlist(roomId, cab, { recalculate:true, persist:false }) || [];
        return (Array.isArray(parts) ? parts : []).filter((part)=> text(part && part.name).toLowerCase() === 'front' || /^\s*front\s*:/i.test(text(part && part.material)));
      }
    }catch(_){ }
    try{
      const hw = FC.frontHardware || {};
      if(hw && typeof hw.getCabinetFrontCutListForMaterials === 'function'){
        return (hw.getCabinetFrontCutListForMaterials(roomId, cab) || []).filter((part)=> text(part && part.name).toLowerCase() === 'front');
      }
    }catch(_){ }
    return [];
  }
  function frontPartQty(part){ return Math.max(0, Math.round(num(part && part.qty, 0))); }
  function frontPartsQty(parts){
    return (Array.isArray(parts) ? parts : []).reduce((sum, part)=> sum + frontPartQty(part), 0);
  }
  function frontPartsNote(parts){
    const rows = (Array.isArray(parts) ? parts : []).map((part)=> {
      const qty = frontPartQty(part);
      if(!(qty > 0)) return '';
      const dims = text(part && part.dims) || [part && part.a, part && part.b].map((v)=> Number(v) || 0).join(' × ');
      return `${qty}× ${dims}`;
    }).filter(Boolean);
    return rows.length ? `Fronty z MATERIAŁ/WYCENA: ${rows.join(', ')}` : '';
  }
  function addFrontLabor(components, entry, defs, rates, volumeM3){
    const def = findDefById(defs, 'labor_mount_front');
    if(!def) return;
    const cab = entry && entry.cabinet || {};
    const cond = evaluateConditions(def, entry);
    if(!cond.matched) return;
    const parts = frontPartsForCabinet(entry && entry.roomId, cab);
    const meta = quantityFromSource(def, entry, frontPartsQty(parts));
    if(!(meta.quantity > 0)) return;
    const calc = calculate(def, { quantity:meta.quantity, volumeM3, hourlyRates:rates });
    const notes = [frontPartsNote(parts) || 'Automatycznie z frontów używanych przez MATERIAŁ/WYCENĘ.', sourceNote(meta), conditionNote(cond)].filter(Boolean);
    const cmp = componentFromCalc(calc, Object.assign({
      suffix:'fronts',
      unit:'szt.',
      name:text(def.name) || 'Montaż frontu / drzwi',
      note:notes.join(' • '),
      sourceType:'fronts',
      sourceLabel:cabinetSourceLabel(entry),
      sourceId:text(cab && cab.id),
      sourceRole:'front-labor',
      sourceKind:'automatic',
      warnings:(meta.warning ? [meta.warning] : []).concat(conditionWarnings(cond))
    }, sourceOpts(meta), conditionOpts(cond)));
    if(cmp) components.push(cmp);
  }
  function hingeRequirementsForCabinet(roomId, cab){
    try{
      const factsApi = FC.cabinetDerivedFacts || null;
      if(factsApi && typeof factsApi.ensureCabinetFacts === 'function'){
        const res = factsApi.ensureCabinetFacts(roomId, cab, { recalculate:true, persist:false });
        const rows = res && res.cache && res.cache.hardwareRequirements && Array.isArray(res.cache.hardwareRequirements.hinges) ? res.cache.hardwareRequirements.hinges : null;
        if(rows) return rows.filter((req)=> req && req.kind === 'hinge' && (!text(req.hardwareGroup) || text(req.hardwareGroup) === 'hinges'));
      }
    }catch(_){ }
    try{
      const api = FC.cabinetHardwareRequirements || {};
      if(api && typeof api.getHingeRequirementsWithQty === 'function'){
        return (api.getHingeRequirementsWithQty(roomId, cab) || []).filter((req)=> req && req.kind === 'hinge' && text(req.hardwareGroup) === 'hinges');
      }
    }catch(_){ }
    return [];
  }
  function hingeSourceLabel(entry, req){
    return [cabinetSourceLabel(entry), text(req && req.doorLabel)].filter(Boolean).join(' — ');
  }
  function hingeRequirementNote(req){
    const bits = [];
    if(text(req && req.label)) bits.push(text(req.label));
    if(text(req && req.ruleId)) bits.push('reguła: ' + text(req.ruleId));
    if(text(req && req.doorLabel)) bits.push(text(req.doorLabel));
    if(num(req && req.frontWidthCm, 0) > 0 && num(req && req.frontHeightCm, 0) > 0) bits.push(`${num(req.frontWidthCm, 0)} × ${num(req.frontHeightCm, 0)} cm`);
    return bits.length ? bits.join(' • ') : 'Automatycznie z centralnych wymagań zawiasów.';
  }
  function hingeRequirementsQty(reqs){
    return (Array.isArray(reqs) ? reqs : []).reduce((sum, req)=> sum + Math.max(0, Math.round(num(req && req.qty, 0))), 0);
  }
  function hingeRequirementsBreakdown(reqs){
    const rows = (Array.isArray(reqs) ? reqs : []).map((req)=> {
      const qty = Math.max(0, Math.round(num(req && req.qty, 0)));
      if(!(qty > 0)) return '';
      const label = text(req && req.doorLabel) || 'Drzwiczki';
      return label + ': ' + qty + ' szt.';
    }).filter(Boolean);
    return rows.length ? 'Rozbicie zawiasów: ' + rows.join('; ') : '';
  }
  function addHingeLabor(components, entry, defs, rates, volumeM3){
    const def = findDefById(defs, 'labor_mount_hinge');
    if(!def) return;
    const cab = entry && entry.cabinet || {};
    const cond = evaluateConditions(def, entry);
    if(!cond.matched) return;
    const reqs = hingeRequirementsForCabinet(entry && entry.roomId, cab);
    const sourceCode = text(def.quantitySource) || 'hinge.count';
    const totalReq = hingeRequirementsQty(reqs);
    const meta = quantityFromSource(def, entry, totalReq);
    const quantity = Math.max(0, Number(meta.quantity) || 0);
    if(!(quantity > 0)) return;
    const calc = calculate(def, { quantity, volumeM3, hourlyRates:rates });
    const notes = [
      hingeRequirementsBreakdown(reqs),
      sourceNote(meta) || 'Źródło ilości: Liczba zawiasów (hinge.count) = ' + quantity + ' szt.',
      conditionNote(cond),
      'Czynność zawiasów liczona raz na poziomie szafki; lewe/prawe drzwiczki są tylko rozbiciem technicznym.'
    ].filter(Boolean);
    const cmp = componentFromCalc(calc, Object.assign({
      key:slug(`${text(cab && cab.id) || entry.cabinetNumber || 'cab'}_hinges_total`),
      suffix:'hinges_total',
      unit:'szt.',
      name:text(def.name) || 'Montaż zawiasu',
      note:notes.join(' • '),
      sourceType:'hinges',
      sourceLabel:cabinetSourceLabel(entry),
      sourceId:text(cab && cab.id),
      sourceRole:'hinge-labor',
      sourceKind:'automatic',
      warnings:(meta.warning ? [meta.warning] : []).concat(conditionWarnings(cond))
    }, sourceOpts(meta), conditionOpts(cond)));
    if(cmp) components.push(cmp);
  }

  function isApplianceAutomation(def){
    const id = text(def && def.id);
    const sourceCode = text(def && def.quantitySource);
    return ['dishwasher_mount','fridge_mount','oven_mount','hob_mount','hood_under_cabinet_mount','hood_chimney_mount','microwave_mount','washer_mount','dryer_mount','coffee_machine_mount','warming_drawer_mount'].includes(id)
      || sourceCode.indexOf('appliance.') === 0;
  }

  function isCarryingAutomation(def){
    const id = text(def && def.id);
    const sourceCode = text(def && def.quantitySource);
    return ['labor_carrying_cabinet','labor_carrying_disassembly'].includes(id)
      || sourceCode.indexOf('carrying.') === 0;
  }

  function carryingEvaluation(entry){
    try{
      const factsApi = FC.cabinetDerivedFacts || null;
      if(factsApi && typeof factsApi.getLogistics === 'function'){
        const ev = factsApi.getLogistics(entry && entry.roomId, entry && entry.cabinet || {}, { recalculate:true, persist:false });
        if(ev) return ev;
      }
    }catch(_){ }
    try{
      const api = FC.carryingLogistics || {};
      if(api && typeof api.evaluateCabinet === 'function') return api.evaluateCabinet(entry && entry.roomId, entry && entry.cabinet || {});
    }catch(_){ }
    return null;
  }
  function carryingLineNote(ev){
    if(!ev) return '';
    const dims = ev.dimensionsCm || {};
    const lift = ev.liftFits ? 'winda: korpus mieści się — liczony jako 2 poziomy' : ('schody/brak dopasowania windy: ' + text(ev.liftReason));
    const orient = ev.liftOrientation && Array.isArray(ev.liftOrientation.doorPair)
      ? `orientacja windy: ${ev.liftOrientation.doorPair.join(' × ')} cm przez drzwi, ${ev.liftOrientation.cabinDepth} cm w głąb windy`
      : '';
    const lines = [
      `Wymiary korpusu: ${num(dims.width, 0)} × ${num(dims.height, 0)} × ${num(dims.depth, 0)} cm`,
      `Waga samego korpusu: ${Math.round((Number(ev.bodyWeightKg) || 0) * 10) / 10} kg`,
      lift,
      orient,
      `Poziomy do naliczenia: ${Number(ev.floorUnits) || 0}`,
      `Liczba pomocników: ${Number(ev.peopleCount) || 1}`
    ];
    if(ev.requiresDisassembly){
      const dis = ev.disassembled || {};
      lines.push(`Korpus rozkręcany: sprawdzono ${Number(dis.itemCount) || 0} dużych elementów`);
      lines.push(`Do windy weszło: ${Number(dis.elevatorItemCount) || 0} szt. • po schodach: ${Number(dis.stairsItemCount) || 0} szt.`);
      const stairs = Array.isArray(dis.stairsItems) ? dis.stairsItems.slice(0, 8) : [];
      if(stairs.length){
        lines.push(`Elementy po schodach: ${stairs.map((it)=> `${text(it.name)} ${num(it.aCm,0)} × ${num(it.bCm,0)} cm`).join(', ')}`);
      }
    }
    if(ev.highFronts && Number(ev.highFronts.itemCount) > 0){
      const hf = ev.highFronts || {};
      lines.push(`Wysokie fronty >${Number(hf.thresholdCm) || 200} cm: ${Number(hf.itemCount) || 0} szt. • windą: ${Number(hf.elevatorItemCount) || 0} szt. • po schodach: ${Number(hf.stairsItemCount) || 0} szt.`);
    }
    lines.push(ev.formula);
    return lines.filter(Boolean).join(' • ');
  }
  function highFrontGroupNote(ev, group, modeLabel){
    const hf = ev && ev.highFronts || {};
    const rows = Array.isArray(group && group.items) ? group.items : [];
    const floorUnits = Number(group && group.floorUnits) || 0;
    const people = Number(group && group.peopleCount) || rows.length || 0;
    const location = text(modeLabel) || 'logistyka';
    const lines = [
      `Wysokie fronty powyżej ${Number(hf.thresholdCm) || 200} cm — ${location}: ${rows.length} szt.`,
      `Poziomy do naliczenia: ${floorUnits}`,
      `Pomocnicy łącznie: ${people}`,
      `${ev.startMinutes || 15} min + ${floorUnits} poziom(y) × ${ev.minutesPerFloorUnit || 5} min = ${Math.round(((ev.startMinutes || 15) + floorUnits * (ev.minutesPerFloorUnit || 5)) * 10) / 10} min na front/pakiet`
    ];
    if(rows.length){
      lines.push('Fronty: ' + rows.slice(0, 8).map((it)=> {
        const lift = it && it.lift ? ` — ${text(it.lift.reason) || (it.lift.fits ? 'mieści się' : 'nie mieści się')}` : '';
        return `${num(it.aCm,0)} × ${num(it.bCm,0)} cm${lift}`;
      }).join(', '));
    }
    return lines.filter(Boolean).join(' • ');
  }

  function addHighFrontCarryingLabor(components, entry, carryingDef, rates, volumeM3, ev){
    const cab = entry && entry.cabinet || {};
    const hf = ev && ev.highFronts || {};
    if(!carryingDef || !(Number(hf.itemCount) > 0)) return;
    const groups = [];
    if(Number(hf.elevatorItemCount) > 0){
      groups.push({
        key:'lift',
        label:'windą',
        items:Array.isArray(hf.elevatorItems) ? hf.elevatorItems : [],
        count:Number(hf.elevatorItemCount) || 0,
        floorUnits:Number(hf.elevatorFloorUnits) || 2,
        peopleCount:Number(hf.elevatorPeopleCount) || Number(hf.elevatorItemCount) || 0
      });
    }
    if(Number(hf.stairsItemCount) > 0){
      groups.push({
        key:'stairs',
        label:'po schodach',
        items:Array.isArray(hf.stairsItems) ? hf.stairsItems : [],
        count:Number(hf.stairsItemCount) || 0,
        floorUnits:Number(hf.stairsFloorUnits) || 0,
        peopleCount:Number(hf.stairsPeopleCount) || Number(hf.stairsItemCount) || 0
      });
    }
    groups.forEach((group)=> {
      if(!(group.count > 0 && group.floorUnits > 0)) return;
      const hourlyRate = Math.max(0, Number(rates && rates[carryingDef.rateType]) || 0);
      const startHours = Math.max(0, Number(carryingDef.startHours) || 0.25);
      const stepHours = Math.max(0, Number(carryingDef.stepHours) || 0.0833333333);
      const quantityHours = startHours + (group.floorUnits * stepHours);
      const multiplier = Math.max(1, Number(group.peopleCount) || group.count || 1);
      const pricedHours = quantityHours * multiplier;
      const total = pricedHours * hourlyRate;
      const calc = {
        definition:carryingDef,
        quantity:group.floorUnits,
        volumeM3,
        hourlyRate,
        quantityHours,
        volumeHours:0,
        multiplier,
        pricedHours,
        laborPrice:total,
        volumePrice:0,
        fixedPrice:0,
        startPrice:0,
        unitPrice:0,
        includedQty:0,
        billableQty:group.floorUnits,
        total
      };
      const warnings = Array.isArray(ev.warnings) ? ev.warnings.slice() : [];
      const cmp = componentFromCalc(calc, {
        suffix:`carrying_high_fronts_${group.key}`,
        unit:'poziom',
        name:`Wnoszenie wysokich frontów — ${group.label}`,
        note:highFrontGroupNote(ev, group, group.label),
        sourceType:'carrying-fronts',
        sourceLabel:cabinetSourceLabel(entry),
        sourceId:text(cab && cab.id),
        sourceRole:'carrying-high-front-labor',
        sourceKind:'automatic',
        quantitySource:'carrying.floor_units',
        quantitySourceLabel:group.key === 'lift' ? 'Poziomy wnoszenia frontów windą' : 'Poziomy wnoszenia frontów po schodach',
        quantitySourceValue:group.floorUnits,
        quantitySourceDisplay:`${group.floorUnits} poziom(y)`,
        quantitySourceUsed:true,
        warnings
      });
      if(cmp){
        cmp.carrying = {
          highFronts:true,
          mode:group.key,
          itemCount:group.count,
          peopleCount:group.peopleCount,
          floorUnits:group.floorUnits,
          items:group.items.map((it)=> ({ aCm:it.aCm, bCm:it.bCm, weightKg:it.weightKg, lift:it.lift }))
        };
        components.push(cmp);
      }
    });
  }

  function addCarryingLabor(components, entry, defs, rates, volumeM3){
    const cab = entry && entry.cabinet || {};
    const ev = carryingEvaluation(entry);
    if(!ev) return;
    const carryingDef = findDefById(defs, 'labor_carrying_cabinet');
    if(carryingDef && Number(ev.floorUnits) > 0){
      const floorFact = factFor(entry, 'carrying.floor_units') || {};
      const peopleFact = factFor(entry, 'carrying.people_count') || {};
      const itemFact = factFor(entry, 'carrying.stairs_item_count') || {};
      const itemCount = Math.max(0, Number(ev.carryingItemCount) || (ev.requiresDisassembly ? 0 : 1));
      if(itemCount > 0){
        const hourlyRate = Math.max(0, Number(rates && rates[carryingDef.rateType]) || 0);
        const startHours = Math.max(0, Number(carryingDef.startHours) || 0.25);
        const stepHours = Math.max(0, Number(carryingDef.stepHours) || 0.0833333333);
        const quantityHours = startHours + ((Number(ev.floorUnits) || 0) * stepHours);
        const helperMultiplier = Math.max(1, Number(ev.peopleCount) || 1);
        const multiplier = helperMultiplier * itemCount;
        const pricedHours = quantityHours * multiplier;
        const total = pricedHours * hourlyRate;
        const calc = {
          definition:carryingDef,
          quantity:Number(ev.floorUnits) || 0,
          volumeM3,
          hourlyRate,
          quantityHours,
          volumeHours:0,
          multiplier,
          pricedHours,
          laborPrice:total,
          volumePrice:0,
          fixedPrice:0,
          startPrice:0,
          unitPrice:0,
          includedQty:0,
          billableQty:Number(ev.floorUnits) || 0,
          total
        };
        const warnings = Array.isArray(ev.warnings) ? ev.warnings.slice() : [];
        const cmp = componentFromCalc(calc, {
          suffix:'carrying_cabinet',
          unit:'poziom',
          name:text(carryingDef.name) || 'Wnoszenie korpusu / elementów',
          note:carryingLineNote(ev),
          sourceType:'carrying',
          sourceLabel:cabinetSourceLabel(entry),
          sourceId:text(cab && cab.id),
          sourceRole:'carrying-labor',
          sourceKind:'automatic',
          quantitySource:'carrying.floor_units',
          quantitySourceLabel:text(floorFact.label) || 'Poziomy wnoszenia',
          quantitySourceValue:Number(ev.floorUnits) || 0,
          quantitySourceDisplay:text(floorFact.displayValue) || `${Number(ev.floorUnits) || 0} poziom(y)`,
          quantitySourceUsed:true,
          warnings
        });
        if(cmp){
          cmp.carrying = {
            bodyWeightKg:ev.bodyWeightKg,
            peopleCount:ev.peopleCount,
            floorUnits:ev.floorUnits,
            liftFits:ev.liftFits,
            requiresDisassembly:ev.requiresDisassembly,
            helperSourceDisplay:text(peopleFact.displayValue),
            carryingItemCount:itemCount,
            carryingItemSourceDisplay:text(itemFact.displayValue)
          };
          components.push(cmp);
        }
      }
    }
    addHighFrontCarryingLabor(components, entry, carryingDef, rates, volumeM3, ev);
    if(ev.requiresDisassembly){
      const disassemblyDef = findDefById(defs, 'labor_carrying_disassembly');
      if(disassemblyDef){
        const calc = calculate(disassemblyDef, { quantity:1, volumeM3, hourlyRates:rates });
        const fact = factFor(entry, 'carrying.requires_disassembly') || {};
        const cmp = componentFromCalc(calc, {
          suffix:'carrying_disassembly',
          unit:'kpl.',
          name:text(disassemblyDef.name) || 'Rozkręcenie i ponowne skręcenie korpusu',
          note:[carryingLineNote(ev), `Próg rozkręcenia: ${ev.disassemblyThresholdKg} kg dla wnoszenia po schodach w całości.`].filter(Boolean).join(' • '),
          sourceType:'carrying',
          sourceLabel:cabinetSourceLabel(entry),
          sourceId:text(cab && cab.id),
          sourceRole:'carrying-disassembly-labor',
          sourceKind:'automatic',
          quantitySource:'carrying.requires_disassembly',
          quantitySourceLabel:text(fact.label) || 'Wymaga rozkręcenia do wnoszenia',
          quantitySourceValue:1,
          quantitySourceDisplay:text(fact.displayValue) || 'tak',
          quantitySourceUsed:true,
          warnings:Array.isArray(ev.warnings) ? ev.warnings.slice() : []
        });
        if(cmp) components.push(cmp);
      }
    }
  }

  function autoQuantityDefs(defs){
    const blocked = new Set(['labor_mount_front','labor_mount_hinge','labor_carrying_cabinet','labor_carrying_disassembly']);
    return (Array.isArray(defs) ? defs : []).filter((def)=> def && def.active !== false && def.isHourlyRate !== true && text(def.quantitySource) && !blocked.has(text(def.id)) && !isApplianceAutomation(def) && !isCarryingAutomation(def));
  }
  function addGenericQuantitySourceLabor(components, entry, defs, rates, volumeM3){
    const cab = entry && entry.cabinet || {};
    autoQuantityDefs(defs).forEach((def)=> {
      const cond = evaluateConditions(def, entry);
      if(!cond.matched) return;
      const meta = quantityFromSource(def, entry, 0);
      if(!(meta.quantity > 0)) return;
      const calc = calculate(def, { quantity:meta.quantity, volumeM3, hourlyRates:rates });
      const role = semanticRole(def);
      const cmp = componentFromCalc(calc, Object.assign({
        suffix:`source_${text(def.id) || text(def.name)}`,
        unit:'szt.',
        name:text(def.name) || 'Czynność',
        note:[sourceNote(meta), conditionNote(cond), 'Automatycznie z wybranego źródła ilości.'].filter(Boolean).join(' • '),
        sourceType:role.sourceType,
        sourceLabel:cabinetSourceLabel(entry),
        sourceId:text(cab && cab.id),
        sourceRole:role.sourceRole,
        sourceKind:'automatic',
        warnings:(meta.warning ? [meta.warning] : []).concat(conditionWarnings(cond))
      }, sourceOpts(meta), conditionOpts(cond)));
      if(cmp) components.push(cmp);
    });
  }


  function buildCabinetCarryingLine(entry, defs, rates){
    const cab = entry && entry.cabinet || {};
    const volumeM3 = cabinetVolumeM3(cab);
    const components = [];
    addCarryingLabor(components, entry, defs, rates, volumeM3);
    const total = components.reduce((sum, row)=> sum + (Number(row.total) || 0), 0);
    const hours = components.reduce((sum, row)=> sum + (Number(row.hours) || 0), 0);
    if(!(total > 0) && !components.length) return null;
    const number = Number(entry && entry.cabinetNumber) || 0;
    const name = `Wnoszenie — szafka #${number}${entry.roomLabel ? ' — ' + entry.roomLabel : ''}`;
    return {
      key:slug(`${entry.roomId || 'room'}_${cab.id || number}_carrying`),
      type:'carrying-cabinet',
      category:'Wnoszenie mebli',
      name,
      cabinetNumber:number,
      cabinetId:text(cab && cab.id),
      roomId:text(entry && entry.roomId),
      rooms:text(entry && entry.roomLabel),
      dimensions:cabinetDimensionsLabel(cab),
      volumeM3,
      qty:1,
      unit:'kpl.',
      unitPrice:total,
      total,
      hours,
      details:components,
      note:text(cab.type || '') + (cab.subType ? ' • ' + text(cab.subType) : ''),
    };
  }

  function buildCabinetLaborLine(entry, defs, rates){
    const cab = entry && entry.cabinet || {};
    const volumeM3 = cabinetVolumeM3(cab);
    const components = [];
    addFrontLabor(components, entry, defs, rates, volumeM3);
    addHingeLabor(components, entry, defs, rates, volumeM3);
    addGenericQuantitySourceLabor(components, entry, defs, rates, volumeM3);
    const manual = Array.isArray(cab && cab.laborItems) ? cab.laborItems : [];
    manual.forEach((item, idx)=>{
      const rateId = text(item && (item.rateId || item.id));
      const def = (defs || []).find((row)=> text(row && row.id) === rateId) || null;
      const qty = Math.max(0, num(item && item.qty, 1)) || 1;
      if(!def){
        const cmp = manualFallbackComponent(item, entry, idx, {
          volumeM3,
          name:rateId || 'Czynność ręczna',
          note:[text(item && item.note), 'Brak pozycji w cenniku robocizny — czynność pokazana bez czasu.'].filter(Boolean).join(' • '),
          warnings:['Brak pozycji w cenniku robocizny.']
        });
        if(cmp) components.push(cmp);
        return;
      }
      const cond = evaluateConditions(def, entry);
      const duplicateRisk = ['labor_mount_front','labor_mount_hinge'].includes(text(def && def.id));
      const condWarn = conditionWarnings(cond);
      if(!cond.matched){
        const cmp = manualFallbackComponent(item, entry, idx, {
          volumeM3,
          name:text(def.name) || rateId || 'Czynność ręczna',
          category:text(def.category || 'Czynności przy szafce'),
          rateType:text(def.rateType || ''),
          pricingMode:text(def.pricingMode || ''),
          quantityMode:text(def.quantityMode || 'linear'),
          note:[text(item && item.note), 'Ręczna pozycja przypięta do szafki.', text(cond && cond.skippedReason)].filter(Boolean).join(' • '),
          warnings:condWarn
        });
        if(cmp) components.push(cmp);
        return;
      }
      const calc = calculate(def, { quantity:qty, volumeM3, hourlyRates:rates });
      const manualNote = [text(item && item.note), conditionNote(cond), duplicateRisk ? 'Ręczna pozycja może dublować automat frontów/zawiasów — sprawdź audyt.' : 'Ręczna pozycja przypięta do szafki.'].filter(Boolean).join(' • ');
      const cmp = componentFromCalc(calc, Object.assign({ suffix:`manual_${idx}`, unit:'szt.', note:manualNote, sourceType:'manual-cabinet', sourceLabel:cabinetSourceLabel(entry), sourceId:text(cab && cab.id), sourceRole:'manual-cabinet-labor', sourceKind:'manual', allowZero:true, warnings:(duplicateRisk ? ['Możliwy duplikat: ta ręczna czynność ma taki sam typ jak automat frontów/zawiasów.'] : []).concat(condWarn) }, conditionOpts(cond)));
      if(cmp) components.push(cmp);
    });
    const total = components.reduce((sum, row)=> sum + (Number(row.total) || 0), 0);
    const hours = components.reduce((sum, row)=> sum + (Number(row.hours) || 0), 0);
    if(!(total > 0) && !components.length) return null;
    const number = Number(entry && entry.cabinetNumber) || 0;
    const name = `Szafka #${number}${entry.roomLabel ? ' — ' + entry.roomLabel : ''}`;
    return {
      key:slug(`${entry.roomId || 'room'}_${cab.id || number}_labor`),
      type:'labor-cabinet',
      category:'Robocizna szafek',
      name,
      cabinetNumber:number,
      cabinetId:text(cab && cab.id),
      roomId:text(entry && entry.roomId),
      rooms:text(entry && entry.roomLabel),
      dimensions:cabinetDimensionsLabel(cab),
      volumeM3,
      qty:1,
      unit:'kpl.',
      unitPrice:total,
      total,
      hours,
      details:components,
      note:text(cab.type || '') + (cab.subType ? ' • ' + text(cab.subType) : ''),
    };
  }

  function collectCabinetLabor(selectedRooms){
    try{
      const factsApi = FC.cabinetDerivedFacts || null;
      if(factsApi && typeof factsApi.ensureForRooms === 'function') factsApi.ensureForRooms(selectedRooms || [], { persist:true, recalculate:true });
    }catch(_){ }
    const defs = laborDefs();
    const rates = hourlyRates(defs);
    return enumerateSelectedCabinets(selectedRooms).map((entry)=> buildCabinetLaborLine(entry, defs, rates)).filter(Boolean);
  }

  function collectCarryingLines(selectedRooms){
    try{
      const factsApi = FC.cabinetDerivedFacts || null;
      if(factsApi && typeof factsApi.ensureForRooms === 'function') factsApi.ensureForRooms(selectedRooms || [], { persist:true, recalculate:true });
    }catch(_){ }
    const defs = laborDefs();
    const rates = hourlyRates(defs);
    return enumerateSelectedCabinets(selectedRooms).map((entry)=> buildCabinetCarryingLine(entry, defs, rates)).filter(Boolean);
  }

  FC.wycenaCoreLabor = {
    enumerateSelectedCabinets,
    cabinetVolumeM3,
    collectCabinetLabor,
    collectCarryingLines,
  };
})();
