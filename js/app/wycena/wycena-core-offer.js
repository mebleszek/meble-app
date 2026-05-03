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

  function collectQuoteRateLines(){
    const draft = getOfferDraft();
    const selections = Array.isArray(draft && draft.rateSelections) ? draft.rateSelections : [];
    const catalogRows = FC.catalogSelectors && typeof FC.catalogSelectors.getQuoteRates === 'function' ? FC.catalogSelectors.getQuoteRates() : [];
    const catalog = Array.isArray(catalogRows) ? catalogRows : [];
    return selections.map((row)=>{
      const rate = catalog.find((item)=> String(item && item.id || '') === String(row && row.rateId || '')) || null;
      if(!rate) return null;
      const def = FC.laborCatalog && typeof FC.laborCatalog.normalizeDefinition === 'function' ? FC.laborCatalog.normalizeDefinition(rate) : rate;
      const autoRole = String(def && def.autoRole || 'none');
      if(autoRole !== 'none' || def.active === false) return null;
      const qty = Math.max(0, Number(row && row.qty) || 0);
      if(!(qty > 0)) return null;
      const priced = calculateManualRateLine(def, qty, catalog);
      return {
        key: utils.slug(def && def.name || def && def.id || ''),
        type:'quote-rate',
        category: String(def && def.category || ''),
        name: String(def && def.name || 'Czynność'),
        qty,
        unit:'x',
        unitPrice:Number(priced.unitPrice) || 0,
        total:Number(priced.total) || 0,
        hours:Number(priced.hours) || 0,
        note:String(priced.note || '').trim(),
        internalOnly:def && def.internalOnly === true,
      };
    }).filter(Boolean);
  }

  FC.wycenaCoreOffer = {
    collectCommercialDraft,
    getOfferDraft,
    collectQuoteRateLines,
  };
})();
