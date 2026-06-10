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
    if(!calc || !(Number(calc.total) > 0 || Number(calc.pricedHours) > 0 || Number(calc.volumePrice) > 0)) return null;
    const opts = options && typeof options === 'object' ? options : {};
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
      timeBlockHours:Number(def.timeBlockHours) || 0,
      quantityMode:text(def.quantityMode || 'none'),
      volumeHours:Number(calc.volumeHours) || 0,
      multiplier:Number(calc.multiplier) || 1,
      volumeM3:Number(calc.volumeM3) || 0,
      volumePrice:Number(calc.volumePrice) || 0,
      volumePricePerM3:Number(def.volumePricePerM3) || 0,
      volumeTimeMode:text(def.volumeTimeMode || 'none'),
      volumeTimePerM3:Number(def.volumeTimePerM3) || 0,
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
      const label = text(req && req.doorLabel) || text(req && req.label) || 'Zawiasy';
      const bits = [label + ': ' + qty + ' szt.'];
      if(text(req && req.label) && text(req && req.label) !== label) bits.push(text(req.label));
      if(text(req && req.ruleId)) bits.push('reguła: ' + text(req.ruleId));
      if(num(req && req.frontWidthCm, 0) > 0 && num(req && req.frontHeightCm, 0) > 0) bits.push(`${num(req.frontWidthCm, 0)} × ${num(req.frontHeightCm, 0)} cm`);
      return bits.join(' • ');
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

  function autoQuantityDefs(defs){
    const blocked = new Set(['labor_mount_front','labor_mount_hinge']);
    return (Array.isArray(defs) ? defs : []).filter((def)=> def && def.active !== false && def.isHourlyRate !== true && text(def.quantitySource) && !blocked.has(text(def.id)));
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
      if(!def) return;
      const cond = evaluateConditions(def, entry);
      if(!cond.matched) return;
      const qty = Math.max(0, num(item && item.qty, 1)) || 1;
      const calc = calculate(def, { quantity:qty, volumeM3, hourlyRates:rates });
      const duplicateRisk = ['labor_mount_front','labor_mount_hinge'].includes(text(def && def.id));
      const manualNote = [text(item && item.note), conditionNote(cond), duplicateRisk ? 'Ręczna pozycja może dublować automat frontów/zawiasów — sprawdź audyt.' : 'Ręczna pozycja przypięta do szafki.'].filter(Boolean).join(' • ');
      const cmp = componentFromCalc(calc, Object.assign({ suffix:`manual_${idx}`, unit:'szt.', note:manualNote, sourceType:'manual-cabinet', sourceLabel:cabinetSourceLabel(entry), sourceId:text(cab && cab.id), sourceRole:'manual-cabinet-labor', sourceKind:'manual', warnings:(duplicateRisk ? ['Możliwy duplikat: ta ręczna czynność ma taki sam typ jak automat frontów/zawiasów.'] : []).concat(conditionWarnings(cond)) }, conditionOpts(cond)));
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
    const defs = laborDefs();
    const rates = hourlyRates(defs);
    return enumerateSelectedCabinets(selectedRooms).map((entry)=> buildCabinetLaborLine(entry, defs, rates)).filter(Boolean);
  }

  FC.wycenaCoreLabor = {
    enumerateSelectedCabinets,
    cabinetVolumeM3,
    collectCabinetLabor,
  };
})();
