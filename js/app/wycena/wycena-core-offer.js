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

  function collectQuoteRateLines(){
    const draft = getOfferDraft();
    const selections = Array.isArray(draft && draft.rateSelections) ? draft.rateSelections : [];
    const catalog = FC.catalogSelectors && typeof FC.catalogSelectors.getQuoteRates === 'function' ? FC.catalogSelectors.getQuoteRates() : [];
    return selections.map((row)=>{
      const rate = (Array.isArray(catalog) ? catalog : []).find((item)=> String(item && item.id || '') === String(row && row.rateId || '')) || null;
      if(!rate) return null;
      const autoRole = String(rate && rate.autoRole || 'none');
      const usage = String(rate && rate.usage || 'manual');
      if(autoRole !== 'none' || usage !== 'manual' || rate.internalOnly === true) return null;
      const qty = Math.max(0, Number(row && row.qty) || 0);
      if(!(qty > 0)) return null;
      const unitPrice = Math.max(0, Number(rate && rate.price) || 0);
      return {
        key: utils.slug(rate && rate.name || rate && rate.id || ''),
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

  FC.wycenaCoreOffer = {
    collectCommercialDraft,
    getOfferDraft,
    collectQuoteRateLines,
  };
})();
