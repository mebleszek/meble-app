(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const utils = FC.wycenaCoreUtils;

  function retryWycenaCoreModule(apiKey, missingLabel){
    try{
      const state = FC.__wycenaCoreModuleRetries = FC.__wycenaCoreModuleRetries || {};
      const count = state[apiKey] = (Number(state[apiKey]) || 0) + 1;
      if(count > 12){
        try{ console.warn('WYCENA: moduł nie wystartował po ponowieniach', apiKey, missingLabel); }catch(_){}
        return;
      }
      const current = document.currentScript && document.currentScript.getAttribute ? (document.currentScript.getAttribute('src') || '') : '';
      if(!current) return;
      window.setTimeout(function(){
        try{
          if(FC[apiKey]) return;
          const script = document.createElement('script');
          script.defer = true;
          script.async = false;
          script.src = current + (current.indexOf('?') === -1 ? '?' : '&') + 'wycena_dep_retry=' + count + '_' + Date.now();
          document.head.appendChild(script);
        }catch(_){}
      }, Math.min(1200, 80 * count));
    }catch(_){}
  }

  if(!utils){
    retryWycenaCoreModule('wycenaCoreOffer', 'FC.wycenaCoreUtils');
    return;
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
        audit:{price:def.price,rateType:def.rateType,hourlyRate:calc.hourlyRate,baseHours:calc.quantityHours,multiplier:calc.multiplier,
          quantityMode:def.quantityMode,timeBlockHours:def.timeBlockHours,startHours:def.startHours,startQty:def.startQty,stepHours:def.stepHours,stepEveryQty:def.stepEveryQty,
          quantityTiers:def.quantityTiers,volumeHours:calc.volumeHours,volumeM3:calc.volumeM3,volumePrice:calc.volumePrice,fixedPrice:calc.fixedPrice},
      };
    }
    const unitPrice = Math.max(0, Number(rate && rate.price) || 0);
    return { unitPrice, total:qty * unitPrice, hours:0, note:String(rate && rate.category || '').trim() };
  }

  function withCalculation(line){
    if(FC.quoteCalculationRegister && typeof FC.quoteCalculationRegister.describeCalculation==='function')line.calculation=FC.quoteCalculationRegister.describeCalculation(line);
    return line;
  }


  function buildTransportRateLine(catalog, selections){
    const selectedIds = new Set((Array.isArray(selections) ? selections : []).map((row)=> String(row && row.rateId || '')).filter(Boolean));
    const canonicalRow = (Array.isArray(catalog) ? catalog : []).find(row=>row && row.id === 'transport_distance_km');
    if(canonicalRow && (canonicalRow.active === false || canonicalRow.isHourlyRate === true)) return null;
    const rows = (Array.isArray(catalog) ? catalog : []).filter(row=>row && (row.id === 'transport_distance_km' || row.quantitySource === 'transport.distance_km') && row.active !== false && row.isHourlyRate !== true);
    if(rows.some(row=>selectedIds.has(String(row.id)))) return null; // An explicit assignment owns this work, including its quantity and zero price.
    const ctx = FC.investorTransport && typeof FC.investorTransport.getCurrentTransportContext === 'function' ? FC.investorTransport.getCurrentTransportContext() : null;
    const qty = Math.max(0, Number(ctx && ctx.billableKm) || 0);
    if(!(qty > 0)) return null;
    const canonical = rows.find(row=>row.id === 'transport_distance_km');
    const untouchedStarter = row=>row.starterPrice === true && !String(row.priceUserEditedAt || '').trim() && Number(row.price) === 0 && !(Number(row.startPrice) > 0);
    const candidates = rows.filter(row=>!untouchedStarter(row));
    // A canonical user edit is explicit. Otherwise only one non-starter with an exact quantity-source role is unambiguous.
    const explicitCanonical = canonical && String(canonical.priceUserEditedAt || '').trim();
    const conflict = !explicitCanonical && (candidates.length > 1 || candidates.some(row=>row.starterPrice === true && !String(row.priceUserEditedAt || '').trim()));
    const defRaw = explicitCanonical ? canonical : (candidates.length === 1 ? candidates[0] : canonical);
    if(conflict){
      const ids = candidates.map(row=>String(row.id)).join(', ');
      const warning = 'STOP: konflikt stawek transportu ('+ids+'). Wybierz jedną pozycję w ręcznych przypisaniach lub jawnie edytuj stawkę systemową. Transport nie został wyceniony.';
      return {key:'transport-distance-conflict',type:'quote-rate',category:'Transport',name:'Transport — konflikt stawek',qty:0,unit:'km',unitPrice:0,total:0,hours:0,
        sourceType:'transport',sourceRole:'transport-distance',sourceKind:'automatic-blocked',sourceId:ids,quantitySource:'transport.distance_km',note:warning,calculation:warning,warnings:[warning]};
    }
    if(!defRaw) return null;
    const def = FC.laborCatalog && typeof FC.laborCatalog.normalizeDefinition === 'function' ? FC.laborCatalog.normalizeDefinition(defRaw) : defRaw;
    if(!def || def.active === false || def.isHourlyRate === true) return null;
    const calc = FC.laborCatalog && typeof FC.laborCatalog.calculateDefinition === 'function' ? FC.laborCatalog.calculateDefinition(def, { quantity:qty, hourlyRates:buildHourlyRates(catalog) }) : null;
    const total = Math.max(0, Number(calc && calc.total) || (qty * (Math.max(0, Number(def.price) || 0))));
    if(!(total > 0)) return null;
    const unitPrice = Math.max(0, Number(def.price) || 0);
    const startPrice = Math.max(0, Number(calc && calc.startPrice != null ? calc.startPrice : def.startPrice) || 0);
    const includedQty = Math.max(0, Number(calc && calc.includedQty != null ? calc.includedQty : def.includedQty) || 0);
    const billableQty = Math.max(0, Number(calc && calc.billableQty != null ? calc.billableQty : qty) || 0);
    const inv = ctx && ctx.investor || null;
    const calcText = startPrice > 0 || includedQty > 0
      ? `Transport = ${String(startPrice)} PLN start${includedQty > 0 ? ' + max(0, ' + qty + ' km - ' + includedQty + ' km) × ' + String(unitPrice) + ' PLN/km' : ' + ' + billableQty + ' km × ' + String(unitPrice) + ' PLN/km'}.`
      : `Transport = ${qty} km × ${String(unitPrice)} PLN/km.`;
    return withCalculation({
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
    });
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
    return withCalculation({
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
      calculation:`Czas dojazdu = ${display} × ${String(hourlyRate)} PLN/h stawki montażowej.`,
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
    });
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
      return withCalculation(Object.assign({}, priced.audit || {}, {
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
      }));
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
