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
  function matchesBodyRule(def, heightMm){
    if(!def || def.autoRole !== 'cabinetBody') return false;
    const min = Math.max(0, Number(def.heightMinMm) || 0);
    const max = Math.max(0, Number(def.heightMaxMm) || 0);
    if(heightMm < min) return false;
    if(max > 0 && heightMm > max) return false;
    return true;
  }
  function findBodyRule(defs, cabinet){
    const h = mmFromCmLike(cabinet && cabinet.height);
    return (defs || []).find((def)=> matchesBodyRule(def, h)) || null;
  }
  function shelfCount(cabinet){
    const details = cabinet && cabinet.details && typeof cabinet.details === 'object' ? cabinet.details : {};
    const candidates = [details.shelves, details.shelfCount, cabinet && cabinet.shelves, cabinet && cabinet.shelfCount];
    for(const value of candidates){
      const n = Math.max(0, Math.floor(num(value, 0)));
      if(n > 0) return n;
    }
    return 0;
  }
  function findAutoDefs(defs, role){ return (defs || []).filter((def)=> def && def.autoRole === role); }
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
    const parts = frontPartsForCabinet(entry && entry.roomId, cab);
    const meta = quantityFromSource(def, entry, frontPartsQty(parts));
    if(!(meta.quantity > 0)) return;
    const calc = calculate(def, { quantity:meta.quantity, volumeM3, hourlyRates:rates });
    const notes = [frontPartsNote(parts) || 'Automatycznie z frontów używanych przez MATERIAŁ/WYCENĘ.', sourceNote(meta)].filter(Boolean);
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
      warnings:meta.warning ? [meta.warning] : []
    }, sourceOpts(meta)));
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
  function addHingeLabor(components, entry, defs, rates, volumeM3){
    const def = findDefById(defs, 'labor_mount_hinge');
    if(!def) return;
    const cab = entry && entry.cabinet || {};
    const reqs = hingeRequirementsForCabinet(entry && entry.roomId, cab);
    const sourceCode = text(def.quantitySource);
    if(sourceCode && sourceCode !== 'hinge.count'){
      const totalReq = (Array.isArray(reqs) ? reqs : []).reduce((sum, req)=> sum + Math.max(0, Math.round(num(req && req.qty, 0))), 0);
      const meta = quantityFromSource(def, entry, totalReq);
      if(!(meta.quantity > 0)) return;
      const calc = calculate(def, { quantity:meta.quantity, volumeM3, hourlyRates:rates });
      const cmp = componentFromCalc(calc, Object.assign({
        suffix:'hinges_source',
        unit:'szt.',
        name:text(def.name) || 'Montaż zawiasu',
        note:[sourceNote(meta), 'Czynność zawiasów policzona z wybranego źródła ilości.'].filter(Boolean).join(' • '),
        sourceType:'hinges',
        sourceLabel:cabinetSourceLabel(entry),
        sourceId:text(cab && cab.id),
        sourceRole:'hinge-labor',
        sourceKind:'automatic',
        warnings:meta.warning ? [meta.warning] : []
      }, sourceOpts(meta)));
      if(cmp) components.push(cmp);
      return;
    }
    (Array.isArray(reqs) ? reqs : []).forEach((req, index)=>{
      const fallbackQty = Math.max(0, Math.round(num(req && req.qty, 0)));
      if(!(fallbackQty > 0)) return;
      const meta = { quantity:fallbackQty, sourceCode:sourceCode || 'hinge.count', usedSource:!!sourceCode, fact:null, warning:'' };
      const calc = calculate(def, { quantity:fallbackQty, volumeM3, hourlyRates:rates });
      const doorKey = text(req && (req.doorKey || req.doorLabel)) || String(index + 1);
      const cmp = componentFromCalc(calc, Object.assign({
        key:slug(`${text(cab && cab.id) || entry.cabinetNumber || 'cab'}_hinges_${doorKey}`),
        suffix:`hinges_${doorKey}`,
        unit:'szt.',
        name:text(def.name) || 'Montaż zawiasu',
        note:[hingeRequirementNote(req), sourceCode ? 'Źródło ilości: Liczba zawiasów (hinge.count)' : ''].filter(Boolean).join(' • '),
        sourceType:'hinges',
        sourceLabel:hingeSourceLabel(entry, req),
        sourceId:text(cab && cab.id),
        sourceRole:'hinge-labor',
        sourceKind:'automatic'
      }, sourceOpts(meta)));
      if(cmp) components.push(cmp);
    });
  }
  function autoQuantityDefs(defs){
    const blocked = new Set(['labor_mount_front','labor_mount_hinge']);
    return (Array.isArray(defs) ? defs : []).filter((def)=> def && def.active !== false && text(def.autoRole || 'none') === 'none' && text(def.quantitySource) && !blocked.has(text(def.id)));
  }
  function addGenericQuantitySourceLabor(components, entry, defs, rates, volumeM3){
    const cab = entry && entry.cabinet || {};
    autoQuantityDefs(defs).forEach((def)=> {
      const meta = quantityFromSource(def, entry, 0);
      if(!(meta.quantity > 0)) return;
      const calc = calculate(def, { quantity:meta.quantity, volumeM3, hourlyRates:rates });
      const cmp = componentFromCalc(calc, Object.assign({
        suffix:`source_${text(def.id) || text(def.name)}`,
        unit:'szt.',
        name:text(def.name) || 'Czynność',
        note:[sourceNote(meta), 'Automatycznie z wybranego źródła ilości.'].filter(Boolean).join(' • '),
        sourceType:'quantity-source',
        sourceLabel:cabinetSourceLabel(entry),
        sourceId:text(cab && cab.id),
        sourceRole:'quantity-source-labor',
        sourceKind:'automatic',
        warnings:meta.warning ? [meta.warning] : []
      }, sourceOpts(meta)));
      if(cmp) components.push(cmp);
    });
  }


  function buildCabinetLaborLine(entry, defs, rates){
    const cab = entry && entry.cabinet || {};
    const volumeM3 = cabinetVolumeM3(cab);
    const components = [];
    const bodyRule = findBodyRule(defs, cab);
    if(bodyRule){
      const meta = quantityFromSource(bodyRule, entry, 1);
      if(meta.quantity > 0){
        const calc = calculate(bodyRule, { quantity:meta.quantity, volumeM3, hourlyRates:rates });
        const cmp = componentFromCalc(calc, Object.assign({ suffix:'body', note:['Automatycznie z wysokości i gabarytu korpusu', sourceNote(meta)].filter(Boolean).join(' • '), sourceType:'cabinet', sourceLabel:cabinetSourceLabel(entry), sourceId:text(cab && cab.id), sourceRole:'cabinet-body-labor', sourceKind:'automatic', warnings:meta.warning ? [meta.warning] : [] }, sourceOpts(meta)));
        if(cmp) components.push(cmp);
      }
    }
    const shelves = shelfCount(cab);
    if(shelves > 0){
      findAutoDefs(defs, 'cabinetLooseShelves').forEach((def)=>{
        const meta = quantityFromSource(def, entry, shelves);
        if(!(meta.quantity > 0)) return;
        const calc = calculate(def, { quantity:meta.quantity, volumeM3, hourlyRates:rates });
        const cmp = componentFromCalc(calc, Object.assign({ suffix:'shelves', unit:'szt.', note:[`Półki: ${shelves} szt.`, sourceNote(meta)].filter(Boolean).join(' • '), sourceType:'cabinet', sourceLabel:cabinetSourceLabel(entry), sourceId:text(cab && cab.id), sourceRole:'shelf-labor', sourceKind:'automatic', warnings:meta.warning ? [meta.warning] : [] }, sourceOpts(meta)));
        if(cmp) components.push(cmp);
      });
    }
    addFrontLabor(components, entry, defs, rates, volumeM3);
    addHingeLabor(components, entry, defs, rates, volumeM3);
    addGenericQuantitySourceLabor(components, entry, defs, rates, volumeM3);
    const manual = Array.isArray(cab && cab.laborItems) ? cab.laborItems : [];
    manual.forEach((item, idx)=>{
      const rateId = text(item && (item.rateId || item.id));
      const def = (defs || []).find((row)=> text(row && row.id) === rateId) || null;
      if(!def) return;
      const qty = Math.max(0, num(item && item.qty, 1)) || 1;
      const calc = calculate(def, { quantity:qty, volumeM3, hourlyRates:rates });
      const duplicateRisk = ['labor_mount_front','labor_mount_hinge'].includes(text(def && def.id));
      const manualNote = [text(item && item.note), duplicateRisk ? 'Ręczna pozycja może dublować automat frontów/zawiasów — sprawdź audyt.' : 'Ręczna pozycja przypięta do szafki.'].filter(Boolean).join(' • ');
      const cmp = componentFromCalc(calc, { suffix:`manual_${idx}`, unit:'szt.', note:manualNote, sourceType:'manual-cabinet', sourceLabel:cabinetSourceLabel(entry), sourceId:text(cab && cab.id), sourceRole:'manual-cabinet-labor', sourceKind:'manual', warnings:duplicateRisk ? ['Możliwy duplikat: ta ręczna czynność ma taki sam typ jak automat frontów/zawiasów.'] : [] });
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
