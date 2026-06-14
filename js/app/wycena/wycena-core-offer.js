(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const utils = FC.wycenaCoreUtils;
  if(!utils){
    throw new Error('Brak FC.wycenaCoreUtils — sprawdź kolejność ładowania Wyceny.');
  }

  function collectCommercialDraft(draft){
    const src = draft && typeof draft === 'object' ? draft : {};
    const commercial = src && typeof src.commercial === 'object' ? src.commercial : {};
    try{
      if(FC.quoteOfferStore && typeof FC.quoteOfferStore.normalizeCommercial === 'function'){
        return FC.quoteOfferStore.normalizeCommercial(commercial, { selection:src.selection });
      }
    }catch(_){ }
    let discountPercent = Math.max(0, Number(commercial && commercial.discountPercent) || 0);
    let discountAmount = Math.max(0, Number(commercial && commercial.discountAmount) || 0);
    if(discountPercent > 0) discountAmount = 0;
    if(discountAmount > 0) discountPercent = 0;
    const preliminary = !!(commercial && commercial.preliminary);
    const versionName = String(commercial && commercial.versionName || '').trim()
      || (FC.quoteOfferStore && typeof FC.quoteOfferStore.defaultVersionName === 'function'
        ? FC.quoteOfferStore.defaultVersionName(preliminary, { selection:src.selection })
        : (preliminary ? 'Wstępna oferta' : 'Oferta'));
    return {
      versionName,
      preliminary,
      discountPercent,
      discountAmount,
      offerValidity: String(commercial && commercial.offerValidity || '').trim(),
      leadTime: String(commercial && commercial.leadTime || '').trim(),
      deliveryTerms: String(commercial && commercial.deliveryTerms || '').trim(),
      customerNote: String(commercial && commercial.customerNote || '').trim(),
    };
  }

  function getOfferDraft(){
    try{
      if(FC.quoteOfferStore && typeof FC.quoteOfferStore.getCurrentDraft === 'function') return FC.quoteOfferStore.getCurrentDraft();
    }catch(_){ }
    return { rateSelections:[], commercial:{} };
  }

  function buildHourlyRates(catalogRows){
    try{
      if(FC.laborCatalog && typeof FC.laborCatalog.buildHourlyRates === 'function') return FC.laborCatalog.buildHourlyRates(catalogRows);
    }catch(_){ }
    return {};
  }

  function calculateManualRateLine(rate, qty, catalogRows){
    const def = FC.laborCatalog && typeof FC.laborCatalog.normalizeDefinition === 'function'
      ? FC.laborCatalog.normalizeDefinition(rate)
      : rate;
    const hasLaborRule = !!(def && (
      Number(def.timeBlockHours) > 0 ||
      String(def.quantityMode || 'none') !== 'none' ||
      Number(def.volumePricePerM3) > 0 ||
      String(def.volumeTimeMode || 'none') !== 'none' ||
      Number(def.fixedPrice) > 0 ||
      Number(def.defaultMultiplier) !== 1
    ));
    if(hasLaborRule && FC.laborCatalog && typeof FC.laborCatalog.calculateDefinition === 'function'){
      const calc = FC.laborCatalog.calculateDefinition(def, {
        quantity:qty,
        volumeM3:0,
        hourlyRates:buildHourlyRates(catalogRows),
      });
      return {
        unitPrice: qty > 0 ? (Number(calc.total) || 0) / qty : 0,
        total: Number(calc.total) || 0,
        hours: Number(calc.pricedHours) || 0,
        note: String(def.category || '').trim(),
      };
    }
    const unitPrice = Math.max(0, Number(rate && rate.price) || 0);
    return { unitPrice, total:qty * unitPrice, hours:0, note:String(rate && rate.category || '').trim() };
  }


  function buildTransportRateLine(catalog, selections){
    const selectedIds = new Set((Array.isArray(selections) ? selections : []).map((row)=> String(row && row.rateId || '')).filter(Boolean));
    const defRaw = (Array.isArray(catalog) ? catalog : []).find((row)=> String(row && row.id || '') === 'transport_distance_km') || null;
    if(!defRaw || selectedIds.has('transport_distance_km')) return null;
    const def = FC.laborCatalog && typeof FC.laborCatalog.normalizeDefinition === 'function' ? FC.laborCatalog.normalizeDefinition(defRaw) : defRaw;
    if(!def || def.active === false || def.isHourlyRate === true) return null;
    const ctx = FC.investorTransport && typeof FC.investorTransport.getCurrentTransportContext === 'function' ? FC.investorTransport.getCurrentTransportContext() : null;
    const qty = Math.max(0, Number(ctx && ctx.billableKm) || 0);
    if(!(qty > 0)) return null;
    const calc = FC.laborCatalog && typeof FC.laborCatalog.calculateDefinition === 'function' ? FC.laborCatalog.calculateDefinition(def, { quantity:qty, hourlyRates:buildHourlyRates(catalog) }) : null;
    const total = Math.max(0, Number(calc && calc.total) || (qty * (Math.max(0, Number(def.price) || 0))));
    if(!(total > 0)) return null;
    const unitPrice = Math.max(0, Number(def.price) || 0);
    const startPrice = Math.max(0, Number(calc && calc.startPrice != null ? calc.startPrice : def.startPrice) || 0);
    const includedQty = Math.max(0, Number(calc && calc.includedQty != null ? calc.includedQty : def.includedQty) || 0);
    const billableQty = Math.max(0, Number(calc && calc.billableQty != null ? calc.billableQty : qty) || 0);
    const inv = ctx && ctx.investor || null;
    const calcText = startPrice > 0 || includedQty > 0
      ? `Transport = ${startPrice.toFixed(2)} PLN start${includedQty > 0 ? ' + max(0, ' + qty + ' km - ' + includedQty + ' km) × ' + unitPrice.toFixed(2) + ' PLN/km' : ' + ' + billableQty + ' km × ' + unitPrice.toFixed(2) + ' PLN/km'}.`
      : `Transport = ${qty} km × ${unitPrice.toFixed(2)} PLN/km.`;
    return {
      key: utils.slug(def && def.name || def && def.id || 'transport'),
      type:'quote-rate',
      category:String(def.category || 'Transport'),
      name:String(def.name || 'Transport do klienta'),
      qty,
      unit:'km',
      unitPrice,
      total,
      hours:0,
      note:'Automatycznie z Inwestora: ' + (ctx.displayValue || (qty + ' km')),
      calculation:calcText,
      pricingMode:String(def.pricingMode || ''),
      startPrice,
      includedQty,
      billableQty,
      internalOnly:false,
      sourceType:'transport',
      sourceLabel:'Inwestor' + (inv && (inv.name || inv.companyName) ? ': ' + String(inv.name || inv.companyName) : ''),
      sourceId:String(def.id || 'transport_distance_km'),
      sourceRole:'transport-distance',
      quantitySource:'transport.distance_km',
      quantitySourceValue:qty,
      quantitySourceDisplay:ctx.displayValue || (qty + ' km'),
      sourceKind:'automatic'
    };
  }

  function buildTransportTravelTimeLine(catalog, selections){
    const selectedIds = new Set((Array.isArray(selections) ? selections : []).map((row)=> String(row && row.rateId || '')).filter(Boolean));
    const defRaw = (Array.isArray(catalog) ? catalog : []).find((row)=> String(row && row.id || '') === 'transport_travel_time') || null;
    if(!defRaw || selectedIds.has('transport_travel_time')) return null;
    const def = FC.laborCatalog && typeof FC.laborCatalog.normalizeDefinition === 'function' ? FC.laborCatalog.normalizeDefinition(defRaw) : defRaw;
    if(!def || def.active === false || def.isHourlyRate === true) return null;
    const ctx = FC.investorTransport && typeof FC.investorTransport.getCurrentTransportContext === 'function' ? FC.investorTransport.getCurrentTransportContext() : null;
    const durationMin = Math.max(0, Math.round(Number(ctx && ctx.durationMin) || 0));
    const durationHours = durationMin > 0 ? durationMin / 60 : Math.max(0, Number(ctx && ctx.durationHours) || 0);
    if(!(durationHours > 0)) return null;
    const rates = buildHourlyRates(catalog);
    const hourlyRate = Math.max(0, Number(rates[def.rateType || 'assembly']) || 0);
    const total = durationHours * hourlyRate;
    const inv = ctx && ctx.investor || null;
    const display = ctx && ctx.durationDisplay ? String(ctx.durationDisplay) : (durationMin ? durationMin + ' min' : (Math.round(durationHours * 60) + ' min'));
    return {
      key:'transport_travel_time',
      type:'quote-rate',
      category:String(def.category || 'Transport'),
      name:String(def.name || 'Czas dojazdu'),
      qty:durationHours,
      unit:'h',
      unitPrice:hourlyRate,
      total,
      hours:durationHours,
      baseHours:durationHours,
      timeBlockHours:1,
      quantity:durationHours,
      quantityMode:'linear',
      pricingMode:'time',
      rateType:String(def.rateType || 'assembly'),
      hourlyRate,
      note:'Automatycznie z Inwestora: czas dojazdu ' + display + '. Kilometry są liczone osobno w pozycji Transport do klienta.',
      calculation:`Czas dojazdu = ${display} × ${hourlyRate.toFixed(2)} PLN/h stawki montażowej.`,
      internalOnly:true,
      sourceType:'transport',
      sourceLabel:'Inwestor' + (inv && (inv.name || inv.companyName) ? ': ' + String(inv.name || inv.companyName) : ''),
      sourceId:String(def.id || 'transport_travel_time'),
      sourceRole:'transport-travel-time',
      sourceKind:'automatic',
      quantitySource:'transport.duration_hours',
      quantitySourceLabel:'Czas dojazdu z inwestora',
      quantitySourceValue:durationHours,
      quantitySourceDisplay:display,
      quantitySourceUsed:true
    };
  }


  function collectQuoteRateLines(){
    const draft = getOfferDraft();
    const selections = Array.isArray(draft && draft.rateSelections) ? draft.rateSelections : [];
    const catalogRows = FC.catalogSelectors && typeof FC.catalogSelectors.getQuoteRates === 'function' ? FC.catalogSelectors.getQuoteRates() : [];
    const catalog = Array.isArray(catalogRows) ? catalogRows : [];
    const manualLines = selections.map((row)=>{
      const rate = catalog.find((item)=> String(item && item.id || '') === String(row && row.rateId || '')) || null;
      if(!rate) return null;
      const def = FC.laborCatalog && typeof FC.laborCatalog.normalizeDefinition === 'function' ? FC.laborCatalog.normalizeDefinition(rate) : rate;
      if(!def || def.active === false || def.isHourlyRate === true) return null;
      const qty = Math.max(0, Number(row && row.qty) || 0);
      if(!(qty > 0)) return null;
      const priced = calculateManualRateLine(def, qty, catalog);
      return {
        key: utils.slug(def && def.name || def && def.id || ''),
        type:'quote-rate',
        category: String(def && def.category || ''),
        name: String(def && def.name || 'Czynność'),
        qty,
        unit:String(def && def.id || '') === 'transport_distance_km' ? 'km' : 'x',
        unitPrice:Number(priced.unitPrice) || 0,
        total:Number(priced.total) || 0,
        hours:Number(priced.hours) || 0,
        note:String(priced.note || '').trim(),
        internalOnly:def && def.internalOnly === true,
        sourceType:'manual',
        sourceLabel:'Ręczna pozycja WYCENY',
        sourceId:String(def && def.id || ''),
        pricingMode:String(def && def.pricingMode || ''),
        startPrice:Number(def && def.startPrice) || 0,
        includedQty:Number(def && def.includedQty) || 0,
      };
    }).filter(Boolean);
    const transportLine = buildTransportRateLine(catalog, selections);
    const travelTimeLine = buildTransportTravelTimeLine(catalog, selections);
    return manualLines.concat([transportLine, travelTimeLine].filter(Boolean));
  }

  FC.wycenaCoreOffer = {
    collectCommercialDraft,
    getOfferDraft,
    collectQuoteRateLines,
  };
})();
