// js/app/quote/quote-calculation-register.js
// Centralny rejestr wyliczeń oferty: jedno miejsce, z którego WYCENA bierze sumy i szczegóły audytu.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const REGISTER_SCHEMA = 'quote-calculation-register-v1';
  const SECTION_LABELS = {
    materials:'Materiały',
    accessories:'Akcesoria',
    labor:'Robocizna szafek',
    carrying:'Wnoszenie mebli',
    quoteRates:'Usługi dodatkowe',
    transport:'Transport',
    services:'Montaż AGD',
    discount:'Rabat',
    total:'Razem',
  };

  function text(value){ return String(value == null ? '' : value).trim(); }
  function num(value){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function round2(value){ const n = num(value); return Math.round(n * 100) / 100; }
  function clone(value){ try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }catch(_){ return JSON.parse(JSON.stringify(value || null)); } }
  function cloneList(value){
    if(!Array.isArray(value)) return [];
    try{ return clone(value) || []; }catch(_){ return []; }
  }
  function slug(value){ try{ return FC.wycenaCoreUtils && typeof FC.wycenaCoreUtils.slug === 'function' ? FC.wycenaCoreUtils.slug(value) : text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }catch(_){ return text(value); } }
  function isStarterPrice(row){ return !!(row && row.starterPrice === true && !text(row.priceUserEditedAt)); }
  function warning(row, message){ return { key:slug((row && row.key || row && row.name || '') + ' ' + message), section:text(row && row.section), sectionLabel:text(row && row.sectionLabel), message:text(message) }; }

  function normalizeRegisterLine(line, fallback){
    const src = line && typeof line === 'object' ? line : {};
    const fb = fallback && typeof fallback === 'object' ? fallback : {};
    const section = text(src.section || fb.section || '');
    const quantity = Math.max(0, num(src.quantity != null ? src.quantity : (src.qty != null ? src.qty : fb.quantity)));
    const unitPrice = Math.max(0, num(src.unitPrice != null ? src.unitPrice : fb.unitPrice));
    const total = Math.max(0, num(src.total != null ? src.total : (quantity * unitPrice)));
    return {
      id:text(src.id || src.key || fb.id || fb.key || slug(`${section}_${src.name || fb.name || ''}_${quantity}_${total}`)),
      section,
      sectionLabel:text(src.sectionLabel || fb.sectionLabel || SECTION_LABELS[section] || section || 'Inne'),
      subsection:text(src.subsection || fb.subsection || ''),
      sourceType:text(src.sourceType || fb.sourceType || ''),
      sourceLabel:text(src.sourceLabel || src.rooms || fb.sourceLabel || ''),
      sourceId:text(src.sourceId || fb.sourceId || ''),
      quantitySource:text(src.quantitySource || fb.quantitySource || ''),
      quantitySourceLabel:text(src.quantitySourceLabel || fb.quantitySourceLabel || ''),
      quantitySourceValue:num(src.quantitySourceValue != null ? src.quantitySourceValue : fb.quantitySourceValue),
      quantitySourceDisplay:text(src.quantitySourceDisplay || fb.quantitySourceDisplay || ''),
      quantitySourceUsed:src.quantitySourceUsed === true || fb.quantitySourceUsed === true,
      conditions:cloneList(src.conditions || fb.conditions),
      matchedConditions:cloneList(src.matchedConditions || fb.matchedConditions),
      skippedReason:text(src.skippedReason || fb.skippedReason || ''),
      pricingMode:text(src.pricingMode || fb.pricingMode || ''),
      startPrice:num(src.startPrice != null ? src.startPrice : fb.startPrice),
      includedQty:num(src.includedQty != null ? src.includedQty : fb.includedQty),
      billableQty:num(src.billableQty != null ? src.billableQty : fb.billableQty),
      timeBlockHours:num(src.timeBlockHours != null ? src.timeBlockHours : fb.timeBlockHours),
      quantityMode:text(src.quantityMode || fb.quantityMode || ''),
      rateType:text(src.rateType || fb.rateType || ''),
      hourlyRate:num(src.hourlyRate != null ? src.hourlyRate : fb.hourlyRate),
      hours:num(src.hours != null ? src.hours : fb.hours),
      baseHours:num(src.baseHours != null ? src.baseHours : fb.baseHours),
      volumeHours:num(src.volumeHours != null ? src.volumeHours : fb.volumeHours),
      multiplier:num(src.multiplier != null ? src.multiplier : fb.multiplier),
      volumeM3:num(src.volumeM3 != null ? src.volumeM3 : fb.volumeM3),
      volumePrice:num(src.volumePrice != null ? src.volumePrice : fb.volumePrice),
      fixedPrice:num(src.fixedPrice != null ? src.fixedPrice : fb.fixedPrice),
      sourceRole:text(src.sourceRole || fb.sourceRole || ''),
      sourceKind:text(src.sourceKind || fb.sourceKind || ''),
      name:text(src.name || fb.name || 'Pozycja'),
      quantity,
      unit:text(src.unit || fb.unit || ''),
      unitPrice,
      total,
      rooms:text(src.rooms || fb.rooms || ''),
      note:text(src.note || fb.note || ''),
      calculation:text(src.calculation || src.calculationNote || fb.calculation || ''),
      starterPrice:isStarterPrice(src),
      priceUserEditedAt:text(src.priceUserEditedAt || ''),
      warnings:Array.isArray(src.warnings) ? src.warnings.map((row)=> text(row && row.message || row)).filter(Boolean) : [],
    };
  }

  function materialSubsection(row){
    const unit = text(row && row.unit).toLowerCase();
    const kind = text(row && row.pricingMode || row && row.priceUnit).toLowerCase();
    const name = text(row && row.name).toLowerCase();
    if(kind === 'edge' || unit === 'mb') return 'Obrzeża';
    if(kind === 'm2' || unit === 'm²' || unit === 'm2'){
      if(name.includes('hdf') || name.includes('plecy')) return 'Plecy / HDF';
      return 'm² / gotowe fronty';
    }
    if(kind === 'piece' || unit === 'szt.') return 'Sztuki / blaty';
    return 'Arkusze / rozkrój';
  }

  function materialLine(row, index){
    const src = row || {};
    const qty = Math.max(0, num(src.qty));
    const unit = text(src.unit) || 'ark.';
    const calc = text(src.calculation) || (unit === 'ark.'
      ? 'Cena = liczba arkuszy z rozkroju × cena za arkusz z cennika materiałów. Materiały o tej samej realnej nazwie są liczone we wspólnej grupie rozkroju.'
      : unit === 'm²'
        ? 'Cena = powierzchnia elementów × cena za m² z cennika materiałów. Dla lakieru/akrylu m² oznacza gotowy front.'
        : unit === 'mb'
          ? 'Cena = metry obrzeża z elementów + 10% zapasu × cena za mb z cennika materiałów.'
          : 'Cena = ilość × cena jednostkowa z cennika materiałów.');
    const out = normalizeRegisterLine(Object.assign({}, src, {
      id:src.key || `materials_${index}`,
      section:'materials',
      sectionLabel:SECTION_LABELS.materials,
      subsection:text(src.subsection) || materialSubsection(src),
      name:text(src.name) || 'Materiał',
      quantity:qty,
      unit,
      unitPrice:num(src.unitPrice),
      total:num(src.total),
      calculation:calc,
      raw:src,
    }));
    if(!(num(src.unitPrice) > 0)) out.warnings.push('Brak ceny jednostkowej w cenniku materiałów.');
    if(src.starterPrice === true && !text(src.priceUserEditedAt)) out.warnings.push('Cena startowa — sprawdź i edytuj w cenniku przed realną ofertą.');
    if(text(src.note)) out.note = text(src.note);
    return out;
  }

  function simpleLine(section, row, index, opts){
    const src = row || {};
    const cfg = opts || {};
    const out = normalizeRegisterLine(Object.assign({}, src, {
      id:src.key || `${section}_${index}`,
      section,
      sectionLabel:SECTION_LABELS[section] || cfg.label || section,
      subsection:text(src.category || cfg.subsection || ''),
      name:text(src.name) || cfg.defaultName || 'Pozycja',
      quantity:num(src.qty || src.quantity || 0),
      unit:text(src.unit || cfg.unit || ''),
      unitPrice:num(src.unitPrice != null ? src.unitPrice : src.price),
      total:num(src.total),
      calculation:text(src.calculation) || cfg.calculation || 'Cena = ilość × cena jednostkowa z właściwego cennika.',
      raw:src,
    }));
    if(!(out.unitPrice > 0) && out.total <= 0) out.warnings.push(cfg.emptyWarning || 'Pozycja ma 0 zł — sprawdź, czy jest cena w cenniku.');
    if(src.starterPrice === true && !text(src.priceUserEditedAt)) out.warnings.push('Cena startowa — sprawdź i edytuj w cenniku przed realną ofertą.');
    return out;
  }

  function laborLikeLines(rows, section, label, defaultName, defaultCalculation){
    const out = [];
    (Array.isArray(rows) ? rows : []).forEach((row, rowIndex)=>{
      const details = Array.isArray(row && row.details) ? row.details : [];
      if(details.length){
        details.forEach((part, partIndex)=>{
          const p = part || {};
          const meta = [];
          if(num(p.baseHours) > 0) meta.push(`czas bazowy ${round2(p.baseHours)} h`);
          if(num(p.hours) > 0) meta.push(`czas wyceniony ${round2(p.hours)} h`);
          if(num(p.hourlyRate) > 0) meta.push(`${round2(p.hourlyRate)} PLN/h`);
          if(text(p.quantitySource)) meta.push(`źródło ilości ${text(p.quantitySourceLabel) || text(p.quantitySource)}${text(p.quantitySourceDisplay) ? ': ' + text(p.quantitySourceDisplay) : ''}`);
          const matchedConditions = Array.isArray(p.matchedConditions) ? p.matchedConditions : [];
          if(matchedConditions.length) meta.push('warunki: ' + matchedConditions.map((cond)=> `${text(cond.label) || text(cond.source)} = ${text(cond.displayValue) || num(cond.value)}`).join('; '));
          if(num(p.multiplier) && num(p.multiplier) !== 1) meta.push(`mnożnik ×${round2(p.multiplier)}`);
          if(num(p.volumeM3) > 0 && num(p.volumePrice) > 0) meta.push(`gabaryt ${round2(p.volumeM3)} m³`);
          const calcBits = [];
          if(text(p.quantityMode) === 'linear' && num(p.quantity) > 0 && num(p.timeBlockHours) > 0 && num(p.hourlyRate) > 0) calcBits.push(`${round2(p.quantity)} × ${round2(p.timeBlockHours)} h × ${round2(p.hourlyRate)} PLN/h`);
          else if(num(p.hours) > 0 && num(p.hourlyRate) > 0) calcBits.push(`${round2(p.hours)} h × ${round2(p.hourlyRate)} PLN/h`);
          if(num(p.volumePrice) > 0) calcBits.push(`dopłata gabarytowa ${round2(p.volumePrice)} PLN`);
          if(num(p.fixedPrice) > 0) calcBits.push(`kwota stała ${round2(p.fixedPrice)} PLN`);
          const detailLine = normalizeRegisterLine({
            id:p.key || `${row.key || rowIndex}_${partIndex}`,
            section,
            sectionLabel:label,
            subsection:text(p.category || 'Czynności przy szafce'),
            sourceType:text(p.sourceType) || 'cabinet',
            sourceLabel:text(p.sourceLabel) || text(row && row.name) || `Szafka #${rowIndex + 1}`,
            sourceId:text(p.sourceId) || text(row && (row.cabinetId || row.key)),
            quantitySource:text(p.quantitySource),
            quantitySourceLabel:text(p.quantitySourceLabel),
            quantitySourceValue:num(p.quantitySourceValue),
            quantitySourceDisplay:text(p.quantitySourceDisplay),
            quantitySourceUsed:p.quantitySourceUsed === true,
            rateType:text(p.rateType),
            hourlyRate:num(p.hourlyRate),
            hours:num(p.hours),
            baseHours:num(p.baseHours),
            volumeHours:num(p.volumeHours),
            multiplier:num(p.multiplier),
            volumeM3:num(p.volumeM3),
            volumePrice:num(p.volumePrice),
            fixedPrice:num(p.fixedPrice),
            sourceRole:text(p.sourceRole),
            sourceKind:text(p.sourceKind),
            conditions:cloneList(p.conditions),
            matchedConditions:cloneList(p.matchedConditions),
            skippedReason:text(p.skippedReason),
            timeBlockHours:num(p.timeBlockHours),
            quantityMode:text(p.quantityMode),
            name:text(p.name) || defaultName || 'Czynność',
            quantity:num(p.quantity || 1) || 1,
            unit:text(p.unit || 'x'),
            unitPrice:num(p.unitPrice != null ? p.unitPrice : (num(p.quantity || 1) > 0 ? num(p.total) / num(p.quantity || 1) : num(p.total))),
            total:num(p.total),
            rooms:text(row && row.rooms),
            note:text(p.note),
            calculation:calcBits.length ? `Cena = ${calcBits.join(' + ')}.` : (defaultCalculation || 'Cena wyliczona z reguły przypisanej do szafki.'),
            starterPrice:p.starterPrice === true && !text(p.priceUserEditedAt),
            priceUserEditedAt:text(p.priceUserEditedAt),
            warnings:Array.isArray(p.warnings) ? p.warnings.map(text).filter(Boolean) : [],
            raw:p,
          });
          if(text(p.quantitySourceWarning)) detailLine.warnings.push(text(p.quantitySourceWarning));
          if(text(p.skippedReason)) detailLine.warnings.push(text(p.skippedReason));
          if(p.starterPrice === true && !text(p.priceUserEditedAt)) detailLine.warnings.push('Cena startowa — sprawdź i edytuj w cenniku przed realną ofertą.');
          out.push(detailLine);
        });
      }else{
        out.push(simpleLine(section, row, rowIndex, { label, defaultName:text(row && row.name) || defaultName || 'Pozycja szafki', unit:'kpl.', calculation:defaultCalculation || 'Cena = suma czynności przypisanych do tej szafki.' }));
      }
    });
    return out;
  }



  function laborLines(rows){
    return laborLikeLines(rows, 'labor', SECTION_LABELS.labor, 'Robocizna szafki', 'Cena = suma czynności robocizny przypisanych do tej szafki.');
  }

  function carryingLines(rows){
    return laborLikeLines(rows, 'carrying', SECTION_LABELS.carrying, 'Wnoszenie szafki', 'Cena = suma czynności wnoszenia/logistyki przypisanych do tej szafki.');
  }


  function isTransportLine(row){
    const src = row && typeof row === 'object' ? row : {};
    return text(src.sourceRole) === 'transport-distance'
      || text(src.sourceType) === 'transport'
      || text(src.quantitySource) === 'transport.distance_km'
      || text(src.sourceId) === 'transport_distance_km';
  }

  function totalBy(lines, section){
    return round2((Array.isArray(lines) ? lines : []).filter((row)=> row.section === section).reduce((sum, row)=> sum + num(row.total), 0));
  }
  function collectWarnings(lines){
    const out = [];
    (Array.isArray(lines) ? lines : []).forEach((row)=>{
      (Array.isArray(row.warnings) ? row.warnings : []).forEach((msg)=>{ if(text(msg)) out.push(warning(row, msg)); });
    });
    ['materials','accessories','labor','carrying','quoteRates','transport','services'].forEach((section)=>{
      const rows = lines.filter((row)=> row.section === section);
      const total = totalBy(lines, section);
      if(!rows.length) out.push({ key:`empty_${section}`, section, sectionLabel:SECTION_LABELS[section], message:'Brak pozycji w rejestrze wyliczeń.' });
      else if(total <= 0) out.push({ key:`zero_${section}`, section, sectionLabel:SECTION_LABELS[section], message:'Suma 0 zł — sprawdź, czy cenniki i reguły mają ceny.' });
    });
    const seen = new Set();
    return out.filter((row)=>{ const key = text(row && row.section) + '|' + text(row && row.message); if(!text(row && row.message) || seen.has(key)) return false; seen.add(key); return true; });
  }

  function buildRegister(lines, commercial){
    const src = lines && typeof lines === 'object' ? lines : {};
    const out = [];
    (Array.isArray(src.materials) ? src.materials : []).forEach((row, index)=> out.push(materialLine(row, index)));
    (Array.isArray(src.accessories) ? src.accessories : []).forEach((row, index)=> out.push(simpleLine('accessories', row, index, { defaultName:'Akcesorium', calculation:'Cena = ilość okuć/akcesoriów × cena do wyceny z katalogu okuć.', emptyWarning:'Akcesorium ma 0 zł — sprawdź cenę w katalogu okuć.' })));
    laborLines(src.labor).forEach((row)=> out.push(row));
    carryingLines(src.carrying).forEach((row)=> out.push(row));
    (Array.isArray(src.quoteRates) ? src.quoteRates : []).forEach((row, index)=> {
      if(isTransportLine(row)){
        out.push(simpleLine('transport', row, index, { defaultName:'Transport', calculation:'Cena = kilometry do wyceny zapisane przy inwestorze × cena za 1 km z cennika transportu.', emptyWarning:'Transport ma 0 zł — sprawdź kilometry przy inwestorze i cenę za km w cenniku.' }));
      }else{
        out.push(simpleLine('quoteRates', row, index, { defaultName:'Robocizna / stawka', calculation:'Cena = ilość ręcznej pozycji/stawki × cena z cennika robocizny.', emptyWarning:'Pozycja robocizny ma 0 zł — sprawdź stawkę.' }));
      }
    });
    (Array.isArray(src.agdServices) ? src.agdServices : []).forEach((row, index)=> out.push(simpleLine('services', row, index, { defaultName:'Montaż AGD', calculation:'Cena = liczba urządzeń AGD z zaznaczonym montażem × cena usługi AGD z cennika.', emptyWarning:'Usługa AGD ma 0 zł — sprawdź cennik AGD.' })));
    const subtotal = ['materials','accessories','labor','carrying','quoteRates','transport','services'].reduce((sum, section)=> sum + totalBy(out, section), 0);
    const comm = commercial && typeof commercial === 'object' ? commercial : {};
    let discount = 0;
    if(num(comm.discountPercent) > 0) discount = subtotal * (num(comm.discountPercent) / 100);
    else if(num(comm.discountAmount) > 0) discount = num(comm.discountAmount);
    discount = Math.min(subtotal, Math.max(0, discount));
    const totals = {
      materials:totalBy(out, 'materials'),
      accessories:totalBy(out, 'accessories'),
      labor:totalBy(out, 'labor'),
      carrying:totalBy(out, 'carrying'),
      quoteRates:totalBy(out, 'quoteRates'),
      transport:totalBy(out, 'transport'),
      services:totalBy(out, 'services'),
      subtotal:round2(subtotal),
      discount:round2(discount),
      grand:round2(subtotal - discount),
    };
    return {
      schema:REGISTER_SCHEMA,
      generatedAt:Date.now(),
      sections:clone(SECTION_LABELS),
      lines:out,
      totals,
      warnings:collectWarnings(out),
    };
  }

  function normalizeRegister(register){
    const src = register && typeof register === 'object' ? register : {};
    const lines = Array.isArray(src.lines) ? src.lines.map((row)=> normalizeRegisterLine(row)).filter((row)=> row.section) : [];
    const totals = src.totals && typeof src.totals === 'object' ? {
      materials:round2(src.totals.materials),
      accessories:round2(src.totals.accessories),
      labor:round2(src.totals.labor),
      quoteRates:round2(src.totals.quoteRates),
      transport:round2(src.totals.transport),
      services:round2(src.totals.services),
      subtotal:round2(src.totals.subtotal),
      discount:round2(src.totals.discount),
      grand:round2(src.totals.grand),
    } : null;
    return {
      schema:text(src.schema) || REGISTER_SCHEMA,
      generatedAt:Number(src.generatedAt) || Date.now(),
      sections:Object.assign({}, SECTION_LABELS, src.sections || {}),
      lines,
      totals:totals || {
        materials:totalBy(lines, 'materials'),
        accessories:totalBy(lines, 'accessories'),
        labor:totalBy(lines, 'labor'),
        quoteRates:totalBy(lines, 'quoteRates'),
        transport:totalBy(lines, 'transport'),
        services:totalBy(lines, 'services'),
        subtotal:round2(['materials','accessories','labor','carrying','quoteRates','transport','services'].reduce((sum, section)=> sum + totalBy(lines, section), 0)),
        discount:0,
        grand:round2(['materials','accessories','labor','carrying','quoteRates','transport','services'].reduce((sum, section)=> sum + totalBy(lines, section), 0)),
      },
      warnings:Array.isArray(src.warnings) ? src.warnings.map((row)=> ({ key:text(row && row.key) || slug(row && row.message || row), section:text(row && row.section), sectionLabel:text(row && row.sectionLabel), message:text(row && row.message || row) })).filter((row)=> row.message) : collectWarnings(lines),
    };
  }

  FC.quoteCalculationRegister = {
    REGISTER_SCHEMA,
    SECTION_LABELS:clone(SECTION_LABELS),
    buildRegister,
    normalizeRegister,
    normalizeRegisterLine,
  };
})();
